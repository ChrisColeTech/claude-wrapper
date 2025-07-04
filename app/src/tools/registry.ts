/**
 * Tool Function Schema Registry (Phase 10A)
 * Single Responsibility: Registry operations only
 * 
 * Provides centralized management of tool function schemas with fast lookups
 * Following SOLID principles and architecture guidelines
 */

import { OpenAIFunctionSchema } from './schemas';
import { 
  REGISTRY_LIMITS,
  REGISTRY_MESSAGES,
  REGISTRY_ERRORS,
  REGISTRY_TYPES,
  SCHEMA_VERSIONS
} from './constants';
import { getLogger } from '../utils/logger';

const logger = getLogger('ToolRegistry');

/**
 * Tool schema with registry metadata
 */
export interface RegistryToolSchema {
  name: string;
  schema: typeof OpenAIFunctionSchema._type;
  version: string;
  registeredAt: number;
  metadata?: Record<string, any>;
}

/**
 * Registry operation result
 */
export interface RegistryResult {
  success: boolean;
  schema?: RegistryToolSchema;
  errors: string[];
  operationTimeMs: number;
}

/**
 * Registry list result
 */
export interface RegistryListResult {
  success: boolean;
  schemas: RegistryToolSchema[];
  totalCount: number;
  errors: string[];
  operationTimeMs: number;
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalSchemas: number;
  totalSize: number;
  oldestSchema?: RegistryToolSchema;
  newestSchema?: RegistryToolSchema;
  versions: Record<string, number>;
}

/**
 * Tool registry interface (ISP compliance - focused interface)
 */
export interface IToolRegistry {
  register(name: string, schema: any, version?: string): Promise<RegistryResult>;
  lookup(name: string): Promise<RegistryResult>;
  unregister(name: string): Promise<RegistryResult>;
  list(): Promise<RegistryListResult>;
  clear(): Promise<RegistryResult>;
}

/**
 * Registry error for consistent error handling
 */
export class RegistryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly operationTimeMs?: number,
    public readonly schemaName?: string
  ) {
    super(message);
    this.name = 'RegistryError';
  }
}

/**
 * Tool Registry implementation
 * SRP: Handles only registry operations (storage, retrieval, management)
 * File size: <200 lines, functions <50 lines, max 5 parameters
 */
export class ToolRegistry implements IToolRegistry {
  private schemas: Map<string, RegistryToolSchema> = new Map();

  /**
   * Register a tool schema in the registry
   * @param name Schema name (unique identifier)
   * @param schema OpenAI function schema
   * @param version Schema version (defaults to current)
   * @returns Registry operation result
   */
  async register(name: string, schema: any, version: string = SCHEMA_VERSIONS.DEFAULT_VERSION): Promise<RegistryResult> {
    const startTime = performance.now();

    try {
      // Early validation
      const validationErrors = this.validateRegistrationInputs(name, schema, version);
      if (validationErrors.length > 0) {
        return {
          success: false,
          errors: validationErrors,
          operationTimeMs: performance.now() - startTime
        };
      }

      // Check registry limits
      const limitErrors = this.checkRegistryLimits();
      if (limitErrors.length > 0) {
        return {
          success: false,
          errors: limitErrors,
          operationTimeMs: performance.now() - startTime
        };
      }

      // Check for existing schema
      if (this.schemas.has(name)) {
        return {
          success: false,
          errors: [REGISTRY_MESSAGES.SCHEMA_ALREADY_EXISTS],
          operationTimeMs: performance.now() - startTime
        };
      }

      // Create registry schema
      const registrySchema: RegistryToolSchema = {
        name,
        schema,
        version,
        registeredAt: Date.now()
      };

      // Store in registry
      this.schemas.set(name, registrySchema);

      const operationTime = performance.now() - startTime;

      // Check timeout requirement (<3ms)
      if (operationTime > REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS) {
        throw new RegistryError(
          REGISTRY_MESSAGES.REGISTRY_OPERATION_TIMEOUT,
          REGISTRY_ERRORS.TIMEOUT,
          operationTime,
          name
        );
      }

      logger.debug(`Schema registered successfully: ${name}`, {
        schemaName: name,
        version,
        operationTimeMs: operationTime
      });

      return {
        success: true,
        schema: registrySchema,
        errors: [],
        operationTimeMs: operationTime
      };

    } catch (error) {
      const operationTime = performance.now() - startTime;

      if (error instanceof RegistryError) {
        return {
          success: false,
          errors: [error.message],
          operationTimeMs: operationTime
        };
      }

      logger.error(`Schema registration failed: ${name}`, { error, operationTimeMs: operationTime });

      return {
        success: false,
        errors: [REGISTRY_MESSAGES.SCHEMA_REGISTRATION_FAILED],
        operationTimeMs: operationTime
      };
    }
  }

