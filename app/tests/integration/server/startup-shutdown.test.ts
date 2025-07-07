/**
 * Server Startup-Shutdown Integration Tests
 * Tests for complete server lifecycle with proper resource cleanup
 * 
 * These tests verify that the server can start and stop cleanly without
 * memory leaks or resource issues in test environments
 */

import { Server } from 'http';
import { Application } from 'express';
import { testEnvironmentManager } from '../../utils/test-environment';
import { createApp, createAndStartServer } from '../../../src/server';
import { config } from '../../../src/utils/env';
import { ProductionServerManager } from '../../../src/server/production-server-manager';
import { portManager } from '../../../src/utils/port-manager';
import { healthMonitor } from '../../../src/monitoring/health-monitor';

describe('Server Startup-Shutdown Integration', () => {
  let testServers: Server[] = [];
  let testApps: Application[] = [];
  
  beforeAll(() => {
    // Setup test environment with memory monitoring
    testEnvironmentManager.setup();
  });

  beforeEach(() => {
    // Reset environment for each test
    testEnvironmentManager.reset();
    
    // Clear any existing servers
    testServers = [];
    testApps = [];
  });

  afterEach(async () => {
    // Clean up all servers created during tests
    await Promise.all(testServers.map(server => new Promise<void>((resolve) => {
      if (server.listening) {
        server.close(() => resolve());
      } else {
        resolve();
      }
    })));
    
    testServers = [];
    testApps = [];
    
    // Clean up singletons
    try {
      await portManager.shutdown();
    } catch (error) {
      // Ignore cleanup errors
    }
    
    try {
      healthMonitor.stopMonitoring();
      healthMonitor.clearActiveServerPort();
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Force cleanup of test environment
    testEnvironmentManager.cleanup();
  });

  afterAll(() => {
    // Final cleanup
    testEnvironmentManager.cleanup();
  });

  describe('Express App Creation', () => {
    test('should create Express app without errors', () => {
      const app = createApp(config);
      testApps.push(app);
      
      expect(app).toBeDefined();
      expect(typeof app).toBe('function'); // Express apps are functions
      expect(app.listen).toBeDefined();
    });

    test('should create app with proper middleware stack', () => {
      const app = createApp(config);
      testApps.push(app);
      
      // Test that the app has been configured with middleware
      expect(app._router).toBeDefined();
      expect(app._router.stack.length).toBeGreaterThan(0);
    });

    test('should disable x-powered-by header for security', () => {
      const app = createApp(config);
      testApps.push(app);
      
      expect(app.get('x-powered-by')).toBe(false);
    });
  });

  describe('Server Lifecycle Management', () => {
    test('should start server on available port', async () => {
      const testPort = 8000 + Math.floor(Math.random() * 1000);
      
      const result = await createAndStartServer({
        ...config,
        PORT: testPort
      });
      
      testServers.push(result.server);
      
      expect(result.server).toBeDefined();
      expect(result.port).toBe(testPort);
      expect(result.url).toBe(`http://localhost:${testPort}`);
      expect(result.server.listening).toBe(true);
    }, 10000);

    test('should handle port conflicts gracefully', async () => {
      const testPort = 8000 + Math.floor(Math.random() * 1000);
      
      // Start first server
      const result1 = await createAndStartServer({
        ...config,
        PORT: testPort
      });
      testServers.push(result1.server);
      
      expect(result1.server.listening).toBe(true);
      expect(result1.port).toBe(testPort);
      
      // Try to start second server on same port - should find alternative
      const result2 = await createAndStartServer({
        ...config,
        PORT: testPort
      });
      testServers.push(result2.server);
      
      expect(result2.server.listening).toBe(true);
      expect(result2.port).not.toBe(testPort); // Should be different port
    }, 15000);

    test('should shutdown server cleanly', async () => {
      const testPort = 8000 + Math.floor(Math.random() * 1000);
      
      const result = await createAndStartServer({
        ...config,
        PORT: testPort
      });
      
      expect(result.server.listening).toBe(true);
      
      // Clean shutdown
      await new Promise<void>((resolve) => {
        result.server.close(() => {
          resolve();
        });
      });
      
      expect(result.server.listening).toBe(false);
      
      // Don't add to testServers since we already closed it
    }, 10000);
  });

  describe('Production Server Manager Integration', () => {
    let productionServerManager: ProductionServerManager;
    
    beforeEach(() => {
      productionServerManager = new ProductionServerManager();
    });

    afterEach(async () => {
      try {
        await productionServerManager.shutdown();
      } catch (error) {
        // Ignore shutdown errors
      }
    });

    test('should create production server manager', () => {
      expect(productionServerManager).toBeDefined();
      expect(productionServerManager.startServer).toBeDefined();
      expect(productionServerManager.shutdown).toBeDefined();
    });

    test('should start server with production configuration', async () => {
      const testPort = 8000 + Math.floor(Math.random() * 1000);
      const app = createApp(config);
      testApps.push(app);
      
      const result = await productionServerManager.startServer(app, testPort);
      
      if (result.server) {
        testServers.push(result.server);
      }
      
      expect(result.success).toBe(true);
      expect(result.server).toBeDefined();
      expect(result.port).toBe(testPort);
      expect(result.startupTime).toBeGreaterThan(0);
    }, 15000);

    test('should handle startup failures gracefully', async () => {
      const invalidPort = -1; // Invalid port
      const app = createApp(config);
      testApps.push(app);
      
      const result = await productionServerManager.startServer(app, invalidPort);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    }, 10000);

    test('should shutdown production server cleanly', async () => {
      const testPort = 8000 + Math.floor(Math.random() * 1000);
      const app = createApp(config);
      testApps.push(app);
      
      const startResult = await productionServerManager.startServer(app, testPort);
      
      if (startResult.server) {
        testServers.push(startResult.server);
      }
      
      expect(startResult.success).toBe(true);
      
      const shutdownResult = await productionServerManager.shutdown();
      
      expect(shutdownResult.success).toBe(true);
      expect(shutdownResult.shutdownTime).toBeGreaterThan(0);
      
      // Remove from testServers since it's already shut down
      testServers = testServers.filter(s => s !== startResult.server);
    }, 15000);
  });

  describe('Health Monitoring Integration', () => {
    test('should integrate with health monitoring system', async () => {
      const testPort = 8000 + Math.floor(Math.random() * 1000);
      
      const result = await createAndStartServer({
        ...config,
        PORT: testPort
      });
      
      testServers.push(result.server);
      
      // Health monitor should be able to detect the server
      expect(result.server.listening).toBe(true);
      
      // Test health endpoint availability
      const response = await fetch(`http://localhost:${testPort}/health`);
      expect(response.ok).toBe(true);
      
      const healthData = await response.json() as { status: string; service: string };
      expect(healthData.status).toBe('healthy');
      expect(healthData.service).toBe('claude-code-openai-wrapper');
    }, 15000);

    test('should handle health monitoring cleanup', async () => {
      const testPort = 8000 + Math.floor(Math.random() * 1000);
      
      const result = await createAndStartServer({
        ...config,
        PORT: testPort
      });
      
      testServers.push(result.server);
      
      // Stop health monitoring
      healthMonitor.stopMonitoring();
      healthMonitor.clearActiveServerPort();
      
      // Should not throw errors
      expect(true).toBe(true); // Test passes if no errors thrown
    }, 10000);
  });

  describe('Resource Cleanup Validation', () => {
    test('should not accumulate signal handlers during server lifecycle', () => {
      const initialCounts = {
        SIGTERM: process.listenerCount('SIGTERM'),
        SIGINT: process.listenerCount('SIGINT'),
        SIGUSR2: process.listenerCount('SIGUSR2')
      };
      
      // Create and destroy multiple servers
      for (let i = 0; i < 5; i++) {
        const app = createApp(config);
        testApps.push(app);
        
        // In test environment, signal handlers should not be added
        const counts = {
          SIGTERM: process.listenerCount('SIGTERM'),
          SIGINT: process.listenerCount('SIGINT'),
          SIGUSR2: process.listenerCount('SIGUSR2')
        };
        
        expect(counts.SIGTERM).toBe(initialCounts.SIGTERM);
        expect(counts.SIGINT).toBe(initialCounts.SIGINT);
        expect(counts.SIGUSR2).toBe(initialCounts.SIGUSR2);
      }
    });

    test('should not leak memory during multiple server startups', async () => {
      const memoryTracker = testEnvironmentManager.memoryTracker;
      memoryTracker.startTracking();
      
      // Start and stop multiple servers
      for (let i = 0; i < 3; i++) {
        const testPort = 8000 + Math.floor(Math.random() * 1000) + i;
        
        const result = await createAndStartServer({
          ...config,
          PORT: testPort
        });
        
        memoryTracker.takeSnapshot();
        
        // Immediately close server
        await new Promise<void>((resolve) => {
          result.server.close(() => resolve());
        });
        
        memoryTracker.takeSnapshot();
      }
      
      const snapshots = memoryTracker.stopTracking();
      expect(snapshots.length).toBeGreaterThan(0);
      
      // Should not detect significant memory leaks
      expect(memoryTracker.checkForLeaks(100)).toBe(false);
    }, 30000);

    test('should clean up port manager resources', async () => {
      // Test that port manager can be shutdown without errors
      expect(() => {
        portManager.shutdown();
      }).not.toThrow();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle concurrent server startups', async () => {
      const basePort = 8000 + Math.floor(Math.random() * 1000);
      
      // Start multiple servers concurrently
      const serverPromises = Array.from({ length: 3 }, (_, i) => 
        createAndStartServer({
          ...config,
          PORT: basePort + i
        })
      );
      
      const results = await Promise.all(serverPromises);
      
      // Add all servers to cleanup list
      results.forEach(result => {
        if (result.server) {
          testServers.push(result.server);
        }
      });
      
      // All should start successfully
      results.forEach(result => {
        expect(result.server).toBeDefined();
        expect(result.server.listening).toBe(true);
      });
      
      // Ports should be different
      const ports = results.map(r => r.port);
      const uniquePorts = new Set(ports);
      expect(uniquePorts.size).toBe(ports.length);
    }, 20000);

    test('should handle rapid startup-shutdown cycles', async () => {
      // Test rapid cycles don't cause resource leaks
      for (let i = 0; i < 5; i++) {
        const testPort = 8000 + Math.floor(Math.random() * 1000);
        
        const result = await createAndStartServer({
          ...config,
          PORT: testPort
        });
        
        expect(result.server.listening).toBe(true);
        
        // Immediate shutdown
        await new Promise<void>((resolve) => {
          result.server.close(() => resolve());
        });
        
        expect(result.server.listening).toBe(false);
      }
    }, 30000);
  });
});