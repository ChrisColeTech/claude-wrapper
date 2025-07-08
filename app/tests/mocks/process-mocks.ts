/**
 * Process module mocks for testing Phase 6A components
 * Provides clean, controlled test environment for process management testing
 */

import { jest } from '@jest/globals';

/**
 * Mock filesystem operations for PID file testing
 */
export const mockFs = {
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
};

/**
 * Mock OS operations
 */
export const mockOs = {
  tmpdir: jest.fn(() => '/tmp'),
};

/**
 * Mock path operations
 */
export const mockPath = {
  join: jest.fn((...args: string[]) => args.join('/')),
};

/**
 * Mock process operations for signal testing
 */
export const mockProcess = {
  kill: jest.fn(),
  on: jest.fn(),
  exit: jest.fn(),
  pid: 12345,
};

/**
 * Mock child process operations for daemon testing
 */
export const mockChildProcess = {
  spawn: jest.fn(),
  exec: jest.fn(),
};

/**
 * Mock server instance for signal handler testing
 */
export const mockServer = {
  close: jest.fn((callback: (error?: Error) => void) => {
    setTimeout(() => callback(), 100);
  }),
  listen: jest.fn(),
};

/**
 * Mock logger for process testing
 */
export const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

/**
 * Mock session manager for signal handler testing
 */
export const mockSessionManager = {
  shutdown: jest.fn() as any,
};

/**
 * Reset all mocks to clean state
 */
export function resetProcessMocks(): void {
  Object.values(mockFs).forEach((mock) => {
    if (typeof mock === 'function' && 'mockReset' in mock) {
      mock.mockReset();
    }
  });

  Object.values(mockOs).forEach((mock) => {
    if (typeof mock === 'function' && 'mockReset' in mock) {
      mock.mockReset();
    }
  });

  Object.values(mockPath).forEach((mock) => {
    if (typeof mock === 'function' && 'mockReset' in mock) {
      mock.mockReset();
    }
  });

  Object.values(mockProcess).forEach((mock) => {
    if (typeof mock === 'function' && 'mockReset' in mock) {
      mock.mockReset();
    }
  });

  Object.values(mockChildProcess).forEach((mock) => {
    if (typeof mock === 'function' && 'mockReset' in mock) {
      mock.mockReset();
    }
  });

  Object.values(mockServer).forEach((mock) => {
    if (typeof mock === 'function' && 'mockReset' in mock) {
      mock.mockReset();
    }
  });

  Object.values(mockLogger).forEach((mock) => {
    if (typeof mock === 'function' && 'mockReset' in mock) {
      mock.mockReset();
    }
  });

  Object.values(mockSessionManager).forEach((mock) => {
    if (typeof mock === 'function' && 'mockReset' in mock) {
      mock.mockReset();
    }
  });

  // Reset default implementations
  mockOs.tmpdir.mockReturnValue('/tmp');
  mockPath.join.mockImplementation((...args: string[]) => args.join('/'));
  mockProcess.pid = 12345;
  mockServer.close.mockImplementation((callback: (error?: Error) => void) => {
    setTimeout(() => callback(), 100);
  });
}

/**
 * Setup successful PID file operations
 */
export function setupSuccessfulPidOperations(): void {
  mockFs.existsSync.mockReturnValue(true);
  mockFs.readFileSync.mockReturnValue('12345');
  mockFs.writeFileSync.mockReturnValue(undefined);
  mockFs.unlinkSync.mockReturnValue(undefined);
  mockProcess.kill.mockReturnValue(true);
}

/**
 * Setup failed PID file operations
 */
export function setupFailedPidOperations(): void {
  mockFs.existsSync.mockReturnValue(false);
  mockFs.readFileSync.mockImplementation(() => {
    throw new Error('File not found');
  });
  mockFs.writeFileSync.mockImplementation(() => {
    throw new Error('Permission denied');
  });
  mockProcess.kill.mockImplementation(() => {
    throw new Error('Process not found');
  });
}

/**
 * Setup successful signal operations
 */
export function setupSuccessfulSignalOperations(): void {
  mockProcess.on.mockReturnValue(undefined);
  mockProcess.exit.mockReturnValue(undefined);
  mockServer.close.mockImplementation((callback: (error?: Error) => void) => {
    setTimeout(() => callback(), 10);
  });
}

/**
 * Setup failed signal operations
 */
export function setupFailedSignalOperations(): void {
  mockServer.close.mockImplementation((callback: (error?: Error) => void) => {
    setTimeout(() => callback(new Error('Server close failed')), 10);
  });
}