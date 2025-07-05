/**
 * ToolResultHandler Unit Tests (Phase 9A)
 * 100% test coverage for tool result handling functionality
 * Tests performance requirement: <5ms handling time
 */

import { ToolResultHandler, IToolResultHandler, ToolResultHandlingError, ToolResult } from '../../../src/tools/result-handler';
import { Message } from '../../../src/models/message';
import { MESSAGE_PROCESSING_LIMITS, MESSAGE_PROCESSING_MESSAGES } from '../../../src/tools/constants';

describe('ToolResultHandler', () => {
  let handler: IToolResultHandler;

  beforeEach(() => {
    handler = new ToolResultHandler();
  });

  describe('constructor', () => {
    it('should create handler instance successfully', () => {
      expect(handler).toBeInstanceOf(ToolResultHandler);
      expect(handler).toBeDefined();
    });
  });

  describe('handleToolResult', () => {
    const validToolMessage: Message = {
      role: 'tool',
      content: 'Tool execution successful',
      tool_call_id: 'call_abc123xyz789'
    };

    it('should handle valid tool result successfully', async () => {
      const result = await handler.handleToolResult(validToolMessage);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result?.toolCallId).toBe('call_abc123xyz789');
      expect(result.result?.content).toBe('Tool execution successful');
      expect(result.result?.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.handlingTimeMs).toBeLessThan(MESSAGE_PROCESSING_LIMITS.RESULT_HANDLING_TIMEOUT_MS);
    });

    it('should meet performance requirement (<5ms)', async () => {
      const startTime = performance.now();
      const result = await handler.handleToolResult(validToolMessage);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5);
      expect(result.handlingTimeMs).toBeLessThan(5);
    });

    it('should reject invalid message structure', async () => {
      const invalidMessage = {} as Message;
      const result = await handler.handleToolResult(invalidMessage);

      expect(result.success).toBe(false);
      expect(result.result).toBeUndefined();
      expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
    });

    it('should reject non-tool message', async () => {
      const nonToolMessage: Message = {
        role: 'user',
        content: 'User message',
        tool_call_id: 'call_abc123xyz789'
      };

      const result = await handler.handleToolResult(nonToolMessage);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
    });

    it('should reject message without tool_call_id', async () => {
      const messageWithoutId: Message = {
        role: 'tool',
        content: 'Tool result'
      };

      const result = await handler.handleToolResult(messageWithoutId);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
    });

    it('should reject message without content', async () => {
      const messageWithoutContent: Message = {
        role: 'tool',
        tool_call_id: 'call_abc123xyz789'
      } as any;

      const result = await handler.handleToolResult(messageWithoutContent);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
    });

    it('should handle message with complex JSON content', async () => {
      const jsonContent = '{"status": "success", "data": {"items": [1, 2, 3]}, "timestamp": 1234567890}';
      const messageWithJson: Message = {
        role: 'tool',
        content: jsonContent,
        tool_call_id: 'call_abc123xyz789'
      };

      const result = await handler.handleToolResult(messageWithJson);

      expect(result.success).toBe(true);
      expect(result.result?.content).toBe(jsonContent);
      expect(result.result?.toolCallId).toBe('call_abc123xyz789');
    });

    it('should handle message with name metadata', async () => {
      const messageWithName: Message = {
        role: 'tool',
        content: 'Tool result with name',
        tool_call_id: 'call_abc123xyz789',
        name: 'test_tool'
      };

      const result = await handler.handleToolResult(messageWithName);

      expect(result.success).toBe(true);
      expect(result.result?.metadata).toBeDefined();
      expect(result.result?.metadata?.name).toBe('test_tool');
    });

    it('should handle timeout scenarios', async () => {
      // Mock performance.now to simulate timeout
      const originalNow = performance.now;
      let callCount = 0;
      Object.defineProperty(performance, 'now', {
        writable: true,
        value: jest.fn(() => {
          callCount++;
          if (callCount === 1) return 0; // Start time
          return MESSAGE_PROCESSING_LIMITS.RESULT_HANDLING_TIMEOUT_MS + 1; // End time exceeds limit
        })
      });

      try {
        const result = await handler.handleToolResult(validToolMessage);
        expect(result.success).toBe(false);
        expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.RESULT_TIMEOUT);
      } finally {
        Object.defineProperty(performance, 'now', {
          writable: true,
          value: originalNow
        });
      }
    });

    it('should handle processing errors gracefully', async () => {
      // Create a message that will cause internal processing error
      const problematicMessage = {
        role: 'tool',
        get content() { throw new Error('Content access error'); },
        tool_call_id: 'call_abc123xyz789'
      } as any;

      const result = await handler.handleToolResult(problematicMessage);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.RESULT_HANDLING_FAILED);
    });
  });

  describe('handleBatchToolResults', () => {
    const validMessages: Message[] = [
      {
        role: 'tool',
        content: 'First tool result',
        tool_call_id: 'call_abc123xyz789'
      },
      {
        role: 'tool',
        content: 'Second tool result',
        tool_call_id: 'call_def456uvw012'
      }
    ];

    it('should handle multiple tool results successfully', async () => {
      const result = await handler.handleBatchToolResults(validMessages);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.totalHandled).toBe(2);
      expect(result.failedResults).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.handlingTimeMs).toBeLessThan(MESSAGE_PROCESSING_LIMITS.RESULT_HANDLING_TIMEOUT_MS);
    });

    it('should handle empty array gracefully', async () => {
      const result = await handler.handleBatchToolResults([]);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(0);
      expect(result.totalHandled).toBe(0);
      expect(result.failedResults).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle null/undefined array gracefully', async () => {
      const resultNull = await handler.handleBatchToolResults(null as any);
      const resultUndefined = await handler.handleBatchToolResults(undefined as any);

      expect(resultNull.success).toBe(true);
      expect(resultNull.totalHandled).toBe(0);
      expect(resultUndefined.success).toBe(true);
      expect(resultUndefined.totalHandled).toBe(0);
    });

    it('should handle mixed valid and invalid messages', async () => {
      const mixedMessages: Message[] = [
        {
          role: 'tool',
          content: 'Valid result',
          tool_call_id: 'call_abc123xyz789'
        },
        {
          role: 'user', // Invalid role
          content: 'Invalid message',
          tool_call_id: 'call_def456uvw012'
        }
      ];

      const result = await handler.handleBatchToolResults(mixedMessages);

      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(1);
      expect(result.totalHandled).toBe(1);
      expect(result.failedResults).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle all invalid messages', async () => {
      const invalidMessages: Message[] = [
        {
          role: 'user',
          content: 'Not a tool message'
        } as any,
        {
          role: 'assistant',
          content: 'Also not a tool message'
        } as any
      ];

      const result = await handler.handleBatchToolResults(invalidMessages);

      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(0);
      expect(result.totalHandled).toBe(0);
      expect(result.failedResults).toBe(2);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle processing errors in batch', async () => {
      const problematicMessages = [
        {
          role: 'tool',
          get content() { throw new Error('Batch processing error'); },
          tool_call_id: 'call_abc123xyz789'
        }
      ] as any;

      const result = await handler.handleBatchToolResults(problematicMessages);

      expect(result.success).toBe(false);
      expect(result.failedResults).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle large batches efficiently', async () => {
      const largeBatch = Array.from({ length: 100 }, (_, i) => ({
        role: 'tool' as const,
        content: `Result ${i}`,
        tool_call_id: `call_batch${i}test${i}`
      }));

      const startTime = performance.now();
      const result = await handler.handleBatchToolResults(largeBatch);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(result.totalHandled).toBe(100);
      expect(endTime - startTime).toBeLessThan(100); // Reasonable batch processing time
    });
  });

  describe('extractToolResult', () => {
    it('should extract tool result from valid message', () => {
      const message: Message = {
        role: 'tool',
        content: 'Extraction test result',
        tool_call_id: 'call_extract123test456'
      };

      const result = handler.extractToolResult(message);

      expect(result).toBeDefined();
      expect(result?.toolCallId).toBe('call_extract123test456');
      expect(result?.content).toBe('Extraction test result');
      expect(result?.success).toBe(true);
      expect(result?.timestamp).toBeGreaterThan(0);
    });

    it('should extract result with name metadata', () => {
      const message: Message = {
        role: 'tool',
        content: 'Result with metadata',
        tool_call_id: 'call_meta123test456',
        name: 'extraction_tool'
      };

      const result = handler.extractToolResult(message);

      expect(result).toBeDefined();
      expect(result?.metadata).toBeDefined();
      expect(result?.metadata?.name).toBe('extraction_tool');
    });

    it('should handle object content by stringifying', () => {
      const objectContent = { status: 'success', data: [1, 2, 3] };
      const message: Message = {
        role: 'tool',
        content: objectContent as any,
        tool_call_id: 'call_object123test456'
      };

      const result = handler.extractToolResult(message);

      expect(result).toBeDefined();
      expect(result?.content).toBe(JSON.stringify(objectContent));
    });

    it('should trim whitespace from content', () => {
      const message: Message = {
        role: 'tool',
        content: '  \n  Trimmed content  \n  ',
        tool_call_id: 'call_trim123test456'
      };

      const result = handler.extractToolResult(message);

      expect(result).toBeDefined();
      expect(result?.content).toBe('Trimmed content');
    });

    it('should return null for invalid messages', () => {
      const invalidMessage = {} as Message;
      const result = handler.extractToolResult(invalidMessage);
      expect(result).toBeNull();
    });

    it('should return null for null/undefined messages', () => {
      expect(handler.extractToolResult(null as any)).toBeNull();
      expect(handler.extractToolResult(undefined as any)).toBeNull();
    });

    it('should handle extraction errors gracefully', () => {
      const problematicMessage = {
        role: 'tool',
        get content() { throw new Error('Content access error'); },
        tool_call_id: 'call_error123test456'
      } as any;

      const result = handler.extractToolResult(problematicMessage);
      expect(result).toBeNull();
    });
  });

  describe('validateToolResult', () => {
    it('should validate correct tool result', () => {
      const validResult: ToolResult = {
        toolCallId: 'call_valid123test456',
        content: 'Valid result content',
        success: true,
        timestamp: Date.now()
      };

      const isValid = handler.validateToolResult(validResult);
      expect(isValid).toBe(true);
    });

    it('should reject result without toolCallId', () => {
      const invalidResult = {
        content: 'Valid content',
        success: true,
        timestamp: Date.now()
      } as any;

      const isValid = handler.validateToolResult(invalidResult);
      expect(isValid).toBe(false);
    });

    it('should reject result with non-string toolCallId', () => {
      const invalidResult = {
        toolCallId: 123,
        content: 'Valid content',
        success: true,
        timestamp: Date.now()
      } as any;

      const isValid = handler.validateToolResult(invalidResult);
      expect(isValid).toBe(false);
    });

    it('should reject result without content', () => {
      const invalidResult = {
        toolCallId: 'call_valid123test456',
        success: true,
        timestamp: Date.now()
      } as any;

      const isValid = handler.validateToolResult(invalidResult);
      expect(isValid).toBe(false);
    });

    it('should reject result with non-string content', () => {
      const invalidResult = {
        toolCallId: 'call_valid123test456',
        content: 123,
        success: true,
        timestamp: Date.now()
      } as any;

      const isValid = handler.validateToolResult(invalidResult);
      expect(isValid).toBe(false);
    });

    it('should reject result with empty content', () => {
      const invalidResult: ToolResult = {
        toolCallId: 'call_valid123test456',
        content: '',
        success: true,
        timestamp: Date.now()
      };

      const isValid = handler.validateToolResult(invalidResult);
      expect(isValid).toBe(false);
    });

    it('should reject result without success field', () => {
      const invalidResult = {
        toolCallId: 'call_valid123test456',
        content: 'Valid content',
        timestamp: Date.now()
      } as any;

      const isValid = handler.validateToolResult(invalidResult);
      expect(isValid).toBe(false);
    });

    it('should reject result with non-boolean success', () => {
      const invalidResult = {
        toolCallId: 'call_valid123test456',
        content: 'Valid content',
        success: 'true',
        timestamp: Date.now()
      } as any;

      const isValid = handler.validateToolResult(invalidResult);
      expect(isValid).toBe(false);
    });

    it('should reject result without timestamp', () => {
      const invalidResult = {
        toolCallId: 'call_valid123test456',
        content: 'Valid content',
        success: true
      } as any;

      const isValid = handler.validateToolResult(invalidResult);
      expect(isValid).toBe(false);
    });

    it('should reject result with non-number timestamp', () => {
      const invalidResult = {
        toolCallId: 'call_valid123test456',
        content: 'Valid content',
        success: true,
        timestamp: 'invalid'
      } as any;

      const isValid = handler.validateToolResult(invalidResult);
      expect(isValid).toBe(false);
    });

    it('should handle validation errors gracefully', () => {
      const problematicResult = {
        get toolCallId() { throw new Error('Access error'); }
      } as any;

      const isValid = handler.validateToolResult(problematicResult);
      expect(isValid).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should create ToolResultHandlingError correctly', () => {
      const error = new ToolResultHandlingError(
        'Test handling error',
        'TEST_HANDLING_ERROR',
        3.5
      );

      expect(error.name).toBe('ToolResultHandlingError');
      expect(error.message).toBe('Test handling error');
      expect(error.code).toBe('TEST_HANDLING_ERROR');
      expect(error.handlingTimeMs).toBe(3.5);
      expect(error).toBeInstanceOf(Error);
    });

    it('should handle ToolResultHandlingError in processing', async () => {
      // Mock internal method to throw ToolResultHandlingError
      const handlerInstance = handler as any;
      const originalValidate = handlerInstance.isValidToolMessage;
      
      handlerInstance.isValidToolMessage = jest.fn(() => {
        throw new ToolResultHandlingError(
          'Validation error',
          'VALIDATION_ERROR',
          2.5
        );
      });

      try {
        const result = await handler.handleToolResult({
          role: 'tool',
          content: 'Test',
          tool_call_id: 'call_abc123xyz789'
        });

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Validation error');
      } finally {
        handlerInstance.isValidToolMessage = originalValidate;
      }
    });
  });

  describe('performance requirements', () => {
    it('should handle single result within 5ms', async () => {
      const message: Message = {
        role: 'tool',
        content: 'Performance test result',
        tool_call_id: 'call_perf123test456'
      };

      const startTime = performance.now();
      const result = await handler.handleToolResult(message);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5);
    });

    it('should handle batch results efficiently', async () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        role: 'tool' as const,
        content: `Batch result ${i}`,
        tool_call_id: `call_batch${i}test${i}`
      }));

      const startTime = performance.now();
      const result = await handler.handleBatchToolResults(messages);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(result.totalHandled).toBe(10);
      expect(endTime - startTime).toBeLessThan(50); // Reasonable batch processing time
    });
  });

  describe('edge cases', () => {
    it('should handle very long content', async () => {
      const longContent = 'B'.repeat(50000);
      const message: Message = {
        role: 'tool',
        content: longContent,
        tool_call_id: 'call_long123test456'
      };

      const result = await handler.handleToolResult(message);
      expect(result.success).toBe(true);
      expect(result.result?.content).toBe(longContent);
    });

    it('should handle unicode content', async () => {
      const unicodeContent = '工具执行结果: 成功 ✅ 🚀';
      const message: Message = {
        role: 'tool',
        content: unicodeContent,
        tool_call_id: 'call_unicode123test456'
      };

      const result = await handler.handleToolResult(message);
      expect(result.success).toBe(true);
      expect(result.result?.content).toBe(unicodeContent);
    });

    it('should handle complex nested JSON content', async () => {
      const complexJson = JSON.stringify({
        status: 'success',
        data: {
          nested: {
            array: [1, 2, { deep: 'value' }],
            map: { key1: 'value1', key2: ['a', 'b'] }
          }
        },
        metadata: { timestamp: 1234567890, version: '1.0.0' }
      });

      const message: Message = {
        role: 'tool',
        content: complexJson,
        tool_call_id: 'call_complex123test456'
      };

      const result = await handler.handleToolResult(message);
      expect(result.success).toBe(true);
      expect(result.result?.content).toBe(complexJson);
    });
  });

  describe('factory function', () => {
    it('should create handler instance via factory', () => {
      const { createToolResultHandler } = require('../../../src/tools/result-handler');
      const factoryHandler = createToolResultHandler();
      
      expect(factoryHandler).toBeInstanceOf(ToolResultHandler);
      expect(factoryHandler).toBeDefined();
    });
  });
});