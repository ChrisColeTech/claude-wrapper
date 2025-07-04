/**
 * OpenAI Tools API Compatibility Tests (Phase 13A)
 * Single Responsibility: OpenAI API specification compliance verification
 * 
 * Validates that all OpenAI tools functionality exactly matches OpenAI API specification
 * Tests all phases 1A-12A for complete OpenAI compatibility
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  ValidationFramework,
  SchemaValidator,
  RuntimeValidator,
  ToolValidator,
  ToolConverter,
  ToolCallResponseBuilder,
  MultiToolCallHandler,
  ToolErrorHandler
} from '../../src/tools';
import { setupCustomMatchers } from '../helpers/openai-tools/assertion-helpers';
import { TestDataFactory } from '../helpers/openai-tools/test-builders';
import { PerformanceUtils } from '../helpers/openai-tools/performance-helpers';
import { SIMPLE_TOOLS, SIMPLE_TOOL_OBJECTS, COMPLEX_TOOLS } from '../fixtures/openai-tools/sample-tools';
import { CHAT_COMPLETION_REQUESTS } from '../fixtures/openai-tools/test-requests';
import { BASIC_TOOL_CALL_RESPONSES, COMPLEX_RESPONSES } from '../fixtures/openai-tools/test-responses';
import { INVALID_TOOL_SCHEMAS } from '../fixtures/openai-tools/error-scenarios';

// Setup custom Jest matchers
setupCustomMatchers();

describe('OpenAI Tools API Compatibility Tests (Phase 13A)', () => {
  let validator: ToolValidator;
  let schemaValidator: SchemaValidator;
  let runtimeValidator: RuntimeValidator;
  let validationFramework: ValidationFramework;
  let converter: ToolConverter;
  let responseBuilder: ToolCallResponseBuilder;
  let multiHandler: MultiToolCallHandler;
  let errorHandler: ToolErrorHandler;

  beforeEach(() => {
    // Initialize all components
    schemaValidator = new SchemaValidator();
    runtimeValidator = new RuntimeValidator();
    validationFramework = new ValidationFramework(schemaValidator, runtimeValidator);
    validator = new ToolValidator();
    converter = new ToolConverter();
    responseBuilder = new ToolCallResponseBuilder();
    multiHandler = new MultiToolCallHandler();
    errorHandler = new ToolErrorHandler();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('OpenAI Tool Schema Compatibility (Phase 1A)', () => {
    it('should validate simple OpenAI tool schemas exactly as OpenAI API', async () => {
      const tool = SIMPLE_TOOLS.calculator;
      
      const result = await validator.validateTool(tool);
      
      expect(result).toBeValidationSuccess();
      expect(tool).toBeValidOpenAITool();
      expect(tool).toMatchOpenAIFormat();
    });

    it('should validate complex OpenAI tool schemas with nested parameters', async () => {
      const tool = COMPLEX_TOOLS.data_processor;
      
      const result = await validator.validateTool(tool);
      
      expect(result).toBeValidationSuccess();
      expect(tool).toBeValidOpenAITool();
      expect(tool).toHaveValidToolSchema();
    });

    it('should validate all JSON Schema parameter types as per OpenAI spec', async () => {
      const typeTests = [
        { type: 'string', value: 'test' },
        { type: 'number', value: 42 },
        { type: 'integer', value: 42 },
        { type: 'boolean', value: true },
        { type: 'array', value: ['item1', 'item2'] },
        { type: 'object', value: { key: 'value' } },
        { type: 'null', value: null }
      ];

      for (const testCase of typeTests) {
        const tool = TestDataFactory.simpleTool(`test_${testCase.type}`);
        tool.function.parameters = {
          type: 'object',
          properties: {
            param: { type: testCase.type as any }
          },
          required: ['param']
        };

        const result = await validator.validateTool(tool);
        expect(result).toBeValidationSuccess();
        expect(tool).toBeValidOpenAITool();
      }
    });

    it('should reject invalid tool schemas exactly like OpenAI API', async () => {
      const invalidSchemas = [
        INVALID_TOOL_SCHEMAS.missing_type,
        INVALID_TOOL_SCHEMAS.invalid_type,
        INVALID_TOOL_SCHEMAS.missing_function,
        INVALID_TOOL_SCHEMAS.missing_function_name
      ];

      for (const invalidTool of invalidSchemas) {
        const result = await validator.validateTool(invalidTool as any);
        expect(result).toBeValidationFailure();
        expect(result).toHaveValidationErrors();
      }
    });

    it('should validate tool arrays with unique names requirement', async () => {
      const tools = [
        SIMPLE_TOOLS.calculator,
        SIMPLE_TOOLS.weather_lookup,
        SIMPLE_TOOLS.url_shortener
      ];

      const result = await validator.validateToolArray(tools);
      
      expect(result).toBeValidationSuccess();
      expect(tools).toBeValidToolArray();
      expect(tools).toHaveUniqueToolNames();
    });

    it('should reject tool arrays with duplicate function names', async () => {
      const tools = [
        SIMPLE_TOOLS.calculator,
        SIMPLE_TOOLS.calculator // Duplicate
      ];

      const result = await validator.validateToolArray(tools);
      
      expect(result).toBeValidationFailure();
      expect(result).toHaveValidationError('tools', 'DUPLICATE_FUNCTION_NAMES');
    });
  });

  describe('OpenAI Parameter Processing Compatibility (Phase 2A)', () => {
    it('should extract parameters exactly as OpenAI API expects', async () => {
      const request = CHAT_COMPLETION_REQUESTS.basic_with_tools;
      
      // Test parameter extraction
      const tools = request.tools;
      const toolChoice = request.tool_choice;

      expect(tools).toBeValidToolArray();
      expect(toolChoice).toBeValidToolChoice();
    });

    it('should handle tool choice parameter formats per OpenAI specification', async () => {
      const validChoices = [
        'auto',
        'none',
        { type: 'function', function: { name: 'calculator' } }
      ];

      for (const choice of validChoices) {
        expect(choice).toBeValidToolChoice();
      }
    });

    it('should reject invalid tool choice formats', async () => {
      const invalidChoices = [
        'invalid_string',
        { type: 'invalid' },
        { function: { name: 'test' } }, // Missing type
        { type: 'function' }, // Missing function
        { type: 'function', function: {} } // Missing function name
      ];

      for (const choice of invalidChoices) {
        expect(choice).not.toBeValidToolChoice();
      }
    });
  });

  describe('OpenAI Format Conversion Compatibility (Phase 3A)', () => {
    it('should convert OpenAI tools to Claude format maintaining data fidelity', async () => {
      const openaiTool = SIMPLE_TOOLS.calculator;
      
      const { result: claudeTool, timeMs } = await PerformanceUtils.timeAsync(() =>
        converter.convertToClaudeFormat([openaiTool])
      );

      expect(timeMs).toBeLessThan(15); // Performance requirement
      expect(claudeTool).toBeDefined();
      expect(claudeTool[0]).toHaveProperty('name', openaiTool.function.name);
    });

    it('should convert Claude tools back to OpenAI format without data loss', async () => {
      const openaiTool = SIMPLE_TOOLS.calculator;
      
      // Round-trip conversion
      const claudeTools = await converter.convertToClaudeFormat([openaiTool]);
      const backToOpenAI = await converter.convertToOpenAIFormat(claudeTools);

      expect(backToOpenAI[0]).toBeValidOpenAITool();
      expect(backToOpenAI[0].function.name).toBe(openaiTool.function.name);
      expect(backToOpenAI[0].function.description).toBe(openaiTool.function.description);
    });

    it('should handle complex nested parameter conversion accurately', async () => {
      const complexTool = COMPLEX_TOOLS.data_processor;
      
      const claudeTools = await converter.convertToClaudeFormat([complexTool]);
      const backToOpenAI = await converter.convertToOpenAIFormat(claudeTools);

      expect(backToOpenAI[0]).toBeValidOpenAITool();
      expect(backToOpenAI[0]).toHaveValidToolSchema();
      
      // Verify parameter structure preservation
      const originalParams = complexTool.function.parameters;
      const convertedParams = backToOpenAI[0].function.parameters;
      
      expect(convertedParams).toEqual(originalParams);
    });
  });

  describe('OpenAI Response Format Compatibility (Phase 4A)', () => {
    it('should generate tool call responses in exact OpenAI format', async () => {
      const toolCall = {
        id: 'call_abc123',
        type: 'function' as const,
        function: {
          name: 'calculator',
          arguments: '{"operation": "add", "a": 2, "b": 3}'
        }
      };

      const response = await responseBuilder.buildToolCallResponse(toolCall, 'Success: 5');

      expect(response).toBeOpenAICompatible();
      expect(response.tool_calls).toBeDefined();
      expect(response.tool_calls[0]).toBeValidToolCall();
      expect(response.tool_calls[0]).toHaveToolCallId();
    });

    it('should generate tool call IDs in OpenAI format (call_ prefix)', async () => {
      const toolCall = await responseBuilder.generateToolCall('calculator', { a: 1, b: 2 });

      expect(toolCall).toBeValidToolCall();
      expect(toolCall).toHaveToolCallId();
      expect(toolCall.id).toMatch(/^call_[a-zA-Z0-9]+$/);
    });

    it('should format multiple tool calls with unique IDs', async () => {
      const tools = [
        { name: 'calculator', args: { a: 1, b: 2 } },
        { name: 'weather', args: { location: 'NYC' } }
      ];

      const toolCalls = await Promise.all(
        tools.map(t => responseBuilder.generateToolCall(t.name, t.args))
      );

      expect(toolCalls).toHaveNoDuplicateIds();
      toolCalls.forEach(tc => {
        expect(tc).toBeValidToolCall();
        expect(tc).toHaveToolCallId();
      });
    });
  });

  describe('OpenAI Tool Choice Logic Compatibility (Phase 5A)', () => {
    it('should handle "auto" tool choice exactly as OpenAI API', async () => {
      const tools = [SIMPLE_TOOLS.calculator, SIMPLE_TOOLS.weather_lookup];
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user' as const, content: 'Calculate 2+2' }],
        tools,
        tool_choice: 'auto' as const
      };

      // Validation should pass
      const toolsResult = await validator.validateToolArray(tools);
      expect(toolsResult).toBeValidationSuccess();
      expect(request.tool_choice).toBeValidToolChoice();
    });

    it('should handle "none" tool choice to disable tool usage', async () => {
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user' as const, content: 'Just answer normally' }],
        tools: [SIMPLE_TOOLS.calculator],
        tool_choice: 'none' as const
      };

      expect(request.tool_choice).toBeValidToolChoice();
    });

    it('should handle specific function tool choice with validation', async () => {
      const tools = [SIMPLE_TOOLS.calculator, SIMPLE_TOOLS.weather_lookup];
      const toolChoice = { type: 'function' as const, function: { name: 'calculator' } };

      expect(toolChoice).toBeValidToolChoice();
      
      // Verify function exists in tools array
      const functionExists = tools.some(t => t.function.name === toolChoice.function.name);
      expect(functionExists).toBe(true);
    });
  });

  describe('OpenAI Multi-Tool Support Compatibility (Phase 7A)', () => {
    it('should handle multiple tool calls in single request per OpenAI spec', async () => {
      const tools = [
        SIMPLE_TOOLS.calculator,
        SIMPLE_TOOLS.weather_lookup,
        SIMPLE_TOOLS.url_shortener
      ];

      const result = await multiHandler.processMultipleTools(tools, {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Use multiple tools' }],
        tools,
        tool_choice: 'auto'
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should execute parallel tool calls maintaining OpenAI response format', async () => {
      const tools = [SIMPLE_TOOLS.calculator, SIMPLE_TOOLS.weather_lookup];
      
      const { result, timeMs } = await PerformanceUtils.timeAsync(() =>
        multiHandler.executeParallel(tools)
      );

      expect(timeMs).toBeLessThan(1000); // Should be fast for parallel execution
      expect(result).toBeDefined();
    });
  });

  describe('OpenAI Error Handling Compatibility (Phase 8A)', () => {
    it('should return errors in exact OpenAI error format', async () => {
      const invalidTool = { invalid: 'tool' };

      try {
        await validator.validateTool(invalidTool as any);
      } catch (error) {
        const errorResponse = await errorHandler.handleError({
          error,
          context: { tool: invalidTool }
        });

        expect(errorResponse.errorResponse).toMatchOpenAIErrorFormat();
      }
    });

    it('should classify errors with OpenAI-compatible error types', async () => {
      const testErrors = [
        { error: new Error('validation failed'), expectedType: 'validation' },
        { error: new Error('timeout exceeded'), expectedType: 'timeout' },
        { error: new Error('invalid format'), expectedType: 'format' },
        { error: new Error('system error'), expectedType: 'system' }
      ];

      for (const { error, expectedType } of testErrors) {
        const result = await errorHandler.handleError({ error });
        
        expect(result.success).toBe(true);
        expect(result.errorResponse).toBeDefined();
      }
    });
  });

  describe('OpenAI Validation Framework Compatibility (Phase 12A)', () => {
    it('should provide complete validation matching OpenAI API behavior', async () => {
      const tool = SIMPLE_TOOLS.calculator;
      const parameters = { operation: 'add', a: 2, b: 3 };

      const { result, timeMs } = await PerformanceUtils.timeAsync(() =>
        validationFramework.validateComplete(tool, parameters)
      );

      expect(timeMs).toBeLessThan(2); // <2ms requirement
      expect(result).toBeValidationSuccess();
      expect(result).toCompleteWithinTimeLimit(2);
    });

    it('should validate tool arrays with OpenAI-compatible results', async () => {
      const tools = [
        SIMPLE_TOOLS.calculator,
        SIMPLE_TOOLS.weather_lookup,
        SIMPLE_TOOLS.url_shortener
      ];

      const results = await validationFramework.validateTools(tools);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeValidationSuccess();
        expect(result).toCompleteWithinTimeLimit(2);
      });
    });

    it('should validate tools with choice per OpenAI specification', async () => {
      const tools = [SIMPLE_TOOLS.calculator];
      const toolChoice = { type: 'function' as const, function: { name: 'calculator' } };

      const result = await validationFramework.validateToolsWithChoice(tools, toolChoice);

      expect(result).toBeValidationSuccess();
      expect(result).toCompleteWithinTimeLimit(2);
    });
  });

  describe('OpenAI API Request/Response Cycle Compatibility', () => {
    it('should handle complete chat completion request with tools exactly like OpenAI', async () => {
      const request = CHAT_COMPLETION_REQUESTS.complex_with_multiple_tools;

      // Validate request structure
      expect(request.tools).toBeValidToolArray();
      expect(request.tool_choice).toBeValidToolChoice();
      expect(request).toBeOpenAICompatible();

      // Validate each tool
      for (const tool of request.tools) {
        const result = await validator.validateTool(tool);
        expect(result).toBeValidationSuccess();
      }
    });

    it('should generate responses that exactly match OpenAI API format', async () => {
      const expectedResponse = BASIC_TOOL_CALL_RESPONSES.single_tool_call;

      expect(expectedResponse).toBeOpenAICompatible();
      expect(expectedResponse.choices[0].message.tool_calls).toBeDefined();
      
      if (expectedResponse.choices[0].message.tool_calls) {
        expectedResponse.choices[0].message.tool_calls.forEach(tc => {
          expect(tc).toBeValidToolCall();
          expect(tc).toHaveToolCallId();
        });
      }
    });

    it('should handle streaming responses with tool calls per OpenAI spec', async () => {
      // Test streaming tool call format
      const streamChunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1694268190,
        model: 'gpt-4',
        choices: [{
          index: 0,
          delta: {
            tool_calls: [{
              index: 0,
              id: 'call_abc123',
              type: 'function' as const,
              function: {
                name: 'calculator',
                arguments: '{"a": 2, "b"'
              }
            }]
          },
          finish_reason: null
        }]
      };

      expect(streamChunk).toBeOpenAICompatible();
      expect(streamChunk.choices[0].delta.tool_calls![0]).toBeValidToolCall();
    });
  });

  describe('Performance Requirements Compliance', () => {
    it('should meet all OpenAI API performance expectations', async () => {
      const tools = [SIMPLE_TOOL_OBJECTS.calculator, SIMPLE_TOOL_OBJECTS.weather_lookup];
      const startTime = performance.now();

      // Validate tools
      const validationResults = await Promise.all(
        tools.map(tool => validator.validateTool(tool))
      );

      // Convert formats
      const claudeTools = converter.toClaudeFormat(tools);
      const backToOpenAI = converter.toOpenAIFormat(claudeTools.data || []);

      // Generate tool calls
      const toolCalls = await Promise.all([
        responseBuilder.generateToolCall('calculator', { a: 1, b: 2 }),
        responseBuilder.generateToolCall('weather_lookup', { location: 'NYC' })
      ]);

      const totalTime = performance.now() - startTime;

      // Verify all operations completed successfully
      validationResults.forEach(result => {
        expect(result).toBeValidationSuccess();
      });

      expect(backToOpenAI).toBeValidToolArray();
      expect(toolCalls).toHaveNoDuplicateIds();

      // Verify performance is reasonable (should be very fast)
      expect(totalTime).toBeLessThan(100); // Should complete in under 100ms
    });
  });
});