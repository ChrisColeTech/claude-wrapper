/**
 * Test Setup File
 * Configures the test environment before each test file runs
 */

import { setupTestEnvironment, teardownTestEnvironment } from './mocks';

// =============================================================================
// GLOBAL CONFIGURATION
// =============================================================================

jest.setTimeout(30000);

// =============================================================================
// TEST ENVIRONMENT SETUP
// =============================================================================

beforeEach(() => {
  setupTestEnvironment();
});

afterEach(() => {
  teardownTestEnvironment();
});

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
});

// Helper function to register cleanup
(global as any).registerCleanup = (fn: () => void | Promise<void>) => {
  cleanupFunctions.push(fn);
};

// =============================================================================
// GLOBAL MOCKS
// =============================================================================

// Mock Claude Code SDK
jest.mock('@anthropic-ai/claude-code', () => ({
  ClaudeCode: jest.fn().mockImplementation(() => ({
    sendMessage: jest.fn(),
    verifyConnection: jest.fn(),
    getConfig: jest.fn(),
    isConnected: jest.fn().mockReturnValue(true),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock Winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => require('./mocks').mockLoggerImpl),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
    json: jest.fn(),
    errors: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

// =============================================================================
// CUSTOM MATCHERS
// =============================================================================

declare global {
  namespace jest {
    interface Matchers<R> {
      toEndWith(expected: string): R;
    }
  }
}

expect.extend({
  toEndWith(received: string, expected: string) {
    const pass = received.endsWith(expected);
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to end with ${expected}`,
      pass,
    };
  },
});

export {};