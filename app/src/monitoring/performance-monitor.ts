/**
 * Performance Monitor - Production-ready performance metrics collection
 * SOLID compliance: SRP, OCP, LSP, ISP, DIP
 * DRY compliance: Common patterns extracted to utils
 * Performance requirements: <5ms monitoring overhead
 */

import { getLogger } from '../utils/logger';
import { PRODUCTION_MONITORING, PRODUCTION_RELIABILITY } from '../tools/constants/production';

const logger = getLogger('PerformanceMonitor');

/**
 * Performance metric data structure
 */
export interface PerformanceMetric {
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Performance statistics interface
 */
export interface PerformanceStats {
  count: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  errorRate: number;
  p95Duration: number;
  p99Duration: number;
}

/**
 * Performance monitor interface (ISP compliance)
 */
export interface IPerformanceMonitor {
  startTimer(operation: string): IPerformanceTimer;
  recordMetric(operation: string, metric: PerformanceMetric): void;
  getStats(operation: string): PerformanceStats | null;
  getAllStats(): Map<string, PerformanceStats>;
  clearMetrics(operation?: string): void;
}

/**
 * Performance timer interface
 */
export interface IPerformanceTimer {
  stop(success?: boolean, error?: string, metadata?: Record<string, any>): void;
  duration(): number;
}

/**
 * Performance timer implementation
 */
export class PerformanceTimer implements IPerformanceTimer {
  private startTime: number;
  private operation: string;
  private monitor: IPerformanceMonitor;

  constructor(operation: string, monitor: IPerformanceMonitor) {
    this.startTime = performance.now();
    this.operation = operation;
    this.monitor = monitor;
  }

  /**
   * Stop the timer and record the metric
   */
  stop(success: boolean = true, error?: string, metadata?: Record<string, any>): void {
    const duration = this.duration();
    
    // Performance requirement: Always record metrics
    // The original condition was backwards - it prevented recording fast operations
    this.monitor.recordMetric(this.operation, {
      timestamp: Date.now(),
      duration,
      success,
      error,
      metadata
    });
  }

  /**
   * Get current duration
   */
  duration(): number {
    return performance.now() - this.startTime;
  }
}

/**
 * Performance Monitor implementation
 * SRP: Single responsibility for performance monitoring
 * OCP: Open for extension via interface
 * LSP: Substitutable via interface
 * ISP: Interface segregation with focused interfaces
 * DIP: Depends on abstractions
 */
export class PerformanceMonitor implements IPerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private readonly retentionMs: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(retentionMs: number = PRODUCTION_MONITORING.MEMORY_LIMIT_MB * 1000 * 60) {
    this.retentionMs = retentionMs;
    this.startCleanupTask();
  }

  /**
   * Start a performance timer for an operation
   */
  startTimer(operation: string): IPerformanceTimer {
    return new PerformanceTimer(operation, this);
  }

  /**
   * Record a performance metric
   */
  recordMetric(operation: string, metric: PerformanceMetric): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    
    const operationMetrics = this.metrics.get(operation)!;
    operationMetrics.push(metric);
    
    // Prevent memory growth by limiting metrics per operation
    if (operationMetrics.length > 1000) {
      operationMetrics.shift();
    }
  }

  /**
   * Get performance statistics for an operation
   */
  getStats(operation: string): PerformanceStats | null {
    const operationMetrics = this.metrics.get(operation);
    if (!operationMetrics || operationMetrics.length === 0) {
      return null;
    }

    return this.calculateStats(operationMetrics);
  }

  /**
   * Get all performance statistics
   */
  getAllStats(): Map<string, PerformanceStats> {
    const allStats = new Map<string, PerformanceStats>();
    
    for (const [operation, operationMetrics] of this.metrics) {
      if (operationMetrics.length > 0) {
        allStats.set(operation, this.calculateStats(operationMetrics));
      }
    }
    
    return allStats;
  }

  /**
   * Clear metrics for an operation or all operations
   */
  clearMetrics(operation?: string): void {
    if (operation) {
      this.metrics.delete(operation);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Calculate performance statistics
   */
  private calculateStats(operationMetrics: PerformanceMetric[]): PerformanceStats {
    const durations = operationMetrics.map(m => m.duration).sort((a, b) => a - b);
    const successCount = operationMetrics.filter(m => m.success).length;
    
    return {
      count: operationMetrics.length,
      avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      successRate: successCount / operationMetrics.length,
      errorRate: 1 - (successCount / operationMetrics.length),
      p95Duration: this.getPercentile(durations, 0.95),
      p99Duration: this.getPercentile(durations, 0.99)
    };
  }

  /**
   * Get percentile from sorted array
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    const index = Math.floor(sortedArray.length * percentile);
    return sortedArray[Math.min(index, sortedArray.length - 1)];
  }

  /**
   * Start cleanup task to remove old metrics
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 60000); // Clean every minute
  }

  /**
   * Clean up old metrics based on retention policy
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - this.retentionMs;
    
    for (const [operation, operationMetrics] of this.metrics) {
      const filteredMetrics = operationMetrics.filter(m => m.timestamp > cutoffTime);
      
      if (filteredMetrics.length === 0) {
        this.metrics.delete(operation);
      } else {
        this.metrics.set(operation, filteredMetrics);
      }
    }
  }

  /**
   * Shutdown the performance monitor
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * Global performance monitor instance
 */
export const performanceMonitor = new PerformanceMonitor();

/**
 * Performance monitoring utilities
 */
export const PerformanceUtils = {
  /**
   * Monitor async function execution
   */
  async monitorAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const timer = performanceMonitor.startTimer(operation);
    
    try {
      const result = await fn();
      timer.stop(true, undefined, metadata);
      return result;
    } catch (error) {
      timer.stop(false, error instanceof Error ? error.message : 'Unknown error', metadata);
      throw error;
    }
  },

  /**
   * Monitor synchronous function execution
   */
  monitorSync<T>(
    operation: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    const timer = performanceMonitor.startTimer(operation);
    
    try {
      const result = fn();
      timer.stop(true, undefined, metadata);
      return result;
    } catch (error) {
      timer.stop(false, error instanceof Error ? error.message : 'Unknown error', metadata);
      throw error;
    }
  },

  /**
   * Check if performance is within acceptable limits
   */
  isPerformanceHealthy(stats: PerformanceStats): boolean {
    return stats.p95Duration < PRODUCTION_MONITORING.RESPONSE_TIME_THRESHOLD_MS &&
           stats.errorRate < PRODUCTION_MONITORING.ERROR_RATE_THRESHOLD;
  }
};