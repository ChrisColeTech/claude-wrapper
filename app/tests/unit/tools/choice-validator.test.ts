/**
 * Unit tests for Tool Choice Validator
 * Phase 2A: Tool Request Parameter Processing
 * 
 * Tests tool choice validation logic with 100% coverage
 */

import {
  ToolChoiceValidator,
  ToolChoiceValidationError,
  ToolChoiceValidationUtils,
  toolChoiceValidator,
  IToolChoiceValidator
} from '../../../src/tools/choice-validator';
import { OpenAITool, OpenAIToolChoice, ToolValidationResult } from '../../../src/tools/types';
import { 
  TOOL_CHOICE_OPTIONS, 
  TOOL_CHOICE_TYPES, 
  TOOL_VALIDATION_MESSAGES 
} from '../../../src/tools/constants';

describe('ToolChoiceValidator', () => {
  let validator: IToolChoiceValidator;
  let mockTools: OpenAITool[];

  beforeEach(() => {
    validator = new ToolChoiceValidator();
    mockTools = [
      {
        type: 'function',
        function: {
          name: 'test_function_1',
          description: 'First test function',
          parameters: { type: 'object', properties: {} }
        }
      },
      {
        type: 'function',
        function: {
          name: 'test_function_2',
          description: 'Second test function',
          parameters: { type: 'object', properties: {} }
        }
      }
    ];
  });

  describe('validateToolChoice', () => {
    it('should validate auto tool choice', () => {
      const result = validator.validateToolChoice('auto', mockTools);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate none tool choice', () => {
      const result = validator.validateToolChoice('none', mockTools);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate function tool choice with existing function', () => {
      const toolChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'test_function_1' }
      };

      const result = validator.validateToolChoice(toolChoice, mockTools);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject function tool choice with non-existing function', () => {
      const toolChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'non_existing_function' }
      };

      const result = validator.validateToolChoice(toolChoice, mockTools);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(TOOL_VALIDATION_MESSAGES.TOOL_CHOICE_FUNCTION_NOT_FOUND);
    });

    it('should reject invalid string tool choice', () => {
      const result = validator.validateToolChoice('invalid' as OpenAIToolChoice, mockTools);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle validation errors gracefully', () => {
      // Pass invalid data to trigger error handling
      const result = validator.validateToolChoice(123 as any, mockTools);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateToolChoiceFormat', () => {
    it('should validate auto format', () => {
      const result = validator.validateToolChoiceFormat('auto');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate none format', () => {
      const result = validator.validateToolChoiceFormat('none');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate function object format', () => {
      const toolChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'test_function' }
      };

      const result = validator.validateToolChoiceFormat(toolChoice);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid string values', () => {
      const result = validator.validateToolChoiceFormat('invalid' as OpenAIToolChoice);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(`Tool choice string must be "${TOOL_CHOICE_OPTIONS.AUTO}" or "${TOOL_CHOICE_OPTIONS.NONE}"`);
    });

    it('should reject function object without type', () => {
      const toolChoice = {
        function: { name: 'test_function' }
      } as any;

      const result = validator.validateToolChoiceFormat(toolChoice);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(`Tool choice type must be "${TOOL_CHOICE_TYPES.FUNCTION}"`);
    });

    it('should reject function object with wrong type', () => {
      const toolChoice = {
        type: 'invalid',
        function: { name: 'test_function' }
      } as any;

      const result = validator.validateToolChoiceFormat(toolChoice);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(`Tool choice type must be "${TOOL_CHOICE_TYPES.FUNCTION}"`);
    });

    it('should reject function object without function field', () => {
      const toolChoice = {
        type: 'function'
      } as any;

      const result = validator.validateToolChoiceFormat(toolChoice);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Tool choice function field is required');
    });

    it('should reject function object without function name', () => {
      const toolChoice = {
        type: 'function',
        function: {}
      } as any;

      const result = validator.validateToolChoiceFormat(toolChoice);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Tool choice function.name is required and must be a string');
    });

    it('should reject function object with empty function name', () => {
      const toolChoice = {
        type: 'function',
        function: { name: '   ' }
      } as any;

      const result = validator.validateToolChoiceFormat(toolChoice);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Tool choice function.name cannot be empty');
    });

    it('should reject invalid data types', () => {
      const result = validator.validateToolChoiceFormat(123 as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(TOOL_VALIDATION_MESSAGES.TOOL_CHOICE_INVALID);
    });

    it('should handle format validation errors gracefully', () => {
      // This test ensures error handling in format validation
      const result = validator.validateToolChoiceFormat(null as any);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateToolChoiceConsistency', () => {
    it('should validate string choices without consistency check', () => {
      const result = validator.validateToolChoiceConsistency('auto', mockTools);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate function choice that exists in tools', () => {
      const toolChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'test_function_1' }
      };

      const result = validator.validateToolChoiceConsistency(toolChoice, mockTools);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject function choice that does not exist in tools', () => {
      const toolChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'non_existing_function' }
      };

      const result = validator.validateToolChoiceConsistency(toolChoice, mockTools);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(TOOL_VALIDATION_MESSAGES.TOOL_CHOICE_FUNCTION_NOT_FOUND);
    });

    it('should handle consistency validation errors gracefully', () => {
      // Mock a scenario that could throw an error
      const toolChoice = { type: 'function', function: { name: 'test' } } as OpenAIToolChoice;
      const invalidTools = null as any;

      const result = validator.validateToolChoiceConsistency(toolChoice, invalidTools);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('isValidToolChoiceValue', () => {
    it('should return true for auto string', () => {
      const isValid = validator.isValidToolChoiceValue('auto');

      expect(isValid).toBe(true);
    });

    it('should return true for none string', () => {
      const isValid = validator.isValidToolChoiceValue('none');

      expect(isValid).toBe(true);
    });

    it('should return true for valid function object', () => {
      const toolChoice = {
        type: 'function',
        function: { name: 'test_function' }
      };

      const isValid = validator.isValidToolChoiceValue(toolChoice);

      expect(isValid).toBe(true);
    });

    it('should return false for invalid string', () => {
      const isValid = validator.isValidToolChoiceValue('invalid');

      expect(isValid).toBe(false);
    });

    it('should return false for invalid object type', () => {
      const toolChoice = {
        type: 'invalid',
        function: { name: 'test_function' }
      };

      const isValid = validator.isValidToolChoiceValue(toolChoice);

      expect(isValid).toBe(false);
    });

    it('should return false for object without function', () => {
      const toolChoice = {
        type: 'function'
      };

      const isValid = validator.isValidToolChoiceValue(toolChoice);

      expect(isValid).toBe(false);
    });

    it('should return false for object with empty function name', () => {
      const toolChoice = {
        type: 'function',
        function: { name: '' }
      };

      const isValid = validator.isValidToolChoiceValue(toolChoice);

      expect(isValid).toBe(false);
    });

    it('should return false for null', () => {
      const isValid = validator.isValidToolChoiceValue(null);

      expect(isValid).toBe(false);
    });

    it('should return false for undefined', () => {
      const isValid = validator.isValidToolChoiceValue(undefined);

      expect(isValid).toBe(false);
    });

    it('should return false for number', () => {
      const isValid = validator.isValidToolChoiceValue(123);

      expect(isValid).toBe(false);
    });
  });

  describe('ToolChoiceValidationUtils', () => {
    describe('getToolChoiceType', () => {
      it('should return string value for string choices', () => {
        const type = ToolChoiceValidationUtils.getToolChoiceType('auto');

        expect(type).toBe('auto');
      });

      it('should return type property for object choices', () => {
        const toolChoice: OpenAIToolChoice = {
          type: 'function',
          function: { name: 'test' }
        };

        const type = ToolChoiceValidationUtils.getToolChoiceType(toolChoice);

        expect(type).toBe('function');
      });

      it('should return unknown for invalid choices', () => {
        const type = ToolChoiceValidationUtils.getToolChoiceType({} as any);

        expect(type).toBe('unknown');
      });
    });

    describe('getFunctionName', () => {
      it('should return function name for function choice', () => {
        const toolChoice: OpenAIToolChoice = {
          type: 'function',
          function: { name: 'test_function' }
        };

        const name = ToolChoiceValidationUtils.getFunctionName(toolChoice);

        expect(name).toBe('test_function');
      });

      it('should return undefined for string choices', () => {
        const name = ToolChoiceValidationUtils.getFunctionName('auto');

        expect(name).toBeUndefined();
      });

      it('should return undefined for non-function objects', () => {
        const name = ToolChoiceValidationUtils.getFunctionName({} as any);

        expect(name).toBeUndefined();
      });
    });

    describe('isAutoChoice', () => {
      it('should return true for auto choice', () => {
        const isAuto = ToolChoiceValidationUtils.isAutoChoice('auto');

        expect(isAuto).toBe(true);
      });

      it('should return false for none choice', () => {
        const isAuto = ToolChoiceValidationUtils.isAutoChoice('none');

        expect(isAuto).toBe(false);
      });

      it('should return false for function choice', () => {
        const toolChoice: OpenAIToolChoice = {
          type: 'function',
          function: { name: 'test' }
        };

        const isAuto = ToolChoiceValidationUtils.isAutoChoice(toolChoice);

        expect(isAuto).toBe(false);
      });
    });

    describe('isNoneChoice', () => {
      it('should return true for none choice', () => {
        const isNone = ToolChoiceValidationUtils.isNoneChoice('none');

        expect(isNone).toBe(true);
      });

      it('should return false for auto choice', () => {
        const isNone = ToolChoiceValidationUtils.isNoneChoice('auto');

        expect(isNone).toBe(false);
      });

      it('should return false for function choice', () => {
        const toolChoice: OpenAIToolChoice = {
          type: 'function',
          function: { name: 'test' }
        };

        const isNone = ToolChoiceValidationUtils.isNoneChoice(toolChoice);

        expect(isNone).toBe(false);
      });
    });

    describe('isFunctionChoice', () => {
      it('should return true for function choice', () => {
        const toolChoice: OpenAIToolChoice = {
          type: 'function',
          function: { name: 'test' }
        };

        const isFunction = ToolChoiceValidationUtils.isFunctionChoice(toolChoice);

        expect(isFunction).toBe(true);
      });

      it('should return false for string choices', () => {
        const isFunction = ToolChoiceValidationUtils.isFunctionChoice('auto');

        expect(isFunction).toBe(false);
      });

      it('should return false for non-function objects', () => {
        const isFunction = ToolChoiceValidationUtils.isFunctionChoice({} as any);

        expect(isFunction).toBe(false);
      });
    });

    describe('createFunctionChoice', () => {
      it('should create valid function choice', () => {
        const functionChoice = ToolChoiceValidationUtils.createFunctionChoice('test_function');

        expect(functionChoice).toEqual({
          type: 'function',
          function: { name: 'test_function' }
        });
      });
    });
  });

  describe('default instance', () => {
    it('should export default toolChoiceValidator instance', () => {
      expect(toolChoiceValidator).toBeInstanceOf(ToolChoiceValidator);
    });

    it('should work with default instance', () => {
      const result = toolChoiceValidator.validateToolChoice('auto', mockTools);

      expect(result.valid).toBe(true);
    });
  });

  describe('error scenarios', () => {
    it('should create ToolChoiceValidationError with correct properties', () => {
      const error = new ToolChoiceValidationError(
        'Test error',
        'TEST_CODE',
        'test_field',
        'auto'
      );

      expect(error.name).toBe('ToolChoiceValidationError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.field).toBe('test_field');
      expect(error.toolChoice).toBe('auto');
    });
  });

  describe('performance', () => {
    it('should validate tool choice within performance limit', () => {
      const largeToolsArray = Array.from({ length: 100 }, (_, i) => ({
        type: 'function' as const,
        function: {
          name: `test_function_${i}`,
          description: `Test function ${i}`
        }
      }));

      const toolChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'test_function_50' }
      };

      const startTime = Date.now();
      const result = validator.validateToolChoice(toolChoice, largeToolsArray);
      const duration = Date.now() - startTime;

      expect(result.valid).toBe(true);
      expect(duration).toBeLessThan(5); // Less than 5ms for performance requirement
    });
  });
});