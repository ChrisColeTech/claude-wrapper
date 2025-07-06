/**
 * Phase 16A: Minimal tools exports for protocol compatibility
 * Note: Server-side tool execution has been removed
 */

// Export constants only - no tool execution functionality
export * from './constants';

// Phase 16A: Tool validation placeholder (rejects tools with helpful message)
export const toolValidator = {
  validateToolArray: () => ({
    valid: false,
    errors: ['Tool execution is not supported. This API provides OpenAI-compatible chat completions only.'],
    validTools: []
  }),
  validateToolChoice: () => ({
    valid: false,
    errors: ['Tool execution is not supported. This API provides OpenAI-compatible chat completions only.']
  })
};