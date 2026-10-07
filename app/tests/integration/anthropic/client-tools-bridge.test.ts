/**
 * The tool bridge under the surface (spec section 7, ADR 0001), with the test playing upstream: a
 * scripted run, and an MCP client calling the run's bridge server as upstream does. The client's
 * `tool_result` content is what upstream's `tools/call` gets back, pre-delivered results are
 * served the moment upstream asks, and a park the client abandons (the park TTL, a disconnect
 * while a call waits) interrupts the run before the waiting call is rejected, forgets the upstream
 * session, and turns a late answer into a replayed turn.
 */
import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ANTHROPIC_SETTING_ENV } from '../../../src/config/anthropic-settings';
import { logger } from '../../../src/utils/logger';
import { callWeather, connectAsUpstream, isPending, toolResultFrame, weatherCalls } from '../../mocks/anthropic/bridge-upstream';
import { GET_WEATHER } from '../../mocks/anthropic/client-tool-recordings';
import { STATE } from '../../mocks/anthropic/plan-context';
import { memorySessions, TestSessions } from '../../mocks/anthropic/sessions';
import { SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { BLOCK_STOP, END_TURN, initFrame, MESSAGE_START, MESSAGE_STOP, resultFrame, TEXT_START, textDelta }
  from '../../mocks/anthropic/turn-frames';
import { createFakeClock, FakeClock } from '../../mocks/shared/fake-clock';
import { waitFor } from '../../mocks/shared/wait-for';
import { settle } from '../../mocks/upstream/run-helpers';
import { ScriptedProcess } from '../../mocks/upstream/scripted-process';
import { createScriptedRunner, ScriptedRunner } from '../../mocks/upstream/scripted-runner';
import { Clock, systemClock } from '../../../src/utils/clock';

type MessageParam = Anthropic.MessageParam;

const PARIS = { id: 'toolu_paris', city: 'Paris' };
const TOKYO = { id: 'toolu_tokyo', city: 'Tokyo' };
const ASK: MessageParam = { role: 'user', content: 'Weather in Paris and Tokyo?' };
const REQUEST = { model: 'claude-fable-5-1', max_tokens: 1024, tools: [GET_WEATHER as Anthropic.Tool] };
const INIT = initFrame({ tools: ['mcp__client__get_weather'] });
const event = (value: object) => ({ type: 'stream_event', event: value, parent_tool_use_id: null, session_id: 'session-1' });
const answerCall = (text: string) => [MESSAGE_START, TEXT_START, textDelta(text), BLOCK_STOP, END_TURN, MESSAGE_STOP].map(event);
const result = (id: string, content: NonNullable<Anthropic.ToolResultBlockParam['content']>): Anthropic.ToolResultBlockParam =>
  ({ type: 'tool_result', tool_use_id: id, content });
const textOf = (message: Anthropic.Message) =>
  message.content.filter(block => block.type === 'text').map(block => (block as Anthropic.TextBlock).text).join('');
const interrupts = (upstream: ScriptedProcess) => upstream.writtenLines()
  .filter((line): line is { request_id: string } => (line as { type: string }).type === 'control_request');
const userLines = (upstream: ScriptedProcess) => upstream.writtenLines().filter(line => (line as { type: string }).type === 'user');

describe('Anthropic surface: the tool bridge', () => {
  let surface: SurfaceHarness;
  let runner: ScriptedRunner;
  let state: TestSessions;
  let mcp: Client | undefined;

  async function serve(clock: Clock = systemClock): Promise<Anthropic> {
    runner = createScriptedRunner(clock);
    state = memorySessions(clock);
    surface = await startSurface({ runner, clock, stateDirectory: STATE, sessions: state.sessions });
    return surface.client();
  }

  /** Asks, plays upstream up to the park with the Paris call already waiting on the bridge. */
  async function park(client: Anthropic, calls = [PARIS, TOKYO]) {
    const asking = client.messages.create({ ...REQUEST, messages: [ASK] });
    const { spec, process: upstream } = await runner.nextRun();
    await waitFor(() => userLines(upstream).length === 1);
    mcp = await connectAsUpstream(spec);
    upstream.frames(INIT, ...weatherCalls(calls));
    const waiting = callWeather(mcp, PARIS);
    const parked = await asking;
    return { upstream, waiting, parked, history: [ASK, { role: 'assistant' as const, content: parked.content }] };
  }

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(logger, 'info');
    jest.spyOn(logger, 'warn');
  });

  afterEach(async () => {
    delete process.env[ANTHROPIC_SETTING_ENV.parkTtlMs];
    await mcp?.close();
    mcp = undefined;
    await surface.close();
  });

  it('hands upstream the client’s own results, serving a pre-delivered one the moment it asks', async () => {
    const client = await serve();
    const { upstream, waiting, parked, history } = await park(client);
    expect(parked.content.filter(block => block.type === 'tool_use').map(block => (block as Anthropic.ToolUseBlock).id))
      .toEqual([PARIS.id, TOKYO.id]);
    expect(await isPending(waiting)).toBe(true);

    const answering = client.messages.create({ ...REQUEST, messages: [...history, { role: 'user', content: [
      result(TOKYO.id, [{ type: 'text', text: 'Tokyo: 24 C' }]), result(PARIS.id, 'Paris: 18 C')
    ] }] });

    await expect(waiting).resolves.toEqual({ content: [{ type: 'text', text: 'Paris: 18 C' }], isError: false });
    await expect(callWeather(mcp as Client, TOKYO)).resolves.toEqual({ content: [{ type: 'text', text: 'Tokyo: 24 C' }], isError: false });
    upstream.frames(toolResultFrame(PARIS.id, 'Paris: 18 C'), toolResultFrame(TOKYO.id, 'Tokyo: 24 C'),
      ...answerCall('Tokyo is warmer.'), resultFrame({ num_turns: 3 }));
    const answer = await answering;

    expect(textOf(answer)).toBe('Tokyo is warmer.');
    expect(answer.stop_reason).toBe('end_turn');
    expect(userLines(upstream)).toHaveLength(1);
    await waitFor(() => upstream.inputEnded());
    upstream.exit(0);
    await waitFor(() => state.recorded.length === 1);
    expect(state.recorded).toEqual(['session-1']);
  });

  describe('abandonment', () => {
    let clock: FakeClock;

    beforeEach(() => {
      clock = createFakeClock(1_791_000_000_000);
      process.env[ANTHROPIC_SETTING_ENV.parkTtlMs] = '60000';
    });

    /** Upstream answers the interrupt, then ends the way an interrupted run does. */
    async function answerInterrupt(upstream: ScriptedProcess): Promise<void> {
      const [interrupt] = interrupts(upstream);
      upstream.frames({ type: 'control_response', response: { subtype: 'success', request_id: interrupt?.request_id } });
      await settle();
      upstream.frames(resultFrame({ subtype: 'error_during_execution', is_error: true, result: undefined }));
      await waitFor(() => upstream.inputEnded());
      upstream.exit(1);
    }

    it('interrupts the run when the park TTL expires, then rejects the waiting call and forgets the session', async () => {
      const client = await serve(clock);
      const { upstream, waiting, history } = await park(client, [PARIS]);
      jest.mocked(logger.warn).mockClear();

      clock.advance(59_999);
      await settle();
      expect(interrupts(upstream)).toEqual([]);
      clock.advance(1);
      await waitFor(() => interrupts(upstream).length === 1);
      expect(await isPending(waiting)).toBe(true);
      await answerInterrupt(upstream);

      await expect(waiting).rejects.toThrow(/abandoned: park TTL expired/);
      await waitFor(() => state.forgotten.includes('session-1'));
      expect(state.sessions.parked.get(PARIS.id)).toBeUndefined();
      // The interrupted run's `error_during_execution` and exit 1 are its expected end.
      expect(logger.warn).not.toHaveBeenCalled();

      const late = client.messages.create({ ...REQUEST, messages: [...history, { role: 'user', content: [result(PARIS.id, '18 C')] }] });
      const { process: replayed } = await runner.nextRun();
      await waitFor(() => userLines(replayed).length === 1);
      replayed.frames(INIT, ...answerCall('Paris is mild.'), resultFrame());
      expect(textOf(await late)).toBe('Paris is mild.');
      const sent = userLines(replayed)[0] as { message: { content: { text: string }[] } };
      expect(sent.message.content[0]?.text).toMatch(/^<conversation_history>\n/);
      expect(sent.message.content[1]?.text).toBe(`<tool_result tool_use_id="${PARIS.id}" is_error="false">18 C</tool_result>`);
      expect(logger.info).toHaveBeenCalledWith('Lost park: no parked run holds these tool results; the turn is replayed',
        expect.objectContaining({ toolUseIds: [PARIS.id] }));
    });

    it('interrupts first, then rejects the waiting call, when the client disconnects while a call waits', async () => {
      const client = await serve(clock);
      const stream = client.messages.stream({ ...REQUEST, messages: [ASK] });
      const started = new Promise(resolve => stream.on('streamEvent', item => { if (item.type === 'content_block_start') resolve(item); }));
      const ended = stream.finalMessage().catch(error => error);
      const { spec, process: upstream } = await runner.nextRun();
      await waitFor(() => userLines(upstream).length === 1);
      mcp = await connectAsUpstream(spec);
      upstream.frames(INIT, ...weatherCalls([PARIS]).slice(0, 4));
      const waiting = callWeather(mcp, PARIS);
      await started;
      expect(await isPending(waiting)).toBe(true);

      stream.abort();
      await ended;
      await waitFor(() => interrupts(upstream).length === 1);
      expect(await isPending(waiting)).toBe(true);
      await answerInterrupt(upstream);

      await expect(waiting).rejects.toThrow(/abandoned: the turn ended: disconnected/);
      await waitFor(() => state.forgotten.includes('session-1'));
    });
  });
});
