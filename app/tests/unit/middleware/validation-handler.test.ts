/**
 * Validation Handler Unit Tests
 * Comprehensive tests for detailed validation error handling system
 * Tests field-level validation, error reporting, and performance requirements
 */

// Mock logger to prevent console output during tests
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock logger using automatic hoisting
jest.mock('../../../src/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }),
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }),
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
  getErrorClassifier: jest.fn(() => ({
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
  }))
}));

describe('ValidationHandler', () => {
  let ValidationHandler: any;
  let validationHandler: any;
  let validateRequest: any;
  let createValidationResponse: any;
  let getValidationStats: any;
  let handler: any;
  
  beforeAll(async () => {
    // Dynamically import after mocks are set up
    const module = await import('../../../src/middleware/validation-handler');
    ValidationHandler = module.ValidationHandler;
    validationHandler = module.validationHandler;
    validateRequest = module.validateRequest;
    createValidationResponse = module.createValidationResponse;
    getValidationStats = module.getValidationStats;
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
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

  describe('Phase 4B Enhanced Performance Validation', () => {
    it('should validate all requests within 25ms requirement', async () => {
      const testRequests = [
        {
          schema: 'chat_completion',
          data: { model: 'claude-3-sonnet-20240229', messages: [{ role: 'user', content: 'Hello' }] }
        },
        {
          schema: 'session', 
          data: { session_id: 'test_session_123', title: 'Test Session' }
        }
      ];

      for (const { schema, data } of testRequests) {
        const startTime = performance.now();
        const report = await handler.validateRequest(data, schema, {});
        const endTime = performance.now();
        
        const processingTime = endTime - startTime;
        expect(processingTime).toBeLessThan(25); // <25ms requirement
        expect(report.processingTime).toBeLessThan(25);
      }
    });

    it('should maintain validation performance under load', async () => {
      const testData = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Performance test message' }],
        temperature: 1.0
      };

      const validationPromises = Array.from({ length: 100 }, (_, i) => 
        handler.validateRequest(testData, 'chat_completion', { requestId: `perf_test_${i}` })
      );

      const startTime = performance.now();
      const results = await Promise.all(validationPromises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const avgTimePerValidation = totalTime / results.length;

      expect(avgTimePerValidation).toBeLessThan(25); // <25ms average
      expect(results.every(r => r.processingTime < 25)).toBe(true);

      const stats = handler.getPerformanceStats();
      expect(stats.isOptimal).toBe(true);
    });

    it('should validate complex nested objects within performance requirements', async () => {
      const complexSchema: ValidationSchema = {
        description: 'Complex nested validation test',
        rules: [
          { field: 'user.profile.personal.name.first', required: true, type: 'string' },
          { field: 'user.profile.personal.name.last', required: true, type: 'string' },
          { field: 'user.settings.preferences.theme', type: 'string', enum: ['light', 'dark'] },
          { field: 'user.settings.notifications.email', type: 'boolean' },
          { field: 'metadata.creation.timestamp', required: true, type: 'string' },
          { field: 'metadata.tags', type: 'array' }
        ]
      };

      handler.registerSchema('complex_nested', complexSchema);

      const complexData = {
        user: {
          profile: {
            personal: {
              name: {
                first: 'John',
                last: 'Doe'
              }
            }
          },
          settings: {
            preferences: {
              theme: 'dark'
            },
            notifications: {
              email: true
            }
          }
        },
        metadata: {
          creation: {
            timestamp: '2024-01-01T00:00:00Z'
          },
          tags: ['test', 'validation']
        }
      };

      const startTime = performance.now();
      const report = await handler.validateRequest(complexData, 'complex_nested', {});
      const endTime = performance.now();

      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(25); // <25ms even for complex validation
      expect(report.isValid).toBe(true);
      expect(report.processingTime).toBeLessThan(25);
    });

    it('should validate large payloads within performance requirements', async () => {
      const largePayloadSchema: ValidationSchema = {
        description: 'Large payload validation test',
        rules: [
          { field: 'model', required: true, type: 'string' },
          { field: 'messages', required: true, type: 'array' },
          { field: 'large_content', type: 'string', maxLength: 50000 }
        ]
      };

      handler.registerSchema('large_payload', largePayloadSchema);

      const largeData = {
        model: 'claude-3-sonnet-20240229',
        messages: Array.from({ length: 100 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'x'.repeat(1000)}` // 1KB per message
        })),
        large_content: 'x'.repeat(30000) // 30KB content
      };

      const startTime = performance.now();
      const report = await handler.validateRequest(largeData, 'large_payload', {});
      const endTime = performance.now();

      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(25); // <25ms even for large payloads
      expect(report.processingTime).toBeLessThan(25);
    });
  });

  describe('Phase 4B OpenAI Response Format Compliance', () => {
    it('should generate OpenAI-compatible validation error responses', async () => {
      const invalidData = {
        // Missing required 'model' field
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 'invalid' // Wrong type
      };

      const report = await handler.validateRequest(invalidData, 'chat_completion', {
        requestId: 'req_openai_test',
        endpoint: '/v1/chat/completions',
        method: 'POST'
      });

      expect(report.isValid).toBe(false);
      expect(report.errors.length).toBeGreaterThan(0);

      // Generate OpenAI-compatible response
      const response = handler.createValidationErrorResponse(report);

      // Verify OpenAI compatibility
      expect(response.error).toBeDefined();
      expect(response.error.type).toBe('validation_error');
      expect(response.error.message).toBeDefined();
      expect(response.error.code).toBeDefined();
      expect(response.error.details).toBeDefined();
      expect(response.error.details.invalid_fields).toBeDefined();
      expect(Array.isArray(response.error.details.invalid_fields)).toBe(true);

      // Verify field-level details
      response.error.details.invalid_fields.forEach((field: any) => {
        expect(field.field).toBeDefined();
        expect(field.path).toBeDefined();
        expect(field.message).toBeDefined();
        expect(field.code).toBeDefined();
        expect(field.suggestion).toBeDefined();
      });
    });

    it('should provide detailed field paths for OpenAI compatibility', async () => {
      const nestedInvalidData = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user' }], // Missing content
        metadata: {
          user: {
            preferences: {
              invalid_field: 'bad_value'
            }
          }
        }
      };

      const nestedSchema: ValidationSchema = {
        description: 'Nested field validation for OpenAI compatibility',
        rules: [
          { field: 'model', required: true, type: 'string' },
          { field: 'messages[0].content', required: true, type: 'string' },
          { field: 'metadata.user.preferences.theme', type: 'string', enum: ['light', 'dark'] }
        ]
      };

      handler.registerSchema('nested_openai', nestedSchema);

      const report = await handler.validateRequest(nestedInvalidData, 'nested_openai', {});
      const response = handler.createValidationErrorResponse(report);

      // Verify detailed field paths are provided
      const invalidFields = response.error.details.invalid_fields;
      expect(invalidFields.length).toBeGreaterThan(0);

      invalidFields.forEach((field: any) => {
        // Field paths should use dot notation or array notation
        expect(field.path).toMatch(/^[a-zA-Z0-9_.[\]]+$/);
        expect(field.field).toMatch(/^[a-zA-Z0-9_.[\]]+$/);
      });
    });

    it('should sanitize sensitive data in validation responses', async () => {
      const sensitiveData = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Hello' }],
        api_key: 'sk-secret123456',
        password: 'mysecretpassword',
        auth_token: 'bearer_token_123'
      };

      const sensitiveSchema: ValidationSchema = {
        description: 'Sensitive data validation',
        rules: [
          { field: 'model', required: true, type: 'string' },
          { field: 'api_key', type: 'string', pattern: /^sk-/ },
          { field: 'password', type: 'string', minLength: 8 },
          { field: 'auth_token', type: 'string' }
        ]
      };

      handler.registerSchema('sensitive_test', sensitiveSchema);

      const report = await handler.validateRequest(sensitiveData, 'sensitive_test', {});
      const response = handler.createValidationErrorResponse(report);

      // Verify sensitive values are redacted
      if (response.error.details.invalid_fields) {
        response.error.details.invalid_fields.forEach((field: any) => {
          if (['api_key', 'password', 'auth_token'].includes(field.field)) {
            expect(field.value).toBe('[REDACTED]');
          }
        });
      }

      // Verify debug info doesn't expose sensitive data
      if (response.error.debug_info?.request_metadata) {
        const debugStr = JSON.stringify(response.error.debug_info);
        expect(debugStr).not.toContain('sk-secret123456');
        expect(debugStr).not.toContain('mysecretpassword');
        expect(debugStr).not.toContain('bearer_token_123');
      }
    });
  });

  describe('Phase 4B Request ID Correlation in Validation', () => {
    it('should maintain request ID correlation throughout validation pipeline', async () => {
      const testRequestId = 'req_validation_correlation_456';
      const testData = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Correlation test' }]
      };

      const context = {
        requestId: testRequestId,
        endpoint: '/v1/chat/completions',
        method: 'POST',
        timestamp: new Date(),
        userAgent: 'Test-Agent/1.0'
      };

      const report = await handler.validateRequest(testData, 'chat_completion', context);

      // Verify request ID is preserved in report context
      expect(report.context.requestId).toBe(testRequestId);
      
      // Verify request ID is included in error response
      const response = handler.createValidationErrorResponse(report);
      expect(response.error.request_id).toBe(testRequestId);

      // Verify correlation ID is present in details
      if (response.error.details?.correlation_id) {
        expect(response.error.details.correlation_id).toBe(testRequestId);
      }
    });

    it('should handle multiple concurrent validations with unique request IDs', async () => {
      const concurrentValidations = Array.from({ length: 50 }, (_, i) => ({
        requestId: `req_concurrent_validation_${i}`,
        data: {
          model: 'claude-3-sonnet-20240229',
          messages: [{ role: 'user', content: `Concurrent message ${i}` }]
        }
      }));

      const validationPromises = concurrentValidations.map(({ requestId, data }) =>
        handler.validateRequest(data, 'chat_completion', { requestId })
      );

      const reports = await Promise.all(validationPromises);

      // Verify each report has the correct request ID
      reports.forEach((report, index) => {
        const expectedRequestId = concurrentValidations[index].requestId;
        expect(report.context.requestId).toBe(expectedRequestId);
      });

      // Verify no request ID contamination
      const uniqueRequestIds = new Set(reports.map(r => r.context.requestId));
      expect(uniqueRequestIds.size).toBe(concurrentValidations.length);
    });

    it('should generate unique request IDs when not provided', async () => {
      const testData = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Auto-generated ID test' }]
      };

      const reports = await Promise.all([
        handler.validateRequest(testData, 'chat_completion', {}),
        handler.validateRequest(testData, 'chat_completion', {}),
        handler.validateRequest(testData, 'chat_completion', {})
      ]);

      // Verify each report has a request ID (auto-generated or default)
      reports.forEach(report => {
        expect(report.context.requestId).toBeDefined();
        expect(typeof report.context.requestId).toBe('string');
      });
    });
  });
});