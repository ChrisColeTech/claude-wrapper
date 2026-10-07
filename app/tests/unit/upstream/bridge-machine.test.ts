/**
 * The tool bridge's state machine, lifted from the spike (`.scratch/anthropic-compat-api/spike/
 * bridge.mjs`), played against the spike's recorded runs: upstream's frames and MCP calls at
 * their recorded times, with a client that answers (or never answers) as the spike's did.
 */
import { createBridgeMachine } from '../../../src/upstream/bridge/state-machine';
import { BridgeEvent, DeliveredResult, McpToolResult, ToolUse } from '../../../src/upstream/bridge/types';
import { parseFrame } from '../../../src/upstream/frames';
import { playSpikeSequence, spikeTrace, withoutTime } from '../../mocks/upstream/bridge-sequences';

const weather = (toolUse: ToolUse): McpToolResult => ({
  content: [{ type: 'text', text: JSON.stringify({ city: (toolUse.input as { city: string }).city, sky: 'overcast' }) }],
  isError: false
});

const PARIS = 'toolu_01KHVVfCyaD5M7pU9pUR6Y8f';

describe('bridge state machine against the spike runs', () => {
  it('parks when the assistant message completes, and a result delivered later resumes the waiting call (cli-http-happy)', async () => {
    const { trace, calls } = playSpikeSequence('cli-http-happy', { deliverAfterParkMs: 3000, answer: weather });

    expect(trace.map(withoutTime)).toEqual([
      { kind: 'turn_started' },
      { kind: 'client_tool_use_announced', id: PARIS, name: 'get_weather' },
      { kind: 'assistant_message_complete', stopReason: 'tool_use' },
      { kind: 'park', toolUses: [{ id: PARIS, name: 'get_weather', input: { city: 'Paris' } }] },
      { kind: 'mcp_call_registered', toolUseId: PARIS, name: 'get_weather', early: false },
      { kind: 'client_result_delivered_to_waiting_handler', toolUseId: PARIS, isError: false },
      { kind: 'resumed' },
      { kind: 'turn_ended' }
    ]);
    await expect(calls.get(PARIS)).resolves.toEqual({
      status: 'resolved',
      value: { content: [{ type: 'text', text: '{"city":"Paris","sky":"overcast"}' }], isError: false }
    });
  });

  it('parks a two-call message once, holds the second result until upstream asks, and serves it at once (sdk-parallel)', async () => {
    const { trace, calls } = playSpikeSequence('sdk-parallel', { deliverAfterParkMs: 3000, answer: weather });

    expect(trace.map(withoutTime)).toEqual(spikeTrace('sdk-parallel'));
    const tokyo = await calls.get('toolu_01HmJvfskARcHbdt2vfMabdN');
    expect(tokyo).toEqual({
      status: 'resolved',
      value: { content: [{ type: 'text', text: '{"city":"Tokyo","sky":"overcast"}' }], isError: false }
    });
  });

  it('holds a result delivered before upstream asks and serves it when the call arrives (cli-http-happy, answered at once)', async () => {
    const { trace, calls } = playSpikeSequence('cli-http-happy', { deliverAfterParkMs: 0, answer: weather });

    expect(trace.map(withoutTime)).toEqual([
      { kind: 'turn_started' },
      { kind: 'client_tool_use_announced', id: PARIS, name: 'get_weather' },
      { kind: 'assistant_message_complete', stopReason: 'tool_use' },
      { kind: 'park', toolUses: [{ id: PARIS, name: 'get_weather', input: { city: 'Paris' } }] },
      { kind: 'client_result_predelivered', toolUseId: PARIS, isError: false },
      { kind: 'resumed' },
      { kind: 'mcp_call_served_from_predelivered', toolUseId: PARIS, name: 'get_weather' },
      { kind: 'turn_ended' }
    ]);
    await expect(calls.get(PARIS)).resolves.toEqual(expect.objectContaining({ status: 'resolved' }));
  });

  it('rejects the waiting call when abandoned after the interrupt, as the spike did (cli-http-interrupt)', async () => {
    const { trace, calls } = playSpikeSequence('cli-http-interrupt', { abandonAfterParkMs: 4500 });

    expect(trace.map(withoutTime)).toEqual(spikeTrace('cli-http-interrupt'));
    const call = await calls.get('toolu_01J5RVQguX7yyFkAmqwfLJNv');
    expect(call).toEqual({ status: 'rejected', reason: new Error('abandoned: client never answered') });
  });
});

describe('bridge state machine deliveries', () => {
  const init = parseFrame('{"type":"system","subtype":"init","session_id":"s","tools":[],"mcp_servers":[]}');
  const toolUse = (id: string, name: string) => ({ type: 'tool_use', id, name, input: {} });
  const assistant = (...blocks: object[]) =>
    parseFrame(JSON.stringify({ type: 'assistant', message: { id: 'msg_1', content: blocks }, parent_tool_use_id: null }));
  const messageComplete = parseFrame(JSON.stringify({
    type: 'stream_event', event: { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: {} }, parent_tool_use_id: null
  }));
  const result = (id: string): DeliveredResult => ({ toolUseId: id, result: { content: [{ type: 'text', text: id }], isError: false } });
  const isPending = async (promise: Promise<unknown>) =>
    Promise.race([promise.then(() => false, () => false), new Promise(resolve => setImmediate(() => resolve(true)))]);

  function parkedOnTwoCalls() {
    const trace: BridgeEvent[] = [];
    const machine = createBridgeMachine({ onEvent: event => trace.push(event) });
    machine.onFrame(init);
    machine.onFrame(assistant(toolUse('toolu_a', 'mcp__client__a'), toolUse('toolu_b', 'mcp__client__b')));
    machine.onFrame(messageComplete);
    const first = machine.call({ toolUseId: 'toolu_a', name: 'a', args: {} });
    return { machine, trace, first };
  }

  it('reports a partial answer with the ids still missing, delivers nothing, and stays parked', async () => {
    const { machine, first } = parkedOnTwoCalls();

    expect(machine.deliver([result('toolu_a')])).toEqual({ status: 'partial', stillMissing: ['toolu_b'] });
    expect(await isPending(first)).toBe(true);

    expect(machine.deliver([result('toolu_b'), result('toolu_a')])).toEqual({ status: 'resumed' });
    await expect(first).resolves.toEqual(result('toolu_a').result);
  });

  it('reports ids that belong to no park of this bridge and delivers nothing', async () => {
    const { machine, first } = parkedOnTwoCalls();

    expect(machine.deliver([result('toolu_a'), result('toolu_b'), result('toolu_x')]))
      .toEqual({ status: 'unknown', unknownIds: ['toolu_x'] });
    expect(await isPending(first)).toBe(true);
  });

  it('treats results that arrive when nothing is parked as unknown', () => {
    const machine = createBridgeMachine();
    machine.onFrame(init);

    expect(machine.deliver([result('toolu_a')])).toEqual({ status: 'unknown', unknownIds: ['toolu_a'] });
  });

  it('never parks on a built-in tool call', () => {
    const trace: BridgeEvent[] = [];
    const machine = createBridgeMachine({ onEvent: event => trace.push(event) });
    machine.onFrame(init);
    machine.onFrame(assistant(toolUse('toolu_w', 'WebSearch')));
    machine.onFrame(messageComplete);

    expect(trace.map(event => event.kind)).toEqual(['turn_started', 'builtin_tool_use', 'assistant_message_complete']);
  });
});
