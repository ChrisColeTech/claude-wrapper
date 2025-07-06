/**
 * Tool call error handling service
 * Single Responsibility: Tool call error processing only
 * 
 * Handles all tool call error scenarios with OpenAI compatibility:
 * - Invalid tool call validation 
 * - Tool call timeouts
 * - Tool processing errors
 * - Error isolation and recovery
 */

import { OpenAIToolCall } from './types';
import { ToolCallError, ToolCallErrorDetail, ToolCallErrorResponse, ToolCallErrorType } from '../models/error';
import { 
  TOOL_ERRORS, 
  TOOL_ERROR_MESSAGES, 
  TOOL_ERROR_LIMITS 
} from './constants';
import { getLogger } from '../utils/logger';

const logger = getLogger('ToolErrorHandler');

/**
 * Tool error handling request
 */
export interface ToolErrorHandlingRequest {
  error: Error | unknown;
  toolCall?: OpenAIToolCall;
  context?: Record<string, any>;
  requestId?: string;
  sessionId?: string;
}

/**
 * Tool error handling result
 */
export interface ToolErrorHandlingResult {
  success: boolean;
  errorResponse?: ToolCallErrorResponse;
  isolationSuccessful: boolean;
  recoveryAction?: 'retry' | 'skip' | 'fallback' | 'abort';
  processingTimeMs: number;
}

/**
 * Tool error handling options
 */
export interface ToolErrorHandlingOptions {
  enableIsolation?: boolean;
  enableRecovery?: boolean;
  maxRetryAttempts?: number;
  timeoutMs?: number;
}

/**
 * Tool error handler interface
 */
export interface IToolErrorHandler {
  handleError(request: ToolErrorHandlingRequest, options?: ToolErrorHandlingOptions): Promise<ToolErrorHandlingResult>;
  classifyError(error: Error | unknown): ToolCallErrorType;
  formatErrorResponse(error: ToolCallError): ToolCallErrorResponse;
  isolateError(request: ToolErrorHandlingRequest): boolean;
  determineRecoveryAction(error: ToolCallError): 'retry' | 'skip' | 'fallback' | 'abort';
}

/**
 * Tool call error class
 */
export class ToolCallErrorException extends Error {
  constructor(
    message: string,
    public readonly errorType: ToolCallErrorType,
    public readonly code: string,
    public readonly toolCallId?: string,
    public readonly functionName?: string,
    public readonly context?: Record<string, any>,
    public readonly recoverable: boolean = true
  ) {
    super(message);
    this.name = 'ToolCallErrorException';
  }
}

/**
 * Tool error handler implementation
 */
export class ToolErrorHandler implements IToolErrorHandler {
  /**
   * Handle tool call error with isolation and recovery
   */
  async handleError(
    request: ToolErrorHandlingRequest, 
    options: ToolErrorHandlingOptions = {}
  ): Promise<ToolErrorHandlingResult> {
    const startTime = Date.now();
    const opts = { ...this.getDefaultOptions(), ...options };

    try {
      // Classify the error
      const errorType = this.classifyError(request.error);
      
      // Create structured error
      const toolError: ToolCallError = {
        id: request.toolCall?.id,
        type: errorType,
        code: this.getErrorCode(errorType, request.error),
        message: this.getErrorMessage(request.error),
        context: request.context,
        timestamp: Date.now(),
        recoverable: this.isRecoverable(errorType, request.error)
      };

      // Attempt error isolation
      const isolationSuccessful = opts.enableIsolation ? this.isolateError(request) : true;

      // Format error response
      const errorResponse = this.formatErrorResponse(toolError);

      // Determine recovery action
      const recoveryAction = opts.enableRecovery ? this.determineRecoveryAction(toolError) : 'abort';

      const processingTime = Date.now() - startTime;

      // Log error details
      logger.error('Tool call error handled', {
        errorType,
        code: toolError.code,
        toolCallId: request.toolCall?.id,
        functionName: request.toolCall?.function?.name,
        isolationSuccessful,
        recoveryAction,
        processingTime,
        requestId: request.requestId
      });

      return {
        success: true,
        errorResponse,
        isolationSuccessful,
        recoveryAction,
        processingTimeMs: processingTime
      };

    } catch (handlingError) {
      const processingTime = Date.now() - startTime;
      logger.error('Error handling failed', { 
        error: handlingError instanceof Error ? handlingError.message : String(handlingError),
        processingTime
      });

      return {
        success: false,
        isolationSuccessful: false,
        processingTimeMs: processingTime
      };
    }
  }

