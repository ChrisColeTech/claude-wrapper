/**
 * Tool validation service
 * Single Responsibility: Validation logic only
 * 
 * Implements OpenAI Tools API validation with comprehensive error handling
 */

import {
  IToolValidator,
  IToolSchemaValidator,
  IToolArrayValidator,
  OpenAITool,
  OpenAIFunction,
  OpenAIToolChoice,
  ToolValidationResult,
  ToolArrayValidationResult,
  IValidationFramework,
  ValidationFrameworkResult,
  RuntimeValidationContext
} from './types';
import {
  OpenAIToolSchema,
  OpenAIFunctionSchema,
  OpenAIToolChoiceSchema,
  ToolsArraySchema,
  ToolsRequestSchema,
  ValidationUtils
} from './schemas';
import {
  TOOL_VALIDATION_LIMITS,
  TOOL_VALIDATION_MESSAGES
} from './constants';

/**
 * Tool validation error class
 */
export class ToolValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'ToolValidationError';
  }
}

/**
 * Tool schema validator implementation
 */
export class ToolSchemaValidator implements IToolSchemaValidator {
  /**
   * Validate individual tool
   */
  validateTool(tool: OpenAITool): ToolValidationResult {
    try {
      const result = OpenAIToolSchema.safeParse(tool);
      
      if (result.success) {
        return { valid: true, errors: [] };
      }
      
      const errors = ValidationUtils.extractErrorMessages(result);
      return { valid: false, errors };
      
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error']
      };
    }
  }

  /**
   * Validate function definition
   */
  validateFunction(func: OpenAIFunction): ToolValidationResult {
    try {
      const result = OpenAIFunctionSchema.safeParse(func);
      
      if (result.success) {
        return { valid: true, errors: [] };
      }
      
      const errors = ValidationUtils.extractErrorMessages(result);
      return { valid: false, errors };
      
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error']
      };
    }
  }

  /**
   * Validate function parameters
   */
  validateParameters(parameters: Record<string, any>): ToolValidationResult {
    try {
      // Check parameter depth
      if (!ValidationUtils.validateParameterDepth(parameters)) {
        return {
          valid: false,
          errors: [TOOL_VALIDATION_MESSAGES.PARAMETERS_DEPTH_EXCEEDED]
        };
      }
      
      // Validate parameter structure
      const result = OpenAIFunctionSchema.shape.parameters.safeParse(parameters);
      
      if (result.success) {
        return { valid: true, errors: [] };
      }
      
      const errors = ValidationUtils.extractErrorMessages(result);
      return { valid: false, errors };
      
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error']
      };
    }
  }
}

/**
 * Tool array validator implementation
 */
export class ToolArrayValidator implements IToolArrayValidator {
  /**
   * Validate tools array
   */
  validateToolArray(tools: OpenAITool[]): ToolArrayValidationResult {
    try {
      if (!Array.isArray(tools)) {
        return {
          valid: false,
          errors: [TOOL_VALIDATION_MESSAGES.TOOLS_ARRAY_REQUIRED],
          validTools: []
        };
      }
      
      const result = ToolsArraySchema.safeParse(tools);
      
      if (result.success) {
        return { valid: true, errors: [], validTools: result.data };
      }
      
      const errors = ValidationUtils.extractErrorMessages(result);
      
      // Extract valid tools for partial validation
      const validTools = tools.filter(tool => {
        const toolResult = OpenAIToolSchema.safeParse(tool);
        return toolResult.success;
      });
      
      return { valid: false, errors, validTools };
      
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error'],
        validTools: []
      };
    }
  }

  /**
   * Validate tool choice
   */
  validateToolChoice(toolChoice: OpenAIToolChoice, tools: OpenAITool[]): ToolValidationResult {
    try {
      // Basic schema validation
      const result = OpenAIToolChoiceSchema.safeParse(toolChoice);
      
      if (!result.success) {
        const errors = ValidationUtils.extractErrorMessages(result);
        return { valid: false, errors };
      }
      
      // Validate function name exists in tools array
      if (typeof toolChoice === 'object' && toolChoice.type === 'function') {
        const functionName = toolChoice.function.name;
        const toolNames = tools.map(tool => tool.function.name);
        
        if (!toolNames.includes(functionName)) {
          return {
            valid: false,
            errors: [TOOL_VALIDATION_MESSAGES.TOOL_CHOICE_FUNCTION_NOT_FOUND]
          };
        }
      }
      
      return { valid: true, errors: [] };
      
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error']
      };
    }
  }
}

/**
 * Main tool validator implementation
 */
export class ToolValidator implements IToolValidator {
  private schemaValidator: IToolSchemaValidator;
  private arrayValidator: IToolArrayValidator;
  private validationFramework?: IValidationFramework;

  constructor(
    schemaValidator?: IToolSchemaValidator,
    arrayValidator?: IToolArrayValidator,
    validationFramework?: IValidationFramework
  ) {
    this.schemaValidator = schemaValidator || new ToolSchemaValidator();
    this.arrayValidator = arrayValidator || new ToolArrayValidator();
    this.validationFramework = validationFramework;
  }

  /**
   * Validate individual tool
   */
  validateTool(tool: OpenAITool): ToolValidationResult {
    return this.schemaValidator.validateTool(tool);
  }

  /**
   * Validate function definition
   */
  validateFunction(func: OpenAIFunction): ToolValidationResult {
    return this.schemaValidator.validateFunction(func);
  }

  /**
   * Validate function parameters
   */
  validateParameters(parameters: Record<string, any>): ToolValidationResult {
    return this.schemaValidator.validateParameters(parameters);
  }

