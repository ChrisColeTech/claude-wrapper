/**
 * Multi-call flattening around built-in web calls (spec section 11) on hand-built frames, for the
 * orders no recording shows: a client call in the same message as a built-in (the mixed-message
 * hold, and the documented deviation when the client call comes first), a result that arrives
 * while a later block still streams, the output-limit cuts in a later model call (their usage
 * summed over the calls), and the error codes of failed calls.
 */
import { accumulate } from '../../../../src/anthropic/respond';
import { ApiEvent, createTranslator, TurnEvent } from '../../../../src/anthropic/translate';
import { createServerToolCalls } from '../../../../src/anthropic/translate/server-tool-calls';
import { Frame, JsonObject } from '../../../../src/upstream/frames';
import { DenialCode } from '../../../../src/upstream/hook-policy';
import { frameOf, streamEvent } from '../../../mocks/anthropic/turn-frames';

const messageStart = (id: string, usage: object): Frame => streamEvent({ type: 'message_start',
  message: { id, type: 'message', role: 'assistant', model: 'claude-fable-5-1', content: [], stop_reason: null, stop_sequence: null, usage } });
const toolBlock = (index: number, id: string, name: string, json: string): Frame[] => [
  streamEvent({ type: 'content_block_start', index, content_block: { type: 'tool_use', id, name, input: {}, caller: { type: 'direct' } } }),
  streamEvent({ type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: json } }),
  streamEvent({ type: 'content_block_stop', index })
];
const textBlock = (index: number, text: string): Frame[] => [
  streamEvent({ type: 'content_block_start', index, content_block: { type: 'text', text: '' } }),
  streamEvent({ type: 'content_block_delta', index, delta: { type: 'text_delta', text } }),
  streamEvent({ type: 'content_block_stop', index })
];
const callEnd = (stop_reason: string, usage: object): Frame[] => [
  streamEvent({ type: 'message_delta', delta: { stop_reason, stop_sequence: null }, usage }),
  streamEvent({ type: 'message_stop' })
];
const userResult = (tool_use_id: string, content: unknown, toolUseResult: unknown, is_error?: boolean): Frame => frameOf({
  type: 'user', parent_tool_use_id: null, tool_use_result: toolUseResult,
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id, content, ...(is_error ? { is_error } : {}) }] }
});
const SEARCH_OUTPUT = { query: 'q', results: [{ tool_use_id: 'srvtoolu_x', content: [{ title: 'T', url: 'https://t.example/' }] }, 'summary'], searchCount: 1 };
const searchResult = (id: string): Frame => userResult(id, 'Web search results for query: "q" ...', SEARCH_OUTPUT);

type Translate = (frames: Frame[]) => TurnEvent[];

function translatorFor(options: { stopSequences?: string[]; denials?: Record<string, DenialCode>; calls?: ReturnType<typeof createServerToolCalls> } = {}): Translate {
  const translator = createTranslator({
    logger: { debug: () => undefined }, stopSequences: options.stopSequences ?? [], now: () => 0,
    serverTools: options.calls ?? createServerToolCalls(id => options.denials?.[id])
  });
  return frames => frames.flatMap(frame => translator.push(frame));
}

const shape = (events: TurnEvent[]): string[] => events.filter(event => event.type !== 'content_block_delta').map(event => {
  if (event.type === 'content_block_start') return `${event.index}:${String(event.content_block['type'])}`;
  if (event.type === 'content_block_stop') return `${event.index}:stop`;
  if (event.type === 'message_delta') return `delta:${String(event.delta['stop_reason'])}`;
  return event.type;
});
const apiEvents = (events: TurnEvent[]) => events.filter((event): event is ApiEvent => !['park', 'cut', 'fail'].includes(event.type));
const finalUsage = (events: TurnEvent[]): JsonObject =>
  (events.find(event => event.type === 'message_delta') as Extract<ApiEvent, { type: 'message_delta' }>).usage;

