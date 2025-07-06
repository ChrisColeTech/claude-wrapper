/**
 * Claude Code OpenAI Wrapper - Application Entry Point
 * Main application entry point for programmatic usage
 * 
 * Based on Python implementation main.py
 * Single Responsibility: Application bootstrap and programmatic API
 */

import dotenv from 'dotenv';
import { config } from './utils/env';
import { createLogger } from './utils/logger';
import { createAndStartServer, ServerStartResult } from './server';

// Load environment variables
dotenv.config();

/**
 * Check if running in test environment
 */
function isTestEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.JEST_WORKER_ID !== undefined ||
    typeof global.describe === 'function' ||
    typeof (global as any).it === 'function'
  );
}

/**
 * Application startup options
 */
export interface ApplicationOptions {
  port?: number;
  verbose?: boolean;
  debug?: boolean;
  interactive?: boolean;
}

/**
 * Application startup result
 */
export interface ApplicationResult {
  server: ServerStartResult;
  shutdown: () => Promise<void>;
}

/**
 * Main application class for programmatic usage
 */
export class Application {
  private logger: any;
  private serverResult?: ServerStartResult;

  constructor() {
    this.logger = createLogger(config);
  }

  /**
   * Start the application with options
   * @param options Application startup options
   * @returns Application result with server and shutdown function
   */
  async start(options: ApplicationOptions = {}): Promise<ApplicationResult> {
    try {
      // Override environment variables with options
      if (options.port) {
        process.env.PORT = options.port.toString();
      }
      if (options.verbose) {
        process.env.VERBOSE = 'true';
      }
      if (options.debug) {
        process.env.DEBUG_MODE = 'true';
      }

      this.logger.info('Starting Claude Code OpenAI Wrapper application...', {
        options,
        config: {
          port: config.PORT,
          verbose: config.VERBOSE,
          debug: config.DEBUG_MODE
        }
      });

      // Start the server
      this.serverResult = await createAndStartServer(config);

      this.logger.info('Application started successfully', {
        url: this.serverResult.url,
        port: this.serverResult.port
      });

      return {
        server: this.serverResult,
        shutdown: this.shutdown.bind(this)
      };

    } catch (error) {
      this.logger.error('Failed to start application:', error);
      throw error;
    }
  }

  /**
   * Gracefully shutdown the application
   */
  async shutdown(): Promise<void> {
    if (!this.serverResult) {
      return;
    }

    this.logger.info('Shutting down application...');
    
    return new Promise((resolve) => {
      this.serverResult!.server.close(() => {
        this.logger.info('Application shutdown completed');
        resolve();
      });
    });
  }
}

/**
 * Start server with options (legacy function for compatibility)
 * @param options Server startup options
 * @returns Promise resolving to server result
 */
export async function startServer(options: ApplicationOptions = {}): Promise<ServerStartResult> {
  const app = new Application();
  const result = await app.start(options);
  return result.server;
}

/**
 * Create application instance
 * @returns New application instance
 */
export function createApplication(): Application {
  return new Application();
}

// Export configuration and utilities for external use
export { config } from './utils/env';
export { createLogger } from './utils/logger';
export { PortUtils } from './utils/port';

// Direct execution (for npm run dev)
if (require.main === module) {
  const app = new Application();
  
  app.start().then((result) => {
    console.log(`🚀 Server ready at ${result.server.url}`);
    
    // Setup graceful shutdown for direct execution (skip in test environment)
    if (!isTestEnvironment()) {
      const gracefulShutdown = async (signal: string) => {
        console.log(`\nReceived ${signal}, shutting down gracefully...`);
        await result.shutdown();
        process.exit(0);
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }
    
  }).catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}
