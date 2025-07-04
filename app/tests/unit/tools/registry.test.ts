/**
 * ToolRegistry Unit Tests (Phase 10A)
 * 100% test coverage for tool registry functionality
 * Tests performance requirement: <3ms registry operations
 */

import { ToolRegistry, IToolRegistry, RegistryError } from '../../../src/tools/registry';
import { REGISTRY_LIMITS, REGISTRY_MESSAGES, SCHEMA_VERSIONS } from '../../../src/tools/constants';

describe('ToolRegistry', () => {
  let registry: IToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('constructor', () => {
    it('should create registry instance successfully', () => {
      expect(registry).toBeInstanceOf(ToolRegistry);
      expect(registry).toBeDefined();
    });
  });

  describe('register', () => {
    const validSchema = {
      name: 'test_function',
      description: 'Test function for registry',
      parameters: {
        type: 'object',
        properties: {
          param1: { type: 'string', description: 'First parameter' }
        }
      }
    };

    it('should register valid schema successfully', async () => {
      const result = await registry.register('test_function', validSchema);

      expect(result.success).toBe(true);
      expect(result.schema).toBeDefined();
      expect(result.schema?.name).toBe('test_function');
      expect(result.schema?.version).toBe(SCHEMA_VERSIONS.DEFAULT_VERSION);
      expect(result.errors).toHaveLength(0);
      expect(result.operationTimeMs).toBeLessThan(REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS);
    });

    it('should meet performance requirement (<3ms)', async () => {
      const startTime = performance.now();
      const result = await registry.register('perf_test', validSchema);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(3);
      expect(result.operationTimeMs).toBeLessThan(3);
    });

    it('should register schema with custom version', async () => {
      const customVersion = '2.1.0';
      const result = await registry.register('versioned_function', validSchema, customVersion);

      expect(result.success).toBe(true);
      expect(result.schema?.version).toBe(customVersion);
    });

    it('should reject registration with invalid name', async () => {
      const result = await registry.register('', validSchema);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(REGISTRY_MESSAGES.INVALID_SCHEMA_NAME);
    });

    it('should reject registration with null name', async () => {
      const result = await registry.register(null as any, validSchema);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(REGISTRY_MESSAGES.INVALID_SCHEMA_NAME);
    });

    it('should reject registration with invalid schema', async () => {
      const result = await registry.register('invalid_schema', null);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(REGISTRY_MESSAGES.SCHEMA_VALIDATION_FAILED);
    });

    it('should reject registration with invalid version', async () => {
      const result = await registry.register('test_function', validSchema, 'invalid.version');

      expect(result.success).toBe(false);
      expect(result.errors).toContain(REGISTRY_MESSAGES.INVALID_SCHEMA_VERSION);
    });

    it('should reject duplicate schema registration', async () => {
      // First registration should succeed
      const firstResult = await registry.register('duplicate_test', validSchema);
      expect(firstResult.success).toBe(true);

      // Second registration should fail
      const secondResult = await registry.register('duplicate_test', validSchema);
      expect(secondResult.success).toBe(false);
      expect(secondResult.errors).toContain(REGISTRY_MESSAGES.SCHEMA_ALREADY_EXISTS);
    });

    it('should handle schema with long name within limits', async () => {
      const longName = 'a'.repeat(REGISTRY_LIMITS.MAX_SCHEMA_NAME_LENGTH);
      const result = await registry.register(longName, validSchema);

      expect(result.success).toBe(true);
      expect(result.schema?.name).toBe(longName);
    });

    it('should reject schema with name too long', async () => {
      const tooLongName = 'a'.repeat(REGISTRY_LIMITS.MAX_SCHEMA_NAME_LENGTH + 1);
      const result = await registry.register(tooLongName, validSchema);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(REGISTRY_MESSAGES.INVALID_SCHEMA_NAME);
    });

    it('should handle registration timeout scenarios', async () => {
      // Mock performance.now to simulate timeout
      const originalNow = performance.now;
      let callCount = 0;
      performance.now = jest.fn(() => {
        callCount++;
        if (callCount === 1) return 0; // Start time
        return REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS + 1; // End time exceeds limit
      });

      try {
        const result = await registry.register('timeout_test', validSchema);
        expect(result.success).toBe(false);
        expect(result.errors).toContain(REGISTRY_MESSAGES.REGISTRY_OPERATION_TIMEOUT);
      } finally {
        performance.now = originalNow;
      }
    });

    it('should handle registration errors gracefully', async () => {
      // Create a problematic schema (null)
      const problematicSchema = null;

      const result = await registry.register('error_test', problematicSchema);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(REGISTRY_MESSAGES.SCHEMA_VALIDATION_FAILED);
    });
  });

  describe('lookup', () => {
    const testSchema = {
      name: 'lookup_test',
      description: 'Test schema for lookup',
      parameters: { type: 'object', properties: {} }
    };

    beforeEach(async () => {
      await registry.register('lookup_test', testSchema);
    });

    it('should lookup existing schema successfully', async () => {
      const result = await registry.lookup('lookup_test');

      expect(result.success).toBe(true);
      expect(result.schema).toBeDefined();
      expect(result.schema?.name).toBe('lookup_test');
      expect(result.errors).toHaveLength(0);
      expect(result.operationTimeMs).toBeLessThan(REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS);
    });

    it('should meet performance requirement (<3ms)', async () => {
      const startTime = performance.now();
      const result = await registry.lookup('lookup_test');
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(3);
      expect(result.operationTimeMs).toBeLessThan(3);
    });

    it('should return not found for non-existent schema', async () => {
      const result = await registry.lookup('non_existent');

      expect(result.success).toBe(false);
      expect(result.schema).toBeUndefined();
      expect(result.errors).toContain(REGISTRY_MESSAGES.SCHEMA_NOT_FOUND);
    });

    it('should reject lookup with invalid name', async () => {
      const result = await registry.lookup('');

      expect(result.success).toBe(false);
      expect(result.errors).toContain(REGISTRY_MESSAGES.INVALID_SCHEMA_NAME);
    });

    it('should reject lookup with null name', async () => {
      const result = await registry.lookup(null as any);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(REGISTRY_MESSAGES.INVALID_SCHEMA_NAME);
    });

    it('should handle lookup timeout scenarios', async () => {
      // Mock performance.now to simulate timeout
      const originalNow = performance.now;
      let callCount = 0;
      performance.now = jest.fn(() => {
        callCount++;
        if (callCount === 1) return 0; // Start time
        return REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS + 1; // End time exceeds limit
      });

      try {
        const result = await registry.lookup('lookup_test');
        expect(result.success).toBe(false);
        expect(result.errors).toContain(REGISTRY_MESSAGES.REGISTRY_OPERATION_TIMEOUT);
      } finally {
        performance.now = originalNow;
      }
    });

    it('should handle lookup errors gracefully', async () => {
      // Mock registry instance to throw error during lookup
      const registryInstance = registry as any;
      const originalGet = registryInstance.schemas?.get;
      
      if (registryInstance.schemas) {
        registryInstance.schemas.get = jest.fn(() => {
          throw new Error('Lookup error');
        });
      }

      try {
        const result = await registry.lookup('lookup_test');
        expect(result.success).toBe(false);
        expect(result.errors).toContain(REGISTRY_MESSAGES.SCHEMA_NOT_FOUND);
      } finally {
        if (registryInstance.schemas && originalGet) {
          registryInstance.schemas.get = originalGet;
        }
      }
    });
  });

  describe('unregister', () => {
    const testSchema = {
      name: 'unregister_test',
      description: 'Test schema for unregistration',
      parameters: { type: 'object', properties: {} }
    };

    beforeEach(async () => {
      await registry.register('unregister_test', testSchema);
    });

    it('should unregister existing schema successfully', async () => {
      const result = await registry.unregister('unregister_test');

      expect(result.success).toBe(true);
      expect(result.schema).toBeDefined();
      expect(result.schema?.name).toBe('unregister_test');
      expect(result.errors).toHaveLength(0);
      expect(result.operationTimeMs).toBeLessThan(REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS);

      // Verify schema is actually removed
      const lookupResult = await registry.lookup('unregister_test');
      expect(lookupResult.success).toBe(false);
    });

    it('should meet performance requirement (<3ms)', async () => {
      const startTime = performance.now();
      const result = await registry.unregister('unregister_test');
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(3);
      expect(result.operationTimeMs).toBeLessThan(3);
    });

    it('should return not found for non-existent schema', async () => {
      const result = await registry.unregister('non_existent');

      expect(result.success).toBe(false);
      expect(result.errors).toContain(REGISTRY_MESSAGES.SCHEMA_NOT_FOUND);
    });

    it('should reject unregister with invalid name', async () => {
      const result = await registry.unregister('');

      expect(result.success).toBe(false);
      expect(result.errors).toContain(REGISTRY_MESSAGES.INVALID_SCHEMA_NAME);
    });

    it('should reject unregister with null name', async () => {
      const result = await registry.unregister(null as any);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(REGISTRY_MESSAGES.INVALID_SCHEMA_NAME);
    });

    it('should handle unregister timeout scenarios', async () => {
      // Mock performance.now to simulate timeout
      const originalNow = performance.now;
      let callCount = 0;
      performance.now = jest.fn(() => {
        callCount++;
        if (callCount === 1) return 0; // Start time
        return REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS + 1; // End time exceeds limit
      });

      try {
        const result = await registry.unregister('unregister_test');
        expect(result.success).toBe(false);
        expect(result.errors).toContain(REGISTRY_MESSAGES.REGISTRY_OPERATION_TIMEOUT);
      } finally {
        performance.now = originalNow;
      }
    });
  });

  describe('list', () => {
    const schemas = [
      { name: 'schema1', description: 'First schema', parameters: { type: 'object' } },
      { name: 'schema2', description: 'Second schema', parameters: { type: 'object' } },
      { name: 'schema3', description: 'Third schema', parameters: { type: 'object' } }
    ];

    beforeEach(async () => {
      for (const schema of schemas) {
        await registry.register(schema.name, schema);
      }
    });

    it('should list all registered schemas successfully', async () => {
      const result = await registry.list();

      expect(result.success).toBe(true);
      expect(result.schemas).toHaveLength(3);
      expect(result.totalCount).toBe(3);
      expect(result.errors).toHaveLength(0);
      expect(result.operationTimeMs).toBeLessThan(REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS);

      const schemaNames = result.schemas.map(s => s.name);
      expect(schemaNames).toContain('schema1');
      expect(schemaNames).toContain('schema2');
      expect(schemaNames).toContain('schema3');
    });

    it('should meet performance requirement (<3ms)', async () => {
      const startTime = performance.now();
      const result = await registry.list();
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(3);
      expect(result.operationTimeMs).toBeLessThan(3);
    });

    it('should return empty list for new registry', async () => {
      const newRegistry = new ToolRegistry();
      const result = await newRegistry.list();

      expect(result.success).toBe(true);
      expect(result.schemas).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should handle list timeout scenarios', async () => {
      // Mock performance.now to simulate timeout
      const originalNow = performance.now;
      let callCount = 0;
      performance.now = jest.fn(() => {
        callCount++;
        if (callCount === 1) return 0; // Start time
        return REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS + 1; // End time exceeds limit
      });

      try {
        const result = await registry.list();
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      } finally {
        performance.now = originalNow;
      }
    });

    it('should handle list errors gracefully', async () => {
      // Mock registry instance to throw error during list
      const registryInstance = registry as any;
      const originalValues = Array.from;
      
      Array.from = jest.fn(() => {
        throw new Error('List error');
      });

      try {
        const result = await registry.list();
        expect(result.success).toBe(false);
        expect(result.schemas).toHaveLength(0);
        expect(result.totalCount).toBe(0);
      } finally {
        Array.from = originalValues;
      }
    });
  });

  describe('clear', () => {
    beforeEach(async () => {
      await registry.register('test1', { name: 'test1', parameters: {} });
      await registry.register('test2', { name: 'test2', parameters: {} });
    });

    it('should clear all schemas successfully', async () => {
      const result = await registry.clear();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.operationTimeMs).toBeLessThan(REGISTRY_LIMITS.REGISTRY_OPERATION_TIMEOUT_MS);

      // Verify registry is actually cleared
      const listResult = await registry.list();
      expect(listResult.totalCount).toBe(0);
    });

    it('should meet performance requirement (<3ms)', async () => {
      const startTime = performance.now();
      const result = await registry.clear();
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(3);
      expect(result.operationTimeMs).toBeLessThan(3);
    });

    it('should handle clear on empty registry', async () => {
      const newRegistry = new ToolRegistry();
      const result = await newRegistry.clear();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle clear errors gracefully', async () => {
      // Mock registry instance to throw error during clear
      const registryInstance = registry as any;
      const originalClear = registryInstance.schemas?.clear;
      
      if (registryInstance.schemas) {
        registryInstance.schemas.clear = jest.fn(() => {
          throw new Error('Clear error');
        });
      }

      try {
        const result = await registry.clear();
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      } finally {
        if (registryInstance.schemas && originalClear) {
          registryInstance.schemas.clear = originalClear;
        }
      }
    });
  });

  describe('getStats', () => {
    it('should return correct stats for empty registry', () => {
      const stats = (registry as any).getStats();

      expect(stats.totalSchemas).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.oldestSchema).toBeUndefined();
      expect(stats.newestSchema).toBeUndefined();
      expect(stats.versions).toEqual({});
    });

    it('should return correct stats with schemas', async () => {
      await registry.register('test1', { name: 'test1', parameters: {} }, '1.0.0');
      await registry.register('test2', { name: 'test2', parameters: {} }, '1.1.0');
      await registry.register('test3', { name: 'test3', parameters: {} }, '1.0.0');

      const stats = (registry as any).getStats();

      expect(stats.totalSchemas).toBe(3);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.oldestSchema).toBeDefined();
      expect(stats.newestSchema).toBeDefined();
      expect(stats.versions['1.0.0']).toBe(2);
      expect(stats.versions['1.1.0']).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should create RegistryError correctly', () => {
      const error = new RegistryError(
        'Test registry error',
        'TEST_ERROR',
        2.5,
        'test_schema'
      );

      expect(error.name).toBe('RegistryError');
      expect(error.message).toBe('Test registry error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.operationTimeMs).toBe(2.5);
      expect(error.schemaName).toBe('test_schema');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('registry limits', () => {
    it('should respect schema count limits', async () => {
      // Mock registry limits for testing
      const originalLimit = REGISTRY_LIMITS.MAX_SCHEMAS_PER_REGISTRY;
      (REGISTRY_LIMITS as any).MAX_SCHEMAS_PER_REGISTRY = 2;

      try {
        // Register up to limit
        await registry.register('schema1', { name: 'schema1', parameters: {} });
        await registry.register('schema2', { name: 'schema2', parameters: {} });

        // This should fail due to limit
        const result = await registry.register('schema3', { name: 'schema3', parameters: {} });
        expect(result.success).toBe(false);
        expect(result.errors).toContain(REGISTRY_MESSAGES.REGISTRY_SCHEMA_LIMIT_EXCEEDED);
      } finally {
        (REGISTRY_LIMITS as any).MAX_SCHEMAS_PER_REGISTRY = originalLimit;
      }
    });

    it('should validate name length limits', async () => {
      const shortName = 'a'.repeat(REGISTRY_LIMITS.MIN_SCHEMA_NAME_LENGTH - 1);
      const result = await registry.register(shortName, { name: shortName, parameters: {} });

      expect(result.success).toBe(false);
      expect(result.errors).toContain(REGISTRY_MESSAGES.INVALID_SCHEMA_NAME);
    });
  });

  describe('edge cases', () => {
    it('should handle complex schema structures', async () => {
      const complexSchema = {
        name: 'complex_function',
        description: 'A complex function with nested parameters',
        parameters: {
          type: 'object',
          properties: {
            basic: { type: 'string', description: 'Basic parameter' },
            nested: {
              type: 'object',
              properties: {
                level2: {
                  type: 'object',
                  properties: {
                    level3: { type: 'string', description: 'Deep nesting' }
                  }
                }
              }
            },
            array: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  item_prop: { type: 'string' }
                }
              }
            }
          },
          required: ['basic', 'nested']
        }
      };

      const result = await registry.register('complex_function', complexSchema);
      expect(result.success).toBe(true);
      expect(result.schema?.schema).toEqual(complexSchema);
    });

    it('should handle unicode in schema names and descriptions', async () => {
      const unicodeSchema = {
        name: 'unicode_测试_функция',
        description: 'Schema with unicode: 测试 функция עברית',
        parameters: { type: 'object', properties: {} }
      };

      const result = await registry.register(unicodeSchema.name, unicodeSchema);
      expect(result.success).toBe(true);
      expect(result.schema?.name).toBe(unicodeSchema.name);
    });

    it('should handle concurrent registrations', async () => {
      const schemas = Array.from({ length: 10 }, (_, i) => ({
        name: `concurrent_${i}`,
        description: `Concurrent schema ${i}`,
        parameters: { type: 'object', properties: {} }
      }));

      const registrationPromises = schemas.map(schema => 
        registry.register(schema.name, schema)
      );

      const results = await Promise.all(registrationPromises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify all are registered
      const listResult = await registry.list();
      expect(listResult.totalCount).toBe(10);
    });
  });

  describe('factory function', () => {
    it('should create registry instance via factory', () => {
      const { createToolRegistry } = require('../../../src/tools/registry');
      const factoryRegistry = createToolRegistry();
      
      expect(factoryRegistry).toBeInstanceOf(ToolRegistry);
      expect(factoryRegistry).toBeDefined();
    });
  });
});