describe('flattening: a client call in a message with a built-in (spec section 11, mixed message)', () => {
  const callFrames = [
    messageStart('msg_1', { input_tokens: 3, output_tokens: 1 }),
    ...toolBlock(0, 'toolu_A', 'WebSearch', '{"query":"q","mode":"standard"}'),
    ...toolBlock(1, 'toolu_C', 'mcp__client__get_weather', '{"city":"Oslo"}'),
    ...callEnd('tool_use', { input_tokens: 3, output_tokens: 40 })
  ];

  it('holds the client call until the built-in before it has its result, so the result comes first', () => {
    const translate = translatorFor();

    const before = translate(callFrames);
    const after = translate([searchResult('toolu_A')]);

    expect(shape(before)).toEqual(['message_start', '0:server_tool_use', '0:stop']);
    expect(shape(after)).toEqual(['1:web_search_tool_result', '1:stop', '2:tool_use', '2:stop', 'delta:tool_use', 'message_stop', 'park']);
    expect(after[after.length - 1]).toEqual({ type: 'park', toolUseIds: ['toolu_C'] });
    expect(accumulate(apiEvents([...before, ...after])).content).toEqual([
      { type: 'server_tool_use', id: 'srvtoolu_A', name: 'web_search', input: { query: 'q' } },
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_A', content: [
        { type: 'web_search_result', url: 'https://t.example/', title: 'T', encrypted_content: expect.any(String), page_age: null }
      ] },
      { type: 'tool_use', id: 'toolu_C', name: 'get_weather', input: { city: 'Oslo' } }
    ]);
  });

  it('ends the turn with a server_tool_use and no result when the client call comes first; the result opens the resuming turn', () => {
    const calls = createServerToolCalls();
    const parked = translatorFor({ calls })([
      messageStart('msg_1', { input_tokens: 3, output_tokens: 1 }),
      ...toolBlock(0, 'toolu_C', 'mcp__client__get_weather', '{"city":"Oslo"}'),
      ...toolBlock(1, 'toolu_B', 'WebSearch', '{"query":"q"}'),
      ...callEnd('tool_use', { input_tokens: 3, output_tokens: 40 })
    ]);
    const resumed = translatorFor({ calls })([
      userResult('toolu_C', [{ type: 'text', text: '{"temp": 12}' }], undefined),
      searchResult('toolu_B'),
      messageStart('msg_2', { input_tokens: 9, output_tokens: 1 }),
      ...textBlock(0, 'It is 12 degrees.'),
      ...callEnd('end_turn', { input_tokens: 9, output_tokens: 8 })
    ]);

    expect(shape(parked)).toEqual(['message_start', '0:tool_use', '0:stop', '1:server_tool_use', '1:stop', 'delta:tool_use', 'message_stop', 'park']);
    expect(shape(resumed)).toEqual(['message_start', '0:web_search_tool_result', '0:stop', '1:text', '1:stop', 'delta:end_turn', 'message_stop']);
    expect(resumed[1]).toEqual(expect.objectContaining({ content_block: expect.objectContaining({ tool_use_id: 'srvtoolu_B' }) }));
  });
});

describe('flattening: block order across model calls (spec section 11, rule (b))', () => {
  it('places a result that arrives while a later block streams right after that block', () => {
    const events = translatorFor()([
      messageStart('msg_1', { input_tokens: 3, output_tokens: 1 }),
      ...toolBlock(0, 'toolu_A', 'WebSearch', '{"query":"a"}'),
      streamEvent({ type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'toolu_B', name: 'WebSearch', input: {} } }),
      searchResult('toolu_A'),
      streamEvent({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"query":"b"}' } }),
      streamEvent({ type: 'content_block_stop', index: 1 }),
      ...callEnd('tool_use', { input_tokens: 3, output_tokens: 30 }),
      searchResult('toolu_B'),
      messageStart('msg_2', { input_tokens: 5, output_tokens: 1 }),
      ...textBlock(0, 'Both found.'),
      ...callEnd('end_turn', { input_tokens: 5, output_tokens: 4 })
    ]);

    expect(shape(events)).toEqual(['message_start', '0:server_tool_use', '0:stop', '1:server_tool_use', '1:stop',
      '2:web_search_tool_result', '2:stop', '3:web_search_tool_result', '3:stop', '4:text', '4:stop', 'delta:end_turn', 'message_stop']);
    expect(finalUsage(events)).toEqual({ input_tokens: 8, output_tokens: 34, server_tool_use: { web_search_requests: 2, web_fetch_requests: 0 } });
  });

  it('still ends the turn at a tool_use stop whose call is neither a client tool nor a web tool', () => {
    const events = translatorFor()([
      messageStart('msg_1', { input_tokens: 3, output_tokens: 1 }),
      ...toolBlock(0, 'toolu_S', 'StructuredOutput', '{"a":1}'),
      ...callEnd('tool_use', { input_tokens: 3, output_tokens: 9 })
    ]);

    expect(shape(events)).toEqual(['message_start', '0:tool_use', '0:stop', 'delta:tool_use', 'message_stop']);
  });
});

