import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middleware/error';
import chatRoutes from './routes/chat';
import modelsRoutes from './routes/models';
import healthRoutes from './routes/health';
import sessionRoutes from './routes/sessions';
import { logger } from '../utils/logger';
import { EnvironmentManager } from '../config/env';
import { createAuthMiddleware, getApiKey } from '../auth/middleware';
import { swaggerSpec } from './swagger';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, _res, next) => {
  logger.info('Request received', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Optional HTTP API protection middleware (only if API key is configured)
const apiKey = getApiKey();
const authMiddleware = createAuthMiddleware({
  skipPaths: ['/health', '/v1/models', '/docs', '/swagger.json'], // Always allow these endpoints
  ...(apiKey && { apiKey }) // Only include apiKey if it exists
});
app.use(authMiddleware);

// Swagger documentation routes (always public)
app.get('/swagger.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Claude Wrapper API Documentation'
}));

// Routes
app.use('/', healthRoutes);
app.use('/', modelsRoutes);
app.use('/', sessionRoutes);
app.use('/', chatRoutes);

// Error handling (must be last)
app.use(errorHandler);

export function createServer() {
  return app;
}

export function startServer(): void {
  const config = EnvironmentManager.getConfig();
  
  app.listen(config.port, () => {
    logger.info('Server started successfully', {
      port: config.port,
      environment: EnvironmentManager.isProduction() ? 'production' : 'development'
    });
  });
}

export default app;