/**
 * Authentication middleware implementation
 * Based on claude-wrapper/app/src/middleware/auth.ts patterns
 * 
 * Single Responsibility: Bearer token authentication middleware
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AuthManager } from './manager';

/**
 * Authentication error types
 */
export enum AuthErrorType {
  MISSING_TOKEN = 'missing_token',
  INVALID_TOKEN = 'invalid_token',
  MALFORMED_HEADER = 'malformed_header'
}

/**
 * Authentication error class
 */
export class AuthenticationError extends Error {
  constructor(
    public type: AuthErrorType,
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Bearer token validator interface (ISP compliance)
 */
export interface IBearerTokenValidator {
  validateToken(token: string): boolean;
  extractToken(authHeader: string): string | null;
}

/**
 * Bearer token validator implementation
 */
export class BearerTokenValidator implements IBearerTokenValidator {
  private authManager: AuthManager;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
  }

  /**
   * Validate bearer token against configured API key
   */
  validateToken(token: string): boolean {
    const activeApiKey = this.authManager.getApiKey();
    
    if (!activeApiKey) {
      // No API key protection configured
      return true;
    }

    // Simple constant-time comparison to prevent timing attacks
    if (token.length !== activeApiKey.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < token.length; i++) {
      result |= token.charCodeAt(i) ^ activeApiKey.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Extract bearer token from Authorization header
   */
  extractToken(authHeader: string): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1] || null;
  }
}

/**
 * Authentication middleware options
 */
export interface AuthMiddlewareOptions {
  skipPaths?: string[];
  requireAuth?: boolean;
}

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(
  authManager: AuthManager,
  options: AuthMiddlewareOptions = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const validator = new BearerTokenValidator(authManager);
  const { skipPaths = [], requireAuth = false } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Skip authentication for specified paths
      if (skipPaths.some(path => req.path.startsWith(path))) {
        logger.debug(`Skipping authentication for path: ${req.path}`);
        return next();
      }

      // Check if API key protection is enabled
      const isProtected = authManager.isProtected();
      
      if (!isProtected && !requireAuth) {
        // No protection enabled and not required
        logger.debug('API key protection disabled, allowing request');
        return next();
      }

      // Get Authorization header
      const authHeader = req.get('Authorization');
      
      if (!authHeader) {
        logger.warn(`Missing Authorization header for protected path: ${req.path}`);
        throw new AuthenticationError(
          AuthErrorType.MISSING_TOKEN,
          'Missing Authorization header. Include "Authorization: Bearer <token>" in your request.',
          401
        );
      }

      // Extract bearer token
      const token = validator.extractToken(authHeader);
      
      if (!token) {
        logger.warn(`Malformed Authorization header for path: ${req.path}`);
        throw new AuthenticationError(
          AuthErrorType.MALFORMED_HEADER,
          'Malformed Authorization header. Use format "Authorization: Bearer <token>".',
          401
        );
      }

      // Validate token
      const isValid = validator.validateToken(token);
      
      if (!isValid) {
        logger.warn(`Invalid bearer token for path: ${req.path}`);
        throw new AuthenticationError(
          AuthErrorType.INVALID_TOKEN,
          'Invalid bearer token. Check your API key.',
          401
        );
      }

      // Token is valid, proceed
      logger.debug(`Authentication successful for path: ${req.path}`);
      next();

    } catch (error) {
      if (error instanceof AuthenticationError) {
        logger.error(`Authentication failed: ${error.message}`, error, {
          type: error.type,
          path: req.path,
          method: req.method
        });

        res.status(error.statusCode).json({
          error: {
            message: error.message,
            type: 'authentication_error',
            code: error.type
          }
        });
      } else {
        logger.error(`Unexpected authentication error: ${error}`, error instanceof Error ? error : undefined, {
          path: req.path,
          method: req.method
        });

        res.status(500).json({
          error: {
            message: 'Internal authentication error',
            type: 'internal_error',
            code: 'auth_processing_error'
          }
        });
      }
    }
  };
}

/**
 * Simple authentication middleware (default export for compatibility)
 */
export const authMiddleware = (_req: Request, _res: Response, next: NextFunction): void => {
  // This will be replaced by the proper middleware once AuthManager is available
  logger.debug('Using placeholder authentication middleware');
  next();
};

/**
 * Authentication status middleware - adds auth info to response headers
 */
export function authStatusMiddleware(authManager: AuthManager) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Add authentication status headers
      const isProtected = authManager.isProtected();
      const currentMethod = authManager.getCurrentMethod();

      res.setHeader('X-Auth-Protected', isProtected ? 'true' : 'false');
      if (currentMethod) {
        res.setHeader('X-Auth-Method', currentMethod);
      }

      logger.debug(`Auth status headers added`, {
        protected: isProtected,
        method: currentMethod,
        path: req.path
      });

      next();
    } catch (error) {
      logger.warn(`Failed to add auth status headers: ${error}`);
      // Don't fail the request, just proceed without headers
      next();
    }
  };
}

/**
 * Utility functions for authentication
 */
export class AuthUtils {
  /**
   * Generate secure API key for bearer token authentication
   */
  static generateSecureApiKey(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    
    // Use crypto.randomBytes for secure generation
    const crypto = require('crypto');
    const bytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    
    return result;
  }

  /**
   * Create safe hash for logging (first 8 characters + ...)
   */
  static createSafeHash(value: string): string {
    if (!value || value.length < 8) {
      return 'invalid';
    }
    return value.substring(0, 8) + '...';
  }

  /**
   * Validate API key format
   */
  static isValidApiKeyFormat(apiKey: string): boolean {
    // Must be at least 16 characters, alphanumeric plus - and _
    const pattern = /^[A-Za-z0-9_-]{16,}$/;
    return pattern.test(apiKey);
  }
}