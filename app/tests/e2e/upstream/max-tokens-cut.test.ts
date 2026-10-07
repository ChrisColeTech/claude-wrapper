/**
 * E2E (real CLI, behind UPSTREAM_E2E=1), scenario 4: the interrupt racing upstream's
 * auto-continuation after a `max_tokens` cut (spec section 12, ADR 0004). Upstream does not stop
 * at its output cap: it asks the model to resume and calls it again. The surface relays the
 * capped call as the turn (`stop_reason: max_tokens`, `output_tokens` equal to the cap) and
 * interrupts the run at once. The race may cost one more capped call, never more; the session is
 * forgotten, so its transcript is gone once the run has exited.
 *
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/max-tokens-cut.test.ts
 *
 * The model is `UPSTREAM_E2E_MODEL` (default Haiku 4.5, thinking off as the surface runs it).
 * The number of model calls upstream started is printed.
 */
import type Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Frame } from '../../../src/upstream/frames';
import { Runner } from '../../../src/upstream/runner';
import { openStateDirectory, StateDirectory } from '../../../src/upstream/state-directory';
import type { SurfaceHarness } from '../../mocks/anthropic/surface-harness';
import { waitFor } from '../../mocks/shared/wait-for';
import { describeUpstream, E2E_MODEL, removeStateRoot } from './harness';
import { sessionOf, TeeingRunner, teeingRunner } from './teeing-runner';

const CAP = 48;
const RUN_EXIT_WAIT_MS = 60_000;
const request = {
  model: E2E_MODEL,
  max_tokens: CAP,
  messages: [{ role: 'user' as const, content: 'Write a long, detailed essay on the history of the tangerine.' }]
};

/** Built here, not imported at the top: a skipped file must not start the OpenAI surface's timers. */
async function productionSurface(state: StateDirectory, runner: Runner): Promise<SurfaceHarness> {
  const { createServer } = await import('../../../src/api/server');
  const { serveApp } = await import('../../mocks/anthropic/surface-harness');
  return serveApp(createServer({ stateDirectory: state, runner }));
}

const projectDirectory = (cwd: string): string =>
  path.join(os.homedir(), '.claude', 'projects', fs.realpathSync(cwd).replace(/[^a-zA-Z0-9]/g, '-'));

/** Main-thread model calls upstream started, and how many of them came after the first capped one. */
function modelCalls(frames: Frame[]): { total: number; afterCap: number } {
  let total = 0;
  let afterCap = 0;
  let capped = false;
  for (const frame of frames) {
    if (frame.type !== 'stream_event' || frame.parent_tool_use_id != null) continue;
    if (frame.event.type === 'message_start') {
      total += 1;
      if (capped) afterCap += 1;
    }
    if (frame.event.type === 'message_delta' && frame.event.delta['stop_reason'] === 'max_tokens') capped = true;
  }
  return { total, afterCap };
}

describeUpstream('scenario 4: the interrupt after a max_tokens cut, against the real CLI', () => {
  let root: string;
  let state: StateDirectory;
  let surface: SurfaceHarness;
  let runner: TeeingRunner;

  const runsExited = () => waitFor(() => fs.readdirSync(state.runs).length === 0, RUN_EXIT_WAIT_MS);

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'max-tokens-cut-e2e-'));
    state = openStateDirectory(root);
    runner = teeingRunner();
    surface = await productionSurface(state, runner);
  });

  afterEach(async () => {
    await runsExited();
    await surface.close();
    removeStateRoot(root, state.cwd);
  }, RUN_EXIT_WAIT_MS + 10_000);

  async function expectCut(message: Anthropic.Message): Promise<void> {
    expect(message.stop_reason).toBe('max_tokens');
    expect(message.usage.output_tokens).toBe(CAP);
    expect(message.content.some(block => block.type === 'text' && block.text.length > 0)).toBe(true);

    await runsExited();
    const frames = runner.runs.flatMap(run => run.frames);
    const calls = modelCalls(frames);
    console.info(`[scenario 4] upstream model calls: ${calls.total}, started after the cap: ${calls.afterCap}`);
    expect(calls.afterCap).toBeLessThanOrEqual(1);
    const session = sessionOf(frames);
    expect(session).toBeDefined();
    await waitFor(() => !fs.existsSync(path.join(projectDirectory(state.cwd), `${session}.jsonl`)), RUN_EXIT_WAIT_MS);
  }

  it('messages.create gets the capped call, and upstream makes at most one more', async () => {
    await expectCut(await surface.client().messages.create(request));
  }, 180_000);

  it('messages.stream().finalMessage() gets the capped call, and upstream makes at most one more', async () => {
    await expectCut(await surface.client().messages.stream(request).finalMessage());
  }, 180_000);
});
