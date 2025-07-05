/**
 * Detailed Validation Error Handling System
 * Field-level validation error reporting matching Python implementation
 * 
 * Single Responsibility: Validation error processing and detailed reporting
 * Integrates with error classifier for comprehensive error handling
 */

import { createLogger } from '../utils/logger';
import { config } from '../utils/env';
import { ErrorClassification, errorClassifier } from './error-classifier';
import * as winston from 'winston';

/**
 * Field-level validation error details
 */
export interface FieldValidationError {
  field: string;
  path: string;
  value: any;
  message: string;
  code: string;
  constraint?: string;
  suggestion?: string;
}

/**
 * Validation context for error tracking
 */
export interface ValidationContext {
  requestId?: string;
  endpoint: string;
  method: string;
  requestBody?: any;
  timestamp: Date;
  userAgent?: string;
}

/**
 * Comprehensive validation error report
 */
export interface ValidationErrorReport {
  isValid: boolean;
  errors: FieldValidationError[];
  errorCount: number;
  classification: ErrorClassification;
  context: ValidationContext;
  suggestions: string[];
  debugInfo?: Record<string, any>;
  processingTime: number;
}

/**
 * Validation rule configuration
 */
export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean;
  message?: string;
}

/**
 * Validation schema for request validation
 */
export interface ValidationSchema {
  rules: ValidationRule[];
  description: string;
  examples?: Record<string, any>;
}

/**
 * Production-grade validation error handler
 * Follows SRP: handles only validation error processing and reporting
 */
export class ValidationHandler {
  private logger: winston.Logger;
  private schemas: Map<string, ValidationSchema> = new Map();
  private processingTimes: number[] = [];

  constructor() {
    this.logger = createLogger(config);
    this.registerDefaultSchemas();
  }

  /**
   * Validate request with detailed field-level error reporting
   * Performance requirement: <25ms processing time
   */
  async validateRequest(
    data: any,
    schemaName: string,
    context: Partial<ValidationContext>
  ): Promise<ValidationErrorReport> {
    const startTime = Date.now();
    
    try {
      this.logValidationStart(schemaName, context.requestId);
      
      const schema = this.getValidationSchema(schemaName);
      const validationContext = this.buildValidationContext(context);
      const errors = await this.processValidationRules(data, schema, validationContext);
      const classification = this.classifyValidationErrors(errors, schemaName, context.endpoint);
      
      const processingTime = Date.now() - startTime;
      this.updateProcessingStats(processingTime);
      
      const report = this.buildValidationReport(errors, classification, validationContext, schema, data, processingTime);
      
      this.logValidationCompletion(report, context.requestId);
      return report;

    } catch (error) {
      return this.handleValidationError(error, schemaName, context, Date.now() - startTime);
    }
  }

  /**
   * Register validation schema for specific endpoint or data type
   */
  registerSchema(name: string, schema: ValidationSchema): void {
    this.schemas.set(name, schema);
    this.logger.debug('Registered validation schema', { 
      name, 
      rules: schema.rules.length,
      description: schema.description 
    });
  }

  /**
   * Get validation performance statistics
   */
  getPerformanceStats(): {
    averageProcessingTime: number;
    maxProcessingTime: number;
    totalValidations: number;
    isOptimal: boolean;
  } {
    const maxTime = Math.max(...this.processingTimes, 0);
    const avgTime = this.processingTimes.length > 0 
      ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length 
      : 0;

    return {
      averageProcessingTime: avgTime,
      maxProcessingTime: maxTime,
      totalValidations: this.processingTimes.length,
      isOptimal: avgTime < 25 // <25ms requirement
    };
  }

  /**
   * Create detailed validation error response matching Python format
   */
  createValidationErrorResponse(report: ValidationErrorReport): any {
    const response = {
      error: {
        type: 'validation_error',
        message: `Request validation failed with ${report.errorCount} error(s)`,
        code: report.classification.errorCode,
        details: {
          invalid_fields: report.errors.map(error => ({
            field: error.field,
            path: error.path,
            message: error.message,
            code: error.code,
            value: this.sanitizeValue(error.value),
            suggestion: error.suggestion
          })),
          suggestions: report.suggestions,
          field_count: report.errorCount
        },
        request_id: report.context.requestId,
        timestamp: report.context.timestamp.toISOString()
      }
    };

    // Add debug information if enabled
    if (config.DEBUG_MODE && report.debugInfo) {
      (response.error as any).debug_info = {
        endpoint: report.context.endpoint,
        method: report.context.method,
        processing_time_ms: report.processingTime,
        raw_request: this.sanitizeValue(report.debugInfo.requestBody)
      };
    }

    return response;
  }

