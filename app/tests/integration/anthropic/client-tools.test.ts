/**
 * The SDK's tool loop end to end (spec section 7, ADR 0001) against the replay runner playing the
 * spike's recorded client-tool runs on a fake clock, so upstream's resumed call plays only once
 * the client has answered. The turn ends with `stop_reason: tool_use` and upstream's own blocks
 * and ids; the next request's `tool_result` blocks continue the same run (no second run, nothing
 * more on its stdin) as a new turn stream; the recordings are the oracle.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createControlServer } from '../../../src/upstream/control-server';
import { createReplayRunner, parseRecording, ReplayRunner } from '../../../src/upstream/runner';
import { logger } from '../../../src/utils/logger';
import {
  clientToolRecording, GET_WEATHER, PARALLEL_CALLS, recordedAnswer, recordedToolUses, SINGLE_CALL
} from '../../mocks/anthropic/client-tool-recordings';
import { STATE } from '../../mocks/anthropic/plan-context';
import { memorySessions, TestSessions } from '../../mocks/anthropic/sessions';
import { envelopeOf, rejectionOf, SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { initFrame, PLAIN_CALL, resultFrame, streamEvent } from '../../mocks/anthropic/turn-frames';
import { createFakeClock, FakeClock } from '../../mocks/shared/fake-clock';
import { waitFor } from '../../mocks/shared/wait-for';
import { settle } from '../../mocks/upstream/run-helpers';

type MessageParam = Anthropic.MessageParam;
type ToolUseBlock = Anthropic.ToolUseBlock;

const ASK: MessageParam = { role: 'user', content: 'What is the weather in Paris?' };
const TOOL_REQUEST = { model: 'fable', max_tokens: 1024, tools: [GET_WEATHER as Anthropic.Tool] };
const weather = (city: unknown) => JSON.stringify({ city, temp_c: 18, sky: 'overcast' });
const textOf = (message: Anthropic.Message) =>
  message.content.filter(block => block.type === 'text').map(block => (block as Anthropic.TextBlock).text).join('');
const toolUses = (message: Anthropic.Message) => message.content.filter((block): block is ToolUseBlock => block.type === 'tool_use');
const answerFor = (blocks: ToolUseBlock[]): MessageParam => ({
  role: 'user',
  content: blocks.map(block => ({ type: 'tool_result', tool_use_id: block.id, content: weather((block.input as { city?: string }).city) }))
});

describe('Anthropic surface: client tools round trip', () => {
  let surface: SurfaceHarness;
  let runner: ReplayRunner;
  let clock: FakeClock;
  let state: TestSessions;

  async function serve(fixture: string): Promise<Anthropic> {
    clock = createFakeClock(1_791_000_000_000);
    runner = createReplayRunner([clientToolRecording(fixture)], { clock });
    state = memorySessions(clock);
    surface = await startSurface({ runner, clock, stateDirectory: STATE, sessions: state.sessions });
    return surface.client();
  }

  /** Plays the recording for `ms` of its time once the run has its first message. */
  async function play(ms: number): Promise<void> {
    await waitFor(() => runner.started[0]?.input.length === 1);
    clock.advance(ms);
    await settle();
  }

  /** Waits until the parked run has taken the request's results, then plays the rest. */
  async function resumeAndPlay(ids: string[]): Promise<void> {
    await waitFor(() => ids.every(id => state.sessions.parked.get(id) === undefined));
    for (let step = 0; step < 4; step += 1) {
      clock.advance(5_000);
      await settle();
    }
  }

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(logger, 'debug');
  });

  afterEach(async () => {
    await surface.close();
  });

  it('parks on upstream’s own tool_use and answers from the same run once the result is in', async () => {
    const client = await serve(SINGLE_CALL);
    const [recorded] = recordedToolUses(SINGLE_CALL);

    const asking = client.messages.create({ ...TOOL_REQUEST, messages: [ASK] });
    await play(4_000);
    const parked = await asking;

    expect(parked.stop_reason).toBe('tool_use');
    expect(toolUses(parked)).toEqual([{ type: 'tool_use', id: recorded?.id, name: 'get_weather', input: recorded?.input }]);
    const answering = client.messages.stream({
      ...TOOL_REQUEST, messages: [ASK, { role: 'assistant', content: parked.content }, answerFor(toolUses(parked))]
    }).finalMessage();
    await resumeAndPlay([String(recorded?.id)]);
    const answer = await answering;

    expect(answer.stop_reason).toBe('end_turn');
    expect(textOf(answer)).toBe(recordedAnswer(SINGLE_CALL));
    expect(answer.id).not.toBe(parked.id);
    expect(runner.started).toHaveLength(1);
    expect(runner.started[0]?.input).toEqual([expect.objectContaining({ type: 'user' })]);
    await waitFor(() => state.recorded.length === 1);
    expect(state.forgotten).toEqual([]);
  });

  it('mounts the bridge server through the run’s own MCP config file, its token nowhere else', async () => {
    const client = await serve(SINGLE_CALL);

    const asking = client.messages.create({ ...TOOL_REQUEST, messages: [ASK] });
    await play(4_000);
    await asking;

    const spec = runner.started[0]?.spec;
    const flagValue = (flag: string) => spec?.flags[spec.flags.indexOf(flag) + 1];
    const config = JSON.parse(spec?.runDir?.files['mcp-config.json'] ?? '{}');
    const token = String(config.mcpServers?.client?.headers?.Authorization).replace(/^Bearer /, '');
    expect(flagValue('--mcp-config')).toBe(`${spec?.runDir?.path}/mcp-config.json`);
    expect(flagValue('--allowedTools')).toBe('mcp__client__get_weather');
    expect(config).toEqual({ mcpServers: { client: {
      type: 'http', url: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/runs\/[\w-]+\/mcp$/),
      headers: { Authorization: `Bearer ${token}` }, alwaysLoad: true, timeout: 660_000
    } } });
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(JSON.stringify({ flags: spec?.flags, env: spec?.env })).not.toContain(token);
  });

  it('returns every tool_use of a parallel call and takes their results in any order', async () => {
    const client = await serve(PARALLEL_CALLS);

    const asking = client.messages.create({ ...TOOL_REQUEST, messages: [ASK] });
    await play(5_500);
    const parked = await asking;
    const blocks = toolUses(parked);
    expect(blocks.map(({ id, input }) => ({ id, input }))).toEqual(recordedToolUses(PARALLEL_CALLS));

    const answering = client.messages.create({
      ...TOOL_REQUEST, messages: [ASK, { role: 'assistant', content: parked.content }, answerFor([...blocks].reverse())]
    });
    await resumeAndPlay(blocks.map(block => block.id));

    expect(textOf(await answering)).toBe(recordedAnswer(PARALLEL_CALLS));
    expect(runner.started).toHaveLength(1);
  });

  it('answers a partial answer with the real API’s 400 and keeps the run parked for the whole one', async () => {
    const client = await serve(PARALLEL_CALLS);
    const asking = client.messages.create({ ...TOOL_REQUEST, messages: [ASK] });
    await play(5_500);
    const parked = await asking;
    const [first, second] = toolUses(parked) as [ToolUseBlock, ToolUseBlock];
    const history: MessageParam[] = [ASK, { role: 'assistant', content: parked.content }];

    const error = await rejectionOf(client.messages.create({ ...TOOL_REQUEST, messages: [...history, answerFor([second])] }));

    expect(error).toBeInstanceOf(Anthropic.BadRequestError);
    expect(envelopeOf(error).error).toEqual({ type: 'invalid_request_error', message:
      `messages.1: \`tool_use\` ids were found without \`tool_result\` blocks immediately after: ${first.id}. ` +
      'Each `tool_use` block must have a corresponding `tool_result` block in the next message.' });
    expect(state.sessions.parked.get(first.id)).toBeDefined();
    const answering = client.messages.create({ ...TOOL_REQUEST, messages: [...history, answerFor([first, second])] });
    await resumeAndPlay([first.id, second.id]);
    expect(textOf(await answering)).toBe(recordedAnswer(PARALLEL_CALLS));
  });

  it('ignores edits to the earlier history and run-bound parameters on the resuming request, logging them', async () => {
    const client = await serve(SINGLE_CALL);
    const asking = client.messages.create({ ...TOOL_REQUEST, messages: [ASK] });
    await play(4_000);
    const parked = await asking;

    const answering = client.messages.create({
      ...TOOL_REQUEST, max_tokens: 99, system: 'Answer in French.',
      messages: [{ role: 'user', content: 'An edited question' }, { role: 'assistant', content: parked.content },
        answerFor(toolUses(parked))]
    });
    await resumeAndPlay(toolUses(parked).map(block => block.id));

    expect(textOf(await answering)).toBe(recordedAnswer(SINGLE_CALL));
    expect(runner.started).toHaveLength(1);
    expect(logger.debug).toHaveBeenCalledWith('Run-bound parameters ignored on a resuming turn',
      expect.objectContaining({ parameters: ['max_tokens', 'system'] }));
  });
});

