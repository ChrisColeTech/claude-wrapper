/**
 * Minimal Test Setup for CI
 * Bare minimum to get tests passing
 */

// Set global timeout
jest.setTimeout(10000);

// Set test environment
beforeAll(() => {
  process.env.NODE_ENV = 'test';
});

export {};