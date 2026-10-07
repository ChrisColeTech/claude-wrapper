/**
 * E2E scenario 9 (real CLI, behind UPSTREAM_E2E=1): a connector round trip against a real `https`
 * MCP server through the whole surface (spec section 9). A beta client's `mcp_servers` reaches
 * upstream as an `http` entry with `alwaysLoad` in the run's MCP config file; `system/init` must
 * report it `connected` and list its tools; upstream calls it itself and the client gets
 * `mcp_tool_use` and `mcp_tool_result` blocks with the server split out, in one message. The
 * not-connected path: a server nothing answers at must fail the turn before commit with a 400
 * naming it (and inside the startup timer, the connect wait being capped by
 * `MCP_CONNECT_TIMEOUT_MS` and `MCP_TIMEOUT`). The round trip spends one model turn or two; the
 * failure path at most the start of one.
 *
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/connectors.test.ts
 *
 * Optional: `UPSTREAM_E2E_CONNECTOR_URL` (default `https://mcp.deepwiki.com/mcp`, DeepWiki's
 * public MCP server, no token needed), `UPSTREAM_E2E_CONNECTOR_NAME` (default `deepwiki`),
 * `UPSTREAM_E2E_CONNECTOR_TOKEN` (sent as `authorization_token`), `UPSTREAM_E2E_CONNECTOR_PROMPT`
 * (a prompt that makes the model call one of that server's tools), `UPSTREAM_E2E_DEAD_CONNECTOR_URL`
 * (default `https://127.0.0.1:9/mcp`, a port nothing listens on), `UPSTREAM_E2E_MODEL`,
 * `CLAUDE_COMMAND`. With `UPSTREAM_E2E_RECORD_DIR` set, each run's frames are written there as
 * `connector-round-trip.jsonl` and `connector-not-connected.jsonl`; the fixtures of those names
 * under `tests/fixtures/upstream/e2e-runs/` are the first run's (2026-10-07). Scrub a new recording
 * (`npm run fixtures:scrub`) before it becomes a fixture, and never commit one carrying a token.
 */
import type Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Frame } from '../../../src/upstream/frames';
import { openStateDirectory, StateDirectory } from '../../../src/upstream/state-directory';
import type { SurfaceHarness } from '../../mocks/anthropic/surface-harness';
import { waitFor } from '../../mocks/shared/wait-for';
import { describeUpstream, E2E_MODEL, productionSurface, removeStateRoot } from './harness';
import { recordFrames, TeeingRunner, teeingRunner } from './teeing-runner';

const URL_ = process.env['UPSTREAM_E2E_CONNECTOR_URL'] ?? 'https://mcp.deepwiki.com/mcp';
const NAME = process.env['UPSTREAM_E2E_CONNECTOR_NAME'] ?? 'deepwiki';
const TOKEN = process.env['UPSTREAM_E2E_CONNECTOR_TOKEN'];
const PROMPT = process.env['UPSTREAM_E2E_CONNECTOR_PROMPT'] ?? 'Call the read_wiki_structure tool exactly once for the GitHub '
  + 'repository modelcontextprotocol/typescript-sdk, then answer in one sentence naming one topic it lists.';
const DEAD_URL = process.env['UPSTREAM_E2E_DEAD_CONNECTOR_URL'] ?? 'https://127.0.0.1:9/mcp';
const MCP_BETA = 'mcp-client-2025-11-20';
const HOSTS = 'CLAUDE_WRAPPER_CONNECTOR_HOSTS';
const STARTUP_TIMER_MS = 20_000;
const RUN_EXIT_WAIT_MS = 60_000;
const TURN_TIMEOUT_MS = 240_000;

type BetaMessage = Anthropic.Beta.Messages.BetaMessage;
type BetaParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

function connector(name: string, url: string, token?: string): Pick<BetaParams, 'mcp_servers' | 'tools' | 'betas'> {
  return {
    betas: [MCP_BETA],
    mcp_servers: [{ type: 'url', url, name, ...(token ? { authorization_token: token } : {}) }],
    tools: [{ type: 'mcp_toolset', mcp_server_name: name }]
  };
}

