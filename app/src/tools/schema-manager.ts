/**
 * Tool Schema Manager (Phase 10A)
 * Single Responsibility: Schema lifecycle management only
 * 
 * Handles schema validation, normalization, versioning, and conflict resolution
 * Following SOLID principles and architecture guidelines
 */

import { OpenAIFunctionSchema } from './schemas';
import { RegistryToolSchema } from './registry';
import { 
  REGISTRY_MESSAGES,
  REGISTRY_ERRORS,
  SCHEMA_VERSIONS,
  REGISTRY_TYPES,
  REGISTRY_LIMITS
} from './constants';
import { getLogger } from '../utils/logger';

const logger = getLogger('SchemaManager');

/**
 * Schema validation result
 */
export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalizedSchema?: any;
}

/**
 * Schema conflict information
 */
export interface SchemaConflict {
  conflictType: 'name' | 'version' | 'definition';
  existing: RegistryToolSchema;
  incoming: any;
  description: string;
  resolutionOptions: string[];
}

/**
 * Conflict resolution strategy
 */
export interface ConflictResolution {
  strategy: 'reject' | 'replace' | 'version';
  action: string;
  resolvedSchema?: any;
  success: boolean;
  errors: string[];
}

/**
 * Version compatibility result
 */
export interface VersionCompatibility {
  compatible: boolean;
  currentVersion: string;
  targetVersion: string;
  migrationRequired: boolean;
  migrationSteps?: string[];
}

/**
 * Schema manager interface (ISP compliance)
 */
export interface ISchemaManager {
  validateSchema(schema: any): Promise<SchemaValidationResult>;
  normalizeSchema(schema: any): Promise<any>;
  checkVersionCompatibility(version: string): Promise<VersionCompatibility>;
  detectConflicts(existing: RegistryToolSchema, incoming: any): Promise<SchemaConflict | null>;
  resolveConflict(conflict: SchemaConflict, strategy: string): Promise<ConflictResolution>;
}

/**
 * Schema management error
 */
export class SchemaManagementError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly schemaName?: string,
    public readonly version?: string
  ) {
    super(message);
    this.name = 'SchemaManagementError';
  }
}

/**
 * Schema Manager implementation
 * SRP: Handles only schema lifecycle management
 * File size: <200 lines, functions <50 lines, max 5 parameters
 */
export class SchemaManager implements ISchemaManager {

  /**
   * Validate schema structure and content
   * @param schema Schema to validate
   * @returns Validation result with errors and normalized schema
   */
  async validateSchema(schema: any): Promise<SchemaValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic structure validation
      if (!schema || typeof schema !== 'object') {
        errors.push(REGISTRY_MESSAGES.SCHEMA_VALIDATION_FAILED);
        return { valid: false, errors, warnings };
      }

      // Validate required fields
      const requiredFields = ['name'];
      for (const field of requiredFields) {
        if (!schema[field]) {
          errors.push(`Missing required field: ${field}`);
        }
      }

      // Validate name format
      if (schema.name && typeof schema.name === 'string') {
        if (schema.name.length < REGISTRY_LIMITS.MIN_SCHEMA_NAME_LENGTH ||
            schema.name.length > REGISTRY_LIMITS.MAX_SCHEMA_NAME_LENGTH) {
          errors.push(REGISTRY_MESSAGES.INVALID_SCHEMA_NAME);
        }
      }

      // Validate description length if provided
      if (schema.description && typeof schema.description === 'string') {
        if (schema.description.length > REGISTRY_LIMITS.MAX_SCHEMA_DESCRIPTION_LENGTH) {
          errors.push('Schema description exceeds maximum length');
        }
      }

      // Validate parameters structure
      if (schema.parameters) {
        const paramValidation = this.validateParametersStructure(schema.parameters);
        errors.push(...paramValidation.errors);
        warnings.push(...paramValidation.warnings);
      }

