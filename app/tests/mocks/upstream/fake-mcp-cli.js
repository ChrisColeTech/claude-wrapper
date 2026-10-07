/**
 * A stand-in for the Claude Code CLI in stream-json mode that reports on its `--mcp-config` file,
 * for connector tests through the spawn runner (never the real CLI). On a `user` message it reads
 * the file, reports every server in it `connected` on `system/init` (with the `--model` it was
 * given), and answers with one text block: the file's mode and each server's Authorization header,
 * as JSON. Exits 0 when stdin ends. Run it as `node fake-mcp-cli.js <flags>`.
 */
const fs = require('fs');
const readline = require('readline');

const argv = process.argv.slice(2);
const arg = (flag) => argv[argv.indexOf(flag) + 1];
const emit = (frame) => process.stdout.write(JSON.stringify(frame) + '\n');
const event = (value) => emit({ type: 'stream_event', event: value, parent_tool_use_id: null, session_id: 'fake-session' });

function report() {
  const file = arg('--mcp-config');
  const servers = JSON.parse(fs.readFileSync(file, 'utf8')).mcpServers;
  const headers = Object.fromEntries(Object.entries(servers).map(([name, entry]) => [name, (entry.headers || {}).Authorization || null]));
  return { servers, text: JSON.stringify({ mode: (fs.statSync(file).mode & 0o777).toString(8), headers }) };
}

readline.createInterface({ input: process.stdin }).on('line', (line) => {
  if (JSON.parse(line).type !== 'user') return;
  const { servers, text } = report();
  emit({
    type: 'system', subtype: 'init', session_id: 'fake-session', model: arg('--model'), tools: [], cwd: process.cwd(),
    mcp_servers: Object.keys(servers).map((name) => ({ name, status: 'connected' })), apiKeySource: 'none',
    permissionMode: 'default', claude_code_version: 'fake'
  });
  event({ type: 'message_start', message: { id: 'msg_fake', type: 'message', role: 'assistant', model: arg('--model'), content: [],
    stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } });
  event({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
  event({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } });
  event({ type: 'content_block_stop', index: 0 });
  event({ type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 2 } });
  event({ type: 'message_stop' });
  emit({ type: 'result', subtype: 'success', is_error: false, result: text, session_id: 'fake-session', usage: {} });
}).on('close', () => process.exit(0));
