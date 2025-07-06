/**
 * Tool choice enforcement service
 * Single Responsibility: Tool choice enforcement only
 * 
 * Enforces choice decisions in Claude SDK integration:
 * - Ensures responses match the chosen behavior
 * - Handles choice-specific error scenarios
 * - Validates Claude responses against choice constraints
 */

import { 
  ChoiceProcessingContext,
  ClaudeChoiceFormat,
  ToolChoiceProcessingError
} from './choice-processor';

// Re-export imported types for external use
export type { ChoiceProcessingContext, ClaudeChoiceFormat };
import { ProcessedToolChoice } from './choice';
import { OpenAIToolCall } from './types';
import { 
  TOOL_CHOICE_PROCESSING_LIMITS,
  TOOL_CHOICE_MESSAGES,
  TOOL_CHOICE_ERRORS
} from './constants';

/**
 * Choice enforcement request
 */
export interface ChoiceEnforcementRequest {
  context: ChoiceProcessingContext;
  claudeResponse?: ClaudeResponse;
  toolCalls?: OpenAIToolCall[];
  requestId?: string;
  sessionId?: string;
}

/**
 * Claude response interface for enforcement
 */
export interface ClaudeResponse {
  content: string;
  tool_calls?: any[];
  finish_reason?: string;
  metadata?: {
    model?: string;
    usage?: any;
  };
}

/**
 * Choice enforcement result
 */
export interface ChoiceEnforcementResult {
  success: boolean;
  enforcementAction: EnforcementAction;
  modifiedResponse?: ClaudeResponse;
  violations: ChoiceViolation[];
  errors: string[];
  enforcementTimeMs?: number;
}

/**
 * Enforcement action taken
 */
export interface EnforcementAction {
  type: 'none' | 'filter_tools' | 'force_text_only' | 'force_function' | 'reject_response';
  description: string;
  modifications: string[];
  wasRequired: boolean;
}

/**
 * Choice violation detected
 */
export interface ChoiceViolation {
  type: 'unexpected_tool_calls' | 'missing_forced_function' | 'wrong_function_called' | 'text_when_function_required';
  description: string;
  severity: 'error' | 'warning';
  expectedBehavior: string;
  actualBehavior: string;
}

/**
 * Choice enforcement options
 */
export interface ChoiceEnforcementOptions {
  strictEnforcement?: boolean;
  allowPartialCompliance?: boolean;
  enforceTimeout?: boolean;
  timeoutMs?: number;
  logViolations?: boolean;
}

/**
 * Tool choice enforcement error
 */
export class ToolChoiceEnforcementError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: ChoiceProcessingContext,
    public readonly enforcementTimeMs?: number
  ) {
    super(message);
    this.name = 'ToolChoiceEnforcementError';
  }
}

/**
 * Tool choice enforcer interface
 */
export interface IToolChoiceEnforcer {
  enforceChoice(request: ChoiceEnforcementRequest, options?: ChoiceEnforcementOptions): Promise<ChoiceEnforcementResult>;
  validateResponseAgainstChoice(context: ChoiceProcessingContext, response: ClaudeResponse): ChoiceViolation[];
  modifyResponseForChoice(context: ChoiceProcessingContext, response: ClaudeResponse): ClaudeResponse;
  createEnforcementAction(context: ChoiceProcessingContext, violations: ChoiceViolation[]): EnforcementAction;
}

/**
 * Tool choice enforcer implementation
 */
