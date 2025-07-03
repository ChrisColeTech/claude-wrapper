/**
 * Error Response Models for OpenAI Chat Completions API
 * Based on Python models.py:146-154 (ErrorDetail, ErrorResponse)
 * Provides complete OpenAI-compatible error structure with Zod validation
 */

import { z } from 'zod';

/**
 * Claude Client Error Classes
 * For SDK integration error handling
 */
export class ClaudeClientError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ClaudeClientError';
  }
}

export class AuthenticationError extends ClaudeClientError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_FAILED');
  }
}

export class StreamingError extends ClaudeClientError {
  constructor(message: string) {
    super(message, 'STREAMING_FAILED');
  }
}

/**
 * Error detail schema
 * Based on Python ErrorDetail class
 */
export const ErrorDetailSchema = z.object({
  message: z.string(),
  type: z.string(),
  param: z.string().optional(),
  code: z.string().optional()
});

export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;

/**
 * Error response schema
 * Based on Python ErrorResponse class
 */
export const ErrorResponseSchema = z.object({
  error: ErrorDetailSchema
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Common error types for OpenAI API compatibility
 */
export const ErrorTypes = {
  // Authentication errors
  AUTHENTICATION_ERROR: 'authentication_error',
  AUTHORIZATION_ERROR: 'authorization_error',
  INVALID_API_KEY: 'invalid_api_key',
  
  // Request errors
  INVALID_REQUEST: 'invalid_request_error',
  MISSING_PARAMETER: 'missing_parameter',
  INVALID_PARAMETER: 'invalid_parameter',
  
  // Rate limiting
  RATE_LIMIT_ERROR: 'rate_limit_exceeded',
  
  // Server errors
  SERVER_ERROR: 'server_error',
  ENGINE_OVERLOADED: 'engine_overloaded',
  
  // Claude Code specific
  SDK_ERROR: 'sdk_error',
  STREAMING_ERROR: 'streaming_error',
  TOOL_ERROR: 'tool_error'
} as const;

/**
 * Error codes for detailed error identification
 */
export const ErrorCodes = {
  // Authentication
  MISSING_AUTHORIZATION: 'missing_authorization',
  INVALID_BEARER_TOKEN: 'invalid_bearer_token',
  INVALID_API_KEY: 'invalid_api_key',
  
  // Request validation
  MISSING_REQUIRED_PARAMETER: 'missing_required_parameter',
  INVALID_PARAMETER_VALUE: 'invalid_parameter_value',
  UNSUPPORTED_PARAMETER: 'unsupported_parameter',
  
  // Model errors
  MODEL_NOT_FOUND: 'model_not_found',
  MODEL_OVERLOADED: 'model_overloaded',
  
  // Claude Code specific
  SDK_NOT_AVAILABLE: 'sdk_not_available',
  SDK_AUTHENTICATION_FAILED: 'sdk_authentication_failed',
  STREAMING_FAILED: 'streaming_failed',
  TOOL_EXECUTION_FAILED: 'tool_execution_failed'
} as const;

/**
 * Error response utilities
 */
export const ErrorUtils = {
  /**
   * Create authentication error
   */
  authentication: (message: string, code?: string): ErrorResponse => ({
    error: {
      message,
      type: ErrorTypes.AUTHENTICATION_ERROR,
      code: code || ErrorCodes.MISSING_AUTHORIZATION
    }
  }),

  /**
   * Create invalid request error
   */
  invalidRequest: (message: string, param?: string, code?: string): ErrorResponse => ({
    error: {
      message,
      type: ErrorTypes.INVALID_REQUEST,
      param,
      code: code || ErrorCodes.INVALID_PARAMETER_VALUE
    }
  }),

  /**
   * Create missing parameter error
   */
  missingParameter: (param: string): ErrorResponse => ({
    error: {
      message: `Missing required parameter: ${param}`,
      type: ErrorTypes.MISSING_PARAMETER,
      param,
      code: ErrorCodes.MISSING_REQUIRED_PARAMETER
    }
  }),

  /**
   * Create server error
   */
  serverError: (message: string): ErrorResponse => ({
    error: {
      message,
      type: ErrorTypes.SERVER_ERROR
    }
  }),

  /**
   * Create Claude SDK error
   */
  sdkError: (message: string, code?: string): ErrorResponse => ({
    error: {
      message,
      type: ErrorTypes.SDK_ERROR,
      code: code || ErrorCodes.SDK_NOT_AVAILABLE
    }
  }),

  /**
   * Create streaming error
   */
  streamingError: (message: string): ErrorResponse => ({
    error: {
      message,
      type: ErrorTypes.STREAMING_ERROR,
      code: ErrorCodes.STREAMING_FAILED
    }
  }),

  /**
   * Create rate limit error
   */
  rateLimitError: (message: string = "Rate limit exceeded"): ErrorResponse => ({
    error: {
      message,
      type: ErrorTypes.RATE_LIMIT_ERROR
    }
  }),

  /**
   * Create model not found error
   */
  modelNotFound: (model: string): ErrorResponse => ({
    error: {
      message: `Model ${model} not found`,
      type: ErrorTypes.INVALID_REQUEST,
      code: ErrorCodes.MODEL_NOT_FOUND
    }
  }),

  /**
   * Create unsupported parameter warning
   */
  unsupportedParameter: (param: string, value: any): ErrorResponse => ({
    error: {
      message: `Parameter '${param}' with value '${value}' is not supported by Claude Code SDK and will be ignored`,
      type: ErrorTypes.INVALID_REQUEST,
      param,
      code: ErrorCodes.UNSUPPORTED_PARAMETER
    }
  }),

  /**
   * Convert generic error to ErrorResponse
   */
  fromError: (error: Error | unknown): ErrorResponse => {
    const message = error instanceof Error ? error.message : String(error);
    
    // Detect error type from message
    if (message.toLowerCase().includes('authentication') || message.toLowerCase().includes('api key')) {
      return ErrorUtils.authentication(message);
    }
    
    if (message.toLowerCase().includes('stream')) {
      return ErrorUtils.streamingError(message);
    }
    
    if (message.toLowerCase().includes('sdk') || message.toLowerCase().includes('claude code')) {
      return ErrorUtils.sdkError(message);
    }
    
    return ErrorUtils.serverError(message);
  },

  /**
   * Validate error response
   */
  validate: (error: unknown): ErrorResponse => {
    return ErrorResponseSchema.parse(error);
  },

  /**
   * Check if response is an error
   */
  isErrorResponse: (response: any): response is ErrorResponse => {
    try {
      ErrorResponseSchema.parse(response);
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * HTTP status codes for different error types
 */
export const ErrorStatusCodes = {
  [ErrorTypes.AUTHENTICATION_ERROR]: 401,
  [ErrorTypes.AUTHORIZATION_ERROR]: 403,
  [ErrorTypes.INVALID_API_KEY]: 401,
  [ErrorTypes.INVALID_REQUEST]: 400,
  [ErrorTypes.MISSING_PARAMETER]: 400,
  [ErrorTypes.INVALID_PARAMETER]: 400,
  [ErrorTypes.RATE_LIMIT_ERROR]: 429,
  [ErrorTypes.SERVER_ERROR]: 500,
  [ErrorTypes.ENGINE_OVERLOADED]: 503,
  [ErrorTypes.SDK_ERROR]: 500,
  [ErrorTypes.STREAMING_ERROR]: 500,
  [ErrorTypes.TOOL_ERROR]: 500
} as const;

/**
 * Get HTTP status code for error type
 */
export function getErrorStatusCode(errorType: string): number {
  return ErrorStatusCodes[errorType as keyof typeof ErrorStatusCodes] || 500;
}
