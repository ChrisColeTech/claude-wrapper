/**
 * Tool call error response formatting service
 * Single Responsibility: Error response formatting only
 * 
 * Formats tool call errors into OpenAI-compatible error responses
 * with proper HTTP status codes and structured error details
 */

import { ToolCallError, ToolCallErrorResponse, ErrorResponse, getErrorStatusCode } from '../models/error';
import { OpenAIToolCall } from './types';
import { TOOL_ERROR_LIMITS } from './constants';

/**
 * Error formatting request
 */
export interface ErrorFormattingRequest {
  error: ToolCallError;
  toolCall?: OpenAIToolCall;
  requestId?: string;
  includeContext?: boolean;
}

/**
 * Error formatting result
 */
export interface ErrorFormattingResult {
  success: boolean;
  errorResponse?: ToolCallErrorResponse;
  httpStatusCode: number;
  formattingTimeMs: number;
}

/**
 * Error formatting options
 */
export interface ErrorFormattingOptions {
  includeStackTrace?: boolean;
  includeContext?: boolean;
  maxMessageLength?: number;
  sanitizeContext?: boolean;
}

/**
 * Tool error formatter interface
 */
export interface IToolErrorFormatter {
  formatError(request: ErrorFormattingRequest, options?: ErrorFormattingOptions): ErrorFormattingResult;
  formatValidationError(message: string, param?: string, toolCall?: OpenAIToolCall): ToolCallErrorResponse;
  formatTimeoutError(message: string, toolCall?: OpenAIToolCall): ToolCallErrorResponse;
  formatProcessingError(message: string, toolCall?: OpenAIToolCall): ToolCallErrorResponse;
  getHttpStatusCode(errorType: string): number;
}

/**
 * Tool error formatter implementation
 */
export class ToolErrorFormatter implements IToolErrorFormatter {
  /**
   * Format tool call error into OpenAI-compatible response
   */
  formatError(
    request: ErrorFormattingRequest, 
    options: ErrorFormattingOptions = {}
  ): ErrorFormattingResult {
    const startTime = Date.now();

    try {
      const opts = { ...this.getDefaultOptions(), ...options };
      const { error, toolCall } = request;

      // Build error response
      const errorResponse: ToolCallErrorResponse = {
        error: {
          message: this.formatMessage(error.message, opts.maxMessageLength),
          type: this.mapToOpenAIType(error.type),
          code: error.code,
          toolCallId: error.id || toolCall?.id,
          functionName: this.extractFunctionName(error, toolCall),
          errorContext: opts.includeContext ? this.formatContext(error.context, opts.sanitizeContext) : undefined
        }
      };

      // Add param if available
      if (toolCall?.function?.name) {
        errorResponse.error.param = `tools[].function.name`;
      }

      const httpStatusCode = this.getHttpStatusCode(errorResponse.error.type);
      const formattingTime = Date.now() - startTime;

      return {
        success: true,
        errorResponse,
        httpStatusCode,
        formattingTimeMs: formattingTime
      };

    } catch (formattingError) {
      const formattingTime = Date.now() - startTime;
      
      return {
        success: false,
        httpStatusCode: 500,
        formattingTimeMs: formattingTime
      };
    }
  }

  /**
   * Format validation error
   */
  formatValidationError(message: string, param?: string, toolCall?: OpenAIToolCall): ToolCallErrorResponse {
    return {
      error: {
        message: this.formatMessage(message),
        type: 'invalid_request_error',
        code: 'tool_validation_failed',
        param,
        toolCallId: toolCall?.id,
        functionName: toolCall?.function?.name
      }
    };
  }

  /**
   * Format timeout error
   */
  formatTimeoutError(message: string, toolCall?: OpenAIToolCall): ToolCallErrorResponse {
    return {
      error: {
        message: this.formatMessage(message),
        type: 'timeout_error',
        code: 'tool_timeout_exceeded',
        toolCallId: toolCall?.id,
        functionName: toolCall?.function?.name
      }
    };
  }

  /**
   * Format processing error
   */
  formatProcessingError(message: string, toolCall?: OpenAIToolCall): ToolCallErrorResponse {
    return {
      error: {
        message: this.formatMessage(message),
        type: 'tool_error',
        code: 'tool_processing_failed',
        toolCallId: toolCall?.id,
        functionName: toolCall?.function?.name
      }
    };
  }

