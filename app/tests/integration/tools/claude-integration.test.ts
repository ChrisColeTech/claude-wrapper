/**
 * Phase 3A Integration Tests
 * Claude SDK Tool Format Conversion Integration
 * 
 * Tests the complete conversion pipeline from OpenAI tools to Claude format
 * and back with real tool definitions and data fidelity validation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ToolConverter } from '../../../src/tools/converter';
import { ToolParameterMapper } from '../../../src/tools/mapper';
import { FormatValidator } from '../../../src/tools/format-validator';
import { OpenAITool, OpenAIToolChoice } from '../../../src/tools/types';
import { ClaudeTool, ClaudeToolChoice } from '../../../src/tools/conversion-types';

describe('Phase 3A: Claude SDK Integration Tests', () => {
  let converter: ToolConverter;
  let mapper: ToolParameterMapper;
  let validator: FormatValidator;

  beforeEach(() => {
    mapper = new ToolParameterMapper();
    validator = new FormatValidator();
    converter = new ToolConverter(mapper, validator);
  });

  describe('Core Format Conversion Integration', () => {
    it('should convert OpenAI tools to Claude format with complete fidelity', async () => {
      const openaiTools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get the current weather in a given location',
            parameters: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'The city and state, e.g. San Francisco, CA'
                },
                unit: {
                  type: 'string',
                  enum: ['celsius', 'fahrenheit'],
                  description: 'Temperature unit'
                }
              },
              required: ['location']
            }
          }
        }
      ];

      const result = converter.toClaudeFormat(openaiTools);

      expect(result.success).toBe(true);
      expect(result.converted).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.conversionTimeMs).toBeLessThan(15); // Performance requirement

      const claudeTool = result.converted![0] as ClaudeTool;
      expect(claudeTool.name).toBe('get_weather');
      expect(claudeTool.description).toBe('Get the current weather in a given location');
      expect(claudeTool.input_schema).toEqual({
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state, e.g. San Francisco, CA'
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'Temperature unit'
          }
        },
        required: ['location']
      });
    });

    it('should perform round-trip conversion with data fidelity preservation', async () => {
      const originalTools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'send_email',
            description: 'Send an email to a recipient',
            parameters: {
              type: 'object',
              properties: {
                to: { type: 'string', description: 'Recipient email' },
                subject: { type: 'string', description: 'Email subject' },
                body: { type: 'string', description: 'Email body' },
                cc: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'CC recipients'
                }
              },
              required: ['to', 'subject', 'body']
            }
          }
        }
      ];

      const roundTripResult = converter.performRoundTripTest(originalTools);

      expect(roundTripResult.success).toBe(true);
      expect(roundTripResult.dataFidelityPreserved).toBe(true);
      expect(roundTripResult.conversionTimeMs).toBeLessThan(15);

      // Verify the round-trip preserved all essential data
      const reconvertedTool = roundTripResult.claudeToOpenai![0];
      expect(reconvertedTool.function.name).toBe(originalTools[0].function.name);
      expect(reconvertedTool.function.description).toBe(originalTools[0].function.description);
      expect(reconvertedTool.function.parameters).toEqual(originalTools[0].function.parameters);
    });

    it('should handle complex nested parameters correctly', async () => {
      const complexTool: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'update_database',
            description: 'Update database with complex nested data',
            parameters: {
              type: 'object',
              properties: {
                config: {
                  type: 'object',
                  properties: {
                    connection: {
                      type: 'object',
                      properties: {
                        host: { type: 'string' },
                        port: { type: 'number' },
                        ssl: { type: 'boolean' }
                      },
                      required: ['host', 'port']
                    },
                    timeout: { type: 'number', minimum: 1000 }
                  },
                  required: ['connection']
                },
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      values: {
                        type: 'array',
                        items: { type: 'number' }
                      }
                    }
                  }
                }
              },
              required: ['config', 'data']
            }
          }
        }
      ];

      const conversionResult = converter.toClaudeFormat(complexTool);
      expect(conversionResult.success).toBe(true);

      const roundTripResult = converter.performRoundTripTest(complexTool);
      expect(roundTripResult.success).toBe(true);
      expect(roundTripResult.dataFidelityPreserved).toBe(true);
    });
  });

  describe('Tool Choice Conversion Integration', () => {
    it('should convert OpenAI tool choices to Claude format', async () => {
      const testCases: Array<{ input: OpenAIToolChoice; expected: ClaudeToolChoice }> = [
        { input: 'auto', expected: 'allowed' },
        { input: 'none', expected: 'disabled' },
        { input: 'required', expected: 'required' },
        {
          input: { type: 'function', function: { name: 'test_function' } },
          expected: { name: 'test_function' }
        }
      ];

      for (const { input, expected } of testCases) {
        const result = converter.convertOpenAIToolChoice(input);
        expect(result.success).toBe(true);
        expect(result.converted).toEqual(expected);
        expect(result.conversionTimeMs).toBeLessThan(15);
      }
    });

    it('should convert Claude tool choices to OpenAI format', async () => {
      const testCases: Array<{ input: ClaudeToolChoice; expected: OpenAIToolChoice }> = [
        { input: 'allowed', expected: 'auto' },
        { input: 'disabled', expected: 'none' },
        { input: 'required', expected: 'required' },
        {
          input: { name: 'test_function' },
          expected: { type: 'function', function: { name: 'test_function' } }
        }
      ];

      for (const { input, expected } of testCases) {
        const result = converter.convertClaudeToolChoice(input);
        expect(result.success).toBe(true);
        expect(result.converted).toEqual(expected);
        expect(result.conversionTimeMs).toBeLessThan(15);
      }
    });
  });

  describe('Performance Requirements Validation', () => {
    it('should convert 20 tools within 15ms requirement', async () => {
      const manyTools: OpenAITool[] = Array(20).fill(null).map((_, i) => ({
        type: 'function' as const,
        function: {
          name: `tool_${i}`,
          description: `Tool number ${i}`,
          parameters: {
            type: 'object',
            properties: {
              param1: { type: 'string' },
              param2: { type: 'number' },
              param3: { type: 'boolean' }
            },
            required: ['param1']
          }
        }
      }));

      const result = converter.toClaudeFormat(manyTools);

      expect(result.success).toBe(true);
      expect(result.converted).toHaveLength(20);
      expect(result.conversionTimeMs).toBeLessThan(15); // Phase 3A requirement
    });

    it('should handle concurrent conversions efficiently', async () => {
      const tool: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'concurrent_test',
            description: 'Test concurrent conversion'
          }
        }
      ];

      // Run 10 concurrent conversions
      const promises = Array(10).fill(null).map(() => 
        Promise.resolve(converter.toClaudeFormat(tool))
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.conversionTimeMs).toBeLessThan(15);
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle malformed OpenAI tools gracefully', async () => {
      const malformedTools = [
        {
          type: 'invalid_type',
          function: {
            // Missing name
            description: 'Invalid tool'
          }
        }
      ] as any;

      const result = converter.toClaudeFormat(malformedTools);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.conversionTimeMs).toBeLessThan(15);
    });

    it('should handle empty and null inputs correctly', async () => {
      const emptyResult = converter.toClaudeFormat([]);
      expect(emptyResult.success).toBe(true);
      expect(emptyResult.converted).toEqual([]);

      const nullResult = converter.toClaudeFormat(null as any);
      expect(nullResult.success).toBe(false);
      expect(nullResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Data Integrity Validation', () => {
    it('should preserve all JSON Schema fields during conversion', async () => {
      const schemaTestTool: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'schema_test',
            description: 'Test JSON Schema preservation',
            parameters: {
              type: 'object',
              title: 'Test Schema',
              description: 'Schema for testing',
              properties: {
                stringField: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 100,
                  pattern: '^[a-zA-Z]+$'
                },
                numberField: {
                  type: 'number',
                  minimum: 0,
                  maximum: 100,
                  multipleOf: 0.1
                },
                arrayField: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 10,
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      value: { type: 'number' }
                    }
                  }
                }
              },
              required: ['stringField', 'numberField'],
              additionalProperties: false
            }
          }
        }
      ];

      const roundTripResult = converter.performRoundTripTest(schemaTestTool);

      expect(roundTripResult.success).toBe(true);
      expect(roundTripResult.dataFidelityPreserved).toBe(true);

      // Verify specific schema properties are preserved
      const originalParams = schemaTestTool[0].function.parameters!;
      const convertedParams = roundTripResult.claudeToOpenai![0].function.parameters!;

      expect(convertedParams.title).toBe(originalParams.title);
      expect(convertedParams.description).toBe(originalParams.description);
      expect(convertedParams.additionalProperties).toBe(originalParams.additionalProperties);
      expect(convertedParams.properties.stringField.pattern).toBe(originalParams.properties.stringField.pattern);
      expect(convertedParams.properties.numberField.minimum).toBe(originalParams.properties.numberField.minimum);
    });
  });
});