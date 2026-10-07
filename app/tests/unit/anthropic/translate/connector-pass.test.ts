/**
 * The connector pass on hand-built frames (spec sections 9 and 11), for what the recorded round
 * trip does not show: a failed call and its non-text items, a connector call in the same message
 * as a client call (the mixed-message order, then the park), a tool name holding `__`, several
 * calls answered while their message still streams, and the redaction of a connector call's input.
 */
import { accumulate } from '../../../../src/anthropic/respond';
import { ApiEvent, createTranslator, TurnEvent } from '../../../../src/anthropic/translate';
import { createServerToolCalls } from '../../../../src/anthropic/translate/server-tool-calls';
import { Frame } from '../../../../src/upstream/frames';
import { frameOf, MESSAGE_START, streamEvent } from '../../../mocks/anthropic/turn-frames';

const toolBlock = (index: number, id: string, name: string, json: string): Frame[] => [
  streamEvent({ type: 'content_block_start', index, content_block: { type: 'tool_use', id, name, input: {}, caller: { type: 'direct' } } }),
  streamEvent({ type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: json } }),
  streamEvent({ type: 'content_block_stop', index })
];
const callEnd = (stop_reason: string): Frame[] => [
  streamEvent({ type: 'message_delta', delta: { stop_reason, stop_sequence: null }, usage: { output_tokens: 5 } }),
  streamEvent({ type: 'message_stop' })
];
const userResult = (tool_use_id: string, content: unknown, is_error?: boolean): Frame => frameOf({
  type: 'user', parent_tool_use_id: null, tool_use_result: content,
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id, content, ...(is_error ? { is_error } : {}) }] }
});
const answer = (text: string): Frame[] => [
  streamEvent(MESSAGE_START),
  streamEvent({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
  streamEvent({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }),
  streamEvent({ type: 'content_block_stop', index: 0 }),
  ...callEnd('end_turn')
];

function translate(frames: Frame[], options: { debug?: jest.Mock; redact?: string[] } = {}): TurnEvent[] {
  const translator = createTranslator({
    logger: { debug: options.debug ?? jest.fn() }, serverTools: createServerToolCalls(), now: () => 0, redact: options.redact ?? []
  });
  return [...frames.flatMap(frame => translator.push(frame)), ...translator.end()];
}

const shape = (events: TurnEvent[]): string[] => events.filter(event => event.type !== 'content_block_delta').map(event => {
  if (event.type === 'content_block_start') return `${event.index}:${String(event.content_block['type'])}`;
  if (event.type === 'content_block_stop') return `${event.index}:stop`;
  if (event.type === 'message_delta') return `delta:${String(event.delta['stop_reason'])}`;
  return event.type;
});
const apiEvents = (events: TurnEvent[]) => events.filter((event): event is ApiEvent => !['park', 'cut', 'fail'].includes(event.type));

describe('the connector pass (spec section 9)', () => {
  it("relays a failed call's result as is_error with its text, dropping and logging other items", () => {
    const debug = jest.fn();
    const events = translate([
      streamEvent(MESSAGE_START), ...toolBlock(0, 'toolu_a', 'mcp__docs__fetch', '{"page":1}'), ...callEnd('tool_use'),
      userResult('toolu_a', [{ type: 'text', text: 'MCP error -32001: Request timed out' }, { type: 'image', source: {} }], true),
      ...answer('The docs server timed out.')
    ], { debug });

    expect(accumulate(apiEvents(events)).content).toEqual([
      { type: 'mcp_tool_use', id: 'toolu_a', name: 'fetch', server_name: 'docs', input: { page: 1 } },
      { type: 'mcp_tool_result', tool_use_id: 'toolu_a', is_error: true, content: [{ type: 'text', text: 'MCP error -32001: Request timed out' }] },
      { type: 'text', text: 'The docs server timed out.' }
    ]);
    expect(debug).toHaveBeenCalledWith('Connector result item dropped', { type: 'image' });
  });

  it('makes a string result one text block', () => {
    const events = translate([
      streamEvent(MESSAGE_START), ...toolBlock(0, 'toolu_a', 'mcp__docs__fetch', '{}'), ...callEnd('tool_use'),
      userResult('toolu_a', 'plain text result'), ...answer('ok')
    ]);

    expect(accumulate(apiEvents(events)).content[1]).toEqual(
      { type: 'mcp_tool_result', tool_use_id: 'toolu_a', is_error: false, content: [{ type: 'text', text: 'plain text result' }] });
  });

  it("splits the name as upstream does: the server is the second part, the tool everything after it", () => {
    const events = translate([streamEvent(MESSAGE_START), ...toolBlock(0, 'toolu_a', 'mcp__docs__read__page', '{}')]);

    expect(events[1]).toEqual({ type: 'content_block_start', index: 0,
      content_block: { type: 'mcp_tool_use', id: 'toolu_a', name: 'read__page', server_name: 'docs', input: {} } });
  });

  it("orders a connector call before a client call in one message as the real API does, then parks on the client's", () => {
    const events = translate([
      streamEvent(MESSAGE_START),
      ...toolBlock(0, 'toolu_c', 'mcp__docs__fetch', '{}'),
      ...toolBlock(1, 'toolu_k', 'mcp__client__get_weather', '{"city":"Paris"}'),
      ...callEnd('tool_use'),
      userResult('toolu_c', [{ type: 'text', text: 'page' }])
    ]);

    expect(shape(events)).toEqual([
      'message_start', '0:mcp_tool_use', '0:stop', '1:mcp_tool_result', '1:stop', '2:tool_use', '2:stop', 'delta:tool_use',
      'message_stop', 'park'
    ]);
    expect(events[events.length - 1]).toEqual({ type: 'park', toolUseIds: ['toolu_k'] });
  });

  it('places the results of calls answered while the message still streams after their calls, in one message', () => {
    // Upstream runs a connector call as soon as its block ends, so its result can arrive while the next block streams.
    const [start, delta, stop] = toolBlock(1, 'toolu_2', 'mcp__labels__create', '{"name":"b"}');
    const events = translate([
      streamEvent(MESSAGE_START), ...toolBlock(0, 'toolu_1', 'mcp__labels__create', '{"name":"a"}'),
      start as Frame, userResult('toolu_1', 'created a'), delta as Frame, stop as Frame,
      userResult('toolu_2', 'created b'), ...callEnd('tool_use'), ...answer('Two labels.')
    ]);

    expect(shape(events)).toEqual(['message_start', '0:mcp_tool_use', '0:stop', '1:mcp_tool_use', '1:stop', '2:mcp_tool_result', '2:stop',
      '3:mcp_tool_result', '3:stop', '4:text', '4:stop', 'delta:end_turn', 'message_stop']);
    expect(accumulate(apiEvents(events)).content.map(block => block['tool_use_id'] ?? block['id'] ?? block['type']))
      .toEqual(['toolu_1', 'toolu_2', 'toolu_1', 'toolu_2', 'text']);
  });

  it("redacts an armed string inside a connector call's input, which stays valid JSON", () => {
    const events = translate([
      streamEvent(MESSAGE_START), ...toolBlock(0, 'toolu_a', 'mcp__mail__send', '{"to": "user@example.invalid"}'), ...callEnd('tool_use')
    ], { redact: ['user@example.invalid'] });
    const input = events.flatMap(event => (event.type === 'content_block_delta' ? [String(event.delta['partial_json'])] : [])).join('');

    expect(JSON.parse(input)).toEqual({ to: '[redacted]' });
  });
});
