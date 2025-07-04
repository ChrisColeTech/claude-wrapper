/**
 * OpenAI Tools Custom Jest Assertions (Phase 13A)
 * Single Responsibility: Custom Jest matchers for OpenAI tools testing
 * 
 * Provides specialized assertions for OpenAI tools validation and testing
 * Follows Jest custom matcher patterns with TypeScript strict mode
 */

import { expect } from '@jest/globals';
import { OpenAITool, OpenAIToolChoice, ValidationFrameworkResult, ValidationFieldError } from '../../../src/tools/types';

declare global {
  namespace jest {
    interface Matchers<R> {
      // Tool validation matchers
      toBeValidOpenAITool(): R;
      toBeValidToolArray(): R;
      toBeValidToolChoice(): R;
      toHaveValidToolSchema(): R;
      toHaveValidParameterSchema(): R;
      
      // Validation result matchers
      toBeValidationSuccess(): R;
      toBeValidationFailure(): R;
      toHaveValidationErrors(count?: number): R;
      toHaveValidationError(field: string, code?: string): R;
      
      // Performance matchers
      toCompleteWithinTimeLimit(timeMs: number): R;
      toMeetPerformanceRequirement(requirement: string): R;
      
      // OpenAI compatibility matchers
      toMatchOpenAIFormat(): R;
      toMatchOpenAIErrorFormat(): R;
      toBeOpenAICompatible(): R;
      
      // Tool call matchers
      toBeValidToolCall(): R;
      toHaveToolCallId(): R;
      toHaveValidToolCallStructure(): R;
      
      // Array and structure matchers
      toHaveUniqueToolNames(): R;
      toHaveNoDuplicateIds(): R;
      toBeWithinSizeLimit(limit: number): R;
      
      // Error scenario matchers
      toBeValidationError(type?: string): R;
      toBeTimeoutError(): R;
      toBeFormatError(): R;
      toBeSystemError(): R;
    }
  }
}

/**
 * Validation result assertion helpers
 */
export const ValidationAssertions = {
  /**
   * Check if validation result indicates success
   */
  isValidationSuccess(result: ValidationFrameworkResult): boolean {
    return result.valid === true && result.errors.length === 0;
  },

  /**
   * Check if validation result indicates failure
   */
  isValidationFailure(result: ValidationFrameworkResult): boolean {
    return result.valid === false || result.errors.length > 0;
  },

  /**
   * Check if validation result has specific error
   */
  hasValidationError(result: ValidationFrameworkResult, field: string, code?: string): boolean {
    return result.errors.some(error => 
      error.field === field && (code ? error.code === code : true)
    );
  },

  /**
   * Get validation error count
   */
  getErrorCount(result: ValidationFrameworkResult): number {
    return result.errors.length;
  },

  /**
   * Check if validation completed within time limit
   */
  isWithinTimeLimit(result: ValidationFrameworkResult, timeMs: number): boolean {
    return result.validationTimeMs <= timeMs;
  }
};

/**
 * Tool structure validation helpers
 */
export const ToolAssertions = {
  /**
   * Validate OpenAI tool structure
   */
  isValidOpenAITool(tool: any): boolean {
    if (!tool || typeof tool !== 'object') return false;
    if (tool.type !== 'function') return false;
    if (!tool.function || typeof tool.function !== 'object') return false;
    if (!tool.function.name || typeof tool.function.name !== 'string') return false;
    
    // Validate parameters if present
    if (tool.function.parameters) {
      return this.isValidParameterSchema(tool.function.parameters);
    }
    
    return true;
  },

  /**
   * Validate tool array structure
   */
  isValidToolArray(tools: any): boolean {
    if (!Array.isArray(tools)) return false;
    if (tools.length === 0) return false;
    
    return tools.every(tool => this.isValidOpenAITool(tool));
  },

  /**
   * Validate tool choice structure
   */
  isValidToolChoice(choice: any): boolean {
    if (typeof choice === 'string') {
      return choice === 'auto' || choice === 'none';
    }
    
    if (typeof choice === 'object' && choice !== null) {
      return choice.type === 'function' && 
             choice.function && 
             typeof choice.function.name === 'string';
    }
    
    return false;
  },

  /**
   * Validate parameter schema structure
   */
  isValidParameterSchema(schema: any): boolean {
    if (!schema || typeof schema !== 'object') return false;
    if (schema.type !== 'object') return false;
    
    if (schema.properties && typeof schema.properties !== 'object') return false;
    if (schema.required && !Array.isArray(schema.required)) return false;
    
    return true;
  },

  /**
   * Check for unique tool names
   */
  hasUniqueToolNames(tools: OpenAITool[]): boolean {
    const names = tools.map(tool => tool.function.name);
    return new Set(names).size === names.length;
  },

  /**
   * Check array size limits
   */
  isWithinSizeLimit(array: any[], limit: number): boolean {
    return Array.isArray(array) && array.length <= limit;
  }
};

