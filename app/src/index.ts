/**
 * Claude Code OpenAI Wrapper - Server Logic
 * Main server functionality
 * 
 * Based on Python implementation main.py
 */

import dotenv from 'dotenv';
import { createApp } from './server';
import { logger } from './utils/logger';
import { config } from './utils/env';

// Load environment variables
dotenv.config();

export interface ServerOptions {
  port?: number;
  verbose?: boolean;
  debug?: boolean;
  interactive?: boolean;
}

export async function startServer(options: ServerOptions = {}): Promise<void> {
  try {
    // Apply CLI options to config
    const serverPort = options.port || config.PORT;
    
    logger.info('Starting Claude Code OpenAI Wrapper...');
    
    const app = await createApp();
    
    app.listen(serverPort, () => {
      logger.info(`Server running on http://localhost:${serverPort}`);
      logger.info('Ready to process OpenAI-compatible requests');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    throw error;
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Direct execution (for npm run dev)
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}
