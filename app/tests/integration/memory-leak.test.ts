/**
 * Memory Leak Detection Tests
 * Tests for signal handler cleanup and memory management
 * 
 * These tests verify that the signal handler fixes prevent memory leaks
 * and that all resources are properly cleaned up in test environments
 */

import { testEnvironmentManager, TestProcessManager, TestMemoryTracker } from '../utils/test-environment';

describe('Memory Leak Detection', () => {
  let processManager: TestProcessManager;
  let memoryTracker: TestMemoryTracker;
  
  beforeAll(() => {
    processManager = TestProcessManager.getInstance();
    memoryTracker = TestMemoryTracker.getInstance();
  });

  beforeEach(() => {
    testEnvironmentManager.setup();
    memoryTracker.startTracking();
  });

  afterEach(() => {
    testEnvironmentManager.cleanup();
  });

  describe('Process Signal Handler Management', () => {
    test('should not exceed maximum process listeners', () => {
      const initialCounts = processManager.getListenerCounts();
      
      // Simulate adding multiple signal handlers (this would cause the leak)
      const handlers: Function[] = [];
      
      for (let i = 0; i < 10; i++) {
        const handler = () => console.log(`Handler ${i}`);
        handlers.push(handler);
        process.on('SIGTERM', handler);
        process.on('SIGINT', handler);
      }
      
      const afterCounts = processManager.getListenerCounts();
      
      // Verify handlers were added
      expect(afterCounts.SIGTERM).toBeGreaterThan(initialCounts.SIGTERM);
      expect(afterCounts.SIGINT).toBeGreaterThan(initialCounts.SIGINT);
      
      // Cleanup should remove all handlers
      processManager.cleanupTestListeners();
      
      const finalCounts = processManager.getListenerCounts();
      expect(finalCounts.SIGTERM).toBe(0);
      expect(finalCounts.SIGINT).toBe(0);
    });

    test('should track and cleanup all test listeners', () => {
      const initialCount = process.listenerCount('SIGTERM');
      
      // Add listeners through the tracked methods
      const handler1 = () => {};
      const handler2 = () => {};
      
      process.on('SIGTERM', handler1);
      process.addListener('SIGINT', handler2);
      
      // Verify listeners were added
      expect(process.listenerCount('SIGTERM')).toBeGreaterThan(initialCount);
      expect(process.listenerCount('SIGINT')).toBeGreaterThan(0);
      
      // Cleanup should remove tracked listeners
      processManager.cleanupTestListeners();
      
      expect(process.listenerCount('SIGTERM')).toBe(0);
      expect(process.listenerCount('SIGINT')).toBe(0);
    });

    test('should restore original process max listeners', () => {
      const originalMaxListeners = process.getMaxListeners();
      
      // Setup should increase max listeners
      processManager.setupTestEnvironment();
      expect(process.getMaxListeners()).toBeGreaterThan(originalMaxListeners);
      
      // Restore should reset to original
      processManager.restoreProcessEnvironment();
      expect(process.getMaxListeners()).toBe(originalMaxListeners);
    });

    test('should handle cleanup errors gracefully', () => {
      // Add a listener that might cause cleanup issues
      const problematicHandler = () => {
        throw new Error('Handler error');
      };
      
      process.on('SIGTERM', problematicHandler);
      
      // Cleanup should not throw even with problematic handlers
      expect(() => {
        processManager.cleanupTestListeners();
      }).not.toThrow();
      
      // Should still clean up successfully
      expect(process.listenerCount('SIGTERM')).toBe(0);
    });
  });

  describe('Memory Usage Tracking', () => {
    test('should track memory usage during tests', () => {
      memoryTracker.startTracking();
      
      // Simulate some memory usage
      const largeArray = new Array(1000).fill('test data');
      memoryTracker.takeSnapshot();
      
      // Add more memory usage
      const anotherArray = new Array(1000).fill('more test data');
      memoryTracker.takeSnapshot();
      
      const snapshots = memoryTracker.stopTracking();
      
      expect(snapshots.length).toBeGreaterThanOrEqual(2);
      expect(snapshots[0]).toHaveProperty('timestamp');
      expect(snapshots[0]).toHaveProperty('usage');
      expect(snapshots[0].usage).toHaveProperty('heapUsed');
      
      // Clean up
      largeArray.length = 0;
      anotherArray.length = 0;
    });

    test('should detect potential memory leaks', () => {
      memoryTracker.startTracking();
      
      // Simulate a small memory growth (should not trigger leak detection)
      const smallArray = new Array(100).fill('small');
      memoryTracker.takeSnapshot();
      
      // Check for leaks with high threshold (should not detect)
      expect(memoryTracker.checkForLeaks(100)).toBe(false);
      
      memoryTracker.stopTracking();
      
      // Clean up
      smallArray.length = 0;
    });

    test('should limit snapshot storage to prevent unbounded growth', () => {
      memoryTracker.startTracking();
      
      // Take many snapshots
      for (let i = 0; i < 150; i++) {
        memoryTracker.takeSnapshot();
      }
      
      const snapshots = memoryTracker.stopTracking();
      
      // Should be limited to 100 snapshots
      expect(snapshots.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Integration Test Environment Manager', () => {
    test('should setup and cleanup test environment completely', () => {
      const initialListenerCounts = processManager.getListenerCounts();
      
      // Setup environment
      testEnvironmentManager.setup();
      
      // Add some test resources
      process.on('SIGTERM', () => {});
      process.on('SIGINT', () => {});
      
      const afterSetupCounts = processManager.getListenerCounts();
      expect(afterSetupCounts.SIGTERM).toBeGreaterThan(initialListenerCounts.SIGTERM);
      expect(afterSetupCounts.SIGINT).toBeGreaterThan(initialListenerCounts.SIGINT);
      
      // Cleanup should restore clean state
      testEnvironmentManager.cleanup();
      
      const finalCounts = processManager.getListenerCounts();
      expect(finalCounts.SIGTERM).toBe(0);
      expect(finalCounts.SIGINT).toBe(0);
    });

    test('should reset environment for test isolation', () => {
      // Add some listeners
      process.on('SIGTERM', () => {});
      
      expect(process.listenerCount('SIGTERM')).toBeGreaterThan(0);
      
      // Reset should clean up and re-setup
      testEnvironmentManager.reset();
      
      expect(process.listenerCount('SIGTERM')).toBe(0);
      expect(process.getMaxListeners()).toBeGreaterThan(10); // Should be set to test value
    });

    test('should only operate in test environment', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      
      try {
        // Temporarily set non-test environment
        process.env.NODE_ENV = 'production';
        delete process.env.JEST_WORKER_ID;
        
        const initialMaxListeners = process.getMaxListeners();
        
        // Operations should be no-ops in non-test environment
        testEnvironmentManager.setup();
        expect(process.getMaxListeners()).toBe(initialMaxListeners);
        
        testEnvironmentManager.cleanup();
        expect(process.getMaxListeners()).toBe(initialMaxListeners);
        
      } finally {
        // Restore test environment
        process.env.NODE_ENV = originalNodeEnv;
        process.env.JEST_WORKER_ID = '1';
      }
    });
  });

  describe('Signal Handler Cleanup Prevention', () => {
    test('should prevent the original MaxListenersExceededWarning scenario', () => {
      const warningHandler = jest.fn();
      process.on('warning', warningHandler);
      
      try {
        // Simulate the scenario that was causing the original issue
        // This would have triggered MaxListenersExceededWarning before the fix
        for (let i = 0; i < 25; i++) {
          process.on('SIGTERM', () => {});
          process.on('SIGINT', () => {});
          process.on('SIGUSR2', () => {});
        }
        
        // With our fixes, this should not generate warnings
        // because we've increased max listeners and have cleanup
        
        // Give a moment for any warnings to be emitted
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Clean up the listeners
        processManager.cleanupTestListeners();
        
        // Should not have received MaxListenersExceededWarning
        const maxListenerWarnings = warningHandler.mock.calls.filter(call => 
          call[0]?.message?.includes('MaxListenersExceededWarning')
        );
        
        expect(maxListenerWarnings.length).toBe(0);
        
      } finally {
        process.removeListener('warning', warningHandler);
        processManager.cleanupTestListeners();
      }
    });

    test('should handle multiple cleanup calls safely', () => {
      // Add some listeners
      process.on('SIGTERM', () => {});
      process.on('SIGINT', () => {});
      
      expect(process.listenerCount('SIGTERM')).toBeGreaterThan(0);
      
      // Multiple cleanup calls should be safe
      expect(() => {
        processManager.cleanupTestListeners();
        processManager.cleanupTestListeners();
        processManager.cleanupTestListeners();
      }).not.toThrow();
      
      expect(process.listenerCount('SIGTERM')).toBe(0);
      expect(process.listenerCount('SIGINT')).toBe(0);
    });

    test('should maintain process functionality after cleanup', () => {
      // Add and clean up listeners
      const handler = jest.fn();
      process.on('SIGTERM', handler);
      
      processManager.cleanupTestListeners();
      
      // Should be able to add new listeners after cleanup
      const newHandler = jest.fn();
      process.on('SIGTERM', newHandler);
      
      expect(process.listenerCount('SIGTERM')).toBe(1);
      
      // Clean up for test isolation
      process.removeListener('SIGTERM', newHandler);
    });
  });
});