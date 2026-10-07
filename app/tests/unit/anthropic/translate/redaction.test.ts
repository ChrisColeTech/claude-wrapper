/**
 * The redaction pass (spec sections 6 and 11): with strings armed, every occurrence in a
 * `text_delta` or `input_json_delta` payload reaches the client as `[redacted]`, matched
 * case-insensitively as a whole word, also when upstream splits it across deltas. Armed on the
 * fixtures' placeholders only, never on an operator's live values.
 */
import { MessageStream } from '@anthropic-ai/sdk/lib/MessageStream';
import { createTranslator, TurnEvent } from '../../../../src/anthropic/translate';
import { Frame } from '../../../../src/upstream/frames';
import {
  BLOCK_STOP, END_TURN, MESSAGE_START, MESSAGE_STOP, streamEvent, TEXT_START, textDelta
} from '../../../mocks/anthropic/turn-frames';

const EMAIL = 'user@example.invalid';
const NAME = 'Example User';

function translateArmed(redact: readonly string[], events: object[]): TurnEvent[] {
  const translator = createTranslator({ logger: { debug: jest.fn() }, redact });
  const frames: Frame[] = events.map(event => streamEvent(event));
  return [...frames.flatMap(frame => translator.push(frame)), ...translator.end()];
}

/** The text a client rebuilds from the turn's text deltas. */
const textOf = (events: TurnEvent[]): string => events
  .flatMap(event => (event.type === 'content_block_delta' && event.delta['type'] === 'text_delta' ? [event.delta['text']] : []))
  .join('');

const textTurn = (...chunks: string[]): object[] =>
  [MESSAGE_START, TEXT_START, ...chunks.map(textDelta), BLOCK_STOP, END_TURN, MESSAGE_STOP];

describe('redaction pass: text deltas', () => {
  it('replaces an armed address with [redacted]', () => {
    const events = translateArmed([EMAIL], textTurn(`Your address is ${EMAIL}, as asked.`));

    expect(textOf(events)).toBe('Your address is [redacted], as asked.');
  });

  it('matches regardless of case', () => {
    const events = translateArmed([EMAIL], textTurn('Mail USER@Example.INVALID today.'));

    expect(textOf(events)).toBe('Mail [redacted] today.');
  });

  it('catches an address split across deltas, relaying no part of it', () => {
    const events = translateArmed([EMAIL], textTurn('It is **us', 'er@exam', '', 'ple.inv', 'alid** here.'));

    expect(textOf(events)).toBe('It is **[redacted]** here.');
  });

  it('catches an address that ends the block, split over its last deltas', () => {
    const events = translateArmed([EMAIL], textTurn('Address: user@example', '.invalid'));

    expect(textOf(events)).toBe('Address: [redacted]');
    expect(events.map(event => event.type).slice(-4))
      .toEqual(['content_block_delta', 'content_block_stop', 'message_delta', 'message_stop']);
  });

  it("releases a held tail that never became an armed string at the block's end", () => {
    const events = translateArmed([NAME], textTurn('Read the Exam'));

    expect(textOf(events)).toBe('Read the Exam');
    expect(events.map(event => event.type).slice(-5, -2))
      .toEqual(['content_block_delta', 'content_block_delta', 'content_block_stop']);
  });

  it('releases what it holds, redacted, when the frames end inside a block', () => {
    const events = translateArmed([EMAIL], [MESSAGE_START, TEXT_START, textDelta('Write to user@example.invalid')]);

    expect(textOf(events)).toBe('Write to [redacted]');
  });
});

describe('redaction pass: whole words', () => {
  it('leaves an armed string inside a longer word alone', () => {
    const events = translateArmed(['Zed'], textTurn('Authorized by Zed, not by Zedd.'));

    expect(textOf(events)).toBe('Authorized by [redacted], not by Zedd.');
  });

  it('prefers the longest armed string, also when it arrives in pieces', () => {
    const events = translateArmed(['Example', NAME], textTurn('Signed: Exam', 'ple Us', 'er. Example only.'));

    expect(textOf(events)).toBe('Signed: [redacted]. [redacted] only.');
  });

  it('relays deltas that hold nothing armed exactly as they came', () => {
    const turn = textTurn('Hello', ' there, ', 'Examiner', ' user.');

    expect(translateArmed([EMAIL, NAME], turn)).toEqual(translateArmed([], turn));
  });
});

describe('redaction pass: tool input deltas', () => {
  const toolTurn = (...chunks: string[]): object[] => [
    MESSAGE_START,
    { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_1', name: 'send', input: {} } },
    ...chunks.map(partial_json => ({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json } })),
    BLOCK_STOP,
    { type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 9 } },
    MESSAGE_STOP
  ];

  /** The tool input the official SDK's stream accumulator parses from the turn. */
  async function sdkInput(events: TurnEvent[]): Promise<unknown> {
    const body = new TextEncoder().encode(events.map(event => JSON.stringify(event)).join('\n') + '\n');
    const stream = new ReadableStream({ start(controller) { controller.enqueue(body); controller.close(); } });
    const message = await MessageStream.fromReadableStream(stream).finalMessage();
    return (message.content[0] as { input: unknown }).input;
  }

  it('redacts an address split across input_json_delta chunks, and the SDK parses the input', async () => {
    const events = translateArmed([EMAIL, NAME], toolTurn('{"to": "us', 'er@example.inv', 'alid", "note": "for ', 'Example User"}'));

    expect(await sdkInput(events)).toEqual({ to: '[redacted]', note: 'for [redacted]' });
  });

  it('matches only inside string values, never JSON structure', async () => {
    const events = translateArmed(['true'], toolTurn('{"urgent": true, "s', 'ubject": "true story"}'));

    expect(await sdkInput(events)).toEqual({ urgent: true, subject: '[redacted] story' });
  });

  it('counts a JSON escape as a boundary and never rewrites an escaped character', async () => {
    const events = translateArmed([NAME, 'next'], toolTurn('{"a": "Hi\\nExample User", "b": "1\\next"}'));

    expect(await sdkInput(events)).toEqual({ a: 'Hi\n[redacted]', b: '1\next' });
  });
});
