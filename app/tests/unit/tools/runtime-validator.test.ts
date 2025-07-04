/**
 * Runtime Validator unit tests (Phase 12A)
 * 100% test coverage for RuntimeValidator class
 * 
 * Tests runtime parameter validation with custom rules engine
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import {
  RuntimeValidator,
  RuntimeValidationError,
  createRuntimeValidator
} from '../../../src/tools/runtime-validator';
import {
  OpenAITool,
  RuntimeValidationContext,
  CustomValidationRule,
  ValidationContext,
  ValidationRuleResult,
  ValidationFieldError
} from '../../../src/tools/types';
import {
  VALIDATION_FRAMEWORK_LIMITS,
  VALIDATION_FRAMEWORK_MESSAGES,
  VALIDATION_FRAMEWORK_ERRORS
} from '../../../src/tools/constants';

describe('Runtime Validator (Phase 12A)', () => {
  let runtimeValidator: RuntimeValidator;

  const mockTool: OpenAITool = {
    type: 'function',
    function: {
      name: 'test_function',
      description: 'Test function',
      parameters: {
        type: 'object',
        properties: {
          required_param: { type: 'string' },
          optional_param: { type: 'number' }
        },
        required: ['required_param']
      }
    }
  };

  const validParameters = {
    required_param: 'test_value',
    optional_param: 42
  };

  const validContext: RuntimeValidationContext = {
    tool: mockTool,
    parameters: validParameters,
    requestId: 'test-request',
    sessionId: 'test-session'
  };

  const mockValidationContext: ValidationContext = {
    toolName: 'test_function',
    parameterPath: 'parameters',
    fullParameters: validParameters,
    requestMetadata: { requestId: 'test' }
  };

  beforeEach(() => {
    runtimeValidator = new RuntimeValidator();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('RuntimeValidationError', () => {
    it('should create error with all fields', () => {
      const error = new RuntimeValidationError(
        'Test error',
        'TEST_CODE',
        'test_field',
        5
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.field).toBe('test_field');
      expect(error.validationTimeMs).toBe(5);
      expect(error.name).toBe('RuntimeValidationError');
    });
  });

  describe('validateRuntimeParameters', () => {
    it('should validate correct parameters successfully', async () => {
      const result = await runtimeValidator.validateRuntimeParameters(validContext);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.validationTimeMs).toBeGreaterThan(0);
      expect(result.performanceMetrics?.runtimeValidationTimeMs).toBeGreaterThan(0);
    });

    it('should fail with invalid context', async () => {
      const invalidContext = null as any;

      const result = await runtimeValidator.validateRuntimeParameters(invalidContext);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(VALIDATION_FRAMEWORK_ERRORS.VALIDATION_CONTEXT_ERROR);
      expect(result.errors[0].message).toBe(VALIDATION_FRAMEWORK_MESSAGES.VALIDATION_CONTEXT_INVALID);
    });

    it('should fail with missing tool', async () => {
      const invalidContext = {
        tool: null,
        parameters: validParameters
      } as any;

      const result = await runtimeValidator.validateRuntimeParameters(invalidContext);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(VALIDATION_FRAMEWORK_ERRORS.VALIDATION_CONTEXT_ERROR);
    });

    it('should fail with missing parameters', async () => {
      const invalidContext = {
        tool: mockTool,
        parameters: null
      } as any;

      const result = await runtimeValidator.validateRuntimeParameters(invalidContext);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(VALIDATION_FRAMEWORK_ERRORS.VALIDATION_CONTEXT_ERROR);
    });

    it('should validate required parameters', async () => {
      const contextWithMissingRequired = {
        tool: mockTool,
        parameters: { optional_param: 42 } // Missing required_param
      };

      const result = await runtimeValidator.validateRuntimeParameters(contextWithMissingRequired);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('parameters.required_param');
      expect(result.errors[0].code).toBe(VALIDATION_FRAMEWORK_ERRORS.PARAMETER_VALIDATION_ERROR);
    });

    it('should validate parameter types', async () => {
      const contextWithWrongType = {
        tool: mockTool,
        parameters: {
          required_param: 123, // Should be string
          optional_param: 42
        }
      };

      const result = await runtimeValidator.validateRuntimeParameters(contextWithWrongType);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('parameters.required_param');
      expect(result.errors[0].code).toBe(VALIDATION_FRAMEWORK_ERRORS.PARAMETER_VALIDATION_ERROR);
    });

    it('should handle tools without parameter schema', async () => {
      const toolWithoutParams: OpenAITool = {
        type: 'function',
        function: {
          name: 'simple_function',
          description: 'Simple function without parameters'
        }
      };

      const simpleContext = {
        tool: toolWithoutParams,
        parameters: {}
      };

      const result = await runtimeValidator.validateRuntimeParameters(simpleContext);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should execute custom rules when provided', async () => {
      const customRule: CustomValidationRule = {
        name: 'test_rule',
        description: 'Test validation rule',
        validator: jest.fn().mockReturnValue({ valid: true }) as any,
        priority: 1,
        enabled: true
      };

      const contextWithCustomRules = {
        ...validContext,
        customRules: [customRule]
      };

      const result = await runtimeValidator.validateRuntimeParameters(contextWithCustomRules);

      expect(result.valid).toBe(true);
      expect(result.performanceMetrics?.customRulesTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle validation exceptions', async () => {
      // Create a context that will cause an exception during processing
      const problematicContext = {
        tool: null as any,
        parameters: null as any
      };

      const result = await runtimeValidator.validateRuntimeParameters(problematicContext);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(VALIDATION_FRAMEWORK_ERRORS.VALIDATION_CONTEXT_ERROR);
    });

    it('should complete validation within performance limit', async () => {
      const startTime = performance.now();
      const result = await runtimeValidator.validateRuntimeParameters(validContext);
      const duration = performance.now() - startTime;

      expect(result.valid).toBe(true);
      expect(duration).toBeLessThan(VALIDATION_FRAMEWORK_LIMITS.VALIDATION_TIMEOUT_MS);
    });
  });

  describe('Custom Rules Management', () => {
    const validRule: CustomValidationRule = {
      name: 'test_rule',
      description: 'Test validation rule',
      validator: (value: any, context: ValidationContext) => ({ valid: true }),
      priority: 1,
      enabled: true
    };

    it('should add custom validation rule', () => {
      const result = runtimeValidator.addCustomRule(validRule);

      expect(result).toBe(true);
      const rules = runtimeValidator.getCustomRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].name).toBe('test_rule');
    });

    it('should reject invalid rule definition', () => {
      const invalidRule = {
        name: '',
        description: 'Invalid rule',
        // Missing validator function
        priority: 1,
        enabled: true
      } as any;

      const result = runtimeValidator.addCustomRule(invalidRule);

      expect(result).toBe(false);
      expect(runtimeValidator.getCustomRules()).toHaveLength(0);
    });

    it('should reject rule without validator function', () => {
      const invalidRule = {
        name: 'invalid_rule',
        description: 'Rule without validator',
        validator: null,
        priority: 1,
        enabled: true
      } as any;

      const result = runtimeValidator.addCustomRule(invalidRule);

      expect(result).toBe(false);
    });

    it('should reject rule with invalid priority', () => {
      const invalidRule = {
        ...validRule,
        priority: VALIDATION_FRAMEWORK_LIMITS.CUSTOM_RULE_PRIORITY_MAX + 1
      };

      const result = runtimeValidator.addCustomRule(invalidRule);

      expect(result).toBe(false);
    });

    it('should reject rules when limit exceeded', () => {
      // Add rules up to the limit
      for (let i = 0; i < VALIDATION_FRAMEWORK_LIMITS.CUSTOM_RULES_MAX_COUNT; i++) {
        const rule = {
          ...validRule,
          name: `rule_${i}`
        };
        runtimeValidator.addCustomRule(rule);
      }

      // Try to add one more
      const extraRule = {
        ...validRule,
        name: 'extra_rule'
      };

      const result = runtimeValidator.addCustomRule(extraRule);

      expect(result).toBe(false);
      expect(runtimeValidator.getCustomRules()).toHaveLength(VALIDATION_FRAMEWORK_LIMITS.CUSTOM_RULES_MAX_COUNT);
    });

    it('should remove custom validation rule', () => {
      runtimeValidator.addCustomRule(validRule);
      expect(runtimeValidator.getCustomRules()).toHaveLength(1);

      const result = runtimeValidator.removeCustomRule('test_rule');

      expect(result).toBe(true);
      expect(runtimeValidator.getCustomRules()).toHaveLength(0);
    });

    it('should return false when removing non-existent rule', () => {
      const result = runtimeValidator.removeCustomRule('non_existent_rule');

      expect(result).toBe(false);
    });

    it('should handle exceptions during rule addition', () => {
      // Test with null rule to trigger exception handling
      const result = runtimeValidator.addCustomRule(null as any);

      expect(result).toBe(false);
    });

    it('should handle exceptions during rule removal', () => {
      // Mock a scenario where deletion could throw (though unlikely in real usage)
      const result = runtimeValidator.removeCustomRule(null as any);

      expect(result).toBe(false);
    });

    it('should return rules sorted by priority', () => {
      const rule1 = { ...validRule, name: 'rule1', priority: 3 };
      const rule2 = { ...validRule, name: 'rule2', priority: 1 };
      const rule3 = { ...validRule, name: 'rule3', priority: 2 };

      runtimeValidator.addCustomRule(rule1);
      runtimeValidator.addCustomRule(rule2);
      runtimeValidator.addCustomRule(rule3);

      const rules = runtimeValidator.getCustomRules();

      expect(rules).toHaveLength(3);
      expect(rules[0].name).toBe('rule2'); // Priority 1
      expect(rules[1].name).toBe('rule3'); // Priority 2
      expect(rules[2].name).toBe('rule1'); // Priority 3
    });
  });

  describe('validateWithCustomRules', () => {
    it('should execute enabled rules in priority order', async () => {
      const executionOrder: string[] = [];

      const rule1: CustomValidationRule = {
        name: 'rule1',
        description: 'Low priority rule',
        validator: (value: any, context: ValidationContext) => {
          executionOrder.push('rule1');
          return { valid: true };
        },
        priority: 3,
        enabled: true
      };

      const rule2: CustomValidationRule = {
        name: 'rule2',
        description: 'High priority rule',
        validator: (value: any, context: ValidationContext) => {
          executionOrder.push('rule2');
          return { valid: true };
        },
        priority: 1,
        enabled: true
      };

      runtimeValidator.addCustomRule(rule1);
      runtimeValidator.addCustomRule(rule2);

      const results = await runtimeValidator.validateWithCustomRules(
        validParameters,
        mockValidationContext
      );

      expect(results).toHaveLength(2);
      expect(executionOrder).toEqual(['rule2', 'rule1']); // High priority first
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(true);
    });

    it('should skip disabled rules', async () => {
      const enabledRule: CustomValidationRule = {
        name: 'enabled_rule',
        description: 'Enabled rule',
        validator: jest.fn().mockReturnValue({ valid: true }) as any,
        priority: 1,
        enabled: true
      };

      const disabledRule: CustomValidationRule = {
        name: 'disabled_rule',
        description: 'Disabled rule',
        validator: jest.fn().mockReturnValue({ valid: false }) as any,
        priority: 2,
        enabled: false
      };

      runtimeValidator.addCustomRule(enabledRule);
      runtimeValidator.addCustomRule(disabledRule);

      const results = await runtimeValidator.validateWithCustomRules(
        validParameters,
        mockValidationContext
      );

      expect(results).toHaveLength(1);
      expect(enabledRule.validator).toHaveBeenCalled();
      expect(disabledRule.validator).not.toHaveBeenCalled();
    });

    it('should handle rule execution failures', async () => {
      const failingRule: CustomValidationRule = {
        name: 'failing_rule',
        description: 'Rule that throws error',
        validator: (value: any, context: ValidationContext) => {
          throw new Error('Rule execution error');
        },
        priority: 1,
        enabled: true
      };

      runtimeValidator.addCustomRule(failingRule);

      const results = await runtimeValidator.validateWithCustomRules(
        validParameters,
        mockValidationContext
      );

      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].error?.code).toBe(VALIDATION_FRAMEWORK_ERRORS.CUSTOM_RULE_EXECUTION_ERROR);
      expect(results[0].error?.message).toContain('Rule execution error');
    });

    it('should handle async rules', async () => {
      const asyncRule: CustomValidationRule = {
        name: 'async_rule',
        description: 'Async validation rule',
        validator: (value: any, context: ValidationContext) => ({ valid: true }),
        priority: 1,
        enabled: true,
        async: true
      };

      runtimeValidator.addCustomRule(asyncRule);

      const results = await runtimeValidator.validateWithCustomRules(
        validParameters,
        mockValidationContext
      );

      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(true);
      expect(results[0].processingTimeMs).toBeGreaterThan(0);
    });

    it('should return empty array when no rules are enabled', async () => {
      const results = await runtimeValidator.validateWithCustomRules(
        validParameters,
        mockValidationContext
      );

      expect(results).toEqual([]);
    });

    it('should track rule execution metrics', async () => {
      const rule: CustomValidationRule = {
        name: 'metric_rule',
        description: 'Rule for testing metrics',
        validator: (value: any, context: ValidationContext) => ({ valid: true }),
        priority: 1,
        enabled: true
      };

      runtimeValidator.addCustomRule(rule);

      const results = await runtimeValidator.validateWithCustomRules(
        validParameters,
        mockValidationContext
      );

      expect(results).toHaveLength(1);
      expect(results[0].processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Requirements', () => {
    it('should complete runtime validation within 2ms for simple parameters', async () => {
      const startTime = performance.now();
      const result = await runtimeValidator.validateRuntimeParameters(validContext);
      const duration = performance.now() - startTime;

      expect(result.valid).toBe(true);
      expect(duration).toBeLessThan(VALIDATION_FRAMEWORK_LIMITS.VALIDATION_TIMEOUT_MS);
    });

    it('should handle many custom rules efficiently', async () => {
      // Add multiple simple rules
      for (let i = 0; i < 10; i++) {
        const rule: CustomValidationRule = {
          name: `performance_rule_${i}`,
          description: `Performance test rule ${i}`,
          validator: (value: any) => ({ valid: true }),
          priority: i,
          enabled: true
        };
        runtimeValidator.addCustomRule(rule);
      }

      const contextWithRules = {
        ...validContext,
        customRules: runtimeValidator.getCustomRules()
      };

      const startTime = performance.now();
      const result = await runtimeValidator.validateRuntimeParameters(contextWithRules);
      const duration = performance.now() - startTime;

      expect(result.valid).toBe(true);
      expect(duration).toBeLessThan(10); // Should be reasonable even with many rules
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined parameter values', async () => {
      const contextWithUndefined = {
        tool: mockTool,
        parameters: {
          required_param: 'test',
          optional_param: undefined
        }
      };

      const result = await runtimeValidator.validateRuntimeParameters(contextWithUndefined);

      expect(result.valid).toBe(true); // undefined is acceptable for optional params
    });

    it('should handle null parameter values', async () => {
      const contextWithNull = {
        tool: mockTool,
        parameters: {
          required_param: null // This should fail as it's required
        }
      };

      const result = await runtimeValidator.validateRuntimeParameters(contextWithNull);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('parameters.required_param');
    });

    it('should handle array parameter types', async () => {
      const toolWithArrayParam: OpenAITool = {
        type: 'function',
        function: {
          name: 'array_function',
          parameters: {
            type: 'object',
            properties: {
              items: { type: 'array' }
            },
            required: ['items']
          }
        }
      };

      const contextWithArray = {
        tool: toolWithArrayParam,
        parameters: {
          items: [1, 2, 3]
        }
      };

      const result = await runtimeValidator.validateRuntimeParameters(contextWithArray);

      expect(result.valid).toBe(true);
    });

    it('should handle complex nested objects', async () => {
      const toolWithNestedParams: OpenAITool = {
        type: 'function',
        function: {
          name: 'nested_function',
          parameters: {
            type: 'object',
            properties: {
              config: { type: 'object' }
            },
            required: ['config']
          }
        }
      };

      const contextWithNested = {
        tool: toolWithNestedParams,
        parameters: {
          config: {
            nested: {
              deeply: {
                value: 'test'
              }
            }
          }
        }
      };

      const result = await runtimeValidator.validateRuntimeParameters(contextWithNested);

      expect(result.valid).toBe(true);
    });
  });

  describe('Factory Function', () => {
    it('should create runtime validator instance', () => {
      const validator = createRuntimeValidator();
      
      expect(validator).toBeInstanceOf(RuntimeValidator);
    });
  });

  describe('Rule Validation Results', () => {
    it('should return rule results with warnings', async () => {
      const warningRule: CustomValidationRule = {
        name: 'warning_rule',
        description: 'Rule that returns warning',
        validator: (value: any, context: ValidationContext) => ({
          valid: true,
          warning: 'This is a warning message'
        }),
        priority: 1,
        enabled: true
      };

      runtimeValidator.addCustomRule(warningRule);

      const results = await runtimeValidator.validateWithCustomRules(
        validParameters,
        { ...mockValidationContext }
      );

      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(true);
      expect(results[0].warning).toBe('This is a warning message');
    });

    it('should return rule results with detailed errors', async () => {
      const detailedErrorRule: CustomValidationRule = {
        name: 'detailed_error_rule',
        description: 'Rule that returns detailed error',
        validator: (value: any, context: ValidationContext) => ({
          valid: false,
          error: {
            field: 'custom_field',
            code: 'CUSTOM_ERROR',
            message: 'Custom validation failed',
            severity: 'error' as const
          }
        }),
        priority: 1,
        enabled: true
      };

      runtimeValidator.addCustomRule(detailedErrorRule);

      const results = await runtimeValidator.validateWithCustomRules(
        validParameters,
        mockValidationContext
      );

      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].error?.field).toBe('custom_field');
      expect(results[0].error?.code).toBe('CUSTOM_ERROR');
      expect(results[0].error?.message).toBe('Custom validation failed');
    });
  });
});