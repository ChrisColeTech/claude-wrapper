/**
 * Tool Call Correlation Service (Phase 9A)
 * Single Responsibility: Tool call ID correlation only
 * 
 * Correlates tool call IDs with tool results for proper message association
 * Following SOLID principles and architecture guidelines
 */

import { Message } from '../models/message';
import { OpenAIToolCall } from './types';
import { 
  MESSAGE_PROCESSING_LIMITS,
  MESSAGE_PROCESSING_MESSAGES,
  MESSAGE_PROCESSING_ERRORS,
  TOOL_MESSAGE_VALIDATION
} from './constants';

/**
 * Tool call correlation entry
 */
export interface ToolCallCorrelation {
  toolCallId: string;
  sessionId?: string;
  timestamp: number;
  toolName?: string;
  status: 'pending' | 'completed' | 'failed';
}

/**
 * Tool correlation result
 */
export interface ToolCorrelationResult {
  success: boolean;
  correlation?: ToolCallCorrelation;
  errors: string[];
  correlationTimeMs: number;
}

/**
 * Batch correlation result
 */
export interface BatchCorrelationResult {
  success: boolean;
  correlations: ToolCallCorrelation[];
  totalCorrelated: number;
  errors: string[];
  correlationTimeMs: number;
  failedCorrelations: number;
}

/**
 * Tool call correlation interface (ISP compliance)
 */
export interface IToolCallCorrelationService {
  correlateToolCall(toolCallId: string, sessionId?: string): Promise<ToolCorrelationResult>;
  correlateToolResult(message: Message): Promise<ToolCorrelationResult>;
  getCorrelation(toolCallId: string): ToolCallCorrelation | null;
  hasCorrelation(toolCallId: string): boolean;
  removeCorrelation(toolCallId: string): boolean;
  clearSession(sessionId: string): number;
}

/**
 * Tool correlation error
 */
export class ToolCorrelationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly correlationTimeMs?: number
  ) {
    super(message);
    this.name = 'ToolCorrelationError';
  }
}

/**
 * Tool Call Correlation Service implementation
 * SRP: Handles only tool call ID correlation logic
 * File size: <200 lines, functions <50 lines, max 5 parameters
 */
export class ToolCallCorrelationService implements IToolCallCorrelationService {
  private correlations: Map<string, ToolCallCorrelation> = new Map();

  /**
   * Correlate a tool call ID for tracking
   * @param toolCallId Tool call ID to track
   * @param sessionId Optional session ID
   * @returns Correlation result
   */
  async correlateToolCall(toolCallId: string, sessionId?: string): Promise<ToolCorrelationResult> {
    const startTime = performance.now();

    try {
      // Early return for invalid tool call ID
      if (!this.isValidToolCallId(toolCallId)) {
        return {
          success: false,
          errors: [MESSAGE_PROCESSING_MESSAGES.TOOL_CALL_ID_INVALID],
          correlationTimeMs: performance.now() - startTime
        };
      }

      // Check for existing correlation
      if (this.correlations.has(toolCallId)) {
        return {
          success: false,
          errors: [MESSAGE_PROCESSING_MESSAGES.DUPLICATE_TOOL_CALL_ID],
          correlationTimeMs: performance.now() - startTime
        };
      }

      // Create new correlation
      const correlation: ToolCallCorrelation = {
        toolCallId,
        sessionId,
        timestamp: Date.now(),
        status: 'pending'
      };

      this.correlations.set(toolCallId, correlation);

      const correlationTime = performance.now() - startTime;

      // Check timeout requirement (<3ms)
      if (correlationTime > MESSAGE_PROCESSING_LIMITS.CORRELATION_TIMEOUT_MS) {
        throw new ToolCorrelationError(
          MESSAGE_PROCESSING_MESSAGES.CORRELATION_TIMEOUT,
          MESSAGE_PROCESSING_ERRORS.TIMEOUT,
          correlationTime
        );
      }

      return {
        success: true,
        correlation,
        errors: [],
        correlationTimeMs: correlationTime
      };

    } catch (error) {
      const correlationTime = performance.now() - startTime;

      if (error instanceof ToolCorrelationError) {
        return {
          success: false,
          errors: [error.message],
          correlationTimeMs: correlationTime
        };
      }

      return {
        success: false,
        errors: [MESSAGE_PROCESSING_MESSAGES.CORRELATION_FAILED],
        correlationTimeMs: correlationTime
      };
    }
  }

