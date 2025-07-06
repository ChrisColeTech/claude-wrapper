/**
 * Registry Validator (Phase 10A)
 * Single Responsibility: Registry validation only
 * 
 * Validates schema registrations, detects duplicates, and ensures registry integrity
 * Following SOLID principles and architecture guidelines
 */

import { RegistryToolSchema } from './registry';
import { OpenAIFunctionSchema, ValidationUtils } from './schemas';
import { 
  REGISTRY_LIMITS,
  REGISTRY_MESSAGES,
  REGISTRY_ERRORS,
  SCHEMA_VERSIONS,
  TOOL_VALIDATION_PATTERNS
} from './constants';
import { getLogger } from '../utils/logger';

const logger = getLogger('RegistryValidator');

/**
 * Registry validation result
 */
export interface RegistryValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  validationTimeMs: number;
}

/**
 * Duplicate detection result
 */
export interface DuplicateDetectionResult {
  duplicatesFound: boolean;
  duplicates: DuplicateInfo[];
  totalChecked: number;
  detectionTimeMs: number;
}

/**
 * Duplicate information
 */
export interface DuplicateInfo {
  name: string;
  count: number;
  schemas: RegistryToolSchema[];
  conflictType: 'exact' | 'name' | 'definition';
}

/**
 * Structure validation result
 */
export interface StructureValidationResult {
  valid: boolean;
  structureScore: number; // 0-100 quality score
  issues: StructureIssue[];
  recommendations: string[];
}

/**
 * Structure issue information
 */
export interface StructureIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'naming' | 'parameters' | 'description' | 'format';
  message: string;
  location?: string;
}

/**
 * Registry validator interface (ISP compliance)
 */
export interface IRegistryValidator {
  validateRegistration(schema: any): Promise<RegistryValidationResult>;
  detectDuplicates(schemas: RegistryToolSchema[]): Promise<DuplicateDetectionResult>;
  validateStructure(schema: any): Promise<StructureValidationResult>;
  validateSchemaName(name: string): boolean;
  validateSchemaVersion(version: string): boolean;
}

/**
 * Registry validation error
 */
export class RegistryValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly validationTimeMs?: number
  ) {
    super(message);
    this.name = 'RegistryValidationError';
  }
}

/**
 * Registry Validator implementation
 * SRP: Handles only validation logic for registry operations
 * File size: <200 lines, functions <50 lines, max 5 parameters
 */
export class RegistryValidator implements IRegistryValidator {

