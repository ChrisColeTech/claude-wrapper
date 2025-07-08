/**
 * Authentication test setup utilities
 * Provides common setup and teardown for auth tests
 */

import { mockEnvironment } from '../../mocks/auth-mocks';

export const authTestSetup = {
  beforeEach: () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Clear environment variables
    mockEnvironment.clear();
    
    // Reset modules to ensure clean state
    jest.resetModules();
  },

  afterEach: () => {
    // Clean up any remaining timers
    jest.clearAllTimers();
    
    // Clear environment variables
    mockEnvironment.clear();
  },

  beforeAll: () => {
    // Use fake timers for deterministic testing
    jest.useFakeTimers();
  },

  afterAll: () => {
    // Restore real timers
    jest.useRealTimers();
  }
};

export const authTestHelpers = {
  expectValidResult: (result: any, method: string) => {
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.method).toBe(method);
    expect(result.config.validated).toBe(true);
  },

  expectInvalidResult: (result: any, method?: string) => {
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    if (method) {
      expect(result.method).toBe(method);
    }
  },

  expectApiKeyFormat: (key: string, prefix: string) => {
    expect(key).toMatch(new RegExp(`^${prefix}\\w+$`));
    expect(key.length).toBeGreaterThan(prefix.length + 10);
  }
};