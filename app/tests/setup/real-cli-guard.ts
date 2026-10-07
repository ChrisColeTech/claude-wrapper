/**
 * Jest setup file of the unit and integration projects and `test:ci` (never the e2e project): no
 * test reaches the operator's Claude Code, whose runs spend subscription quota. `CLAUDE_COMMAND`
 * names a shim (`blocked-cli/claude`) that exits 97 with "real CLI blocked in tests", and the
 * shim's directory goes first on PATH, so `claude` looked up on the PATH a run's child inherits
 * is the shim too. With `UPSTREAM_E2E=1` (the real-CLI e2e flag) it steps aside.
 *
 * It changes this test file's `process.env`, which is what the app's modules read; a child
 * spawned without an explicit `env` inherits the worker's own environment instead.
 */
import * as path from 'path';

const BLOCKED_CLI_DIR = path.resolve(__dirname, 'blocked-cli');

if (process.env['UPSTREAM_E2E'] !== '1') {
  const current = process.env['PATH'];
  const rest = current ? current.split(path.delimiter).filter(entry => entry !== BLOCKED_CLI_DIR) : [];
  process.env['CLAUDE_COMMAND'] = path.join(BLOCKED_CLI_DIR, 'claude');
  process.env['PATH'] = [BLOCKED_CLI_DIR, ...rest].join(path.delimiter);
}
