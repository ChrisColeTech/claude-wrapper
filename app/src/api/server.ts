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
import { AuthMiddlewareOptions, createAuthMiddleware, getApiKey } from '../auth/middleware';
import { swaggerSpec } from './swagger';
import { SurfaceDeps } from '../anthropic/deps';
import { AnthropicSurface, createAnthropicSurface } from '../anthropic';
import {
  ANTHROPIC_OPENAPI_PATH, createAnthropicAuth, isAnthropicRequest, parseAnthropicBody, serveAnthropicOpenApi, tagSurface
} from '../anthropic/http';

/** The client gate's options, read per request (the API key can be set at runtime). */
function authOptions(): AuthMiddlewareOptions {
  const apiKey = getApiKey();
  return {
    skipPaths: ['/health', '/docs', '/swagger.json', '/v1/auth/status', '/logs', '/port-forwarding'], // Always allow these endpoints
    ...(apiKey && { apiKey }) // Only include apiKey if it exists
  };
}

function mountMiddleware(app: Express): void {
  app.use(tagSurface); // first: every later middleware renders by the surface tag
  app.use(cors());
  // The Anthropic surface checks the key (x-api-key or Bearer, its own envelope) before it reads a body of up to 32 MB
  app.use((req, res, next) => (isAnthropicRequest(req) ? createAnthropicAuth(authOptions())(req, res, next) : next()));
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

  // Optional HTTP API protection middleware (lazy initialization to handle runtime API key setting).
  // The OpenAI surface stays Bearer-only, checked here, after its body is parsed, as it always was.
  app.use((req, res, next) => (isAnthropicRequest(req) ? next() : createAuthMiddleware(authOptions())(req, res, next)));
}

// Swagger documentation routes (always public)
function mountDocs(app: Express): void {
  app.get('/swagger.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  app.get(ANTHROPIC_OPENAPI_PATH, serveAnthropicOpenApi); // before /docs, whose UI answers every path under it

  // The top bar holds the definition picker (one definition per surface); only its logo is hidden
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(undefined, {
    explorer: true,
    swaggerOptions: {
      urls: [{ url: '/swagger.json', name: 'OpenAI surface' }, { url: ANTHROPIC_OPENAPI_PATH, name: 'Anthropic surface' }]
    },
    customCss: '.swagger-ui .topbar .link { display: none }',
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

/** Each app's Anthropic surface, for `anthropicSurfaceOf`. */
const surfaces = new WeakMap<Express, AnthropicSurface>();

/**
 * Build a fresh Express app. Each call returns a new, independent app.
 * `deps` go to the Anthropic surface's composition root; every slot is optional and the
 * OpenAI surface ignores them.
 */
export function createServer(deps: SurfaceDeps = {}): Express {
  const app = express();
  const anthropic = createAnthropicSurface(deps);
  surfaces.set(app, anthropic);
  mountMiddleware(app);
  mountDocs(app);
  mountRoutes(app, anthropic);
  mountErrorHandling(app);
  return app;
}

/**
 * The Anthropic surface of an app `createServer` built, as the wrapper process drives it (spec section 14): `start()` when the wrapper starts (the transcript
 * sweeps), `shutdown(deadlineMs?)` first in its shutdown (new requests 529, turns in flight their
 * error, every run down the teardown ladder, SIGKILL at the deadline; resolves once every run has
 * exited).
 */
export function anthropicSurfaceOf(app: Express): Pick<AnthropicSurface, 'start' | 'shutdown'> {
  return surfaces.get(app) ?? { start: () => undefined, shutdown: async () => undefined };
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
