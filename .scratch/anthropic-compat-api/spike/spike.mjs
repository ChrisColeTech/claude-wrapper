// PROTOTYPE, THROWAWAY. Wayfinder ticket 06: can one client tool call make the
// round trip through a held-open upstream run?  Usage: node spike.mjs <scenario>
//
//   sdk-happy          Agent SDK in-process MCP tool; simulated client answers after a delay.
//   sdk-parallel       Same, but the prompt asks for two calls at once.
//   sdk-interrupt      Client never answers; after N ms we interrupt() the run, then reject.
//   sdk-timeout        Client never answers; the MCP server timeout fires. What does upstream do?
//   sdk-hybrid-resume  Park, interrupt, exit; then a fresh run --resume's the session with the result as text.
//   cli-http-happy     Raw `claude -p` + `--mcp-config {type:http}` to a wrapper-hosted MCP server; client answers.
//   cli-http-interrupt Raw CLI; client never answers; we write a control_request interrupt on stdin.
//   sdk-close-while-parked  Client never answers; we close stdin WITHOUT interrupting. Does upstream stop or call the model again?
//
// Every run writes runs/<scenario>.wire.ndjson (every frame, both directions)
// and runs/<scenario>.summary.json (timings, ids, cost, verdict inputs).
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { createBridge } from './bridge.mjs';
import { createRecorder, tapChild, childEnv } from './recorder.mjs';
import { startMcpHttpServer } from './mcp-http-server.mjs';

const CLI = process.env.SPIKE_CLI ?? '/home/anas/.local/share/mise/installs/claude/latest/claude';
const CWD = process.env.SPIKE_CWD ?? '/tmp/claude-1000/-home-anas-Work-claude-wrapper/d3fca5e2-71dd-4306-bec0-29bbeb4844c8/scratchpad/spike-cwd';
mkdirSync(CWD, { recursive: true });
const SERVER = 'spike';
const PREFIX = `mcp__${SERVER}__`;
const CLIENT_DELAY_MS = Number(process.env.SPIKE_CLIENT_DELAY_MS ?? 3000);
const RUN_CAP_MS = Number(process.env.SPIKE_RUN_CAP_MS ?? 240_000);
const STALL_MS = Number(process.env.SPIKE_STALL_MS ?? 90_000);

// The client's tool exactly as it would arrive on POST /v1/messages.
const CLIENT_TOOLS = [{
  name: 'get_weather',
  description: 'Get the current weather for a city. Returns a JSON object.',
  input_schema: { type: 'object', properties: { city: { type: 'string', description: 'City name, e.g. Paris' } }, required: ['city'] },
}];
const fakeWeather = (city = '?') => JSON.stringify({ city, temp_c: /^tok/i.test(city) ? 24 : 18, sky: 'overcast' });

const ONE_CALL = 'Use the get_weather tool for Paris, then reply with one short sentence about the weather there. Do not call any other tool.';
const TWO_CALLS = 'Call the get_weather tool for Paris and for Tokyo, both in the same response (two tool calls in parallel), then reply with one sentence comparing them.';

const SCENARIOS = {
  'sdk-happy':          { driver: 'sdk', prompt: ONE_CALL,  client: 'answer' },
  'sdk-parallel':       { driver: 'sdk', prompt: TWO_CALLS, client: 'answer' },
  'sdk-interrupt':      { driver: 'sdk', prompt: ONE_CALL,  client: 'never', afterParkMs: 3000, action: 'interrupt' },
  'sdk-timeout':        { driver: 'sdk', prompt: ONE_CALL,  client: 'never', serverTimeoutMs: 5000 },
  'sdk-hybrid-resume':  { driver: 'sdk', prompt: ONE_CALL,  client: 'never', afterParkMs: 1000, action: 'interrupt', persist: true, thenResume: true },
  'cli-http-happy':     { driver: 'cli', prompt: ONE_CALL,  client: 'answer' },
  'cli-http-interrupt': { driver: 'cli', prompt: ONE_CALL,  client: 'never', afterParkMs: 3000, action: 'interrupt' },
  'sdk-close-while-parked': { driver: 'sdk', prompt: ONE_CALL, client: 'never', afterParkMs: 3000, action: 'close' },
};

