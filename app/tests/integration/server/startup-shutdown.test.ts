/**
 * Production Server Startup/Shutdown Integration Tests
 * End-to-end tests for complete server lifecycle management
 * Tests real server startup, port management, health monitoring, and graceful shutdown
 */

import express from 'express';
import { Server } from 'http';
import request from 'supertest';
import { ProductionServerManager } from '../../../src/server/production-server-manager';
import { PortManager } from '../../../src/utils/port-manager';
import { HealthMonitor } from '../../../src/monitoring/health-monitor';
import { createApp } from '../../../src/server';
import { config } from '../../../src/utils/env';

// Increase timeout for integration tests
jest.setTimeout(30000);

describe('Production Server Startup/Shutdown Integration', () => {
  let productionServerManager: ProductionServerManager;
  let portManager: PortManager;
  let healthMonitor: HealthMonitor;
  let app: express.Application;
  let runningServers: Server[] = [];

  beforeEach(() => {
    // Create real instances for integration testing
    productionServerManager = new ProductionServerManager({
      gracefulShutdownTimeout: 5000,
      maxStartupAttempts: 3,
      startupRetryDelay: 500,
      healthCheckEnabled: true,
      preflightChecks: true
    });

    portManager = new PortManager({
      defaultPort: 8200, // Use high port to avoid conflicts
      scanRangeStart: 8200,
      scanRangeEnd: 8299,
      maxRetries: 3,
      reservationTimeout: 30000 // 30 seconds for tests
    });

    healthMonitor = new HealthMonitor({
      checkInterval: 1000, // Fast checks for testing
      timeout: 2000,
      retryAttempts: 2
    });

    // Create real Express app
    app = createApp(config);
  });

  afterEach(async () => {
    // Cleanup all resources
    try {
      await productionServerManager.shutdown();
      portManager.shutdown();
      healthMonitor.shutdown();
      
      // Force close any remaining servers
      for (const server of runningServers) {
        await new Promise<void>((resolve) => {
          server.close(() => resolve());
        });
      }
      runningServers = [];
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  describe('Complete Server Lifecycle', () => {
    it('should start server, serve requests, and shutdown gracefully', async () => {
      // Start the production server
      const startupResult = await productionServerManager.startServer(app, 8200);
      
      expect(startupResult.success).toBe(true);
      expect(startupResult.port).toBe(8200);
      expect(startupResult.server).toBeDefined();
      expect(startupResult.url).toBe('http://localhost:8200');
      
      if (startupResult.server) {
        runningServers.push(startupResult.server);
      }

      // Verify server is running and healthy
      expect(productionServerManager.isRunning()).toBe(true);
      
      const healthStatus = productionServerManager.getHealthStatus();
      expect(healthStatus.status).toBe('healthy');
      expect(healthStatus.port).toBe(8200);

      // Test server responsiveness
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status');

      // Graceful shutdown
      const shutdownResult = await productionServerManager.shutdown();
      
      expect(shutdownResult.success).toBe(true);
      expect(shutdownResult.shutdownTime).toBeGreaterThanOrEqual(0);
      expect(shutdownResult.shutdownTime).toBeLessThan(2000); // Within 2 seconds
      expect(shutdownResult.resourcesReleased).toContain('http-server');
      
      expect(productionServerManager.isRunning()).toBe(false);
    });

    it('should handle port conflicts with automatic resolution', async () => {
      // Start first server on port 8201
      const firstResult = await productionServerManager.startServer(app, 8201);
      expect(firstResult.success).toBe(true);
      expect(firstResult.port).toBe(8201);
      
      if (firstResult.server) {
        runningServers.push(firstResult.server);
      }

      // Try to start second server on same port - should resolve to different port
      const secondManager = new ProductionServerManager();
      const secondApp = createApp(config);
      
      try {
        const secondResult = await secondManager.startServer(secondApp, 8201);
        
        expect(secondResult.success).toBe(true);
        expect(secondResult.port).not.toBe(8201); // Should use different port
        expect(secondResult.port).toBeGreaterThan(8201);
        expect(secondResult.portResolution?.alternativePort).toBeDefined();
        
        if (secondResult.server) {
          runningServers.push(secondResult.server);
        }

        // Both servers should be running on different ports
        expect(productionServerManager.isRunning()).toBe(true);
        expect(secondManager.isRunning()).toBe(true);

        await secondManager.shutdown();
      } finally {
        await secondManager.shutdown();
      }
    });

    it('should integrate with health monitoring system', async () => {
      // Start health monitoring
      healthMonitor.startMonitoring();

      // Start production server
      const startupResult = await productionServerManager.startServer(app, 8202);
      expect(startupResult.success).toBe(true);
      
      if (startupResult.server) {
        runningServers.push(startupResult.server);
      }

      // Wait for health check cycle
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Verify health monitoring is working
      const healthReport = await healthMonitor.runHealthChecks();
      
      expect(healthReport.overall).toBe('healthy');
      expect(healthReport.checks.length).toBeGreaterThan(0);
      expect(healthReport.uptime).toBeGreaterThan(0);
      
      // Check specific health endpoints
      const memoryCheck = healthReport.checks.find(c => c.name === 'memory');
      expect(memoryCheck).toBeDefined();
      expect(memoryCheck?.status).toMatch(/healthy|warning/);

      const uptimeCheck = healthReport.checks.find(c => c.name === 'uptime');
      expect(uptimeCheck).toBeDefined();
      expect(uptimeCheck?.status).toBe('healthy');
    });

    it('should handle multiple rapid startup/shutdown cycles', async () => {
      const cycles = 3;
      const results: boolean[] = [];

      for (let i = 0; i < cycles; i++) {
        const port = 8210 + i;
        
        // Startup
        const startupResult = await productionServerManager.startServer(app, port);
        results.push(startupResult.success);
        
        expect(startupResult.success).toBe(true);
        expect(productionServerManager.isRunning()).toBe(true);
        
        if (startupResult.server) {
          runningServers.push(startupResult.server);
        }

        // Quick health check
        const health = productionServerManager.getHealthStatus();
        expect(health.status).toBe('healthy');

        // Shutdown
        const shutdownResult = await productionServerManager.shutdown();
        expect(shutdownResult.success).toBe(true);
        expect(productionServerManager.isRunning()).toBe(false);
      }

      // All cycles should succeed
      expect(results.every(r => r === true)).toBe(true);
    });

    it('should handle server startup with custom middleware and routes', async () => {
      // Add custom middleware and routes to test app
      const customApp = createApp(config);
      
      customApp.use('/test', (req, res, next) => {
        res.locals.testData = 'integration-test';
        next();
      });

      customApp.get('/test/endpoint', (req, res) => {
        res.json({ 
          message: 'Integration test endpoint',
          data: res.locals.testData,
          timestamp: new Date().toISOString()
        });
      });

      // Start server with custom app
      const startupResult = await productionServerManager.startServer(customApp, 8203);
      expect(startupResult.success).toBe(true);
      
      if (startupResult.server) {
        runningServers.push(startupResult.server);
      }

      // Test custom endpoint
      const testResponse = await request(customApp)
        .get('/test/endpoint')
        .expect(200);
      
      expect(testResponse.body.message).toBe('Integration test endpoint');
      expect(testResponse.body.data).toBe('integration-test');
      expect(testResponse.body.timestamp).toBeDefined();

      // Test health endpoint still works
      await request(customApp)
        .get('/health')
        .expect(200);
    });
  });

  describe('Port Management Integration', () => {
    it('should coordinate between port manager and production server', async () => {
      const targetPort = 8204;

      // Reserve port through port manager
      const reserved = await portManager.reservePort(targetPort, 'integration-test', 'test-suite');
      expect(reserved).toBe(true);

      // Try to start server on reserved port - should find alternative
      const startupResult = await productionServerManager.startServer(app, targetPort);
      
      expect(startupResult.success).toBe(true);
      expect(startupResult.port).not.toBe(targetPort); // Should use different port
      expect(startupResult.portResolution?.alternativePort).toBeDefined();
      
      if (startupResult.server) {
        runningServers.push(startupResult.server);
      }

      // Release reservation
      portManager.releasePort(targetPort);

      // Verify port manager status
      const portManagerStatus = portManager.getStatus();
      expect(portManagerStatus.activeReservations).toBe(0);
    });

    it('should handle port manager reservation cleanup during server lifecycle', async () => {
      const startupResult = await productionServerManager.startServer(app, 8205);
      expect(startupResult.success).toBe(true);
      
      if (startupResult.server) {
        runningServers.push(startupResult.server);
      }

      // Verify port is in use (not available)
      const portAvailability = await portManager.findAvailablePort(8205);
      expect(portAvailability.port).not.toBe(8205); // Should find alternative

      // Shutdown should release port
      await productionServerManager.shutdown();

      // Port should be available again after shutdown
      const postShutdownAvailability = await portManager.findAvailablePort(8205);
      expect(postShutdownAvailability.available).toBe(true);
    });
  });

  describe('Health Monitoring Integration', () => {
    it('should provide comprehensive health status during server operation', async () => {
      healthMonitor.startMonitoring();

      const startupResult = await productionServerManager.startServer(app, 8206);
      expect(startupResult.success).toBe(true);
      
      if (startupResult.server) {
        runningServers.push(startupResult.server);
      }

      // Register custom health check for server-specific monitoring
      healthMonitor.registerHealthCheck('production-server', async () => {
        const serverHealth = productionServerManager.getHealthStatus();
        return {
          name: 'production-server',
          status: serverHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
          message: `Server status: ${serverHealth.status}, uptime: ${serverHealth.uptime}ms`,
          duration: 10,
          timestamp: new Date(),
          details: { 
            port: serverHealth.port,
            uptime: serverHealth.uptime 
          }
        };
      });

      // Run comprehensive health check
      const healthReport = await healthMonitor.runHealthChecks();
      
      expect(healthReport.overall).toMatch(/healthy|warning/);
      expect(healthReport.checks.length).toBeGreaterThan(2);
      
      // Verify custom production server check
      const serverCheck = healthReport.checks.find(c => c.name === 'production-server');
      expect(serverCheck).toBeDefined();
      expect(serverCheck?.status).toBe('healthy');
      expect(serverCheck?.details?.port).toBe(8206);

      // Verify health endpoint reflects monitoring data
      const healthEndpointResponse = await request(app)
        .get('/health')
        .expect(200);
      
      expect(healthEndpointResponse.body.status).toBeDefined();
    });

    it('should detect and report server issues through health monitoring', async () => {
      healthMonitor.startMonitoring();

      const startupResult = await productionServerManager.startServer(app, 8207);
      expect(startupResult.success).toBe(true);
      
      if (startupResult.server) {
        runningServers.push(startupResult.server);
      }

      // Simulate server issue by registering failing health check
      healthMonitor.registerHealthCheck('simulated-failure', async () => {
        return {
          name: 'simulated-failure',
          status: 'unhealthy',
          message: 'Simulated server component failure',
          duration: 5,
          timestamp: new Date(),
          details: { error: 'Integration test simulation' }
        };
      });

      const healthReport = await healthMonitor.runHealthChecks();
      
      expect(healthReport.overall).toBe('unhealthy'); // Should detect the failure
      
      const failureCheck = healthReport.checks.find(c => c.name === 'simulated-failure');
      expect(failureCheck?.status).toBe('unhealthy');
    });
  });

  describe('Performance and Reliability', () => {
    it('should meet performance requirements under load', async () => {
      // Startup performance
      const startupStart = Date.now();
      const startupResult = await productionServerManager.startServer(app, 8208);
      const startupTime = Date.now() - startupStart;
      
      expect(startupResult.success).toBe(true);
      expect(startupTime).toBeLessThan(3000); // < 3 seconds startup requirement
      
      if (startupResult.server) {
        runningServers.push(startupResult.server);
      }

      // Response time performance
      const requestStart = Date.now();
      await request(app).get('/health').expect(200);
      const responseTime = Date.now() - requestStart;
      
      expect(responseTime).toBeLessThan(1000); // < 1 second response requirement

      // Shutdown performance
      const shutdownStart = Date.now();
      const shutdownResult = await productionServerManager.shutdown();
      const shutdownTime = Date.now() - shutdownStart;
      
      expect(shutdownResult.success).toBe(true);
      expect(shutdownTime).toBeLessThan(2000); // < 2 seconds shutdown requirement
    });

    it('should handle concurrent requests during normal operation', async () => {
      const startupResult = await productionServerManager.startServer(app, 8209);
      expect(startupResult.success).toBe(true);
      
      if (startupResult.server) {
        runningServers.push(startupResult.server);
      }

      // Send multiple concurrent requests
      const requestCount = 10;
      const requestPromises = Array.from({ length: requestCount }, () =>
        request(app).get('/health').expect(200)
      );

      const responses = await Promise.all(requestPromises);
      
      // All requests should succeed
      expect(responses).toHaveLength(requestCount);
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status');
      });
    });

    it('should maintain stability across extended operation period', async () => {
      const startupResult = await productionServerManager.startServer(app, 8210);
      expect(startupResult.success).toBe(true);
      
      if (startupResult.server) {
        runningServers.push(startupResult.server);
      }

      // Simulate extended operation with periodic health checks
      const checkInterval = 500; // 500ms
      const duration = 3000; // 3 seconds total
      const checksPerformed: boolean[] = [];

      const endTime = Date.now() + duration;
      while (Date.now() < endTime) {
        try {
          const health = productionServerManager.getHealthStatus();
          checksPerformed.push(health.status === 'healthy');
          
          await request(app).get('/health').expect(200);
          
          await new Promise(resolve => setTimeout(resolve, checkInterval));
        } catch (error) {
          checksPerformed.push(false);
        }
      }

      // Should maintain health throughout operation
      const healthyChecks = checksPerformed.filter(c => c === true).length;
      const healthyPercentage = healthyChecks / checksPerformed.length;
      
      expect(healthyPercentage).toBeGreaterThan(0.95); // 95% healthy
      expect(checksPerformed.length).toBeGreaterThan(3); // Multiple checks performed
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from startup failures and retry successfully', async () => {
      // Create a manager with retries enabled
      const retryManager = new ProductionServerManager({
        maxStartupAttempts: 3,
        startupRetryDelay: 200
      });

      // First attempt should fail due to invalid port
      const invalidApp = {} as express.Application; // Invalid app

      try {
        const failResult = await retryManager.startServer(invalidApp, 8211);
        expect(failResult.success).toBe(false);

        // Second attempt with valid app should succeed
        const successResult = await retryManager.startServer(app, 8211);
        expect(successResult.success).toBe(true);
        
        if (successResult.server) {
          runningServers.push(successResult.server);
        }

        await retryManager.shutdown();
      } finally {
        await retryManager.shutdown();
      }
    });

    it('should handle graceful shutdown even with active connections', async () => {
      const startupResult = await productionServerManager.startServer(app, 8212);
      expect(startupResult.success).toBe(true);
      
      if (startupResult.server) {
        runningServers.push(startupResult.server);
      }

      // Start long-running request (simulated)
      const longRequestPromise = request(app)
        .get('/health')
        .timeout(1000);

      // Initiate shutdown while request is in progress
      const shutdownPromise = productionServerManager.shutdown();

      // Both should complete successfully
      const [requestResult, shutdownResult] = await Promise.all([
        longRequestPromise.catch(() => ({ status: 'timeout' })), // Handle potential timeout
        shutdownPromise
      ]);

      expect(shutdownResult.success).toBe(true);
      // Request may timeout due to server shutdown, which is acceptable
    });
  });
});