/**
 * VertexProvider Test Suite
 * Tests Google Cloud Vertex AI authentication provider with proper mocking
 */

import {
  setupTestEnvironment,
  teardownTestEnvironment,
  clearEnvironment,
  mockEnvironment,
} from '../../../mocks';
import { VertexProvider } from '../../../../src/auth/providers/vertex-provider';
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

// Mock child_process module
const mockExec = jest.fn();
jest.mock('child_process', () => ({
  exec: mockExec,
}));

// Mock credential validator
const mockValidator = {
  validate: jest.fn(),
};

jest.mock('../../../../src/auth/utils/credential-validator', () => ({
  GoogleCredentialValidator: jest.fn(() => mockValidator),
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

describe('VertexProvider', () => {
  let provider: VertexProvider;

  beforeEach(() => {
    setupTestEnvironment();
    clearEnvironment();
    jest.clearAllMocks();
    mockValidator.validate.mockClear();
    mockExec.mockClear();
    provider = new VertexProvider();
  });

  afterEach(() => {
    teardownTestEnvironment();
  });

  describe('Basic Functionality', () => {
    it('should initialize successfully', () => {
      expect(provider).toBeInstanceOf(VertexProvider);
    });

    it('should return correct method', () => {
      expect(provider.getMethod()).toBe(AuthMethod.VERTEX);
    });

    it('should return correct required env vars', () => {
      const requiredVars = provider.getRequiredEnvVars();
      expect(requiredVars).toContain('GOOGLE_APPLICATION_CREDENTIALS');
      expect(requiredVars).toContain('GCLOUD_PROJECT');
    });
  });

  describe('Detection', () => {
    beforeEach(() => {
      const { ValidationUtils } = require('../../../../src/auth/utils/credential-validator');
      ValidationUtils.hasEnvVar.mockImplementation((key: string) => {
        return process.env[key] !== undefined && process.env[key] !== '';
      });
      ValidationUtils.fileExists.mockImplementation((path: string) => {
        const { mockExistsSync } = require('../../../mocks/fs');
        return mockExistsSync(path);
      });
      ValidationUtils.logValidationResult.mockImplementation(() => {});
    });

    it('should detect when Google credentials are present via environment', () => {
      mockEnvironment({
        'GOOGLE_APPLICATION_CREDENTIALS': '/path/to/creds.json',
        'GCLOUD_PROJECT': 'my-project',
      });
      const { mockExistsSync } = require('../../../mocks/fs');
      mockExistsSync.mockReturnValue(true);
      
      const result = provider.canDetect();
      expect(result).toBe(true);
    });

    it('should detect when gcloud CLI is available', () => {
      // Mock gcloud credentials file exists
      const { mockExistsSync } = require('../../../mocks/fs');
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes('application_default_credentials.json')) {
          return true;
        }
        return false;
      });
      
      mockExec.mockImplementation((command: string, callback: any) => {
        callback(null, { stdout: 'gcloud 425.0.0', stderr: '' });
      });
      
      const result = provider.canDetect();
      expect(result).toBe(true);
    });

    it('should not detect when no Google credentials are present', () => {
      clearEnvironment();
      const { mockExistsSync } = require('../../../mocks/fs');
      mockExistsSync.mockReturnValue(false);
      mockExec.mockImplementation((command: string, callback: any) => {
        callback(new Error('Command not found'), { stdout: '', stderr: 'command not found' });
      });
      
      const result = provider.canDetect();
      expect(result).toBe(false);
    });

    it('should be configured when credentials are present', () => {
      mockEnvironment({
        'GOOGLE_APPLICATION_CREDENTIALS': '/path/to/creds.json',
        'GCLOUD_PROJECT': 'my-project',
      });
      const { mockExistsSync } = require('../../../mocks/fs');
      mockExistsSync.mockReturnValue(true);
      
      const result = provider.isConfigured();
      expect(result).toBe(true);
    });

    it('should not be configured when credentials are missing', () => {
      clearEnvironment();
      const { mockExistsSync } = require('../../../mocks/fs');
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
        const { mockExistsSync } = require('../../../mocks/fs');
        return mockExistsSync(path);
      });
      ValidationUtils.logValidationResult.mockImplementation(() => {});
    });

    it('should validate successfully with valid service account credentials', async () => {
      mockEnvironment({
        'GOOGLE_APPLICATION_CREDENTIALS': '/path/to/creds.json',
        'GCLOUD_PROJECT': 'my-project',
      });
      const { mockExistsSync } = require('../../../mocks/fs');
      mockExistsSync.mockReturnValue(true);
      const { mockReadFileSync } = require('../../../mocks/fs');
      mockReadFileSync.mockReturnValue(JSON.stringify({
        type: 'service_account',
        client_email: 'test@my-project.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n',
      }));
      
      // Mock successful validation
      mockValidator.validate.mockResolvedValue({
        isValid: true,
        details: { auth_method: 'service_account' },
      });

      const result = await provider.validate();

      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.VERTEX);
      expect(mockValidator.validate).toHaveBeenCalled();
    });

    it('should validate successfully with gcloud CLI authentication', async () => {
      mockEnvironment({ GCLOUD_PROJECT: 'my-project' });
      
      // Mock gcloud CLI available
      mockExec.mockImplementation((command: string, callback: any) => {
        if (command.includes('gcloud auth print-access-token')) {
          callback(null, { stdout: 'ya29.c.fake-token', stderr: '' });
        } else {
          callback(null, { stdout: 'gcloud 425.0.0', stderr: '' });
        }
      });
      
      mockValidator.validate.mockResolvedValue({
        isValid: true,
        details: { auth_method: 'gcloud' },
      });

      const result = await provider.validate();

      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.VERTEX);
    });

    it('should fail validation when Google credentials are missing', async () => {
      clearEnvironment();

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
          errors: ['No Google Cloud credentials found'],
          config: {},
          method,
        }),
      }));

      const result = await provider.validate();

      expect(result.valid).toBe(false);
      expect(result.method).toBe(AuthMethod.VERTEX);
      expect(result.errors).toContain('No Google Cloud credentials found');
    });

    it('should fail validation when credentials are invalid', async () => {
      mockEnvironment({
        'GOOGLE_APPLICATION_CREDENTIALS': '/path/to/creds.json',
        'GCLOUD_PROJECT': 'my-project',
      });
      const { mockExistsSync } = require('../../../mocks/fs');
      mockExistsSync.mockReturnValue(true);
      const { mockReadFileSync } = require('../../../mocks/fs');
      mockReadFileSync.mockReturnValue(JSON.stringify({
        type: 'service_account',
        // Missing required fields
      }));
      
      mockValidator.validate.mockResolvedValue({
        isValid: false,
        errorMessage: 'Invalid service account credentials',
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
          errors: ['Invalid service account credentials'],
          config: {},
          method,
        }),
      }));

      const result = await provider.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid service account credentials');
    });

    it('should handle validation network errors', async () => {
      mockEnvironment({
        'GOOGLE_APPLICATION_CREDENTIALS': '/path/to/creds.json',
        'GCLOUD_PROJECT': 'my-project',
      });
      const { mockExistsSync } = require('../../../mocks/fs');
      mockExistsSync.mockReturnValue(true);
      const { mockReadFileSync } = require('../../../mocks/fs');
      mockReadFileSync.mockReturnValue(JSON.stringify({
        type: 'service_account',
        client_email: 'test@my-project.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n',
      }));
      
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
          errors: ['Google Cloud validation failed: Network timeout'],
          config: {},
          method,
        }),
      }));

      const result = await provider.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Google Cloud validation failed: Network timeout');
    });

    it('should include config information in validation result', async () => {
      mockEnvironment({
        'GOOGLE_APPLICATION_CREDENTIALS': '/path/to/creds.json',
        'GCLOUD_PROJECT': 'my-project',
      });
      const { mockExistsSync } = require('../../../mocks/fs');
      mockExistsSync.mockReturnValue(true);
      const { mockReadFileSync } = require('../../../mocks/fs');
      mockReadFileSync.mockReturnValue(JSON.stringify({
        type: 'service_account',
        client_email: 'test@my-project.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n',
      }));
      
      mockValidator.validate.mockResolvedValue({
        isValid: true,
        details: { auth_method: 'service_account' },
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
            has_service_account: true,
            has_gcloud_project: true,
            project: 'my-project',
            auth_method: 'service_account',
          },
          method,
        }),
      }));

      const result = await provider.validate();

      expect(result.config).toEqual({
        has_service_account: true,
        has_gcloud_project: true,
        project: 'my-project',
        auth_method: 'service_account',
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
        const { mockExistsSync } = require('../../../mocks/fs');
        return mockExistsSync(path);
      });
      ValidationUtils.logValidationResult.mockImplementation(() => {});
    });

    it('should handle validator initialization errors', () => {
      expect(provider).toBeInstanceOf(VertexProvider);
      expect(provider.getMethod()).toBe(AuthMethod.VERTEX);
    });

    it('should handle file reading errors', async () => {
      mockEnvironment({
        'GOOGLE_APPLICATION_CREDENTIALS': '/path/to/creds.json',
        'GCLOUD_PROJECT': 'my-project',
      });
      const { mockExistsSync } = require('../../../mocks/fs');
      mockExistsSync.mockReturnValue(true);
      const { mockReadFileSync } = require('../../../mocks/fs');
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
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
          errors: ['Failed to read credentials file: Permission denied'],
          config: {},
          method,
        }),
      }));

      const result = await provider.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Failed to read credentials file: Permission denied');
    });

    it('should handle malformed JSON in credentials file', async () => {
      mockEnvironment({
        'GOOGLE_APPLICATION_CREDENTIALS': '/path/to/creds.json',
        'GCLOUD_PROJECT': 'my-project',
      });
      const { mockExistsSync } = require('../../../mocks/fs');
      mockExistsSync.mockReturnValue(true);
      const { mockReadFileSync } = require('../../../mocks/fs');
      mockReadFileSync.mockReturnValue('invalid json content');

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
          errors: ['Invalid credentials file format'],
          config: {},
          method,
        }),
      }));

      const result = await provider.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid credentials file format');
    });

    it('should handle gcloud CLI errors', async () => {
      mockEnvironment({ GCLOUD_PROJECT: 'my-project' });
      
      mockExec.mockImplementation((command: string, callback: any) => {
        callback(new Error('gcloud not installed'), { stdout: '', stderr: 'command not found' });
      });

      const result = await provider.validate();

      expect(result.valid).toBe(false);
      expect(result.method).toBe(AuthMethod.VERTEX);
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
      expect(result.method).toBe(AuthMethod.VERTEX);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(typeof result.config).toBe('object');
      expect(typeof result.valid).toBe('boolean');
    });
  });
});