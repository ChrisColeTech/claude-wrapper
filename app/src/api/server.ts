import express, { Express } from 'express';
import { Server } from 'http';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middleware/error';
import { requestLoggingMiddleware, errorLoggingMiddleware } from './middleware/logging';
import chatRoutes from './routes/chat';
import modelsRoutes from './routes/models';
import { createHealthRouter } from './routes/health';
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
import { AnthropicSurface, createAnthropicSurface } from '../anthropic';
import { createAnthropicAuth, isAnthropicRequest, parseAnthropicBody, tagSurface } from '../anthropic/http';

function mountMiddleware(app: Express): void {
  app.use(tagSurface); // first: every later middleware renders by the surface tag
  app.use(cors());
  app.use(parseAnthropicBody); // 32 MB on Anthropic-tagged requests; express.json() skips a parsed body
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
    const options = {
      skipPaths: ['/health', '/docs', '/swagger.json', '/v1/auth/status', '/logs', '/port-forwarding'], // Always allow these endpoints
      ...(apiKey && { apiKey }) // Only include apiKey if it exists
    };
    // The Anthropic surface also accepts x-api-key and answers in its own envelope; the OpenAI surface stays Bearer-only
    const authMiddleware = isAnthropicRequest(req) ? createAnthropicAuth(options) : createAuthMiddleware(options);
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

function mountRoutes(app: Express, anthropic: AnthropicSurface): void {
  app.use('/', anthropic.router); // before the OpenAI routes: Anthropic wins on a shared path
  app.use('/', createHealthRouter(() => ({ anthropic: anthropic.health() })));
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

/** Where an app keeps its Anthropic surface, for `shutdownAnthropicSurface`. */
const ANTHROPIC_SURFACE = 'anthropic surface';

/**
 * Build a fresh Express app. Each call returns a new, independent app.
 * `deps` go to the Anthropic surface's composition root; every slot is optional and the
 * OpenAI surface ignores them.
 */
export function createServer(deps: SurfaceDeps = {}): Express {
  const app = express();
  const anthropic = createAnthropicSurface(deps);
  app.set(ANTHROPIC_SURFACE, anthropic);
  mountMiddleware(app);
  mountDocs(app);
  mountRoutes(app, anthropic);
  mountErrorHandling(app);
  return app;
}

/**
 * Drains the Anthropic surface of an app `createServer` built, the default export included (spec
 * section 14): new requests get 529, turns in flight their error, every upstream run goes down the
 * teardown ladder, and what is left at `deadlineMs` (the shutdown-drain setting by default) is
 * SIGKILLed. Resolves once every run has exited.
 */
export function shutdownAnthropicSurface(app: Express, deadlineMs?: number): Promise<void> {
  const surface = app.get(ANTHROPIC_SURFACE) as AnthropicSurface | undefined;
  return surface ? surface.shutdown(deadlineMs) : Promise.resolve();
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
