/**
 * Test Environment Detection Utility
 * Centralized test environment detection and resource management
 * 
 * Single Responsibility: Provide consistent test environment detection
 * Used by all components that need test-aware behavior
 */

/**
 * Check if the current process is running in a test environment
 * Uses multiple detection methods for reliability
 */
export function isTestEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.JEST_WORKER_ID !== undefined ||
    typeof global.describe === 'function' ||
    typeof (global as any).it === 'function' ||
    typeof jest !== 'undefined'
  );
}

/**
 * Check if the current process is running in CI environment
 */
export function isCIEnvironment(): boolean {
  return !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.TRAVIS ||
    process.env.CIRCLECI
  );
}

/**
 * Should skip resource cleanup (for debugging)
 */
export function shouldSkipCleanup(): boolean {
  return process.env.SKIP_CLEANUP === 'true' || process.env.DEBUG_MEMORY === 'true';
}

/**
 * Test environment configuration interface
 */
export interface TestEnvironmentConfig {
  isTest: boolean;
  isCI: boolean;
  skipCleanup: boolean;
  maxListeners: number;
  memoryTracking: boolean;
}

/**
 * Get comprehensive test environment configuration
 */
export function getTestEnvironmentConfig(): TestEnvironmentConfig {
  return {
    isTest: isTestEnvironment(),
    isCI: isCIEnvironment(),
    skipCleanup: shouldSkipCleanup(),
    maxListeners: parseInt(process.env.TEST_MAX_LISTENERS || '50', 10),
    memoryTracking: process.env.TRACK_MEMORY === 'true' || isCIEnvironment()
  };
}

/**
 * Process listener management for tests
 */
export class TestProcessManager {
  private static instance: TestProcessManager;
  private originalMaxListeners: number;
  private testListeners: Array<{event: string, listener: (...args: any[]) => void}> = [];

  private constructor() {
    this.originalMaxListeners = process.getMaxListeners();
  }

  static getInstance(): TestProcessManager {
    if (!TestProcessManager.instance) {
      TestProcessManager.instance = new TestProcessManager();
    }
    return TestProcessManager.instance;
  }

  /**
   * Setup test environment with increased listener limits
   */
  setupTestEnvironment(): void {
    if (!isTestEnvironment()) {
      return;
    }

    const config = getTestEnvironmentConfig();
    process.setMaxListeners(config.maxListeners);

    // Track listeners added during tests
    this.trackProcessListeners();
  }

  /**
   * Track process listeners for cleanup
   */
  private trackProcessListeners(): void {
    const originalAddListener = process.addListener.bind(process);
    const self = this;

    (process as any).addListener = function(event: string, listener: (...args: any[]) => void) {
      if (isTestEnvironment()) {
        self.testListeners.push({ event, listener });
      }
      return originalAddListener(event as any, listener);
    };

    const originalOn = process.on.bind(process);
    (process as any).on = function(event: string, listener: (...args: any[]) => void) {
      if (isTestEnvironment()) {
        self.testListeners.push({ event, listener });
      }
      return originalOn(event as any, listener);
    };
  }

  /**
   * Clean up all test listeners
   */
  cleanupTestListeners(): void {
    if (!isTestEnvironment()) {
      return;
    }

    // Remove tracked listeners
    this.testListeners.forEach(({ event, listener }) => {
      try {
        process.removeListener(event, listener);
      } catch (error) {
        // Ignore errors during cleanup
      }
    });

    this.testListeners = [];

    // Remove all signal listeners
    const signalEvents = ['SIGTERM', 'SIGINT', 'SIGUSR2', 'SIGHUP', 'exit', 'uncaughtException', 'unhandledRejection'] as const;
    signalEvents.forEach(event => {
      try {
        process.removeAllListeners(event);
      } catch (error) {
        // Ignore errors during cleanup
      }
    });
  }

  /**
   * Restore original process configuration
   */
  restoreProcessEnvironment(): void {
    if (!isTestEnvironment()) {
      return;
    }

    this.cleanupTestListeners();
    process.setMaxListeners(this.originalMaxListeners);
  }

  /**
   * Get current listener count for debugging
   */
  getListenerCounts(): Record<string, number> {
    const events = ['SIGTERM', 'SIGINT', 'SIGUSR2', 'exit'];
    const counts: Record<string, number> = {};
    
    events.forEach(event => {
      counts[event] = process.listenerCount(event);
    });

    return counts;
  }
}

/**
 * Memory usage tracking for tests
 */
export class TestMemoryTracker {
  private static instance: TestMemoryTracker;
  private memorySnapshots: Array<{timestamp: number, usage: NodeJS.MemoryUsage}> = [];
  private trackingEnabled: boolean = false;

  private constructor() {}

  static getInstance(): TestMemoryTracker {
    if (!TestMemoryTracker.instance) {
      TestMemoryTracker.instance = new TestMemoryTracker();
    }
    return TestMemoryTracker.instance;
  }

  /**
   * Start memory tracking
   */
  startTracking(): void {
    if (!isTestEnvironment()) {
      return;
    }

    this.trackingEnabled = true;
    this.takeSnapshot();
  }

  /**
   * Take a memory usage snapshot
   */
  takeSnapshot(): void {
    if (!this.trackingEnabled) {
      return;
    }

    this.memorySnapshots.push({
      timestamp: Date.now(),
      usage: process.memoryUsage()
    });

    // Keep only last 100 snapshots
    if (this.memorySnapshots.length > 100) {
      this.memorySnapshots = this.memorySnapshots.slice(-100);
    }
  }

  /**
   * Stop tracking and return results
   */
  stopTracking(): Array<{timestamp: number, usage: NodeJS.MemoryUsage}> {
    this.trackingEnabled = false;
    const snapshots = [...this.memorySnapshots];
    this.memorySnapshots = [];
    return snapshots;
  }

  /**
   * Check for memory leaks
   */
  checkForLeaks(thresholdMB: number = 50): boolean {
    if (this.memorySnapshots.length < 2) {
      return false;
    }

    const first = this.memorySnapshots[0];
    const last = this.memorySnapshots[this.memorySnapshots.length - 1];
    
    const heapGrowth = (last.usage.heapUsed - first.usage.heapUsed) / 1024 / 1024;
    return heapGrowth > thresholdMB;
  }
}

/**
 * Global test environment manager
 */
export const testEnvironmentManager = {
  processManager: TestProcessManager.getInstance(),
  memoryTracker: TestMemoryTracker.getInstance(),

  /**
   * Setup complete test environment
   */
  setup(): void {
    if (!isTestEnvironment()) {
      return;
    }

    this.processManager.setupTestEnvironment();
    this.memoryTracker.startTracking();
  },

  /**
   * Cleanup complete test environment
   */
  cleanup(): void {
    if (!isTestEnvironment()) {
      return;
    }

    this.processManager.cleanupTestListeners();
    this.memoryTracker.stopTracking();
  },

  /**
   * Complete reset for test isolation
   */
  reset(): void {
    if (!isTestEnvironment()) {
      return;
    }

    this.cleanup();
    this.setup();
  }
};