/**
 * E2E scenario 1 (real CLI, behind UPSTREAM_E2E=1): a model call failing after it has streamed
 * content (spec sections 11 and 13). Nobody has seen upstream's shape for this yet: whether it
 * emits `api_retry` and a fresh `message_start` (trigger i) or an error `result` (trigger ii).
 * The failure is injected: upstream's `ANTHROPIC_BASE_URL` points at a loopback proxy
 * (`fault-proxy.ts`) that breaks the turn's first streamed response after its first
 * `content_block_delta`, with an SSE `overloaded_error` event (`UPSTREAM_E2E_FAULT=cut` drops
 * the connection instead).
 *
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/failure-after-content.test.ts
 *
 * The first test records upstream's frames to `UPSTREAM_E2E_RECORD_DIR` (default: a temp
 * directory) and prints which trigger fired. To keep the shape as a fixture, follow "Recording
 * an observed failure" in `tests/fixtures/upstream/README.md`. The second drives the whole
 * surface with the SDK: the turn must end in the SSE `error` event with a mapped type.
 *
 * Unproven: that the CLI honours `ANTHROPIC_BASE_URL` on the operator's login. If the proxy sees
 * no `/v1/messages` request the test says so; put an API key in `CLAUDE_WRAPPER_UPSTREAM_ENV`.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createTranslator } from '../../../src/anthropic/translate';
import { ANTHROPIC_SETTING_ENV } from '../../../src/config/anthropic-settings';
import { EnvironmentManager } from '../../../src/config/env';
import { Frame } from '../../../src/upstream/frames';
import { openStateDirectory, StateDirectory } from '../../../src/upstream/state-directory';
import type { SurfaceHarness } from '../../mocks/anthropic/surface-harness';
import { waitFor } from '../../mocks/shared/wait-for';
import { createUpstreamHarness, describeUpstream, E2E_MODEL, firstMessage, removeStateRoot } from './harness';
import { FaultMode, FaultProxy, startFaultProxy } from './fault-proxy';

const MARKER = 'e2e-fault-7f3a';
const PROMPT = `Count from 1 to 60, one number per line, nothing else. (${MARKER})`;
const MODE: FaultMode = process.env['UPSTREAM_E2E_FAULT'] === 'cut' ? 'cut' : 'error_event';
const MAPPED_TYPES = ['api_error', 'overloaded_error', 'rate_limit_error', 'timeout_error'];
const RUN_MS = 180_000;

/** Which of section 11's triggers ended the turn, read by feeding the frames to the translator. */
function firedTrigger(frames: Frame[]): { trigger: string; errorType?: string } {
  const translator = createTranslator({ logger: { debug: () => undefined } });
  let ended = false;
  for (const frame of frames) {
    const events = translator.push(frame);
    const fail = events.find(event => event.type === 'fail');
    if (fail?.type === 'fail') {
      const trigger = frame.type === 'stream_event' ? '(i) message_start while a block was open'
        : frame.type === 'result' ? '(ii) failed result before the final message_stop'
          : `(fail fast) ${frame.type === 'system' ? frame.subtype : frame.type}`;
      return { trigger, errorType: fail.error.type };
    }
    ended ||= events.some(event => event.type === 'message_stop');
  }
  return { trigger: ended ? 'none: the turn completed' : '(iii) the run ended before the turn' };
}

function record(frames: Frame[], summary: object): string {
  const dir = process.env['UPSTREAM_E2E_RECORD_DIR'] ?? fs.mkdtempSync(path.join(os.tmpdir(), 'scenario-1-'));
  const file = path.join(dir, `scenario-1-failure-after-content-${MODE}.jsonl`);
  const lines = frames.map(frame => JSON.stringify(frame.type === 'unknown' ? frame.raw : frame));
  fs.writeFileSync(file, lines.join('\n') + '\n');
  fs.writeFileSync(file.replace(/\.jsonl$/, '.summary.json'), JSON.stringify(summary, null, 2) + '\n');
  return file;
}

/** The operator's `upstream.env` with the proxy as the API's base URL. */
function proxiedUpstreamEnv(proxy: FaultProxy): string {
  return JSON.stringify({ ...EnvironmentManager.getAnthropicSettings().upstreamEnv, ANTHROPIC_BASE_URL: proxy.url });
}

describeUpstream('scenario 1: a model call failing after it has streamed content', () => {
  let proxy: FaultProxy;

  beforeEach(async () => {
    proxy = await startFaultProxy({ marker: MARKER, mode: MODE });
  });

  afterEach(async () => {
    await proxy.close();
  });

  describe('the raw run', () => {
    const harness = createUpstreamHarness();

    afterEach(async () => {
      await harness.cleanup();
    });

    it('records the shape and names the trigger that fired', async () => {
      const { run, plan } = harness.start({ prompt: PROMPT, env: { ANTHROPIC_BASE_URL: proxy.url } });

      const { frames, exit } = await harness.complete(run, firstMessage(plan));

      expect(proxy.messagesRequests()).toBeGreaterThan(0);
      expect(proxy.faulted()).toBe(true);
      const fired = firedTrigger(frames);
      const file = record(frames, { mode: MODE, model: E2E_MODEL, ...fired, exit: { code: exit.code, signal: exit.signal } });
      process.stdout.write(`\nscenario 1 (${MODE}): ${fired.trigger}, ${fired.errorType ?? 'no fail'}; recorded ${file}\n`);
      expect(fired.trigger).toMatch(/^\((i|ii)\) /);
      expect(MAPPED_TYPES).toContain(fired.errorType);
    }, RUN_MS);
  });

  describe('through the surface', () => {
    const variable = ANTHROPIC_SETTING_ENV.upstreamEnv;
    const operatorValue = process.env[variable];
    let root: string;
    let state: StateDirectory;
    let surface: SurfaceHarness | undefined;

    beforeEach(async () => {
      process.env[variable] = proxiedUpstreamEnv(proxy);
      root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-e2e-'));
      state = openStateDirectory(root);
      // Imported here, not at the top: importing the app starts timers a skipped file never stops.
      const { createServer } = await import('../../../src/api/server');
      const { serveApp } = await import('../../mocks/anthropic/surface-harness');
      surface = await serveApp(createServer({ stateDirectory: state }));
    });

    afterEach(async () => {
      if (operatorValue === undefined) delete process.env[variable];
      else process.env[variable] = operatorValue;
      await surface?.close();
      removeStateRoot(root, state.cwd);
    });

    it('ends the stream with the SSE error event and a mapped type', async () => {
      const { rejectionOf } = await import('../../mocks/anthropic/surface-harness');
      const client = (surface as SurfaceHarness).client();

      const stream = client.messages.stream({
        model: E2E_MODEL, max_tokens: 1024, messages: [{ role: 'user', content: PROMPT }]
      });
      const texts: string[] = [];
      stream.on('text', text => texts.push(text));
      const error = await rejectionOf(stream.finalMessage());

      expect(proxy.faulted()).toBe(true);
      expect(texts.length).toBeGreaterThan(0);
      expect(error.status).toBeUndefined();
      expect(MAPPED_TYPES).toContain(error.type);
      await waitFor(() => fs.readdirSync(state.runs).length === 0, 60_000);
    }, RUN_MS);
  });
});
