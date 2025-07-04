/**
 * Tool calling state tracking service
 * Single Responsibility: State tracking and monitoring only
 * 
 * Tracks tool calling patterns and provides analytics:
 * - Tool call frequency and duration tracking
 * - State transition monitoring
 * - Performance metrics collection
 * - Usage pattern analysis
 */

import { ToolCallState, ToolCallStateEntry, ToolCallStateSnapshot } from './state';
import { OpenAIToolCall } from './types';
import { getLogger } from '../utils/logger';

const logger = getLogger('ToolStateTracker');

/**
 * Tool call tracking metrics
 */
export interface ToolCallMetrics {
  sessionId: string;
  totalCalls: number;
  pendingCalls: number;
  completedCalls: number;
  failedCalls: number;
  cancelledCalls: number;
  averageDuration: number;
  successRate: number;
  mostUsedFunction: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Function usage statistics
 */
export interface FunctionUsageStats {
  functionName: string;
  callCount: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
  successRate: number;
  lastUsed: number;
}

/**
 * State transition event
 */
export interface StateTransitionEvent {
  sessionId: string;
  toolCallId: string;
  functionName: string;
  fromState: ToolCallState;
  toState: ToolCallState;
  duration: number;
  timestamp: number;
  success: boolean;
}

/**
 * Tracking period statistics
 */
export interface TrackingPeriodStats {
  periodStart: number;
  periodEnd: number;
  totalSessions: number;
  totalToolCalls: number;
  averageCallsPerSession: number;
  overallSuccessRate: number;
  topFunctions: FunctionUsageStats[];
  performanceMetrics: {
    averageStateTransitionTime: number;
    averageCallDuration: number;
    peakConcurrentCalls: number;
  };
}

/**
 * State tracker interface
 */
export interface IToolStateTracker {
  trackToolCall(sessionId: string, entry: ToolCallStateEntry): Promise<void>;
  trackStateTransition(event: StateTransitionEvent): Promise<void>;
  getSessionMetrics(sessionId: string): Promise<ToolCallMetrics | null>;
  getFunctionStats(functionName: string): Promise<FunctionUsageStats | null>;
  getToolCallInfo(toolCallId: string): Promise<any>;
  getAllFunctionStats(): Promise<FunctionUsageStats[]>;
  getPeriodStats(startTime: number, endTime: number): Promise<TrackingPeriodStats>;
  getActiveCallsCount(): Promise<number>;
  cleanupOldMetrics(maxAgeMs: number): Promise<number>;
}

/**
 * Tool state tracker implementation
 */
export class ToolStateTracker implements IToolStateTracker {
  private sessionMetrics: Map<string, ToolCallMetrics> = new Map();
  private functionStats: Map<string, FunctionUsageStats> = new Map();
  private transitionEvents: StateTransitionEvent[] = [];
  private activeCalls: Set<string> = new Set();

