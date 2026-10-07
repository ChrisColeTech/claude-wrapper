/**
 * The StructuredOutput buffer on hand-built frames (spec section 12): the failure path (a
 * `tool_result` with `is_error` drops the buffer, the call is flattened away like a built-in
 * call and the retry follows), the retries running out (a post-commit error), prose dropped, a
 * `max_tokens` cut inside the buffer, and a `tool_result` that arrives after the call's end.
 */
import { createTranslator, TurnEvent } from '../../../../src/anthropic/translate';
import { Frame } from '../../../../src/upstream/frames';
import { frameOf, MESSAGE_START, MESSAGE_STOP, resultFrame, streamEvent } from '../../../mocks/anthropic/turn-frames';

function translateFormatRun(frames: Frame[], debug = jest.fn(), redact: string[] = []): TurnEvent[] {
  const translator = createTranslator({ logger: { debug }, structuredOutput: true, redact });
  return [...frames.flatMap(frame => translator.push(frame)), ...translator.end()];
}

const thinking = (index: number): object[] => [
  { type: 'content_block_start', index, content_block: { type: 'thinking', thinking: '', signature: '' } },
  { type: 'content_block_delta', index, delta: { type: 'signature_delta', signature: `sig-${index}` } },
  { type: 'content_block_stop', index }
];

const prose = (index: number, text: string): object[] => [
  { type: 'content_block_start', index, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index, delta: { type: 'text_delta', text } },
  { type: 'content_block_stop', index }
];

/** The StructuredOutput `tool_use` block, its input streamed as `chunks`. */
const answer = (index: number, id: string, chunks: string[]): object[] => [
  { type: 'content_block_start', index, content_block: { type: 'tool_use', id, name: 'StructuredOutput', input: {} } },
  ...chunks.map(partial_json => ({ type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json } })),
  { type: 'content_block_stop', index }
];

const toolResult = (id: string, isError = false): Frame => frameOf({
  type: 'user', parent_tool_use_id: null, session_id: 'session-1',
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: isError
    ? 'Output does not match required schema' : 'Structured output provided successfully', ...(isError ? { is_error: true } : {}) }] }
});

const callEnd = (stopReason: string): object[] =>
  [{ type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 9 } }, MESSAGE_STOP];

const events = (...items: object[]): Frame[] => items.map(event => streamEvent(event));

const kinds = (turn: TurnEvent[]): string[] => turn
  .filter(event => event.type !== 'content_block_delta')
  .map(event => (event.type === 'content_block_start' ? `start ${event.index} ${String(event.content_block['type'])}`
    : event.type === 'content_block_stop' ? `stop ${event.index}`
      : event.type === 'message_delta' ? `message_delta ${String(event.delta['stop_reason'])}` : event.type));

const textOf = (turn: TurnEvent[]): string => turn.flatMap(event =>
  (event.type === 'content_block_delta' && event.delta['type'] === 'text_delta' ? [String(event.delta['text'])] : [])).join('');

