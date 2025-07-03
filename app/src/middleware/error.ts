/**
 * Error handling middleware
 * Based on Python main.py:820-832 exception handlers
 * 
 * Single Responsibility: Global error handling with OpenAI-compatible responses
 */

import { Request, Response, NextFunction } from 'express';
import { getLogger } from '../utils/logger';
import { ValidationResult } from '../validation/validator';

const logger = getLogger('ErrorMiddleware');

/**
 * OpenAI-compatible error response structure
 * Based on Python exception handler format
 */
export interface ErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
    param?: string;
    details?: any;
  };
}

/**
 * Error types matching Python error classification
 */
export enum ErrorType {
  API_ERROR = 'api_error',
  AUTHENTICATION_ERROR = 'authentication_error', 
  PERMISSION_ERROR = 'permission_error',
  INVALID_REQUEST_ERROR = 'invalid_request_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  INTERNAL_ERROR = 'internal_error',
  VALIDATION_ERROR = 'validation_error'
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public errorType: ErrorType = ErrorType.API_ERROR,
    public code?: string,
    public param?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends ApiError {
  constructor(
    message: string,
    public validationResult: ValidationResult,
    param?: string
  ) {
    super(message, 422, ErrorType.VALIDATION_ERROR, 'validation_failed', param, {
      errors: validationResult.errors,
      warnings: validationResult.warnings
    });
    this.name = 'ValidationError';
  }
}

/**
 * Global error handler middleware
 * Based on Python HTTP exception handler behavior
 */
export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
  // Skip if response already sent
  if (res.headersSent) {
    return next(error);
  }

  const requestId = Array.isArray(req.headers['x-request-id']) 
    ? req.headers['x-request-id'][0] 
    : req.headers['x-request-id'] || 'unknown';
  
  try {
    if (error instanceof ApiError) {
      handleApiError(error, req, res, requestId);
    } else if (error instanceof SyntaxError && 'body' in error) {
      handleJsonParseError(error, req, res, requestId);
    } else {
      handleGenericError(error, req, res, requestId);
    }
  } catch (handlerError) {
    // Fallback if error handler itself fails
    logger.error(`Error handler failed: ${handlerError}`);
    try {
      res.status(500).json({
        error: {
          message: 'Internal server error',
          type: ErrorType.INTERNAL_ERROR,
          code: 'handler_error'
        }
      });
    } catch (finalError) {
      logger.error(`Final error handler failed: ${finalError}`);
      res.status(500).end('Internal server error');
    }
  }
}

/**
 * Handle API errors (known error types)
 * Based on Python APIError exception handling
 */
function handleApiError(error: ApiError, req: Request, res: Response, requestId: string): void {
  logger.error(`❌ [${requestId}] API Error: ${error.message}`, {
    type: error.errorType,
    code: error.code,
    statusCode: error.statusCode,
    param: error.param,
    path: req.path,
    method: req.method
  });

  const errorResponse: ErrorResponse = {
    error: {
      message: error.message,
      type: error.errorType,
      code: error.code,
      param: error.param,
      details: error.details
    }
  };

  // Remove undefined fields for cleaner response
  Object.keys(errorResponse.error).forEach(key => {
    if (errorResponse.error[key as keyof typeof errorResponse.error] === undefined) {
      delete errorResponse.error[key as keyof typeof errorResponse.error];
    }
  });

  try {
    res.status(error.statusCode).json(errorResponse);
  } catch (jsonError) {
    logger.error(`Failed to send error response: ${jsonError}`);
    // Fallback to plain text response
    res.status(500).end('Internal server error');
  }
}

/**
 * Handle JSON parse errors (malformed request body)
 * Based on Python request validation error handling
 */
function handleJsonParseError(error: SyntaxError, req: Request, res: Response, requestId: string): void {
  logger.error(`❌ [${requestId}] JSON Parse Error: ${error.message}`, {
    path: req.path,
    method: req.method,
    contentType: req.get('Content-Type')
  });

  const errorResponse: ErrorResponse = {
    error: {
      message: 'Invalid JSON in request body',
      type: ErrorType.INVALID_REQUEST_ERROR,
      code: 'json_parse_error',
      details: {
        parse_error: error.message,
        suggestion: 'Ensure request body contains valid JSON'
      }
    }
  };

  try {
    res.status(400).json(errorResponse);
  } catch (jsonError) {
    logger.error(`Failed to send JSON parse error response: ${jsonError}`);
    res.status(500).end('Internal server error');
  }
}