  /**
   * Lookup a tool schema by name
   * @param name Schema name to lookup
   * @returns Registry operation result with schema if found
   */
  async lookup(name: string): Promise<RegistryResult> {
    const startTime = performance.now();

    try {
      // Validate input
      if (!name || typeof name !== 'string') {
        return {
          success: false,
          errors: [REGISTRY_MESSAGES.INVALID_SCHEMA_NAME],
          operationTimeMs: performance.now() - startTime
        };
      }

      // Lookup schema
      const schema = this.schemas.get(name);

      const operationTime = performance.now() - startTime;

      // Check timeout requirement (<3ms)
      if (operationTime > REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS) {
        throw new RegistryError(
          REGISTRY_MESSAGES.REGISTRY_OPERATION_TIMEOUT,
          REGISTRY_ERRORS.TIMEOUT,
          operationTime,
          name
        );
      }

      if (!schema) {
        return {
          success: false,
          errors: [REGISTRY_MESSAGES.SCHEMA_NOT_FOUND],
          operationTimeMs: operationTime
        };
      }

      return {
        success: true,
        schema,
        errors: [],
        operationTimeMs: operationTime
      };

    } catch (error) {
      const operationTime = performance.now() - startTime;

      if (error instanceof RegistryError) {
        return {
          success: false,
          errors: [error.message],
          operationTimeMs: operationTime
        };
      }

      return {
        success: false,
        errors: [REGISTRY_MESSAGES.SCHEMA_NOT_FOUND],
        operationTimeMs: operationTime
      };
    }
  }

  /**
   * Unregister a tool schema from registry
   * @param name Schema name to remove
   * @returns Registry operation result
   */
  async unregister(name: string): Promise<RegistryResult> {
    const startTime = performance.now();

    try {
      // Validate input
      if (!name || typeof name !== 'string') {
        return {
          success: false,
          errors: [REGISTRY_MESSAGES.INVALID_SCHEMA_NAME],
          operationTimeMs: performance.now() - startTime
        };
      }

      // Check if schema exists
      const schema = this.schemas.get(name);
      if (!schema) {
        return {
          success: false,
          errors: [REGISTRY_MESSAGES.SCHEMA_NOT_FOUND],
          operationTimeMs: performance.now() - startTime
        };
      }

      // Remove schema
      const removed = this.schemas.delete(name);

      const operationTime = performance.now() - startTime;

      // Check timeout requirement (<3ms)
      if (operationTime > REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS) {
        throw new RegistryError(
          REGISTRY_MESSAGES.REGISTRY_OPERATION_TIMEOUT,
          REGISTRY_ERRORS.TIMEOUT,
          operationTime,
          name
        );
      }

      if (removed) {
        logger.debug(`Schema unregistered successfully: ${name}`, {
          schemaName: name,
          operationTimeMs: operationTime
        });

        return {
          success: true,
          schema,
          errors: [],
          operationTimeMs: operationTime
        };
      }

      return {
        success: false,
        errors: [REGISTRY_MESSAGES.SCHEMA_NOT_FOUND],
        operationTimeMs: operationTime
      };

    } catch (error) {
      const operationTime = performance.now() - startTime;

      if (error instanceof RegistryError) {
        return {
          success: false,
          errors: [error.message],
          operationTimeMs: operationTime
        };
      }

      return {
        success: false,
        errors: [REGISTRY_MESSAGES.SCHEMA_NOT_FOUND],
        operationTimeMs: operationTime
      };
    }
  }

