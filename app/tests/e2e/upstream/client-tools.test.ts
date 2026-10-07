/**
 * E2E (real CLI, behind UPSTREAM_E2E=1): the SDK's tool loop through the whole surface (spec
 * section 7, ADR 0001). The first request ends with `stop_reason: tool_use` and upstream's own
 * `tool_use` block; the second carries the client's `tool_result` and continues the same run,
 * whose answer uses the result. Scenario 6 holds the park longer than five minutes, past the
 * CLI's default HTTP MCP idle timeout, which the run's `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` raises
 * above the park TTL; the run must still complete on delivery.
 *
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/client-tools.test.ts
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/client-tools.test.ts -t 'scenario 6'
 *
 * Optional: `UPSTREAM_E2E_MODEL`, `UPSTREAM_E2E_PARK_MS` (scenario 6's park, default 5.5 min).
 */
import type Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ControlServer, createControlServer } from '../../../src/upstream/control-server';
import { createSpawnRunner, Runner, RunSpec } from '../../../src/upstream/runner';
import { openStateDirectory, StateDirectory } from '../../../src/upstream/state-directory';
import type { SurfaceHarness } from '../../mocks/anthropic/surface-harness';
import { waitFor } from '../../mocks/shared/wait-for';
import { describeUpstream, E2E_MODEL, removeStateRoot } from './harness';

const RUN_EXIT_WAIT_MS = 60_000;
const PARK_MS = Number(process.env['UPSTREAM_E2E_PARK_MS'] ?? 330_000);
const CLI_MCP_IDLE_DEFAULT_MS = 300_000;
const WEATHER: Anthropic.Tool = {
  name: 'get_weather',
  description: 'Get the current weather for a city. Returns a JSON object.',
  input_schema: { type: 'object', properties: { city: { type: 'string', description: 'City name, e.g. Paris' } }, required: ['city'] }
};
const ASK: Anthropic.MessageParam = {
  role: 'user',
  content: 'Use the get_weather tool for Paris, then reply with one short sentence about the weather there. Do not call any other tool.'
};
const REQUEST = { model: E2E_MODEL, max_tokens: 1024, tools: [WEATHER] };
const WEATHER_RESULT = JSON.stringify({ city: 'Paris', temp_c: 18, sky: 'overcast' });

const textOf = (message: Anthropic.Message): string =>
  message.content.filter(block => block.type === 'text').map(block => (block as Anthropic.TextBlock).text).join('');
const toolUses = (message: Anthropic.Message) =>
  message.content.filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use');
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** The production spawn runner, noting each run's spec (never logged: it carries the token). */
function notingRunner(specs: RunSpec[]): Runner {
  const runner = createSpawnRunner();
  return { startRun: spec => { specs.push(spec); return runner.startRun(spec); } };
}

/** Built here, not imported at the top: a skipped file must not start the OpenAI surface's timers. */
async function productionSurface(state: StateDirectory, runner: Runner, controlServer: ControlServer): Promise<SurfaceHarness> {
  const { createServer } = await import('../../../src/api/server');
  const { serveApp } = await import('../../mocks/anthropic/surface-harness');
  return serveApp(createServer({ stateDirectory: state, runner, controlServer }));
}

describeUpstream('client tools through the surface against the real CLI', () => {
  let root: string;
  let state: StateDirectory;
  let surface: SurfaceHarness;
  let controlServer: ControlServer;
  let specs: RunSpec[];

  /** A run's directory goes once it has exited; a parked run is still there. */
  const runsExited = () => waitFor(() => fs.readdirSync(state.runs).length === 0, RUN_EXIT_WAIT_MS);

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'client-tools-e2e-'));
    state = openStateDirectory(root);
    specs = [];
    controlServer = createControlServer();
    surface = await productionSurface(state, notingRunner(specs), controlServer);
  });

  afterEach(async () => {
    await runsExited();
    await surface.close();
    await controlServer.close();
    removeStateRoot(root, state.cwd);
  }, RUN_EXIT_WAIT_MS + 10_000);

  /** Asks, parks, waits `parkMs`, answers; returns both messages. */
  async function roundTrip(parkMs: number): Promise<{ parked: Anthropic.Message; answer: Anthropic.Message }> {
    const client = surface.client({ timeout: parkMs + 120_000 });
    const parked = await client.messages.create({ ...REQUEST, messages: [ASK] });
    expect(fs.readdirSync(state.runs)).toHaveLength(1);
    await sleep(parkMs);
    const answer = await client.messages.stream({
      ...REQUEST,
      messages: [ASK, { role: 'assistant', content: parked.content },
        { role: 'user', content: toolUses(parked).map(block => ({ type: 'tool_result' as const, tool_use_id: block.id, content: WEATHER_RESULT })) }]
    }).finalMessage();
    return { parked, answer };
  }

  it('parks on upstream’s own tool_use and answers from the genuine result in the same run', async () => {
    const { parked, answer } = await roundTrip(3_000);

    expect(parked.stop_reason).toBe('tool_use');
    expect(toolUses(parked)).toEqual([expect.objectContaining({
      id: expect.stringMatching(/^toolu_/), name: 'get_weather', input: expect.objectContaining({ city: expect.any(String) })
    })]);
    expect(answer.stop_reason).toBe('end_turn');
    expect(textOf(answer)).toMatch(/overcast|18/i);
    expect(specs).toHaveLength(1);
    expect(specs[0]?.flags).toContain('--mcp-config');
  }, 240_000);

  it('scenario 6: completes on delivery after a park longer than five minutes', async () => {
    const { answer } = await roundTrip(PARK_MS);

    expect(PARK_MS).toBeGreaterThan(CLI_MCP_IDLE_DEFAULT_MS);
    expect(Number(specs[0]?.env['CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT'])).toBeGreaterThan(PARK_MS);
    expect(answer.stop_reason).toBe('end_turn');
    expect(textOf(answer)).toMatch(/overcast|18/i);
    expect(specs).toHaveLength(1);
  }, PARK_MS + 300_000);
});
