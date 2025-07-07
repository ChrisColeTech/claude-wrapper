/**
 * Memory Monitoring Setup for Tests
 * Enhanced memory tracking and leak detection for test suites
 */

import { testEnvironmentManager } from './utils/test-environment';

// Track original console methods for restoration
const originalConsole = {
  warn: console.warn,
  error: console.error
};

// Track memory warnings
let memoryWarnings: any[] = [];
let maxListenerWarnings: any[] = [];

/**
 * Setup memory monitoring before each test
 */
beforeEach(() => {
  // Clear warning arrays
  memoryWarnings = [];
  maxListenerWarnings = [];
  
  // Setup test environment with memory tracking
  testEnvironmentManager.setup();
  
  // Intercept memory-related warnings
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const message = args.join(' ');
    
    if (message.includes('MaxListenersExceededWarning')) {
      maxListenerWarnings.push({
        message,
        timestamp: Date.now(),
        args
      });
    } else if (message.includes('memory') || message.includes('heap')) {
      memoryWarnings.push({
        message,
        timestamp: Date.now(),
        args
      });
    }
    
    // Still log to original console in debug mode
    if (process.env.DEBUG) {
      originalWarn.apply(console, args);
    }
  };
  
  // Track process listener counts
  const listenerCounts = {
    SIGTERM: process.listenerCount('SIGTERM'),
    SIGINT: process.listenerCount('SIGINT'),
    SIGUSR2: process.listenerCount('SIGUSR2'),
    exit: process.listenerCount('exit')
  };
  
  // Store initial counts for comparison
  (global as any).__initialListenerCounts = listenerCounts;
});

/**
 * Cleanup and validation after each test
 */
afterEach(() => {
  // Check for memory leaks
  const memoryLeakDetected = testEnvironmentManager.memoryTracker.checkForLeaks(50);
  
  if (memoryLeakDetected) {
    console.error('⚠️  Memory leak detected during test execution');
  }
  
  // Check for MaxListenersExceededWarning
  if (maxListenerWarnings.length > 0) {
    console.error('⚠️  MaxListenersExceededWarning detected:', maxListenerWarnings);
    
    // This should fail the test as it indicates our fixes aren't working
    expect(maxListenerWarnings.length).toBe(0);
  }
  
  // Check for excessive listener growth
  const initialCounts = (global as any).__initialListenerCounts || {};
  const finalCounts = {
    SIGTERM: process.listenerCount('SIGTERM'),
    SIGINT: process.listenerCount('SIGINT'),
    SIGUSR2: process.listenerCount('SIGUSR2'),
    exit: process.listenerCount('exit')
  };
  
  // In test environment, listener counts should not grow significantly
  Object.keys(finalCounts).forEach(event => {
    const initial = initialCounts[event] || 0;
    const final = (finalCounts as any)[event];
    const growth = final - initial;
    
    if (growth > 5) { // Allow small growth but catch significant leaks
      console.warn(`⚠️  Significant listener growth for ${event}: ${initial} → ${final} (+${growth})`);
    }
  });
  
  // Cleanup test environment
  testEnvironmentManager.cleanup();
  
  // Restore console.warn
  console.warn = originalConsole.warn;
  
  // Clear global state
  delete (global as any).__initialListenerCounts;
});

/**
 * Global memory monitoring setup
 */
beforeAll(() => {
  // Setup enhanced error tracking
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const message = args.join(' ');
    
    // Track specific error patterns that indicate memory issues
    if (message.includes('heap') || 
        message.includes('memory') || 
        message.includes('MaxListeners') ||
        message.includes('EMFILE') ||
        message.includes('ENOMEM')) {
      
      // Store error for analysis
      if (!(global as any).__memoryErrors) {
        (global as any).__memoryErrors = [];
      }
      (global as any).__memoryErrors.push({
        message,
        timestamp: Date.now(),
        stack: new Error().stack
      });
    }
    
    // Always log errors in debug mode
    if (process.env.DEBUG) {
      originalError.apply(console, args);
    }
  };
  
  // Setup process monitoring
  let processWarningHandler: ((warning: any) => void) | null = null;
  
  processWarningHandler = (warning: any) => {
    if (warning.name === 'MaxListenersExceededWarning') {
      if (!(global as any).__processWarnings) {
        (global as any).__processWarnings = [];
      }
      (global as any).__processWarnings.push({
        name: warning.name,
        message: warning.message,
        timestamp: Date.now()
      });
    }
  };
  
  process.on('warning', processWarningHandler);
  
  // Store reference for cleanup
  (global as any).__processWarningHandler = processWarningHandler;
});

/**
 * Global memory monitoring cleanup
 */
afterAll(() => {
  // Report any accumulated memory issues
  const memoryErrors = (global as any).__memoryErrors || [];
  const processWarnings = (global as any).__processWarnings || [];
  
  if (memoryErrors.length > 0) {
    console.log(`\n📊 Memory-related errors detected: ${memoryErrors.length}`);
    if (process.env.DEBUG) {
      memoryErrors.forEach((error: any, index: number) => {
        console.log(`  ${index + 1}. ${error.message} (${new Date(error.timestamp).toISOString()})`);
      });
    }
  }
  
  if (processWarnings.length > 0) {
    console.log(`\n⚠️  Process warnings detected: ${processWarnings.length}`);
    processWarnings.forEach((warning: any, index: number) => {
      console.log(`  ${index + 1}. ${warning.name}: ${warning.message}`);
    });
  }
  
  // Remove process warning handler
  const warningHandler = (global as any).__processWarningHandler;
  if (warningHandler) {
    process.removeListener('warning', warningHandler);
  }
  
  // Restore console methods
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  
  // Final cleanup
  testEnvironmentManager.cleanup();
  
  // Clean up global state
  delete (global as any).__memoryErrors;
  delete (global as any).__processWarnings;
  delete (global as any).__processWarningHandler;
});

/**
 * Custom memory assertion helpers
 */
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveNoMemoryLeaks(): R;
      toHaveNoExcessiveListeners(): R;
    }
  }
}

expect.extend({
  toHaveNoMemoryLeaks(received: any) {
    const hasLeaks = testEnvironmentManager.memoryTracker.checkForLeaks(50);
    
    return {
      message: () => hasLeaks 
        ? 'Expected no memory leaks but detected significant memory growth'
        : 'No memory leaks detected',
      pass: !hasLeaks,
    };
  },
  
  toHaveNoExcessiveListeners(received: any) {
    const counts = {
      SIGTERM: process.listenerCount('SIGTERM'),
      SIGINT: process.listenerCount('SIGINT'),
      SIGUSR2: process.listenerCount('SIGUSR2')
    };
    
    const maxCount = Math.max(...Object.values(counts));
    const excessive = maxCount > 10; // Threshold for "excessive"
    
    return {
      message: () => excessive
        ? `Expected no excessive listeners but found: ${JSON.stringify(counts)}`
        : `Listener counts are within normal range: ${JSON.stringify(counts)}`,
      pass: !excessive,
    };
  },
});

export {};