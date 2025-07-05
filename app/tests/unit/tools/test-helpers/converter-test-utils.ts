/**
 * Shared test utilities for tool conversion tests
 * Extracted from large test files to reduce duplication and improve maintainability
 */

import { jest } from '@jest/globals';
import {
  ClaudeTool,
  ClaudeToolChoice,
  ToolConversionResult,
  BidirectionalConversionResult,
  ParameterMappingResult,
  FormatValidationResult,
  IToolMapper,
  IFormatValidator
} from '../../../../src/tools/conversion-types';
import { OpenAITool, OpenAIToolChoice } from '../../../../src/tools/types';

/**
 * Creates a mock tool mapper with successful defaults
 */
export function createMockMapper(): jest.Mocked<IToolMapper> {
  return {
    mapParameters: jest.fn().mockReturnValue({
      success: true,
      mapped: { type: 'object' },
      errors: [],
      mappingDetails: {
        sourceFields: ['type'],
        targetFields: ['type'],
        preservedFields: ['type'],
        lostFields: []
      }
    }) as jest.MockedFunction<(source: Record<string, any>, targetFormat: 'openai' | 'claude') => ParameterMappingResult>,
    mapParametersReverse: jest.fn().mockReturnValue({
      success: true,
      mapped: { type: 'object' },
      errors: [],
      mappingDetails: {
        sourceFields: ['type'],
        targetFields: ['type'],
        preservedFields: ['type'],
        lostFields: []
      }
    }) as jest.MockedFunction<(source: Record<string, any>, targetFormat: 'openai' | 'claude') => ParameterMappingResult>,
    validateMapping: jest.fn<(original: Record<string, any>, mapped: Record<string, any>) => boolean>().mockReturnValue(true)
  };
}

/**
 * Creates a mock format validator with successful defaults
 */
export function createMockValidator(): jest.Mocked<IFormatValidator> {
  return {
    validateOpenAIFormat: jest.fn().mockReturnValue({
      valid: true,
      format: 'openai',
      errors: [],
      details: {
        hasRequiredFields: true,
        supportedVersion: true,
        knownFormat: true
      }
    }) as jest.MockedFunction<(tools: any[]) => FormatValidationResult>,
    validateClaudeFormat: jest.fn().mockReturnValue({
      valid: true,
      format: 'claude',
      errors: [],
      details: {
        hasRequiredFields: true,
        supportedVersion: true,
        knownFormat: true
      }
    }) as jest.MockedFunction<(tools: any[]) => FormatValidationResult>,
    detectFormat: jest.fn().mockReturnValue({
      valid: true,
      format: 'openai',
      errors: [],
      details: {
        hasRequiredFields: true,
        supportedVersion: true,
        knownFormat: true
      }
    }) as jest.MockedFunction<(tools: any[]) => FormatValidationResult>
  };
}

/**
 * Creates a sample OpenAI tool for testing
 */
export function createSampleOpenAITool(
  name: string = 'test_function',
  description: string = 'Test function description',
  parameters?: Record<string, any>,
  overrides: Partial<OpenAITool> = {}
): OpenAITool {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: parameters || {
        type: 'object',
        properties: {
          param1: { type: 'string', description: 'First parameter' }
        },
        required: ['param1']
      }
    },
    ...overrides
  };
}

/**
 * Creates a sample Claude tool for testing
 */
export function createSampleClaudeTool(
  name: string = 'test_function',
  description: string = 'Test function description',
  input_schema?: Record<string, any>,
  overrides: Partial<ClaudeTool> = {}
): ClaudeTool {
  return {
    name,
    description,
    input_schema: input_schema || {
      type: 'object',
      properties: {
        param1: { type: 'string', description: 'First parameter' }
      },
      required: ['param1']
    },
    ...overrides
  };
}

/**
 * Creates a sample OpenAI tool choice for testing
 */
export function createOpenAIToolChoice(
  type: 'auto' | 'none' | 'required' | 'function' = 'auto',
  functionName?: string
): OpenAIToolChoice {
  if (type === 'function' && functionName) {
    return { type: 'function', function: { name: functionName } };
  }
  return type as 'auto' | 'none' | 'required';
}

/**
 * Creates a sample Claude tool choice for testing
 */
export function createClaudeToolChoice(
  type: 'allowed' | 'disabled' | 'required' | 'specific' = 'allowed',
  toolName?: string
): ClaudeToolChoice {
  if (type === 'specific' && toolName) {
    return { name: toolName };
  }
  return type as 'allowed' | 'disabled' | 'required';
}

/**
 * Creates a successful tool conversion result for testing
 */
export function createSuccessfulConversionResult<T>(
  converted: T,
  sourceFormat: 'openai' | 'claude' = 'openai',
  targetFormat: 'openai' | 'claude' = 'claude',
  overrides: Partial<ToolConversionResult> = {}
): ToolConversionResult {
  return {
    success: true,
    converted,
    errors: [],
    warnings: [],
    conversionTimeMs: 2,
    sourceFormat,
    targetFormat,
    toolsConverted: 1,
    ...overrides
  };
}

