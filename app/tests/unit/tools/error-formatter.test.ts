/**
 * Tool Error Formatter Unit Tests
 * Phase 8A: Comprehensive error formatting testing
 * No placeholders - all real functionality tests
 */

import { 
  ToolErrorFormatter,
  ErrorFormattingUtils,
  IToolErrorFormatter,
  ErrorFormattingRequest,
  ErrorFormattingResult
} from '../../../src/tools/error-formatter';
import { ToolCallError, ToolCallErrorType } from '../../../src/models/error';
import { OpenAIToolCall } from '../../../src/tools/types';
import { TOOL_ERROR_LIMITS } from '../../../src/tools/constants';

describe('ToolErrorFormatter', () => {
  let errorFormatter: IToolErrorFormatter;

  beforeEach(() => {
    errorFormatter = new ToolErrorFormatter();
  });

  describe('formatError', () => {
    describe('successful error formatting', () => {
      it('should format validation error successfully', () => {
        const toolError: ToolCallError = {
          id: 'call_123',
          type: 'validation',
          code: 'tool_validation_failed',
          message: 'Invalid parameter provided',
          context: { parameter: 'name', value: 'invalid' },
          timestamp: Date.now(),
          recoverable: false
        };

        const request: ErrorFormattingRequest = {
          error: toolError,
          toolCall: {
            id: 'call_123',
            type: 'function',
            function: { name: 'test_func', arguments: '{}' }
          } as OpenAIToolCall,
          requestId: 'req_456'
        };

        const result = errorFormatter.formatError(request);

        expect(result.success).toBe(true);
        expect(result.errorResponse).toBeDefined();
        expect(result.errorResponse!.error.message).toBe('Invalid parameter provided');
        expect(result.errorResponse!.error.type).toBe('invalid_request_error');
        expect(result.errorResponse!.error.code).toBe('tool_validation_failed');
        expect(result.errorResponse!.error.toolCallId).toBe('call_123');
        expect(result.errorResponse!.error.functionName).toBe('test_func');
        expect(result.errorResponse!.error.param).toBe('tools[].function.name');
        expect(result.httpStatusCode).toBe(422);
        expect(result.formattingTimeMs).toBeGreaterThanOrEqual(0);
      });

      it('should format timeout error successfully', () => {
        const toolError: ToolCallError = {
          type: 'timeout',
          code: 'tool_timeout_exceeded',
          message: 'Tool call timeout exceeded',
          timestamp: Date.now(),
          recoverable: true
        };

        const request: ErrorFormattingRequest = {
          error: toolError
        };

        const result = errorFormatter.formatError(request);

        expect(result.success).toBe(true);
        expect(result.errorResponse!.error.type).toBe('timeout_error');
        expect(result.errorResponse!.error.code).toBe('tool_timeout_exceeded');
        expect(result.httpStatusCode).toBe(408);
      });

      it('should format processing error successfully', () => {
        const toolError: ToolCallError = {
          type: 'processing',
          code: 'tool_processing_failed',
          message: 'Tool processing failed',
          timestamp: Date.now(),
          recoverable: true
        };

        const request: ErrorFormattingRequest = {
          error: toolError
        };

        const result = errorFormatter.formatError(request);

        expect(result.success).toBe(true);
        expect(result.errorResponse!.error.type).toBe('tool_error');
        expect(result.httpStatusCode).toBe(422);
      });

      it('should format system error successfully', () => {
        const toolError: ToolCallError = {
          type: 'system',
          code: 'tool_system_error',
          message: 'System error occurred',
          timestamp: Date.now(),
          recoverable: false
        };

        const request: ErrorFormattingRequest = {
          error: toolError
        };

        const result = errorFormatter.formatError(request);

        expect(result.success).toBe(true);
        expect(result.errorResponse!.error.type).toBe('server_error');
        expect(result.httpStatusCode).toBe(500);
      });

      it('should format execution error successfully', () => {
        const toolError: ToolCallError = {
          type: 'execution',
          code: 'tool_execution_failed',
          message: 'Tool execution failed',
          timestamp: Date.now(),
          recoverable: true
        };

        const request: ErrorFormattingRequest = {
          error: toolError
        };

        const result = errorFormatter.formatError(request);

        expect(result.success).toBe(true);
        expect(result.errorResponse!.error.type).toBe('tool_execution_error');
        expect(result.httpStatusCode).toBe(422);
      });

      it('should format format error successfully', () => {
        const toolError: ToolCallError = {
          type: 'format',
          code: 'tool_format_invalid',
          message: 'Invalid format provided',
          timestamp: Date.now(),
          recoverable: false
        };

        const request: ErrorFormattingRequest = {
          error: toolError
        };

        const result = errorFormatter.formatError(request);

        expect(result.success).toBe(true);
        expect(result.errorResponse!.error.type).toBe('invalid_request_error');
        expect(result.httpStatusCode).toBe(422);
      });
    });

    describe('error formatting options', () => {
      it('should respect includeContext option', () => {
        const toolError: ToolCallError = {
          type: 'validation',
          code: 'tool_validation_failed',
          message: 'Error with context',
          context: { key: 'value', sensitive: 'data' },
          timestamp: Date.now(),
          recoverable: false
        };

        const request: ErrorFormattingRequest = {
          error: toolError
        };

        const resultWithContext = errorFormatter.formatError(request, { includeContext: true });
        const resultWithoutContext = errorFormatter.formatError(request, { includeContext: false });

        expect(resultWithContext.errorResponse!.error.errorContext).toBeDefined();
        expect(resultWithoutContext.errorResponse!.error.errorContext).toBeUndefined();
      });

      it('should respect maxMessageLength option', () => {
        const longMessage = 'A'.repeat(1000);
        const toolError: ToolCallError = {
          type: 'validation',
          code: 'tool_validation_failed',
          message: longMessage,
          timestamp: Date.now(),
          recoverable: false
        };

        const request: ErrorFormattingRequest = {
          error: toolError
        };

        const result = errorFormatter.formatError(request, { maxMessageLength: 50 });

        expect(result.errorResponse!.error.message.length).toBeLessThanOrEqual(50);
        expect(result.errorResponse!.error.message.endsWith('...')).toBe(true);
      });

      it('should respect sanitizeContext option', () => {
        const toolError: ToolCallError = {
          type: 'validation',
          code: 'tool_validation_failed',
          message: 'Error with sensitive data',
          context: {
            parameter: 'test',
            password: 'secret123',
            token: 'bearer_token',
            value: 'safe_value'
          },
          timestamp: Date.now(),
          recoverable: false
        };

        const request: ErrorFormattingRequest = {
          error: toolError
        };

        const sanitizedResult = errorFormatter.formatError(request, { sanitizeContext: true });
        const unsanitizedResult = errorFormatter.formatError(request, { sanitizeContext: false });

        expect(sanitizedResult.errorResponse!.error.errorContext).toEqual({
          parameter: 'test',
          value: 'safe_value'
        });
        expect(unsanitizedResult.errorResponse!.error.errorContext).toEqual({
          parameter: 'test',
          password: 'secret123',
          token: 'bearer_token',
          value: 'safe_value'
        });
      });
    });

    describe('error handling failures', () => {
      it('should handle formatting failure gracefully', () => {
        // Force an error by passing invalid data
        const invalidRequest = null as any;

        const result = errorFormatter.formatError(invalidRequest);

        expect(result.success).toBe(false);
        expect(result.httpStatusCode).toBe(500);
        expect(result.formattingTimeMs).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('formatValidationError', () => {
    it('should format validation error correctly', () => {
      const result = errorFormatter.formatValidationError(
        'Invalid parameter provided',
        'tools[0].function.name',
        {
          id: 'call_123',
          type: 'function',
          function: { name: 'test_func', arguments: '{}' }
        } as OpenAIToolCall
      );

      expect(result.error.message).toBe('Invalid parameter provided');
      expect(result.error.type).toBe('invalid_request_error');
      expect(result.error.code).toBe('tool_validation_failed');
      expect(result.error.param).toBe('tools[0].function.name');
      expect(result.error.toolCallId).toBe('call_123');
      expect(result.error.functionName).toBe('test_func');
    });

    it('should format validation error without optional parameters', () => {
      const result = errorFormatter.formatValidationError('Validation failed');

      expect(result.error.message).toBe('Validation failed');
      expect(result.error.type).toBe('invalid_request_error');
      expect(result.error.code).toBe('tool_validation_failed');
      expect(result.error.param).toBeUndefined();
      expect(result.error.toolCallId).toBeUndefined();
      expect(result.error.functionName).toBeUndefined();
    });
  });

  describe('formatTimeoutError', () => {
    it('should format timeout error correctly', () => {
      const result = errorFormatter.formatTimeoutError(
        'Tool call timeout exceeded',
        {
          id: 'call_timeout',
          type: 'function',
          function: { name: 'slow_func', arguments: '{}' }
        } as OpenAIToolCall
      );

      expect(result.error.message).toBe('Tool call timeout exceeded');
      expect(result.error.type).toBe('timeout_error');
      expect(result.error.code).toBe('tool_timeout_exceeded');
      expect(result.error.toolCallId).toBe('call_timeout');
      expect(result.error.functionName).toBe('slow_func');
    });
  });

  describe('formatProcessingError', () => {
    it('should format processing error correctly', () => {
      const result = errorFormatter.formatProcessingError(
        'Tool processing failed',
        {
          id: 'call_proc',
          type: 'function',
          function: { name: 'proc_func', arguments: '{}' }
        } as OpenAIToolCall
      );

      expect(result.error.message).toBe('Tool processing failed');
      expect(result.error.type).toBe('tool_error');
      expect(result.error.code).toBe('tool_processing_failed');
      expect(result.error.toolCallId).toBe('call_proc');
      expect(result.error.functionName).toBe('proc_func');
    });
  });

  describe('getHttpStatusCode', () => {
    it('should return correct status codes for error types', () => {
      expect(errorFormatter.getHttpStatusCode('invalid_request_error')).toBe(422);
      expect(errorFormatter.getHttpStatusCode('timeout_error')).toBe(408);
      expect(errorFormatter.getHttpStatusCode('tool_error')).toBe(422);
      expect(errorFormatter.getHttpStatusCode('tool_execution_error')).toBe(422);
      expect(errorFormatter.getHttpStatusCode('server_error')).toBe(500);
      expect(errorFormatter.getHttpStatusCode('authentication_error')).toBe(401);
      expect(errorFormatter.getHttpStatusCode('authorization_error')).toBe(403);
      expect(errorFormatter.getHttpStatusCode('rate_limit_error')).toBe(429);
    });

    it('should return 500 for unknown error types', () => {
      expect(errorFormatter.getHttpStatusCode('unknown_error')).toBe(500);
    });
  });
});

describe('ErrorFormattingUtils', () => {
  describe('quickValidationError', () => {
    it('should create validation error response', () => {
      const result = ErrorFormattingUtils.quickValidationError(
        'Invalid input',
        'tools[0].function.arguments'
      );

      expect(result.error.message).toBe('Invalid input');
      expect(result.error.type).toBe('invalid_request_error');
      expect(result.error.code).toBe('tool_validation_failed');
      expect(result.error.param).toBe('tools[0].function.arguments');
    });
  });

  describe('quickTimeoutError', () => {
    it('should create timeout error response', () => {
      const result = ErrorFormattingUtils.quickTimeoutError('Operation timed out');

      expect(result.error.message).toBe('Operation timed out');
      expect(result.error.type).toBe('timeout_error');
      expect(result.error.code).toBe('tool_timeout_exceeded');
    });
  });

  describe('quickProcessingError', () => {
    it('should create processing error response', () => {
      const result = ErrorFormattingUtils.quickProcessingError('Processing failed');

      expect(result.error.message).toBe('Processing failed');
      expect(result.error.type).toBe('tool_error');
      expect(result.error.code).toBe('tool_processing_failed');
    });
  });

  describe('isFormattedError', () => {
    it('should identify formatted error responses', () => {
      const formattedError = {
        error: {
          message: 'Test error',
          type: 'tool_error',
          code: 'test_code'
        }
      };

      const nonFormattedError = {
        message: 'Not formatted'
      };

      expect(ErrorFormattingUtils.isFormattedError(formattedError)).toBe(true);
      expect(ErrorFormattingUtils.isFormattedError(nonFormattedError)).toBe(false);
      expect(ErrorFormattingUtils.isFormattedError(null)).toBe(false);
      expect(ErrorFormattingUtils.isFormattedError(undefined)).toBe(false);
    });
  });

  describe('extractErrorInfo', () => {
    it('should extract error information correctly', () => {
      const errorResponse = {
        error: {
          message: 'Test error',
          type: 'tool_error',
          code: 'test_code',
          toolCallId: 'call_123',
          functionName: 'test_func'
        }
      };

      const info = ErrorFormattingUtils.extractErrorInfo(errorResponse);

      expect(info.message).toBe('Test error');
      expect(info.type).toBe('tool_error');
      expect(info.code).toBe('test_code');
      expect(info.toolCallId).toBe('call_123');
      expect(info.functionName).toBe('test_func');
    });
  });

  describe('validateErrorFormat', () => {
    it('should validate correct error format', () => {
      const validError = {
        error: {
          message: 'Valid error',
          type: 'tool_error'
        }
      };

      const invalidError1 = {
        error: {
          message: '',
          type: 'tool_error'
        }
      };

      const invalidError2 = {
        error: {
          message: 'Valid message'
          // missing type
        }
      };

      expect(ErrorFormattingUtils.validateErrorFormat(validError)).toBe(true);
      expect(ErrorFormattingUtils.validateErrorFormat(invalidError1)).toBe(false);
      expect(ErrorFormattingUtils.validateErrorFormat(invalidError2)).toBe(false);
      expect(ErrorFormattingUtils.validateErrorFormat(null)).toBe(false);
    });
  });
});

describe('Message and Context Formatting', () => {
  let errorFormatter: IToolErrorFormatter;

  beforeEach(() => {
    errorFormatter = new ToolErrorFormatter();
  });

  describe('message truncation', () => {
    it('should truncate messages exceeding length limits', () => {
      const longMessage = 'A'.repeat(TOOL_ERROR_LIMITS.MAX_ERROR_MESSAGE_LENGTH + 100);
      const toolError: ToolCallError = {
        type: 'validation',
        code: 'tool_validation_failed',
        message: longMessage,
        timestamp: Date.now(),
        recoverable: false
      };

      const request: ErrorFormattingRequest = {
        error: toolError
      };

      const result = errorFormatter.formatError(request);

      expect(result.errorResponse!.error.message.length).toBeLessThanOrEqual(
        TOOL_ERROR_LIMITS.MAX_ERROR_MESSAGE_LENGTH
      );
      expect(result.errorResponse!.error.message.endsWith('...')).toBe(true);
    });

    it('should not truncate messages within limits', () => {
      const shortMessage = 'Short error message';
      const toolError: ToolCallError = {
        type: 'validation',
        code: 'tool_validation_failed',
        message: shortMessage,
        timestamp: Date.now(),
        recoverable: false
      };

      const request: ErrorFormattingRequest = {
        error: toolError
      };

      const result = errorFormatter.formatError(request);

      expect(result.errorResponse!.error.message).toBe(shortMessage);
    });
  });

  describe('context sanitization', () => {
    it('should remove sensitive information from context', () => {
      const toolError: ToolCallError = {
        type: 'validation',
        code: 'tool_validation_failed',
        message: 'Error with sensitive data',
        context: {
          parameter: 'test',
          password: 'secret123',
          api_key: 'key_123',
          authorization: 'Bearer token',
          secret: 'secret_value',
          value: 'safe_value'
        },
        timestamp: Date.now(),
        recoverable: false
      };

      const request: ErrorFormattingRequest = {
        error: toolError
      };

      const result = errorFormatter.formatError(request);

      expect(result.errorResponse!.error.errorContext).toEqual({
        parameter: 'test',
        value: 'safe_value'
      });
      expect(result.errorResponse!.error.errorContext).not.toHaveProperty('password');
      expect(result.errorResponse!.error.errorContext).not.toHaveProperty('api_key');
      expect(result.errorResponse!.error.errorContext).not.toHaveProperty('authorization');
      expect(result.errorResponse!.error.errorContext).not.toHaveProperty('secret');
    });

    it('should limit context value sizes', () => {
      const largeValue = 'A'.repeat(200);
      const toolError: ToolCallError = {
        type: 'validation',
        code: 'tool_validation_failed',
        message: 'Error with large context',
        context: {
          largeField: largeValue,
          smallField: 'small'
        },
        timestamp: Date.now(),
        recoverable: false
      };

      const request: ErrorFormattingRequest = {
        error: toolError
      };

      const result = errorFormatter.formatError(request);

      expect(result.errorResponse!.error.errorContext!.largeField).not.toBe(largeValue);
      expect(result.errorResponse!.error.errorContext!.largeField.length).toBeLessThanOrEqual(100);
      expect(result.errorResponse!.error.errorContext!.largeField.endsWith('...')).toBe(true);
      expect(result.errorResponse!.error.errorContext!.smallField).toBe('small');
    });
  });

  describe('function name extraction', () => {
    it('should extract function name from error context', () => {
      const toolError: ToolCallError = {
        type: 'validation',
        code: 'tool_validation_failed',
        message: 'Error with function context',
        context: {
          functionName: 'context_func'
        },
        timestamp: Date.now(),
        recoverable: false
      };

      const request: ErrorFormattingRequest = {
        error: toolError,
        toolCall: {
          id: 'call_123',
          type: 'function',
          function: { name: 'tool_func', arguments: '{}' }
        } as OpenAIToolCall
      };

      const result = errorFormatter.formatError(request);

      expect(result.errorResponse!.error.functionName).toBe('context_func');
    });

    it('should fallback to tool call function name', () => {
      const toolError: ToolCallError = {
        type: 'validation',
        code: 'tool_validation_failed',
        message: 'Error without function context',
        timestamp: Date.now(),
        recoverable: false
      };

      const request: ErrorFormattingRequest = {
        error: toolError,
        toolCall: {
          id: 'call_123',
          type: 'function',
          function: { name: 'tool_func', arguments: '{}' }
        } as OpenAIToolCall
      };

      const result = errorFormatter.formatError(request);

      expect(result.errorResponse!.error.functionName).toBe('tool_func');
    });
  });
});

describe('Performance Requirements', () => {
  let errorFormatter: IToolErrorFormatter;

  beforeEach(() => {
    errorFormatter = new ToolErrorFormatter();
  });

  it('should format errors within performance limits', () => {
    const toolError: ToolCallError = {
      type: 'validation',
      code: 'tool_validation_failed',
      message: 'Performance test error',
      timestamp: Date.now(),
      recoverable: false
    };

    const request: ErrorFormattingRequest = {
      error: toolError
    };

    const result = errorFormatter.formatError(request);

    expect(result.success).toBe(true);
    expect(result.formattingTimeMs).toBeLessThan(5); // Within 5ms requirement
  });

  it('should handle multiple formatting operations efficiently', () => {
    const requests: ErrorFormattingRequest[] = Array(100).fill(null).map((_, i) => ({
      error: {
        type: 'validation' as ToolCallErrorType,
        code: 'tool_validation_failed',
        message: `Error ${i}`,
        timestamp: Date.now(),
        recoverable: false
      }
    }));

    const startTime = Date.now();
    const results = requests.map(request => errorFormatter.formatError(request));
    const totalTime = Date.now() - startTime;

    results.forEach(result => {
      expect(result.success).toBe(true);
      expect(result.formattingTimeMs).toBeLessThan(5);
    });

    expect(totalTime).toBeLessThan(100); // 100 operations in under 100ms
  });
});