  /**
   * Track new tool call
   */
  async trackToolCall(sessionId: string, entry: ToolCallStateEntry): Promise<void> {
    try {
      // Update session metrics
      await this.updateSessionMetrics(sessionId, entry);
      
      // Update function statistics
      await this.updateFunctionStats(entry);
      
      // Track as active call only if not in terminal state
      if (['pending', 'in_progress'].includes(entry.state)) {
        this.activeCalls.add(entry.id);
      }

      logger.debug('Tool call tracked', {
        sessionId,
        toolCallId: entry.id,
        functionName: entry.toolCall.function?.name,
        state: entry.state
      });
    } catch (error) {
      logger.error('Failed to track tool call', {
        sessionId,
        toolCallId: entry.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Track state transition
   */
  async trackStateTransition(event: StateTransitionEvent): Promise<void> {
    try {
      // Store transition event
      this.transitionEvents.push(event);
      
      // Clean up old events periodically
      if (this.transitionEvents.length > 10000) {
        await this.cleanupOldEvents();
      }

      // Update active calls tracking
      if (['completed', 'failed', 'cancelled'].includes(event.toState)) {
        this.activeCalls.delete(event.toolCallId);
      } else if (event.toState === 'in_progress') {
        this.activeCalls.add(event.toolCallId);
      }

      // Update session metrics with transition
      await this.updateMetricsForTransition(event);

      logger.debug('State transition tracked', {
        sessionId: event.sessionId,
        toolCallId: event.toolCallId,
        transition: `${event.fromState} -> ${event.toState}`,
        duration: event.duration,
        success: event.success
      });
    } catch (error) {
      logger.error('Failed to track state transition', {
        sessionId: event.sessionId,
        toolCallId: event.toolCallId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get session metrics
   */
  async getSessionMetrics(sessionId: string): Promise<ToolCallMetrics | null> {
    return this.sessionMetrics.get(sessionId) || null;
  }

  /**
   * Get function usage statistics
   */
  async getFunctionStats(functionName: string): Promise<FunctionUsageStats | null> {
    return this.functionStats.get(functionName) || null;
  }

  /**
   * Get tool call tracking information
   */
  async getToolCallInfo(toolCallId: string): Promise<any> {
    // Return tracking information for the specific tool call
    return {
      isActive: this.activeCalls.has(toolCallId),
      trackingEnabled: true,
      lastTracked: Date.now()
    };
  }

  /**
   * Get all function statistics
   */
  async getAllFunctionStats(): Promise<FunctionUsageStats[]> {
    return Array.from(this.functionStats.values())
      .sort((a, b) => b.callCount - a.callCount);
  }

  /**
   * Get statistics for time period
   */
  async getPeriodStats(startTime: number, endTime: number): Promise<TrackingPeriodStats> {
    const periodEvents = this.transitionEvents.filter(
      event => event.timestamp >= startTime && event.timestamp <= endTime
    );

    const sessionIds = new Set(periodEvents.map(event => event.sessionId));
    const functionUsage = new Map<string, { calls: number; success: number; durations: number[] }>();

    // Collect function usage data
    for (const event of periodEvents) {
      if (!functionUsage.has(event.functionName)) {
        functionUsage.set(event.functionName, { calls: 0, success: 0, durations: [] });
      }
      
      const usage = functionUsage.get(event.functionName)!;
      usage.calls++;
      if (event.success) usage.success++;
      usage.durations.push(event.duration);
    }

    // Calculate top functions
    const topFunctions: FunctionUsageStats[] = Array.from(functionUsage.entries())
      .map(([functionName, data]) => ({
        functionName,
        callCount: data.calls,
        successCount: data.success,
        failureCount: data.calls - data.success,
        averageDuration: data.durations.reduce((sum, d) => sum + d, 0) / data.durations.length || 0,
        successRate: data.calls > 0 ? data.success / data.calls : 0,
        lastUsed: Math.max(...periodEvents
          .filter(e => e.functionName === functionName)
          .map(e => e.timestamp))
      }))
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, 10);

    // Calculate performance metrics
    const completionEvents = periodEvents.filter(e => ['completed', 'failed', 'cancelled'].includes(e.toState));
    const averageCallDuration = completionEvents.length > 0 
      ? completionEvents.reduce((sum, e) => sum + e.duration, 0) / completionEvents.length 
      : 0;

    const averageStateTransitionTime = periodEvents.length > 0
      ? periodEvents.reduce((sum, e) => sum + e.duration, 0) / periodEvents.length
      : 0;

    // Calculate peak concurrent calls
    const peakConcurrentCalls = this.calculatePeakConcurrentCalls(periodEvents);

    return {
      periodStart: startTime,
      periodEnd: endTime,
      totalSessions: sessionIds.size,
      totalToolCalls: periodEvents.length,
      averageCallsPerSession: sessionIds.size > 0 ? periodEvents.length / sessionIds.size : 0,
      overallSuccessRate: periodEvents.length > 0 
        ? periodEvents.filter(e => e.success).length / periodEvents.length 
        : 0,
      topFunctions,
      performanceMetrics: {
        averageStateTransitionTime,
        averageCallDuration,
        peakConcurrentCalls
      }
    };
  }

  /**
   * Get current active calls count
   */
  async getActiveCallsCount(): Promise<number> {
    return this.activeCalls.size;
  }

  /**
   * Clean up old metrics
   */
  async cleanupOldMetrics(maxAgeMs: number): Promise<number> {
    const cutoffTime = Date.now() - maxAgeMs;
    let cleanedCount = 0;

    try {
      // Clean up old session metrics
      Array.from(this.sessionMetrics.entries()).forEach(([sessionId, metrics]) => {
        if (metrics.updatedAt < cutoffTime) {
          this.sessionMetrics.delete(sessionId);
          cleanedCount++;
        }
      });

      // Clean up old function stats
      Array.from(this.functionStats.entries()).forEach(([functionName, stats]) => {
        if (stats.lastUsed < cutoffTime) {
          this.functionStats.delete(functionName);
          cleanedCount++;
        }
      });

      // Clean up old transition events
      const originalEventCount = this.transitionEvents.length;
      this.transitionEvents = this.transitionEvents.filter(
        event => event.timestamp >= cutoffTime
      );
      cleanedCount += originalEventCount - this.transitionEvents.length;

      logger.info('Old metrics cleaned up', { cleanedCount, cutoffTime });
      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup old metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }

  /**
   * Update session metrics
   */
  private async updateSessionMetrics(sessionId: string, entry: ToolCallStateEntry): Promise<void> {
    const existing = this.sessionMetrics.get(sessionId);
    const now = Date.now();
    const entryTime = entry.updatedAt || entry.createdAt;

    if (existing) {
      existing.totalCalls++;
      existing.updatedAt = now;
      
      // Update state counts based on current state
      switch (entry.state) {
        case 'pending':
        case 'in_progress':
          existing.pendingCalls++;
          break;
        case 'completed':
          existing.completedCalls++;
          break;
        case 'failed':
          existing.failedCalls++;
          break;
        case 'cancelled':
          existing.cancelledCalls++;
          break;
      }

      // Recalculate success rate
      const totalFinished = existing.completedCalls + existing.failedCalls + existing.cancelledCalls;
      existing.successRate = totalFinished > 0 ? existing.completedCalls / totalFinished : 0;
    } else {
      // Create new metrics
      const newMetrics: ToolCallMetrics = {
        sessionId,
        totalCalls: 1,
        pendingCalls: ['pending', 'in_progress'].includes(entry.state) ? 1 : 0,
        completedCalls: entry.state === 'completed' ? 1 : 0,
        failedCalls: entry.state === 'failed' ? 1 : 0,
        cancelledCalls: entry.state === 'cancelled' ? 1 : 0,
        averageDuration: 0,
        successRate: entry.state === 'completed' ? 1.0 : 0,
        mostUsedFunction: entry.toolCall.function?.name || 'unknown',
        createdAt: entryTime,
        updatedAt: entryTime
      };

      this.sessionMetrics.set(sessionId, newMetrics);
    }
  }

  /**
   * Update function statistics
   */
  private async updateFunctionStats(entry: ToolCallStateEntry): Promise<void> {
    const functionName = entry.toolCall.function?.name || 'unknown';
    const existing = this.functionStats.get(functionName);
    const now = Date.now();
    const entryTime = entry.updatedAt || entry.createdAt;

    if (existing) {
      existing.callCount++;
      existing.lastUsed = now;
      
      if (entry.state === 'completed') {
        existing.successCount++;
      } else if (['failed', 'cancelled'].includes(entry.state)) {
        existing.failureCount++;
      }

      // Recalculate success rate
      const totalCompleted = existing.successCount + existing.failureCount;
      existing.successRate = totalCompleted > 0 ? existing.successCount / totalCompleted : 0;
    } else {
      // Create new function stats
      const newStats: FunctionUsageStats = {
        functionName,
        callCount: 1,
        successCount: entry.state === 'completed' ? 1 : 0,
        failureCount: ['failed', 'cancelled'].includes(entry.state) ? 1 : 0,
        averageDuration: 0,
        successRate: entry.state === 'completed' ? 1.0 : 0,
        lastUsed: entryTime
      };

      this.functionStats.set(functionName, newStats);
    }
  }

  /**
   * Update metrics for transition
   */
  private async updateMetricsForTransition(event: StateTransitionEvent): Promise<void> {
    // Update session metrics
    const sessionMetrics = this.sessionMetrics.get(event.sessionId);
    if (sessionMetrics) {
      // Update state counts
      if (event.fromState === 'pending' || event.fromState === 'in_progress') {
        sessionMetrics.pendingCalls = Math.max(0, sessionMetrics.pendingCalls - 1);
      }
      
      if (event.toState === 'completed') {
        sessionMetrics.completedCalls++;
      } else if (event.toState === 'failed') {
        sessionMetrics.failedCalls++;
      } else if (event.toState === 'cancelled') {
        sessionMetrics.cancelledCalls++;
      }

      // Update average duration and success rate if this is a completion
      if (['completed', 'failed', 'cancelled'].includes(event.toState)) {
        const totalCompleted = sessionMetrics.completedCalls + sessionMetrics.failedCalls + sessionMetrics.cancelledCalls;
        const currentTotal = sessionMetrics.averageDuration * (totalCompleted - 1);
        sessionMetrics.averageDuration = (currentTotal + event.duration) / totalCompleted;
        
        // Recalculate success rate
        sessionMetrics.successRate = totalCompleted > 0 ? sessionMetrics.completedCalls / totalCompleted : 0;
      }

      sessionMetrics.updatedAt = Date.now();
    }

    // Update function stats
    const functionStats = this.functionStats.get(event.functionName);
    if (functionStats && ['completed', 'failed', 'cancelled'].includes(event.toState)) {
      // Update counts based on transition outcome
      if (event.toState === 'completed') {
        functionStats.successCount++;
      } else if (['failed', 'cancelled'].includes(event.toState)) {
        functionStats.failureCount++;
      }
      
      const totalCompleted = functionStats.successCount + functionStats.failureCount;
      const currentTotal = functionStats.averageDuration * (totalCompleted - 1);
      functionStats.averageDuration = totalCompleted > 0 
        ? (currentTotal + event.duration) / totalCompleted 
        : event.duration;
        
      // Recalculate success rate
      functionStats.successRate = totalCompleted > 0 ? functionStats.successCount / totalCompleted : 0;
      functionStats.lastUsed = Date.now();
    }
  }

  /**
   * Calculate peak concurrent calls in period
   */
  private calculatePeakConcurrentCalls(events: StateTransitionEvent[]): number {
    const timePoints: Array<{ time: number; delta: number }> = [];

    // Create time points for call starts and ends
    for (const event of events) {
      if (event.fromState === 'pending' && event.toState === 'in_progress') {
        timePoints.push({ time: event.timestamp, delta: 1 });
      } else if (['completed', 'failed', 'cancelled'].includes(event.toState)) {
        timePoints.push({ time: event.timestamp, delta: -1 });
      }
    }

    // Sort by time
    timePoints.sort((a, b) => a.time - b.time);

    // Calculate peak
    let current = 0;
    let peak = 0;
    for (const point of timePoints) {
      current += point.delta;
      peak = Math.max(peak, current);
    }

    return peak;
  }

  /**
   * Clean up old transition events
   */
  private async cleanupOldEvents(): Promise<void> {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    this.transitionEvents = this.transitionEvents.filter(
      event => event.timestamp >= cutoffTime
    );
  }
}

/**
 * State tracking utilities
 */
export const ToolStateTrackingUtils = {
  /**
   * Calculate success rate
   */
  calculateSuccessRate: (successCount: number, totalCount: number): number => {
    return totalCount > 0 ? successCount / totalCount : 0;
  },

  /**
   * Format duration for display
   */
  formatDuration: (durationMs: number): string => {
    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    return `${(durationMs / 60000).toFixed(1)}m`;
  },

  /**
   * Get performance grade
   */
  getPerformanceGrade: (averageDuration: number): 'A' | 'B' | 'C' | 'D' | 'F' => {
    if (averageDuration < 1000) return 'A';
    if (averageDuration < 3000) return 'B';
    if (averageDuration < 5000) return 'C';
    if (averageDuration < 10000) return 'D';
    return 'F';
  },

  /**
   * Check if function is trending
   */
  isTrendingFunction: (stats: FunctionUsageStats, periodMs: number = 3600000): boolean => {
    const recentThreshold = Date.now() - periodMs;
    return stats.lastUsed >= recentThreshold && stats.callCount >= 5;
  }
};

export const toolStateTracker = new ToolStateTracker();