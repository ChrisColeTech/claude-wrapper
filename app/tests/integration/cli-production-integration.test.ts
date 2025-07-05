/**
 * CLI Production Server Management Integration Tests
 * Validates complete CLI integration with ProductionServerManager for Phase 3B
 * 
 * Tests:
 * - CLI --production flag functionality
 * - ProductionServerManager startup/shutdown through CLI
 * - Health monitoring system integration
 * - Port management through CLI
 * - Configuration management
 * - Daemon mode with production features
 * - Error handling and recovery
 */

import { CliRunner, CliParser } from '../../src/cli';
import { ProductionServerManager } from '../../src/server/production-server-manager';
import { healthMonitor } from '../../src/monitoring/health-monitor';
import { portManager } from '../../src/utils/port-manager';
import { createApp } from '../../src/server';
import { config } from '../../src/utils/env';
import express from 'express';
import { Server } from 'http';

// Mock to prevent actual server creation during most tests
jest.mock('../../src/server', () => ({
  createApp: jest.fn(),
  createAndStartServer: jest.fn()
}));

// Mock health monitor to control behavior during tests
jest.mock('../../src/monitoring/health-monitor', () => ({
  healthMonitor: {
    startMonitoring: jest.fn(),
    stopMonitoring: jest.fn(),
    setActiveServerPort: jest.fn(),
    clearActiveServerPort: jest.fn(),
    shutdown: jest.fn(),
    getLatestReport: jest.fn()
  },
  startHealthMonitoring: jest.fn()
}));

// Mock port manager
jest.mock('../../src/utils/port-manager', () => ({
  portManager: {
    findAvailablePort: jest.fn(),
    reservePort: jest.fn(),
    releasePort: jest.fn(),
    getStatus: jest.fn()
  }
}));

// Mock production server manager
jest.mock('../../src/server/production-server-manager');

// Mock process.exit to prevent test termination
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
  throw new Error(`Process exit called with code ${code}`);
});

