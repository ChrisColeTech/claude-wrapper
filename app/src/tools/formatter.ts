/**
 * OpenAI tool call response formatting service
 * Single Responsibility: Formatting only
 * 
 * Formats Claude tool calls into OpenAI-compatible response structure
 */

import { 
  OpenAIToolCall, 
  ClaudeToolCall, 
  ToolCallFormattingResult, 
  IToolFormatter,
  MultiToolCallResult
} from './types';
import { IToolCallIdGenerator } from './id-generator';
import { 
  TOOL_CALL_STRUCTURE, 
  RESPONSE_FORMAT_LIMITS,
  RESPONSE_FORMATTING_MESSAGES, 
  RESPONSE_FORMATTING_ERRORS,
  FORMAT_SPECIFICATIONS,
  MULTI_TOOL_LIMITS,
  MULTI_TOOL_MESSAGES
} from './constants';

/**
 * Tool call formatting error
 */
export class ToolCallFormattingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly toolCall?: ClaudeToolCall | OpenAIToolCall,
    public readonly formattingTimeMs?: number
  ) {
    super(message);
    this.name = 'ToolCallFormattingError';
  }
}

/**
 * Tool call formatter implementation
 */
export class ToolCallFormatter implements IToolFormatter {
  constructor(private idGenerator: IToolCallIdGenerator) {}

  /**
   * Format single Claude tool call to OpenAI format
   */
  formatToolCall(claudeCall: ClaudeToolCall): OpenAIToolCall {
    try {
      // Validate input
      if (!claudeCall || typeof claudeCall !== 'object') {
        throw new ToolCallFormattingError(
          RESPONSE_FORMATTING_MESSAGES.INVALID_TOOL_CALL,
          RESPONSE_FORMATTING_ERRORS.INVALID_STRUCTURE,
          claudeCall
        );
      }

      if (!claudeCall.name || typeof claudeCall.name !== 'string') {
        throw new ToolCallFormattingError(
          'Tool call must have a valid function name',
          RESPONSE_FORMATTING_ERRORS.INVALID_STRUCTURE,
          claudeCall
        );
      }

      // Generate ID if not provided
      const id = claudeCall.id || this.idGenerator.generateId();

      // Serialize arguments to JSON string
      const argumentsJson = this.serializeArguments(claudeCall.arguments || {});

      // Build OpenAI format tool call
      const openaiCall: OpenAIToolCall = {
        [TOOL_CALL_STRUCTURE.ID_FIELD]: id,
        [TOOL_CALL_STRUCTURE.TYPE_FIELD]: FORMAT_SPECIFICATIONS.OPENAI_TOOL_TYPE,
        [TOOL_CALL_STRUCTURE.FUNCTION_FIELD]: {
          [TOOL_CALL_STRUCTURE.FUNCTION_NAME_FIELD]: claudeCall.name,
          [TOOL_CALL_STRUCTURE.FUNCTION_ARGUMENTS_FIELD]: argumentsJson
        }
      };

      // Validate formatted call
      if (!this.validateFormattedCall(openaiCall)) {
        throw new ToolCallFormattingError(
          'Formatted tool call validation failed',
          RESPONSE_FORMATTING_ERRORS.FORMATTING_FAILED,
          claudeCall
        );
      }

      return openaiCall;

    } catch (error) {
      if (error instanceof ToolCallFormattingError) {
        throw error;
      }
      
      throw new ToolCallFormattingError(
        error instanceof Error ? error.message : RESPONSE_FORMATTING_MESSAGES.FORMATTING_FAILED,
        RESPONSE_FORMATTING_ERRORS.FORMATTING_FAILED,
        claudeCall
      );
    }
  }

  /**
   * Format multiple Claude tool calls to OpenAI format
   */
  formatToolCalls(claudeCalls: ClaudeToolCall[]): ToolCallFormattingResult {
    const startTime = Date.now();

    try {
      // Validate input
      if (!Array.isArray(claudeCalls)) {
        return {
          success: false,
          errors: [RESPONSE_FORMATTING_MESSAGES.INVALID_TOOL_CALL],
          formattingTimeMs: Date.now() - startTime
        };
      }

      if (claudeCalls.length === 0) {
        return {
          success: true,
          toolCalls: [],
          errors: [],
          formattingTimeMs: Date.now() - startTime
        };
      }

      // Check limits
      if (claudeCalls.length > RESPONSE_FORMAT_LIMITS.MAX_TOOL_CALLS_PER_RESPONSE) {
        return {
          success: false,
          errors: [`Too many tool calls: ${claudeCalls.length} exceeds limit of ${RESPONSE_FORMAT_LIMITS.MAX_TOOL_CALLS_PER_RESPONSE}`],
          formattingTimeMs: Date.now() - startTime
        };
      }

      // Format each tool call
      const formattedCalls: OpenAIToolCall[] = [];
      const errors: string[] = [];

      for (let i = 0; i < claudeCalls.length; i++) {
        try {
          const formatted = this.formatToolCall(claudeCalls[i]);
          formattedCalls.push(formatted);
        } catch (error) {
          const errorMessage = error instanceof Error 
            ? `Tool call ${i}: ${error.message}`
            : `Tool call ${i}: ${RESPONSE_FORMATTING_MESSAGES.FORMATTING_FAILED}`;
          errors.push(errorMessage);
        }
      }

      const formattingTime = Date.now() - startTime;

      // Check timeout
      if (formattingTime > RESPONSE_FORMAT_LIMITS.FORMATTING_TIMEOUT_MS) {
        errors.push(RESPONSE_FORMATTING_MESSAGES.FORMATTING_TIMEOUT);
      }

      return {
        success: errors.length === 0,
        toolCalls: formattedCalls,
        errors,
        formattingTimeMs: formattingTime
      };

    } catch (error) {
      return {
        success: false,
        errors: [
          error instanceof Error ? error.message : RESPONSE_FORMATTING_MESSAGES.FORMATTING_FAILED
        ],
        formattingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Validate formatted OpenAI tool call structure
   */
  validateFormattedCall(toolCall: OpenAIToolCall): boolean {
    try {
      // Check basic structure
      if (!toolCall || typeof toolCall !== 'object') {
        return false;
      }

      // Check required fields
      if (!toolCall[TOOL_CALL_STRUCTURE.ID_FIELD] || 
          typeof toolCall[TOOL_CALL_STRUCTURE.ID_FIELD] !== 'string') {
        return false;
      }

      if (toolCall[TOOL_CALL_STRUCTURE.TYPE_FIELD] !== FORMAT_SPECIFICATIONS.OPENAI_TOOL_TYPE) {
        return false;
      }

      if (!toolCall[TOOL_CALL_STRUCTURE.FUNCTION_FIELD] || 
          typeof toolCall[TOOL_CALL_STRUCTURE.FUNCTION_FIELD] !== 'object') {
        return false;
      }

      const func = toolCall[TOOL_CALL_STRUCTURE.FUNCTION_FIELD];
      
      if (!func[TOOL_CALL_STRUCTURE.FUNCTION_NAME_FIELD] || 
          typeof func[TOOL_CALL_STRUCTURE.FUNCTION_NAME_FIELD] !== 'string') {
        return false;
      }

      if (typeof func[TOOL_CALL_STRUCTURE.FUNCTION_ARGUMENTS_FIELD] !== 'string') {
        return false;
      }

      // Validate arguments are valid JSON
      try {
        JSON.parse(func[TOOL_CALL_STRUCTURE.FUNCTION_ARGUMENTS_FIELD]);
      } catch {
        return false;
      }

      return true;

    } catch (error) {
      return false;
    }
  }

  /**
   * Serialize function arguments to JSON string
   */
  private serializeArguments(args: Record<string, any>): string {
    try {
      if (!args || typeof args !== 'object') {
        return '{}';
      }

      // Ensure we can serialize and deserialize without data loss
      const serialized = JSON.stringify(args);
      
      // Validate serialization worked correctly
      try {
        JSON.parse(serialized);
      } catch {
        throw new ToolCallFormattingError(
          RESPONSE_FORMATTING_MESSAGES.ARGUMENTS_SERIALIZATION_FAILED,
          RESPONSE_FORMATTING_ERRORS.SERIALIZATION_FAILED
        );
      }

      return serialized;

    } catch (error) {
      if (error instanceof ToolCallFormattingError) {
        throw error;
      }
      
      throw new ToolCallFormattingError(
        RESPONSE_FORMATTING_MESSAGES.ARGUMENTS_SERIALIZATION_FAILED,
        RESPONSE_FORMATTING_ERRORS.SERIALIZATION_FAILED
      );
    }
  }
}

/**
 * Tool formatting utilities
 */
export const ToolFormattingUtils = {
  /**
   * Extract function name from OpenAI tool call
   */
  extractFunctionName: (toolCall: OpenAIToolCall): string | null => {
    try {
      return toolCall[TOOL_CALL_STRUCTURE.FUNCTION_FIELD][TOOL_CALL_STRUCTURE.FUNCTION_NAME_FIELD] || null;
    } catch {
      return null;
    }
  },

  /**
   * Extract and parse function arguments from OpenAI tool call
   */
  extractFunctionArguments: (toolCall: OpenAIToolCall): Record<string, any> | null => {
    try {
      const argsJson = toolCall[TOOL_CALL_STRUCTURE.FUNCTION_FIELD][TOOL_CALL_STRUCTURE.FUNCTION_ARGUMENTS_FIELD];
      return JSON.parse(argsJson);
    } catch {
      return null;
    }
  },

  /**
   * Check if tool call has valid ID format
   */
  hasValidId: (toolCall: OpenAIToolCall): boolean => {
    const id = toolCall[TOOL_CALL_STRUCTURE.ID_FIELD];
    return typeof id === 'string' && id.length > 0;
  },

  /**
   * Create Claude tool call from OpenAI format (reverse conversion)
   */
  toClaudeFormat: (openaiCall: OpenAIToolCall): ClaudeToolCall | null => {
    try {
      const name = ToolFormattingUtils.extractFunctionName(openaiCall);
      const args = ToolFormattingUtils.extractFunctionArguments(openaiCall);
      
      if (!name || args === null) {
        return null;
      }

      return {
        id: openaiCall[TOOL_CALL_STRUCTURE.ID_FIELD],
        name,
        arguments: args
      };
    } catch {
      return null;
    }
  },

  /**
   * Validate multiple tool calls for uniqueness
   */
  validateUniqueIds: (toolCalls: OpenAIToolCall[]): boolean => {
    const ids = toolCalls.map(call => call[TOOL_CALL_STRUCTURE.ID_FIELD]);
    const uniqueIds = new Set(ids);
    return uniqueIds.size === ids.length;
  },

  /**
   * Format multi-tool call result for OpenAI response (Phase 7A)
   */
  formatMultiToolResult: (result: MultiToolCallResult): ToolCallFormattingResult => {
    try {
      if (!result || !Array.isArray(result.toolCalls)) {
        return {
          success: false,
          toolCalls: [],
          errors: [MULTI_TOOL_MESSAGES.INVALID_MULTI_CALL_STRUCTURE],
          formattingTimeMs: 0
        };
      }

      const startTime = performance.now();

      // Validate tool call count limits
      if (result.toolCalls.length > MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS) {
        return {
          success: false,
          toolCalls: [],
          errors: [MULTI_TOOL_MESSAGES.TOO_MANY_PARALLEL_CALLS],
          formattingTimeMs: performance.now() - startTime
        };
      }

      // Validate unique IDs
      if (!ToolFormattingUtils.validateUniqueIds(result.toolCalls)) {
        return {
          success: false,
          toolCalls: [],
          errors: [MULTI_TOOL_MESSAGES.DUPLICATE_TOOL_CALL_IDS],
          formattingTimeMs: performance.now() - startTime
        };
      }

      // Format each tool call
      const formattedCalls: OpenAIToolCall[] = [];
      const errors: string[] = [];

      for (const toolCall of result.toolCalls) {
        try {
          // Ensure proper OpenAI format
          const formatted: OpenAIToolCall = {
            id: toolCall.id,
            type: 'function',
            function: {
              name: toolCall.function.name,
              arguments: toolCall.function.arguments
            }
          };

          // Validate formatted call
          if (ToolFormattingUtils.validateToolCall(formatted)) {
            formattedCalls.push(formatted);
          } else {
            errors.push(`Invalid tool call format for ID: ${toolCall.id}`);
          }
        } catch (error) {
          errors.push(`Formatting failed for tool call ${toolCall.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      const success = formattedCalls.length === result.toolCalls.length;

      return {
        success,
        toolCalls: formattedCalls,
        errors,
        formattingTimeMs: performance.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        toolCalls: [],
        errors: [error instanceof Error ? error.message : MULTI_TOOL_MESSAGES.MULTI_CALL_PROCESSING_FAILED],
        formattingTimeMs: 0
      };
    }
  },

  /**
   * Validate multi-tool call array structure
   */
  validateMultiToolCalls: (toolCalls: OpenAIToolCall[]): boolean => {
    if (!Array.isArray(toolCalls)) {
      return false;
    }

    if (toolCalls.length === 0) {
      return false;
    }

    if (toolCalls.length > MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS) {
      return false;
    }

    // Validate each tool call
    for (const toolCall of toolCalls) {
      if (!ToolFormattingUtils.validateToolCall(toolCall)) {
        return false;
      }
    }

    // Validate unique IDs
    if (!ToolFormattingUtils.validateUniqueIds(toolCalls)) {
      return false;
    }

    return true;
  },

  /**
   * Validate tool call structure
   */
  validateToolCall: (toolCall: OpenAIToolCall): boolean => {
    try {
      if (!toolCall || typeof toolCall !== 'object') {
        return false;
      }

      if (!toolCall.id || typeof toolCall.id !== 'string') {
        return false;
      }

      if (toolCall.type !== 'function') {
        return false;
      }

      if (!toolCall.function || typeof toolCall.function !== 'object') {
        return false;
      }

      if (!toolCall.function.name || typeof toolCall.function.name !== 'string') {
        return false;
      }

      if (typeof toolCall.function.arguments !== 'string') {
        return false;
      }

      // Validate arguments are valid JSON
      try {
        JSON.parse(toolCall.function.arguments);
      } catch {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  },

  /**
   * Sort tool calls by priority for optimal execution order
   */
  sortToolCallsByPriority: (toolCalls: OpenAIToolCall[]): OpenAIToolCall[] => {
    const priorityOrder: Record<string, number> = {
      'list_directory': 1,
      'search_files': 2,
      'read_file': 3,
      'web_fetch': 4,
      'write_file': 5,
      'edit_file': 6,
      'execute_command': 7
    };

    return [...toolCalls].sort((a, b) => {
      const priorityA = priorityOrder[a.function.name] || 8;
      const priorityB = priorityOrder[b.function.name] || 8;
      return priorityA - priorityB;
    });
  }
};