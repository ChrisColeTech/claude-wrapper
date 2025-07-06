/**
 * Cleanup Utilities - Reusable cleanup functions for memory leak prevention
 * Single Responsibility: Provide reusable cleanup functions
 * DRY Principle: Common cleanup patterns extracted to utilities
 */

import { EventEmitter } from 'events';
import { getLogger } from './logger';

const logger = getLogger('CleanupUtils');

/**
 * Cleanup operation result
 */
export interface CleanupResult {
  success: boolean;
  cleanedCount: number;
  errors: string[];
  duration: number;
}

/**
 * EventEmitter cleanup options
 */
export interface EventEmitterCleanupOptions {
  removeAllListeners?: boolean;
  destroyIfPossible?: boolean;
  logActivity?: boolean;
  maxRetries?: number;
}

/**
 * Process signal cleanup options
 */
export interface ProcessSignalCleanupOptions {
  signals?: NodeJS.Signals[];
  removeAllSignalListeners?: boolean;
  logActivity?: boolean;
  testEnvironmentSkip?: boolean;
}

/**
 * Timer cleanup options
 */
export interface TimerCleanupOptions {
  clearTimeouts?: boolean;
  clearIntervals?: boolean;
  logActivity?: boolean;
}

/**
 * Memory cleanup utilities following DRY principles
 */
export class CleanupUtils {
  /**
   * Clean up EventEmitter instances safely
   * @param emitters Array of EventEmitter instances or single instance
   * @param options Cleanup options
   * @returns Cleanup result
   */
  static cleanupEventEmitters(
    emitters: EventEmitter | EventEmitter[],
    options: EventEmitterCleanupOptions = {}
  ): CleanupResult {
    const startTime = performance.now();
    const emitterArray = Array.isArray(emitters) ? emitters : [emitters];
    const errors: string[] = [];
    let cleanedCount = 0;

    const {
      removeAllListeners = true,
      destroyIfPossible = true,
      logActivity = false,
      maxRetries = 3
    } = options;

    for (const emitter of emitterArray) {
      if (!emitter || typeof emitter.removeAllListeners !== 'function') {
        errors.push('Invalid EventEmitter instance');
        continue;
      }

      let retries = 0;
      let cleaned = false;

      while (retries < maxRetries && !cleaned) {
        try {
          // Get listener count before cleanup
          const listenerCount = emitter.listenerCount ? 
            Object.keys(emitter.eventNames()).reduce((total, event) => {
              return total + emitter.listenerCount(event);
            }, 0) : 0;

          if (removeAllListeners) {
            emitter.removeAllListeners();
          }

          // Try to destroy if the emitter has a destroy method
          if (destroyIfPossible && typeof (emitter as any).destroy === 'function') {
            (emitter as any).destroy();
          }

          // Set max listeners to 0 to prevent new listeners
          if (typeof emitter.setMaxListeners === 'function') {
            emitter.setMaxListeners(0);
          }

          cleanedCount++;
          cleaned = true;

          if (logActivity) {
            logger.debug(`EventEmitter cleaned up`, {
              listenerCount,
              hasDestroy: typeof (emitter as any).destroy === 'function',
              attempt: retries + 1
            });
          }

        } catch (error) {
          retries++;
          const errorMsg = `EventEmitter cleanup failed (attempt ${retries}): ${error instanceof Error ? error.message : 'Unknown error'}`;
          
          if (retries >= maxRetries) {
            errors.push(errorMsg);
            if (logActivity) {
              logger.error(errorMsg);
            }
          }
        }
      }
    }

    const duration = performance.now() - startTime;
    const result: CleanupResult = {
      success: errors.length === 0,
      cleanedCount,
      errors,
      duration
    };

    if (logActivity) {
      logger.info('EventEmitter cleanup completed', result);
    }

    return result;
  }

