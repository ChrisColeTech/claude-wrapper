/**
 * Test Setup Utilities
 * Provides reusable setup and teardown functions for tests
 */

import { OpenAIMessage } from '../../src/types';
import { clearLoggerMocks } from '../mocks/logger.mock';

// Set test environment
process.env['NODE_ENV'] = 'test';
process.env['JEST_WORKER_ID'] = '1';

/**
 * Common test setup function
 * Should be called in beforeEach for consistent test state
 */
export const setupTest = () => {
  // Clear all mocks
  clearLoggerMocks();
  
  // Reset timers
  jest.clearAllTimers();
  
  // Clear any global state if needed
};

/**
 * Common test cleanup function
 * Should be called in afterEach for proper cleanup
 */
export const cleanupTest = () => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Clear any timers
  jest.clearAllTimers();
};

/**
 * Create test messages for session testing
 */
export const createTestMessages = (count: number = 3): OpenAIMessage[] => {
  const messages: OpenAIMessage[] = [];
  
  for (let i = 0; i < count; i++) {
    const role = i % 2 === 0 ? 'user' : 'assistant';
    messages.push({
      role: role as 'user' | 'assistant',
      content: `Test message ${i + 1}`
    });
  }
  
  return messages;
};

/**
 * Create expired session data for testing
 */
export const createExpiredSession = (sessionId: string, messages: OpenAIMessage[] = []) => {
  const pastTime = new Date(Date.now() - 3600000); // 1 hour ago
  
  return {
    session_id: sessionId,
    messages,
    created_at: pastTime,
    last_accessed: pastTime,
    expires_at: pastTime
  };
};

/**
 * Create valid session data for testing
 */
export const createValidSession = (sessionId: string, messages: OpenAIMessage[] = []) => {
  const now = new Date();
  const futureTime = new Date(now.getTime() + 3600000); // 1 hour from now
  
  return {
    session_id: sessionId,
    messages,
    created_at: now,
    last_accessed: now,
    expires_at: futureTime
  };
};

/**
 * Wait for async operations to complete
 * Useful for testing async functionality
 */
export const flushPromises = () => new Promise(resolve => setImmediate(resolve));

/**
 * Mock date/time for consistent testing
 */
export const mockDate = (timestamp: number) => {
  const originalDate = global.Date;
  
  // Simple mock that replaces Date constructor and now method
  const MockDate: any = jest.fn().mockImplementation((arg?: any) => {
    if (arg === undefined) {
      return new originalDate(timestamp);
    }
    return new originalDate(arg);
  });
  
  // Add static methods
  MockDate.now = jest.fn(() => timestamp);
  MockDate.parse = originalDate.parse;
  MockDate.UTC = originalDate.UTC;
  
  global.Date = MockDate;
  
  // Return cleanup function
  return () => {
    global.Date = originalDate;
  };
};

/**
 * Create test timeout that resolves after specified milliseconds
 * Use sparingly and only when testing time-dependent behavior
 */
export const testTimeout = (ms: number = 0): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};