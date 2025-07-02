#!/usr/bin/env node
"use strict";
/**
 * Claude Code OpenAI Wrapper - CLI Entry Point
 * Command-line interface for starting the server
 *
 * Based on Python implementation main.py CLI behavior
 */
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const index_1 = require("./index");
const program = new commander_1.Command();
program
    .name('claude-wrapper')
    .description('OpenAI-compatible API wrapper for Claude Code CLI')
    .version('1.0.0')
    .option('-p, --port <number>', 'port to run server on', '8000')
    .option('-v, --verbose', 'enable verbose logging')
    .option('-d, --debug', 'enable debug mode')
    .option('--no-interactive', 'disable interactive API key setup')
    .parse();
const options = program.opts();
// Start the server with CLI options
(0, index_1.startServer)({
    port: parseInt(options.port),
    verbose: options.verbose,
    debug: options.debug,
    interactive: options.interactive
}).catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map