describe('flattening: output-limit cuts in a later model call (spec sections 11, 12)', () => {
  const firstCall = [
    messageStart('msg_1', { input_tokens: 2, cache_creation_input_tokens: 10, output_tokens: 1 }),
    ...toolBlock(0, 'toolu_A', 'WebSearch', '{"query":"q"}'),
    ...callEnd('tool_use', { input_tokens: 2, cache_creation_input_tokens: 10, output_tokens: 20 }),
    searchResult('toolu_A')
  ];

  it("cuts at a stop sequence with the cut call's estimate plus the earlier calls' usage and request counts", () => {
    const events = translatorFor({ stopSequences: ['STOP'] })([
      ...firstCall,
      messageStart('msg_2', { input_tokens: 30, cache_read_input_tokens: 10, output_tokens: 1 }),
      streamEvent({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
      streamEvent({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello STOP world' } })
    ]);

    // 'Hello ' is 6 characters: the cut call's own 1 + ceil(6 / 4) = 3, on top of the first call's 20.
    expect(finalUsage(events)).toEqual({
      input_tokens: 32, cache_read_input_tokens: 10, output_tokens: 23, cache_creation_input_tokens: 10,
      server_tool_use: { web_search_requests: 1, web_fetch_requests: 0 }
    });
    expect(events[events.length - 1]).toEqual({ type: 'cut', reason: 'stop_sequence' });
  });

  it('relays a max_tokens stop in a later call with every call’s usage summed', () => {
    const events = translatorFor()([
      ...firstCall,
      messageStart('msg_2', { input_tokens: 30, output_tokens: 1 }),
      ...textBlock(0, 'Partial'),
      ...callEnd('max_tokens', { input_tokens: 30, output_tokens: 7 })
    ]);

    expect(finalUsage(events)).toEqual({
      input_tokens: 32, output_tokens: 27, cache_creation_input_tokens: 10, server_tool_use: { web_search_requests: 1, web_fetch_requests: 0 }
    });
    expect(events[events.length - 1]).toEqual({ type: 'cut', reason: 'max_tokens' });
  });
});

describe('server-tool pass: failed calls (spec section 8)', () => {
  const resultOf = (name: string, result: Frame, denials: Record<string, DenialCode> = {}): unknown => {
    const events = translatorFor({ denials })([
      messageStart('msg_1', { input_tokens: 3, output_tokens: 1 }),
      ...toolBlock(0, 'toolu_A', name, name === 'WebSearch' ? '{"query":"q"}' : '{"url":"https://a.example/","prompt":"p"}'),
      ...callEnd('tool_use', { input_tokens: 3, output_tokens: 9 }),
      result
    ]);
    const message = accumulate(apiEvents([...events, ...callEnd('end_turn', {}).flatMap(frame => frame.type === 'stream_event' ? [frame.event] : [])]));
    return message.content[1]?.['content'];
  };

  it.each([
    ['a failed search is unavailable', 'WebSearch', userResult('toolu_A', 'Error: search failed', 'Error: search failed', true), {}, { type: 'web_search_tool_result_error', error_code: 'unavailable' }],
    ['a search the hook denied carries its code', 'WebSearch', userResult('toolu_A', 'PreToolUse:WebSearch hook error: max_uses_exceeded: x', 'Error: x', true),
      { toolu_A: 'max_uses_exceeded' }, { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' }],
    ['a failed fetch is url_not_accessible', 'WebFetch', userResult('toolu_A', 'Error: fetch failed', 'Error: fetch failed', true), {}, { type: 'web_fetch_tool_result_error', error_code: 'url_not_accessible' }],
    ['a fetch answered 404 is url_not_accessible', 'WebFetch', userResult('toolu_A', 'Not Found', { url: 'https://a.example/', code: 404, codeText: 'Not Found', bytes: 9, result: 'Not Found' }),
      {}, { type: 'web_fetch_tool_result_error', error_code: 'url_not_accessible' }],
    ['a fetch the hook denied carries its code', 'WebFetch', userResult('toolu_A', 'PreToolUse:WebFetch hook error: url_not_allowed: x', 'Error: x', true),
      { toolu_A: 'url_not_allowed' }, { type: 'web_fetch_tool_result_error', error_code: 'url_not_allowed' }]
  ])('%s', (_case, name, result, denials, expected) => {
    expect(resultOf(name, result, denials as Record<string, DenialCode>)).toEqual(expected);
  });

  it('names the URL the call asked for when upstream’s output has none', () => {
    expect(resultOf('WebFetch', userResult('toolu_A', [{ type: 'text', text: 'The page says hi.' }], {}))).toEqual({
      type: 'web_fetch_result', url: 'https://a.example/', retrieved_at: '1970-01-01T00:00:00.000Z',
      content: { type: 'document', source: { type: 'text', media_type: 'text/plain', data: 'The page says hi.' }, title: null }
    });
  });
});