/**
 * Creates a failed tool conversion result for testing
 */
export function createFailedConversionResult<T>(
  errors: string[] = ['Conversion failed'],
  sourceFormat: 'openai' | 'claude' = 'openai',
  targetFormat: 'openai' | 'claude' = 'claude',
  overrides: Partial<ToolConversionResult> = {}
): ToolConversionResult {
  return {
    success: false,
    errors,
    warnings: [],
    conversionTimeMs: 1,
    sourceFormat,
    targetFormat,
    toolsConverted: 0,
    ...overrides
  };
}

/**
 * Creates a bidirectional conversion result for testing
 */
export function createBidirectionalResult<T, U>(
  forwardResult: ToolConversionResult,
  backwardResult: ToolConversionResult,
  dataFidelity: number = 1.0,
  overrides: Partial<BidirectionalConversionResult> = {}
): BidirectionalConversionResult {
  return {
    success: forwardResult.success && backwardResult.success,
    errors: [...forwardResult.errors, ...backwardResult.errors],
    dataFidelityPreserved: dataFidelity >= 0.95,
    conversionTimeMs: (forwardResult.conversionTimeMs || 0) + (backwardResult.conversionTimeMs || 0),
    forwardConversion: forwardResult,
    backwardConversion: backwardResult,
    roundTripSuccess: forwardResult.success && backwardResult.success,
    dataFidelity,
    totalTimeMs: (forwardResult.conversionTimeMs || 0) + 
                 (backwardResult.conversionTimeMs || 0),
    ...overrides
  };
}

/**
 * Performance testing helper for conversions
 */
export async function measureConversionTime<T>(fn: () => Promise<T> | T): Promise<{ result: T; timeMs: number }> {
  const startTime = Date.now();
  const result = await fn();
  const endTime = Date.now();
  return { result, timeMs: endTime - startTime };
}

/**
 * Common assertion helpers for conversion tests
 */
export const ConversionTestAssertions = {
  expectSuccessfulConversion: <T>(result: ToolConversionResult) => {
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.converted).toBeDefined();
    expect(result.conversionTimeMs).toBeGreaterThanOrEqual(0);
  },

  expectFailedConversion: <T>(result: ToolConversionResult, expectedErrors: number = 1) => {
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(expectedErrors);
    expect(result.converted).toBeUndefined();
  },

  expectSuccessfulBidirectional: <T, U>(result: BidirectionalConversionResult) => {
    expect(result.roundTripSuccess).toBe(true);
    expect(result.forwardConversion?.success).toBe(true);
    expect(result.backwardConversion?.success).toBe(true);
    expect(result.dataFidelity).toBeGreaterThanOrEqual(0.9); // Allow 10% fidelity loss
  },

  expectHighDataFidelity: <T, U>(result: BidirectionalConversionResult, threshold: number = 0.95) => {
    expect(result.dataFidelity).toBeGreaterThanOrEqual(threshold);
  },

  expectReasonablePerformance: (timeMs: number, maxMs: number = 50) => {
    expect(timeMs).toBeLessThanOrEqual(maxMs);
    expect(timeMs).toBeGreaterThanOrEqual(0);
  }
};

/**
 * Creates complex test data for performance testing
 */
export function createComplexTestData() {
  return {
    openaiTools: Array.from({ length: 10 }, (_, i) => createSampleOpenAITool(
      `complex_function_${i}`,
      `Complex function ${i} with detailed description and multiple parameters`,
      {
        type: 'object',
        properties: {
          param1: { type: 'string', description: 'String parameter' },
          param2: { type: 'number', description: 'Numeric parameter' },
          param3: { 
            type: 'object', 
            description: 'Nested object parameter',
            properties: {
              nested1: { type: 'string' },
              nested2: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        required: ['param1', 'param2']
      }
    )),

    claudeTools: Array.from({ length: 10 }, (_, i) => createSampleClaudeTool(
      `complex_claude_function_${i}`,
      `Complex Claude function ${i} with detailed description`,
      {
        type: 'object',
        properties: {
          input1: { type: 'string', description: 'Input parameter' },
          input2: { type: 'integer', description: 'Integer input' },
          input3: {
            type: 'object',
            description: 'Complex nested input',
            properties: {
              subfield1: { type: 'string' },
              subfield2: { type: 'array', items: { type: 'number' } }
            }
          }
        },
        required: ['input1']
      }
    ))
  };
}

/**
 * Validates tool structure consistency
 */
export function validateToolStructure(tool: OpenAITool | ClaudeTool): boolean {
  if ('function' in tool) {
    // OpenAI tool
    return !!(tool.type === 'function' && 
             tool.function?.name && 
             tool.function?.description &&
             tool.function?.parameters);
  } else {
    // Claude tool
    return !!(tool.name && 
             tool.description && 
             tool.input_schema);
  }
}