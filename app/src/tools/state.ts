/**
 * Tool State Types
 * Minimal state interfaces for session compatibility
 * No actual tool execution state - tools are client-side only
 */

/**
 * Tool call state snapshot for session compatibility
 */
export interface ToolCallStateSnapshot {
  sessionId?: string;
  timestamp?: Date;
  // Minimal interface - no server-side tool execution state needed
}

/**
 * Create empty tool call state snapshot
 */
export function createEmptySnapshot(sessionId?: string): ToolCallStateSnapshot {
  return {
    sessionId,
    timestamp: new Date()
  };
}