      // Normalize schema if validation passes
      let normalizedSchema: any | undefined;
      if (errors.length === 0) {
        normalizedSchema = await this.normalizeSchema(schema);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        normalizedSchema
      };

    } catch (error) {
      logger.error('Schema validation failed', { error, schema });
      return {
        valid: false,
        errors: [REGISTRY_MESSAGES.SCHEMA_VALIDATION_FAILED],
        warnings
      };
    }
  }

  /**
   * Normalize schema to standard format
   * @param schema Schema to normalize
   * @returns Normalized schema
   */
  async normalizeSchema(schema: any): Promise<any> {
    try {
      // Create normalized copy
      const normalized = {
        name: schema.name,
        description: schema.description || '',
        parameters: schema.parameters || {},
        ...schema
      };

      // Ensure parameters has proper structure
      if (!normalized.parameters.type) {
        normalized.parameters.type = 'object';
      }

      if (!normalized.parameters.properties) {
        normalized.parameters.properties = {};
      }

      // Remove any undefined values
      Object.keys(normalized).forEach(key => {
        if (normalized[key] === undefined) {
          delete normalized[key];
        }
      });

      logger.debug('Schema normalized successfully', {
        originalName: schema.name,
        normalizedName: normalized.name
      });

      return normalized;

    } catch (error) {
      logger.error('Schema normalization failed', { error, schema });
      throw new SchemaManagementError(
        REGISTRY_MESSAGES.SCHEMA_NORMALIZATION_FAILED,
        REGISTRY_ERRORS.NORMALIZATION_FAILED,
        schema?.name
      );
    }
  }

  /**
   * Check version compatibility
   * @param version Version to check
   * @returns Compatibility information
   */
  async checkVersionCompatibility(version: string): Promise<VersionCompatibility> {
    try {
      const currentVersion = SCHEMA_VERSIONS.CURRENT_VERSION;
      const supportedVersions = SCHEMA_VERSIONS.SUPPORTED_VERSIONS;

      // Check if version is supported
      const compatible = supportedVersions.includes(version);

      // Check if migration is required
      const migrationRequired = !compatible && this.isVersionNewer(version, currentVersion);

      const result: VersionCompatibility = {
        compatible,
        currentVersion,
        targetVersion: version,
        migrationRequired
      };

      // Add migration steps if needed
      if (migrationRequired) {
        result.migrationSteps = this.generateMigrationSteps(currentVersion, version);
      }

      return result;

    } catch (error) {
      logger.error('Version compatibility check failed', { error, version });
      return {
        compatible: false,
        currentVersion: SCHEMA_VERSIONS.CURRENT_VERSION,
        targetVersion: version,
        migrationRequired: false
      };
    }
  }

  /**
   * Detect conflicts between existing and incoming schemas
   * @param existing Existing schema in registry
   * @param incoming New schema being registered
   * @returns Conflict information or null if no conflict
   */
  async detectConflicts(existing: RegistryToolSchema, incoming: any): Promise<SchemaConflict | null> {
    try {
      // Name conflict (same name, different definition)
      if (existing.name === incoming.name) {
        const definitionMatch = this.compareSchemaDefinitions(existing.schema, incoming);
        
        if (!definitionMatch) {
          return {
            conflictType: 'definition',
            existing,
            incoming,
            description: `Schema with name '${existing.name}' already exists with different definition`,
            resolutionOptions: [
              REGISTRY_TYPES.CONFLICT_STRATEGY_REJECT,
              REGISTRY_TYPES.CONFLICT_STRATEGY_REPLACE,
              REGISTRY_TYPES.CONFLICT_STRATEGY_VERSION
            ]
          };
        }
      }

      // Version conflict
      if (existing.name === incoming.name && existing.version !== incoming.version) {
        return {
          conflictType: 'version',
          existing,
          incoming,
          description: `Schema '${existing.name}' version conflict: existing ${existing.version}, incoming ${incoming.version}`,
          resolutionOptions: [
            REGISTRY_TYPES.CONFLICT_STRATEGY_REJECT,
            REGISTRY_TYPES.CONFLICT_STRATEGY_REPLACE
          ]
        };
      }

      return null;

    } catch (error) {
      logger.error('Conflict detection failed', { error, existing, incoming });
      return {
        conflictType: 'definition',
        existing,
        incoming,
        description: 'Unable to determine conflict type',
        resolutionOptions: [REGISTRY_TYPES.CONFLICT_STRATEGY_REJECT]
      };
    }
  }

  /**
   * Resolve schema conflict using specified strategy
   * @param conflict Conflict information
   * @param strategy Resolution strategy
   * @returns Resolution result
   */
  async resolveConflict(conflict: SchemaConflict, strategy: string): Promise<ConflictResolution> {
    try {
      switch (strategy) {
        case REGISTRY_TYPES.CONFLICT_STRATEGY_REJECT: {
          return {
            strategy: 'reject',
            action: 'Registration rejected due to conflict',
            success: false,
            errors: [REGISTRY_MESSAGES.SCHEMA_CONFLICT_DETECTED]
          };
        }

        case REGISTRY_TYPES.CONFLICT_STRATEGY_REPLACE: {
          return {
            strategy: 'replace',
            action: 'Existing schema will be replaced',
            resolvedSchema: conflict.incoming,
            success: true,
            errors: []
          };
        }

        case REGISTRY_TYPES.CONFLICT_STRATEGY_VERSION: {
          const versionedSchema = await this.createVersionedSchema(conflict.incoming);
          return {
            strategy: 'version',
            action: 'Schema registered with new version',
            resolvedSchema: versionedSchema,
            success: true,
            errors: []
          };
        }

        default: {
          return {
            strategy: 'reject',
            action: 'Unknown strategy, defaulting to reject',
            success: false,
            errors: [REGISTRY_MESSAGES.CONFLICT_RESOLUTION_FAILED]
          };
        }
      }

    } catch (error) {
      logger.error('Conflict resolution failed', { error, conflict, strategy });
      return {
        strategy: 'reject',
        action: 'Resolution failed, defaulting to reject',
        success: false,
        errors: [REGISTRY_MESSAGES.CONFLICT_RESOLUTION_FAILED]
      };
    }
  }

  /**
   * Validate parameters structure
   * @param parameters Parameters object to validate
   * @returns Validation result
   */
  private validateParametersStructure(parameters: any): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (parameters && typeof parameters === 'object') {
      // Check for deeply nested parameters
      const depth = this.calculateObjectDepth(parameters);
      if (depth > 5) {
        warnings.push('Parameters structure is deeply nested, consider simplifying');
      }

      // Check for too many properties
      const propertyCount = this.countProperties(parameters);
      if (propertyCount > 50) {
        warnings.push('Parameters has many properties, consider grouping');
      }
    }

    return { errors, warnings };
  }

  /**
   * Compare schema definitions for equality
   * @param schema1 First schema
   * @param schema2 Second schema
   * @returns True if definitions match
   */
  private compareSchemaDefinitions(schema1: any, schema2: any): boolean {
    try {
      // Simple deep comparison (in production, use a proper deep equals library)
      return JSON.stringify(schema1) === JSON.stringify(schema2);
    } catch {
      return false;
    }
  }

  /**
   * Check if version is newer than current
   * @param version Version to check
   * @param current Current version
   * @returns True if version is newer
   */
  private isVersionNewer(version: string, current: string): boolean {
    const parseVersion = (v: string) => v.split('.').map(Number);
    const versionParts = parseVersion(version);
    const currentParts = parseVersion(current);

    for (let i = 0; i < Math.max(versionParts.length, currentParts.length); i++) {
      const vPart = versionParts[i] || 0;
      const cPart = currentParts[i] || 0;
      
      if (vPart > cPart) return true;
      if (vPart < cPart) return false;
    }
    
    return false;
  }

  /**
   * Generate migration steps for version upgrade
   * @param from Source version
   * @param to Target version
   * @returns Array of migration step descriptions
   */
  private generateMigrationSteps(from: string, to: string): string[] {
    return [
      `Migrate from version ${from} to ${to}`,
      'Validate schema compatibility',
      'Update schema format if necessary',
      'Test schema functionality'
    ];
  }

  /**
   * Create versioned schema name
   * @param schema Schema to version
   * @returns Schema with versioned name
   */
  private async createVersionedSchema(schema: any): Promise<any> {
    const timestamp = Date.now();
    const versionedName = `${schema.name}_v${timestamp}`;
    
    return {
      ...schema,
      name: versionedName,
      originalName: schema.name,
      version: SCHEMA_VERSIONS.CURRENT_VERSION
    };
  }

  /**
   * Calculate object nesting depth
   * @param obj Object to analyze
   * @returns Maximum depth
   */
  private calculateObjectDepth(obj: any, depth: number = 0): number {
    if (!obj || typeof obj !== 'object') return depth;
    
    let maxDepth = depth;
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        maxDepth = Math.max(maxDepth, this.calculateObjectDepth(value, depth + 1));
      }
    }
    
    return maxDepth;
  }

  /**
   * Count total properties in object recursively
   * @param obj Object to count
   * @returns Total property count
   */
  private countProperties(obj: any): number {
    if (!obj || typeof obj !== 'object') return 0;
    
    let count = Object.keys(obj).length;
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        count += this.countProperties(value);
      }
    }
    
    return count;
  }
}

/**
 * Create schema manager instance
 * Factory function for dependency injection
 */
export function createSchemaManager(): ISchemaManager {
  return new SchemaManager();
}