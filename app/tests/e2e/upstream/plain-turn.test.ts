/**
 * E2E (real CLI, behind UPSTREAM_E2E=1): a plain turn through the whole surface, built with its
 * production runner (the operator's Claude Code, `CLAUDE_COMMAND` else `claude` on PATH) and
 * driven by the official SDK, non-streaming and streaming. `message.model` must be the resolved
 * canonical id. The prompt never asks about the account (redaction is a later ticket).
 *
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/plain-turn.test.ts
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { openStateDirectory, StateDirectory } from '../../../src/upstream/state-directory';
import { shippedCatalogue } from '../../mocks/anthropic/plan-context';
import type { SurfaceHarness } from '../../mocks/anthropic/surface-harness';
import { waitFor } from '../../mocks/shared/wait-for';
import { describeUpstream, E2E_MODEL, removeStateRoot } from './harness';

const PROMPT = 'Reply with the single word pong.';
const request = { model: E2E_MODEL, max_tokens: 1024, messages: [{ role: 'user' as const, content: PROMPT }] };
const RUN_EXIT_WAIT_MS = 60_000;
const REQUEST_ID = /^req_[0-9A-Za-z]{24}$/;

/**
 * Built here, not imported at the top: importing the app starts the OpenAI surface's streaming
 * timers, which only the shared per-test cleanup stops, so a skipped file would never exit.
 */
async function productionSurface(state: StateDirectory): Promise<SurfaceHarness> {
  const { createServer } = await import('../../../src/api/server');
  const { serveApp } = await import('../../mocks/anthropic/surface-harness');
  return serveApp(createServer({ stateDirectory: state }));
}

describeUpstream('a plain turn through the surface against the real CLI', () => {
  const resolvedModel = shippedCatalogue.resolve(E2E_MODEL)?.id;
  let root: string;
  let state: StateDirectory;
  let surface: SurfaceHarness;

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-e2e-'));
    state = openStateDirectory(root);
    surface = await productionSurface(state);
  });

  afterEach(async () => {
    // The response ends at message_stop; the run writes its result and exits after it.
    await waitFor(() => fs.readdirSync(state.runs).length === 0, RUN_EXIT_WAIT_MS);
    await surface.close();
    removeStateRoot(root, state.cwd);
  }, RUN_EXIT_WAIT_MS + 10_000);

  it('answers messages.create with the resolved model, the text and real usage', async () => {
    const { data: message, response } = await surface.client().messages.create(request).withResponse();

    expect(response.headers.get('request-id')).toMatch(REQUEST_ID);
    expect(message.model).toBe(resolvedModel);
    expect(message.stop_reason).toBe('end_turn');
    const text = message.content.filter(block => block.type === 'text').map(block => block.text).join('');
    expect(text.toLowerCase()).toContain('pong');
    expect(message.usage.input_tokens).toBeGreaterThan(0);
    expect(message.usage.output_tokens).toBeGreaterThan(0);
  }, 120_000);

  it("streams the turn in the API's order and finalMessage() holds the resolved model and real usage", async () => {
    const stream = surface.client().messages.stream(request);
    const events: string[] = [];
    stream.on('streamEvent', event => events.push(event.type));

    const message = await stream.finalMessage();

    expect(stream.request_id).toMatch(REQUEST_ID);
    expect(events[0]).toBe('message_start');
    expect(events.slice(-2)).toEqual(['message_delta', 'message_stop']);
    expect(events.filter(event => event === 'message_start')).toHaveLength(1);
    expect(message.model).toBe(resolvedModel);
    expect(message.content.some(block => block.type === 'text' && block.text.toLowerCase().includes('pong'))).toBe(true);
    expect(message.usage.output_tokens).toBeGreaterThan(0);
  }, 120_000);
});
