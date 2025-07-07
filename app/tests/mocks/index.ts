/**
 * Mock System Index
 * Centralizes all mock management and setup/teardown
 */

import { mockLoggerImpl, resetLoggerMocks } from './logger';
import { mockFsImpl, resetFsMocks } from './fs';
import { mockFetchImpl, setupFetchMocks, resetFetchMocks } from './fetch';
import { mockProcessImpl, resetProcessMocks, clearEnvironment } from './process';
import { mockCryptoImpl, resetCryptoMocks } from './crypto';
import { mockClaudeSDK, mockClaudeClient, resetClaudeSDKMocks } from './claude-sdk';
import { resetExpressMocks } from './express';
import { resetSessionMocks } from './session';
import { resetAuthMocks } from './auth';
import { resetMonitoringMocks } from './monitoring';

// =============================================================================
// MOCK IMPLEMENTATIONS
// =============================================================================

export const mocks = {
  logger: mockLoggerImpl,
  fs: mockFsImpl,
  fetch: mockFetchImpl,
  process: mockProcessImpl,
  crypto: mockCryptoImpl,
  claudeSDK: mockClaudeSDK,
  claudeClient: mockClaudeClient,
};

// =============================================================================
// ENVIRONMENT MANAGEMENT
// =============================================================================

export const mockEnv = {
  original: {} as NodeJS.ProcessEnv,
  
  store() {
    this.original = { ...process.env };
  },
  
  restore() {
    process.env = { ...this.original };
  },
  
  clear() {
    clearEnvironment();
  },
  
  set(key: string, value: string | undefined) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  },
  
  setMultiple(vars: Record<string, string | undefined>) {
    Object.entries(vars).forEach(([key, value]) => {
      this.set(key, value);
    });
  }
};

// =============================================================================
// MOCK UTILITIES
// =============================================================================

export function createMockProvider(method: string) {
  return {
    getMethod: jest.fn().mockReturnValue(method),
    canDetect: jest.fn().mockReturnValue(false),
    isConfigured: jest.fn().mockReturnValue(false),
    validate: jest.fn().mockResolvedValue({
      valid: false,
      errors: [],
      config: {},
      method,
    }),
    getRequiredEnvVars: jest.fn().mockReturnValue([]),
  };
}

export function createMockValidationResult(valid: boolean, method: string, errors: string[] = [], config: any = {}) {
  return {
    valid,
    errors,
    config,
    method,
  };
}

export function createMockCredentialValidator() {
  return {
    validate: jest.fn(),
    validateFormat: jest.fn(),
    validateWithAPI: jest.fn(),
  };
}

// =============================================================================
// SETUP AND TEARDOWN
// =============================================================================

export function setupTestEnvironment() {
  // Store original environment
  mockEnv.store();
  
  // Clear environment
  mockEnv.clear();
  
  // Reset all mocks to clean state
  resetAllMocks();
  
  // Setup global mocks
  setupGlobalMocks();
}

export function teardownTestEnvironment() {
  // Reset all mocks
  resetAllMocks();
  
  // Restore original environment
  mockEnv.restore();
  
  // Clear Jest mocks
  jest.clearAllMocks();
}

function setupGlobalMocks() {
  setupFetchMocks();
}

function resetAllMocks() {
  resetLoggerMocks();
  resetFsMocks();
  resetFetchMocks();
  resetProcessMocks();
  resetCryptoMocks();
  resetClaudeSDKMocks();
  resetExpressMocks();
  resetSessionMocks();
  resetAuthMocks();
  resetMonitoringMocks();
}

// =============================================================================
// INDIVIDUAL MOCK EXPORTS
// =============================================================================

export * from './logger';
export * from './fs';
export * from './fetch';
export * from './process';
export * from './crypto';
export * from './claude-sdk';
export * from './express';
export * from './session';
export * from './auth';
export * from './monitoring';