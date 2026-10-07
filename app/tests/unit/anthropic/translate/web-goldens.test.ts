/**
 * Every recorded web-tool turn with partial messages is a translator golden (spec sections 8 and
 * 11): upstream's several model calls become one surface message. Frames in, the turn stream out,
 * compared with `tests/fixtures/turn-streams/<fixture>.json`, and checked against oracles the
 * translator never reads: the recording's `assistant` frames (the model's calls), its `user`
 * frames (what each call returned), `result.usage` (measured equal to the summed per-call usage),
 * the probe hook's log (its denials) and the official SDK's accumulator.
 *
 * After a deliberate change to the turn stream, rewrite the goldens and review the diff:
 *   UPDATE_TURN_STREAM_GOLDENS=1 npm run test:unit -- tests/unit/anthropic/translate/web-goldens
 */
import * as fs from 'fs';
import * as path from 'path';
import { accumulate } from '../../../../src/anthropic/respond';
import { ApiEvent, TurnEvent } from '../../../../src/anthropic/translate';
import { JsonObject } from '../../../../src/upstream/frames';
import { sdkFinalMessage } from '../../../mocks/anthropic/sdk-oracle';
import {
  NOW, recordedCalls, recordedDenials, recordedResult, recordedResults, translateWeb, WEB_RECORDINGS, webFrames
} from '../../../mocks/anthropic/web-recordings';

const GOLDENS = path.resolve(__dirname, '..', '..', '..', 'fixtures', 'turn-streams');
const UPDATE = process.env['UPDATE_TURN_STREAM_GOLDENS'] === '1';
const NEVER_RELAYED = ['caller', 'wire_tool_inputs', 'iterations', 'estimated_tokens', 'ttft_ms', 'uuid', 'session_id',
  'parent_tool_use_id', 'mode', 'prompt', 'searchCount', 'durationSeconds'];
const COUNTERS = ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'];
const SERVER_NAMES: Record<string, string> = { WebSearch: 'web_search', WebFetch: 'web_fetch' };

function golden(name: string, events: TurnEvent[]): unknown {
  const file = path.join(GOLDENS, `${name}.json`);
  if (UPDATE) fs.writeFileSync(file, JSON.stringify(events, null, 2) + '\n');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const pick = (object: JsonObject, keys: string[]): JsonObject =>
  Object.fromEntries(keys.filter(key => key in object).map(key => [key, object[key]]));

/** What the spec says each call's result block holds, built from what upstream's tool returned. */
function expectedResult(call: { name: string }, recorded: { block: JsonObject; toolUseResult: unknown }, denied?: string): unknown {
  if (call.name === 'WebSearch') {
    if (denied) return { type: 'web_search_tool_result_error', error_code: denied };
    const results = (recorded.toolUseResult as { results: unknown[] }).results
      .flatMap(result => (typeof result === 'object' && result !== null ? (result as { content: JsonObject[] }).content : []));
    return results.map(({ url, title }) =>
      ({ type: 'web_search_result', url, title, encrypted_content: expect.any(String), page_age: null }));
  }
  if (denied) return { type: 'web_fetch_tool_result_error', error_code: denied };
  return {
    type: 'web_fetch_result', url: (recorded.toolUseResult as { url: string }).url, retrieved_at: new Date(NOW).toISOString(),
    content: { type: 'document', source: { type: 'text', media_type: 'text/plain', data: recorded.block['content'] }, title: null }
  };
}

describe.each(WEB_RECORDINGS)('web-tool turn golden: $name', ({ name, denialCode }) => {
  const denials = recordedDenials(name, denialCode);
  const events = translateWeb(webFrames(name), denials) as ApiEvent[];
  const calls = recordedCalls(name);
  const results = recordedResults(name);
  const result = recordedResult(name);

  it('matches the committed turn stream', () => {
    expect(events).toEqual(golden(name, events));
  });

  it("is one message in the real API's event order: blocks numbered from 0 in turn, each closed before the next", () => {
    const order = events.filter(event => event.type !== 'content_block_delta').map(event =>
      (event.type === 'content_block_start' ? `start ${event.index}` : event.type === 'content_block_stop' ? `stop ${event.index}` : event.type));
    const blockCount = order.filter(entry => entry.startsWith('start')).length;
    const expected = ['message_start'];
    for (let index = 0; index < blockCount; index++) expected.push(`start ${index}`, `stop ${index}`);

    expect(order).toEqual([...expected, 'message_delta', 'message_stop']);
  });

  it("pairs each of the model's calls with its result block, in upstream's order, the input filtered", async () => {
    const message = accumulate(events);
    const serverBlocks = message.content.filter(block => block['type'] !== 'text' && block['type'] !== 'thinking');

    expect(serverBlocks).toEqual(calls.flatMap(call => {
      const recorded = results.get(call.id);
      const key = call.name === 'WebSearch' ? 'query' : 'url';
      const id = expect.stringMatching(/^srvtoolu_/);
      return [
        { type: 'server_tool_use', id, name: SERVER_NAMES[call.name], input: { [key]: call.input[key] } },
        { type: `${SERVER_NAMES[call.name]}_tool_result`, tool_use_id: id,
          content: recorded ? expectedResult(call, recorded, denials.get(call.id)) : undefined }
      ];
    }));
    for (let index = 0; index < serverBlocks.length; index += 2) {
      expect(serverBlocks[index + 1]?.['tool_use_id']).toBe(serverBlocks[index]?.['id']);
    }
    expect(await sdkFinalMessage(events)).toEqual(message);
  });

  it("sums every call's usage into the final message_delta, equal to the result's, and counts the requests", () => {
    const delta = events.find(event => event.type === 'message_delta') as Extract<ApiEvent, { type: 'message_delta' }>;
    const counted = (tool: string) => calls.filter(call => call.name === tool && !denials.has(call.id))
      .reduce((sum, call) => sum + ((results.get(call.id)?.toolUseResult as { searchCount?: number }).searchCount ?? 1), 0);

    expect(pick(delta.usage, COUNTERS)).toEqual(pick(result.usage, COUNTERS));
    expect(delta.usage['cache_creation']).toEqual(result.usage['cache_creation']);
    expect(delta.usage['output_tokens_details']).toEqual(result.usage['output_tokens_details']);
    expect(delta.usage['server_tool_use']).toEqual({ web_search_requests: counted('WebSearch'), web_fetch_requests: counted('WebFetch') });
    expect(events[0]).toEqual(expect.objectContaining({ type: 'message_start' }));
  });

  it('carries no field the API does not define', () => {
    const names = new Set<string>();
    JSON.stringify(events, (key, value: unknown) => { names.add(key); return value; });

    expect(NEVER_RELAYED.filter(field => names.has(field))).toEqual([]);
  });
});
