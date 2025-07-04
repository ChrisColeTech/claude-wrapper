/**
 * ToolMessageProcessor Unit Tests (Phase 9A)
 * 100% test coverage for tool message processing functionality
 * Tests performance requirement: <8ms processing time
 */

import { ToolMessageProcessor, IToolMessageProcessor, ToolMessageProcessingError } from '../../../src/tools/message-processor';
import { Message } from '../../../src/models/message';
import { MESSAGE_PROCESSING_LIMITS, MESSAGE_PROCESSING_MESSAGES, MESSAGE_ROLES } from '../../../src/tools/constants';

describe('ToolMessageProcessor', () => {
  let processor: IToolMessageProcessor;

  beforeEach(() => {
    processor = new ToolMessageProcessor();
  });

  describe('constructor', () => {
    it('should create processor instance successfully', () => {
      expect(processor).toBeInstanceOf(ToolMessageProcessor);
      expect(processor).toBeDefined();
    });
  });

  describe('processToolMessage', () => {
    const validToolMessage: Message = {
      role: 'tool',
      content: 'Tool execution result',
      tool_call_id: 'call_abc123xyz789'
    };

    it('should process valid tool message successfully', async () => {
      const result = await processor.processToolMessage(validToolMessage);

      expect(result.success).toBe(true);
      expect(result.processedMessage).toBeDefined();
      expect(result.processedMessage?.role).toBe('tool');
      expect(result.processedMessage?.content).toBe('Tool execution result');
      expect(result.processedMessage?.tool_call_id).toBe('call_abc123xyz789');
      expect(result.errors).toHaveLength(0);
      expect(result.processingTimeMs).toBeLessThan(MESSAGE_PROCESSING_LIMITS.PROCESSING_TIMEOUT_MS);
    });

    it('should meet performance requirement (<8ms)', async () => {
      const startTime = performance.now();
      const result = await processor.processToolMessage(validToolMessage);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(8);
      expect(result.processingTimeMs).toBeLessThan(8);
    });

    it('should reject invalid message structure', async () => {
      const invalidMessage = {} as Message;
      const result = await processor.processToolMessage(invalidMessage);

      expect(result.success).toBe(false);
      expect(result.processedMessage).toBeUndefined();
      expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
    });

    it('should reject message without tool role', async () => {
      const nonToolMessage: Message = {
        role: 'user',
        content: 'User message',
        tool_call_id: 'call_abc123xyz789'
      };

      const result = await processor.processToolMessage(nonToolMessage);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
    });

    it('should reject message without tool_call_id', async () => {
      const messageWithoutId: Message = {
        role: 'tool',
        content: 'Tool result'
      };

      const result = await processor.processToolMessage(messageWithoutId);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
    });

    it('should reject message without content', async () => {
      const messageWithoutContent: Message = {
        role: 'tool',
        tool_call_id: 'call_abc123xyz789'
      } as any;

      const result = await processor.processToolMessage(messageWithoutContent);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
    });

    it('should reject message with invalid tool_call_id format', async () => {
      const messageWithInvalidId: Message = {
        role: 'tool',
        content: 'Tool result',
        tool_call_id: 'invalid-format'
      };

      const result = await processor.processToolMessage(messageWithInvalidId);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.TOOL_CALL_ID_INVALID);
    });

    it('should handle empty content gracefully', async () => {
      const messageWithEmptyContent: Message = {
        role: 'tool',
        content: '',
        tool_call_id: 'call_abc123xyz789'
      };

      const result = await processor.processToolMessage(messageWithEmptyContent);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
    });

    it('should handle timeout scenarios', async () => {
      // Mock performance.now to simulate timeout
      const originalNow = performance.now;
      let callCount = 0;
      performance.now = jest.fn(() => {
        callCount++;
        if (callCount === 1) return 0; // Start time
        return MESSAGE_PROCESSING_LIMITS.PROCESSING_TIMEOUT_MS + 1; // End time exceeds limit
      });

      try {
        const result = await processor.processToolMessage(validToolMessage);
        expect(result.success).toBe(false);
        expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.PROCESSING_TIMEOUT);
      } finally {
        performance.now = originalNow;
      }
    });

    it('should handle processing errors gracefully', async () => {
      // Create a message that will cause internal processing error
      const problematicMessage = {
        role: 'tool',
        get content() { throw new Error('Content access error'); },
        tool_call_id: 'call_abc123xyz789'
      } as any;

      const result = await processor.processToolMessage(problematicMessage);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.PROCESSING_FAILED);
    });
  });

  describe('processBatchToolMessages', () => {
    const validMessages: Message[] = [
      {
        role: 'tool',
        content: 'Result 1',
        tool_call_id: 'call_abc123xyz789'
      },
      {
        role: 'tool',
        content: 'Result 2',
        tool_call_id: 'call_def456uvw012'
      }
    ];

    it('should process multiple tool messages successfully', async () => {
      const result = await processor.processBatchToolMessages(validMessages);

      expect(result.success).toBe(true);
      expect(result.processedMessages).toHaveLength(2);
      expect(result.totalProcessed).toBe(2);
      expect(result.failedMessages).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.processingTimeMs).toBeLessThan(MESSAGE_PROCESSING_LIMITS.PROCESSING_TIMEOUT_MS);
    });

    it('should handle empty array gracefully', async () => {
      const result = await processor.processBatchToolMessages([]);

      expect(result.success).toBe(true);
      expect(result.processedMessages).toHaveLength(0);
      expect(result.totalProcessed).toBe(0);
      expect(result.failedMessages).toBe(0);
      expect(result.errors).toHaveLength(0);
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

      const result = await processor.processBatchToolMessages(mixedMessages);

      expect(result.success).toBe(false);
      expect(result.processedMessages).toHaveLength(1);
      expect(result.totalProcessed).toBe(1);
      expect(result.failedMessages).toBe(1);
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

      const result = await processor.processBatchToolMessages(invalidMessages);

      expect(result.success).toBe(false);
      expect(result.processedMessages).toHaveLength(0);
      expect(result.totalProcessed).toBe(0);
      expect(result.failedMessages).toBe(2);
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

      const result = await processor.processBatchToolMessages(problematicMessages);

      expect(result.success).toBe(false);
      expect(result.failedMessages).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateToolMessage', () => {
    it('should validate correct tool message', () => {
      const validMessage: Message = {
        role: 'tool',
        content: 'Tool result',
        tool_call_id: 'call_abc123xyz789'
      };

      const isValid = processor.validateToolMessage(validMessage);
      expect(isValid).toBe(true);
    });

    it('should reject message with wrong role', () => {
      const invalidMessage: Message = {
        role: 'user',
        content: 'Tool result',
        tool_call_id: 'call_abc123xyz789'
      };

      const isValid = processor.validateToolMessage(invalidMessage);
      expect(isValid).toBe(false);
    });

    it('should reject message without tool_call_id', () => {
      const invalidMessage: Message = {
        role: 'tool',
        content: 'Tool result'
      };

      const isValid = processor.validateToolMessage(invalidMessage);
      expect(isValid).toBe(false);
    });

    it('should reject message without content', () => {
      const invalidMessage: Message = {
        role: 'tool',
        tool_call_id: 'call_abc123xyz789'
      } as any;

      const isValid = processor.validateToolMessage(invalidMessage);
      expect(isValid).toBe(false);
    });

    it('should handle null/undefined messages', () => {
      expect(processor.validateToolMessage(null as any)).toBe(false);
      expect(processor.validateToolMessage(undefined as any)).toBe(false);
    });
  });

  describe('extractToolCallId', () => {
    it('should extract tool call ID from valid message', () => {
      const message: Message = {
        role: 'tool',
        content: 'Tool result',
        tool_call_id: 'call_abc123xyz789'
      };

      const toolCallId = processor.extractToolCallId(message);
      expect(toolCallId).toBe('call_abc123xyz789');
    });

    it('should return null for message without tool_call_id', () => {
      const message: Message = {
        role: 'tool',
        content: 'Tool result'
      };

      const toolCallId = processor.extractToolCallId(message);
      expect(toolCallId).toBeNull();
    });

    it('should return null for null/undefined messages', () => {
      expect(processor.extractToolCallId(null as any)).toBeNull();
      expect(processor.extractToolCallId(undefined as any)).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should create ToolMessageProcessingError correctly', () => {
      const error = new ToolMessageProcessingError(
        'Test error message',
        'TEST_ERROR',
        5.5
      );

      expect(error.name).toBe('ToolMessageProcessingError');
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.processingTimeMs).toBe(5.5);
      expect(error).toBeInstanceOf(Error);
    });

    it('should handle ToolMessageProcessingError in processing', async () => {
      // Mock internal method to throw ToolMessageProcessingError
      const processorInstance = processor as any;
      const originalValidate = processorInstance.validateToolMessageWithErrors;
      
      processorInstance.validateToolMessageWithErrors = jest.fn(() => {
        throw new ToolMessageProcessingError(
          'Validation error',
          'VALIDATION_ERROR',
          2.5
        );
      });

      try {
        const result = await processor.processToolMessage({
          role: 'tool',
          content: 'Test',
          tool_call_id: 'call_abc123xyz789'
        });

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Validation error');
      } finally {
        processorInstance.validateToolMessageWithErrors = originalValidate;
      }
    });
  });

  describe('performance requirements', () => {
    it('should process single message within 8ms', async () => {
      const message: Message = {
        role: 'tool',
        content: 'Performance test result',
        tool_call_id: 'call_perf123test456'
      };

      const startTime = performance.now();
      const result = await processor.processToolMessage(message);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(8);
    });

    it('should process batch messages efficiently', async () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        role: 'tool' as const,
        content: `Batch result ${i}`,
        tool_call_id: `call_batch${i}test${i}`
      }));

      const startTime = performance.now();
      const result = await processor.processBatchToolMessages(messages);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(result.totalProcessed).toBe(10);
      expect(endTime - startTime).toBeLessThan(50); // Reasonable batch processing time
    });
  });

  describe('edge cases', () => {
    it('should handle very long content', async () => {
      const longContent = 'A'.repeat(10000);
      const message: Message = {
        role: 'tool',
        content: longContent,
        tool_call_id: 'call_abc123xyz789'
      };

      const result = await processor.processToolMessage(message);
      expect(result.success).toBe(true);
      expect(result.processedMessage?.content).toBe(longContent);
    });

    it('should handle special characters in content', async () => {
      const specialContent = '{"result": "success", "data": [1, 2, 3], "nested": {"key": "value"}}';
      const message: Message = {
        role: 'tool',
        content: specialContent,
        tool_call_id: 'call_abc123xyz789'
      };

      const result = await processor.processToolMessage(message);
      expect(result.success).toBe(true);
      expect(result.processedMessage?.content).toBe(specialContent);
    });

    it('should handle unicode content', async () => {
      const unicodeContent = '处理结果: 成功 ✅ 🎉';
      const message: Message = {
        role: 'tool',
        content: unicodeContent,
        tool_call_id: 'call_abc123xyz789'
      };

      const result = await processor.processToolMessage(message);
      expect(result.success).toBe(true);
      expect(result.processedMessage?.content).toBe(unicodeContent);
    });
  });

  describe('factory function', () => {
    it('should create processor instance via factory', () => {
      const { createToolMessageProcessor } = require('../../../src/tools/message-processor');
      const factoryProcessor = createToolMessageProcessor();
      
      expect(factoryProcessor).toBeInstanceOf(ToolMessageProcessor);
      expect(factoryProcessor).toBeDefined();
    });
  });
});