/**
 * Validation Handler Unit Tests
 * Comprehensive tests for detailed validation error handling system
 * Tests field-level validation, error reporting, and performance requirements
 */

import {
  ValidationHandler,
  FieldValidationError,
  ValidationContext,
  ValidationErrorReport,
  ValidationRule,
  ValidationSchema,
  validationHandler,
  validateRequest,
  createValidationResponse,
  getValidationStats
} from '../../../src/middleware/validation-handler';

// Mock logger to prevent console output during tests
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

jest.mock('../../../src/utils/logger', () => ({
  createLogger: jest.fn(() => mockLogger),
  getLogger: jest.fn(() => mockLogger),
  LogLevel: {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug'
  }
}));

// Mock config for testing
jest.mock('../../../src/utils/env', () => ({
  config: {
    DEBUG_MODE: false,
    VERBOSE: false
  }
}));

// Mock error classifier
jest.mock('../../../src/middleware/error-classifier', () => ({
  errorClassifier: {
    classifyError: jest.fn(() => ({
      category: 'validation_error',
      severity: 'low',
      retryStrategy: 'no_retry',
      httpStatusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      isRetryable: false,
      operationalImpact: 'Request rejected due to invalid input',
      clientGuidance: ['Check request parameters', 'Validate input format']
    }))
  }
}));

