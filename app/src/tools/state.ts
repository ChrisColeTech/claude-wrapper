/**
 * Phase 16A: Minimal state types for compatibility
 * Note: No actual tool state management - tools are client-side only
 */

export interface ToolState {
  // Empty interface for compatibility
}

export interface SessionState {
  id: string;
  created: Date;
  // Minimal session state without tool execution
}

export interface ToolCallStateSnapshot {
  // Phase 16A: Empty interface for compatibility - no tool execution state
  sessionId?: string;
  timestamp?: Date;
}

// Phase 16A: Placeholder exports for compatibility
export const createSessionState = (id: string): SessionState => ({
  id,
  created: new Date()
});

export const getSessionState = (id: string): SessionState | null => {
  // Minimal implementation
  return null;
};