  /**
   * Validate individual field against rule
   */
  private async validateField(
    data: any,
    rule: ValidationRule,
    context: ValidationContext
  ): Promise<FieldValidationError[]> {
    const errors: FieldValidationError[] = [];
    const value = this.getFieldValue(data, rule.field);
    const path = rule.field;

    // Check required field first
    const requiredError = this.validateRequiredField(rule, value, path);
    if (requiredError) {
      return [requiredError]; // Skip other validations if required field is missing
    }

    // Skip validation if field is not present and not required
    if (value === undefined || value === null) {
      return errors;
    }

    // Apply all validation rules
    const validationErrors = this.applyFieldValidationRules(rule, value, path);
    errors.push(...validationErrors);

    return errors;
  }

  /**
   * Get field value from nested object using dot notation
   */
  private getFieldValue(data: any, fieldPath: string): any {
    const parts = fieldPath.split('.');
    let value = data;
    
    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      
      // Handle array indices
      if (/^\[\d+\]$/.test(part)) {
        const index = parseInt(part.slice(1, -1), 10);
        value = Array.isArray(value) ? value[index] : undefined;
      } else {
        value = value[part];
      }
    }
    
    return value;
  }

  /**
   * Validate value type
   */
  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType.toLowerCase()) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true; // Unknown type, allow any
    }
  }

  /**
   * Generate helpful suggestions based on validation errors
   */
  private generateSuggestions(errors: FieldValidationError[], schema: ValidationSchema): string[] {
    const suggestions: string[] = [];
    
    if (errors.length === 0) {
      return ['Request is valid'];
    }

    const requiredErrors = errors.filter(e => e.code === 'REQUIRED_FIELD_MISSING');
    if (requiredErrors.length > 0) {
      suggestions.push(`Required fields missing: ${requiredErrors.map(e => e.field).join(', ')}`);
    }

    const typeErrors = errors.filter(e => e.code === 'INVALID_TYPE');
    if (typeErrors.length > 0) {
      suggestions.push('Check data types for all fields');
    }

    const formatErrors = errors.filter(e => e.code === 'INVALID_FORMAT');
    if (formatErrors.length > 0) {
      suggestions.push('Verify field formats match expected patterns');
    }

    // Add schema examples if available
    if (schema.examples && Object.keys(schema.examples).length > 0) {
      suggestions.push('Refer to API documentation for valid request examples');
    }

    return suggestions;
  }

  /**
   * Sanitize value for safe logging and response
   */
  private sanitizeValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Redact sensitive information
    const sensitivePatterns = [
      /api[_-]?key/i,
      /password/i,
      /token/i,
      /secret/i,
      /auth/i
    ];

    if (typeof value === 'string') {
      for (const pattern of sensitivePatterns) {
        if (pattern.test(value)) {
          return '[REDACTED]';
        }
      }
      
      // Truncate long strings
      return value.length > 100 ? value.substring(0, 100) + '...' : value;
    }

    if (typeof value === 'object') {
      const sanitized: any = Array.isArray(value) ? [] : {};
      
      for (const [key, val] of Object.entries(value)) {
        const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));
        sanitized[key] = isSensitive ? '[REDACTED]' : this.sanitizeValue(val);
      }
      
      return sanitized;
    }

    return value;
  }

  /**
   * Create error report for validation failures
   */
  private createErrorReport(
    error: any,
    context: Partial<ValidationContext>,
    processingTime: number
  ): ValidationErrorReport {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      isValid: false,
      errors: [{
        field: 'validation_system',
        path: 'system',
        value: null,
        message: `Validation system error: ${errorMessage}`,
        code: 'VALIDATION_SYSTEM_ERROR',
        suggestion: 'Contact support if error persists'
      }],
      errorCount: 1,
      classification: errorClassifier.classifyError(
        error instanceof Error ? error : new Error(errorMessage)
      ),
      context: {
        endpoint: 'unknown',
        method: 'POST',
        timestamp: new Date(),
        ...context
      },
      suggestions: ['Contact support for validation system issues'],
      processingTime
    };
  }

  /**
   * Update processing time statistics
   */
  private updateProcessingStats(processingTime: number): void {
    this.processingTimes.push(processingTime);
    
    // Keep last 1000 measurements for performance
    if (this.processingTimes.length > 1000) {
      this.processingTimes.shift();
    }
  }

  /**
   * Log validation start
   */
  private logValidationStart(schemaName: string, requestId?: string): void {
    this.logger.debug('Starting validation', { 
      schema: schemaName,
      requestId 
    });
  }

  /**
   * Get validation schema by name
   */
  private getValidationSchema(schemaName: string): ValidationSchema {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      throw new Error(`Validation schema '${schemaName}' not found`);
    }
    return schema;
  }

  /**
   * Build validation context
   */
  private buildValidationContext(context: Partial<ValidationContext>): ValidationContext {
    return {
      endpoint: 'unknown',
      method: 'POST',
      timestamp: new Date(),
      ...context
    };
  }

  /**
   * Process all validation rules for a schema
   */
  private async processValidationRules(
    data: any,
    schema: ValidationSchema,
    context: ValidationContext
  ): Promise<FieldValidationError[]> {
    const errors: FieldValidationError[] = [];
    
    for (const rule of schema.rules) {
      const fieldErrors = await this.validateField(data, rule, context);
      errors.push(...fieldErrors);
    }
    
    return errors;
  }

  /**
   * Classify validation errors
   */
  private classifyValidationErrors(
    errors: FieldValidationError[],
    schemaName: string,
    endpoint?: string
  ): ErrorClassification {
    const validationError = new Error(`Validation failed: ${errors.length} field errors`);
    return errorClassifier.classifyError(validationError, {
      fieldCount: errors.length,
      schema: schemaName,
      endpoint
    });
  }

  /**
   * Build validation report
   */
  private buildValidationReport(
    errors: FieldValidationError[],
    classification: ErrorClassification,
    context: ValidationContext,
    schema: ValidationSchema,
    data: any,
    processingTime: number
  ): ValidationErrorReport {
    return {
      isValid: errors.length === 0,
      errors,
      errorCount: errors.length,
      classification,
      context,
      suggestions: this.generateSuggestions(errors, schema),
      processingTime,
      debugInfo: config.DEBUG_MODE ? {
        requestBody: data,
        schema: schema.description,
        processingTime
      } : undefined
    };
  }

  /**
   * Log validation completion
   */
  private logValidationCompletion(report: ValidationErrorReport, requestId?: string): void {
    this.logger.debug('Validation completed', {
      isValid: report.isValid,
      errorCount: report.errorCount,
      processingTime: report.processingTime,
      requestId
    });
  }

  /**
   * Handle validation error
   */
  private handleValidationError(
    error: any,
    schemaName: string,
    context: Partial<ValidationContext>,
    processingTime: number
  ): ValidationErrorReport {
    this.logger.error('Validation processing failed', {
      error: error instanceof Error ? error.message : String(error),
      schema: schemaName,
      processingTime,
      requestId: context.requestId
    });

    return this.createErrorReport(error, context, processingTime);
  }

  /**
   * Validate required field
   */
  private validateRequiredField(
    rule: ValidationRule,
    value: any,
    path: string
  ): FieldValidationError | null {
    if (rule.required && (value === undefined || value === null || value === '')) {
      return {
        field: rule.field,
        path,
        value,
        message: rule.message || `Field '${rule.field}' is required`,
        code: 'REQUIRED_FIELD_MISSING',
        suggestion: `Provide a value for '${rule.field}'`
      };
    }
    return null;
  }

  /**
   * Apply all field validation rules
   */
  private applyFieldValidationRules(
    rule: ValidationRule,
    value: any,
    path: string
  ): FieldValidationError[] {
    const errors: FieldValidationError[] = [];

    // Type validation
    const typeError = this.validateFieldType(rule, value, path);
    if (typeError) errors.push(typeError);

    // String length validation
    if (typeof value === 'string') {
      errors.push(...this.validateStringLength(rule, value, path));
    }

    // Pattern validation
    const patternError = this.validateFieldPattern(rule, value, path);
    if (patternError) errors.push(patternError);

    // Enum validation
    const enumError = this.validateFieldEnum(rule, value, path);
    if (enumError) errors.push(enumError);

    // Custom validation
    const customError = this.validateFieldCustom(rule, value, path);
    if (customError) errors.push(customError);

    return errors;
  }

  /**
   * Validate field type
   */
  private validateFieldType(
    rule: ValidationRule,
    value: any,
    path: string
  ): FieldValidationError | null {
    if (rule.type && !this.validateType(value, rule.type)) {
      return {
        field: rule.field,
        path,
        value,
        message: `Field '${rule.field}' must be of type ${rule.type}`,
        code: 'INVALID_TYPE',
        suggestion: `Convert '${rule.field}' to ${rule.type}`
      };
    }
    return null;
  }

  /**
   * Validate string length constraints
   */
  private validateStringLength(
    rule: ValidationRule,
    value: string,
    path: string
  ): FieldValidationError[] {
    const errors: FieldValidationError[] = [];

    if (rule.minLength && value.length < rule.minLength) {
      errors.push({
        field: rule.field,
        path,
        value,
        message: `Field '${rule.field}' must be at least ${rule.minLength} characters`,
        code: 'TOO_SHORT',
        constraint: `min_length: ${rule.minLength}`,
        suggestion: `Increase length of '${rule.field}' to at least ${rule.minLength} characters`
      });
    }

    if (rule.maxLength && value.length > rule.maxLength) {
      errors.push({
        field: rule.field,
        path,
        value,
        message: `Field '${rule.field}' must be at most ${rule.maxLength} characters`,
        code: 'TOO_LONG',
        constraint: `max_length: ${rule.maxLength}`,
        suggestion: `Reduce length of '${rule.field}' to at most ${rule.maxLength} characters`
      });
    }

    return errors;
  }

  /**
   * Validate field pattern
   */
  private validateFieldPattern(
    rule: ValidationRule,
    value: any,
    path: string
  ): FieldValidationError | null {
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      return {
        field: rule.field,
        path,
        value,
        message: `Field '${rule.field}' format is invalid`,
        code: 'INVALID_FORMAT',
        constraint: `pattern: ${rule.pattern.source}`,
        suggestion: `Ensure '${rule.field}' matches the required format`
      };
    }
    return null;
  }

  /**
   * Validate field enum constraint
   */
  private validateFieldEnum(
    rule: ValidationRule,
    value: any,
    path: string
  ): FieldValidationError | null {
    if (rule.enum && !rule.enum.includes(value)) {
      return {
        field: rule.field,
        path,
        value,
        message: `Field '${rule.field}' must be one of: ${rule.enum.join(', ')}`,
        code: 'INVALID_ENUM_VALUE',
        constraint: `allowed_values: [${rule.enum.join(', ')}]`,
        suggestion: `Choose a valid value for '${rule.field}' from the allowed list`
      };
    }
    return null;
  }

  /**
   * Validate field custom constraint
   */
  private validateFieldCustom(
    rule: ValidationRule,
    value: any,
    path: string
  ): FieldValidationError | null {
    if (rule.custom && !rule.custom(value)) {
      return {
        field: rule.field,
        path,
        value,
        message: rule.message || `Field '${rule.field}' failed custom validation`,
        code: 'CUSTOM_VALIDATION_FAILED',
        suggestion: `Review the requirements for '${rule.field}'`
      };
    }
    return null;
  }

  /**
   * Register chat completion validation schema
   */
  private registerChatCompletionSchema(): void {
    this.registerSchema('chat_completion', {
      description: 'OpenAI Chat Completion API request validation',
      rules: [
        {
          field: 'model',
          required: true,
          type: 'string',
          message: 'Model parameter is required'
        },
        {
          field: 'messages',
          required: true,
          type: 'array',
          message: 'Messages array is required'
        },
        {
          field: 'temperature',
          type: 'number',
          custom: (value) => value >= 0 && value <= 2,
          message: 'Temperature must be between 0 and 2'
        },
        {
          field: 'max_tokens',
          type: 'number',
          custom: (value) => value > 0,
          message: 'Max tokens must be positive'
        }
      ],
      examples: {
        basic: {
          model: 'claude-3-sonnet-20240229',
          messages: [{ role: 'user', content: 'Hello' }]
        }
      }
    });
  }

  /**
   * Register session validation schema
   */
  private registerSessionSchema(): void {
    this.registerSchema('session', {
      description: 'Session management request validation',
      rules: [
        {
          field: 'session_id',
          type: 'string',
          pattern: /^[a-zA-Z0-9_-]+$/,
          message: 'Session ID must contain only alphanumeric characters, hyphens, and underscores'
        },
        {
          field: 'title',
          type: 'string',
          maxLength: 200,
          message: 'Session title must be 200 characters or less'
        }
      ]
    });
  }

  /**
   * Register default validation schemas
   */
  private registerDefaultSchemas(): void {
    this.registerChatCompletionSchema();
    this.registerSessionSchema();
  }
}

// Production-ready singleton instance
export const validationHandler = new ValidationHandler();

// Export utilities for easy access
export const validateRequest = (data: any, schema: string, context: Partial<ValidationContext>) =>
  validationHandler.validateRequest(data, schema, context);
export const createValidationResponse = (report: ValidationErrorReport) =>
  validationHandler.createValidationErrorResponse(report);
export const getValidationStats = () => validationHandler.getPerformanceStats();