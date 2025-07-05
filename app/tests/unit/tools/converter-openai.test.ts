/**
 * Unit tests for OpenAIConverter
 * Complete test coverage for OpenAI format conversion functionality
 * 
 * Tests OpenAI to Claude and Claude to OpenAI conversion:
 * - Tool format conversion between standards
 * - Tool choice format conversion
 * - Validation and error handling
 * - Performance and edge cases
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  OpenAIConverter,
  ToolConversionError
} from '../../../src/tools/converter';
import {
  ClaudeTool,
  ClaudeToolChoice
} from '../../../src/tools/conversion-types';
import { OpenAITool, OpenAIToolChoice } from '../../../src/tools/types';
import {
  createMockMapper,
  createMockValidator,
  createSampleOpenAITool,
  createSampleClaudeTool,
  createOpenAIToolChoice,
  createClaudeToolChoice,
  ConversionTestAssertions
} from './test-helpers/converter-test-utils';

describe('OpenAIConverter', () => {
  let openaiConverter: OpenAIConverter;
  let mockMapper: any;
  let mockValidator: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockMapper = createMockMapper();
    mockValidator = createMockValidator();
    
    openaiConverter = new OpenAIConverter(mockMapper, mockValidator);
  });

  describe('toClaudeFormat', () => {
    it('should convert OpenAI tools to Claude format', () => {
      const openaiTools: OpenAITool[] = [
        createSampleOpenAITool('get_weather', 'Get the weather', {
          type: 'object',
          properties: {
            location: { type: 'string' }
          },
          required: ['location']
        })
      ];

      const result = openaiConverter.toClaudeFormat(openaiTools);
      
      ConversionTestAssertions.expectSuccessfulConversion(result);
      expect(result.converted).toEqual([
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
      ]);
      expect(result.conversionTimeMs).toBeGreaterThan(0);
    });

    it('should handle tools without parameters', () => {
      const openaiTools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'simple_function',
            description: 'Simple function'
          }
        }
      ];

      const result = openaiConverter.toClaudeFormat(openaiTools);
      
      ConversionTestAssertions.expectSuccessfulConversion(result);
      expect(result.converted).toEqual([
        {
          name: 'simple_function',
          description: 'Simple function',
          input_schema: {}
        }
      ]);
    });

    it('should handle multiple tools', () => {
      const openaiTools: OpenAITool[] = [
        createSampleOpenAITool('tool1', 'First tool'),
        createSampleOpenAITool('tool2', 'Second tool'),
        createSampleOpenAITool('tool3', 'Third tool')
      ];

      const result = openaiConverter.toClaudeFormat(openaiTools);
      
      ConversionTestAssertions.expectSuccessfulConversion(result);
      expect(result.converted).toHaveLength(3);
      expect(result.converted?.map((t: any) => t.name)).toEqual(['tool1', 'tool2', 'tool3']);
    });

    it('should handle empty tools array', () => {
      const result = openaiConverter.toClaudeFormat([]);
      
      ConversionTestAssertions.expectSuccessfulConversion(result);
      expect(result.converted).toEqual([]);
    });

    it('should handle validation failures', () => {
      mockValidator.validateOpenAIFormat.mockReturnValueOnce({
        valid: false,
        format: 'unknown',
        errors: ['Invalid format'],
        details: {
          hasRequiredFields: false,
          supportedVersion: false,
          knownFormat: false
        }
      });

      const result = openaiConverter.toClaudeFormat([]);
      
      ConversionTestAssertions.expectFailedConversion(result);
      expect(result.errors).toEqual(['Invalid format']);
    });

    it('should handle conversion exceptions', () => {
      mockValidator.validateOpenAIFormat.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = openaiConverter.toClaudeFormat([]);
      
      ConversionTestAssertions.expectFailedConversion(result);
      expect(result.errors[0]).toContain('Test error');
    });

    it('should handle complex parameter schemas', () => {
      const complexTool = createSampleOpenAITool('complex_tool', 'Complex tool', {
        type: 'object',
        properties: {
          nested: {
            type: 'object',
            properties: {
              value: { type: 'string' },
              array: { type: 'array', items: { type: 'number' } }
            }
          },
          optional: { type: 'boolean' }
        },
        required: ['nested']
      });

      const result = openaiConverter.toClaudeFormat([complexTool]);
      
      ConversionTestAssertions.expectSuccessfulConversion(result);
      expect(result.converted?.[0].input_schema).toEqual(complexTool.function.parameters);
    });

    it('should preserve tool descriptions and names', () => {
      const tool = createSampleOpenAITool(
        'preserve_test',
        'This description should be preserved exactly',
        { type: 'object', properties: {} }
      );

      const result = openaiConverter.toClaudeFormat([tool]);
      
      ConversionTestAssertions.expectSuccessfulConversion(result);
      expect(result.converted?.[0].name).toBe('preserve_test');
      expect(result.converted?.[0].description).toBe('This description should be preserved exactly');
    });
  });

  describe('fromClaudeFormat', () => {
    it('should convert Claude tools to OpenAI format', () => {
      const claudeTools: ClaudeTool[] = [
        createSampleClaudeTool('get_weather', 'Get the weather', {
          type: 'object',
          properties: {
            location: { type: 'string' }
          },
          required: ['location']
        })
      ];

      const result = openaiConverter.fromClaudeFormat(claudeTools);
      
      ConversionTestAssertions.expectSuccessfulConversion(result);
      expect(result.converted).toEqual([
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
      ]);
    });

    it('should handle Claude tools without input schema', () => {
      const claudeTools: ClaudeTool[] = [
        {
          name: 'simple_claude_tool',
          description: 'Simple Claude tool'
        } as ClaudeTool
      ];

      const result = openaiConverter.fromClaudeFormat(claudeTools);
      
      ConversionTestAssertions.expectSuccessfulConversion(result);
      expect(result.converted?.[0].function.parameters).toEqual({});
    });

    it('should handle multiple Claude tools', () => {
      const claudeTools: ClaudeTool[] = [
        createSampleClaudeTool('claude1', 'First Claude tool'),
        createSampleClaudeTool('claude2', 'Second Claude tool'),
        createSampleClaudeTool('claude3', 'Third Claude tool')
      ];

      const result = openaiConverter.fromClaudeFormat(claudeTools);
      
      ConversionTestAssertions.expectSuccessfulConversion(result);
      expect(result.converted).toHaveLength(3);
      expect(result.converted?.map((t: any) => t.function.name)).toEqual(['claude1', 'claude2', 'claude3']);
    });

    it('should handle validation failures for Claude format', () => {
      mockValidator.validateClaudeFormat.mockReturnValueOnce({
        valid: false,
        format: 'unknown',
        errors: ['Invalid Claude format'],
        details: {
          hasRequiredFields: false,
          supportedVersion: false,
          knownFormat: false
        }
      });

      const result = openaiConverter.fromClaudeFormat([]);
      
      ConversionTestAssertions.expectFailedConversion(result);
      expect(result.errors).toEqual(['Invalid Claude format']);
    });

    it('should handle conversion exceptions in fromClaudeFormat', () => {
      mockValidator.validateClaudeFormat.mockImplementation(() => {
        throw new Error('Claude conversion error');
      });

      const result = openaiConverter.fromClaudeFormat([]);
      
      ConversionTestAssertions.expectFailedConversion(result);
      expect(result.errors[0]).toContain('Claude conversion error');
    });
  });

  describe('convertOpenAIToolChoice', () => {
    it('should convert auto choice', () => {
      const result = openaiConverter.convertOpenAIToolChoice('auto');
      
      ConversionTestAssertions.expectSuccessfulConversion(result);
      expect(result.converted).toBe('allowed');
    });

    it('should convert none choice', () => {
      const result = openaiConverter.convertOpenAIToolChoice('none');
      
      ConversionTestAssertions.expectSuccessfulConversion(result);
      expect(result.converted).toBe('disabled');
    });

    it('should convert function choice', () => {
      const functionChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'specific_function' }
      };

      const result = openaiConverter.convertOpenAIToolChoice(functionChoice);
      
      ConversionTestAssertions.expectSuccessfulConversion(result);
      expect(result.converted).toEqual({
        name: 'specific_function'
      });
    });

    it('should handle invalid function choice', () => {
      const invalidChoice = {
        type: 'function'
        // Missing function property
      } as OpenAIToolChoice;

      const result = openaiConverter.convertOpenAIToolChoice(invalidChoice);
      
      ConversionTestAssertions.expectFailedConversion(result);
      expect(result.errors[0]).toContain('function name');
    });

    it('should handle unknown choice types', () => {
      const unknownChoice = 'unknown' as OpenAIToolChoice;

      const result = openaiConverter.convertOpenAIToolChoice(unknownChoice);
      
      ConversionTestAssertions.expectFailedConversion(result);
      expect(result.errors[0]).toContain('Unknown');
    });

    it('should handle null and undefined choices', () => {
      const nullResult = openaiConverter.convertOpenAIToolChoice(null as any);
      const undefinedResult = openaiConverter.convertOpenAIToolChoice(undefined as any);
      
      ConversionTestAssertions.expectFailedConversion(nullResult);
      ConversionTestAssertions.expectFailedConversion(undefinedResult);
    });

    it('should preserve function names exactly', () => {
      const functionChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'very_specific_function_name_123' }
      };

      const result = openaiConverter.convertOpenAIToolChoice(functionChoice);
      
      ConversionTestAssertions.expectSuccessfulConversion(result);
      expect((result.converted as any).name).toBe('very_specific_function_name_123');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle malformed OpenAI tools', () => {
      const malformedTools = [
        { type: 'function' }, // Missing function property
        { function: { name: 'test' } }, // Missing type
        null,
        undefined
      ] as unknown as OpenAITool[];

      // Should not throw but may produce warnings
      expect(() => openaiConverter.toClaudeFormat(malformedTools)).not.toThrow();
    });

    it('should handle malformed Claude tools', () => {
      const malformedTools = [
        { name: 'test' }, // Missing description
        { description: 'test' }, // Missing name
        null,
        undefined
      ] as ClaudeTool[];

      expect(() => openaiConverter.fromClaudeFormat(malformedTools)).not.toThrow();
    });

    it('should handle very large tool arrays', () => {
      const largeToolArray = Array.from({ length: 100 }, (_, i) => 
        createSampleOpenAITool(`tool_${i}`, `Tool number ${i}`)
      );

      const result = openaiConverter.toClaudeFormat(largeToolArray);
      
      ConversionTestAssertions.expectSuccessfulConversion(result);
      expect(result.converted).toHaveLength(100);
    });

    it('should maintain conversion timing information', () => {
      const tools = [createSampleOpenAITool('timed_tool', 'Timing test')];

      const result = openaiConverter.toClaudeFormat(tools);
      
      ConversionTestAssertions.expectSuccessfulConversion(result);
      expect(result.conversionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.sourceFormat).toBe('openai');
      expect(result.targetFormat).toBe('claude');
      expect(result.toolsConverted).toBe(1);
    });

    it('should handle mapper failures gracefully', () => {
      mockMapper.mapParameters.mockReturnValueOnce({
        success: false,
        errors: ['Mapping failed'],
        mappingDetails: {
          sourceFields: [],
          targetFields: [],
          preservedFields: [],
          lostFields: ['lost_field']
        }
      });

      const tools = [createSampleOpenAITool('mapper_test', 'Mapper test')];
      
      // Should still succeed even if mapping has issues
      const result = openaiConverter.toClaudeFormat(tools);
      expect(result.success).toBe(true); // The converter should handle mapper failures gracefully
    });
  });
});