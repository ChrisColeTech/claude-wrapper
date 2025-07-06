/**
 * Tool Function Validation Framework (Phase 12A)
 * Single Responsibility: Validation orchestration and coordination only
 * 
 * Provides comprehensive validation orchestration with performance optimization
 * Following SOLID principles and <2ms performance requirement
 */

import {
  OpenAITool,
  OpenAIToolChoice,
  IValidationFramework,
  ISchemaValidator,
  IRuntimeValidator,
  ValidationFrameworkResult,
  ValidationFrameworkConfig,
  ValidationPerformanceMetrics,
  RuntimeValidationContext,
  ValidationFieldError
} from './types';
import {
  VALIDATION_FRAMEWORK_LIMITS,
  VALIDATION_FRAMEWORK_MESSAGES,
  VALIDATION_FRAMEWORK_ERRORS
} from './constants';
import { getLogger } from '../utils/logger';

const logger = getLogger('ValidationFramework');

/**
 * Validation framework error class
 */
export class ValidationFrameworkError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly validationTimeMs?: number,
    public readonly field?: string
  ) {
    super(message);
    this.name = 'ValidationFrameworkError';
  }
}

/**
 * Default validation framework configuration
 */
const DEFAULT_CONFIG: ValidationFrameworkConfig = {
  enableCaching: true,
  cacheSize: VALIDATION_FRAMEWORK_LIMITS.VALIDATION_CACHE_SIZE,
  cacheTtlMs: VALIDATION_FRAMEWORK_LIMITS.VALIDATION_CACHE_TTL_MS,
  enableCustomRules: true,
  customRulesTimeout: VALIDATION_FRAMEWORK_LIMITS.CUSTOM_RULE_PRIORITY_MAX,
  enablePerformanceMetrics: true,
  strictMode: true,
  maxValidationTimeMs: VALIDATION_FRAMEWORK_LIMITS.VALIDATION_TIMEOUT_MS
};

/**
 * Validation Framework implementation
 * SRP: Orchestrates validation using schema and runtime validators
 * Performance: <2ms per validation operation
 * File size: <200 lines, methods <50 lines, max 5 parameters
 */
export class ValidationFramework implements IValidationFramework {
  private config: ValidationFrameworkConfig;
  private performanceMetrics: ValidationPerformanceMetrics = {
    validationTimeMs: 0,
    schemaValidationTimeMs: 0,
    runtimeValidationTimeMs: 0,
    customRulesTimeMs: 0,
    cacheTimeMs: 0,
    memoryUsageBytes: 0
  };

  constructor(
    private schemaValidator: ISchemaValidator,
    private runtimeValidator: IRuntimeValidator,
    config?: Partial<ValidationFrameworkConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.resetMetrics();
  }

  /**
   * Validate tool and parameters completely
   * @param tool OpenAI tool definition
   * @param parameters Runtime parameters
   * @param context Optional runtime validation context
   * @returns Complete validation result
   */
  async validateComplete(
    tool: OpenAITool,
    parameters: Record<string, any>,
    context?: RuntimeValidationContext
  ): Promise<ValidationFrameworkResult> {
    const startTime = performance.now();

    try {
      // Input validation
      if (!tool || !parameters) {
        return this.createErrorResult(
          VALIDATION_FRAMEWORK_MESSAGES.VALIDATION_INPUT_REQUIRED,
          VALIDATION_FRAMEWORK_ERRORS.VALIDATION_FAILED,
          performance.now() - startTime
        );
      }

      // Schema validation
      const schemaStartTime = performance.now();
      const schemaResult = await this.schemaValidator.validateToolSchema(tool);
      const schemaTime = performance.now() - schemaStartTime;

      if (!schemaResult.valid) {
        return this.createValidationResult(
          false,
          schemaResult.errors,
          performance.now() - startTime,
          { schemaValidationTimeMs: schemaTime }
        );
      }

      // Runtime validation
      const runtimeStartTime = performance.now();
      const runtimeContext: RuntimeValidationContext = {
        tool,
        parameters,
        ...context
      };
      const runtimeResult = await this.runtimeValidator.validateRuntimeParameters(runtimeContext);
      const runtimeTime = performance.now() - runtimeStartTime;

      const totalTime = performance.now() - startTime;

      // Check performance requirement (<2ms)
      if (totalTime > this.config.maxValidationTimeMs) {
        logger.warn('Validation exceeded performance requirement', {
          validationTimeMs: totalTime,
          maxAllowed: this.config.maxValidationTimeMs,
          toolName: tool.function.name
        });
      }

      // Update metrics
      this.updatePerformanceMetrics(totalTime, schemaTime, runtimeTime);

      // Combine results
      return this.combineValidationResults(
        schemaResult,
        runtimeResult,
        totalTime,
        { schemaValidationTimeMs: schemaTime, runtimeValidationTimeMs: runtimeTime }
      );

    } catch (error) {
      const totalTime = performance.now() - startTime;
      logger.error('Validation framework error', {
        error: error instanceof Error ? error.message : String(error),
        validationTimeMs: totalTime,
        toolName: tool?.function?.name
      });

      return this.createErrorResult(
        VALIDATION_FRAMEWORK_MESSAGES.VALIDATION_FRAMEWORK_ERROR,
        VALIDATION_FRAMEWORK_ERRORS.FRAMEWORK_ERROR,
        totalTime
      );
    }
  }

