/**
 * Connectors through the official beta SDK client (spec sections 9, 10, 11 and 16). With the
 * operator's host list set, a `client.beta.messages` request with `mcp_servers` and its
 * `mcp_toolset` reaches upstream as one `http` entry in the run's MCP config file (the token only
 * there), and a replayed connector run comes back as one message carrying `mcp_tool_use` and
 * `mcp_tool_result` blocks. The connector recordings are e2e scenario 9's real runs. A connector
 * upstream reports not connected fails the turn before commit with a 400 naming it; every
 * validation 400 is raised before anything is spawned.
 */
import Anthropic from '@anthropic-ai/sdk';
import { inspect } from 'util';
import { EnvironmentManager } from '../../../src/config/env';
import { createReplayRunner, ReplayRunner } from '../../../src/upstream/runner';
import { logger } from '../../../src/utils/logger';
import {
  connectorRequest, MCP_BETA, NOT_CONNECTED, RECORDED_MODEL, recordedAnswer, recordedCalls, recordedResult, recordedToolResults,
  ROUND_TRIP
} from '../../mocks/anthropic/connector-recordings';
import { STATE } from '../../mocks/anthropic/plan-context';
import { envelopeOf, rejectionOf, SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { initFrame } from '../../mocks/anthropic/turn-frames';
import { loadRecording } from '../../mocks/upstream/recordings';
import { createScriptedRunner, ScriptedRunner } from '../../mocks/upstream/scripted-runner';

const HOSTS = 'CLAUDE_WRAPPER_CONNECTOR_HOSTS';
const TOKEN = 'connector-secret-7f3a9c';
const MCP_CONFIG = 'mcp-config.json';

type BetaParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

function request(server: string, token?: string): BetaParams {
  const { mcp_servers, tools } = connectorRequest(server);
  return {
    model: RECORDED_MODEL, max_tokens: 1024, betas: [MCP_BETA],
    messages: [{ role: 'user', content: 'Use the connector.' }],
    mcp_servers: mcp_servers.map(entry => ({ ...entry, ...(token ? { authorization_token: token } : {}) })),
    tools
  } as unknown as BetaParams;
}

const flagValue = (flags: readonly string[], flag: string) => flags[flags.indexOf(flag) + 1];

describe('Anthropic surface: a replayed connector run through the beta SDK', () => {
  let surface: SurfaceHarness;
  let runner: ReplayRunner;

  async function start(recording: string): Promise<void> {
    runner = createReplayRunner([loadRecording(recording)], { timeScale: 0 });
    surface = await startSurface({ runner, stateDirectory: STATE });
  }

  beforeEach(() => {
    process.env[HOSTS] = 'deepwiki.example.com, dead.example.com';
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    delete process.env[HOSTS];
    await surface?.close();
  });

  it.each([
    ['beta.messages.create', (client: Anthropic, params: BetaParams) => client.beta.messages.create(params)],
    ['beta.messages.stream().finalMessage()', (client: Anthropic, params: BetaParams) => client.beta.messages.stream(params).finalMessage()]
  ])('%s: the call and its result as MCP blocks, then the answer', async (_name, send) => {
    await start(ROUND_TRIP);
    const message = await send(surface.client(), request('deepwiki', TOKEN));
    const [call] = recordedCalls(ROUND_TRIP);
    const [result] = recordedToolResults(ROUND_TRIP);

    expect(message.content.map(block => block.type)).toEqual(['text', 'mcp_tool_use', 'mcp_tool_result', 'text']);
    expect(message.content[1]).toEqual({
      type: 'mcp_tool_use', id: call?.id, name: 'read_wiki_structure', server_name: 'deepwiki', input: call?.input
    });
    // Upstream's real connector result is a string, which becomes one text block.
    expect(typeof result?.['content']).toBe('string');
    expect(message.content[2]).toEqual({ type: 'mcp_tool_result', tool_use_id: call?.id, is_error: false,
      content: [{ type: 'text', text: result?.['content'] }] });
    expect(message.content[3]).toEqual({ type: 'text', text: recordedAnswer(ROUND_TRIP) });
    expect(message.stop_reason).toBe('end_turn');
    expect(message.usage.input_tokens).toBe(recordedResult(ROUND_TRIP).usage['input_tokens']);
  });

  it("mounts the connector in the run's MCP config file, its token only there", async () => {
    await start(ROUND_TRIP);
    await surface.client().beta.messages.create(request('deepwiki', TOKEN));
    const { spec } = runner.started[0]!;

    expect(JSON.parse(spec.runDir?.files[MCP_CONFIG] ?? '{}')).toEqual({ mcpServers: { deepwiki: {
      type: 'http', url: 'https://deepwiki.example.com/mcp', headers: { Authorization: `Bearer ${TOKEN}` }, alwaysLoad: true, timeout: 60_000
    } } });
    expect(flagValue(spec.flags, '--mcp-config')).toBe(`${spec.runDir?.path}/${MCP_CONFIG}`);
    expect(flagValue(spec.flags, '--allowedTools')).toBe('mcp__deepwiki');
    expect(JSON.stringify(spec.flags)).not.toContain(TOKEN);
    expect(JSON.stringify(spec.env)).not.toContain(TOKEN);
  });

  it('streams the round trip as one message, its result after its call', async () => {
    await start(ROUND_TRIP);
    const events: Anthropic.Beta.Messages.BetaRawMessageStreamEvent[] = [];
    for await (const event of await surface.client().beta.messages.create({ ...request('deepwiki'), stream: true })) events.push(event);
    const starts = events.flatMap(event => (event.type === 'content_block_start' ? [event.content_block] : []));

    expect(events.filter(event => event.type === 'message_start')).toHaveLength(1);
    expect(starts.map(block => block.type)).toEqual(['text', 'mcp_tool_use', 'mcp_tool_result', 'text']);
  });

  it('answers a connector the recorded run reported failed with a 400 naming it, before commit', async () => {
    await start(NOT_CONNECTED);

    const error = await rejectionOf(surface.client().beta.messages.create(request('dead')));

    expect(error).toBeInstanceOf(Anthropic.BadRequestError);
    expect(envelopeOf(error).error).toEqual({
      type: 'invalid_request_error', message: 'mcp_servers: the MCP server "dead" is not connected (status "failed")'
    });
  });

  it('measures a count_tokens request with the connector mounted', async () => {
    await start(ROUND_TRIP);
    const { max_tokens: _max, ...countParams } = request('deepwiki', TOKEN);
    const counted = await surface.client().beta.messages.countTokens(countParams as Anthropic.Beta.Messages.MessageCountTokensParams);
    const { spec } = runner.started[0]!;
    const usage = recordedResult(ROUND_TRIP).usage as Record<string, number>;

    expect(spec.flags).toContain('--no-session-persistence');
    expect(JSON.parse(spec.runDir?.files[MCP_CONFIG] ?? '{}').mcpServers.deepwiki.headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
    expect(counted.input_tokens).toBe(usage['input_tokens']! + usage['cache_creation_input_tokens']! + usage['cache_read_input_tokens']!);
  });

  it("keeps the token out of debug mode's request log, which prints the body, though the run gets it", async () => {
    jest.spyOn(EnvironmentManager, 'isDebugMode').mockReturnValue(true);
    await start(ROUND_TRIP);
    const http = jest.spyOn(logger, 'http').mockImplementation(() => undefined);
    const info = jest.spyOn(logger, 'info');
    await surface.client().beta.messages.create(request('deepwiki', TOKEN));
    const logged = [...http.mock.calls, ...info.mock.calls].map(call => `${JSON.stringify(call)} ${inspect(call, { depth: null })}`);

    expect(logged.some(line => line.includes('mcp_servers'))).toBe(true);
    expect(logged.some(line => line.includes(TOKEN))).toBe(false);
    expect(runner.started[0]!.spec.runDir?.files[MCP_CONFIG]).toContain(TOKEN);
  });
});

describe('Anthropic surface: a connector upstream reports not connected (scripted runner)', () => {
  let surface: SurfaceHarness;
  let runner: ScriptedRunner;

  beforeEach(async () => {
    process.env[HOSTS] = '*';
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    runner = createScriptedRunner();
    surface = await startSurface({ runner, stateDirectory: STATE });
  });

  afterEach(async () => {
    delete process.env[HOSTS];
    await surface.close();
  });

  it.each([
    ['failed', [{ name: 'weather', status: 'failed', source: 'dynamic' }], undefined, '(status "failed")'],
    ['needs-auth', [{ name: 'weather', status: 'needs-auth', source: 'dynamic' }], undefined, '(status "needs-auth")'],
    ['skipped', [], [{ name: 'weather', type: 'invalid_config', message: 'bad entry' }], '(not listed by upstream): invalid_config: bad entry']
  ])('%s: a 400 before commit naming the server, and the run stopped', async (_case, servers, errors, detail) => {
    const created = rejectionOf(surface.client().beta.messages.create(request('weather')));
    const { process: upstream } = await runner.nextRun();
    upstream.frames(JSON.parse(JSON.stringify(initFrame({
      model: RECORDED_MODEL, mcp_servers: servers, ...(errors ? { mcp_server_errors: errors } : {})
    }))));
    const error = await created;

    expect(error).toBeInstanceOf(Anthropic.BadRequestError);
    expect(error.headers?.get('x-should-retry')).toBe('false');
    expect(envelopeOf(error).error).toEqual({
      type: 'invalid_request_error', message: `mcp_servers: the MCP server "weather" is not connected ${detail}`
    });
    expect(upstream.writtenLines()).toContainEqual(expect.objectContaining({ type: 'control_request', request: { subtype: 'interrupt' } }));
    upstream.exit(1);
  });
});

describe('Anthropic surface: connector 400s before any spawn (spec section 9)', () => {
  let surface: SurfaceHarness;
  let spawned: number;

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    spawned = 0;
    surface = await startSurface({ runner: { startRun: () => { spawned += 1; throw new Error('spawned'); } }, stateDirectory: STATE });
  });

  afterEach(async () => {
    delete process.env[HOSTS];
    await surface.close();
  });

  it.each([
    ['no beta', undefined, (params: BetaParams) => ({ ...params, betas: [] }), 'mcp_servers: Extra inputs are not permitted'],
    ['connectors off', undefined, (params: BetaParams) => params,
      `mcp_servers: connectors are off on this surface; the wrapper's operator turns them on by listing the hosts they may reach in ${HOSTS}`],
    ['host not listed', 'other.example.com', (params: BetaParams) => params,
      `mcp_servers.0.url: host "weather.example.com" is not in this surface's connector host list; the wrapper's operator allows it in ${HOSTS}`],
    ['a server named client', '*', () => request('client'),
      'mcp_servers.0.name: "client" is reserved on this surface (it names the server that carries the client\'s own tools)']
  ])('%s', async (_case, hosts, adjust, message) => {
    if (hosts) process.env[HOSTS] = hosts;
    await surface.close();
    surface = await startSurface({ runner: { startRun: () => { spawned += 1; throw new Error('spawned'); } }, stateDirectory: STATE });
    const error = await rejectionOf(surface.client().beta.messages.create(adjust(request('weather'))));

    expect(error).toBeInstanceOf(Anthropic.BadRequestError);
    expect(envelopeOf(error).error).toEqual({ type: 'invalid_request_error', message });
    expect(error.headers?.get('x-should-retry')).toBe('false');
    expect(spawned).toBe(0);
  });
});
