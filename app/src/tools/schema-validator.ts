/**
 * Enhanced Schema Validator (Phase 12A)
 * Single Responsibility: Schema validation with caching and performance optimization
 * 
 * Provides high-performance schema validation with intelligent caching
 * Following SOLID principles and <2ms performance requirement
 */

import {
  OpenAITool,
  OpenAIFunction,
  ISchemaValidator,
  ValidationFrameworkResult,
  ValidationFieldError,
  ValidationPerformanceMetrics,
  SchemaValidationCacheEntry
} from './types';
import {
  VALIDATION_FRAMEWORK_LIMITS,
  VALIDATION_FRAMEWORK_MESSAGES,
  VALIDATION_FRAMEWORK_ERRORS,
  TOOL_VALIDATION_PATTERNS,
  TOOL_VALIDATION_MESSAGES,
  SUPPORTED_JSON_SCHEMA_TYPES
} from './constants';
import { getLogger } from '../utils/logger';
import { createHash } from 'crypto';

const logger = getLogger('SchemaValidator');

/**
 * Schema validation error class
 */
export class SchemaValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field: string,
    public readonly validationTimeMs?: number
  ) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

/**
 * Enhanced Schema Validator implementation
 * SRP: Handles only schema validation with caching optimization
 * Performance: <2ms per validation operation with caching
 * File size: <200 lines, methods <50 lines, max 5 parameters
 */
export class SchemaValidator implements ISchemaValidator {
  private cache: Map<string, SchemaValidationCacheEntry> = new Map();
  private cacheHits = 0;
  private cacheMisses = 0;

  /**
   * Validate OpenAI tool schema
   * @param tool OpenAI tool definition
   * @returns Validation result with performance metrics
   */
  async validateToolSchema(tool: OpenAITool): Promise<ValidationFrameworkResult> {
    const startTime = performance.now();

    try {
      // Generate cache key
      const cacheKey = this.generateSchemaHash(tool);
      
      // Try cache first
      const cachedResult = await this.getCachedResult(cacheKey);
      if (cachedResult) {
        return {
          ...cachedResult,
          validationTimeMs: performance.now() - startTime,
          cacheHit: true
        };
      }

      // Validate tool structure
      const errors: ValidationFieldError[] = [];

      // Validate tool type
      if (!tool || typeof tool !== 'object') {
        errors.push(this.createFieldError(
          'tool',
          VALIDATION_FRAMEWORK_ERRORS.SCHEMA_INVALID,
          VALIDATION_FRAMEWORK_MESSAGES.TOOL_OBJECT_REQUIRED
        ));
      } else {
        if (tool.type !== 'function') {
          errors.push(this.createFieldError(
            'tool.type',
            VALIDATION_FRAMEWORK_ERRORS.SCHEMA_INVALID,
            TOOL_VALIDATION_MESSAGES.TOOL_TYPE_INVALID
          ));
        }

        // Validate function definition
        if (!tool.function) {
          errors.push(this.createFieldError(
            'tool.function',
            VALIDATION_FRAMEWORK_ERRORS.SCHEMA_INVALID,
            TOOL_VALIDATION_MESSAGES.FUNCTION_REQUIRED
          ));
        } else {
          const functionErrors = await this.validateFunctionSchema(tool.function);
          errors.push(...functionErrors.errors);
        }
      }

      const validationTime = performance.now() - startTime;
      const result = this.createValidationResult(errors.length === 0, errors, validationTime);

      // Cache result
      await this.cacheResult(cacheKey, result);

      return result;

    } catch (error) {
      const validationTime = performance.now() - startTime;
      logger.error('Schema validation error', {
        error: error instanceof Error ? error.message : String(error),
        validationTimeMs: validationTime
      });

      return this.createValidationResult(false, [
        this.createFieldError(
          'tool',
          VALIDATION_FRAMEWORK_ERRORS.VALIDATION_FAILED,
          VALIDATION_FRAMEWORK_MESSAGES.SCHEMA_VALIDATION_FAILED
        )
      ], validationTime);
    }
  }