  /**
   * Correlate tool result message with existing tool call
   * @param message Tool message with result
   * @returns Correlation result
   */
  async correlateToolResult(message: Message): Promise<ToolCorrelationResult> {
    const startTime = performance.now();

    try {
      // Early return for invalid tool message
      if (!this.isValidToolMessage(message)) {
        return {
          success: false,
          errors: [MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE],
          correlationTimeMs: performance.now() - startTime
        };
      }

      const toolCallId = message.tool_call_id!;

      // Find existing correlation
      const existingCorrelation = this.correlations.get(toolCallId);
      if (!existingCorrelation) {
        return {
          success: false,
          errors: [MESSAGE_PROCESSING_MESSAGES.TOOL_CALL_NOT_FOUND],
          correlationTimeMs: performance.now() - startTime
        };
      }

      // Update correlation status
      existingCorrelation.status = 'completed';
      existingCorrelation.timestamp = Date.now();

      const correlationTime = performance.now() - startTime;

      // Check timeout requirement (<3ms)
      if (correlationTime > MESSAGE_PROCESSING_LIMITS.CORRELATION_TIMEOUT_MS) {
        throw new ToolCorrelationError(
          MESSAGE_PROCESSING_MESSAGES.CORRELATION_TIMEOUT,
          MESSAGE_PROCESSING_ERRORS.TIMEOUT,
          correlationTime
        );
      }

      return {
        success: true,
        correlation: existingCorrelation,
        errors: [],
        correlationTimeMs: correlationTime
      };

    } catch (error) {
      const correlationTime = performance.now() - startTime;

      if (error instanceof ToolCorrelationError) {
        return {
          success: false,
          errors: [error.message],
          correlationTimeMs: correlationTime
        };
      }

      return {
        success: false,
        errors: [MESSAGE_PROCESSING_MESSAGES.CORRELATION_FAILED],
        correlationTimeMs: correlationTime
      };
    }
  }

  /**
   * Get correlation for tool call ID
   * @param toolCallId Tool call ID to look up
   * @returns Correlation or null if not found
   */
  getCorrelation(toolCallId: string): ToolCallCorrelation | null {
    return this.correlations.get(toolCallId) || null;
  }

  /**
   * Check if tool call ID has correlation
   * @param toolCallId Tool call ID to check
   * @returns True if correlation exists
   */
  hasCorrelation(toolCallId: string): boolean {
    return this.correlations.has(toolCallId);
  }

  /**
   * Remove correlation for tool call ID
   * @param toolCallId Tool call ID to remove
   * @returns True if correlation was removed
   */
  removeCorrelation(toolCallId: string): boolean {
    return this.correlations.delete(toolCallId);
  }

  /**
   * Clear all correlations for a session
   * @param sessionId Session ID to clear
   * @returns Number of correlations removed
   */
  clearSession(sessionId: string): number {
    let removedCount = 0;

    Array.from(this.correlations.entries()).forEach(([toolCallId, correlation]) => {
      if (correlation.sessionId === sessionId) {
        this.correlations.delete(toolCallId);
        removedCount++;
      }
    });

    return removedCount;
  }

  /**
   * Get correlation statistics
   * @returns Statistics about current correlations
   */
  getStats(): {
    totalCorrelations: number;
    pendingCorrelations: number;
    completedCorrelations: number;
    failedCorrelations: number;
  } {
    const stats = {
      totalCorrelations: this.correlations.size,
      pendingCorrelations: 0,
      completedCorrelations: 0,
      failedCorrelations: 0
    };

    Array.from(this.correlations.values()).forEach(correlation => {
      switch (correlation.status) {
        case 'pending':
          stats.pendingCorrelations++;
          break;
        case 'completed':
          stats.completedCorrelations++;
          break;
        case 'failed':
          stats.failedCorrelations++;
          break;
      }
    });

    return stats;
  }

  /**
   * Validate tool call ID format
   * @param toolCallId Tool call ID to validate
   * @returns True if valid format
   */
  private isValidToolCallId(toolCallId: string): boolean {
    return typeof toolCallId === 'string' && 
           TOOL_MESSAGE_VALIDATION.TOOL_CALL_ID_PATTERN.test(toolCallId);
  }

  /**
   * Check if message is valid tool message
   * @param message Message to validate
   * @returns True if valid tool message
   */
  private isValidToolMessage(message: Message): boolean {
    return message && 
           message.role === 'tool' && 
           Boolean(message.tool_call_id) && 
           Boolean(message.content);
  }
}

/**
 * Create tool call correlation service instance
 * Factory function for dependency injection
 */
export function createToolCallCorrelationService(): IToolCallCorrelationService {
  return new ToolCallCorrelationService();
}