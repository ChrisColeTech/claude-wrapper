/**
 * ToolCallCorrelationService Unit Tests (Phase 9A)
 * 100% test coverage for tool call correlation functionality
 * Tests performance requirement: <3ms correlation time
 */

import { 
  ToolCallCorrelationService, 
  IToolCallCorrelationService, 
  ToolCorrelationError, 
  ToolCallCorrelation 
} from '../../../src/tools/correlation-service';
import { Message } from '../../../src/models/message';
import { 
  MESSAGE_PROCESSING_LIMITS, 
  MESSAGE_PROCESSING_MESSAGES, 
  MESSAGE_PROCESSING_ERRORS 
} from '../../../src/tools/constants';

describe('ToolCallCorrelationService', () => {
  let service: IToolCallCorrelationService;

  beforeEach(() => {
    service = new ToolCallCorrelationService();
  });

  describe('constructor', () => {
    it('should create service instance successfully', () => {
      expect(service).toBeInstanceOf(ToolCallCorrelationService);
      expect(service).toBeDefined();
    });
  });

  describe('correlateToolCall', () => {
    const validToolCallId = 'call_abc123xyz789';

    it('should correlate valid tool call successfully', async () => {
      const result = await service.correlateToolCall(validToolCallId);

      expect(result.success).toBe(true);
      expect(result.correlation).toBeDefined();
      expect(result.correlation?.toolCallId).toBe(validToolCallId);
      expect(result.correlation?.status).toBe('pending');
      expect(result.correlation?.timestamp).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
      expect(result.correlationTimeMs).toBeLessThan(MESSAGE_PROCESSING_LIMITS.CORRELATION_TIMEOUT_MS);
    });

    it('should meet performance requirement (<3ms)', async () => {
      const startTime = performance.now();
      const result = await service.correlateToolCall(validToolCallId);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(3);
      expect(result.correlationTimeMs).toBeLessThan(3);
    });

    it('should correlate with session ID', async () => {
      const sessionId = 'session_test123';
      const result = await service.correlateToolCall(validToolCallId, sessionId);

      expect(result.success).toBe(true);
      expect(result.correlation?.sessionId).toBe(sessionId);
    });

    it('should reject invalid tool call ID format', async () => {
      const invalidId = 'invalid-format';
      const result = await service.correlateToolCall(invalidId);

      expect(result.success).toBe(false);
      expect(result.correlation).toBeUndefined();
      expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.TOOL_CALL_ID_INVALID);
    });

    it('should reject empty tool call ID', async () => {
      const result = await service.correlateToolCall('');

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.TOOL_CALL_ID_INVALID);
    });

    it('should reject null/undefined tool call ID', async () => {
      const resultNull = await service.correlateToolCall(null as any);
      const resultUndefined = await service.correlateToolCall(undefined as any);

      expect(resultNull.success).toBe(false);
      expect(resultUndefined.success).toBe(false);
    });

    it('should reject duplicate tool call ID', async () => {
      // First correlation should succeed
      const firstResult = await service.correlateToolCall(validToolCallId);
      expect(firstResult.success).toBe(true);

      // Second correlation should fail
      const secondResult = await service.correlateToolCall(validToolCallId);
      expect(secondResult.success).toBe(false);
      expect(secondResult.errors).toContain(MESSAGE_PROCESSING_MESSAGES.DUPLICATE_TOOL_CALL_ID);
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
          return MESSAGE_PROCESSING_LIMITS.CORRELATION_TIMEOUT_MS + 1; // End time exceeds limit
        })
      });

      try {
        const result = await service.correlateToolCall(validToolCallId);
        expect(result.success).toBe(false);
        expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.CORRELATION_TIMEOUT);
      } finally {
        Object.defineProperty(performance, 'now', {
          writable: true,
          value: originalNow
        });
      }
    });

    it('should handle processing errors gracefully', async () => {
      // Mock internal method to throw error
      const serviceInstance = service as any;
      const originalValidate = serviceInstance.isValidToolCallId;
      
      serviceInstance.isValidToolCallId = jest.fn(() => {
        throw new Error('Validation error');
      });

      try {
        const result = await service.correlateToolCall(validToolCallId);
        expect(result.success).toBe(false);
        expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.CORRELATION_FAILED);
      } finally {
        serviceInstance.isValidToolCallId = originalValidate;
      }
    });
  });

  describe('correlateToolResult', () => {
    const validToolMessage: Message = {
      role: 'tool',
      content: 'Tool execution result',
      tool_call_id: 'call_result123test456'
    };

    it('should correlate tool result with existing correlation', async () => {
      // First establish correlation
      await service.correlateToolCall(validToolMessage.tool_call_id!);

      // Then correlate result
      const result = await service.correlateToolResult(validToolMessage);

      expect(result.success).toBe(true);
      expect(result.correlation).toBeDefined();
      expect(result.correlation?.status).toBe('completed');
      expect(result.errors).toHaveLength(0);
      expect(result.correlationTimeMs).toBeLessThan(MESSAGE_PROCESSING_LIMITS.CORRELATION_TIMEOUT_MS);
    });

    it('should meet performance requirement (<3ms)', async () => {
      // First establish correlation
      await service.correlateToolCall(validToolMessage.tool_call_id!);

      const startTime = performance.now();
      const result = await service.correlateToolResult(validToolMessage);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(3);
      expect(result.correlationTimeMs).toBeLessThan(3);
    });

    it('should reject invalid tool message', async () => {
      const invalidMessage = {} as Message;
      const result = await service.correlateToolResult(invalidMessage);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
    });

    it('should reject non-tool message', async () => {
      const nonToolMessage: Message = {
        role: 'user',
        content: 'Not a tool message',
        tool_call_id: 'call_notool123test456'
      };

      const result = await service.correlateToolResult(nonToolMessage);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
    });

    it('should reject message without tool_call_id', async () => {
      const messageWithoutId: Message = {
        role: 'tool',
        content: 'Tool result'
      };

      const result = await service.correlateToolResult(messageWithoutId);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
    });

    it('should reject message without content', async () => {
      const messageWithoutContent: Message = {
        role: 'tool',
        tool_call_id: 'call_nocontent123test456'
      } as any;

      const result = await service.correlateToolResult(messageWithoutContent);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
    });

    it('should reject result without existing correlation', async () => {
      const orphanMessage: Message = {
        role: 'tool',
        content: 'Orphan result',
        tool_call_id: 'call_orphan123test456'
      };

      const result = await service.correlateToolResult(orphanMessage);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.TOOL_CALL_NOT_FOUND);
    });

    it('should handle timeout scenarios', async () => {
      // First establish correlation
      await service.correlateToolCall(validToolMessage.tool_call_id!);

      // Mock performance.now to simulate timeout
      const originalNow = performance.now;
      let callCount = 0;
      Object.defineProperty(performance, 'now', {
        writable: true,
        value: jest.fn(() => {
          callCount++;
          if (callCount === 1) return 0; // Start time
          return MESSAGE_PROCESSING_LIMITS.CORRELATION_TIMEOUT_MS + 1; // End time exceeds limit
        })
      });

      try {
        const result = await service.correlateToolResult(validToolMessage);
        expect(result.success).toBe(false);
        expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.CORRELATION_TIMEOUT);
      } finally {
        Object.defineProperty(performance, 'now', {
          writable: true,
          value: originalNow
        });
      }
    });

    it('should handle processing errors gracefully', async () => {
      // First establish correlation
      await service.correlateToolCall(validToolMessage.tool_call_id!);

      // Mock internal method to throw error
      const serviceInstance = service as any;
      const originalValidate = serviceInstance.isValidToolMessage;
      
      serviceInstance.isValidToolMessage = jest.fn(() => {
        throw new Error('Validation error');
      });

      try {
        const result = await service.correlateToolResult(validToolMessage);
        expect(result.success).toBe(false);
        expect(result.errors).toContain(MESSAGE_PROCESSING_MESSAGES.CORRELATION_FAILED);
      } finally {
        serviceInstance.isValidToolMessage = originalValidate;
      }
    });
  });

  describe('getCorrelation', () => {
    const testToolCallId = 'call_get123test456';

    it('should return correlation for existing tool call ID', async () => {
      // First establish correlation
      await service.correlateToolCall(testToolCallId);

      const correlation = service.getCorrelation(testToolCallId);

      expect(correlation).toBeDefined();
      expect(correlation?.toolCallId).toBe(testToolCallId);
      expect(correlation?.status).toBe('pending');
    });

    it('should return null for non-existing tool call ID', () => {
      const correlation = service.getCorrelation('call_nonexistent123test456');
      expect(correlation).toBeNull();
    });

    it('should return null for empty tool call ID', () => {
      const correlation = service.getCorrelation('');
      expect(correlation).toBeNull();
    });
  });

  describe('hasCorrelation', () => {
    const testToolCallId = 'call_has123test456';

    it('should return true for existing correlation', async () => {
      // First establish correlation
      await service.correlateToolCall(testToolCallId);

      const hasCorrelation = service.hasCorrelation(testToolCallId);
      expect(hasCorrelation).toBe(true);
    });

    it('should return false for non-existing correlation', () => {
      const hasCorrelation = service.hasCorrelation('call_nonexistent123test456');
      expect(hasCorrelation).toBe(false);
    });

    it('should return false for empty tool call ID', () => {
      const hasCorrelation = service.hasCorrelation('');
      expect(hasCorrelation).toBe(false);
    });
  });

  describe('removeCorrelation', () => {
    const testToolCallId = 'call_remove123test456';

    it('should remove existing correlation', async () => {
      // First establish correlation
      await service.correlateToolCall(testToolCallId);
      expect(service.hasCorrelation(testToolCallId)).toBe(true);

      // Remove correlation
      const removed = service.removeCorrelation(testToolCallId);

      expect(removed).toBe(true);
      expect(service.hasCorrelation(testToolCallId)).toBe(false);
    });

    it('should return false for non-existing correlation', () => {
      const removed = service.removeCorrelation('call_nonexistent123test456');
      expect(removed).toBe(false);
    });

    it('should return false for empty tool call ID', () => {
      const removed = service.removeCorrelation('');
      expect(removed).toBe(false);
    });
  });

  describe('clearSession', () => {
    const sessionId = 'session_clear123test';

    it('should clear all correlations for a session', async () => {
      // Establish multiple correlations for the session
      await service.correlateToolCall('call_session1', sessionId);
      await service.correlateToolCall('call_session2', sessionId);
      await service.correlateToolCall('call_session3', sessionId);

      // Also add correlation for different session
      await service.correlateToolCall('call_other1', 'other_session');

      // Clear target session
      const removedCount = service.clearSession(sessionId);

      expect(removedCount).toBe(3);
      expect(service.hasCorrelation('call_session1')).toBe(false);
      expect(service.hasCorrelation('call_session2')).toBe(false);
      expect(service.hasCorrelation('call_session3')).toBe(false);
      expect(service.hasCorrelation('call_other1')).toBe(true); // Should remain
    });

    it('should return zero for non-existing session', () => {
      const removedCount = service.clearSession('nonexistent_session');
      expect(removedCount).toBe(0);
    });

    it('should handle empty session ID', () => {
      const removedCount = service.clearSession('');
      expect(removedCount).toBe(0);
    });

    it('should handle correlations without session ID', async () => {
      // Add correlation without session ID
      await service.correlateToolCall('call_nosession123');

      const removedCount = service.clearSession('any_session');
      expect(removedCount).toBe(0);
      expect(service.hasCorrelation('call_nosession123')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return correct stats for empty service', () => {
      const stats = (service as any).getStats();

      expect(stats.totalCorrelations).toBe(0);
      expect(stats.pendingCorrelations).toBe(0);
      expect(stats.completedCorrelations).toBe(0);
      expect(stats.failedCorrelations).toBe(0);
    });

    it('should return correct stats with correlations', async () => {
      // Add pending correlations
      await service.correlateToolCall('call_pending1');
      await service.correlateToolCall('call_pending2');

      // Add completed correlation
      await service.correlateToolCall('call_completed1');
      const completedMessage: Message = {
        role: 'tool',
        content: 'Completed result',
        tool_call_id: 'call_completed1'
      };
      await service.correlateToolResult(completedMessage);

      // Manually set failed correlation for testing
      const serviceInstance = service as any;
      const correlation = serviceInstance.correlations.get('call_pending1');
      if (correlation) {
        correlation.status = 'failed';
      }

      const stats = serviceInstance.getStats();

      expect(stats.totalCorrelations).toBe(3);
      expect(stats.pendingCorrelations).toBe(1);
      expect(stats.completedCorrelations).toBe(1);
      expect(stats.failedCorrelations).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should create ToolCorrelationError correctly', () => {
      const error = new ToolCorrelationError(
        'Test correlation error',
        'TEST_CORRELATION_ERROR',
        2.5
      );

      expect(error.name).toBe('ToolCorrelationError');
      expect(error.message).toBe('Test correlation error');
      expect(error.code).toBe('TEST_CORRELATION_ERROR');
      expect(error.correlationTimeMs).toBe(2.5);
      expect(error).toBeInstanceOf(Error);
    });

    it('should handle ToolCorrelationError in correlation', async () => {
      // Mock internal method to throw ToolCorrelationError
      const serviceInstance = service as any;
      const originalValidate = serviceInstance.isValidToolCallId;
      
      serviceInstance.isValidToolCallId = jest.fn(() => {
        throw new ToolCorrelationError(
          'Validation error',
          'VALIDATION_ERROR',
          1.5
        );
      });

      try {
        const result = await service.correlateToolCall('call_error123test456');
        expect(result.success).toBe(false);
        expect(result.errors).toContain('Validation error');
      } finally {
        serviceInstance.isValidToolCallId = originalValidate;
      }
    });
  });

  describe('performance requirements', () => {
    it('should correlate tool call within 3ms', async () => {
      const startTime = performance.now();
      const result = await service.correlateToolCall('call_perf123test456');
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(3);
    });

    it('should correlate tool result within 3ms', async () => {
      const toolCallId = 'call_perfresult123test456';
      
      // First establish correlation
      await service.correlateToolCall(toolCallId);

      const message: Message = {
        role: 'tool',
        content: 'Performance result',
        tool_call_id: toolCallId
      };

      const startTime = performance.now();
      const result = await service.correlateToolResult(message);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(3);
    });

    it('should handle multiple correlations efficiently', async () => {
      const correlations = Array.from({ length: 100 }, (_, i) => 
        `call_multi${i}test${i}`
      );

      const startTime = performance.now();
      
      for (const toolCallId of correlations) {
        await service.correlateToolCall(toolCallId);
      }
      
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(300); // 3ms per correlation * 100
    });
  });

  describe('edge cases', () => {
    it('should handle very long tool call IDs', async () => {
      const longId = 'call_' + 'a'.repeat(100) + '123test456';
      
      // This should fail validation due to pattern mismatch (too long)
      const result = await service.correlateToolCall(longId);
      expect(result.success).toBe(false);
    });

    it('should handle special characters in tool call ID', async () => {
      const specialId = 'call_special!@#$%^&*()123test456';
      
      // This should fail validation due to pattern mismatch
      const result = await service.correlateToolCall(specialId);
      expect(result.success).toBe(false);
    });

    it('should handle unicode in tool call ID', async () => {
      const unicodeId = 'call_测试123test456';
      
      // This should fail validation due to pattern mismatch
      const result = await service.correlateToolCall(unicodeId);
      expect(result.success).toBe(false);
    });

    it('should handle rapid correlation and removal', async () => {
      const toolCallId = 'call_rapid123test456';

      // Rapid correlation
      const correlateResult = await service.correlateToolCall(toolCallId);
      expect(correlateResult.success).toBe(true);

      // Immediate check
      expect(service.hasCorrelation(toolCallId)).toBe(true);

      // Rapid removal
      const removed = service.removeCorrelation(toolCallId);
      expect(removed).toBe(true);

      // Immediate check after removal
      expect(service.hasCorrelation(toolCallId)).toBe(false);
    });

    it('should handle correlation state transitions', async () => {
      const toolCallId = 'call_transition123test456';

      // Start with pending
      await service.correlateToolCall(toolCallId);
      let correlation = service.getCorrelation(toolCallId);
      expect(correlation?.status).toBe('pending');

      // Complete the correlation
      const message: Message = {
        role: 'tool',
        content: 'Transition result',
        tool_call_id: toolCallId
      };
      await service.correlateToolResult(message);
      
      correlation = service.getCorrelation(toolCallId);
      expect(correlation?.status).toBe('completed');
    });
  });

  describe('factory function', () => {
    it('should create service instance via factory', () => {
      const { createToolCallCorrelationService } = require('../../../src/tools/correlation-service');
      const factoryService = createToolCallCorrelationService();
      
      expect(factoryService).toBeInstanceOf(ToolCallCorrelationService);
      expect(factoryService).toBeDefined();
    });
  });
});