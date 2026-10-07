/**
 * Structured output (spec section 12): upstream answers a `--json-schema` run through a
 * `tool_use` block named `StructuredOutput`, its synthetic `tool_result` inside the same model
 * call, then that call's `message_delta {stop_reason: "tool_use"}`. The turn stream is the real
 * API's shape instead: one `text` block whose deltas are the buffered `partial_json` chunks (empty
 * ones skipped), and `stop_reason: "end_turn"`.
 *
 * The golden is `t3-json-schema-stream`, checked against oracles the translator never reads: the
 * recording's `result.structured_output` and `result.usage`, and its `input_json_delta` chunks.
 *
 * After a deliberate change to the turn stream, rewrite the golden and review the diff:
 *   UPDATE_TURN_STREAM_GOLDENS=1 npm run test:unit -- tests/unit/anthropic/translate/structured-output-golden
 */
import * as fs from 'fs';
import * as path from 'path';
import { ApiEvent, createTranslator, TurnEvent } from '../../../../src/anthropic/translate';
import { Frame } from '../../../../src/upstream/frames';
import { recordedFrames, recordedStdout } from '../../../mocks/upstream/recordings';

const FIXTURE = 'cli-probes/t3-json-schema-stream.jsonl';
const GOLDEN = path.resolve(__dirname, '..', '..', '..', 'fixtures', 'turn-streams', 't3-json-schema-stream.json');
const UPDATE = process.env['UPDATE_TURN_STREAM_GOLDENS'] === '1';

type Recorded = {
  type: string;
  structured_output?: unknown;
  usage?: Record<string, unknown>;
  event?: { type: string; delta?: { type?: string; partial_json?: string } };
};

function golden(events: TurnEvent[]): unknown {
  if (UPDATE) fs.writeFileSync(GOLDEN, JSON.stringify(events, null, 2) + '\n');
  return JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
}

function translateFormatRun(frames: Frame[]): TurnEvent[] {
  const translator = createTranslator({ logger: { debug: jest.fn() }, structuredOutput: true });
  return [...frames.flatMap(frame => translator.push(frame)), ...translator.end()];
}

const kinds = (events: TurnEvent[]): string[] => events
  .filter(event => event.type !== 'content_block_delta')
  .map(event => (event.type === 'content_block_start' ? `start ${event.index}`
    : event.type === 'content_block_stop' ? `stop ${event.index}` : event.type));

const textDeltas = (events: TurnEvent[]): string[] => events.flatMap(event =>
  (event.type === 'content_block_delta' && event.delta['type'] === 'text_delta' ? [String(event.delta['text'])] : []));

describe('structured output: t3-json-schema-stream golden (the StructuredOutput call becomes one text block)', () => {
  const events = translateFormatRun(recordedFrames(FIXTURE));
  const stdout = recordedStdout(FIXTURE) as Recorded[];
  const result = stdout.find(frame => frame.type === 'result') as Recorded;
  const chunks = stdout
    .filter(frame => frame.type === 'stream_event' && frame.event?.delta?.type === 'input_json_delta')
    .map(frame => String(frame.event?.delta?.partial_json));

  it('matches the committed turn stream', () => {
    expect(events).toEqual(golden(events));
  });

  it("is the real API's structured-output shape: message_start, one text block, message_delta, message_stop", () => {
    expect(kinds(events)).toEqual(['message_start', 'start 0', 'stop 0', 'message_delta', 'message_stop']);
    expect(events[1]).toEqual({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
  });

  it("carries the buffered partial_json chunks as the text deltas, empty ones skipped", () => {
    expect(textDeltas(events)).toEqual(chunks.filter(chunk => chunk !== ''));
    expect(chunks).toContain('');
  });

  it('is JSON equal to the structured_output upstream reported, which the translator never reads', () => {
    expect(JSON.parse(textDeltas(events).join(''))).toEqual(result.structured_output);
  });

  it("rewrites that call's stop_reason tool_use to end_turn and keeps its usage", () => {
    const delta = events.find(event => event.type === 'message_delta') as Extract<ApiEvent, { type: 'message_delta' }>;

    expect(delta.delta['stop_reason']).toBe('end_turn');
    expect(delta.usage['output_tokens']).toBe(result.usage?.['output_tokens']);
    expect(JSON.stringify(events)).not.toMatch(/StructuredOutput|tool_use|input_json_delta/);
  });
});
