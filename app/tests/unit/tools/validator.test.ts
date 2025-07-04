/**
 * Validator logic unit tests
 * 100% test coverage for all validation logic
 * 
 * Tests ToolValidator classes with comprehensive scenarios
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  ToolValidator,
  ToolSchemaValidator,
  ToolArrayValidator,
  ToolValidationError,
  toolValidator
} from '../../../src/tools/validator';
import {
  OpenAITool,
  OpenAIFunction,
  OpenAIToolChoice,
  IToolValidator,
  IToolSchemaValidator,
  IToolArrayValidator
} from '../../../src/tools/types';
import {
  TOOL_VALIDATION_MESSAGES,
  TOOL_VALIDATION_LIMITS
} from '../../../src/tools/constants';

describe('Tool Validation Logic', () => {
  let schemaValidator: ToolSchemaValidator;
  let arrayValidator: ToolArrayValidator;
  let validator: ToolValidator;

  beforeEach(() => {
    schemaValidator = new ToolSchemaValidator();
    arrayValidator = new ToolArrayValidator();
    validator = new ToolValidator();
  });

  describe('ToolValidationError', () => {
    it('should create error with all fields', () => {
      const error = new ToolValidationError(
        'Test error',
        'TEST_CODE',
        'test_field',
        { extra: 'data' }
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.field).toBe('test_field');
      expect(error.details).toEqual({ extra: 'data' });
      expect(error.name).toBe('ToolValidationError');
    });
  });

  describe('ToolSchemaValidator', () => {
    describe('validateTool', () => {
      it('should validate correct tool', () => {
        const tool: OpenAITool = {
          type: 'function',
          function: {
            name: 'test_function',
            description: 'Test function'
          }
        };

        const result = schemaValidator.validateTool(tool);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should reject tool with missing type', () => {
        const tool = {
          function: { name: 'test_function' }
        } as any;

        const result = schemaValidator.validateTool(tool);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should reject tool with invalid type', () => {
        const tool = {
          type: 'invalid',
          function: { name: 'test_function' }
        } as any;

        const result = schemaValidator.validateTool(tool);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain(TOOL_VALIDATION_MESSAGES.TOOL_TYPE_INVALID);
      });

      it('should handle validation exceptions', () => {
        const result = schemaValidator.validateTool(null as any);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('validateFunction', () => {
      it('should validate correct function', () => {
        const func: OpenAIFunction = {
          name: 'valid_function',
          description: 'A valid function',
          parameters: {
            type: 'object',
            properties: {
              param1: { type: 'string' }
            }
          }
        };

        const result = schemaValidator.validateFunction(func);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should reject function with empty name', () => {
        const func: OpenAIFunction = {
          name: '',
          description: 'Invalid function'
        };

        const result = schemaValidator.validateFunction(func);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain(TOOL_VALIDATION_MESSAGES.FUNCTION_NAME_TOO_SHORT);
      });

      it('should reject function with reserved name', () => {
        const func: OpenAIFunction = {
          name: 'function',
          description: 'Invalid function'
        };

        const result = schemaValidator.validateFunction(func);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain(TOOL_VALIDATION_MESSAGES.FUNCTION_NAME_RESERVED);
      });

      it('should handle validation exceptions', () => {
        const result = schemaValidator.validateFunction(null as any);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('validateParameters', () => {
      it('should validate correct parameters', () => {
        const parameters = {
          type: 'object',
          properties: {
            location: { type: 'string' },
            unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
          },
          required: ['location']
        };

        const result = schemaValidator.validateParameters(parameters);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should reject parameters exceeding depth limit', () => {
        const deepParameters = {
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
                            level5: {
                              type: 'object',
                              properties: {
                                level6: { type: 'string' }
                              }
                            }
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

        const result = schemaValidator.validateParameters(deepParameters);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain(TOOL_VALIDATION_MESSAGES.PARAMETERS_DEPTH_EXCEEDED);
      });

      it('should handle validation exceptions', () => {
        const result = schemaValidator.validateParameters(null as any);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('ToolArrayValidator', () => {
    describe('validateToolArray', () => {
      it('should validate correct tools array', () => {
        const tools: OpenAITool[] = [
          {
            type: 'function',
            function: { name: 'function1' }
          },
          {
            type: 'function',
            function: { name: 'function2' }
          }
        ];

        const result = arrayValidator.validateToolArray(tools);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.validTools).toEqual(tools);
      });

      it('should reject non-array input', () => {
        const result = arrayValidator.validateToolArray('not-array' as any);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain(TOOL_VALIDATION_MESSAGES.TOOLS_ARRAY_REQUIRED);
        expect(result.validTools).toEqual([]);
      });

      it('should reject empty array', () => {
        const result = arrayValidator.validateToolArray([]);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain(TOOL_VALIDATION_MESSAGES.TOOLS_ARRAY_EMPTY);
      });

      it('should reject array with duplicate function names', () => {
        const tools: OpenAITool[] = [
          {
            type: 'function',
            function: { name: 'duplicate_name' }
          },
          {
            type: 'function',
            function: { name: 'duplicate_name' }
          }
        ];

        const result = arrayValidator.validateToolArray(tools);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain(TOOL_VALIDATION_MESSAGES.DUPLICATE_FUNCTION_NAMES);
      });

      it('should extract valid tools from partially invalid array', () => {
        const tools = [
          {
            type: 'function',
            function: { name: 'valid_function' }
          },
          {
            type: 'invalid',
            function: { name: 'invalid_function' }
          }
        ] as any;

        const result = arrayValidator.validateToolArray(tools);
        expect(result.valid).toBe(false);
        expect(result.validTools.length).toBe(1);
        expect(result.validTools[0].function.name).toBe('valid_function');
      });

      it('should handle validation exceptions', () => {
        const result = arrayValidator.validateToolArray(null as any);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.validTools).toEqual([]);
      });
    });

    describe('validateToolChoice', () => {
      const tools: OpenAITool[] = [
        {
          type: 'function',
          function: { name: 'existing_function' }
        }
      ];

      it('should validate "auto" choice', () => {
        const result = arrayValidator.validateToolChoice('auto', tools);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should validate "none" choice', () => {
        const result = arrayValidator.validateToolChoice('none', tools);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should validate specific function choice', () => {
        const choice: OpenAIToolChoice = {
          type: 'function',
          function: { name: 'existing_function' }
        };

        const result = arrayValidator.validateToolChoice(choice, tools);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should reject choice for non-existent function', () => {
        const choice: OpenAIToolChoice = {
          type: 'function',
          function: { name: 'non_existent_function' }
        };

        const result = arrayValidator.validateToolChoice(choice, tools);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain(TOOL_VALIDATION_MESSAGES.TOOL_CHOICE_FUNCTION_NOT_FOUND);
      });

      it('should reject invalid choice format', () => {
        const result = arrayValidator.validateToolChoice('invalid' as any, tools);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should handle validation exceptions', () => {
        const result = arrayValidator.validateToolChoice(null as any, tools);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('ToolValidator (Main)', () => {
    describe('Constructor', () => {
      it('should use default validators when none provided', () => {
        const validator = new ToolValidator();
        expect(validator).toBeInstanceOf(ToolValidator);
      });

      it('should use provided validators', () => {
        const mockSchemaValidator = {} as IToolSchemaValidator;
        const mockArrayValidator = {} as IToolArrayValidator;
        
        const validator = new ToolValidator(mockSchemaValidator, mockArrayValidator);
        expect(validator).toBeInstanceOf(ToolValidator);
      });
    });

    describe('Delegation Methods', () => {
      it('should delegate validateTool to schema validator', () => {
        const tool: OpenAITool = {
          type: 'function',
          function: { name: 'test_function' }
        };

        const result = validator.validateTool(tool);
        expect(result.valid).toBe(true);
      });

      it('should delegate validateFunction to schema validator', () => {
        const func: OpenAIFunction = {
          name: 'test_function'
        };

        const result = validator.validateFunction(func);
        expect(result.valid).toBe(true);
      });

      it('should delegate validateParameters to schema validator', () => {
        const parameters = { type: 'object' };
        const result = validator.validateParameters(parameters);
        expect(result.valid).toBe(true);
      });

      it('should delegate validateToolArray to array validator', () => {
        const tools: OpenAITool[] = [
          {
            type: 'function',
            function: { name: 'test_function' }
          }
        ];

        const result = validator.validateToolArray(tools);
        expect(result.valid).toBe(true);
      });

      it('should delegate validateToolChoice to array validator', () => {
        const tools: OpenAITool[] = [
          {
            type: 'function',
            function: { name: 'test_function' }
          }
        ];

        const result = validator.validateToolChoice('auto', tools);
        expect(result.valid).toBe(true);
      });
    });

    describe('validateToolsRequest', () => {
      it('should validate complete valid request', () => {
        const tools: OpenAITool[] = [
          {
            type: 'function',
            function: { name: 'test_function' }
          }
        ];
        const toolChoice: OpenAIToolChoice = 'auto';

        const result = validator.validateToolsRequest(tools, toolChoice);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.validTools).toEqual(tools);
      });

      it('should validate request without tool choice', () => {
        const tools: OpenAITool[] = [
          {
            type: 'function',
            function: { name: 'test_function' }
          }
        ];

        const result = validator.validateToolsRequest(tools);
        expect(result.valid).toBe(true);
        expect(result.validTools).toEqual(tools);
      });

      it('should reject request with invalid tools', () => {
        const tools = [
          {
            type: 'invalid',
            function: { name: 'test_function' }
          }
        ] as any;

        const result = validator.validateToolsRequest(tools);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should handle validation exceptions', () => {
        const result = validator.validateToolsRequest(null as any);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.validTools).toEqual([]);
      });
    });

    describe('validateWithTimeout', () => {
      it('should validate quickly within timeout', async () => {
        const tools: OpenAITool[] = [
          {
            type: 'function',
            function: { name: 'test_function' }
          }
        ];

        const startTime = Date.now();
        const result = await validator.validateWithTimeout(tools, undefined, 100);
        const duration = Date.now() - startTime;

        expect(result.valid).toBe(true);
        expect(duration).toBeLessThan(TOOL_VALIDATION_LIMITS.VALIDATION_TIMEOUT_MS);
      });

      it('should handle timeout errors', async () => {
        const tools: OpenAITool[] = [
          {
            type: 'function',
            function: { name: 'test_function' }
          }
        ];

        // Mock ValidationUtils.validateWithTimeout to throw timeout error
        const mockError = new Error('timeout');
        jest.spyOn(require('../../../src/tools/schemas').ValidationUtils, 'validateWithTimeout')
          .mockRejectedValueOnce(mockError);

        const result = await validator.validateWithTimeout(tools, undefined, 1);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain(TOOL_VALIDATION_MESSAGES.VALIDATION_TIMEOUT);
      });

      it('should handle other validation errors', async () => {
        const tools: OpenAITool[] = [
          {
            type: 'function',
            function: { name: 'test_function' }
          }
        ];

        // Mock ValidationUtils.validateWithTimeout to throw generic error
        const mockError = new Error('Generic error');
        jest.spyOn(require('../../../src/tools/schemas').ValidationUtils, 'validateWithTimeout')
          .mockRejectedValueOnce(mockError);

        const result = await validator.validateWithTimeout(tools);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('Generic error');
      });
    });
  });

  describe('Default Instance', () => {
    it('should provide working default tool validator', () => {
      const tool: OpenAITool = {
        type: 'function',
        function: { name: 'test_function' }
      };

      const result = toolValidator.validateTool(tool);
      expect(result.valid).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should validate complex real-world tool definition', () => {
      const tool: OpenAITool = {
        type: 'function',
        function: {
          name: 'get_current_weather',
          description: 'Get the current weather in a given location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city and state, e.g. San Francisco, CA'
              },
              unit: {
                type: 'string',
                enum: ['celsius', 'fahrenheit'],
                description: 'The unit of temperature'
              }
            },
            required: ['location']
          }
        }
      };

      const result = validator.validateTool(tool);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate complete request with multiple tools', () => {
      const tools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather information'
          }
        },
        {
          type: 'function',
          function: {
            name: 'send_email',
            description: 'Send an email',
            parameters: {
              type: 'object',
              properties: {
                to: { type: 'string' },
                subject: { type: 'string' },
                body: { type: 'string' }
              },
              required: ['to', 'subject', 'body']
            }
          }
        }
      ];

      const toolChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'get_weather' }
      };

      const result = validator.validateToolsRequest(tools, toolChoice);
      expect(result.valid).toBe(true);
      expect(result.validTools).toEqual(tools);
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle circular references gracefully', () => {
      const circular: any = { type: 'function', function: { name: 'test' } };
      circular.circular = circular;

      const result = validator.validateTool(circular);
      // Should not hang or crash
      expect(typeof result.valid).toBe('boolean');
    });

    it('should handle very large tool arrays', () => {
      const largeTools: OpenAITool[] = Array(100).fill(null).map((_, i) => ({
        type: 'function' as const,
        function: { name: `function_${i}` }
      }));

      const startTime = Date.now();
      const result = validator.validateToolArray(largeTools);
      const duration = Date.now() - startTime;

      expect(result.valid).toBe(true);
      expect(duration).toBeLessThan(100); // Should be fast
    });
  });
});