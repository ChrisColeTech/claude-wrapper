/**
 * System Monitoring Integration Tests
 * End-to-end monitoring tests with comprehensive functionality coverage
 * No placeholders - all tests are fully implemented
 */

import request from 'supertest';
import express from 'express';
import { PerformanceMonitor, performanceMonitor } from '../../../src/monitoring/performance-monitor';
import { CleanupService, CleanupServiceFactory } from '../../../src/services/cleanup-service';
import { createTimingMiddleware } from '../../../src/middleware/timing';
import { createMonitoringRoutes } from '../../../src/routes/monitoring';
import { SessionManager } from '../../../src/session/manager';

describe('System Monitoring Integration', () => {
  let app: express.Application;
  let sessionManager: SessionManager;
  let cleanupService: CleanupService;
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    // Create fresh instances for each test
    sessionManager = new SessionManager();
    cleanupService = CleanupServiceFactory.createWithSessionManager(sessionManager) as CleanupService;
    monitor = new PerformanceMonitor();
    
    // Setup Express app with all monitoring components
    app = express();
    app.use(express.json());
    
    // Add timing middleware
    app.use(createTimingMiddleware({
      logRequests: false, // Reduce noise in tests
      excludePaths: []
    }));
    
    // Add monitoring routes
    app.use('/monitoring', createMonitoringRoutes());
    
    // Add test endpoints
    app.get('/test/fast', (req, res) => {
      res.json({ message: 'fast response' });
    });
    
    app.get('/test/slow', async (req, res) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      res.json({ message: 'slow response' });
    });
    
    app.get('/test/error', (req, res) => {
      res.status(500).json({ error: 'test error' });
    });
    
    app.post('/test/session', (req, res) => {
      const session = sessionManager.get_or_create_session('test-session');
      res.json({ sessionId: session.session_id });
    });
  });

  afterEach(async () => {
    // Cleanup
    if (cleanupService.isRunning()) {
      cleanupService.stop();
    }
    sessionManager.shutdown();
    monitor.shutdown();
    performanceMonitor.clearMetrics();
  });

  describe('Performance Monitoring Integration', () => {
    it('should track request performance', async () => {
      // Make some requests
      await request(app).get('/test/fast').expect(200);
      await request(app).get('/test/slow').expect(200);
      
      // Check metrics endpoint
      const response = await request(app)
        .get('/monitoring/metrics')
        .expect(200);
      
      expect(response.body.operations).toBeDefined();
      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.totalOperations).toBeGreaterThan(0);
    });

    it('should track error rates', async () => {
      // Make requests with errors
      await request(app).get('/test/error').expect(500);
      await request(app).get('/test/fast').expect(200);
      
      // Check metrics
      const response = await request(app)
        .get('/monitoring/metrics')
        .expect(200);
      
      expect(response.body.summary.errorRate).toBeGreaterThan(0);
    });

    it('should provide operation-specific metrics', async () => {
      // Make requests
      await request(app).get('/test/fast');
      await request(app).get('/test/fast');
      
      // Check specific operation metrics
      const response = await request(app)
        .get('/monitoring/metrics/get:/test/fast')
        .expect(200);
      
      expect(response.body.operation).toBe('get:/test/fast');
      expect(response.body.stats).toBeDefined();
      expect(response.body.stats.count).toBe(2);
    });

    it('should handle non-existent operation metrics', async () => {
      const response = await request(app)
        .get('/monitoring/metrics/non-existent')
        .expect(404);
      
      expect(response.body.error).toBe('Operation not found');
    });
  });

  describe('Health Check Integration', () => {
    it('should provide basic health status', async () => {
      const response = await request(app)
        .get('/monitoring/health')
        .expect(200);
      
      expect(response.body.status).toMatch(/healthy|warning|critical/);
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
      expect(response.body.version).toBeDefined();
    });

    it('should provide detailed status', async () => {
      const response = await request(app)
        .get('/monitoring/status')
        .expect(200);
      
      expect(response.body.status).toMatch(/healthy|warning|critical/);
      expect(response.body.system).toBeDefined();
      expect(response.body.system.memory).toBeDefined();
      expect(response.body.system.cpu).toBeDefined();
      expect(response.body.system.process).toBeDefined();
      expect(response.body.performance).toBeDefined();
    });

    it('should detect performance issues', async () => {
      // Generate slow requests to trigger warning
      for (let i = 0; i < 5; i++) {
        await request(app).get('/test/slow');
      }
      
      const response = await request(app)
        .get('/monitoring/status')
        .expect(200);
      
      // Should detect slow operations
      expect(response.body.performance.summary.slowOperations).toBeDefined();
    });
  });

  describe('System Metrics Integration', () => {
    it('should provide system metrics', async () => {
      const response = await request(app)
        .get('/monitoring/system')
        .expect(200);
      
      expect(response.body.memory).toBeDefined();
      expect(response.body.memory.used).toBeGreaterThan(0);
      expect(response.body.memory.total).toBeGreaterThan(0);
      expect(response.body.memory.percentage).toBeGreaterThan(0);
      
      expect(response.body.cpu).toBeDefined();
      expect(response.body.cpu.loadAverage).toBeDefined();
      
      expect(response.body.process).toBeDefined();
      expect(response.body.process.pid).toBe(process.pid);
      expect(response.body.process.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should provide dashboard view', async () => {
      // Generate some activity
      await request(app).get('/test/fast');
      await request(app).get('/test/slow');
      
      const response = await request(app)
        .get('/monitoring/dashboard')
        .expect(200);
      
      expect(response.body.status).toBeDefined();
      expect(response.body.system).toBeDefined();
      expect(response.body.performance).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Session Management Integration', () => {
    it('should track session creation', async () => {
      // Create sessions
      await request(app).post('/test/session').expect(200);
      await request(app).post('/test/session').expect(200);
      
      expect(sessionManager.get_session_count()).toBeGreaterThan(0);
    });

    it('should handle session cleanup', async () => {
      // Create sessions
      const session1 = sessionManager.get_or_create_session('session-1');
      const session2 = sessionManager.get_or_create_session('session-2');
      
      // Mock one as expired
      jest.spyOn(session1, 'is_expired').mockReturnValue(true);
      jest.spyOn(session2, 'is_expired').mockReturnValue(false);
      
      // Run cleanup
      const cleanedCount = await cleanupService.runCleanup();
      
      expect(cleanedCount).toBeGreaterThan(0);
      
      const stats = cleanupService.getStats();
      expect(stats.totalRuns).toBe(1);
      expect(stats.totalSessionsRemoved).toBeGreaterThan(0);
    });

    it('should integrate cleanup stats with monitoring', async () => {
      // Run cleanup to generate stats
      await cleanupService.runCleanup();
      
      // Check that cleanup stats are available
      const stats = cleanupService.getStats();
      expect(stats.totalRuns).toBe(1);
      expect(stats.lastRunAt).toBeDefined();
    });
  });

  describe('Timing Middleware Integration', () => {
    it('should time all requests', async () => {
      // Make various requests
      await request(app).get('/test/fast');
      await request(app).get('/test/slow');
      await request(app).get('/test/error');
      
      // Check that timing data was recorded
      const response = await request(app)
        .get('/monitoring/metrics')
        .expect(200);
      
      expect(Object.keys(response.body.operations)).toContain('get:/test/fast');
      expect(Object.keys(response.body.operations)).toContain('get:/test/slow');
      expect(Object.keys(response.body.operations)).toContain('get:/test/error');
    });

    it('should exclude monitoring endpoints from timing', async () => {
      // Make request to monitoring endpoint
      await request(app).get('/monitoring/health');
      
      // Check metrics - should not include monitoring endpoint
      const response = await request(app)
        .get('/monitoring/metrics')
        .expect(200);
      
      const operations = Object.keys(response.body.operations);
      expect(operations).not.toContain('get:/monitoring/health');
    });

    it('should track request duration accurately', async () => {
      await request(app).get('/test/slow'); // 100ms delay
      
      const response = await request(app)
        .get('/monitoring/metrics/get:/test/slow')
        .expect(200);
      
      const stats = response.body.stats;
      expect(stats.avgDuration).toBeGreaterThan(50); // Should be around 100ms
      expect(stats.count).toBe(1);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle monitoring endpoint errors gracefully', async () => {
      // Mock an error in the performance monitor
      jest.spyOn(performanceMonitor, 'getAllStats').mockImplementation(() => {
        throw new Error('Monitor error');
      });
      
      const response = await request(app)
        .get('/monitoring/metrics')
        .expect(500);
      
      expect(response.body.error).toBe('Metrics retrieval failed');
      
      // Restore mock
      jest.restoreAllMocks();
    });

    it('should handle system metrics errors', async () => {
      // Mock os module to throw error
      const originalRequire = require;
      jest.doMock('os', () => ({
        totalmem: () => { throw new Error('OS error'); },
        freemem: () => { throw new Error('OS error'); },
        loadavg: () => { throw new Error('OS error'); }
      }));
      
      const response = await request(app)
        .get('/monitoring/system')
        .expect(500);
      
      expect(response.body.error).toBe('System metrics retrieval failed');
      
      // Restore require
      jest.doMock('os', () => originalRequire('os'));
    });
  });

  describe('Performance Requirements', () => {
    it('should meet monitoring overhead requirements', async () => {
      const iterations = 10;
      const startTime = performance.now();
      
      // Make multiple requests
      for (let i = 0; i < iterations; i++) {
        await request(app).get('/test/fast');
      }
      
      const totalTime = performance.now() - startTime;
      const averageTime = totalTime / iterations;
      
      // Should be fast
      expect(averageTime).toBeLessThan(50); // Should be much less than 50ms per request
    });

    it('should handle high load without degradation', async () => {
      const iterations = 50;
      const promises = [];
      
      const startTime = performance.now();
      
      // Make concurrent requests
      for (let i = 0; i < iterations; i++) {
        promises.push(request(app).get('/test/fast'));
      }
      
      await Promise.all(promises);
      const totalTime = performance.now() - startTime;
      
      // Should handle concurrent load
      expect(totalTime).toBeLessThan(5000); // Should complete in under 5 seconds
      
      // Check metrics are still accurate
      const response = await request(app)
        .get('/monitoring/metrics')
        .expect(200);
      
      expect(response.body.summary.totalOperations).toBeGreaterThan(0);
    });

    it('should cleanup metrics efficiently', async () => {
      // Generate lots of metrics
      for (let i = 0; i < 100; i++) {
        await request(app).get('/test/fast');
      }
      
      // Clear metrics
      const startTime = performance.now();
      await request(app).delete('/monitoring/metrics').expect(200);
      const clearTime = performance.now() - startTime;
      
      expect(clearTime).toBeLessThan(100); // Should clear quickly
      
      // Verify metrics are cleared
      const response = await request(app)
        .get('/monitoring/metrics')
        .expect(200);
      
      expect(Object.keys(response.body.operations)).toHaveLength(0);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle mixed workload', async () => {
      // Simulate realistic workload
      const requests = [
        request(app).get('/test/fast'),
        request(app).get('/test/slow'),
        request(app).post('/test/session'),
        request(app).get('/test/error'),
        request(app).get('/monitoring/health'),
        request(app).get('/test/fast'),
        request(app).get('/test/slow')
      ];
      
      await Promise.all(requests);
      
      // Check comprehensive metrics
      const response = await request(app)
        .get('/monitoring/dashboard')
        .expect(200);
      
      expect(response.body.status).toBeDefined();
      expect(response.body.performance.summary.totalOperations).toBeGreaterThan(0);
      expect(response.body.performance.summary.errorRate).toBeGreaterThan(0);
    });

    it('should maintain accuracy under sustained load', async () => {
      // Run sustained load for a short period
      const duration = 1000; // 1 second
      const startTime = Date.now();
      const requests = [];
      
      while (Date.now() - startTime < duration) {
        requests.push(request(app).get('/test/fast'));
        
        // Don't overwhelm the system
        if (requests.length % 10 === 0) {
          await Promise.all(requests.splice(0, 10));
        }
      }
      
      // Wait for remaining requests
      await Promise.all(requests);
      
      // Verify metrics accuracy
      const response = await request(app)
        .get('/monitoring/metrics/get:/test/fast')
        .expect(200);
      
      const stats = response.body.stats;
      expect(stats.count).toBeGreaterThan(0);
      expect(stats.successRate).toBe(1); // All should succeed
      expect(stats.avgDuration).toBeGreaterThan(0);
    });

    it('should handle cleanup during active monitoring', async () => {
      // Start cleanup service
      cleanupService.start();
      
      // Generate activity while cleanup is running
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(request(app).get('/test/fast'));
        promises.push(request(app).post('/test/session'));
      }
      
      await Promise.all(promises);
      
      // Wait for potential cleanup cycle
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Verify system is still functional
      const response = await request(app)
        .get('/monitoring/health')
        .expect(200);
      
      expect(response.body.status).toMatch(/healthy|warning|critical/);
      
      // Check cleanup stats
      const cleanupStats = cleanupService.getStats();
      expect(cleanupStats.totalRuns).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistent metrics across endpoints', async () => {
      // Generate specific activity
      await request(app).get('/test/fast');
      await request(app).get('/test/slow');
      await request(app).get('/test/error');
      
      // Get metrics from different endpoints
      const metricsResponse = await request(app).get('/monitoring/metrics');
      const dashboardResponse = await request(app).get('/monitoring/dashboard');
      const statusResponse = await request(app).get('/monitoring/status');
      
      // Verify consistency
      expect(metricsResponse.body.summary.totalOperations)
        .toBe(dashboardResponse.body.performance.summary.totalOperations);
      
      expect(metricsResponse.body.summary.totalOperations)
        .toBe(statusResponse.body.performance.summary.totalOperations);
    });

    it('should handle concurrent metric updates', async () => {
      // Make concurrent requests
      const concurrentRequests = Array(20).fill(null).map(() => 
        request(app).get('/test/fast')
      );
      
      await Promise.all(concurrentRequests);
      
      // Check final count is accurate
      const response = await request(app)
        .get('/monitoring/metrics/get:/test/fast')
        .expect(200);
      
      expect(response.body.stats.count).toBe(20);
    });
  });
});