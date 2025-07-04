/**
 * Enhanced Integration Tests - Phase 1B Review
 * Comprehensive integration testing for tool validation
 * 
 * Tests tool validation components working together
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ToolValidator } from '../../../src/tools/validator';
import { OpenAITool, OpenAIToolChoice } from '../../../src/tools/types';
import { TOOL_VALIDATION_MESSAGES } from '../../../src/tools/constants';

describe.skip('Enhanced Tool Validation Integration - Phase 1B', () => {
  let validator: ToolValidator;

  beforeEach(() => {
    validator = new ToolValidator();
  });

  describe.skip('End-to-End Tool Validation', () => {
    it('should validate complete OpenAI tools request flow', async () => {
      const tools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get current weather for a location',
            parameters: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'City and country'
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

      const toolChoice: OpenAIToolChoice = 'auto';

      // Test complete validation flow
      const result = await validator.validateWithTimeout(tools, toolChoice);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.validTools).toEqual(tools);
    });

    it('should handle complex multi-tool validation scenarios', async () => {
      const complexTools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'read_file',
            description: 'Read content from a file',
            parameters: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path' }
              },
              required: ['path']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'write_file',
            description: 'Write content to a file',
            parameters: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                content: { type: 'string' },
                mode: { type: 'string', enum: ['append', 'overwrite'] }
              },
              required: ['path', 'content']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'list_directory',
            description: 'List directory contents',
            parameters: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                include_hidden: { type: 'boolean', default: false },
                filter: {
                  type: 'object',
                  properties: {
                    extensions: { type: 'array', items: { type: 'string' } },
                    pattern: { type: 'string' }
                  }
                }
              },
              required: ['path']
            }
          }
        }
      ];

      const result = await validator.validateWithTimeout(complexTools, 'auto');
      
      expect(result.valid).toBe(true);
      expect(result.validTools).toHaveLength(3);
    });

    it('should handle validation errors in complex scenarios', async () => {
      const problematicTools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'valid_function',
            description: 'This function is valid'
          }
        },
        {
          type: 'function',
          function: {
            name: '',  // Invalid empty name
            description: 'This function has invalid name'
          }
        } as OpenAITool,
        {
          type: 'function',
          function: {
            name: 'another_valid',
            description: 'Another valid function'
          }
        }
      ];

      const result = validator.validateToolArray(problematicTools);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.validTools).toHaveLength(2); // Should extract valid tools
      expect(result.validTools[0].function.name).toBe('valid_function');
      expect(result.validTools[1].function.name).toBe('another_valid');
    });
  });

  describe.skip('OpenAI Specification Compliance Integration', () => {
    it('should match OpenAI API examples exactly', async () => {
      // Direct copy from API_REFERENCE.md example
      const openaiExample: OpenAITool = {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read content from a file',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'File path to read'
              }
            },
            required: ['path']
          }
        }
      };

      const result = validator.validateTool(openaiExample);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should support all OpenAI tool_choice formats in integration', async () => {
      const tools: OpenAITool[] = [{
        type: 'function',
        function: { name: 'test_function', description: 'Test' }
      }];

      // Test all documented tool_choice formats
      const choiceOptions: OpenAIToolChoice[] = [
        'auto',
        'none',
        { type: 'function', function: { name: 'test_function' } }
      ];

      for (const choice of choiceOptions) {
        const result = await validator.validateWithTimeout(tools, choice);
        expect(result.valid).toBe(true);
      }
    });

    it('should provide OpenAI-compatible error responses', async () => {
      const invalidTools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'duplicate',
            description: 'First'
          }
        },
        {
          type: 'function',
          function: {
            name: 'duplicate',
            description: 'Second with same name'
          }
        }
      ];

      const result = validator.validateToolArray(invalidTools);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(TOOL_VALIDATION_MESSAGES.DUPLICATE_FUNCTION_NAMES);
    });
  });

  describe.skip('Performance Integration Testing', () => {
    it('should handle large tool sets efficiently', async () => {
      const largeToolSet: OpenAITool[] = Array.from({ length: 100 }, (_, i) => ({
        type: 'function',
        function: {
          name: `performance_function_${i}`,
          description: `Performance test function ${i}`,
          parameters: {
            type: 'object',
            properties: {
              param1: { type: 'string' },
              param2: { type: 'number' },
              param3: { type: 'boolean' }
            }
          }
        }
      }));

      const startTime = Date.now();
      const result = await validator.validateWithTimeout(largeToolSet, 'auto');
      const duration = Date.now() - startTime;

      expect(result.valid).toBe(true);
      expect(duration).toBeLessThan(50); // Should be very fast
    });

    it('should process complex nested parameters efficiently', async () => {
      const complexTool: OpenAITool = {
        type: 'function',
        function: {
          name: 'complex_data_processor',
          description: 'Process complex nested data structures',
          parameters: {
            type: 'object',
            properties: {
              config: {
                type: 'object',
                properties: {
                  database: {
                    type: 'object',
                    properties: {
                      connections: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            host: { type: 'string' },
                            port: { type: 'number' },
                            credentials: {
                              type: 'object',
                              properties: {
                                username: { type: 'string' },
                                password: { type: 'string' }
                              }
                            }
                          }
                        }
                      }
                    }
                  },
                  processing: {
                    type: 'object',
                    properties: {
                      batch_size: { type: 'number', minimum: 1, maximum: 1000 },
                      parallel_workers: { type: 'number', minimum: 1, maximum: 16 },
                      filters: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            field: { type: 'string' },
                            operator: { type: 'string', enum: ['eq', 'ne', 'gt', 'lt', 'in'] },
                            value: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'array' }] }
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

      const startTime = Date.now();
      const result = validator.validateTool(complexTool);
      const duration = Date.now() - startTime;

      expect(result.valid).toBe(true);
      expect(duration).toBeLessThan(10);
    });
  });

  describe.skip('Error Handling Integration', () => {
    it('should gracefully handle all error scenarios in sequence', async () => {
      // Test sequence of different error types
      const errorScenarios = [
        // Empty function name
        {
          type: 'function',
          function: { name: '', description: 'Empty name' }
        },
        // Reserved function name
        {
          type: 'function',
          function: { name: 'function', description: 'Reserved name' }
        },
        // Too long name
        {
          type: 'function',
          function: { name: 'a'.repeat(100), description: 'Too long name' }
        }
      ];

      for (const tool of errorScenarios) {
        const result = validator.validateTool(tool as OpenAITool);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should handle tool_choice validation errors consistently', async () => {
      const tools: OpenAITool[] = [{
        type: 'function',
        function: { name: 'existing_function', description: 'Test' }
      }];

      const invalidChoices = [
        'invalid_string' as OpenAIToolChoice,
        { type: 'function', function: { name: 'non_existent' } },
        { type: 'invalid' as any, function: { name: 'test' } }
      ];

      for (const choice of invalidChoices) {
        const result = validator.validateToolChoice(choice, tools);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe.skip('Real-World Usage Patterns', () => {
    it('should handle typical developer tool definitions', async () => {
      const developerTools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'execute_command',
            description: 'Execute a shell command',
            parameters: {
              type: 'object',
              properties: {
                command: { type: 'string', description: 'Command to execute' },
                working_directory: { type: 'string', description: 'Working directory' },
                timeout: { type: 'number', minimum: 1, maximum: 300, default: 30 }
              },
              required: ['command']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'search_code',
            description: 'Search for code patterns in project',
            parameters: {
              type: 'object',
              properties: {
                pattern: { type: 'string' },
                file_types: { type: 'array', items: { type: 'string' } },
                case_sensitive: { type: 'boolean', default: false },
                max_results: { type: 'number', minimum: 1, maximum: 100, default: 10 }
              },
              required: ['pattern']
            }
          }
        }
      ];

      const result = await validator.validateWithTimeout(developerTools, 'auto');
      expect(result.valid).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.validTools).toHaveLength(2);
      expect(result.validTools[0].function.name).toBe('execute_command');
      expect(result.validTools[1].function.name).toBe('search_code');
    });

    it('should validate API integration tool patterns', async () => {
      const apiTools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'make_api_request',
            description: 'Make HTTP API request',
            parameters: {
              type: 'object',
              properties: {
                url: { type: 'string', format: 'uri' },
                method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
                headers: { type: 'object', additionalProperties: { type: 'string' } },
                body: { anyOf: [{ type: 'string' }, { type: 'object' }] },
                timeout: { type: 'number', minimum: 1, maximum: 60, default: 10 }
              },
              required: ['url', 'method']
            }
          }
        }
      ];

      const result = validator.validateToolArray(apiTools);
      expect(result.valid).toBe(true);
    });
  });
});