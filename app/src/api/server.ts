import express, { Express } from 'express';
import { Server } from 'http';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middleware/error';
import { requestLoggingMiddleware, errorLoggingMiddleware } from './middleware/logging';
import chatRoutes from './routes/chat';
import modelsRoutes from './routes/models';
import healthRoutes from './routes/health';
import sessionRoutes from './routes/sessions';
import authRoutes from './routes/auth';
import logsRoutes from './routes/logs';
import portForwardingRoutes from './routes/port-forwarding';
import { logger } from '../utils/logger';
import { EnvironmentManager } from '../config/env';
import { createAuthMiddleware, getApiKey } from '../auth/middleware';
import { swaggerSpec } from './swagger';
import { lazyApp } from './lazy-app';
import { SurfaceDeps } from '../anthropic/deps';

function mountMiddleware(app: Express): void {
  app.use(cors());
  app.use(express.json());

  // Enhanced request/response logging middleware (debug mode)
  if (EnvironmentManager.isDebugMode()) {
    app.use(requestLoggingMiddleware);
  } else {
    // Basic request logging for standard mode
    app.use((req, _res, next) => {
      logger.info('Request received', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  // Optional HTTP API protection middleware (lazy initialization to handle runtime API key setting)
  app.use((req, res, next) => {
    const apiKey = getApiKey();
    const authMiddleware = createAuthMiddleware({
      skipPaths: ['/health', '/docs', '/swagger.json', '/v1/auth/status', '/logs', '/port-forwarding'], // Always allow these endpoints
      ...(apiKey && { apiKey }) // Only include apiKey if it exists
    });
    authMiddleware(req, res, next);
  });
}

// Swagger documentation routes (always public)
function mountDocs(app: Express): void {
  app.get('/swagger.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Claude Wrapper API Documentation'
  }));
}

function mountRoutes(app: Express): void {
  app.use('/', healthRoutes);
  app.use('/', modelsRoutes);
  app.use('/', sessionRoutes);
  app.use('/', authRoutes);
  app.use('/', logsRoutes);
  app.use('/', portForwardingRoutes);
  app.use('/', chatRoutes);
}

// Error handling (must be last)
function mountErrorHandling(app: Express): void {
  if (EnvironmentManager.isDebugMode()) {
    app.use(errorLoggingMiddleware);
  }
  app.use(errorHandler);
}

/**
 * Build a fresh Express app. Each call returns a new, independent app.
 * `_deps` is reserved for the Anthropic surface's composition root (ticket 24 onwards);
 * every slot is optional and the OpenAI surface ignores them.
 */
export function createServer(_deps: SurfaceDeps = {}): Express {
  const app = express();
  mountMiddleware(app);
  mountDocs(app);
  mountRoutes(app);
  mountErrorHandling(app);
  return app;
}

/**
 * Build an app with `deps` and listen on the configured port. Returns the HTTP server.
 */
export function startServer(deps: SurfaceDeps = {}): Server {
  const config = EnvironmentManager.getConfig();

  return createServer(deps).listen(config.port, '0.0.0.0', () => {
    logger.info('Server started successfully', {
      port: config.port,
      environment: EnvironmentManager.isProduction() ? 'production' : 'development'
    });
  });
}

/**
 * The CLI and the daemon listen on this app. It is built on first use, after they have set
 * the environment, so importing this module builds no app.
 */
export default lazyApp(() => createServer());
