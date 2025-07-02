/**
 * Global test setup
 * Configures test environment and mocks
 */

import { MockClaudeClient } from './mocks/MockClaudeClient';
import { MockSessionStore } from './mocks/MockSessionStore';

// Configure test environment
process.env.NODE_ENV = 'test';
process.env.API_KEY = 'test-api-key';
process.env.PORT = '8001';

// Suppress console output during tests unless debugging
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

// Global test utilities
(global as any).TestUtils = {
  createMockClaudeClient: () => new MockClaudeClient(),
  createMockSessionStore: () => new MockSessionStore(),
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
};

// Jest configuration
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
