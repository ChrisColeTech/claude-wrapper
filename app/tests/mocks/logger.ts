/**
 * Logger Mock
 * Provides controlled logging for tests
 */

export const mockLoggerMethods = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
};

export const mockLoggerImpl = mockLoggerMethods;

export function resetLoggerMocks() {
  Object.values(mockLoggerMethods).forEach(mock => {
    mock.mockReset();
  });
}

export function createMockLogger() {
  return { ...mockLoggerMethods };
}