/**
 * Signal Handler Cleanup Validation Tests
 * Tests process signal handler memory leak prevention
 * Phase 3: Test Suite Memory Leak Fixes
 */

import { CleanupUtils, globalCleanupRegistry } from '../../../src/utils/cleanup-utils';
import { ResourceManager } from '../../../src/utils/resource-manager';

describe('Signal Handler Cleanup Validation', () => {
  let initialSignalCounts: Record<string, number>;
  let resourceManager: ResourceManager;

  beforeEach(() => {
    // Record initial signal handler counts
    initialSignalCounts = {
      SIGTERM: process.listenerCount('SIGTERM'),
      SIGINT: process.listenerCount('SIGINT'),
      SIGHUP: process.listenerCount('SIGHUP'),
      SIGUSR1: process.listenerCount('SIGUSR1'),
      SIGUSR2: process.listenerCount('SIGUSR2')
    };
    
    resourceManager = new ResourceManager('signal-test');
  });

  afterEach(() => {
    // Clean up any test signal handlers
    resourceManager.cleanup();
    
    // Force cleanup of any remaining signal handlers
    CleanupUtils.cleanupProcessSignals({
      testEnvironmentSkip: false,
      logActivity: false
    });
    
    // Verify no signal handler leaks
    Object.entries(initialSignalCounts).forEach(([signal, initialCount]) => {
      const currentCount = process.listenerCount(signal as NodeJS.Signals);
      if (currentCount > initialCount) {
        console.warn(`Signal handler leak detected for ${signal}: ${currentCount - initialCount} handlers`);
      }
    });
  });

  describe('CleanupUtils Signal Handler Management', () => {
    test('should cleanup process signals without affecting existing handlers', () => {
      const beforeCounts = {
        SIGTERM: process.listenerCount('SIGTERM'),
        SIGINT: process.listenerCount('SIGINT')
      };

      // Add test handlers (which should be skipped in test environment)
      const testHandler = jest.fn();
      process.on('SIGUSR1', testHandler);
      process.on('SIGUSR2', testHandler);

      expect(process.listenerCount('SIGUSR1')).toBe(1);
      expect(process.listenerCount('SIGUSR2')).toBe(1);

      // Cleanup should remove test handlers but preserve original ones
      const result = CleanupUtils.cleanupProcessSignals({
        signals: ['SIGUSR1', 'SIGUSR2'],
        testEnvironmentSkip: false,
        logActivity: false
      });

      expect(result.success).toBe(true);
      expect(result.cleanedCount).toBe(2);
      expect(process.listenerCount('SIGUSR1')).toBe(0);
      expect(process.listenerCount('SIGUSR2')).toBe(0);

      // Original signal handlers should be preserved
      expect(process.listenerCount('SIGTERM')).toBe(beforeCounts.SIGTERM);
      expect(process.listenerCount('SIGINT')).toBe(beforeCounts.SIGINT);
    });

    test('should handle signal cleanup in test environment', () => {
      // In test environment, cleanup should still work but skip live handlers
      const result = CleanupUtils.cleanupProcessSignals({
        testEnvironmentSkip: true,
        logActivity: false
      });

      expect(result.success).toBe(true);
      expect(result.cleanedCount).toBe(0); // No handlers to clean in test env
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    test('should handle selective signal cleanup', () => {
      // Add handlers to specific signals
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      process.on('SIGUSR1', handler1);
      process.on('SIGUSR2', handler2);
      
      expect(process.listenerCount('SIGUSR1')).toBe(1);
      expect(process.listenerCount('SIGUSR2')).toBe(1);

      // Clean only SIGUSR1
      const result = CleanupUtils.cleanupProcessSignals({
        signals: ['SIGUSR1'],
        testEnvironmentSkip: false,
        logActivity: false
      });

      expect(result.success).toBe(true);
      expect(result.cleanedCount).toBe(1);
      expect(process.listenerCount('SIGUSR1')).toBe(0);
      expect(process.listenerCount('SIGUSR2')).toBe(1);

      // Clean remaining
      process.removeAllListeners('SIGUSR2');
    });

    test('should handle signal cleanup errors gracefully', () => {
      // Mock process.removeAllListeners to throw error
      const originalRemoveAllListeners = process.removeAllListeners;
      const mockError = new Error('Signal cleanup error');
      
      process.removeAllListeners = jest.fn().mockImplementation(() => {
        throw mockError;
      });

      try {
        const result = CleanupUtils.cleanupProcessSignals({
          signals: ['SIGUSR1'],
          testEnvironmentSkip: false,
          logActivity: false
        });

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('Signal cleanup error');
      } finally {
        // Restore original function
        process.removeAllListeners = originalRemoveAllListeners;
      }
    });

    test('should provide accurate cleanup statistics', () => {
      // Add multiple handlers to same signal
      const handlers = [jest.fn(), jest.fn(), jest.fn()];
      
      handlers.forEach(handler => {
        process.on('SIGUSR1', handler);
      });

      expect(process.listenerCount('SIGUSR1')).toBe(3);

      const result = CleanupUtils.cleanupProcessSignals({
        signals: ['SIGUSR1'],
        testEnvironmentSkip: false,
        logActivity: false
      });

      expect(result.success).toBe(true);
      expect(result.cleanedCount).toBe(3);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(process.listenerCount('SIGUSR1')).toBe(0);
    });
  });

  describe('ResourceManager Signal Handler Tracking', () => {
    test('should track signal handlers in non-test environment', () => {
      // Mock non-test environment
      const originalEnv = process.env.NODE_ENV;
      const originalJest = process.env.JEST_WORKER_ID;
      
      delete process.env.JEST_WORKER_ID;
      process.env.NODE_ENV = 'development';

      try {
        const handler = jest.fn();
        const cleanup = resourceManager.trackSignalHandler('SIGUSR1', handler, 'tracked-signal');

        expect(resourceManager.getResourceCount()).toBe(1);
        expect(typeof cleanup).toBe('function');
        expect(process.listenerCount('SIGUSR1')).toBe(1);

        // Manual cleanup
        cleanup();
        expect(process.listenerCount('SIGUSR1')).toBe(0);
      } finally {
        // Restore environment
        process.env.NODE_ENV = originalEnv;
        if (originalJest) {
          process.env.JEST_WORKER_ID = originalJest;
        }
      }
    });

    test('should skip signal handlers in test environment', () => {
      const handler = jest.fn();
      const cleanup = resourceManager.trackSignalHandler('SIGUSR2', handler, 'test-skipped');

      expect(resourceManager.getResourceCount()).toBe(1);
      expect(typeof cleanup).toBe('function');
      // In test environment, actual signal handler should not be added
      // But resource should still be tracked for consistency

      // Cleanup should work without errors
      expect(() => cleanup()).not.toThrow();
    });

    test('should handle multiple signal handlers per signal', () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.JEST_WORKER_ID;
      process.env.NODE_ENV = 'production';

      try {
        const handlers = [jest.fn(), jest.fn(), jest.fn()];
        const cleanups: (() => void)[] = [];

        handlers.forEach((handler, index) => {
          const cleanup = resourceManager.trackSignalHandler(
            'SIGUSR1', 
            handler, 
            `multi-handler-${index}`
          );
          cleanups.push(cleanup);
        });

        expect(resourceManager.getResourceCount()).toBe(3);
        expect(process.listenerCount('SIGUSR1')).toBe(3);

        // Cleanup all
        cleanups.forEach(cleanup => cleanup());
        expect(process.listenerCount('SIGUSR1')).toBe(0);
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.JEST_WORKER_ID = '1';
      }
    });

    test('should handle signal handler cleanup during resource manager cleanup', () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.JEST_WORKER_ID;
      process.env.NODE_ENV = 'production';

      try {
        const handlers = [jest.fn(), jest.fn()];
        
        handlers.forEach((handler, index) => {
          resourceManager.trackSignalHandler(
            index === 0 ? 'SIGUSR1' : 'SIGUSR2',
            handler,
            `cleanup-test-${index}`
          );
        });

        expect(resourceManager.getResourceCount()).toBe(2);
        expect(process.listenerCount('SIGUSR1')).toBe(1);
        expect(process.listenerCount('SIGUSR2')).toBe(1);

        // Resource manager cleanup should remove all tracked handlers
        resourceManager.cleanup();
        
        expect(resourceManager.getResourceCount()).toBe(0);
        expect(process.listenerCount('SIGUSR1')).toBe(0);
        expect(process.listenerCount('SIGUSR2')).toBe(0);
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.JEST_WORKER_ID = '1';
      }
    });

    test('should handle signal cleanup errors in resource manager', () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.JEST_WORKER_ID;
      process.env.NODE_ENV = 'production';

      try {
        // Add a handler
        const handler = jest.fn();
        resourceManager.trackSignalHandler('SIGUSR1', handler, 'error-test');
        
        expect(process.listenerCount('SIGUSR1')).toBe(1);

        // Mock process.removeListener to throw error
        const originalRemoveListener = process.removeListener;
        process.removeListener = jest.fn().mockImplementation(() => {
          throw new Error('Remove listener error');
        });

        // Cleanup should handle errors gracefully
        expect(() => resourceManager.cleanup()).not.toThrow();
        expect(resourceManager.getResourceCount()).toBe(0);

        // Restore original function
        process.removeListener = originalRemoveListener;
        // Clean up manually since mock failed
        process.removeAllListeners('SIGUSR1');
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.JEST_WORKER_ID = '1';
      }
    });
  });

  describe('Global Cleanup Registry Signal Management', () => {
    test('should register and cleanup signal handlers via global registry', () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.JEST_WORKER_ID;
      process.env.NODE_ENV = 'production';

      try {
        const handler1 = jest.fn();
        const handler2 = jest.fn();

        // Register via global registry
        globalCleanupRegistry.registerSignalHandler('SIGUSR1', handler1);
        globalCleanupRegistry.registerSignalHandler('SIGUSR2', handler2);

        expect(process.listenerCount('SIGUSR1')).toBe(1);
        expect(process.listenerCount('SIGUSR2')).toBe(1);

        // Global cleanup should remove all
        const result = globalCleanupRegistry.cleanup();
        
        expect(result.success).toBe(true);
        expect(process.listenerCount('SIGUSR1')).toBe(0);
        expect(process.listenerCount('SIGUSR2')).toBe(0);
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.JEST_WORKER_ID = '1';
      }
    });

    test('should handle registry cleanup with mixed resource types', () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.JEST_WORKER_ID;  
      process.env.NODE_ENV = 'production';

      try {
        const handler = jest.fn();
        const timer = setTimeout(() => {}, 1000);

        // Register different resource types
        globalCleanupRegistry.registerSignalHandler('SIGUSR1', handler);
        globalCleanupRegistry.registerTimer(timer);

        const stats = globalCleanupRegistry.getStats();
        expect(stats.signalHandlers).toBe(1);
        expect(stats.timers).toBe(1);

        // Cleanup should handle all types
        const result = globalCleanupRegistry.cleanup();
        expect(result.success).toBe(true);

        const finalStats = globalCleanupRegistry.getStats();
        expect(finalStats.signalHandlers).toBe(0);
        expect(finalStats.timers).toBe(0);
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.JEST_WORKER_ID = '1';
      }
    });

    test('should provide accurate registry statistics for signal handlers', () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.JEST_WORKER_ID;
      process.env.NODE_ENV = 'production';

      try {
        const handlers = [jest.fn(), jest.fn(), jest.fn()];

        // Register multiple signal handlers
        handlers.forEach((handler, index) => {
          globalCleanupRegistry.registerSignalHandler(
            index % 2 === 0 ? 'SIGUSR1' : 'SIGUSR2',
            handler
          );
        });

        const stats = globalCleanupRegistry.getStats();
        expect(stats.signalHandlers).toBe(3);

        // Cleanup
        globalCleanupRegistry.cleanup();
        const finalStats = globalCleanupRegistry.getStats();
        expect(finalStats.signalHandlers).toBe(0);
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.JEST_WORKER_ID = '1';
      }
    });
  });

  describe('Comprehensive Signal Handler Cleanup', () => {
    test('should perform comprehensive signal cleanup', () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.JEST_WORKER_ID;
      process.env.NODE_ENV = 'production';

      try {
        // Add various signal handlers
        const handlers = [jest.fn(), jest.fn(), jest.fn()];
        handlers.forEach(handler => {
          process.on('SIGUSR1', handler);
        });

        expect(process.listenerCount('SIGUSR1')).toBe(3);

        // Comprehensive cleanup should handle all
        const result = CleanupUtils.performComprehensiveCleanup({
          signals: true
        }, {
          logActivity: false
        });

        expect(result.success).toBe(true);
        expect(result.cleanedCount).toBeGreaterThanOrEqual(3);
        expect(process.listenerCount('SIGUSR1')).toBe(0);
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.JEST_WORKER_ID = '1';
      }
    });

    test('should handle signal cleanup with other resource types', () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.JEST_WORKER_ID;
      process.env.NODE_ENV = 'production';

      try {
        // Mix of resource types
        const handler = jest.fn();
        const timer = setTimeout(() => {}, 5000);
        const emitter = require('events').EventEmitter();

        process.on('SIGUSR1', handler);

        const result = CleanupUtils.performComprehensiveCleanup({
          signals: true,
          timers: [timer],
          eventEmitters: [emitter],
          garbageCollection: true
        }, {
          logActivity: false
        });

        expect(result.success).toBe(true);
        expect(result.cleanedCount).toBeGreaterThanOrEqual(1);
        expect(process.listenerCount('SIGUSR1')).toBe(0);
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.JEST_WORKER_ID = '1';
      }
    });

    test('should verify no signal handler leaks after comprehensive cleanup', () => {
      const beforeCounts: Record<string, number> = {};
      const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGHUP', 'SIGUSR1', 'SIGUSR2'];
      
      // Record before counts
      signals.forEach(signal => {
        beforeCounts[signal] = process.listenerCount(signal);
      });

      // Perform comprehensive cleanup multiple times
      for (let i = 0; i < 3; i++) {
        CleanupUtils.performComprehensiveCleanup({
          signals: true,
          garbageCollection: true
        }, {
          logActivity: false
        });
      }

      // Verify no accumulation
      signals.forEach(signal => {
        const currentCount = process.listenerCount(signal);
        expect(currentCount).toBeLessThanOrEqual(beforeCounts[signal]);
      });
    });
  });
});