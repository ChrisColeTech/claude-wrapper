/**
 * Tool Error Handler Unit Tests
 * Phase 8A: Comprehensive tool call error handling testing
 * No placeholders - all real functionality tests
 */

import { 
  ToolErrorHandler, 
  ToolCallErrorException,
  ToolErrorUtils,
  IToolErrorHandler,
  ToolErrorHandlingRequest,
  ToolErrorHandlingResult
} from '../../../src/tools/error-handler';
import { ToolCallErrorType } from '../../../src/models/error';
import { OpenAIToolCall } from '../../../src/tools/types';
import { TOOL_ERROR_LIMITS } from '../../../src/tools/constants';

describe('ToolErrorHandler', () => {
  let errorHandler: IToolErrorHandler;

  beforeEach(() => {
    errorHandler = new ToolErrorHandler();
  });

  describe('handleError', () => {
    describe('successful error handling', () => {
      it('should handle validation error successfully', async () => {
        const request: ToolErrorHandlingRequest = {
          error: new Error('Invalid function name provided'),
          toolCall: {
            id: 'call_123',
            type: 'function',
            function: { name: 'test_func', arguments: '{}' }
          } as OpenAIToolCall,
          requestId: 'req_456'
        };

        const result = await errorHandler.handleError(request);

        expect(result.success).toBe(true);
        expect(result.errorResponse).toBeDefined();
        expect(result.errorResponse!.error.type).toBe('invalid_request_error');
        expect(result.errorResponse!.error.code).toBe('tool_validation_failed');
        expect(result.errorResponse!.error.toolCallId).toBe('call_123');
        expect(result.isolationSuccessful).toBe(true);
        expect(result.recoveryAction).toBe('skip');
        expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
        expect(result.processingTimeMs).toBeLessThan(TOOL_ERROR_LIMITS.ERROR_PROCESSING_TIMEOUT_MS);
      });

      it('should handle timeout error successfully', async () => {
        const request: ToolErrorHandlingRequest = {
          error: new Error('Tool call timeout exceeded 30 seconds'),
          toolCall: {
            id: 'call_timeout',
            type: 'function',
            function: { name: 'slow_func', arguments: '{"delay": 30}' }
          } as OpenAIToolCall
        };

        const result = await errorHandler.handleError(request);

        expect(result.success).toBe(true);
        expect(result.errorResponse!.error.type).toBe('timeout_error');
        expect(result.errorResponse!.error.code).toBe('tool_timeout_exceeded');
        expect(result.recoveryAction).toBe('retry');
      });

      it('should handle processing error successfully', async () => {
        const request: ToolErrorHandlingRequest = {
          error: new Error('Tool processing failed due to internal error'),
          context: { processingStep: 'validation', errorCode: 'PROC_001' }
        };

        const result = await errorHandler.handleError(request);

        expect(result.success).toBe(true);
        expect(result.errorResponse!.error.type).toBe('tool_error');
        expect(result.errorResponse!.error.errorContext).toEqual({
          processingStep: 'validation',
          errorCode: 'PROC_001'
        });
      });

      it('should handle system error successfully', async () => {
        const request: ToolErrorHandlingRequest = {
          error: new Error('System internal error - critical failure'),
          sessionId: 'session_789'
        };

        const result = await errorHandler.handleError(request);

        expect(result.success).toBe(true);
        expect(result.errorResponse!.error.type).toBe('server_error');
        expect(result.errorResponse!.error.code).toBe('tool_system_error');
        expect(result.recoveryAction).toBe('abort');
      });
    });

    describe('error handling options', () => {
      it('should respect isolation disabled option', async () => {
        const request: ToolErrorHandlingRequest = {
          error: new Error('Test error')
        };

        const result = await errorHandler.handleError(request, {
          enableIsolation: false,
          enableRecovery: true
        });

        expect(result.success).toBe(true);
        expect(result.isolationSuccessful).toBe(true); // Should default to true when disabled
      });

      it('should respect recovery disabled option', async () => {
        const request: ToolErrorHandlingRequest = {
          error: new Error('Test error')
        };

        const result = await errorHandler.handleError(request, {
          enableIsolation: true,
          enableRecovery: false
        });

        expect(result.success).toBe(true);
        expect(result.recoveryAction).toBe('abort');
      });

      it('should handle custom timeout option', async () => {
        const request: ToolErrorHandlingRequest = {
          error: new Error('Test error')
        };

        const result = await errorHandler.handleError(request, {
          timeoutMs: 10
        });

        expect(result.success).toBe(true);
        expect(result.processingTimeMs).toBeLessThan(15); // Allow some margin
      });
    });

    describe('error handling failures', () => {
      it('should handle null error gracefully', async () => {
        const request: ToolErrorHandlingRequest = {
          error: null
        };

        const result = await errorHandler.handleError(request);

        expect(result.success).toBe(true);
        expect(result.errorResponse!.error.message).toBe('null');
      });

      it('should handle undefined error gracefully', async () => {
        const request: ToolErrorHandlingRequest = {
          error: undefined
        };

        const result = await errorHandler.handleError(request);

        expect(result.success).toBe(true);
        expect(result.errorResponse!.error.message).toBe('undefined');
      });
    });
  });

  describe('classifyError', () => {
    it('should classify validation errors correctly', () => {
      const validationErrors = [
        new Error('Validation failed for parameter'),
        new Error('Invalid function name provided'),
        new Error('Required field is missing'),
        new Error('Malformed tool call structure')
      ];

      validationErrors.forEach(error => {
        const type = errorHandler.classifyError(error);
        expect(type).toBe('validation');
      });
    });

    it('should classify timeout errors correctly', () => {
      const timeoutErrors = [
        new Error('Timeout exceeded'),
        new Error('Operation timed out after 30 seconds'),
        new Error('Request deadline exceeded'),
        new Error('Call aborted due to timeout')
      ];

      timeoutErrors.forEach(error => {
        const type = errorHandler.classifyError(error);
        expect(type).toBe('timeout');
      });
    });

    it('should classify format errors correctly', () => {
      const formatErrors = [
        new Error('JSON parse error'),
        new Error('Invalid format provided'),
        new Error('Syntax error in structure'),
        new Error('Failed to parse arguments')
      ];

      formatErrors.forEach(error => {
        const type = errorHandler.classifyError(error);
        expect(type).toBe('format');
      });
    });

    it('should classify execution errors correctly', () => {
      const executionErrors = [
        new Error('Tool execution failed'),
        new Error('Runtime error occurred'),
        new Error('Failed to complete operation'),
        new Error('Exception during execution')
      ];

      executionErrors.forEach(error => {
        const type = errorHandler.classifyError(error);
        expect(type).toBe('execution');
      });
    });

    it('should classify system errors correctly', () => {
      const systemErrors = [
        new Error('System internal error'),
        new Error('Critical server failure'),
        new Error('Fatal system crash'),
        new Error('Internal server error')
      ];

      systemErrors.forEach(error => {
        const type = errorHandler.classifyError(error);
        expect(type).toBe('system');
      });
    });

    it('should default to processing for unknown errors', () => {
      const unknownError = new Error('Some unknown error occurred');
      const type = errorHandler.classifyError(unknownError);
      expect(type).toBe('processing');
    });
  });

  describe('formatErrorResponse', () => {
    it('should format error response correctly', () => {
      const toolError = {
        id: 'call_123',
        type: 'validation' as ToolCallErrorType,
        code: 'tool_validation_failed',
        message: 'Invalid parameter provided',
        context: { parameter: 'name', value: 'invalid' },
        timestamp: Date.now(),
        recoverable: false
      };

      const response = errorHandler.formatErrorResponse(toolError);

      expect(response.error.message).toBe('Invalid parameter provided');
      expect(response.error.type).toBe('invalid_request_error');
      expect(response.error.code).toBe('tool_validation_failed');
      expect(response.error.toolCallId).toBe('call_123');
      expect(response.error.errorContext).toEqual({ parameter: 'name', value: 'invalid' });
    });

    it('should truncate long error messages', () => {
      const longMessage = 'A'.repeat(600); // Longer than TOOL_ERROR_LIMITS.MAX_ERROR_MESSAGE_LENGTH
      const toolError = {
        id: 'call_123',
        type: 'validation' as ToolCallErrorType,
        code: 'tool_validation_failed',
        message: longMessage,
        timestamp: Date.now(),
        recoverable: false
      };

      const response = errorHandler.formatErrorResponse(toolError);

      expect(response.error.message.length).toBeLessThanOrEqual(TOOL_ERROR_LIMITS.MAX_ERROR_MESSAGE_LENGTH);
      expect(response.error.message.endsWith('...')).toBe(true);
    });

    it('should sanitize error context', () => {
      const toolError = {
        id: 'call_123',
        type: 'validation' as ToolCallErrorType,
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

      const response = errorHandler.formatErrorResponse(toolError);

      expect(response.error.errorContext).toEqual({
        parameter: 'test',
        value: 'safe_value'
      });
      expect(response.error.errorContext).not.toHaveProperty('password');
      expect(response.error.errorContext).not.toHaveProperty('token');
    });
  });

  describe('isolateError', () => {
    it('should successfully isolate error', () => {
      const request: ToolErrorHandlingRequest = {
        error: new Error('Test error'),
        toolCall: {
          id: 'call_123',
          type: 'function',
          function: { name: 'test_func', arguments: '{}' }
        } as OpenAIToolCall
      };

      const result = errorHandler.isolateError(request);
      expect(result).toBe(true);
    });

    it('should handle isolation without tool call', () => {
      const request: ToolErrorHandlingRequest = {
        error: new Error('Test error')
      };

      const result = errorHandler.isolateError(request);
      expect(result).toBe(true);
    });
  });

  describe('determineRecoveryAction', () => {
    it('should suggest retry for timeout errors', () => {
      const toolError = {
        id: 'call_123',
        type: 'timeout' as ToolCallErrorType,
        code: 'tool_timeout_exceeded',
        message: 'Timeout occurred',
        timestamp: Date.now(),
        recoverable: true
      };

      const action = errorHandler.determineRecoveryAction(toolError);
      expect(action).toBe('retry');
    });

    it('should suggest skip for validation errors', () => {
      const toolError = {
        type: 'validation' as ToolCallErrorType,
        code: 'tool_validation_failed',
        message: 'Validation failed',
        timestamp: Date.now(),
        recoverable: false
      };

      const action = errorHandler.determineRecoveryAction(toolError);
      expect(action).toBe('skip');
    });

    it('should suggest fallback for format errors', () => {
      const toolError = {
        type: 'format' as ToolCallErrorType,
        code: 'tool_format_invalid',
        message: 'Format error',
        timestamp: Date.now(),
        recoverable: true
      };

      const action = errorHandler.determineRecoveryAction(toolError);
      expect(action).toBe('fallback');
    });

    it('should suggest abort for system errors', () => {
      const toolError = {
        type: 'system' as ToolCallErrorType,
        code: 'tool_system_error',
        message: 'System error',
        timestamp: Date.now(),
        recoverable: false
      };

      const action = errorHandler.determineRecoveryAction(toolError);
      expect(action).toBe('abort');
    });

    it('should suggest abort for non-recoverable errors', () => {
      const toolError = {
        type: 'processing' as ToolCallErrorType,
        code: 'tool_processing_failed',
        message: 'Processing failed',
        timestamp: Date.now(),
        recoverable: false
      };

      const action = errorHandler.determineRecoveryAction(toolError);
      expect(action).toBe('abort');
    });
  });
});

describe('ToolCallErrorException', () => {
  it('should create exception with all properties', () => {
    const exception = new ToolCallErrorException(
      'Test error message',
      'validation',
      'test_code',
      'call_123',
      'test_function',
      { key: 'value' },
      true
    );

    expect(exception.message).toBe('Test error message');
    expect(exception.errorType).toBe('validation');
    expect(exception.code).toBe('test_code');
    expect(exception.toolCallId).toBe('call_123');
    expect(exception.functionName).toBe('test_function');
    expect(exception.context).toEqual({ key: 'value' });
    expect(exception.recoverable).toBe(true);
    expect(exception.name).toBe('ToolCallErrorException');
  });

  it('should create exception with default recoverable value', () => {
    const exception = new ToolCallErrorException(
      'Test error',
      'validation',
      'test_code'
    );

    expect(exception.recoverable).toBe(true);
  });
});

describe('ToolErrorUtils', () => {
  describe('fromException', () => {
    it('should convert exception to tool error', () => {
      const exception = new ToolCallErrorException(
        'Test error',
        'validation',
        'test_code',
        'call_123',
        'test_func',
        { key: 'value' },
        false
      );

      const toolError = ToolErrorUtils.fromException(exception);

      expect(toolError.id).toBe('call_123');
      expect(toolError.type).toBe('validation');
      expect(toolError.code).toBe('test_code');
      expect(toolError.message).toBe('Test error');
      expect(toolError.context).toEqual({ key: 'value' });
      expect(toolError.recoverable).toBe(false);
      expect(toolError.timestamp).toBeGreaterThan(0);
    });
  });

  describe('isToolError', () => {
    it('should identify tool call error exception', () => {
      const exception = new ToolCallErrorException('Test', 'validation', 'code');
      expect(ToolErrorUtils.isToolError(exception)).toBe(true);
    });

    it('should identify tool-related errors by message', () => {
      const toolErrors = [
        new Error('Tool validation failed'),
        new Error('Function call error occurred'),
        new Error('Tool execution timeout')
      ];

      toolErrors.forEach(error => {
        expect(ToolErrorUtils.isToolError(error)).toBe(true);
      });
    });

    it('should not identify non-tool errors', () => {
      const nonToolErrors = [
        new Error('Database connection failed'),
        new Error('Network timeout'),
        new Error('Authentication error')
      ];

      nonToolErrors.forEach(error => {
        expect(ToolErrorUtils.isToolError(error)).toBe(false);
      });
    });
  });

  describe('extractToolCallId', () => {
    it('should extract ID from tool call error exception', () => {
      const exception = new ToolCallErrorException('Test', 'validation', 'code', 'call_123');
      const id = ToolErrorUtils.extractToolCallId(exception);
      expect(id).toBe('call_123');
    });

    it('should extract ID from error message', () => {
      const error = new Error('Tool call failed for tool_call_id: call_456');
      const id = ToolErrorUtils.extractToolCallId(error);
      expect(id).toBe('call_456');
    });

    it('should return undefined for errors without ID', () => {
      const error = new Error('General error message');
      const id = ToolErrorUtils.extractToolCallId(error);
      expect(id).toBeUndefined();
    });
  });
});

describe('Performance Requirements', () => {
  let errorHandler: IToolErrorHandler;

  beforeEach(() => {
    errorHandler = new ToolErrorHandler();
  });

  it('should handle errors within 5ms performance limit', async () => {
    const request: ToolErrorHandlingRequest = {
      error: new Error('Performance test error'),
      toolCall: {
        id: 'call_perf',
        type: 'function',
        function: { name: 'perf_func', arguments: '{}' }
      } as OpenAIToolCall
    };

    const result = await errorHandler.handleError(request);

    expect(result.success).toBe(true);
    expect(result.processingTimeMs).toBeLessThan(TOOL_ERROR_LIMITS.ERROR_PROCESSING_TIMEOUT_MS);
  });

  it('should handle multiple errors within performance limits', async () => {
    const requests: ToolErrorHandlingRequest[] = Array(10).fill(null).map((_, i) => ({
      error: new Error(`Error ${i}`),
      toolCall: {
        id: `call_${i}`,
        type: 'function',
        function: { name: 'test_func', arguments: '{}' }
      } as OpenAIToolCall
    }));

    const startTime = Date.now();
    const results = await Promise.all(
      requests.map(request => errorHandler.handleError(request))
    );
    const totalTime = Date.now() - startTime;

    results.forEach(result => {
      expect(result.success).toBe(true);
      expect(result.processingTimeMs).toBeLessThan(TOOL_ERROR_LIMITS.ERROR_PROCESSING_TIMEOUT_MS);
    });

    expect(totalTime).toBeLessThan(50); // 10 errors in under 50ms total
  });
});