/**
 * Performance assertion helpers
 */
export const PerformanceAssertions = {
  /**
   * Check if operation completed within time limit
   */
  isWithinTimeLimit(timeMs: number, limit: number): boolean {
    return timeMs <= limit;
  },

  /**
   * Check if performance meets specific requirement
   */
  meetsRequirement(actual: number, requirement: string): boolean {
    const match = requirement.match(/^(<|<=|>|>=)?\s*(\d+(\.\d+)?)\s*(ms|s|minutes?)?$/i);
    if (!match) return false;
    
    const operator = match[1] || '<=';
    const value = parseFloat(match[2]);
    const unit = match[4]?.toLowerCase() || 'ms';
    
    // Convert to milliseconds
    let limitMs = value;
    if (unit === 's') limitMs *= 1000;
    if (unit.startsWith('minute')) limitMs *= 60000;
    
    switch (operator) {
      case '<': return actual < limitMs;
      case '<=': return actual <= limitMs;
      case '>': return actual > limitMs;
      case '>=': return actual >= limitMs;
      default: return actual <= limitMs;
    }
  }
};

/**
 * OpenAI format validation helpers
 */
export const FormatAssertions = {
  /**
   * Check if object matches OpenAI tool format
   */
  matchesOpenAIToolFormat(obj: any): boolean {
    return ToolAssertions.isValidOpenAITool(obj);
  },

  /**
   * Check if error matches OpenAI error format
   */
  matchesOpenAIErrorFormat(error: any): boolean {
    if (!error || typeof error !== 'object') return false;
    
    // OpenAI error format: { error: { message, type, code?, ... } }
    if (!error.error || typeof error.error !== 'object') return false;
    if (!error.error.message || typeof error.error.message !== 'string') return false;
    if (!error.error.type || typeof error.error.type !== 'string') return false;
    
    return true;
  },

  /**
   * Check if response is OpenAI compatible
   */
  isOpenAICompatible(response: any): boolean {
    if (!response || typeof response !== 'object') return false;
    
    // Basic structure checks
    if (response.id && typeof response.id !== 'string') return false;
    if (response.object && typeof response.object !== 'string') return false;
    if (response.created && typeof response.created !== 'number') return false;
    if (response.model && typeof response.model !== 'string') return false;
    
    return true;
  }
};

/**
 * Tool call structure validation helpers
 */
export const ToolCallAssertions = {
  /**
   * Validate tool call structure
   */
  isValidToolCall(toolCall: any): boolean {
    if (!toolCall || typeof toolCall !== 'object') return false;
    if (!toolCall.id || typeof toolCall.id !== 'string') return false;
    if (toolCall.type !== 'function') return false;
    if (!toolCall.function || typeof toolCall.function !== 'object') return false;
    if (!toolCall.function.name || typeof toolCall.function.name !== 'string') return false;
    
    return true;
  },

  /**
   * Check if tool call has valid ID format
   */
  hasValidToolCallId(toolCall: any): boolean {
    if (!toolCall?.id || typeof toolCall.id !== 'string') return false;
    
    // OpenAI tool call ID format: call_xxxxx (starts with call_)
    return toolCall.id.startsWith('call_') && toolCall.id.length > 5;
  },

  /**
   * Check for duplicate IDs in tool calls array
   */
  hasNoDuplicateIds(toolCalls: any[]): boolean {
    if (!Array.isArray(toolCalls)) return false;
    
    const ids = toolCalls.map(tc => tc.id).filter(Boolean);
    return new Set(ids).size === ids.length;
  }
};