  /**
   * Validate tools array
   */
  validateToolArray(tools: OpenAITool[]): ToolArrayValidationResult {
    return this.arrayValidator.validateToolArray(tools);
  }

  /**
   * Validate tool choice
   */
  validateToolChoice(toolChoice: OpenAIToolChoice, tools: OpenAITool[]): ToolValidationResult {
    return this.arrayValidator.validateToolChoice(toolChoice, tools);
  }

  /**
   * Validate complete tools request
   */
  validateToolsRequest(tools: OpenAITool[], toolChoice?: OpenAIToolChoice): ToolArrayValidationResult {
    try {
      const requestData = { tools, tool_choice: toolChoice };
      const result = ToolsRequestSchema.safeParse(requestData);
      
      if (result.success) {
        return { valid: true, errors: [], validTools: result.data.tools };
      }
      
      const errors = ValidationUtils.extractErrorMessages(result);
      
      // Extract valid tools for partial validation
      const validTools = tools.filter(tool => {
        const toolResult = OpenAIToolSchema.safeParse(tool);
        return toolResult.success;
      });
      
      return { valid: false, errors, validTools };
      
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error'],
        validTools: []
      };
    }
  }

  /**
   * Validate with performance timeout
   */
  async validateWithTimeout(
    tools: OpenAITool[],
    toolChoice?: OpenAIToolChoice,
    timeoutMs: number = TOOL_VALIDATION_LIMITS.VALIDATION_TIMEOUT_MS
  ): Promise<ToolArrayValidationResult> {
    try {
      const requestData = { tools, tool_choice: toolChoice };
      const result = await ValidationUtils.validateWithTimeout(
        ToolsRequestSchema,
        requestData,
        timeoutMs
      );
      
      if (result.success) {
        return { valid: true, errors: [], validTools: result.data.tools };
      }
      
      const errors = ValidationUtils.extractErrorMessages(result);
      
      // Extract valid tools for partial validation
      const validTools = tools.filter(tool => {
        const toolResult = OpenAIToolSchema.safeParse(tool);
        return toolResult.success;
      });
      
      return { valid: false, errors, validTools };
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        return {
          valid: false,
          errors: [TOOL_VALIDATION_MESSAGES.VALIDATION_TIMEOUT],
          validTools: []
        };
      }
      
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error'],
        validTools: []
      };
    }
  }

  /**
   * Enhanced validation with framework (Phase 12A)
   * Provides complete validation including runtime parameter validation
   */
  async validateWithFramework(
    tool: OpenAITool,
    parameters: Record<string, any>,
    context?: RuntimeValidationContext
  ): Promise<ValidationFrameworkResult> {
    if (!this.validationFramework) {
      // Fallback to basic validation
      const basicResult = this.validateTool(tool);
      return {
        valid: basicResult.valid,
        errors: basicResult.errors.map(error => ({
          field: 'tool',
          code: 'VALIDATION_FAILED',
          message: error,
          severity: 'error' as const
        })),
        validationTimeMs: 0,
        performanceMetrics: {
          validationTimeMs: 0,
          schemaValidationTimeMs: 0,
          runtimeValidationTimeMs: 0,
          customRulesTimeMs: 0,
          cacheTimeMs: 0,
          memoryUsageBytes: 0
        }
      };
    }

    return this.validationFramework.validateComplete(tool, parameters, context);
  }

  /**
   * Enhanced tools validation with framework
   */
  async validateToolsWithFramework(tools: OpenAITool[]): Promise<ValidationFrameworkResult[]> {
    if (!this.validationFramework) {
      // Fallback to basic validation
      return tools.map(tool => {
        const basicResult = this.validateTool(tool);
        return {
          valid: basicResult.valid,
          errors: basicResult.errors.map(error => ({
            field: 'tool',
            code: 'VALIDATION_FAILED',
            message: error,
            severity: 'error' as const
          })),
          validationTimeMs: 0,
          performanceMetrics: {
            validationTimeMs: 0,
            schemaValidationTimeMs: 0,
            runtimeValidationTimeMs: 0,
            customRulesTimeMs: 0,
            cacheTimeMs: 0,
            memoryUsageBytes: 0
          }
        };
      });
    }

    return this.validationFramework.validateTools(tools);
  }

  /**
   * Enhanced tools with choice validation using framework
   */
  async validateToolsRequestWithFramework(
    tools: OpenAITool[],
    toolChoice?: OpenAIToolChoice
  ): Promise<ValidationFrameworkResult> {
    if (!this.validationFramework) {
      // Fallback to basic validation
      const basicResult = this.validateToolsRequest(tools, toolChoice);
      return {
        valid: basicResult.valid,
        errors: basicResult.errors.map(error => ({
          field: 'tools',
          code: 'VALIDATION_FAILED',
          message: error,
          severity: 'error' as const
        })),
        validationTimeMs: 0,
        performanceMetrics: {
          validationTimeMs: 0,
          schemaValidationTimeMs: 0,
          runtimeValidationTimeMs: 0,
          customRulesTimeMs: 0,
          cacheTimeMs: 0,
          memoryUsageBytes: 0
        }
      };
    }

    return this.validationFramework.validateToolsWithChoice(tools, toolChoice);
  }

  /**
   * Set validation framework instance
   */
  setValidationFramework(framework: IValidationFramework): void {
    this.validationFramework = framework;
  }

  /**
   * Check if validation framework is available
   */
  hasValidationFramework(): boolean {
    return !!this.validationFramework;
  }
}

/**
 * Default tool validator instance
 */
export const toolValidator = new ToolValidator();