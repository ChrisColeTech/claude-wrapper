/**
 * Enhanced Error Handling Middleware
 * Comprehensive error handling with classification, validation, and correlation
 * 
 * Single Responsibility: Global error handling with OpenAI-compatible responses
 * Integrates with Phase 4A error handling components
 */

import { Request, Response, NextFunction } from 'express';
import { getLogger } from '../utils/logger';
import { ValidationResult } from '../validation/validator';
import { 
  errorClassifier, 
  ErrorClassification,
  ErrorCategory,
  ErrorSeverity 
} from './error-classifier';
import { 
  validationHandler, 
  ValidationErrorReport 
} from './validation-handler';
import { 
  ErrorResponseFactory,
  EnhancedErrorResponse,
  ValidationErrorResponse 
} from '../models/error-responses';
import { markRequestError } from './request-id';

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
 * Enhanced global error handler middleware
 * Integrates with comprehensive error classification and response generation
 */
export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
  // Skip if response already sent
  if (res.headersSent) {
    return next(error);
  }

  const requestId = req.requestId || 
    (Array.isArray(req.headers['x-request-id']) 
      ? req.headers['x-request-id'][0] 
      : req.headers['x-request-id']) || 'unknown';
  
  try {
    // Mark error in request tracking
    if (requestId !== 'unknown') {
      markRequestError(requestId, error);
    }

    // Use comprehensive error classification
    const classification = errorClassifier.classifyError(error, {
      requestId,
      endpoint: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      timestamp: new Date()
    });

    // Handle different error types with enhanced responses
    if (error instanceof ValidationError) {
      handleValidationErrorEnhanced(error, req, res, requestId, classification);
    } else if (error instanceof ApiError) {
      handleApiErrorEnhanced(error, req, res, requestId, classification);
    } else if (error instanceof SyntaxError && 'body' in error) {
      handleJsonParseErrorEnhanced(error, req, res, requestId, classification);
    } else {
      handleGenericErrorEnhanced(error, req, res, requestId, classification);
    }
  } catch (handlerError) {
    // Fallback if error handler itself fails
    logger.error(`Error handler failed: ${handlerError}`);
    handleFallbackError(res, requestId);
  }
}

/**
 * Handle validation errors with enhanced reporting
 */
function handleValidationErrorEnhanced(
  error: ValidationError, 
  req: Request, 
  res: Response, 
  requestId: string,
  classification: ErrorClassification
): void {
  logger.error(`❌ [${requestId}] Validation Error: ${error.message}`, {
    errorCount: error.validationResult.errors.length,
    warnings: error.validationResult.warnings.length,
    path: req.path,
    method: req.method
  });

  // Convert validation result to enhanced validation report
  const enhancedReport: ValidationErrorReport = {
    isValid: false,
    errors: error.validationResult.errors.map((err, index) => ({
      field: error.param || `field_${index}`,
      path: error.param || `field_${index}`,
      value: null,
      message: err,
      code: 'VALIDATION_FAILED',
      suggestion: `Please correct the ${error.param || 'field'} value`
    })),
    errorCount: error.validationResult.errors.length,
    classification,
    context: {
      requestId,
      endpoint: req.path,
      method: req.method,
      timestamp: new Date(),
      userAgent: req.get('User-Agent')
    },
    suggestions: error.validationResult.warnings.length > 0 
      ? [`Review warnings: ${error.validationResult.warnings.join(', ')}`]
      : ['Check request parameters and try again'],
    processingTime: 0
  };

  const errorResponse = ErrorResponseFactory.createValidationErrorResponse(enhancedReport, requestId);
  
  try {
    res.status(classification.httpStatusCode).json(errorResponse);
  } catch (jsonError) {
    logger.error(`Failed to send validation error response: ${jsonError}`);
    handleFallbackError(res, requestId);
  }
}

/**
 * Handle API errors with enhanced classification
 */
