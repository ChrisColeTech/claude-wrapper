#!/usr/bin/env node
/**
 * Background server daemon process
 * Runs the Express server in background without CLI interaction
 */

import app from './api/server';
import { logger } from './utils/logger';
import { signalHandler } from './process/signals';

/**
 * Parse daemon arguments
 */
function parseDaemonArgs(): { port: number; apiKey?: string; verbose?: boolean; debug?: boolean } {
  const args = process.argv.slice(2);
  const result: { port: number; apiKey?: string; verbose?: boolean; debug?: boolean } = {
    port: 8000
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--port':
        result.port = parseInt(args[++i] || '8000');
        break;
      case '--api-key': {
        const apiKeyValue = args[++i];
        if (apiKeyValue) {
          result.apiKey = apiKeyValue;
        }
        break;
      }
      case '--verbose':
        result.verbose = true;
        break;
      case '--debug':
        result.debug = true;
        break;
    }
  }

  return result;
}


/**
 * Main daemon function
 */
function startDaemon(): void {
  const options = parseDaemonArgs();
  
  // Set environment variables if provided
  if (options.apiKey) {
    process.env['API_KEY'] = options.apiKey;
  }
  if (options.verbose) {
    process.env['VERBOSE'] = 'true';
  }
  if (options.debug) {
    process.env['DEBUG_MODE'] = 'true';
  }

  // Start server
  const server = app.listen(options.port, () => {
    // Only log in verbose/debug mode for daemon
    if (options.verbose || options.debug) {
      logger.info(`🚀 Claude Wrapper daemon running on port ${options.port}`);
      logger.info(`📡 API available at http://localhost:${options.port}/v1/chat/completions`);
      logger.info(`📊 Health check at http://localhost:${options.port}/health`);
    }
  });

  // Setup graceful shutdown using new signal handler
  signalHandler.setupGracefulShutdown(server);
}

// Only run if this is the main module
if (require.main === module) {
  startDaemon();
}

export { startDaemon };