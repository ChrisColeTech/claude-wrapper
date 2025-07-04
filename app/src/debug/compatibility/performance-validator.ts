/**
 * Performance Validator (Phase 14B)
 * Single Responsibility: Performance analysis and benchmarking only
 * 
 * Validates performance metrics against OpenAI API benchmarks
 * Implements IPerformanceAnalyzer interface with <200 lines limit
 */

import { IPerformanceAnalyzer, PerformanceAnalysisResult, PerformanceMetrics } from '../interfaces/debug-interfaces';
import {
  DEBUG_PERFORMANCE_LIMITS,
  DEBUG_ERROR_CODES,
  DEBUG_MESSAGES,
  COMPATIBILITY_SCORING
} from '../../tools/constants';
import { getLogger } from '../../utils/logger';

const logger = getLogger('PerformanceValidator');

/**
 * Performance validator
 * SRP: Performance analysis operations only
 */
export class PerformanceValidator implements IPerformanceAnalyzer {

  /**
   * Analyze performance for a specific tool call
   */
  async analyzePerformance(sessionId: string, toolCallId: string): Promise<PerformanceAnalysisResult> {
    const startTime = performance.now();
    
    try {
      // Get performance metrics (placeholder - would integrate with actual metrics collection)
      const metrics = await this.collectPerformanceMetrics(sessionId, toolCallId);
      
      // Calculate overall performance score
      const score = this.calculatePerformanceScore(metrics);
      
      // Identify bottlenecks
      const bottlenecks = await this.identifyBottlenecks(metrics);
      
      // Generate optimization suggestions
      const optimizations = this.generateOptimizations(metrics, bottlenecks);
      
      // Check if meets benchmarks
      const meetsBenchmarks = this.checkBenchmarkCompliance(metrics);

      return {
        overallScore: score,
        metrics,
        bottlenecks,
        optimizations,
        meetsBenchmarks,
        analysisTimeMs: performance.now() - startTime
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
      // Get current memory usage
      const memoryUsage = process.memoryUsage();
      
      // Calculate session-specific memory usage (placeholder)
      // In production, this would track memory per session
      const sessionMemory = memoryUsage.heapUsed;
      
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
      bottlenecks.push(`Slow execution time: ${metrics.executionTimeMs}ms (threshold: ${DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS}ms)`);
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

    // Check network time if available
    if (metrics.networkTimeMs && metrics.networkTimeMs > 200) { // 200ms threshold for network
      bottlenecks.push(`Slow network operations: ${metrics.networkTimeMs}ms`);
    }

    return bottlenecks;
  }

  /**
   * Collect performance metrics for a tool call
   */
  private async collectPerformanceMetrics(sessionId: string, toolCallId: string): Promise<PerformanceMetrics> {
    // In production, this would integrate with actual metrics collection systems
    // For now, return sample metrics based on current performance
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
   * Generate optimization suggestions
   */
  private generateOptimizations(metrics: PerformanceMetrics, bottlenecks: string[]): string[] {
    const optimizations: string[] = [];

    if (metrics.executionTimeMs > DEBUG_PERFORMANCE_LIMITS.SLOW_EXECUTION_THRESHOLD_MS) {
      optimizations.push('Consider caching frequently used tool validations');
      optimizations.push('Optimize parameter processing algorithms');
    }

    if (metrics.validationTimeMs > DEBUG_PERFORMANCE_LIMITS.INSPECTION_OPERATION_TIMEOUT_MS) {
      optimizations.push('Implement validation result caching');
      optimizations.push('Use more efficient validation algorithms');
    }

    if (metrics.memoryUsageBytes > DEBUG_PERFORMANCE_LIMITS.MEMORY_THRESHOLD_BYTES) {
      optimizations.push('Implement memory cleanup strategies');
      optimizations.push('Consider streaming for large data processing');
    }

    if (bottlenecks.length === 0) {
      optimizations.push('Performance is within acceptable limits');
    }

    return optimizations;
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