/**
 * Process test setup utilities for Phase 6A testing
 * Provides clean test environment setup and teardown
 */

import { jest } from '@jest/globals';
import { resetProcessMocks } from '../mocks/process-mocks';

/**
 * Mock module paths for consistent module mocking
 */
export const MODULE_MOCKS = {
  FS: 'fs',
  OS: 'os', 
  PATH: 'path',
  CHILD_PROCESS: 'child_process',
  LOGGER: '../../src/utils/logger',
  SESSION_MANAGER: '../../src/session/manager',
} as const;

/**
 * Setup process test environment with proper mocking
 */
export function setupProcessTestEnvironment(): void {
  // Mock filesystem
  jest.doMock(MODULE_MOCKS.FS, () => ({
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    unlinkSync: jest.fn(),
  }));

  // Mock OS
  jest.doMock(MODULE_MOCKS.OS, () => ({
    tmpdir: jest.fn(() => '/tmp'),
  }));

  // Mock path
  jest.doMock(MODULE_MOCKS.PATH, () => ({
    join: jest.fn((...args: string[]) => args.join('/')),
  }));

  // Mock child process
  jest.doMock(MODULE_MOCKS.CHILD_PROCESS, () => ({
    spawn: jest.fn(),
    exec: jest.fn(),
  }));

  // Mock logger
  jest.doMock(MODULE_MOCKS.LOGGER, () => ({
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  }));

  // Mock session manager
  jest.doMock(MODULE_MOCKS.SESSION_MANAGER, () => ({
    sessionManager: {
      shutdown: jest.fn().mockResolvedValue(undefined),
    },
  }));
}

/**
 * Cleanup process test environment
 */
export function cleanupProcessTestEnvironment(): void {
  // Reset all mocks
  resetProcessMocks();
  
  // Clear module registry
  jest.resetModules();
  
  // Clear all timers
  jest.clearAllTimers();
  
  // Restore all mocks
  jest.restoreAllMocks();
}

/**
 * Create test timeout wrapper to ensure tests complete
 */
export function withTestTimeout<T>(
  testFn: () => Promise<T> | T,
  timeoutMs: number = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Test timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    Promise.resolve(testFn())
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

/**
 * Wait for next tick in event loop
 */
export function nextTick(): Promise<void> {
  return new Promise((resolve) => {
    process.nextTick(resolve);
  });
}

/**
 * Wait for specified time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Mock environment variables for testing
 */
export function mockEnvVars(vars: Record<string, string>): void {
  Object.entries(vars).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

/**
 * Cleanup environment variables after testing
 */
export function cleanupEnvVars(keys: string[]): void {
  keys.forEach((key) => {
    delete process.env[key];
  });
}

/**
 * Create temporary test directory path
 */
export function createTestTempPath(fileName: string): string {
  return `/tmp/test-${Date.now()}-${fileName}`;
}

/**
 * Validate error is of expected type and message
 */
export function expectError(
  error: unknown,
  expectedType: string,
  expectedMessage?: string
): void {
  expect(error).toBeInstanceOf(Error);
  const err = error as Error;
  expect(err.name).toBe(expectedType);
  
  if (expectedMessage) {
    expect(err.message).toContain(expectedMessage);
  }
}