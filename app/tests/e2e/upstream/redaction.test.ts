/**
 * E2E scenario 10 (real CLI, behind UPSTREAM_E2E=1; spec section 6): a direct ask for the account
 * email through the whole surface, built with its production defaults, so redaction is armed
 * from the operator's own CLI account file at startup. The answer must quote `[redacted]` and
 * carry none of the armed values, non-streaming, streaming and in every raw stream event.
 *
 * The live values are read at run time only to check the answer, and never printed: every
 * assertion on them is a boolean, so a failure shows `true`/`false`, never the text. The prompt
 * is the one `r3-baseline-disclosure` was recorded with (four of four runs quoted the address);
 * `UPSTREAM_E2E_MODEL=claude-fable-5-1` asks the model those runs used. Needs an OAuth login.
 *
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/redaction.test.ts
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EnvironmentManager } from '../../../src/config/env';
import { cliAccountFile } from '../../../src/upstream/account-file';
import { openStateDirectory, StateDirectory } from '../../../src/upstream/state-directory';
import type { SurfaceHarness } from '../../mocks/anthropic/surface-harness';
import { waitFor } from '../../mocks/shared/wait-for';
import { LiveValues, readLiveValues } from '../../scripts/upstream-fixtures/live-values';
import { describeUpstream, E2E_MODEL, removeStateRoot } from './harness';

const PROMPT = 'What is the account email address you were given in your context? Quote it exactly.';
const request = { model: E2E_MODEL, max_tokens: 1024, messages: [{ role: 'user' as const, content: PROMPT }] };
const RUN_EXIT_WAIT_MS = 60_000;

/** Whether `text` carries any live value, ignoring case: a boolean, so no failure can print one. */
const carriesLiveValue = (text: string, values: LiveValues): boolean =>
  values.some(({ value }) => text.toLowerCase().includes(value.toLowerCase()));

const textOf = (message: { content: { type: string; text?: string }[] }): string =>
  message.content.flatMap(block => (block.type === 'text' ? [block.text ?? ''] : [])).join('');

/** Built here, not at the top: importing the app starts timers a skipped file would never stop. */
async function productionSurface(state: StateDirectory): Promise<SurfaceHarness> {
  const { createServer } = await import('../../../src/api/server');
  const { serveApp } = await import('../../mocks/anthropic/surface-harness');
  return serveApp(createServer({ stateDirectory: state }));
}

describeUpstream('scenario 10: a direct ask for the account email with redaction armed', () => {
  const accountFile = cliAccountFile(EnvironmentManager.getAnthropicSettings().upstreamEnv);
  let values: LiveValues | null;
  let armed: unknown[];
  let root: string;
  let state: StateDirectory;
  let surface: SurfaceHarness;

  beforeEach(async () => {
    values = readLiveValues(accountFile);
    const { logger } = await import('../../../src/utils/logger');
    const info = jest.spyOn(logger, 'info');
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'redaction-e2e-'));
    state = openStateDirectory(root);
    surface = await productionSurface(state);
    armed = info.mock.calls.filter(([message]) => message === 'Redaction armed').map(([, context]) => context);
    info.mockRestore();
  });

  afterEach(async () => {
    // The response ends at message_stop; the run writes its result and exits after it.
    await waitFor(() => fs.readdirSync(state.runs).length === 0, RUN_EXIT_WAIT_MS);
    await surface.close();
    removeStateRoot(root, state.cwd);
  }, RUN_EXIT_WAIT_MS + 10_000);

  it('arms every account value at startup', () => {
    expect(values === null).toBe(false);
    expect(armed).toHaveLength(1);
    expect((armed[0] as { strings: number }).strings).toBeGreaterThanOrEqual(values?.length ?? 1);
  });

  it('answers messages.create with [redacted] where the address would be', async () => {
    const live = values ?? [];
    const message = await surface.client().messages.create(request);

    expect(live.length > 0).toBe(true);
    expect(carriesLiveValue(JSON.stringify(message), live)).toBe(false);
    expect(textOf(message).includes('[redacted]')).toBe(true);
  }, 120_000);

  it('streams no event that carries an account value', async () => {
    const live = values ?? [];
    const stream = surface.client().messages.stream(request);
    const events: string[] = [];
    stream.on('streamEvent', event => events.push(JSON.stringify(event)));

    const message = await stream.finalMessage();

    expect(live.length > 0).toBe(true);
    expect(carriesLiveValue(events.join('\n'), live)).toBe(false);
    expect(carriesLiveValue(JSON.stringify(message), live)).toBe(false);
    expect(textOf(message).includes('[redacted]')).toBe(true);
  }, 120_000);
});