  /**
   * Classify error type based on error characteristics
   */
  classifyError(error: Error | unknown): ToolCallErrorType {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    // Check specific error types in order of priority
    if (this.isSystemError(errorMessage)) return 'system';
    if (this.isTimeoutError(errorMessage)) return 'timeout';
    if (this.isFormatError(errorMessage)) return 'format';
    if (this.isValidationError(errorMessage)) return 'validation';
    if (this.isProcessingError(errorMessage)) return 'processing';
    if (this.isExecutionError(errorMessage)) return 'execution';

    return 'processing';
  }

  /**
   * Check if error is a system error
   */
  private isSystemError(errorMessage: string): boolean {
    const systemKeywords = ['system', 'critical', 'fatal'];
    if (systemKeywords.some(keyword => errorMessage.includes(keyword))) {
      return true;
    }
    
    // Internal errors not related to processing or tools
    return errorMessage.includes('internal') && 
           !errorMessage.includes('processing') && 
           !errorMessage.includes('tool');
  }

  /**
   * Check if error is a timeout error
   */
  private isTimeoutError(errorMessage: string): boolean {
    const timeoutKeywords = ['timeout', 'timed out', 'deadline', 'expired'];
    return timeoutKeywords.some(keyword => errorMessage.includes(keyword));
  }

  /**
   * Check if error is a format error
   */
  private isFormatError(errorMessage: string): boolean {
    const formatKeywords = ['format', 'parse', 'json', 'syntax'];
    if (formatKeywords.some(keyword => errorMessage.includes(keyword))) {
      return true;
    }
    
    // Specific invalid format patterns
    const invalidFormatPatterns = ['invalid format', 'invalid structure'];
    if (invalidFormatPatterns.some(pattern => errorMessage.includes(pattern))) {
      return true;
    }
    
    // Invalid with format/parse context
    return errorMessage.includes('invalid') && 
           (errorMessage.includes('format') || errorMessage.includes('parse'));
  }

  /**
   * Check if error is a validation error
   */
  private isValidationError(errorMessage: string): boolean {
    const validationKeywords = ['validation', 'required', 'missing', 'malformed'];
    if (validationKeywords.some(keyword => errorMessage.includes(keyword))) {
      return true;
    }
    
    // Invalid but not format-related
    return errorMessage.includes('invalid');
  }

  /**
   * Check if error is a processing error
   */
  private isProcessingError(errorMessage: string): boolean {
    return errorMessage.includes('processing');
  }

  /**
   * Check if error is an execution error
   */
  private isExecutionError(errorMessage: string): boolean {
    const executionKeywords = ['execution', 'runtime', 'exception'];
    if (executionKeywords.some(keyword => errorMessage.includes(keyword))) {
      return true;
    }
    
    // Failed but not time-related
    return errorMessage.includes('failed') && !errorMessage.includes('time');
  }

  /**
   * Format tool call error for OpenAI response
   */
  formatErrorResponse(error: ToolCallError): ToolCallErrorResponse {
    const errorDetail: ToolCallErrorDetail = {
      message: this.truncateMessage(error.message),
      type: this.getOpenAIErrorType(error.type),
      code: error.code,
      toolCallId: error.id,
      functionName: this.extractFunctionName(error),
      errorContext: this.sanitizeContext(error.context)
    };

    return {
      error: errorDetail
    };
  }

  /**
   * Isolate error to prevent cascade failures
   */
  isolateError(request: ToolErrorHandlingRequest): boolean {
    try {
      // Error isolation logic - prevent error propagation
      // This is a simplified isolation that always succeeds
      // In production, this would implement circuit breaker patterns
      
      logger.debug('Error isolation successful', {
        toolCallId: request.toolCall?.id,
        errorType: typeof request.error
      });

      return true;
    } catch (isolationError) {
      logger.warn('Error isolation failed', { 
        isolationError: isolationError instanceof Error ? isolationError.message : String(isolationError)
      });
      return false;
    }
  }

  /**
   * Determine recovery action based on error characteristics
   */
  determineRecoveryAction(error: ToolCallError): 'retry' | 'skip' | 'fallback' | 'abort' {
    // Determine action based on error type first, then consider recoverability
    switch (error.type) {
      case 'timeout':
        return error.recoverable ? 'retry' : 'abort';
      case 'validation':
        return 'skip'; // Always skip validation errors, regardless of recoverability
      case 'format':
        return error.recoverable ? 'fallback' : 'abort';
      case 'processing':
        return error.recoverable ? 'retry' : 'abort';
      case 'execution':
        return error.recoverable ? 'fallback' : 'abort';
      case 'system':
        return 'abort'; // Always abort system errors
      default:
        return error.recoverable ? 'skip' : 'abort';
    }
  }

