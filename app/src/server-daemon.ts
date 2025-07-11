#!/usr/bin/env node
/**
 * Background server daemon process
 * Runs the Express server in background without CLI interaction
 */

import { logger } from './utils/logger';
import { signalHandler } from './process/signals';

/**
 * Parse daemon arguments
 */
function parseDaemonArgs(): { port: number; apiKey?: string; verbose?: boolean; debug?: boolean; mock?: boolean } {
  const args = process.argv.slice(2);
  const result: { port: number; apiKey?: string; verbose?: boolean; debug?: boolean; mock?: boolean } = {
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
      case '--mock':
        result.mock = true;
        break;
    }
  }

  return result;
}


/**
 * Main daemon function
 */
async function startDaemon(): Promise<void> {
  const options = parseDaemonArgs();
  
  // Set environment variables BEFORE importing server (critical for middleware configuration)
  process.env['PORT'] = options.port.toString();
  
  if (options.apiKey) {
    process.env['API_KEY'] = options.apiKey;
  }
  if (options.verbose) {
    process.env['VERBOSE'] = 'true';
  }
  if (options.debug) {
    process.env['DEBUG_MODE'] = 'true';
  }
  if (options.mock) {
    process.env['MOCK_MODE'] = 'true';
  }

  // Reset config cache to ensure environment variables are re-read
  const { EnvironmentManager } = await import('./config/env');
  EnvironmentManager.resetConfig();

  // Import server AFTER setting environment variables
  const { startServer } = await import('./api/server');

  // Start server with Claude CLI initialization
  const server = await startServer();

  // Setup graceful shutdown using new signal handler
  signalHandler.setupGracefulShutdown(server);
}

// Only run if this is the main module
if (require.main === module) {
  startDaemon().catch(error => {
    logger.error('Failed to start daemon', error);
    process.exit(1);
  });
}

export { startDaemon };