/**
 * Global test setup
 * Configures test environment and mocks
 */

import { MockClaudeClient } from "./mocks/MockClaudeClient";
import { MockSessionStore } from "./mocks/MockSessionStore";
import { setupCustomMatchers } from "./helpers/openai-tools/assertion-helpers";
import { jest, afterEach } from "@jest/globals";

// Configure test environment
process.env.NODE_ENV = "test";
process.env.API_KEY = "test-api-key";
process.env.PORT = "8001";

// Global test utilities
(global as any).TestUtils = {
  createMockClaudeClient: () => new MockClaudeClient(),
  createMockSessionStore: () => new MockSessionStore(),
  sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
};

// Jest configuration
jest.setTimeout(30000);

// Setup custom matchers for OpenAI tools testing
setupCustomMatchers();

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