describe('Anthropic surface: tool_choice', () => {
  let surface: SurfaceHarness;
  const plainRun = (tools: string[]) => parseRecording([initFrame({ tools }), ...PLAIN_CALL.map(item => streamEvent(item)),
    resultFrame()].map(frame => JSON.stringify(frame)).join('\n'));

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await surface.close();
  });

  it('none leaves the bridge server unmounted: nothing allowed, no MCP config, upstream reports no tool', async () => {
    const runner = createReplayRunner([plainRun([])], { timeScale: 0 });
    const controlServer = createControlServer();
    jest.spyOn(controlServer, 'registerRun');
    surface = await startSurface({ runner, stateDirectory: STATE, controlServer });

    const message = await surface.client().messages.create({ ...TOOL_REQUEST, tool_choice: { type: 'none' }, messages: [ASK] });

    expect(textOf(message)).toBe('hi');
    const spec = runner.started[0]?.spec;
    expect(spec?.flags).not.toContain('--mcp-config');
    expect(spec?.flags[(spec?.flags.indexOf('--allowedTools') ?? 0) + 1]).toBe('');
    expect(spec?.runDir?.files).toEqual({});
    expect(controlServer.registerRun).not.toHaveBeenCalled();
  });

  it('auto mounts the bridge server as when absent', async () => {
    const runner = createReplayRunner([plainRun(['mcp__client__get_weather'])], { timeScale: 0 });
    surface = await startSurface({ runner, stateDirectory: STATE });

    const message = await surface.client().messages.create({ ...TOOL_REQUEST, tool_choice: { type: 'auto' }, messages: [ASK] });

    expect(textOf(message)).toBe('hi');
    expect(runner.started[0]?.spec.flags).toContain('--mcp-config');
  });

  it.each([[{ type: 'any' }], [{ type: 'tool', name: 'get_weather' }]] as const)(
    'refuses %p with the real API’s 400 before any run', async (toolChoice) => {
      surface = await startSurface({ stateDirectory: STATE });

      const error = await rejectionOf(surface.client().messages.create({ ...TOOL_REQUEST, tool_choice: toolChoice, messages: [ASK] }));

      expect(error).toBeInstanceOf(Anthropic.BadRequestError);
      expect(envelopeOf(error).error.message).toBe('tool_choice: type "tool" and "any" are not supported for this model.');
    }
  );
});
