/**
 * The stop-sequence scan (spec section 12, ADR 0004): `stop_sequences` are emulated in the
 * translator. Only `text_delta` payloads are scanned; the scan holds back the longest sequence's
 * length minus one character, so a match split across deltas is found, and flushes the hold-back
 * at `content_block_stop`. On a match the text before it is relayed, the open block closed, and
 * the turn ends with `message_delta {stop_reason: "stop_sequence", stop_sequence}`, an estimated
 * `output_tokens`, `message_stop` and the `cut` signal; nothing upstream sends after it is relayed.
 */
import { MessageStream } from '@anthropic-ai/sdk/lib/MessageStream';
import { ApiEvent, createTranslator, TurnEvent } from '../../../../src/anthropic/translate';
import { Frame } from '../../../../src/upstream/frames';
import {
  BLOCK_STOP, END_TURN, MESSAGE_START, MESSAGE_STOP, resultFrame, streamEvent, TEXT_START, textDelta
} from '../../../mocks/anthropic/turn-frames';
import { EMAIL_PLACEHOLDER } from '../../../scripts/upstream-fixtures/live-values';

function translateWith(stopSequences: string[], frames: Frame[], redact: string[] = []): TurnEvent[] {
  const translator = createTranslator({ logger: { debug: jest.fn() }, stopSequences, redact });
  return [...frames.flatMap(frame => translator.push(frame)), ...translator.end()];
}

/** One plain call streaming `chunks` as text deltas of block 0, then upstream's own end. */
const textCall = (chunks: string[]): Frame[] =>
  [MESSAGE_START, TEXT_START, ...chunks.map(textDelta), BLOCK_STOP, END_TURN, MESSAGE_STOP].map(e => streamEvent(e));

const textDeltas = (events: TurnEvent[]): string[] => events.flatMap(event =>
  (event.type === 'content_block_delta' && event.delta['type'] === 'text_delta' ? [String(event.delta['text'])] : []));

const kinds = (events: TurnEvent[]): string[] => events
  .filter(event => event.type !== 'content_block_delta')
  .map(event => (event.type === 'content_block_start' ? `start ${event.index}`
    : event.type === 'content_block_stop' ? `stop ${event.index}` : event.type));

const messageDelta = (events: TurnEvent[]) =>
  events.find(event => event.type === 'message_delta') as Extract<ApiEvent, { type: 'message_delta' }>;

const CUT_TURN = ['message_start', 'start 0', 'stop 0', 'message_delta', 'message_stop', 'cut'];

