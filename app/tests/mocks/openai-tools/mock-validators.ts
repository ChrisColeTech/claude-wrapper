/**
 * Mock Validators for OpenAI Tools Testing
 * 
 * Provides comprehensive mocking for all validation services
 * covering schema validation, parameter validation, format validation,
 * and runtime validation from phases 1A-12A.
 * 
 * Features:
 * - Configurable validation results for different test scenarios
 * - Error injection for testing validation error handling
 * - Validation call tracking for test verification
 * - Support for all validation services and frameworks
 * - Lightweight and fast for unit testing
 */

import { jest } from '@jest/globals';
import {
  OpenAITool,
  OpenAIFunction,
  OpenAIToolChoice,
  ToolValidationResult,
  ToolArrayValidationResult,
  IToolValidator,
  IToolSchemaValidator,
  IToolArrayValidator,
  IToolChoiceValidator,
  IFormatValidator,
  IValidationFramework
} from '../../../src/tools/types';

// Mock validation configurations
export interface MockValidationConfig {
  // Schema validation
  schemaValidation?: {
    shouldPass?: boolean;
    errors?: string[];
    warnings?: string[];
    strictMode?: boolean;
  };
  
  // Parameter validation
  parameterValidation?: {
    shouldPass?: boolean;
    errors?: string[];
    warnings?: string[];
    requiredFields?: string[];
    typeChecking?: boolean;
  };
  
  // Format validation
  formatValidation?: {
    shouldPass?: boolean;
    errors?: string[];
    warnings?: string[];
    supportedFormats?: string[];
  };
  
  // Runtime validation
  runtimeValidation?: {
    shouldPass?: boolean;
    errors?: string[];
    warnings?: string[];
    performanceChecks?: boolean;
  };
  
  // Error configuration
  errorConfig?: {
    shouldThrow?: boolean;
    errorType?: 'schema' | 'parameter' | 'format' | 'runtime' | 'validation';
    errorMessage?: string;
    errorDetails?: any;
  };
  
  // Performance simulation
  performanceConfig?: {
    latencyMs?: number;
    shouldTimeout?: boolean;
    timeoutMs?: number;
  };
  
  // Tracking
  trackValidations?: boolean;
}

export interface MockValidationCallInfo {
  validatorType: string;
  methodName: string;
  input: any;
  result?: any;
  error?: Error;
  timestamp: number;
  duration: number;
}

/**
 * Base Mock Validator with common functionality
 */
export abstract class BaseMockValidator {
  protected config: MockValidationConfig;
  protected callHistory: MockValidationCallInfo[] = [];
  protected callCounts: Map<string, number> = new Map();
  
  constructor(config: MockValidationConfig = {}) {
    this.config = {
      schemaValidation: { shouldPass: true },
      parameterValidation: { shouldPass: true },
      formatValidation: { shouldPass: true },
      runtimeValidation: { shouldPass: true },
      errorConfig: { shouldThrow: false },
      performanceConfig: { latencyMs: 0 },
      trackValidations: true,
      ...config
    };
  }

  /**
   * Simulate validation latency
   */
  protected async simulateLatency(): Promise<void> {
    const { latencyMs = 0, shouldTimeout = false, timeoutMs = 5000 } = this.config.performanceConfig || {};
    
    if (shouldTimeout) {
      throw new Error('Validation timeout');
    }
    
    if (latencyMs > 0) {
      await new Promise(resolve => setTimeout(resolve, latencyMs));
    }
  }

  /**
   * Handle configured errors
   */
  protected handleError(context: string): void {
    const { shouldThrow, errorType, errorMessage, errorDetails } = this.config.errorConfig || {};
    
    if (shouldThrow) {
      const message = errorMessage || `Mock validation error in ${context}`;
      const error = new Error(message);
      
      if (errorDetails) {
        (error as any).details = errorDetails;
      }
      
      if (errorType) {
        (error as any).type = errorType;
      }
      
      throw error;
    }
  }

  /**
   * Track validation calls
   */
  protected trackCall(validatorType: string, methodName: string, input: any, result?: any, error?: Error, duration: number = 0): void {
    if (!this.config.trackValidations) return;
    
    this.callHistory.push({
      validatorType,
      methodName,
      input,
      result,
      error,
      timestamp: Date.now(),
      duration
    });
    
    const key = `${validatorType}.${methodName}`;
    this.callCounts.set(key, (this.callCounts.get(key) || 0) + 1);
  }