function handleApiErrorEnhanced(
  error: ApiError, 
  req: Request, 
  res: Response, 
  requestId: string,
  classification: ErrorClassification
): void {
  logger.error(`❌ [${requestId}] API Error: ${error.message}`, {
    type: error.errorType,
    code: error.code,
    statusCode: error.statusCode,
    severity: classification.severity,
    path: req.path,
    method: req.method
  });

  const errorResponse = ErrorResponseFactory.createFromClassification(error, classification, requestId);
  
  // Add request metadata if available
  if (req.requestMetadata) {
    ErrorResponseFactory.addRequestMetadata(errorResponse, req.requestMetadata);
  }

  try {
    res.status(classification.httpStatusCode).json(errorResponse);
  } catch (jsonError) {
    logger.error(`Failed to send API error response: ${jsonError}`);
    handleFallbackError(res, requestId);
  }
}

/**
 * Handle JSON parse errors with enhanced classification
 */
function handleJsonParseErrorEnhanced(
  error: SyntaxError, 
  req: Request, 
  res: Response, 
  requestId: string,
  classification: ErrorClassification
): void {
  logger.error(`❌ [${requestId}] JSON Parse Error: ${error.message}`, {
    path: req.path,
    method: req.method,
    contentType: req.get('Content-Type'),
    severity: classification.severity
  });

  const errorResponse = ErrorResponseFactory.createFromClassification(error, classification, requestId);
  
  // Enhance with specific JSON parsing guidance
  if (errorResponse.error.details) {
    errorResponse.error.details.suggestions = [
      'Ensure request body contains valid JSON',
      'Check for trailing commas, unquoted keys, or unclosed brackets',
      'Validate JSON format using a JSON validator',
      `Parse error: ${error.message}`
    ];
  }

  try {
    res.status(classification.httpStatusCode).json(errorResponse);
  } catch (jsonError) {
    logger.error(`Failed to send JSON parse error response: ${jsonError}`);
    handleFallbackError(res, requestId);
  }
}

/**
 * Handle generic/unknown errors with enhanced classification
 */
function handleGenericErrorEnhanced(
  error: Error, 
  req: Request, 
  res: Response, 
  requestId: string,
  classification: ErrorClassification
): void {
  logger.error(`💥 [${requestId}] Unhandled Error: ${error.message}`, {
    name: error.name,
    category: classification.category,
    severity: classification.severity,
    retryable: classification.isRetryable,
    path: req.path,
    method: req.method
  });

  const errorResponse = ErrorResponseFactory.createFromClassification(error, classification, requestId);
  
  // Add request metadata if available
  if (req.requestMetadata) {
    ErrorResponseFactory.addRequestMetadata(errorResponse, req.requestMetadata);
  }

  try {
    res.status(classification.httpStatusCode).json(errorResponse);
  } catch (jsonError) {
    logger.error(`Failed to send generic error response: ${jsonError}`);
    handleFallbackError(res, requestId);
  }
}

/**
 * Fallback error handler when all else fails
 */
function handleFallbackError(res: Response, requestId: string): void {
  try {
    const fallbackResponse = ErrorResponseFactory.createMinimalErrorResponse(
      'api_error',
      'Internal server error',
      'HANDLER_ERROR',
      requestId
    );
    res.status(500).json(fallbackResponse);
  } catch (finalError) {
    logger.error(`Final fallback error handler failed: ${finalError}`);
    res.status(500).end('Internal server error');
  }
}

/**
 * Enhanced not found handler (404 errors)
 */
