/**
 * Tool Call Formatter Unit Tests
 * Phase 4A: Response Formatting Implementation
 * 
 * Tests OpenAI tool call response formatting
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { 
  ToolCallFormatter, 
  ToolCallFormattingError,
  ToolFormattingUtils 
} from '../../../src/tools/formatter';
import { IToolFormatter } from '../../../src/tools/types';
import { ToolCallIdGenerator, IToolCallIdGenerator } from '../../../src/tools/id-generator';
import { ClaudeToolCall, OpenAIToolCall } from '../../../src/tools/types';
import { 
  TOOL_CALL_STRUCTURE, 
  FORMAT_SPECIFICATIONS,
  RESPONSE_FORMATTING_ERRORS 
} from '../../../src/tools/constants';

describe('ToolCallFormatter', () => {
  let formatter: IToolFormatter;
  let mockIdGenerator: jest.Mocked<IToolCallIdGenerator>;

  beforeEach(() => {
    mockIdGenerator = {
      generateId: jest.fn(() => 'call_test123456789012345678901'),
      generateIds: jest.fn(),
      isValidId: jest.fn((id: string) => true),
      validateIdFormat: jest.fn((id: string) => true)
    } as jest.Mocked<IToolCallIdGenerator>;
    
    formatter = new ToolCallFormatter(mockIdGenerator);
  });

  describe('formatToolCall', () => {
    it('should format valid Claude tool call to OpenAI format', () => {
      const claudeCall: ClaudeToolCall = {
        name: 'get_weather',
        arguments: {
          location: 'San Francisco',
          unit: 'celsius'
        }
      };

      const result = formatter.formatToolCall(claudeCall);

      expect(result).toEqual({
        id: 'call_test123456789012345678901',
        type: 'function',
        function: {
          name: 'get_weather',
          arguments: JSON.stringify({
            location: 'San Francisco',
            unit: 'celsius'
          })
        }
      });
      
      expect(mockIdGenerator.generateId).toHaveBeenCalledTimes(1);
    });

    it('should use provided ID when available', () => {
      const claudeCall: ClaudeToolCall = {
        id: 'call_existing123456789012345678',
        name: 'test_function',
        arguments: { param: 'value' }
      };

      const result = formatter.formatToolCall(claudeCall);

      expect(result.id).toBe('call_existing123456789012345678');
      expect(mockIdGenerator.generateId).not.toHaveBeenCalled();
    });

    it('should handle empty arguments', () => {
      const claudeCall: ClaudeToolCall = {
        name: 'simple_function',
        arguments: {}
      };

      const result = formatter.formatToolCall(claudeCall);

      expect(result.function.arguments).toBe('{}');
    });

    it('should handle undefined arguments', () => {
      const claudeCall: any = {
        name: 'simple_function',
        arguments: undefined
      };

      const result = formatter.formatToolCall(claudeCall);

      expect(result.function.arguments).toBe('{}');
    });

    it('should handle complex nested arguments', () => {
      const claudeCall: ClaudeToolCall = {
        name: 'complex_function',
        arguments: {
          config: {
            settings: {
              nested: true,
              values: [1, 2, 3]
            }
          },
          metadata: {
            timestamp: '2024-01-01T00:00:00Z',
            flags: ['a', 'b']
          }
        }
      };

      const result = formatter.formatToolCall(claudeCall);
      const parsedArgs = JSON.parse(result.function.arguments);

      expect(parsedArgs).toEqual(claudeCall.arguments);
    });

    it('should throw error for invalid Claude tool call', () => {
      expect(() => {
        formatter.formatToolCall(null as any);
      }).toThrow(ToolCallFormattingError);

      expect(() => {
        formatter.formatToolCall({} as any);
      }).toThrow(ToolCallFormattingError);

      expect(() => {
        formatter.formatToolCall({ name: '', arguments: {} });
      }).toThrow(ToolCallFormattingError);
    });

    it('should throw error for non-string function name', () => {
      expect(() => {
        formatter.formatToolCall({ name: null as any, arguments: {} });
      }).toThrow(ToolCallFormattingError);

      expect(() => {
        formatter.formatToolCall({ name: 123 as any, arguments: {} });
      }).toThrow(ToolCallFormattingError);
    });

    it('should throw error if formatted call validation fails', () => {
      // Override the validateFormattedCall method to return false
      jest.spyOn(formatter, 'validateFormattedCall').mockReturnValue(false);
      
      const claudeCall: ClaudeToolCall = {
        name: 'test_function',
        arguments: { param: 'value' }
      };

      expect(() => {
        formatter.formatToolCall(claudeCall);
      }).toThrow(ToolCallFormattingError);
    });

    it('should handle arguments serialization errors', () => {
      const claudeCall: ClaudeToolCall = {
        name: 'test_function',
        arguments: {} as any
      };

      // Create circular reference
      claudeCall.arguments.circular = claudeCall.arguments;

      expect(() => {
        formatter.formatToolCall(claudeCall);
      }).toThrow(ToolCallFormattingError);
    });
  });

  describe('formatToolCalls', () => {
    it('should format multiple Claude tool calls', () => {
      const claudeCalls: ClaudeToolCall[] = [
        { name: 'function1', arguments: { param1: 'value1' } },
        { name: 'function2', arguments: { param2: 'value2' } }
      ];

      mockIdGenerator.generateId
        .mockReturnValueOnce('call_test123456789012345678901')
        .mockReturnValueOnce('call_test123456789012345678902');

      const result = formatter.formatToolCalls(claudeCalls);

      expect(result.success).toBe(true);
      expect(result.toolCalls).toHaveLength(2);
      expect(result.errors).toEqual([]);
      expect(result.toolCalls![0].function.name).toBe('function1');
      expect(result.toolCalls![1].function.name).toBe('function2');
    });

    it('should handle empty array', () => {
      const result = formatter.formatToolCalls([]);

      expect(result.success).toBe(true);
      expect(result.toolCalls).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('should handle non-array input', () => {
      const result = formatter.formatToolCalls('invalid' as any);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle partial failures', () => {
      const claudeCalls: ClaudeToolCall[] = [
        { name: 'valid_function', arguments: { param: 'value' } },
        { name: '', arguments: {} }, // Invalid function name
        { name: 'another_valid', arguments: { param: 'value' } }
      ];

      mockIdGenerator.generateId
        .mockReturnValueOnce('call_test123456789012345678901')
        .mockReturnValueOnce('call_test123456789012345678903');

      const result = formatter.formatToolCalls(claudeCalls);

      expect(result.success).toBe(false);
      expect(result.toolCalls).toHaveLength(2); // Only valid ones
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Tool call 1:');
    });

    it('should enforce tool call limits', () => {
      const claudeCalls: ClaudeToolCall[] = Array.from({ length: 100 }, (_, i) => ({
        name: `function_${i}`,
        arguments: { index: i }
      }));

      const result = formatter.formatToolCalls(claudeCalls);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Too many tool calls');
    });

    it('should track formatting time', () => {
      const claudeCalls: ClaudeToolCall[] = [
        { name: 'test_function', arguments: {} }
      ];

      const result = formatter.formatToolCalls(claudeCalls);

      expect(result.formattingTimeMs).toBeDefined();
      expect(typeof result.formattingTimeMs).toBe('number');
      expect(result.formattingTimeMs!).toBeGreaterThanOrEqual(0);
    });

    it('should handle timeout detection', async () => {
      const claudeCalls: ClaudeToolCall[] = [
        { name: 'test_function', arguments: {} }
      ];

      // Mock slow formatting by adding delay
      const originalFormatToolCall = formatter.formatToolCall;
      formatter.formatToolCall = jest.fn((call) => {
        // Simulate slow processing
        const start = Date.now();
        while (Date.now() - start < 20) {
          // Busy wait
        }
        return originalFormatToolCall.call(formatter, call as ClaudeToolCall);
      });

      const result = formatter.formatToolCalls(claudeCalls);

      expect(result.errors.some((error: string) => error.includes('timeout'))).toBe(true);
    });
  });

  describe('validateFormattedCall', () => {
    it('should validate correct OpenAI tool call format', () => {
      const validCall: OpenAIToolCall = {
        id: 'call_test123456789012345678901',
        type: 'function',
        function: {
          name: 'test_function',
          arguments: JSON.stringify({ param: 'value' })
        }
      };

      expect(formatter.validateFormattedCall(validCall)).toBe(true);
    });

    it('should reject invalid tool call formats', () => {
      expect(formatter.validateFormattedCall(null as any)).toBe(false);
      expect(formatter.validateFormattedCall({} as any)).toBe(false);
      
      expect(formatter.validateFormattedCall({
        id: '',
        type: 'function',
        function: { name: 'test', arguments: '{}' }
      } as any)).toBe(false);

      expect(formatter.validateFormattedCall({
        id: 'call_test123456789012345678901',
        type: 'invalid',
        function: { name: 'test', arguments: '{}' }
      } as any)).toBe(false);

      expect(formatter.validateFormattedCall({
        id: 'call_test123456789012345678901',
        type: 'function',
        function: { name: '', arguments: '{}' }
      } as any)).toBe(false);

      expect(formatter.validateFormattedCall({
        id: 'call_test123456789012345678901',
        type: 'function',
        function: { name: 'test', arguments: 'invalid json' }
      } as any)).toBe(false);
    });

    it('should validate JSON arguments', () => {
      const validCall: OpenAIToolCall = {
        id: 'call_test123456789012345678901',
        type: 'function',
        function: {
          name: 'test_function',
          arguments: '{"valid": "json"}'
        }
      };

      const invalidCall: OpenAIToolCall = {
        id: 'call_test123456789012345678901',
        type: 'function',
        function: {
          name: 'test_function',
          arguments: '{invalid json}'
        }
      };

      expect(formatter.validateFormattedCall(validCall)).toBe(true);
      expect(formatter.validateFormattedCall(invalidCall)).toBe(false);
    });
  });
});

describe('ToolFormattingUtils', () => {
  describe('extractFunctionName', () => {
    it('should extract function name from valid tool call', () => {
      const toolCall: OpenAIToolCall = {
        id: 'call_test123456789012345678901',
        type: 'function',
        function: {
          name: 'get_weather',
          arguments: '{}'
        }
      };

      expect(ToolFormattingUtils.extractFunctionName(toolCall)).toBe('get_weather');
    });

    it('should return null for invalid tool call', () => {
      expect(ToolFormattingUtils.extractFunctionName({} as any)).toBeNull();
      expect(ToolFormattingUtils.extractFunctionName(null as any)).toBeNull();
    });
  });

  describe('extractFunctionArguments', () => {
    it('should extract and parse function arguments', () => {
      const toolCall: OpenAIToolCall = {
        id: 'call_test123456789012345678901',
        type: 'function',
        function: {
          name: 'test_function',
          arguments: JSON.stringify({ param: 'value', number: 42 })
        }
      };

      const args = ToolFormattingUtils.extractFunctionArguments(toolCall);
      expect(args).toEqual({ param: 'value', number: 42 });
    });

    it('should return null for invalid arguments', () => {
      const toolCall: OpenAIToolCall = {
        id: 'call_test123456789012345678901',
        type: 'function',
        function: {
          name: 'test_function',
          arguments: 'invalid json'
        }
      };

      expect(ToolFormattingUtils.extractFunctionArguments(toolCall)).toBeNull();
    });
  });

  describe('hasValidId', () => {
    it('should validate tool call ID', () => {
      const validCall: OpenAIToolCall = {
        id: 'call_test123456789012345678901',
        type: 'function',
        function: { name: 'test', arguments: '{}' }
      };

      const invalidCall: OpenAIToolCall = {
        id: '',
        type: 'function',
        function: { name: 'test', arguments: '{}' }
      };

      expect(ToolFormattingUtils.hasValidId(validCall)).toBe(true);
      expect(ToolFormattingUtils.hasValidId(invalidCall)).toBe(false);
    });
  });

  describe('toClaudeFormat', () => {
    it('should convert OpenAI format to Claude format', () => {
      const openaiCall: OpenAIToolCall = {
        id: 'call_test123456789012345678901',
        type: 'function',
        function: {
          name: 'get_weather',
          arguments: JSON.stringify({ location: 'SF', unit: 'celsius' })
        }
      };

      const claudeCall = ToolFormattingUtils.toClaudeFormat(openaiCall);

      expect(claudeCall).toEqual({
        id: 'call_test123456789012345678901',
        name: 'get_weather',
        arguments: { location: 'SF', unit: 'celsius' }
      });
    });

    it('should return null for invalid OpenAI format', () => {
      expect(ToolFormattingUtils.toClaudeFormat({} as any)).toBeNull();
      expect(ToolFormattingUtils.toClaudeFormat(null as any)).toBeNull();
    });
  });

  describe('validateUniqueIds', () => {
    it('should validate unique IDs in tool calls array', () => {
      const uniqueCalls: OpenAIToolCall[] = [
        {
          id: 'call_test123456789012345678901',
          type: 'function',
          function: { name: 'func1', arguments: '{}' }
        },
        {
          id: 'call_test123456789012345678902',
          type: 'function',
          function: { name: 'func2', arguments: '{}' }
        }
      ];

      const duplicateCalls: OpenAIToolCall[] = [
        {
          id: 'call_test123456789012345678901',
          type: 'function',
          function: { name: 'func1', arguments: '{}' }
        },
        {
          id: 'call_test123456789012345678901',
          type: 'function',
          function: { name: 'func2', arguments: '{}' }
        }
      ];

      expect(ToolFormattingUtils.validateUniqueIds(uniqueCalls)).toBe(true);
      expect(ToolFormattingUtils.validateUniqueIds(duplicateCalls)).toBe(false);
    });

    it('should handle empty arrays', () => {
      expect(ToolFormattingUtils.validateUniqueIds([])).toBe(true);
    });
  });
});

describe('ToolCallFormattingError', () => {
  it('should create error with all properties', () => {
    const claudeCall: ClaudeToolCall = { name: 'test', arguments: {} };
    const error = new ToolCallFormattingError(
      'Test error',
      RESPONSE_FORMATTING_ERRORS.FORMATTING_FAILED,
      claudeCall,
      100
    );

    expect(error.message).toBe('Test error');
    expect(error.code).toBe(RESPONSE_FORMATTING_ERRORS.FORMATTING_FAILED);
    expect(error.toolCall).toBe(claudeCall);
    expect(error.formattingTimeMs).toBe(100);
    expect(error.name).toBe('ToolCallFormattingError');
  });
});

describe('Performance Tests', () => {
  let formatter: IToolFormatter;
  let idGenerator: IToolCallIdGenerator;

  beforeEach(() => {
    idGenerator = new ToolCallIdGenerator();
    formatter = new ToolCallFormatter(idGenerator);
  });

  it('should format tool calls within performance limits', () => {
    const claudeCalls: ClaudeToolCall[] = Array.from({ length: 10 }, (_, i) => ({
      name: `function_${i}`,
      arguments: { param: `value_${i}`, index: i }
    }));

    const startTime = Date.now();
    const result = formatter.formatToolCalls(claudeCalls);
    const duration = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(result.toolCalls).toHaveLength(10);
    expect(duration).toBeLessThan(10); // Should be very fast
  });

  it('should validate formatted calls quickly', () => {
    const toolCalls: OpenAIToolCall[] = Array.from({ length: 100 }, (_, i) => ({
      id: `call_test${i.toString().padStart(21, '0')}`,
      type: 'function',
      function: {
        name: `function_${i}`,
        arguments: JSON.stringify({ index: i })
      }
    }));

    const startTime = Date.now();
    for (const call of toolCalls) {
      formatter.validateFormattedCall(call);
    }
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(10); // Validation should be very fast
  });
});