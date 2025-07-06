/**
 * Tool call ID tracking service
 * Single Responsibility: ID tracking only
 * 
 * Tracks tool call IDs across conversation turns and sessions
 */

import { IIDTracker, IDTrackingResult } from './types';
import { 
  ID_MANAGEMENT_LIMITS, 
  ID_MANAGEMENT_MESSAGES, 
  ID_MANAGEMENT_ERRORS,
  ID_FORMATS 
} from './constants';

/**
 * ID tracking error class
 */
export class IDTrackingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly id?: string,
    public readonly sessionId?: string
  ) {
    super(message);
    this.name = 'IDTrackingError';
  }
}

/**
 * ID tracking utilities
 */
export class IDTrackingUtils {
  /**
   * Validate session ID format
   */
  static validateSessionId(sessionId: string): boolean {
    return typeof sessionId === 'string' && sessionId.length > 0 && sessionId.length <= 100;
  }

  /**
   * Validate tool call ID format
   */
  static validateToolCallId(id: string): boolean {
    return typeof id === 'string' && 
           id.startsWith(ID_FORMATS.CALL_PREFIX) && 
           id.length === ID_FORMATS.CALL_ID_LENGTH;
  }

  /**
   * Create tracking key for storage
   */
  static createTrackingKey(id: string, sessionId?: string): string {
    return sessionId ? `${sessionId}:${id}` : id;
  }

  /**
   * Extract session from tracking key
   */
  static extractSessionFromKey(key: string): string | null {
    const parts = key.split(':');
    return parts.length > 1 ? parts[0] : null;
  }

  /**
   * Extract ID from tracking key
   */
  static extractIdFromKey(key: string): string {
    const parts = key.split(':');
    return parts.length > 1 ? parts[1] : parts[0];
  }
}

/**
 * Tool call ID tracker implementation
 */
export class ToolCallIDTracker implements IIDTracker {
  private trackedIds: Map<string, string> = new Map(); // key -> sessionId
  private sessionIds: Map<string, Set<string>> = new Map(); // sessionId -> Set of IDs

  /**
   * Add ID to tracking
   */
  addId(id: string, sessionId?: string): IDTrackingResult {
    const startTime = performance.now();

    try {
      // Validate inputs
      if (!IDTrackingUtils.validateToolCallId(id)) {
        return {
          success: false,
          id,
          sessionId,
          errors: [ID_MANAGEMENT_MESSAGES.ID_TRACKING_FAILED],
          trackingTimeMs: performance.now() - startTime
        };
      }

      if (sessionId !== undefined && !IDTrackingUtils.validateSessionId(sessionId)) {
        return {
          success: false,
          id,
          sessionId,
          errors: [ID_MANAGEMENT_MESSAGES.INVALID_SESSION_ID],
          trackingTimeMs: performance.now() - startTime
        };
      }

      // Check if already tracked
      if (this.trackedIds.has(id)) {
        return {
          success: false,
          id,
          sessionId,
          errors: [ID_MANAGEMENT_MESSAGES.ID_ALREADY_TRACKED],
          trackingTimeMs: performance.now() - startTime
        };
      }

      // Check session limits
      if (sessionId) {
        const sessionIdSet = this.sessionIds.get(sessionId);
        if (sessionIdSet && sessionIdSet.size >= ID_MANAGEMENT_LIMITS.MAX_IDS_PER_SESSION) {
          return {
            success: false,
            id,
            sessionId,
            errors: [ID_MANAGEMENT_MESSAGES.TRACKING_LIMIT_EXCEEDED],
            trackingTimeMs: performance.now() - startTime
          };
        }
      }

      // Add to tracking
      this.trackedIds.set(id, sessionId || '');
      
      if (sessionId) {
        if (!this.sessionIds.has(sessionId)) {
          this.sessionIds.set(sessionId, new Set());
        }
        this.sessionIds.get(sessionId)!.add(id);
      }

      return {
        success: true,
        id,
        sessionId,
        errors: [],
        trackingTimeMs: performance.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        id,
        sessionId,
        errors: [error instanceof Error ? error.message : ID_MANAGEMENT_MESSAGES.ID_TRACKING_FAILED],
        trackingTimeMs: performance.now() - startTime
      };
    }
  }

  /**
   * Check if ID is being tracked
   */
  hasId(id: string): boolean {
    return this.trackedIds.has(id);
  }

  /**
   * Get all tracked IDs, optionally filtered by session
   */
  getIds(sessionId?: string): string[] {
    if (sessionId) {
      const sessionIdSet = this.sessionIds.get(sessionId);
      return sessionIdSet ? Array.from(sessionIdSet) : [];
    }

    return Array.from(this.trackedIds.keys());
  }

  /**
   * Remove ID from tracking
   */
  removeId(id: string): IDTrackingResult {
    const startTime = performance.now();

    try {
      if (!this.trackedIds.has(id)) {
        return {
          success: false,
          id,
          errors: [ID_MANAGEMENT_MESSAGES.ID_NOT_TRACKED],
          trackingTimeMs: performance.now() - startTime
        };
      }

      const sessionId = this.trackedIds.get(id);
      this.trackedIds.delete(id);

      if (sessionId) {
        const sessionIdSet = this.sessionIds.get(sessionId);
        if (sessionIdSet) {
          sessionIdSet.delete(id);
          if (sessionIdSet.size === 0) {
            this.sessionIds.delete(sessionId);
          }
        }
      }

      return {
        success: true,
        id,
        sessionId: sessionId || undefined,
        errors: [],
        trackingTimeMs: performance.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        id,
        errors: [error instanceof Error ? error.message : ID_MANAGEMENT_MESSAGES.ID_TRACKING_FAILED],
        trackingTimeMs: performance.now() - startTime
      };
    }
  }

  /**
   * Clear tracking data
   */
  clear(sessionId?: string): void {
    if (sessionId) {
      const sessionIdSet = this.sessionIds.get(sessionId);
      if (sessionIdSet) {
        // Remove all IDs for this session
        for (const id of sessionIdSet) {
          this.trackedIds.delete(id);
        }
        this.sessionIds.delete(sessionId);
      }
    } else {
      // Clear all tracking data
      this.trackedIds.clear();
      this.sessionIds.clear();
    }
  }

  /**
   * Get tracking statistics (for testing/monitoring)
   */
  getTrackingStats() {
    return {
      totalTrackedIds: this.trackedIds.size,
      totalSessions: this.sessionIds.size,
      averageIdsPerSession: this.sessionIds.size > 0 
        ? this.trackedIds.size / this.sessionIds.size 
        : 0
    };
  }

  /**
   * Get session ID for a tracked ID
   */
  getSessionForId(id: string): string | null {
    const sessionId = this.trackedIds.get(id);
    return sessionId || null;
  }

  /**
   * Check if session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessionIds.has(sessionId);
  }
}

/**
 * Default tool call ID tracker instance
 */
export const toolCallIDTracker = new ToolCallIDTracker();