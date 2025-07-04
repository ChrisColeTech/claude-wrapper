/**
 * Production Monitoring Unit Tests - Phase 15A
 * Comprehensive tests for monitoring accuracy and performance
 * 
 * Tests cover:
 * - Metrics collection accuracy
 * - Health check completeness
 * - Alert system reliability
 * - Performance monitoring precision
 * - Event emission correctness
 */

import winston from 'winston';
import { ProductionMonitoring, IMonitoring } from '../../../src/production/monitoring';
import { PRODUCTION_MONITORING, PRODUCTION_LIMITS } from '../../../src/tools/constants';

describe('ProductionMonitoring', () => {
  let monitoring: IMonitoring;
  let mockLogger: winston.Logger;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    // Create fresh monitoring instance
    monitoring = new ProductionMonitoring(mockLogger, {
      metricsRetentionMs: 60000, // 1 minute for testing
      healthCheckIntervalMs: 1000 // 1 second for testing
    });
  });

  afterEach(() => {
    // Cleanup
    if (monitoring && typeof (monitoring as any).destroy === 'function') {
      (monitoring as any).destroy();
    }
  });

  describe('Tool Operation Metrics', () => {
    it('should record tool operations accurately', () => {
      const startTime = Date.now();
      
      monitoring.recordToolOperation('Read', 150, true);
      monitoring.recordToolOperation('Write', 200, false, 'Permission denied');
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Tool operation recorded',
        expect.objectContaining({
          tool: 'Read',
          duration: 150,
          success: true
        })
      );
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Tool operation recorded',
        expect.objectContaining({
          tool: 'Write',
          duration: 200,
          success: false,
          error: 'Permission denied'
        })
      );
    });

    it('should emit tool operation events', (done) => {
      (monitoring as any).on('toolOperation', (metric: any) => {
        expect(metric.toolName).toBe('Bash');
        expect(metric.duration).toBe(300);
        expect(metric.success).toBe(true);
        expect(metric.timestamp).toBeCloseTo(Date.now(), -2);
        done();
      });

      monitoring.recordToolOperation('Bash', 300, true);
    });

    it('should calculate success rates correctly', () => {
      // Record mix of successful and failed operations
      monitoring.recordToolOperation('Read', 100, true);
      monitoring.recordToolOperation('Read', 120, false, 'Error');
      monitoring.recordToolOperation('Write', 80, true);
      monitoring.recordToolOperation('Write', 90, true);

      const summary = monitoring.getMetricsSummary();
      
      expect(summary.tools.totalCalls).toBe(4);
      expect(summary.tools.successRate).toBe(0.75); // 3 out of 4 successful
      expect(summary.tools.callsByTool.Read).toBe(2);
      expect(summary.tools.callsByTool.Write).toBe(2);
      expect(summary.tools.errorsByTool.Read).toBe(1);
    });

    it('should calculate average latency correctly', () => {
      monitoring.recordToolOperation('Read', 100, true);
      monitoring.recordToolOperation('Read', 200, true);
      monitoring.recordToolOperation('Read', 300, true);

      const summary = monitoring.getMetricsSummary();
      
      expect(summary.tools.averageLatency).toBe(200); // (100+200+300)/3
    });

    it('should track errors by tool correctly', () => {
      monitoring.recordToolOperation('Read', 100, false, 'File not found');
      monitoring.recordToolOperation('Read', 150, false, 'Permission denied');
      monitoring.recordToolOperation('Write', 120, false, 'Disk full');
      monitoring.recordToolOperation('Write', 80, true);

      const summary = monitoring.getMetricsSummary();
      
      expect(summary.tools.errorsByTool.Read).toBe(2);
      expect(summary.tools.errorsByTool.Write).toBe(1);
    });
  });

  describe('Performance Metrics', () => {
    it('should record performance metrics accurately', () => {
      monitoring.recordPerformanceMetric('api_request', 250);
      monitoring.recordPerformanceMetric('database_query', 80);

      // Should emit performance metric events
      expect(mockLogger.info).toHaveBeenCalledTimes(2);
    });

    it('should emit performance metric events', (done) => {
      (monitoring as any).on('performanceMetric', (metric: any) => {
        expect(metric.operation).toBe('api_request');
        expect(metric.duration).toBe(150);
        expect(metric.timestamp).toBeCloseTo(Date.now(), -2);
        done();
      });

      monitoring.recordPerformanceMetric('api_request', 150);
    });

    it('should calculate percentile response times correctly', () => {
      // Record various response times
      const durations = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      durations.forEach(duration => {
        monitoring.recordPerformanceMetric('api_request', duration);
      });

      const summary = monitoring.getMetricsSummary();
      
      expect(summary.performance.averageResponseTime).toBe(550);
      expect(summary.performance.p95ResponseTime).toBeGreaterThanOrEqual(900);
      expect(summary.performance.p99ResponseTime).toBeGreaterThanOrEqual(950);
    });

    it('should calculate requests per second', () => {
      // Record multiple operations
      for (let i = 0; i < 10; i++) {
        monitoring.recordPerformanceMetric('api_request', 100);
      }

      const summary = monitoring.getMetricsSummary();
      
      expect(summary.performance.requestsPerSecond).toBeGreaterThan(0);
    });
  });

  describe('Health Status', () => {
    it('should provide comprehensive health status', () => {
      const healthStatus = monitoring.getHealthStatus();
      
      expect(healthStatus).toHaveProperty('status');
      expect(healthStatus).toHaveProperty('timestamp');
      expect(healthStatus).toHaveProperty('uptime');
      expect(healthStatus).toHaveProperty('components');
      expect(healthStatus).toHaveProperty('overall');
      
      expect(['healthy', 'degraded', 'unhealthy']).toContain(healthStatus.status);
      expect(Array.isArray(healthStatus.components)).toBe(true);
    });

    it('should check component health accurately', () => {
      // Record some failing operations to trigger health issues
      for (let i = 0; i < 10; i++) {
        monitoring.recordToolOperation('Read', 100, false, 'Error');
      }

      const healthStatus = monitoring.getHealthStatus();
      
      const toolComponent = healthStatus.components.find(c => c.name === 'tool_operations');
      expect(toolComponent).toBeDefined();
      expect(['degraded', 'unhealthy']).toContain(toolComponent!.status);
    });

    it('should detect memory issues', () => {
      const healthStatus = monitoring.getHealthStatus();
      
      const memoryComponent = healthStatus.components.find(c => c.name === 'memory_usage');
      expect(memoryComponent).toBeDefined();
      expect(memoryComponent!.details).toHaveProperty('usedMB');
      expect(memoryComponent!.details).toHaveProperty('percentage');
    });

    it('should monitor response times', () => {
      // Record slow operations
      for (let i = 0; i < 5; i++) {
        monitoring.recordPerformanceMetric('slow_operation', 3000);
      }

      const healthStatus = monitoring.getHealthStatus();
      
      const responseComponent = healthStatus.components.find(c => c.name === 'response_times');
      expect(responseComponent).toBeDefined();
      
      if (responseComponent!.details.recentRequests > 0) {
        expect(['degraded', 'unhealthy']).toContain(responseComponent!.status);
      }
    });

    it('should emit health check events', (done) => {
      (monitoring as any).on('healthCheck', (healthStatus: any) => {
        expect(healthStatus.status).toBeDefined();
        expect(healthStatus.components).toBeDefined();
        done();
      });

      // Trigger health check manually
      (monitoring as any).performHealthCheck();
    });

    it('should determine overall status correctly', () => {
      // Start with healthy state
      let healthStatus = monitoring.getHealthStatus();
      const initialStatus = healthStatus.status;

      // Record many failures to trigger unhealthy state
      for (let i = 0; i < 20; i++) {
        monitoring.recordToolOperation('Read', 100, false, 'Constant failure');
      }

      healthStatus = monitoring.getHealthStatus();
      expect(healthStatus.overall.errors).toBeGreaterThan(0);
    });
  });

  describe('Alert System', () => {
    it('should register alerts correctly', () => {
      const alertCallback = jest.fn();
      const alertId = monitoring.setupAlert(
        {
          metric: 'tool_error_rate',
          threshold: 0.5,
          operator: 'gt'
        },
        alertCallback
      );

      expect(alertId).toBeTruthy();
      expect(typeof alertId).toBe('string');
    });

    it('should trigger alerts when conditions are met', (done) => {
      const alertCallback = jest.fn((alertEvent) => {
        expect(alertEvent.condition.metric).toBe('tool_error_rate');
        expect(alertEvent.currentValue).toBeGreaterThan(0.5);
        expect(alertEvent.message).toContain('Alert triggered');
        done();
      });

      monitoring.setupAlert(
        {
          metric: 'tool_error_rate',
          threshold: 0.5,
          operator: 'gt'
        },
        alertCallback
      );

      // Trigger high error rate
      monitoring.recordToolOperation('Read', 100, false, 'Error 1');
      monitoring.recordToolOperation('Read', 100, false, 'Error 2');
      monitoring.recordToolOperation('Read', 100, false, 'Error 3');
      monitoring.recordToolOperation('Read', 100, true);
    });

    it('should respect cooldown periods', (done) => {
      let alertCount = 0;
      const alertCallback = jest.fn(() => {
        alertCount++;
      });

      monitoring.setupAlert(
        {
          metric: 'tool_latency',
          threshold: 100,
          operator: 'gt',
          cooldown: 1000 // 1 second cooldown
        },
        alertCallback
      );

      // Trigger multiple alerts quickly
      monitoring.recordToolOperation('Read', 150, true);
      monitoring.recordToolOperation('Read', 200, true);
      
      setTimeout(() => {
        expect(alertCount).toBeLessThanOrEqual(1);
        done();
      }, 100);
    });

    it('should remove alerts correctly', () => {
      const alertCallback = jest.fn();
      const alertId = monitoring.setupAlert(
        {
          metric: 'tool_error_rate',
          threshold: 0.5,
          operator: 'gt'
        },
        alertCallback
      );

      const removed = monitoring.removeAlert(alertId);
      expect(removed).toBe(true);

      // Trigger condition - callback should not be called
      monitoring.recordToolOperation('Read', 100, false, 'Error');
      expect(alertCallback).not.toHaveBeenCalled();
    });

    it('should handle alert callback errors gracefully', () => {
      const faultyCallback = jest.fn(() => {
        throw new Error('Callback error');
      });

      monitoring.setupAlert(
        {
          metric: 'tool_latency',
          threshold: 50,
          operator: 'gt'
        },
        faultyCallback
      );

      // Should not throw
      expect(() => {
        monitoring.recordToolOperation('Read', 100, true);
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Alert callback failed',
        expect.objectContaining({
          error: 'Callback error'
        })
      );
    });

    it('should emit alert events', (done) => {
      (monitoring as any).on('alert', (alertEvent: any) => {
        expect(alertEvent.condition.metric).toBe('response_time');
        expect(alertEvent.currentValue).toBe(150);
        done();
      });

      monitoring.setupAlert(
        {
          metric: 'response_time',
          threshold: 100,
          operator: 'gt'
        },
        jest.fn()
      );

      monitoring.recordPerformanceMetric('test_operation', 150);
    });
  });

  describe('Metrics Summary', () => {
    it('should provide accurate metrics summary', () => {
      // Record test data
      monitoring.recordToolOperation('Read', 100, true);
      monitoring.recordToolOperation('Write', 200, false, 'Error');
      monitoring.recordPerformanceMetric('api_request', 150);

      const summary = monitoring.getMetricsSummary();
      
      expect(summary.timestamp).toBeCloseTo(Date.now(), -2);
      expect(summary.period.duration).toBe(60 * 60 * 1000); // 1 hour
      expect(summary.tools.totalCalls).toBe(2);
      expect(summary.tools.successRate).toBe(0.5);
      expect(summary.performance.averageResponseTime).toBe(150);
      expect(summary.system.uptime).toBeGreaterThan(0);
    });

    it('should calculate error rates correctly', () => {
      monitoring.recordToolOperation('Read', 100, true);
      monitoring.recordToolOperation('Read', 100, false, 'Error');

      const summary = monitoring.getMetricsSummary();
      
      expect(summary.tools.successRate).toBe(0.5);
      expect(summary.performance.errorRate).toBe(0.5);
    });

    it('should include system metrics', () => {
      const summary = monitoring.getMetricsSummary();
      
      expect(summary.system.memoryUsage).toBeGreaterThan(0);
      expect(summary.system.uptime).toBeGreaterThan(0);
      expect(typeof summary.system.cpuUsage).toBe('number');
      expect(typeof summary.system.activeConnections).toBe('number');
    });

    it('should filter metrics by time window', () => {
      const shortRetentionMonitoring = new ProductionMonitoring(mockLogger, {
        metricsRetentionMs: 100 // Very short retention
      });

      // Record old metric
      shortRetentionMonitoring.recordToolOperation('Read', 100, true);
      
      // Wait for metric to expire
      setTimeout(() => {
        const summary = shortRetentionMonitoring.getMetricsSummary();
        expect(summary.tools.totalCalls).toBe(0);
        
        (shortRetentionMonitoring as any).destroy();
      }, 150);
    });
  });

  describe('Performance Requirements', () => {
    it('should complete metric recording in <1ms', () => {
      const times: number[] = [];
      
      for (let i = 0; i < 100; i++) {
        const start = Date.now();
        monitoring.recordToolOperation('Read', 100, true);
        times.push(Date.now() - start);
      }
      
      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      expect(averageTime).toBeLessThan(1);
    });

    it('should complete health check in <1ms', () => {
      const times: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        monitoring.getHealthStatus();
        times.push(Date.now() - start);
      }
      
      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      expect(averageTime).toBeLessThan(1);
    });

    it('should complete metrics summary generation in <1ms', () => {
      // Add some data first
      for (let i = 0; i < 10; i++) {
        monitoring.recordToolOperation('Read', 100, true);
        monitoring.recordPerformanceMetric('api_request', 150);
      }

      const times: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        monitoring.getMetricsSummary();
        times.push(Date.now() - start);
      }
      
      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      expect(averageTime).toBeLessThan(1);
    });
  });

  describe('Integration with Constants', () => {
    it('should use production monitoring constants correctly', () => {
      const prodMonitoring = new ProductionMonitoring(mockLogger, {
        metricsRetentionMs: PRODUCTION_LIMITS.METRICS_RETENTION_MS,
        healthCheckIntervalMs: PRODUCTION_LIMITS.HEALTH_CHECK_INTERVAL_MS
      });
      
      expect(prodMonitoring).toBeDefined();
      (prodMonitoring as any).destroy();
    });

    it('should apply monitoring thresholds correctly', () => {
      // Record high error rate
      for (let i = 0; i < 20; i++) {
        monitoring.recordToolOperation('Read', 100, false, 'Error');
      }

      const healthStatus = monitoring.getHealthStatus();
      const toolComponent = healthStatus.components.find(c => c.name === 'tool_operations');
      
      expect(toolComponent!.details.errorRate).toBeGreaterThan(PRODUCTION_MONITORING.ERROR_RATE_THRESHOLD);
    });
  });

  describe('Edge Cases', () => {
    it('should handle no metrics gracefully', () => {
      const summary = monitoring.getMetricsSummary();
      
      expect(summary.tools.totalCalls).toBe(0);
      expect(summary.tools.successRate).toBe(1); // Default to 100% when no data
      expect(summary.tools.averageLatency).toBe(0);
    });

    it('should handle invalid metric values', () => {
      expect(() => {
        monitoring.recordToolOperation('', -1, true);
      }).not.toThrow();
      
      expect(() => {
        monitoring.recordPerformanceMetric('', NaN);
      }).not.toThrow();
    });

    it('should handle cleanup operations correctly', () => {
      // Record metrics
      monitoring.recordToolOperation('Read', 100, true);
      
      // Trigger cleanup manually
      (monitoring as any).cleanupOldMetrics();
      
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should handle concurrent operations safely', async () => {
      const promises = [];
      
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            monitoring.recordToolOperation('Read', 100, true);
            monitoring.recordPerformanceMetric('api_request', 150);
          })
        );
      }
      
      await Promise.all(promises);
      
      const summary = monitoring.getMetricsSummary();
      expect(summary.tools.totalCalls).toBe(100);
    });
  });
});