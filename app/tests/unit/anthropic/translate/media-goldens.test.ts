/**
 * Translator goldens from the pass-through recordings (spec sections 4.3 and 11): the turns in
 * which upstream answered a text, content and base64 PDF document (`o-pass-through-run1`, turns 1
 * to 3) and a document with `title`, `context` and `citations` enabled (`o-pass-through-run2`,
 * turn 1). Frames in, the turn stream out, compared with the committed events in
 * `tests/fixtures/turn-streams/<fixture>.turn<n>.json`, and checked against oracles the
 * translator never reads: the recording's `assistant` frames (text), its citation (upstream's
 * `assistant` frame says `citations: []`, so the stream is the only carrier) and `result`
 * (usage, stop reason), and the official SDK's own accumulator for the non-streaming message.
 * The turn in which the API refused mixed citation settings fails with the API's 400.
 *
 * After a deliberate change to the turn stream, rewrite the goldens and review the diff:
 *   UPDATE_TURN_STREAM_GOLDENS=1 npm run test:unit -- tests/unit/anthropic/translate/media-goldens
 */
import { MessageStream } from '@anthropic-ai/sdk/lib/MessageStream';
import * as fs from 'fs';
import * as path from 'path';
import { accumulate } from '../../../../src/anthropic/respond';
import { ApiEvent, FailSignal, TurnEvent } from '../../../../src/anthropic/translate';
import { JsonObject } from '../../../../src/upstream/frames';
import { translate } from '../../../mocks/anthropic/turn-frames';
import { recordedTurnFrames, recordedTurnStdout } from '../../../mocks/upstream/recorded-turns';

const RUN1 = 'cli-probes/o-pass-through-run1.jsonl';
const RUN2 = 'cli-probes/o-pass-through-run2.jsonl';
const TURNS: [string, number, string][] = [
  [RUN1, 1, 'a text document'], [RUN1, 2, 'a content document'], [RUN1, 3, 'a base64 PDF document'],
  [RUN2, 1, 'a document with title, context and citations']
];
const GOLDENS = path.resolve(__dirname, '..', '..', '..', 'fixtures', 'turn-streams');
const UPDATE = process.env['UPDATE_TURN_STREAM_GOLDENS'] === '1';
const COUNTERS = ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'];

type Recorded = JsonObject & { type: string; event?: JsonObject & { type: string; delta?: JsonObject };
  message?: { content: JsonObject[] } };

function golden(name: string, events: TurnEvent[]): unknown {
  const file = path.join(GOLDENS, `${name}.json`);
  if (UPDATE) fs.writeFileSync(file, JSON.stringify(events, null, 2) + '\n');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** What the official SDK's `finalMessage()` makes of these events, less its client-side `parsed_output`. */
async function sdkFinalMessage(events: ApiEvent[]): Promise<unknown> {
  const body = new TextEncoder().encode(events.map(event => JSON.stringify(event)).join('\n') + '\n');
  const stream = new ReadableStream({ start(controller) { controller.enqueue(body); controller.close(); } });
  const { parsed_output: _clientSide, ...message } = await MessageStream.fromReadableStream(stream).finalMessage();
  return message;
}

const pick = (object: JsonObject, keys: string[]): JsonObject =>
  Object.fromEntries(keys.filter(key => key in object).map(key => [key, object[key]]));

describe.each(TURNS)('pass-through golden: %s turn %d (%s)', (fixture, turn) => {
  const name = `${path.basename(fixture, '.jsonl')}.turn${turn}`;
  const events = translate(recordedTurnFrames(fixture, turn)) as ApiEvent[];
  const stdout = recordedTurnStdout(fixture, turn) as Recorded[];
  const assistantBlocks = stdout.filter(frame => frame.type === 'assistant').flatMap(frame => frame.message?.content ?? []);
  const result = stdout.find(frame => frame.type === 'result') as Recorded & { usage: JsonObject; stop_reason: string };

  it('matches the committed turn stream', () => {
    expect(events).toEqual(golden(name, events));
  });

  it("answers with the recorded text, and usage and stop_reason equal to the result's", () => {
    const message = accumulate(events);

    expect(message.content.map(block => block['text'])).toEqual(assistantBlocks.map(block => block['text']));
    expect(message['stop_reason']).toBe(result.stop_reason);
    expect(pick(message.usage, COUNTERS)).toEqual(pick(result.usage, COUNTERS));
  });

  it("accumulates into the message the official SDK's accumulator builds", async () => {
    expect(accumulate(events)).toEqual(await sdkFinalMessage(events));
  });
});

describe('pass-through golden: the citation', () => {
  const recordedCitation = (recordedTurnStdout(RUN2, 1) as Recorded[])
    .map(frame => frame.event?.delta)
    .find(delta => delta?.['type'] === 'citations_delta')?.['citation'];

  it('relays the citations_delta and accumulates the citation onto its text block', () => {
    const events = translate(recordedTurnFrames(RUN2, 1)) as ApiEvent[];

    expect(recordedCitation).toEqual(expect.objectContaining({ type: 'char_location', document_title: 'Saffron memo' }));
    expect(events).toContainEqual({ type: 'content_block_delta', index: 1,
      delta: { type: 'citations_delta', citation: recordedCitation } });
    expect(accumulate(events).content[1]).toEqual({ type: 'text', text: 'The codeword is saffron-5', citations: [recordedCitation] });
  });
});

describe('pass-through: mixed citation settings', () => {
  it("fails with the API's 400 and its own message, relaying nothing else", () => {
    const events = translate(recordedTurnFrames(RUN1, 6));

    expect(events.map(event => event.type)).toEqual(['fail']);
    const { error } = events[0] as FailSignal;
    expect({ status: error.status, type: error.type, message: error.message, retryable: error.retryable }).toEqual({
      status: 400, type: 'invalid_request_error', retryable: false,
      message: 'messages.9.content: Citations must be either enabled or disabled on all `document` blocks. ' +
        'A mixture of enabling and disabling is not supported at this time.'
    });
  });
});
