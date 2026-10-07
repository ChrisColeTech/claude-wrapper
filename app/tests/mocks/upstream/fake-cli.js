#!/usr/bin/env node
/**
 * A stand-in for the Claude Code CLI in stream-json mode, for spawn runner tests (never the real
 * CLI). Reads stdin lines: a `user` message gets a `system/init` reporting this process's argv,
 * cwd and environment names plus the message's size, then a `result`; an interrupt gets its
 * `control_response`. Exits with FAKE_CLI_EXIT (default 0) when stdin ends.
 *
 * FAKE_CLI_MODE: `ignore-eof` keeps running after stdin ends; `trap-term` also ignores SIGTERM.
 */
const readline = require('readline');

const mode = process.env.FAKE_CLI_MODE || 'normal';
const emit = (frame) => process.stdout.write(JSON.stringify(frame) + '\n');

if (mode === 'trap-term') process.on('SIGTERM', () => undefined);

const input = readline.createInterface({ input: process.stdin });
input.on('line', (line) => {
  const message = JSON.parse(line);
  if (message.type === 'user') {
    emit({
      type: 'system', subtype: 'init', session_id: 'fake-session', model: 'fake-model',
      argv: process.argv.slice(2), cwd: process.cwd(), envNames: Object.keys(process.env).sort(),
      receivedBytes: Buffer.byteLength(line)
    });
    emit({ type: 'result', subtype: 'success', is_error: false, result: 'pong' });
  }
  if (message.type === 'control_request') {
    emit({ type: 'control_response', response: { subtype: 'success', request_id: message.request_id, response: {} } });
  }
});
input.on('close', () => {
  process.stderr.write('fake cli: stdin ended\n');
  if (mode === 'normal') process.exit(Number(process.env.FAKE_CLI_EXIT || 0));
  setInterval(() => undefined, 1000);
});