  /**
   * Validate OpenAI function schema
   * @param func OpenAI function definition
   * @returns Validation result
   */
  async validateFunctionSchema(func: OpenAIFunction): Promise<ValidationFrameworkResult> {
    const startTime = performance.now();
    const errors: ValidationFieldError[] = [];

    try {
      // Validate function name
      if (!func.name || typeof func.name !== 'string') {
        errors.push(this.createFieldError(
          'function.name',
          VALIDATION_FRAMEWORK_ERRORS.SCHEMA_INVALID,
          TOOL_VALIDATION_MESSAGES.FUNCTION_NAME_REQUIRED
        ));
      } else {
        if (!TOOL_VALIDATION_PATTERNS.FUNCTION_NAME.test(func.name)) {
          errors.push(this.createFieldError(
            'function.name',
            VALIDATION_FRAMEWORK_ERRORS.SCHEMA_INVALID,
            TOOL_VALIDATION_MESSAGES.FUNCTION_NAME_INVALID
          ));
        }

        if (TOOL_VALIDATION_PATTERNS.RESERVED_NAMES.includes(func.name)) {
          errors.push(this.createFieldError(
            'function.name',
            VALIDATION_FRAMEWORK_ERRORS.SCHEMA_INVALID,
            TOOL_VALIDATION_MESSAGES.FUNCTION_NAME_RESERVED
          ));
        }
      }

      // Validate function description
      if (func.description && typeof func.description !== 'string') {
        errors.push(this.createFieldError(
          'function.description',
          VALIDATION_FRAMEWORK_ERRORS.SCHEMA_INVALID,
          VALIDATION_FRAMEWORK_MESSAGES.FUNCTION_DESCRIPTION_INVALID
        ));
      }

      // Validate parameters schema
      if (func.parameters) {
        const paramResult = await this.validateParametersSchema(func.parameters);
        errors.push(...paramResult.errors);
      }

      return this.createValidationResult(errors.length === 0, errors, performance.now() - startTime);

    } catch (error) {
      return this.createValidationResult(false, [
        this.createFieldError(
          'function',
          VALIDATION_FRAMEWORK_ERRORS.VALIDATION_FAILED,
          VALIDATION_FRAMEWORK_MESSAGES.FUNCTION_VALIDATION_FAILED
        )
      ], performance.now() - startTime);
    }
  }

  /**
   * Validate parameters JSON schema
   * @param parameters Parameters schema object
   * @returns Validation result
   */
  async validateParametersSchema(parameters: Record<string, any>): Promise<ValidationFrameworkResult> {
    const startTime = performance.now();
    const errors: ValidationFieldError[] = [];

    try {
      if (!parameters || typeof parameters !== 'object') {
        errors.push(this.createFieldError(
          'parameters',
          VALIDATION_FRAMEWORK_ERRORS.SCHEMA_INVALID,
          VALIDATION_FRAMEWORK_MESSAGES.PARAMETERS_INVALID
        ));
        return this.createValidationResult(false, errors, performance.now() - startTime);
      }

      // Validate schema depth
      const depth = this.calculateSchemaDepth(parameters);
      if (depth > VALIDATION_FRAMEWORK_LIMITS.PARAMETER_VALIDATION_MAX_DEPTH) {
        errors.push(this.createFieldError(
          'parameters',
          VALIDATION_FRAMEWORK_ERRORS.COMPLEXITY_EXCEEDED,
          VALIDATION_FRAMEWORK_MESSAGES.PARAMETERS_DEPTH_EXCEEDED
        ));
      }

      // Validate schema types
      this.validateSchemaTypes(parameters, 'parameters', errors);

      return this.createValidationResult(errors.length === 0, errors, performance.now() - startTime);

    } catch (error) {
      return this.createValidationResult(false, [
        this.createFieldError(
          'parameters',
          VALIDATION_FRAMEWORK_ERRORS.VALIDATION_FAILED,
          VALIDATION_FRAMEWORK_MESSAGES.PARAMETERS_VALIDATION_FAILED
        )
      ], performance.now() - startTime);
    }
  }

  /**
   * Validate with caching optimization
   * @param schemaHash Hash of schema for caching
   * @param validator Validation function
   * @returns Cached or fresh validation result
   */
  async validateWithCache(
    schemaHash: string,
    validator: () => Promise<ValidationFrameworkResult>
  ): Promise<ValidationFrameworkResult> {
    const startTime = performance.now();

    // Check cache
    const cached = await this.getCachedResult(schemaHash);
    if (cached) {
      return {
        ...cached,
        validationTimeMs: performance.now() - startTime,
        cacheHit: true
      };
    }

    // Execute validator
    const result = await validator();
    
    // Cache result
    await this.cacheResult(schemaHash, result);

    return result;
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    logger.debug('Schema validation cache cleared');
  }

