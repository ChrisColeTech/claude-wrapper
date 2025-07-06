/**
 * Phase 16A: Minimal performance monitoring for HTTP server
 * Tool execution performance monitoring removed
 */

export interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  lastRequestTime?: Date;
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetrics = {
    requestCount: 0,
    averageResponseTime: 0
  };

  static getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  static recordRequest(responseTime: number): void {
    this.metrics.requestCount++;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime + responseTime) / 2;
    this.metrics.lastRequestTime = new Date();
  }

  static reset(): void {
    this.metrics = {
      requestCount: 0,
      averageResponseTime: 0
    };
  }

  getAllStats(): PerformanceMetrics {
    return PerformanceMonitor.getMetrics();
  }
}

// Export compatibility utilities
export const PerformanceUtils = {
  getAllStats: () => PerformanceMonitor.getMetrics(),
  recordRequest: (time: number) => PerformanceMonitor.recordRequest(time),
  monitorSync: (operation: string, fn: () => any) => {
    const startTime = Date.now();
    const result = fn();
    const duration = Date.now() - startTime;
    PerformanceMonitor.recordRequest(duration);
    return result;
  }
};

export const performanceMonitor = new PerformanceMonitor();