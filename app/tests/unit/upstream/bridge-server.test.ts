/**
 * The bridge server (spec section 7, section 16): the client's tools served to an MCP client
 * over Streamable HTTP through the control server, each `tools/call` held on the bridge until
 * the client's `tool_result` is delivered, and abandonment that interrupts the run before it
 * rejects the waiting call.
 */
import request from 'supertest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { Bridge, BridgeEvent, ClientTool, createBridge } from '../../../src/upstream/bridge';
import { ControlServer, createControlServer } from '../../../src/upstream/control-server';
import { parseFrame } from '../../../src/upstream/frames';

const QUIET = { debug: () => undefined, warn: () => undefined };

const WEATHER: ClientTool = {
  name: 'get_weather',
  description: 'Get the current weather for a city. Returns a JSON object.',
  input_schema: { type: 'object', properties: { city: { type: 'string', description: 'City name, e.g. Paris' } }, required: ['city'] }
};

/** A schema Zod would reshape: `$defs`, `$ref`, `anyOf`, `additionalProperties`, formats, an unknown keyword. */
const BOOKING: ClientTool = {
  name: 'book-flight_v2',
  input_schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    $defs: { airport: { type: 'string', pattern: '^[A-Z]{3}$' } },
    properties: {
      from: { $ref: '#/$defs/airport' },
      to: { $ref: '#/$defs/airport' },
      when: { anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }] },
      seats: { type: 'integer', minimum: 1, default: 1 }
    },
    required: ['from', 'to'],
    additionalProperties: false,
    'x-vendor-hint': { keep: true }
  }
};

const ID = 'toolu_01KHVVfCyaD5M7pU9pUR6Y8f';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const frame = (value: object) => parseFrame(JSON.stringify(value));

/** Upstream announces one `mcp__client__get_weather` call and completes the message. */
function announce(bridge: Bridge, id = ID): void {
  bridge.onFrame(frame({ type: 'system', subtype: 'init', session_id: 's', tools: [], mcp_servers: [] }));
  bridge.onFrame(frame({
    type: 'assistant', parent_tool_use_id: null,
    message: { id: 'msg_1', content: [{ type: 'tool_use', id, name: 'mcp__client__get_weather', input: { city: 'Paris' } }] }
  }));
  bridge.onFrame(frame({ type: 'stream_event', parent_tool_use_id: null, event: { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: {} } }));
}

const isPending = (promise: Promise<unknown>): Promise<boolean> =>
  Promise.race([promise.then(() => false, () => false), new Promise<boolean>(resolve => setTimeout(() => resolve(true), 50))]);

describe('bridge server', () => {
  let control: ControlServer;
  let bridge: Bridge;
  let events: BridgeEvent[];
  let client: Client;
  let mcpUrl: string;
  let token: string;

  async function connect(tools: ClientTool[]): Promise<void> {
    bridge = createBridge(tools, { logger: QUIET });
    events = [];
    bridge.events.subscribe(event => events.push(event));
    ({ mcpUrl, token } = control.registerRun('run-1', { mcpHandler: bridge.mcpHandler }));
    client = new Client({ name: 'upstream-under-test', version: '0.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } }
    });
    await client.connect(transport as Transport);
  }

  const callWeather = (id = ID) =>
    client.callTool({ name: 'get_weather', arguments: { city: 'Paris' }, _meta: { 'claudecode/toolUseId': id } });

  beforeEach(async () => {
    control = createControlServer({ logger: QUIET });
    await control.start();
  });

  afterEach(async () => {
    await client?.close();
    await control.close();
  });

  it('serves the client tools’ name, description and input_schema verbatim', async () => {
    await connect([WEATHER, BOOKING]);

    const { tools } = await client.listTools();

    expect(tools).toEqual([
      { name: WEATHER.name, description: WEATHER.description, inputSchema: WEATHER.input_schema, _meta: { 'anthropic/alwaysLoad': true } },
      { name: BOOKING.name, inputSchema: BOOKING.input_schema, _meta: { 'anthropic/alwaysLoad': true } }
    ]);
  });

  it('holds a tools/call on the bridge until the client’s tool_result is delivered, then returns it', async () => {
    await connect([WEATHER]);
    announce(bridge);

    const call = callWeather();

    expect(await isPending(call)).toBe(true);
    expect(bridge.deliver([{ type: 'tool_result', tool_use_id: ID, content: '{"temp_c":18}' }])).toEqual({ status: 'resumed' });
    await expect(call).resolves.toEqual({ content: [{ type: 'text', text: '{"temp_c":18}' }], isError: false });
    expect(events.find(event => event.kind === 'park')).toEqual(expect.objectContaining({
      toolUses: [{ id: ID, name: 'get_weather', input: { city: 'Paris' } }]
    }));
  });

  it('maps text and image blocks to MCP text and image content, and is_error to isError', async () => {
    await connect([WEATHER]);
    announce(bridge);
    const call = callWeather();

    bridge.deliver([{
      tool_use_id: ID,
      is_error: true,
      content: [
        { type: 'text', text: 'camera offline' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG } }
      ]
    }]);

    await expect(call).resolves.toEqual({
      content: [{ type: 'text', text: 'camera offline' }, { type: 'image', data: PNG, mimeType: 'image/png' }],
      isError: true
    });
  });

  it('answers a tools/call without _meta["claudecode/toolUseId"] with an MCP error', async () => {
    await connect([WEATHER]);

    await expect(client.callTool({ name: 'get_weather', arguments: { city: 'Paris' } }))
      .rejects.toThrow(/claudecode\/toolUseId/);
  });

  it('interrupts the run first and only then rejects the waiting call', async () => {
    await connect([WEATHER]);
    announce(bridge);
    const call = callWeather();
    await isPending(call);
    let pendingAtInterrupt: boolean | undefined;
    const run = { interrupt: jest.fn(async () => { pendingAtInterrupt = await isPending(call); }) };

    await bridge.abandon(run, 'park TTL expired');

    expect(run.interrupt).toHaveBeenCalledTimes(1);
    expect(pendingAtInterrupt).toBe(true);
    await expect(call).rejects.toThrow(/abandoned: park TTL expired/);
  });

  it('still rejects the waiting call when the run cannot be interrupted any more', async () => {
    await connect([WEATHER]);
    announce(bridge);
    const call = callWeather();
    await isPending(call);

    await bridge.abandon({ interrupt: async () => { throw new Error("upstream's stdin is closed"); } }, 'client disconnected');

    await expect(call).rejects.toThrow(/abandoned: client disconnected/);
  });

  it('answers 400 to a request that is neither an initialize nor in a session, as the spike did', async () => {
    await connect([WEATHER]);

    await request(mcpUrl.replace(/\/runs\/.*$/, '')).post('/runs/run-1/mcp')
      .set({ Authorization: `Bearer ${token}`, Accept: 'application/json, text/event-stream' })
      .send({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: {} })
      .expect(400);
  });
});
