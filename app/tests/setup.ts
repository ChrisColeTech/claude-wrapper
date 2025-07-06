/**
 * Global Test Setup
 * Handles timeouts, environment setup, and cleanup
 */

// Set global timeouts
jest.setTimeout(30000);

// Track cleanup functions
const cleanupFunctions: (() => void | Promise<void>)[] = [];

// Global setup
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Disable console.log in tests unless DEBUG is set
  if (!process.env.DEBUG) {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
  }
});

// Global cleanup
afterAll(async () => {
  // Run all cleanup functions
  await Promise.all(cleanupFunctions.map(fn => fn()));
  
  // Final cleanup
  if (global.gc) {
    global.gc();
  }
  
  console.log('Global test cleanup completed');
});

// Helper function to register cleanup
(global as any).registerCleanup = (fn: () => void | Promise<void>) => {
  cleanupFunctions.push(fn);
};

// Store original process.exit but don't mock it (causes CI issues)
const originalExit = process.exit;

export {};