/**
 * Error type validation helpers
 */
export const ErrorAssertions = {
  /**
   * Check if error is validation error
   */
  isValidationError(error: any, type?: string): boolean {
    if (!error) return false;
    
    const message = error.message || String(error);
    const isValidation = message.toLowerCase().includes('validation') ||
                        message.toLowerCase().includes('invalid') ||
                        message.toLowerCase().includes('required');
    
    if (type) {
      return isValidation && message.toLowerCase().includes(type.toLowerCase());
    }
    
    return isValidation;
  },

  /**
   * Check if error is timeout error
   */
  isTimeoutError(error: any): boolean {
    if (!error) return false;
    
    const message = error.message || String(error);
    return message.toLowerCase().includes('timeout') ||
           message.toLowerCase().includes('timed out') ||
           message.toLowerCase().includes('deadline');
  },

  /**
   * Check if error is format error
   */
  isFormatError(error: any): boolean {
    if (!error) return false;
    
    const message = error.message || String(error);
    return message.toLowerCase().includes('format') ||
           message.toLowerCase().includes('parse') ||
           message.toLowerCase().includes('syntax');
  },

  /**
   * Check if error is system error
   */
  isSystemError(error: any): boolean {
    if (!error) return false;
    
    const message = error.message || String(error);
    return message.toLowerCase().includes('system') ||
           message.toLowerCase().includes('internal') ||
           message.toLowerCase().includes('server');
  }
};

/**
 * Custom Jest matchers implementation
 */
