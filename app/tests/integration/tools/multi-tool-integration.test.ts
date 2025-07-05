/**
 * Multi-Tool Integration Tests
 * Phase 7A: Multi-Tool Support Implementation
 * 
 * Tests complete integration of multi-tool calling system including
 * handler, processor, coordinator, and response formatting
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  MultiToolCallHandler,
  ParallelProcessor,
  ToolCallCoordinator,
  IMultiToolCallHandler,
  IParallelProcessor,
  IToolCallCoordinator
} from '../../../src/tools';
import {
  MultiToolCallRequest,
  MultiToolCallResult,
  OpenAIToolCall,
  OpenAITool
} from '../../../src/tools/types';
import { ResponseBuildingUtils, ChatCompletionResponse } from '../../../src/tools/response-builder';
import { ToolFormattingUtils } from '../../../src/tools/formatter';
import { MULTI_TOOL_LIMITS, MULTI_TOOL_MESSAGES } from '../../../src/tools/constants';

describe('Multi-Tool Integration', () => {
  let handler: IMultiToolCallHandler;
  let processor: IParallelProcessor;
  let coordinator: IToolCallCoordinator;
  let sampleTools: OpenAITool[];
  let sampleToolCalls: OpenAIToolCall[];

  beforeEach(() => {
    handler = new MultiToolCallHandler();
    processor = new ParallelProcessor();
    coordinator = new ToolCallCoordinator();

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
          name: 'list_files',
          description: 'List files in directory',
          parameters: {
            type: 'object',
            properties: {
              directory: { type: 'string' }
            },
            required: ['directory']
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
              query: { type: 'string' },
              directory: { type: 'string' }
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
          name: 'list_files',
          arguments: JSON.stringify({ directory: '/project' })
        }
      },
      {
        id: 'call_DEF456GHI789JKL012MNO345A',
        type: 'function',
        function: {
          name: 'read_file',
          arguments: JSON.stringify({ path: '/project/config.json' })
        }
      },
      {
        id: 'call_GHI789JKL012MNO345PQR678B',
        type: 'function',
        function: {
          name: 'search_files',
          arguments: JSON.stringify({ query: '*.js', directory: '/project/src' })
        }
      },
      {
        id: 'call_JKL012MNO345PQR678STU901C',
        type: 'function',
        function: {
          name: 'write_file',
          arguments: JSON.stringify({ 
            path: '/project/summary.txt', 
            content: 'Project analysis complete' 
          })
        }
      }
    ];
  });

  afterEach(() => {
    // Clean up any persistent state
    if (handler instanceof MultiToolCallHandler) {
      handler.resetStats();
    }
    if (processor instanceof ParallelProcessor) {
      processor.resetStats();
    }
    if (coordinator instanceof ToolCallCoordinator) {
      coordinator.resetStats();
    }
  });

  describe('End-to-End Multi-Tool Processing', () => {
    it('should handle complete multi-tool workflow successfully', async () => {
      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: sampleToolCalls,
        sessionId: 'integration-session-001',
        requestId: 'req-12345',
        parallel: false
      };

      // Test complete workflow through handler
      const result = await handler.processMultipleToolCalls(request);

      expect(result.success).toBe(true);
      expect(result.toolCalls).toHaveLength(4);
      expect(result.results).toHaveLength(4);
      expect(result.errors).toEqual([]);
      expect(result.processingTimeMs).toBeGreaterThan(0);
      expect(result.parallelProcessed).toBe(false);

      // Verify all tool calls were processed
      result.results.forEach(toolResult => {
        expect(toolResult.success).toBe(true);
        expect(toolResult.toolCallId).toBeDefined();
        expect(toolResult.toolName).toBeDefined();
        expect(toolResult.processingTimeMs).toBeGreaterThan(0);
      });
    });

    it('should handle parallel processing workflow', async () => {
      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: sampleToolCalls,
        sessionId: 'integration-session-002',
        requestId: 'req-12346',
        parallel: true
      };

      const result = await handler.processMultipleToolCalls(request);

      expect(result.success).toBe(true);
      expect(result.parallelProcessed).toBe(true);
      expect(result.toolCalls).toHaveLength(4);
      expect(result.results).toHaveLength(4);
    });

    it('should integrate coordination and processing', async () => {
      // Create tool calls with dependencies
      const dependentToolCalls: OpenAIToolCall[] = [
        {
          id: 'call_setup',
          type: 'function',
          function: {
            name: 'write_file',
            arguments: JSON.stringify({ path: '/tmp/input.txt', content: 'input data' })
          }
        },
        {
          id: 'call_process',
          type: 'function',
          function: {
            name: 'read_file',
            arguments: JSON.stringify({ path: '/tmp/input.txt' })
          }
        },
        {
          id: 'call_cleanup',
          type: 'function',
          function: {
            name: 'write_file',
            arguments: JSON.stringify({ path: '/tmp/output.txt', content: 'processed' })
          }
        }
      ];

      // First coordinate the tool calls
      const coordinationResult = await coordinator.coordinateToolCalls(
        dependentToolCalls, 
        'integration-session-003'
      );

      expect(coordinationResult.success).toBe(true);
      expect(coordinationResult.processingOrder).toHaveLength(3);

      // Verify that setup comes before process
      const setupIndex = coordinationResult.processingOrder.indexOf('call_setup');
      const processIndex = coordinationResult.processingOrder.indexOf('call_process');
      expect(setupIndex).toBeLessThan(processIndex);

      // Then process with the handler
      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: coordinationResult.coordinatedCalls,
        sessionId: 'integration-session-003',
        parallel: false // Use sequential processing to respect dependencies
      };

      const processingResult = await handler.processMultipleToolCalls(request);
      expect(processingResult.success).toBe(true);
    });

    it('should handle mixed success and failure scenarios', async () => {
      const mixedToolCalls: OpenAIToolCall[] = [
        {
          id: 'call_success_1',
          type: 'function',
          function: {
            name: 'read_file',
            arguments: JSON.stringify({ path: '/existing/file.txt' })
          }
        },
        {
          id: 'call_failure_1',
          type: 'function',
          function: {
            name: 'unknown_tool',
            arguments: JSON.stringify({ param: 'value' })
          }
        },
        {
          id: 'call_success_2',
          type: 'function',
          function: {
            name: 'list_files',
            arguments: JSON.stringify({ directory: '/existing/dir' })
          }
        }
      ];

      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: mixedToolCalls,
        sessionId: 'integration-session-004'
      };

      const result = await handler.processMultipleToolCalls(request);

      expect(result.success).toBe(false); // Overall failure due to one failed call
      expect(result.results).toHaveLength(3);
      expect(result.results.filter(r => r.success)).toHaveLength(2);
      expect(result.results.filter(r => !r.success)).toHaveLength(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Response Formatting Integration', () => {
    it('should format multi-tool results into OpenAI response', async () => {
      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: sampleToolCalls.slice(0, 2), // Use subset for faster test
        sessionId: 'formatting-session-001'
      };

      const result = await handler.processMultipleToolCalls(request);

      // Test response creation
      const response = handler.createMultiToolResponse(result);

      expect(response).toHaveProperty('tool_calls');
      expect(response).toHaveProperty('finish_reason');
      expect(response).toHaveProperty('processing_metadata');

      expect(response.tool_calls).toHaveLength(2);
      expect(response.finish_reason).toBe('tool_calls');
      expect(response.processing_metadata.success).toBe(true);
      expect(response.processing_metadata.total_calls).toBe(2);
      expect(response.processing_metadata.successful_calls).toBe(2);
      expect(response.processing_metadata.failed_calls).toBe(0);
    });

    it('should integrate with ResponseBuildingUtils for complete response', async () => {
      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: sampleToolCalls.slice(0, 2),
        sessionId: 'response-integration-001'
      };

      const result = await handler.processMultipleToolCalls(request);

      // Test full response building
      const fullResponse = ResponseBuildingUtils.buildMultiToolResponse(
        result,
        'I processed multiple tools for you.',
        'claude-3-sonnet-20240229',
        'chatcmpl-integration-test'
      );

      expect(fullResponse).toHaveProperty('id');
      expect(fullResponse).toHaveProperty('object');
      expect(fullResponse).toHaveProperty('created');
      expect(fullResponse).toHaveProperty('model');
      expect(fullResponse).toHaveProperty('choices');

      expect(fullResponse.id).toBe('chatcmpl-integration-test');
      expect(fullResponse.model).toBe('claude-3-sonnet-20240229');
      expect(fullResponse.choices).toHaveLength(1);

      const choice = fullResponse.choices[0];
      expect(choice.message.content).toBe('I processed multiple tools for you.');
      expect(choice.message.tool_calls).toHaveLength(2);
      expect(choice.finish_reason).toBe('tool_calls');
      expect(choice.multi_tool_metadata).toBeDefined();
      expect(choice.multi_tool_metadata.total_tool_calls).toBe(2);
    });

    it('should validate multi-tool responses correctly', async () => {
      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: sampleToolCalls.slice(0, 1),
        sessionId: 'validation-session-001'
      };

      const result = await handler.processMultipleToolCalls(request);
      const response = ResponseBuildingUtils.buildMultiToolResponse(result);

      // Test validation
      const isValid = ResponseBuildingUtils.validateMultiToolResponse(response);
      expect(isValid).toBe(true);

      // Test formatting validation
      const formattingResult = ToolFormattingUtils.formatMultiToolResult(result);
      expect(formattingResult.success).toBe(true);
      expect(formattingResult.toolCalls).toHaveLength(1);
      expect(formattingResult.errors).toEqual([]);
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle maximum allowed tool calls efficiently', async () => {
      const maxToolCalls = Array(MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS).fill(null).map((_, i) => ({
        id: `call_${i.toString().padStart(25, '0')}`,
        type: 'function' as const,
        function: {
          name: 'read_file',
          arguments: JSON.stringify({ path: `/files/file${i}.txt` })
        }
      }));

      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: maxToolCalls,
        sessionId: 'stress-session-001',
        parallel: true
      };

      const startTime = performance.now();
      const result = await handler.processMultipleToolCalls(request);
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.toolCalls).toHaveLength(MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS);
      expect(result.parallelProcessed).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle complex dependency chains efficiently', async () => {
      // Create a chain of dependencies
      const chainLength = 8;
      const chainedToolCalls = Array(chainLength).fill(null).map((_, i) => ({
        id: `call_chain_${i}`,
        type: 'function' as const,
        function: {
          name: i === 0 ? 'write_file' : 'read_file',
          arguments: JSON.stringify({
            path: i === 0 ? `/chain/step${i}.txt` : `/chain/step${i - 1}.txt`,
            ...(i === 0 ? { content: `step ${i} data` } : {})
          })
        }
      }));

      // Add final write step
      chainedToolCalls.push({
        id: `call_chain_final`,
        type: 'function',
        function: {
          name: 'write_file',
          arguments: JSON.stringify({
            path: '/chain/final.txt',
            content: 'chain complete'
          })
        }
      });

      const coordinationResult = await coordinator.coordinateToolCalls(
        chainedToolCalls,
        'chain-session-001'
      );

      expect(coordinationResult.success).toBe(true);
      expect(coordinationResult.processingOrder).toHaveLength(chainLength + 1);

      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: coordinationResult.coordinatedCalls,
        sessionId: 'chain-session-001',
        parallel: false // Sequential for dependencies
      };

      const startTime = performance.now();
      const result = await handler.processMultipleToolCalls(request);
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(3000); // Should handle chains efficiently
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle processor errors gracefully', async () => {
      // Create invalid tool calls that will cause processor errors
      const invalidToolCalls: OpenAIToolCall[] = [
        {
          id: 'call_invalid_1',
          type: 'function',
          function: {
            name: 'non_existent_tool',
            arguments: JSON.stringify({ param: 'value' })
          }
        },
        {
          id: 'call_invalid_2',
          type: 'function',
          function: {
            name: 'another_invalid_tool',
            arguments: 'invalid json'
          }
        }
      ];

      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: invalidToolCalls,
        sessionId: 'error-session-001'
      };

      const result = await handler.processMultipleToolCalls(request);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.results.every(r => !r.success)).toBe(true);
    });

    it('should handle coordination failures', async () => {
      // Test with too many tool calls
      const tooManyToolCalls = Array(MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS + 1).fill(null).map((_, i) => ({
        id: `call_${i}`,
        type: 'function' as const,
        function: {
          name: 'read_file',
          arguments: JSON.stringify({ path: `/file${i}.txt` })
        }
      }));

      const coordinationResult = await coordinator.coordinateToolCalls(
        tooManyToolCalls,
        'error-session-002'
      );

      expect(coordinationResult.success).toBe(false);
      expect(coordinationResult.errors).toContain(MULTI_TOOL_MESSAGES.TOO_MANY_PARALLEL_CALLS);
    });

    it('should handle timeout scenarios gracefully', async () => {
      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: sampleToolCalls,
        sessionId: 'timeout-session-001'
      };

      // This test verifies that the system can handle normal processing without timeouts
      const result = await handler.processMultipleToolCalls(request);

      expect(result.processingTimeMs).toBeLessThan(MULTI_TOOL_LIMITS.PROCESSING_TIMEOUT_MS);
      expect(result.success).toBe(true);
    });
  });

  describe('State Management and Statistics', () => {
    it('should track statistics across multiple operations', async () => {
      // Perform multiple operations
      const operations = [
        { tools: sampleTools, toolCalls: sampleToolCalls.slice(0, 2) },
        { tools: sampleTools, toolCalls: sampleToolCalls.slice(2, 4) },
        { tools: sampleTools, toolCalls: sampleToolCalls.slice(0, 3) }
      ];

      for (const [index, op] of operations.entries()) {
        const request: MultiToolCallRequest = {
          tools: op.tools,
          toolCalls: op.toolCalls,
          sessionId: `stats-session-${index}`
        };

        await handler.processMultipleToolCalls(request);
      }

      // Check handler stats
      const handlerStats = (handler as MultiToolCallHandler).getProcessingStats();
      expect(handlerStats.totalRequests).toBe(3);
      expect(handlerStats.totalToolCalls).toBe(7); // 2 + 2 + 3
      expect(handlerStats.successfulRequests).toBe(3);
      expect(handlerStats.averageToolCallsPerRequest).toBeCloseTo(7 / 3, 1);

      // Check coordinator stats (if operations used coordination)
      const coordinatorStats = (coordinator as ToolCallCoordinator).getCoordinationStats();
      expect(coordinatorStats.totalCoordinations).toBeGreaterThanOrEqual(0);
    });

    it('should reset statistics correctly', async () => {
      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: sampleToolCalls.slice(0, 1),
        sessionId: 'reset-session-001'
      };

      await handler.processMultipleToolCalls(request);

      // Reset stats
      (handler as MultiToolCallHandler).resetStats();
      (coordinator as ToolCallCoordinator).resetStats();
      (processor as ParallelProcessor).resetStats();

      // Verify reset
      const handlerStats = (handler as MultiToolCallHandler).getProcessingStats();
      expect(handlerStats.totalRequests).toBe(0);
      expect(handlerStats.totalToolCalls).toBe(0);

      const coordinatorStats = (coordinator as ToolCallCoordinator).getCoordinationStats();
      expect(coordinatorStats.totalCoordinations).toBe(0);

      const processorStats = (processor as ParallelProcessor).getParallelProcessingStats();
      expect(processorStats.totalParallelSessions).toBe(0);
    });
  });

  describe('OpenAI Compatibility', () => {
    it('should produce responses compatible with OpenAI API format', async () => {
      const request: MultiToolCallRequest = {
        tools: sampleTools,
        toolCalls: sampleToolCalls.slice(0, 2),
        sessionId: 'openai-compat-001'
      };

      const result = await handler.processMultipleToolCalls(request);
      const response = ResponseBuildingUtils.buildMultiToolResponse(
        result,
        'Processing completed successfully.',
        'claude-3-sonnet-20240229'
      );

      // Verify OpenAI compatibility
      expect(response).toMatchObject({
        id: expect.stringMatching(/^chatcmpl-/),
        object: 'chat.completion',
        created: expect.any(Number),
        model: 'claude-3-sonnet-20240229',
        choices: expect.arrayContaining([
          expect.objectContaining({
            index: 0,
            message: expect.objectContaining({
              role: 'assistant',
              content: 'Processing completed successfully.',
              tool_calls: expect.any(Array)
            }),
            finish_reason: 'tool_calls'
          })
        ])
      });

      // Verify tool calls format
      const toolCalls = response.choices[0].message.tool_calls;
      toolCalls.forEach((toolCall: any) => {
        expect(toolCall).toMatchObject({
          id: expect.stringMatching(/^call_/),
          type: 'function',
          function: expect.objectContaining({
            name: expect.any(String),
            arguments: expect.any(String)
          })
        });

        // Verify arguments are valid JSON
        expect(() => JSON.parse(toolCall.function.arguments)).not.toThrow();
      });
    });

    it('should handle tool choice constraints properly', async () => {
      // Test that the system respects OpenAI tool choice patterns
      const constrainedRequest: MultiToolCallRequest = {
        tools: sampleTools.slice(0, 2), // Limit available tools: read_file, write_file
        toolCalls: [sampleToolCalls[1], sampleToolCalls[3]], // Use matching tool calls: read_file, write_file
        sessionId: 'constrained-session-001'
      };

      const result = await handler.processMultipleToolCalls(constrainedRequest);

      expect(result.success).toBe(true);
      expect(result.toolCalls.every(call => 
        constrainedRequest.tools.some(tool => tool.function.name === call.function.name)
      )).toBe(true);
    });
  });
});