  /**
   * Clean up process signal handlers safely
   * @param options Signal cleanup options
   * @returns Cleanup result
   */
  static cleanupProcessSignals(options: ProcessSignalCleanupOptions = {}): CleanupResult {
    const startTime = performance.now();
    const errors: string[] = [];
    let cleanedCount = 0;

    const {
      signals = ['SIGTERM', 'SIGINT', 'SIGHUP', 'SIGUSR1', 'SIGUSR2'],
      removeAllSignalListeners = true,
      logActivity = false,
      testEnvironmentSkip = true
    } = options;

    // Skip in test environment if requested
    if (testEnvironmentSkip && CleanupUtils.isTestEnvironment()) {
      return {
        success: true,
        cleanedCount: 0,
        errors: [],
        duration: performance.now() - startTime
      };
    }

    for (const signal of signals) {
      try {
        const listenerCount = process.listenerCount(signal);
        
        if (removeAllSignalListeners && listenerCount > 0) {
          process.removeAllListeners(signal);
          cleanedCount += listenerCount;

          if (logActivity) {
            logger.debug(`Process signal listeners cleaned up`, {
              signal,
              listenerCount
            });
          }
        }

      } catch (error) {
        const errorMsg = `Signal cleanup failed for ${signal}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        
        if (logActivity) {
          logger.error(errorMsg);
        }
      }
    }

    const duration = performance.now() - startTime;
    const result: CleanupResult = {
      success: errors.length === 0,
      cleanedCount,
      errors,
      duration
    };

    if (logActivity) {
      logger.info('Process signal cleanup completed', result);
    }

    return result;
  }

  /**
   * Clean up Node.js timers (timeouts and intervals)
   * @param timerRefs Array of timer references
   * @param options Timer cleanup options
   * @returns Cleanup result
   */
  static cleanupTimers(
    timerRefs: (NodeJS.Timeout | NodeJS.Timer)[],
    options: TimerCleanupOptions = {}
  ): CleanupResult {
    const startTime = performance.now();
    const errors: string[] = [];
    let cleanedCount = 0;

    const {
      clearTimeouts = true,
      clearIntervals = true,
      logActivity = false
    } = options;

    for (const timer of timerRefs) {
      if (!timer) {
        continue;
      }

      try {
        // Try both clearTimeout and clearInterval for compatibility
        if (clearTimeouts) {
          clearTimeout(timer as NodeJS.Timeout);
        }
        if (clearIntervals) {
          clearInterval(timer as NodeJS.Timeout);
        }

        cleanedCount++;

        if (logActivity) {
          logger.debug('Timer cleaned up', { timer: timer.toString() });
        }

      } catch (error) {
        const errorMsg = `Timer cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        
        if (logActivity) {
          logger.error(errorMsg);
        }
      }
    }

    const duration = performance.now() - startTime;
    const result: CleanupResult = {
      success: errors.length === 0,
      cleanedCount,
      errors,
      duration
    };

    if (logActivity) {
      logger.info('Timer cleanup completed', result);
    }

    return result;
  }

  /**
   * Force garbage collection if available
   * @param logActivity Whether to log the GC activity
   * @returns Whether GC was triggered
   */
  static forceGarbageCollection(logActivity: boolean = false): boolean {
    if (typeof global.gc === 'function') {
      try {
        const startTime = performance.now();
        global.gc();
        const duration = performance.now() - startTime;

        if (logActivity) {
          logger.debug('Forced garbage collection completed', { duration });
        }

        return true;
      } catch (error) {
        if (logActivity) {
          logger.error('Failed to force garbage collection', { error });
        }
        return false;
      }
    }

    if (logActivity) {
      logger.debug('Garbage collection not available');
    }

    return false;
  }

  /**
   * Get memory usage statistics
   * @returns Memory usage information
   */
  static getMemoryUsage(): NodeJS.MemoryUsage & { timestamp: number } {
    const memUsage = process.memoryUsage();
    return {
      ...memUsage,
      timestamp: Date.now()
    };
  }