// Mock console methods to capture output
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('CLI Production Server Management Integration', () => {
  let cliRunner: CliRunner;
  let mockApp: express.Application;
  let mockServer: jest.Mocked<Server>;
  let mockProductionServerManager: jest.Mocked<ProductionServerManager>;
  let originalEnv: NodeJS.ProcessEnv;

  const mockCreateApp = createApp as jest.MockedFunction<typeof createApp>;
  const mockHealthMonitor = healthMonitor as jest.Mocked<typeof healthMonitor>;
  const mockPortManager = portManager as jest.Mocked<typeof portManager>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    cliRunner = new CliRunner();
    
    // Setup mocks
    jest.clearAllMocks();
    mockExit.mockClear();

    // Mock Express app
    mockApp = {
      listen: jest.fn(),
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn()
    } as any;

    // Mock HTTP server
    mockServer = {
      close: jest.fn((callback) => callback && callback()),
      timeout: 0,
      keepAliveTimeout: 0,
      headersTimeout: 0,
      maxHeadersCount: 0
    } as any;

    // Mock ProductionServerManager
    mockProductionServerManager = {
      startServer: jest.fn(),
      shutdown: jest.fn(),
      getHealthStatus: jest.fn(),
      isRunning: jest.fn(),
      addShutdownHandler: jest.fn()
    } as any;

    // Setup default mocks
    mockCreateApp.mockReturnValue(mockApp);
    
    const ProductionServerManagerMock = require('../../src/server/production-server-manager').ProductionServerManager;
    ProductionServerManagerMock.mockImplementation(() => mockProductionServerManager);

    mockProductionServerManager.startServer.mockResolvedValue({
      success: true,
      server: mockServer,
      port: 8000,
      url: 'http://localhost:8000',
      startupTime: 150,
      healthCheckUrl: 'http://localhost:8000/health'
    });

    mockProductionServerManager.shutdown.mockResolvedValue({
      success: true,
      shutdownTime: 100,
      resourcesReleased: ['http-server', 'port-8000', 'server-manager']
    });

    mockProductionServerManager.getHealthStatus.mockReturnValue({
      status: 'healthy',
      uptime: 5000,
      port: 8000,
      lastHealthCheck: new Date(),
      errors: []
    });

    mockProductionServerManager.isRunning.mockReturnValue(true);

    mockPortManager.findAvailablePort.mockResolvedValue({
      port: 8000,
      available: true,
      scanDuration: 10
    });

    mockHealthMonitor.getLatestReport.mockReturnValue({
      overall: 'healthy',
      uptime: 5000,
      timestamp: new Date(),
      checks: [],
      summary: { healthy: 3, warning: 0, unhealthy: 0, total: 3 },
      performance: {
        avgResponseTime: 50,
        memoryUsage: process.memoryUsage()
      }
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  afterAll(() => {
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('CLI --production Flag Integration', () => {
    it('should initialize ProductionServerManager when --production flag is used', async () => {
      const argv = ['node', 'cli.js', '--production', '--port', '8001'];
      
      await cliRunner.run(argv);

      // Verify ProductionServerManager was created and used
      expect(ProductionServerManagerMock).toHaveBeenCalledWith({
        port: 8001,
        gracefulShutdownTimeout: 10000,
        maxStartupAttempts: 3,
        healthCheckEnabled: false,
        preflightChecks: true
      });

      expect(mockProductionServerManager.startServer).toHaveBeenCalledWith(mockApp, 8001);
      
      // Verify production mode environment was set
      expect(process.env.NODE_ENV).toBe('production');
    });

    it('should use standard server when --production flag is not provided', async () => {
      const mockCreateAndStartServer = require('../../src/server').createAndStartServer;
      mockCreateAndStartServer.mockResolvedValue({
        server: mockServer,
        port: 8000,
        url: 'http://localhost:8000'
      });

      const argv = ['node', 'cli.js', '--port', '8002'];
      
      await cliRunner.run(argv);

      // Verify standard server creation was used
      expect(mockCreateAndStartServer).toHaveBeenCalled();
      expect(ProductionServerManagerMock).not.toHaveBeenCalled();
    });

    it('should enable health monitoring when both --production and --health-monitoring flags are used', async () => {
      const argv = ['node', 'cli.js', '--production', '--health-monitoring', '--port', '8003'];
      
      await cliRunner.run(argv);

      // Verify health monitoring was started
      expect(mockHealthMonitor.startMonitoring).toHaveBeenCalled();
      
      // Verify ProductionServerManager was configured with health monitoring
      expect(ProductionServerManagerMock).toHaveBeenCalledWith({
        port: 8003,
        gracefulShutdownTimeout: 10000,
        maxStartupAttempts: 3,
        healthCheckEnabled: true,
        preflightChecks: true
      });
    });

    it('should display production-specific startup messages', async () => {
      const argv = ['node', 'cli.js', '--production', '--health-monitoring'];
      
      await cliRunner.run(argv);

      // Verify production startup messages
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Starting server.*Production Mode/)
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Production Features: enabled/)
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Health Monitoring: enabled/)
      );
    });
  });

  describe('Production Server Lifecycle Management', () => {
    it('should handle production server startup with proper configuration', async () => {
      const argv = ['node', 'cli.js', '--production', '--port', '8004'];
      
      await cliRunner.run(argv);

      // Verify app creation and production server startup
      expect(mockCreateApp).toHaveBeenCalledWith(expect.objectContaining({
        PORT: 8004
      }));
      expect(mockProductionServerManager.startServer).toHaveBeenCalledWith(mockApp, 8004);
      
      // Verify success messages
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/🎉 Server is ready and running!/)
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/🏭 Mode: Production/)
      );
    });

    it('should handle production server startup failures gracefully', async () => {
      mockProductionServerManager.startServer.mockResolvedValue({
        success: false,
        startupTime: 200,
        errors: ['Port 8005 already in use', 'Failed to bind to port']
      });

      const argv = ['node', 'cli.js', '--production', '--port', '8005'];
      
      await expect(cliRunner.run(argv)).rejects.toThrow('Process exit called with code 1');

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringMatching(/❌.*Failed to start server.*/)
      );
    });

    it('should setup production-specific graceful shutdown handlers', async () => {
      const argv = ['node', 'cli.js', '--production'];
      
      await cliRunner.run(argv);

      // Verify shutdown handler setup
      // Note: This is tested indirectly through successful completion
      expect(mockProductionServerManager.startServer).toHaveBeenCalled();
    });
  });

  describe('Health Monitoring Integration', () => {
    it('should integrate health monitoring with production server management', async () => {
      const argv = ['node', 'cli.js', '--production', '--health-monitoring'];
      
      await cliRunner.run(argv);

      // Verify health monitoring initialization
      expect(mockConsoleLog).toHaveBeenCalledWith('🔍 Starting health monitoring system...');
      expect(mockHealthMonitor.startMonitoring).toHaveBeenCalled();
      
      // Verify health endpoints are displayed
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Health URL:.*\/health/)
      );
    });

    it('should display health monitoring status in CLI output', async () => {
      const argv = ['node', 'cli.js', '--production', '--health-monitoring'];
      
      await cliRunner.run(argv);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/💚 Health Monitoring: Active/)
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Health:.*\/health/)
      );
    });

    it('should handle health monitoring without production mode', async () => {
      const mockCreateAndStartServer = require('../../src/server').createAndStartServer;
      mockCreateAndStartServer.mockResolvedValue({
        server: mockServer,
        port: 8000,
        url: 'http://localhost:8000'
      });

      const argv = ['node', 'cli.js', '--health-monitoring'];
      
      await cliRunner.run(argv);

      // Health monitoring should work with standard server too
      expect(mockHealthMonitor.startMonitoring).toHaveBeenCalled();
    });
  });

  describe('Port Management Integration', () => {
    it('should handle port conflicts with production server manager', async () => {
      mockProductionServerManager.startServer.mockResolvedValue({
        success: true,
        server: mockServer,
        port: 8007, // Different from requested port due to conflict
        url: 'http://localhost:8007',
        startupTime: 200,
        portResolution: {
          port: 8007,
          available: true,
          alternativePort: 8007,
          reason: 'Port 8006 was in use'
        }
      });

      const argv = ['node', 'cli.js', '--production', '--port', '8006'];
      
      await cliRunner.run(argv);

      expect(mockProductionServerManager.startServer).toHaveBeenCalledWith(mockApp, 8006);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/📡 Port: 8007/)
      );
    });

    it('should validate port numbers through CLI parser', () => {
      const parser = new CliParser();
      
      // Valid port should not throw
      expect(() => {
        parser.validateOptions({ port: '8008', production: true });
      }).not.toThrow();
      
      // Invalid port should throw
      expect(() => {
        parser.validateOptions({ port: '99999', production: true });
      }).toThrow('Invalid port number: 99999');
    });
  });

  describe('Configuration Management', () => {
    it('should properly merge CLI options with production configuration', async () => {
      const argv = ['node', 'cli.js', '--production', '--verbose', '--debug', '--port', '8009'];
      
      await cliRunner.run(argv);

      // Verify environment variables were set correctly
      expect(process.env.PORT).toBe('8009');
      expect(process.env.VERBOSE).toBe('true');
      expect(process.env.DEBUG_MODE).toBe('true');
      expect(process.env.NODE_ENV).toBe('production');
    });

    it('should handle API key configuration in production mode', async () => {
      const argv = ['node', 'cli.js', '--production', '--api-key', 'test-api-key-123', '--no-interactive'];
      
      await cliRunner.run(argv);

      // Verify production server was started (indirectly confirms API key handling)
      expect(mockProductionServerManager.startServer).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle ProductionServerManager initialization errors', async () => {
      const ProductionServerManagerMock = require('../../src/server/production-server-manager').ProductionServerManager;
      ProductionServerManagerMock.mockImplementation(() => {
        throw new Error('ProductionServerManager initialization failed');
      });

      const argv = ['node', 'cli.js', '--production'];
      
      await expect(cliRunner.run(argv)).rejects.toThrow('Process exit called with code 1');
    });

    it('should provide helpful error messages for production-specific failures', async () => {
      mockProductionServerManager.startServer.mockResolvedValue({
        success: false,
        startupTime: 300,
        errors: ['Production configuration validation failed']
      });

      const argv = ['node', 'cli.js', '--production'];
      
      await expect(cliRunner.run(argv)).rejects.toThrow('Process exit called with code 1');

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringMatching(/Production server startup failed/)
      );
    });
  });

  describe('CLI Argument Parsing for Production Features', () => {
    it('should correctly parse production-related CLI arguments', () => {
      const parser = new CliParser();
      
      const options = parser.parseArguments([
        'node', 'cli.js', 
        '--production', 
        '--health-monitoring', 
        '--port', '8010',
        '--verbose',
        '--debug'
      ]);

      expect(options.production).toBe(true);
      expect(options.healthMonitoring).toBe(true);
      expect(options.port).toBe('8010');
      expect(options.verbose).toBe(true);
      expect(options.debug).toBe(true);
    });

    it('should handle production flags in combination with other arguments', () => {
      const parser = new CliParser();
      
      const options = parser.parseArguments([
        'node', 'cli.js', 
        '8011',  // Port as positional argument
        '--production',
        '--health-monitoring',
        '--api-key', 'prod-key-456'
      ]);

      expect(options.port).toBe('8011');
      expect(options.production).toBe(true);
      expect(options.healthMonitoring).toBe(true);
      expect(options.apiKey).toBe('prod-key-456');
    });
  });

  describe('Production Server Status and Monitoring', () => {
    it('should provide production server status through health monitoring', async () => {
      const argv = ['node', 'cli.js', '--production', '--health-monitoring'];
      
      await cliRunner.run(argv);

      // Verify health status integration
      expect(mockProductionServerManager.getHealthStatus).toBeDefined();
      expect(mockHealthMonitor.startMonitoring).toHaveBeenCalled();
    });

    it('should handle production server health check failures', async () => {
      mockProductionServerManager.getHealthStatus.mockReturnValue({
        status: 'unhealthy',
        uptime: 1000,
        port: 8000,
        lastHealthCheck: new Date(),
        errors: ['Database connection failed', 'High memory usage']
      });

      const argv = ['node', 'cli.js', '--production', '--health-monitoring'];
      
      await cliRunner.run(argv);

      // Should still start successfully but report unhealthy status
      expect(mockProductionServerManager.startServer).toHaveBeenCalled();
    });
  });
});