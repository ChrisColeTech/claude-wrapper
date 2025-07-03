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
import { initializeAuthentication } from './server/auth-initializer';
import { ServerManager, ServerStartResult } from './server/server-manager';

// Re-export ServerManager for external use
export { ServerManager };

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

    // Request parsing middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // CORS middleware
    app.use(createCorsMiddleware(config.corsOrigins));

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
      skipPaths: ['/health', '/v1/models'] // Skip auth for health and models endpoints
    }));

    // Health check endpoint
    app.get('/health', (_req, res) => {
      const healthResponse: HealthResponse = {
        status: 'healthy',
        service: 'claude-code-openai-wrapper',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime
      };
      res.json(healthResponse);
    });

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
  
  // Initialize authentication before creating app
  await initializeAuthentication(logger);
  
  const app = createApp(config);
  const serverManager = new ServerManager(logger);
  
  return serverManager.startServer(app, config.PORT);
}