  /**
   * Monitor memory usage and trigger cleanup if threshold exceeded
   * @param thresholdMB Memory threshold in megabytes
   * @param cleanupCallback Callback to run when threshold exceeded
   * @param logActivity Whether to log memory monitoring
   * @returns Current memory usage in MB
   */
  static monitorMemoryUsage(
    thresholdMB: number = 512,
    cleanupCallback?: () => void,
    logActivity: boolean = false
  ): number {
    const memUsage = CleanupUtils.getMemoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;

    if (logActivity) {
      logger.debug('Memory usage check', {
        heapUsedMB: heapUsedMB.toFixed(2),
        thresholdMB,
        exceedsThreshold: heapUsedMB > thresholdMB
      });
    }

    if (heapUsedMB > thresholdMB && cleanupCallback) {
      logger.warn('Memory threshold exceeded, triggering cleanup', {
        heapUsedMB: heapUsedMB.toFixed(2),
        thresholdMB
      });
      
      try {
        cleanupCallback();
      } catch (error) {
        logger.error('Memory cleanup callback failed', { error });
      }
    }

    return heapUsedMB;
  }

  /**
   * Check if running in test environment
   * @returns True if in test environment
   */
  static isTestEnvironment(): boolean {
    return (
      process.env.NODE_ENV === 'test' ||
      process.env.JEST_WORKER_ID !== undefined ||
      typeof global.describe === 'function' ||
      typeof (global as any).it === 'function'
    );
  }

  /**
   * Comprehensive cleanup operation
   * @param targets Cleanup targets
   * @param options Global cleanup options
   * @returns Combined cleanup result
   */
  static performComprehensiveCleanup(
    targets: {
      eventEmitters?: EventEmitter[];
      timers?: (NodeJS.Timeout | NodeJS.Timer)[];
      signals?: boolean;
      garbageCollection?: boolean;
    },
    options: {
      logActivity?: boolean;
      memoryThresholdMB?: number;
    } = {}
  ): CleanupResult {
    const startTime = performance.now();
    const { logActivity = false, memoryThresholdMB = 512 } = options;
    
    const errors: string[] = [];
    let totalCleanedCount = 0;

    // Memory usage before cleanup
    const memoryBefore = CleanupUtils.getMemoryUsage();

    if (logActivity) {
      logger.info('Starting comprehensive cleanup', {
        memoryBeforeMB: (memoryBefore.heapUsed / 1024 / 1024).toFixed(2),
        targets: Object.keys(targets).filter(key => targets[key as keyof typeof targets])
      });
    }

    // Clean up EventEmitters
    if (targets.eventEmitters && targets.eventEmitters.length > 0) {
      const emitterResult = CleanupUtils.cleanupEventEmitters(targets.eventEmitters, {
        logActivity
      });
      totalCleanedCount += emitterResult.cleanedCount;
      errors.push(...emitterResult.errors);
    }

    // Clean up timers
    if (targets.timers && targets.timers.length > 0) {
      const timerResult = CleanupUtils.cleanupTimers(targets.timers, {
        logActivity
      });
      totalCleanedCount += timerResult.cleanedCount;
      errors.push(...timerResult.errors);
    }

    // Clean up process signals
    if (targets.signals) {
      const signalResult = CleanupUtils.cleanupProcessSignals({
        logActivity
      });
      totalCleanedCount += signalResult.cleanedCount;
      errors.push(...signalResult.errors);
    }

    // Force garbage collection
    if (targets.garbageCollection) {
      CleanupUtils.forceGarbageCollection(logActivity);
    }

    // Memory usage after cleanup
    const memoryAfter = CleanupUtils.getMemoryUsage();
    const duration = performance.now() - startTime;

    const result: CleanupResult = {
      success: errors.length === 0,
      cleanedCount: totalCleanedCount,
      errors,
      duration
    };

    if (logActivity) {
      logger.info('Comprehensive cleanup completed', {
        ...result,
        memoryBeforeMB: (memoryBefore.heapUsed / 1024 / 1024).toFixed(2),
        memoryAfterMB: (memoryAfter.heapUsed / 1024 / 1024).toFixed(2),
        memoryFreedMB: ((memoryBefore.heapUsed - memoryAfter.heapUsed) / 1024 / 1024).toFixed(2)
      });
    }

    return result;
  }
}

