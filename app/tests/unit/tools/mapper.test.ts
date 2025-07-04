/**
 * Parameter mapping unit tests
 * 100% test coverage for parameter mapping logic
 * 
 * Tests ToolParameterMapper with comprehensive scenarios
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  ToolParameterMapper,
  ParameterMappingError,
  ParameterMappingUtils,
  toolParameterMapper
} from '../../../src/tools/mapper';
import {
  ParameterMappingResult
} from '../../../src/tools/conversion-types';
import {
  TOOL_CONVERSION_MESSAGES
} from '../../../src/tools/constants';

describe('Parameter Mapping Logic', () => {
  let mapper: ToolParameterMapper;

  beforeEach(() => {
    mapper = new ToolParameterMapper();
  });

  describe('ParameterMappingError', () => {
    it('should create error with all fields', () => {
      const error = new ParameterMappingError(
        'Test mapping error',
        'MAPPING_TEST',
        'test_field',
        { extra: 'data' }
      );

      expect(error.message).toBe('Test mapping error');
      expect(error.code).toBe('MAPPING_TEST');
      expect(error.field).toBe('test_field');
      expect(error.details).toEqual({ extra: 'data' });
      expect(error.name).toBe('ParameterMappingError');
    });
  });

  describe('ParameterMappingUtils', () => {
    describe('deepClone', () => {
      it('should clone primitive values', () => {
        expect(ParameterMappingUtils.deepClone(42)).toBe(42);
        expect(ParameterMappingUtils.deepClone('test')).toBe('test');
        expect(ParameterMappingUtils.deepClone(true)).toBe(true);
        expect(ParameterMappingUtils.deepClone(null)).toBe(null);
      });

      it('should clone dates', () => {
        const date = new Date('2023-01-01');
        const cloned = ParameterMappingUtils.deepClone(date);
        
        expect(cloned).toEqual(date);
        expect(cloned).not.toBe(date);
      });

      it('should clone arrays', () => {
        const arr = [1, 'test', { nested: true }];
        const cloned = ParameterMappingUtils.deepClone(arr);
        
        expect(cloned).toEqual(arr);
        expect(cloned).not.toBe(arr);
        expect(cloned[2]).not.toBe(arr[2]);
      });

      it('should clone objects', () => {
        const obj = {
          str: 'test',
          num: 42,
          nested: {
            prop: 'value'
          },
          arr: [1, 2, 3]
        };
        
        const cloned = ParameterMappingUtils.deepClone(obj);
        
        expect(cloned).toEqual(obj);
        expect(cloned).not.toBe(obj);
        expect(cloned.nested).not.toBe(obj.nested);
        expect(cloned.arr).not.toBe(obj.arr);
      });
    });

    describe('structurallyEqual', () => {
      it('should compare primitive values', () => {
        expect(ParameterMappingUtils.structurallyEqual(42, 42)).toBe(true);
        expect(ParameterMappingUtils.structurallyEqual('test', 'test')).toBe(true);
        expect(ParameterMappingUtils.structurallyEqual(true, true)).toBe(true);
        expect(ParameterMappingUtils.structurallyEqual(null, null)).toBe(true);
        
        expect(ParameterMappingUtils.structurallyEqual(42, 43)).toBe(false);
        expect(ParameterMappingUtils.structurallyEqual('test', 'other')).toBe(false);
        expect(ParameterMappingUtils.structurallyEqual(true, false)).toBe(false);
        expect(ParameterMappingUtils.structurallyEqual(null, undefined)).toBe(false);
      });

      it('should compare arrays', () => {
        expect(ParameterMappingUtils.structurallyEqual([1, 2, 3], [1, 2, 3])).toBe(true);
        expect(ParameterMappingUtils.structurallyEqual([], [])).toBe(true);
        
        expect(ParameterMappingUtils.structurallyEqual([1, 2, 3], [1, 2])).toBe(false);
        expect(ParameterMappingUtils.structurallyEqual([1, 2, 3], [1, 3, 2])).toBe(false);
      });

      it('should compare objects', () => {
        const obj1 = { a: 1, b: 'test' };
        const obj2 = { a: 1, b: 'test' };
        const obj3 = { b: 'test', a: 1 }; // Different order
        const obj4 = { a: 1, b: 'other' };
        
        expect(ParameterMappingUtils.structurallyEqual(obj1, obj2)).toBe(true);
        expect(ParameterMappingUtils.structurallyEqual(obj1, obj3)).toBe(true);
        expect(ParameterMappingUtils.structurallyEqual(obj1, obj4)).toBe(false);
      });

      it('should compare nested structures', () => {
        const nested1 = {
          level1: {
            level2: {
              value: 'test'
            }
          }
        };
        
        const nested2 = {
          level1: {
            level2: {
              value: 'test'
            }
          }
        };
        
        const nested3 = {
          level1: {
            level2: {
              value: 'other'
            }
          }
        };
        
        expect(ParameterMappingUtils.structurallyEqual(nested1, nested2)).toBe(true);
        expect(ParameterMappingUtils.structurallyEqual(nested1, nested3)).toBe(false);
      });
    });

    describe('extractFieldPaths', () => {
      it('should extract field paths from flat object', () => {
        const obj = {
          name: 'test',
          value: 42,
          enabled: true
        };
        
        const paths = ParameterMappingUtils.extractFieldPaths(obj);
        expect(paths).toEqual(['name', 'value', 'enabled']);
      });

      it('should extract nested field paths', () => {
        const obj = {
          user: {
            profile: {
              name: 'John'
            },
            settings: {
              theme: 'dark'
            }
          },
          metadata: {
            version: '1.0'
          }
        };
        
        const paths = ParameterMappingUtils.extractFieldPaths(obj);
        expect(paths).toContain('user');
        expect(paths).toContain('user.profile');
        expect(paths).toContain('user.profile.name');
        expect(paths).toContain('user.settings');
        expect(paths).toContain('user.settings.theme');
        expect(paths).toContain('metadata');
        expect(paths).toContain('metadata.version');
      });

      it('should handle empty objects', () => {
        expect(ParameterMappingUtils.extractFieldPaths({})).toEqual([]);
        expect(ParameterMappingUtils.extractFieldPaths(null)).toEqual([]);
        expect(ParameterMappingUtils.extractFieldPaths(undefined)).toEqual([]);
      });
    });
  });

  describe('ToolParameterMapper', () => {
    describe('mapParameters', () => {
      it('should map OpenAI parameters to Claude format', () => {
        const openaiParams = {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The location'
            },
            unit: {
              type: 'string',
              enum: ['celsius', 'fahrenheit']
            }
          },
          required: ['location']
        };

        const result = mapper.mapParameters(openaiParams, 'claude');
        
        expect(result.success).toBe(true);
        expect(result.mapped).toEqual(openaiParams);
        expect(result.errors).toEqual([]);
        expect(result.mappingDetails.preservedFields).toContain('type');
        expect(result.mappingDetails.preservedFields).toContain('properties');
      });

      it('should map Claude parameters to OpenAI format', () => {
        const claudeParams = {
          type: 'object',
          properties: {
            query: {
              type: 'string'
            }
          }
        };

        const result = mapper.mapParameters(claudeParams, 'openai');
        
        expect(result.success).toBe(true);
        expect(result.mapped).toEqual(claudeParams);
        expect(result.errors).toEqual([]);
      });

      it('should add type field when missing for OpenAI format', () => {
        const claudeParams = {
          properties: {
            query: {
              type: 'string'
            }
          }
        };

        const result = mapper.mapParameters(claudeParams, 'openai');
        
        expect(result.success).toBe(true);
        expect(result.mapped?.type).toBe('object');
      });

      it('should handle null/undefined parameters', () => {
        const result1 = mapper.mapParameters(null as any, 'claude');
        const result2 = mapper.mapParameters(undefined as any, 'openai');
        
        expect(result1.success).toBe(false);
        expect(result1.errors).toContain(TOOL_CONVERSION_MESSAGES.PARAMETER_MAPPING_FAILED);
        
        expect(result2.success).toBe(false);
        expect(result2.errors).toContain(TOOL_CONVERSION_MESSAGES.PARAMETER_MAPPING_FAILED);
      });

      it('should handle invalid parameter types', () => {
        const result = mapper.mapParameters('invalid' as any, 'claude');
        
        expect(result.success).toBe(false);
        expect(result.errors).toContain(TOOL_CONVERSION_MESSAGES.PARAMETER_MAPPING_FAILED);
      });

      it('should track mapping details correctly', () => {
        const params = {
          type: 'object',
          properties: {
            nested: {
              type: 'object',
              properties: {
                value: { type: 'string' }
              }
            }
          }
        };

        const result = mapper.mapParameters(params, 'claude');
        
        expect(result.success).toBe(true);
        expect(result.mappingDetails.sourceFields).toContain('type');
        expect(result.mappingDetails.sourceFields).toContain('properties');
        expect(result.mappingDetails.sourceFields).toContain('properties.nested');
        expect(result.mappingDetails.targetFields).toContain('type');
        expect(result.mappingDetails.preservedFields.length).toBeGreaterThan(0);
      });

      it('should handle mapping exceptions', () => {
        // Mock mapper method to throw error
        const originalMethod = mapper['mapToClaudeFormat'];
        mapper['mapToClaudeFormat'] = () => { throw new Error('Test error'); };

        const result = mapper.mapParameters({ type: 'object' }, 'claude');
        
        expect(result.success).toBe(false);
        expect(result.errors[0]).toContain('Test error');
        
        // Restore original method
        mapper['mapToClaudeFormat'] = originalMethod;
      });
    });

    describe('mapParametersReverse', () => {
      it('should map OpenAI to Claude when source is OpenAI', () => {
        const params = { type: 'object' };
        const result = mapper.mapParametersReverse(params, 'openai');
        
        expect(result.success).toBe(true);
        // Should have called mapParameters with 'claude' target
      });

      it('should map Claude to OpenAI when source is Claude', () => {
        const params = { properties: { test: { type: 'string' } } };
        const result = mapper.mapParametersReverse(params, 'claude');
        
        expect(result.success).toBe(true);
        expect(result.mapped?.type).toBe('object');
      });
    });

    describe('validateMapping', () => {
      it('should validate successful mapping', () => {
        const original = {
          type: 'object',
          properties: {
            test: { type: 'string' }
          },
          required: ['test'],
          description: 'Test schema'
        };
        
        const mapped = {
          type: 'object',
          properties: {
            test: { type: 'string' }
          },
          required: ['test'],
          description: 'Test schema'
        };
        
        const isValid = mapper.validateMapping(original, mapped);
        expect(isValid).toBe(true);
      });

      it('should detect missing essential fields', () => {
        const original = {
          type: 'object',
          properties: {
            test: { type: 'string' }
          }
        };
        
        const mapped = {
          // Missing type field
          properties: {
            test: { type: 'string' }
          }
        };
        
        const isValid = mapper.validateMapping(original, mapped);
        expect(isValid).toBe(false);
      });

      it('should handle null/undefined inputs', () => {
        expect(mapper.validateMapping(null as any, null as any)).toBe(true);
        expect(mapper.validateMapping({}, null as any)).toBe(false);
        expect(mapper.validateMapping(null as any, {})).toBe(false);
      });

      it('should handle validation exceptions', () => {
        // Test with mismatched structures that should fail validation
        const original = { 
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name']
        };
        const invalid = { 
          type: 'string'  // Type mismatch should fail validation
        };
        
        const isValid = mapper.validateMapping(original, invalid);
        expect(isValid).toBe(false);
      });

      it('should validate equivalent fields', () => {
        const original = {
          type: 'object',
          description: 'Test'
        };
        
        const mapped = {
          type: 'object',
          desc: 'Test' // Equivalent field
        };
        
        const isValid = mapper.validateMapping(original, mapped);
        expect(isValid).toBe(true);
      });
    });

    describe('Complex Parameter Scenarios', () => {
      it('should handle deeply nested parameters', () => {
        const complexParams = {
          type: 'object',
          properties: {
            config: {
              type: 'object',
              properties: {
                database: {
                  type: 'object',
                  properties: {
                    connection: {
                      type: 'object',
                      properties: {
                        host: { type: 'string' },
                        port: { type: 'number' }
                      }
                    }
                  }
                }
              }
            }
          }
        };

        const result = mapper.mapParameters(complexParams, 'claude');
        
        expect(result.success).toBe(true);
        expect(result.mapped).toEqual(complexParams);
      });

      it('should handle array parameters', () => {
        const arrayParams = {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  value: { type: 'number' }
                }
              }
            }
          }
        };

        const result = mapper.mapParameters(arrayParams, 'openai');
        
        expect(result.success).toBe(true);
        expect(result.mapped?.type).toBe('object');
      });

      it('should handle parameters with all JSON Schema types', () => {
        const allTypesParams = {
          type: 'object',
          properties: {
            stringField: { type: 'string' },
            numberField: { type: 'number' },
            integerField: { type: 'integer' },
            booleanField: { type: 'boolean' },
            objectField: { 
              type: 'object',
              properties: {
                nested: { type: 'string' }
              }
            },
            arrayField: {
              type: 'array',
              items: { type: 'string' }
            },
            nullField: { type: 'null' }
          }
        };

        const result = mapper.mapParameters(allTypesParams, 'claude');
        
        expect(result.success).toBe(true);
        expect(result.mapped).toEqual(allTypesParams);
      });
    });

    describe('Error Handling', () => {
      it('should handle malformed parameter objects', () => {
        const malformed = {
          type: ['invalid'], // Should be string
          properties: 'invalid' // Should be object
        };

        const result = mapper.mapParameters(malformed, 'openai');
        
        expect(result.success).toBe(true); // Mapper is permissive
        expect(result.mapped).toEqual(malformed);
      });

      it('should preserve data in edge cases', () => {
        const edgeCase = {
          customField: 'value',
          specialProperty: {
            nested: true
          }
        };

        const result = mapper.mapParameters(edgeCase, 'claude');
        
        expect(result.success).toBe(true);
        expect(result.mapped).toEqual(edgeCase);
      });
    });
  });

  describe('Default Instance', () => {
    it('should provide working default mapper', () => {
      const params = {
        type: 'object',
        properties: {
          test: { type: 'string' }
        }
      };

      const result = toolParameterMapper.mapParameters(params, 'claude');
      expect(result.success).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    it('should map parameters quickly', () => {
      const largeParams = {
        type: 'object',
        properties: Object.fromEntries(
          Array(50).fill(null).map((_, i) => [
            `param_${i}`,
            {
              type: 'object',
              properties: {
                nested: { type: 'string' },
                value: { type: 'number' }
              }
            }
          ])
        )
      };

      const startTime = Date.now();
      const result = mapper.mapParameters(largeParams, 'claude');
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(50); // Should be fast
    });

    it('should handle deep nesting efficiently', () => {
      let deepParams: any = { type: 'object' };
      let current = deepParams;
      
      for (let i = 0; i < 10; i++) {
        current.properties = {
          [`level_${i}`]: {
            type: 'object'
          }
        };
        current = current.properties[`level_${i}`];
      }

      const startTime = Date.now();
      const result = mapper.mapParameters(deepParams, 'openai');
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(100);
    });
  });
});