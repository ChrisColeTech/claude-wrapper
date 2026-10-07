#!/usr/bin/env node
// Ticket 21 measurement 5: the same updatedInput through the Agent SDK's in-process `hooks` option.
// Uses the spike's node_modules (@anthropic-ai/claude-agent-sdk 0.3.289) by absolute import; nothing under spike/ is modified.
// usage: node s-sdk-hooks.mjs <name> <prompt>
// Writes out/<name>.jsonl (every SDK message, one per line), out/<name>.wire.ndjson (both stdio directions of the child,
// so the control-protocol hook_callback round trip is visible), out/<name>.stderr.txt, out/<name>.harness.txt,
// and the hook callback logs to hooklog/<name>.jsonl. 180 s cap -> q.close().
import { spawn } from 'node:child_process';
import { appendFileSync, writeFileSync, readdirSync } from 'node:fs';
import { query } from '/home/anas/Work/claude-wrapper/.scratch/anthropic-compat-api/spike/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs';

const BASE = '/tmp/claude-1000/-home-anas-Work-claude-wrapper/23127712-bc1f-4f65-ab20-57491898aa91/scratchpad/probe-21';
const CLI = '/home/anas/.local/share/mise/installs/claude/latest/claude';
const CWD = `${BASE}/cwd`;
const [name, prompt] = process.argv.slice(2);
if (readdirSync(CWD).length) throw new Error('probe cwd must be empty');
const OUT = `${BASE}/out/${name}`, HOOKLOG = `${BASE}/hooklog/${name}.jsonl`;
writeFileSync(`${OUT}.jsonl`, ''); writeFileSync(`${OUT}.wire.ndjson`, ''); writeFileSync(`${OUT}.stderr.txt`, ''); writeFileSync(HOOKLOG, '');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE')));
const stripped = Object.keys(process.env).filter((k) => k.startsWith('CLAUDE')).sort();
const t0 = Date.now(); const wire = (dir, line) => appendFileSync(`${OUT}.wire.ndjson`, JSON.stringify({ t_ms: Date.now() - t0, dir, line }) + '\n');

let n = 0; let spawned = null;
const preToolUse = async (input, toolUseID, { signal }) => {
  n += 1;
  const out = n === 1
    ? { hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { ...(input.tool_input ?? {}), allowed_domains: ['github.com'] } } }
    : { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'max_uses reached' } };
  appendFileSync(HOOKLOG, JSON.stringify({ n, t: new Date().toISOString(), toolUseID, input, output: out }) + '\n');
  return out;
};

const q = query({ prompt, options: {
  pathToClaudeCodeExecutable: CLI, cwd: CWD, env,
  tools: ['WebSearch'], allowedTools: ['WebSearch'],
  permissionMode: 'default', permissionPrompts: 'none', settingSources: [], strictMcpConfig: true,
  persistSession: false, includePartialMessages: true, includeHookEvents: true, maxBudgetUsd: 1, systemPrompt: '',
  hooks: { PreToolUse: [{ matcher: 'WebSearch|WebFetch', hooks: [preToolUse], timeout: 30 }] },
  spawnClaudeCodeProcess: (o) => {
    spawned = { command: o.command, args: o.args };
    const child = spawn(o.command, o.args, { cwd: o.cwd, env: o.env, stdio: ['pipe', 'pipe', 'pipe'], signal: o.signal });
    const w = child.stdin.write.bind(child.stdin);
    child.stdin.write = (chunk, ...rest) => { for (const l of String(chunk).split('\n')) if (l.trim()) wire('host->cli', l); return w(chunk, ...rest); };
    const e = child.stdin.end.bind(child.stdin); child.stdin.end = (...a) => { wire('host->cli', '<stdin EOF>'); return e(...a); };
    let buf = ''; child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.trim()) wire('cli->host', l); } });
    child.stderr.on('data', (d) => appendFileSync(`${OUT}.stderr.txt`, String(d)));
    child.on('exit', (c, s) => wire('proc', `<exit code=${c} signal=${s}>`));
    return child;
  },
  stderr: () => {},
} });
const cap = setTimeout(() => { wire('harness', '<180 s cap: q.close()>'); q.close(); }, 180000);
let count = 0;
try { for await (const m of q) { count += 1; appendFileSync(`${OUT}.jsonl`, JSON.stringify(m) + '\n'); } }
catch (err) { wire('harness', `<iterator threw: ${String(err)}>`); }
clearTimeout(cap);
const rec = { probe: name, driver: 'agent-sdk 0.3.289 in-process hooks', started: new Date(t0).toISOString(), duration_s: (Date.now() - t0) / 1000, messages: count, spawned, prompt, env_stripped: stripped, hook_log: HOOKLOG };
writeFileSync(`${OUT}.harness.txt`, JSON.stringify(rec, null, 1) + '\n');
appendFileSync(`${BASE}/out/s-run-log.jsonl`, JSON.stringify(rec) + '\n');
console.log(`${name}: messages=${count} ${rec.duration_s.toFixed(1)}s hook_calls=${n}`);
