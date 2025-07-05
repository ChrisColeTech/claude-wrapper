/**
 * Comprehensive Unit Test Suite for Health Service
 * Phase 11B Implementation: Complete health service tests
 * Based on Python main.py:680-683 health_check endpoint behavior
 */

import { HealthRouter, HealthResponse, DetailedHealthResponse } from '../../../src/routes/health';

describe('Health Service Unit Tests', () => {
  beforeEach(() => {
    // Reset any environmental state
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    jest.restoreAllMocks();
  });

  describe('HealthRouter static properties and methods', () => {
    it('should initialize with correct start time', () => {
      const testStartTime = Date.now() - 1000;
      HealthRouter.setStartTime(testStartTime);
      
      const uptime = HealthRouter.getUptime();
      expect(uptime).toBeGreaterThan(900); // Should be close to 1000ms
      expect(uptime).toBeLessThan(1100);
    });

    it('should calculate uptime correctly', () => {
      const testStartTime = Date.now() - 5000; // 5 seconds ago
      HealthRouter.setStartTime(testStartTime);
      
      const uptime = HealthRouter.getUptime();
      expect(uptime).toBeGreaterThan(4900);
      expect(uptime).toBeLessThan(5100);
    });

    it('should handle start time updates correctly', () => {
      const firstStartTime = Date.now() - 2000;
      const secondStartTime = Date.now() - 1000;
      
      HealthRouter.setStartTime(firstStartTime);
      const firstUptime = HealthRouter.getUptime();
      
      HealthRouter.setStartTime(secondStartTime);
      const secondUptime = HealthRouter.getUptime();
      
      expect(firstUptime).toBeGreaterThan(secondUptime);
    });
  });

  describe('isHealthy method', () => {
    it('should return true under normal memory conditions', () => {
      // Mock normal memory usage (50% usage)
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 50 * 1024 * 1024, // 50MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
        rss: 120 * 1024 * 1024
      });

      expect(HealthRouter.isHealthy()).toBe(true);
    });

    it('should return false under high memory conditions', () => {
      // Mock high memory usage (95% usage)
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 95 * 1024 * 1024, // 95MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
        rss: 120 * 1024 * 1024
      });

      expect(HealthRouter.isHealthy()).toBe(false);
    });

    it('should return true when memory usage exactly at threshold', () => {
      // Mock memory usage at exactly 90% (threshold)
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 90 * 1024 * 1024, // 90MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
        rss: 120 * 1024 * 1024
      });

      expect(HealthRouter.isHealthy()).toBe(true);
    });

    it('should return false when memory usage calculation throws error', () => {
      // Mock process.memoryUsage to throw an error
      jest.spyOn(process, 'memoryUsage').mockImplementation(() => {
        throw new Error('Memory access failed');
      });

      expect(HealthRouter.isHealthy()).toBe(false);
    });

    it('should handle edge case with zero memory values', () => {
      // Mock zero memory values (should not happen in practice)
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        arrayBuffers: 0,
        rss: 0
      });

      // This would cause division by zero, should handle gracefully
      expect(() => HealthRouter.isHealthy()).not.toThrow();
    });
  });

  describe('authentication status detection', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Clear all auth-related environment variables
      process.env = {
        ...originalEnv,
        ANTHROPIC_API_KEY: undefined,
        CLAUDE_CONFIG_DIR: undefined,
        AWS_ACCESS_KEY_ID: undefined,
        AWS_SECRET_ACCESS_KEY: undefined,
        GOOGLE_APPLICATION_CREDENTIALS: undefined
      };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should detect no authentication when no credentials present', () => {
      // Use reflection to access private method for unit testing
      const checkAuthStatus = (HealthRouter as any).checkAuthenticationStatus;
      expect(checkAuthStatus()).toBe('not_configured');
    });

    it('should detect Anthropic API key authentication', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test123';
      const checkAuthStatus = (HealthRouter as any).checkAuthenticationStatus;
      expect(checkAuthStatus()).toBe('configured');
    });

    it('should detect Claude config directory authentication', () => {
      process.env.CLAUDE_CONFIG_DIR = '/home/user/.claude';
      const checkAuthStatus = (HealthRouter as any).checkAuthenticationStatus;
      expect(checkAuthStatus()).toBe('configured');
    });

    it('should detect AWS credentials authentication', () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIATEST123';
      process.env.AWS_SECRET_ACCESS_KEY = 'secret123';
      const checkAuthStatus = (HealthRouter as any).checkAuthenticationStatus;
      expect(checkAuthStatus()).toBe('configured');
    });

    it('should require both AWS credentials to be configured', () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIATEST123';
      // Missing AWS_SECRET_ACCESS_KEY
      const checkAuthStatus = (HealthRouter as any).checkAuthenticationStatus;
      expect(checkAuthStatus()).toBe('not_configured');
    });

    it('should detect Google credentials authentication', () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/credentials.json';
      const checkAuthStatus = (HealthRouter as any).checkAuthenticationStatus;
      expect(checkAuthStatus()).toBe('configured');
    });

    it('should detect authentication with multiple providers configured', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test123';
      process.env.AWS_ACCESS_KEY_ID = 'AKIATEST123';
      process.env.AWS_SECRET_ACCESS_KEY = 'secret123';
      const checkAuthStatus = (HealthRouter as any).checkAuthenticationStatus;
      expect(checkAuthStatus()).toBe('configured');
    });

    it('should handle empty string environment variables', () => {
      process.env.ANTHROPIC_API_KEY = '';
      process.env.CLAUDE_CONFIG_DIR = '';
      const checkAuthStatus = (HealthRouter as any).checkAuthenticationStatus;
      expect(checkAuthStatus()).toBe('not_configured');
    });
  });

  describe('router creation', () => {
    it('should create router with correct endpoints', () => {
      const router = HealthRouter.createRouter();
      expect(router).toBeDefined();
      
      // Check that router has the expected structure
      expect(typeof router.get).toBe('function');
      expect(typeof router.post).toBe('function');
      expect(typeof router.use).toBe('function');
    });

    it('should configure GET /health endpoint', () => {
      const router = HealthRouter.createRouter();
      
      // Check that the router has been configured with routes
      expect(router.stack).toBeDefined();
      expect(router.stack.length).toBeGreaterThan(0);
    });

    it('should configure GET /health/detailed endpoint', () => {
      const router = HealthRouter.createRouter();
      
      // Verify multiple routes are configured
      expect(router.stack.length).toBe(4); // Basic health + detailed health + production health + monitoring health
    });
  });

  describe('memory usage calculations', () => {
    it('should calculate memory percentage correctly', () => {
      // Mock specific memory values for percentage calculation
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 25 * 1024 * 1024, // 25MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 10 * 1024 * 1024,
        arrayBuffers: 5 * 1024 * 1024,
        rss: 120 * 1024 * 1024
      });

      // Test isHealthy calculation
      expect(HealthRouter.isHealthy()).toBe(true); // 25% usage should be healthy
    });

    it('should handle very low memory usage', () => {
      // Mock very low memory usage
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 1024 * 1024, // 1MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 0,
        arrayBuffers: 0,
        rss: 10 * 1024 * 1024
      });

      expect(HealthRouter.isHealthy()).toBe(true); // 1% usage should be healthy
    });

    it('should handle boundary condition at 89% usage', () => {
      // Mock memory usage just below threshold
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 89 * 1024 * 1024, // 89MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024,
        rss: 110 * 1024 * 1024
      });

      expect(HealthRouter.isHealthy()).toBe(true); // 89% usage should be healthy
    });

    it('should handle boundary condition at 91% usage', () => {
      // Mock memory usage just above threshold
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 91 * 1024 * 1024, // 91MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024,
        rss: 110 * 1024 * 1024
      });

      expect(HealthRouter.isHealthy()).toBe(false); // 91% usage should be unhealthy
    });
  });

  describe('performance characteristics', () => {
    it('should execute health check quickly', () => {
      const startTime = process.hrtime.bigint();
      
      const isHealthy = HealthRouter.isHealthy();
      
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1000000;
      
      expect(typeof isHealthy).toBe('boolean');
      expect(durationMs).toBeLessThan(10); // Should complete within 10ms
    });

    it('should handle multiple concurrent health checks', () => {
      const healthChecks = Array(100).fill(null).map(() => 
        HealthRouter.isHealthy()
      );
      
      healthChecks.forEach(result => {
        expect(typeof result).toBe('boolean');
      });
    });

    it('should maintain consistent uptime calculation performance', () => {
      HealthRouter.setStartTime(Date.now() - 1000);
      
      const startTime = process.hrtime.bigint();
      
      // Perform multiple uptime calculations
      for (let i = 0; i < 1000; i++) {
        HealthRouter.getUptime();
      }
      
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1000000;
      
      expect(durationMs).toBeLessThan(50); // 1000 calculations should complete within 50ms
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle system errors gracefully in health check', () => {
      // Mock system error during memory access
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(process, 'memoryUsage').mockImplementation(() => {
        throw new Error('System memory access denied');
      });

      expect(() => HealthRouter.isHealthy()).not.toThrow();
      expect(HealthRouter.isHealthy()).toBe(false);
      
      consoleSpy.mockRestore();
    });

    it('should handle negative start time correctly', () => {
      // Set start time in the future (negative uptime scenario)
      HealthRouter.setStartTime(Date.now() + 1000);
      
      const uptime = HealthRouter.getUptime();
      expect(uptime).toBeLessThan(0);
    });

    it('should handle very large uptime values', () => {
      // Set start time far in the past
      HealthRouter.setStartTime(0); // Unix epoch
      
      const uptime = HealthRouter.getUptime();
      expect(uptime).toBeGreaterThan(0);
      expect(uptime).toBeLessThan(Date.now() + 1000); // Should be reasonable
    });
  });
});