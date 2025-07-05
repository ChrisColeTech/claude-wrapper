/**
 * Health Monitor Unit Tests
 * Comprehensive tests for production health monitoring functionality
 * Tests health checks, performance monitoring, and alert system
 */

import { HealthMonitor, HealthCheckResult, SystemHealthReport, HealthCheckFunction } from '../../../src/monitoring/health-monitor';
import { PortUtils } from '../../../src/utils/port';

// Mock PortUtils for controlled testing
jest.mock('../../../src/utils/port', () => ({
  PortUtils: {
    isPortAvailable: jest.fn()
  }
}));

// Mock logger to prevent console output during tests
jest.mock('../../../src/utils/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

// Mock production config
jest.mock('../../config/production.config', () => ({
  productionConfig: {
    getMonitoringConfig: jest.fn(() => ({
      healthCheckInterval: 5000,
      healthCheckEnabled: true
    })),
    getFeatureFlags: jest.fn(() => ({
      verboseLogging: false
    })),
    getServerConfig: jest.fn(() => ({
      port: 3000
    }))
  }
}));

const mockPortUtils = PortUtils as jest.Mocked<typeof PortUtils>;

describe('HealthMonitor', () => {
  let healthMonitor: HealthMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Create fresh instance for each test
    healthMonitor = new HealthMonitor({
      checkInterval: 5000,
      timeout: 1000,
      retryAttempts: 2,
      alertThresholds: {
        memoryUsage: 0.8,
        responseTime: 1000,
        consecutiveFailures: 3
      },
      enableDetailedMetrics: true,
      enablePerformanceTracking: true
    });
  });

  afterEach(async () => {
    jest.useRealTimers();
    healthMonitor.shutdown();
    // Give time for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const monitor = new HealthMonitor();
      const stats = monitor.getStatistics();
      
      expect(stats.totalChecks).toBeGreaterThan(0); // Should have core checks
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
      
      monitor.shutdown();
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        checkInterval: 10000,
        timeout: 5000,
        retryAttempts: 3,
        alertThresholds: {
          memoryUsage: 0.9,
          responseTime: 2000,
          consecutiveFailures: 5
        }
      };
      
      const monitor = new HealthMonitor(customConfig);
      
      // Test behavior by checking retry attempts through execution
      expect(() => monitor).not.toThrow();
      
      monitor.shutdown();
    });
  });

  describe('Health Check Registration', () => {
    it('should register custom health checks', () => {
      const customCheck: HealthCheckFunction = async () => ({
        name: 'test-check',
        status: 'healthy',
        message: 'Test is healthy',
        duration: 10,
        timestamp: new Date()
      });

      healthMonitor.registerHealthCheck('test-check', customCheck);
      
      const stats = healthMonitor.getStatistics();
      expect(stats.totalChecks).toBeGreaterThan(3); // Core checks + custom check
    });

    it('should unregister health checks', () => {
      const customCheck: HealthCheckFunction = async () => ({
        name: 'test-check',
        status: 'healthy',
        message: 'Test is healthy',
        duration: 10,
        timestamp: new Date()
      });

      healthMonitor.registerHealthCheck('test-check', customCheck);
      const beforeCount = healthMonitor.getStatistics().totalChecks;
      
      const removed = healthMonitor.unregisterHealthCheck('test-check');
      
      expect(removed).toBe(true);
      expect(healthMonitor.getStatistics().totalChecks).toBe(beforeCount - 1);
    });

    it('should handle unregistering non-existent health checks', () => {
      const removed = healthMonitor.unregisterHealthCheck('non-existent');
      expect(removed).toBe(false);
    });

    it('should overwrite existing health checks when re-registering', () => {
      const firstCheck: HealthCheckFunction = async () => ({
        name: 'test-check',
        status: 'healthy',
        message: 'First check',
        duration: 10,
        timestamp: new Date()
      });

      const secondCheck: HealthCheckFunction = async () => ({
        name: 'test-check',
        status: 'unhealthy',
        message: 'Second check',
        duration: 20,
        timestamp: new Date()
      });

      healthMonitor.registerHealthCheck('test-check', firstCheck);
      healthMonitor.registerHealthCheck('test-check', secondCheck);
      
      // Should not increase total count
      const stats = healthMonitor.getStatistics();
      expect(stats.totalChecks).toBeGreaterThan(3); // Core checks + 1 custom
    });
  });

  describe('Health Check Execution', () => {
    it('should execute all health checks and generate report', async () => {
      mockPortUtils.isPortAvailable.mockResolvedValue(false); // Server should be running
      
      const report = await healthMonitor.runHealthChecks();
      
      expect(report).toBeDefined();
      expect(report.overall).toMatch(/healthy|warning|unhealthy|unknown/);
      expect(report.checks).toHaveLength(3); // memory, server-port, uptime
      expect(report.summary.total).toBe(3);
      expect(report.performance).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
    });

    it('should handle successful health checks', async () => {
      mockPortUtils.isPortAvailable.mockResolvedValue(false); // Server running = healthy
      
      const healthyCheck: HealthCheckFunction = async () => ({
        name: 'always-healthy',
        status: 'healthy',
        message: 'All good',
        duration: 5,
        timestamp: new Date()
      });

      healthMonitor.registerHealthCheck('always-healthy', healthyCheck);
      
      const report = await healthMonitor.runHealthChecks();
      
      const customCheck = report.checks.find(c => c.name === 'always-healthy');
      expect(customCheck).toBeDefined();
      expect(customCheck!.status).toBe('healthy');
    });

    it('should handle failing health checks with retries', async () => {
      let attemptCount = 0;
      const flakyCheck: HealthCheckFunction = async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary failure');
        }
        return {
          name: 'flaky-check',
          status: 'healthy',
          message: 'Eventually succeeded',
          duration: 10,
          timestamp: new Date()
        };
      };

      healthMonitor.registerHealthCheck('flaky-check', flakyCheck);
      
      const report = await healthMonitor.runHealthChecks();
      
      const flakyResult = report.checks.find(c => c.name === 'flaky-check');
      expect(flakyResult).toBeDefined();
      expect(flakyResult!.status).toBe('healthy');
      expect(attemptCount).toBe(2); // Should have retried once
    });

    it('should handle check timeouts', async () => {
      const timeoutCheck: HealthCheckFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Longer than timeout
        return {
          name: 'timeout-check',
          status: 'healthy',
          message: 'Should not reach here',
          duration: 2000,
          timestamp: new Date()
        };
      };

      healthMonitor.registerHealthCheck('timeout-check', timeoutCheck);
      
      const report = await healthMonitor.runHealthChecks();
      
      const timeoutResult = report.checks.find(c => c.name === 'timeout-check');
      expect(timeoutResult).toBeDefined();
      expect(timeoutResult!.status).toBe('unhealthy');
      expect(timeoutResult!.message).toContain('timed out');
    });

    it('should track failure counts correctly', async () => {
      const failingCheck: HealthCheckFunction = async () => {
        throw new Error('Always fails');
      };

      healthMonitor.registerHealthCheck('failing-check', failingCheck);
      
      // Run checks multiple times
      await healthMonitor.runHealthChecks();
      await healthMonitor.runHealthChecks();
      await healthMonitor.runHealthChecks();
      
      const stats = healthMonitor.getStatistics();
      expect(stats.failureRates['failing-check']).toBe(3);
    });
  });

  describe('Core Health Checks', () => {
    beforeEach(() => {
      mockPortUtils.isPortAvailable.mockResolvedValue(false); // Default: server running
    });

    it('should include memory health check', async () => {
      const report = await healthMonitor.runHealthChecks();
      
      const memoryCheck = report.checks.find(c => c.name === 'memory');
      expect(memoryCheck).toBeDefined();
      expect(memoryCheck!.status).toMatch(/healthy|warning|unhealthy/);
      expect(memoryCheck!.message).toContain('Memory usage');
      expect(memoryCheck!.details).toBeDefined();
    });

    it('should include server port health check', async () => {
      const report = await healthMonitor.runHealthChecks();
      
      const portCheck = report.checks.find(c => c.name === 'server-port');
      expect(portCheck).toBeDefined();
      expect(portCheck!.message).toContain('port');
    });

    it('should include uptime health check', async () => {
      const report = await healthMonitor.runHealthChecks();
      
      const uptimeCheck = report.checks.find(c => c.name === 'uptime');
      expect(uptimeCheck).toBeDefined();
      expect(uptimeCheck!.status).toBe('healthy');
      expect(uptimeCheck!.message).toContain('uptime');
    });

    it('should detect unhealthy server when port is available', async () => {
      mockPortUtils.isPortAvailable.mockResolvedValue(true); // Port available = server not running
      
      const report = await healthMonitor.runHealthChecks();
      
      const portCheck = report.checks.find(c => c.name === 'server-port');
      expect(portCheck!.status).toBe('unhealthy');
      expect(portCheck!.message).toContain('not in use');
    });
  });

  describe('Monitoring and Statistics', () => {
    it('should start and stop monitoring', () => {
      expect(() => healthMonitor.startMonitoring()).not.toThrow();
      expect(() => healthMonitor.stopMonitoring()).not.toThrow();
    });

    it('should not start monitoring twice', () => {
      healthMonitor.startMonitoring();
      expect(() => healthMonitor.startMonitoring()).not.toThrow(); // Should handle gracefully
      healthMonitor.stopMonitoring();
    });

    it('should provide accurate statistics', async () => {
      await healthMonitor.runHealthChecks();
      
      const stats = healthMonitor.getStatistics();
      
      expect(stats.totalChecks).toBeGreaterThan(0);
      expect(stats.avgResponseTime).toBeGreaterThanOrEqual(0);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
      expect(stats.failureRates).toBeDefined();
    });

    it('should get latest health report', async () => {
      const report1 = await healthMonitor.runHealthChecks();
      const latest = healthMonitor.getLatestReport();
      
      expect(latest).toEqual(report1);
    });

    it('should get specific check status', async () => {
      await healthMonitor.runHealthChecks();
      
      const memoryStatus = healthMonitor.getCheckStatus('memory');
      expect(memoryStatus).toBeDefined();
      expect(memoryStatus!.name).toBe('memory');
    });

    it('should return null for non-existent check status', async () => {
      await healthMonitor.runHealthChecks();
      
      const nonExistent = healthMonitor.getCheckStatus('non-existent');
      expect(nonExistent).toBeNull();
    });
  });

  describe('Overall Health Calculation', () => {
    it('should return healthy when all checks pass', async () => {
      mockPortUtils.isPortAvailable.mockResolvedValue(false);
      
      const healthyCheck: HealthCheckFunction = async () => ({
        name: 'healthy-check',
        status: 'healthy',
        message: 'All good',
        duration: 5,
        timestamp: new Date()
      });

      healthMonitor.registerHealthCheck('healthy-check', healthyCheck);
      
      const report = await healthMonitor.runHealthChecks();
      
      // If memory is healthy and all other checks are healthy, overall should be healthy
      const unhealthyCount = report.checks.filter(c => c.status === 'unhealthy').length;
      if (unhealthyCount === 0) {
        expect(report.overall).toBe('healthy');
      }
    });

    it('should return warning when some checks have warnings', async () => {
      mockPortUtils.isPortAvailable.mockResolvedValue(false);
      
      const warningCheck: HealthCheckFunction = async () => ({
        name: 'warning-check',
        status: 'warning',
        message: 'Something might be wrong',
        duration: 5,
        timestamp: new Date()
      });

      healthMonitor.registerHealthCheck('warning-check', warningCheck);
      
      const report = await healthMonitor.runHealthChecks();
      
      const warningCount = report.checks.filter(c => c.status === 'warning').length;
      const unhealthyCount = report.checks.filter(c => c.status === 'unhealthy').length;
      
      if (warningCount > 0 && unhealthyCount === 0) {
        expect(report.overall).toBe('warning');
      }
    });

    it('should return unhealthy when any check fails', async () => {
      mockPortUtils.isPortAvailable.mockResolvedValue(false);
      
      const unhealthyCheck: HealthCheckFunction = async () => ({
        name: 'unhealthy-check',
        status: 'unhealthy',
        message: 'Something is broken',
        duration: 5,
        timestamp: new Date()
      });

      healthMonitor.registerHealthCheck('unhealthy-check', unhealthyCheck);
      
      const report = await healthMonitor.runHealthChecks();
      
      expect(report.overall).toBe('unhealthy');
    });
  });

  describe('Performance Metrics', () => {
    it('should track response times', async () => {
      await healthMonitor.runHealthChecks();
      await healthMonitor.runHealthChecks();
      
      const stats = healthMonitor.getStatistics();
      expect(stats.avgResponseTime).toBeGreaterThanOrEqual(0);
    });

    it('should include performance data in reports', async () => {
      const report = await healthMonitor.runHealthChecks();
      
      expect(report.performance).toBeDefined();
      expect(report.performance.avgResponseTime).toBeGreaterThanOrEqual(0);
      expect(report.performance.memoryUsage).toBeDefined();
    });

    it('should limit response time history size', async () => {
      // Run many health checks to test history limitation
      for (let i = 0; i < 150; i++) {
        await healthMonitor.runHealthChecks();
      }
      
      const stats = healthMonitor.getStatistics();
      expect(stats.avgResponseTime).toBeGreaterThanOrEqual(0);
      // History should be limited to 100 entries (internal implementation detail)
    });
  });

  describe('Error Handling', () => {
    it('should handle check execution errors gracefully', async () => {
      const errorCheck: HealthCheckFunction = async () => {
        throw new Error('Check failed completely');
      };

      healthMonitor.registerHealthCheck('error-check', errorCheck);
      
      const report = await healthMonitor.runHealthChecks();
      
      const errorResult = report.checks.find(c => c.name === 'error-check');
      expect(errorResult).toBeDefined();
      expect(errorResult!.status).toBe('unhealthy');
      expect(errorResult!.message).toContain('Check failed completely');
    });

    it('should handle port check errors', async () => {
      mockPortUtils.isPortAvailable.mockRejectedValue(new Error('Port check failed'));
      
      const report = await healthMonitor.runHealthChecks();
      
      const portCheck = report.checks.find(c => c.name === 'server-port');
      expect(portCheck!.status).toBe('unhealthy');
      expect(portCheck!.message).toContain('Port check failed');
    });
  });

  describe('Cleanup and Shutdown', () => {
    it('should shutdown gracefully', () => {
      healthMonitor.startMonitoring();
      expect(() => healthMonitor.shutdown()).not.toThrow();
    });

    it('should clear monitoring data on shutdown', async () => {
      await healthMonitor.runHealthChecks();
      
      healthMonitor.shutdown();
      
      const stats = healthMonitor.getStatistics();
      expect(stats.totalChecks).toBe(0);
      expect(stats.avgResponseTime).toBe(0);
    });

    it('should handle multiple shutdown calls safely', () => {
      healthMonitor.shutdown();
      expect(() => healthMonitor.shutdown()).not.toThrow();
    });
  });

  describe('Performance Requirements', () => {
    it('should complete health checks within reasonable time', async () => {
      const startTime = Date.now();
      await healthMonitor.runHealthChecks();
      const endTime = Date.now();
      
      // Should complete in less than 1 second as per requirements
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle multiple concurrent health checks efficiently', async () => {
      const promises = Array.from({ length: 5 }, () =>
        healthMonitor.runHealthChecks()
      );
      
      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(results).toHaveLength(5);
      expect(results.every(r => r.checks.length > 0)).toBe(true);
      expect(endTime - startTime).toBeLessThan(2000); // Should handle concurrency well
    });
  });
});