  /**
   * Get HTTP status code for error type
   */
  getHttpStatusCode(errorType: string): number {
    const statusCodeMap: Record<string, number> = {
      'invalid_request_error': 422,
      'timeout_error': 408,
      'tool_error': 422,
      'tool_execution_error': 422,
      'server_error': 500,
      'authentication_error': 401,
      'authorization_error': 403,
      'rate_limit_error': 429
    };

    return statusCodeMap[errorType] || 500;
  }

  /**
   * Map internal error type to OpenAI error type
   */
  private mapToOpenAIType(errorType: string): string {
    const typeMap: Record<string, string> = {
      'validation': 'invalid_request_error',
      'timeout': 'timeout_error',
      'processing': 'tool_error',
      'format': 'invalid_request_error',
      'execution': 'tool_execution_error',
      'system': 'server_error'
    };

    return typeMap[errorType] || 'tool_error';
  }

  /**
   * Format error message with length limits
   */
  private formatMessage(message: string, maxLength?: number): string {
    const limit = maxLength || TOOL_ERROR_LIMITS.MAX_ERROR_MESSAGE_LENGTH;
    
    if (message.length <= limit) {
      return message;
    }

    return message.substring(0, limit - 3) + '...';
  }

  /**
   * Extract function name from error or tool call
   */
  private extractFunctionName(error: ToolCallError, toolCall?: OpenAIToolCall): string | undefined {
    // Try error context first
    if (error.context?.functionName) {
      return error.context.functionName as string;
    }

    // Fallback to tool call
    return toolCall?.function?.name;
  }

  /**
   * Format error context for response
   */
  private formatContext(context?: Record<string, any>, sanitize: boolean = true): Record<string, any> | undefined {
    if (!context || Object.keys(context).length === 0) {
      return undefined;
    }

    if (!sanitize) {
      return context;
    }

    // Sanitize context
    const sanitized: Record<string, any> = {};
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth'];

    for (const [key, value] of Object.entries(context)) {
      // Skip sensitive keys
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        continue;
      }

      // Limit value size
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      if (stringValue.length > 100) {
        sanitized[key] = stringValue.substring(0, 97) + '...';
      } else {
        sanitized[key] = value;
      }
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  /**
   * Get default formatting options
   */
  private getDefaultOptions(): ErrorFormattingOptions {
    return {
      includeStackTrace: false,
      includeContext: true,
      maxMessageLength: TOOL_ERROR_LIMITS.MAX_ERROR_MESSAGE_LENGTH,
      sanitizeContext: true
    };
  }
}

/**
 * Error formatting utilities
 */
export const ErrorFormattingUtils = {
  /**
   * Quick format for common validation errors
   */
  quickValidationError: (message: string, param?: string): ErrorResponse => ({
    error: {
      message,
      type: 'invalid_request_error',
      code: 'tool_validation_failed',
      param
    }
  }),

  /**
   * Quick format for timeout errors
   */
  quickTimeoutError: (message: string): ErrorResponse => ({
    error: {
      message,
      type: 'timeout_error',
      code: 'tool_timeout_exceeded'
    }
  }),

  /**
   * Quick format for processing errors
   */
  quickProcessingError: (message: string): ErrorResponse => ({
    error: {
      message,
      type: 'tool_error',
      code: 'tool_processing_failed'
    }
  }),

  /**
   * Check if response is formatted error
   */
  isFormattedError: (response: any): response is ToolCallErrorResponse => {
    return !!(response && 
             response.error && 
             typeof response.error.message === 'string' &&
             typeof response.error.type === 'string');
  },

  /**
   * Extract error information from formatted response
   */
  extractErrorInfo: (response: ToolCallErrorResponse): {
    message: string;
    type: string;
    code?: string;
    toolCallId?: string;
    functionName?: string;
  } => ({
    message: response.error.message,
    type: response.error.type,
    code: response.error.code,
    toolCallId: response.error.toolCallId,
    functionName: response.error.functionName
  }),

  /**
   * Validate error response format
   */
  validateErrorFormat: (response: any): boolean => {
    try {
      return !!(response &&
               response.error &&
               typeof response.error.message === 'string' &&
               typeof response.error.type === 'string' &&
               response.error.message.length > 0 &&
               response.error.type.length > 0);
    } catch {
      return false;
    }
  }
};

export const toolErrorFormatter = new ToolErrorFormatter();