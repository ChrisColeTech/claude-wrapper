/**
 * Upstream's side of a client-tool turn for surface tests with the scripted runner: the frames of
 * a model call that ends in `get_weather` calls, and an MCP client that connects to the run's
 * bridge server the way upstream does, from the MCP config file the surface put in the run's
 * directory (the replay runner's `spec.runDir.files`), and calls tools by `tool_use` id.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { RunSpec } from '../../../src/upstream/runner';
import { MESSAGE_START, MESSAGE_STOP } from './turn-frames';

const SESSION = { session_id: 'session-1', uuid: 'frame-uuid' };
const NAME = 'mcp__client__get_weather';

export interface WeatherCall {
  id: string;
  city: string;
}

/** The frames of one model call announcing these calls, up to its `message_stop`. */
export function weatherCalls(calls: WeatherCall[]): object[] {
  const event = (value: object) => ({ type: 'stream_event', event: value, parent_tool_use_id: null, ...SESSION });
  const blocks = calls.flatMap(({ id, city }, index) => [
    event({ type: 'content_block_start', index, content_block: { type: 'tool_use', id, name: NAME, input: {}, caller: { type: 'direct' } } }),
    event({ type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: JSON.stringify({ city }) } }),
    { type: 'assistant', parent_tool_use_id: null, ...SESSION,
      message: { id: 'msg_1', role: 'assistant', content: [{ type: 'tool_use', id, name: NAME, input: { city } }] } },
    event({ type: 'content_block_stop', index })
  ]);
  return [
    event(MESSAGE_START),
    ...blocks,
    event({ type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 40 } }),
    event(MESSAGE_STOP)
  ];
}

/** The `user` frame upstream writes once a call has its result. */
export const toolResultFrame = (id: string, content: unknown): object =>
  ({ type: 'user', parent_tool_use_id: null, ...SESSION, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content }] } });

/** An MCP client connected to the run's bridge server with the run's own token, as upstream connects. */
export async function connectAsUpstream(spec: RunSpec): Promise<Client> {
  const config = JSON.parse(spec.runDir?.files['mcp-config.json'] ?? '{}') as
    { mcpServers: { client: { url: string; headers: Record<string, string> } } };
  const { url, headers } = config.mcpServers.client;
  const client = new Client({ name: 'upstream-under-test', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers } }) as Transport);
  return client;
}

/** Upstream's `tools/call` for one announced call. */
export const callWeather = (client: Client, { id, city }: WeatherCall) =>
  client.callTool({ name: 'get_weather', arguments: { city }, _meta: { 'claudecode/toolUseId': id } });

/** True when `promise` has not settled after a short while. */
export const isPending = (promise: Promise<unknown>): Promise<boolean> =>
  Promise.race([promise.then(() => false, () => false), new Promise<boolean>(resolve => setTimeout(() => resolve(true), 50))]);
