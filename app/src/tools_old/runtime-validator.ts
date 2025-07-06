/**
 * Runtime Validator (Phase 12A)
 * Single Responsibility: Runtime parameter validation with custom rules
 * 
 * Provides runtime parameter validation with extensible custom rule engine
 * Following SOLID principles and <2ms performance requirement
 */

import {
  IRuntimeValidator,
  ValidationFrameworkResult,
  ValidationFieldError,
  ValidationPerformanceMetrics,
  RuntimeValidationContext,
  CustomValidationRule,
  ValidationContext,
  ValidationRuleResult
} from './types';
import {
  VALIDATION_FRAMEWORK_LIMITS,
  VALIDATION_FRAMEWORK_MESSAGES,
  VALIDATION_FRAMEWORK_ERRORS
} from './constants';
import { getLogger } from '../utils/logger';

const logger = getLogger('RuntimeValidator');

/**
 * Runtime validation error class
 */
export class RuntimeValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field: string,
    public readonly validationTimeMs?: number
  ) {
    super(message);
    this.name = 'RuntimeValidationError';
  }
}

/**
 * Runtime Validator implementation
 * SRP: Handles only runtime parameter validation and custom rule execution
 * Performance: <2ms per validation operation
 * File size: <200 lines, methods <50 lines, max 5 parameters
 */
export class RuntimeValidator implements IRuntimeValidator {
  private customRules: Map<string, CustomValidationRule> = new Map();
  private ruleExecutionMetrics: Map<string, number> = new Map();

  /**
   * Validate runtime parameters with custom rules
   * @param context Runtime validation context
   * @returns Validation result with performance metrics
   */
  async validateRuntimeParameters(context: RuntimeValidationContext): Promise<ValidationFrameworkResult> {
    const startTime = performance.now();

    try {
      // Input validation
      if (!context || !context.tool || !context.parameters) {
        return this.createErrorResult(
          VALIDATION_FRAMEWORK_MESSAGES.VALIDATION_CONTEXT_INVALID,
          VALIDATION_FRAMEWORK_ERRORS.VALIDATION_CONTEXT_ERROR,
          performance.now() - startTime
        );
      }

      const errors: ValidationFieldError[] = [];
      
      // Basic parameter type validation
      const typeErrors = await this.validateParameterTypes(context);
      errors.push(...typeErrors);

      // Required parameter validation
      const requiredErrors = await this.validateRequiredParameters(context);
      errors.push(...requiredErrors);

      // Custom rules validation (check both internal rules and context rules)
      let customRulesTime = 0;
      const hasInternalRules = this.customRules.size > 0;
      const hasContextRules = context.customRules && context.customRules.length > 0;
      
      if (hasInternalRules || hasContextRules) {
        const customStartTime = performance.now();
        const customErrors = await this.executeCustomRules(context);
        customRulesTime = performance.now() - customStartTime;
        errors.push(...customErrors);
      }

      const validationTime = performance.now() - startTime;

      // Check performance requirement (<2ms)
      if (validationTime > VALIDATION_FRAMEWORK_LIMITS.VALIDATION_TIMEOUT_MS) {
        logger.warn('Runtime validation exceeded performance requirement', {
          validationTimeMs: validationTime,
          maxAllowed: VALIDATION_FRAMEWORK_LIMITS.VALIDATION_TIMEOUT_MS,
          toolName: context.tool.function.name
        });
      }

      return this.createValidationResult(
        errors.length === 0,
        errors,
        validationTime,
        { runtimeValidationTimeMs: validationTime, customRulesTimeMs: customRulesTime }
      );

    } catch (error) {
      const validationTime = performance.now() - startTime;
      logger.error('Runtime validation error', {
        error: error instanceof Error ? error.message : String(error),
        validationTimeMs: validationTime,
        toolName: context.tool?.function?.name
      });

      return this.createErrorResult(
        VALIDATION_FRAMEWORK_MESSAGES.RUNTIME_VALIDATION_FAILED,
        VALIDATION_FRAMEWORK_ERRORS.RUNTIME_VALIDATION_ERROR,
        validationTime
      );
    }
  }

