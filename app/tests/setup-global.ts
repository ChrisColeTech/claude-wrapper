/**
 * Global Test Setup
 * Configures the global test environment before any tests run
 */

import { jest } from '@jest/globals';
import { setupTestEnvironment } from './mocks';

// =============================================================================
// GLOBAL JEST CONFIGURATION
// =============================================================================

// Increase timeout for integration tests
jest.setTimeout(30000);

// =============================================================================
// GLOBAL MOCKS SETUP
// =============================================================================

// Mock modules that are always needed
jest.mock('fs', () => require('./mocks').mockFs);
jest.mock('child_process', () => require('./mocks').mockChildProcess);
jest.mock('os', () => require('./mocks').mockOs);
jest.mock('path', () => require('./mocks').mockPath);
jest.mock('crypto', () => require('./mocks').mockCrypto);

// =============================================================================
// GLOBAL SETUP
// =============================================================================

beforeAll(() => {
  // Setup test environment
  setupTestEnvironment();
  
  // Suppress console output during tests unless explicitly needed
  const originalConsole = global.console;
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests
});

// Handle uncaught exceptions in tests
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process in tests
});

// =============================================================================
// NODE.JS COMPATIBILITY
// =============================================================================

// Ensure TextEncoder/TextDecoder are available (for some dependencies)
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {};