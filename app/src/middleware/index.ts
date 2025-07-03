/**
 * Complete middleware system
 * Based on Python main.py:177-305 middleware registration
 * 
 * Single Responsibility: Middleware orchestration and configuration
 */

import { Express, Request, Response, NextFunction } from 'express';
import { createCorsMiddleware } from './cors';
import { createDebugMiddlewareFromEnv } from './debug';
import { authMiddleware, authStatusMiddleware } from '../auth/middleware';
import { createValidationMiddlewareStack } from './validation';
import { errorHandler, notFoundHandler, timeoutHandler } from './error';
import { getLogger } from '../utils/logger';

const logger = getLogger('MiddlewareSystem');

/**
 * Middleware configuration options
 */
export interface MiddlewareConfig {
  cors?: {
    origins: string;
  };
  debug?: {
    enabled: boolean;
    verbose: boolean;
  };
  auth?: {
    skipPaths: string[];
  };
  validation?: {
    enableDebugInfo: boolean;
    includeRawBody: boolean;
  };
  timeout?: number;
}

/**
 * Configure complete middleware stack
 * Based on Python FastAPI middleware ordering and configuration
 */
export function configureMiddleware(app: Express, config?: MiddlewareConfig): void {
  logger.info('🔧 Configuring middleware stack');

  // 1. Request timeout (must be first)
  if (config?.timeout) {
    app.use(createTimeoutMiddleware(config.timeout));
  }

  // 2. CORS middleware (must be early for preflight requests)
  const corsOrigins = config?.cors?.origins || process.env.CORS_ORIGINS || '["*"]';
  app.use(createCorsMiddleware(corsOrigins));
  logger.debug('✅ CORS middleware configured');

  // 3. Debug logging middleware (early in pipeline for full request tracking)
  app.use(createDebugMiddlewareFromEnv());
  logger.debug('✅ Debug middleware configured');

  // 4. Request ID middleware (for request correlation)
  app.use(createRequestIdMiddleware());
  logger.debug('✅ Request ID middleware configured');

  // 5. JSON body parser with size limits (before validation)
  const express = require('express');
  app.use(express.json({ 
    limit: '10mb',
    strict: true,
    type: 'application/json'
  }));
  logger.debug('✅ JSON body parser configured');

  // 6. Auth status middleware (adds headers, doesn't block)
  app.use(authStatusMiddleware);
  logger.debug('✅ Auth status middleware configured');

  // 7. Validation middleware stack
  const validationStack = createValidationMiddlewareStack(config?.validation);
  validationStack.forEach(middleware => app.use(middleware));
  logger.debug('✅ Validation middleware stack configured');

  // 8. Authentication middleware (after validation, before routes)
  const authConfig = config?.auth || { skipPaths: ['/health', '/v1/models'] };
  app.use(authMiddleware(authConfig));
  logger.debug('✅ Authentication middleware configured');

  logger.info('🎯 Middleware stack configuration complete');
}

/**
 * Configure error handling middleware
 * Must be called after all routes are defined
 */
export function configureErrorHandling(app: Express): void {
  logger.info('🛡️ Configuring error handling');

  // 404 handler for unmatched routes
  app.use('*', notFoundHandler);
  logger.debug('✅ 404 handler configured');

  // Global error handler (must be last)
  app.use(errorHandler);
  logger.debug('✅ Global error handler configured');

  logger.info('🎯 Error handling configuration complete');
}

/**
 * Create request timeout middleware
 */
function createTimeoutMiddleware(timeoutMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        timeoutHandler(req, res);
      }
    }, timeoutMs);

    // Clear timeout when response finishes
    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));

    next();
  };
}

/**
 * Create request ID middleware for correlation
 */
function createRequestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Use existing request ID or generate new one
    const requestId = req.headers['x-request-id'] as string || 
                     generateRequestId();
    
    // Add to request and response headers
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    
    next();
  };
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get middleware configuration from environment
 * Based on Python environment variable patterns
 */
export function getMiddlewareConfigFromEnv(): MiddlewareConfig {
  return {
    cors: {
      origins: process.env.CORS_ORIGINS || '["*"]'
    },
    debug: {
      enabled: process.env.DEBUG_MODE?.toLowerCase() === 'true',
      verbose: process.env.VERBOSE?.toLowerCase() === 'true'
    },
    auth: {
      skipPaths: process.env.AUTH_SKIP_PATHS?.split(',') || ['/health', '/v1/models']
    },
    validation: {
      enableDebugInfo: process.env.DEBUG_MODE?.toLowerCase() === 'true',
      includeRawBody: process.env.VERBOSE?.toLowerCase() === 'true'
    },
    timeout: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000') || 30000 // 30 second default, fallback for NaN
  };
}

/**
 * Validate middleware configuration
 */
export function validateMiddlewareConfig(config: MiddlewareConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate CORS origins
  if (config.cors?.origins) {
    try {
      JSON.parse(config.cors.origins);
    } catch {
      errors.push('Invalid CORS origins format - must be valid JSON');
    }
  }

  // Validate timeout
  if (config.timeout && (config.timeout < 1000 || config.timeout > 300000)) {
    warnings.push('Request timeout should be between 1s and 5min for best results');
  }

  // Validate auth skip paths
  if (config.auth?.skipPaths) {
    config.auth.skipPaths.forEach(path => {
      if (!path.startsWith('/')) {
        errors.push(`Auth skip path '${path}' must start with '/'`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Middleware health check
 */
export function getMiddlewareHealth(): {
  cors: boolean;
  debug: boolean;
  auth: boolean;
  validation: boolean;
  error_handling: boolean;
} {
  return {
    cors: true, // CORS is always available
    debug: process.env.DEBUG_MODE?.toLowerCase() === 'true',
    auth: true, // Auth middleware is always configured
    validation: true, // Validation is always available
    error_handling: true // Error handling is always configured
  };
}

// Re-export middleware components for direct use
export {
  createCorsMiddleware,
  createDebugMiddlewareFromEnv,
  authMiddleware,
  authStatusMiddleware,
  createValidationMiddlewareStack,
  errorHandler,
  notFoundHandler,
  timeoutHandler
};

// Re-export error types and utilities
export {
  ApiError,
  ValidationError,
  ErrorType,
  createValidationError,
  createAuthError,
  createPermissionError,
  createRateLimitError,
  asyncErrorWrapper
} from './error';