  /**
   * Add custom validation rule
   * @param rule Custom validation rule definition
   * @returns Success status
   */
  addCustomRule(rule: CustomValidationRule): boolean {
    try {
      // Validate rule definition
      if (!rule || !rule.name || !rule.validator || typeof rule.validator !== 'function') {
        logger.warn('Invalid custom rule definition', { ruleName: rule?.name });
        return false;
      }

      // Check rule count limit
      if (this.customRules.size >= VALIDATION_FRAMEWORK_LIMITS.CUSTOM_RULES_MAX_COUNT) {
        logger.warn('Custom rules limit exceeded', {
          current: this.customRules.size,
          max: VALIDATION_FRAMEWORK_LIMITS.CUSTOM_RULES_MAX_COUNT
        });
        return false;
      }

      // Validate priority
      if (rule.priority < 0 || rule.priority > VALIDATION_FRAMEWORK_LIMITS.CUSTOM_RULE_PRIORITY_MAX) {
        logger.warn('Invalid rule priority', { 
          ruleName: rule.name, 
          priority: rule.priority,
          max: VALIDATION_FRAMEWORK_LIMITS.CUSTOM_RULE_PRIORITY_MAX
        });
        return false;
      }

      // Store rule
      this.customRules.set(rule.name, rule);
      this.ruleExecutionMetrics.set(rule.name, 0);

      logger.debug('Custom rule added', {
        ruleName: rule.name,
        priority: rule.priority,
        enabled: rule.enabled
      });

      return true;

    } catch (error) {
      logger.error('Failed to add custom rule', {
        ruleName: rule?.name,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Remove custom validation rule
   * @param ruleName Name of rule to remove
   * @returns Success status
   */
  removeCustomRule(ruleName: string): boolean {
    try {
      const removed = this.customRules.delete(ruleName);
      this.ruleExecutionMetrics.delete(ruleName);

      if (removed) {
        logger.debug('Custom rule removed', { ruleName });
      }

      return removed;

    } catch (error) {
      logger.error('Failed to remove custom rule', {
        ruleName,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get all custom validation rules
   * @returns Array of custom rules
   */
  getCustomRules(): CustomValidationRule[] {
    return Array.from(this.customRules.values())
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Validate value with custom rules
   * @param value Value to validate
   * @param context Validation context
   * @returns Array of rule results
   */
  async validateWithCustomRules(value: any, context: ValidationContext): Promise<ValidationRuleResult[]> {
    const results: ValidationRuleResult[] = [];
    
    // Get enabled rules sorted by priority
    const enabledRules = Array.from(this.customRules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of enabledRules) {
      try {
        const startTime = performance.now();
        const result = await this.executeRule(rule, value, context);
        const executionTime = performance.now() - startTime;

        // Update metrics
        this.ruleExecutionMetrics.set(rule.name, 
          (this.ruleExecutionMetrics.get(rule.name) || 0) + executionTime);

        results.push({
          ...result,
          processingTimeMs: executionTime
        });

      } catch (error) {
        logger.error('Custom rule execution failed', {
          ruleName: rule.name,
          error: error instanceof Error ? error.message : String(error)
        });

        results.push({
          valid: false,
          error: this.createFieldError(
            context.parameterPath,
            VALIDATION_FRAMEWORK_ERRORS.CUSTOM_RULE_EXECUTION_ERROR,
            `Rule ${rule.name}: ${error instanceof Error ? error.message : String(error)}`
          )
        });
      }
    }

    return results;
  }

  /**
   * Validate parameter types against schema
   */
  private async validateParameterTypes(context: RuntimeValidationContext): Promise<ValidationFieldError[]> {
    const errors: ValidationFieldError[] = [];
    const { tool, parameters } = context;

    if (!tool.function.parameters) {
      return errors;
    }

    const schema = tool.function.parameters;

    // Validate required type structure
    if (schema.type === 'object' && schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const value = parameters[propName];
        
        if (value !== undefined) {
          const typeError = this.validatePropertyType(value, propSchema as any, `parameters.${propName}`);
          if (typeError) {
            errors.push(typeError);
          }
        }
      }
    }

    return errors;
  }

  /**
   * Validate required parameters
   */
  private async validateRequiredParameters(context: RuntimeValidationContext): Promise<ValidationFieldError[]> {
    const errors: ValidationFieldError[] = [];
    const { tool, parameters } = context;

    if (!tool.function.parameters?.required) {
      return errors;
    }

    for (const requiredParam of tool.function.parameters.required) {
      const value = parameters[requiredParam];
      
      if (!(requiredParam in parameters) || value === undefined || value === null) {
        errors.push(this.createFieldError(
          `parameters.${requiredParam}`,
          VALIDATION_FRAMEWORK_ERRORS.PARAMETER_VALIDATION_ERROR,
          VALIDATION_FRAMEWORK_MESSAGES.REQUIRED_PARAMETER_MISSING
        ));
      } else if (typeof value === 'string' && value.trim() === '') {
        // Check for empty strings in required fields
        errors.push(this.createFieldError(
          `parameters.${requiredParam}`,
          VALIDATION_FRAMEWORK_ERRORS.PARAMETER_VALIDATION_ERROR,
          `Required parameter '${requiredParam}' cannot be empty`
        ));
      }
    }

    return errors;
  }

  /**
   * Execute custom rules for context
   */
  private async executeCustomRules(context: RuntimeValidationContext): Promise<ValidationFieldError[]> {
    const errors: ValidationFieldError[] = [];
    const { tool, parameters } = context;

    const validationContext: ValidationContext = {
      toolName: tool.function.name,
      parameterPath: 'parameters',
      fullParameters: parameters,
      requestMetadata: {
        requestId: context.requestId,
        sessionId: context.sessionId
      }
    };

    const ruleResults = await this.validateWithCustomRules(parameters, validationContext);
    
    for (const result of ruleResults) {
      if (!result.valid && result.error) {
        errors.push(result.error);
      }
    }

    return errors;
  }

  /**
   * Execute single custom rule
   */
  private async executeRule(
    rule: CustomValidationRule,
    value: any,
    context: ValidationContext
  ): Promise<ValidationRuleResult> {
    if (rule.async) {
      return await Promise.resolve(rule.validator(value, context));
    } else {
      return rule.validator(value, context);
    }
  }

  /**
   * Validate property type against schema
   */
  private validatePropertyType(value: any, schema: any, path: string): ValidationFieldError | null {
    if (!schema.type) return null;

    let actualType = Array.isArray(value) ? 'array' : typeof value;
    
    // Handle integer type - JSON Schema distinguishes integer from number
    if (schema.type === 'integer' && typeof value === 'number' && Number.isInteger(value)) {
      actualType = 'integer';
    }
    
    // Check basic type compatibility
    if (schema.type !== actualType) {
      return this.createFieldError(
        path,
        VALIDATION_FRAMEWORK_ERRORS.PARAMETER_VALIDATION_ERROR,
        VALIDATION_FRAMEWORK_MESSAGES.PARAMETER_TYPE_MISMATCH
      );
    }

    // Validate schema constraints based on type
    if (schema.type === 'string') {
      // Check string constraints
      if (schema.enum && !schema.enum.includes(value)) {
        return this.createFieldError(
          path,
          VALIDATION_FRAMEWORK_ERRORS.PARAMETER_VALIDATION_ERROR,
          `Value '${value}' is not in allowed enum values: [${schema.enum.join(', ')}]`
        );
      }
      
      // Check empty string (basic validation - could be enhanced with minLength)
      if (value === '' && schema.minLength !== undefined && schema.minLength > 0) {
        return this.createFieldError(
          path,
          VALIDATION_FRAMEWORK_ERRORS.PARAMETER_VALIDATION_ERROR,
          `String cannot be empty (minimum length: ${schema.minLength})`
        );
      }
    }
    
    if (schema.type === 'number' || schema.type === 'integer') {
      // Check numeric constraints
      if (schema.minimum !== undefined && value < schema.minimum) {
        return this.createFieldError(
          path,
          VALIDATION_FRAMEWORK_ERRORS.PARAMETER_VALIDATION_ERROR,
          `Value ${value} is below minimum: ${schema.minimum}`
        );
      }
      
      if (schema.maximum !== undefined && value > schema.maximum) {
        return this.createFieldError(
          path,
          VALIDATION_FRAMEWORK_ERRORS.PARAMETER_VALIDATION_ERROR,
          `Value ${value} exceeds maximum: ${schema.maximum}`
        );
      }
    }

    return null;
  }

  /**
   * Create validation field error
   */
  private createFieldError(field: string, code: string, message: string): ValidationFieldError {
    return {
      field,
      code,
      message,
      severity: 'error'
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
      field: 'runtime',
      code,
      message,
      severity: 'error'
    };

    return {
      valid: false,
      errors: [error],
      validationTimeMs,
      performanceMetrics: {
        validationTimeMs,
        schemaValidationTimeMs: 0,
        runtimeValidationTimeMs: validationTimeMs,
        customRulesTimeMs: 0,
        cacheTimeMs: 0,
        memoryUsageBytes: process.memoryUsage().heapUsed
      }
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
        validationTimeMs,
        schemaValidationTimeMs: 0,
        runtimeValidationTimeMs: validationTimeMs,
        customRulesTimeMs: 0,
        cacheTimeMs: 0,
        memoryUsageBytes: process.memoryUsage().heapUsed,
        ...additionalMetrics
      }
    };
  }
}

/**
 * Create runtime validator instance
 * Factory function for dependency injection
 */
export function createRuntimeValidator(): IRuntimeValidator {
  return new RuntimeValidator();
}