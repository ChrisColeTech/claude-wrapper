/**
 * Format validation unit tests
 * 100% test coverage for format validation logic
 * 
 * Tests FormatValidator with comprehensive scenarios
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  FormatValidator,
  FormatValidationError,
  FormatValidationUtils,
  formatValidator
} from '../../../src/tools/format-validator';
import { OpenAITool } from '../../../src/tools/types';
import { ClaudeTool, FormatValidationResult } from '../../../src/tools/conversion-types';
import { FORMAT_SPECIFICATIONS } from '../../../src/tools/constants';

describe('Format Validation Logic', () => {
  let validator: FormatValidator;

  beforeEach(() => {
    validator = new FormatValidator();
  });

  describe('FormatValidationError', () => {
    it('should create error with all fields', () => {
      const error = new FormatValidationError(
        'Test validation error',
        'VALIDATION_TEST',
        'openai',
        { extra: 'data' }
      );

      expect(error.message).toBe('Test validation error');
      expect(error.code).toBe('VALIDATION_TEST');
      expect(error.format).toBe('openai');
      expect(error.details).toEqual({ extra: 'data' });
      expect(error.name).toBe('FormatValidationError');
    });
  });

  describe('FormatValidationUtils', () => {
    describe('hasOpenAIToolFields', () => {
      it('should detect valid OpenAI tool structure', () => {
        const validTool = {
          type: 'function',
          function: {
            name: 'test_function',
            description: 'Test function'
          }
        };

        expect(FormatValidationUtils.hasOpenAIToolFields(validTool)).toBe(true);
      });

      it('should reject invalid OpenAI tool structures', () => {
        const invalidTools = [
          null,
          undefined,
          'string',
          42,
          [],
          {},
          { type: 'invalid' },
          { type: 'function' }, // Missing function
          { type: 'function', function: {} }, // Missing function.name
          { type: 'function', function: { name: 42 } }, // Invalid name type
          { function: { name: 'test' } } // Missing type
        ];

        invalidTools.forEach(tool => {
          expect(FormatValidationUtils.hasOpenAIToolFields(tool)).toBe(false);
        });
      });
    });

    describe('hasClaudeToolFields', () => {
      it('should detect valid Claude tool structure', () => {
        const validTools = [
          { name: 'test_function' },
          { name: 'test_function', description: 'Test' },
          { name: 'test_function', input_schema: {} },
          { 
            name: 'test_function', 
            description: 'Test',
            input_schema: { type: 'object' }
          }
        ];

        validTools.forEach(tool => {
          expect(FormatValidationUtils.hasClaudeToolFields(tool)).toBe(true);
        });
      });

      it('should reject invalid Claude tool structures', () => {
        const invalidTools = [
          null,
          undefined,
          'string',
          42,
          [],
          {},
          { description: 'Test' }, // Missing name
          { name: 42 }, // Invalid name type
          { name: 'test', input_schema: 'invalid' } // Invalid schema type
        ];

        invalidTools.forEach(tool => {
          expect(FormatValidationUtils.hasClaudeToolFields(tool)).toBe(false);
        });
      });
    });

    describe('detectToolFormat', () => {
      it('should detect OpenAI format', () => {
        const openaiTool = {
          type: 'function',
          function: {
            name: 'test_function'
          }
        };

        expect(FormatValidationUtils.detectToolFormat(openaiTool)).toBe('openai');
      });

      it('should detect Claude format', () => {
        const claudeTool = {
          name: 'test_function',
          description: 'Test function'
        };

        expect(FormatValidationUtils.detectToolFormat(claudeTool)).toBe('claude');
      });

      it('should detect unknown format', () => {
        const unknownTools = [
          null,
          undefined,
          'string',
          {},
          { invalid: 'structure' }
        ];

        unknownTools.forEach(tool => {
          expect(FormatValidationUtils.detectToolFormat(tool)).toBe('unknown');
        });
      });
    });

    describe('isValidJSONSchema', () => {
      it('should validate correct JSON schemas', () => {
        const validSchemas = [
          { type: 'string' },
          { type: 'object', properties: {} },
          { type: 'array', items: { type: 'string' } },
          { 
            type: 'object',
            properties: {
              name: { type: 'string' }
            },
            required: ['name']
          }
        ];

        validSchemas.forEach(schema => {
          expect(FormatValidationUtils.isValidJSONSchema(schema)).toBe(true);
        });
      });

      it('should reject invalid JSON schemas', () => {
        const invalidSchemas = [
          null,
          undefined,
          'string',
          42,
          [],
          { type: ['invalid'] }, // Type should be string
          { properties: 'invalid' }, // Properties should be object
          { required: 'invalid' } // Required should be array
        ];

        invalidSchemas.forEach(schema => {
          expect(FormatValidationUtils.isValidJSONSchema(schema)).toBe(false);
        });
      });
    });

    describe('isSupportedVersion', () => {
      it('should validate supported OpenAI versions', () => {
        const openaiTool = {
          type: 'function',
          function: {
            name: 'test_function'
          }
        };

        expect(FormatValidationUtils.isSupportedVersion(openaiTool, 'openai')).toBe(true);
      });

      it('should validate supported Claude versions', () => {
        const claudeTool = {
          name: 'test_function'
        };

        expect(FormatValidationUtils.isSupportedVersion(claudeTool, 'claude')).toBe(true);
      });

      it('should reject unsupported versions', () => {
        const invalidTool = { invalid: 'structure' };

        expect(FormatValidationUtils.isSupportedVersion(invalidTool, 'openai')).toBe(false);
        expect(FormatValidationUtils.isSupportedVersion(invalidTool, 'claude')).toBe(false);
      });
    });
  });

  describe('FormatValidator', () => {
    describe('validateOpenAIFormat', () => {
      it('should validate correct OpenAI tools', () => {
        const tools: OpenAITool[] = [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get the weather',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' }
                },
                required: ['location']
              }
            }
          }
        ];

        const result = validator.validateOpenAIFormat(tools);
        
        expect(result.valid).toBe(true);
        expect(result.format).toBe('openai');
        expect(result.errors).toEqual([]);
        expect(result.details.hasRequiredFields).toBe(true);
        expect(result.details.supportedVersion).toBe(true);
        expect(result.details.knownFormat).toBe(true);
      });

      it('should reject non-array input', () => {
        const result = validator.validateOpenAIFormat('invalid' as any);
        
        expect(result.valid).toBe(false);
        expect(result.format).toBe('unknown');
        expect(result.errors).toContain('Tools must be an array');
      });

      it('should detect missing required fields', () => {
        const invalidTools = [
          { type: 'invalid' }, // Invalid type
          { function: { name: 'test' } }, // Missing type
          { type: 'function' }, // Missing function
          { type: 'function', function: {} } // Missing function.name
        ] as any;

        const result = validator.validateOpenAIFormat(invalidTools);
        
        expect(result.valid).toBe(false);
        expect(result.details.hasRequiredFields).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should detect unsupported versions', () => {
        const tools = [
          {
            type: 'function',
            function: {
              name: 'test'
            }
          }
        ] as OpenAITool[];

        // Mock isSupportedVersion to return false
        const originalMethod = FormatValidationUtils.isSupportedVersion;
        FormatValidationUtils.isSupportedVersion = () => false;

        const result = validator.validateOpenAIFormat(tools);
        
        expect(result.details.supportedVersion).toBe(false);
        expect(result.errors.some(e => e.includes('unsupported'))).toBe(true);

        // Restore original method
        FormatValidationUtils.isSupportedVersion = originalMethod;
      });

      it('should validate function parameters schema', () => {
        const toolsWithInvalidSchema = [
          {
            type: 'function',
            function: {
              name: 'test',
              parameters: {
                type: ['invalid'], // Invalid schema
                properties: 'not-object'
              }
            }
          }
        ] as any;

        const result = validator.validateOpenAIFormat(toolsWithInvalidSchema);
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('invalid JSON Schema'))).toBe(true);
      });

      it('should handle validation exceptions', () => {
        // Mock hasOpenAIToolFields to throw error
        const spy = jest.spyOn(FormatValidationUtils, 'hasOpenAIToolFields')
          .mockImplementation(() => { throw new Error('Test error'); });

        const result = validator.validateOpenAIFormat([{ type: 'function', function: { name: 'test' } }]);
        
        expect(result.valid).toBe(false);
        expect(result.format).toBe('unknown');
        expect(result.errors[0]).toContain('Test error');

        // Restore original method
        spy.mockRestore();
      });
    });

    describe('validateClaudeFormat', () => {
      it('should validate correct Claude tools', () => {
        const tools: ClaudeTool[] = [
          {
            name: 'get_weather',
            description: 'Get the weather',
            input_schema: {
              type: 'object',
              properties: {
                location: { type: 'string' }
              },
              required: ['location']
            }
          }
        ];

        const result = validator.validateClaudeFormat(tools);
        
        expect(result.valid).toBe(true);
        expect(result.format).toBe('claude');
        expect(result.errors).toEqual([]);
        expect(result.details.hasRequiredFields).toBe(true);
        expect(result.details.supportedVersion).toBe(true);
        expect(result.details.knownFormat).toBe(true);
      });

      it('should reject non-array input', () => {
        const result = validator.validateClaudeFormat('invalid' as any);
        
        expect(result.valid).toBe(false);
        expect(result.format).toBe('unknown');
        expect(result.errors).toContain('Tools must be an array');
      });

      it('should detect missing required fields', () => {
        const invalidTools = [
          {}, // Missing name
          { description: 'Test' } // Missing name
        ] as any;

        const result = validator.validateClaudeFormat(invalidTools);
        
        expect(result.valid).toBe(false);
        expect(result.details.hasRequiredFields).toBe(false);
        expect(result.errors.some(e => e.includes('missing required Claude fields'))).toBe(true);
      });

      it('should validate input_schema when present', () => {
        const toolsWithInvalidSchema = [
          {
            name: 'test',
            input_schema: {
              type: ['invalid'], // Invalid schema
              properties: 'not-object'
            }
          }
        ] as any;

        const result = validator.validateClaudeFormat(toolsWithInvalidSchema);
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('invalid JSON Schema'))).toBe(true);
      });

      it('should handle validation exceptions', () => {
        // Mock hasClaudeToolFields to throw error
        const spy = jest.spyOn(FormatValidationUtils, 'hasClaudeToolFields')
          .mockImplementation(() => { throw new Error('Test error'); });

        const result = validator.validateClaudeFormat([{ name: 'test' }]);
        
        expect(result.valid).toBe(false);
        expect(result.format).toBe('unknown');

        // Restore original method
        spy.mockRestore();
      });
    });

    describe('detectFormat', () => {
      it('should detect OpenAI format from array', () => {
        const openaiTools = [
          {
            type: 'function',
            function: {
              name: 'test_function'
            }
          }
        ];

        const result = validator.detectFormat(openaiTools);
        
        expect(result.valid).toBe(true);
        expect(result.format).toBe('openai');
      });

      it('should detect Claude format from array', () => {
        const claudeTools = [
          {
            name: 'test_function',
            description: 'Test function'
          }
        ];

        const result = validator.detectFormat(claudeTools);
        
        expect(result.valid).toBe(true);
        expect(result.format).toBe('claude');
      });

      it('should handle empty arrays', () => {
        const result = validator.detectFormat([]);
        
        expect(result.valid).toBe(false);
        expect(result.format).toBe('unknown');
        expect(result.errors).toContain('Empty or invalid tools array');
      });

      it('should handle non-arrays', () => {
        const result = validator.detectFormat('invalid' as any);
        
        expect(result.valid).toBe(false);
        expect(result.format).toBe('unknown');
        expect(result.errors).toContain('Empty or invalid tools array');
      });

      it('should detect unknown format', () => {
        const unknownTools = [
          { invalid: 'structure' }
        ];

        const result = validator.detectFormat(unknownTools);
        
        expect(result.valid).toBe(false);
        expect(result.format).toBe('unknown');
        expect(result.errors).toContain('Could not detect tool format from structure');
      });

      it('should detect mixed formats', () => {
        const mixedTools = [
          {
            type: 'function',
            function: { name: 'openai_tool' }
          },
          {
            name: 'claude_tool'
          }
        ];

        const result = validator.detectFormat(mixedTools);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Mixed tool formats detected in array');
      });

      it('should handle detection exceptions', () => {
        // Mock detectToolFormat to throw error
        const spy = jest.spyOn(FormatValidationUtils, 'detectToolFormat')
          .mockImplementation(() => { throw new Error('Test error'); });

        const result = validator.detectFormat([{ test: 'tool' }]);
        
        expect(result.valid).toBe(false);
        expect(result.format).toBe('unknown');

        // Restore original method
        spy.mockRestore();
      });
    });

    describe('Complex Validation Scenarios', () => {
      it('should validate multiple OpenAI tools', () => {
        const tools: OpenAITool[] = [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather information'
            }
          },
          {
            type: 'function',
            function: {
              name: 'send_email',
              description: 'Send an email',
              parameters: {
                type: 'object',
                properties: {
                  to: { type: 'string' },
                  subject: { type: 'string' },
                  body: { type: 'string' }
                },
                required: ['to', 'subject', 'body']
              }
            }
          }
        ];

        const result = validator.validateOpenAIFormat(tools);
        expect(result.valid).toBe(true);
      });

      it('should validate multiple Claude tools', () => {
        const tools: ClaudeTool[] = [
          {
            name: 'get_weather',
            description: 'Get weather information'
          },
          {
            name: 'send_email',
            description: 'Send an email',
            input_schema: {
              type: 'object',
              properties: {
                to: { type: 'string' },
                subject: { type: 'string' },
                body: { type: 'string' }
              },
              required: ['to', 'subject', 'body']
            }
          }
        ];

        const result = validator.validateClaudeFormat(tools);
        expect(result.valid).toBe(true);
      });

      it('should handle tools without optional fields', () => {
        const minimalOpenAITool: OpenAITool[] = [
          {
            type: 'function',
            function: {
              name: 'simple_function'
            }
          }
        ];

        const minimalClaudeTool: ClaudeTool[] = [
          {
            name: 'simple_function'
          }
        ];

        expect(validator.validateOpenAIFormat(minimalOpenAITool).valid).toBe(true);
        expect(validator.validateClaudeFormat(minimalClaudeTool).valid).toBe(true);
      });
    });
  });

  describe('Default Instance', () => {
    it('should provide working default validator', () => {
      const openaiTools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'test_function'
          }
        }
      ];

      const result = formatValidator.validateOpenAIFormat(openaiTools);
      expect(result.valid).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    it('should validate large tool arrays quickly', () => {
      const manyTools: OpenAITool[] = Array(100).fill(null).map((_, i) => ({
        type: 'function' as const,
        function: {
          name: `function_${i}`,
          description: `Function number ${i}`
        }
      }));

      const startTime = Date.now();
      const result = validator.validateOpenAIFormat(manyTools);
      const duration = Date.now() - startTime;

      expect(result.valid).toBe(true);
      expect(duration).toBeLessThan(100); // Should be fast
    });

    it('should handle complex schemas efficiently', () => {
      const complexTools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'complex_function',
            parameters: {
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
            }
          }
        }
      ];

      const startTime = Date.now();
      const result = validator.validateOpenAIFormat(complexTools);
      const duration = Date.now() - startTime;

      expect(result.valid).toBe(true);
      expect(duration).toBeLessThan(50);
    });
  });
});