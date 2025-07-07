import { ERROR_CODES } from '../config/constants';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;

  constructor(message: string, statusCode: number = 500, code: string = ERROR_CODES.ARCHITECTURE_ERROR, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, ERROR_CODES.VALIDATION_FAILED);
    this.name = 'ValidationError';
  }
}

export class ClaudeCliError extends AppError {
  constructor(message: string) {
    super(message, 503, ERROR_CODES.CLAUDE_CLI_ERROR);
    this.name = 'ClaudeCliError';
  }
}

export class TimeoutError extends AppError {
  constructor(message: string) {
    super(message, 408, ERROR_CODES.TIMEOUT_ERROR);
    this.name = 'TimeoutError';
  }
}

export class InvalidRequestError extends AppError {
  constructor(message: string) {
    super(message, 400, ERROR_CODES.INVALID_REQUEST);
    this.name = 'InvalidRequestError';
  }
}

export class ArchitectureError extends AppError {
  constructor(message: string) {
    super(message, 500, ERROR_CODES.ARCHITECTURE_ERROR);
    this.name = 'ArchitectureError';
  }
}

export function createOpenAIErrorResponse(error: AppError): any {
  return {
    error: {
      message: error.message,
      type: 'api_error',
      code: error.code,
    }
  };
}

export function isOperationalError(error: Error): boolean {
  return error instanceof AppError && error.isOperational;
}