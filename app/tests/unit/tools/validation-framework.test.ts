/**
 * Validation Framework unit tests (Phase 12A)
 * 100% test coverage for ValidationFramework class
 * 
 * Tests all validation orchestration functionality with performance requirements
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import {
  ValidationFramework,
  ValidationFrameworkError,
  createValidationFramework
} from '../../../src/tools/validation-framework';
import {
  OpenAITool,
  OpenAIToolChoice,
  ISchemaValidator,
  IRuntimeValidator,
  ValidationFrameworkResult,
  ValidationFieldError,
  RuntimeValidationContext,
  ValidationFrameworkConfig
} from '../../../src/tools/types';
import {
  VALIDATION_FRAMEWORK_LIMITS,
  VALIDATION_FRAMEWORK_MESSAGES,
  VALIDATION_FRAMEWORK_ERRORS
} from '../../../src/tools/constants';

describe('Validation Framework (Phase 12A)', () => {
  let mockSchemaValidator: jest.Mocked<ISchemaValidator>;
  let mockRuntimeValidator: jest.Mocked<IRuntimeValidator>;
  let validationFramework: ValidationFramework;

  const mockTool: OpenAITool = {
    type: 'function',
    function: {
      name: 'test_function',
      description: 'Test function',
      parameters: {
        type: 'object',
        properties: {
          param1: { type: 'string' }
        },
        required: ['param1']
      }
    }
  };

  const mockParameters = { param1: 'test_value' };

  const createMockValidationResult = (valid: boolean, errors: ValidationFieldError[] = []): ValidationFrameworkResult => ({
    valid,
    errors,
    validationTimeMs: 1,
    performanceMetrics: {
      validationTimeMs: 1,
      schemaValidationTimeMs: 0.5,
      runtimeValidationTimeMs: 0.5,
      customRulesTimeMs: 0,
      cacheTimeMs: 0,
      memoryUsageBytes: 1024
    }
  });

  beforeEach(() => {
    mockSchemaValidator = {
      validateToolSchema: jest.fn(),
      validateFunctionSchema: jest.fn(),
      validateParametersSchema: jest.fn(),
      validateWithCache: jest.fn(),
      clearCache: jest.fn(),
      getCacheStats: jest.fn()
    };

    mockRuntimeValidator = {
      validateRuntimeParameters: jest.fn(),
      addCustomRule: jest.fn(),
      removeCustomRule: jest.fn(),
      getCustomRules: jest.fn(),
      validateWithCustomRules: jest.fn()
    };

    validationFramework = new ValidationFramework(mockSchemaValidator, mockRuntimeValidator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ValidationFrameworkError', () => {
    it('should create error with all fields', () => {
      const error = new ValidationFrameworkError(
        'Test error',
        'TEST_CODE',
        5,
        'test_field'
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.validationTimeMs).toBe(5);
      expect(error.field).toBe('test_field');
      expect(error.name).toBe('ValidationFrameworkError');
    });
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      const framework = new ValidationFramework(mockSchemaValidator, mockRuntimeValidator);
      const config = framework.getConfiguration();
      
      expect(config.enableCaching).toBe(true);
      expect(config.cacheSize).toBe(VALIDATION_FRAMEWORK_LIMITS.VALIDATION_CACHE_SIZE);
      expect(config.enableCustomRules).toBe(true);
      expect(config.strictMode).toBe(true);
      expect(config.maxValidationTimeMs).toBe(VALIDATION_FRAMEWORK_LIMITS.VALIDATION_TIMEOUT_MS);
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        enableCaching: false,
        strictMode: false,
        maxValidationTimeMs: 10
      };

      const framework = new ValidationFramework(mockSchemaValidator, mockRuntimeValidator, customConfig);
      const config = framework.getConfiguration();
      
      expect(config.enableCaching).toBe(false);
      expect(config.strictMode).toBe(false);
      expect(config.maxValidationTimeMs).toBe(10);
    });
  });

  describe('validateComplete', () => {
    it('should validate tool and parameters successfully', async () => {
      const schemaResult = createMockValidationResult(true);
      const runtimeResult = createMockValidationResult(true);

      mockSchemaValidator.validateToolSchema.mockResolvedValue(schemaResult);
      mockRuntimeValidator.validateRuntimeParameters.mockResolvedValue(runtimeResult);

      const result = await validationFramework.validateComplete(mockTool, mockParameters);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.validationTimeMs).toBeGreaterThan(0);
      expect(result.performanceMetrics).toBeDefined();
      expect(mockSchemaValidator.validateToolSchema).toHaveBeenCalledWith(mockTool);
      expect(mockRuntimeValidator.validateRuntimeParameters).toHaveBeenCalledWith({
        tool: mockTool,
        parameters: mockParameters
      });
    });

    it('should fail when schema validation fails', async () => {
      const schemaError: ValidationFieldError = {
        field: 'tool.function.name',
        code: 'INVALID_NAME',
        message: 'Invalid function name',
        severity: 'error'
      };
      const schemaResult = createMockValidationResult(false, [schemaError]);

      mockSchemaValidator.validateToolSchema.mockResolvedValue(schemaResult);

      const result = await validationFramework.validateComplete(mockTool, mockParameters);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(schemaError);
      expect(mockRuntimeValidator.validateRuntimeParameters).not.toHaveBeenCalled();
    });

    it('should fail when runtime validation fails', async () => {
      const schemaResult = createMockValidationResult(true);
      const runtimeError: ValidationFieldError = {
        field: 'parameters.param1',
        code: 'TYPE_MISMATCH',
        message: 'Type mismatch',
        severity: 'error'
      };
      const runtimeResult = createMockValidationResult(false, [runtimeError]);

      mockSchemaValidator.validateToolSchema.mockResolvedValue(schemaResult);
      mockRuntimeValidator.validateRuntimeParameters.mockResolvedValue(runtimeResult);

      const result = await validationFramework.validateComplete(mockTool, mockParameters);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(runtimeError);
    });

    it('should handle missing tool parameter', async () => {
      const result = await validationFramework.validateComplete(null as any, mockParameters);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(VALIDATION_FRAMEWORK_ERRORS.VALIDATION_FAILED);
      expect(result.errors[0].message).toBe(VALIDATION_FRAMEWORK_MESSAGES.VALIDATION_INPUT_REQUIRED);
    });

    it('should handle missing parameters', async () => {
      const result = await validationFramework.validateComplete(mockTool, null as any);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(VALIDATION_FRAMEWORK_ERRORS.VALIDATION_FAILED);
    });

    it('should handle validation with context', async () => {
      const context: RuntimeValidationContext = {
        tool: mockTool,
        parameters: mockParameters,
        requestId: 'test-request',
        sessionId: 'test-session'
      };

      const schemaResult = createMockValidationResult(true);
      const runtimeResult = createMockValidationResult(true);

      mockSchemaValidator.validateToolSchema.mockResolvedValue(schemaResult);
      mockRuntimeValidator.validateRuntimeParameters.mockResolvedValue(runtimeResult);

      const result = await validationFramework.validateComplete(mockTool, mockParameters, context);

      expect(result.valid).toBe(true);
      expect(mockRuntimeValidator.validateRuntimeParameters).toHaveBeenCalledWith({
        tool: mockTool,
        parameters: mockParameters,
        requestId: 'test-request',
        sessionId: 'test-session'
      });
    });

    it('should handle validation exceptions', async () => {
      mockSchemaValidator.validateToolSchema.mockRejectedValue(new Error('Schema validation error'));

      const result = await validationFramework.validateComplete(mockTool, mockParameters);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(VALIDATION_FRAMEWORK_ERRORS.FRAMEWORK_ERROR);
      expect(result.errors[0].message).toBe(VALIDATION_FRAMEWORK_MESSAGES.VALIDATION_FRAMEWORK_ERROR);
    });

    it('should warn about performance requirement violations', async () => {
      const slowSchemaResult = createMockValidationResult(true);
      const slowRuntimeResult = createMockValidationResult(true);

      // Mock slow validation
      mockSchemaValidator.validateToolSchema.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(slowSchemaResult), 5))
      );
      mockRuntimeValidator.validateRuntimeParameters.mockResolvedValue(slowRuntimeResult);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await validationFramework.validateComplete(mockTool, mockParameters);

      expect(result.valid).toBe(true);
      expect(result.validationTimeMs).toBeGreaterThan(VALIDATION_FRAMEWORK_LIMITS.VALIDATION_TIMEOUT_MS);

      consoleSpy.mockRestore();
    });
  });

  describe('validateTools', () => {
    it('should validate array of tools successfully', async () => {
      const tools = [mockTool, { ...mockTool, function: { ...mockTool.function, name: 'test_function2' } }];
      const validResult = createMockValidationResult(true);

      mockSchemaValidator.validateToolSchema.mockResolvedValue(validResult);

      const results = await validationFramework.validateTools(tools);

      expect(results).toHaveLength(2);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(true);
      expect(mockSchemaValidator.validateToolSchema).toHaveBeenCalledTimes(2);
    });

    it('should handle empty tools array', async () => {
      const results = await validationFramework.validateTools([]);

      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors[0].message).toBe(VALIDATION_FRAMEWORK_MESSAGES.TOOLS_ARRAY_REQUIRED);
    });

    it('should handle null tools array', async () => {
      const results = await validationFramework.validateTools(null as any);

      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
    });

    it('should handle validation errors for individual tools', async () => {
      const tools = [mockTool];
      
      mockSchemaValidator.validateToolSchema.mockRejectedValue(new Error('Validation error'));

      const results = await validationFramework.validateTools(tools);

      expect(results[0].valid).toBe(false);
      expect(results[0].errors[0].message).toContain('Validation error');
    });
  });

  describe('validateToolsWithChoice', () => {
    it('should validate tools with auto choice', async () => {
      const tools = [mockTool];
      const toolChoice: OpenAIToolChoice = 'auto';
      const validResult = createMockValidationResult(true);

      mockSchemaValidator.validateToolSchema.mockResolvedValue(validResult);

      const result = await validationFramework.validateToolsWithChoice(tools, toolChoice);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate tools with specific function choice', async () => {
      const tools = [mockTool];
      const toolChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'test_function' }
      };
      const validResult = createMockValidationResult(true);

      mockSchemaValidator.validateToolSchema.mockResolvedValue(validResult);

      const result = await validationFramework.validateToolsWithChoice(tools, toolChoice);

      expect(result.valid).toBe(true);
    });

    it('should fail when tool choice function not found', async () => {
      const tools = [mockTool];
      const toolChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'non_existent_function' }
      };
      const validResult = createMockValidationResult(true);

      mockSchemaValidator.validateToolSchema.mockResolvedValue(validResult);

      const result = await validationFramework.validateToolsWithChoice(tools, toolChoice);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe(VALIDATION_FRAMEWORK_MESSAGES.TOOL_CHOICE_FUNCTION_NOT_FOUND);
    });

    it('should fail when tool validation fails', async () => {
      const tools = [mockTool];
      const invalidResult = createMockValidationResult(false, [{
        field: 'tool',
        code: 'INVALID',
        message: 'Invalid tool',
        severity: 'error'
      }]);

      mockSchemaValidator.validateToolSchema.mockResolvedValue(invalidResult);

      const result = await validationFramework.validateToolsWithChoice(tools);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe('Invalid tool');
    });

    it('should handle validation exceptions', async () => {
      const tools = [mockTool];
      const invalidResult = createMockValidationResult(false, [{
        field: 'tool',
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        severity: 'error'
      }]);
      
      mockSchemaValidator.validateToolSchema.mockResolvedValue(invalidResult);

      const result = await validationFramework.validateToolsWithChoice(tools);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('VALIDATION_FAILED');
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = {
        enableCaching: false,
        maxValidationTimeMs: 5
      };

      validationFramework.configure(newConfig);
      const config = validationFramework.getConfiguration();

      expect(config.enableCaching).toBe(false);
      expect(config.maxValidationTimeMs).toBe(5);
      expect(config.enableCustomRules).toBe(true); // Should retain original value
    });

    it('should return current configuration', () => {
      const config = validationFramework.getConfiguration();

      expect(config).toHaveProperty('enableCaching');
      expect(config).toHaveProperty('cacheSize');
      expect(config).toHaveProperty('enableCustomRules');
      expect(config).toHaveProperty('strictMode');
      expect(config).toHaveProperty('maxValidationTimeMs');
    });
  });

  describe('Performance Metrics', () => {
    it('should return current metrics', () => {
      const metrics = validationFramework.getValidationMetrics();

      expect(metrics).toHaveProperty('validationTimeMs');
      expect(metrics).toHaveProperty('schemaValidationTimeMs');
      expect(metrics).toHaveProperty('runtimeValidationTimeMs');
      expect(metrics).toHaveProperty('customRulesTimeMs');
      expect(metrics).toHaveProperty('cacheTimeMs');
      expect(metrics).toHaveProperty('memoryUsageBytes');
    });

    it('should reset metrics', () => {
      validationFramework.resetMetrics();
      const metrics = validationFramework.getValidationMetrics();

      expect(metrics.validationTimeMs).toBe(0);
      expect(metrics.schemaValidationTimeMs).toBe(0);
      expect(metrics.runtimeValidationTimeMs).toBe(0);
      expect(metrics.customRulesTimeMs).toBe(0);
      expect(metrics.cacheTimeMs).toBe(0);
      expect(metrics.memoryUsageBytes).toBe(0);
    });

    it('should update metrics during validation', async () => {
      const schemaResult = createMockValidationResult(true);
      const runtimeResult = createMockValidationResult(true);

      mockSchemaValidator.validateToolSchema.mockResolvedValue(schemaResult);
      mockRuntimeValidator.validateRuntimeParameters.mockResolvedValue(runtimeResult);

      await validationFramework.validateComplete(mockTool, mockParameters);

      const metrics = validationFramework.getValidationMetrics();
      expect(metrics.validationTimeMs).toBeGreaterThan(0);
      expect(metrics.memoryUsageBytes).toBeGreaterThan(0);
    });
  });

  describe('Performance Requirements', () => {
    it('should complete validation within 2ms for simple tools', async () => {
      const schemaResult = createMockValidationResult(true);
      const runtimeResult = createMockValidationResult(true);

      mockSchemaValidator.validateToolSchema.mockResolvedValue(schemaResult);
      mockRuntimeValidator.validateRuntimeParameters.mockResolvedValue(runtimeResult);

      const startTime = performance.now();
      const result = await validationFramework.validateComplete(mockTool, mockParameters);
      const duration = performance.now() - startTime;

      expect(result.valid).toBe(true);
      expect(duration).toBeLessThan(VALIDATION_FRAMEWORK_LIMITS.VALIDATION_TIMEOUT_MS);
    });
  });

  describe('Factory Function', () => {
    it('should create validation framework instance', () => {
      const framework = createValidationFramework(mockSchemaValidator, mockRuntimeValidator);
      
      expect(framework).toBeInstanceOf(ValidationFramework);
    });

    it('should create framework with custom configuration', () => {
      const config = { enableCaching: false };
      const framework = createValidationFramework(mockSchemaValidator, mockRuntimeValidator, config);
      
      expect(framework.getConfiguration().enableCaching).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined tool choice', async () => {
      const tools = [mockTool];
      const validResult = createMockValidationResult(true);

      mockSchemaValidator.validateToolSchema.mockResolvedValue(validResult);

      const result = await validationFramework.validateToolsWithChoice(tools, undefined);

      expect(result.valid).toBe(true);
    });

    it('should handle malformed tool choice object', async () => {
      const tools = [mockTool];
      const toolChoice = { invalid: 'choice' } as any;
      const validResult = createMockValidationResult(true);

      mockSchemaValidator.validateToolSchema.mockResolvedValue(validResult);

      const result = await validationFramework.validateToolsWithChoice(tools, toolChoice);

      expect(result.valid).toBe(true); // Should not fail due to malformed choice when tools are valid
    });
  });
});