/**
 * Resource Manager Unit Tests
 * Tests RAII patterns and memory leak prevention
 * Phase 3: Test Suite Memory Leak Fixes
 */

import { ResourceManager, ResourceGuard, createResourceManager } from '../../../src/utils/resource-manager';
import { EventEmitter } from 'events';

describe('ResourceManager - Memory Leak Prevention', () => {
  let resourceManager: ResourceManager;
  let initialMemory: NodeJS.MemoryUsage;

  beforeEach(() => {
    initialMemory = (global as any).TestUtils.getMemoryUsage();
    resourceManager = createResourceManager('test-manager');
  });

  afterEach(() => {
    resourceManager.destroy();
    (global as any).TestUtils.forceGC();
    
    const finalMemory = (global as any).TestUtils.getMemoryUsage();
    (global as any).TestUtils.checkMemoryLeak('ResourceManager', initialMemory, finalMemory);
  });

  describe('Timer Resource Management', () => {
    test('should track and cleanup timeouts without memory leaks', () => {
      const timeouts: NodeJS.Timeout[] = [];
      let callbackExecuted = false;

      // Create multiple timeouts
      for (let i = 0; i < 10; i++) {
        const timeout = resourceManager.trackTimeout(() => {
          callbackExecuted = true;
        }, 100, `timeout-${i}`);
        timeouts.push(timeout);
      }

      expect(resourceManager.getResourceCount()).toBe(10);
      expect(resourceManager.getResourceIds('timer')).toHaveLength(10);

      // Cleanup all resources
      resourceManager.cleanup();

      expect(resourceManager.getResourceCount()).toBe(0);
      expect(callbackExecuted).toBe(false); // Timeouts should be cancelled
    });

    test('should track and cleanup intervals without memory leaks', () => {
      const intervals: NodeJS.Timeout[] = [];
      let callbackCount = 0;

      // Create multiple intervals
      for (let i = 0; i < 5; i++) {
        const interval = resourceManager.trackInterval(() => {
          callbackCount++;
        }, 50, `interval-${i}`);
        intervals.push(interval);
      }

      expect(resourceManager.getResourceCount()).toBe(5);

      // Let intervals run briefly
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(callbackCount).toBeGreaterThan(0);
          
          // Cleanup should stop all intervals
          resourceManager.cleanup();
          const countAfterCleanup = callbackCount;
          
          // Wait and verify intervals stopped
          setTimeout(() => {
            expect(callbackCount).toBe(countAfterCleanup);
            expect(resourceManager.getResourceCount()).toBe(0);
            resolve();
          }, 100);
        }, 100);
      });
    });

    test('should handle timeout/interval cleanup errors gracefully', () => {
      // Create invalid timer reference
      const fakeTimer = { [Symbol.toPrimitive]: () => 'invalid' } as any;
      
      resourceManager.trackCustom(fakeTimer, () => {
        throw new Error('Cleanup error');
      }, 'invalid-timer');

      expect(resourceManager.getResourceCount()).toBe(1);

      // Cleanup should handle errors gracefully
      expect(() => resourceManager.cleanup()).not.toThrow();
      expect(resourceManager.getResourceCount()).toBe(0);
    });
  });

  describe('EventEmitter Resource Management', () => {
    test('should track and cleanup EventEmitter listeners without memory leaks', () => {
      const emitter = new EventEmitter();
      const listeners: (() => void)[] = [];
      let callbackCount = 0;

      // Track multiple listeners
      for (let i = 0; i < 15; i++) {
        const cleanup = resourceManager.trackListener(emitter, 'test', () => {
          callbackCount++;
        }, `listener-${i}`);
        listeners.push(cleanup);
      }

      expect(resourceManager.getResourceCount()).toBe(15);
      expect(emitter.listenerCount('test')).toBe(15);

      // Emit event to verify listeners work
      emitter.emit('test');
      expect(callbackCount).toBe(15);

      // Cleanup should remove all listeners
      resourceManager.cleanup();
      expect(resourceManager.getResourceCount()).toBe(0);
      expect(emitter.listenerCount('test')).toBe(0);

      // Verify listeners removed
      emitter.emit('test');
      expect(callbackCount).toBe(15); // Should not increase
    });

    test('should track and cleanup EventEmitter instances without memory leaks', () => {
      const emitters: EventEmitter[] = [];

      // Track multiple EventEmitters
      for (let i = 0; i < 8; i++) {
        const emitter = new EventEmitter();
        emitter.setMaxListeners(100);
        resourceManager.trackEmitter(emitter, `emitter-${i}`);
        emitters.push(emitter);
      }

      expect(resourceManager.getResourceCount()).toBe(8);

      // Add listeners to verify cleanup
      emitters.forEach((emitter, index) => {
        emitter.on('test', () => {});
        expect(emitter.listenerCount('test')).toBe(1);
      });

      // Cleanup should clean all emitters
      resourceManager.cleanup();
      expect(resourceManager.getResourceCount()).toBe(0);

      // Verify emitters cleaned up
      emitters.forEach((emitter) => {
        expect(emitter.listenerCount('test')).toBe(0);
      });
    });

    test('should handle EventEmitter cleanup with destroy method', () => {
      class DestroyableEmitter extends EventEmitter {
        public destroyed = false;
        
        destroy() {
          this.destroyed = true;
        }
      }

      const emitter = new DestroyableEmitter();
      resourceManager.trackEmitter(emitter, 'destroyable-emitter');

      expect(resourceManager.getResourceCount()).toBe(1);
      expect(emitter.destroyed).toBe(false);

      resourceManager.cleanup();

      expect(resourceManager.getResourceCount()).toBe(0);
      expect(emitter.destroyed).toBe(true);
    });
  });

  describe('Process Signal Management', () => {
    test('should track signal handlers in non-test environment', () => {
      // Mock non-test environment
      const originalEnv = process.env.NODE_ENV;
      const originalJest = process.env.JEST_WORKER_ID;
      
      delete process.env.JEST_WORKER_ID;
      process.env.NODE_ENV = 'development';

      try {
        const handler = jest.fn();
        const cleanup = resourceManager.trackSignalHandler('SIGUSR1', handler, 'test-signal');

        expect(resourceManager.getResourceCount()).toBe(1);
        expect(typeof cleanup).toBe('function');

        // Cleanup should remove handler
        cleanup();
        
        // Verify through resource manager
        resourceManager.cleanup();
        expect(resourceManager.getResourceCount()).toBe(0);
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
      const cleanup = resourceManager.trackSignalHandler('SIGUSR2', handler, 'test-signal-skip');

      expect(resourceManager.getResourceCount()).toBe(1);
      expect(typeof cleanup).toBe('function');

      // Cleanup should work even though no actual signal handler was added
      resourceManager.cleanup();
      expect(resourceManager.getResourceCount()).toBe(0);
    });
  });

  describe('Custom Resource Management', () => {
    test('should track and cleanup custom resources without memory leaks', () => {
      const resources: any[] = [];
      let cleanupCount = 0;

      // Track multiple custom resources
      for (let i = 0; i < 12; i++) {
        const resource = { id: i, data: new Array(1000).fill(i) };
        const resourceId = resourceManager.trackCustom(resource, () => {
          cleanupCount++;
        }, `custom-resource-${i}`);
        
        resources.push(resource);
        expect(resourceManager.hasResource(resourceId)).toBe(true);
      }

      expect(resourceManager.getResourceCount()).toBe(12);
      expect(cleanupCount).toBe(0);

      // Cleanup should call all cleanup functions
      resourceManager.cleanup();
      expect(resourceManager.getResourceCount()).toBe(0);
      expect(cleanupCount).toBe(12);
    });

    test('should handle individual resource removal', () => {
      const resource = { data: 'test' };
      let cleaned = false;
      
      const resourceId = resourceManager.trackCustom(resource, () => {
        cleaned = true;
      }, 'individual-resource');

      expect(resourceManager.hasResource(resourceId)).toBe(true);
      expect(resourceManager.getResourceCount()).toBe(1);

      // Remove individual resource
      const removed = resourceManager.removeResource(resourceId);
      expect(removed).toBe(true);
      expect(cleaned).toBe(true);
      expect(resourceManager.hasResource(resourceId)).toBe(false);
      expect(resourceManager.getResourceCount()).toBe(0);

      // Try to remove again
      const removedAgain = resourceManager.removeResource(resourceId);
      expect(removedAgain).toBe(false);
    });

    test('should handle cleanup errors in custom resources', () => {
      // Track resources with failing cleanup
      for (let i = 0; i < 5; i++) {
        resourceManager.trackCustom({}, () => {
          throw new Error(`Cleanup error ${i}`);
        }, `failing-resource-${i}`);
      }

      expect(resourceManager.getResourceCount()).toBe(5);

      // Cleanup should handle all errors gracefully
      expect(() => resourceManager.cleanup()).not.toThrow();
      expect(resourceManager.getResourceCount()).toBe(0);
    });
  });

  describe('Resource Statistics and Monitoring', () => {
    test('should provide accurate resource statistics', () => {
      // Add various resource types
      resourceManager.trackTimeout(() => {}, 1000, 'timeout-1');
      resourceManager.trackTimeout(() => {}, 1000, 'timeout-2');
      resourceManager.trackInterval(() => {}, 1000, 'interval-1');
      
      const emitter = new EventEmitter();
      resourceManager.trackListener(emitter, 'test', () => {}, 'listener-1');
      resourceManager.trackEmitter(emitter, 'emitter-1');
      
      resourceManager.trackCustom({}, () => {}, 'custom-1');

      const stats = resourceManager.getStats();
      
      expect(stats.total).toBe(6);
      expect(stats.byType.timer).toBe(2);
      expect(stats.byType.interval).toBe(1);
      expect(stats.byType.listener).toBe(1);
      expect(stats.byType.emitter).toBe(1);
      expect(stats.byType.custom).toBe(1);
      expect(stats.byType.signal).toBe(0);
      expect(stats.oldestResource).toBeInstanceOf(Date);
      expect(stats.memoryEstimate).toBe(600); // 6 * 100
    });

    test('should track resource creation time', async () => {
      const beforeTime = Date.now();
      
      resourceManager.trackTimeout(() => {}, 1000, 'timed-resource');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const stats = resourceManager.getStats();
      expect(stats.oldestResource).toBeInstanceOf(Date);
      expect(stats.oldestResource!.getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(stats.oldestResource!.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('ResourceGuard RAII Pattern', () => {
    test('should automatically cleanup resources when guard is disposed', () => {
      const testManager = createResourceManager('guard-test');
      let cleanupCalled = false;
      
      {
        const guard = new ResourceGuard(testManager);
        testManager.trackCustom({}, () => {
          cleanupCalled = true;
        }, 'guard-resource');
        
        expect(testManager.getResourceCount()).toBe(1);
        
        // Manual cleanup
        guard.cleanup();
      }
      
      expect(cleanupCalled).toBe(true);
      expect(testManager.getResourceCount()).toBe(0);
    });

    test('should support Symbol.dispose for automatic cleanup', () => {
      const testManager = createResourceManager('dispose-test');
      let cleanupCalled = false;
      
      const guard = new ResourceGuard(testManager);
      testManager.trackCustom({}, () => {
        cleanupCalled = true;
      }, 'dispose-resource');
      
      expect(testManager.getResourceCount()).toBe(1);
      
      // Call Symbol.dispose
      guard[Symbol.dispose]();
      
      expect(cleanupCalled).toBe(true);
      expect(testManager.getResourceCount()).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty cleanup gracefully', () => {
      expect(resourceManager.getResourceCount()).toBe(0);
      expect(() => resourceManager.cleanup()).not.toThrow();
      expect(() => resourceManager.destroy()).not.toThrow();
    });

    test('should handle multiple cleanup calls', () => {
      resourceManager.trackTimeout(() => {}, 1000, 'multi-cleanup');
      expect(resourceManager.getResourceCount()).toBe(1);
      
      resourceManager.cleanup();
      expect(resourceManager.getResourceCount()).toBe(0);
      
      // Second cleanup should be safe
      expect(() => resourceManager.cleanup()).not.toThrow();
      expect(resourceManager.getResourceCount()).toBe(0);
    });

    test('should handle concurrent resource operations', async () => {
      const promises: Promise<void>[] = [];
      
      // Concurrently add resources
      for (let i = 0; i < 20; i++) {
        promises.push(
          new Promise<void>((resolve) => {
            setTimeout(() => {
              resourceManager.trackCustom({}, () => {}, `concurrent-${i}`);
              resolve();
            }, Math.random() * 10);
          })
        );
      }
      
      await Promise.all(promises);
      expect(resourceManager.getResourceCount()).toBe(20);
      
      resourceManager.cleanup();
      expect(resourceManager.getResourceCount()).toBe(0);
    });

    test('should handle invalid resource IDs', () => {
      expect(resourceManager.hasResource('invalid-id')).toBe(false);
      expect(resourceManager.removeResource('invalid-id')).toBe(false);
    });
  });
});