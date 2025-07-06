/**
 * Tool calling state management service
 * Single Responsibility: Tool calling state management only
 * 
 * Manages tool calling state across conversation turns:
 * - Tool call creation and tracking
 * - State transitions and completion
 * - State cleanup and memory management
 * - Tool call history maintenance
 */

import { OpenAIToolCall } from './types';
import { getLogger } from '../utils/logger';

const logger = getLogger('ToolStateManager');

/**
 * Tool call state types
 */
export type ToolCallState = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

/**
 * Tool call state entry
 */
export interface ToolCallStateEntry {
  id: string;
  toolCall: OpenAIToolCall;
  state: ToolCallState;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Tool calling state snapshot
 */
export interface ToolCallStateSnapshot {
  sessionId: string;
  conversationTurn: number;
  pendingCalls: ToolCallStateEntry[];
  completedCalls: ToolCallStateEntry[];
  totalCalls: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * State transition request
 */
export interface StateTransitionRequest {
  toolCallId: string;
  newState: ToolCallState;
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * State transition result
 */
export interface StateTransitionResult {
  success: boolean;
  previousState?: ToolCallState;
  newState?: ToolCallState;
  transitionTimeMs: number;
  error?: string;
}

/**
 * State cleanup result
 */
export interface StateCleanupResult {
  cleanedEntries: number;
  remainingEntries: number;
  cleanupTimeMs: number;
  bytesFreed: number;
}

/**
 * Tool state manager interface
 */
export interface IToolStateManager {
  createToolCall(sessionId: string, toolCall: OpenAIToolCall, metadata?: Record<string, any>): Promise<ToolCallStateEntry>;
  updateToolCallState(sessionId: string, request: StateTransitionRequest): Promise<StateTransitionResult>;
  getToolCallState(sessionId: string, toolCallId: string): Promise<ToolCallStateEntry | null>;
  getPendingToolCalls(sessionId: string): Promise<ToolCallStateEntry[]>;
  getCompletedToolCalls(sessionId: string): Promise<ToolCallStateEntry[]>;
  getAllToolCalls(sessionId: string): Promise<ToolCallStateEntry[]>;
  getSessionToolCalls(sessionId: string): Promise<string[]>;
  getStateSnapshot(sessionId: string): Promise<ToolCallStateSnapshot | null>;
  cleanupExpiredStates(maxAgeMs: number): Promise<StateCleanupResult>;
  clearSessionState(sessionId: string): Promise<boolean>;
}

/**
 * Tool state manager implementation
 */
export class ToolStateManager implements IToolStateManager {
  private states: Map<string, Map<string, ToolCallStateEntry>> = new Map();
  private snapshots: Map<string, ToolCallStateSnapshot> = new Map();

