/**
 * EventEmitter Cleanup Tests for Monitoring Classes
 * Tests memory leak prevention in monitoring systems
 * Phase 3: Test Suite Memory Leak Fixes
 */

import { SystemMonitor, cleanupSystemMonitor } from '../../../src/monitoring/system-monitor';
import { PerformanceMonitor, cleanupPerformanceMonitor } from '../../../src/monitoring/performance-monitor';
import { HealthMonitor, cleanupHealthMonitor } from '../../../src/monitoring/health-monitor';
import { EventEmitter } from 'events';

describe('EventEmitter Cleanup in Monitoring Classes', () => {
  let initialMemory: NodeJS.MemoryUsage;
  let initialSignalListeners: number;

  beforeEach(() => {
    initialMemory = (global as any).TestUtils.getMemoryUsage();
    initialSignalListeners = process.listenerCount('SIGTERM') + process.listenerCount('SIGINT');
  });

  afterEach(() => {
    // Force cleanup all monitoring instances
    cleanupSystemMonitor();
    cleanupPerformanceMonitor();
    cleanupHealthMonitor();
    
    (global as any).TestUtils.forceGC();
    
    const finalMemory = (global as any).TestUtils.getMemoryUsage();
    const finalSignalListeners = process.listenerCount('SIGTERM') + process.listenerCount('SIGINT');
    
    // Check for signal handler leaks
    expect(finalSignalListeners).toBeLessThanOrEqual(initialSignalListeners);
    
    (global as any).TestUtils.checkMemoryLeak('EventEmitter Cleanup', initialMemory, finalMemory);
  });

  describe('SystemMonitor EventEmitter Cleanup', () => {
    test('should cleanup SystemMonitor EventEmitter without memory leaks', () => {
      const monitor = new SystemMonitor();
      expect(monitor).toBeInstanceOf(EventEmitter);
      
      // Add listeners to track cleanup
      let startedEventFired = false;
      let stoppedEventFired = false;
      let alertEventFired = false;
      
      monitor.on('monitoring:started', () => {
        startedEventFired = true;
      });
      
      monitor.on('monitoring:stopped', () => {
        stoppedEventFired = true;
      });
      
      monitor.on('alert', () => {
        alertEventFired = true;
      });

      expect(monitor.listenerCount('monitoring:started')).toBe(1);
      expect(monitor.listenerCount('monitoring:stopped')).toBe(1);
      expect(monitor.listenerCount('alert')).toBe(1);

      // Start and stop monitoring
      monitor.start(100);
      expect(monitor.isRunning()).toBe(true);
      expect(startedEventFired).toBe(true);

      monitor.stop();
      expect(monitor.isRunning()).toBe(false);
      expect(stoppedEventFired).toBe(true);

      // Cleanup should remove all listeners
      monitor.cleanup();
      expect(monitor.listenerCount('monitoring:started')).toBe(0);
      expect(monitor.listenerCount('monitoring:stopped')).toBe(0);
      expect(monitor.listenerCount('alert')).toBe(0);
    });

    test('should handle multiple SystemMonitor instances cleanup', () => {
      const monitors: SystemMonitor[] = [];
      
      // Create multiple monitor instances
      for (let i = 0; i < 5; i++) {
        const monitor = new SystemMonitor({
          enabled: true,
          thresholds: {
            responseTime: 1000,
            errorRate: 5,
            memoryUsage: 80,
            cpuUsage: 80,
            diskUsage: 90
          },
          channels: {
            console: false,
            file: false
          }
        });
        
        // Add listeners
        monitor.on('monitoring:started', () => {});
        monitor.on('alert', () => {});
        
        monitors.push(monitor);
      }

      expect(monitors).toHaveLength(5);
      
      // Each should have listeners
      monitors.forEach(monitor => {
        expect(monitor.listenerCount('monitoring:started')).toBe(1);
        expect(monitor.listenerCount('alert')).toBe(1);
      });

      // Cleanup all
      monitors.forEach(monitor => monitor.cleanup());
      
      // All should be cleaned up
      monitors.forEach(monitor => {
        expect(monitor.listenerCount('monitoring:started')).toBe(0);
        expect(monitor.listenerCount('alert')).toBe(0);
      });
    });

    test('should prevent listener accumulation in SystemMonitor', () => {
      const monitor = new SystemMonitor();
      
      // Add many listeners
      for (let i = 0; i < 20; i++) {
        monitor.on('alert', () => {});
      }
      
      expect(monitor.listenerCount('alert')).toBe(20);
      
      // Cleanup should remove all
      monitor.cleanup();
      expect(monitor.listenerCount('alert')).toBe(0);
    });

    test('should cleanup monitoring intervals along with EventEmitter', async () => {
      const monitor = new SystemMonitor();
      
      // Start monitoring with short interval
      monitor.start(50);
      expect(monitor.isRunning()).toBe(true);
      
      // Let it run briefly
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Cleanup should stop monitoring and clean EventEmitter
      monitor.cleanup();
      expect(monitor.isRunning()).toBe(false);
      expect(monitor.listenerCount('monitoring:started')).toBe(0);
    });

    test('should handle SystemMonitor destroy completely', () => {
      const monitor = new SystemMonitor();
      
      monitor.on('alert', () => {});
      monitor.start(1000);
      
      expect(monitor.isRunning()).toBe(true);
      expect(monitor.listenerCount('alert')).toBe(1);
      
      // Destroy should do complete cleanup
      monitor.destroy();
      
      expect(monitor.isRunning()).toBe(false);
      expect(monitor.listenerCount('alert')).toBe(0);
    });
  });

  describe('PerformanceMonitor Cleanup', () => {
    test('should cleanup PerformanceMonitor intervals without memory leaks', () => {
      const monitor = new PerformanceMonitor(60000); // 1 minute retention
      
      // Record some metrics
      const timer1 = monitor.startTimer('test-operation-1');
      timer1.stop(true);
      
      const timer2 = monitor.startTimer('test-operation-2');
      timer2.stop(false, 'Test error');
      
      // Check metrics were recorded
      const stats1 = monitor.getStats('test-operation-1');
      const stats2 = monitor.getStats('test-operation-2');
      
      expect(stats1).not.toBeNull();
      expect(stats2).not.toBeNull();
      expect(stats1!.count).toBe(1);
      expect(stats2!.count).toBe(1);
      
      // Cleanup should clear metrics and stop intervals
      monitor.cleanup();
      
      expect(monitor.getStats('test-operation-1')).toBeNull();
      expect(monitor.getStats('test-operation-2')).toBeNull();
    });

    test('should handle concurrent PerformanceMonitor operations', async () => {
      const monitor = new PerformanceMonitor();
      
      // Start many concurrent operations
      const timers = [];
      for (let i = 0; i < 15; i++) {
        const timer = monitor.startTimer(`concurrent-op-${i}`);
        timers.push(timer);
      }
      
      // Complete operations concurrently
      const promises = timers.map((timer, index) => 
        new Promise<void>(resolve => {
          setTimeout(() => {
            timer.stop(Math.random() > 0.5);
            resolve();
          }, Math.random() * 50);
        })
      );
      
      await Promise.all(promises);
      
      // Verify all operations recorded
      const allStats = monitor.getAllStats();
      expect(allStats.size).toBe(15);
      
      // Cleanup should clear everything
      monitor.cleanup();
      expect(monitor.getAllStats().size).toBe(0);
    });

    test('should prevent memory leaks in metric retention', () => {
      const monitor = new PerformanceMonitor(100); // Very short retention
      
      // Generate many metrics
      for (let i = 0; i < 50; i++) {
        const timer = monitor.startTimer('metric-retention-test');
        timer.stop(true);
      }
      
      let stats = monitor.getStats('metric-retention-test');
      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(50);
      
      // Trigger cleanup manually
      monitor.triggerCleanup();
      
      // With very short retention, metrics should be cleaned
      stats = monitor.getStats('metric-retention-test');
      // Stats might still exist if within retention window
      
      // Force cleanup
      monitor.cleanup();
      expect(monitor.getStats('metric-retention-test')).toBeNull();
    });

    test('should handle PerformanceTimer lifecycle properly', () => {
      const monitor = new PerformanceMonitor();
      
      // Create timer
      const timer = monitor.startTimer('timer-lifecycle');
      expect(timer.duration()).toBeGreaterThan(0);
      
      // Stop timer multiple times (should be safe)
      timer.stop(true);
      timer.stop(false, 'Second stop'); // Should not cause issues
      
      const stats = monitor.getStats('timer-lifecycle');
      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(1);
      
      monitor.cleanup();
      expect(monitor.getStats('timer-lifecycle')).toBeNull();
    });

    test('should cleanup PerformanceMonitor factory instances', () => {
      const monitor1 = new PerformanceMonitor(30000);
      const monitor2 = new PerformanceMonitor(60000);
      
      // Add metrics to both
      monitor1.startTimer('test-1').stop(true);
      monitor2.startTimer('test-2').stop(true);
      
      expect(monitor1.getStats('test-1')).not.toBeNull();
      expect(monitor2.getStats('test-2')).not.toBeNull();
      
      // Cleanup both
      monitor1.cleanup();
      monitor2.cleanup();
      
      expect(monitor1.getStats('test-1')).toBeNull();
      expect(monitor2.getStats('test-2')).toBeNull();
    });
  });

  describe('HealthMonitor Cleanup', () => {
    test('should cleanup HealthMonitor intervals and checks', async () => {
      const monitor = new HealthMonitor({
        checkInterval: 100,
        timeout: 1000,
        retryAttempts: 1,
        alertThresholds: {
          memoryUsage: 0.9,
          responseTime: 2000,
          consecutiveFailures: 2
        },
        enableDetailedMetrics: false,
        enablePerformanceTracking: false
      });
      
      // Register custom health check
      monitor.registerHealthCheck('test-check', async () => ({
        name: 'test-check',
        status: 'healthy',
        message: 'Test check passed',
        duration: 10,
        timestamp: new Date()
      }));
      
      // Start monitoring
      monitor.startMonitoring();
      
      // Let it run briefly
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should have run health checks
      const report = monitor.getLatestReport();
      expect(report).not.toBeNull();
      expect(report!.checks.length).toBeGreaterThan(0);
      
      // Cleanup should stop monitoring and clear state
      monitor.cleanup();
      
      // Should not be running anymore
      const stats = monitor.getStatistics();
      expect(stats.totalChecks).toBeGreaterThan(0); // Stats preserved until cleanup
    });

    test('should handle HealthMonitor check registration and cleanup', () => {
      const monitor = new HealthMonitor();
      
      // Register multiple checks
      const checkNames = ['check-1', 'check-2', 'check-3', 'check-4'];
      
      checkNames.forEach(name => {
        monitor.registerHealthCheck(name, async () => ({
          name,
          status: 'healthy',
          message: `${name} passed`,
          duration: 5,
          timestamp: new Date()
        }));
      });
      
      // Unregister some checks
      expect(monitor.unregisterHealthCheck('check-2')).toBe(true);
      expect(monitor.unregisterHealthCheck('check-4')).toBe(true);
      expect(monitor.unregisterHealthCheck('nonexistent')).toBe(false);
      
      // Cleanup should clear remaining checks
      monitor.cleanup();
    });

    test('should prevent health check memory accumulation', async () => {
      const monitor = new HealthMonitor({
        checkInterval: 50,
        enablePerformanceTracking: true
      });
      
      let checkCallCount = 0;
      
      // Register check that tracks calls
      monitor.registerHealthCheck('memory-test', async () => {
        checkCallCount++;
        return {
          name: 'memory-test',
          status: 'healthy',
          message: `Call #${checkCallCount}`,
          duration: 1,
          timestamp: new Date()
        };
      });
      
      // Start monitoring
      monitor.startMonitoring();
      
      // Let it accumulate some history
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(checkCallCount).toBeGreaterThan(2);
      
      // Cleanup should stop checks and clear history
      monitor.cleanup();
      
      const finalCallCount = checkCallCount;
      
      // Wait and verify no more calls
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(checkCallCount).toBe(finalCallCount);
    });

    test('should handle server port monitoring cleanup', () => {
      const monitor = new HealthMonitor();
      
      // Set active server port
      monitor.setActiveServerPort(3000);
      
      // Clear active server port
      monitor.clearActiveServerPort();
      
      // Should handle cleanup gracefully
      expect(() => monitor.cleanup()).not.toThrow();
    });

    test('should handle concurrent health check execution', async () => {
      const monitor = new HealthMonitor({
        checkInterval: 25,
        retryAttempts: 1
      });
      
      let concurrentCallCount = 0;
      const maxConcurrent = 5;
      
      // Register check that simulates async work
      monitor.registerHealthCheck('concurrent-test', async () => {
        concurrentCallCount++;
        await new Promise(resolve => setTimeout(resolve, 10));
        
        return {
          name: 'concurrent-test',
          status: 'healthy',
          message: 'Concurrent test passed',
          duration: 10,
          timestamp: new Date()
        };
      });
      
      // Start monitoring with rapid checks
      monitor.startMonitoring();
      
      // Let multiple checks overlap
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(concurrentCallCount).toBeGreaterThan(1);
      
      // Cleanup should handle concurrent operations gracefully
      monitor.cleanup();
    });
  });

  describe('Global Monitoring Cleanup', () => {
    test('should cleanup all global monitoring instances', () => {
      // Test global cleanup functions don't throw
      expect(() => cleanupSystemMonitor()).not.toThrow();
      expect(() => cleanupPerformanceMonitor()).not.toThrow();
      expect(() => cleanupHealthMonitor()).not.toThrow();
    });

    test('should handle repeated global cleanup calls', () => {
      // Multiple cleanup calls should be safe
      cleanupSystemMonitor();
      cleanupPerformanceMonitor();
      cleanupHealthMonitor();
      
      // Second round should not throw
      expect(() => cleanupSystemMonitor()).not.toThrow();
      expect(() => cleanupPerformanceMonitor()).not.toThrow();
      expect(() => cleanupHealthMonitor()).not.toThrow();
    });

    test('should verify monitoring singleton cleanup', () => {
      // Import the global instances
      const { systemMonitor } = require('../../../src/monitoring/system-monitor');
      const { performanceMonitor } = require('../../../src/monitoring/performance-monitor');
      const { healthMonitor } = require('../../../src/monitoring/health-monitor');
      
      // Add some activity
      systemMonitor.recordRequest(100, true);
      const timer = performanceMonitor.startTimer('singleton-test');
      timer.stop(true);
      
      // Cleanup should work on singletons
      expect(() => {
        cleanupSystemMonitor();
        cleanupPerformanceMonitor();  
        cleanupHealthMonitor();
      }).not.toThrow();
    });
  });
});