// Ticket 17 probe: does Claude Code accept, truncate, alias or reject long MCP
// tool names, and does the model call them by the right name?  Standalone;
// imports the MCP SDK from the spike's node_modules by absolute path.
// Usage: node probe.mjs [runTag]   (PROBE_MAX_LEN=115 drops client names longer than that)
import { createServer as createHttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';

const SDK = '/home/anas/Work/claude-wrapper/.scratch/anthropic-compat-api/spike/node_modules/@modelcontextprotocol/sdk/dist/esm';
const { Server } = await import(`${SDK}/server/index.js`);
const { StreamableHTTPServerTransport } = await import(`${SDK}/server/streamableHttp.js`);
const { ListToolsRequestSchema, CallToolRequestSchema, isInitializeRequest } = await import(`${SDK}/types.js`);

const CLI = '/home/anas/.local/share/mise/installs/claude/latest/claude';
const CWD = '/tmp/claude-1000/-home-anas-Work-claude-wrapper/23127712-bc1f-4f65-ab20-57491898aa91/scratchpad/probe-17/cwd';
const OUT = '/home/anas/Work/claude-wrapper/.scratch/anthropic-compat-api/research/cli-probes';
const TAG = process.argv[2] ?? 'run1';
const MAX_LEN = Number(process.env.PROBE_MAX_LEN ?? 128);
const SERVER = 'client';
const PREFIX = `mcp__${SERVER}__`;
const CAP_MS = 180_000;
mkdirSync(CWD, { recursive: true }); mkdirSync(OUT, { recursive: true });

// ---- tool names ----
const fill = (base, len) => { let s = base; let i = 0; while (s.length < len) s += String(i++ % 10); return s; };
const twin = fill('twin_shared_prefix_', 64);
const defs = [
  { key: 'len064', name: fill('len064_', 64), what: 'the 64-character tool' },
  { key: 'len100', name: fill('len100_', 100), what: 'the 100-character tool' },
  { key: 'len115', name: fill('len115_', 115), what: 'the 115-character tool' },
  { key: 'len128', name: fill('len128_', 128), what: 'the 128-character tool' },
  { key: 'hyphen', name: 'has-hyphens-in-name', what: 'the hyphenated tool' },
  { key: 'twinA', name: twin + '_alpha', what: 'twin tool ALPHA (its name ends in _alpha)' },
  { key: 'twinB', name: twin + '_bravo', what: 'twin tool BRAVO (its name ends in _bravo)' },
].filter((d) => d.name.length <= MAX_LEN);
for (const d of defs) { if (!/^[a-zA-Z0-9_-]{1,128}$/.test(d.name)) throw new Error('bad name ' + d.key); }
const TOOLS = defs.map((d) => ({ ...d, upstream: PREFIX + d.name, description: `Call this when asked to call ${d.what}. Takes a label and returns a short acknowledgement.`,
  input_schema: { type: 'object', properties: { label: { type: 'string' } }, required: ['label'] } }));

// ---- recorder ----
const t0 = Date.now();
const ms = () => Date.now() - t0;
const wirePath = `${OUT}/q-tool-names-${TAG}.wire.ndjson`;
const mcpLogPath = `${OUT}/q-tool-names-${TAG}.mcp-server.ndjson`;
const summaryPath = `${OUT}/q-tool-names-${TAG}.summary.json`;
const stderrPath = `${OUT}/q-tool-names-${TAG}.stderr.txt`;
writeFileSync(wirePath, ''); writeFileSync(mcpLogPath, ''); writeFileSync(stderrPath, '');
const wire = (dir, frame) => appendFileSync(wirePath, JSON.stringify({ t_ms: ms(), dir, frame }) + '\n');
const mcpLog = (event, extra = {}) => { const e = { t_ms: ms(), event, ...extra }; appendFileSync(mcpLogPath, JSON.stringify(e) + '\n'); console.log(`[+${String(e.t_ms).padStart(6)}ms] mcp ${event}`, JSON.stringify(extra).slice(0, 300)); };
const mark = (label, extra = {}) => console.log(`[+${String(ms()).padStart(6)}ms] ${label}`, Object.keys(extra).length ? JSON.stringify(extra).slice(0, 400) : '');

// ---- MCP HTTP server named `client` ----
const obs = { init: null, systemFrames: [], toolUseBlocks: [], streamToolUseStarts: [], toolResults: [], results: [], rateLimits: [], mcpListServed: [], mcpCalls: [], exit: null, stderr: '' };
const transports = new Map();
function newServer() {
  const server = new Server({ name: SERVER, version: '0.0.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.input_schema, _meta: { 'anthropic/alwaysLoad': true } }));
    obs.mcpListServed.push(tools.map((t) => t.name));
    mcpLog('tools/list served', { names: tools.map((t) => t.name) });
    return { tools };
  });
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args, _meta } = request.params;
    obs.mcpCalls.push({ t_ms: ms(), name, args, toolUseId: _meta?.['claudecode/toolUseId'] ?? null });
    mcpLog('tools/call received', { name, length: name.length, args, _meta });
    return { content: [{ type: 'text', text: `ok:${name.slice(0, 12)}` }] };
  });
  return server;
}
const http = createHttpServer(async (req, res) => {
  let body;
  if (req.method === 'POST') {
    const chunks = []; for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    try { body = raw ? JSON.parse(raw) : undefined; } catch { res.writeHead(400).end('bad json'); return; }
    mcpLog('http POST', { method: body?.method, id: body?.id, name: body?.params?.name, session: req.headers['mcp-session-id'] ?? null, raw: raw.slice(0, 1500) });
  } else mcpLog(`http ${req.method}`, { session: req.headers['mcp-session-id'] ?? null });
  const sid = req.headers['mcp-session-id'];
  let transport = sid ? transports.get(sid) : undefined;
  if (!transport) {
    if (!(req.method === 'POST' && isInitializeRequest(body))) { res.writeHead(400).end('no session'); mcpLog('http 400 no session', { method: body?.method }); return; }
    transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID(), onsessioninitialized: (id) => { transports.set(id, transport); mcpLog('session initialized', { id }); } });
    await newServer().connect(transport);
  }
  await transport.handleRequest(req, res, body);
});
await new Promise((r) => http.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${http.address().port}/mcp`;
mcpLog('listening', { url });

// ---- spawn upstream ----
const version = execFileSync(CLI, ['--version']).toString().trim();
const mcpConfig = { mcpServers: { [SERVER]: { type: 'http', url, alwaysLoad: true } } };
const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
  '--tools', '', '--setting-sources=', '--strict-mcp-config', '--permission-mode', 'default', '--permission-prompts', 'none',
  '--max-budget-usd', '1', '--no-session-persistence', '--mcp-config', JSON.stringify(mcpConfig), '--allowedTools', TOOLS.map((t) => t.upstream).join(',')];
const env = { ...process.env }; for (const k of ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SSE_PORT', 'CLAUDE_AGENT_SDK_VERSION']) delete env[k];
mark('spawn', { version, cwd: CWD, args });
wire('meta', { version, cwd: CWD, command: CLI, args, tools: TOOLS.map((t) => ({ key: t.key, name: t.name, length: t.name.length, upstream: t.upstream, upstreamLength: t.upstream.length })) });
const child = spawn(CLI, args, { cwd: CWD, env, stdio: ['pipe', 'pipe', 'pipe'] });
child.stderr.on('data', (d) => { obs.stderr += d; appendFileSync(stderrPath, d); wire('cli-stderr', String(d)); });

function onFrame(m) {
  if (m.type === 'system' && m.subtype === 'init') { obs.init = m; mark('system/init', { tools: m.tools, mcp_servers: m.mcp_servers, mcp_server_errors: m.mcp_server_errors, version: m.claude_code_version, model: m.model, permissionMode: m.permissionMode }); }
  else if (m.type === 'system') { obs.systemFrames.push(m); mark(`system/${m.subtype}`, m); }
  else if (m.type === 'stream_event') {
    const e = m.event;
    if (e.type === 'content_block_start' && e.content_block?.type === 'tool_use') { obs.streamToolUseStarts.push({ id: e.content_block.id, name: e.content_block.name }); mark('stream tool_use start', { name: e.content_block.name }); }
    else if (e.type === 'message_start') mark('stream message_start', { id: e.message?.id, input_tokens: e.message?.usage?.input_tokens });
    else if (e.type === 'message_delta') mark('stream message_delta', { stop_reason: e.delta?.stop_reason });
  } else if (m.type === 'assistant') {
    for (const b of m.message?.content ?? []) {
      if (b.type === 'tool_use') { obs.toolUseBlocks.push({ id: b.id, name: b.name, length: b.name.length, input: b.input }); mark('assistant tool_use', { id: b.id, name: b.name, length: b.name.length, input: b.input }); }
      else if (b.type === 'text') mark('assistant text', { text: b.text.slice(0, 200) });
    }
  } else if (m.type === 'user') {
    for (const b of (Array.isArray(m.message?.content) ? m.message.content : [])) if (b.type === 'tool_result') { const r = { tool_use_id: b.tool_use_id, is_error: b.is_error ?? false, content: JSON.stringify(b.content).slice(0, 300) }; obs.toolResults.push(r); mark('user tool_result', r); }
  } else if (m.type === 'result') {
    const r = { subtype: m.subtype, is_error: m.is_error, api_error_status: m.api_error_status, errors: m.errors, stop_reason: m.stop_reason, num_turns: m.num_turns, total_cost_usd: m.total_cost_usd, duration_ms: m.duration_ms, permission_denials: m.permission_denials, result: typeof m.result === 'string' ? m.result.slice(0, 500) : m.result, usage: m.usage && { input_tokens: m.usage.input_tokens, output_tokens: m.usage.output_tokens, cache_read_input_tokens: m.usage.cache_read_input_tokens, cache_creation_input_tokens: m.usage.cache_creation_input_tokens } };
    obs.results.push(r); mark('result', r);
    setTimeout(() => { mark('closing stdin'); child.stdin.end(); }, 1000);
  } else if (m.type === 'rate_limit_event') {
    const u = m.rate_limit_info?.unifiedWindows; obs.rateLimits.push({ t_ms: ms(), five_hour: u?.five_hour, seven_day: u?.seven_day, status: m.rate_limit_info?.status }); mark('rate_limit_event', { five_hour: u?.five_hour?.utilization, seven_day: u?.seven_day?.utilization });
  } else if (m.type === 'control_request' || m.type === 'control_response') mark(`cli ${m.type}`, { snippet: JSON.stringify(m).slice(0, 300) });
}
let buf = '';
child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (!l.trim()) continue; wire('cli->host', l); try { onFrame(JSON.parse(l)); } catch (e) { mark('non-json stdout line', { line: l.slice(0, 200) }); } } });
const exited = new Promise((r) => child.on('exit', (code, signal) => { obs.exit = { code, signal, t_ms: ms() }; wire('proc', `<exit code=${code} signal=${signal}>`); mark('process exit', obs.exit); r(); }));

const list = TOOLS.map((t, i) => `${i + 1}. ${t.upstream}`).join('\n');
const prompt = `You have ${TOOLS.length} tools from the "client" MCP server. Call each of the following tools exactly once, with input {"label": "x"}, all in a single response. Then reply with exactly the word: done\n\nTools:\n${list}`;
const userMsg = JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: prompt }] }, parent_tool_use_id: null, session_id: '' });
wire('host->cli', userMsg); child.stdin.write(userMsg + '\n'); mark('wrote user message');

const cap = setTimeout(() => { mark('CAP 180 s: SIGINT'); child.kill('SIGINT'); setTimeout(() => { if (obs.exit) return; mark('still alive: SIGTERM'); child.kill('SIGTERM'); setTimeout(() => { if (!obs.exit) { mark('still alive: SIGKILL'); child.kill('SIGKILL'); } }, 5000); }, 10_000); }, CAP_MS);
await exited; clearTimeout(cap); await new Promise((r) => http.close(r));

// ---- per-tool table ----
const initTools = obs.init?.tools ?? [];
const classify = (t) => {
  if (initTools.includes(t.upstream)) return 'exact';
  const trunc = initTools.find((n) => t.upstream.startsWith(n) && n !== t.upstream);
  if (trunc) return `truncated:${trunc}`;
  const alias = initTools.find((n) => n.includes(t.key) || n.endsWith(t.name.slice(-8)));
  if (alias) return `aliased:${alias}`;
  return 'absent';
};
const table = TOOLS.map((t) => {
  const uses = obs.toolUseBlocks.filter((b) => b.name === t.upstream || b.name.startsWith(t.upstream.slice(0, 40)) && b.name.endsWith(t.name.slice(-6)));
  const ids = new Set(uses.map((u) => u.id));
  const calls = obs.mcpCalls.filter((c) => c.name === t.name || ids.has(c.toolUseId));
  const results = obs.toolResults.filter((r) => ids.has(r.tool_use_id));
  const denied = (obs.results.flatMap((r) => r.permission_denials ?? [])).filter((d) => d.tool_name === t.upstream || ids.has(d.tool_use_id));
  return { key: t.key, clientName: t.name, clientLength: t.name.length, upstreamName: t.upstream, upstreamLength: t.upstream.length, initTools: classify(t), modelCalledAs: uses.map((u) => u.name), mcpReceivedAs: calls.map((c) => c.name), toolResultIsError: results.map((r) => r.is_error), denied: denied.length > 0 };
});
const summary = { tag: TAG, recorded_at: new Date(t0).toISOString(), version, prefix: PREFIX, prefixLength: PREFIX.length, cwd: CWD, args, prompt,
  init: obs.init && { tools: obs.init.tools, mcp_servers: obs.init.mcp_servers, mcp_server_errors: obs.init.mcp_server_errors, claude_code_version: obs.init.claude_code_version, model: obs.init.model, permissionMode: obs.init.permissionMode, apiKeySource: obs.init.apiKeySource },
  systemFrames: obs.systemFrames, toolUseBlocks: obs.toolUseBlocks, streamToolUseStarts: obs.streamToolUseStarts, toolResults: obs.toolResults, mcpListServed: obs.mcpListServed, mcpCalls: obs.mcpCalls, results: obs.results,
  rateLimits: obs.rateLimits, five_hour_before: obs.rateLimits[0]?.five_hour?.utilization ?? null, five_hour_after: obs.rateLimits.at(-1)?.five_hour?.utilization ?? null, exit: obs.exit, stderr: obs.stderr.slice(0, 2000), table };
writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
console.log('\n=== TABLE ==='); console.table(table.map((r) => ({ key: r.key, len: r.clientLength, up: r.upstreamLength, init: r.initTools.slice(0, 30), called: r.modelCalledAs.length, mcp: r.mcpReceivedAs.length, err: r.toolResultIsError.join(','), denied: r.denied })));
console.log(JSON.stringify({ results: summary.results, five_hour_before: summary.five_hour_before, five_hour_after: summary.five_hour_after, exit: summary.exit }, null, 2));
console.log(`summary -> ${summaryPath}`);
process.exit(0);
