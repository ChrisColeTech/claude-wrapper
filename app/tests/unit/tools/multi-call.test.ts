/**
 * Multi-Tool Call Handler Unit Tests
 * Phase 7A: Multi-Tool Support Implementation
 * 
 * Tests multiple tool call handling in OpenAI format with parallel processing
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  MultiToolCallHandler,
  MultiToolCallError,
  MultiToolCallUtils
} from '../../../src/tools/multi-call';
import { 
  MultiToolCallRequest,
  MultiToolCallResult,
  OpenAIToolCall,
  OpenAITool,
  IMultiToolCallHandler
} from '../../../src/tools/types';
import { MULTI_TOOL_LIMITS, MULTI_TOOL_MESSAGES } from '../../../src/tools/constants';

describe('MultiToolCallHandler', () => {
  let handler: IMultiToolCallHandler;
  let sampleTools: OpenAITool[];
  let sampleToolCalls: OpenAIToolCall[];

  beforeEach(() => {
    handler = new MultiToolCallHandler();
    
    sampleTools = [
      {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read a file',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string' }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'write_file',
          description: 'Write to a file',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['path', 'content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_files',
          description: 'Search for files',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' }
            },
            required: ['query']
          }
        }
      }
    ];

    sampleToolCalls = [
      {
        id: 'call_ABC123DEF456GHI789JKL012M',
        type: 'function',
        function: {
          name: 'read_file',
          arguments: JSON.stringify({ path: '/test/file1.txt' })
        }
      },
      {
        id: 'call_DEF456GHI789JKL012MNO345A',
        type: 'function',
        function: {
          name: 'write_file',
          arguments: JSON.stringify({ path: '/test/file2.txt', content: 'Hello World' })
        }
      }
    ];
  });

  describe('processMultipleToolCalls', () => {
    it('should process multiple tool calls successfully', async () => {
      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: sampleToolCalls,
        sessionId: 'session-123',
        parallel: false
      };

      const result = await handler.processMultipleToolCalls(request);

      expect(result.success).toBe(true);
      expect(result.toolCalls).toHaveLength(2);
      expect(result.results).toHaveLength(2);
      expect(result.errors).toEqual([]);
      expect(result.processingTimeMs).toBeGreaterThan(0);
      expect(result.parallelProcessed).toBe(false);
    });

    it('should handle empty tool calls array', async () => {
      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: [],
        sessionId: 'session-123'
      };

      const result = await handler.processMultipleToolCalls(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MULTI_TOOL_MESSAGES.INVALID_MULTI_CALL_STRUCTURE);
    });

    it('should handle too many parallel calls', async () => {
      const manyToolCalls = Array(MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS + 1).fill(null).map((_, i) => ({
        id: `call_${i.toString().padStart(25, '0')}`,
        type: 'function' as const,
        function: {
          name: 'read_file',
          arguments: JSON.stringify({ path: `/file${i}.txt` })
        }
      }));

      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: manyToolCalls,
        sessionId: 'session-123'
      };

      const result = await handler.processMultipleToolCalls(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MULTI_TOOL_MESSAGES.INVALID_MULTI_CALL_STRUCTURE);
    });

    it('should handle tool not found error', async () => {
      const toolCallWithUnknownTool: OpenAIToolCall = {
        id: 'call_UNKNOWN123456789012345678901',
        type: 'function',
        function: {
          name: 'unknown_tool',
          arguments: JSON.stringify({ param: 'value' })
        }
      };

      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: [toolCallWithUnknownTool],
        sessionId: 'session-123'
      };

      const result = await handler.processMultipleToolCalls(request);

      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].errors[0]).toContain('Tool \'unknown_tool\' not found');
    });

    it('should handle duplicate tool call IDs', async () => {
      const duplicateToolCalls = [
        sampleToolCalls[0],
        { ...sampleToolCalls[1], id: sampleToolCalls[0].id } // Same ID as first call
      ];

      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: duplicateToolCalls,
        sessionId: 'session-123'
      };

      const result = await handler.processMultipleToolCalls(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(MULTI_TOOL_MESSAGES.INVALID_MULTI_CALL_STRUCTURE);
    });

    it('should process tool calls with parallel flag', async () => {
      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: sampleToolCalls,
        sessionId: 'session-123',
        parallel: true
      };

      const result = await handler.processMultipleToolCalls(request);

      expect(result.success).toBe(true);
      expect(result.parallelProcessed).toBe(true);
    });

    it('should handle mixed success and failure results', async () => {
      const mixedToolCalls: OpenAIToolCall[] = [
        sampleToolCalls[0], // Should succeed
        {
          id: 'call_UNKNOWN123456789012345678901',
          type: 'function',
          function: {
            name: 'unknown_tool',
            arguments: JSON.stringify({ param: 'value' })
          }
        } // Should fail
      ];

      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: mixedToolCalls,
        sessionId: 'session-123'
      };

      const result = await handler.processMultipleToolCalls(request);

      expect(result.success).toBe(false); // Overall failure due to one failed call
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateMultiToolRequest', () => {
    it('should validate correct multi-tool request', () => {
      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: sampleToolCalls,
        sessionId: 'session-123'
      };

      const isValid = handler.validateMultiToolRequest(request);
      expect(isValid).toBe(true);
    });

    it('should reject invalid request structure', () => {
      const invalidRequest = null as any;
      const isValid = handler.validateMultiToolRequest(invalidRequest);
      expect(isValid).toBe(false);
    });

    it('should reject request with missing tools', () => {
      const request = {
        toolCalls: sampleToolCalls,
        sessionId: 'session-123'
      } as any;

      const isValid = handler.validateMultiToolRequest(request);
      expect(isValid).toBe(false);
    });

    it('should reject request with missing toolCalls', () => {
      const request = {
        tools: sampleTools,
        sessionId: 'session-123'
      } as any;

      const isValid = handler.validateMultiToolRequest(request);
      expect(isValid).toBe(false);
    });
  });

  describe('createMultiToolResponse', () => {
    it('should create OpenAI-compatible response for successful result', () => {
      const mockResult: MultiToolCallResult = {
        success: true,
        toolCalls: sampleToolCalls,
        results: [
          {
            success: true,
            toolCallId: sampleToolCalls[0].id,
            toolName: 'read_file',
            result: { status: 'ready_for_execution' },
            errors: [],
            processingTimeMs: 5
          },
          {
            success: true,
            toolCallId: sampleToolCalls[1].id,
            toolName: 'write_file',
            result: { status: 'ready_for_execution' },
            errors: [],
            processingTimeMs: 7
          }
        ],
        errors: [],
        processingTimeMs: 12,
        parallelProcessed: false
      };

      const response = handler.createMultiToolResponse(mockResult);

      expect(response).toHaveProperty('tool_calls');
      expect(response.tool_calls).toEqual(sampleToolCalls);
      expect(response.finish_reason).toBe('tool_calls');
      expect(response.processing_metadata).toEqual({
        success: true,
        total_calls: 2,
        successful_calls: 2,
        failed_calls: 0,
        processing_time_ms: 12,
        parallel_processed: false
      });
    });

    it('should create response for failed result', () => {
      const mockResult: MultiToolCallResult = {
        success: false,
        toolCalls: sampleToolCalls,
        results: [
          {
            success: false,
            toolCallId: sampleToolCalls[0].id,
            toolName: 'read_file',
            errors: ['File not found'],
            processingTimeMs: 3
          }
        ],
        errors: ['Processing failed'],
        processingTimeMs: 5,
        parallelProcessed: false
      };

      const response = handler.createMultiToolResponse(mockResult);

      expect(response.finish_reason).toBe('stop');
      expect(response.processing_metadata.success).toBe(false);
      expect(response.processing_metadata.failed_calls).toBe(1);
    });
  });

  describe('getProcessingStats', () => {
    it('should return accurate processing statistics', async () => {
      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: sampleToolCalls,
        sessionId: 'session-123'
      };

      // Process multiple requests to test stats
      await handler.processMultipleToolCalls(request);
      await handler.processMultipleToolCalls(request);

      const stats = (handler as MultiToolCallHandler).getProcessingStats();

      expect(stats.totalRequests).toBe(2);
      expect(stats.successfulRequests).toBe(2);
      expect(stats.failedRequests).toBe(0);
      expect(stats.totalToolCalls).toBe(4);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
      expect(stats.averageToolCallsPerRequest).toBe(2);
      expect(stats.successRate).toBe(1);
    });

    it('should handle division by zero in statistics', () => {
      const stats = (handler as MultiToolCallHandler).getProcessingStats();

      expect(stats.totalRequests).toBe(0);
      expect(stats.averageProcessingTime).toBe(0);
      expect(stats.averageToolCallsPerRequest).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics to zero', async () => {
      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: sampleToolCalls,
        sessionId: 'session-123'
      };

      await handler.processMultipleToolCalls(request);
      (handler as MultiToolCallHandler).resetStats();

      const stats = (handler as MultiToolCallHandler).getProcessingStats();

      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
      expect(stats.totalToolCalls).toBe(0);
      expect(stats.totalProcessingTime).toBe(0);
    });
  });
});

describe('MultiToolCallUtils', () => {
  let sampleToolCalls: OpenAIToolCall[];

  beforeEach(() => {
    sampleToolCalls = [
      {
        id: 'call_ABC123DEF456GHI789JKL012M',
        type: 'function',
        function: {
          name: 'read_file',
          arguments: JSON.stringify({ path: '/test/file1.txt' })
        }
      },
      {
        id: 'call_DEF456GHI789JKL012MNO345A',
        type: 'function',
        function: {
          name: 'write_file',
          arguments: JSON.stringify({ path: '/test/file2.txt', content: 'Hello' })
        }
      }
    ];
  });

  describe('validateRequest', () => {
    it('should validate correct multi-tool request', () => {
      const request: MultiToolCallRequest = {
        tools: [],
        toolCalls: sampleToolCalls,
        sessionId: 'session-123'
      };

      const isValid = MultiToolCallUtils.validateRequest(request);
      expect(isValid).toBe(true);
    });

    it('should reject null request', () => {
      const isValid = MultiToolCallUtils.validateRequest(null as any);
      expect(isValid).toBe(false);
    });

    it('should reject request with non-array tools', () => {
      const request = {
        tools: 'not-array',
        toolCalls: sampleToolCalls
      } as any;

      const isValid = MultiToolCallUtils.validateRequest(request);
      expect(isValid).toBe(false);
    });

    it('should reject request with empty tool calls', () => {
      const request: MultiToolCallRequest = {
        tools: [],
        toolCalls: [],
        sessionId: 'session-123'
      };

      const isValid = MultiToolCallUtils.validateRequest(request);
      expect(isValid).toBe(false);
    });

    it('should reject request with too many tool calls', () => {
      const manyToolCalls = Array(MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS + 1).fill(null).map((_, i) => ({
        id: `call_${i.toString().padStart(25, '0')}`,
        type: 'function' as const,
        function: {
          name: 'test_tool',
          arguments: '{}'
        }
      }));

      const request: MultiToolCallRequest = {
        tools: [],
        toolCalls: manyToolCalls,
        sessionId: 'session-123'
      };

      const isValid = MultiToolCallUtils.validateRequest(request);
      expect(isValid).toBe(false);
    });

    it('should reject tool calls with missing IDs', () => {
      const invalidToolCalls = [
        {
          type: 'function' as const,
          function: {
            name: 'test_tool',
            arguments: '{}'
          }
        }
      ] as any;

      const request: MultiToolCallRequest = {
        tools: [],
        toolCalls: invalidToolCalls,
        sessionId: 'session-123'
      };

      const isValid = MultiToolCallUtils.validateRequest(request);
      expect(isValid).toBe(false);
    });

    it('should reject tool calls with duplicate IDs', () => {
      const duplicateToolCalls = [
        sampleToolCalls[0],
        { ...sampleToolCalls[1], id: sampleToolCalls[0].id }
      ];

      const request: MultiToolCallRequest = {
        tools: [],
        toolCalls: duplicateToolCalls,
        sessionId: 'session-123'
      };

      const isValid = MultiToolCallUtils.validateRequest(request);
      expect(isValid).toBe(false);
    });
  });

  describe('createResult', () => {
    it('should create result with all fields', () => {
      const startTime = performance.now();
      
      const result = MultiToolCallUtils.createResult(
        true,
        sampleToolCalls,
        [],
        [],
        startTime,
        true
      );

      expect(result.success).toBe(true);
      expect(result.toolCalls).toEqual(sampleToolCalls);
      expect(result.results).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.parallelProcessed).toBe(true);
    });

    it('should create result without timing', () => {
      const result = MultiToolCallUtils.createResult(
        false,
        [],
        [],
        ['Error message']
      );

      expect(result.success).toBe(false);
      expect(result.processingTimeMs).toBe(0);
      expect(result.parallelProcessed).toBe(false);
      expect(result.errors).toEqual(['Error message']);
    });
  });

  describe('withTimeout', () => {
    it('should execute operation within timeout', async () => {
      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      };

      const result = await MultiToolCallUtils.withTimeout(operation, 100);
      expect(result).toBe('success');
    });

    it('should timeout slow operations', async () => {
      const slowOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'should not reach this';
      };

      await expect(MultiToolCallUtils.withTimeout(slowOperation, 10))
        .rejects.toThrow(MultiToolCallError);
    });

    it('should handle operation errors', async () => {
      const errorOperation = async () => {
        throw new Error('Test error');
      };

      await expect(MultiToolCallUtils.withTimeout(errorOperation, 100))
        .rejects.toThrow('Test error');
    });
  });
});

describe('MultiToolCallError', () => {
  it('should create error with all properties', () => {
    const error = new MultiToolCallError(
      'Test error',
      'TEST_CODE',
      'tool-call-123',
      'request-456',
      { extra: 'data' }
    );

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.toolCallId).toBe('tool-call-123');
    expect(error.requestId).toBe('request-456');
    expect(error.details).toEqual({ extra: 'data' });
    expect(error.name).toBe('MultiToolCallError');
  });

  it('should work with minimal parameters', () => {
    const error = new MultiToolCallError('Test error', 'TEST_CODE');

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.toolCallId).toBeUndefined();
    expect(error.requestId).toBeUndefined();
    expect(error.details).toBeUndefined();
  });
});

describe('Performance Tests', () => {
  let handler: MultiToolCallHandler;
  let sampleTools: OpenAITool[];

  beforeEach(() => {
    handler = new MultiToolCallHandler();
    sampleTools = [
      {
        type: 'function',
        function: {
          name: 'test_tool',
          description: 'Test tool',
          parameters: {
            type: 'object',
            properties: {
              param: { type: 'string' }
            }
          }
        }
      }
    ];
  });

  it('should handle multiple tool calls efficiently', async () => {
    const toolCalls = Array(5).fill(null).map((_, i) => ({
      id: `call_${i.toString().padStart(25, '0')}`,
      type: 'function' as const,
      function: {
        name: 'test_tool',
        arguments: JSON.stringify({ param: `value${i}` })
      }
    }));

    const request: MultiToolCallRequest = {
      tools: sampleTools,
      toolCalls,
      sessionId: 'session-123'
    };

    const startTime = performance.now();
    const result = await handler.processMultipleToolCalls(request);
    const duration = performance.now() - startTime;

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(5);
    expect(duration).toBeLessThan(100); // Should be very fast
  });

  it('should maintain performance with large number of tool calls', async () => {
    const toolCalls = Array(MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS).fill(null).map((_, i) => ({
      id: `call_${i.toString().padStart(25, '0')}`,
      type: 'function' as const,
      function: {
        name: 'test_tool',
        arguments: JSON.stringify({ param: `value${i}` })
      }
    }));

    const request: MultiToolCallRequest = {
      tools: sampleTools,
      toolCalls,
      sessionId: 'session-123'
    };

    const startTime = performance.now();
    const result = await handler.processMultipleToolCalls(request);
    const duration = performance.now() - startTime;

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS);
    expect(duration).toBeLessThan(500); // Should handle large batches efficiently
  });
});