export class ToolChoiceEnforcer implements IToolChoiceEnforcer {
  /**
   * Enforce tool choice against Claude response
   */
  async enforceChoice(
    request: ChoiceEnforcementRequest,
    options: ChoiceEnforcementOptions = {}
  ): Promise<ChoiceEnforcementResult> {
    const startTime = Date.now();

    try {
      // Set default options
      const opts = {
        strictEnforcement: true,
        allowPartialCompliance: false,
        enforceTimeout: true,
        timeoutMs: TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS,
        logViolations: true,
        ...options
      };

      const context = request.context;
      const response = request.claudeResponse;

      // If no response to enforce against, return success
      if (!response) {
        return {
          success: true,
          enforcementAction: {
            type: 'none',
            description: 'No response to enforce against',
            modifications: [],
            wasRequired: false
          },
          violations: [],
          errors: []
        };
      }

      // Validate response against choice
      const violations = this.validateResponseAgainstChoice(context, response);

      // Create enforcement action
      const enforcementAction = this.createEnforcementAction(context, violations);

      // Modify response if needed
      let modifiedResponse = response;
      if (enforcementAction.type !== 'none') {
        modifiedResponse = this.modifyResponseForChoice(context, response);
      }

      // Check timeout
      const enforcementTimeMs = Date.now() - startTime;
      if (opts.enforceTimeout && enforcementTimeMs > opts.timeoutMs) {
        return {
          success: false,
          enforcementAction: {
            type: 'reject_response',
            description: 'Enforcement timeout exceeded',
            modifications: [],
            wasRequired: true
          },
          violations: [],
          errors: [TOOL_CHOICE_MESSAGES.CHOICE_PROCESSING_TIMEOUT],
          enforcementTimeMs
        };
      }

      // Determine success based on violations and enforcement
      const hasErrorViolations = violations.some(v => v.severity === 'error');
      const success = !hasErrorViolations || (opts.allowPartialCompliance && enforcementAction.type !== 'reject_response');

      return {
        success,
        enforcementAction,
        modifiedResponse,
        violations,
        errors: hasErrorViolations && !success ? violations.map(v => v.description) : [],
        enforcementTimeMs
      };

    } catch (error) {
      return {
        success: false,
        enforcementAction: {
          type: 'reject_response',
          description: 'Enforcement failed with error',
          modifications: [],
          wasRequired: true
        },
        violations: [],
        errors: [
          error instanceof Error ? error.message : TOOL_CHOICE_MESSAGES.CHOICE_ENFORCEMENT_FAILED
        ],
        enforcementTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Validate Claude response against tool choice constraints
   */
  validateResponseAgainstChoice(
    context: ChoiceProcessingContext,
    response: ClaudeResponse
  ): ChoiceViolation[] {
    const violations: ChoiceViolation[] = [];
    const hasToolCalls = response.tool_calls && response.tool_calls.length > 0;

    // Auto choice: No specific constraints (Claude decides)
    if (context.choiceType === 'auto') {
      // Auto choice is always valid - Claude can decide
      return violations;
    }

    // None choice: Must be text-only, no tool calls
    if (context.choiceType === 'none') {
      if (hasToolCalls) {
        violations.push({
          type: 'unexpected_tool_calls',
          description: 'Tool calls present when choice is "none" (text-only required)',
          severity: 'error',
          expectedBehavior: 'Text-only response without tool calls',
          actualBehavior: `Response contains ${response.tool_calls?.length} tool calls`
        });
      }
      return violations;
    }

    // Function choice: Must call the specific function
    if (context.choiceType === 'function') {
      const expectedFunction = context.functionName;

      if (!hasToolCalls) {
        violations.push({
          type: 'missing_forced_function',
          description: `No tool calls when specific function "${expectedFunction}" is required`,
          severity: 'error',
          expectedBehavior: `Must call function "${expectedFunction}"`,
          actualBehavior: 'No tool calls in response'
        });
      } else {
        // Check if the required function was called
        const calledFunctions = response.tool_calls?.map(call => call.function?.name) || [];
        const hasRequiredFunction = calledFunctions.includes(expectedFunction);

        if (!hasRequiredFunction) {
          violations.push({
            type: 'wrong_function_called',
            description: `Required function "${expectedFunction}" not called`,
            severity: 'error',
            expectedBehavior: `Must call function "${expectedFunction}"`,
            actualBehavior: `Called functions: ${calledFunctions.join(', ')}`
          });
        }

        // Warning if additional functions called (depending on enforcement strictness)
        const additionalFunctions = calledFunctions.filter(name => name !== expectedFunction);
        if (additionalFunctions.length > 0) {
          violations.push({
            type: 'unexpected_tool_calls',
            description: `Additional functions called beyond required "${expectedFunction}"`,
            severity: 'warning',
            expectedBehavior: `Only call function "${expectedFunction}"`,
            actualBehavior: `Additional functions: ${additionalFunctions.join(', ')}`
          });
        }
      }
      return violations;
    }

    return violations;
  }

  /**
   * Modify Claude response to comply with tool choice
   */
  modifyResponseForChoice(
    context: ChoiceProcessingContext,
    response: ClaudeResponse
  ): ClaudeResponse {
    const modifiedResponse = { ...response };

    // None choice: Remove all tool calls, ensure text-only
    if (context.choiceType === 'none') {
      modifiedResponse.tool_calls = [];
      modifiedResponse.finish_reason = 'stop';
      
      // Ensure there's text content if tool calls were removed
      if (!modifiedResponse.content || modifiedResponse.content.trim().length === 0) {
        modifiedResponse.content = 'I can provide a text response. How can I help you?';
      }
    }

    // Function choice: Filter to only the required function
    if (context.choiceType === 'function' && context.functionName) {
      const requiredFunction = context.functionName;
      
      if (modifiedResponse.tool_calls) {
        // Keep only the required function calls
        modifiedResponse.tool_calls = modifiedResponse.tool_calls.filter(
          call => call.function?.name === requiredFunction
        );
        
        // If no required function calls found, this is an error case
        if (modifiedResponse.tool_calls.length === 0) {
          // This should be handled by validation - don't modify further
        } else {
          modifiedResponse.finish_reason = 'tool_calls';
        }
      }
    }

    return modifiedResponse;
  }

  /**
   * Create enforcement action based on context and violations
   */
  createEnforcementAction(
    context: ChoiceProcessingContext,
    violations: ChoiceViolation[]
  ): EnforcementAction {
    const hasErrorViolations = violations.some(v => v.severity === 'error');
    const modifications: string[] = [];

    // No violations - no action needed
    if (violations.length === 0) {
      return {
        type: 'none',
        description: 'Response complies with tool choice requirements',
        modifications: [],
        wasRequired: false
      };
    }

    // None choice enforcement
    if (context.choiceType === 'none' && hasErrorViolations) {
      modifications.push('Removed all tool calls', 'Set finish_reason to "stop"');
      return {
        type: 'force_text_only',
        description: 'Enforced text-only response for "none" choice',
        modifications,
        wasRequired: true
      };
    }

    // Function choice enforcement
    if (context.choiceType === 'function' && hasErrorViolations) {
      const expectedFunction = context.functionName;
      modifications.push(`Filtered to only "${expectedFunction}" function calls`);
      return {
        type: 'force_function',
        description: `Enforced specific function "${expectedFunction}" for function choice`,
        modifications,
        wasRequired: true
      };
    }

    // General tool filtering for warnings
    if (violations.some(v => v.type === 'unexpected_tool_calls' && v.severity === 'warning')) {
      modifications.push('Filtered unexpected tool calls');
      return {
        type: 'filter_tools',
        description: 'Filtered unexpected tool calls based on choice constraints',
        modifications,
        wasRequired: false
      };
    }

    // Reject response for serious violations
    if (hasErrorViolations) {
      return {
        type: 'reject_response',
        description: 'Response violates tool choice constraints and cannot be modified',
        modifications: [],
        wasRequired: true
      };
    }

    return {
      type: 'none',
      description: 'No enforcement action required',
      modifications: [],
      wasRequired: false
    };
  }
}

/**
 * Tool choice enforcement utilities
 */
export const ChoiceEnforcementUtils = {
  /**
   * Check if enforcement was successful
   */
  wasSuccessful: (result: ChoiceEnforcementResult): boolean => {
    return result.success;
  },

  /**
   * Check if modifications were made
   */
  wasModified: (result: ChoiceEnforcementResult): boolean => {
    return result.enforcementAction.type !== 'none' && result.modifiedResponse !== undefined;
  },

  /**
   * Check if response was rejected
   */
  wasRejected: (result: ChoiceEnforcementResult): boolean => {
    return result.enforcementAction.type === 'reject_response';
  },

  /**
   * Get error violations only
   */
  getErrorViolations: (result: ChoiceEnforcementResult): ChoiceViolation[] => {
    return result.violations.filter(v => v.severity === 'error');
  },

  /**
   * Get warning violations only
   */
  getWarningViolations: (result: ChoiceEnforcementResult): ChoiceViolation[] => {
    return result.violations.filter(v => v.severity === 'warning');
  },

  /**
   * Check if enforcement meets performance requirements
   */
  meetsPerformanceRequirements: (result: ChoiceEnforcementResult): boolean => {
    return !result.enforcementTimeMs || 
           result.enforcementTimeMs <= TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS;
  },

  /**
   * Create default enforcement options
   */
  createDefaultOptions: (): ChoiceEnforcementOptions => ({
    strictEnforcement: true,
    allowPartialCompliance: false,
    enforceTimeout: true,
    timeoutMs: TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS,
    logViolations: true
  }),

  /**
   * Create error enforcement result
   */
  createErrorResult: (errors: string[], enforcementTimeMs?: number): ChoiceEnforcementResult => ({
    success: false,
    enforcementAction: {
      type: 'reject_response',
      description: 'Enforcement failed with errors',
      modifications: [],
      wasRequired: true
    },
    violations: [],
    errors,
    enforcementTimeMs
  })
};

/**
 * Factory for creating tool choice enforcer
 */
export class ToolChoiceEnforcerFactory {
  static create(): IToolChoiceEnforcer {
    return new ToolChoiceEnforcer();
  }
}