/**
 * Schema Management Integration Tests (Phase 10A)
 * Tests integration between ToolRegistry, SchemaManager, and RegistryValidator
 * Verifies end-to-end schema registry functionality
 */

import { ToolRegistry, IToolRegistry } from '../../../src/tools/registry';
import { SchemaManager, ISchemaManager } from '../../../src/tools/schema-manager';
import { RegistryValidator, IRegistryValidator } from '../../../src/tools/registry-validator';
import { RegistryUtils } from '../../../src/tools/schemas';
import { REGISTRY_LIMITS, REGISTRY_MESSAGES, SCHEMA_VERSIONS } from '../../../src/tools/constants';

describe('Schema Management Integration', () => {
  let registry: IToolRegistry;
  let schemaManager: ISchemaManager;
  let validator: IRegistryValidator;

  beforeEach(() => {
    registry = new ToolRegistry();
    schemaManager = new SchemaManager();
    validator = new RegistryValidator();
  });

  describe('Complete Registration Workflow', () => {
    const testSchema = {
      name: 'test_integration_function',
      description: 'Integration test function for schema registry',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Input parameter' },
          options: {
            type: 'object',
            properties: {
              timeout: { type: 'number', description: 'Timeout in milliseconds' }
            }
          }
        },
        required: ['input']
      }
    };

    it('should complete full registration workflow successfully', async () => {
      // Step 1: Validate schema structure
      const validationResult = await validator.validateRegistration(testSchema);
      expect(validationResult.valid).toBe(true);

      // Step 2: Normalize schema
      const normalizedSchema = await schemaManager.normalizeSchema(testSchema);
      expect(normalizedSchema.name).toBe(testSchema.name);
      expect(normalizedSchema.parameters).toBeDefined();

      // Step 3: Register schema
      const registrationResult = await registry.register(testSchema.name, normalizedSchema);
      expect(registrationResult.success).toBe(true);
      expect(registrationResult.schema?.name).toBe(testSchema.name);

      // Step 4: Verify registration via lookup
      const lookupResult = await registry.lookup(testSchema.name);
      expect(lookupResult.success).toBe(true);
      expect(lookupResult.schema?.name).toBe(testSchema.name);
    });

    it('should handle registration with validation warnings', async () => {
      const complexSchema = {
        name: 'complex_integration_test',
        description: 'Complex schema for integration testing',
        parameters: {
          type: 'object',
          properties: {
            level1: {
              type: 'object',
              properties: {
                level2: {
                  type: 'object',
                  properties: {
                    level3: {
                      type: 'object',
                      properties: {
                        level4: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      };

      // Validation should pass with warnings
      const validationResult = await validator.validateRegistration(complexSchema);
      expect(validationResult.valid).toBe(true);
      expect(validationResult.warnings.length).toBeGreaterThan(0);

      // Registration should still succeed
      const normalizedSchema = await schemaManager.normalizeSchema(complexSchema);
      const registrationResult = await registry.register(complexSchema.name, normalizedSchema);
      expect(registrationResult.success).toBe(true);
    });

    it('should prevent registration of invalid schemas', async () => {
      const invalidSchema = {
        name: '', // Invalid empty name
        description: 'Invalid schema test',
        parameters: { type: 'object' }
      };

      // Validation should fail
      const validationResult = await validator.validateRegistration(invalidSchema);
      expect(validationResult.valid).toBe(false);

      // Registration should fail
      const registrationResult = await registry.register(invalidSchema.name, invalidSchema);
      expect(registrationResult.success).toBe(false);
    });
  });

  describe('Conflict Detection and Resolution', () => {
    const originalSchema = {
      name: 'conflict_test_function',
      description: 'Original function for conflict testing',
      parameters: {
        type: 'object',
        properties: {
          param1: { type: 'string', description: 'Original parameter' }
        }
      }
    };

    const conflictingSchema = {
      name: 'conflict_test_function', // Same name
      description: 'Updated function with different implementation',
      parameters: {
        type: 'object',
        properties: {
          param1: { type: 'string', description: 'Updated parameter' },
          param2: { type: 'number', description: 'New parameter' }
        }
      }
    };

    beforeEach(async () => {
      // Register original schema
      await registry.register(originalSchema.name, originalSchema);
    });

    it('should detect conflicts during registration', async () => {
      // Attempt to register conflicting schema
      const registrationResult = await registry.register(conflictingSchema.name, conflictingSchema);
      expect(registrationResult.success).toBe(false);
      expect(registrationResult.errors).toContain(REGISTRY_MESSAGES.SCHEMA_ALREADY_EXISTS);
    });

    it('should detect conflicts via schema manager', async () => {
      const existingRegistrySchema = (await registry.lookup(originalSchema.name)).schema!;
      const conflict = await schemaManager.detectConflicts(existingRegistrySchema, conflictingSchema);
      
      expect(conflict).not.toBeNull();
      expect(conflict?.conflictType).toBe('definition');
      expect(conflict?.existing.name).toBe(originalSchema.name);
      expect(conflict?.incoming.name).toBe(conflictingSchema.name);
    });

    it('should resolve conflicts with replace strategy', async () => {
      const existingRegistrySchema = (await registry.lookup(originalSchema.name)).schema!;
      const conflict = await schemaManager.detectConflicts(existingRegistrySchema, conflictingSchema);
      
      expect(conflict).not.toBeNull();
      
      if (conflict) {
        const resolution = await schemaManager.resolveConflict(conflict, 'replace');
        expect(resolution.success).toBe(true);
        expect(resolution.strategy).toBe('replace');
        expect(resolution.resolvedSchema).toBe(conflictingSchema);
      }
    });

    it('should resolve conflicts with version strategy', async () => {
      const existingRegistrySchema = (await registry.lookup(originalSchema.name)).schema!;
      const conflict = await schemaManager.detectConflicts(existingRegistrySchema, conflictingSchema);
      
      expect(conflict).not.toBeNull();
      
      if (conflict) {
        const resolution = await schemaManager.resolveConflict(conflict, 'version');
        expect(resolution.success).toBe(true);
        expect(resolution.strategy).toBe('version');
        expect(resolution.resolvedSchema?.name).not.toBe(conflictingSchema.name);
        expect(resolution.resolvedSchema?.originalName).toBe(conflictingSchema.name);
      }
    });
  });

  describe('OpenAI Format Integration', () => {
    const openAIToolSchema = {
      type: 'function',
      function: {
        name: 'openai_format_test',
        description: 'Test function in OpenAI format',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Message to process' }
          },
          required: ['message']
        }
      }
    };

    it('should convert from OpenAI format and register', async () => {
      // Convert from OpenAI format
      const registrySchema = RegistryUtils.fromOpenAIFormat(openAIToolSchema);
      expect(registrySchema.name).toBe(openAIToolSchema.function.name);

      // Validate converted schema
      const validationResult = await validator.validateRegistration(registrySchema);
      expect(validationResult.valid).toBe(true);

      // Register converted schema
      const registrationResult = await registry.register(registrySchema.name, registrySchema);
      expect(registrationResult.success).toBe(true);

      // Verify lookup works
      const lookupResult = await registry.lookup(registrySchema.name);
      expect(lookupResult.success).toBe(true);
      expect(lookupResult.schema?.name).toBe(openAIToolSchema.function.name);
    });

    it('should convert to OpenAI format after registration', async () => {
      // Register schema in registry format
      const registrySchema = RegistryUtils.fromOpenAIFormat(openAIToolSchema);
      await registry.register(registrySchema.name, registrySchema);

      // Retrieve and convert back to OpenAI format
      const lookupResult = await registry.lookup(registrySchema.name);
      expect(lookupResult.success).toBe(true);

      const backToOpenAI = RegistryUtils.toOpenAIFormat(lookupResult.schema!.schema);
      expect(backToOpenAI.type).toBe('function');
      expect(backToOpenAI.function.name).toBe(openAIToolSchema.function.name);
      expect(backToOpenAI.function.description).toBe(openAIToolSchema.function.description);
    });

    it('should validate OpenAI compatibility', async () => {
      const isCompatible = RegistryUtils.isRegistryCompatible(openAIToolSchema);
      expect(isCompatible).toBe(true);

      const invalidOpenAI = { type: 'invalid', function: {} };
      const isIncompatible = RegistryUtils.isRegistryCompatible(invalidOpenAI);
      expect(isIncompatible).toBe(false);
    });

    it('should extract metadata from OpenAI schemas', async () => {
      const metadata = RegistryUtils.extractMetadata(openAIToolSchema);
      
      expect(metadata.hasDescription).toBe(true);
      expect(metadata.descriptionLength).toBeGreaterThan(0);
      expect(metadata.parameterCount).toBe(1);
      expect(metadata.hasRequiredParameters).toBe(true);
      expect(metadata.complexity).toBeGreaterThan(0);
    });
  });

  describe('Duplicate Detection Integration', () => {
    const schemas = [
      {
        name: 'duplicate_test_1',
        description: 'First duplicate test schema',
        parameters: { type: 'object', properties: {} }
      },
      {
        name: 'duplicate_test_2',
        description: 'Second duplicate test schema',
        parameters: { type: 'object', properties: {} }
      },
      {
        name: 'duplicate_test_1', // Duplicate name
        description: 'Different implementation',
        parameters: { type: 'object', properties: { param: { type: 'string' } } }
      }
    ];

    beforeEach(async () => {
      // Register first two schemas
      await registry.register(schemas[0].name, schemas[0]);
      await registry.register(schemas[1].name, schemas[1]);
    });

    it('should detect duplicates in registry', async () => {
      const listResult = await registry.list();
      expect(listResult.success).toBe(true);

      const duplicateResult = await validator.detectDuplicates(listResult.schemas);
      expect(duplicateResult.duplicatesFound).toBe(false); // No duplicates yet
      expect(duplicateResult.totalChecked).toBe(2);

      // Try to register duplicate
      const duplicateRegistration = await registry.register(schemas[2].name, schemas[2]);
      expect(duplicateRegistration.success).toBe(false); // Should fail due to conflict
    });

    it('should handle multiple registrations and detect conflicts', async () => {
      const multipleSchemas = [
        { name: 'multi_1', description: 'Schema 1', parameters: { type: 'object' } },
        { name: 'multi_2', description: 'Schema 2', parameters: { type: 'object' } },
        { name: 'multi_3', description: 'Schema 3', parameters: { type: 'object' } },
        { name: 'multi_1', description: 'Conflicting Schema 1', parameters: { type: 'object' } }
      ];

      // Register first three
      for (let i = 0; i < 3; i++) {
        const result = await registry.register(multipleSchemas[i].name, multipleSchemas[i]);
        expect(result.success).toBe(true);
      }

      // Fourth should fail due to duplicate name
      const conflictResult = await registry.register(multipleSchemas[3].name, multipleSchemas[3]);
      expect(conflictResult.success).toBe(false);

      // Verify registry state
      const listResult = await registry.list();
      expect(listResult.totalCount).toBe(5); // 2 from beforeEach + 3 new
    });
  });

  describe('Version Compatibility Integration', () => {
    const versionedSchema = {
      name: 'versioned_test_function',
      description: 'Function for version testing',
      parameters: { type: 'object', properties: {} }
    };

    it('should handle version compatibility checks', async () => {
      // Check current version compatibility
      const currentVersionCheck = await schemaManager.checkVersionCompatibility(SCHEMA_VERSIONS.CURRENT_VERSION);
      expect(currentVersionCheck.compatible).toBe(true);
      expect(currentVersionCheck.migrationRequired).toBe(false);

      // Register with current version
      const registrationResult = await registry.register(
        versionedSchema.name, 
        versionedSchema, 
        SCHEMA_VERSIONS.CURRENT_VERSION
      );
      expect(registrationResult.success).toBe(true);
      expect(registrationResult.schema?.version).toBe(SCHEMA_VERSIONS.CURRENT_VERSION);
    });

    it('should handle unsupported version scenarios', async () => {
      const unsupportedVersion = 'invalid.version';
      
      // Check compatibility
      const versionCheck = await schemaManager.checkVersionCompatibility(unsupportedVersion);
      expect(versionCheck.compatible).toBe(false);

      // Registration should fail due to version validation
      const registrationResult = await registry.register(
        versionedSchema.name, 
        versionedSchema, 
        unsupportedVersion
      );
      expect(registrationResult.success).toBe(false);
      expect(registrationResult.errors).toContain(REGISTRY_MESSAGES.INVALID_SCHEMA_VERSION);
    });

    it('should handle version validation through validator', async () => {
      // Valid version
      expect(validator.validateSchemaVersion('1.0.0')).toBe(true);
      expect(validator.validateSchemaVersion('2.1.3')).toBe(true);

      // Invalid versions
      expect(validator.validateSchemaVersion('1.0')).toBe(false);
      expect(validator.validateSchemaVersion('invalid')).toBe(false);
      expect(validator.validateSchemaVersion('')).toBe(false);
    });
  });

  describe('Performance Integration Tests', () => {
    it('should meet performance requirements for complete workflow', async () => {
      const performanceSchema = {
        name: 'performance_integration_test',
        description: 'Schema for performance testing',
        parameters: {
          type: 'object',
          properties: {
            data: { type: 'string', description: 'Data parameter' }
          }
        }
      };

      const startTime = performance.now();

      // Complete workflow
      const validationResult = await validator.validateRegistration(performanceSchema);
      expect(validationResult.valid).toBe(true);

      const normalizedSchema = await schemaManager.normalizeSchema(performanceSchema);
      const registrationResult = await registry.register(performanceSchema.name, normalizedSchema);
      expect(registrationResult.success).toBe(true);

      const lookupResult = await registry.lookup(performanceSchema.name);
      expect(lookupResult.success).toBe(true);

      const endTime = performance.now();

      // Total workflow should be fast
      expect(endTime - startTime).toBeLessThan(10); // Allow 10ms for complete workflow
    });

    it('should handle bulk operations efficiently', async () => {
      const bulkSchemas = Array.from({ length: 50 }, (_, i) => ({
        name: `bulk_test_${i}`,
        description: `Bulk test schema ${i}`,
        parameters: { type: 'object', properties: {} }
      }));

      const startTime = performance.now();

      // Register all schemas
      for (const schema of bulkSchemas) {
        const result = await registry.register(schema.name, schema);
        expect(result.success).toBe(true);
      }

      // List all schemas
      const listResult = await registry.list();
      expect(listResult.success).toBe(true);
      expect(listResult.totalCount).toBeGreaterThanOrEqual(50);

      const endTime = performance.now();

      // Bulk operations should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(100); // Allow 100ms for 50 operations
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle cascading errors gracefully', async () => {
      // Create a simple invalid schema instead of using getter errors
      const problematicSchema = null;

      // Validation should handle error
      const validationResult = await validator.validateRegistration(problematicSchema);
      expect(validationResult.valid).toBe(false);

      // Registration should handle error
      const registrationResult = await registry.register('error_test', problematicSchema);
      expect(registrationResult.success).toBe(false);

      // Registry should remain functional
      const listResult = await registry.list();
      expect(listResult.success).toBe(true);
    });

    it('should maintain registry integrity during errors', async () => {
      // Register some valid schemas first
      const validSchemas = [
        { name: 'valid_1', description: 'Valid schema 1', parameters: { type: 'object' } },
        { name: 'valid_2', description: 'Valid schema 2', parameters: { type: 'object' } }
      ];

      for (const schema of validSchemas) {
        const result = await registry.register(schema.name, schema);
        expect(result.success).toBe(true);
      }

      // Attempt invalid operations
      const invalidResult = await registry.register('', null as any);
      expect(invalidResult.success).toBe(false);

      // Registry should still contain valid schemas
      const listResult = await registry.list();
      expect(listResult.success).toBe(true);
      expect(listResult.totalCount).toBeGreaterThanOrEqual(2);

      // Valid operations should still work
      const lookupResult = await registry.lookup('valid_1');
      expect(lookupResult.success).toBe(true);
    });
  });

  describe('Registry Limits Integration', () => {
    it('should enforce registry limits across components', async () => {
      // Test name length limits
      const tooLongName = 'a'.repeat(REGISTRY_LIMITS.MAX_SCHEMA_NAME_LENGTH + 1);
      const longNameSchema = {
        name: tooLongName,
        description: 'Schema with too long name',
        parameters: { type: 'object' }
      };

      // Validator should reject
      expect(validator.validateSchemaName(tooLongName)).toBe(false);

      // Registration should fail
      const registrationResult = await registry.register(tooLongName, longNameSchema);
      expect(registrationResult.success).toBe(false);
    });

    it('should enforce description length limits', async () => {
      const tooLongDescription = 'a'.repeat(REGISTRY_LIMITS.MAX_SCHEMA_DESCRIPTION_LENGTH + 1);
      const longDescSchema = {
        name: 'valid_name',
        description: tooLongDescription,
        parameters: { type: 'object' }
      };

      // Validation should fail
      const validationResult = await validator.validateRegistration(longDescSchema);
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.some(e => e.includes('Description exceeds maximum length'))).toBe(true);
    });
  });
});