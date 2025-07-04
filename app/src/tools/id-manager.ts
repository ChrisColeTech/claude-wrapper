/**
 * Tool call ID management service
 * Single Responsibility: ID management coordination only
 * 
 * Coordinates ID generation, tracking, and validation for tool calls
 */

import { IIDManager, IIDTracker, IToolCallIdGenerator, IDManagementResult } from './types';
import { ToolCallIdGenerator } from './id-generator';
import { ToolCallIDTracker } from './id-tracker';
import { 
  ID_MANAGEMENT_LIMITS, 
  ID_MANAGEMENT_MESSAGES, 
  ID_MANAGEMENT_ERRORS 
} from './constants';

/**
 * ID management error class
 */
export class IDManagementError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly id?: string,
    public readonly sessionId?: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'IDManagementError';
  }
}

/**
 * ID management statistics
 */
interface IDManagementStats {
  totalIdsGenerated: number;
  totalIdsTracked: number;
  successfulOperations: number;
  failedOperations: number;
  totalOperationTime: number;
}

/**
 * ID management utilities
 */
export class IDManagementUtils {
  /**
   * Validate operation within timeout
   */
  static async validateWithTimeout<T>(
    operation: () => T,
    timeoutMs: number = ID_MANAGEMENT_LIMITS.MANAGEMENT_TIMEOUT_MS
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let hasResolved = false;
      
      const timeout = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          reject(new IDManagementError(
            ID_MANAGEMENT_MESSAGES.MANAGEMENT_TIMEOUT,
            ID_MANAGEMENT_ERRORS.TIMEOUT
          ));
        }
      }, timeoutMs);
      
      try {
        setImmediate(() => {
          try {
            const result = operation();
            if (!hasResolved) {
              hasResolved = true;
              clearTimeout(timeout);
              resolve(result);
            }
          } catch (error) {
            if (!hasResolved) {
              hasResolved = true;
              clearTimeout(timeout);
              reject(error);
            }
          }
        });
      } catch (error) {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timeout);
          reject(error);
        }
      }
    });
  }

  /**
   * Create management result
   */
  static createResult(
    success: boolean,
    id?: string,
    sessionId?: string,
    errors: string[] = [],
    startTime?: number
  ): IDManagementResult {
    return {
      success,
      id,
      sessionId,
      errors,
      managementTimeMs: startTime ? performance.now() - startTime : undefined
    };
  }
}

/**
 * Tool call ID manager implementation
 */
export class ToolCallIDManager implements IIDManager {
  private generator: IToolCallIdGenerator;
  private tracker: IIDTracker;
  private stats: IDManagementStats = {
    totalIdsGenerated: 0,
    totalIdsTracked: 0,
    successfulOperations: 0,
    failedOperations: 0,
    totalOperationTime: 0
  };

  constructor(
    generator?: IToolCallIdGenerator,
    tracker?: IIDTracker
  ) {
    this.generator = generator || new ToolCallIdGenerator();
    this.tracker = tracker || new ToolCallIDTracker();
  }

  /**
   * Generate a unique tool call ID
   */
  generateId(): string {
    const startTime = performance.now();
    
    try {
      const id = this.generator.generateId();
      this.stats.totalIdsGenerated++;
      this.updateStats(true, performance.now() - startTime);
      return id;
    } catch (error) {
      this.updateStats(false, performance.now() - startTime);
      throw new IDManagementError(
        error instanceof Error ? error.message : ID_MANAGEMENT_MESSAGES.ID_TRACKING_FAILED,
        ID_MANAGEMENT_ERRORS.TRACKING_FAILED
      );
    }
  }

