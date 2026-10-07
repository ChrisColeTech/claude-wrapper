/**
 * Every connector fixture is a translator golden (spec sections 9 and 11): upstream's model calls
 * around its connector calls become one surface message, each call an `mcp_tool_use` and its
 * result an `mcp_tool_result`. Frames in, the turn stream out, compared with
 * `tests/fixtures/turn-streams/<fixture>.json` and checked against oracles the translator never
 * reads: the recording's `assistant` frames (the calls), its `user` frames (their results),
 * `result.usage`, and the beta SDK's accumulator. The fixture is e2e scenario 9's real round trip,
 * whose connector result came back as a string.
 *
 * After a deliberate change to the turn stream, rewrite the goldens and review the diff:
 *   UPDATE_TURN_STREAM_GOLDENS=1 npm run test:unit -- tests/unit/anthropic/translate/connector-goldens
 */
import * as fs from 'fs';
import * as path from 'path';
import { accumulate } from '../../../../src/anthropic/respond';
import { ApiEvent, TurnEvent } from '../../../../src/anthropic/translate';
import { JsonObject } from '../../../../src/upstream/frames';
import {
  connectorFrames, CONNECTOR_RECORDINGS, recordedAnswer, recordedCalls, recordedResult, recordedToolResults, translateConnector
} from '../../../mocks/anthropic/connector-recordings';
import { sdkBetaFinalMessage } from '../../../mocks/anthropic/sdk-oracle';

const GOLDENS = path.resolve(__dirname, '..', '..', '..', 'fixtures', 'turn-streams');
const UPDATE = process.env['UPDATE_TURN_STREAM_GOLDENS'] === '1';
const NEVER_RELAYED = ['caller', 'wire_tool_inputs', 'iterations', 'estimated_tokens', 'ttft_ms', 'uuid', 'session_id',
  'parent_tool_use_id', 'tool_use_meta', 'tool_use_result'];
const COUNTERS = ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'];

function golden(name: string, events: TurnEvent[]): unknown {
  const file = path.join(GOLDENS, path.basename(name).replace(/\.(wire\.ndjson|jsonl)$/, '.json'));
  if (UPDATE) fs.writeFileSync(file, JSON.stringify(events, null, 2) + '\n');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const pick = (object: JsonObject, keys: string[]): JsonObject =>
  Object.fromEntries(keys.filter(key => key in object).map(key => [key, object[key]]));

/** Spec section 9: the result's text items as text blocks, nothing else. */
const textBlocks = (content: unknown): JsonObject[] => (typeof content === 'string'
  ? [{ type: 'text', text: content }]
  : (content as JsonObject[]).filter(item => item['type'] === 'text').map(item => ({ type: 'text', text: item['text'] })));

describe.each(CONNECTOR_RECORDINGS)('connector turn golden: $name', ({ name, server }) => {
  const events = translateConnector(connectorFrames(name)) as ApiEvent[];
  const calls = recordedCalls(name);
  const results = recordedToolResults(name);

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
    expect((events.find(event => event.type === 'message_delta') as Extract<ApiEvent, { type: 'message_delta' }>).delta['stop_reason'])
      .toBe('end_turn');
  });

  it("relays each call as mcp_tool_use with upstream's id and the server split out, and each result as mcp_tool_result", async () => {
    const message = accumulate(events);
    const uses = message.content.filter(block => block['type'] === 'mcp_tool_use');
    const outputs = message.content.filter(block => block['type'] === 'mcp_tool_result');

    expect(uses).toEqual(calls.map(call => ({
      type: 'mcp_tool_use', id: call.id, name: call.name.slice(`mcp__${server}__`.length), server_name: server, input: call.input
    })));
    expect(outputs).toEqual(results.map(result => ({
      type: 'mcp_tool_result', tool_use_id: result['tool_use_id'], is_error: false, content: textBlocks(result['content'])
    })));
    for (const output of outputs) {
      const use = message.content.findIndex(block => block['id'] === output['tool_use_id']);
      expect(use).toBeGreaterThanOrEqual(0);
      expect(message.content.indexOf(output)).toBeGreaterThan(use);
    }
    expect(message.content.filter(block => block['type'] === 'tool_use')).toEqual([]);
    expect(message.content[message.content.length - 1]).toEqual({ type: 'text', text: recordedAnswer(name) });
    expect(await sdkBetaFinalMessage(events)).toEqual(message);
  });

  it("sums every call's usage into the final message_delta, equal to the result's, with no server-tool counters", () => {
    const delta = events.find(event => event.type === 'message_delta') as Extract<ApiEvent, { type: 'message_delta' }>;
    const result = recordedResult(name);

    expect(pick(delta.usage, COUNTERS)).toEqual(pick(result.usage, COUNTERS));
    expect(delta.usage['server_tool_use']).toBeUndefined();
  });

  it('carries no field the API does not define', () => {
    const names = new Set<string>();
    JSON.stringify(events, (key, value: unknown) => { names.add(key); return value; });

    expect(NEVER_RELAYED.filter(field => names.has(field))).toEqual([]);
  });
});
