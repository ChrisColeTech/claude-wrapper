/**
 * Jest Custom Matchers Type Definitions
 * Phase 13B: Testing Integration Review
 * 
 * Provides TypeScript declarations for custom Jest matchers used in OpenAI tools testing
 */

declare global {
  namespace jest {
    interface Matchers<R> {
      // OpenAI Tool Validation Matchers
      toBeValidOpenAITool(): R;
      toBeValidToolArray(): R;
      toBeValidToolChoice(): R;
      toHaveValidToolSchema(): R;
      toHaveValidParameterSchema(): R;
      
      // Validation Framework Matchers
      toBeValidationSuccess(): R;
      toBeValidationFailure(): R;
      toHaveValidationErrors(count?: number): R;
      toHaveValidationError(field: string, code?: string): R;
      
      // Performance Testing Matchers
      toCompleteWithinTimeLimit(timeMs: number): R;
      toMeetPerformanceRequirement(requirement: string): R;
      
      // OpenAI Compatibility Matchers
      toMatchOpenAIFormat(): R;
      toMatchOpenAIErrorFormat(): R;
      toBeOpenAICompatible(): R;
      
      // Tool Call Structure Matchers
      toBeValidToolCall(): R;
      toHaveToolCallId(): R;
      toHaveValidToolCallStructure(): R;
      
      // Array and Collection Matchers
      toHaveUniqueToolNames(): R;
      toHaveNoDuplicateIds(): R;
      toBeWithinSizeLimit(limit: number): R;
      
      // Error Type Matchers
      toBeValidationError(type?: string): R;
      toBeTimeoutError(): R;
      toBeFormatError(): R;
      toBeSystemError(): R;
    }
  }
}

export {};