/**
 * E2E (real CLI, behind UPSTREAM_E2E=1), scenario 5: `count_tokens` end to end (spec section 12).
 * The surface measures a request with a run of its own: capped at one output token
 * (`CLAUDE_CODE_MAX_OUTPUT_TOKENS=1`), persisting no session (`--no-session-persistence`). The
 * answer is the run's first `message_delta`: its input count plus both cache counters, which
 * includes the residual context upstream adds (about 500 tokens on an empty system prompt). The
 * run is interrupted there, so upstream's auto-continuation after the cap costs at most one more
 * call, and no transcript is written.
 *
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/count-tokens.test.ts
 *
 * The model is `UPSTREAM_E2E_MODEL` (default Haiku 4.5); `UPSTREAM_E2E_5X_MODEL` (default
 * `claude-sonnet-5-5`) is the model measured under its default adaptive thinking. Seven
 * one-token counts and one short Messages turn, plus at most one auto-continued call per count;
 * the counts are printed.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Frame } from '../../../src/upstream/frames';
import { Runner } from '../../../src/upstream/runner';
import { openStateDirectory, StateDirectory } from '../../../src/upstream/state-directory';
import type { SurfaceHarness } from '../../mocks/anthropic/surface-harness';
import { waitFor } from '../../mocks/shared/wait-for';
import { describeUpstream, E2E_MODEL, removeStateRoot } from './harness';
import { modelCallStarts, sessionOf, TeeingRunner, teeingRunner } from './teeing-runner';

const HAIKU = 'claude-haiku-4-5-20251001';
const FIVE_X_MODEL = process.env['UPSTREAM_E2E_5X_MODEL'] ?? 'claude-sonnet-5-5';
/** "Reply with the single word pong." is a handful of tokens; anything above this is the residual context. */
const RESIDUAL_FLOOR = 300;
const RUN_EXIT_WAIT_MS = 60_000;
const TIMEOUT_MS = 180_000;

const WEATHER = {
  name: 'get_weather',
  description: 'Get the current weather for a city. Returns a JSON object with the temperature and conditions.',
  input_schema: { type: 'object' as const, properties: { city: { type: 'string', description: 'City name, e.g. Paris' } } }
};

const body = (fields: object = {}) => ({
  model: E2E_MODEL, messages: [{ role: 'user' as const, content: 'Reply with the single word pong.' }], ...fields
});

/** Built here, not imported at the top: a skipped file must not start the OpenAI surface's timers. */
async function productionSurface(state: StateDirectory, runner: Runner): Promise<SurfaceHarness> {
  const { createServer } = await import('../../../src/api/server');
  const { serveApp } = await import('../../mocks/anthropic/surface-harness');
  return serveApp(createServer({ stateDirectory: state, runner }));
}

const projectDirectory = (cwd: string): string =>
  path.join(os.homedir(), '.claude', 'projects', fs.realpathSync(cwd).replace(/[^a-zA-Z0-9]/g, '-'));

/** Upstream's first main-thread `message_delta`: its stop reason and its three input counters summed. */
function firstDelta(frames: readonly Frame[]): { stopReason: unknown; input: number } | undefined {
  for (const frame of frames) {
    if (frame.type !== 'stream_event' || frame.parent_tool_use_id != null || frame.event.type !== 'message_delta') continue;
    const { usage, delta } = frame.event;
    const counter = (name: string) => (typeof usage[name] === 'number' ? usage[name] as number : 0);
    return {
      stopReason: delta['stop_reason'],
      input: counter('input_tokens') + counter('cache_creation_input_tokens') + counter('cache_read_input_tokens')
    };
  }
  return undefined;
}

describeUpstream('scenario 5: count_tokens end to end, against the real CLI', () => {
  let root: string;
  let state: StateDirectory;
  let runner: TeeingRunner;
  let surface: SurfaceHarness;

  const runsExited = () => waitFor(() => fs.readdirSync(state.runs).length === 0, RUN_EXIT_WAIT_MS);

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'count-tokens-e2e-'));
    state = openStateDirectory(root);
    runner = teeingRunner();
    surface = await productionSurface(state, runner);
  });

  afterEach(async () => {
    await runsExited();
    await surface.close();
    removeStateRoot(root, state.cwd);
  }, RUN_EXIT_WAIT_MS + 10_000);

  it("answers the first message_delta's input counters, residual context included, and persists nothing", async () => {
    const { input_tokens: count } = await surface.client().messages.countTokens(body());

    await runsExited();
    const run = runner.runs[0];
    const measured = firstDelta(run?.frames ?? []);
    console.info(`[scenario 5] count ${count}; first message_delta stop_reason ${String(measured?.stopReason)}; ` +
      `model calls started: ${modelCallStarts(run?.frames ?? [])}`);
    expect(run?.spec.env['CLAUDE_CODE_MAX_OUTPUT_TOKENS']).toBe('1');
    expect(run?.spec.flags).toContain('--no-session-persistence');
    expect(count).toBe(measured?.input);
    expect(count).toBeGreaterThan(RESIDUAL_FLOOR);
    // Interrupted at the measurement: the auto-continuation after the cap starts at most one more call.
    expect(modelCallStarts(run?.frames ?? [])).toBeLessThanOrEqual(2);
    const session = sessionOf(run?.frames ?? []);
    expect(session).toBeDefined();
    expect(fs.existsSync(path.join(projectDirectory(state.cwd), `${session}.jsonl`))).toBe(false);
  }, TIMEOUT_MS);

  it('equals the input of the Messages turn it measures', async () => {
    const { input_tokens: count } = await surface.client().messages.countTokens(body());
    const { usage } = await surface.client().messages.create({ ...body(), max_tokens: 16 });

    const turnInput = usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
    console.info(`[scenario 5] count ${count}; the Messages turn's input ${turnInput}`);
    expect(count).toBe(turnInput);
  }, TIMEOUT_MS);

  it("counts the client tools' definitions: the bridge server is mounted for the run", async () => {
    const { input_tokens: without } = await surface.client().messages.countTokens(body());
    const { input_tokens: withTool } = await surface.client().messages.countTokens(body({ tools: [WEATHER] }));

    console.info(`[scenario 5] count without the tool ${without}, with it ${withTool}`);
    expect(runner.runs[1]?.spec.flags).toContain('--mcp-config');
    expect(withTool).toBeGreaterThan(without);
  }, TIMEOUT_MS);

  it('measures a 5.x model under its default adaptive thinking', async () => {
    const { input_tokens: count } = await surface.client().messages.countTokens(body({ model: FIVE_X_MODEL }));

    console.info(`[scenario 5] count on ${FIVE_X_MODEL}: ${count}`);
    expect(count).toBeGreaterThan(RESIDUAL_FLOOR);
  }, TIMEOUT_MS);

  it('measures a Haiku thinking budget with thinking off: the same input as without one', async () => {
    const thinking = { type: 'enabled' as const, budget_tokens: 2048 };
    const { input_tokens: budgeted } = await surface.client().messages.countTokens(body({ model: HAIKU, thinking }));
    const { input_tokens: plain } = await surface.client().messages.countTokens(body({ model: HAIKU }));

    console.info(`[scenario 5] Haiku count with a thinking budget ${budgeted}, without ${plain}`);
    expect(runner.runs[0]?.spec.env['MAX_THINKING_TOKENS']).toBeUndefined();
    expect(budgeted).toBe(plain);
  }, TIMEOUT_MS);
});
