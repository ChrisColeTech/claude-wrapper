/**
 * Logger Mock
 * Provides mock implementation for logger to prevent test output noise
 */

export const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock the logger module
jest.mock('../../src/utils/logger', () => ({
  logger: mockLogger
}));

export const clearLoggerMocks = () => {
  mockLogger.info.mockClear();
  mockLogger.debug.mockClear();
  mockLogger.warn.mockClear();
  mockLogger.error.mockClear();
};