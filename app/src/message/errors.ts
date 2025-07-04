/**
 * Message Conversion Errors
 * Single Responsibility: Define error types for message conversion operations
 */

import { MESSAGE_ERROR_CODES } from './constants';
import { ConversionErrorDetails } from './interfaces';

/**
 * Base error class for message conversion operations
 */
export class MessageConversionError extends Error {
  public readonly code: string;
  public readonly details?: ConversionErrorDetails;
  public readonly processingTimeMs?: number;

  constructor(
    message: string, 
    code: string = MESSAGE_ERROR_CODES.CONVERSION_FAILED,
    details?: ConversionErrorDetails
  ) {
    super(message);
    this.name = 'MessageConversionError';
    this.code = code;
    this.details = details;
    this.processingTimeMs = details?.processingTimeMs;

    // Maintain proper stack trace for debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MessageConversionError);
    }
  }
}

/**
 * Format-specific error for invalid message formats
 */
export class InvalidMessageFormatError extends MessageConversionError {
  constructor(message: string, format?: string) {
    super(
      `Invalid message format${format ? ` (${format})` : ''}: ${message}`,
      MESSAGE_ERROR_CODES.INVALID_FORMAT
    );
    this.name = 'InvalidMessageFormatError';
  }
}

/**
 * Content filtering error
 */
export class ContentFilteringError extends MessageConversionError {
  constructor(message: string, originalContent?: string) {
    super(message, MESSAGE_ERROR_CODES.CONTENT_FILTERING_FAILED, {
      code: MESSAGE_ERROR_CODES.CONTENT_FILTERING_FAILED,
      message,
      source: originalContent
    });
    this.name = 'ContentFilteringError';
  }
}

/**
 * Message parsing error
 */
export class MessageParsingError extends MessageConversionError {
  constructor(message: string, sourceMessages?: any[]) {
    super(message, MESSAGE_ERROR_CODES.PARSING_FAILED, {
      code: MESSAGE_ERROR_CODES.PARSING_FAILED,
      message,
      source: sourceMessages
    });
    this.name = 'MessageParsingError';
  }
}

/**
 * Message validation error
 */
export class MessageValidationError extends MessageConversionError {
  constructor(message: string, invalidMessages?: any[]) {
    super(message, MESSAGE_ERROR_CODES.VALIDATION_FAILED, {
      code: MESSAGE_ERROR_CODES.VALIDATION_FAILED,
      message,
      source: invalidMessages
    });
    this.name = 'MessageValidationError';
  }
}

/**
 * Conversion timeout error
 */
export class ConversionTimeoutError extends MessageConversionError {
  constructor(timeoutMs: number, operation: string) {
    super(
      `Message conversion timeout: ${operation} exceeded ${timeoutMs}ms`,
      MESSAGE_ERROR_CODES.TIMEOUT_EXCEEDED,
      {
        code: MESSAGE_ERROR_CODES.TIMEOUT_EXCEEDED,
        message: `Timeout after ${timeoutMs}ms`,
        processingTimeMs: timeoutMs
      }
    );
    this.name = 'ConversionTimeoutError';
  }
}

/**
 * Error handling wrapper for message conversion operations
 */
export async function handleMessageConversionCall<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<T> {
  const startTime = Date.now();
  
  try {
    return await operation();
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Re-throw message conversion errors as-is
    if (error instanceof MessageConversionError) {
      throw error;
    }
    
    // Wrap other errors in MessageConversionError
    throw new MessageConversionError(
      `${context ? context + ': ' : ''}${errorMessage}`,
      MESSAGE_ERROR_CODES.CONVERSION_FAILED,
      {
        code: MESSAGE_ERROR_CODES.CONVERSION_FAILED,
        message: errorMessage,
        source: error,
        processingTimeMs: processingTime
      }
    );
  }
}