  /**
   * Create new tool call state entry
   */
  async createToolCall(
    sessionId: string, 
    toolCall: OpenAIToolCall, 
    metadata?: Record<string, any>
  ): Promise<ToolCallStateEntry> {
    const startTime = Date.now();
    
    try {
      if (!sessionId || !toolCall?.id) {
        throw new Error('Session ID and tool call ID are required');
      }

      const entry: ToolCallStateEntry = {
        id: toolCall.id,
        toolCall,
        state: 'pending',
        createdAt: startTime,
        updatedAt: startTime,
        metadata
      };

      // Initialize session state if needed
      if (!this.states.has(sessionId)) {
        this.states.set(sessionId, new Map());
      }

      const sessionStates = this.states.get(sessionId)!;
      sessionStates.set(toolCall.id, entry);

      // Update snapshot
      await this.updateSnapshot(sessionId);

      logger.debug('Tool call state created', {
        sessionId,
        toolCallId: toolCall.id,
        functionName: toolCall.function?.name,
        processingTime: Date.now() - startTime
      });

      return entry;
    } catch (error) {
      logger.error('Failed to create tool call state', {
        sessionId,
        toolCallId: toolCall?.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Update tool call state with transition
   */
  async updateToolCallState(
    sessionId: string, 
    request: StateTransitionRequest
  ): Promise<StateTransitionResult> {
    const startTime = Date.now();
    
    try {
      const sessionStates = this.states.get(sessionId);
      if (!sessionStates) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const entry = sessionStates.get(request.toolCallId);
      if (!entry) {
        throw new Error(`Tool call ${request.toolCallId} not found in session ${sessionId}`);
      }

      const previousState = entry.state;
      
      // Validate state transition
      if (!this.isValidTransition(previousState, request.newState)) {
        throw new Error(`Invalid state transition from ${previousState} to ${request.newState}`);
      }

      // Update entry
      entry.state = request.newState;
      entry.updatedAt = Date.now();
      
      if (request.result !== undefined) {
        entry.result = request.result;
      }
      
      if (request.error) {
        entry.error = request.error;
      }
      
      if (request.metadata) {
        entry.metadata = { ...entry.metadata, ...request.metadata };
      }

      // Set completion timestamp for terminal states
      if (['completed', 'failed', 'cancelled'].includes(request.newState)) {
        entry.completedAt = Date.now();
      }

      // Update snapshot
      await this.updateSnapshot(sessionId);

      const transitionTime = Date.now() - startTime;

      logger.debug('Tool call state updated', {
        sessionId,
        toolCallId: request.toolCallId,
        previousState,
        newState: request.newState,
        transitionTime
      });

      return {
        success: true,
        previousState,
        newState: request.newState,
        transitionTimeMs: transitionTime
      };
    } catch (error) {
      const transitionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Failed to update tool call state', {
        sessionId,
        toolCallId: request.toolCallId,
        error: errorMessage,
        transitionTime
      });

      return {
        success: false,
        transitionTimeMs: transitionTime,
        error: errorMessage
      };
    }
  }

  /**
   * Get tool call state by ID
   */
  async getToolCallState(sessionId: string, toolCallId: string): Promise<ToolCallStateEntry | null> {
    const sessionStates = this.states.get(sessionId);
    if (!sessionStates) {
      return null;
    }

    return sessionStates.get(toolCallId) || null;
  }

  /**
   * Get all pending tool calls for session
   */
  async getPendingToolCalls(sessionId: string): Promise<ToolCallStateEntry[]> {
    return this.getToolCallsByState(sessionId, ['pending', 'in_progress']);
  }

  /**
   * Get all completed tool calls for session
   */
  async getCompletedToolCalls(sessionId: string): Promise<ToolCallStateEntry[]> {
    return this.getToolCallsByState(sessionId, ['completed', 'failed', 'cancelled']);
  }

  /**
   * Get all tool calls for session
   */
  async getAllToolCalls(sessionId: string): Promise<ToolCallStateEntry[]> {
    const sessionStates = this.states.get(sessionId);
    if (!sessionStates) {
      return [];
    }

    return Array.from(sessionStates.values()).sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Get all tool call IDs for session
   */
  async getSessionToolCalls(sessionId: string): Promise<string[]> {
    const sessionStates = this.states.get(sessionId);
    if (!sessionStates) {
      return [];
    }

    return Array.from(sessionStates.keys()).sort();
  }

  /**
   * Get current state snapshot for session
   */
  async getStateSnapshot(sessionId: string): Promise<ToolCallStateSnapshot | null> {
    return this.snapshots.get(sessionId) || null;
  }

  /**
   * Clean up expired tool call states
   */
  async cleanupExpiredStates(maxAgeMs: number): Promise<StateCleanupResult> {
    const startTime = Date.now();
    const cutoffTime = Date.now() - maxAgeMs;
    let cleanedEntries = 0;
    let remainingEntries = 0;
    let bytesFreed = 0;

    try {
      for (const [sessionId, sessionStates] of Array.from(this.states.entries())) {
        const toDelete: string[] = [];

        for (const [toolCallId, entry] of Array.from(sessionStates.entries())) {
          // Only clean up completed/failed states that are old enough
          if (['completed', 'failed', 'cancelled'].includes(entry.state) && 
              (entry.completedAt || entry.updatedAt) < cutoffTime) {
            toDelete.push(toolCallId);
            cleanedEntries++;
            bytesFreed += this.estimateEntrySize(entry);
          } else {
            remainingEntries++;
          }
        }

        // Remove expired entries
        for (const toolCallId of toDelete) {
          sessionStates.delete(toolCallId);
        }

        // Remove empty session states
        if (sessionStates.size === 0) {
          this.states.delete(sessionId);
          this.snapshots.delete(sessionId);
        } else {
          // Update snapshot for sessions with remaining entries
          await this.updateSnapshot(sessionId);
        }
      }

      const cleanupTime = Date.now() - startTime;

      logger.info('State cleanup completed', {
        cleanedEntries,
        remainingEntries,
        cleanupTime,
        bytesFreed
      });

      return {
        cleanedEntries,
        remainingEntries,
        cleanupTimeMs: cleanupTime,
        bytesFreed
      };
    } catch (error) {
      logger.error('State cleanup failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Clear all state for a session
   */
  async clearSessionState(sessionId: string): Promise<boolean> {
    try {
      this.states.delete(sessionId);
      this.snapshots.delete(sessionId);
      
      logger.debug('Session state cleared', { sessionId });
      return true;
    } catch (error) {
      logger.error('Failed to clear session state', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get tool calls by state
   */
  private async getToolCallsByState(sessionId: string, states: ToolCallState[]): Promise<ToolCallStateEntry[]> {
    const sessionStates = this.states.get(sessionId);
    if (!sessionStates) {
      return [];
    }

    return Array.from(sessionStates.values())
      .filter(entry => states.includes(entry.state))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Update state snapshot for session
   */
  private async updateSnapshot(sessionId: string): Promise<void> {
    const sessionStates = this.states.get(sessionId);
    if (!sessionStates) {
      return;
    }

    const allCalls = Array.from(sessionStates.values());
    const pendingCalls = allCalls.filter(entry => ['pending', 'in_progress'].includes(entry.state));
    const completedCalls = allCalls.filter(entry => ['completed', 'failed', 'cancelled'].includes(entry.state));

    const snapshot: ToolCallStateSnapshot = {
      sessionId,
      conversationTurn: this.calculateConversationTurn(allCalls),
      pendingCalls,
      completedCalls,
      totalCalls: allCalls.length,
      createdAt: this.snapshots.get(sessionId)?.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    this.snapshots.set(sessionId, snapshot);
  }

  /**
   * Calculate current conversation turn
   */
  private calculateConversationTurn(entries: ToolCallStateEntry[]): number {
    if (entries.length === 0) return 0;
    
    // Each completed tool call represents a conversation turn
    // Count distinct completed calls
    const completedCount = entries.filter(entry => 
      ['completed', 'failed', 'cancelled'].includes(entry.state)
    ).length;
    
    // If we have pending calls, add 1 for the current turn
    const hasPending = entries.some(entry => 
      ['pending', 'in_progress'].includes(entry.state)
    );
    
    return completedCount + (hasPending ? 1 : 0);
  }

  /**
   * Validate state transition
   */
  private isValidTransition(from: ToolCallState, to: ToolCallState): boolean {
    const validTransitions: Record<ToolCallState, ToolCallState[]> = {
      'pending': ['in_progress', 'cancelled'],
      'in_progress': ['completed', 'failed', 'cancelled'],
      'completed': [], // Terminal state
      'failed': [], // Terminal state
      'cancelled': [] // Terminal state
    };

    return validTransitions[from]?.includes(to) || false;
  }

  /**
   * Estimate memory size of entry
   */
  private estimateEntrySize(entry: ToolCallStateEntry): number {
    return JSON.stringify(entry).length * 2; // Rough UTF-16 byte estimate
  }
}

/**
 * State management utilities
 */
export const ToolStateUtils = {
  /**
   * Check if state is terminal
   */
  isTerminalState: (state: ToolCallState): boolean => {
    return ['completed', 'failed', 'cancelled'].includes(state);
  },

  /**
   * Check if state is active
   */
  isActiveState: (state: ToolCallState): boolean => {
    return ['pending', 'in_progress'].includes(state);
  },

  /**
   * Get state priority for sorting
   */
  getStatePriority: (state: ToolCallState): number => {
    const priorities: { [key: string]: number } = {
      'in_progress': 0,
      'pending': 1,
      'completed': 2,
      'failed': 3,
      'cancelled': 4
    };
    return priorities[state] !== undefined ? priorities[state] : 999;
  },

  /**
   * Filter entries by age
   */
  filterByAge: (entries: ToolCallStateEntry[], maxAgeMs: number): ToolCallStateEntry[] => {
    const cutoff = Date.now() - maxAgeMs;
    return entries.filter(entry => entry.createdAt >= cutoff);
  },

  /**
   * Get completion rate for entries
   */
  getCompletionRate: (entries: ToolCallStateEntry[]): number => {
    if (entries.length === 0) return 0;
    const completed = entries.filter(entry => entry.state === 'completed').length;
    return completed / entries.length;
  }
};

export const toolStateManager = new ToolStateManager();