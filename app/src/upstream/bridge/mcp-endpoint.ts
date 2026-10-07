/**
 * The bridge server's MCP adapter (spec section 16, bridge): a low-level MCP `Server` named
 * `client` over Streamable HTTP, one per MCP session upstream opens. `tools/list` serves the
 * client's `name`, `description` and `input_schema` verbatim, never through Zod; `tools/call`
 * becomes a bridge call keyed by `_meta["claudecode/toolUseId"]`, upstream's own `tool_use` id.
 *
 * As in the spike, a request that is neither an `initialize` nor in a known session is a 400:
 * upstream's `server/discover` probe gets it and falls back to `initialize`.
 */
import { randomUUID } from 'crypto';
import { ServerResponse } from 'http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CallToolRequestSchema, CallToolResult, ErrorCode, isInitializeRequest, ListToolsRequestSchema, McpError, Tool
} from '@modelcontextprotocol/sdk/types.js';
import { McpHttpHandler } from '../control-server';
import { BRIDGE_SERVER_NAME, BridgeCall, ClientTool, McpToolResult } from './types';

export type BridgeCallHandler = (call: BridgeCall) => Promise<McpToolResult>;

export interface McpEndpointLogger {
  debug(message: string, context?: unknown): void;
}

const TOOL_USE_ID = 'claudecode/toolUseId';

function listed(tool: ClientTool): Tool {
  return {
    name: tool.name,
    ...(tool.description !== undefined ? { description: tool.description } : {}),
    inputSchema: tool.input_schema as Tool['inputSchema'],
    _meta: { 'anthropic/alwaysLoad': true }
  };
}

function bridgeServer(tools: ClientTool[], onCall: BridgeCallHandler, log: McpEndpointLogger): Server {
  const server = new Server({ name: BRIDGE_SERVER_NAME, version: '1.0.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: tools.map(listed) }));
  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const toolUseId = request.params._meta?.[TOOL_USE_ID];
    if (typeof toolUseId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, `tools/call needs _meta["${TOOL_USE_ID}"]`);
    }
    const { content, isError } = await onCall({ toolUseId, name: request.params.name, args: request.params.arguments ?? {} });
    return { content, isError };
  });
  server.onerror = error => log.debug('Bridge server MCP error', { error: String(error) });
  return server;
}

/** The spike's answer (400, `no session`), the one upstream's `server/discover` fallback was proven against. */
function noSession(res: ServerResponse): void {
  res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end('no session');
}

export function createMcpEndpoint(tools: ClientTool[], onCall: BridgeCallHandler, log: McpEndpointLogger): McpHttpHandler {
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const openSession = async (): Promise<StreamableHTTPServerTransport> => {
    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: id => { sessions.set(id, transport); }
    });
    transport.onclose = () => { if (transport.sessionId) sessions.delete(transport.sessionId); };
    await bridgeServer(tools, onCall, log).connect(transport as Transport);
    return transport;
  };

  return async (req, res, body) => {
    const sessionId = req.headers['mcp-session-id'];
    let transport = typeof sessionId === 'string' ? sessions.get(sessionId) : undefined;
    if (!transport) {
      if (req.method !== 'POST' || !isInitializeRequest(body)) {
        noSession(res);
        return;
      }
      transport = await openSession();
    }
    await transport.handleRequest(req, res, body);
  };
}