/**
 * Handle generic/unknown errors
 * Based on Python generic exception handling
 */
function handleGenericError(error: Error, req: Request, res: Response, requestId: string): void {
  // Log full error details for debugging
  logger.error(`💥 [${requestId}] Unhandled Error: ${error.message}`, {
    name: error.name,
    stack: error.stack,
    path: req.path,
    method: req.method
  });

  // Don't expose internal error details in production
  const isProduction = process.env.NODE_ENV === 'production';
  const debugMode = process.env.DEBUG_MODE?.toLowerCase() === 'true';

  const errorResponse: ErrorResponse = {
    error: {
      message: isProduction && !debugMode 
        ? 'Internal server error' 
        : error.message,
      type: ErrorType.INTERNAL_ERROR,
      code: 'internal_error'
    }
  };

  // Include debug details in development
  if (!isProduction || debugMode) {
    errorResponse.error.details = {
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 5) // Limit stack trace length
    };
  }

  try {
    res.status(500).json(errorResponse);
  } catch (jsonError) {
    logger.error(`Failed to send generic error response: ${jsonError}`);
    res.status(500).end('Internal server error');
  }
}

/**
 * Not found handler (404 errors)
 * Based on Python 404 handling
 */
export function notFoundHandler(req: Request, res: Response): void {
  const requestId = Array.isArray(req.headers['x-request-id']) 
    ? req.headers['x-request-id'][0] 
    : req.headers['x-request-id'] || 'unknown';
  
  logger.warn(`🔍 [${requestId}] Not Found: ${req.method} ${req.path}`);

  const errorResponse: ErrorResponse = {
    error: {
      message: `The requested endpoint ${req.method} ${req.path} was not found`,
      type: ErrorType.INVALID_REQUEST_ERROR,
      code: 'not_found',
      details: {
        available_endpoints: [
          'POST /v1/chat/completions',
          'GET /v1/models',
          'GET /health'
        ]
      }
    }
  };

  try {
    res.status(404).json(errorResponse);
  } catch (jsonError) {
    logger.error(`Failed to send 404 error response: ${jsonError}`);
    res.status(500).end('Internal server error');
  }
}

/**
 * Request timeout handler
 */
export function timeoutHandler(req: Request, res: Response): void {
  const requestId = Array.isArray(req.headers['x-request-id']) 
    ? req.headers['x-request-id'][0] 
    : req.headers['x-request-id'] || 'unknown';
  
  logger.error(`⏰ [${requestId}] Request Timeout: ${req.method} ${req.path}`);

  const errorResponse: ErrorResponse = {
    error: {
      message: 'Request timeout - the server took too long to respond',
      type: ErrorType.API_ERROR,
      code: 'timeout_error'
    }
  };

  try {
    res.status(408).json(errorResponse);
  } catch (jsonError) {
    logger.error(`Failed to send timeout error response: ${jsonError}`);
    res.status(500).end('Internal server error');
  }
}

/**
 * Validation error helper
 * Creates ValidationError from validation result
 */
export function createValidationError(
  validationResult: ValidationResult, 
  param?: string
): ValidationError {
  const message = validationResult.errors.length > 0 
    ? `Validation failed: ${validationResult.errors.join(', ')}`
    : 'Request validation failed';
    
  return new ValidationError(message, validationResult, param);
}

/**
 * Authentication error helper
 */
export function createAuthError(message: string, code?: string): ApiError {
  return new ApiError(
    message, 
    401, 
    ErrorType.AUTHENTICATION_ERROR, 
    code || 'auth_error'
  );
}

/**
 * Permission error helper
 */
export function createPermissionError(message: string, code?: string): ApiError {
  return new ApiError(
    message, 
    403, 
    ErrorType.PERMISSION_ERROR, 
    code || 'permission_error'
  );
}

/**
 * Rate limit error helper
 */
export function createRateLimitError(message: string, retryAfter?: number): ApiError {
  return new ApiError(
    message, 
    429, 
    ErrorType.RATE_LIMIT_ERROR, 
    'rate_limit_exceeded',
    undefined,
    { retry_after: retryAfter }
  );
}

/**
 * Async error wrapper for route handlers
 * Ensures async errors are properly caught
 */
export function asyncErrorWrapper(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any> | any
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = fn(req, res, next);
      if (result && typeof result.catch === 'function') {
        result.catch(next);
      }
    } catch (error) {
      next(error);
    }
  };
}