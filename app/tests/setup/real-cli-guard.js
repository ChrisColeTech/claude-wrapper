const path = require('path');

if (process.env.UPSTREAM_E2E !== '1') {
  process.env.CLAUDE_COMMAND = process.execPath;
  process.env.CLAUDE_COMMAND_ARGS = JSON.stringify([
    path.resolve(__dirname, 'blocked-cli.js')
  ]);
}
