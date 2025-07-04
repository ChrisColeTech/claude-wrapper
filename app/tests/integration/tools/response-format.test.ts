/**
 * Tool Call Response Format Integration Tests
 * Phase 4A: Response Formatting Implementation
 * 
 * Tests complete tool call response formatting pipeline
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ToolCallIdGenerator } from '../../../src/tools/id-generator';
import { ToolCallFormatter } from '../../../src/tools/formatter';
import { ToolCallResponseBuilder } from '../../../src/tools/response-builder';
import { ChatCompletionUtils } from '../../../src/models/chat';
import { ClaudeToolCall, OpenAIToolCall } from '../../../src/tools/types';
import { RESPONSE_FORMATS, ID_FORMATS } from '../../../src/tools/constants';

describe('Tool Call Response Format Integration', () => {
  let idGenerator: ToolCallIdGenerator;
  let formatter: ToolCallFormatter;
  let responseBuilder: ToolCallResponseBuilder;

  beforeEach(() => {
    idGenerator = new ToolCallIdGenerator();
    formatter = new ToolCallFormatter(idGenerator);
    responseBuilder = new ToolCallResponseBuilder();
  });

  describe('Complete Tool Call Response Pipeline', () => {
    it('should process single tool call end-to-end', () => {
      // 1. Start with Claude tool call
      const claudeCall: ClaudeToolCall = {
        name: 'get_weather',
        arguments: {
          location: 'San Francisco, CA',
          unit: 'celsius'
        }
      };

      // 2. Format to OpenAI format
      const openaiCall = formatter.formatToolCall(claudeCall);

      // 3. Build complete response
      const response = responseBuilder.buildToolCallResponse(
        [openaiCall],
        'I\'ll check the weather for you.'
      );

      // 4. Verify complete pipeline
      expect(openaiCall.id).toMatch(/^call_[A-Za-z0-9]{25}$/);
      expect(openaiCall.type).toBe('function');
      expect(openaiCall.function.name).toBe('get_weather');
      expect(JSON.parse(openaiCall.function.arguments)).toEqual({
        location: 'San Francisco, CA',
        unit: 'celsius'
      });

      expect(response.choices[0].message.tool_calls).toEqual([openaiCall]);
      expect(response.choices[0].message.content).toBe('I\'ll check the weather for you.');
      expect(response.choices[0].finish_reason).toBe('tool_calls');
      expect(response.object).toBe('chat.completion');
    });

    it('should process multiple tool calls end-to-end', () => {
      const claudeCalls: ClaudeToolCall[] = [
        {
          name: 'search_database',
          arguments: {
            query: 'user preferences',
            limit: 10
          }
        },
        {
          name: 'send_notification',
          arguments: {
            recipient: 'user@example.com',
            message: 'Query completed'
          }
        },
        {
          name: 'log_activity',
          arguments: {
            action: 'database_search',
            timestamp: '2024-01-01T00:00:00Z'
          }
        }
      ];

      // Format all calls
      const formattingResult = formatter.formatToolCalls(claudeCalls);
      expect(formattingResult.success).toBe(true);
      expect(formattingResult.toolCalls).toHaveLength(3);

      // Build response
      const response = responseBuilder.buildToolCallResponse(
        formattingResult.toolCalls!,
        'Processing your request with multiple operations.'
      );

      // Verify all tool calls in response
      expect(response.choices[0].message.tool_calls).toHaveLength(3);
      expect(response.choices[0].finish_reason).toBe('tool_calls');

      // Verify each tool call format
      const toolCalls = response.choices[0].message.tool_calls!;
      expect(toolCalls[0].function.name).toBe('search_database');
      expect(toolCalls[1].function.name).toBe('send_notification');
      expect(toolCalls[2].function.name).toBe('log_activity');

      // Verify unique IDs
      const ids = toolCalls.map(call => call.id);
      expect(new Set(ids).size).toBe(3);
    });

    it('should handle response without tool calls', () => {
      const response = responseBuilder.buildToolCallResponse(
        [],
        'This is a regular response without tool calls.'
      );

      expect(response.choices[0].message.tool_calls).toBeUndefined();
      expect(response.choices[0].message.content).toBe('This is a regular response without tool calls.');
      expect(response.choices[0].finish_reason).toBe('stop');
    });
  });

  describe('OpenAI Specification Compliance', () => {
    it('should match OpenAI tool call response format exactly', () => {
      const claudeCall: ClaudeToolCall = {
        name: 'get_current_weather',
        arguments: {
          location: 'Boston, MA',
          unit: 'fahrenheit'
        }
      };

      const openaiCall = formatter.formatToolCall(claudeCall);
      const response = responseBuilder.buildToolCallResponse([openaiCall]);

      // Verify OpenAI specification compliance
      expect(response).toMatchObject({
        id: expect.stringMatching(/^chatcmpl-/),
        object: 'chat.completion',
        created: expect.any(Number),
        model: expect.any(String),
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: expect.stringMatching(/^call_[A-Za-z0-9]{25}$/),
                  type: 'function',
                  function: {
                    name: 'get_current_weather',
                    arguments: expect.any(String)
                  }
                }
              ]
            },
            finish_reason: 'tool_calls'
          }
        ]
      });

      // Verify arguments are valid JSON
      const args = JSON.parse(openaiCall.function.arguments);
      expect(args).toEqual({
        location: 'Boston, MA',
        unit: 'fahrenheit'
      });
    });

    it('should support all OpenAI tool call response features', () => {
      const claudeCalls: ClaudeToolCall[] = [
        {
          name: 'calculate',
          arguments: {
            expression: '15 * 25 + 100',
            precision: 2
          }
        }
      ];

      const formattingResult = formatter.formatToolCalls(claudeCalls);
      const response = ChatCompletionUtils.createToolCallResponse(
        'claude-3-sonnet-20240229',
        formattingResult.toolCalls!,
        'Let me calculate that for you.',
        {
          prompt_tokens: 25,
          completion_tokens: 50,
          total_tokens: 75
        }
      );

      // Verify complete OpenAI-compatible response
      expect(response.id).toMatch(/^chatcmpl-/);
      expect(response.object).toBe('chat.completion');
      expect(response.model).toBe('claude-3-sonnet-20240229');
      expect(response.usage).toEqual({
        prompt_tokens: 25,
        completion_tokens: 50,
        total_tokens: 75
      });
      expect(response.choices[0].finish_reason).toBe('tool_calls');
    });

    it('should handle complex parameter types correctly', () => {
      const claudeCall: ClaudeToolCall = {
        name: 'process_data',
        arguments: {
          data: {
            numbers: [1, 2, 3.14, -5],
            metadata: {
              timestamp: '2024-01-01T00:00:00Z',
              valid: true,
              tags: ['important', 'processed']
            },
            options: {
              include_null: null,
              batch_size: 100
            }
          },
          config: {
            timeout: 30000,
            retry_attempts: 3,
            filters: [
              { field: 'status', operator: 'eq', value: 'active' },
              { field: 'created', operator: 'gt', value: '2023-01-01' }
            ]
          }
        }
      };

      const openaiCall = formatter.formatToolCall(claudeCall);
      const response = responseBuilder.buildToolCallResponse([openaiCall]);

      // Verify complex arguments are properly serialized
      const parsedArgs = JSON.parse(openaiCall.function.arguments);
      expect(parsedArgs).toEqual(claudeCall.arguments);
      
      // Verify data fidelity
      expect(parsedArgs.data.numbers).toEqual([1, 2, 3.14, -5]);
      expect(parsedArgs.data.options.include_null).toBeNull();
      expect(parsedArgs.config.filters).toHaveLength(2);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle formatting errors gracefully', () => {
      const invalidClaudeCalls: ClaudeToolCall[] = [
        { name: 'valid_function', arguments: { param: 'value' } },
        { name: '', arguments: {} }, // Invalid name
        { name: 'another_valid', arguments: { param: 'value' } }
      ];

      const formattingResult = formatter.formatToolCalls(invalidClaudeCalls);

      expect(formattingResult.success).toBe(false);
      expect(formattingResult.toolCalls).toHaveLength(2); // Only valid ones
      expect(formattingResult.errors).toHaveLength(1);

      // Can still build response with valid tool calls
      const response = responseBuilder.buildToolCallResponse(
        formattingResult.toolCalls || [],
        'Processed available functions.'
      );

      expect(response.choices[0].message.tool_calls).toHaveLength(2);
      expect(response.choices[0].finish_reason).toBe('tool_calls');
    });

    it('should handle response building errors', () => {
      expect(() => {
        responseBuilder.buildToolCallResponse('invalid' as any);
      }).toThrow();

      expect(() => {
        responseBuilder.buildToolCallResponse(null as any);
      }).toThrow();
    });

    it('should validate response structure comprehensively', () => {
      const claudeCall: ClaudeToolCall = {
        name: 'test_function',
        arguments: { test: 'value' }
      };

      const openaiCall = formatter.formatToolCall(claudeCall);
      const response = responseBuilder.buildToolCallResponse([openaiCall]);

      expect(responseBuilder.validateResponseStructure(response)).toBe(true);

      // Verify specific structure requirements
      expect(response.choices[0].index).toBe(0);
      expect(response.choices[0].message.role).toBe('assistant');
      expect(Array.isArray(response.choices[0].message.tool_calls)).toBe(true);
      expect(formatter.validateFormattedCall(openaiCall)).toBe(true);
    });
  });

  describe('Performance Integration', () => {
    it('should process tool calls within performance limits', () => {
      const claudeCalls: ClaudeToolCall[] = Array.from({ length: 20 }, (_, i) => ({
        name: `function_${i}`,
        arguments: {
          index: i,
          data: `test_data_${i}`,
          config: {
            setting: `value_${i}`,
            enabled: i % 2 === 0
          }
        }
      }));

      const startTime = Date.now();

      // Format all calls
      const formattingResult = formatter.formatToolCalls(claudeCalls);
      expect(formattingResult.success).toBe(true);

      // Build response
      const response = responseBuilder.buildToolCallResponse(
        formattingResult.toolCalls!,
        'Processing batch request.'
      );

      const totalTime = Date.now() - startTime;

      expect(response.choices[0].message.tool_calls).toHaveLength(20);
      expect(totalTime).toBeLessThan(50); // Should be very fast
      expect(formattingResult.formattingTimeMs).toBeLessThan(20);
    });

    it('should handle large argument objects efficiently', () => {
      const largeArguments = {
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          value: `item_${i}`,
          metadata: {
            timestamp: new Date().toISOString(),
            processed: true
          }
        })),
        config: {
          batch_size: 100,
          timeout: 30000,
          options: Object.fromEntries(
            Array.from({ length: 50 }, (_, i) => [`option_${i}`, `value_${i}`])
          )
        }
      };

      const claudeCall: ClaudeToolCall = {
        name: 'process_large_dataset',
        arguments: largeArguments
      };

      const startTime = Date.now();
      const openaiCall = formatter.formatToolCall(claudeCall);
      const response = responseBuilder.buildToolCallResponse([openaiCall]);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
      expect(JSON.parse(openaiCall.function.arguments)).toEqual(largeArguments);
      expect(response.choices[0].message.tool_calls).toHaveLength(1);
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should handle typical API integration tool calls', () => {
      const apiCalls: ClaudeToolCall[] = [
        {
          name: 'make_api_request',
          arguments: {
            url: 'https://api.example.com/users',
            method: 'GET',
            headers: {
              'Authorization': 'Bearer token',
              'Content-Type': 'application/json'
            },
            timeout: 5000
          }
        },
        {
          name: 'process_api_response',
          arguments: {
            response_data: {
              users: [
                { id: 1, name: 'John Doe', email: 'john@example.com' },
                { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
              ],
              pagination: {
                page: 1,
                per_page: 10,
                total: 25
              }
            },
            transform_rules: {
              include_fields: ['id', 'name', 'email'],
              format_names: true
            }
          }
        }
      ];

      const formattingResult = formatter.formatToolCalls(apiCalls);
      const response = responseBuilder.buildToolCallResponse(
        formattingResult.toolCalls!,
        'I\'ll fetch and process the user data for you.'
      );

      expect(formattingResult.success).toBe(true);
      expect(response.choices[0].message.tool_calls).toHaveLength(2);
      expect(response.choices[0].finish_reason).toBe('tool_calls');

      // Verify API call structure preserved
      const firstCall = response.choices[0].message.tool_calls![0];
      const args = JSON.parse(firstCall.function.arguments);
      expect(args.url).toBe('https://api.example.com/users');
      expect(args.headers).toEqual({
        'Authorization': 'Bearer token',
        'Content-Type': 'application/json'
      });
    });

    it('should handle file operation tool calls', () => {
      const fileOps: ClaudeToolCall[] = [
        {
          name: 'read_file',
          arguments: {
            path: '/home/user/documents/data.json',
            encoding: 'utf8'
          }
        },
        {
          name: 'write_file',
          arguments: {
            path: '/home/user/output/processed_data.json',
            content: JSON.stringify({ processed: true, timestamp: new Date().toISOString() }),
            mode: 'overwrite'
          }
        }
      ];

      const formattingResult = formatter.formatToolCalls(fileOps);
      const response = responseBuilder.buildToolCallResponse(
        formattingResult.toolCalls!,
        'Processing file operations.'
      );

      expect(formattingResult.success).toBe(true);
      expect(response.choices[0].message.tool_calls).toHaveLength(2);

      // Verify file operations preserved
      const readCall = response.choices[0].message.tool_calls![0];
      const writeCall = response.choices[0].message.tool_calls![1];
      
      expect(JSON.parse(readCall.function.arguments).path).toBe('/home/user/documents/data.json');
      expect(JSON.parse(writeCall.function.arguments).mode).toBe('overwrite');
    });

    it('should maintain ID uniqueness across complex scenarios', () => {
      const multipleInstances = Array.from({ length: 5 }, () => {
        const idGen = new ToolCallIdGenerator();
        const fmt = new ToolCallFormatter(idGen);
        return fmt;
      });

      const allToolCalls: OpenAIToolCall[] = [];

      multipleInstances.forEach((formatter, instanceIndex) => {
        const claudeCalls: ClaudeToolCall[] = Array.from({ length: 10 }, (_, i) => ({
          name: `instance_${instanceIndex}_function_${i}`,
          arguments: { instance: instanceIndex, index: i }
        }));

        const formattingResult = formatter.formatToolCalls(claudeCalls);
        allToolCalls.push(...(formattingResult.toolCalls || []));
      });

      // Verify all IDs are unique across instances
      const allIds = allToolCalls.map(call => call.id);
      expect(new Set(allIds).size).toBe(allIds.length);
      expect(allIds).toHaveLength(50);

      // Verify all IDs follow OpenAI format
      allIds.forEach(id => {
        expect(id).toMatch(/^call_[A-Za-z0-9]{25}$/);
      });
    });
  });
});