const initOf = (frames: readonly Frame[]) =>
  frames.find(frame => frame.type === 'system' && frame.subtype === 'init') as Extract<Frame, { subtype: 'init' }> | undefined;

describeUpstream('connectors through the surface against the real CLI (spec section 9, e2e scenario 9)', () => {
  let root: string;
  let state: StateDirectory;
  let surface: SurfaceHarness;
  let runner: TeeingRunner;

  beforeEach(async () => {
    process.env[HOSTS] = [new URL(URL_).hostname, new URL(DEAD_URL).hostname].join(',');
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'connectors-e2e-'));
    state = openStateDirectory(root);
    runner = teeingRunner();
    surface = await productionSurface(state, { runner });
  });

  afterEach(async () => {
    await waitFor(() => fs.readdirSync(state.runs).length === 0, RUN_EXIT_WAIT_MS);
    delete process.env[HOSTS];
    await surface.close();
    removeStateRoot(root, state.cwd);
  }, RUN_EXIT_WAIT_MS + 10_000);

  it('round trip: the connector connects, upstream calls it, the client gets the MCP blocks', async () => {
    const message: BetaMessage = await surface.client({ timeout: TURN_TIMEOUT_MS }).beta.messages.stream({
      model: E2E_MODEL, max_tokens: 2048, messages: [{ role: 'user', content: PROMPT }], ...connector(NAME, URL_, TOKEN)
    }).finalMessage();
    await waitFor(() => fs.readdirSync(state.runs).length === 0, RUN_EXIT_WAIT_MS);
    const [run] = runner.runs;
    recordFrames('connector-round-trip', run?.frames ?? []);

    const init = initOf(run?.frames ?? []);
    expect(init?.mcp_servers).toContainEqual(expect.objectContaining({ name: NAME, status: 'connected' }));
    expect(init?.tools.some(tool => tool.startsWith(`mcp__${NAME}__`))).toBe(true);
    const config = JSON.parse(run?.spec.runDir?.files['mcp-config.json'] ?? '{}').mcpServers[NAME];
    expect(config).toEqual(expect.objectContaining({ type: 'http', url: URL_, alwaysLoad: true, timeout: 60_000 }));
    const uses = message.content.filter(block => block.type === 'mcp_tool_use');
    const results = message.content.filter(block => block.type === 'mcp_tool_result');
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.every(use => use.server_name === NAME && !use.name.startsWith('mcp__'))).toBe(true);
    expect(results.map(result => result.tool_use_id)).toEqual(uses.map(use => use.id));
    expect(message.content.filter(block => block.type === 'tool_use')).toEqual([]);
    expect(message.stop_reason).toBe('end_turn');
  }, TURN_TIMEOUT_MS + RUN_EXIT_WAIT_MS);

  it('not connected: a 400 before commit naming the server, inside the startup timer', async () => {
    const started = Date.now();
    const failure = await surface.client({ timeout: TURN_TIMEOUT_MS }).beta.messages.create({
      model: E2E_MODEL, max_tokens: 64, messages: [{ role: 'user', content: 'Reply with the word pong.' }], ...connector('dead', DEAD_URL)
    }).then(() => undefined, (error: unknown) => error as InstanceType<typeof Anthropic.APIError>);
    await waitFor(() => fs.readdirSync(state.runs).length === 0, RUN_EXIT_WAIT_MS);
    recordFrames('connector-not-connected', runner.runs[0]?.frames ?? []);

    expect(failure?.status).toBe(400);
    expect((failure?.error as { error: { message: string } }).error.message)
      .toMatch(/^mcp_servers: the MCP server "dead" is not connected \(/);
    expect(Date.now() - started).toBeLessThan(STARTUP_TIMER_MS);
  }, TURN_TIMEOUT_MS + RUN_EXIT_WAIT_MS);
});
