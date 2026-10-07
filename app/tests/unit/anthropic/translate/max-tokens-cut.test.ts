/**
 * The `max_tokens` cut (spec section 12, ADR 0004): upstream does not stop at its output cap; it
 * injects a "resume directly" message and calls the model again, up to four times. The surface
 * ends the turn at the first call that stops with `max_tokens`: that call's `message_delta` and
 * `message_stop` are relayed (the real API's shape: partial content, `output_tokens` = the cap),
 * then the `cut` signal, and nothing after it. `result` never overrides the relayed stop reason.
 *
 * The golden is `t1-max-output-100` (four capped calls, then a synthetic error and an error
 * `result` that says `stop_reason: "stop_sequence"`), checked against the recording's own first
 * `assistant` frame and first `message_delta`, which the translator never reads.
 *
 * After a deliberate change to the turn stream, rewrite the golden and review the diff:
 *   UPDATE_TURN_STREAM_GOLDENS=1 npm run test:unit -- tests/unit/anthropic/translate/max-tokens-cut
 */
import * as fs from 'fs';
import * as path from 'path';
import { ApiEvent, TurnEvent } from '../../../../src/anthropic/translate';
import {
  BLOCK_STOP, MESSAGE_START, MESSAGE_STOP, resultFrame, streamEvent, TEXT_START, textDelta, translate
} from '../../../mocks/anthropic/turn-frames';
import { recordedFrames, recordedStdout } from '../../../mocks/upstream/recordings';

const FIXTURE = 'cli-probes/t1-max-output-100.jsonl';
const GOLDEN = path.resolve(__dirname, '..', '..', '..', 'fixtures', 'turn-streams', 't1-max-output-100.json');
const UPDATE = process.env['UPDATE_TURN_STREAM_GOLDENS'] === '1';
/** The recording ran with `CLAUDE_CODE_MAX_OUTPUT_TOKENS=100`. */
const CAP = 100;

type Recorded = {
  type: string;
  message?: { model?: string; content: { type: string; text?: string }[] };
  event?: { type: string; delta?: Record<string, unknown>; usage?: Record<string, unknown> };
};

function golden(events: TurnEvent[]): unknown {
  if (UPDATE) fs.writeFileSync(GOLDEN, JSON.stringify(events, null, 2) + '\n');
  return JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
}

const kinds = (events: TurnEvent[]): string[] => events
  .filter(event => event.type !== 'content_block_delta')
  .map(event => (event.type === 'content_block_start' ? `start ${event.index}`
    : event.type === 'content_block_stop' ? `stop ${event.index}` : event.type));

const textOf = (events: TurnEvent[]): string => events
  .flatMap(event => (event.type === 'content_block_delta' && event.delta['type'] === 'text_delta' ? [event.delta['text']] : []))
  .join('');

const maxTokensDelta = { type: 'message_delta', delta: { stop_reason: 'max_tokens', stop_sequence: null }, usage: { output_tokens: 3 } };

describe('the max_tokens cut: t1-max-output-100 golden (four capped calls become one cut turn)', () => {
  const events = translate(recordedFrames(FIXTURE));
  const stdout = recordedStdout(FIXTURE) as Recorded[];
  const firstAnswer = stdout.find(frame => frame.type === 'assistant' && frame.message?.model !== '<synthetic>');
  const firstDelta = stdout.find(frame => frame.type === 'stream_event' && frame.event?.type === 'message_delta');

  it('matches the committed turn stream', () => {
    expect(events).toEqual(golden(events));
  });

  it("is the first call alone, closed by its own message_delta and message_stop, then the cut", () => {
    expect(kinds(events)).toEqual(['message_start', 'start 0', 'stop 0', 'message_delta', 'message_stop', 'cut']);
    expect(events[events.length - 1]).toEqual({ type: 'cut', reason: 'max_tokens' });
  });

  it("carries the first call's partial text, and nothing of the auto-continuations", () => {
    expect(textOf(events)).toBe(firstAnswer?.message?.content[0]?.text);
  });

  it("reports stop_reason max_tokens and output_tokens equal to the cap, whatever result says", () => {
    const delta = events.find(event => event.type === 'message_delta') as Extract<ApiEvent, { type: 'message_delta' }>;

    expect(delta.delta['stop_reason']).toBe('max_tokens');
    expect(delta.usage['output_tokens']).toBe(CAP);
    expect(delta.usage['input_tokens']).toBe(firstDelta?.event?.usage?.['input_tokens']);
    expect(events.some(event => event.type === 'fail')).toBe(false);
  });
});

describe('the max_tokens cut on hand-built frames', () => {
  it('ignores every frame after the cut, a failed result included', () => {
    const events = translate([
      ...[MESSAGE_START, TEXT_START, textDelta('par'), BLOCK_STOP, maxTokensDelta, MESSAGE_STOP].map(e => streamEvent(e)),
      ...[MESSAGE_START, TEXT_START, textDelta('tial'), BLOCK_STOP, maxTokensDelta, MESSAGE_STOP].map(e => streamEvent(e)),
      resultFrame({ subtype: 'error_during_execution', is_error: true, stop_reason: null })
    ]);

    expect(kinds(events)).toEqual(['message_start', 'start 0', 'stop 0', 'message_delta', 'message_stop', 'cut']);
    expect(textOf(events)).toBe('par');
  });

  it('is no cut when the call ends any other way', () => {
    const events = translate([
      MESSAGE_START, TEXT_START, textDelta('hi'), BLOCK_STOP,
      { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 2 } },
      MESSAGE_STOP
    ].map(e => streamEvent(e)));

    expect(events.some(event => event.type === 'cut')).toBe(false);
  });
});
