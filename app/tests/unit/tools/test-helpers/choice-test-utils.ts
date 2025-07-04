/**
 * Shared test utilities for choice enforcement tests
 * Extracted from large test files to reduce duplication and improve maintainability
 */

import {
  ChoiceProcessingContext,
  ClaudeResponse,
  ChoiceEnforcementRequest,
  ChoiceEnforcementOptions
} from '../../../../src/tools/choice-enforcer';
import { OpenAIToolCall } from '../../../../src/tools/types';

/**
 * Creates a standard auto choice context for testing
 */
export function createAutoChoiceContext(overrides: Partial<ChoiceProcessingContext> = {}): ChoiceProcessingContext {
  return {
    hasChoice: true,
    choiceType: 'auto',
    allowsTools: true,
    forcesTextOnly: false,
    forcesSpecificFunction: false,
    claudeFormat: {
      mode: 'auto',
      allowTools: true,
      restrictions: {
        onlyTextResponse: false,
        specificFunction: false
      }
    },
    processingTimeMs: 2,
    ...overrides
  };
}

/**
 * Creates a standard none choice context for testing
 */
export function createNoneChoiceContext(overrides: Partial<ChoiceProcessingContext> = {}): ChoiceProcessingContext {
  return {
    hasChoice: true,
    choiceType: 'none',
    allowsTools: false,
    forcesTextOnly: true,
    forcesSpecificFunction: false,
    claudeFormat: {
      mode: 'none',
      allowTools: false,
      restrictions: {
        onlyTextResponse: true,
        specificFunction: false
      }
    },
    processingTimeMs: 1,
    ...overrides
  };
}

/**
 * Creates a standard function choice context for testing
 */
export function createFunctionChoiceContext(
  functionName: string, 
  overrides: Partial<ChoiceProcessingContext> = {}
): ChoiceProcessingContext {
  return {
    hasChoice: true,
    choiceType: 'function',
    allowsTools: true,
    forcesTextOnly: false,
    forcesSpecificFunction: true,
    functionName,
    claudeFormat: {
      mode: 'specific',
      allowTools: true,
      forceFunction: functionName,
      restrictions: {
        onlyTextResponse: false,
        specificFunction: true,
        functionName
      }
    },
    processingTimeMs: 2,
    ...overrides
  };
}

/**
 * Creates a Claude response with tool calls for testing
 */
export function createClaudeResponseWithTools(
  content: string = 'Test response with tools',
  toolCalls: OpenAIToolCall[] = [],
  overrides: Partial<ClaudeResponse> = {}
): ClaudeResponse {
  return {
    content,
    tool_calls: toolCalls.length > 0 ? toolCalls : [{
      id: 'call_test_1',
      type: 'function',
      function: {
        name: 'test_function',
        arguments: '{"param": "value"}'
      }
    }],
    finish_reason: 'tool_calls',
    ...overrides
  };
}

/**
 * Creates a text-only Claude response for testing
 */
export function createTextOnlyClaudeResponse(
  content: string = 'Test text response',
  overrides: Partial<ClaudeResponse> = {}
): ClaudeResponse {
  return {
    content,
    finish_reason: 'stop',
    ...overrides
  };
}

/**
 * Creates a standard choice enforcement request for testing
 */
export function createChoiceEnforcementRequest(
  context: ChoiceProcessingContext,
  response: ClaudeResponse,
  requestId: string = 'test-request',
  overrides: Partial<ChoiceEnforcementRequest> = {}
): ChoiceEnforcementRequest {
  return {
    context,
    claudeResponse: response,
    requestId,
    ...overrides
  };
}

/**
 * Creates standard choice enforcement options for testing
 */
export function createChoiceEnforcementOptions(
  overrides: Partial<ChoiceEnforcementOptions> = {}
): ChoiceEnforcementOptions {
  return {
    allowPartialCompliance: true,
    strictEnforcement: false,
    enforceTimeout: false,
    ...overrides
  };
}

/**
 * Creates a sample tool call for testing
 */
export function createSampleToolCall(
  id: string = 'call_sample',
  functionName: string = 'sample_function',
  args: string = '{}',
  overrides: Partial<OpenAIToolCall> = {}
): OpenAIToolCall {
  return {
    id,
    type: 'function',
    function: {
      name: functionName,
      arguments: args
    },
    ...overrides
  };
}

/**
 * Performance testing helper
 */
export async function measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; timeMs: number }> {
  const startTime = Date.now();
  const result = await fn();
  const endTime = Date.now();
  return { result, timeMs: endTime - startTime };
}

/**
 * Common assertion helpers
 */
export const ChoiceTestAssertions = {
  expectSuccessfulEnforcement: (result: any) => {
    expect(result.success).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.enforcementAction.type).toBe('none');
    expect(result.enforcementAction.wasRequired).toBe(false);
    expect(result.errors).toHaveLength(0);
  },

  expectFailedEnforcement: (result: any, expectedViolations: number = 1) => {
    expect(result.success).toBe(false);
    expect(result.violations).toHaveLength(expectedViolations);
    expect(result.errors).toHaveLength(0);
  },

  expectEnforcementAction: (result: any, actionType: string, wasRequired: boolean = true) => {
    expect(result.enforcementAction.type).toBe(actionType);
    expect(result.enforcementAction.wasRequired).toBe(wasRequired);
  }
};