/**
 * Every recorded plain turn (one model call, partial messages) is a translator golden (spec
 * Testing Decisions): frames in, the turn stream out, compared with the committed events in
 * `tests/fixtures/turn-streams/<fixture>.json`, and checked against oracles the translator never
 * reads: the recording's `assistant` frames (block content), `system/init` (model) and `result`
 * (usage and stop reason, measured equal to the summed `message_delta.usage`).
 *
 * After a deliberate change to the turn stream, rewrite the goldens and review the diff:
 *   UPDATE_TURN_STREAM_GOLDENS=1 npm run test:unit -- tests/unit/anthropic/translate/plain-goldens
 */
import * as fs from 'fs';
import * as path from 'path';
import { ApiEvent, TurnEvent } from '../../../../src/anthropic/translate';
import { JsonObject } from '../../../../src/upstream/frames';
import { translate } from '../../../mocks/anthropic/turn-frames';
import { recordedFrames, recordedStdout } from '../../../mocks/upstream/recordings';

const PLAIN_FIXTURES = [
  'c-partial', 'm-thinking-partial', 'p1-empty-system-prompt', 'p2-empty-system-prompt-repeat',
  'p3-helpful-assistant-persisted', 'p5-safe-mode-disable-slash', 'p6-resume-snapshot-off', 'p7-resume-snapshot-on',
  'r2-exclude-dynamic', 'r3-baseline-disclosure', 'r4-system-instruction-disclosure', 'r5-disable-attachments-env',
  'r6-nonessential-traffic-env', 't2-alias-sonnet-effort-low', 't4-haiku-baseline', 't5-haiku-disable-thinking',
  't6-haiku-max-thinking-1024'
];
const GOLDENS = path.resolve(__dirname, '..', '..', '..', 'fixtures', 'turn-streams');
const UPDATE = process.env['UPDATE_TURN_STREAM_GOLDENS'] === '1';
const NEVER_RELAYED = ['caller', 'wire_tool_inputs', 'iterations', 'estimated_tokens', 'thinking_display', 'ttft_ms',
  'uuid', 'session_id', 'parent_tool_use_id', 'context_management', 'safeguard_results', 'input_transformations'];
const COUNTERS = ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'];

const thinkingTokens = (usage: JsonObject): unknown =>
  (usage['output_tokens_details'] as { thinking_tokens?: number } | undefined)?.thinking_tokens ?? 0;

type Recorded = JsonObject & { type: string; subtype?: string; message?: JsonObject & { content: JsonObject[] } };

function golden(name: string, events: TurnEvent[]): unknown {
  const file = path.join(GOLDENS, `${name}.json`);
  if (UPDATE) {
    fs.mkdirSync(GOLDENS, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(events, null, 2) + '\n');
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Each surface block rebuilt from its events: start block, text/thinking appended, signature set. */
function blocksOf(events: ApiEvent[]): JsonObject[] {
  const blocks: JsonObject[] = [];
  for (const event of events) {
    if (event.type === 'content_block_start') blocks.push({ ...event.content_block });
    if (event.type !== 'content_block_delta') continue;
    const block = blocks[event.index] as JsonObject;
    const { type, text, thinking, signature } = event.delta as Record<string, string>;
    if (type === 'text_delta') block['text'] = String(block['text']) + text;
    if (type === 'thinking_delta') block['thinking'] = String(block['thinking']) + thinking;
    if (type === 'signature_delta') block['signature'] = signature;
  }
  return blocks;
}

const pick = (object: JsonObject, keys: string[]): JsonObject =>
  Object.fromEntries(keys.filter(key => key in object).map(key => [key, object[key]]));

describe.each(PLAIN_FIXTURES)('plain turn golden: %s', (name) => {
  const fixture = `cli-probes/${name}.jsonl`;
  const events = translate(recordedFrames(fixture)) as ApiEvent[];
  const stdout = recordedStdout(fixture) as Recorded[];
  const init = stdout.find(frame => frame.type === 'system' && frame.subtype === 'init') as Recorded;
  const result = stdout.find(frame => frame.type === 'result') as Recorded & { usage: JsonObject; stop_reason: string };
  const assistantBlocks = stdout.filter(frame => frame.type === 'assistant').flatMap(frame => frame.message?.content ?? []);

  it('matches the committed turn stream', () => {
    expect(events).toEqual(golden(name, events));
  });

  it("is the real API's event order: one message_start, contiguous blocks, message_delta, message_stop", () => {
    const blockCount = assistantBlocks.length;
    const expected = ['message_start'];
    for (let index = 0; index < blockCount; index++) expected.push(`start ${index}`, `stop ${index}`);
    expected.push('message_delta', 'message_stop');

    const order = events
      .filter(event => event.type !== 'content_block_delta')
      .map(event => (event.type === 'content_block_start' ? `start ${event.index}`
        : event.type === 'content_block_stop' ? `stop ${event.index}` : event.type));
    expect(order).toEqual(expected);
  });

  it("rebuilds the recorded assistant blocks from the deltas", () => {
    expect(blocksOf(events)).toEqual(assistantBlocks.map(block => pick(block, ['type', 'text', 'thinking', 'signature'])));
  });

  it("relays upstream's model, and usage and stop_reason equal to the result's", () => {
    const start = events[0] as Extract<ApiEvent, { type: 'message_start' }>;
    const delta = events.find(event => event.type === 'message_delta') as Extract<ApiEvent, { type: 'message_delta' }>;

    expect(start.message['model']).toBe(init['model']);
    expect(delta.delta['stop_reason']).toBe(result.stop_reason);
    expect(pick(delta.usage, COUNTERS)).toEqual(pick(result.usage, COUNTERS));
    // Upstream omits the details on a call without thinking (t5); `result` reports 0 there.
    expect(thinkingTokens(delta.usage)).toBe(thinkingTokens(result.usage));
  });

  it('carries no field the API does not define', () => {
    const names = new Set<string>();
    JSON.stringify(events, (key, value: unknown) => { names.add(key); return value; });

    expect(NEVER_RELAYED.filter(field => names.has(field))).toEqual([]);
  });
});
