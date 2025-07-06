/**
 * Enhanced Parameter Processing Tests - Phase 2B Review
 * Comprehensive testing for tool parameter processing
 * 
 * Tests complete parameter processing pipeline from extraction to validation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ToolParameterExtractor, IToolExtractor, ToolExtractionUtils } from '../../../src/tools/extractor';
import { ToolChoiceValidator, IToolChoiceValidator, ToolChoiceValidationUtils } from '../../../src/tools/choice-validator';
import { ToolParameterProcessor, IToolProcessor, ToolProcessingUtils } from '../../../src/tools/processor';
import { ToolValidator } from '../../../src/tools/validator';
import { IToolValidator } from '../../../src/tools/types';
import { OpenAITool, OpenAIToolChoice } from '../../../src/tools/types';
import { TOOL_CHOICE_OPTIONS, TOOL_CHOICE_TYPES, TOOL_PARAMETER_LIMITS } from '../../../src/tools/constants';

describe('Enhanced Parameter Processing - Phase 2B', () => {
  let toolValidator: IToolValidator;
  let toolExtractor: IToolExtractor;
  let toolChoiceValidator: IToolChoiceValidator;
  let processor: IToolProcessor;
  let mockChoiceProcessor: jest.Mocked<any>;

  beforeEach(() => {
    toolValidator = new ToolValidator();
    toolExtractor = new ToolParameterExtractor();
    toolChoiceValidator = new ToolChoiceValidator();
    // Create mock with explicit typing to avoid TypeScript issues
    mockChoiceProcessor = {
      processChoice: jest.fn(),
      createProcessingContext: jest.fn(),
      validateChoiceAgainstTools: jest.fn(),
      createChoiceContext: jest.fn(),
      processChoiceWithContext: jest.fn()
    } as any;
    
    // Setup return values separately
    mockChoiceProcessor.processChoice.mockResolvedValue({ 
      success: true, 
      processedChoice: { type: 'auto' },
      claudeFormat: { mode: 'auto' },
      errors: [] 
    });
    mockChoiceProcessor.createProcessingContext.mockReturnValue({});
    mockChoiceProcessor.validateChoiceAgainstTools.mockReturnValue([]);
    mockChoiceProcessor.createChoiceContext.mockReturnValue({});
    mockChoiceProcessor.processChoiceWithContext.mockResolvedValue({ 
      success: true, 
      errors: [] 
    });
    processor = new ToolParameterProcessor(toolValidator, toolExtractor, toolChoiceValidator, mockChoiceProcessor);
  });

  describe('Complete Parameter Processing Pipeline', () => {
    it('should process valid OpenAI chat completion request with tools', async () => {
      const request = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Test message' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get current weather',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string', description: 'City location' }
                },
                required: ['location']
              }
            }
          }
        ],
        tool_choice: 'auto'
      };

      const result = await processor.processRequest(request);

      expect(result.success).toBe(true);
      expect(result.tools).toHaveLength(1);
      expect(result.tools![0].function.name).toBe('get_weather');
      expect(result.toolChoice).toBe('auto');
      expect(result.errors).toEqual([]);
      expect(result.processingTimeMs).toBeLessThan(TOOL_PARAMETER_LIMITS.PROCESSING_TIMEOUT_MS);
    });

    it('should process request with specific function tool choice', async () => {
      const tools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'search_documents',
            description: 'Search through documents',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                max_results: { type: 'number', minimum: 1, maximum: 100 }
              },
              required: ['query']
            }
          }
        }
      ];

      const toolChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'search_documents' }
      };

      const request = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Search for API documentation' }],
        tools,
        tool_choice: toolChoice
      };

      const result = await processor.processRequest(request);

      expect(result.success).toBe(true);
      expect(result.tools).toEqual(tools);
      expect(result.toolChoice).toEqual(toolChoice);
      expect(ToolChoiceValidationUtils.isFunctionChoice(result.toolChoice!)).toBe(true);
      expect(ToolChoiceValidationUtils.getFunctionName(result.toolChoice!)).toBe('search_documents');
    });

    it('should handle multiple tools with complex parameters', async () => {
      const complexTools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'database_query',
            description: 'Execute database query',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      value: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] }
                    }
                  }
                },
                options: {
                  type: 'object',
                  properties: {
                    timeout: { type: 'number', minimum: 1000, maximum: 30000 },
                    limit: { type: 'number', minimum: 1, maximum: 1000 }
                  }
                }
              },
              required: ['query']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'file_operations',
            description: 'Perform file operations',
            parameters: {
              type: 'object',
              properties: {
                operation: { type: 'string', enum: ['read', 'write', 'delete', 'list'] },
                path: { type: 'string' },
                content: { type: 'string' },
                options: {
                  type: 'object',
                  properties: {
                    encoding: { type: 'string', enum: ['utf8', 'base64', 'binary'] },
                    backup: { type: 'boolean' }
                  }
                }
              },
              required: ['operation', 'path']
            }
          }
        }
      ];

      const request = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Help with database and file operations' }],
        tools: complexTools,
        tool_choice: 'auto'
      };

      const result = await processor.processRequest(request);

      expect(result.success).toBe(true);
      expect(result.tools).toHaveLength(2);
      expect(result.tools![0].function.name).toEqual('database_query');
      expect(result.tools![1].function.name).toEqual('file_operations');
      expect(ToolProcessingUtils.hasValidTools(result)).toBe(true);
    });

    it('should handle requests without tools and provide default behavior', async () => {
      const request = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Regular conversation without tools' }]
      };

      const result = await processor.processRequest(request);

      expect(result.success).toBe(true);
      expect(result.tools).toBeUndefined();
      expect(result.toolChoice).toBeUndefined();
      expect(result.defaultBehavior).toBeDefined();
      expect(result.defaultBehavior!.enableTools).toBe(false);
      expect(result.defaultBehavior!.toolChoice).toBe('none');
      expect(result.defaultBehavior!.allowToolCalls).toBe(false);
    });
  });

  describe('Parameter Processing Error Handling', () => {
    it('should handle invalid tool choice with specific function not in tools', async () => {
      const tools: OpenAITool[] = [
        {
          type: 'function',
          function: { name: 'available_function', description: 'Available function' }
        }
      ];

      const request = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Test' }],
        tools,
        tool_choice: {
          type: 'function',
          function: { name: 'non_existent_function' }
        }
      };

      const result = await processor.processRequest(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Tool choice function name not found in tools array');
    });

    it('should handle tool_choice without tools array', async () => {
      const request = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Test' }],
        tool_choice: 'auto'
      };

      const result = await processor.processRequest(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Tool choice specified but no tools provided');
    });

    it('should handle malformed tools array', async () => {
      const request = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Test' }],
        tools: 'invalid_tools_format'
      };

      const result = await processor.processRequest(request);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle invalid tool choice format', async () => {
      const tools: OpenAITool[] = [
        {
          type: 'function',
          function: { name: 'test_function', description: 'Test function' }
        }
      ];

      const request = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Test' }],
        tools,
        tool_choice: 'invalid_choice'
      };

      const result = await processor.processRequest(request);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Check that the error is related to invalid tool choice
      expect(result.errors.some(error => 
        error.includes('Tool choice string must be') || 
        error.includes('Invalid tool choice string value')
      )).toBe(true);
    });

    it('should handle tools with invalid schema structure', async () => {
      const invalidTools = [
        {
          type: 'function',
          function: {
            name: '', // Invalid empty name
            description: 'Invalid function'
          }
        }
      ];

      const request = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Test' }],
        tools: invalidTools
      };

      const result = await processor.processRequest(request);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Parameter Processing Performance', () => {
    it.skip('should process tool parameters within performance limits', async () => {
      const tools: OpenAITool[] = Array.from({ length: 10 }, (_, i) => ({
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

      const request = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Performance test' }],
        tools,
        tool_choice: 'auto'
      };


      const startTime = Date.now();
      const result = await processor.processRequest(request);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(TOOL_PARAMETER_LIMITS.PROCESSING_TIMEOUT_MS);
      expect(result.processingTimeMs).toBeLessThan(TOOL_PARAMETER_LIMITS.PROCESSING_TIMEOUT_MS);
      expect(ToolProcessingUtils.isWithinPerformanceLimit(result)).toBe(true);
    });

    it('should process complex nested parameters efficiently', async () => {
      const complexTool: OpenAITool = {
        type: 'function',
        function: {
          name: 'complex_processor',
          description: 'Process complex nested data',
          parameters: {
            type: 'object',
            properties: {
              config: {
                type: 'object',
                properties: {
                  settings: {
                    type: 'object',
                    properties: {
                      advanced: {
                        type: 'object',
                        properties: {
                          options: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                key: { type: 'string' },
                                value: { anyOf: [{ type: 'string' }, { type: 'number' }] }
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

      const request = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Process complex data' }],
        tools: [complexTool],
        tool_choice: 'auto'
      };

      const result = await processor.processRequest(request);

      expect(result.success).toBe(true);
      expect(result.processingTimeMs).toBeLessThan(TOOL_PARAMETER_LIMITS.PROCESSING_TIMEOUT_MS);
    });
  });

  describe('Context Merging Integration', () => {
    it('should merge processing result with request context correctly', async () => {
      const request = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Test with tools' }],
        tools: [
          {
            type: 'function',
            function: { name: 'test_function', description: 'Test function' }
          }
        ],
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 1000
      };

      const processingResult = await processor.processRequest(request);
      expect(processingResult.success).toBe(true);

      const mergedContext = processor.mergeWithRequestContext(request, processingResult);

      expect(mergedContext.model).toBe('claude-3-sonnet-20240229');
      expect(mergedContext.messages).toEqual(request.messages);
      expect(mergedContext.temperature).toBe(0.7);
      expect(mergedContext.max_tokens).toBe(1000);
      expect(mergedContext.toolProcessing).toBeDefined();
      expect(mergedContext.toolProcessing.hasTools).toBe(true);
      expect(mergedContext.toolProcessing.toolCount).toBe(1);
      expect(mergedContext.toolProcessing.hasToolChoice).toBe(true);
      expect(mergedContext.toolProcessing.toolChoice).toBe('auto');
      expect(mergedContext.processedTools).toEqual(processingResult.tools);
    });

    it('should handle context merging without tools', async () => {
      const request = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Test without tools' }],
        temperature: 0.5
      };

      const processingResult = await processor.processRequest(request);
      expect(processingResult.success).toBe(true);

      const mergedContext = processor.mergeWithRequestContext(request, processingResult);

      expect(mergedContext.toolProcessing.hasTools).toBe(false);
      expect(mergedContext.toolProcessing.toolCount).toBe(0);
      expect(mergedContext.toolProcessing.hasToolChoice).toBe(false);
      expect(mergedContext.toolProcessing.defaultBehavior).toBeDefined();
      expect(mergedContext.processedTools).toBeUndefined();
    });

    it('should handle context merging errors gracefully', async () => {
      const invalidProcessingResult = {
        success: false,
        errors: ['Processing failed'],
        processingTimeMs: 10
      };

      expect(() => {
        processor.mergeWithRequestContext({}, invalidProcessingResult);
      }).toThrow();
    });
  });

  describe('OpenAI Specification Compliance', () => {
    it('should support all documented tool_choice formats', async () => {
      const tools: OpenAITool[] = [
        {
          type: 'function',
          function: { name: 'test_function', description: 'Test function' }
        }
      ];

      const toolChoices: OpenAIToolChoice[] = [
        TOOL_CHOICE_OPTIONS.AUTO,
        TOOL_CHOICE_OPTIONS.NONE,
        {
          type: TOOL_CHOICE_TYPES.FUNCTION,
          function: { name: 'test_function' }
        }
      ];

      for (const toolChoice of toolChoices) {
        const request = {
          model: 'claude-3-sonnet-20240229',
          messages: [{ role: 'user', content: 'Test' }],
          tools,
          tool_choice: toolChoice
        };

        const result = await processor.processRequest(request);
        expect(result.success).toBe(true);
        expect(result.toolChoice).toEqual(toolChoice);
      }
    });

    it('should match OpenAI API examples exactly', async () => {
      // Direct copy from API_REFERENCE.md tool example
      const openaiRequest = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Read a file' }],
        tools: [
          {
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
          }
        ],
        tool_choice: 'auto'
      };

      const result = await processor.processRequest(openaiRequest);

      expect(result.success).toBe(true);
      expect(result.tools![0].function.name).toBe('read_file');
      expect(result.tools![0].function.description).toBe('Read content from a file');
      expect(result.toolChoice).toBe('auto');
    });

    it('should preserve OpenAI request structure in processing', async () => {
      const openaiRequest = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Test message' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get current weather',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                  unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
                },
                required: ['location']
              }
            }
          }
        ],
        tool_choice: 'auto'
      };

      const result = await processor.processRequest(openaiRequest);
      
      expect(result.success).toBe(true);
      expect(result.tools![0]).toEqual(openaiRequest.tools[0]);
      expect(result.toolChoice).toBe(openaiRequest.tool_choice);
    });
  });

  describe('Tool Processing Utilities', () => {
    it('should provide utility functions for processing results', async () => {
      const tools: OpenAITool[] = [
        {
          type: 'function',
          function: { name: 'utility_function', description: 'Utility test' }
        }
      ];

      const request = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Test utilities' }],
        tools,
        tool_choice: 'auto'
      };

      const result = await processor.processRequest(request);

      expect(ToolProcessingUtils.hasValidTools(result)).toBe(true);
      expect(ToolProcessingUtils.hasToolChoice(result)).toBe(true);
      expect(ToolProcessingUtils.getToolCount(result)).toBe(1);
      expect(ToolProcessingUtils.isDefaultBehavior(result)).toBe(false);
      expect(ToolProcessingUtils.isWithinPerformanceLimit(result)).toBe(true);
    });

    it('should create processing options with defaults', () => {
      const defaultOptions = ToolProcessingUtils.createOptions();
      
      expect(defaultOptions.validateTools).toBe(true);
      expect(defaultOptions.validateToolChoice).toBe(true);
      expect(defaultOptions.enforceTimeout).toBe(true);
      expect(defaultOptions.timeoutMs).toBe(TOOL_PARAMETER_LIMITS.PROCESSING_TIMEOUT_MS);
      expect(defaultOptions.allowPartialProcessing).toBe(false);

      const customOptions = ToolProcessingUtils.createOptions({
        validateTools: false,
        timeoutMs: 1000
      });

      expect(customOptions.validateTools).toBe(false);
      expect(customOptions.timeoutMs).toBe(1000);
      expect(customOptions.validateToolChoice).toBe(true); // Still uses default
    });
  });
});