const name = process.argv[2];
const sc = SCENARIOS[name];
if (!sc) { console.error('unknown scenario. one of: ' + Object.keys(SCENARIOS).join(', ')); process.exit(2); }

const rec = createRecorder(name);
const bridge = createBridge({ prefix: PREFIX, now: () => rec.ms() });
const obs = { modelCalls: 0, assistantMsgIds: new Set(), announced: [], metaIds: [], cliToolResultIds: [], controlFrames: [], results: [], finalText: [], utilization: null, init: null, parkedAt: null, deliveredAt: null, interrupt: null, stopReasons: [] };
const ctl = { interrupt: async () => rec.mark('interrupt not wired for this driver'), endRun: () => {}, close: () => rec.mark('close not wired') };
let lastFrameAt = Date.now();

// ---- shared frame handler (CLI stream-json objects; the SDK yields the same shapes) ----
function onFrame(m) {
  lastFrameAt = Date.now();
  if (m.type === 'system' && m.subtype === 'init') {
    obs.init = { session_id: m.session_id, claude_code_version: m.claude_code_version, tools: m.tools, mcp_servers: m.mcp_servers, apiKeySource: m.apiKeySource, permissionMode: m.permissionMode, model: m.model };
    rec.mark('system/init', obs.init);
    bridge.turnStarted();
  } else if (m.type === 'stream_event') {
    const e = m.event;
    if (e.type === 'message_start') { obs.modelCalls++; rec.mark(`stream message_start #${obs.modelCalls}`, { id: e.message?.id }); }
    else if (e.type === 'content_block_start') rec.mark('stream content_block_start', { index: e.index, type: e.content_block?.type, name: e.content_block?.name, id: e.content_block?.id });
    else if (e.type === 'message_delta') { obs.stopReasons.push(e.delta?.stop_reason); rec.mark('stream message_delta', { stop_reason: e.delta?.stop_reason, output_tokens: e.usage?.output_tokens }); if (e.delta?.stop_reason === 'tool_use') handlePark(bridge.assistantMessageComplete({ stopReason: 'tool_use' }).park); }
    else if (e.type === 'message_stop') rec.mark('stream message_stop');
  } else if (m.type === 'assistant') {
    obs.assistantMsgIds.add(m.message?.id);
    for (const b of m.message?.content ?? []) {
      if (b.type === 'tool_use') { obs.announced.push({ id: b.id, name: b.name, input: b.input }); rec.mark('assistant tool_use frame', { id: b.id, name: b.name, input: b.input }); handlePark(bridge.assistantToolUse({ id: b.id, name: b.name, input: b.input }).park); }
      else if (b.type === 'text') { obs.finalText.push(b.text); rec.mark('assistant text frame', { text: b.text.slice(0, 160) }); }
      else rec.mark(`assistant ${b.type} frame`);
    }
  } else if (m.type === 'user') {
    for (const b of (Array.isArray(m.message?.content) ? m.message.content : [])) if (b.type === 'tool_result') { obs.cliToolResultIds.push(b.tool_use_id); rec.mark('cli emitted user/tool_result frame', { tool_use_id: b.tool_use_id, content: JSON.stringify(b.content).slice(0, 200) }); }
  } else if (m.type === 'result') {
    const r = { subtype: m.subtype, stop_reason: m.stop_reason, num_turns: m.num_turns, duration_ms: m.duration_ms, duration_api_ms: m.duration_api_ms, total_cost_usd: m.total_cost_usd, is_error: m.is_error, errors: m.errors, terminal_reason: m.terminal_reason, result: typeof m.result === 'string' ? m.result.slice(0, 300) : undefined, session_id: m.session_id, usage: m.usage && { input_tokens: m.usage.input_tokens, output_tokens: m.usage.output_tokens, cache_read_input_tokens: m.usage.cache_read_input_tokens, cache_creation_input_tokens: m.usage.cache_creation_input_tokens }, permission_denials: m.permission_denials };
    obs.results.push(r); rec.mark('result', r); bridge.turnEnded(); ctl.endRun();
  } else if (m.type === 'rate_limit_event') {
    obs.utilization = m.rate_limit_info?.unifiedWindows ?? { utilization: m.rate_limit_info?.utilization };
  } else if (m.type === 'control_request' || m.type === 'control_response' || m.type === 'control_cancel_request') {
    obs.controlFrames.push(m); rec.mark(`cli ${m.type}`, { subtype: m.request?.subtype ?? m.response?.subtype, request_id: m.request_id ?? m.response?.request_id, snippet: JSON.stringify(m).slice(0, 300) });
  } else if (m.type === 'system') {
    rec.mark(`system/${m.subtype}`, m.subtype === 'api_retry' ? { attempt: m.attempt, error: m.error, status: m.error_status } : {});
  }
}