describe('ValidationHandler', () => {
  let handler: ValidationHandler;
  
  beforeEach(() => {
    handler = new ValidationHandler();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default schemas', () => {
      expect(handler).toBeInstanceOf(ValidationHandler);
    });

    it('should register default chat completion schema', async () => {
      const validData = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const context: Partial<ValidationContext> = {
        endpoint: '/chat/completions',
        method: 'POST'
      };

      const report = await handler.validateRequest(validData, 'chat_completion', context);
      expect(report.isValid).toBe(true);
      expect(report.errorCount).toBe(0);
    });

    it('should register default session schema', async () => {
      const validData = {
        session_id: 'valid_session_123',
        title: 'Test Session'
      };

      const context: Partial<ValidationContext> = {
        endpoint: '/sessions',
        method: 'POST'
      };

      const report = await handler.validateRequest(validData, 'session', context);
      expect(report.isValid).toBe(true);
      expect(report.errorCount).toBe(0);
    });

    it('should initialize with empty performance statistics', () => {
      const stats = handler.getPerformanceStats();
      expect(stats.averageProcessingTime).toBe(0);
      expect(stats.maxProcessingTime).toBe(0);
      expect(stats.totalValidations).toBe(0);
      expect(stats.isOptimal).toBe(true);
    });
  });

  describe('Request Validation', () => {
    it('should validate required fields correctly', async () => {
      const invalidData = {
        messages: [{ role: 'user', content: 'Hello' }]
        // Missing required 'model' field
      };

      const context: Partial<ValidationContext> = {
        endpoint: '/chat/completions',
        method: 'POST',
        requestId: 'req_123'
      };

      const report = await handler.validateRequest(invalidData, 'chat_completion', context);
      
      expect(report.isValid).toBe(false);
      expect(report.errorCount).toBe(1);
      expect(report.errors[0].field).toBe('model');
      expect(report.errors[0].code).toBe('REQUIRED_FIELD_MISSING');
      expect(report.errors[0].message).toContain('required');
    });

    it('should validate field types correctly', async () => {
      const invalidData = {
        model: 'claude-3-sonnet-20240229',
        messages: 'invalid_type', // Should be array
        temperature: 'invalid_number' // Should be number
      };

      const context: Partial<ValidationContext> = {
        endpoint: '/chat/completions',
        method: 'POST'
      };

      const report = await handler.validateRequest(invalidData, 'chat_completion', context);
      
      expect(report.isValid).toBe(false);
      expect(report.errorCount).toBe(2);
      
      const typeErrors = report.errors.filter(e => e.code === 'INVALID_TYPE');
      expect(typeErrors).toHaveLength(2);
      expect(typeErrors.some(e => e.field === 'messages')).toBe(true);
      expect(typeErrors.some(e => e.field === 'temperature')).toBe(true);
    });

    it('should validate string length constraints', async () => {
      const customSchema: ValidationSchema = {
        description: 'Test schema with length constraints',
        rules: [
          {
            field: 'short_field',
            type: 'string',
            minLength: 5,
            maxLength: 10
          }
        ]
      };

      handler.registerSchema('test_length', customSchema);

      // Test too short
      const tooShortData = { short_field: 'abc' };
      const shortReport = await handler.validateRequest(tooShortData, 'test_length', {});
      
      expect(shortReport.isValid).toBe(false);
      expect(shortReport.errors[0].code).toBe('TOO_SHORT');
      expect(shortReport.errors[0].constraint).toContain('min_length: 5');

      // Test too long
      const tooLongData = { short_field: 'this_is_way_too_long' };
      const longReport = await handler.validateRequest(tooLongData, 'test_length', {});
      
      expect(longReport.isValid).toBe(false);
      expect(longReport.errors[0].code).toBe('TOO_LONG');
      expect(longReport.errors[0].constraint).toContain('max_length: 10');

      // Test valid length
      const validData = { short_field: 'valid' };
      const validReport = await handler.validateRequest(validData, 'test_length', {});
      
      expect(validReport.isValid).toBe(true);
    });

    it('should validate pattern constraints', async () => {
      const patternSchema: ValidationSchema = {
        description: 'Test schema with pattern validation',
        rules: [
          {
            field: 'email',
            type: 'string',
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Invalid email format'
          }
        ]
      };

      handler.registerSchema('test_pattern', patternSchema);

      const invalidData = { email: 'invalid-email' };
      const report = await handler.validateRequest(invalidData, 'test_pattern', {});
      
      expect(report.isValid).toBe(false);
      expect(report.errors[0].code).toBe('INVALID_FORMAT');
      expect(report.errors[0].constraint).toContain('pattern:');
      expect(report.errors[0].message).toBe('Invalid email format');

      const validData = { email: 'test@example.com' };
      const validReport = await handler.validateRequest(validData, 'test_pattern', {});
      
      expect(validReport.isValid).toBe(true);
    });

    it('should validate enum constraints', async () => {
      const enumSchema: ValidationSchema = {
        description: 'Test schema with enum validation',
        rules: [
          {
            field: 'status',
            type: 'string',
            enum: ['active', 'inactive', 'pending']
          }
        ]
      };

      handler.registerSchema('test_enum', enumSchema);

      const invalidData = { status: 'invalid_status' };
      const report = await handler.validateRequest(invalidData, 'test_enum', {});
      
      expect(report.isValid).toBe(false);
      expect(report.errors[0].code).toBe('INVALID_ENUM_VALUE');
      expect(report.errors[0].message).toContain('must be one of: active, inactive, pending');
      expect(report.errors[0].constraint).toContain('allowed_values: [active, inactive, pending]');

      const validData = { status: 'active' };
      const validReport = await handler.validateRequest(validData, 'test_enum', {});
      
      expect(validReport.isValid).toBe(true);
    });

    it('should validate custom validation functions', async () => {
      const customSchema: ValidationSchema = {
        description: 'Test schema with custom validation',
        rules: [
          {
            field: 'temperature',
            type: 'number',
            custom: (value) => value >= 0 && value <= 2,
            message: 'Temperature must be between 0 and 2'
          }
        ]
      };

      handler.registerSchema('test_custom', customSchema);

      const invalidData = { temperature: 3.5 };
      const report = await handler.validateRequest(invalidData, 'test_custom', {});
      
      expect(report.isValid).toBe(false);
      expect(report.errors[0].code).toBe('CUSTOM_VALIDATION_FAILED');
      expect(report.errors[0].message).toBe('Temperature must be between 0 and 2');

      const validData = { temperature: 1.5 };
      const validReport = await handler.validateRequest(validData, 'test_custom', {});
      
      expect(validReport.isValid).toBe(true);
    });

    it('should handle nested field paths with dot notation', async () => {
      const nestedSchema: ValidationSchema = {
        description: 'Test schema with nested fields',
        rules: [
          {
            field: 'user.profile.name',
            required: true,
            type: 'string'
          },
          {
            field: 'settings.preferences.theme',
            type: 'string',
            enum: ['light', 'dark']
          }
        ]
      };

      handler.registerSchema('test_nested', nestedSchema);

      const validData = {
        user: {
          profile: {
            name: 'John Doe'
          }
        },
        settings: {
          preferences: {
            theme: 'dark'
          }
        }
      };

      const report = await handler.validateRequest(validData, 'test_nested', {});
      expect(report.isValid).toBe(true);

      const invalidData = {
        user: {
          profile: {} // Missing name
        },
        settings: {
          preferences: {
            theme: 'invalid' // Invalid enum value
          }
        }
      };

      const invalidReport = await handler.validateRequest(invalidData, 'test_nested', {});
      expect(invalidReport.isValid).toBe(false);
      expect(invalidReport.errorCount).toBe(2);
    });

    it('should skip validation for optional fields that are not present', async () => {
      const optionalSchema: ValidationSchema = {
        description: 'Test schema with optional fields',
        rules: [
          {
            field: 'required_field',
            required: true,
            type: 'string'
          },
          {
            field: 'optional_field',
            required: false,
            type: 'string',
            minLength: 5
          }
        ]
      };

      handler.registerSchema('test_optional', optionalSchema);

      const dataWithoutOptional = {
        required_field: 'present'
        // optional_field is not present
      };

      const report = await handler.validateRequest(dataWithoutOptional, 'test_optional', {});
      expect(report.isValid).toBe(true);
      expect(report.errorCount).toBe(0);
    });
  });

  describe('Error Reporting and Context', () => {
    it('should include comprehensive validation context', async () => {
      const context: ValidationContext = {
        requestId: 'req_test_123',
        endpoint: '/api/test',
        method: 'POST',
        timestamp: new Date('2024-01-01T00:00:00Z'),
        userAgent: 'TestAgent/1.0',
        requestBody: { test: 'data' }
      };

      const invalidData = {};
      const report = await handler.validateRequest(invalidData, 'chat_completion', context);
      
      expect(report.context.requestId).toBe('req_test_123');
      expect(report.context.endpoint).toBe('/api/test');
      expect(report.context.method).toBe('POST');
      expect(report.context.userAgent).toBe('TestAgent/1.0');
      expect(report.context.timestamp).toEqual(new Date('2024-01-01T00:00:00Z'));
    });

    it('should provide detailed field-level error information', async () => {
      const invalidData = {
        model: 123, // Wrong type
        messages: null, // Wrong type
        temperature: -1 // Invalid custom validation
      };

      const report = await handler.validateRequest(invalidData, 'chat_completion', {});
      
      expect(report.errors).toHaveLength(3);
      
      report.errors.forEach(error => {
        expect(error.field).toBeDefined();
        expect(error.path).toBeDefined();
        expect(error.message).toBeDefined();
        expect(error.code).toBeDefined();
        expect(error.suggestion).toBeDefined();
      });
    });

    it('should generate helpful suggestions based on error types', async () => {
      const invalidData = {
        // Missing required field 'model'
        messages: 'invalid_type', // Type error
        temperature: 'invalid' // Format error
      };

      const report = await handler.validateRequest(invalidData, 'chat_completion', {});
      
      expect(report.suggestions).toContain('Required fields missing: model');
      expect(report.suggestions).toContain('Check data types for all fields');
    });

    it('should include debug information in debug mode', async () => {
      // Mock debug mode
      const mockConfig = require('../../../src/utils/env');
      mockConfig.config.DEBUG_MODE = true;

      const freshHandler = new ValidationHandler();
      const testData = { test: 'data' };
      
      const report = await freshHandler.validateRequest(testData, 'chat_completion', {});
      
      expect(report.debugInfo).toBeDefined();
      expect(report.debugInfo?.requestBody).toEqual(testData);
      expect(report.debugInfo?.processingTime).toBeDefined();
    });

    it('should sanitize sensitive values in error responses', async () => {
      const sensitiveData = {
        model: 'test',
        api_key: 'secret_key_123',
        password: 'secret_password',
        token: 'auth_token_456'
      };

      const response = handler.createValidationErrorResponse({
        isValid: false,
        errors: [
          {
            field: 'api_key',
            path: 'api_key',
            value: 'secret_key_123',
            message: 'Invalid API key',
            code: 'INVALID_VALUE'
          }
        ],
        errorCount: 1,
        classification: {
          category: 'validation_error' as any,
          severity: 'low' as any,
          retryStrategy: 'no_retry' as any,
          httpStatusCode: 400,
          errorCode: 'VALIDATION_ERROR',
          isRetryable: false,
          operationalImpact: 'Request rejected',
          clientGuidance: []
        },
        context: {
          endpoint: '/test',
          method: 'POST',
          timestamp: new Date()
        },
        suggestions: [],
        processingTime: 10
      });

      const invalidField = response.error.details.invalid_fields[0];
      expect(invalidField.value).toBe('[REDACTED]');
    });
  });

  describe('Schema Management', () => {
    it('should allow registration of custom schemas', () => {
      const customSchema: ValidationSchema = {
        description: 'Custom test schema',
        rules: [
          {
            field: 'custom_field',
            required: true,
            type: 'string'
          }
        ],
        examples: {
          valid: { custom_field: 'test' }
        }
      };

      handler.registerSchema('custom_test', customSchema);
      
      // Verify schema is registered by attempting validation
      expect(async () => {
        await handler.validateRequest({}, 'custom_test', {});
      }).not.toThrow();
    });

    it('should handle validation with unknown schema gracefully', async () => {
      const report = await handler.validateRequest({}, 'unknown_schema', {});
      
      expect(report.isValid).toBe(false);
      expect(report.errors[0].code).toBe('VALIDATION_SYSTEM_ERROR');
      expect(report.errors[0].message).toContain('Validation schema \'unknown_schema\' not found');
    });

    it('should include schema examples in suggestions when available', async () => {
      const schemaWithExamples: ValidationSchema = {
        description: 'Schema with examples',
        rules: [
          {
            field: 'test_field',
            required: true,
            type: 'string'
          }
        ],
        examples: {
          basic: { test_field: 'example_value' }
        }
      };

      handler.registerSchema('with_examples', schemaWithExamples);

      const report = await handler.validateRequest({}, 'with_examples', {});
      
      expect(report.suggestions).toContain('Refer to API documentation for valid request examples');
    });
  });

  describe('Performance Requirements', () => {
    it('should complete validation within 25ms requirement', async () => {
      const testData = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 1.0,
        max_tokens: 1000
      };

      const startTime = Date.now();
      await handler.validateRequest(testData, 'chat_completion', {});
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(25); // <25ms requirement
    });

    it('should track performance statistics correctly', async () => {
      const testData = { model: 'test', messages: [] };
      
      // Perform multiple validations
      for (let i = 0; i < 5; i++) {
        await handler.validateRequest(testData, 'chat_completion', {});
      }

      const stats = handler.getPerformanceStats();
      
      expect(stats.totalValidations).toBe(5);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
      expect(stats.maxProcessingTime).toBeGreaterThan(0);
      expect(stats.isOptimal).toBe(true); // Should be under 25ms
    });

    it('should maintain performance under load', async () => {
      const testData = { model: 'test', messages: [] };
      const validationPromises = [];

      // Create 50 concurrent validations
      for (let i = 0; i < 50; i++) {
        validationPromises.push(
          handler.validateRequest(testData, 'chat_completion', { requestId: `req_${i}` })
        );
      }

      const startTime = Date.now();
      const results = await Promise.all(validationPromises);
      const endTime = Date.now();

      expect(results).toHaveLength(50);
      expect(results.every(r => r !== undefined)).toBe(true);
      
      const totalTime = endTime - startTime;
      const avgTimePerValidation = totalTime / 50;
      expect(avgTimePerValidation).toBeLessThan(25); // Should maintain <25ms average
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle validation system errors gracefully', async () => {
      // Mock a schema with a custom validation that throws an error
      const faultySchema: ValidationSchema = {
        description: 'Faulty schema for testing',
        rules: [
          {
            field: 'test',
            custom: () => { throw new Error('Custom validation error'); }
          }
        ]
      };

      handler.registerSchema('faulty_test', faultySchema);

      const report = await handler.validateRequest({ test: 'value' }, 'faulty_test', {});
      
      expect(report.isValid).toBe(false);
      expect(report.errors[0].code).toBe('VALIDATION_SYSTEM_ERROR');
      expect(report.suggestions).toContain('Contact support for validation system issues');
    });

    it('should handle null and undefined input data', async () => {
      const nullReport = await handler.validateRequest(null, 'chat_completion', {});
      const undefinedReport = await handler.validateRequest(undefined, 'chat_completion', {});
      
      expect(nullReport.isValid).toBe(false);
      expect(undefinedReport.isValid).toBe(false);
      
      // Should not crash and should provide meaningful error messages
      expect(nullReport.errors).toBeDefined();
      expect(undefinedReport.errors).toBeDefined();
    });

    it('should handle circular references in input data', async () => {
      const circularData: any = { model: 'test' };
      circularData.circular = circularData;

      const report = await handler.validateRequest(circularData, 'chat_completion', {});
      
      // Should not crash due to circular reference
      expect(report).toBeDefined();
      expect(typeof report.isValid).toBe('boolean');
    });

    it('should handle deeply nested objects', async () => {
      const deepData = {
        model: 'test',
        messages: [],
        deep: {
          level1: {
            level2: {
              level3: {
                level4: {
                  value: 'deep_value'
                }
              }
            }
          }
        }
      };

      const report = await handler.validateRequest(deepData, 'chat_completion', {});
      
      expect(report).toBeDefined();
      expect(typeof report.isValid).toBe('boolean');
    });

    it('should handle very large input data', async () => {
      const largeData = {
        model: 'test',
        messages: [],
        large_field: 'x'.repeat(10000) // Very large string
      };

      const report = await handler.validateRequest(largeData, 'chat_completion', {});
      
      expect(report).toBeDefined();
      expect(typeof report.isValid).toBe('boolean');
    });
  });

  describe('Utility Functions', () => {
    it('should provide singleton instance access', async () => {
      const testData = { model: 'test', messages: [] };
      const context = { endpoint: '/test', method: 'POST' };
      
      const report = await validateRequest(testData, 'chat_completion', context);
      
      expect(report).toBeDefined();
      expect(typeof report.isValid).toBe('boolean');
    });

    it('should create validation error responses', () => {
      const mockReport: ValidationErrorReport = {
        isValid: false,
        errors: [
          {
            field: 'test_field',
            path: 'test_field',
            value: 'invalid',
            message: 'Test error',
            code: 'TEST_ERROR',
            suggestion: 'Fix the test field'
          }
        ],
        errorCount: 1,
        classification: {
          category: 'validation_error' as any,
          severity: 'low' as any,
          retryStrategy: 'no_retry' as any,
          httpStatusCode: 400,
          errorCode: 'VALIDATION_ERROR',
          isRetryable: false,
          operationalImpact: 'Request rejected',
          clientGuidance: []
        },
        context: {
          endpoint: '/test',
          method: 'POST',
          timestamp: new Date()
        },
        suggestions: ['Test suggestion'],
        processingTime: 10
      };

      const response = createValidationResponse(mockReport);
      
      expect(response.error.type).toBe('validation_error');
      expect(response.error.details.invalid_fields).toHaveLength(1);
      expect(response.error.details.field_count).toBe(1);
    });

    it('should provide performance statistics access', async () => {
      // Perform a validation to generate stats
      await validateRequest({ model: 'test' }, 'chat_completion', {});
      
      const stats = getValidationStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalValidations).toBeGreaterThan(0);
      expect(typeof stats.averageProcessingTime).toBe('number');
      expect(typeof stats.isOptimal).toBe('boolean');
    });
  });

  describe('Field Value Extraction', () => {
    it('should extract nested field values using dot notation', async () => {
      const nestedSchema: ValidationSchema = {
        description: 'Nested field test',
        rules: [
          {
            field: 'user.details.email',
            required: true,
            type: 'string'
          }
        ]
      };

      handler.registerSchema('nested_test', nestedSchema);

      const validData = {
        user: {
          details: {
            email: 'test@example.com'
          }
        }
      };

      const report = await handler.validateRequest(validData, 'nested_test', {});
      expect(report.isValid).toBe(true);

      const invalidData = {
        user: {
          details: {} // Missing email
        }
      };

      const invalidReport = await handler.validateRequest(invalidData, 'nested_test', {});
      expect(invalidReport.isValid).toBe(false);
      expect(invalidReport.errors[0].field).toBe('user.details.email');
    });

    it('should handle array indices in field paths', async () => {
      const arraySchema: ValidationSchema = {
        description: 'Array field test',
        rules: [
          {
            field: 'items[0].name',
            required: true,
            type: 'string'
          }
        ]
      };

      handler.registerSchema('array_test', arraySchema);

      const validData = {
        items: [
          { name: 'first_item' }
        ]
      };

      const report = await handler.validateRequest(validData, 'array_test', {});
      expect(report.isValid).toBe(true);
    });
  });
});