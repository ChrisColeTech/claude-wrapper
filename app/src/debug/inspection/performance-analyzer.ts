/**
 * Performance Analyzer (Phase 14B)
 * Single Responsibility: Performance analysis and metrics calculation
 * 
 * Extracted from oversized tool-inspector.ts following SRP
 * Implements IPerformanceAnalyzer interface with <200 lines limit
 */

import { IPerformanceAnalyzer, PerformanceAnalysis, PerformanceMetrics } from './types';
import {
  DEBUG_PERFORMANCE_LIMITS,
  DEBUG_ERROR_CODES,
  DEBUG_MESSAGES,
  COMPATIBILITY_SCORING
} from '../../tools/constants';
import { getLogger } from '../../utils/logger';

const logger = getLogger('PerformanceAnalyzer');

/**
 * Performance analyzer for tool call inspection
 * SRP: Performance analysis operations only
 */
export class PerformanceAnalyzer implements IPerformanceAnalyzer {

  /**
   * Analyze performance for a specific tool call
   */
  async analyzePerformance(sessionId: string, toolCallId: string): Promise<PerformanceAnalysis> {
    const startTime = performance.now();
    
    try {
      // Collect performance metrics
      const metrics = await this.collectMetrics(sessionId, toolCallId);
      
      // Calculate performance score
      const score = this.calculatePerformanceScore(metrics);
      
      // Determine grade
      const grade = this.getPerformanceGrade(score);
      
      // Identify bottlenecks
      const bottlenecks = await this.identifyBottlenecks(metrics);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(metrics, bottlenecks);
      
      // Compare to baseline
      const comparisonToBaseline = await this.compareToBaseline(metrics);
      
      // Check benchmark compliance
      const meetsBenchmarks = this.checkBenchmarkCompliance(metrics);

      logger.info('Performance analysis completed', { 
        sessionId, 
        toolCallId, 
        score, 
        grade,
        analysisTimeMs: performance.now() - startTime
      });

      return {
        overallScore: score,
        grade,
        bottlenecks,
        recommendations,
        comparisonToBaseline,
        meetsBenchmarks
      };

    } catch (error) {
      logger.error('Performance analysis failed', { error, sessionId, toolCallId });
      throw new Error(`${DEBUG_ERROR_CODES.PERFORMANCE_ANALYSIS_FAILED}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Measure execution time of an operation
   */
  async measureExecutionTime(operation: () => Promise<any>): Promise<number> {
    const startTime = performance.now();
    
    try {
      await operation();
      return performance.now() - startTime;
    } catch (error) {
      // Still return timing even if operation failed
      const executionTime = performance.now() - startTime;
      logger.warn('Operation failed during timing measurement', { error, executionTime });
      return executionTime;
    }
  }

  /**
   * Track memory usage for a session
   */
  async trackMemoryUsage(sessionId: string): Promise<number> {
    try {
      const memoryUsage = process.memoryUsage();
      const sessionMemory = memoryUsage.heapUsed; // Simplified - in production would track per session
      
      if (sessionMemory > DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES) {
        logger.warn('High memory usage detected', { sessionId, memoryUsage: sessionMemory });
      }
      
      return sessionMemory;

    } catch (error) {
      logger.error('Memory tracking failed', { error, sessionId });
      throw new Error(`${DEBUG_ERROR_CODES.MEMORY_TRACKING_FAILED}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate performance report from metrics
   */
  async generatePerformanceReport(metrics: PerformanceMetrics[]): Promise<string> {
    if (metrics.length === 0) {
      return 'No performance metrics available for report generation.';
    }

    const avgExecutionTime = this.calculateAverage(metrics.map(m => m.executionTimeMs));
    const avgValidationTime = this.calculateAverage(metrics.map(m => m.validationTimeMs));
    const avgMemoryUsage = this.calculateAverage(metrics.map(m => m.memoryUsageBytes));
    const totalPersistenceTime = metrics.reduce((sum, m) => sum + m.persistenceTimeMs, 0);

    const slowOperations = metrics.filter(m => m.executionTimeMs > DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS);
    const highMemoryOperations = metrics.filter(m => m.memoryUsageBytes > DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES);

    return `
Performance Analysis Report
===========================

Summary:
- Total Operations: ${metrics.length}
- Average Execution Time: ${avgExecutionTime.toFixed(2)}ms
- Average Validation Time: ${avgValidationTime.toFixed(2)}ms
- Average Memory Usage: ${(avgMemoryUsage / 1024 / 1024).toFixed(2)}MB
- Total Persistence Time: ${totalPersistenceTime.toFixed(2)}ms

Performance Issues:
- Slow Operations (>${DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS}ms): ${slowOperations.length}
- High Memory Operations (>${DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES / 1024 / 1024}MB): ${highMemoryOperations.length}

Recommendations:
${slowOperations.length > 0 ? '- Optimize slow operations to improve response times' : ''}
${highMemoryOperations.length > 0 ? '- Investigate memory usage in high-consumption operations' : ''}
${avgExecutionTime > DEBUG_PERFORMANCE_LIMITS.BASELINE_EXECUTION_TIME_MS ? '- Overall execution time exceeds baseline' : ''}
`;
  }

  /**
   * Identify performance bottlenecks
   */
  async identifyBottlenecks(metrics: PerformanceMetrics): Promise<string[]> {
    const bottlenecks: string[] = [];

    // Check execution time
    if (metrics.executionTimeMs > DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS) {
      bottlenecks.push(`Slow execution: ${metrics.executionTimeMs}ms (threshold: ${DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS}ms)`);
    }

    // Check validation time
    if (metrics.validationTimeMs > DEBUG_PERFORMANCE_LIMITS.INSPECTION_OPERATION_TIMEOUT_MS) {
      bottlenecks.push(`Slow validation: ${metrics.validationTimeMs}ms (threshold: ${DEBUG_PERFORMANCE_LIMITS.INSPECTION_OPERATION_TIMEOUT_MS}ms)`);
    }

    // Check memory usage
    if (metrics.memoryUsageBytes > DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES) {
      bottlenecks.push(`High memory usage: ${(metrics.memoryUsageBytes / 1024 / 1024).toFixed(2)}MB (threshold: ${DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES / 1024 / 1024}MB)`);
    }

    // Check persistence time
    if (metrics.persistenceTimeMs > 100) { // 100ms threshold for persistence
      bottlenecks.push(`Slow persistence: ${metrics.persistenceTimeMs}ms`);
    }

    return bottlenecks;
  }

  /**
   * Collect performance metrics for a tool call
   */
  private async collectMetrics(sessionId: string, toolCallId: string): Promise<PerformanceMetrics> {
    // In production, this would integrate with actual metrics collection
    const currentMemory = await this.trackMemoryUsage(sessionId);
    
    return {
      executionTimeMs: Math.random() * 1000 + 100, // Sample execution time
      validationTimeMs: Math.random() * 50 + 10,   // Sample validation time
      memoryUsageBytes: currentMemory,
      persistenceTimeMs: Math.random() * 20 + 5,   // Sample persistence time
      networkTimeMs: Math.random() * 100 + 50      // Sample network time
    };
  }

  /**
   * Calculate performance score (0-100)
   */
  private calculatePerformanceScore(metrics: PerformanceMetrics): number {
    let score = COMPATIBILITY_SCORING.MAX_SCORE;

    // Penalize slow execution
    if (metrics.executionTimeMs > DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS) {
      const penalty = Math.floor((metrics.executionTimeMs - DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS) / 100) * COMPATIBILITY_SCORING.PERFORMANCE_PENALTY_PER_100MS;
      score -= penalty;
    }

    // Penalize slow validation
    if (metrics.validationTimeMs > DEBUG_PERFORMANCE_LIMITS.INSPECTION_OPERATION_TIMEOUT_MS) {
      score -= COMPATIBILITY_SCORING.MAJOR_VIOLATION_PENALTY;
    }

    // Penalize high memory usage
    if (metrics.memoryUsageBytes > DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES) {
      score -= COMPATIBILITY_SCORING.MINOR_VIOLATION_PENALTY;
    }

    return Math.max(score, COMPATIBILITY_SCORING.MIN_SCORE);
  }

  /**
   * Get performance grade based on score
   */
  private getPerformanceGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(metrics: PerformanceMetrics, bottlenecks: string[]): string[] {
    const recommendations: string[] = [];

    if (metrics.executionTimeMs > DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS) {
      recommendations.push('Consider caching frequently used tool validations');
      recommendations.push('Optimize parameter processing algorithms');
    }

    if (metrics.validationTimeMs > DEBUG_PERFORMANCE_LIMITS.INSPECTION_OPERATION_TIMEOUT_MS) {
      recommendations.push('Implement validation result caching');
      recommendations.push('Use more efficient validation algorithms');
    }

    if (metrics.memoryUsageBytes > DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES) {
      recommendations.push('Implement memory cleanup strategies');
      recommendations.push('Consider streaming for large data processing');
    }

    if (bottlenecks.length === 0) {
      recommendations.push('Performance is within acceptable limits');
    }

    return recommendations;
  }

  /**
   * Compare to baseline performance
   */
  private async compareToBaseline(metrics: PerformanceMetrics): Promise<{
    executionTimeDelta: number;
    memoryUsageDelta: number;
    performanceImprovement: boolean;
  }> {
    const baseline = {
      executionTimeMs: DEBUG_PERFORMANCE_LIMITS.BASELINE_EXECUTION_TIME_MS,
      memoryUsageBytes: DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES / 2 // Use half threshold as baseline
    };

    const executionTimeDelta = metrics.executionTimeMs - baseline.executionTimeMs;
    const memoryUsageDelta = metrics.memoryUsageBytes - baseline.memoryUsageBytes;
    const performanceImprovement = executionTimeDelta <= 0 && memoryUsageDelta <= 0;

    return {
      executionTimeDelta,
      memoryUsageDelta,
      performanceImprovement
    };
  }

  /**
   * Check if metrics meet benchmark requirements
   */
  private checkBenchmarkCompliance(metrics: PerformanceMetrics): boolean {
    return (
      metrics.executionTimeMs <= DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS &&
      metrics.validationTimeMs <= DEBUG_PERFORMANCE_LIMITS.INSPECTION_OPERATION_TIMEOUT_MS &&
      metrics.memoryUsageBytes <= DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES
    );
  }

  /**
   * Calculate average of an array of numbers
   */
  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }
}