  /**
   * Validate schema for registry registration
   * @param schema Schema to validate for registration
   * @returns Validation result with detailed feedback
   */
  async validateRegistration(schema: any): Promise<RegistryValidationResult> {
    const startTime = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic structure validation
      if (!schema || typeof schema !== 'object') {
        errors.push(REGISTRY_MESSAGES.SCHEMA_VALIDATION_FAILED);
        return {
          valid: false,
          errors,
          warnings,
          validationTimeMs: performance.now() - startTime
        };
      }

      // Validate required fields
      if (!schema.name) {
        errors.push('Schema name is required');
      } else if (!this.validateSchemaName(schema.name)) {
        errors.push(REGISTRY_MESSAGES.INVALID_SCHEMA_NAME);
      }

      // Validate OpenAI function schema structure
      try {
        const validation = await ValidationUtils.validateWithTimeout(
          OpenAIFunctionSchema,
          schema,
          REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS
        );

        if (!validation.success) {
          const validationErrors = ValidationUtils.extractErrorMessages(validation);
          errors.push(...validationErrors);
        }
      } catch (error) {
        errors.push('Schema validation timeout or error');
      }

      // Validate description length
      if (schema.description && schema.description.length > REGISTRY_LIMITS.MAX_SCHEMA_DESCRIPTION_LENGTH) {
        errors.push(`Description exceeds maximum length of ${REGISTRY_LIMITS.MAX_SCHEMA_DESCRIPTION_LENGTH} characters`);
      }

      // Validate parameters complexity
      if (schema.parameters) {
        const complexityIssues = this.validateParametersComplexity(schema.parameters);
        warnings.push(...complexityIssues);
      }

      // Performance validation
      const validationTime = performance.now() - startTime;
      if (validationTime > REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS) {
        throw new RegistryValidationError(
          REGISTRY_MESSAGES.REGISTRY_OPERATION_TIMEOUT,
          REGISTRY_ERRORS.TIMEOUT,
          validationTime
        );
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        validationTimeMs: validationTime
      };

    } catch (error) {
      const validationTime = performance.now() - startTime;

      if (error instanceof RegistryValidationError) {
        return {
          valid: false,
          errors: [error.message],
          warnings,
          validationTimeMs: validationTime
        };
      }

      logger.error('Registration validation failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        schemaName: schema?.name || 'unknown'
      });
      return {
        valid: false,
        errors: [REGISTRY_MESSAGES.SCHEMA_VALIDATION_FAILED],
        warnings,
        validationTimeMs: validationTime
      };
    }
  }

  /**
   * Detect duplicate schemas in registry
   * @param schemas Array of schemas to check for duplicates
   * @returns Duplicate detection result
   */
  async detectDuplicates(schemas: RegistryToolSchema[]): Promise<DuplicateDetectionResult> {
    const startTime = performance.now();

    try {
      const duplicates: DuplicateInfo[] = [];
      const nameGroups = new Map<string, RegistryToolSchema[]>();

      // Group schemas by name
      for (const schema of schemas) {
        const existing = nameGroups.get(schema.name) || [];
        existing.push(schema);
        nameGroups.set(schema.name, existing);
      }

      // Find duplicates
      Array.from(nameGroups.entries()).forEach(([name, schemaGroup]) => {
        if (schemaGroup.length > 1) {
          // Determine conflict type
          const conflictType = this.determineConflictType(schemaGroup);
          
          duplicates.push({
            name,
            count: schemaGroup.length,
            schemas: schemaGroup,
            conflictType
          });
        }
      });

      const detectionTime = performance.now() - startTime;

      return {
        duplicatesFound: duplicates.length > 0,
        duplicates,
        totalChecked: schemas.length,
        detectionTimeMs: detectionTime
      };

    } catch (error) {
      logger.error('Duplicate detection failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        schemaCount: schemas.length 
      });
      return {
        duplicatesFound: false,
        duplicates: [],
        totalChecked: schemas.length,
        detectionTimeMs: performance.now() - startTime
      };
    }
  }

  /**
   * Validate schema structure quality
   * @param schema Schema to analyze
   * @returns Structure validation with quality score and recommendations
   */
  async validateStructure(schema: any): Promise<StructureValidationResult> {
    const issues: StructureIssue[] = [];
    const recommendations: string[] = [];
    let structureScore = 100;

    try {
      // Validate naming conventions
      if (schema.name) {
        const namingIssues = this.validateNamingConventions(schema.name);
        issues.push(...namingIssues);
        structureScore -= namingIssues.length * 10;
      }

      // Validate description quality
      if (!schema.description) {
        issues.push({
          severity: 'warning',
          category: 'description',
          message: 'Schema lacks description',
          location: 'description'
        });
        recommendations.push('Add descriptive documentation for better usability');
        structureScore -= 5;
      } else if (schema.description.length < 10) {
        issues.push({
          severity: 'info',
          category: 'description',
          message: 'Description is very brief',
          location: 'description'
        });
        structureScore -= 2;
      }

      // Validate parameters structure
      if (schema.parameters) {
        const paramIssues = this.validateParametersStructure(schema.parameters);
        issues.push(...paramIssues);
        structureScore -= paramIssues.filter(i => i.severity === 'error').length * 15;
        structureScore -= paramIssues.filter(i => i.severity === 'warning').length * 5;
      }

      // Generate recommendations based on issues
      if (issues.length === 0) {
        recommendations.push('Schema structure is well-formed');
      } else {
        recommendations.push(...this.generateRecommendations(issues));
      }

      return {
        valid: !issues.some(issue => issue.severity === 'error'),
        structureScore: Math.max(0, structureScore),
        issues,
        recommendations
      };

    } catch (error) {
      logger.error('Structure validation failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        schemaName: schema?.name || 'unknown'
      });
      return {
        valid: false,
        structureScore: 0,
        issues: [{
          severity: 'error',
          category: 'format',
          message: 'Structure validation failed',
          location: 'root'
        }],
        recommendations: ['Review schema format and structure']
      };
    }
  }

  /**
   * Validate schema name format
   * @param name Schema name to validate
   * @returns True if name is valid
   */
  validateSchemaName(name: string): boolean {
    if (!name || typeof name !== 'string') {
      return false;
    }

    if (name.length < REGISTRY_LIMITS.MIN_SCHEMA_NAME_LENGTH ||
        name.length > REGISTRY_LIMITS.MAX_SCHEMA_NAME_LENGTH) {
      return false;
    }

    // Allow unicode characters in schema names for broader compatibility
    // Basic pattern: no spaces, no control characters, at least one valid character
    // eslint-disable-next-line no-control-regex
    const basicPattern = /^[^\s\x00-\x1f\x7f]+$/;
    return basicPattern.test(name);
  }

  /**
   * Validate schema version format
   * @param version Version string to validate
   * @returns True if version is valid
   */
  validateSchemaVersion(version: string): boolean {
    if (!version || typeof version !== 'string') {
      return false;
    }

    return SCHEMA_VERSIONS.VERSION_PATTERN.test(version);
  }

  /**
   * Validate parameters complexity
   * @param parameters Parameters object to validate
   * @returns Array of complexity warnings
   */
  private validateParametersComplexity(parameters: any): string[] {
    const warnings: string[] = [];

    try {
      // Check nesting depth
      const depth = this.calculateDepth(parameters);
      if (depth > 4) {
        warnings.push('Parameters have deep nesting, consider flattening structure');
      }

      // Check property count
      const propertyCount = this.countProperties(parameters);
      if (propertyCount > 20) {
        warnings.push('Parameters have many properties, consider grouping related fields');
      }

      // Check for missing descriptions
      if (parameters.properties) {
        const undescribedProperties = Object.keys(parameters.properties).filter(
          key => !parameters.properties[key].description
        );
        if (undescribedProperties.length > 0) {
          warnings.push(`Properties lack descriptions: ${undescribedProperties.join(', ')}`);
        }
      }

    } catch (error) {
      warnings.push('Unable to analyze parameter complexity');
    }

    return warnings;
  }

  /**
   * Determine conflict type for duplicate schemas
   * @param schemas Array of schemas with same name
   * @returns Conflict type classification
   */
  private determineConflictType(schemas: RegistryToolSchema[]): 'exact' | 'name' | 'definition' {
    if (schemas.length < 2) return 'exact';

    const firstSchema = schemas[0];
    const allExact = schemas.every(schema => 
      JSON.stringify(schema.schema) === JSON.stringify(firstSchema.schema)
    );

    if (allExact) return 'exact';

    const allSameName = schemas.every(schema => schema.name === firstSchema.name);
    return allSameName ? 'definition' : 'name';
  }

  /**
   * Validate naming conventions
   * @param name Schema name to validate
   * @returns Array of naming issues
   */
  private validateNamingConventions(name: string): StructureIssue[] {
    const issues: StructureIssue[] = [];

    // Check for reserved names
    if (TOOL_VALIDATION_PATTERNS.RESERVED_NAMES.includes(name)) {
      issues.push({
        severity: 'error',
        category: 'naming',
        message: `Name '${name}' is reserved`,
        location: 'name'
      });
    }

    // Check naming style
    if (name.includes(' ')) {
      issues.push({
        severity: 'warning',
        category: 'naming',
        message: 'Name contains spaces, consider using underscores or camelCase',
        location: 'name'
      });
    }

    // Check length appropriateness
    if (name.length < 3) {
      issues.push({
        severity: 'warning',
        category: 'naming',
        message: 'Name is very short, consider more descriptive naming',
        location: 'name'
      });
    }

    return issues;
  }

  /**
   * Validate parameters structure quality
   * @param parameters Parameters object
   * @returns Array of structure issues
   */
  private validateParametersStructure(parameters: any): StructureIssue[] {
    const issues: StructureIssue[] = [];

    if (!parameters.type) {
      issues.push({
        severity: 'warning',
        category: 'parameters',
        message: 'Parameters missing type specification',
        location: 'parameters.type'
      });
    }

    if (parameters.type === 'object' && !parameters.properties) {
      issues.push({
        severity: 'warning',
        category: 'parameters',
        message: 'Object type parameters should define properties',
        location: 'parameters.properties'
      });
    }

    return issues;
  }

  /**
   * Generate recommendations based on issues
   * @param issues Array of validation issues
   * @returns Array of actionable recommendations
   */
  private generateRecommendations(issues: StructureIssue[]): string[] {
    const recommendations: string[] = [];

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    if (errorCount > 0) {
      recommendations.push(`Fix ${errorCount} critical issue(s) before registration`);
    }

    if (warningCount > 0) {
      recommendations.push(`Address ${warningCount} warning(s) to improve schema quality`);
    }

    // Category-specific recommendations
    const categories = Array.from(new Set(issues.map(i => i.category)));
    categories.forEach(category => {
      switch (category) {
        case 'naming':
          recommendations.push('Review naming conventions for consistency');
          break;
        case 'description':
          recommendations.push('Add comprehensive descriptions for better documentation');
          break;
        case 'parameters':
          recommendations.push('Optimize parameter structure for clarity');
          break;
      }
    });

    return recommendations;
  }

  /**
   * Calculate object depth
   * @param obj Object to analyze
   * @returns Maximum nesting depth
   */
  private calculateDepth(obj: any, depth: number = 0): number {
    if (!obj || typeof obj !== 'object') return depth;
    
    let maxDepth = depth;
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        maxDepth = Math.max(maxDepth, this.calculateDepth(value, depth + 1));
      }
    }
    
    return maxDepth;
  }

  /**
   * Count total properties recursively
   * @param obj Object to count
   * @returns Total property count
   */
  private countProperties(obj: any): number {
    if (!obj || typeof obj !== 'object') return 0;
    
    let count = Object.keys(obj).length;
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        count += this.countProperties(value);
      }
    }
    
    return count;
  }
}

/**
 * Create registry validator instance
 * Factory function for dependency injection
 */
export function createRegistryValidator(): IRegistryValidator {
  return new RegistryValidator();
}