export function notFoundHandler(req: Request, res: Response): void {
  const requestId = req.requestId || 
    (Array.isArray(req.headers['x-request-id']) 
      ? req.headers['x-request-id'][0] 
      : req.headers['x-request-id']) || 'unknown';
  
  logger.warn(`🔍 [${requestId}] Not Found: ${req.method} ${req.path}`);

  const notFoundError = new Error(`The requested endpoint ${req.method} ${req.path} was not found`);
  const classification = errorClassifier.classifyError(notFoundError, {
    requestId,
    endpoint: req.path,
    method: req.method
  });

  // Override classification for 404 errors
  classification.httpStatusCode = 404;
  classification.errorCode = 'NOT_FOUND';
  classification.category = ErrorCategory.CLIENT_ERROR;

  const errorResponse = ErrorResponseFactory.createFromClassification(
    notFoundError, 
    classification, 
    requestId
  );

  // Add helpful endpoint suggestions
  if (errorResponse.error.details) {
    errorResponse.error.details.suggestions = [
      'Check the URL path and HTTP method',
      'Refer to API documentation for available endpoints',
      'Ensure you are using the correct base URL',
      'Available endpoints: POST /v1/chat/completions, GET /v1/models, GET /health'
    ];
  }

  try {
    res.status(404).json(errorResponse);
  } catch (jsonError) {
    logger.error(`Failed to send 404 error response: ${jsonError}`);
    handleFallbackError(res, requestId);
  }
}

/**
 * Enhanced request timeout handler
 */
export function timeoutHandler(req: Request, res: Response): void {
  const requestId = req.requestId || 
    (Array.isArray(req.headers['x-request-id']) 
      ? req.headers['x-request-id'][0] 
      : req.headers['x-request-id']) || 'unknown';
  
  logger.error(`⏰ [${requestId}] Request Timeout: ${req.method} ${req.path}`);

  const timeoutError = new Error('Request timeout - the server took too long to respond');
  const classification = errorClassifier.classifyError(timeoutError, {
    requestId,
    endpoint: req.path,
    method: req.method
  });

  // Override classification for timeout errors
  classification.httpStatusCode = 408;
  classification.errorCode = 'REQUEST_TIMEOUT';
  classification.category = ErrorCategory.NETWORK_ERROR;
  classification.isRetryable = true;

  const errorResponse = ErrorResponseFactory.createFromClassification(
    timeoutError, 
    classification, 
    requestId
  );

  // Add request metadata if available
  if (req.requestMetadata) {
    ErrorResponseFactory.addRequestMetadata(errorResponse, req.requestMetadata);
  }

  try {
    res.status(408).json(errorResponse);
  } catch (jsonError) {
    logger.error(`Failed to send timeout error response: ${jsonError}`);
    handleFallbackError(res, requestId);
  }
}

/**
 * Enhanced validation error helper
 * Creates ValidationError from validation result with classification
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
 * Enhanced authentication error helper
 */
export function createAuthError(message: string, code?: string): ApiError {
  return new ApiError(
    message, 
    401, 
    ErrorType.AUTHENTICATION_ERROR, 
    code || 'AUTHENTICATION_FAILED'
  );
}

/**
 * Enhanced permission error helper
 */
export function createPermissionError(message: string, code?: string): ApiError {
  return new ApiError(
    message, 
    403, 
    ErrorType.PERMISSION_ERROR, 
    code || 'PERMISSION_DENIED'
  );
}

/**
 * Enhanced rate limit error helper
 */
export function createRateLimitError(message: string, retryAfter?: number): ApiError {
  return new ApiError(
    message, 
    429, 
    ErrorType.RATE_LIMIT_ERROR, 
    'RATE_LIMIT_EXCEEDED',
    undefined,
    { retry_after: retryAfter }
  );
}

/**
 * Create enhanced validation error from ValidationErrorReport
 */
export function createEnhancedValidationError(
  report: ValidationErrorReport,
  requestId?: string
): ValidationErrorResponse {
  return ErrorResponseFactory.createValidationErrorResponse(report, requestId);
}

/**
 * Create error response with enhanced classification
 */
export function createClassifiedErrorResponse(
  error: Error,
  context?: Record<string, any>,
  requestId?: string
): EnhancedErrorResponse {
  const classification = errorClassifier.classifyError(error, context);
  return ErrorResponseFactory.createFromClassification(error, classification, requestId);
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