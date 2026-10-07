/**
 * A client tool call parks the turn (spec sections 7 and 11, flattener rule (c), pass 5): the
 * call's `tool_use` blocks are relayed with upstream's own ids and input deltas, their names with
 * the bridge prefix stripped, then that call's `message_delta {stop_reason: tool_use}` and
 * `message_stop`, then the `park` signal naming every client `tool_use` id. Nothing of the call
 * upstream makes once the results are in belongs to the parked turn: it opens the resuming turn,
 * a new turn stream with its own `message_start`. The recorded spike runs are the oracle.
 */
import { accumulate } from '../../../../src/anthropic/respond';
import { ApiEvent, createTranslator, TurnEvent } from '../../../../src/anthropic/translate';
import { Frame } from '../../../../src/upstream/frames';
import {
  clientToolFrames, PARALLEL_CALLS, recordedAnswer, recordedToolUses, SINGLE_CALL, untilFirstStop
} from '../../../mocks/anthropic/client-tool-recordings';
import { MESSAGE_START, MESSAGE_STOP, streamEvent, translate } from '../../../mocks/anthropic/turn-frames';

const apiEvents = (events: TurnEvent[]) =>
  events.filter((event): event is ApiEvent => event.type !== 'park' && event.type !== 'fail');
const afterFirstStop = (frames: Frame[]) => frames.slice(untilFirstStop(frames).length);

const toolUseCall = (name: string, id = 'toolu_1'): Frame[] => [
  MESSAGE_START,
  { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id, name, input: {}, caller: { type: 'direct' } } },
  { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"q":"x"}' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 9 } },
  MESSAGE_STOP
].map(event => streamEvent(event));

describe('translator: a client tool call parks the turn', () => {
  it('relays the recorded call with the prefix stripped, then message_delta, message_stop and park', () => {
    const events = translate(clientToolFrames(SINGLE_CALL));
    const [toolUse] = recordedToolUses(SINGLE_CALL);

    expect(events.slice(-3)).toEqual([
      expect.objectContaining({ type: 'message_delta', delta: expect.objectContaining({ stop_reason: 'tool_use' }) }),
      { type: 'message_stop' },
      { type: 'park', toolUseIds: [toolUse?.id] }
    ]);
    expect(events.filter(event => event.type === 'message_start')).toHaveLength(1);
    const message = accumulate(apiEvents(events));
    expect(message['stop_reason']).toBe('tool_use');
    expect(message.content).toEqual([
      { type: 'text', text: 'Checking the current weather in Paris now.' },
      { type: 'tool_use', id: toolUse?.id, name: 'get_weather', input: toolUse?.input }
    ]);
  });

  it('returns every tool_use block of a parallel call and parks on all their ids', () => {
    const events = translate(clientToolFrames(PARALLEL_CALLS));
    const toolUses = recordedToolUses(PARALLEL_CALLS);

    expect(toolUses).toHaveLength(2);
    expect(events[events.length - 1]).toEqual({ type: 'park', toolUseIds: toolUses.map(toolUse => toolUse.id) });
    expect(accumulate(apiEvents(events)).content).toEqual(
      toolUses.map(({ id, input }) => ({ type: 'tool_use', id, name: 'get_weather', input }))
    );
  });

  it('streams the call upstream makes with the results as a new turn with its own message_start', () => {
    const frames = clientToolFrames(SINGLE_CALL);

    const events = translate(afterFirstStop(frames));

    expect(events[0]).toEqual(expect.objectContaining({ type: 'message_start' }));
    expect(events.some(event => event.type === 'park')).toBe(false);
    const message = accumulate(apiEvents(events));
    expect(message['stop_reason']).toBe('end_turn');
    expect(message.content).toEqual([{ type: 'text', text: recordedAnswer(SINGLE_CALL) }]);
  });

  it.each([['WebSearch', 'web_search'], ['mcp__docs__search', 'search']])(
    'never parks on a %s call, which is upstream’s own', (name, relayed) => {
      const events = translate(toolUseCall(name));

      expect(events.some(event => event.type === 'park')).toBe(false);
      expect(events).toContainEqual(expect.objectContaining({
        type: 'content_block_start', content_block: expect.objectContaining({ name: relayed })
      }));
    }
  );

  it('strips the prefix from a client tool’s name only', () => {
    const events = translate(toolUseCall('mcp__client__mcp__client__x'));

    expect(events).toContainEqual(expect.objectContaining({
      type: 'content_block_start', content_block: { type: 'tool_use', id: 'toolu_1', name: 'mcp__client__x', input: {} }
    }));
    expect(events[events.length - 1]).toEqual({ type: 'park', toolUseIds: ['toolu_1'] });
  });

  it('never parks a turn a stop sequence cut before its tool call', () => {
    const translator = createTranslator({ logger: { debug: jest.fn() }, stopSequences: ['weather'] });

    const events = clientToolFrames(SINGLE_CALL).flatMap(frame => translator.push(frame));

    expect(events.slice(-3)).toEqual([
      expect.objectContaining({ type: 'message_delta', delta: expect.objectContaining({ stop_reason: 'stop_sequence' }) }),
      { type: 'message_stop' },
      { type: 'cut', reason: 'stop_sequence' }
    ]);
    expect(events.some(event => event.type === 'park' || (event.type === 'content_block_start'
      && event.content_block['type'] === 'tool_use'))).toBe(false);
  });
});