  /**
   * Validate array of tools
   * @param tools Array of OpenAI tools
   * @returns Array of validation results
   */
  async validateTools(tools: OpenAITool[]): Promise<ValidationFrameworkResult[]> {
    if (!Array.isArray(tools) || tools.length === 0) {
      return [this.createErrorResult(
        VALIDATION_FRAMEWORK_MESSAGES.TOOLS_ARRAY_REQUIRED,
        VALIDATION_FRAMEWORK_ERRORS.VALIDATION_FAILED,
        0
      )];
    }

    // Validate tools in parallel for performance
    const validationPromises = tools.map(async (tool, index) => {
      try {
        return await this.schemaValidator.validateToolSchema(tool);
      } catch (error) {
        return this.createErrorResult(
          `Tool ${index}: ${error instanceof Error ? error.message : String(error)}`,
          VALIDATION_FRAMEWORK_ERRORS.VALIDATION_FAILED,
          0
        );
      }
    });

    return Promise.all(validationPromises);
  }

  /**
   * Validate tools with tool choice
   * @param tools Array of OpenAI tools
   * @param toolChoice Optional tool choice constraint
   * @returns Combined validation result
   */
  async validateToolsWithChoice(
    tools: OpenAITool[],
    toolChoice?: OpenAIToolChoice
  ): Promise<ValidationFrameworkResult> {
    const startTime = performance.now();

    try {
      // Validate tools first
      const toolResults = await this.validateTools(tools);
      
      // Check if any tool validation failed
      const failedTools = toolResults.filter(result => !result.valid);
      if (failedTools.length > 0) {
        const combinedErrors = failedTools.flatMap(result => result.errors);
        return this.createValidationResult(false, combinedErrors, performance.now() - startTime);
      }

      // Validate tool choice if provided
      if (toolChoice && typeof toolChoice === 'object' && toolChoice.function) {
        const chosenTool = tools.find(tool => tool.function.name === toolChoice.function.name);
        if (!chosenTool) {
          return this.createErrorResult(
            VALIDATION_FRAMEWORK_MESSAGES.TOOL_CHOICE_FUNCTION_NOT_FOUND,
            VALIDATION_FRAMEWORK_ERRORS.VALIDATION_FAILED,
            performance.now() - startTime
          );
        }
      }

      return this.createValidationResult(true, [], performance.now() - startTime);

    } catch (error) {
      return this.createErrorResult(
        VALIDATION_FRAMEWORK_MESSAGES.VALIDATION_FRAMEWORK_ERROR,
        VALIDATION_FRAMEWORK_ERRORS.FRAMEWORK_ERROR,
        performance.now() - startTime
      );
    }
  }

  /**
   * Configure validation framework
   * @param config Partial configuration to update
   */
  configure(config: Partial<ValidationFrameworkConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug('Validation framework configured', { config: this.config });
  }

  /**
   * Get current configuration
   * @returns Current validation framework configuration
   */
  getConfiguration(): ValidationFrameworkConfig {
    return { ...this.config };
  }

  /**
   * Get validation performance metrics
   * @returns Current performance metrics
   */
  getValidationMetrics(): ValidationPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.performanceMetrics = {
      validationTimeMs: 0,
      schemaValidationTimeMs: 0,
      runtimeValidationTimeMs: 0,
      customRulesTimeMs: 0,
      cacheTimeMs: 0,
      memoryUsageBytes: 0
    };
  }

  /**
   * Create error validation result
   */
  private createErrorResult(
    message: string,
    code: string,
    validationTimeMs: number
  ): ValidationFrameworkResult {
    const error: ValidationFieldError = {
      field: 'framework',
      code,
      message,
      severity: 'error'
    };

    return {
      valid: false,
      errors: [error],
      validationTimeMs,
      performanceMetrics: this.performanceMetrics
    };
  }

  /**
   * Create validation result
   */
  private createValidationResult(
    valid: boolean,
    errors: ValidationFieldError[],
    validationTimeMs: number,
    additionalMetrics?: Partial<ValidationPerformanceMetrics>
  ): ValidationFrameworkResult {
    return {
      valid,
      errors,
      validationTimeMs,
      performanceMetrics: {
        ...this.performanceMetrics,
        validationTimeMs,
        ...additionalMetrics
      }
    };
  }

  /**
   * Combine schema and runtime validation results
   */
  private combineValidationResults(
    schemaResult: ValidationFrameworkResult,
    runtimeResult: ValidationFrameworkResult,
    totalTime: number,
    additionalMetrics: Partial<ValidationPerformanceMetrics>
  ): ValidationFrameworkResult {
    const combinedErrors = [...schemaResult.errors, ...runtimeResult.errors];
    const valid = schemaResult.valid && runtimeResult.valid;

    return {
      valid,
      errors: combinedErrors,
      warnings: [...(schemaResult.warnings || []), ...(runtimeResult.warnings || [])],
      validationTimeMs: totalTime,
      cacheHit: schemaResult.cacheHit || runtimeResult.cacheHit,
      performanceMetrics: {
        ...this.performanceMetrics,
        validationTimeMs: totalTime,
        ...schemaResult.performanceMetrics,
        ...runtimeResult.performanceMetrics,
        ...additionalMetrics
      }
    };
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(
    totalTime: number,
    schemaTime: number,
    runtimeTime: number
  ): void {
    this.performanceMetrics.validationTimeMs = totalTime;
    this.performanceMetrics.schemaValidationTimeMs = schemaTime;
    this.performanceMetrics.runtimeValidationTimeMs = runtimeTime;
    this.performanceMetrics.memoryUsageBytes = process.memoryUsage().heapUsed;
  }
}

/**
 * Create validation framework instance
 * Factory function for dependency injection
 */
export function createValidationFramework(
  schemaValidator: ISchemaValidator,
  runtimeValidator: IRuntimeValidator,
  config?: Partial<ValidationFrameworkConfig>
): IValidationFramework {
  return new ValidationFramework(schemaValidator, runtimeValidator, config);
}