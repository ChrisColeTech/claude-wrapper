/**
 * Bearer token authentication middleware
 * Based on Python auth.py bearer token validation
 * 
 * Single Responsibility: Validate bearer tokens in HTTP requests
 */

import { Request, Response, NextFunction } from 'express';
import { IBearerTokenValidator } from './interfaces';
import { authManager } from './auth-manager';
import { secureCompare } from '../utils/crypto';
import { getLogger } from '../utils/logger';

const logger = getLogger('AuthMiddleware');

/**
 * Bearer token validator implementation
 */
export class BearerTokenValidator implements IBearerTokenValidator {
  /**
   * Validate bearer token from authorization header
   */
  validateToken(token: string): boolean {
    const expectedToken = authManager.getApiKey();
    
    if (!expectedToken) {
      logger.debug('No API key configured - allowing request');
      return true; // No protection enabled
    }

    if (!token) {
      logger.debug('No token provided but API key protection enabled');
      return false;
    }

    const isValid = secureCompare(token, expectedToken);
    
    if (isValid) {
      logger.debug('Bearer token validation successful');
    } else {
      logger.warn('Bearer token validation failed');
    }

    return isValid;
  }

  /**
   * Extract token from authorization header
   */
  extractToken(authHeader: string): string | null {
    if (!authHeader || typeof authHeader !== 'string') {
      return null;
    }

    // Check for Bearer token format
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch) {
      return bearerMatch[1];
    }

    logger.debug(`Invalid authorization header format: ${authHeader.substring(0, 20)}...`);
    return null;
  }
}

/**
 * Global bearer token validator instance
 */
export const bearerTokenValidator = new BearerTokenValidator();

/**
 * Express middleware for bearer token authentication
 * Based on Python check_auth() function
 */
export function authMiddleware(options: {
  skipPaths?: string[];
  validator?: IBearerTokenValidator;
} = {}) {
  const { 
    skipPaths = ['/health', '/v1/models'], 
    validator = bearerTokenValidator 
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Skip authentication for certain paths
      if (skipPaths.some(path => req.path === path || req.path.startsWith(path))) {
        logger.debug(`Skipping auth for path: ${req.path}`);
        return next();
      }

      // Check if API key protection is enabled
      if (!authManager.isProtected()) {
        logger.debug('API key protection disabled - allowing request');
        return next();
      }

      // Extract authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        logger.warn(`Unauthorized request to ${req.path} - no authorization header`);
        res.status(401).json({
          error: {
            message: 'Authorization header required',
            type: 'authentication_error',
            code: 'missing_authorization'
          }
        });
        return;
      }

      // Extract bearer token
      const token = validator.extractToken(authHeader);
      if (!token) {
        logger.warn(`Unauthorized request to ${req.path} - invalid authorization format`);
        res.status(401).json({
          error: {
            message: 'Invalid authorization header format. Expected: Bearer <token>',
            type: 'authentication_error',
            code: 'invalid_authorization_format'
          }
        });
        return;
      }

      // Validate token
      const isValid = validator.validateToken(token);
      if (!isValid) {
        logger.warn(`Unauthorized request to ${req.path} - invalid token`);
        res.status(401).json({
          error: {
            message: 'Invalid or expired API key',
            type: 'authentication_error',
            code: 'invalid_api_key'
          }
        });
        return;
      }

      // Token is valid - continue to next middleware
      logger.debug(`Authorized request to ${req.path}`);
      next();

    } catch (error) {
      logger.error(`Authentication middleware error: ${error}`);
      res.status(500).json({
        error: {
          message: 'Internal authentication error',
          type: 'authentication_error',
          code: 'internal_error'
        }
      });
    }
  };
}

/**
 * Middleware to check authentication status and add to response headers
 */
export function authStatusMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const isProtected = authManager.isProtected();
    const currentMethod = authManager.getCurrentMethod();

    // Add auth status to response headers (for debugging)
    res.setHeader('X-Auth-Protected', isProtected ? 'true' : 'false');
    if (currentMethod) {
      res.setHeader('X-Auth-Method', currentMethod);
    }

    next();
  } catch (error) {
    logger.error(`Auth status middleware error: ${error}`);
    next(); // Continue even if status check fails
  }
}

/**
 * Health check for authentication system
 */
export async function getAuthHealthStatus(): Promise<{
  protected: boolean;
  method: string | null;
  provider_status: Record<string, boolean>;
}> {
  try {
    const authStatus = await authManager.getAuthStatus();
    const providers = authManager.getProviders();
    
    const providerStatus: Record<string, boolean> = {};
    for (const provider of providers) {
      try {
        const result = await provider.validate();
        providerStatus[provider.getMethod()] = result.valid;
      } catch (error) {
        providerStatus[provider.getMethod()] = false;
      }
    }

    return {
      protected: authManager.isProtected(),
      method: authStatus.method,
      provider_status: providerStatus
    };
  } catch (error) {
    logger.error(`Auth health check error: ${error}`);
    return {
      protected: false,
      method: null,
      provider_status: {}
    };
  }
}