  /**
   * Get error code based on type and error
   */
  private getErrorCode(errorType: ToolCallErrorType, error: Error | unknown): string {
    switch (errorType) {
      case 'validation':
        return TOOL_ERRORS.CODES.TOOL_VALIDATION_FAILED;
      case 'timeout':
        return TOOL_ERRORS.CODES.TOOL_TIMEOUT_EXCEEDED;
      case 'format':
        return TOOL_ERRORS.CODES.TOOL_FORMAT_INVALID;
      case 'execution':
        return TOOL_ERRORS.CODES.TOOL_EXECUTION_FAILED;
      case 'system':
        return TOOL_ERRORS.CODES.TOOL_SYSTEM_ERROR;
      default:
        return TOOL_ERRORS.CODES.TOOL_PROCESSING_FAILED;
    }
  }

  /**
   * Get error message from error object
   */
  private getErrorMessage(error: Error | unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverable(errorType: ToolCallErrorType, error: Error | unknown): boolean {
    // System errors are generally not recoverable
    if (errorType === 'system') {
      return false;
    }

    // Check error message for non-recoverable indicators
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    const nonRecoverableTerms = ['fatal', 'critical', 'permanent', 'corrupt'];
    
    return !nonRecoverableTerms.some(term => errorMessage.includes(term));
  }

  /**
   * Map internal error type to OpenAI error type
   */
  private getOpenAIErrorType(errorType: ToolCallErrorType): string {
    switch (errorType) {
      case 'validation':
        return 'invalid_request_error';
      case 'timeout':
        return 'timeout_error';
      case 'format':
        return 'invalid_request_error';
      case 'execution':
        return 'tool_execution_error';
      case 'system':
        return 'server_error';
      default:
        return 'tool_error';
    }
  }

  /**
   * Extract function name from error context
   */
  private extractFunctionName(error: ToolCallError): string | undefined {
    return error.context?.functionName as string;
  }

  /**
   * Sanitize error context for response
   */
  private sanitizeContext(context?: Record<string, any>): Record<string, any> | undefined {
    if (!context) return undefined;

    // Remove sensitive information and limit size
    const sanitized: Record<string, any> = {};
    const maxContextSize = TOOL_ERROR_LIMITS.MAX_ERROR_CONTEXT_SIZE;
    let currentSize = 0;

    for (const [key, value] of Object.entries(context)) {
      // Skip sensitive keys
      if (key.toLowerCase().includes('password') || key.toLowerCase().includes('token')) {
        continue;
      }

      const serialized = JSON.stringify(value);
      if (currentSize + serialized.length <= maxContextSize) {
        sanitized[key] = value;
        currentSize += serialized.length;
      } else {
        break;
      }
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  /**
   * Truncate error message to limit
   */
  private truncateMessage(message: string): string {
    const maxLength = TOOL_ERROR_LIMITS.MAX_ERROR_MESSAGE_LENGTH;
    if (message.length <= maxLength) {
      return message;
    }
    return message.substring(0, maxLength - 3) + '...';
  }

  /**
   * Get default error handling options
   */
  private getDefaultOptions(): ToolErrorHandlingOptions {
    return {
      enableIsolation: true,
      enableRecovery: true,
      maxRetryAttempts: TOOL_ERROR_LIMITS.MAX_RETRY_ATTEMPTS,
      timeoutMs: TOOL_ERROR_LIMITS.ERROR_PROCESSING_TIMEOUT_MS
    };
  }
}

/**
 * Error handling utilities
 */
export const ToolErrorUtils = {
  /**
   * Create tool error from exception
   */
  fromException: (error: ToolCallErrorException): ToolCallError => ({
    id: error.toolCallId,
    type: error.errorType,
    code: error.code,
    message: error.message,
    context: error.context,
    timestamp: Date.now(),
    recoverable: error.recoverable
  }),

  /**
   * Check if error is tool-related
   */
  isToolError: (error: Error | unknown): boolean => {
    if (error instanceof ToolCallErrorException) {
      return true;
    }

    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return message.includes('tool') || message.includes('function');
  },

  /**
   * Extract tool call ID from error
   */
  extractToolCallId: (error: Error | unknown): string | undefined => {
    if (error instanceof ToolCallErrorException) {
      return error.toolCallId;
    }

    // Try to extract from error message
    const message = error instanceof Error ? error.message : String(error);
    const match = message.match(/tool_call_id[:\s]+([a-zA-Z0-9_-]+)/i);
    return match?.[1];
  }
};

export const toolErrorHandler = new ToolErrorHandler();