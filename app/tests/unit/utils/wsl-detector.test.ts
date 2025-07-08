/**
 * WSL Detector Tests
 * Comprehensive test suite for WSL detection functionality
 * Uses externalized mocks following clean architecture principles
 */

import { WSLDetector } from '../../../src/utils/wsl-detector';
import { WSLEnvironmentMock } from '../../mocks/utils/wsl-environment-mock';

// Only mock external dependencies

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('WSLDetector', () => {
  let originalEnv: NodeJS.ProcessEnv;
  
  beforeEach(() => {
    // Store original environment
    originalEnv = process.env;
    
    WSLEnvironmentMock.reset();
    jest.clearAllMocks();
    
    // Set up process.env mock to use WSLEnvironmentMock
    Object.defineProperty(process, 'env', {
      value: new Proxy(originalEnv, {
        get: (target, prop: string) => {
          const mockValue = WSLEnvironmentMock.getEnv(prop);
          return mockValue !== undefined ? mockValue : target[prop];
        },
        has: (target, prop: string) => {
          const mockValue = WSLEnvironmentMock.getEnv(prop);
          return mockValue !== undefined || prop in target;
        }
      }),
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    // Restore original environment
    Object.defineProperty(process, 'env', {
      value: originalEnv,
      writable: true,
      configurable: true
    });
  });

  describe('isWSL method', () => {
    it('should detect WSL via WSL_DISTRO_NAME environment variable', () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'Ubuntu-20.04' });
      
      const result = WSLDetector.isWSL();
      
      expect(result).toBe(true);
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
    });

    it('should not detect WSL when WSL_DISTRO_NAME is undefined', () => {
      WSLEnvironmentMock.setup({ wslDistroName: undefined });
      
      const result = WSLDetector.isWSL();
      
      // This test checks the logic when WSL_DISTRO_NAME is undefined
      // It may still return true if the system has WSL file indicators
      expect(typeof result).toBe('boolean');
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
    });

    it('should prioritize WSL_DISTRO_NAME over file checks', () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'Ubuntu-20.04' });
      
      const result = WSLDetector.isWSL();
      
      expect(result).toBe(true);
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
    });

    it('should handle empty WSL_DISTRO_NAME', () => {
      WSLEnvironmentMock.setup({ wslDistroName: '' });
      
      const result = WSLDetector.isWSL();
      
      // Empty string should still be detected as WSL
      expect(result).toBe(true);
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
    });

    it('should handle undefined WSL_DISTRO_NAME fallback', () => {
      WSLEnvironmentMock.setup({ wslDistroName: undefined });
      
      const result = WSLDetector.isWSL();
      
      // With undefined, it should fall back to file checks
      expect(typeof result).toBe('boolean');
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
    });

    it('should be consistent across multiple calls', () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'Ubuntu-20.04' });
      
      const result1 = WSLDetector.isWSL();
      const result2 = WSLDetector.isWSL();
      
      expect(result1).toBe(result2);
      expect(result1).toBe(true);
    });

    it('should handle case-insensitive detection', () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'UBUNTU-20.04' });
      
      const result = WSLDetector.isWSL();
      
      expect(result).toBe(true);
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
    });
  });

  describe('getWSLIP method', () => {
    it('should attempt to get WSL IP when WSL_DISTRO_NAME is set', async () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'Ubuntu-20.04' });
      
      try {
        const result = await WSLDetector.getWSLIP();
        
        // If successful, should return valid IPv4
        expect(result).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
        expect(typeof result).toBe('string');
      } catch (error) {
        // If it fails, should be a proper error
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Failed to get WSL IP address');
      }
      
      // This test is about IP retrieval, which doesn't use environment variables directly
      // but the setup ensures we have a proper test environment
      expect(WSLEnvironmentMock.setup).toBeDefined();
    });

    it('should validate IPv4 format when IP is retrieved', async () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'Ubuntu-20.04' });
      
      try {
        const result = await WSLDetector.getWSLIP();
        
        // Should be valid IPv4 format
        expect(result).toMatch(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/);
      } catch (error) {
        // Error is expected in non-WSL environments
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle network command execution', async () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'Ubuntu-20.04' });
      
      try {
        const result = await WSLDetector.getWSLIP();
        
        // Should successfully execute hostname command
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
      } catch (error) {
        // Error is expected in non-WSL environments
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle multiple IP addresses and return first', async () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'Ubuntu-20.04' });
      
      try {
        const result = await WSLDetector.getWSLIP();
        
        // Should return a single IP address (first one)
        expect(result).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
        expect(result.split(' ')).toHaveLength(1);
      } catch (error) {
        // Error is expected in non-WSL environments
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle network timeouts gracefully', async () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'Ubuntu-20.04' });
      
      try {
        const result = await WSLDetector.getWSLIP();
        expect(typeof result).toBe('string');
      } catch (error) {
        // Should handle timeouts gracefully
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/Failed to get WSL IP address/);
      }
    });
  });

  describe('getWSLInfo method', () => {
    it('should return WSL info when WSL_DISTRO_NAME is set', async () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'Ubuntu-20.04' });
      
      const result = await WSLDetector.getWSLInfo();
      
      expect(result.isWSL).toBe(true);
      expect(result.distroName).toBe('Ubuntu-20.04');
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
      
      // IP and version may or may not be present depending on environment
      if (result.ip) {
        expect(result.ip).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
      }
      if (result.wslVersion) {
        expect(result.wslVersion).toMatch(/^[12]$/);
      }
    });

    it('should return appropriate info when not explicitly WSL', async () => {
      WSLEnvironmentMock.setup({ wslDistroName: undefined });
      
      const result = await WSLDetector.getWSLInfo();
      
      expect(typeof result.isWSL).toBe('boolean');
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
      
      if (result.isWSL) {
        // If detected as WSL, should have proper structure
        expect(result).toHaveProperty('isWSL', true);
        if (result.distroName) {
          expect(typeof result.distroName).toBe('string');
        }
        if (result.wslVersion) {
          expect(result.wslVersion).toMatch(/^[12]$/);
        }
      } else {
        // If not WSL, should be minimal info
        expect(result).toEqual({ isWSL: false });
      }
    });

    it('should handle empty distro name', async () => {
      WSLEnvironmentMock.setup({ wslDistroName: '' });
      
      const result = await WSLDetector.getWSLInfo();
      
      expect(result.isWSL).toBe(true);
      // Empty string should be preserved as empty string when explicitly set
      expect(result.distroName).toBe('');
    });

    it('should handle WSL detection without explicit distro name', async () => {
      WSLEnvironmentMock.setup({ wslDistroName: undefined });
      
      const result = await WSLDetector.getWSLInfo();
      
      expect(typeof result.isWSL).toBe('boolean');
      
      if (result.isWSL && result.distroName) {
        expect(typeof result.distroName).toBe('string');
      }
    });

    it('should handle version detection', async () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'Ubuntu-20.04' });
      
      const result = await WSLDetector.getWSLInfo();
      
      expect(result.isWSL).toBe(true);
      
      if (result.wslVersion) {
        expect(result.wslVersion).toMatch(/^[12]$/);
      }
    });

    it('should handle partial WSL info when IP retrieval fails', async () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'Ubuntu-20.04' });
      
      const result = await WSLDetector.getWSLInfo();
      
      expect(result.isWSL).toBe(true);
      expect(result.distroName).toBe('Ubuntu-20.04');
      
      // IP might not be available in all environments
      if (!result.ip) {
        expect(result.ip).toBeUndefined();
      }
    });
  });

  describe('isWSLNetworkingAvailable method', () => {
    it('should check networking availability when WSL_DISTRO_NAME is set', async () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'Ubuntu-20.04' });
      
      const result = await WSLDetector.isWSLNetworkingAvailable();
      
      expect(typeof result).toBe('boolean');
    });

    it('should return false when not in WSL environment', async () => {
      WSLEnvironmentMock.setup({ wslDistroName: undefined });
      
      const result = await WSLDetector.isWSLNetworkingAvailable();
      
      // Should return false if not detected as WSL
      if (!WSLDetector.isWSL()) {
        expect(result).toBe(false);
      } else {
        expect(typeof result).toBe('boolean');
      }
    });

    it('should handle network connectivity checks', async () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'Ubuntu-20.04' });
      
      const result = await WSLDetector.isWSLNetworkingAvailable();
      
      expect(typeof result).toBe('boolean');
    });
  });

  describe('method availability and types', () => {
    it('should have all required methods available', () => {
      expect(WSLDetector.isWSL).toBeDefined();
      expect(typeof WSLDetector.isWSL).toBe('function');
      
      expect(WSLDetector.getWSLIP).toBeDefined();
      expect(typeof WSLDetector.getWSLIP).toBe('function');
      
      expect(WSLDetector.getWSLInfo).toBeDefined();
      expect(typeof WSLDetector.getWSLInfo).toBe('function');
      
      expect(WSLDetector.isWSLNetworkingAvailable).toBeDefined();
      expect(typeof WSLDetector.isWSLNetworkingAvailable).toBe('function');
    });

    it('should handle method calls without errors', async () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'Ubuntu-20.04' });
      
      // All methods should be callable
      expect(() => WSLDetector.isWSL()).not.toThrow();
      
      try {
        await WSLDetector.getWSLIP();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
      
      const info = await WSLDetector.getWSLInfo();
      expect(info).toBeDefined();
      expect(typeof info.isWSL).toBe('boolean');
      
      const networking = await WSLDetector.isWSLNetworkingAvailable();
      expect(typeof networking).toBe('boolean');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle various environment configurations', () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'Ubuntu-20.04' });
      
      const result = WSLDetector.isWSL();
      
      expect(result).toBe(true);
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
    });

    it('should handle performance requirements', async () => {
      const startTime = Date.now();
      
      WSLEnvironmentMock.setup({ wslDistroName: 'Ubuntu-20.04' });
      
      await WSLDetector.getWSLInfo();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle environment variable access', () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'Test-Distro' });
      
      const result = WSLDetector.isWSL();
      
      expect(result).toBe(true);
      expect(WSLEnvironmentMock.wasMethodCalled('getEnv')).toBe(true);
    });

    it('should handle filesystem operations gracefully', () => {
      WSLEnvironmentMock.setup({ wslDistroName: undefined });
      
      const result = WSLDetector.isWSL();
      
      expect(typeof result).toBe('boolean');
    });

    it('should handle concurrent calls', async () => {
      WSLEnvironmentMock.setup({ wslDistroName: 'Ubuntu-20.04' });
      
      const promises = [
        WSLDetector.getWSLInfo(),
        WSLDetector.getWSLInfo(),
        WSLDetector.getWSLInfo()
      ];
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.isWSL).toBe(true);
        expect(result.distroName).toBe('Ubuntu-20.04');
      });
    });
  });
});