  // Test utilities
  getCallHistory(): MockValidationCallInfo[] {
    return [...this.callHistory];
  }

  getCallCount(validatorType?: string, methodName?: string): number {
    if (validatorType && methodName) {
      return this.callCounts.get(`${validatorType}.${methodName}`) || 0;
    }
    if (validatorType) {
      return this.callHistory.filter(call => call.validatorType === validatorType).length;
    }
    return this.callHistory.length;
  }

  getLastCall(validatorType?: string): MockValidationCallInfo | undefined {
    if (validatorType) {
      return this.callHistory.filter(call => call.validatorType === validatorType).pop();
    }
    return this.callHistory[this.callHistory.length - 1];
  }

  clearCallHistory(): void {
    this.callHistory = [];
    this.callCounts.clear();
  }

  updateConfig(config: Partial<MockValidationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  reset(): void {
    this.clearCallHistory();
    this.config = {
      schemaValidation: { shouldPass: true },
      parameterValidation: { shouldPass: true },
      formatValidation: { shouldPass: true },
      runtimeValidation: { shouldPass: true },
      errorConfig: { shouldThrow: false },
      performanceConfig: { latencyMs: 0 },
      trackValidations: true
    };
  }
}

/**
 * Mock Tool Schema Validator (Phase 1A)
 */
export class MockToolSchemaValidator extends BaseMockValidator implements IToolSchemaValidator {
  async validateSchema(schema: any): Promise<ToolValidationResult> {
    const startTime = Date.now();
    const methodName = 'validateSchema';
    
    try {
      await this.simulateLatency();
      this.handleError(methodName);
      
      const { shouldPass = true, errors = [], warnings = [], strictMode = false } = this.config.schemaValidation || {};
      
      const result: ToolValidationResult = {
        valid: shouldPass,
        errors,
        warnings,
        schema: shouldPass ? schema : undefined,
        metadata: {
          strictMode,
          validatedAt: Date.now()
        }
      };
      
      const duration = Date.now() - startTime;
      this.trackCall('ToolSchemaValidator', methodName, schema, result, undefined, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.trackCall('ToolSchemaValidator', methodName, schema, undefined, error as Error, duration);
      throw error;
    }
  }

  async validateFunctionSchema(functionSchema: OpenAIFunction): Promise<ToolValidationResult> {
    const startTime = Date.now();
    const methodName = 'validateFunctionSchema';
    
    try {
      await this.simulateLatency();
      this.handleError(methodName);
      
      const { shouldPass = true, errors = [], warnings = [] } = this.config.schemaValidation || {};
      
      const result: ToolValidationResult = {
        valid: shouldPass,
        errors,
        warnings,
        functionSchema: shouldPass ? functionSchema : undefined
      };
      
      const duration = Date.now() - startTime;
      this.trackCall('ToolSchemaValidator', methodName, functionSchema, result, undefined, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.trackCall('ToolSchemaValidator', methodName, functionSchema, undefined, error as Error, duration);
      throw error;
    }
  }

  async validateParameterSchema(parameterSchema: any): Promise<ToolValidationResult> {
    const startTime = Date.now();
    const methodName = 'validateParameterSchema';
    
    try {
      await this.simulateLatency();
      this.handleError(methodName);
      
      const { shouldPass = true, errors = [], warnings = [] } = this.config.parameterValidation || {};
      
      const result: ToolValidationResult = {
        valid: shouldPass,
        errors,
        warnings,
        parameterSchema: shouldPass ? parameterSchema : undefined
      };
      
      const duration = Date.now() - startTime;
      this.trackCall('ToolSchemaValidator', methodName, parameterSchema, result, undefined, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.trackCall('ToolSchemaValidator', methodName, parameterSchema, undefined, error as Error, duration);
      throw error;
    }
  }
}

/**
 * Mock Tool Validator (Phase 1A)
 */
export class MockToolValidator extends BaseMockValidator implements IToolValidator {
  async validate(tool: OpenAITool): Promise<ToolValidationResult> {
    const startTime = Date.now();
    const methodName = 'validate';
    
    try {
      await this.simulateLatency();
      this.handleError(methodName);
      
      const { shouldPass = true, errors = [], warnings = [] } = this.config.schemaValidation || {};
      
      const result: ToolValidationResult = {
        valid: shouldPass,
        errors,
        warnings,
        tool: shouldPass ? tool : undefined
      };
      
      const duration = Date.now() - startTime;
      this.trackCall('ToolValidator', methodName, tool, result, undefined, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.trackCall('ToolValidator', methodName, tool, undefined, error as Error, duration);
      throw error;
    }
  }

  async validateFunction(func: OpenAIFunction): Promise<ToolValidationResult> {
    const startTime = Date.now();
    const methodName = 'validateFunction';
    
    try {
      await this.simulateLatency();
      this.handleError(methodName);
      
      const { shouldPass = true, errors = [], warnings = [] } = this.config.schemaValidation || {};
      
      const result: ToolValidationResult = {
        valid: shouldPass,
        errors,
        warnings,
        function: shouldPass ? func : undefined
      };
      
      const duration = Date.now() - startTime;
      this.trackCall('ToolValidator', methodName, func, result, undefined, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.trackCall('ToolValidator', methodName, func, undefined, error as Error, duration);
      throw error;
    }
  }
}

/**
 * Mock Tool Array Validator (Phase 1A)
 */
export class MockToolArrayValidator extends BaseMockValidator implements IToolArrayValidator {
  async validateArray(tools: OpenAITool[]): Promise<ToolArrayValidationResult> {
    const startTime = Date.now();
    const methodName = 'validateArray';
    
    try {
      await this.simulateLatency();
      this.handleError(methodName);
      
      const { shouldPass = true, errors = [], warnings = [] } = this.config.schemaValidation || {};
      
      const result: ToolArrayValidationResult = {
        valid: shouldPass,
        errors,
        warnings,
        validTools: shouldPass ? tools : [],
        invalidTools: shouldPass ? [] : tools,
        totalCount: tools.length,
        validCount: shouldPass ? tools.length : 0,
        invalidCount: shouldPass ? 0 : tools.length
      };
      
      const duration = Date.now() - startTime;
      this.trackCall('ToolArrayValidator', methodName, tools, result, undefined, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.trackCall('ToolArrayValidator', methodName, tools, undefined, error as Error, duration);
      throw error;
    }
  }

  async validateArrayLength(tools: OpenAITool[], maxLength?: number): Promise<ToolValidationResult> {
    const startTime = Date.now();
    const methodName = 'validateArrayLength';
    
    try {
      await this.simulateLatency();
      this.handleError(methodName);
      
      const { shouldPass = true, errors = [], warnings = [] } = this.config.schemaValidation || {};
      
      const result: ToolValidationResult = {
        valid: shouldPass,
        errors,
        warnings,
        metadata: {
          arrayLength: tools.length,
          maxLength: maxLength || 100
        }
      };
      
      const duration = Date.now() - startTime;
      this.trackCall('ToolArrayValidator', methodName, { tools, maxLength }, result, undefined, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.trackCall('ToolArrayValidator', methodName, { tools, maxLength }, undefined, error as Error, duration);
      throw error;
    }
  }
}

/**
 * Mock Tool Choice Validator (Phase 5A)
 */
export class MockToolChoiceValidator extends BaseMockValidator implements IToolChoiceValidator {
  async validateChoice(toolChoice: OpenAIToolChoice, availableTools: OpenAITool[]): Promise<ToolValidationResult> {
    const startTime = Date.now();
    const methodName = 'validateChoice';
    
    try {
      await this.simulateLatency();
      this.handleError(methodName);
      
      const { shouldPass = true, errors = [], warnings = [] } = this.config.schemaValidation || {};
      
      const result: ToolValidationResult = {
        valid: shouldPass,
        errors,
        warnings,
        toolChoice: shouldPass ? toolChoice : undefined,
        metadata: {
          availableToolCount: availableTools.length,
          choiceType: typeof toolChoice === 'string' ? toolChoice : 'function'
        }
      };
      
      const duration = Date.now() - startTime;
      this.trackCall('ToolChoiceValidator', methodName, { toolChoice, availableTools }, result, undefined, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.trackCall('ToolChoiceValidator', methodName, { toolChoice, availableTools }, undefined, error as Error, duration);
      throw error;
    }
  }

  async validateChoiceFormat(toolChoice: OpenAIToolChoice): Promise<ToolValidationResult> {
    const startTime = Date.now();
    const methodName = 'validateChoiceFormat';
    
    try {
      await this.simulateLatency();
      this.handleError(methodName);
      
      const { shouldPass = true, errors = [], warnings = [] } = this.config.formatValidation || {};
      
      const result: ToolValidationResult = {
        valid: shouldPass,
        errors,
        warnings,
        toolChoice: shouldPass ? toolChoice : undefined
      };
      
      const duration = Date.now() - startTime;
      this.trackCall('ToolChoiceValidator', methodName, toolChoice, result, undefined, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.trackCall('ToolChoiceValidator', methodName, toolChoice, undefined, error as Error, duration);
      throw error;
    }
  }
}

/**
 * Mock Format Validator (Phase 3A)
 */
export class MockFormatValidator extends BaseMockValidator implements IFormatValidator {
  async validateFormat(data: any, format: string): Promise<ToolValidationResult> {
    const startTime = Date.now();
    const methodName = 'validateFormat';
    
    try {
      await this.simulateLatency();
      this.handleError(methodName);
      
      const { shouldPass = true, errors = [], warnings = [], supportedFormats = ['openai', 'claude'] } = this.config.formatValidation || {};
      
      const result: ToolValidationResult = {
        valid: shouldPass,
        errors,
        warnings,
        metadata: {
          format,
          supportedFormats,
          dataType: typeof data
        }
      };
      
      const duration = Date.now() - startTime;
      this.trackCall('FormatValidator', methodName, { data, format }, result, undefined, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.trackCall('FormatValidator', methodName, { data, format }, undefined, error as Error, duration);
      throw error;
    }
  }

  async validateOpenAIFormat(data: any): Promise<ToolValidationResult> {
    const startTime = Date.now();
    const methodName = 'validateOpenAIFormat';
    
    try {
      await this.simulateLatency();
      this.handleError(methodName);
      
      const { shouldPass = true, errors = [], warnings = [] } = this.config.formatValidation || {};
      
      const result: ToolValidationResult = {
        valid: shouldPass,
        errors,
        warnings,
        metadata: {
          format: 'openai',
          validatedAt: Date.now()
        }
      };
      
      const duration = Date.now() - startTime;
      this.trackCall('FormatValidator', methodName, data, result, undefined, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.trackCall('FormatValidator', methodName, data, undefined, error as Error, duration);
      throw error;
    }
  }

  async validateClaudeFormat(data: any): Promise<ToolValidationResult> {
    const startTime = Date.now();
    const methodName = 'validateClaudeFormat';
    
    try {
      await this.simulateLatency();
      this.handleError(methodName);
      
      const { shouldPass = true, errors = [], warnings = [] } = this.config.formatValidation || {};
      
      const result: ToolValidationResult = {
        valid: shouldPass,
        errors,
        warnings,
        metadata: {
          format: 'claude',
          validatedAt: Date.now()
        }
      };
      
      const duration = Date.now() - startTime;
      this.trackCall('FormatValidator', methodName, data, result, undefined, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.trackCall('FormatValidator', methodName, data, undefined, error as Error, duration);
      throw error;
    }
  }
}

/**
 * Mock Runtime Validator (Phase 12A)
 */
export class MockRuntimeValidator extends BaseMockValidator {
  async validateRuntime(context: any): Promise<ToolValidationResult> {
    const startTime = Date.now();
    const methodName = 'validateRuntime';
    
    try {
      await this.simulateLatency();
      this.handleError(methodName);
      
      const { shouldPass = true, errors = [], warnings = [], performanceChecks = false } = this.config.runtimeValidation || {};
      
      const result: ToolValidationResult = {
        valid: shouldPass,
        errors,
        warnings,
        metadata: {
          performanceChecks,
          validatedAt: Date.now(),
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime()
        }
      };
      
      const duration = Date.now() - startTime;
      this.trackCall('RuntimeValidator', methodName, context, result, undefined, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.trackCall('RuntimeValidator', methodName, context, undefined, error as Error, duration);
      throw error;
    }
  }

  async validatePerformance(metrics: any): Promise<ToolValidationResult> {
    const startTime = Date.now();
    const methodName = 'validatePerformance';
    
    try {
      await this.simulateLatency();
      this.handleError(methodName);
      
      const { shouldPass = true, errors = [], warnings = [] } = this.config.runtimeValidation || {};
      
      const result: ToolValidationResult = {
        valid: shouldPass,
        errors,
        warnings,
        metadata: {
          metrics,
          validatedAt: Date.now()
        }
      };
      
      const duration = Date.now() - startTime;
      this.trackCall('RuntimeValidator', methodName, metrics, result, undefined, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.trackCall('RuntimeValidator', methodName, metrics, undefined, error as Error, duration);
      throw error;
    }
  }
}

/**
 * Mock Validation Framework (Phase 12A)
 */
export class MockValidationFramework extends BaseMockValidator implements IValidationFramework {
  private validators: Map<string, any> = new Map();
  
  constructor(config: MockValidationConfig = {}) {
    super(config);
    this.initializeValidators();
  }
  
  private initializeValidators(): void {
    this.validators.set('schema', new MockToolSchemaValidator(this.config));
    this.validators.set('tool', new MockToolValidator(this.config));
    this.validators.set('array', new MockToolArrayValidator(this.config));
    this.validators.set('choice', new MockToolChoiceValidator(this.config));
    this.validators.set('format', new MockFormatValidator(this.config));
    this.validators.set('runtime', new MockRuntimeValidator(this.config));
  }
  
  async validateAll(data: any): Promise<ToolValidationResult> {
    const startTime = Date.now();
    const methodName = 'validateAll';
    
    try {
      await this.simulateLatency();
      this.handleError(methodName);
      
      const { shouldPass = true, errors = [], warnings = [] } = this.config.schemaValidation || {};
      
      const result: ToolValidationResult = {
        valid: shouldPass,
        errors,
        warnings,
        metadata: {
          validatorsUsed: Array.from(this.validators.keys()),
          validatedAt: Date.now()
        }
      };
      
      const duration = Date.now() - startTime;
      this.trackCall('ValidationFramework', methodName, data, result, undefined, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.trackCall('ValidationFramework', methodName, data, undefined, error as Error, duration);
      throw error;
    }
  }
  
  getValidator(type: string): any {
    return this.validators.get(type);
  }
  
  registerValidator(type: string, validator: any): void {
    this.validators.set(type, validator);
  }
}

/**
 * Factory functions for creating mock validators
 */
export const createMockValidators = {
  /**
   * Create validators that always pass
   */
  successful: (config?: Partial<MockValidationConfig>) => ({
    schemaValidator: new MockToolSchemaValidator({
      schemaValidation: { shouldPass: true },
      ...config
    }),
    toolValidator: new MockToolValidator({
      schemaValidation: { shouldPass: true },
      ...config
    }),
    arrayValidator: new MockToolArrayValidator({
      schemaValidation: { shouldPass: true },
      ...config
    }),
    choiceValidator: new MockToolChoiceValidator({
      schemaValidation: { shouldPass: true },
      ...config
    }),
    formatValidator: new MockFormatValidator({
      formatValidation: { shouldPass: true },
      ...config
    }),
    runtimeValidator: new MockRuntimeValidator({
      runtimeValidation: { shouldPass: true },
      ...config
    }),
    framework: new MockValidationFramework({
      schemaValidation: { shouldPass: true },
      ...config
    })
  }),

  /**
   * Create validators that always fail
   */
  failing: (errors: string[] = ['Validation failed'], config?: Partial<MockValidationConfig>) => ({
    schemaValidator: new MockToolSchemaValidator({
      schemaValidation: { shouldPass: false, errors },
      ...config
    }),
    toolValidator: new MockToolValidator({
      schemaValidation: { shouldPass: false, errors },
      ...config
    }),
    arrayValidator: new MockToolArrayValidator({
      schemaValidation: { shouldPass: false, errors },
      ...config
    }),
    choiceValidator: new MockToolChoiceValidator({
      schemaValidation: { shouldPass: false, errors },
      ...config
    }),
    formatValidator: new MockFormatValidator({
      formatValidation: { shouldPass: false, errors },
      ...config
    }),
    runtimeValidator: new MockRuntimeValidator({
      runtimeValidation: { shouldPass: false, errors },
      ...config
    }),
    framework: new MockValidationFramework({
      schemaValidation: { shouldPass: false, errors },
      ...config
    })
  }),

  /**
   * Create validators with custom latency
   */
  withLatency: (latencyMs: number, config?: Partial<MockValidationConfig>) => ({
    schemaValidator: new MockToolSchemaValidator({
      performanceConfig: { latencyMs },
      ...config
    }),
    toolValidator: new MockToolValidator({
      performanceConfig: { latencyMs },
      ...config
    }),
    arrayValidator: new MockToolArrayValidator({
      performanceConfig: { latencyMs },
      ...config
    }),
    choiceValidator: new MockToolChoiceValidator({
      performanceConfig: { latencyMs },
      ...config
    }),
    formatValidator: new MockFormatValidator({
      performanceConfig: { latencyMs },
      ...config
    }),
    runtimeValidator: new MockRuntimeValidator({
      performanceConfig: { latencyMs },
      ...config
    }),
    framework: new MockValidationFramework({
      performanceConfig: { latencyMs },
      ...config
    })
  }),

  /**
   * Create lightweight validators (no tracking)
   */
  lightweight: (config?: Partial<MockValidationConfig>) => ({
    schemaValidator: new MockToolSchemaValidator({
      trackValidations: false,
      ...config
    }),
    toolValidator: new MockToolValidator({
      trackValidations: false,
      ...config
    }),
    arrayValidator: new MockToolArrayValidator({
      trackValidations: false,
      ...config
    }),
    choiceValidator: new MockToolChoiceValidator({
      trackValidations: false,
      ...config
    }),
    formatValidator: new MockFormatValidator({
      trackValidations: false,
      ...config
    }),
    runtimeValidator: new MockRuntimeValidator({
      trackValidations: false,
      ...config
    }),
    framework: new MockValidationFramework({
      trackValidations: false,
      ...config
    })
  })
};

/**
 * Jest mock factories
 */
export const createJestMockValidators = (config?: MockValidationConfig) => {
  const validators = createMockValidators.successful(config);
  
  return {
    schemaValidator: {
      validateSchema: jest.fn().mockImplementation(validators.schemaValidator.validateSchema.bind(validators.schemaValidator)),
      validateFunctionSchema: jest.fn().mockImplementation(validators.schemaValidator.validateFunctionSchema.bind(validators.schemaValidator)),
      validateParameterSchema: jest.fn().mockImplementation(validators.schemaValidator.validateParameterSchema.bind(validators.schemaValidator))
    },
    toolValidator: {
      validate: jest.fn().mockImplementation(validators.toolValidator.validate.bind(validators.toolValidator)),
      validateFunction: jest.fn().mockImplementation(validators.toolValidator.validateFunction.bind(validators.toolValidator))
    },
    arrayValidator: {
      validateArray: jest.fn().mockImplementation(validators.arrayValidator.validateArray.bind(validators.arrayValidator)),
      validateArrayLength: jest.fn().mockImplementation(validators.arrayValidator.validateArrayLength.bind(validators.arrayValidator))
    },
    choiceValidator: {
      validateChoice: jest.fn().mockImplementation(validators.choiceValidator.validateChoice.bind(validators.choiceValidator)),
      validateChoiceFormat: jest.fn().mockImplementation(validators.choiceValidator.validateChoiceFormat.bind(validators.choiceValidator))
    },
    formatValidator: {
      validateFormat: jest.fn().mockImplementation(validators.formatValidator.validateFormat.bind(validators.formatValidator)),
      validateOpenAIFormat: jest.fn().mockImplementation(validators.formatValidator.validateOpenAIFormat.bind(validators.formatValidator)),
      validateClaudeFormat: jest.fn().mockImplementation(validators.formatValidator.validateClaudeFormat.bind(validators.formatValidator))
    },
    runtimeValidator: {
      validateRuntime: jest.fn().mockImplementation(validators.runtimeValidator.validateRuntime.bind(validators.runtimeValidator)),
      validatePerformance: jest.fn().mockImplementation(validators.runtimeValidator.validatePerformance.bind(validators.runtimeValidator))
    },
    framework: {
      validateAll: jest.fn().mockImplementation(validators.framework.validateAll.bind(validators.framework)),
      getValidator: jest.fn().mockImplementation(validators.framework.getValidator.bind(validators.framework)),
      registerValidator: jest.fn().mockImplementation(validators.framework.registerValidator.bind(validators.framework))
    }
  };
};

export default {
  MockToolSchemaValidator,
  MockToolValidator,
  MockToolArrayValidator,
  MockToolChoiceValidator,
  MockFormatValidator,
  MockRuntimeValidator,
  MockValidationFramework,
  createMockValidators,
  createJestMockValidators
};