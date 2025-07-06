/**
 * Long-Running Stability Tests for Memory Leak Prevention
 * Tests system stability under sustained load without memory warnings
 * Phase 3: Test Suite Memory Leak Fixes
 */

import { ResourceManager, createResourceManager } from '../../../src/utils/resource-manager';
import { CleanupUtils, globalCleanupRegistry } from '../../../src/utils/cleanup-utils';
import { SystemMonitor } from '../../../src/monitoring/system-monitor';
import { PerformanceMonitor } from '../../../src/monitoring/performance-monitor';
import { HealthMonitor } from '../../../src/monitoring/health-monitor';
import { EventEmitter } from 'events';

describe('Long-Running Memory Leak Stability Tests', () => {
  let initialMemory: NodeJS.MemoryUsage;
  let testStartTime: number;

  beforeEach(() => {
    testStartTime = Date.now();
    initialMemory = (global as any).TestUtils.getMemoryUsage();
    
    // Force garbage collection at test start
    (global as any).TestUtils.forceGC();
  });

  afterEach(() => {
    // Comprehensive cleanup after each test
    globalCleanupRegistry.cleanup();
    CleanupUtils.performComprehensiveCleanup({
      signals: true,
      garbageCollection: true
    }, { logActivity: false });
    
    const testDuration = Date.now() - testStartTime;
    const finalMemory = (global as any).TestUtils.getMemoryUsage();
    const memoryDiff = (global as any).TestUtils.checkMemoryLeak(
      'Stability Test',
      initialMemory,
      finalMemory
    );
    
    console.log(`Test completed in ${testDuration}ms, memory diff: ${memoryDiff.toFixed(2)}MB`);
  });

  describe('Resource Manager Stability', () => {
    test('should handle sustained resource allocation and cleanup for 30 seconds', async () => {
      const testDuration = 30000; // 30 seconds
      const cycleInterval = 100; // 100ms cycles
      const resourcesPerCycle = 5;
      
      let totalCycles = 0;
      let totalResourcesCreated = 0;
      const startTime = Date.now();
      
      const masterManager = createResourceManager('stability-master');
      
      const runCycle = async (): Promise<void> => {
        return new Promise((resolve) => {
          const cycleManager = createResourceManager(`cycle-${totalCycles}`);
          
          // Create various resource types
          for (let i = 0; i < resourcesPerCycle; i++) {
            // Timeout
            cycleManager.trackTimeout(() => {}, 1000, `timeout-${i}`);
            
            // Interval (short-lived)
            const interval = cycleManager.trackInterval(() => {}, 50, `interval-${i}`);
            setTimeout(() => {
              clearInterval(interval);
            }, 200);
            
            // EventEmitter
            const emitter = new EventEmitter();
            cycleManager.trackEmitter(emitter, `emitter-${i}`);
            
            // Custom resource
            cycleManager.trackCustom(
              { data: new Array(100).fill(i) },
              () => {},
              `custom-${i}`
            );
            
            totalResourcesCreated++;
          }
          
          // Clean up after a short time
          setTimeout(() => {
            cycleManager.cleanup();
            cycleManager.destroy();
            resolve();
          }, 50);
        });
      };
      
      // Run cycles for the test duration
      while (Date.now() - startTime < testDuration) {
        await runCycle();
        totalCycles++;
        
        // Force GC every 100 cycles
        if (totalCycles % 100 === 0) {
          (global as any).TestUtils.forceGC();
          
          const currentMemory = (global as any).TestUtils.getMemoryUsage();
          const memoryIncrease = (currentMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
          
          // Memory should not grow excessively
          expect(memoryIncrease).toBeLessThan(50); // Less than 50MB growth
        }
        
        // Small delay between cycles
        await new Promise(resolve => setTimeout(resolve, cycleInterval));
      }
      
      masterManager.cleanup();
      
      console.log(`Completed ${totalCycles} cycles, created ${totalResourcesCreated} resources`);
      expect(totalCycles).toBeGreaterThan(250); // Should run many cycles
      expect(totalResourcesCreated).toBeGreaterThan(1250);
    }, 35000);

    test('should handle concurrent resource managers for 20 seconds', async () => {
      const testDuration = 20000; // 20 seconds
      const managerCount = 10;
      const operationsPerManager = 20;
      
      let completedOperations = 0;
      const startTime = Date.now();
      
      const runConcurrentManagers = async (): Promise<void> => {
        const managers = Array.from({ length: managerCount }, (_, i) => 
          createResourceManager(`concurrent-${i}`)
        );
        
        const promises = managers.map(async (manager, index) => {
          for (let op = 0; op < operationsPerManager; op++) {
            // Random resource type
            const resourceType = op % 4;
            
            switch (resourceType) {
              case 0:
                manager.trackTimeout(() => {}, 100, `concurrent-timeout-${index}-${op}`);
                break;
              case 1:
                const interval = manager.trackInterval(() => {}, 20, `concurrent-interval-${index}-${op}`);
                setTimeout(() => clearInterval(interval), 50);
                break;
              case 2:
                const emitter = new EventEmitter();
                manager.trackEmitter(emitter, `concurrent-emitter-${index}-${op}`);
                break;
              case 3:
                manager.trackCustom({}, () => {}, `concurrent-custom-${index}-${op}`);
                break;
            }
            
            completedOperations++;
            
            // Small random delay
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
          }
        });
        
        await Promise.all(promises);
        
        // Cleanup all managers
        await Promise.all(managers.map(async (manager) => {
          manager.cleanup();
          manager.destroy();
        }));
      };
      
      // Run multiple rounds of concurrent managers
      while (Date.now() - startTime < testDuration) {
        await runConcurrentManagers();
        
        // Force GC between rounds
        (global as any).TestUtils.forceGC();
        
        const currentMemory = (global as any).TestUtils.getMemoryUsage();
        const memoryIncrease = (currentMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
        
        // Memory growth should be controlled
        expect(memoryIncrease).toBeLessThan(30); // Less than 30MB growth
      }
      
      console.log(`Completed ${completedOperations} concurrent operations`);
      expect(completedOperations).toBeGreaterThan(1000);
    }, 25000);

    test('should handle event emitter stress test for 15 seconds', async () => {
      const testDuration = 15000; // 15 seconds
      const emitterCount = 20;
      const listenersPerEmitter = 10;
      const eventsPerSecond = 50;
      
      let totalEventsEmitted = 0;
      let totalEventsReceived = 0;
      const startTime = Date.now();
      
      const resourceManager = createResourceManager('emitter-stress');
      const emitters: EventEmitter[] = [];
      
      // Create emitters with listeners
      for (let e = 0; e < emitterCount; e++) {
        const emitter = new EventEmitter();
        emitter.setMaxListeners(listenersPerEmitter + 5); // Prevent warnings
        
        resourceManager.trackEmitter(emitter, `stress-emitter-${e}`);
        emitters.push(emitter);
        
        // Add listeners
        for (let l = 0; l < listenersPerEmitter; l++) {
          resourceManager.trackListener(emitter, 'stress-test', () => {
            totalEventsReceived++;
          }, `stress-listener-${e}-${l}`);
        }
      }
      
      // Emit events continuously
      const emitInterval = setInterval(() => {
        if (Date.now() - startTime >= testDuration) {
          clearInterval(emitInterval);
          return;
        }
        
        // Emit events on all emitters
        emitters.forEach(emitter => {
          for (let i = 0; i < eventsPerSecond / emitterCount; i++) {
            emitter.emit('stress-test', { data: totalEventsEmitted });
            totalEventsEmitted++;
          }
        });
      }, 1000);
      
      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, testDuration + 100));
      
      clearInterval(emitInterval);
      
      // Cleanup
      resourceManager.cleanup();
      resourceManager.destroy();
      
      console.log(`Emitted ${totalEventsEmitted} events, received ${totalEventsReceived}`);
      expect(totalEventsEmitted).toBeGreaterThan(500);
      expect(totalEventsReceived).toBe(totalEventsEmitted * listenersPerEmitter);
    }, 20000);
  });

  describe('Monitoring System Stability', () => {
    test('should handle continuous monitoring for 25 seconds', async () => {
      const testDuration = 25000; // 25 seconds
      const monitoringInterval = 50; // 50ms monitoring
      
      let healthCheckCount = 0;
      let performanceMetricCount = 0;
      const startTime = Date.now();
      
      // System Monitor
      const systemMonitor = new SystemMonitor({
        enabled: true,
        thresholds: {
          responseTime: 1000,
          errorRate: 10,
          memoryUsage: 90,
          cpuUsage: 90,
          diskUsage: 95
        },
        channels: {
          console: false,
          file: false
        }
      });
      
      // Performance Monitor
      const perfMonitor = new PerformanceMonitor(60000);
      
      // Health Monitor
      const healthMonitor = new HealthMonitor({
        checkInterval: monitoringInterval,
        timeout: 100,
        retryAttempts: 1,
        alertThresholds: {
          memoryUsage: 0.95,
          responseTime: 500,
          consecutiveFailures: 5
        },
        enableDetailedMetrics: false,
        enablePerformanceTracking: false
      });
      
      // Register custom health check
      healthMonitor.registerHealthCheck('stability-test', async () => {
        healthCheckCount++;
        return {
          name: 'stability-test',
          status: 'healthy',
          message: 'Stability test running',
          duration: 1,
          timestamp: new Date()
        };
      });
      
      // Start monitoring
      systemMonitor.start(monitoringInterval);
      healthMonitor.startMonitoring();
      
      // Generate performance metrics continuously
      const metricInterval = setInterval(() => {
        if (Date.now() - startTime >= testDuration) {
          clearInterval(metricInterval);
          return;
        }
        
        // Simulate various operations
        for (let i = 0; i < 5; i++) {
          const timer = perfMonitor.startTimer(`stability-op-${i}`);
          setTimeout(() => {
            timer.stop(Math.random() > 0.1); // 90% success rate
            performanceMetricCount++;
          }, Math.random() * 20);
        }
        
        // Record system requests
        systemMonitor.recordRequest(Math.random() * 100, Math.random() > 0.05);
      }, 20);
      
      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, testDuration + 100));
      
      clearInterval(metricInterval);
      
      // Stop monitoring
      systemMonitor.cleanup();
      perfMonitor.cleanup();
      healthMonitor.cleanup();
      
      console.log(`Health checks: ${healthCheckCount}, Performance metrics: ${performanceMetricCount}`);
      expect(healthCheckCount).toBeGreaterThan(400); // Should run many checks
      expect(performanceMetricCount).toBeGreaterThan(5000);
    }, 30000);

    test('should handle monitoring with frequent start/stop cycles for 20 seconds', async () => {
      const testDuration = 20000; // 20 seconds
      const cycleInterval = 500; // 500ms cycles
      
      let startStopCycles = 0;
      const startTime = Date.now();
      
      const runMonitoringCycle = async (): Promise<void> => {
        const monitor = new SystemMonitor({
          enabled: true,
          channels: { console: false, file: false }
        });
        
        const perfMonitor = new PerformanceMonitor(10000);
        
        // Start monitoring
        monitor.start(100);
        
        // Generate some activity
        for (let i = 0; i < 10; i++) {
          const timer = perfMonitor.startTimer(`cycle-op-${i}`);
          monitor.recordRequest(50, true);
          timer.stop(true);
        }
        
        // Run for a short time
        await new Promise(resolve => setTimeout(resolve, cycleInterval / 2));
        
        // Stop and cleanup
        monitor.cleanup();
        perfMonitor.cleanup();
        
        startStopCycles++;
      };
      
      // Run start/stop cycles
      while (Date.now() - startTime < testDuration) {
        await runMonitoringCycle();
        
        // Force GC every 10 cycles
        if (startStopCycles % 10 === 0) {
          (global as any).TestUtils.forceGC();
          
          const currentMemory = (global as any).TestUtils.getMemoryUsage();
          const memoryIncrease = (currentMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
          
          // Memory should not accumulate from monitoring cycles
          expect(memoryIncrease).toBeLessThan(20); // Less than 20MB growth
        }
        
        // Small delay between cycles
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      console.log(`Completed ${startStopCycles} monitoring start/stop cycles`);
      expect(startStopCycles).toBeGreaterThan(30);
    }, 25000);
  });

  describe('Comprehensive Stability Tests', () => {
    test('should handle mixed workload for 40 seconds without memory leaks', async () => {
      const testDuration = 40000; // 40 seconds
      let operationCount = 0;
      const startTime = Date.now();
      
      const runMixedWorkload = async (): Promise<void> => {
        const workloadManager = createResourceManager('mixed-workload');
        
        // Random workload selection
        const workloadType = Math.floor(Math.random() * 4);
        
        switch (workloadType) {
          case 0: // Resource management workload
            for (let i = 0; i < 20; i++) {
              workloadManager.trackTimeout(() => {}, 100, `mixed-timeout-${i}`);
              const emitter = new EventEmitter();
              workloadManager.trackEmitter(emitter, `mixed-emitter-${i}`);
            }
            break;
            
          case 1: // Performance monitoring workload
            const perfMonitor = new PerformanceMonitor(5000);
            for (let i = 0; i < 15; i++) {
              const timer = perfMonitor.startTimer(`mixed-perf-${i}`);
              setTimeout(() => timer.stop(true), Math.random() * 50);
            }
            setTimeout(() => perfMonitor.cleanup(), 100);
            break;
            
          case 2: // Event emitter workload
            const emitters = [];
            for (let i = 0; i < 10; i++) {
              const emitter = new EventEmitter();
              workloadManager.trackEmitter(emitter, `mixed-event-${i}`);
              
              // Add listeners and emit events
              for (let j = 0; j < 5; j++) {
                workloadManager.trackListener(emitter, 'test', () => {}, `mixed-listener-${i}-${j}`);
              }
              
              emitter.emit('test');
              emitters.push(emitter);
            }
            break;
            
          case 3: // Signal handler workload (in test env, just tracking)
            for (let i = 0; i < 5; i++) {
              workloadManager.trackSignalHandler('SIGUSR1', () => {}, `mixed-signal-${i}`);
            }
            break;
        }
        
        operationCount++;
        
        // Cleanup after short time
        setTimeout(() => {
          workloadManager.cleanup();
          workloadManager.destroy();
        }, 200);
      };
      
      // Run mixed workload continuously
      const workloadInterval = setInterval(() => {
        if (Date.now() - startTime >= testDuration) {
          clearInterval(workloadInterval);
          return;
        }
        
        runMixedWorkload();
      }, 100);
      
      // Memory monitoring
      const memoryCheckInterval = setInterval(() => {
        if (Date.now() - startTime >= testDuration) {
          clearInterval(memoryCheckInterval);
          return;
        }
        
        (global as any).TestUtils.forceGC();
        
        const currentMemory = (global as any).TestUtils.getMemoryUsage();
        const memoryIncrease = (currentMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
        
        // Memory growth should be controlled even under mixed load
        expect(memoryIncrease).toBeLessThan(40); // Less than 40MB growth
      }, 5000);
      
      // Wait for test completion
      await new Promise(resolve => setTimeout(resolve, testDuration + 500));
      
      clearInterval(workloadInterval);
      clearInterval(memoryCheckInterval);
      
      console.log(`Completed ${operationCount} mixed workload operations`);
      expect(operationCount).toBeGreaterThan(300);
    }, 45000);

    test('should handle stress test with rapid allocation/deallocation for 30 seconds', async () => {
      const testDuration = 30000; // 30 seconds
      const allocationsPerCycle = 50;
      let totalAllocations = 0;
      let totalDeallocations = 0;
      const startTime = Date.now();
      
      const runAllocationCycle = (): Promise<void> => {
        return new Promise((resolve) => {
          const resources: any[] = [];
          const managers: ResourceManager[] = [];
          
          // Rapid allocation
          for (let i = 0; i < allocationsPerCycle; i++) {
            const manager = createResourceManager(`stress-${i}`);
            managers.push(manager);
            
            // Allocate various resources
            const timeout = manager.trackTimeout(() => {}, 1000, `stress-timeout-${i}`);
            const emitter = new EventEmitter();
            manager.trackEmitter(emitter, `stress-emitter-${i}`);
            
            resources.push({ timeout, emitter, manager });
            totalAllocations++;
          }
          
          // Rapid deallocation after short delay
          setTimeout(() => {
            managers.forEach(manager => {
              manager.cleanup();
              manager.destroy();
              totalDeallocations++;
            });
            resolve();
          }, 50);
        });
      };
      
      // Run allocation cycles
      while (Date.now() - startTime < testDuration) {
        await runAllocationCycle();
        
        // Check memory every 100 allocations
        if (totalAllocations % (allocationsPerCycle * 20) === 0) {
          (global as any).TestUtils.forceGC();
          
          const currentMemory = (global as any).TestUtils.getMemoryUsage();
          const memoryIncrease = (currentMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
          
          // Rapid allocation/deallocation should not cause memory accumulation
          expect(memoryIncrease).toBeLessThan(25); // Less than 25MB growth
        }
        
        // Small delay between cycles
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      
      console.log(`Allocations: ${totalAllocations}, Deallocations: ${totalDeallocations}`);
      expect(totalAllocations).toBeGreaterThan(1000);
      expect(totalDeallocations).toBe(Math.floor(totalAllocations / allocationsPerCycle));
    }, 35000);

    test('should verify memory stability over extended monitoring period', async () => {
      const testDuration = 35000; // 35 seconds
      const sampleInterval = 2000; // 2 second samples
      const maxMemoryIncrease = 30; // 30MB max increase
      
      let sampleCount = 0;
      const startTime = Date.now();
      const memorysamples: number[] = [];
      
      // Long-running monitor
      const monitor = new SystemMonitor({
        enabled: true,
        channels: { console: false, file: false }
      });
      
      const perfMonitor = new PerformanceMonitor(testDuration);
      
      monitor.start(200);
      
      // Continuous activity
      const activityInterval = setInterval(() => {
        if (Date.now() - startTime >= testDuration) {
          clearInterval(activityInterval);
          return;
        }
        
        // Simulate server activity
        for (let i = 0; i < 10; i++) {
          const timer = perfMonitor.startTimer(`extended-op-${i}`);
          monitor.recordRequest(Math.random() * 200, Math.random() > 0.02);
          setTimeout(() => timer.stop(true), Math.random() * 30);
        }
      }, 100);
      
      // Memory sampling
      const sampleInterval_id = setInterval(() => {
        if (Date.now() - startTime >= testDuration) {
          clearInterval(sampleInterval_id);
          return;
        }
        
        (global as any).TestUtils.forceGC();
        
        const currentMemory = (global as any).TestUtils.getMemoryUsage();
        const memoryUsageMB = currentMemory.heapUsed / 1024 / 1024;
        const memoryIncrease = (currentMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
        
        memorysamples.push(memoryUsageMB);
        sampleCount++;
        
        console.log(`Sample ${sampleCount}: ${memoryUsageMB.toFixed(2)}MB (${memoryIncrease.toFixed(2)}MB increase)`);
        
        // Memory should not grow excessively
        expect(memoryIncrease).toBeLessThan(maxMemoryIncrease);
        
        // Memory should not show consistent upward trend
        if (memorysamples.length >= 5) {
          const recentSamples = memorysamples.slice(-5);
          const trend = recentSamples[4] - recentSamples[0];
          expect(trend).toBeLessThan(15); // Less than 15MB trend over 5 samples
        }
      }, sampleInterval);
      
      // Wait for test completion
      await new Promise(resolve => setTimeout(resolve, testDuration + 500));
      
      clearInterval(activityInterval);
      clearInterval(sampleInterval_id);
      
      // Cleanup
      monitor.cleanup();
      perfMonitor.cleanup();
      
      console.log(`Collected ${sampleCount} memory samples over ${testDuration/1000} seconds`);
      expect(sampleCount).toBeGreaterThan(15);
      
      // Final memory should be stable
      const finalMemory = (global as any).TestUtils.getMemoryUsage();
      const totalIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      expect(totalIncrease).toBeLessThan(maxMemoryIncrease);
    }, 40000);
  });
});