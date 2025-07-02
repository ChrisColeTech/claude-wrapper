/**
 * Express server configuration
 * Based on Python main.py FastAPI app setup
 */

import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger';
import { config } from './utils/env';

export async function createApp(): Promise<express.Application> {
  const app = express();
  
  // Basic middleware
  app.use(express.json());
  app.use(cors({
    origin: config.CORS_ORIGINS === '["*"]' ? true : JSON.parse(config.CORS_ORIGINS),
    credentials: true
  }));
  
  // Basic health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'claude-code-openai-wrapper'
    });
  });
  
  logger.info('Express app configured successfully');
  return app;
}