  /**
   * Get cache statistics
   * @returns Cache performance statistics
   */
  getCacheStats(): { size: number; hitRate: number; totalHits: number; totalMisses: number } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      size: this.cache.size,
      hitRate: total > 0 ? this.cacheHits / total : 0,
      totalHits: this.cacheHits,
      totalMisses: this.cacheMisses
    };
  }

  /**
   * Generate hash for schema caching
   */
  private generateSchemaHash(schema: any): string {
    const normalized = JSON.stringify(schema, Object.keys(schema).sort());
    return createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Get cached validation result
   */
  private async getCachedResult(cacheKey: string): Promise<ValidationFrameworkResult | null> {
    const entry = this.cache.get(cacheKey);
    if (!entry) {
      this.cacheMisses++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.createdAt > VALIDATION_FRAMEWORK_LIMITS.VALIDATION_CACHE_TTL_MS) {
      this.cache.delete(cacheKey);
      this.cacheMisses++;
      return null;
    }

    // Update usage
    entry.hitCount++;
    entry.lastUsed = Date.now();
    this.cacheHits++;

    return entry.result;
  }

  /**
   * Cache validation result
   */
  private async cacheResult(cacheKey: string, result: ValidationFrameworkResult): Promise<void> {
    // Check cache size limit
    if (this.cache.size >= VALIDATION_FRAMEWORK_LIMITS.VALIDATION_CACHE_SIZE) {
      this.evictOldestCacheEntry();
    }

    const entry: SchemaValidationCacheEntry = {
      schemaHash: cacheKey,
      result,
      createdAt: Date.now(),
      hitCount: 0,
      lastUsed: Date.now()
    };

    this.cache.set(cacheKey, entry);
  }

  /**
   * Evict oldest cache entry
   */
  private evictOldestCacheEntry(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Calculate schema depth recursively
   */
  private calculateSchemaDepth(schema: any, currentDepth = 0): number {
    if (currentDepth > VALIDATION_FRAMEWORK_LIMITS.PARAMETER_VALIDATION_MAX_DEPTH) {
      return currentDepth;
    }

    if (!schema || typeof schema !== 'object') {
      return currentDepth;
    }

    let maxDepth = currentDepth;

    if (schema.properties && typeof schema.properties === 'object') {
      for (const prop of Object.values(schema.properties)) {
        const depth = this.calculateSchemaDepth(prop, currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    }

    if (schema.items) {
      const depth = this.calculateSchemaDepth(schema.items, currentDepth + 1);
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  /**
   * Validate JSON schema types recursively
   */
  private validateSchemaTypes(schema: any, path: string, errors: ValidationFieldError[]): void {
    if (!schema || typeof schema !== 'object') return;

    if (schema.type && !SUPPORTED_JSON_SCHEMA_TYPES.includes(schema.type)) {
      errors.push(this.createFieldError(
        `${path}.type`,
        VALIDATION_FRAMEWORK_ERRORS.SCHEMA_INVALID,
        VALIDATION_FRAMEWORK_MESSAGES.UNSUPPORTED_SCHEMA_TYPE
      ));
    }

    if (schema.properties && typeof schema.properties === 'object') {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        this.validateSchemaTypes(propSchema, `${path}.properties.${propName}`, errors);
      }
    }

    if (schema.items) {
      this.validateSchemaTypes(schema.items, `${path}.items`, errors);
    }
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
   * Create validation result
   */
  private createValidationResult(
    valid: boolean,
    errors: ValidationFieldError[],
    validationTimeMs: number
  ): ValidationFrameworkResult {
    return {
      valid,
      errors,
      validationTimeMs,
      performanceMetrics: {
        validationTimeMs,
        schemaValidationTimeMs: validationTimeMs,
        runtimeValidationTimeMs: 0,
        customRulesTimeMs: 0,
        cacheTimeMs: 0,
        memoryUsageBytes: process.memoryUsage().heapUsed
      }
    };
  }
}

/**
 * Create schema validator instance
 * Factory function for dependency injection
 */
export function createSchemaValidator(): ISchemaValidator {
  return new SchemaValidator();
}