export const customMatchers = {
  // Tool validation matchers
  toBeValidOpenAITool(received: any) {
    const pass = ToolAssertions.isValidOpenAITool(received);
    return {
      pass,
      message: () => pass 
        ? `Expected ${JSON.stringify(received)} not to be a valid OpenAI tool`
        : `Expected ${JSON.stringify(received)} to be a valid OpenAI tool`
    };
  },

  toBeValidToolArray(received: any) {
    const pass = ToolAssertions.isValidToolArray(received);
    return {
      pass,
      message: () => pass
        ? `Expected array not to be a valid tool array`
        : `Expected array to be a valid tool array`
    };
  },

  toBeValidToolChoice(received: any) {
    const pass = ToolAssertions.isValidToolChoice(received);
    return {
      pass,
      message: () => pass
        ? `Expected ${JSON.stringify(received)} not to be a valid tool choice`
        : `Expected ${JSON.stringify(received)} to be a valid tool choice`
    };
  },

  toHaveValidToolSchema(received: any) {
    const pass = received && ToolAssertions.isValidParameterSchema(received.function?.parameters);
    return {
      pass,
      message: () => pass
        ? `Expected tool not to have valid schema`
        : `Expected tool to have valid parameter schema`
    };
  },

  toHaveValidParameterSchema(received: any) {
    const pass = ToolAssertions.isValidParameterSchema(received);
    return {
      pass,
      message: () => pass
        ? `Expected schema not to be valid`
        : `Expected schema to be valid parameter schema`
    };
  },

  // Validation result matchers
  toBeValidationSuccess(received: ValidationFrameworkResult) {
    const pass = ValidationAssertions.isValidationSuccess(received);
    return {
      pass,
      message: () => pass
        ? `Expected validation not to succeed`
        : `Expected validation to succeed, but got errors: ${JSON.stringify(received.errors)}`
    };
  },

  toBeValidationFailure(received: ValidationFrameworkResult) {
    const pass = ValidationAssertions.isValidationFailure(received);
    return {
      pass,
      message: () => pass
        ? `Expected validation not to fail`
        : `Expected validation to fail, but it succeeded`
    };
  },

  toHaveValidationErrors(received: ValidationFrameworkResult, count?: number) {
    const errorCount = ValidationAssertions.getErrorCount(received);
    const pass = count !== undefined ? errorCount === count : errorCount > 0;
    
    return {
      pass,
      message: () => {
        if (count !== undefined) {
          return pass
            ? `Expected not to have exactly ${count} validation errors`
            : `Expected ${count} validation errors, but got ${errorCount}`;
        }
        return pass
          ? `Expected not to have validation errors`
          : `Expected to have validation errors, but got none`;
      }
    };
  },

  toHaveValidationError(received: ValidationFrameworkResult, field: string, code?: string) {
    const pass = ValidationAssertions.hasValidationError(received, field, code);
    return {
      pass,
      message: () => {
        const codeMsg = code ? ` with code ${code}` : '';
        return pass
          ? `Expected not to have validation error for field ${field}${codeMsg}`
          : `Expected validation error for field ${field}${codeMsg}, but got: ${JSON.stringify(received.errors)}`;
      }
    };
  },

  // Performance matchers
  toCompleteWithinTimeLimit(received: ValidationFrameworkResult | number, timeMs: number) {
    const actualTime = typeof received === 'number' ? received : received.validationTimeMs;
    const pass = PerformanceAssertions.isWithinTimeLimit(actualTime, timeMs);
    
    return {
      pass,
      message: () => pass
        ? `Expected not to complete within ${timeMs}ms`
        : `Expected to complete within ${timeMs}ms, but took ${actualTime}ms`
    };
  },

  toMeetPerformanceRequirement(received: number, requirement: string) {
    const pass = PerformanceAssertions.meetsRequirement(received, requirement);
    return {
      pass,
      message: () => pass
        ? `Expected ${received}ms not to meet requirement ${requirement}`
        : `Expected ${received}ms to meet requirement ${requirement}`
    };
  },

  // OpenAI compatibility matchers
  toMatchOpenAIFormat(received: any) {
    const pass = FormatAssertions.matchesOpenAIToolFormat(received);
    return {
      pass,
      message: () => pass
        ? `Expected not to match OpenAI format`
        : `Expected to match OpenAI format`
    };
  },

  toMatchOpenAIErrorFormat(received: any) {
    const pass = FormatAssertions.matchesOpenAIErrorFormat(received);
    return {
      pass,
      message: () => pass
        ? `Expected not to match OpenAI error format`
        : `Expected to match OpenAI error format`
    };
  },

  toBeOpenAICompatible(received: any) {
    const pass = FormatAssertions.isOpenAICompatible(received);
    return {
      pass,
      message: () => pass
        ? `Expected not to be OpenAI compatible`
        : `Expected to be OpenAI compatible`
    };
  },

  // Tool call matchers
  toBeValidToolCall(received: any) {
    const pass = ToolCallAssertions.isValidToolCall(received);
    return {
      pass,
      message: () => pass
        ? `Expected not to be valid tool call`
        : `Expected to be valid tool call`
    };
  },

  toHaveToolCallId(received: any) {
    const pass = ToolCallAssertions.hasValidToolCallId(received);
    return {
      pass,
      message: () => pass
        ? `Expected not to have valid tool call ID`
        : `Expected to have valid tool call ID`
    };
  },

  toHaveValidToolCallStructure(received: any) {
    const pass = ToolCallAssertions.isValidToolCall(received) && 
                 ToolCallAssertions.hasValidToolCallId(received);
    return {
      pass,
      message: () => pass
        ? `Expected not to have valid tool call structure`
        : `Expected to have valid tool call structure`
    };
  },

  // Array and structure matchers
  toHaveUniqueToolNames(received: OpenAITool[]) {
    const pass = ToolAssertions.hasUniqueToolNames(received);
    return {
      pass,
      message: () => pass
        ? `Expected tools not to have unique names`
        : `Expected tools to have unique names`
    };
  },

  toHaveNoDuplicateIds(received: any[]) {
    const pass = ToolCallAssertions.hasNoDuplicateIds(received);
    return {
      pass,
      message: () => pass
        ? `Expected to have duplicate IDs`
        : `Expected not to have duplicate IDs`
    };
  },

  toBeWithinSizeLimit(received: any[], limit: number) {
    const pass = ToolAssertions.isWithinSizeLimit(received, limit);
    return {
      pass,
      message: () => pass
        ? `Expected array size (${received.length}) not to be within limit ${limit}`
        : `Expected array size (${received.length}) to be within limit ${limit}`
    };
  },

  // Error scenario matchers
  toBeValidationError(received: any, type?: string) {
    const pass = ErrorAssertions.isValidationError(received, type);
    const typeMsg = type ? ` of type ${type}` : '';
    return {
      pass,
      message: () => pass
        ? `Expected not to be validation error${typeMsg}`
        : `Expected to be validation error${typeMsg}`
    };
  },

  toBeTimeoutError(received: any) {
    const pass = ErrorAssertions.isTimeoutError(received);
    return {
      pass,
      message: () => pass
        ? `Expected not to be timeout error`
        : `Expected to be timeout error`
    };
  },

  toBeFormatError(received: any) {
    const pass = ErrorAssertions.isFormatError(received);
    return {
      pass,
      message: () => pass
        ? `Expected not to be format error`
        : `Expected to be format error`
    };
  },

  toBeSystemError(received: any) {
    const pass = ErrorAssertions.isSystemError(received);
    return {
      pass,
      message: () => pass
        ? `Expected not to be system error`
        : `Expected to be system error`
    };
  }
};

