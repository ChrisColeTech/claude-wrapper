/**
 * Compact Validation Error Handling System
 * Field-level validation error reporting matching Python implementation
 * 
 * Single Responsibility: Validation error processing and detailed reporting
 * Integrates with error classifier for comprehensive error handling
 */

import { createLogger } from '../utils/logger';
import { config } from '../utils/env';
import { ErrorClassification, getErrorClassifier } from './error-classifier';
import { getDefaultSchemas } from './validation-schemas';
import { 
  getFieldValue, 
  validateRequiredField, 
  applyFieldValidationRules 
} from './validation-helpers';
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
   */
  async validateRequest(
    data: any,
    schemaName: string,
    context: Partial<ValidationContext>
  ): Promise<ValidationErrorReport> {
    const startTime = Date.now();
    
    try {
      const schema = this.getValidationSchema(schemaName);
      const validationContext = this.buildValidationContext(context);
      const errors = await this.processValidationRules(data, schema, validationContext);
      const classification = this.classifyValidationErrors(errors, schemaName, context.endpoint);
      
      const processingTime = Date.now() - startTime;
      this.updateProcessingStats(processingTime);
      
      return this.buildValidationReport(errors, classification, validationContext, schema, data, processingTime);

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
    const value = getFieldValue(data, rule.field);
    const path = rule.field;

    // Check required field first
    const requiredError = validateRequiredField(rule, value, path);
    if (requiredError) {
      return [requiredError]; // Skip other validations if required field is missing
    }

    // Skip validation if field is not present and not required
    if (value === undefined || value === null) {
      return errors;
    }

    // Apply all validation rules
    const validationErrors = applyFieldValidationRules(rule, value, path);
    errors.push(...validationErrors);

    return errors;
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

  private createErrorReport(error: any, context: Partial<ValidationContext>, processingTime: number): ValidationErrorReport {
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
      classification: getErrorClassifier().classifyError(
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

  private updateProcessingStats(processingTime: number): void {
    this.processingTimes.push(processingTime);
    
    // Keep last 1000 measurements for performance
    if (this.processingTimes.length > 1000) {
      this.processingTimes.shift();
    }
  }

  private getValidationSchema(schemaName: string): ValidationSchema {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      throw new Error(`Validation schema '${schemaName}' not found`);
    }
    return schema;
  }

  private buildValidationContext(context: Partial<ValidationContext>): ValidationContext {
    return {
      endpoint: 'unknown',
      method: 'POST',
      timestamp: new Date(),
      ...context
    };
  }

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

  private classifyValidationErrors(
    errors: FieldValidationError[],
    schemaName: string,
    endpoint?: string
  ): ErrorClassification {
    const validationError = new Error(`Validation failed: ${errors.length} field errors`);
    return getErrorClassifier().classifyError(validationError, {
      fieldCount: errors.length,
      schema: schemaName,
      endpoint
    });
  }

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
   * Register default validation schemas
   */
  private registerDefaultSchemas(): void {
    const schemas = getDefaultSchemas();
    Object.entries(schemas).forEach(([name, schema]) => {
      this.registerSchema(name, schema);
    });
  }
}

// Lazy singleton instance - only created when needed
let _validationHandler: ValidationHandler | null = null;

export function getValidationHandler(): ValidationHandler {
  if (!_validationHandler) {
    _validationHandler = new ValidationHandler();
  }
  return _validationHandler;
}

// For testing - allows resetting the singleton
export function resetValidationHandler(): void {
  _validationHandler = null;
}

// Export utilities for easy access
export const validateRequest = (data: any, schema: string, context: Partial<ValidationContext>) =>
  getValidationHandler().validateRequest(data, schema, context);
export const createValidationResponse = (report: ValidationErrorReport) =>
  getValidationHandler().createValidationErrorResponse(report);
export const getValidationStats = () => getValidationHandler().getPerformanceStats();