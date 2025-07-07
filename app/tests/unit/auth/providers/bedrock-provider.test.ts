/**
 * BedrockProvider Test Suite
 * Tests AWS Bedrock authentication provider with proper mocking
 */

import {
  setupTestEnvironment,
  teardownTestEnvironment,
  clearEnvironment,
  mockEnvironment,
  mockExistsSync,
} from '../../../mocks';
import { BedrockProvider } from '../../../../src/auth/providers/bedrock-provider';
import { AuthMethod } from '../../../../src/auth/interfaces';

// Mock logger
jest.mock('../../../../src/utils/logger', () => ({
  getLogger: () => require('../../../mocks/logger').createMockLogger(),
}));

// Mock fs module
jest.mock('fs', () => require('../../../mocks/fs').default);

// Mock os module
jest.mock('os', () => ({
  homedir: jest.fn(() => '/home/test'),
}));

// Mock path module
jest.mock('path', () => ({
  join: jest.fn((...parts) => parts.join('/')),
}));

// Mock credential validator
const mockValidator = {
  validate: jest.fn(),
};

jest.mock('../../../../src/auth/utils/credential-validator', () => ({
  AWSCredentialValidator: jest.fn(() => mockValidator),
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
    fileExists: jest.fn(),
    logValidationResult: jest.fn(),
  },
}));

