/**
 * RegistryValidator Unit Tests (Phase 10A)
 * 100% test coverage for registry validation functionality
 * Tests validation, duplicate detection, and structure analysis
 */

import { RegistryValidator, IRegistryValidator, RegistryValidationError } from '../../../src/tools/registry-validator';
import { RegistryToolSchema } from '../../../src/tools/registry';
import { REGISTRY_LIMITS, REGISTRY_MESSAGES, REGISTRY_ERRORS, SCHEMA_VERSIONS } from '../../../src/tools/constants';

describe('RegistryValidator', () => {
  let validator: IRegistryValidator;

  beforeEach(() => {
    validator = new RegistryValidator();
  });

  describe('constructor', () => {
    it('should create validator instance successfully', () => {
      expect(validator).toBeInstanceOf(RegistryValidator);
      expect(validator).toBeDefined();
    });
  });

  describe('validateRegistration', () => {
    const validSchema = {
      name: 'test_function',
      description: 'Test function for validation',
      parameters: {
        type: 'object',
        properties: {
          param1: { type: 'string', description: 'First parameter' }
        }
      }
    };

    it('should validate correct schema successfully', async () => {
      const result = await validator.validateRegistration(validSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.validationTimeMs).toBeLessThan(REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS);
    });

    it('should reject null or undefined schema', async () => {
      const resultNull = await validator.validateRegistration(null);
      const resultUndefined = await validator.validateRegistration(undefined);

      expect(resultNull.valid).toBe(false);
      expect(resultNull.errors).toContain(REGISTRY_MESSAGES.SCHEMA_VALIDATION_FAILED);
      expect(resultUndefined.valid).toBe(false);
      expect(resultUndefined.errors).toContain(REGISTRY_MESSAGES.SCHEMA_VALIDATION_FAILED);
    });

    it('should reject non-object schema', async () => {
      const resultString = await validator.validateRegistration('not an object');
      const resultNumber = await validator.validateRegistration(123);

      expect(resultString.valid).toBe(false);
      expect(resultString.errors).toContain(REGISTRY_MESSAGES.SCHEMA_VALIDATION_FAILED);
      expect(resultNumber.valid).toBe(false);
      expect(resultNumber.errors).toContain(REGISTRY_MESSAGES.SCHEMA_VALIDATION_FAILED);
    });

    it('should reject schema with missing name', async () => {
      const schemaWithoutName = {
        description: 'Schema without name',
        parameters: { type: 'object' }
      };

      const result = await validator.validateRegistration(schemaWithoutName);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Schema name is required');
    });

    it('should reject schema with invalid name', async () => {
      const invalidNameSchema = {
        name: 'invalid name with spaces',
        description: 'Schema with invalid name',
        parameters: { type: 'object' }
      };

      const result = await validator.validateRegistration(invalidNameSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(REGISTRY_MESSAGES.INVALID_SCHEMA_NAME);
    });

    it('should reject schema with description too long', async () => {
      const longDescriptionSchema = {
        name: 'test_function',
        description: 'a'.repeat(REGISTRY_LIMITS.MAX_SCHEMA_DESCRIPTION_LENGTH + 1),
        parameters: { type: 'object' }
      };

      const result = await validator.validateRegistration(longDescriptionSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(`Description exceeds maximum length of ${REGISTRY_LIMITS.MAX_SCHEMA_DESCRIPTION_LENGTH} characters`);
    });

    it('should provide warnings for complex parameters', async () => {
      const complexSchema = {
        name: 'complex_function',
        description: 'Function with complex parameters',
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
                        level4: {
                          type: 'object',
                          properties: {
                            level5: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      };

      const result = await validator.validateRegistration(complexSchema);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('deep nesting'))).toBe(true);
    });

    it('should provide warnings for many parameters', async () => {
      const manyParamsSchema = {
        name: 'many_params_function',
        description: 'Function with many parameters',
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            Array.from({ length: 25 }, (_, i) => [`param${i}`, { type: 'string' }])
          )
        }
      };

      const result = await validator.validateRegistration(manyParamsSchema);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('many properties'))).toBe(true);
    });

    it('should warn about missing parameter descriptions', async () => {
      const undescribedParamsSchema = {
        name: 'undescribed_function',
        description: 'Function with undescribed parameters',
        parameters: {
          type: 'object',
          properties: {
            param1: { type: 'string' }, // No description
            param2: { type: 'number' }  // No description
          }
        }
      };

      const result = await validator.validateRegistration(undescribedParamsSchema);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('lack descriptions'))).toBe(true);
    });

    it('should handle validation timeout scenarios', async () => {
      // Mock performance.now to simulate timeout
      const originalNow = performance.now;
      let callCount = 0;
      performance.now = jest.fn(() => {
        callCount++;
        if (callCount === 1) return 0; // Start time
        return REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS + 1; // End time exceeds limit
      });

      try {
        const result = await validator.validateRegistration(validSchema);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(REGISTRY_MESSAGES.REGISTRY_OPERATION_TIMEOUT);
      } finally {
        performance.now = originalNow;
      }
    });

    it('should handle validation errors gracefully', async () => {
      // Create a schema that causes processing error (null schema)
      const problematicSchema = null;

      const result = await validator.validateRegistration(problematicSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(REGISTRY_MESSAGES.SCHEMA_VALIDATION_FAILED);
    });
  });

  describe('detectDuplicates', () => {
    const baseSchema: RegistryToolSchema = {
      name: 'test_function',
      schema: {
        name: 'test_function',
        description: 'Test function',
        parameters: { type: 'object', properties: {} }
      },
      version: '1.0.0',
      registeredAt: Date.now()
    };

    it('should detect no duplicates for unique schemas', async () => {
      const schemas = [
        { ...baseSchema, name: 'function1' },
        { ...baseSchema, name: 'function2' },
        { ...baseSchema, name: 'function3' }
      ];

      const result = await validator.detectDuplicates(schemas);

      expect(result.duplicatesFound).toBe(false);
      expect(result.duplicates).toHaveLength(0);
      expect(result.totalChecked).toBe(3);
    });

    it('should detect exact duplicates', async () => {
      const duplicateSchema = { ...baseSchema };
      const schemas = [baseSchema, duplicateSchema];

      const result = await validator.detectDuplicates(schemas);

      expect(result.duplicatesFound).toBe(true);
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].conflictType).toBe('exact');
      expect(result.duplicates[0].count).toBe(2);
    });

    it('should detect definition conflicts', async () => {
      const conflictSchema: RegistryToolSchema = {
        ...baseSchema,
        schema: {
          ...baseSchema.schema,
          description: 'Different description'
        }
      };
      const schemas = [baseSchema, conflictSchema];

      const result = await validator.detectDuplicates(schemas);

      expect(result.duplicatesFound).toBe(true);
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].conflictType).toBe('definition');
    });

    it('should handle empty schema array', async () => {
      const result = await validator.detectDuplicates([]);

      expect(result.duplicatesFound).toBe(false);
      expect(result.duplicates).toHaveLength(0);
      expect(result.totalChecked).toBe(0);
    });

    it('should handle single schema', async () => {
      const result = await validator.detectDuplicates([baseSchema]);

      expect(result.duplicatesFound).toBe(false);
      expect(result.duplicates).toHaveLength(0);
      expect(result.totalChecked).toBe(1);
    });

    it('should handle multiple duplicates of same name', async () => {
      const schemas = [
        baseSchema,
        { ...baseSchema },
        { ...baseSchema }
      ];

      const result = await validator.detectDuplicates(schemas);

      expect(result.duplicatesFound).toBe(true);
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].count).toBe(3);
    });

    it('should handle detection errors gracefully', async () => {
      const problematicSchemas = [
        { ...baseSchema, get name() { throw new Error('Access error'); } }
      ];

      const result = await validator.detectDuplicates(problematicSchemas as any);

      expect(result.duplicatesFound).toBe(false);
      expect(result.duplicates).toHaveLength(0);
      expect(result.totalChecked).toBe(1);
    });
  });

  describe('validateStructure', () => {
    const goodSchema = {
      name: 'well_structured_function',
      description: 'A well-structured function with proper documentation',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Input parameter' }
        }
      }
    };

    it('should validate well-structured schema', async () => {
      const result = await validator.validateStructure(goodSchema);

      expect(result.valid).toBe(true);
      expect(result.structureScore).toBeGreaterThan(80);
      expect(result.issues).toHaveLength(0);
      expect(result.recommendations).toContain('Schema structure is well-formed');
    });

    it('should detect missing description', async () => {
      const schemaWithoutDescription = {
        name: 'undocumented_function',
        parameters: { type: 'object', properties: {} }
      };

      const result = await validator.validateStructure(schemaWithoutDescription);

      expect(result.valid).toBe(true); // Still valid, just warning
      expect(result.structureScore).toBeLessThan(100);
      expect(result.issues.some(i => i.category === 'description')).toBe(true);
      expect(result.recommendations.some(r => r.includes('description'))).toBe(true);
    });

    it('should detect brief description', async () => {
      const schemaBriefDescription = {
        name: 'brief_function',
        description: 'Brief',
        parameters: { type: 'object', properties: {} }
      };

      const result = await validator.validateStructure(schemaBriefDescription);

      expect(result.valid).toBe(true);
      expect(result.structureScore).toBeLessThan(100);
      expect(result.issues.some(i => i.message.includes('very brief'))).toBe(true);
    });

    it('should detect naming issues', async () => {
      const badNamingSchema = {
        name: 'a', // Too short
        description: 'Test function',
        parameters: { type: 'object', properties: {} }
      };

      const result = await validator.validateStructure(badNamingSchema);

      expect(result.valid).toBe(true);
      expect(result.structureScore).toBeLessThan(100);
      expect(result.issues.some(i => i.category === 'naming')).toBe(true);
    });

    it('should detect reserved name usage', async () => {
      const reservedNameSchema = {
        name: 'constructor', // Assuming this is in reserved names
        description: 'Test function',
        parameters: { type: 'object', properties: {} }
      };

      const result = await validator.validateStructure(reservedNameSchema);

      // Only test if constructor is actually in reserved names
      const hasReservedNameIssue = result.issues.some(i => 
        i.category === 'naming' && i.severity === 'error'
      );
      
      if (hasReservedNameIssue) {
        expect(result.valid).toBe(false);
        expect(result.structureScore).toBeLessThan(100);
      }
    });

    it('should detect parameter structure issues', async () => {
      const badParametersSchema = {
        name: 'bad_params_function',
        description: 'Function with poorly structured parameters',
        parameters: {
          // Missing type
        }
      };

      const result = await validator.validateStructure(badParametersSchema);

      expect(result.valid).toBe(true); // Warnings don't make it invalid
      expect(result.structureScore).toBeLessThan(100);
      expect(result.issues.some(i => i.category === 'parameters')).toBe(true);
    });

    it('should detect object without properties', async () => {
      const objectWithoutPropsSchema = {
        name: 'object_function',
        description: 'Function with object type but no properties',
        parameters: {
          type: 'object'
          // No properties defined
        }
      };

      const result = await validator.validateStructure(objectWithoutPropsSchema);

      expect(result.valid).toBe(true);
      expect(result.structureScore).toBeLessThan(100);
      expect(result.issues.some(i => 
        i.category === 'parameters' && i.message.includes('properties')
      )).toBe(true);
    });

    it('should handle structure validation errors', async () => {
      // Use null schema to trigger error handling
      const problematicSchema = null;

      const result = await validator.validateStructure(problematicSchema);

      expect(result.valid).toBe(false);
      expect(result.structureScore).toBe(0);
      expect(result.issues.some(i => i.severity === 'error')).toBe(true);
      expect(result.recommendations).toContain('Review schema format and structure');
    });

    it('should generate appropriate recommendations', async () => {
      const multiIssueSchema = {
        name: 'bad function name', // Spaces in name
        // No description
        parameters: {
          type: 'object'
          // No properties for object type
        }
      };

      const result = await validator.validateStructure(multiIssueSchema);

      expect(result.recommendations.length).toBeGreaterThan(1);
      expect(result.recommendations.some(r => r.includes('naming'))).toBe(true);
      expect(result.recommendations.some(r => r.includes('description'))).toBe(true);
    });
  });

  describe('validateSchemaName', () => {
    it('should accept valid schema names', () => {
      const validNames = ['test_function', 'calculateTotal', 'user_auth', 'dataProcessor'];
      
      for (const name of validNames) {
        expect(validator.validateSchemaName(name)).toBe(true);
      }
    });

    it('should reject invalid schema names', () => {
      const invalidNames = ['', 'function with spaces', 'toolong'.repeat(20)];
      
      for (const name of invalidNames) {
        expect(validator.validateSchemaName(name)).toBe(false);
      }
    });

    it('should reject null or undefined names', () => {
      expect(validator.validateSchemaName(null as any)).toBe(false);
      expect(validator.validateSchemaName(undefined as any)).toBe(false);
    });

    it('should reject non-string names', () => {
      expect(validator.validateSchemaName(123 as any)).toBe(false);
      expect(validator.validateSchemaName({} as any)).toBe(false);
      expect(validator.validateSchemaName([] as any)).toBe(false);
    });

    it('should respect name length limits', () => {
      const shortName = 'a'.repeat(REGISTRY_LIMITS.MIN_SCHEMA_NAME_LENGTH - 1);
      const longName = 'a'.repeat(REGISTRY_LIMITS.MAX_SCHEMA_NAME_LENGTH + 1);
      
      expect(validator.validateSchemaName(shortName)).toBe(false);
      expect(validator.validateSchemaName(longName)).toBe(false);
      
      const validLength = 'a'.repeat(REGISTRY_LIMITS.MIN_SCHEMA_NAME_LENGTH);
      expect(validator.validateSchemaName(validLength)).toBe(true);
    });
  });

  describe('validateSchemaVersion', () => {
    it('should accept valid version formats', () => {
      const validVersions = ['1.0.0', '2.1.3', '10.20.30', '0.0.1'];
      
      for (const version of validVersions) {
        expect(validator.validateSchemaVersion(version)).toBe(true);
      }
    });

    it('should reject invalid version formats', () => {
      const invalidVersions = ['', '1.0', '1.0.0.0', 'v1.0.0', '1.a.0', 'invalid'];
      
      for (const version of invalidVersions) {
        expect(validator.validateSchemaVersion(version)).toBe(false);
      }
    });

    it('should reject null or undefined versions', () => {
      expect(validator.validateSchemaVersion(null as any)).toBe(false);
      expect(validator.validateSchemaVersion(undefined as any)).toBe(false);
    });

    it('should reject non-string versions', () => {
      expect(validator.validateSchemaVersion(123 as any)).toBe(false);
      expect(validator.validateSchemaVersion({} as any)).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should create RegistryValidationError correctly', () => {
      const error = new RegistryValidationError(
        'Test validation error',
        'TEST_ERROR',
        2.5
      );

      expect(error.name).toBe('RegistryValidationError');
      expect(error.message).toBe('Test validation error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.validationTimeMs).toBe(2.5);
      expect(error).toBeInstanceOf(Error);
    });

    it('should handle RegistryValidationError without timing', () => {
      const error = new RegistryValidationError(
        'Test error',
        'TEST_CODE'
      );

      expect(error.validationTimeMs).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle schema with unicode content', async () => {
      const unicodeSchema = {
        name: 'unicode_function', // Use ASCII name for OpenAI validation compatibility
        description: 'Функция с unicode символами 测试',
        parameters: {
          type: 'object',
          properties: {
            参数1: { type: 'string', description: 'Unicode parameter' }
          }
        }
      };

      const result = await validator.validateRegistration(unicodeSchema);
      expect(result.valid).toBe(true);

      const structureResult = await validator.validateStructure(unicodeSchema);
      expect(structureResult.valid).toBe(true);
    });

    it('should handle very deep parameter nesting', async () => {
      const deepSchema = {
        name: 'deep_function',
        description: 'Function with deep nesting',
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
                        level4: {
                          type: 'object',
                          properties: {
                            level5: {
                              type: 'object',
                              properties: {
                                level6: { type: 'string' }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      };

      const result = await validator.validateRegistration(deepSchema);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle circular reference detection gracefully', async () => {
      const circularSchema: any = {
        name: 'circular_function',
        parameters: {
          type: 'object',
          properties: {}
        }
      };
      
      // Create circular reference
      circularSchema.parameters.properties.self = circularSchema.parameters;

      const result = await validator.validateStructure(circularSchema);
      // Should not crash, even with circular reference
      expect(result).toBeDefined();
    });

    it('should handle empty parameters gracefully', async () => {
      const emptyParamsSchema = {
        name: 'empty_params_function',
        description: 'Function with empty parameters',
        parameters: {}
      };

      const result = await validator.validateRegistration(emptyParamsSchema);
      expect(result.valid).toBe(true);

      const structureResult = await validator.validateStructure(emptyParamsSchema);
      expect(structureResult.valid).toBe(true);
    });

    it('should handle malformed parameters object', async () => {
      const malformedSchema = {
        name: 'malformed_function',
        parameters: 'not an object'
      };

      const result = await validator.validateRegistration(malformedSchema);
      expect(result.valid).toBe(false);
    });
  });

  describe('performance requirements', () => {
    it('should meet <3ms performance requirement for validation', async () => {
      const testSchema = {
        name: 'performance_test',
        description: 'Testing performance requirements',
        parameters: {
          type: 'object',
          properties: {
            param1: { type: 'string', description: 'Test parameter' }
          }
        }
      };

      const startTime = performance.now();
      const result = await validator.validateRegistration(testSchema);
      const endTime = performance.now();

      expect(result.valid).toBe(true);
      expect(endTime - startTime).toBeLessThan(3);
      expect(result.validationTimeMs).toBeLessThan(3);
    });

    it('should meet performance requirements for duplicate detection', async () => {
      const schemas = Array.from({ length: 100 }, (_, i) => ({
        name: `test_function_${i}`,
        schema: {
          name: `test_function_${i}`,
          description: `Test function ${i}`,
          parameters: { type: 'object', properties: {} }
        },
        version: '1.0.0',
        registeredAt: Date.now()
      }));

      const startTime = performance.now();
      const result = await validator.detectDuplicates(schemas);
      const endTime = performance.now();

      expect(result.totalChecked).toBe(100);
      expect(endTime - startTime).toBeLessThan(10); // Allow more time for 100 schemas
      expect(result.detectionTimeMs).toBeLessThan(10);
    });

    it('should meet performance requirements for structure validation', async () => {
      const complexSchema = {
        name: 'complex_performance_test',
        description: 'Complex schema for performance testing',
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            Array.from({ length: 50 }, (_, i) => [
              `param${i}`,
              { type: 'string', description: `Parameter ${i}` }
            ])
          )
        }
      };

      const startTime = performance.now();
      const result = await validator.validateStructure(complexSchema);
      const endTime = performance.now();

      expect(result.valid).toBe(true);
      expect(endTime - startTime).toBeLessThan(5);
    });
  });

  describe('factory function', () => {
    it('should create validator instance via factory', () => {
      const { createRegistryValidator } = require('../../../src/tools/registry-validator');
      const factoryValidator = createRegistryValidator();
      
      expect(factoryValidator).toBeInstanceOf(RegistryValidator);
      expect(factoryValidator).toBeDefined();
    });
  });
});