/**
 * Express server configuration and management
 * Based on Python main.py FastAPI app setup
 * 
 * Single Responsibility: Express server creation and lifecycle management
 */

import express from 'express';
import winston from 'winston';
import { Config } from './utils/env';
import { createLogger } from './utils/logger';
import { authMiddleware, authStatusMiddleware } from './auth/middleware';
import { createCorsMiddleware } from './middleware/cors';
import { timingMiddleware } from './middleware/timing';
import { initializeAuthentication } from './server/auth-initializer';
import { ServerManager, ServerStartResult } from './server/server-manager';
import { ModelsRouter, HealthRouter, ChatRouter, AuthRouter, SessionsRouter, DebugRouter } from './routes';
import monitoringRoutes from './routes/monitoring';

// Re-export ServerManager and ServerStartResult for external use
export { ServerManager, ServerStartResult };

// Re-export http Server for tests
export { Server } from 'http';


/**
 * Server configuration interface
 */
export interface ServerConfig {
  port: number;
  corsOrigins: string;
  host?: string;
  timeout?: number;
}

/**
 * Health check response interface
 */
export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
}

// ServerStartResult exported from server-manager


/**
 * Express application factory
 */
export class ExpressAppFactory {
  private logger: winston.Logger;
  private startTime: number;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.startTime = Date.now();
  }

  /**
   * Create configured Express application
   * @param config Server configuration
   * @returns Configured Express app
   */
  createApp(config: ServerConfig): express.Application {
    const app = express();

    // Remove security headers that expose server info
    app.disable('x-powered-by');

    // Request parsing middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // CORS middleware
    app.use(createCorsMiddleware(config.corsOrigins));

    // Performance monitoring middleware (before request logging)
    app.use(timingMiddleware);

    // Request logging middleware
    app.use((req, _res, next) => {
      this.logger.debug(`${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent')
      });
      next();
    });

    // Authentication status middleware (adds auth headers)
    app.use(authStatusMiddleware);

    // Authentication middleware for protected routes
    app.use(authMiddleware({
      skipPaths: [
        '/health', 
        '/health/detailed', 
        '/v1/models', 
        '/v1/auth/status', 
        '/v1/compatibility', 
        '/v1/debug/request',
        '/monitoring/health',
        '/monitoring/status',
        '/monitoring/system'
      ] // Skip auth for health, models, auth status, debug, and monitoring endpoints
    }));

    // Set start time for health router
    HealthRouter.setStartTime(this.startTime);

    // Mount route handlers
    // Mount routes
    app.use('/v1/models', ModelsRouter);
    app.use('/health', HealthRouter.createRouter());
    app.use('/v1/auth', AuthRouter);
    app.use('/v1/sessions', SessionsRouter);
    app.use('/debug', DebugRouter);
    app.use('/v1/chat', ChatRouter);
    
    // Mount monitoring routes
    app.use('/monitoring', monitoringRoutes);

    // 404 handler
    app.use((_req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: 'The requested endpoint does not exist'
      });
    });

    // Error handling middleware
    app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      this.logger.error('Express error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred'
      });
    });

    this.logger.info('Express application configured successfully');
    return app;
  }
}


/**
 * Create Express application with environment configuration
 * @param config Environment configuration
 * @returns Configured Express application
 */
export function createApp(config: Config): express.Application {
  const logger = createLogger(config);
  const factory = new ExpressAppFactory(logger);
  
  const serverConfig: ServerConfig = {
    port: config.PORT,
    corsOrigins: config.CORS_ORIGINS,
    timeout: config.MAX_TIMEOUT
  };

  return factory.createApp(serverConfig);
}


/**
 * Create and start server with environment configuration
 * @param config Environment configuration
 * @returns Promise resolving to server start result
 */
export async function createAndStartServer(config: Config): Promise<ServerStartResult> {
  const logger = createLogger(config);
  
  // Initialize authentication before creating app (skip in test mode)
  if (process.env.NODE_ENV !== 'test') {
    await initializeAuthentication(logger);
  } else {
    logger.debug('Skipping authentication initialization in test mode');
  }
  
  const app = createApp(config);
  const serverManager = new ServerManager(logger);
  
  return serverManager.startServer(app, config.PORT);
}