describe('BedrockProvider', () => {
  let provider: BedrockProvider;

  beforeEach(() => {
    setupTestEnvironment();
    clearEnvironment();
    jest.clearAllMocks();
    mockValidator.validate.mockClear();
    provider = new BedrockProvider();
  });

  afterEach(() => {
    teardownTestEnvironment();
  });

  describe('Basic Functionality', () => {
    it('should initialize successfully', () => {
      expect(provider).toBeInstanceOf(BedrockProvider);
    });

    it('should return correct method', () => {
      expect(provider.getMethod()).toBe(AuthMethod.BEDROCK);
    });

    it('should return correct required env vars', () => {
      const requiredVars = provider.getRequiredEnvVars();
      expect(requiredVars).toContain('AWS_ACCESS_KEY_ID');
      expect(requiredVars).toContain('AWS_SECRET_ACCESS_KEY');
      expect(requiredVars).toContain('AWS_REGION');
    });
  });

  describe('Detection', () => {
    beforeEach(() => {
      const { ValidationUtils } = require('../../../../src/auth/utils/credential-validator');
      ValidationUtils.hasEnvVar.mockImplementation((key: string) => {
        return process.env[key] !== undefined && process.env[key] !== '';
      });
      ValidationUtils.fileExists.mockImplementation((path: string) => {
        return mockExistsSync(path);
      });
      ValidationUtils.logValidationResult.mockImplementation(() => {});
    });

    it('should detect when AWS credentials are present via environment', () => {
      mockEnvironment({
        'AWS_ACCESS_KEY_ID': 'AKIATEST',
        'AWS_SECRET_ACCESS_KEY': 'test-secret',
        'AWS_REGION': 'us-east-1',
      });
      
      const result = provider.canDetect();
      expect(result).toBe(true);
    });

    it('should detect when AWS profile is configured', () => {
      mockEnvironment({ AWS_PROFILE: 'default' });
      mockExistsSync.mockReturnValue(true);
      
      const result = provider.canDetect();
      expect(result).toBe(true);
    });

    it('should detect when AWS credentials file exists', () => {
      mockExistsSync.mockReturnValue(true);
      
      const result = provider.canDetect();
      expect(result).toBe(true);
    });

    it('should not detect when no AWS credentials are present', () => {
      clearEnvironment();
      mockExistsSync.mockReturnValue(false);
      
      const result = provider.canDetect();
      expect(result).toBe(false);
    });

    it('should be configured when credentials are present', () => {
      mockEnvironment({
        'AWS_ACCESS_KEY_ID': 'AKIATEST',
        'AWS_SECRET_ACCESS_KEY': 'test-secret',
      });
      
      const result = provider.isConfigured();
      expect(result).toBe(true);
    });

    it('should not be configured when credentials are missing', () => {
      clearEnvironment();
      mockExistsSync.mockReturnValue(false);
      
      const result = provider.isConfigured();
      expect(result).toBe(false);
    });
  });

  describe('Validation', () => {
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
      ValidationUtils.fileExists.mockImplementation((path: string) => {
        return mockExistsSync(path);
      });
      ValidationUtils.logValidationResult.mockImplementation(() => {});
    });

    it('should validate successfully with valid AWS credentials', async () => {
      mockEnvironment({
        'AWS_ACCESS_KEY_ID': 'AKIATEST12345',
        'AWS_SECRET_ACCESS_KEY': 'test-secret-key',
        'AWS_REGION': 'us-east-1',
      });
      
      // Mock successful validation
      mockValidator.validate.mockResolvedValue({
        isValid: true,
        details: { status: 200 },
      });

      const result = await provider.validate();

      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.BEDROCK);
      expect(mockValidator.validate).toHaveBeenCalled();
    });

    it('should fail validation when AWS credentials are missing', async () => {
      clearEnvironment();

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
          errors: ['No AWS credentials found'],
          config: {},
          method,
        }),
      }));

      const result = await provider.validate();

      expect(result.valid).toBe(false);
      expect(result.method).toBe(AuthMethod.BEDROCK);
      expect(result.errors).toContain('No AWS credentials found');
    });

    it('should fail validation when AWS credentials are invalid', async () => {
      mockEnvironment({
        'AWS_ACCESS_KEY_ID': 'invalid-key',
        'AWS_SECRET_ACCESS_KEY': 'invalid-secret',
        'AWS_REGION': 'us-east-1',
      });
      
      // Mock failed validation
      mockValidator.validate.mockResolvedValue({
        isValid: false,
        errorMessage: 'Invalid AWS credentials',
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
          errors: ['Invalid AWS credentials'],
          config: {},
          method,
        }),
      }));

      const result = await provider.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid AWS credentials');
    });

    it('should handle validation network errors', async () => {
      mockEnvironment({
        'AWS_ACCESS_KEY_ID': 'AKIATEST',
        'AWS_SECRET_ACCESS_KEY': 'test-secret',
        'AWS_REGION': 'us-east-1',
      });
      
      // Mock network error
      mockValidator.validate.mockRejectedValue(new Error('Network timeout'));

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
          errors: ['AWS validation failed: Network timeout'],
          config: {},
          method,
        }),
      }));

      const result = await provider.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('AWS validation failed: Network timeout');
    });

    it('should validate with AWS profile configuration', async () => {
      mockEnvironment({
        'AWS_PROFILE': 'test-profile',
        'AWS_REGION': 'us-west-2',
      });
      mockExistsSync.mockReturnValue(true);
      
      mockValidator.validate.mockResolvedValue({
        isValid: true,
        details: { profile: 'test-profile' },
      });

      // Mock ValidationResultBuilder to return success
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
            has_profile: true,
            has_credentials_file: true,
            region: 'us-west-2',
            auth_method: 'profile',
          },
          method,
        }),
      }));

      const result = await provider.validate();

      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.BEDROCK);
    });

    it('should include config information in validation result', async () => {
      mockEnvironment({
        'AWS_ACCESS_KEY_ID': 'AKIATEST',
        'AWS_SECRET_ACCESS_KEY': 'test-secret',
        'AWS_REGION': 'us-east-1',
      });
      
      mockValidator.validate.mockResolvedValue({
        isValid: true,
        details: { status: 200 },
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
          valid: true,
          errors: [],
          config: {
            has_access_key: true,
            has_secret_key: true,
            has_profile: false,
            has_credentials_file: false,
            region: 'us-east-1',
          },
          method,
        }),
      }));

      const result = await provider.validate();

      expect(result.config).toEqual({
        has_access_key: true,
        has_secret_key: true,
        has_profile: false,
        has_credentials_file: false,
        region: 'us-east-1',
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      const { ValidationUtils } = require('../../../../src/auth/utils/credential-validator');
      ValidationUtils.hasEnvVar.mockImplementation((key: string) => {
        return process.env[key] !== undefined && process.env[key] !== '';
      });
      ValidationUtils.fileExists.mockImplementation((path: string) => {
        return mockExistsSync(path);
      });
      ValidationUtils.logValidationResult.mockImplementation(() => {});
    });

    it('should handle validator initialization errors', () => {
      expect(provider).toBeInstanceOf(BedrockProvider);
      expect(provider.getMethod()).toBe(AuthMethod.BEDROCK);
    });

    it('should handle timeout errors during validation', async () => {
      mockEnvironment({
        'AWS_ACCESS_KEY_ID': 'AKIATEST',
        'AWS_SECRET_ACCESS_KEY': 'test-secret',
      });
      
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockValidator.validate.mockRejectedValue(timeoutError);

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
          errors: ['AWS validation failed: Request timeout'],
          config: {},
          method,
        }),
      }));

      const result = await provider.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('AWS validation failed: Request timeout');
    });

    it('should handle permission errors', async () => {
      mockEnvironment({
        'AWS_ACCESS_KEY_ID': 'AKIATEST',
        'AWS_SECRET_ACCESS_KEY': 'test-secret',
      });
      
      mockValidator.validate.mockResolvedValue({
        isValid: false,
        errorMessage: 'Insufficient permissions',
        details: { status: 403 },
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
          errors: ['Insufficient permissions'],
          config: { status: 403 },
          method,
        }),
      }));

      const result = await provider.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Insufficient permissions');
      expect(result.config.status).toBe(403);
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
      clearEnvironment();

      const result = await provider.validate();

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('method');
      expect(result.method).toBe(AuthMethod.BEDROCK);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(typeof result.config).toBe('object');
      expect(typeof result.valid).toBe('boolean');
    });
  });
});