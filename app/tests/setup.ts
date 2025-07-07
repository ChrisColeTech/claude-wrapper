import 'jest';

// Global test configuration
// Increase timeout for integration and E2E tests
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env['NODE_ENV'] = 'test';
  
  // Suppress console logs during tests unless DEBUG is set
  if (!process.env['DEBUG']) {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    // Keep console.error for debugging failures
  }
});

afterAll(async () => {
  // Cleanup after all tests
  // Give time for async operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});

beforeEach(() => {
  // Clear all mocks before each test to prevent contamination
  jest.clearAllMocks();
  
  // Reset any environment variables that might affect tests
  delete process.env['TEST_OVERRIDE'];
});

afterEach(async () => {
  // Cleanup after each test
  // Clear any intervals or timeouts that might be hanging
  jest.clearAllTimers();
  
  // Give time for async cleanup
  await new Promise(resolve => setTimeout(resolve, 10));
});

// Global error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests, just log the error
});

// Configure test environment
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});