/**
 * Setup function to register custom matchers with Jest
 */
export function setupCustomMatchers(): void {
  expect.extend(customMatchers);
}

/**
 * Utility functions for test assertions
 */
export const AssertionUtils = {
  /**
   * Assert multiple validation results
   */
  expectAllValidationSuccess(results: ValidationFrameworkResult[]): void {
    results.forEach((result, index) => {
      const pass = ValidationAssertions.isValidationSuccess(result);
      if (!pass) {
        throw new Error(`Validation result ${index} should be successful but got errors: ${JSON.stringify(result.errors)}`);
      }
    });
  },

  /**
   * Assert validation result contains specific errors
   */
  expectValidationErrors(result: ValidationFrameworkResult, expectedErrors: { field: string; code?: string }[]): void {
    const isFailure = ValidationAssertions.isValidationFailure(result);
    if (!isFailure) {
      throw new Error('Expected validation to fail, but it succeeded');
    }
    
    const errorCount = ValidationAssertions.getErrorCount(result);
    if (errorCount !== expectedErrors.length) {
      throw new Error(`Expected ${expectedErrors.length} validation errors, but got ${errorCount}`);
    }
    
    expectedErrors.forEach(error => {
      const hasError = ValidationAssertions.hasValidationError(result, error.field, error.code);
      if (!hasError) {
        const codeMsg = error.code ? ` with code ${error.code}` : '';
        throw new Error(`Expected validation error for field ${error.field}${codeMsg}, but got: ${JSON.stringify(result.errors)}`);
      }
    });
  },

  /**
   * Assert performance characteristics
   */
  expectPerformanceCompliance(results: ValidationFrameworkResult[], maxTimeMs: number): void {
    results.forEach((result, index) => {
      const withinLimit = ValidationAssertions.isWithinTimeLimit(result, maxTimeMs);
      if (!withinLimit) {
        throw new Error(`Validation result ${index} took ${result.validationTimeMs}ms, exceeding limit of ${maxTimeMs}ms`);
      }
    });
  },

  /**
   * Assert OpenAI compatibility for multiple items
   */
  expectOpenAICompatibility(items: any[]): void {
    items.forEach((item, index) => {
      const compatible = FormatAssertions.isOpenAICompatible(item);
      if (!compatible) {
        throw new Error(`Item ${index} is not OpenAI compatible`);
      }
    });
  }
};