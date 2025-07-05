/**
 * Port Manager Unit Tests
 * Comprehensive tests for production port management functionality
 * Tests port conflict resolution, reservations, and production-grade features
 */

import { PortManager, PortReservation, PortAvailabilityResult } from '../../../src/utils/port-manager';
import { PortUtils } from '../../../src/utils/port';

// Mock PortUtils for controlled testing
jest.mock('../../../src/utils/port', () => ({
  PortUtils: {
    isPortAvailable: jest.fn(),
    getNextAvailablePort: jest.fn()
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

const mockPortUtils = PortUtils as jest.Mocked<typeof PortUtils>;

describe('PortManager', () => {
  let portManager: PortManager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Create fresh instance for each test
    portManager = new PortManager({
      defaultPort: 3000,
      scanRangeStart: 8000,
      scanRangeEnd: 8099,
      maxRetries: 3,
      retryDelay: 100,
      reservationTimeout: 300000 // 5 minutes
    });
  });

  afterEach(async () => {
    jest.useRealTimers();
    portManager.shutdown();
    // Give time for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const manager = new PortManager();
      const status = manager.getStatus();
      
      expect(status.config.defaultPort).toBe(3000);
      expect(status.config.scanRangeStart).toBe(8000);
      expect(status.config.scanRangeEnd).toBe(8099);
      expect(status.activeReservations).toBe(0);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        defaultPort: 5000,
        scanRangeStart: 9000,
        scanRangeEnd: 9099,
        maxRetries: 5
      };
      
      const manager = new PortManager(customConfig);
      const status = manager.getStatus();
      
      expect(status.config.defaultPort).toBe(5000);
      expect(status.config.scanRangeStart).toBe(9000);
      expect(status.config.scanRangeEnd).toBe(9099);
      expect(status.config.maxRetries).toBe(5);
      
      manager.shutdown();
    });

    it('should merge partial configuration with defaults', () => {
      const manager = new PortManager({ defaultPort: 4000 });
      const status = manager.getStatus();
      
      expect(status.config.defaultPort).toBe(4000);
      expect(status.config.scanRangeStart).toBe(8000); // Default value preserved
      
      manager.shutdown();
    });
  });

  describe('findAvailablePort', () => {
    it('should return preferred port when available', async () => {
      mockPortUtils.isPortAvailable.mockResolvedValue(true);
      
      const result = await portManager.findAvailablePort(3000);
      
      expect(result.available).toBe(true);
      expect(result.port).toBe(3000);
      expect(result.scanDuration).toBeGreaterThanOrEqual(0);
      expect(result.alternativePort).toBeUndefined();
      expect(mockPortUtils.isPortAvailable).toHaveBeenCalledWith(3000);
    });

    it('should find alternative port when preferred is unavailable', async () => {
      mockPortUtils.isPortAvailable.mockResolvedValue(false);
      mockPortUtils.getNextAvailablePort.mockResolvedValue(3001);
      
      const result = await portManager.findAvailablePort(3000);
      
      expect(result.available).toBe(true);
      expect(result.port).toBe(3001);
      expect(result.alternativePort).toBe(3001);
      expect(result.reason).toContain('Port 3000 was unavailable');
      expect(mockPortUtils.getNextAvailablePort).toHaveBeenCalledWith(3000);
    });

    it('should use default port when no preferred port specified', async () => {
      mockPortUtils.isPortAvailable.mockResolvedValue(true);
      
      const result = await portManager.findAvailablePort();
      
      expect(result.port).toBe(3000); // Default port from config
      expect(mockPortUtils.isPortAvailable).toHaveBeenCalledWith(3000);
    });

    it('should handle port scanning errors gracefully', async () => {
      const scanError = new Error('Port scanning failed');
      mockPortUtils.isPortAvailable.mockRejectedValue(scanError);
      
      const result = await portManager.findAvailablePort(3000);
      
      expect(result.available).toBe(false);
      expect(result.port).toBe(3000);
      expect(result.reason).toBe('Port scanning failed');
      expect(result.scanDuration).toBeGreaterThanOrEqual(0);
    });

    it('should handle getNextAvailablePort errors', async () => {
      mockPortUtils.isPortAvailable.mockResolvedValue(false);
      mockPortUtils.getNextAvailablePort.mockRejectedValue(new Error('No available ports'));
      
      const result = await portManager.findAvailablePort(3000);
      
      expect(result.available).toBe(false);
      expect(result.reason).toBe('No available ports');
    });

    it('should measure scan duration accurately', async () => {
      mockPortUtils.isPortAvailable.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(true), 50))
      );
      
      const result = await portManager.findAvailablePort(3000);
      
      // Fast-forward timers to simulate delay
      jest.advanceTimersByTime(50);
      
      expect(result.scanDuration).toBeGreaterThanOrEqual(0);
      expect(result.available).toBe(true);
    });
  });

  describe('Port Reservations', () => {
    beforeEach(() => {
      mockPortUtils.isPortAvailable.mockResolvedValue(true);
    });

    it('should reserve available port successfully', async () => {
      const reserved = await portManager.reservePort(3000, 'testing', 'test-suite');
      
      expect(reserved).toBe(true);
      
      const reservations = portManager.getReservations();
      expect(reservations).toHaveLength(1);
      expect(reservations[0].port).toBe(3000);
      expect(reservations[0].purpose).toBe('testing');
      expect(reservations[0].reservedBy).toBe('test-suite');
    });

    it('should not reserve unavailable port', async () => {
      mockPortUtils.isPortAvailable.mockResolvedValue(false);
      
      const reserved = await portManager.reservePort(3000, 'testing');
      
      expect(reserved).toBe(false);
      expect(portManager.getReservations()).toHaveLength(0);
    });

    it('should not reserve already reserved port', async () => {
      // First reservation
      await portManager.reservePort(3000, 'first-purpose');
      
      // Attempt second reservation
      const secondReserved = await portManager.reservePort(3000, 'second-purpose');
      
      expect(secondReserved).toBe(false);
      
      const reservations = portManager.getReservations();
      expect(reservations).toHaveLength(1);
      expect(reservations[0].purpose).toBe('first-purpose');
    });

    it('should release port reservation', async () => {
      await portManager.reservePort(3000, 'testing');
      expect(portManager.getReservations()).toHaveLength(1);
      
      const released = portManager.releasePort(3000);
      
      expect(released).toBe(true);
      expect(portManager.getReservations()).toHaveLength(0);
    });

    it('should handle releasing non-reserved port', () => {
      const released = portManager.releasePort(3000);
      
      expect(released).toBe(false);
      expect(portManager.getReservations()).toHaveLength(0);
    });

    it('should set reservation expiration correctly', async () => {
      await portManager.reservePort(3000, 'testing');
      
      const reservations = portManager.getReservations();
      const reservation = reservations[0];
      
      expect(reservation.expiresAt).toBeInstanceOf(Date);
      expect(reservation.expiresAt.getTime()).toBeGreaterThan(reservation.reservedAt.getTime());
      
      // Should expire in approximately 5 minutes (300000ms)
      const expectedExpiry = reservation.reservedAt.getTime() + 300000;
      const actualExpiry = reservation.expiresAt.getTime();
      expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(1000); // Within 1 second
    });

    it('should handle reservation errors gracefully', async () => {
      mockPortUtils.isPortAvailable.mockRejectedValue(new Error('Port check failed'));
      
      const reserved = await portManager.reservePort(3000, 'testing');
      
      expect(reserved).toBe(false);
      expect(portManager.getReservations()).toHaveLength(0);
    });
  });

  describe('Reservation Cleanup', () => {
    beforeEach(() => {
      mockPortUtils.isPortAvailable.mockResolvedValue(true);
    });

    it('should not find available port for active reservation', async () => {
      await portManager.reservePort(3000, 'testing');
      
      const result = await portManager.findAvailablePort(3000);
      
      expect(result.available).toBe(true);
      expect(result.port).toBe(3001); // Should find alternative
      expect(mockPortUtils.getNextAvailablePort).toHaveBeenCalledWith(3000);
    });

    it('should clean up expired reservations', async () => {
      // Create port manager with short expiration for testing
      const shortExpiryManager = new PortManager({
        reservationTimeout: 100 // 100ms
      });
      
      await shortExpiryManager.reservePort(3000, 'testing');
      expect(shortExpiryManager.getReservations()).toHaveLength(1);
      
      // Fast-forward time to expire reservation
      jest.advanceTimersByTime(61000); // Advance by cleanup interval (1 minute)
      
      // Reservations should be cleaned up
      expect(shortExpiryManager.getReservations()).toHaveLength(0);
      
      shortExpiryManager.shutdown();
    });

    it('should allow reservation of port after expiration', async () => {
      const shortExpiryManager = new PortManager({
        reservationTimeout: 50 // 50ms
      });
      
      // Reserve port
      await shortExpiryManager.reservePort(3000, 'first');
      expect(shortExpiryManager.getReservations()).toHaveLength(1);
      
      // Fast-forward time to expire reservation
      jest.advanceTimersByTime(61000);
      
      // Should be able to reserve again
      const secondReserved = await shortExpiryManager.reservePort(3000, 'second');
      expect(secondReserved).toBe(true);
      
      const reservations = shortExpiryManager.getReservations();
      expect(reservations).toHaveLength(1);
      expect(reservations[0].purpose).toBe('second');
      
      shortExpiryManager.shutdown();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      const validation = portManager.validatePortConfig();
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid default port', () => {
      const invalidManager = new PortManager({ defaultPort: -1 });
      const validation = invalidManager.validatePortConfig();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid default port: -1 (must be 1-65535)');
      
      invalidManager.shutdown();
    });

    it('should detect invalid scan range', () => {
      const invalidManager = new PortManager({ 
        scanRangeStart: 100,
        scanRangeEnd: 50 // End before start
      });
      const validation = invalidManager.validatePortConfig();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Invalid scan range end'))).toBe(true);
      
      invalidManager.shutdown();
    });

    it('should detect invalid max retries', () => {
      const invalidManager = new PortManager({ maxRetries: 0 });
      const validation = invalidManager.validatePortConfig();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid max retries: 0 (must be >= 1)');
      
      invalidManager.shutdown();
    });

    it('should validate port boundaries', () => {
      const invalidManager = new PortManager({ 
        defaultPort: 70000 // Above max port
      });
      const validation = invalidManager.validatePortConfig();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid default port: 70000 (must be 1-65535)');
      
      invalidManager.shutdown();
    });
  });

  describe('Status and Monitoring', () => {
    it('should provide accurate status information', async () => {
      await portManager.reservePort(3000, 'test-1');
      await portManager.reservePort(3001, 'test-2');
      
      const status = portManager.getStatus();
      
      expect(status.activeReservations).toBe(2);
      expect(status.config.defaultPort).toBe(3000);
      expect(status.nextCleanup).toBeInstanceOf(Date);
    });

    it('should track multiple reservations', async () => {
      await portManager.reservePort(3000, 'service-1');
      await portManager.reservePort(3001, 'service-2');
      await portManager.reservePort(3002, 'service-3');
      
      const reservations = portManager.getReservations();
      
      expect(reservations).toHaveLength(3);
      expect(reservations.map(r => r.port)).toEqual([3000, 3001, 3002]);
      expect(reservations.map(r => r.purpose)).toEqual(['service-1', 'service-2', 'service-3']);
    });

    it('should provide reservation details', async () => {
      const beforeReservation = Date.now();
      await portManager.reservePort(3000, 'detailed-test', 'test-runner');
      const afterReservation = Date.now();
      
      const reservations = portManager.getReservations();
      const reservation = reservations[0];
      
      expect(reservation.port).toBe(3000);
      expect(reservation.purpose).toBe('detailed-test');
      expect(reservation.reservedBy).toBe('test-runner');
      expect(reservation.reservedAt.getTime()).toBeGreaterThanOrEqual(beforeReservation);
      expect(reservation.reservedAt.getTime()).toBeLessThanOrEqual(afterReservation);
      expect(reservation.expiresAt.getTime()).toBeGreaterThan(reservation.reservedAt.getTime());
    });
  });

  describe('Shutdown and Cleanup', () => {
    it('should shutdown gracefully', () => {
      expect(() => portManager.shutdown()).not.toThrow();
    });

    it('should clear all reservations on shutdown', async () => {
      await portManager.reservePort(3000, 'test-1');
      await portManager.reservePort(3001, 'test-2');
      
      expect(portManager.getReservations()).toHaveLength(2);
      
      portManager.shutdown();
      
      expect(portManager.getReservations()).toHaveLength(0);
    });

    it('should handle multiple shutdown calls safely', () => {
      portManager.shutdown();
      expect(() => portManager.shutdown()).not.toThrow();
    });

    it('should stop cleanup interval on shutdown', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      portManager.shutdown();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle concurrent reservation attempts', async () => {
      mockPortUtils.isPortAvailable.mockResolvedValue(true);
      
      // Attempt multiple concurrent reservations of same port
      const promises = [
        portManager.reservePort(3000, 'test-1'),
        portManager.reservePort(3000, 'test-2'),
        portManager.reservePort(3000, 'test-3')
      ];
      
      const results = await Promise.all(promises);
      
      // Only first should succeed
      expect(results.filter(r => r === true)).toHaveLength(1);
      expect(portManager.getReservations()).toHaveLength(1);
    });

    it('should handle port availability check timeout', async () => {
      mockPortUtils.isPortAvailable.mockImplementation(
        () => new Promise(() => {}) // Never resolves (simulates timeout)
      );
      
      // This should complete quickly in real scenario with timeout
      const resultPromise = portManager.findAvailablePort(3000);
      
      // Fast-forward time to simulate timeout handling
      jest.advanceTimersByTime(10000);
      
      const result = await resultPromise;
      expect(result.available).toBe(false);
    });

    it('should handle invalid port numbers gracefully', async () => {
      mockPortUtils.isPortAvailable.mockRejectedValue(new Error('Invalid port'));
      
      const reserved = await portManager.reservePort(-1, 'invalid-port');
      
      expect(reserved).toBe(false);
    });

    it('should maintain reservation order', async () => {
      await portManager.reservePort(3002, 'third');
      await portManager.reservePort(3000, 'first');
      await portManager.reservePort(3001, 'second');
      
      const reservations = portManager.getReservations();
      
      // Should maintain insertion order
      expect(reservations.map(r => r.purpose)).toEqual(['third', 'first', 'second']);
    });
  });

  describe('Performance Requirements', () => {
    it('should complete port scanning within reasonable time', async () => {
      mockPortUtils.isPortAvailable.mockResolvedValue(true);
      
      const startTime = Date.now();
      await portManager.findAvailablePort(3000);
      const endTime = Date.now();
      
      // Should complete in less than 1 second as per requirements
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle multiple concurrent port scans efficiently', async () => {
      mockPortUtils.isPortAvailable.mockResolvedValue(true);
      
      const promises = Array.from({ length: 10 }, (_, i) =>
        portManager.findAvailablePort(3000 + i)
      );
      
      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(results).toHaveLength(10);
      expect(results.every(r => r.available)).toBe(true);
      expect(endTime - startTime).toBeLessThan(2000); // Should handle concurrency well
    });
  });
});