// ---- the parked turn: what the HTTP surface would do at stop_reason: tool_use ----
function handlePark(toolUses) {
  if (!toolUses) return;
  obs.parkedAt = rec.ms();
  rec.mark('PARKED: surface would now end the turn with stop_reason=tool_use', { toolUses: toolUses.map((t) => t.id) });
  if (sc.client === 'answer') {
    setTimeout(() => {
      for (const t of toolUses) { const r = bridge.clientResult({ toolUseId: t.id, content: fakeWeather(t.input?.city) }); rec.mark('client delivered tool_result', { toolUseId: t.id, status: r.status }); }
      obs.deliveredAt = rec.ms();
    }, CLIENT_DELAY_MS);
  } else if (sc.action === 'close') {
    setTimeout(() => { rec.mark('client never answered; closing the run WITHOUT interrupting (stdin EOF)'); ctl.close(); }, sc.afterParkMs);
  } else if (sc.action === 'interrupt') {
    setTimeout(async () => { rec.mark('client never answered; interrupting the run first'); await ctl.interrupt(); setTimeout(() => { bridge.abandon('client never answered'); rec.mark('rejected pending MCP calls (after interrupt)'); }, 1500); }, sc.afterParkMs);
  } else {
    rec.mark('client never answers; waiting for upstream to time out the MCP call');
  }
}

// ---- the MCP handler shared by both drivers ----
async function handleCall(upstreamName, args, meta, extra = {}) {
  const toolUseId = meta?.['claudecode/toolUseId'] ?? '<missing>';
  obs.metaIds.push(toolUseId);
  const { promise, early, park } = bridge.mcpCall({ toolUseId, name: upstreamName, args });
  rec.mark('MCP handler parked on bridge', { toolUseId, early, metaKeys: Object.keys(meta ?? {}), extraKeys: Object.keys(extra ?? {}) });
  handlePark(park);
  extra?.signal?.addEventListener?.('abort', () => rec.mark('MCP handler: upstream aborted the call', { toolUseId }));
  const { content, isError } = await promise;   // rejects on abandon()
  rec.mark('MCP handler returning client result', { toolUseId });
  return { content: [{ type: 'text', text: content }], isError };
}