/**
 * Singleton cleanup registry for tracking resources across the application
 */
export class GlobalCleanupRegistry {
  private static instance: GlobalCleanupRegistry;
  private eventEmitters: EventEmitter[] = [];
  private timers: (NodeJS.Timeout | NodeJS.Timer)[] = [];
  private signalHandlers: Map<NodeJS.Signals, Function[]> = new Map();
  private cleanupCallbacks: (() => void)[] = [];

  private constructor() {}

  static getInstance(): GlobalCleanupRegistry {
    if (!GlobalCleanupRegistry.instance) {
      GlobalCleanupRegistry.instance = new GlobalCleanupRegistry();
    }
    return GlobalCleanupRegistry.instance;
  }

  /**
   * Register an EventEmitter for cleanup
   */
  registerEventEmitter(emitter: EventEmitter): void {
    this.eventEmitters.push(emitter);
  }

  /**
   * Register a timer for cleanup
   */
  registerTimer(timer: NodeJS.Timeout | NodeJS.Timer): void {
    this.timers.push(timer);
  }

  /**
   * Register a signal handler for cleanup
   */
  registerSignalHandler(signal: NodeJS.Signals, handler: Function): void {
    if (!this.signalHandlers.has(signal)) {
      this.signalHandlers.set(signal, []);
    }
    this.signalHandlers.get(signal)!.push(handler);
  }

  /**
   * Register a custom cleanup callback
   */
  registerCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Perform cleanup of all registered resources
   */
  cleanup(): CleanupResult {
    const startTime = performance.now();
    const errors: string[] = [];
    let totalCleanedCount = 0;

    // Run custom cleanup callbacks
    for (const callback of this.cleanupCallbacks) {
      try {
        callback();
      } catch (error) {
        errors.push(`Cleanup callback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Comprehensive cleanup
    const result = CleanupUtils.performComprehensiveCleanup({
      eventEmitters: this.eventEmitters,
      timers: this.timers,
      signals: true,
      garbageCollection: true
    }, {
      logActivity: true
    });

    // Clear registries
    this.eventEmitters = [];
    this.timers = [];
    this.signalHandlers.clear();
    this.cleanupCallbacks = [];

    const duration = performance.now() - startTime;

    return {
      success: errors.length === 0 && result.success,
      cleanedCount: totalCleanedCount + result.cleanedCount,
      errors: [...errors, ...result.errors],
      duration
    };
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    eventEmitters: number;
    timers: number;
    signalHandlers: number;
    cleanupCallbacks: number;
  } {
    return {
      eventEmitters: this.eventEmitters.length,
      timers: this.timers.length,
      signalHandlers: Array.from(this.signalHandlers.values()).reduce((sum, handlers) => sum + handlers.length, 0),
      cleanupCallbacks: this.cleanupCallbacks.length
    };
  }
}

/**
 * Global cleanup registry instance
 */
export const globalCleanupRegistry = GlobalCleanupRegistry.getInstance();

/**
 * Convenience function for quick cleanup operations
 */
export function quickCleanup(options: {
  eventEmitters?: EventEmitter[];
  timers?: (NodeJS.Timeout | NodeJS.Timer)[];
  signals?: boolean;
  garbageCollection?: boolean;
  logActivity?: boolean;
} = {}): CleanupResult {
  return CleanupUtils.performComprehensiveCleanup(options, {
    logActivity: options.logActivity
  });
}

/**
 * Setup automatic cleanup on process exit
 */
export function setupGlobalCleanup(): void {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  
  for (const signal of signals) {
    process.on(signal, () => {
      logger.info(`Received ${signal}, performing global cleanup`);
      globalCleanupRegistry.cleanup();
    });
  }

  // Cleanup on uncaught exceptions (after logging)
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception, performing emergency cleanup', { error });
    globalCleanupRegistry.cleanup();
  });

  // Cleanup on unhandled rejections (after logging)
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection, performing emergency cleanup', { reason });
    globalCleanupRegistry.cleanup();
  });
}