/**
 * Global test setup
 * Configures test environment and mocks
 */

import { MockClaudeClient } from "./mocks/MockClaudeClient";
import { MockSessionStore } from "./mocks/MockSessionStore";
import { jest, afterEach, beforeEach, afterAll } from "@jest/globals";
import { globalCleanupRegistry, CleanupUtils } from "../src/utils/cleanup-utils";

// Configure test environment
process.env.NODE_ENV = "test";
process.env.API_KEY = "test-api-key";
process.env.PORT = "8001";

// Prevent signal handler registration in tests
process.env.JEST_WORKER_ID = "1";

// Set up memory monitoring for tests
let initialMemoryUsage: NodeJS.MemoryUsage;

// Global test utilities
(global as any).TestUtils = {
  createMockClaudeClient: () => new MockClaudeClient(),
  createMockSessionStore: () => new MockSessionStore(),
  sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
  forceGC: () => CleanupUtils.forceGarbageCollection(false),
  getMemoryUsage: () => CleanupUtils.getMemoryUsage(),
  checkMemoryLeak: (testName: string, beforeMem: NodeJS.MemoryUsage, afterMem: NodeJS.MemoryUsage) => {
    const heapDiff = afterMem.heapUsed - beforeMem.heapUsed;
    const heapDiffMB = heapDiff / 1024 / 1024;
    
    // Allow small memory increases (< 10MB) due to test overhead
    if (heapDiffMB > 10) {
      console.warn(`Potential memory leak detected in ${testName}: ${heapDiffMB.toFixed(2)}MB increase`);
    }
    
    return heapDiffMB;
  },
};

// Jest configuration
jest.setTimeout(30000);

// Phase 16A: OpenAI tools custom matchers removed

// Set up global memory monitoring and cleanup
beforeEach(() => {
  // Force garbage collection before each test if available
  CleanupUtils.forceGarbageCollection(false);
  
  // Record initial memory usage
  initialMemoryUsage = CleanupUtils.getMemoryUsage();
});

// Clean up after each test to prevent memory leaks
afterEach(() => {
  jest.clearAllMocks();
  
  // Clean up all global resources
  globalCleanupRegistry.cleanup();
  
  // Phase 16A: Monitoring cleanup functions removed
  
  // Clean up process signals (safe in test environment)
  CleanupUtils.cleanupProcessSignals({
    logActivity: false,
    testEnvironmentSkip: false // We want to clean up any test handlers
  });
  
  // Force garbage collection after cleanup
  CleanupUtils.forceGarbageCollection(false);
  
  // Check for memory leaks
  const finalMemoryUsage = CleanupUtils.getMemoryUsage();
  const testName = expect.getState().currentTestName || 'unknown';
  (global as any).TestUtils.checkMemoryLeak(testName, initialMemoryUsage, finalMemoryUsage);
});

// Final cleanup when all tests complete
afterAll(() => {
  // Comprehensive cleanup
  globalCleanupRegistry.cleanup();
  
  // Clean up any remaining signal handlers
  CleanupUtils.cleanupProcessSignals({
    logActivity: false,
    testEnvironmentSkip: false
  });
  
  // Force final garbage collection
  CleanupUtils.forceGarbageCollection(false);
  
  console.log('Global test cleanup completed');
});
