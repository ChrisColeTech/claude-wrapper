/**
 * Complete Validation Pipeline Integration Tests (Phase 12A)
 * End-to-end testing of validation framework integration
 * 
 * Tests the complete validation workflow with all components
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  ValidationFramework,
  createValidationFramework
} from '../../../src/tools/validation-framework';
import {
  SchemaValidator,
  createSchemaValidator
} from '../../../src/tools/schema-validator';
import {
  RuntimeValidator,
  createRuntimeValidator
} from '../../../src/tools/runtime-validator';
import {
  ToolValidator
} from '../../../src/tools/validator';
import {
  OpenAITool,
  OpenAIToolChoice,
  CustomValidationRule,
  ValidationContext,
  RuntimeValidationContext,
  ISchemaValidator,
  IRuntimeValidator,
  IValidationFramework
} from '../../../src/tools/types';
import {
  VALIDATION_FRAMEWORK_LIMITS
} from '../../../src/tools/constants';

describe('Complete Validation Pipeline Integration (Phase 12A)', () => {
  let schemaValidator: ISchemaValidator;
  let runtimeValidator: IRuntimeValidator;
  let validationFramework: IValidationFramework;
  let toolValidator: ToolValidator;

  const complexTool: OpenAITool = {
    type: 'function',
    function: {
      name: 'get_weather_forecast',
      description: 'Get detailed weather forecast for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state, e.g. San Francisco, CA'
          },
          days: {
            type: 'integer',
            minimum: 1,
            maximum: 14,
            description: 'Number of days to forecast (1-14)'
          },
          units: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'Temperature units'
          },
          include_hourly: {
            type: 'boolean',
            description: 'Whether to include hourly breakdown'
          },
          details: {
            type: 'object',
            properties: {
              precipitation: { type: 'boolean' },
              wind: { type: 'boolean' },
              humidity: { type: 'boolean' }
            }
          }
        },
        required: ['location', 'days']
      }
    }
  };

  const validParameters = {
    location: 'San Francisco, CA',
    days: 5,
    units: 'celsius',
    include_hourly: true,
    details: {
      precipitation: true,
      wind: false,
      humidity: true
    }
  };

  beforeEach(() => {
    schemaValidator = createSchemaValidator();
    runtimeValidator = createRuntimeValidator();
    validationFramework = createValidationFramework(schemaValidator, runtimeValidator);
    toolValidator = new ToolValidator(undefined, undefined, validationFramework);
  });

  afterEach(() => {
    if ('clearCache' in schemaValidator) {
      (schemaValidator as SchemaValidator).clearCache();
    }
  });

  describe('End-to-End Validation Flow', () => {
    it('should complete full validation pipeline successfully', async () => {
      const startTime = performance.now();
      
      const result = await validationFramework.validateComplete(
        complexTool,
        validParameters
      );
      
      const duration = performance.now() - startTime;

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.validationTimeMs).toBeGreaterThan(0);
      expect(result.performanceMetrics).toBeDefined();
      expect(result.performanceMetrics?.schemaValidationTimeMs).toBeGreaterThan(0);
      expect(result.performanceMetrics?.runtimeValidationTimeMs).toBeGreaterThan(0);
      expect(duration).toBeLessThan(VALIDATION_FRAMEWORK_LIMITS.VALIDATION_TIMEOUT_MS);
    });

    it('should integrate schema and runtime validation errors', async () => {
      const invalidTool: OpenAITool = {
        type: 'function',
        function: {
          name: '', // Invalid empty name
          parameters: {
            type: 'object',
            properties: {
              required_param: { type: 'string' }
            },
            required: ['required_param']
          }
        }
      };

      const invalidParameters = {
        // Missing required_param
        optional_param: 'test'
      };

      const result = await validationFramework.validateComplete(
        invalidTool,
        invalidParameters
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Should have schema validation errors (empty name)
      const schemaErrors = result.errors.filter(e => e.field.startsWith('function'));
      expect(schemaErrors.length).toBeGreaterThan(0);
    });

    it('should leverage caching for repeated validations', async () => {
      // First validation
      const result1 = await validationFramework.validateComplete(
        complexTool,
        validParameters
      );

      // Second validation should use cache
      const result2 = await validationFramework.validateComplete(
        complexTool,
        validParameters
      );

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
      expect(result2.cacheHit).toBe(true);
      
      // Second validation should be faster due to caching
      expect(result2.validationTimeMs).toBeLessThanOrEqual(result1.validationTimeMs);
    });

    it('should handle custom validation rules in complete workflow', async () => {
      const businessRule: CustomValidationRule = {
        name: 'weather_business_rule',
        description: 'Weather forecast business rule',
        validator: (value: any, context: ValidationContext) => {
          if (context.toolName === 'get_weather_forecast') {
            const params = context.fullParameters;
            if (params.days > 7 && !params.include_hourly) {
              return {
                valid: false,
                error: {
                  field: 'parameters.include_hourly',
                  code: 'BUSINESS_RULE_VIOLATION',
                  message: 'Long-term forecasts (>7 days) must include hourly data',
                  severity: 'error' as const
                }
              };
            }
          }
          return { valid: true };
        },
        priority: 1,
        enabled: true
      };

      runtimeValidator.addCustomRule(businessRule);

      const longTermParameters = {
        location: 'New York, NY',
        days: 10,
        include_hourly: false // This should trigger the business rule
      };

      const result = await validationFramework.validateComplete(
        complexTool,
        longTermParameters
      );

      expect(result.valid).toBe(false);
      const businessError = result.errors.find(e => e.code === 'BUSINESS_RULE_VIOLATION');
      expect(businessError).toBeDefined();
      expect(businessError?.message).toContain('Long-term forecasts');
    });
  });

  describe('Multiple Tools Validation', () => {
    const tools: OpenAITool[] = [
      complexTool,
      {
        type: 'function',
        function: {
          name: 'send_notification',
          description: 'Send notification to user',
          parameters: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              channel: { type: 'string', enum: ['email', 'sms', 'push'] }
            },
            required: ['message', 'channel']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'log_event',
          description: 'Log application event',
          parameters: {
            type: 'object',
            properties: {
              event: { type: 'string' },
              level: { type: 'string', enum: ['info', 'warn', 'error'] },
              metadata: { type: 'object' }
            },
            required: ['event', 'level']
          }
        }
      }
    ];

    it('should validate multiple tools efficiently', async () => {
      const startTime = performance.now();
      
      const results = await validationFramework.validateTools(tools);
      
      const duration = performance.now() - startTime;

      expect(results).toHaveLength(3);
      expect(results.every(r => r.valid)).toBe(true);
      expect(duration).toBeLessThan(10); // Should validate multiple tools quickly
    });

    it('should validate tools with tool choice constraint', async () => {
      const toolChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'get_weather_forecast' }
      };

      const result = await validationFramework.validateToolsWithChoice(tools, toolChoice);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect tool choice for non-existent function', async () => {
      const invalidChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'non_existent_function' }
      };

      const result = await validationFramework.validateToolsWithChoice(tools, invalidChoice);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('not found');
    });
  });

  describe('Enhanced ToolValidator Integration', () => {
    it('should use validation framework when available', async () => {
      const result = await toolValidator.validateWithFramework(
        complexTool,
        validParameters
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.performanceMetrics).toBeDefined();
    });

    it('should fallback to basic validation when framework unavailable', async () => {
      const basicValidator = new ToolValidator(); // No framework provided

      const result = await basicValidator.validateWithFramework(
        complexTool,
        validParameters
      );

      expect(result.valid).toBe(true);
      expect(result.performanceMetrics?.validationTimeMs).toBe(0); // Basic validation has no metrics
    });

    it('should validate tools array with framework', async () => {
      const testTools = [complexTool];
      const results = await toolValidator.validateToolsWithFramework(testTools);

      expect(results).toHaveLength(1);
      expect(results.every(r => r.valid)).toBe(true);
    });

    it('should validate tools request with choice using framework', async () => {
      const testTools = [complexTool];
      const result = await toolValidator.validateToolsRequestWithFramework(
        testTools,
        'auto'
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should report framework availability', () => {
      expect(toolValidator.hasValidationFramework()).toBe(true);

      const basicValidator = new ToolValidator();
      expect(basicValidator.hasValidationFramework()).toBe(false);
    });

    it('should allow setting validation framework', () => {
      const newValidator = new ToolValidator();
      expect(newValidator.hasValidationFramework()).toBe(false);

      newValidator.setValidationFramework(validationFramework);
      expect(newValidator.hasValidationFramework()).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large parameter objects efficiently', async () => {
      const largeTool: OpenAITool = {
        type: 'function',
        function: {
          name: 'process_large_dataset',
          parameters: {
            type: 'object',
            properties: {
              ...Array.from({ length: 50 }, (_, i) => ({
                [`field_${i}`]: { type: 'string', description: `Field ${i}` }
              })).reduce((acc, field) => ({ ...acc, ...field }), {})
            },
            required: Array.from({ length: 25 }, (_, i) => `field_${i}`)
          }
        }
      };

      const largeParameters = Array.from({ length: 50 }, (_, i) => ({
        [`field_${i}`]: `value_${i}`
      })).reduce((acc, field) => ({ ...acc, ...field }), {});

      const startTime = performance.now();
      
      const result = await validationFramework.validateComplete(
        largeTool,
        largeParameters
      );
      
      const duration = performance.now() - startTime;

      expect(result.valid).toBe(true);
      expect(duration).toBeLessThan(10); // Should handle large objects efficiently
    });

    it('should maintain performance with many custom rules', async () => {
      // Add multiple business rules
      for (let i = 0; i < 20; i++) {
        const rule: CustomValidationRule = {
          name: `performance_rule_${i}`,
          description: `Performance test rule ${i}`,
          validator: (value: any, context: ValidationContext) => {
            // Simple validation logic
            return { valid: true };
          },
          priority: i,
          enabled: true
        };
        runtimeValidator.addCustomRule(rule);
      }

      const context: RuntimeValidationContext = {
        tool: complexTool,
        parameters: validParameters,
        customRules: runtimeValidator.getCustomRules()
      };

      const startTime = performance.now();
      
      const result = await validationFramework.validateComplete(
        complexTool,
        validParameters,
        context
      );
      
      const duration = performance.now() - startTime;

      expect(result.valid).toBe(true);
      expect(duration).toBeLessThan(10); // Should handle many rules efficiently
      expect(result.performanceMetrics?.customRulesTimeMs).toBeGreaterThan(0);
    });

    it('should validate concurrent requests efficiently', async () => {
      const promises = Array.from({ length: 10 }, () =>
        validationFramework.validateComplete(complexTool, validParameters)
      );

      const startTime = performance.now();
      const results = await Promise.all(promises);
      const duration = performance.now() - startTime;

      expect(results.every(r => r.valid)).toBe(true);
      expect(duration).toBeLessThan(20); // Concurrent validations should be efficient
    });
  });

  describe('Error Scenarios and Recovery', () => {
    it('should handle partial validation failures gracefully', async () => {
      const partiallyInvalidTool: OpenAITool = {
        type: 'function',
        function: {
          name: 'valid_function_name',
          description: 'Valid description',
          parameters: {
            type: 'object',
            properties: {
              valid_param: { type: 'string' },
              invalid_param: { type: 'unsupported_type' } // Invalid schema type
            },
            required: ['valid_param']
          }
        }
      };

      const validParams = {
        valid_param: 'test_value'
      };

      const result = await validationFramework.validateComplete(
        partiallyInvalidTool,
        validParams
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.validationTimeMs).toBeGreaterThan(0);
    });

    it('should provide detailed error information', async () => {
      const invalidParameters = {
        location: '', // Invalid empty location
        days: 20, // Exceeds maximum
        units: 'kelvin' // Not in enum
      };

      const result = await validationFramework.validateComplete(
        complexTool,
        invalidParameters
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Errors should have detailed field information
      result.errors.forEach(error => {
        expect(error.field).toBeDefined();
        expect(error.code).toBeDefined();
        expect(error.message).toBeDefined();
        expect(error.severity).toBeDefined();
      });
    });

    it('should handle validation framework configuration changes', () => {
      const originalConfig = validationFramework.getConfiguration();
      
      validationFramework.configure({
        enableCaching: false,
        strictMode: false
      });

      const newConfig = validationFramework.getConfiguration();
      
      expect(newConfig.enableCaching).toBe(false);
      expect(newConfig.strictMode).toBe(false);
      expect(newConfig.cacheSize).toBe(originalConfig.cacheSize); // Unchanged
    });

    it('should reset and track performance metrics', async () => {
      await validationFramework.validateComplete(complexTool, validParameters);
      
      let metrics = validationFramework.getValidationMetrics();
      expect(metrics.validationTimeMs).toBeGreaterThan(0);

      validationFramework.resetMetrics();
      
      metrics = validationFramework.getValidationMetrics();
      expect(metrics.validationTimeMs).toBe(0);
      expect(metrics.schemaValidationTimeMs).toBe(0);
      expect(metrics.runtimeValidationTimeMs).toBe(0);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should validate complete weather API workflow', async () => {
      const weatherTools: OpenAITool[] = [
        complexTool,
        {
          type: 'function',
          function: {
            name: 'get_current_weather',
            description: 'Get current weather conditions',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' },
                units: { type: 'string', enum: ['celsius', 'fahrenheit'] }
              },
              required: ['location']
            }
          }
        }
      ];

      const toolChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'get_weather_forecast' }
      };

      const result = await validationFramework.validateToolsWithChoice(
        weatherTools,
        toolChoice
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate complex nested API parameters', async () => {
      const complexApiTool: OpenAITool = {
        type: 'function',
        function: {
          name: 'create_user_profile',
          parameters: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  personal: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      email: { type: 'string' },
                      age: { type: 'integer', minimum: 13 }
                    },
                    required: ['name', 'email']
                  },
                  preferences: {
                    type: 'object',
                    properties: {
                      notifications: {
                        type: 'array',
                        items: { type: 'string', enum: ['email', 'sms', 'push'] }
                      },
                      privacy: {
                        type: 'object',
                        properties: {
                          profile_public: { type: 'boolean' },
                          data_sharing: { type: 'boolean' }
                        }
                      }
                    }
                  }
                },
                required: ['personal']
              }
            },
            required: ['user']
          }
        }
      };

      const complexParameters = {
        user: {
          personal: {
            name: 'John Doe',
            email: 'john@example.com',
            age: 25
          },
          preferences: {
            notifications: ['email', 'push'],
            privacy: {
              profile_public: true,
              data_sharing: false
            }
          }
        }
      };

      const result = await validationFramework.validateComplete(
        complexApiTool,
        complexParameters
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.performanceMetrics?.validationTimeMs).toBeLessThan(VALIDATION_FRAMEWORK_LIMITS.VALIDATION_TIMEOUT_MS);
    });
  });
});