describe('the StructuredOutput buffer', () => {
  it('drops a failed answer and flattens its call away; the retry is the answer, blocks numbered across both calls', () => {
    const turn = translateFormatRun([
      ...events(MESSAGE_START, ...thinking(0), ...answer(1, 'toolu_1', ['{"ok": "yes"}'])),
      toolResult('toolu_1', true),
      ...events(...callEnd('tool_use'), MESSAGE_START, ...thinking(0), ...answer(1, 'toolu_2', ['{"ok": ', 'true}'])),
      toolResult('toolu_2'),
      ...events(...callEnd('tool_use')),
      resultFrame({ result: '{"ok":true}', stop_reason: 'tool_use', num_turns: 3 })
    ]);

    expect(kinds(turn)).toEqual([
      'message_start', 'start 0 thinking', 'stop 0', 'start 1 thinking', 'stop 1', 'start 2 text', 'stop 2',
      'message_delta end_turn', 'message_stop'
    ]);
    expect(textOf(turn)).toBe('{"ok": true}');
  });

  it('fails the turn after commit when upstream runs out of retries', () => {
    const turn = translateFormatRun([
      ...events(MESSAGE_START, ...answer(0, 'toolu_1', ['{}'])),
      toolResult('toolu_1', true),
      ...events(...callEnd('tool_use')),
      resultFrame({
        subtype: 'error_max_structured_output_retries', is_error: true, stop_reason: 'tool_use',
        errors: ['Failed to provide valid structured output after 5 attempts']
      })
    ]);

    expect(kinds(turn)).toEqual(['message_start', 'fail']);
    const fail = turn[1] as Extract<TurnEvent, { type: 'fail' }>;
    expect([fail.error.status, fail.error.type, fail.error.message])
      .toEqual([500, 'api_error', 'Failed to provide valid structured output after 5 attempts']);
  });

  it('drops prose text blocks and logs each one, so every text block is the JSON', () => {
    const debug = jest.fn();
    const turn = translateFormatRun([
      ...events(MESSAGE_START, ...prose(0, 'Here is the JSON:'), ...answer(1, 'toolu_1', ['{"a": 1}'])),
      toolResult('toolu_1'),
      ...events(...callEnd('tool_use'))
    ], debug);

    expect(kinds(turn)).toEqual(['message_start', 'start 0 text', 'stop 0', 'message_delta end_turn', 'message_stop']);
    expect(textOf(turn)).toBe('{"a": 1}');
    expect(debug).toHaveBeenCalledWith('Prose text block dropped from a structured-output turn', { index: 0 });
  });

  it('flushes the buffer as the text block when a max_tokens cut lands inside it', () => {
    const turn = translateFormatRun([
      ...events(MESSAGE_START, ...answer(0, 'toolu_1', ['{"word": "po']), ...callEnd('max_tokens')),
      // Upstream's auto-continuation, which the cut ignores.
      ...events(MESSAGE_START, ...answer(0, 'toolu_2', ['{"word": "pong"}']), ...callEnd('tool_use'))
    ]);

    expect(kinds(turn)).toEqual(['message_start', 'start 0 text', 'stop 0', 'message_delta max_tokens', 'message_stop', 'cut']);
    expect(textOf(turn)).toBe('{"word": "po');
  });

  it('flushes a block still open when the call is cut, closing it once', () => {
    const turn = translateFormatRun(events(
      MESSAGE_START, ...answer(0, 'toolu_1', ['{"word": "po']).slice(0, 2), ...callEnd('max_tokens'),
      { type: 'content_block_stop', index: 0 }
    ));

    expect(kinds(turn)).toEqual(['message_start', 'start 0 text', 'stop 0', 'message_delta max_tokens', 'message_stop', 'cut']);
  });

  it("holds the call's end when its tool_result comes after it", () => {
    const turn = translateFormatRun([
      ...events(MESSAGE_START, ...answer(0, 'toolu_1', ['{"a": ', '1}']), ...callEnd('tool_use')),
      toolResult('toolu_1')
    ]);

    expect(kinds(turn)).toEqual(['message_start', 'start 0 text', 'stop 0', 'message_delta end_turn', 'message_stop']);
    expect(textOf(turn)).toBe('{"a": 1}');
  });

  it('redacts inside the JSON text as tool input is redacted: string values only, so it stays parseable', () => {
    const turn = translateFormatRun([
      ...events(MESSAGE_START, ...answer(0, 'toolu_1', ['{"ok": tr', 'ue, "note": "tr', 'ue story"}'])),
      toolResult('toolu_1'),
      ...events(...callEnd('tool_use'))
    ], jest.fn(), ['true']);

    expect(JSON.parse(textOf(turn))).toEqual({ ok: true, note: '[redacted] story' });
  });

  it('takes a clean result as the answer when no tool_result came', () => {
    const turn = translateFormatRun([
      ...events(MESSAGE_START, ...answer(0, 'toolu_1', ['{"a": 1}']), ...callEnd('tool_use')),
      resultFrame({ result: '{"a":1}', stop_reason: 'tool_use', num_turns: 2 })
    ]);

    expect(kinds(turn)).toEqual(['message_start', 'start 0 text', 'stop 0', 'message_delta end_turn', 'message_stop']);
  });
});