  /**
   * Track a tool call ID for conversation continuity
   */
  trackId(id: string, sessionId?: string): IDManagementResult {
    const startTime = performance.now();

    try {
      // Validate ID format
      if (!this.generator.isValidId(id)) {
        const result = IDManagementUtils.createResult(
          false, id, sessionId, 
          [ID_MANAGEMENT_MESSAGES.ID_TRACKING_FAILED], 
          startTime
        );
        this.updateStats(false, performance.now() - startTime);
        return result;
      }

      // Track the ID
      const trackingResult = this.tracker.addId(id, sessionId);
      
      if (trackingResult.success) {
        this.stats.totalIdsTracked++;
        this.updateStats(true, performance.now() - startTime);
      } else {
        this.updateStats(false, performance.now() - startTime);
      }

      return {
        success: trackingResult.success,
        id: trackingResult.id,
        sessionId: trackingResult.sessionId,
        errors: trackingResult.errors,
        managementTimeMs: performance.now() - startTime
      };

    } catch (error) {
      this.updateStats(false, performance.now() - startTime);
      return IDManagementUtils.createResult(
        false, id, sessionId,
        [error instanceof Error ? error.message : ID_MANAGEMENT_MESSAGES.ID_TRACKING_FAILED],
        startTime
      );
    }
  }

  /**
   * Check if ID is being tracked
   */
  isIdTracked(id: string): boolean {
    return this.tracker.hasId(id);
  }

  /**
   * Get all tracked IDs for a session
   */
  getSessionIds(sessionId: string): string[] {
    return this.tracker.getIds(sessionId);
  }

  /**
   * Clear all tracked IDs for a session
   */
  clearSession(sessionId: string): void {
    this.tracker.clear(sessionId);
  }

  /**
   * Generate and track an ID in one operation
   */
  generateAndTrackId(sessionId?: string): IDManagementResult {
    const startTime = performance.now();

    try {
      const id = this.generateId();
      const trackingResult = this.trackId(id, sessionId);
      
      return {
        success: trackingResult.success,
        id: trackingResult.id,
        sessionId: trackingResult.sessionId,
        errors: trackingResult.errors,
        managementTimeMs: performance.now() - startTime
      };

    } catch (error) {
      this.updateStats(false, performance.now() - startTime);
      return IDManagementUtils.createResult(
        false, undefined, sessionId,
        [error instanceof Error ? error.message : ID_MANAGEMENT_MESSAGES.ID_TRACKING_FAILED],
        startTime
      );
    }
  }

  /**
   * Validate and track multiple IDs
   */
  trackMultipleIds(ids: string[], sessionId?: string): IDManagementResult[] {
    return ids.map(id => this.trackId(id, sessionId));
  }

  /**
   * Remove ID from tracking
   */
  untrackId(id: string): IDManagementResult {
    const startTime = performance.now();

    try {
      const result = this.tracker.removeId(id);
      
      if (result.success) {
        this.updateStats(true, performance.now() - startTime);
      } else {
        this.updateStats(false, performance.now() - startTime);
      }

      return {
        success: result.success,
        id: result.id,
        sessionId: result.sessionId,
        errors: result.errors,
        managementTimeMs: performance.now() - startTime
      };

    } catch (error) {
      this.updateStats(false, performance.now() - startTime);
      return IDManagementUtils.createResult(
        false, id, undefined,
        [error instanceof Error ? error.message : ID_MANAGEMENT_MESSAGES.ID_TRACKING_FAILED],
        startTime
      );
    }
  }

  /**
   * Get management statistics
   */
  getManagementStats() {
    return {
      ...this.stats,
      averageOperationTime: this.stats.successfulOperations > 0 
        ? this.stats.totalOperationTime / this.stats.successfulOperations 
        : 0
    };
  }

  /**
   * Clear all management data
   */
  clearAll(): void {
    this.tracker.clear();
    this.generator.clearUsedIds();
    this.resetStats();
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalIdsGenerated: 0,
      totalIdsTracked: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalOperationTime: 0
    };
  }

  /**
   * Update operation statistics
   */
  private updateStats(success: boolean, operationTime: number): void {
    if (success) {
      this.stats.successfulOperations++;
    } else {
      this.stats.failedOperations++;
    }
    this.stats.totalOperationTime += operationTime;
  }
}

/**
 * Default tool call ID manager instance
 */
export const toolCallIDManager = new ToolCallIDManager();