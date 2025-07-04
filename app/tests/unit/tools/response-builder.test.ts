/**
 * Tool Call Response Builder Unit Tests
 * Phase 4A: Response Formatting Implementation
 * 
 * Tests tool call response construction
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  ToolCallResponseBuilder, 
  ResponseBuildingError,
  ResponseBuildingUtils,
  ChatCompletionResponse 
} from '../../../src/tools/response-builder';
import { IResponseBuilder } from '../../../src/tools/types';
import { OpenAIToolCall } from '../../../src/tools/types';
import { RESPONSE_FORMATS } from '../../../src/tools/constants';

describe('ToolCallResponseBuilder', () => {
  let builder: IResponseBuilder;

  beforeEach(() => {
    builder = new ToolCallResponseBuilder();
  });

  describe('buildToolCallResponse', () => {
    it('should build response with tool calls', () => {
      const toolCalls: OpenAIToolCall[] = [
        {
          id: 'call_test123456789012345678901',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: JSON.stringify({ location: 'San Francisco' })
          }
        }
      ];

      const response = builder.buildToolCallResponse(toolCalls, 'Here is the weather:');

      expect(response.choices[0].message.tool_calls).toEqual(toolCalls);
      expect(response.choices[0].message.content).toBe('Here is the weather:');
      expect(response.choices[0].finish_reason).toBe(RESPONSE_FORMATS.FINISH_REASON_TOOL_CALLS);
      expect(response.object).toBe('chat.completion');
    });

    it('should build response without tool calls', () => {
      const response = builder.buildToolCallResponse([], 'Simple response');

      expect(response.choices[0].message.tool_calls).toBeUndefined();
      expect(response.choices[0].message.content).toBe('Simple response');
      expect(response.choices[0].finish_reason).toBe(RESPONSE_FORMATS.FINISH_REASON_STOP);
    });

    it('should build response with tool calls and no content', () => {
      const toolCalls: OpenAIToolCall[] = [
        {
          id: 'call_test123456789012345678901',
          type: 'function',
          function: {
            name: 'execute_action',
            arguments: '{}'
          }
        }
      ];

      const response = builder.buildToolCallResponse(toolCalls);

      expect(response.choices[0].message.tool_calls).toEqual(toolCalls);
      expect(response.choices[0].message.content).toBeNull();
      expect(response.choices[0].finish_reason).toBe(RESPONSE_FORMATS.FINISH_REASON_TOOL_CALLS);
    });

    it('should generate valid response structure', () => {
      const toolCalls: OpenAIToolCall[] = [];
      const response = builder.buildToolCallResponse(toolCalls, 'Test content');

      expect(response.id).toMatch(/^chatcmpl-/);
      expect(response.object).toBe('chat.completion');
      expect(typeof response.created).toBe('number');
      expect(response.model).toBe('claude-3-sonnet-20240229');
      expect(response.choices).toHaveLength(1);
      expect(response.choices[0].index).toBe(0);
      expect(response.choices[0].message.role).toBe('assistant');
    });

    it('should validate response structure', () => {
      const toolCalls: OpenAIToolCall[] = [];
      const response = builder.buildToolCallResponse(toolCalls, 'Test');

      expect(builder.validateResponseStructure(response)).toBe(true);
    });

    it('should throw error for invalid input', () => {
      expect(() => {
        builder.buildToolCallResponse('invalid' as any);
      }).toThrow(ResponseBuildingError);

      expect(() => {
        builder.buildToolCallResponse(null as any);
      }).toThrow(ResponseBuildingError);
    });

    it('should handle multiple tool calls', () => {
      const toolCalls: OpenAIToolCall[] = [
        {
          id: 'call_test123456789012345678901',
          type: 'function',
          function: { name: 'func1', arguments: '{}' }
        },
        {
          id: 'call_test123456789012345678902',
          type: 'function',
          function: { name: 'func2', arguments: '{}' }
        },
        {
          id: 'call_test123456789012345678903',
          type: 'function',
          function: { name: 'func3', arguments: '{}' }
        }
      ];

      const response = builder.buildToolCallResponse(toolCalls, 'Multiple calls');

      expect(response.choices[0].message.tool_calls).toHaveLength(3);
      expect(response.choices[0].finish_reason).toBe(RESPONSE_FORMATS.FINISH_REASON_TOOL_CALLS);
    });
  });

  describe('setFinishReason', () => {
    it('should set finish reason to tool_calls when has tool calls', () => {
      const baseResponse = {
        id: 'test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'test',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'test' },
            finish_reason: 'stop'
          }
        ]
      };

      const result = builder.setFinishReason(baseResponse, true);

      expect(result.choices[0].finish_reason).toBe(RESPONSE_FORMATS.FINISH_REASON_TOOL_CALLS);
      expect(result).not.toBe(baseResponse); // Should not mutate original
    });

    it('should set finish reason to stop when no tool calls', () => {
      const baseResponse = {
        id: 'test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'test',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'test' },
            finish_reason: 'tool_calls'
          }
        ]
      };

      const result = builder.setFinishReason(baseResponse, false);

      expect(result.choices[0].finish_reason).toBe(RESPONSE_FORMATS.FINISH_REASON_STOP);
    });

    it('should handle multiple choices', () => {
      const baseResponse = {
        id: 'test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'test',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'test1' },
            finish_reason: 'stop'
          },
          {
            index: 1,
            message: { role: 'assistant', content: 'test2' },
            finish_reason: 'stop'
          }
        ]
      };

      const result = builder.setFinishReason(baseResponse, true);

      expect(result.choices[0].finish_reason).toBe(RESPONSE_FORMATS.FINISH_REASON_TOOL_CALLS);
      expect(result.choices[1].finish_reason).toBe(RESPONSE_FORMATS.FINISH_REASON_TOOL_CALLS);
    });

    it('should throw error for invalid response structure', () => {
      expect(() => {
        builder.setFinishReason(null, true);
      }).toThrow(ResponseBuildingError);

      expect(() => {
        builder.setFinishReason({}, true);
      }).toThrow(ResponseBuildingError);

      expect(() => {
        builder.setFinishReason({ choices: 'invalid' }, true);
      }).toThrow(ResponseBuildingError);
    });
  });

  describe('validateResponseStructure', () => {
    it('should validate complete valid response', () => {
      const validResponse: ChatCompletionResponse = {
        id: 'chatcmpl-test123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'claude-3-sonnet-20240229',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello world',
              tool_calls: [
                {
                  id: 'call_test123456789012345678901',
                  type: 'function',
                  function: {
                    name: 'test_function',
                    arguments: '{}'
                  }
                }
              ]
            },
            finish_reason: 'tool_calls'
          }
        ]
      };

      expect(builder.validateResponseStructure(validResponse)).toBe(true);
    });

    it('should validate response without tool calls', () => {
      const validResponse: ChatCompletionResponse = {
        id: 'chatcmpl-test123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'claude-3-sonnet-20240229',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello world'
            },
            finish_reason: 'stop'
          }
        ]
      };

      expect(builder.validateResponseStructure(validResponse)).toBe(true);
    });

    it('should reject invalid response structures', () => {
      expect(builder.validateResponseStructure(null)).toBe(false);
      expect(builder.validateResponseStructure({})).toBe(false);
      expect(builder.validateResponseStructure({ id: 123 })).toBe(false);
      expect(builder.validateResponseStructure({ 
        id: 'test', 
        object: 'invalid' 
      })).toBe(false);
    });

    it('should validate choice structure', () => {
      const invalidChoice = {
        id: 'chatcmpl-test123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'test',
        choices: [
          {
            index: 'invalid',
            message: { role: 'assistant', content: 'test' },
            finish_reason: 'stop'
          }
        ]
      };

      expect(builder.validateResponseStructure(invalidChoice)).toBe(false);
    });

    it('should validate message structure', () => {
      const invalidMessage = {
        id: 'chatcmpl-test123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'test',
        choices: [
          {
            index: 0,
            message: { role: 'invalid', content: 'test' },
            finish_reason: 'stop'
          }
        ]
      };

      expect(builder.validateResponseStructure(invalidMessage)).toBe(false);
    });

    it('should validate tool calls structure', () => {
      const invalidToolCalls = {
        id: 'chatcmpl-test123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'test',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'test',
              tool_calls: [
                {
                  id: 'call_test123456789012345678901',
                  type: 'function',
                  function: {
                    name: 'test_function',
                    arguments: 'invalid json'
                  }
                }
              ]
            },
            finish_reason: 'tool_calls'
          }
        ]
      };

      expect(builder.validateResponseStructure(invalidToolCalls)).toBe(false);
    });
  });
});

describe('ResponseBuildingUtils', () => {
  describe('extractToolCalls', () => {
    it('should extract tool calls from response', () => {
      const toolCalls: OpenAIToolCall[] = [
        {
          id: 'call_test123456789012345678901',
          type: 'function',
          function: { name: 'test', arguments: '{}' }
        }
      ];

      const response: ChatCompletionResponse = {
        id: 'test',
        object: 'chat.completion',
        created: 123,
        model: 'test',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'test',
              tool_calls: toolCalls
            },
            finish_reason: 'tool_calls'
          }
        ]
      };

      expect(ResponseBuildingUtils.extractToolCalls(response)).toEqual(toolCalls);
    });

    it('should return empty array for response without tool calls', () => {
      const response: ChatCompletionResponse = {
        id: 'test',
        object: 'chat.completion',
        created: 123,
        model: 'test',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'test'
            },
            finish_reason: 'stop'
          }
        ]
      };

      expect(ResponseBuildingUtils.extractToolCalls(response)).toEqual([]);
    });

    it('should handle malformed responses', () => {
      expect(ResponseBuildingUtils.extractToolCalls({} as any)).toEqual([]);
      expect(ResponseBuildingUtils.extractToolCalls(null as any)).toEqual([]);
    });
  });

  describe('hasToolCalls', () => {
    it('should detect responses with tool calls', () => {
      const response: ChatCompletionResponse = {
        id: 'test',
        object: 'chat.completion',
        created: 123,
        model: 'test',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'test',
              tool_calls: [
                {
                  id: 'call_test123456789012345678901',
                  type: 'function',
                  function: { name: 'test', arguments: '{}' }
                }
              ]
            },
            finish_reason: 'tool_calls'
          }
        ]
      };

      expect(ResponseBuildingUtils.hasToolCalls(response)).toBe(true);
    });

    it('should detect responses without tool calls', () => {
      const response: ChatCompletionResponse = {
        id: 'test',
        object: 'chat.completion',
        created: 123,
        model: 'test',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'test'
            },
            finish_reason: 'stop'
          }
        ]
      };

      expect(ResponseBuildingUtils.hasToolCalls(response)).toBe(false);
    });
  });

  describe('getFinishReason', () => {
    it('should extract finish reason from response', () => {
      const response: ChatCompletionResponse = {
        id: 'test',
        object: 'chat.completion',
        created: 123,
        model: 'test',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'test' },
            finish_reason: 'tool_calls'
          }
        ]
      };

      expect(ResponseBuildingUtils.getFinishReason(response)).toBe('tool_calls');
    });

    it('should return null for malformed responses', () => {
      expect(ResponseBuildingUtils.getFinishReason({} as any)).toBeNull();
      expect(ResponseBuildingUtils.getFinishReason(null as any)).toBeNull();
    });
  });

  describe('isToolCallFinish', () => {
    it('should detect tool_calls finish reason', () => {
      const response: ChatCompletionResponse = {
        id: 'test',
        object: 'chat.completion',
        created: 123,
        model: 'test',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'test' },
            finish_reason: 'tool_calls'
          }
        ]
      };

      expect(ResponseBuildingUtils.isToolCallFinish(response)).toBe(true);
    });

    it('should detect non-tool_calls finish reason', () => {
      const response: ChatCompletionResponse = {
        id: 'test',
        object: 'chat.completion',
        created: 123,
        model: 'test',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'test' },
            finish_reason: 'stop'
          }
        ]
      };

      expect(ResponseBuildingUtils.isToolCallFinish(response)).toBe(false);
    });
  });

  describe('updateModel', () => {
    it('should update response model', () => {
      const response: ChatCompletionResponse = {
        id: 'test',
        object: 'chat.completion',
        created: 123,
        model: 'old-model',
        choices: []
      };

      const updated = ResponseBuildingUtils.updateModel(response, 'new-model');

      expect(updated.model).toBe('new-model');
      expect(updated).not.toBe(response); // Should not mutate original
    });
  });

  describe('addUsage', () => {
    it('should add usage information to response', () => {
      const response: ChatCompletionResponse = {
        id: 'test',
        object: 'chat.completion',
        created: 123,
        model: 'test',
        choices: []
      };

      const usage = {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      };

      const updated = ResponseBuildingUtils.addUsage(response, usage);

      expect(updated.usage).toEqual(usage);
      expect(updated).not.toBe(response); // Should not mutate original
    });
  });

  describe('mergeToolCallResponses', () => {
    it('should merge multiple responses with tool calls', () => {
      const response1: ChatCompletionResponse = {
        id: 'test1',
        object: 'chat.completion',
        created: 123,
        model: 'test',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'test',
              tool_calls: [
                {
                  id: 'call_test123456789012345678901',
                  type: 'function',
                  function: { name: 'func1', arguments: '{}' }
                }
              ]
            },
            finish_reason: 'tool_calls'
          }
        ]
      };

      const response2: ChatCompletionResponse = {
        id: 'test2',
        object: 'chat.completion',
        created: 124,
        model: 'test',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'test2',
              tool_calls: [
                {
                  id: 'call_test123456789012345678902',
                  type: 'function',
                  function: { name: 'func2', arguments: '{}' }
                }
              ]
            },
            finish_reason: 'tool_calls'
          }
        ]
      };

      const merged = ResponseBuildingUtils.mergeToolCallResponses([response1, response2]);

      expect(merged).not.toBeNull();
      expect(merged!.choices[0].message.tool_calls).toHaveLength(2);
      expect(merged!.choices[0].finish_reason).toBe('tool_calls');
    });

    it('should return single response when array has one item', () => {
      const response: ChatCompletionResponse = {
        id: 'test',
        object: 'chat.completion',
        created: 123,
        model: 'test',
        choices: []
      };

      const result = ResponseBuildingUtils.mergeToolCallResponses([response]);
      expect(result).toBe(response);
    });

    it('should return null for empty array', () => {
      const result = ResponseBuildingUtils.mergeToolCallResponses([]);
      expect(result).toBeNull();
    });

    it('should handle responses without tool calls', () => {
      const response1: ChatCompletionResponse = {
        id: 'test1',
        object: 'chat.completion',
        created: 123,
        model: 'test',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'test1' },
            finish_reason: 'stop'
          }
        ]
      };

      const response2: ChatCompletionResponse = {
        id: 'test2',
        object: 'chat.completion',
        created: 124,
        model: 'test',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'test2' },
            finish_reason: 'stop'
          }
        ]
      };

      const merged = ResponseBuildingUtils.mergeToolCallResponses([response1, response2]);

      expect(merged).not.toBeNull();
      expect(merged!.choices[0].message.tool_calls).toEqual([]);
      expect(merged!.choices[0].finish_reason).toBe('stop');
    });
  });
});

describe('ResponseBuildingError', () => {
  it('should create error with correct properties', () => {
    const response = { id: 'test' };
    const error = new ResponseBuildingError(
      'Test error',
      'TEST_CODE',
      response
    );

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.response).toBe(response);
    expect(error.name).toBe('ResponseBuildingError');
  });
});

describe('Performance Tests', () => {
  let builder: IResponseBuilder;

  beforeEach(() => {
    builder = new ToolCallResponseBuilder();
  });

  it('should build responses within performance limits', () => {
    const toolCalls: OpenAIToolCall[] = Array.from({ length: 10 }, (_, i) => ({
      id: `call_test${i.toString().padStart(21, '0')}`,
      type: 'function',
      function: {
        name: `function_${i}`,
        arguments: JSON.stringify({ index: i })
      }
    }));

    const startTime = Date.now();
    const response = builder.buildToolCallResponse(toolCalls, 'Test response');
    const duration = Date.now() - startTime;

    expect(response.choices[0].message.tool_calls).toHaveLength(10);
    expect(duration).toBeLessThan(10); // Should be very fast
  });

  it('should validate responses quickly', () => {
    const responses: ChatCompletionResponse[] = Array.from({ length: 100 }, (_, i) => ({
      id: `chatcmpl-test${i}`,
      object: 'chat.completion',
      created: Date.now(),
      model: 'test',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: `test ${i}` },
          finish_reason: 'stop'
        }
      ]
    }));

    const startTime = Date.now();
    for (const response of responses) {
      builder.validateResponseStructure(response);
    }
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(10); // Validation should be very fast
  });
});