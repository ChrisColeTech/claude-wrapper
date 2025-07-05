/**
 * Production Server Manager Unit Tests
 * Comprehensive tests for production server lifecycle management
 * Tests startup, shutdown, health monitoring, and production-grade features
 */

import express from 'express';
import { Server } from 'http';
import { ProductionServerManager, ServerStartupResult, ServerShutdownResult } from '../../../src/server/production-server-manager';
import { ServerManager } from '../../../src/server/server-manager';
import { portManager } from '../../../src/utils/port-manager';
import { productionConfig } from '../../../config/production.config';

// Mock dependencies
jest.mock('../../../src/server/server-manager');
jest.mock('../../../src/utils/port-manager');
jest.mock('../../../config/production.config');
jest.mock('../../../src/utils/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

const mockServerManager = ServerManager as jest.MockedClass<typeof ServerManager>;
const mockPortManager = portManager as jest.Mocked<typeof portManager>;
const mockProductionConfig = productionConfig as jest.Mocked<typeof productionConfig>;

describe('ProductionServerManager', () => {
  let productionServerManager: ProductionServerManager;
  let mockApp: express.Application;
  let mockServer: jest.Mocked<Server>;
  let mockServerManagerInstance: jest.Mocked<ServerManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup mock Express app
    mockApp = {
      listen: jest.fn()
    } as any;

    // Setup mock HTTP server
    mockServer = {
      close: jest.fn(),
      timeout: 0,
      keepAliveTimeout: 0,
      headersTimeout: 0,
      maxHeadersCount: 0
    } as any;

    // Setup mock ServerManager instance
    mockServerManagerInstance = {
      startServer: jest.fn(),
      shutdown: jest.fn()
    } as any;

    mockServerManager.mockImplementation(() => mockServerManagerInstance);

    // Setup production config mocks
    mockProductionConfig.getServerConfig.mockReturnValue({
      port: 3000,
      host: '0.0.0.0',
      timeout: 30000,
      keepAliveTimeout: 5000,
      headersTimeout: 10000,
      maxHeaderSize: 8192,
      bodyParserLimit: '10mb'
    });

    mockProductionConfig.getMonitoringConfig.mockReturnValue({
      healthCheckEnabled: true,
      healthCheckInterval: 30000,
      metricsEnabled: false,
      metricsPort: 9090,
      alertingEnabled: false,
      uptimeThreshold: 0.99
    });

    // Setup port manager mocks
    mockPortManager.findAvailablePort.mockResolvedValue({
      port: 3000,
      available: true,
      scanDuration: 50
    });

    mockPortManager.reservePort.mockResolvedValue(true);
    mockPortManager.releasePort.mockReturnValue(true);

    // Create fresh instance for each test
    productionServerManager = new ProductionServerManager({
      gracefulShutdownTimeout: 5000,
      maxStartupAttempts: 2,
      startupRetryDelay: 100
    });
  });

  afterEach(async () => {
    await productionServerManager.shutdown();
    jest.useRealTimers();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default production configuration', () => {
      const manager = new ProductionServerManager();
      
      expect(mockProductionConfig.getServerConfig).toHaveBeenCalled();
      expect(mockProductionConfig.getMonitoringConfig).toHaveBeenCalled();
      expect(manager).toBeInstanceOf(ProductionServerManager);
    });

    it('should accept custom configuration overrides', () => {
      const customConfig = {
        port: 4000,
        gracefulShutdownTimeout: 15000,
        maxStartupAttempts: 5
      };
      
      const manager = new ProductionServerManager(customConfig);
      
      expect(manager).toBeInstanceOf(ProductionServerManager);
      manager.shutdown();
    });

    it('should setup signal handlers for graceful shutdown', () => {
      const processOnSpy = jest.spyOn(process, 'on');
      
      new ProductionServerManager();
      
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGUSR2', expect.any(Function));
      
      processOnSpy.mockRestore();
    });
  });

  describe('Server Startup', () => {
    beforeEach(() => {
      mockServerManagerInstance.startServer.mockResolvedValue({
        server: mockServer,
        port: 3000,
        url: 'http://localhost:3000'
      });
    });

    it('should start server successfully with available port', async () => {
      const result = await productionServerManager.startServer(mockApp, 3000);
      
      expect(result.success).toBe(true);
      expect(result.port).toBe(3000);
      expect(result.url).toBe('http://localhost:3000');
      expect(result.server).toBe(mockServer);
      expect(result.startupTime).toBeGreaterThanOrEqual(0);
      expect(result.portResolution).toBeDefined();
      expect(result.healthCheckUrl).toBe('http://localhost:3000/health');
    });

    it('should use default port when no preferred port specified', async () => {
      const result = await productionServerManager.startServer(mockApp);
      
      expect(mockPortManager.findAvailablePort).toHaveBeenCalledWith(3000);
      expect(result.success).toBe(true);
    });

    it('should handle port conflict resolution', async () => {
      mockPortManager.findAvailablePort.mockResolvedValue({
        port: 3001,
        available: true,
        reason: 'Port 3000 was unavailable',
        alternativePort: 3001,
        scanDuration: 75
      });

      mockServerManagerInstance.startServer.mockResolvedValue({
        server: mockServer,
        port: 3001,
        url: 'http://localhost:3001'
      });

      const result = await productionServerManager.startServer(mockApp, 3000);
      
      expect(result.success).toBe(true);
      expect(result.port).toBe(3001);
      expect(result.portResolution!.alternativePort).toBe(3001);
      expect(mockPortManager.reservePort).toHaveBeenCalledWith(3001, 'production-server', 'ProductionServerManager');
    });

    it('should run preflight checks before startup', async () => {
      const result = await productionServerManager.startServer(mockApp);
      
      expect(result.success).toBe(true);
      expect(mockProductionConfig.getConfigSummary).toHaveBeenCalled();
      expect(mockPortManager.getStatus).toHaveBeenCalled();
    });

    it('should configure production server settings', async () => {
      await productionServerManager.startServer(mockApp);
      
      expect(mockServer.timeout).toBe(30000);
      expect(mockServer.keepAliveTimeout).toBe(5000);
      expect(mockServer.headersTimeout).toBe(10000);
      expect(mockServer.maxHeadersCount).toBe(100);
    });

    it('should display user-friendly startup messages', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await productionServerManager.startServer(mockApp);
      
      expect(consoleSpy).toHaveBeenCalledWith('\n🚀 Server starting on http://localhost:3000');
      expect(consoleSpy).toHaveBeenCalledWith('📝 Update your client base_url to: http://localhost:3000/v1');
      
      consoleSpy.mockRestore();
    });

    it('should retry startup on failures', async () => {
      mockServerManagerInstance.startServer
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce({
          server: mockServer,
          port: 3000,
          url: 'http://localhost:3000'
        });

      const result = await productionServerManager.startServer(mockApp);
      
      expect(result.success).toBe(true);
      expect(mockServerManagerInstance.startServer).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retry attempts', async () => {
      mockServerManagerInstance.startServer.mockRejectedValue(new Error('Startup failed'));
      
      const result = await productionServerManager.startServer(mockApp);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Startup failed');
      expect(mockServerManagerInstance.startServer).toHaveBeenCalledTimes(2); // maxStartupAttempts
      expect(mockPortManager.releasePort).toHaveBeenCalledWith(3000);
    });

    it('should handle port unavailability gracefully', async () => {
      mockPortManager.findAvailablePort.mockResolvedValue({
        port: 3000,
        available: false,
        reason: 'No available ports found',
        scanDuration: 100
      });

      const result = await productionServerManager.startServer(mockApp);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('No available ports found: No available ports found');
    });

    it('should handle invalid Express app gracefully', async () => {
      const invalidApp = null as any;
      
      const result = await productionServerManager.startServer(invalidApp);
      
      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Invalid Express application provided');
    });

    it('should measure startup time accurately', async () => {
      const result = await productionServerManager.startServer(mockApp);
      
      expect(result.startupTime).toBeGreaterThanOrEqual(0);
      expect(result.startupTime).toBeLessThan(1000); // Should be fast in tests
    });
  });

  describe('Server Shutdown', () => {
    beforeEach(async () => {
      mockServerManagerInstance.startServer.mockResolvedValue({
        server: mockServer,
        port: 3000,
        url: 'http://localhost:3000'
      });
      
      await productionServerManager.startServer(mockApp);
    });

    it('should shutdown gracefully with proper cleanup', async () => {
      mockServer.close.mockImplementation((callback: any) => {
        setTimeout(() => callback(), 10);
        return mockServer;
      });

      const result = await productionServerManager.shutdown();
      
      expect(result.success).toBe(true);
      expect(result.shutdownTime).toBeGreaterThanOrEqual(0);
      expect(result.resourcesReleased).toContain('http-server');
      expect(result.resourcesReleased).toContain('port-3000');
      expect(result.resourcesReleased).toContain('server-manager');
    });

    it('should handle server close timeout', async () => {
      mockServer.close.mockImplementation(() => {
        // Never calls callback - simulates timeout
        return mockServer;
      });

      const result = await productionServerManager.shutdown();
      
      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Server shutdown timeout');
    });

    it('should handle multiple shutdown calls gracefully', async () => {
      const firstShutdown = productionServerManager.shutdown();
      const secondShutdown = productionServerManager.shutdown();
      
      const [result1, result2] = await Promise.all([firstShutdown, secondShutdown]);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.resourcesReleased).toContain('shutdown-already-in-progress');
    });

    it('should execute custom shutdown handlers', async () => {
      const customHandler = jest.fn().mockResolvedValue(undefined);
      productionServerManager.addShutdownHandler(customHandler);
      
      mockServer.close.mockImplementation((callback: any) => {
        setTimeout(() => callback(), 10);
        return mockServer;
      });

      const result = await productionServerManager.shutdown();
      
      expect(customHandler).toHaveBeenCalled();
      expect(result.resourcesReleased).toContain('custom-handler');
    });

    it('should handle failing shutdown handlers gracefully', async () => {
      const failingHandler = jest.fn().mockRejectedValue(new Error('Handler failed'));
      productionServerManager.addShutdownHandler(failingHandler);
      
      mockServer.close.mockImplementation((callback: any) => {
        setTimeout(() => callback(), 10);
        return mockServer;
      });

      const result = await productionServerManager.shutdown();
      
      expect(result.success).toBe(true); // Should continue despite handler failure
    });

    it('should release port reservation on shutdown', async () => {
      await productionServerManager.shutdown();
      
      expect(mockPortManager.releasePort).toHaveBeenCalledWith(3000);
    });

    it('should shutdown server manager', async () => {
      await productionServerManager.shutdown();
      
      expect(mockServerManagerInstance.shutdown).toHaveBeenCalled();
    });

    it('should measure shutdown time', async () => {
      mockServer.close.mockImplementation((callback: any) => {
        setTimeout(() => callback(), 50);
        return mockServer;
      });

      const result = await productionServerManager.shutdown();
      
      expect(result.shutdownTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Health Status Monitoring', () => {
    it('should report unhealthy when server not running', () => {
      const health = productionServerManager.getHealthStatus();
      
      expect(health.status).toBe('unhealthy');
      expect(health.uptime).toBe(0);
      expect(health.port).toBe(0);
      expect(health.errors).toContain('Server not running');
    });

    it('should report healthy when server is running', async () => {
      await productionServerManager.startServer(mockApp);
      
      const health = productionServerManager.getHealthStatus();
      
      expect(health.status).toBe('healthy');
      expect(health.uptime).toBeGreaterThanOrEqual(0);
      expect(health.port).toBe(3000);
      expect(health.errors).toHaveLength(0);
    });

    it('should report stopping during shutdown', async () => {
      await productionServerManager.startServer(mockApp);
      
      // Start shutdown but don't await it
      const shutdownPromise = productionServerManager.shutdown();
      
      const health = productionServerManager.getHealthStatus();
      
      expect(health.status).toBe('stopping');
      expect(health.port).toBe(3000);
      
      await shutdownPromise;
    });

    it('should track uptime accurately', async () => {
      await productionServerManager.startServer(mockApp);
      
      jest.advanceTimersByTime(5000); // 5 seconds
      
      const health = productionServerManager.getHealthStatus();
      
      expect(health.uptime).toBeGreaterThanOrEqual(5000);
    });

    it('should provide last health check timestamp', async () => {
      await productionServerManager.startServer(mockApp);
      
      const beforeCheck = Date.now();
      const health = productionServerManager.getHealthStatus();
      const afterCheck = Date.now();
      
      expect(health.lastHealthCheck.getTime()).toBeGreaterThanOrEqual(beforeCheck);
      expect(health.lastHealthCheck.getTime()).toBeLessThanOrEqual(afterCheck);
    });
  });

  describe('Server State Management', () => {
    it('should track running state correctly', async () => {
      expect(productionServerManager.isRunning()).toBe(false);
      
      await productionServerManager.startServer(mockApp);
      expect(productionServerManager.isRunning()).toBe(true);
      
      await productionServerManager.shutdown();
      expect(productionServerManager.isRunning()).toBe(false);
    });

    it('should handle startup failures without changing state', async () => {
      mockPortManager.findAvailablePort.mockResolvedValue({
        port: 3000,
        available: false,
        reason: 'No ports available',
        scanDuration: 100
      });

      const result = await productionServerManager.startServer(mockApp);
      
      expect(result.success).toBe(false);
      expect(productionServerManager.isRunning()).toBe(false);
    });

    it('should allow multiple startup attempts after failure', async () => {
      // First attempt fails
      mockPortManager.findAvailablePort.mockResolvedValueOnce({
        port: 3000,
        available: false,
        reason: 'Port unavailable',
        scanDuration: 50
      });

      const firstResult = await productionServerManager.startServer(mockApp);
      expect(firstResult.success).toBe(false);

      // Second attempt succeeds
      mockPortManager.findAvailablePort.mockResolvedValueOnce({
        port: 3000,
        available: true,
        scanDuration: 25
      });

      const secondResult = await productionServerManager.startServer(mockApp);
      expect(secondResult.success).toBe(true);
    });
  });

  describe('Performance Requirements', () => {
    it('should complete startup within 3 seconds', async () => {
      const startTime = Date.now();
      await productionServerManager.startServer(mockApp);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(3000);
    });

    it('should complete shutdown within 2 seconds', async () => {
      await productionServerManager.startServer(mockApp);
      
      mockServer.close.mockImplementation((callback: any) => {
        setTimeout(() => callback(), 100);
        return mockServer;
      });

      const startTime = Date.now();
      await productionServerManager.shutdown();
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(2000);
    });

    it('should handle concurrent startup attempts efficiently', async () => {
      // This should not actually start multiple servers, but should handle concurrent calls gracefully
      const promises = [
        productionServerManager.startServer(mockApp, 3000),
        productionServerManager.startServer(mockApp, 3001),
        productionServerManager.startServer(mockApp, 3002)
      ];
      
      const results = await Promise.all(promises);
      
      // Only one should succeed (the first one)
      const successfulResults = results.filter(r => r.success);
      expect(successfulResults).toHaveLength(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle server manager initialization errors', () => {
      mockServerManager.mockImplementation(() => {
        throw new Error('ServerManager creation failed');
      });

      expect(() => new ProductionServerManager()).toThrow('ServerManager creation failed');
    });

    it('should handle port manager errors gracefully', async () => {
      mockPortManager.findAvailablePort.mockRejectedValue(new Error('Port manager failed'));
      
      const result = await productionServerManager.startServer(mockApp);
      
      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Port manager failed');
    });

    it('should handle configuration retrieval errors', () => {
      mockProductionConfig.getServerConfig.mockImplementation(() => {
        throw new Error('Config error');
      });

      expect(() => new ProductionServerManager()).toThrow('Config error');
    });

    it('should handle signal handler errors gracefully', () => {
      const processOnSpy = jest.spyOn(process, 'on').mockImplementation(() => {
        throw new Error('Signal handler error');
      });

      expect(() => new ProductionServerManager()).toThrow('Signal handler error');
      
      processOnSpy.mockRestore();
    });
  });

  describe('Custom Shutdown Handlers', () => {
    it('should allow adding multiple shutdown handlers', () => {
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);
      
      productionServerManager.addShutdownHandler(handler1);
      productionServerManager.addShutdownHandler(handler2);
      
      // Handlers should be stored (no direct way to test, but no errors should occur)
      expect(() => productionServerManager.addShutdownHandler(handler1)).not.toThrow();
    });

    it('should execute handlers in order during shutdown', async () => {
      const executionOrder: number[] = [];
      
      const handler1 = jest.fn().mockImplementation(async () => {
        executionOrder.push(1);
      });
      
      const handler2 = jest.fn().mockImplementation(async () => {
        executionOrder.push(2);
      });
      
      productionServerManager.addShutdownHandler(handler1);
      productionServerManager.addShutdownHandler(handler2);
      
      await productionServerManager.startServer(mockApp);
      
      mockServer.close.mockImplementation((callback: any) => {
        setTimeout(() => callback(), 10);
        return mockServer;
      });

      await productionServerManager.shutdown();
      
      expect(executionOrder).toEqual([1, 2]);
    });
  });
});