// ---- driver: Agent SDK ----
async function runSdk(prompt, { resume } = {}) {
  const sdkTools = CLIENT_TOOLS.map((t) => tool(t.name, t.description, { city: z.string().describe(t.input_schema.properties.city.description) }, (args, extra) => handleCall(PREFIX + t.name, args, extra?._meta ?? {}, extra), { alwaysLoad: true }));
  const server = createSdkMcpServer({ name: SERVER, version: '0.0.0', tools: sdkTools, ...(sc.serverTimeoutMs ? { timeout: sc.serverTimeoutMs } : {}) });
  let child;
  const q = query({ prompt, options: {
    pathToClaudeCodeExecutable: CLI, cwd: CWD, env: childEnv(),
    tools: [], mcpServers: { [SERVER]: server }, allowedTools: CLIENT_TOOLS.map((t) => PREFIX + t.name),
    permissionMode: 'default', permissionPrompts: 'none', settingSources: [], strictMcpConfig: true,
    persistSession: !!sc.persist, includePartialMessages: true, maxBudgetUsd: 1,
    ...(resume ? { resume } : {}),
    spawnClaudeCodeProcess: (o) => { rec.mark('spawn', { command: o.command, args: o.args }); child = tapChild(spawn(o.command, o.args, { cwd: o.cwd, env: o.env, stdio: ['pipe', 'pipe', 'pipe'], signal: o.signal }), rec); return child; },
    stderr: () => {},
  } });
  ctl.interrupt = async () => { const r = await q.interrupt(); obs.interrupt = r; rec.mark('interrupt() resolved', r ?? {}); };
  ctl.endRun = () => {};
  ctl.close = () => { child?.stdin.end(); rec.mark('stdin ended (no interrupt); waiting up to 20 s to see what upstream does'); setTimeout(() => { rec.mark('killing child'); q.close(); }, 20000); };
  const cap = setTimeout(() => { rec.mark('RUN CAP HIT, closing'); q.close(); }, RUN_CAP_MS);
  const stall = setInterval(() => { if (Date.now() - lastFrameAt > STALL_MS) { rec.mark('STALL, closing'); q.close(); } }, 5000);
  try { for await (const m of q) onFrame(m); } catch (e) { rec.mark('iterator threw', { error: String(e) }); }
  clearTimeout(cap); clearInterval(stall);
}

// ---- driver: raw CLI + wrapper-hosted HTTP MCP server ----
async function runCli(prompt, { resume } = {}) {
  const mcp = await startMcpHttpServer({ serverName: SERVER, clientTools: CLIENT_TOOLS, rec, onCall: ({ name: n, args, meta, signal }) => handleCall(PREFIX + n, args, meta, { signal }) });
  const mcpConfig = { mcpServers: { [SERVER]: { type: 'http', url: mcp.url, alwaysLoad: true, ...(sc.serverTimeoutMs ? { timeout: sc.serverTimeoutMs } : {}) } } };
  const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    '--tools', '', '--permission-mode', 'default', '--permission-prompts', 'none', '--setting-sources=', '--strict-mcp-config',
    '--mcp-config', JSON.stringify(mcpConfig), '--allowedTools', CLIENT_TOOLS.map((t) => PREFIX + t.name).join(','), '--max-budget-usd', '1',
    ...(sc.persist ? [] : ['--no-session-persistence']), ...(resume ? ['--resume', resume] : [])];
  rec.mark('spawn', { command: CLI, args });
  const child = tapChild(spawn(CLI, args, { cwd: CWD, env: childEnv(), stdio: ['pipe', 'pipe', 'pipe'] }), rec);
  let buf = '';
  child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (!l.trim()) continue; try { onFrame(JSON.parse(l)); } catch { rec.mark('non-json stdout line', { line: l.slice(0, 200) }); } } });
  const exited = new Promise((r) => child.on('exit', r));
  child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: prompt }] }, parent_tool_use_id: null, session_id: '' }) + '\n');
  rec.mark('wrote user message to stdin');
  ctl.interrupt = async () => { child.stdin.write(JSON.stringify({ type: 'control_request', request_id: 'spike-interrupt-1', request: { subtype: 'interrupt' } }) + '\n'); rec.mark('wrote control_request interrupt to stdin'); };
  let ended = false;
  ctl.endRun = () => { if (ended) return; ended = true; setTimeout(() => { rec.mark('closing stdin to end the run'); child.stdin.end(); }, 1000); };
  const cap = setTimeout(() => { rec.mark('RUN CAP HIT, SIGTERM'); child.kill('SIGTERM'); }, RUN_CAP_MS);
  const stall = setInterval(() => { if (Date.now() - lastFrameAt > STALL_MS) { rec.mark('STALL, SIGTERM'); child.kill('SIGTERM'); } }, 5000);
  await exited; clearTimeout(cap); clearInterval(stall); await mcp.close();
}