  /**
   * List all registered schemas
   * @returns Registry list result with all schemas
   */
  async list(): Promise<RegistryListResult> {
    const startTime = performance.now();

    try {
      const schemas = Array.from(this.schemas.values());

      const operationTime = performance.now() - startTime;

      // Check timeout requirement (<3ms)
      if (operationTime > REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS) {
        throw new RegistryError(
          REGISTRY_MESSAGES.REGISTRY_OPERATION_TIMEOUT,
          REGISTRY_ERRORS.TIMEOUT,
          operationTime
        );
      }

      return {
        success: true,
        schemas,
        totalCount: schemas.length,
        errors: [],
        operationTimeMs: operationTime
      };

    } catch (error) {
      const operationTime = performance.now() - startTime;

      if (error instanceof RegistryError) {
        return {
          success: false,
          schemas: [],
          totalCount: 0,
          errors: [error.message],
          operationTimeMs: operationTime
        };
      }

      return {
        success: false,
        schemas: [],
        totalCount: 0,
        errors: ['Failed to list schemas'],
        operationTimeMs: operationTime
      };
    }
  }

  /**
   * Clear all schemas from registry
   * @returns Registry operation result
   */
  async clear(): Promise<RegistryResult> {
    const startTime = performance.now();

    try {
      const previousCount = this.schemas.size;
      this.schemas.clear();

      const operationTime = performance.now() - startTime;

      logger.debug(`Registry cleared successfully`, {
        previousCount,
        operationTimeMs: operationTime
      });

      return {
        success: true,
        errors: [],
        operationTimeMs: operationTime
      };

    } catch (error) {
      const operationTime = performance.now() - startTime;

      return {
        success: false,
        errors: ['Failed to clear registry'],
        operationTimeMs: operationTime
      };
    }
  }

  /**
   * Get registry statistics
   * @returns Registry statistics
   */
  getStats(): RegistryStats {
    const schemas = Array.from(this.schemas.values());
    const versions: Record<string, number> = {};

    let oldestSchema: RegistryToolSchema | undefined;
    let newestSchema: RegistryToolSchema | undefined;
    let totalSize = 0;

    for (const schema of schemas) {
      // Calculate size (approximate)
      totalSize += JSON.stringify(schema).length;

      // Track versions
      versions[schema.version] = (versions[schema.version] || 0) + 1;

      // Find oldest and newest
      if (!oldestSchema || schema.registeredAt < oldestSchema.registeredAt) {
        oldestSchema = schema;
      }
      if (!newestSchema || schema.registeredAt > newestSchema.registeredAt) {
        newestSchema = schema;
      }
    }

    return {
      totalSchemas: schemas.length,
      totalSize,
      oldestSchema,
      newestSchema,
      versions
    };
  }

  /**
   * Validate registration inputs
   * @param name Schema name
   * @param schema Schema object
   * @param version Schema version
   * @returns Array of validation errors
   */
  private validateRegistrationInputs(name: string, schema: any, version: string): string[] {
    const errors: string[] = [];

    // Validate name
    if (!name || typeof name !== 'string') {
      errors.push(REGISTRY_MESSAGES.INVALID_SCHEMA_NAME);
    } else if (name.length < REGISTRY_LIMITS.MIN_SCHEMA_NAME_LENGTH || 
               name.length > REGISTRY_LIMITS.MAX_SCHEMA_NAME_LENGTH) {
      errors.push(REGISTRY_MESSAGES.INVALID_SCHEMA_NAME);
    }

    // Validate schema
    if (!schema || typeof schema !== 'object') {
      errors.push(REGISTRY_MESSAGES.SCHEMA_VALIDATION_FAILED);
    }

    // Validate version
    if (!version || !SCHEMA_VERSIONS.VERSION_PATTERN.test(version)) {
      errors.push(REGISTRY_MESSAGES.INVALID_SCHEMA_VERSION);
    }

    return errors;
  }

  /**
   * Check registry limits before registration
   * @returns Array of limit violation errors
   */
  private checkRegistryLimits(): string[] {
    const errors: string[] = [];

    // Check schema count limit
    if (this.schemas.size >= REGISTRY_LIMITS.MAX_SCHEMAS_PER_REGISTRY) {
      errors.push(REGISTRY_MESSAGES.REGISTRY_SCHEMA_LIMIT_EXCEEDED);
    }

    // Check storage size limit
    const stats = this.getStats();
    if (stats.totalSize >= REGISTRY_LIMITS.SCHEMA_STORAGE_SIZE_LIMIT) {
      errors.push(REGISTRY_MESSAGES.REGISTRY_STORAGE_LIMIT_EXCEEDED);
    }

    return errors;
  }
}

/**
 * Create tool registry instance
 * Factory function for dependency injection
 */
export function createToolRegistry(): IToolRegistry {
  return new ToolRegistry();
}