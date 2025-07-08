/**
 * Tests for Authentication Debug Mock
 * Validates that auth debug mock objects behave correctly
 * Single Responsibility: Ensure authentication debug mock reliability
 */

import {
  AuthDebugMock,
  AuthDebugTestUtils,
  AuthDebugMockSetup,
  AuthDebugMockConfig
} from './auth-debug-mock';
import { AuthErrorType } from '../../../src/auth/middleware';

describe('Authentication Debug Mock', () => {
  beforeEach(() => {
    AuthDebugMockSetup.setup();
  });

  afterEach(() => {
    AuthDebugMockSetup.reset();
  });

  describe('AuthDebugMock', () => {
    describe('setup and configuration', () => {
      it('should setup with default configuration', () => {
        AuthDebugMock.setup();
        
        const config = AuthDebugMock.getCurrentConfig();
        expect(config).toEqual({});
      });

      it('should setup with custom configuration', () => {
        const customConfig: AuthDebugMockConfig = {
          apiKey: 'test-api-key-123',
          debugMode: true,
          logLevel: 'debug',
          shouldFailTokenValidation: true
        };
        
        AuthDebugMock.setup(customConfig);
        
        const config = AuthDebugMock.getCurrentConfig();
        expect(config).toEqual(customConfig);
      });

      it('should update configuration', () => {
        AuthDebugMock.setup({ apiKey: 'original-key' });
        
        AuthDebugMock.updateConfig({ apiKey: 'updated-key', debugMode: true });
        
        const config = AuthDebugMock.getCurrentConfig();
        expect(config.apiKey).toBe('updated-key');
        expect(config.debugMode).toBe(true);
      });

      it('should handle custom environment variables', () => {
        const customEnv = {
          'TEST_VAR': 'test-value',
          'API_KEY': 'env-api-key'
        };
        
        AuthDebugMock.setup({ customEnvironmentVariables: customEnv });
        
        expect(process.env['TEST_VAR']).toBe('test-value');
        expect(process.env['API_KEY']).toBe('env-api-key');
      });

      it('should reset configuration and environment', () => {
        const originalApiKey = process.env['API_KEY'];
        
        AuthDebugMock.setup({ 
          apiKey: 'test-key',
          customEnvironmentVariables: { 'TEST_VAR': 'test' }
        });
        
        AuthDebugMock.reset();
        
        const config = AuthDebugMock.getCurrentConfig();
        expect(config).toEqual({});
        expect(process.env['API_KEY']).toBe(originalApiKey);
        expect(process.env['TEST_VAR']).toBeUndefined();
      });
    });

    describe('MockBearerTokenValidator', () => {
      it('should create mock bearer token validator', () => {
        const mockValidator = AuthDebugMock.createMockBearerTokenValidator();
        
        expect(mockValidator.validateToken).toBeDefined();
        expect(mockValidator.extractToken).toBeDefined();
        expect(jest.isMockFunction(mockValidator.validateToken)).toBe(true);
        expect(jest.isMockFunction(mockValidator.extractToken)).toBe(true);
      });

      it('should validate token correctly when no API key configured', () => {
        AuthDebugMock.setup({});
        const mockValidator = AuthDebugMock.createMockBearerTokenValidator();
        
        const result = mockValidator.validateToken('any-token');
        
        expect(result).toBe(true);
        expect(mockValidator.validateToken).toHaveBeenCalledWith('any-token');
      });

      it('should validate token correctly when API key configured', () => {
        AuthDebugMock.setup({ apiKey: 'test-key' });
        const mockValidator = AuthDebugMock.createMockBearerTokenValidator();
        
        const validResult = mockValidator.validateToken('test-key');
        const invalidResult = mockValidator.validateToken('wrong-key');
        
        expect(validResult).toBe(true);
        expect(invalidResult).toBe(false);
      });

      it('should fail token validation when configured', () => {
        AuthDebugMock.setup({ 
          apiKey: 'test-key',
          shouldFailTokenValidation: true
        });
        const mockValidator = AuthDebugMock.createMockBearerTokenValidator();
        
        const result = mockValidator.validateToken('test-key');
        
        expect(result).toBe(false);
      });

      it('should extract token from valid bearer header', () => {
        const mockValidator = AuthDebugMock.createMockBearerTokenValidator();
        
        const result = mockValidator.extractToken('Bearer test-token');
        
        expect(result).toBe('test-token');
      });

      it('should return null for invalid bearer header', () => {
        const mockValidator = AuthDebugMock.createMockBearerTokenValidator();
        
        const result1 = mockValidator.extractToken('Invalid header');
        const result2 = mockValidator.extractToken('Bearer');
        const result3 = mockValidator.extractToken('');
        
        expect(result1).toBeNull();
        expect(result2).toBeNull();
        expect(result3).toBeNull();
      });

      it('should fail token extraction when configured', () => {
        AuthDebugMock.setup({ shouldFailTokenExtraction: true });
        const mockValidator = AuthDebugMock.createMockBearerTokenValidator();
        
        const result = mockValidator.extractToken('Bearer test-token');
        
        expect(result).toBeNull();
      });
    });

    describe('MockAuthUtils', () => {
      it('should create mock auth utils', () => {
        const mockUtils = AuthDebugMock.createMockAuthUtils();
        
        expect(mockUtils.generateSecureApiKey).toBeDefined();
        expect(mockUtils.createSafeHash).toBeDefined();
        expect(mockUtils.isValidApiKeyFormat).toBeDefined();
        expect(jest.isMockFunction(mockUtils.generateSecureApiKey)).toBe(true);
        expect(jest.isMockFunction(mockUtils.createSafeHash)).toBe(true);
        expect(jest.isMockFunction(mockUtils.isValidApiKeyFormat)).toBe(true);
      });

      it('should generate secure API key with default length', () => {
        const mockUtils = AuthDebugMock.createMockAuthUtils();
        
        const result = mockUtils.generateSecureApiKey();
        
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result.length).toBe(32);
      });

      it('should generate secure API key with custom length', () => {
        const mockUtils = AuthDebugMock.createMockAuthUtils();
        
        const result = mockUtils.generateSecureApiKey(16);
        
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result.length).toBe(16);
      });

      it('should fail API key generation when configured', () => {
        AuthDebugMock.setup({ shouldFailApiKeyGeneration: true });
        const mockUtils = AuthDebugMock.createMockAuthUtils();
        
        expect(() => mockUtils.generateSecureApiKey()).toThrow('API key generation failed');
      });

      it('should create safe hash correctly', () => {
        const mockUtils = AuthDebugMock.createMockAuthUtils();
        
        const result = mockUtils.createSafeHash('test-api-key-123456789');
        
        expect(result).toBe('test-api-...');
      });

      it('should handle invalid values for safe hash', () => {
        const mockUtils = AuthDebugMock.createMockAuthUtils();
        
        const result1 = mockUtils.createSafeHash('short');
        const result2 = mockUtils.createSafeHash('');
        
        expect(result1).toBe('invalid');
        expect(result2).toBe('invalid');
      });

      it('should fail hash generation when configured', () => {
        AuthDebugMock.setup({ shouldFailHashGeneration: true });
        const mockUtils = AuthDebugMock.createMockAuthUtils();
        
        const result = mockUtils.createSafeHash('test-value');
        
        expect(result).toBe('hash-error');
      });

      it('should validate API key format correctly', () => {
        const mockUtils = AuthDebugMock.createMockAuthUtils();
        
        const validResult = mockUtils.isValidApiKeyFormat('test-api-key-123456789');
        const invalidResult = mockUtils.isValidApiKeyFormat('short');
        
        expect(validResult).toBe(true);
        expect(invalidResult).toBe(false);
      });

      it('should fail format validation when configured', () => {
        AuthDebugMock.setup({ shouldFailFormatValidation: true });
        const mockUtils = AuthDebugMock.createMockAuthUtils();
        
        const result = mockUtils.isValidApiKeyFormat('test-api-key-123456789');
        
        expect(result).toBe(false);
      });
    });

    describe('MockAuthEnvironment', () => {
      it('should create mock auth environment', () => {
        const mockEnv = AuthDebugMock.createMockAuthEnvironment();
        
        expect(mockEnv.getApiKey).toBeDefined();
        expect(mockEnv.isApiKeyProtectionEnabled).toBeDefined();
        expect(jest.isMockFunction(mockEnv.getApiKey)).toBe(true);
        expect(jest.isMockFunction(mockEnv.isApiKeyProtectionEnabled)).toBe(true);
      });

      it('should get API key from configuration', () => {
        AuthDebugMock.setup({ apiKey: 'test-key' });
        const mockEnv = AuthDebugMock.createMockAuthEnvironment();
        
        const result = mockEnv.getApiKey();
        
        expect(result).toBe('test-key');
      });

      it('should get API key from environment', () => {
        process.env['API_KEY'] = 'env-key';
        const mockEnv = AuthDebugMock.createMockAuthEnvironment();
        
        const result = mockEnv.getApiKey();
        
        expect(result).toBe('env-key');
      });

      it('should detect API key protection enabled', () => {
        AuthDebugMock.setup({ apiKey: 'test-key' });
        const mockEnv = AuthDebugMock.createMockAuthEnvironment();
        
        const result = mockEnv.isApiKeyProtectionEnabled();
        
        expect(result).toBe(true);
      });

      it('should detect API key protection disabled', () => {
        AuthDebugMock.setup({});
        delete process.env['API_KEY'];
        const mockEnv = AuthDebugMock.createMockAuthEnvironment();
        
        const result = mockEnv.isApiKeyProtectionEnabled();
        
        expect(result).toBe(false);
      });
    });

    describe('Authentication error handling', () => {
      it('should create mock authentication error', () => {
        const error = AuthDebugMock.createMockAuthenticationError(
          AuthErrorType.INVALID_TOKEN,
          'Invalid token',
          401
        );
        
        expect(error.type).toBe(AuthErrorType.INVALID_TOKEN);
        expect(error.message).toBe('Invalid token');
        expect(error.statusCode).toBe(401);
        expect(error.name).toBe('AuthenticationError');
      });

      it('should track error instances', () => {
        AuthDebugMock.createMockAuthenticationError(
          AuthErrorType.MISSING_TOKEN,
          'Missing token',
          401
        );
        AuthDebugMock.createMockAuthenticationError(
          AuthErrorType.INVALID_TOKEN,
          'Invalid token',
          401
        );
        
        const errors = AuthDebugMock.getErrorInstances();
        
        expect(errors).toHaveLength(2);
        expect(errors[0]?.type).toBe(AuthErrorType.MISSING_TOKEN);
        expect(errors[1]?.type).toBe(AuthErrorType.INVALID_TOKEN);
      });

      it('should clear error instances', () => {
        AuthDebugMock.createMockAuthenticationError(
          AuthErrorType.INVALID_TOKEN,
          'Test error',
          401
        );
        
        AuthDebugMock.clearErrorInstances();
        
        const errors = AuthDebugMock.getErrorInstances();
        expect(errors).toHaveLength(0);
      });
    });

    describe('Debug logging', () => {
      it('should add debug log when debug mode enabled', () => {
        AuthDebugMock.setup({ debugMode: true });
        
        AuthDebugMock.addDebugLog('Test debug message');
        
        const logs = AuthDebugMock.getDebugLogs();
        expect(logs).toContain('Test debug message');
      });

      it('should add debug log when log level is debug', () => {
        AuthDebugMock.setup({ logLevel: 'debug' });
        
        AuthDebugMock.addDebugLog('Test debug message');
        
        const logs = AuthDebugMock.getDebugLogs();
        expect(logs).toContain('Test debug message');
      });

      it('should not add debug log when debug mode disabled', () => {
        AuthDebugMock.setup({ debugMode: false, logLevel: 'info' });
        
        AuthDebugMock.addDebugLog('Test debug message');
        
        const logs = AuthDebugMock.getDebugLogs();
        expect(logs).not.toContain('Test debug message');
      });

      it('should clear debug logs', () => {
        AuthDebugMock.setup({ debugMode: true });
        AuthDebugMock.addDebugLog('Test message');
        
        AuthDebugMock.clearDebugLogs();
        
        const logs = AuthDebugMock.getDebugLogs();
        expect(logs).toHaveLength(0);
      });
    });

    describe('Configuration methods', () => {
      it('should set and remove API key', () => {
        AuthDebugMock.setApiKey('test-key');
        expect(AuthDebugMock.getCurrentConfig().apiKey).toBe('test-key');
        expect(process.env['API_KEY']).toBe('test-key');
        
        AuthDebugMock.removeApiKey();
        expect(AuthDebugMock.getCurrentConfig().apiKey).toBeUndefined();
        expect(process.env['API_KEY']).toBeUndefined();
      });

      it('should set debug mode', () => {
        AuthDebugMock.setDebugMode(true);
        expect(AuthDebugMock.getCurrentConfig().debugMode).toBe(true);
        
        AuthDebugMock.setDebugMode(false);
        expect(AuthDebugMock.getCurrentConfig().debugMode).toBe(false);
      });

      it('should set log level', () => {
        AuthDebugMock.setLogLevel('debug');
        expect(AuthDebugMock.getCurrentConfig().logLevel).toBe('debug');
        
        AuthDebugMock.setLogLevel('error');
        expect(AuthDebugMock.getCurrentConfig().logLevel).toBe('error');
      });

      it('should enable and disable token validation failure', () => {
        AuthDebugMock.enableTokenValidationFailure();
        expect(AuthDebugMock.getCurrentConfig().shouldFailTokenValidation).toBe(true);
        
        AuthDebugMock.disableTokenValidationFailure();
        expect(AuthDebugMock.getCurrentConfig().shouldFailTokenValidation).toBe(false);
      });

      it('should enable and disable token extraction failure', () => {
        AuthDebugMock.enableTokenExtractionFailure();
        expect(AuthDebugMock.getCurrentConfig().shouldFailTokenExtraction).toBe(true);
        
        AuthDebugMock.disableTokenExtractionFailure();
        expect(AuthDebugMock.getCurrentConfig().shouldFailTokenExtraction).toBe(false);
      });

      it('should enable and disable API key generation failure', () => {
        AuthDebugMock.enableApiKeyGenerationFailure();
        expect(AuthDebugMock.getCurrentConfig().shouldFailApiKeyGeneration).toBe(true);
        
        AuthDebugMock.disableApiKeyGenerationFailure();
        expect(AuthDebugMock.getCurrentConfig().shouldFailApiKeyGeneration).toBe(false);
      });

      it('should enable and disable hash generation failure', () => {
        AuthDebugMock.enableHashGenerationFailure();
        expect(AuthDebugMock.getCurrentConfig().shouldFailHashGeneration).toBe(true);
        
        AuthDebugMock.disableHashGenerationFailure();
        expect(AuthDebugMock.getCurrentConfig().shouldFailHashGeneration).toBe(false);
      });

      it('should enable and disable format validation failure', () => {
        AuthDebugMock.enableFormatValidationFailure();
        expect(AuthDebugMock.getCurrentConfig().shouldFailFormatValidation).toBe(true);
        
        AuthDebugMock.disableFormatValidationFailure();
        expect(AuthDebugMock.getCurrentConfig().shouldFailFormatValidation).toBe(false);
      });
    });

    describe('Mock instance management', () => {
      it('should get mock instances', () => {
        const bearerTokenValidator = AuthDebugMock.createMockBearerTokenValidator();
        const authUtils = AuthDebugMock.createMockAuthUtils();
        const authEnvironment = AuthDebugMock.createMockAuthEnvironment();
        
        const instances = AuthDebugMock.getMockInstances();
        
        expect(instances.bearerTokenValidator).toBe(bearerTokenValidator);
        expect(instances.authUtils).toBe(authUtils);
        expect(instances.authEnvironment).toBe(authEnvironment);
      });

      it('should return null for uninitialized mock instances', () => {
        const instances = AuthDebugMock.getMockInstances();
        
        expect(instances.bearerTokenValidator).toBeNull();
        expect(instances.authUtils).toBeNull();
        expect(instances.authEnvironment).toBeNull();
      });
    });
  });

  describe('AuthDebugTestUtils', () => {
    describe('Token pattern utilities', () => {
      it('should provide valid bearer token patterns', () => {
        const patterns = AuthDebugTestUtils.getValidBearerTokenPatterns();
        
        expect(Array.isArray(patterns)).toBe(true);
        expect(patterns.length).toBeGreaterThan(0);
        expect(patterns.every(p => p.startsWith('Bearer '))).toBe(true);
      });

      it('should provide invalid bearer token patterns', () => {
        const patterns = AuthDebugTestUtils.getInvalidBearerTokenPatterns();
        
        expect(Array.isArray(patterns)).toBe(true);
        expect(patterns.length).toBeGreaterThan(0);
        expect(patterns.some(p => !p.startsWith('Bearer '))).toBe(true);
      });

      it('should provide valid API key patterns', () => {
        const patterns = AuthDebugTestUtils.getValidApiKeyPatterns();
        
        expect(Array.isArray(patterns)).toBe(true);
        expect(patterns.length).toBeGreaterThan(0);
        expect(patterns.every(p => p.length >= 16)).toBe(true);
      });

      it('should provide invalid API key patterns', () => {
        const patterns = AuthDebugTestUtils.getInvalidApiKeyPatterns();
        
        expect(Array.isArray(patterns)).toBe(true);
        expect(patterns.length).toBeGreaterThan(0);
        expect(patterns.some(p => p.length < 16)).toBe(true);
      });
    });

    describe('Error scenario utilities', () => {
      it('should provide authentication error scenarios', () => {
        const scenarios = AuthDebugTestUtils.getAuthErrorScenarios();
        
        expect(Array.isArray(scenarios)).toBe(true);
        expect(scenarios.length).toBeGreaterThan(0);
        
        scenarios.forEach(scenario => {
          expect(scenario.type).toBeDefined();
          expect(scenario.message).toBeDefined();
          expect(scenario.statusCode).toBeDefined();
          expect(scenario.description).toBeDefined();
        });
      });

      it('should include all error types in scenarios', () => {
        const scenarios = AuthDebugTestUtils.getAuthErrorScenarios();
        const types = scenarios.map(s => s.type);
        
        expect(types).toContain(AuthErrorType.MISSING_TOKEN);
        expect(types).toContain(AuthErrorType.INVALID_TOKEN);
        expect(types).toContain(AuthErrorType.MALFORMED_HEADER);
      });
    });

    describe('Test environment configurations', () => {
      it('should provide test environment configurations', () => {
        const configs = AuthDebugTestUtils.getTestEnvironmentConfigs();
        
        expect(Array.isArray(configs)).toBe(true);
        expect(configs.length).toBeGreaterThan(0);
        
        configs.forEach(config => {
          expect(config.name).toBeDefined();
          expect(config.config).toBeDefined();
          expect(config.description).toBeDefined();
        });
      });

      it('should include various configuration types', () => {
        const configs = AuthDebugTestUtils.getTestEnvironmentConfigs();
        const names = configs.map(c => c.name);
        
        expect(names).toContain('no-auth');
        expect(names).toContain('with-auth');
        expect(names).toContain('debug-mode');
        expect(names).toContain('validation-failures');
        expect(names).toContain('generation-failures');
      });
    });

    describe('Validation utilities', () => {
      it('should validate authentication error correctly', () => {
        const error = AuthDebugMock.createMockAuthenticationError(
          AuthErrorType.INVALID_TOKEN,
          'Test error',
          401
        );
        
        const isValid = AuthDebugTestUtils.validateAuthenticationError(
          error,
          AuthErrorType.INVALID_TOKEN,
          'Test error',
          401
        );
        
        expect(isValid).toBe(true);
      });

      it('should reject invalid authentication error', () => {
        const error = AuthDebugMock.createMockAuthenticationError(
          AuthErrorType.INVALID_TOKEN,
          'Test error',
          401
        );
        
        const isValid = AuthDebugTestUtils.validateAuthenticationError(
          error,
          AuthErrorType.MISSING_TOKEN,
          'Different error',
          403
        );
        
        expect(isValid).toBe(false);
      });
    });

    describe('Test data creation utilities', () => {
      it('should create test API key with default length', () => {
        const apiKey = AuthDebugTestUtils.createTestApiKey();
        
        expect(apiKey).toBeDefined();
        expect(typeof apiKey).toBe('string');
        expect(apiKey.length).toBe(32);
      });

      it('should create test API key with custom length', () => {
        const apiKey = AuthDebugTestUtils.createTestApiKey(24);
        
        expect(apiKey).toBeDefined();
        expect(typeof apiKey).toBe('string');
        expect(apiKey.length).toBe(24);
      });

      it('should create different API keys on each call', () => {
        const key1 = AuthDebugTestUtils.createTestApiKey();
        const key2 = AuthDebugTestUtils.createTestApiKey();
        
        expect(key1).not.toBe(key2);
      });

      it('should create test safe hash', () => {
        const hash = AuthDebugTestUtils.createTestSafeHash('test-api-key-123456789');
        
        expect(hash).toBe('test-api-...');
      });

      it('should handle invalid values for test safe hash', () => {
        const hash1 = AuthDebugTestUtils.createTestSafeHash('short');
        const hash2 = AuthDebugTestUtils.createTestSafeHash('');
        
        expect(hash1).toBe('invalid');
        expect(hash2).toBe('invalid');
      });
    });
  });

  describe('AuthDebugMockSetup', () => {
    describe('Setup and cleanup', () => {
      it('should have setup method', () => {
        expect(typeof AuthDebugMockSetup.setup).toBe('function');
        
        expect(() => AuthDebugMockSetup.setup()).not.toThrow();
      });

      it('should have reset method', () => {
        expect(typeof AuthDebugMockSetup.reset).toBe('function');
        
        expect(() => AuthDebugMockSetup.reset()).not.toThrow();
      });

      it('should create fresh mock instances', () => {
        const mocks = AuthDebugMockSetup.createFreshMocks();
        
        expect(mocks.bearerTokenValidator).toBeDefined();
        expect(mocks.authUtils).toBeDefined();
        expect(mocks.authEnvironment).toBeDefined();
        
        expect(jest.isMockFunction(mocks.bearerTokenValidator.validateToken)).toBe(true);
        expect(jest.isMockFunction(mocks.authUtils.generateSecureApiKey)).toBe(true);
        expect(jest.isMockFunction(mocks.authEnvironment.getApiKey)).toBe(true);
      });

      it('should create independent mock instances', () => {
        const mocks1 = AuthDebugMockSetup.createFreshMocks();
        const mocks2 = AuthDebugMockSetup.createFreshMocks();
        
        expect(mocks1.bearerTokenValidator).not.toBe(mocks2.bearerTokenValidator);
        expect(mocks1.authUtils).not.toBe(mocks2.authUtils);
        expect(mocks1.authEnvironment).not.toBe(mocks2.authEnvironment);
      });
    });

    describe('Integration with AuthDebugMock', () => {
      it('should setup and reset AuthDebugMock correctly', () => {
        AuthDebugMock.setup({ apiKey: 'test-key' });
        
        AuthDebugMockSetup.reset();
        
        const config = AuthDebugMock.getCurrentConfig();
        expect(config).toEqual({});
      });

      it('should maintain proper state isolation', () => {
        AuthDebugMockSetup.setup();
        AuthDebugMock.setApiKey('test-key');
        
        AuthDebugMockSetup.reset();
        AuthDebugMockSetup.setup();
        
        const config = AuthDebugMock.getCurrentConfig();
        expect(config.apiKey).toBeUndefined();
      });
    });
  });

  describe('Integration scenarios', () => {
    describe('Complete authentication flow testing', () => {
      it('should support complete authentication testing workflow', () => {
        // Setup authentication with API key
        AuthDebugMock.setup({ apiKey: 'test-api-key-123456789' });
        
        // Create mock instances
        const bearerTokenValidator = AuthDebugMock.createMockBearerTokenValidator();
        const authUtils = AuthDebugMock.createMockAuthUtils();
        const authEnvironment = AuthDebugMock.createMockAuthEnvironment();
        
        // Test token validation
        const isValid = bearerTokenValidator.validateToken('test-api-key-123456789');
        expect(isValid).toBe(true);
        
        // Test token extraction
        const token = bearerTokenValidator.extractToken('Bearer test-api-key-123456789');
        expect(token).toBe('test-api-key-123456789');
        
        // Test API key format validation
        const isValidFormat = authUtils.isValidApiKeyFormat('test-api-key-123456789');
        expect(isValidFormat).toBe(true);
        
        // Test environment functions
        const apiKey = authEnvironment.getApiKey();
        const isProtected = authEnvironment.isApiKeyProtectionEnabled();
        
        expect(apiKey).toBe('test-api-key-123456789');
        expect(isProtected).toBe(true);
      });

      it('should support failure scenario testing', () => {
        // Setup with multiple failure modes
        AuthDebugMock.setup({
          apiKey: 'test-key',
          shouldFailTokenValidation: true,
          shouldFailTokenExtraction: true,
          shouldFailApiKeyGeneration: true
        });
        
        // Create mock instances
        const bearerTokenValidator = AuthDebugMock.createMockBearerTokenValidator();
        const authUtils = AuthDebugMock.createMockAuthUtils();
        
        // Test failures
        const isValid = bearerTokenValidator.validateToken('test-key');
        const token = bearerTokenValidator.extractToken('Bearer test-key');
        
        expect(isValid).toBe(false);
        expect(token).toBeNull();
        expect(() => authUtils.generateSecureApiKey()).toThrow();
      });
    });

    describe('Debug logging integration', () => {
      it('should support debug logging workflow', () => {
        AuthDebugMock.setup({ debugMode: true });
        
        AuthDebugMock.addDebugLog('Authentication started');
        AuthDebugMock.addDebugLog('Token validation in progress');
        AuthDebugMock.addDebugLog('Authentication completed');
        
        const logs = AuthDebugMock.getDebugLogs();
        
        expect(logs).toContain('Authentication started');
        expect(logs).toContain('Token validation in progress');
        expect(logs).toContain('Authentication completed');
      });

      it('should support error tracking workflow', () => {
        const error1 = AuthDebugMock.createMockAuthenticationError(
          AuthErrorType.MISSING_TOKEN,
          'Missing Authorization header',
          401
        );
        
        const error2 = AuthDebugMock.createMockAuthenticationError(
          AuthErrorType.INVALID_TOKEN,
          'Invalid bearer token',
          401
        );
        
        const errors = AuthDebugMock.getErrorInstances();
        
        expect(errors).toHaveLength(2);
        expect(errors[0].type).toBe(AuthErrorType.MISSING_TOKEN);
        expect(errors[1].type).toBe(AuthErrorType.INVALID_TOKEN);
      });
    });

    describe('Environment management', () => {
      it('should handle environment variable manipulation', () => {
        const originalApiKey = process.env['API_KEY'];
        
        AuthDebugMock.setup({ 
          customEnvironmentVariables: {
            'API_KEY': 'custom-key',
            'DEBUG_MODE': 'true'
          }
        });
        
        expect(process.env['API_KEY']).toBe('custom-key');
        expect(process.env['DEBUG_MODE']).toBe('true');
        
        AuthDebugMock.reset();
        
        expect(process.env['API_KEY']).toBe(originalApiKey);
        expect(process.env['DEBUG_MODE']).toBeUndefined();
      });

      it('should support dynamic API key management', () => {
        AuthDebugMock.setup();
        
        AuthDebugMock.setApiKey('dynamic-key');
        expect(process.env['API_KEY']).toBe('dynamic-key');
        
        AuthDebugMock.removeApiKey();
        expect(process.env['API_KEY']).toBeUndefined();
      });
    });
  });
});