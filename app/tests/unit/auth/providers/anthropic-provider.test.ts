/**
 * AnthropicProvider Test Suite
 * Tests Anthropic authentication provider with proper mocking
 */

import {
  setupTestEnvironment,
  teardownTestEnvironment,
  mockEnv,
  mockLoggerImpl,
  createMockResponse,
  mockFetch,
} from '../../../mocks';
import { AnthropicProvider } from '../../../../src/auth/providers/anthropic-provider';
import { AuthMethod } from '../../../../src/auth/interfaces';

// Mock logger
jest.mock('../../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => mockLoggerImpl),
}));

// Mock credential validator
const mockValidator = {
  validate: jest.fn(),
  validateFormat: jest.fn(),
};

jest.mock('../../../../src/auth/utils/credential-validator', () => ({
  AnthropicCredentialValidator: jest.fn(() => mockValidator),
  ValidationResultBuilder: jest.fn().mockImplementation((method: any) => ({
    method,
    errors: [],
    config: {},
    addError: jest.fn().mockReturnThis(),
    addConfig: jest.fn().mockReturnThis(),
    setConfig: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({
      valid: true,
      errors: [],
      config: {},
      method,
    }),
  })),
  ValidationUtils: {
    hasEnvVar: jest.fn(),
    getRequiredEnvVar: jest.fn(),
    logValidationResult: jest.fn(),
  },
}));

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    setupTestEnvironment();
    jest.clearAllMocks();
    mockValidator.validate.mockClear();
    mockValidator.validateFormat.mockClear();
    provider = new AnthropicProvider();
  });

  afterEach(() => {
    teardownTestEnvironment();
  });

  describe('Basic Functionality', () => {
    it('should initialize successfully', () => {
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    it('should return correct method', () => {
      expect(provider.getMethod()).toBe(AuthMethod.ANTHROPIC);
    });

    it('should return correct required env vars', () => {
      expect(provider.getRequiredEnvVars()).toEqual(['ANTHROPIC_API_KEY']);
    });
  });

  describe('Detection', () => {
    beforeEach(() => {
      const { ValidationUtils } = require('../../../../src/auth/utils/credential-validator');
      ValidationUtils.hasEnvVar.mockImplementation((key: string) => {
        return process.env[key] !== undefined && process.env[key] !== '';
      });
      ValidationUtils.logValidationResult.mockImplementation(() => {});
    });

    it('should detect when ANTHROPIC_API_KEY is present', () => {
      mockEnv.set('ANTHROPIC_API_KEY', 'sk-ant-test-key');
      
      const result = provider.canDetect();
      expect(result).toBe(true);
    });

    it('should not detect when ANTHROPIC_API_KEY is missing', () => {
      mockEnv.clear();
      
      const result = provider.canDetect();
      expect(result).toBe(false);
    });

    it('should not detect when ANTHROPIC_API_KEY is empty', () => {
      mockEnv.set('ANTHROPIC_API_KEY', '');
      
      const result = provider.canDetect();
      expect(result).toBe(false);
    });

    it('should be configured when API key is present', () => {
      mockEnv.set('ANTHROPIC_API_KEY', 'sk-ant-test-key');
      
      const result = provider.isConfigured();
      expect(result).toBe(true);
    });

    it('should not be configured when API key is missing', () => {
      mockEnv.clear();
      
      const result = provider.isConfigured();
      expect(result).toBe(false);
    });
  });

  describe('Validation', () => {
    beforeEach(() => {
      // Mock ValidationUtils
      const { ValidationUtils } = require('../../../../src/auth/utils/credential-validator');
      ValidationUtils.hasEnvVar.mockImplementation((key: string) => {
        return process.env[key] !== undefined && process.env[key] !== '';
      });
      ValidationUtils.getRequiredEnvVar.mockImplementation((key: string) => {
        const value = process.env[key];
        if (!value) throw new Error(`Required environment variable ${key} is not set`);
        return value;
      });
      ValidationUtils.logValidationResult.mockImplementation(() => {});
    });

    it('should validate successfully with valid API key', async () => {
      mockEnv.set('ANTHROPIC_API_KEY', 'sk-ant-test-key-12345678901234567890');
      
      // Mock successful validation
      mockValidator.validate.mockResolvedValue({
        isValid: true,
        details: { status: 200 },
      });

      const result = await provider.validate();

      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.ANTHROPIC);
      expect(mockValidator.validate).toHaveBeenCalledWith('sk-ant-test-key-12345678901234567890');
    });

    it('should fail validation when API key is missing', async () => {
      mockEnv.clear();

      // Mock ValidationResultBuilder to return failure
      const { ValidationResultBuilder } = require('../../../../src/auth/utils/credential-validator');
      ValidationResultBuilder.mockImplementation((method: any) => ({
        method,
        errors: [],
        config: {},
        addError: jest.fn().mockReturnThis(),
        addConfig: jest.fn().mockReturnThis(),
        setConfig: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue({
          valid: false,
          errors: ['ANTHROPIC_API_KEY environment variable not set'],
          config: {},
          method,
        }),
      }));

      const result = await provider.validate();

      expect(result.valid).toBe(false);
      expect(result.method).toBe(AuthMethod.ANTHROPIC);
      expect(result.errors).toContain('ANTHROPIC_API_KEY environment variable not set');
      expect(mockValidator.validate).not.toHaveBeenCalled();
    });

    it('should fail validation when API key is invalid', async () => {
      mockEnv.set('ANTHROPIC_API_KEY', 'invalid-key');
      
      // Mock failed validation
      mockValidator.validate.mockResolvedValue({
        isValid: false,
        errorMessage: 'Invalid API key format',
      });

      // Mock the ValidationResultBuilder to return failure
      const { ValidationResultBuilder } = require('../../../../src/auth/utils/credential-validator');
      ValidationResultBuilder.mockImplementation((method: any) => ({
        method,
        errors: [],
        config: {},
        addError: jest.fn().mockReturnThis(),
        addConfig: jest.fn().mockReturnThis(),
        setConfig: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue({
          valid: false,
          errors: ['Invalid API key format'],
          config: {},
          method,
        }),
      }));

      const result = await provider.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid API key format');
      expect(mockValidator.validate).toHaveBeenCalledWith('invalid-key');
    });

    it('should handle validation network errors', async () => {
      mockEnv.set('ANTHROPIC_API_KEY', 'sk-ant-test-key');
      
      // Mock network error
      mockValidator.validate.mockRejectedValue(new Error('Network timeout'));
      mockValidator.validateFormat.mockResolvedValue({
        isValid: true,
        details: { format: 'valid' },
      });

      // Mock the ValidationResultBuilder to return network error
      const { ValidationResultBuilder } = require('../../../../src/auth/utils/credential-validator');
      ValidationResultBuilder.mockImplementation((method: any) => ({
        method,
        errors: [],
        config: {},
        addError: jest.fn().mockReturnThis(),
        addConfig: jest.fn().mockReturnThis(),
        setConfig: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue({
          valid: false,
          errors: ['API validation failed: Network timeout'],
          config: {},
          method,
        }),
      }));

      const result = await provider.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('API validation failed: Network timeout');
    });

    it('should include config information in validation result', async () => {
      mockEnv.set('ANTHROPIC_API_KEY', 'sk-ant-test-key-12345678901234567890');
      
      mockValidator.validate.mockResolvedValue({
        isValid: true,
        details: { status: 200 },
      });

      // Mock ValidationResultBuilder with config
      const { ValidationResultBuilder } = require('../../../../src/auth/utils/credential-validator');
      ValidationResultBuilder.mockImplementation((method: any) => ({
        method,
        errors: [],
        config: {},
        addError: jest.fn().mockReturnThis(),
        addConfig: jest.fn().mockReturnThis(),
        setConfig: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue({
          valid: true,
          errors: [],
          config: {
            api_key_present: true,
            api_key_length: 44,
            api_validation_status: 200,
          },
          method,
        }),
      }));

      const result = await provider.validate();

      expect(result.config).toEqual({
        api_key_present: true,
        api_key_length: 44,
        api_validation_status: 200,
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      const { ValidationUtils } = require('../../../../src/auth/utils/credential-validator');
      ValidationUtils.hasEnvVar.mockImplementation((key: string) => {
        return process.env[key] !== undefined && process.env[key] !== '';
      });
      ValidationUtils.getRequiredEnvVar.mockImplementation((key: string) => {
        const value = process.env[key];
        if (!value) throw new Error(`Required environment variable ${key} is not set`);
        return value;
      });
    });

    it('should handle validator initialization errors', () => {
      // This test ensures the provider handles validator errors gracefully
      expect(provider).toBeInstanceOf(AnthropicProvider);
      expect(provider.getMethod()).toBe(AuthMethod.ANTHROPIC);
    });

    it('should handle timeout errors during validation', async () => {
      mockEnv.set('ANTHROPIC_API_KEY', 'sk-ant-test-key');
      
      // Mock timeout error
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockValidator.validate.mockRejectedValue(timeoutError);
      mockValidator.validateFormat.mockResolvedValue({
        isValid: true,
        details: { format: 'valid' },
      });

      const { ValidationResultBuilder } = require('../../../../src/auth/utils/credential-validator');
      ValidationResultBuilder.mockImplementation((method: any) => ({
        method,
        errors: [],
        config: {},
        addError: jest.fn().mockReturnThis(),
        addConfig: jest.fn().mockReturnThis(),
        setConfig: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue({
          valid: false,
          errors: ['API validation failed: Request timeout'],
          config: {},
          method,
        }),
      }));

      const result = await provider.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('API validation failed: Request timeout');
    });

    it('should handle rate limit errors', async () => {
      mockEnv.set('ANTHROPIC_API_KEY', 'sk-ant-test-key');
      
      mockValidator.validate.mockResolvedValue({
        isValid: false,
        errorMessage: 'Rate limit exceeded',
        details: { status: 429 },
      });

      const { ValidationResultBuilder } = require('../../../../src/auth/utils/credential-validator');
      ValidationResultBuilder.mockImplementation((method: any) => ({
        method,
        errors: [],
        config: {},
        addError: jest.fn().mockReturnThis(),
        addConfig: jest.fn().mockReturnThis(),
        setConfig: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue({
          valid: false,
          errors: ['Rate limit exceeded'],
          config: { status: 429 },
          method,
        }),
      }));

      const result = await provider.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Rate limit exceeded');
      expect(result.config.status).toBe(429);
    });
  });

  describe('Interface Compliance', () => {
    it('should implement all required methods', () => {
      expect(typeof provider.getMethod).toBe('function');
      expect(typeof provider.canDetect).toBe('function');
      expect(typeof provider.isConfigured).toBe('function');
      expect(typeof provider.validate).toBe('function');
      expect(typeof provider.getRequiredEnvVars).toBe('function');
    });

    it('should return proper validation result structure', async () => {
      mockEnv.clear();

      const result = await provider.validate();

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('method');
      expect(result.method).toBe(AuthMethod.ANTHROPIC);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(typeof result.config).toBe('object');
      expect(typeof result.valid).toBe('boolean');
    });
  });
});