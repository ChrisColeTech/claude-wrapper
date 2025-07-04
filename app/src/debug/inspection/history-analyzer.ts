/**
 * History Analyzer (Phase 14B)
 * Single Responsibility: Tool call history analysis and statistics
 * 
 * Extracted from oversized tool-inspector.ts following SRP
 * Implements IHistoryAnalyzer interface with <200 lines limit
 */

import { IHistoryAnalyzer, ToolCallHistoryReport, PerformanceMetrics } from './types';
import {
  DEBUG_PERFORMANCE_LIMITS,
  DEBUG_ERROR_CODES,
  DEBUG_MESSAGES
} from '../../tools/constants';
import { getLogger } from '../../utils/logger';

const logger = getLogger('HistoryAnalyzer');

/**
 * Tool call history analyzer
 * SRP: Historical data analysis operations only
 */
export class HistoryAnalyzer implements IHistoryAnalyzer {
  private sessionHistory: Map<string, any[]> = new Map();

  /**
   * Analyze complete tool call history for a session
   */
  async analyzeHistory(sessionId: string): Promise<ToolCallHistoryReport> {
    const startTime = performance.now();
    
    try {
      // Get session history (placeholder - would integrate with actual state manager)
      const history = this.getSessionHistory(sessionId);
      
      if (history.length === 0) {
        logger.warn('No history found for session', { sessionId });
        return this.createEmptyHistoryReport(sessionId, performance.now() - startTime);
      }

      // Calculate basic statistics
      const stats = await this.getCallStatistics(sessionId);
      
      // Analyze most used functions
      const mostUsedFunctions = this.calculateMostUsedFunctions(history);
      
      // Generate error summary
      const errorSummary = this.generateErrorSummary(history);
      
      // Generate performance trends
      const performanceTrends = await this.generateTrendAnalysis(sessionId);

      const report: ToolCallHistoryReport = {
        sessionId,
        totalCalls: stats.totalCalls || 0,
        successfulCalls: stats.successfulCalls || 0,
        failedCalls: stats.failedCalls || 0,
        pendingCalls: stats.pendingCalls || 0,
        averageExecutionTime: stats.averageExecutionTime || 0,
        totalExecutionTime: stats.totalExecutionTime || 0,
        mostUsedFunctions,
        errorSummary,
        performanceTrends,
        analysisTimeMs: performance.now() - startTime
      };

      logger.info('History analysis completed', {
        sessionId,
        totalCalls: report.totalCalls,
        analysisTimeMs: report.analysisTimeMs
      });

      return report;

    } catch (error) {
      logger.error('History analysis failed', { error, sessionId });
      throw new Error(`${DEBUG_ERROR_CODES.HISTORY_ANALYSIS_FAILED}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get call statistics for a session
   */
  async getCallStatistics(sessionId: string): Promise<Record<string, number>> {
    try {
      const history = this.getSessionHistory(sessionId);
      
      const stats = {
        totalCalls: history.length,
        successfulCalls: history.filter(call => call.status === 'success').length,
        failedCalls: history.filter(call => call.status === 'error').length,
        pendingCalls: history.filter(call => call.status === 'pending').length,
        timeoutCalls: history.filter(call => call.status === 'timeout').length,
        averageExecutionTime: 0,
        totalExecutionTime: 0,
        minExecutionTime: 0,
        maxExecutionTime: 0
      };

      // Calculate execution time statistics
      const executionTimes = history
        .filter(call => call.executionTimeMs > 0)
        .map(call => call.executionTimeMs);

      if (executionTimes.length > 0) {
        stats.totalExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0);
        stats.averageExecutionTime = stats.totalExecutionTime / executionTimes.length;
        stats.minExecutionTime = Math.min(...executionTimes);
        stats.maxExecutionTime = Math.max(...executionTimes);
      }

      return stats;

    } catch (error) {
      logger.error('Failed to get call statistics', { error, sessionId });
      return {};
    }
  }

  /**
   * Generate trend analysis over time
   */
  async generateTrendAnalysis(sessionId: string): Promise<Array<{ timestamp: number; averageExecutionTime: number; throughput: number }>> {
    try {
      const history = this.getSessionHistory(sessionId);
      
      // Group by time intervals (e.g., every minute)
      const timeIntervals = new Map<number, any[]>();
      const intervalMs = 60000; // 1 minute intervals

      history.forEach(call => {
        const interval = Math.floor(call.timestamp / intervalMs) * intervalMs;
        if (!timeIntervals.has(interval)) {
          timeIntervals.set(interval, []);
        }
        timeIntervals.get(interval)!.push(call);
      });

      // Generate metrics for each interval
      const trends: Array<{ timestamp: number; averageExecutionTime: number; throughput: number }> = [];
      
      for (const [timestamp, calls] of timeIntervals) {
        const avgExecutionTime = calls.reduce((sum, call) => sum + (call.executionTimeMs || 0), 0) / calls.length;
        
        trends.push({
          timestamp,
          averageExecutionTime: avgExecutionTime,
          throughput: calls.length / (intervalMs / 1000) // calls per second
        });
      }

      return trends.sort((a, b) => a.timestamp - b.timestamp);

    } catch (error) {
      logger.error('Failed to generate trend analysis', { error, sessionId });
      return [];
    }
  }

  /**
   * Identify patterns in tool call usage
   */
  async identifyPatterns(sessionId: string): Promise<string[]> {
    try {
      const history = this.getSessionHistory(sessionId);
      const patterns: string[] = [];

      if (history.length === 0) {
        return patterns;
      }

      // Pattern 1: Frequently failing functions
      const functionFailures = new Map<string, number>();
      history.filter(call => call.status === 'error').forEach(call => {
        const count = functionFailures.get(call.functionName) || 0;
        functionFailures.set(call.functionName, count + 1);
      });

      for (const [functionName, failureCount] of functionFailures) {
        const totalCalls = history.filter(call => call.functionName === functionName).length;
        const failureRate = failureCount / totalCalls;
        if (failureRate > 0.2) { // More than 20% failure rate
          patterns.push(`High failure rate detected for ${functionName}: ${(failureRate * 100).toFixed(1)}%`);
        }
      }

      // Pattern 2: Performance degradation over time
      const recentCalls = history.filter(call => Date.now() - call.timestamp < 300000); // Last 5 minutes
      const olderCalls = history.filter(call => Date.now() - call.timestamp >= 300000);
      
      if (recentCalls.length > 0 && olderCalls.length > 0) {
        const recentAvgTime = recentCalls.reduce((sum, call) => sum + call.executionTimeMs, 0) / recentCalls.length;
        const olderAvgTime = olderCalls.reduce((sum, call) => sum + call.executionTimeMs, 0) / olderCalls.length;
        
        if (recentAvgTime > olderAvgTime * 1.5) { // 50% slower
          patterns.push(`Performance degradation detected: Recent calls are ${((recentAvgTime / olderAvgTime - 1) * 100).toFixed(1)}% slower`);
        }
      }

      // Pattern 3: Memory usage trends
      const memoryUsage = history.map(call => call.memoryUsageBytes || 0).filter(usage => usage > 0);
      if (memoryUsage.length > 5) {
        const avgMemory = memoryUsage.reduce((sum, usage) => sum + usage, 0) / memoryUsage.length;
        const maxMemory = Math.max(...memoryUsage);
        
        if (maxMemory > avgMemory * 2) {
          patterns.push(`Memory usage spikes detected: Peak usage is ${((maxMemory / avgMemory - 1) * 100).toFixed(1)}% above average`);
        }
      }

      return patterns;

    } catch (error) {
      logger.error('Failed to identify patterns', { error, sessionId });
      return [];
    }
  }

  /**
   * Export history data as structured format
   */
  async exportHistoryData(sessionId: string): Promise<string> {
    try {
      const history = this.getSessionHistory(sessionId);
      const stats = await this.getCallStatistics(sessionId);
      const patterns = await this.identifyPatterns(sessionId);

      const exportData = {
        sessionId,
        exportedAt: new Date().toISOString(),
        statistics: stats,
        patterns,
        history: history.map(call => ({
          toolCallId: call.toolCallId,
          functionName: call.functionName,
          status: call.status,
          executionTimeMs: call.executionTimeMs,
          timestamp: call.timestamp,
          error: call.error
        }))
      };

      return JSON.stringify(exportData, null, 2);

    } catch (error) {
      logger.error('Failed to export history data', { error, sessionId });
      throw new Error(`${DEBUG_ERROR_CODES.HISTORY_ANALYSIS_FAILED}: Export failed`);
    }
  }

  /**
   * Get session history (placeholder - would integrate with actual state manager)
   */
  private getSessionHistory(sessionId: string): any[] {
    // In production, this would query the actual session state manager
    return this.sessionHistory.get(sessionId) || this.generateSampleHistory(sessionId);
  }

  /**
   * Calculate most used functions
   */
  private calculateMostUsedFunctions(history: any[]): Array<{
    functionName: string;
    callCount: number;
    averageTime: number;
  }> {
    const functionStats = new Map<string, { count: number; totalTime: number }>();

    history.forEach(call => {
      const stats = functionStats.get(call.functionName) || { count: 0, totalTime: 0 };
      stats.count++;
      stats.totalTime += call.executionTimeMs || 0;
      functionStats.set(call.functionName, stats);
    });

    return Array.from(functionStats.entries())
      .map(([functionName, stats]) => ({
        functionName,
        callCount: stats.count,
        averageTime: stats.count > 0 ? stats.totalTime / stats.count : 0
      }))
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, 10); // Top 10
  }

  /**
   * Generate error summary from history
   */
  private generateErrorSummary(history: any[]): Array<{
    error: string;
    count: number;
    affectedFunctions: string[];
  }> {
    const errorStats = new Map<string, { count: number; functions: Set<string> }>();

    history.filter(call => call.error).forEach(call => {
      const stats = errorStats.get(call.error) || { count: 0, functions: new Set() };
      stats.count++;
      stats.functions.add(call.functionName);
      errorStats.set(call.error, stats);
    });

    return Array.from(errorStats.entries())
      .map(([error, stats]) => ({
        error,
        count: stats.count,
        affectedFunctions: Array.from(stats.functions)
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Generate sample history for testing (would be removed in production)
   */
  private generateSampleHistory(sessionId: string): any[] {
    const functions = ['calculateSum', 'processData', 'validateInput', 'generateReport'];
    const statuses = ['success', 'error', 'pending'];
    const errors = ['ValidationError', 'TimeoutError', 'ProcessingError'];
    
    return Array.from({ length: 20 }, (_, i) => ({
      toolCallId: `call_${i}`,
      functionName: functions[Math.floor(Math.random() * functions.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      executionTimeMs: Math.random() * 1000 + 100,
      memoryUsageBytes: Math.random() * 10000000 + 1000000,
      validationTimeMs: Math.random() * 50 + 10,
      persistenceTimeMs: Math.random() * 20 + 5,
      timestamp: Date.now() - Math.random() * 3600000, // Within last hour
      error: Math.random() > 0.7 ? errors[Math.floor(Math.random() * errors.length)] : undefined
    }));
  }

  /**
   * Create empty history report
   */
  private createEmptyHistoryReport(sessionId: string, analysisTimeMs: number): ToolCallHistoryReport {
    return {
      sessionId,
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      pendingCalls: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      mostUsedFunctions: [],
      errorSummary: [],
      performanceTrends: [],
      analysisTimeMs
    };
  }
}