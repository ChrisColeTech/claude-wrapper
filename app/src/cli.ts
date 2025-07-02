#!/usr/bin/env node
/**
 * Claude Code OpenAI Wrapper - CLI Entry Point
 * Command-line interface for starting the server
 * 
 * Based on Python implementation main.py CLI behavior
 */

import { Command } from 'commander';
import { startServer } from './index';

const program = new Command();

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
startServer({
  port: parseInt(options.port),
  verbose: options.verbose,
  debug: options.debug,
  interactive: options.interactive
}).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