describe('the stop-sequence scan', () => {
  it('ends the turn at a match inside one delta: the text before it, the block closed, stop_sequence, the cut', () => {
    const events = translateWith(['END'], textCall(['Hello ', 'there END of story', ' and more']));

    expect(textDeltas(events).join('')).toBe('Hello there ');
    expect(kinds(events)).toEqual(CUT_TURN);
    expect(messageDelta(events).delta).toEqual({
      stop_reason: 'stop_sequence', stop_sequence: 'END', stop_details: null, container: null
    });
    expect(events[events.length - 1]).toEqual({ type: 'cut', reason: 'stop_sequence' });
  });

  it('finds a match split across deltas', () => {
    const events = translateWith(['\n\nHuman:'], textCall(['One.\n', '\nHu', 'man: next', ' turn']));

    expect(textDeltas(events).join('')).toBe('One.');
    expect(messageDelta(events).delta['stop_sequence']).toBe('\n\nHuman:');
  });

  it('holds back the longest sequence minus one character, and flushes the hold-back at content_block_stop', () => {
    const events = translateWith(['END', 'STOP'], textCall(['abcdefg', 'hi', 'jklm']));

    expect(textDeltas(events)).toEqual(['abcd', 'ef', 'ghij', 'klm']);
    expect(events.map(event => event.type).slice(-4, -1)).toEqual(['content_block_delta', 'content_block_stop', 'message_delta']);
    expect(messageDelta(events)).toEqual(expect.objectContaining({ delta: END_TURN.delta }));
    expect(events.some(event => event.type === 'cut')).toBe(false);
  });

  it('never splits a surrogate pair between a relayed delta and the hold-back', () => {
    const events = translateWith(['XYZ'], textCall(['a\u{1F34A}b', 'cd']));

    expect(textDeltas(events)).toEqual(['a', '\u{1F34A}b', 'cd']);
  });

  it('stops at the sequence the model completed first', () => {
    const events = translateWith(['abcdef', 'cd'], textCall(['xxabcdefyy']));

    expect(textDeltas(events).join('')).toBe('xxab');
    expect(messageDelta(events).delta['stop_sequence']).toBe('cd');
  });

  it('relays no text when the block opens with the match, and still closes it', () => {
    const events = translateWith(['END'], textCall(['END', 'ignored']));

    expect(textDeltas(events)).toEqual([]);
    expect(kinds(events)).toEqual(CUT_TURN);
  });

  it('scans text only: thinking and tool input carrying a sequence pass untouched', () => {
    const frames = [
      MESSAGE_START,
      { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'say END' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'toolu_1', name: 'echo', input: {} } },
      { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"text":"END"}' } },
      { type: 'content_block_stop', index: 1 },
      { type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 9 } },
      MESSAGE_STOP
    ].map(e => streamEvent(e));

    const events = translateWith(['END'], frames);

    expect(events.some(event => event.type === 'cut')).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({ delta: { type: 'input_json_delta', partial_json: '{"text":"END"}' } }));
    expect(events).toContainEqual(expect.objectContaining({ delta: { type: 'thinking_delta', thinking: 'say END' } }));
  });

  it("estimates output_tokens: the call's start count plus the relayed characters over four, input from message_start", () => {
    const start = {
      ...MESSAGE_START,
      message: { ...MESSAGE_START.message, usage: {
        input_tokens: 12, cache_creation_input_tokens: 30, cache_read_input_tokens: 400, output_tokens: 1
      } }
    };
    const frames = [start, TEXT_START, textDelta('Nine char'), textDelta('s. END')].map(e => streamEvent(e));

    const events = translateWith(['END'], frames);

    expect(textDeltas(events).join('')).toBe('Nine chars. ');
    expect(messageDelta(events).usage).toEqual({
      input_tokens: 12, cache_creation_input_tokens: 30, cache_read_input_tokens: 400, output_tokens: 1 + 3
    });
  });

  it('ignores whatever upstream sends after the cut, a failed result included', () => {
    const frames = [
      ...textCall(['stop HERE please']),
      resultFrame({ subtype: 'error_during_execution', is_error: true, stop_reason: null })
    ];

    const events = translateWith(['HERE'], frames);

    expect(kinds(events)).toEqual(CUT_TURN);
    expect(events.filter(event => event.type === 'cut')).toHaveLength(1);
  });

  it('changes nothing when no sequence is given', () => {
    const frames = textCall(['Hello END world']);

    expect(translateWith([], frames)).toEqual(translateWith([], frames));
    expect(textDeltas(translateWith([], frames))).toEqual(['Hello END world']);
  });

  it('closes the block before message_delta, so redaction releases its held tail first', () => {
    const events = translateWith(['STOP'], textCall([`write to ${EMAIL_PLACEHOLDER.slice(0, 6)}`, `${EMAIL_PLACEHOLDER.slice(6)} STOP`]),
      [EMAIL_PLACEHOLDER]);

    expect(textDeltas(events).join('')).toBe('write to [redacted] ');
    expect(kinds(events)).toEqual(CUT_TURN);
  });

  it("is read by the SDK's accumulator as the real API's stop_sequence message", async () => {
    const events = translateWith(['END'], textCall(['Hello END'])).filter(event => event.type !== 'cut');
    const body = new TextEncoder().encode(events.map(event => JSON.stringify(event)).join('\n') + '\n');
    const stream = new ReadableStream({ start(controller) { controller.enqueue(body); controller.close(); } });

    const message = await MessageStream.fromReadableStream(stream).finalMessage();

    expect(message).toEqual(expect.objectContaining({
      stop_reason: 'stop_sequence', stop_sequence: 'END', content: [expect.objectContaining({ type: 'text', text: 'Hello ' })]
    }));
  });
});
