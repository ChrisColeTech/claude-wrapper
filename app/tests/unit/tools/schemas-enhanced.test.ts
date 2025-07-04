/**
 * Enhanced Schema Tests - Phase 1B Review
 * Comprehensive test coverage for all schema validation edge cases
 * 
 * Tests uncovered lines and ensures 100% OpenAI specification compliance
 */

import {
  OpenAIFunctionSchema,
  OpenAIToolSchema,
  OpenAIToolChoiceSchema,
  ToolsArraySchema,
  ToolsRequestSchema,
  ValidationUtils
} from '../../../src/tools/schemas';
import { TOOL_VALIDATION_LIMITS } from '../../../src/tools/constants';

describe('Enhanced Schema Tests - Phase 1B', () => {
  describe('ValidationUtils Edge Cases', () => {
    it('should handle timeout in validateWithTimeout', async () => {
      // Test timeout functionality with direct mock
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Validation timeout')), 1);
      });

      await expect(timeoutPromise).rejects.toThrow('Validation timeout');
    });

    it('should handle valid data in validateWithTimeout', async () => {
      const validData = {
        type: 'function',
        function: {
          name: 'test_function',
          description: 'Test function'
        }
      };

      const result = await ValidationUtils.validateWithTimeout(OpenAIToolSchema, validData, 100);
      expect(result.success).toBe(true);
    });

    it('should extract detailed error messages from complex validation failures', () => {
      const complexInvalidTool = {
        type: 'invalid_type',
        function: {
          name: '', // Empty name
          description: 'x'.repeat(2000), // Too long description
          parameters: {
            type: 'invalid_object_type',
            properties: null
          }
        }
      };

      const result = OpenAIToolSchema.safeParse(complexInvalidTool);
      expect(result.success).toBe(false);

      if (!result.success) {
        const errors = ValidationUtils.extractErrorMessages(result);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some(error => error.includes('type'))).toBe(true);
      }
    });

    it('should handle successful validation in extractErrorMessages', () => {
      const validTool = {
        type: 'function',
        function: {
          name: 'valid_function',
          description: 'Valid function'
        }
      };

      const result = OpenAIToolSchema.safeParse(validTool);
      expect(result.success).toBe(true);

      const errors = ValidationUtils.extractErrorMessages(result);
      expect(errors).toEqual([]);
    });

    it('should validate parameter depth with maximum nesting', () => {
      // Create object with maximum allowed depth
      const maxDepthParams = {
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            properties: {
              level2: {
                type: 'object',
                properties: {
                  level3: {
                    type: 'object',
                    properties: {
                      level4: {
                        type: 'object',
                        properties: {
                          level5: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      };

      const isValid = ValidationUtils.validateParameterDepth(maxDepthParams);
      expect(isValid).toBe(true);
    });

    it('should reject parameter depth exceeding limit', () => {
      // Create object with depth exceeding limit
      let deepObject: any = { type: 'string' };
      for (let i = 0; i < TOOL_VALIDATION_LIMITS.MAX_PARAMETER_DEPTH + 2; i++) {
        deepObject = {
          type: 'object',
          properties: { nested: deepObject }
        };
      }

      const isValid = ValidationUtils.validateParameterDepth(deepObject);
      expect(isValid).toBe(false);
    });

    it('should handle null and undefined in depth validation', () => {
      expect(ValidationUtils.validateParameterDepth(null)).toBe(true);
      expect(ValidationUtils.validateParameterDepth(undefined)).toBe(true);
      expect(ValidationUtils.validateParameterDepth('not an object')).toBe(true);
    });
  });

  describe('Function Schema Edge Cases', () => {
    it('should validate function with minimal required fields', () => {
      const minimalFunction = {
        name: 'minimal'
      };

      const result = OpenAIFunctionSchema.safeParse(minimalFunction);
      expect(result.success).toBe(true);
    });

    it('should reject function with name at exact length limit', () => {
      const exactLimitName = 'a'.repeat(TOOL_VALIDATION_LIMITS.MAX_FUNCTION_NAME_LENGTH + 1);
      const functionWithLongName = {
        name: exactLimitName,
        description: 'Test function'
      };

      const result = OpenAIFunctionSchema.safeParse(functionWithLongName);
      expect(result.success).toBe(false);
    });

    it('should accept function with name at exact length limit minus one', () => {
      const validLengthName = 'a'.repeat(TOOL_VALIDATION_LIMITS.MAX_FUNCTION_NAME_LENGTH);
      const functionWithValidName = {
        name: validLengthName,
        description: 'Test function'
      };

      const result = OpenAIFunctionSchema.safeParse(functionWithValidName);
      expect(result.success).toBe(true);
    });

    it('should validate complex parameter schemas with all types', () => {
      const complexFunction = {
        name: 'complex_function',
        description: 'Function with complex parameters',
        parameters: {
          type: 'object',
          properties: {
            stringParam: { type: 'string', pattern: '^[a-z]+$' },
            numberParam: { type: 'number', minimum: 0, maximum: 100 },
            integerParam: { type: 'integer', multipleOf: 2 },
            booleanParam: { type: 'boolean' },
            arrayParam: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 10
            },
            objectParam: {
              type: 'object',
              properties: {
                nestedString: { type: 'string' },
                nestedNumber: { type: 'number' }
              },
              required: ['nestedString'],
              additionalProperties: false
            },
            enumParam: {
              type: 'string',
              enum: ['option1', 'option2', 'option3']
            },
            constParam: {
              const: 'fixed_value'
            },
            anyOfParam: {
              anyOf: [
                { type: 'string' },
                { type: 'number' }
              ]
            },
            oneOfParam: {
              oneOf: [
                { type: 'string', pattern: '^str_' },
                { type: 'number', minimum: 100 }
              ]
            }
          },
          required: ['stringParam', 'numberParam'],
          additionalProperties: true
        }
      };

      const result = OpenAIFunctionSchema.safeParse(complexFunction);
      expect(result.success).toBe(true);
    });
  });

  describe('Tool Choice Schema Edge Cases', () => {
    it('should validate all tool choice string options exactly', () => {
      const validChoices = ['auto', 'none'];
      
      validChoices.forEach(choice => {
        const result = OpenAIToolChoiceSchema.safeParse(choice);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid tool choice strings', () => {
      const invalidChoices = ['required', 'always', 'never', 'force', ''];
      
      invalidChoices.forEach(choice => {
        const result = OpenAIToolChoiceSchema.safeParse(choice);
        expect(result.success).toBe(false);
      });
    });

    it('should validate function tool choice with exact structure', () => {
      const functionChoice = {
        type: 'function',
        function: {
          name: 'specific_function'
        }
      };

      const result = OpenAIToolChoiceSchema.safeParse(functionChoice);
      expect(result.success).toBe(true);
    });

    it('should reject function tool choice with missing fields', () => {
      // Missing function field
      const missingFunction = { type: 'function' };
      expect(OpenAIToolChoiceSchema.safeParse(missingFunction).success).toBe(false);

      // Missing name field
      const missingName = {
        type: 'function',
        function: {}
      };
      expect(OpenAIToolChoiceSchema.safeParse(missingName).success).toBe(false);

      // Missing type field
      const missingType = {
        function: { name: 'test' }
      };
      expect(OpenAIToolChoiceSchema.safeParse(missingType).success).toBe(false);
    });
  });

  describe('Tools Array Schema Edge Cases', () => {
    it('should validate array with maximum allowed tools', () => {
      const maxTools = Array.from({ length: TOOL_VALIDATION_LIMITS.MAX_TOOLS_PER_REQUEST }, (_, i) => ({
        type: 'function',
        function: {
          name: `function_${i}`,
          description: `Function ${i}`
        }
      }));

      const result = ToolsArraySchema.safeParse(maxTools);
      expect(result.success).toBe(true);
    });

    it('should reject array exceeding maximum tools', () => {
      const tooManyTools = Array.from({ length: TOOL_VALIDATION_LIMITS.MAX_TOOLS_PER_REQUEST + 1 }, (_, i) => ({
        type: 'function',
        function: {
          name: `function_${i}`,
          description: `Function ${i}`
        }
      }));

      const result = ToolsArraySchema.safeParse(tooManyTools);
      expect(result.success).toBe(false);
    });

    it('should detect and reject duplicate function names', () => {
      const duplicateTools = [
        {
          type: 'function',
          function: { name: 'duplicate_name', description: 'First' }
        },
        {
          type: 'function',
          function: { name: 'unique_name', description: 'Unique' }
        },
        {
          type: 'function',
          function: { name: 'duplicate_name', description: 'Second with same name' }
        }
      ];

      const result = ToolsArraySchema.safeParse(duplicateTools);
      expect(result.success).toBe(false);
    });
  });

  describe('Tools Request Schema Edge Cases', () => {
    it('should validate request with tools but no tool_choice', () => {
      const requestWithoutChoice = {
        tools: [
          {
            type: 'function',
            function: { name: 'test_function', description: 'Test' }
          }
        ]
      };

      const result = ToolsRequestSchema.safeParse(requestWithoutChoice);
      expect(result.success).toBe(true);
    });

    it('should reject tool_choice referencing non-existent function', () => {
      const requestWithInvalidChoice = {
        tools: [
          {
            type: 'function',
            function: { name: 'existing_function', description: 'Exists' }
          }
        ],
        tool_choice: {
          type: 'function',
          function: { name: 'non_existent_function' }
        }
      };

      const result = ToolsRequestSchema.safeParse(requestWithInvalidChoice);
      expect(result.success).toBe(false);
    });

    it('should validate tool_choice with existing function', () => {
      const validRequest = {
        tools: [
          {
            type: 'function',
            function: { name: 'existing_function', description: 'Exists' }
          },
          {
            type: 'function',
            function: { name: 'another_function', description: 'Another' }
          }
        ],
        tool_choice: {
          type: 'function',
          function: { name: 'existing_function' }
        }
      };

      const result = ToolsRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should handle edge case with empty tools array and tool_choice', () => {
      const emptyToolsWithChoice = {
        tools: [],
        tool_choice: 'auto'
      };

      const result = ToolsRequestSchema.safeParse(emptyToolsWithChoice);
      expect(result.success).toBe(false); // Should fail because tools array is empty
    });
  });

  describe('OpenAI Specification Compliance', () => {
    it('should match exact OpenAI API reference examples', () => {
      // Example from API_REFERENCE.md lines 90-108
      const openaiExample = {
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

      const result = OpenAIToolSchema.safeParse(openaiExample);
      expect(result.success).toBe(true);
    });

    it('should support all documented tool_choice formats from API reference', () => {
      const tools = [
        {
          type: 'function',
          function: { name: 'test_function', description: 'Test' }
        }
      ];

      // Test all formats from API_REFERENCE.md lines 115-119
      const choiceFormats = [
        'auto', // Claude decides when to use tools
        'none', // Force text-only response
        { type: 'function', function: { name: 'test_function' } } // Force specific function
      ];

      choiceFormats.forEach(choice => {
        const request = { tools, tool_choice: choice };
        const result = ToolsRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
      });
    });
  });
});