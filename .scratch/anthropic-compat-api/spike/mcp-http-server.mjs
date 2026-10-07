// PROTOTYPE, THROWAWAY. A wrapper-hosted MCP server over Streamable HTTP that
// serves the client's JSON Schema verbatim (no Zod) and whose tools/call
// handler parks on the bridge until the simulated client answers. This is the
// raw-CLI tool-bridge candidate: `claude -p --mcp-config {type:http,...}`.
import { createServer as createHttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

export async function startMcpHttpServer({ serverName, clientTools, onCall, rec }) {
  const transports = new Map();

  function newServer() {
    const server = new Server({ name: serverName, version: '0.0.0' }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      rec.mark('mcp tools/list served');
      return { tools: clientTools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.input_schema, _meta: { 'anthropic/alwaysLoad': true } })) };
    });
    server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      const meta = request.params._meta ?? {};
      rec.mark('mcp tools/call received', { name: request.params.name, args: request.params.arguments, _meta: meta });
      extra.signal?.addEventListener('abort', () => rec.mark('mcp tools/call aborted by upstream', { name: request.params.name }));
      const out = await onCall({ name: request.params.name, args: request.params.arguments, meta, signal: extra.signal });
      rec.mark('mcp tools/call returning', { name: request.params.name });
      return out;
    });
    return server;
  }

  const http = createHttpServer(async (req, res) => {
    let body;
    if (req.method === 'POST') {
      const chunks = []; for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString('utf8');
      try { body = raw ? JSON.parse(raw) : undefined; } catch { res.writeHead(400).end('bad json'); return; }
      rec.wire('mcp-http->server', raw.slice(0, 4000));
    }
    const sid = req.headers['mcp-session-id'];
    let transport = sid ? transports.get(sid) : undefined;
    if (!transport) {
      if (!(req.method === 'POST' && isInitializeRequest(body))) { res.writeHead(400).end('no session'); return; }
      transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID(), onsessioninitialized: (id) => { transports.set(id, transport); rec.mark('mcp session initialized', { id }); } });
      await newServer().connect(transport);
    }
    await transport.handleRequest(req, res, body);
  });
  await new Promise((r) => http.listen(0, '127.0.0.1', r));
  const port = http.address().port;
  rec.mark('mcp http server listening', { port });
  return { url: `http://127.0.0.1:${port}/mcp`, close: () => new Promise((r) => http.close(r)) };
}