// ---- main ----
rec.mark('scenario', { name, ...sc, CLIENT_DELAY_MS, cli: CLI, cwd: CWD });
const run = sc.driver === 'sdk' ? runSdk : runCli;
await run(sc.prompt);
let resumeObs = null;
if (sc.thenResume && obs.init?.session_id) {
  const sid = obs.init.session_id; const id = obs.announced[0]?.id; const city = obs.announced[0]?.input?.city;
  const resumePrompt = `The get_weather tool call ${id} returned: ${fakeWeather(city)}. Continue and give your final one-sentence answer.`;
  rec.mark('--- second run: resume with the tool result as a user text message ---', { sid, resumePrompt });
  const before = { modelCalls: obs.modelCalls, results: obs.results.length, finalText: obs.finalText.length };
  await run(resumePrompt, { resume: sid });
  resumeObs = { modelCallsInResume: obs.modelCalls - before.modelCalls, results: obs.results.slice(before.results), finalText: obs.finalText.slice(before.finalText) };
}

const t = (label) => rec.marks.find((m) => m.label === label || m.label.startsWith(label))?.t_ms ?? null;
const summary = rec.summary({
  scenario: sc, init: obs.init, modelCalls: obs.modelCalls, assistantMessageIds: [...obs.assistantMsgIds],
  ids: { announcedOnAssistantFrames: obs.announced.map((a) => a.id), seenInMcpMeta: obs.metaIds, inCliToolResultFrames: obs.cliToolResultIds,
         allMatch: obs.announced.length > 0 && obs.announced.every((a) => obs.metaIds.includes(a.id)) && obs.metaIds.every((i) => obs.announced.some((a) => a.id === i)) },
  timings_ms: { tool_use_frame: t('assistant tool_use frame'), message_delta_tool_use: rec.marks.find((m) => m.label === 'stream message_delta' && m.stop_reason === 'tool_use')?.t_ms ?? null, message_stop_first: t('stream message_stop'), mcp_call: t('MCP handler parked'), parked: obs.parkedAt, client_delivered: obs.deliveredAt, cli_tool_result_frame: t('cli emitted user/tool_result'), second_message_start: rec.marks.find((m) => m.label === 'stream message_start #2')?.t_ms ?? null, result: t('result'), exit: t('process exit') },
  derived_ms: { bridge_detect_overhead: (obs.parkedAt != null && t('stream message_stop') != null) ? obs.parkedAt - t('stream message_stop') : null, resume_overhead_delivered_to_cli_tool_result: (obs.deliveredAt != null && t('cli emitted user/tool_result') != null) ? t('cli emitted user/tool_result') - obs.deliveredAt : null, delivered_to_next_model_call: (obs.deliveredAt != null && rec.marks.find((m) => m.label === 'stream message_start #2')) ? rec.marks.find((m) => m.label === 'stream message_start #2').t_ms - obs.deliveredAt : null },
  stopReasons: obs.stopReasons, results: obs.results, finalText: obs.finalText, interrupt: obs.interrupt, controlFramesOnStdout: obs.controlFrames.length, resume: resumeObs,
  bridgeTrace: bridge.state.events, bridgeFinal: bridge.snapshot(), five_hour_utilization: obs.utilization,
});
console.log('\n=== SUMMARY ===');
console.log(JSON.stringify({ modelCalls: summary.modelCalls, ids: summary.ids, timings_ms: summary.timings_ms, derived_ms: summary.derived_ms, stopReasons: summary.stopReasons, results: summary.results.map((r) => ({ subtype: r.subtype, stop_reason: r.stop_reason, num_turns: r.num_turns, cost: r.total_cost_usd, is_error: r.is_error, errors: r.errors })), finalText: summary.finalText, interrupt: summary.interrupt, resume: summary.resume, utilization: summary.five_hour_utilization }, null, 2));
process.exit(0);
