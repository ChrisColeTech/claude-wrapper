import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error';
import chatRoutes from './routes/chat';
import modelsRoutes from './routes/models';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import sessionRoutes from './routes/sessions';
import { logger } from '../utils/logger';
import { EnvironmentManager } from '../config/env';
import { authManager } from '../auth/manager';
import { createAuthMiddleware } from '../auth/middleware';

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

// Optional authentication middleware (only if API key protection is enabled)
const authMiddleware = createAuthMiddleware(authManager, {
  skipPaths: ['/health', '/v1/models', '/v1/auth/status'], // Always allow these endpoints
  requireAuth: false // Only protect if API key is configured
});
app.use(authMiddleware);

// Routes
app.use('/', healthRoutes);
app.use('/', modelsRoutes);
app.use('/', authRoutes);
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