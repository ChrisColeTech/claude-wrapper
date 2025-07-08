/**
 * Authentication Debug Tests
 * Tests for authentication debugging functionality with externalized mocks
 * Single Responsibility: Test authentication debugging utilities and validation
 */

import {
  AuthenticationError,
  AuthErrorType,
  BearerTokenValidator,
  AuthUtils,
  createAuthMiddleware,
  getApiKey,
  isApiKeyProtectionEnabled
} from '../../../src/auth/middleware';
import {
  AuthDebugMock,
  AuthDebugTestUtils,
  AuthDebugMockSetup
} from '../../mocks/auth/auth-debug-mock';
import { MockRequest, MockResponse, MockNext, AuthMockFactory } from '../../mocks/auth/auth-mocks';

describe('Authentication Debug Tests', () => {
  beforeEach(() => {
    AuthDebugMockSetup.setup();
  });

  afterEach(() => {
    AuthDebugMockSetup.reset();
  });

  describe('BearerTokenValidator Debug', () => {
    describe('Token validation debugging', () => {
      it('should validate token with no API key configured', () => {
        const validator = new BearerTokenValidator();
        
        const result = validator.validateToken('any-token');
        
        expect(result).toBe(true);
      });

      it('should validate correct token with API key configured', () => {
        const expectedToken = 'test-api-key-123456789';
        const validator = new BearerTokenValidator(expectedToken);
        
        const result = validator.validateToken(expectedToken);
        
        expect(result).toBe(true);
      });

      it('should reject incorrect token with API key configured', () => {
        const expectedToken = 'test-api-key-123456789';
        const validator = new BearerTokenValidator(expectedToken);
        
        const result = validator.validateToken('wrong-token');
        
        expect(result).toBe(false);
      });

      it('should use constant-time comparison for security', () => {
        const expectedToken = 'test-api-key-123456789';
        const validator = new BearerTokenValidator(expectedToken);
        
        // Test different length tokens
        const shortToken = 'short';
        const longToken = 'this-is-a-very-long-token-that-exceeds-expected-length';
        
        const result1 = validator.validateToken(shortToken);
        const result2 = validator.validateToken(longToken);
        
        expect(result1).toBe(false);
        expect(result2).toBe(false);
      });

      it('should handle empty and null tokens safely', () => {
        const expectedToken = 'test-api-key-123456789';
        const validator = new BearerTokenValidator(expectedToken);
        
        const result1 = validator.validateToken('');
        const result2 = validator.validateToken(null as any);
        const result3 = validator.validateToken(undefined as any);
        
        expect(result1).toBe(false);
        expect(result2).toBe(false);
        expect(result3).toBe(false);
      });
    });

    describe('Token extraction debugging', () => {
      it('should extract token from valid Bearer header', () => {
        const validator = new BearerTokenValidator();
        
        const result = validator.extractToken('Bearer test-token-123');
        
        expect(result).toBe('test-token-123');
      });

      it('should extract token from Bearer header with special characters', () => {
        const validator = new BearerTokenValidator();
        
        const result = validator.extractToken('Bearer test-api-key_123-456');
        
        expect(result).toBe('test-api-key_123-456');
      });

      it('should return null for missing Authorization header', () => {
        const validator = new BearerTokenValidator();
        
        const result = validator.extractToken('');
        
        expect(result).toBeNull();
      });

      it('should return null for null Authorization header', () => {
        const validator = new BearerTokenValidator();
        
        const result = validator.extractToken(null as any);
        
        expect(result).toBeNull();
      });

      it('should return null for malformed Authorization header', () => {
        const validator = new BearerTokenValidator();
        
        const invalidHeaders = AuthDebugTestUtils.getInvalidBearerTokenPatterns();
        
        invalidHeaders.forEach(header => {
          const result = validator.extractToken(header);
          expect(result).toBeNull();
        });
      });

      it('should return null for Bearer header without token', () => {
        const validator = new BearerTokenValidator();
        
        const result = validator.extractToken('Bearer');
        
        expect(result).toBeNull();
      });

      it('should return null for Bearer header with empty token', () => {
        const validator = new BearerTokenValidator();
        
        const result = validator.extractToken('Bearer ');
        
        expect(result).toBeNull();
      });

      it('should handle case sensitivity correctly', () => {
        const validator = new BearerTokenValidator();
        
        const result1 = validator.extractToken('bearer test-token');
        const result2 = validator.extractToken('BEARER test-token');
        const result3 = validator.extractToken('Bearer test-token');
        
        expect(result1).toBeNull();
        expect(result2).toBeNull();
        expect(result3).toBe('test-token');
      });
    });
  });

  describe('AuthUtils Debug', () => {
    describe('Secure API key generation debugging', () => {
      it('should generate API key with default length', () => {
        const apiKey = AuthUtils.generateSecureApiKey();
        
        expect(apiKey).toBeDefined();
        expect(typeof apiKey).toBe('string');
        expect(apiKey.length).toBe(32);
      });

      it('should generate API key with custom length', () => {
        const lengths = [16, 24, 32, 48, 64];
        
        lengths.forEach(length => {
          const apiKey = AuthUtils.generateSecureApiKey(length);
          
          expect(apiKey.length).toBe(length);
          expect(typeof apiKey).toBe('string');
        });
      });

      it('should generate different keys on each call', () => {
        const key1 = AuthUtils.generateSecureApiKey();
        const key2 = AuthUtils.generateSecureApiKey();
        const key3 = AuthUtils.generateSecureApiKey();
        
        expect(key1).not.toBe(key2);
        expect(key2).not.toBe(key3);
        expect(key1).not.toBe(key3);
      });

      it('should use valid characters only', () => {
        const apiKey = AuthUtils.generateSecureApiKey(100);
        const validPattern = /^[A-Za-z0-9_-]+$/;
        
        expect(validPattern.test(apiKey)).toBe(true);
      });

      it('should generate cryptographically secure keys', () => {
        const keys = Array.from({ length: 10 }, () => AuthUtils.generateSecureApiKey());
        const uniqueKeys = new Set(keys);
        
        // All keys should be unique (very high probability with crypto.randomBytes)
        expect(uniqueKeys.size).toBe(keys.length);
      });
    });

    describe('Safe hash creation debugging', () => {
      it('should create safe hash for valid values', () => {
        const testCases = [
          { input: 'test-api-key-123456789', expected: 'test-api...' },
          { input: 'abcdefghijklmnop', expected: 'abcdefgh...' },
          { input: '12345678901234567890', expected: '12345678...' }
        ];
        
        testCases.forEach(({ input, expected }) => {
          const result = AuthUtils.createSafeHash(input);
          expect(result).toBe(expected);
        });
      });

      it('should handle invalid values for safe hash', () => {
        const invalidValues = ['', 'short', '1234567', null, undefined];
        
        invalidValues.forEach(value => {
          const result = AuthUtils.createSafeHash(value as any);
          expect(result).toBe('invalid');
        });
      });

      it('should handle edge case values', () => {
        const edgeCases = [
          { input: '12345678', expected: '12345678...' }, // Exactly 8 characters
          { input: '123456789', expected: '12345678...' }, // 9 characters
          { input: 'special-chars_123-456', expected: 'special-...' }
        ];
        
        edgeCases.forEach(({ input, expected }) => {
          const result = AuthUtils.createSafeHash(input);
          expect(result).toBe(expected);
        });
      });

      it('should not leak sensitive information', () => {
        const sensitiveApiKey = 'super-secret-api-key-with-sensitive-data-123456789';
        
        const hash = AuthUtils.createSafeHash(sensitiveApiKey);
        
        expect(hash).toBe('super-se...');
        expect(hash).not.toContain('secret');
        expect(hash).not.toContain('sensitive');
        expect(hash.length).toBe(11); // 8 chars + '...'
      });
    });

    describe('API key format validation debugging', () => {
      it('should validate correct API key formats', () => {
        const validKeys = AuthDebugTestUtils.getValidApiKeyPatterns();
        
        validKeys.forEach(key => {
          const result = AuthUtils.isValidApiKeyFormat(key);
          expect(result).toBe(true);
        });
      });

      it('should reject invalid API key formats', () => {
        const invalidKeys = AuthDebugTestUtils.getInvalidApiKeyPatterns();
        
        invalidKeys.forEach(key => {
          const result = AuthUtils.isValidApiKeyFormat(key);
          expect(result).toBe(false);
        });
      });

      it('should enforce minimum length requirement', () => {
        const shortKeys = ['a', 'ab', 'abc', '123456789012345']; // All under 16 chars
        
        shortKeys.forEach(key => {
          const result = AuthUtils.isValidApiKeyFormat(key);
          expect(result).toBe(false);
        });
      });

      it('should allow valid characters only', () => {
        const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        const testKey = validChars + validChars; // 128 characters
        
        const result = AuthUtils.isValidApiKeyFormat(testKey);
        
        expect(result).toBe(true);
      });

      it('should handle edge case lengths', () => {
        const exactlyMinLength = 'a'.repeat(16);
        const veryLongKey = 'a'.repeat(1000);
        
        const result1 = AuthUtils.isValidApiKeyFormat(exactlyMinLength);
        const result2 = AuthUtils.isValidApiKeyFormat(veryLongKey);
        
        expect(result1).toBe(true);
        expect(result2).toBe(true);
      });
    });
  });

  describe('AuthenticationError Debug', () => {
    describe('Error creation and properties debugging', () => {
      it('should create authentication error with all properties', () => {
        const error = new AuthenticationError(
          AuthErrorType.INVALID_TOKEN,
          'Invalid bearer token',
          401
        );
        
        expect(error).toBeInstanceOf(AuthenticationError);
        expect(error).toBeInstanceOf(Error);
        expect(error.type).toBe(AuthErrorType.INVALID_TOKEN);
        expect(error.message).toBe('Invalid bearer token');
        expect(error.statusCode).toBe(401);
        expect(error.name).toBe('AuthenticationError');
      });

      it('should create authentication error with default status code', () => {
        const error = new AuthenticationError(
          AuthErrorType.MISSING_TOKEN,
          'Missing Authorization header'
        );
        
        expect(error.statusCode).toBe(401);
      });

      it('should create authentication errors for all error types', () => {
        const scenarios = AuthDebugTestUtils.getAuthErrorScenarios();
        
        scenarios.forEach(scenario => {
          const error = new AuthenticationError(
            scenario.type,
            scenario.message,
            scenario.statusCode
          );
          
          const isValid = AuthDebugTestUtils.validateAuthenticationError(
            error,
            scenario.type,
            scenario.message,
            scenario.statusCode
          );
          
          expect(isValid).toBe(true);
        });
      });

      it('should maintain error stack trace', () => {
        const error = new AuthenticationError(
          AuthErrorType.INVALID_TOKEN,
          'Test error'
        );
        
        expect(error.stack).toBeDefined();
        expect(error.stack).toContain('AuthenticationError');
      });
    });

    describe('Error type enumeration debugging', () => {
      it('should have all required error types', () => {
        expect(AuthErrorType.MISSING_TOKEN).toBe('missing_token');
        expect(AuthErrorType.INVALID_TOKEN).toBe('invalid_token');
        expect(AuthErrorType.MALFORMED_HEADER).toBe('malformed_header');
      });

      it('should use consistent error type values', () => {
        const errorTypes = Object.values(AuthErrorType);
        
        errorTypes.forEach(type => {
          expect(typeof type).toBe('string');
          expect(type.length).toBeGreaterThan(0);
          expect(type).toMatch(/^[a-z_]+$/); // lowercase with underscores
        });
      });
    });
  });

  describe('Environment Functions Debug', () => {
    describe('API key retrieval debugging', () => {
      it('should get API key from environment variable', () => {
        AuthDebugMock.setApiKey('test-environment-key');
        
        const apiKey = getApiKey();
        
        expect(apiKey).toBe('test-environment-key');
      });

      it('should return undefined when no API key set', () => {
        AuthDebugMock.removeApiKey();
        
        const apiKey = getApiKey();
        
        expect(apiKey).toBeUndefined();
      });

      it('should handle environment variable changes', () => {
        AuthDebugMock.removeApiKey();
        expect(getApiKey()).toBeUndefined();
        
        AuthDebugMock.setApiKey('new-key');
        expect(getApiKey()).toBe('new-key');
        
        AuthDebugMock.setApiKey('updated-key');
        expect(getApiKey()).toBe('updated-key');
      });
    });

    describe('API key protection status debugging', () => {
      it('should detect API key protection enabled', () => {
        AuthDebugMock.setApiKey('test-key');
        
        const isEnabled = isApiKeyProtectionEnabled();
        
        expect(isEnabled).toBe(true);
      });

      it('should detect API key protection disabled', () => {
        AuthDebugMock.removeApiKey();
        
        const isEnabled = isApiKeyProtectionEnabled();
        
        expect(isEnabled).toBe(false);
      });

      it('should handle environment changes dynamically', () => {
        AuthDebugMock.removeApiKey();
        expect(isApiKeyProtectionEnabled()).toBe(false);
        
        AuthDebugMock.setApiKey('dynamic-key');
        expect(isApiKeyProtectionEnabled()).toBe(true);
        
        AuthDebugMock.removeApiKey();
        expect(isApiKeyProtectionEnabled()).toBe(false);
      });
    });
  });

  describe('Auth Middleware Debug Integration', () => {
    describe('Middleware creation debugging', () => {
      it('should create middleware with no API key protection', () => {
        const middleware = createAuthMiddleware();
        
        expect(typeof middleware).toBe('function');
        expect(middleware.length).toBe(3); // req, res, next
      });

      it('should create middleware with API key protection', () => {
        const middleware = createAuthMiddleware({ apiKey: 'test-key' });
        
        expect(typeof middleware).toBe('function');
        expect(middleware.length).toBe(3);
      });

      it('should create middleware with skip paths', () => {
        const middleware = createAuthMiddleware({
          skipPaths: ['/health', '/public'],
          apiKey: 'test-key'
        });
        
        expect(typeof middleware).toBe('function');
      });
    });

    describe('Middleware execution debugging', () => {
      it('should allow requests when no API key protection', () => {
        const middleware = createAuthMiddleware();
        const { req, res, next } = AuthMockFactory.createMiddlewareSetup();
        
        middleware(req as any, res as any, next.fn);
        
        expect(next.wasCalled()).toBe(true);
        expect(next.wasCalledWithError()).toBe(false);
        expect(res.wasStatusCalled()).toBe(false);
      });

      it('should allow requests with valid bearer token', () => {
        const middleware = createAuthMiddleware({ apiKey: 'test-key-123' });
        const { req, res, next } = AuthMockFactory.createMiddlewareSetup('test-key-123');
        
        middleware(req as any, res as any, next.fn);
        
        expect(next.wasCalled()).toBe(true);
        expect(next.wasCalledWithError()).toBe(false);
        expect(res.wasStatusCalled()).toBe(false);
      });

      it('should reject requests with invalid bearer token', () => {
        const middleware = createAuthMiddleware({ apiKey: 'correct-key' });
        const { req, res, next } = AuthMockFactory.createMiddlewareSetup('wrong-key');
        
        middleware(req as any, res as any, next.fn);
        
        expect(next.wasCalled()).toBe(false);
        expect(res.wasStatusCalled()).toBe(true);
        expect(res.statusCode).toBe(401);
        expect(res.responseData.error.type).toBe('authentication_error');
        expect(res.responseData.error.code).toBe('invalid_token');
      });

      it('should reject requests without authorization header', () => {
        const middleware = createAuthMiddleware({ apiKey: 'test-key' });
        const { req, res, next } = AuthMockFactory.createMiddlewareSetup();
        
        middleware(req as any, res as any, next.fn);
        
        expect(next.wasCalled()).toBe(false);
        expect(res.wasStatusCalled()).toBe(true);
        expect(res.statusCode).toBe(401);
        expect(res.responseData.error.code).toBe('missing_token');
      });

      it('should reject requests with malformed authorization header', () => {
        const middleware = createAuthMiddleware({ apiKey: 'test-key' });
        const req = AuthMockFactory.createRequestWithMalformedAuth('Invalid header');
        const res = AuthMockFactory.createResponse();
        const next = AuthMockFactory.createNext();
        
        middleware(req as any, res as any, next.fn);
        
        expect(next.wasCalled()).toBe(false);
        expect(res.wasStatusCalled()).toBe(true);
        expect(res.statusCode).toBe(401);
        expect(res.responseData.error.code).toBe('malformed_header');
      });

      it('should skip authentication for specified paths', () => {
        const middleware = createAuthMiddleware({
          apiKey: 'test-key',
          skipPaths: ['/health', '/public']
        });
        
        const testPaths = ['/health', '/public', '/health/status', '/public/info'];
        
        testPaths.forEach(path => {
          const req = new MockRequest(path);
          const res = new MockResponse();
          const next = new MockNext();
          
          middleware(req as any, res as any, next.fn);
          
          expect(next.wasCalled()).toBe(true);
          expect(res.wasStatusCalled()).toBe(false);
        });
      });

      it('should handle unexpected errors gracefully', () => {
        // Create middleware with invalid configuration to trigger error
        const middleware = createAuthMiddleware({ apiKey: 'test-key' });
        const req = null as any; // This will cause an error
        const res = new MockResponse();
        const next = new MockNext();
        
        middleware(req as any, res as any, next.fn);
        
        expect(next.wasCalled()).toBe(false);
        expect(res.wasStatusCalled()).toBe(true);
        expect(res.statusCode).toBe(500);
        expect(res.responseData.error.type).toBe('internal_error');
      });
    });

    describe('Middleware error response debugging', () => {
      it('should return consistent error response format', () => {
        const middleware = createAuthMiddleware({ apiKey: 'test-key' });
        const { req, res, next } = AuthMockFactory.createMiddlewareSetup();
        
        middleware(req as any, res as any, next.fn);
        
        const error = res.responseData.error;
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('type');
        expect(error).toHaveProperty('code');
        expect(error.type).toBe('authentication_error');
      });

      it('should provide helpful error messages', () => {
        const testCases = [
          {
            setup: () => AuthMockFactory.createMiddlewareSetup(),
            expectedCode: 'missing_token',
            description: 'missing authorization header'
          },
          {
            setup: () => {
              const req = AuthMockFactory.createRequestWithMalformedAuth('Invalid');
              const res = AuthMockFactory.createResponse();
              const next = AuthMockFactory.createNext();
              return { req, res, next };
            },
            expectedCode: 'malformed_header',
            description: 'malformed authorization header'
          },
          {
            setup: () => AuthMockFactory.createMiddlewareSetup('wrong-token'),
            expectedCode: 'invalid_token',
            description: 'invalid bearer token'
          }
        ];
        
        testCases.forEach(({ setup, expectedCode }) => {
          const middleware = createAuthMiddleware({ apiKey: 'correct-key' });
          const { req, res, next } = setup();
          
          middleware(req as any, res as any, next.fn);
          
          const error = res.responseData.error;
          expect(error.code).toBe(expectedCode);
          expect(error.message).toBeDefined();
          expect(error.message.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Authentication Flow Integration Debug', () => {
    describe('Complete authentication workflow debugging', () => {
      it('should support end-to-end authentication testing', () => {
        // Setup environment
        AuthDebugMock.setup({ debugMode: true });
        AuthDebugMock.setApiKey('integration-test-key-123456789');
        
        // Create middleware
        const middleware = createAuthMiddleware({ apiKey: 'integration-test-key-123456789' });
        
        // Test valid request
        const { req, res, next } = AuthMockFactory.createMiddlewareSetup('integration-test-key-123456789');
        
        middleware(req as any, res as any, next.fn);
        
        // Verify successful authentication
        expect(next.wasCalled()).toBe(true);
        expect(res.wasStatusCalled()).toBe(false);
        
        // Verify environment functions
        expect(getApiKey()).toBe('integration-test-key-123456789');
        expect(isApiKeyProtectionEnabled()).toBe(true);
      });

      it('should support authentication debugging with logging', () => {
        AuthDebugMock.setup({ debugMode: true, logLevel: 'debug' });
        
        // Simulate authentication flow with debug logging
        AuthDebugMock.addDebugLog('Starting authentication flow');
        
        const validator = new BearerTokenValidator('test-key');
        const token = validator.extractToken('Bearer test-key');
        const isValid = validator.validateToken(token || '');
        
        AuthDebugMock.addDebugLog(`Token extracted: ${token ? 'success' : 'failed'}`);
        AuthDebugMock.addDebugLog(`Token validated: ${isValid ? 'success' : 'failed'}`);
        
        const logs = AuthDebugMock.getDebugLogs();
        
        expect(logs).toContain('Starting authentication flow');
        expect(logs).toContain('Token extracted: success');
        expect(logs).toContain('Token validated: success');
      });

      it('should support error tracking throughout authentication flow', () => {
        const errorScenarios = [
          {
            type: AuthErrorType.MISSING_TOKEN,
            message: 'Missing Authorization header',
            trigger: () => {
              const middleware = createAuthMiddleware({ apiKey: 'test-key' });
              const { req, res, next } = AuthMockFactory.createMiddlewareSetup();
              middleware(req as any, res as any, next.fn);
              return res;
            }
          },
          {
            type: AuthErrorType.INVALID_TOKEN,
            message: 'Invalid bearer token',
            trigger: () => {
              const middleware = createAuthMiddleware({ apiKey: 'correct-key' });
              const { req, res, next } = AuthMockFactory.createMiddlewareSetup('wrong-key');
              middleware(req as any, res as any, next.fn);
              return res;
            }
          }
        ];
        
        errorScenarios.forEach(scenario => {
          const res = scenario.trigger();
          
          expect(res.statusCode).toBe(401);
          expect(res.responseData.error.type).toBe('authentication_error');
          expect(res.responseData.error.code).toBe(scenario.type);
        });
      });
    });

    describe('Performance and security debugging', () => {
      it('should validate constant-time comparison performance', () => {
        const correctKey = 'test-api-key-123456789';
        const validator = new BearerTokenValidator(correctKey);
        
        // Test various token lengths and patterns
        const testTokens = [
          'a',
          'short-key',
          correctKey,
          'wrong-key-of-same-length',
          'much-longer-key-that-exceeds-expected-length-significantly'
        ];
        
        testTokens.forEach(token => {
          const startTime = process.hrtime.bigint();
          const result = validator.validateToken(token);
          const endTime = process.hrtime.bigint();
          
          // Verify behavior is consistent regardless of input
          if (token === correctKey) {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }
          
          // Timing should be reasonably fast (basic sanity check)
          const durationMs = Number(endTime - startTime) / 1000000;
          expect(durationMs).toBeLessThan(10); // Should complete within 10ms
        });
      });

      it('should validate secure API key generation randomness', () => {
        const keyCount = 50;
        const keys = Array.from({ length: keyCount }, () => AuthUtils.generateSecureApiKey(32));
        
        // All keys should be unique
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(keyCount);
        
        // Keys should have good character distribution
        const charCounts = new Map<string, number>();
        keys.join('').split('').forEach(char => {
          charCounts.set(char, (charCounts.get(char) || 0) + 1);
        });
        
        // Should use multiple different characters (not biased to any single character)
        expect(charCounts.size).toBeGreaterThan(10);
      });

      it('should validate safe hash information leakage prevention', () => {
        const sensitiveKeys = [
          'secret-production-key-with-sensitive-data-123456789',
          'admin-master-key-do-not-log-full-value-987654321',
          'user-personal-api-key-private-information-abcdef123'
        ];
        
        sensitiveKeys.forEach(key => {
          const hash = AuthUtils.createSafeHash(key);
          
          // Hash should only show first 8 characters + ellipsis
          expect(hash.length).toBe(11);
          expect(hash.endsWith('...')).toBe(true);
          
          // Hash should not contain sensitive parts
          const sensitiveWords = ['secret', 'production', 'admin', 'master', 'private', 'personal'];
          sensitiveWords.forEach(word => {
            if (key.includes(word) && !key.substring(0, 8).includes(word)) {
              expect(hash).not.toContain(word);
            }
          });
        });
      });
    });
  });
});