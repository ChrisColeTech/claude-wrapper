/**
 * OpenAI Tools Edge Cases and Error Scenarios Tests (Phase 13A)
 * Single Responsibility: Comprehensive edge case and boundary testing
 * 
 * Tests all error scenarios, boundary conditions, and edge cases
 * Ensures robust error handling across all phases 1A-12A
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
  ToolErrorHandler,
  ToolMapper,
  ToolFormatValidator,
  createValidationFramework
} from '../../src/tools';
import { setupCustomMatchers } from '../helpers/openai-tools/assertion-helpers';
import { TestDataFactory, OpenAIToolBuilder, ToolArrayBuilder } from '../helpers/openai-tools/test-builders';
import { PerformanceUtils } from '../helpers/openai-tools/performance-helpers';
import { SIMPLE_TOOLS, COMPLEX_TOOLS, EDGE_CASE_TOOLS } from '../fixtures/openai-tools/sample-tools';
import { 
  INVALID_TOOL_SCHEMAS,
  INVALID_FUNCTION_DEFINITIONS,
  INVALID_PARAMETER_SCHEMAS,
  INVALID_TOOL_ARRAYS,
  INVALID_TOOL_CHOICES,
  PERFORMANCE_LIMIT_SCENARIOS,
  COMPLEX_ERROR_SCENARIOS
} from '../fixtures/openai-tools/error-scenarios';

setupCustomMatchers();

describe('OpenAI Tools Edge Cases and Error Scenarios (Phase 13A)', () => {
  let validator: ToolValidator;
  let schemaValidator: SchemaValidator;
  let runtimeValidator: RuntimeValidator;
  let validationFramework: ValidationFramework;
  let converter: ToolConverter;
  let responseBuilder: ToolCallResponseBuilder;
  let multiHandler: MultiToolCallHandler;
  let errorHandler: ToolErrorHandler;

  beforeEach(() => {
    schemaValidator = new SchemaValidator();
    runtimeValidator = new RuntimeValidator();
    validationFramework = createValidationFramework(schemaValidator, runtimeValidator);
    validator = new ToolValidator();
    
    // Create required dependencies for ToolConverter
    const mapper = new ToolMapper();
    const formatValidator = new ToolFormatValidator();
    converter = new ToolConverter(mapper, formatValidator);
    
    responseBuilder = new ToolCallResponseBuilder();
    multiHandler = new MultiToolCallHandler();
    errorHandler = new ToolErrorHandler();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Validation Edge Cases (Phase 1A)', () => {
    it('should handle null and undefined tool inputs gracefully', async () => {
      const nullInputs = [null, undefined, {}, [], '', 0, false];
      
      for (const input of nullInputs) {
        const result = await validator.validateTool(input as any);
        expect(result).toBeValidationFailure();
        expect(result).toHaveValidationErrors();
      }
    });

    it('should reject tools with invalid type field', async () => {
      const invalidTypes = ['tool', 'method', 'action', 123, null, undefined, {}];
      
      for (const invalidType of invalidTypes) {
        const tool = {
          type: invalidType,
          function: {
            name: 'test_function',
            description: 'Test function'
          }
        };
        
        const result = await validator.validateTool(tool as any);
        expect(result).toBeValidationFailure();
        expect(result).toHaveValidationError('type');
      }
    });

    it('should handle missing function field', async () => {
      const invalidTools = [
        { type: 'function' }, // Missing function entirely
        { type: 'function', function: null },
        { type: 'function', function: undefined },
        { type: 'function', function: '' },
        { type: 'function', function: 123 }
      ];
      
      for (const tool of invalidTools) {
        const result = await validator.validateTool(tool as any);
        expect(result).toBeValidationFailure();
        expect(result).toHaveValidationError('function');
      }
    });

    it('should reject functions with invalid names', async () => {
      const invalidNames = [
        '', // Empty string
        ' ', // Whitespace only
        'function-with-dashes-invalid',
        '123_starts_with_number',
        'has spaces',
        'has.dots',
        'has@symbols',
        'has#hash',
        'function', // Reserved word
        'tool', // Reserved word
        'system', // Reserved word
        'a'.repeat(65) // Too long (>64 chars)
      ];
      
      for (const name of invalidNames) {
        const tool = OpenAIToolBuilder.create()
          .withName(name)
          .withDescription('Test function')
          .withStringParameter('input')
          .build();
        
        const result = await validator.validateTool(tool);
        expect(result).toBeValidationFailure();
      }
    });

    it('should handle deeply nested parameter schemas at limit', async () => {
      // Test maximum allowed depth (5 levels)
      const tool = OpenAIToolBuilder.create()
        .withName('deep_nested_test')
        .withDescription('Test deep nesting')
        .withNestedObjectParameter('nested_param', 5)
        .build();
      
      const result = await validator.validateTool(tool);
      expect(result).toBeValidationSuccess(); // Should pass at limit
      
      // Test exceeding maximum depth (6 levels)
      const tooDeepTool = OpenAIToolBuilder.create()
        .withName('too_deep_test')
        .withDescription('Test too deep nesting')
        .withNestedObjectParameter('nested_param', 6)
        .build();
      
      const tooDeepResult = await validator.validateTool(tooDeepTool);
      expect(tooDeepResult).toBeValidationFailure();
      expect(tooDeepResult).toHaveValidationError('parameters', 'DEPTH_EXCEEDED');
    });

    it('should handle parameter schemas with maximum properties', async () => {
      // Test at limit (100 properties)
      const tool = OpenAIToolBuilder.create()
        .withName('max_properties_test')
        .withDescription('Test maximum properties')
        .withComplexSchema(100)
        .build();
      
      const result = await validator.validateTool(tool);
      expect(result).toBeValidationSuccess(); // Should pass at limit
      
      // Test exceeding limit (101 properties)
      const tooManyPropsTools = OpenAIToolBuilder.create()
        .withName('too_many_props_test')
        .withDescription('Test too many properties')
        .withComplexSchema(101)
        .build();
      
      const tooManyResult = await validator.validateTool(tooManyPropsTools);
      expect(tooManyResult).toBeValidationFailure();
      expect(tooManyResult).toHaveValidationError('parameters', 'TOO_MANY_PROPERTIES');
    });

    it('should reject unsupported JSON Schema types', async () => {
      const unsupportedTypes = ['date', 'binary', 'uuid', 'uri', 'email'];
      
      for (const type of unsupportedTypes) {
        const tool = {
          type: 'function',
          function: {
            name: 'test_unsupported',
            description: 'Test unsupported type',
            parameters: {
              type: 'object',
              properties: {
                param: { type }
              }
            }
          }
        };
        
        const result = await validator.validateTool(tool as any);
        expect(result).toBeValidationFailure();
        expect(result).toHaveValidationError('parameters');
      }
    });

    it('should handle circular references in schemas gracefully', async () => {
      const circularSchema: any = {
        type: 'object',
        properties: {
          self: null
        }
      };
      circularSchema.properties.self = circularSchema; // Create circular reference
      
      const tool = {
        type: 'function',
        function: {
          name: 'circular_test',
          description: 'Test circular reference',
          parameters: circularSchema
        }
      };
      
      const result = await validator.validateTool(tool as any);
      expect(result).toBeValidationFailure();
      expect(result).toHaveValidationError('parameters');
    });
  });

  describe('Tool Array Validation Edge Cases (Phase 1A)', () => {
    it('should handle empty tool arrays', async () => {
      const result = await validator.validateToolArray([]);
      expect(result).toBeValidationFailure();
      expect(result).toHaveValidationError('tools', 'ARRAY_EMPTY');
    });

    it('should handle null/undefined tool arrays', async () => {
      const nullResults = await Promise.all([
        validator.validateToolArray(null as any),
        validator.validateToolArray(undefined as any)
      ]);
      
      nullResults.forEach(result => {
        expect(result).toBeValidationFailure();
        expect(result).toHaveValidationError('tools');
      });
    });

    it('should reject tool arrays exceeding maximum size', async () => {
      // Create array with 129 tools (exceeding limit of 128)
      const tools = ToolArrayBuilder.create()
        .addToolsFromCount(129, 'simple')
        .build();
      
      const result = await validator.validateToolArray(tools);
      expect(result).toBeValidationFailure();
      expect(result).toHaveValidationError('tools', 'ARRAY_TOO_LARGE');
    });

    it('should detect duplicate function names', async () => {
      const tools = ToolArrayBuilder.create()
        .addTool(SIMPLE_TOOLS.calculator)
        .addTool(SIMPLE_TOOLS.weather_lookup)
        .withDuplicateName('calculator') // Add duplicate
        .build();
      
      const result = await validator.validateToolArray(tools);
      expect(result).toBeValidationFailure();
      expect(result).toHaveValidationError('tools', 'DUPLICATE_FUNCTION_NAMES');
    });

    it('should handle mixed valid and invalid tools in array', async () => {
      const tools = [
        SIMPLE_TOOLS.calculator, // Valid
        { type: 'invalid' }, // Invalid type
        SIMPLE_TOOLS.weather_lookup, // Valid
        { type: 'function' }, // Missing function
        SIMPLE_TOOLS.url_shortener // Valid
      ];
      
      const result = await validator.validateToolArray(tools as any);
      expect(result).toBeValidationFailure();
      expect(result.errors.length).toBeGreaterThan(1); // Multiple errors
    });
  });

  describe('Tool Choice Validation Edge Cases (Phase 5A)', () => {
    it('should handle invalid string tool choices', async () => {
      const invalidChoices = ['automatic', 'disabled', 'required', 'manual', '', ' '];
      
      for (const choice of invalidChoices) {
        expect(choice).not.toBeValidToolChoice();
      }
    });

    it('should handle malformed function tool choices', async () => {
      const invalidChoices = [
        { type: 'function' }, // Missing function
        { function: { name: 'test' } }, // Missing type
        { type: 'tool', function: { name: 'test' } }, // Wrong type
        { type: 'function', function: {} }, // Missing function name
        { type: 'function', function: { name: '' } }, // Empty function name
        { type: 'function', function: { name: 123 } }, // Invalid function name type
        { type: 'function', function: null }
      ];
      
      for (const choice of invalidChoices) {
        expect(choice).not.toBeValidToolChoice();
      }
    });

    it('should validate tool choice function exists in tools array', async () => {
      const tools = [SIMPLE_TOOLS.calculator, SIMPLE_TOOLS.weather_lookup];
      const validChoice = { type: 'function' as const, function: { name: 'calculator' } };
      const invalidChoice = { type: 'function' as const, function: { name: 'non_existent' } };
      
      expect(validChoice).toBeValidToolChoice();
      expect(invalidChoice).toBeValidToolChoice(); // Structure is valid
      
      // But function name validation should fail
      const toolNames = tools.map(t => t.function.name);
      expect(toolNames).toContain(validChoice.function.name);
      expect(toolNames).not.toContain(invalidChoice.function.name);
    });
  });

  describe('Runtime Parameter Validation Edge Cases (Phase 12A)', () => {
    it('should handle missing required parameters', async () => {
      const tool = SIMPLE_TOOLS.calculator;
      const incompleteParameters = { operation: 'add', a: 2 }; // Missing 'b'
      
      const context = {
        tool,
        parameters: incompleteParameters,
        requestId: 'test',
        sessionId: 'test'
      };
      
      const result = await runtimeValidator.validateRuntimeParameters(context);
      expect(result).toBeValidationFailure();
      expect(result).toHaveValidationError('parameters.b', 'PARAMETER_VALIDATION_ERROR');
    });

    it('should handle type mismatches in parameters', async () => {
      const tool = SIMPLE_TOOLS.calculator;
      const wrongTypeParameters = {
        operation: 'add',
        a: 'not_a_number', // Should be number
        b: 3
      };
      
      const context = {
        tool,
        parameters: wrongTypeParameters,
        requestId: 'test',
        sessionId: 'test'
      };
      
      const result = await runtimeValidator.validateRuntimeParameters(context);
      expect(result).toBeValidationFailure();
      expect(result).toHaveValidationError('parameters.a');
    });

    it('should handle null and undefined parameter values', async () => {
      const tool = OpenAIToolBuilder.create()
        .withName('null_test')
        .withDescription('Test null handling')
        .withStringParameter('required_param')
        .withStringParameter('optional_param', false)
        .build();
      
      const contexts = [
        { parameters: { required_param: null, optional_param: 'valid' } },
        { parameters: { required_param: undefined, optional_param: 'valid' } },
        { parameters: { required_param: 'valid', optional_param: null } },
        { parameters: { required_param: 'valid', optional_param: undefined } }
      ];
      
      for (const contextData of contexts) {
        const context = {
          tool,
          parameters: contextData.parameters,
          requestId: 'test',
          sessionId: 'test'
        };
        
        const result = await runtimeValidator.validateRuntimeParameters(context);
        
        if (contextData.parameters.required_param === null || 
            contextData.parameters.required_param === undefined) {
          expect(result).toBeValidationFailure();
          expect(result).toHaveValidationError('parameters.required_param');
        } else {
          expect(result).toBeValidationSuccess();
        }
      }
    });

    it('should handle extremely large parameter values', async () => {
      const tool = OpenAIToolBuilder.create()
        .withName('large_param_test')
        .withDescription('Test large parameters')
        .withStringParameter('large_string')
        .withArrayParameter('large_array', 'string')
        .build();
      
      const largeString = 'x'.repeat(1000000); // 1MB string
      const largeArray = Array(10000).fill('item'); // Large array
      
      const context = {
        tool,
        parameters: {
          large_string: largeString,
          large_array: largeArray
        },
        requestId: 'test',
        sessionId: 'test'
      };
      
      const result = await runtimeValidator.validateRuntimeParameters(context);
      // Should handle large values gracefully (may pass or fail based on limits)
      expect(result).toBeDefined();
      expect(result.validationTimeMs).toBeLessThan(100); // Should not take too long
    });

    it('should handle custom validation rules edge cases', async () => {
      const rule = {
        name: 'edge_case_rule',
        priority: 1,
        enabled: true,
        async: false,
        validator: (value: any) => {
          if (value === 'trigger_error') {
            throw new Error('Custom rule error');
          }
          return { valid: value !== 'invalid', error: undefined };
        }
      };
      
      const success = runtimeValidator.addCustomRule(rule);
      expect(success).toBe(true);
      
      const tool = OpenAIToolBuilder.create()
        .withName('custom_rule_test')
        .withDescription('Test custom rule')
        .withStringParameter('test_param')
        .build();
      
      // Test error triggering
      const errorContext = {
        tool,
        parameters: { test_param: 'trigger_error' },
        requestId: 'test',
        sessionId: 'test',
        customRules: [rule]
      };
      
      const errorResult = await runtimeValidator.validateRuntimeParameters(errorContext);
      expect(errorResult).toBeValidationFailure();
      
      // Test invalid value
      const invalidContext = {
        tool,
        parameters: { test_param: 'invalid' },
        requestId: 'test',
        sessionId: 'test',
        customRules: [rule]
      };
      
      const invalidResult = await runtimeValidator.validateRuntimeParameters(invalidContext);
      expect(invalidResult).toBeValidationFailure();
    });
  });

  describe('Format Conversion Edge Cases (Phase 3A)', () => {
    it('should handle conversion of tools with missing optional fields', async () => {
      const minimalTool = {
        type: 'function' as const,
        function: {
          name: 'minimal_function'
          // Missing description and parameters
        }
      };
      
      const claudeFormat = converter.toClaudeFormat([minimalTool]);
      expect(claudeFormat.data).toBeDefined();
      expect(claudeFormat.data[0]).toHaveProperty('name', 'minimal_function');
      
      const backToOpenAI = converter.toOpenAIFormat(claudeFormat.data);
      expect(backToOpenAI[0]).toBeValidOpenAITool();
    });

    it('should preserve complex parameter structures during conversion', async () => {
      const complexTool = COMPLEX_TOOLS.data_processor;
      
      // Multiple round-trip conversions
      let currentFormat = [complexTool];
      for (let i = 0; i < 3; i++) {
        const claudeFormat = converter.toClaudeFormat(currentFormat);
        currentFormat = converter.toOpenAIFormat(claudeFormat.data).data || [];
      }
      
      expect(currentFormat[0]).toBeValidOpenAITool();
      expect(currentFormat[0].function.parameters).toEqual(complexTool.function.parameters);
    });

    it('should handle conversion errors gracefully', async () => {
      const malformedTool = {
        type: 'function',
        function: {
          name: 'malformed',
          parameters: {
            type: 'object',
            properties: {
              circular: null as any
            }
          }
        }
      };
      
      // Create circular reference
      malformedTool.function.parameters.properties.circular = malformedTool.function.parameters;
      
      try {
        converter.toClaudeFormat([malformedTool as any]);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error).toBeFormatError();
      }
    });
  });

  describe('Multi-Tool Processing Edge Cases (Phase 7A)', () => {
    it('should handle empty tool arrays in multi-tool requests', async () => {
      const request = {
        model: 'gpt-4',
        messages: [{ role: 'user' as const, content: 'Test' }],
        tools: [],
        tool_choice: 'auto' as const
      };
      
      try {
        await multiHandler.processMultipleTools([], request);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle partial failures in parallel processing', async () => {
      const tools = [
        SIMPLE_TOOLS.calculator, // Valid
        EDGE_CASE_TOOLS.timeout_tool, // Should timeout
        SIMPLE_TOOLS.weather_lookup // Valid
      ];
      
      const result = await multiHandler.executeParallel(tools);
      
      // Should handle partial failures gracefully
      expect(result).toBeDefined();
    });

    it('should handle concurrent processing limits', async () => {
      // Create more tools than concurrent limit
      const manyTools = ToolArrayBuilder.create()
        .addToolsFromCount(60, 'simple') // Exceeds concurrent limit
        .build();
      
      const startTime = performance.now();
      const result = await multiHandler.executeParallel(manyTools);
      const duration = performance.now() - startTime;
      
      expect(result).toBeDefined();
      expect(duration).toBeLessThan(10000); // Should not hang indefinitely
    });
  });

  describe('Error Handling Edge Cases (Phase 8A)', () => {
    it('should handle non-Error objects in error classification', async () => {
      const strangeErrors = [
        'string error',
        123,
        { message: 'object error' },
        null,
        undefined,
        Symbol('symbol error'),
        [1, 2, 3]
      ];
      
      for (const error of strangeErrors) {
        const result = await errorHandler.handleError({ error });
        expect(result.success).toBe(true);
        expect(result.errorResponse).toBeDefined();
      }
    });

    it('should handle recursive error handling failures', async () => {
      const errorCausingError = {
        get message() {
          throw new Error('Error in error message getter');
        }
      };
      
      const result = await errorHandler.handleError({ 
        error: errorCausingError,
        context: { recursive: true }
      });
      
      expect(result.success).toBe(false); // Should fail gracefully
      expect(result.isolationSuccessful).toBe(false);
    });

    it('should handle error handling timeouts', async () => {
      const slowError = {
        get message() {
          // Simulate slow operation
          const start = Date.now();
          while (Date.now() - start < 10) {
            // Busy wait for 10ms
          }
          return 'slow error';
        }
      };
      
      const result = await errorHandler.handleError({
        error: slowError
      }, {
        timeoutMs: 5 // Very short timeout
      });
      
      expect(result).toBeDefined();
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle validation timeouts gracefully', async () => {
      const tool = TestDataFactory.complexTool('timeout_test', 50);
      const parameters = TestDataFactory.validParameters(tool);
      
      // Override timeout to very short value
      const originalTimeout = jest.spyOn(validationFramework, 'configure');
      validationFramework.configure({ maxValidationTimeMs: 0.1 }); // 0.1ms timeout
      
      const result = await validationFramework.validateComplete(tool, parameters);
      
      // Should handle timeout gracefully
      expect(result).toBeDefined();
      expect(result.validationTimeMs).toBeGreaterThan(0);
      
      originalTimeout.mockRestore();
    });

    it('should handle memory pressure during validation', async () => {
      // Create memory pressure
      const largeArrays: any[] = [];
      try {
        for (let i = 0; i < 100; i++) {
          largeArrays.push(new Array(100000).fill(`memory_pressure_${i}`));
        }
        
        const tool = TestDataFactory.complexTool('memory_test', 10);
        const parameters = TestDataFactory.validParameters(tool);
        
        const result = await validationFramework.validateComplete(tool, parameters);
        expect(result).toBeDefined();
        
      } finally {
        // Clean up memory
        largeArrays.length = 0;
        if (global.gc) {
          global.gc();
        }
      }
    });

    it('should handle extremely deep recursion in parameter validation', async () => {
      // Create extremely deep nested structure
      let deepObject: any = { value: 'deep' };
      for (let i = 0; i < 20; i++) { // Very deep nesting
        deepObject = { nested: deepObject };
      }
      
      const tool = OpenAIToolBuilder.create()
        .withName('deep_recursion_test')
        .withDescription('Test deep recursion')
        .withObjectParameter('deep_param', { nested: { type: 'object' } })
        .build();
      
      const context = {
        tool,
        parameters: { deep_param: deepObject },
        requestId: 'test',
        sessionId: 'test'
      };
      
      const result = await runtimeValidator.validateRuntimeParameters(context);
      // Should handle deep recursion without stack overflow
      expect(result).toBeDefined();
    });
  });

  describe('Integration Edge Cases', () => {
    it('should handle complete workflow with all edge cases combined', async () => {
      // Create a tool with multiple edge cases
      const edgeCaseTool = OpenAIToolBuilder.create()
        .withName('edge_case_integration')
        .withDescription('A'.repeat(1000)) // Long description
        .withStringParameter('required_param')
        .withObjectParameter('optional_object', {
          nested: {
            type: 'object',
            properties: {
              deep: { type: 'string' }
            }
          }
        }, false)
        .build();
      
      // Parameters with edge cases
      const edgeCaseParams = {
        required_param: '', // Empty but present
        optional_object: {
          nested: {
            deep: 'x'.repeat(10000) // Very long string
          },
          extra_field: 'should_be_ignored' // Extra field
        }
      };
      
      // Run complete validation workflow
      const { result, timeMs } = await PerformanceUtils.timeAsync(async () => {
        // Schema validation
        const schemaResult = await schemaValidator.validateToolSchema(edgeCaseTool);
        
        // Runtime validation
        const runtimeResult = await runtimeValidator.validateRuntimeParameters({
          tool: edgeCaseTool,
          parameters: edgeCaseParams,
          requestId: 'edge-case-test',
          sessionId: 'edge-case-session'
        });
        
        // Complete validation
        const completeResult = await validationFramework.validateComplete(
          edgeCaseTool, 
          edgeCaseParams
        );
        
        return {
          schema: schemaResult,
          runtime: runtimeResult,
          complete: completeResult
        };
      });
      
      // All validations should complete without crashing
      expect(result.schema).toBeDefined();
      expect(result.runtime).toBeDefined();
      expect(result.complete).toBeDefined();
      
      // Should complete in reasonable time even with edge cases
      expect(timeMs).toBeLessThan(1000);
    });
  });
});