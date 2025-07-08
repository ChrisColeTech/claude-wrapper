/**
 * HTTP API Protection Middleware
 * Simple bearer token authentication for HTTP endpoints
 * 
 * Single Responsibility: Protect HTTP API endpoints with optional bearer token authentication
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

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
 * Simple bearer token validator implementation
 */
export class BearerTokenValidator implements IBearerTokenValidator {
  private expectedToken: string | undefined;

  constructor(expectedToken?: string) {
    this.expectedToken = expectedToken;
  }

  /**
   * Validate bearer token against expected token
   */
  validateToken(token: string): boolean {
    if (!this.expectedToken) {
      // No token protection configured
      return true;
    }

    // Constant-time comparison to prevent timing attacks
    if (token.length !== this.expectedToken.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < token.length; i++) {
      result |= token.charCodeAt(i) ^ this.expectedToken.charCodeAt(i);
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
  apiKey?: string;
}

/**
 * Create HTTP API protection middleware
 * Only protects endpoints when API key is configured
 */
export function createAuthMiddleware(
  options: AuthMiddlewareOptions = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const { skipPaths = [], apiKey } = options;
  const validator = new BearerTokenValidator(apiKey);

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Skip authentication for specified paths
      if (skipPaths.some(path => req.path.startsWith(path))) {
        logger.debug(`Skipping authentication for path: ${req.path}`);
        return next();
      }

      // Check if API key protection is enabled
      const isProtected = !!apiKey;
      
      if (!isProtected) {
        // No protection enabled
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

/**
 * Get API key from environment or runtime
 */
export function getApiKey(): string | undefined {
  return process.env['API_KEY'];
}

/**
 * Check if API key protection is enabled
 */
export function isApiKeyProtectionEnabled(): boolean {
  return getApiKey() !== undefined;
}