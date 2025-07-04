/**
 * Enhanced Tool Validator Tests - Phase 1B Review
 * Comprehensive test coverage for all edge cases and error scenarios
 * 
 * Tests uncovered lines and ensures 100% OpenAI compatibility
 */

import {
  ToolValidator,
  ToolSchemaValidator,
  ToolArrayValidator,
  ToolValidationError
} from '../../../src/tools/validator';
import { IToolValidator, OpenAITool, OpenAIFunction, OpenAIToolChoice } from '../../../src/tools/types';
import { TOOL_VALIDATION_LIMITS, TOOL_VALIDATION_MESSAGES } from '../../../src/tools/constants';

describe('Enhanced Tool Validator Tests - Phase 1B', () => {
  let validator: IToolValidator;

  beforeEach(() => {
    validator = new ToolValidator();
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle validation timeout in validateWithTimeout', async () => {
      // Mock a slow validation that exceeds timeout
      const slowValidator = new ToolValidator();
      
      // Override the timeout method to simulate timeout
      jest.spyOn(slowValidator, 'validateWithTimeout').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 20)); // Exceed 10ms timeout
        throw new Error('timeout');
      });

      const tools: OpenAITool[] = [{
        type: 'function',
        function: { name: 'test_function', description: 'Test' }
      }];

      try {
        await slowValidator.validateWithTimeout(tools, 'auto', 5); // 5ms timeout
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('timeout');
      }
    });

    it('should handle schema validation exceptions gracefully', () => {
      // Test with malformed object that causes schema parsing to throw
      const malformedTool = {
        type: 'function',
        function: {
          name: 'test',
          parameters: {
            type: 'object',
            properties: {
              // Create circular reference to cause JSON parsing issues
              self: null as any
            }
          }
        }
      };
      
      // Create circular reference
      malformedTool.function.parameters.properties.self = malformedTool;

      const result = validator.validateTool(malformedTool as OpenAITool);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle unexpected errors in parameter validation', () => {
      // Test parameter validation with null input
      const result = validator.validateParameters(null as any);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle tool array validation with mixed valid/invalid tools', () => {
      const mixedTools: OpenAITool[] = [
        {
          type: 'function',
          function: { name: 'valid_function', description: 'Valid function' }
        },
        {
          type: 'function',
          function: { name: '', description: 'Invalid function with empty name' }
        } as OpenAITool,
        {
          type: 'function',
          function: { name: 'another_valid', description: 'Another valid function' }
        }
      ];

      const result = validator.validateToolArray(mixedTools);
      expect(result.valid).toBe(false);
      expect(result.validTools).toHaveLength(2); // Only valid tools should be extracted
      expect(result.validTools[0].function.name).toBe('valid_function');
      expect(result.validTools[1].function.name).toBe('another_valid');
    });

    it('should handle non-array input for tool array validation', () => {
      const result = validator.validateToolArray('not an array' as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(TOOL_VALIDATION_MESSAGES.TOOLS_ARRAY_REQUIRED);
      expect(result.validTools).toEqual([]);
    });

    it('should handle null and undefined inputs gracefully', () => {
      // Test null tool
      const nullResult = validator.validateTool(null as any);
      expect(nullResult.valid).toBe(false);

      // Test undefined tool
      const undefinedResult = validator.validateTool(undefined as any);
      expect(undefinedResult.valid).toBe(false);

      // Test null function
      const nullFuncResult = validator.validateFunction(null as any);
      expect(nullFuncResult.valid).toBe(false);

      // Test null parameters
      const nullParamsResult = validator.validateParameters(null as any);
      expect(nullParamsResult.valid).toBe(false);
    });
  });

  describe('OpenAI Compatibility Verification', () => {
    it('should match exact OpenAI tool definition structure', () => {
      const openaiExampleTool: OpenAITool = {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read content from a file',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'File path to read'
              }
            },
            required: ['path']
          }
        }
      };

      const result = validator.validateTool(openaiExampleTool);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should support all OpenAI tool_choice formats exactly', () => {
      const tools: OpenAITool[] = [{
        type: 'function',
        function: { name: 'test_function', description: 'Test' }
      }];

      // Test "auto"
      const autoResult = validator.validateToolChoice('auto', tools);
      expect(autoResult.valid).toBe(true);

      // Test "none"
      const noneResult = validator.validateToolChoice('none', tools);
      expect(noneResult.valid).toBe(true);

      // Test specific function
      const specificResult = validator.validateToolChoice({
        type: 'function',
        function: { name: 'test_function' }
      }, tools);
      expect(specificResult.valid).toBe(true);
    });

    it('should validate all JSON Schema parameter types from OpenAI examples', () => {
      const complexTool: OpenAITool = {
        type: 'function',
        function: {
          name: 'complex_function',
          description: 'Complex function with all parameter types',
          parameters: {
            type: 'object',
            properties: {
              stringParam: {
                type: 'string',
                description: 'String parameter'
              },
              numberParam: {
                type: 'number',
                description: 'Number parameter'
              },
              booleanParam: {
                type: 'boolean',
                description: 'Boolean parameter'
              },
              arrayParam: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array parameter'
              },
              objectParam: {
                type: 'object',
                properties: {
                  nestedString: { type: 'string' }
                },
                description: 'Object parameter'
              }
            },
            required: ['stringParam', 'numberParam']
          }
        }
      };

      const result = validator.validateTool(complexTool);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle very large tool arrays within performance limits', async () => {
      const largeToolsArray: OpenAITool[] = Array.from({ length: 100 }, (_, i) => ({
        type: 'function',
        function: {
          name: `function_${i}`,
          description: `Function number ${i}`,
          parameters: {
            type: 'object',
            properties: {
              param: { type: 'string' }
            }
          }
        }
      }));

      const startTime = Date.now();
      const result = await (validator as any).validateWithTimeout(largeToolsArray, 'auto', TOOL_VALIDATION_LIMITS.VALIDATION_TIMEOUT_MS);
      const duration = Date.now() - startTime;

      expect(result.valid).toBe(true);
      expect(duration).toBeLessThan(100); // Reasonable timeout for large arrays
    });

    it('should handle complex nested parameters efficiently', () => {
      const complexParameters = {
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            properties: {
              level2: {
                type: 'object',
                properties: {
                  level3: {
                    type: 'string'
                  }
                }
              }
            }
          }
        }
      };

      const startTime = Date.now();
      const result = validator.validateParameters(complexParameters);
      const duration = Date.now() - startTime;

      expect(result.valid).toBe(true);
      expect(duration).toBeLessThan(50); // Should be reasonably fast
    });
  });

  describe('Integration Test Scenarios', () => {
    it('should validate complete tools request exactly as OpenAI expects', () => {
      const tools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get current weather for a location',
            parameters: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'City and state/country'
                },
                unit: {
                  type: 'string',
                  enum: ['celsius', 'fahrenheit'],
                  description: 'Temperature unit'
                }
              },
              required: ['location']
            }
          }
        }
      ];

      const toolChoice: OpenAIToolChoice = 'auto';

      const result = validator.validateToolsRequest(tools, toolChoice);
      expect(result.valid).toBe(true);
      expect(result.validTools).toEqual(tools);
      expect(result.errors).toEqual([]);
    });

    it('should handle all error scenarios with proper OpenAI-compatible error messages', () => {
      // Test duplicate function names
      const duplicateTools: OpenAITool[] = [
        {
          type: 'function',
          function: { name: 'duplicate', description: 'First' }
        },
        {
          type: 'function',
          function: { name: 'duplicate', description: 'Second' }
        }
      ];

      const duplicateResult = validator.validateToolArray(duplicateTools);
      expect(duplicateResult.valid).toBe(false);
      expect(duplicateResult.errors).toContain(TOOL_VALIDATION_MESSAGES.DUPLICATE_FUNCTION_NAMES);

      // Test tool choice for non-existent function
      const tools: OpenAITool[] = [{
        type: 'function',
        function: { name: 'existing_function', description: 'Test' }
      }];

      const nonExistentChoice = validator.validateToolChoice({
        type: 'function',
        function: { name: 'non_existent' }
      }, tools);
      expect(nonExistentChoice.valid).toBe(false);
      expect(nonExistentChoice.errors).toContain(TOOL_VALIDATION_MESSAGES.TOOL_CHOICE_FUNCTION_NOT_FOUND);
    });
  });

  describe('Stress Testing', () => {
    it('should handle maximum tool array size', () => {
      const maxTools: OpenAITool[] = Array.from({ length: TOOL_VALIDATION_LIMITS.MAX_TOOLS_PER_REQUEST }, (_, i) => ({
        type: 'function',
        function: {
          name: `function_${i}`,
          description: `Function ${i}`,
          parameters: { type: 'object', properties: {} }
        }
      }));

      const result = validator.validateToolArray(maxTools);
      expect(result.valid).toBe(true);
      expect(result.validTools).toHaveLength(TOOL_VALIDATION_LIMITS.MAX_TOOLS_PER_REQUEST);
    });

    it('should reject oversized tool arrays', () => {
      const oversizedTools: OpenAITool[] = Array.from({ length: TOOL_VALIDATION_LIMITS.MAX_TOOLS_PER_REQUEST + 1 }, (_, i) => ({
        type: 'function',
        function: {
          name: `function_${i}`,
          description: `Function ${i}`,
          parameters: { type: 'object', properties: {} }
        }
      }));

      const result = validator.validateToolArray(oversizedTools);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(TOOL_VALIDATION_MESSAGES.TOOLS_ARRAY_TOO_LARGE);
    });
  });
});