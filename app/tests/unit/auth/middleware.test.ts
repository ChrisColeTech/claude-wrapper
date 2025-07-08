/**
 * Authentication Middleware Tests
 * Comprehensive tests for bearer token authentication middleware
 * Single Responsibility: Test authentication middleware behavior
 */

import {
  createAuthMiddleware,
  BearerTokenValidator,
  AuthUtils,
  getApiKey,
  isApiKeyProtectionEnabled,
  AuthErrorType,
  AuthenticationError
} from '../../../src/auth/middleware';

import {
  AuthMockFactory,
  AuthTestUtils,
  AuthMockSetup
} from '../../mocks/auth/auth-mocks';

import { LoggerMock } from '../../mocks/shared/logger-mock';

describe('Authentication Middleware', () => {
  beforeEach(() => {
    AuthMockSetup.setup();
    LoggerMock.setup();
  });

  afterEach(() => {
    AuthMockSetup.reset();
    LoggerMock.reset();
  });

  describe('createAuthMiddleware', () => {
    describe('no API key protection', () => {
      it('should allow requests when no API key is configured', () => {
        const middleware = createAuthMiddleware({});
        const { req, res, next } = AuthMockFactory.createMiddlewareSetup();

        middleware(req as any, res as any, next.fn);

        expect(AuthTestUtils.validateSuccessfulNext(next)).toBe(true);
        expect(res.wasStatusCalled()).toBe(false);
        expect(res.wasJsonCalled()).toBe(false);
      });

      it('should skip authentication for specified paths', () => {
        const middleware = createAuthMiddleware({
          skipPaths: ['/health', '/v1/models'],
          apiKey: 'test-key'
        });
        const { req, res, next } = AuthMockFactory.createMiddlewareSetup(undefined, '/health');

        middleware(req as any, res as any, next.fn);

        expect(AuthTestUtils.validateSuccessfulNext(next)).toBe(true);
        expect(res.wasStatusCalled()).toBe(false);
      });

      it('should skip authentication for paths that start with skip pattern', () => {
        const middleware = createAuthMiddleware({
          skipPaths: ['/public'],
          apiKey: 'test-key'
        });
        const { req, res, next } = AuthMockFactory.createMiddlewareSetup(undefined, '/public/images/logo.png');

        middleware(req as any, res as any, next.fn);

        expect(AuthTestUtils.validateSuccessfulNext(next)).toBe(true);
      });
    });

    describe('API key protection enabled', () => {
      const validApiKey = 'test-api-key-12345';

      describe('successful authentication', () => {
        it('should allow requests with valid bearer token', () => {
          const middleware = createAuthMiddleware({ apiKey: validApiKey });
          const { req, res, next } = AuthMockFactory.createMiddlewareSetup(validApiKey);

          middleware(req as any, res as any, next.fn);

          expect(AuthTestUtils.validateSuccessfulNext(next)).toBe(true);
          expect(res.wasStatusCalled()).toBe(false);
          expect(res.wasJsonCalled()).toBe(false);
        });

        it('should handle case-insensitive Authorization header', () => {
          const middleware = createAuthMiddleware({ apiKey: validApiKey });
          const req = AuthMockFactory.createRequestWithCaseVariantAuth(validApiKey, 'authorization');
          const res = AuthMockFactory.createResponse();
          const next = AuthMockFactory.createNext();

          middleware(req as any, res as any, next.fn);

          expect(AuthTestUtils.validateSuccessfulNext(next)).toBe(true);
        });
      });

      describe('missing authorization header', () => {
        it('should reject requests without Authorization header', () => {
          const middleware = createAuthMiddleware({ apiKey: validApiKey });
          const { req, res, next } = AuthMockFactory.createMiddlewareSetup();

          middleware(req as any, res as any, next.fn);

          expect(AuthTestUtils.validateNoNext(next)).toBe(true);
          expect(AuthTestUtils.validateAuthError(
            res, 
            401, 
            'authentication_error', 
            AuthErrorType.MISSING_TOKEN
          )).toBe(true);
        });

        it('should return correct error message for missing header', () => {
          const middleware = createAuthMiddleware({ apiKey: validApiKey });
          const { req, res, next } = AuthMockFactory.createMiddlewareSetup();

          middleware(req as any, res as any, next.fn);

          const responseData = res.responseData;
          expect(responseData.error.message).toContain('Missing Authorization header');
          expect(responseData.error.message).toContain('Authorization: Bearer <token>');
        });
      });

      describe('malformed authorization header', () => {
        it('should reject malformed Bearer token format', () => {
          const middleware = createAuthMiddleware({ apiKey: validApiKey });
          const req = AuthMockFactory.createRequestWithMalformedAuth('Bearer');
          const res = AuthMockFactory.createResponse();
          const next = AuthMockFactory.createNext();

          middleware(req as any, res as any, next.fn);

          expect(AuthTestUtils.validateAuthError(
            res, 
            401, 
            'authentication_error', 
            AuthErrorType.MALFORMED_HEADER
          )).toBe(true);
        });

        it('should reject authorization header without Bearer prefix', () => {
          const middleware = createAuthMiddleware({ apiKey: validApiKey });
          const req = AuthMockFactory.createRequestWithMalformedAuth('token123');
          const res = AuthMockFactory.createResponse();
          const next = AuthMockFactory.createNext();

          middleware(req as any, res as any, next.fn);

          expect(AuthTestUtils.validateAuthError(
            res, 
            401, 
            'authentication_error', 
            AuthErrorType.MALFORMED_HEADER
          )).toBe(true);
        });

        it('should reject authorization header with wrong prefix', () => {
          const middleware = createAuthMiddleware({ apiKey: validApiKey });
          const req = AuthMockFactory.createRequestWithMalformedAuth('Basic token123');
          const res = AuthMockFactory.createResponse();
          const next = AuthMockFactory.createNext();

          middleware(req as any, res as any, next.fn);

          expect(AuthTestUtils.validateAuthError(
            res, 
            401, 
            'authentication_error', 
            AuthErrorType.MALFORMED_HEADER
          )).toBe(true);
        });

        it('should return correct error message for malformed header', () => {
          const middleware = createAuthMiddleware({ apiKey: validApiKey });
          const req = AuthMockFactory.createRequestWithMalformedAuth('Invalid');
          const res = AuthMockFactory.createResponse();
          const next = AuthMockFactory.createNext();

          middleware(req as any, res as any, next.fn);

          const responseData = res.responseData;
          expect(responseData.error.message).toContain('Malformed Authorization header');
          expect(responseData.error.message).toContain('Authorization: Bearer <token>');
        });
      });

      describe('invalid bearer token', () => {
        it('should reject requests with wrong token', () => {
          const middleware = createAuthMiddleware({ apiKey: validApiKey });
          const { req, res, next } = AuthMockFactory.createMiddlewareSetup('wrong-token');

          middleware(req as any, res as any, next.fn);

          expect(AuthTestUtils.validateAuthError(
            res, 
            401, 
            'authentication_error', 
            AuthErrorType.INVALID_TOKEN
          )).toBe(true);
        });

        it('should reject empty token with malformed header error', () => {
          const middleware = createAuthMiddleware({ apiKey: validApiKey });
          const { req, res, next } = AuthMockFactory.createMiddlewareSetup('');

          middleware(req as any, res as any, next.fn);

          expect(AuthTestUtils.validateAuthError(
            res, 
            401, 
            'authentication_error', 
            AuthErrorType.MALFORMED_HEADER
          )).toBe(true);
        });

        it('should reject whitespace token with malformed header error', () => {
          const middleware = createAuthMiddleware({ apiKey: validApiKey });
          const { req, res, next } = AuthMockFactory.createMiddlewareSetup(' ');

          middleware(req as any, res as any, next.fn);

          expect(AuthTestUtils.validateAuthError(
            res, 
            401, 
            'authentication_error', 
            AuthErrorType.MALFORMED_HEADER
          )).toBe(true);
        });

        it('should reject tokens with spaces as malformed header error', () => {
          const middleware = createAuthMiddleware({ apiKey: validApiKey });
          const { req, res, next } = AuthMockFactory.createMiddlewareSetup('Bearer token');

          middleware(req as any, res as any, next.fn);

          expect(AuthTestUtils.validateAuthError(
            res, 
            401, 
            'authentication_error', 
            AuthErrorType.MALFORMED_HEADER
          )).toBe(true);
        });

        it('should return correct error message for invalid token', () => {
          const middleware = createAuthMiddleware({ apiKey: validApiKey });
          const { req, res, next } = AuthMockFactory.createMiddlewareSetup('invalid-token');

          middleware(req as any, res as any, next.fn);

          const responseData = res.responseData;
          expect(responseData.error.message).toContain('Invalid bearer token');
          expect(responseData.error.message).toContain('Check your API key');
        });
      });

      describe('error handling', () => {
        it('should handle unexpected errors gracefully', () => {
          const middleware = createAuthMiddleware({ apiKey: validApiKey });
          const req = AuthMockFactory.createRequestWithBearer(validApiKey);
          
          // Mock req.get to throw an error
          req.get = () => {
            throw new Error('Unexpected error');
          };
          
          const res = AuthMockFactory.createResponse();
          const next = AuthMockFactory.createNext();

          middleware(req as any, res as any, next.fn);

          expect(AuthTestUtils.validateNoNext(next)).toBe(true);
          expect(res.statusCode).toBe(500);
          expect(res.responseData.error.type).toBe('internal_error');
          expect(res.responseData.error.code).toBe('auth_processing_error');
        });
      });
    });
  });

  describe('BearerTokenValidator', () => {
    describe('constructor', () => {
      it('should create validator without expected token', () => {
        const validator = new BearerTokenValidator();
        
        expect(validator).toBeInstanceOf(BearerTokenValidator);
      });

      it('should create validator with expected token', () => {
        const validator = new BearerTokenValidator('test-token');
        
        expect(validator).toBeInstanceOf(BearerTokenValidator);
      });
    });

    describe('validateToken', () => {
      it('should return true when no expected token is set', () => {
        const validator = new BearerTokenValidator();
        
        expect(validator.validateToken('any-token')).toBe(true);
        expect(validator.validateToken('')).toBe(true);
      });

      it('should validate correct token', () => {
        const expectedToken = 'test-token-123';
        const validator = new BearerTokenValidator(expectedToken);
        
        expect(validator.validateToken(expectedToken)).toBe(true);
      });

      it('should reject incorrect token', () => {
        const validator = new BearerTokenValidator('correct-token');
        
        expect(validator.validateToken('wrong-token')).toBe(false);
      });

      it('should reject tokens of different length (timing attack protection)', () => {
        const validator = new BearerTokenValidator('short');
        
        expect(validator.validateToken('very-long-token')).toBe(false);
        expect(validator.validateToken('a')).toBe(false);
      });

      it('should perform constant-time comparison', () => {
        const validator = new BearerTokenValidator('test-token-123');
        
        // These should all take similar time (constant-time comparison)
        expect(validator.validateToken('test-token-456')).toBe(false);
        expect(validator.validateToken('aaaa-aaaaa-aaa')).toBe(false);
        expect(validator.validateToken('zzzz-zzzzz-zzz')).toBe(false);
      });
    });

    describe('extractToken', () => {
      it('should extract token from valid Bearer header', () => {
        const validator = new BearerTokenValidator();
        const token = 'test-token-123';
        
        const extracted = validator.extractToken(`Bearer ${token}`);
        
        expect(extracted).toBe(token);
      });

      it('should return null for empty header', () => {
        const validator = new BearerTokenValidator();
        
        expect(validator.extractToken('')).toBeNull();
        expect(validator.extractToken(null as any)).toBeNull();
        expect(validator.extractToken(undefined as any)).toBeNull();
      });

      it('should return null for malformed header without Bearer', () => {
        const validator = new BearerTokenValidator();
        
        expect(validator.extractToken('token123')).toBeNull();
        expect(validator.extractToken('Basic token123')).toBeNull();
      });

      it('should return null for malformed Bearer header', () => {
        const validator = new BearerTokenValidator();
        
        expect(validator.extractToken('Bearer')).toBeNull();
        expect(validator.extractToken('Bearer ')).toBeNull();
      });

      it('should handle Bearer header with multiple spaces', () => {
        const validator = new BearerTokenValidator();
        
        expect(validator.extractToken('Bearer  token')).toBeNull();
        expect(validator.extractToken('Bearer token extra')).toBeNull();
      });
    });
  });

  describe('AuthUtils', () => {
    describe('generateSecureApiKey', () => {
      it('should generate key with default length', () => {
        const key = AuthUtils.generateSecureApiKey();
        
        expect(key).toHaveLength(32);
        expect(typeof key).toBe('string');
      });

      it('should generate key with custom length', () => {
        const length = 16;
        const key = AuthUtils.generateSecureApiKey(length);
        
        expect(key).toHaveLength(length);
      });

      it('should generate different keys on each call', () => {
        const key1 = AuthUtils.generateSecureApiKey();
        const key2 = AuthUtils.generateSecureApiKey();
        
        expect(key1).not.toBe(key2);
      });

      it('should only contain valid characters', () => {
        const key = AuthUtils.generateSecureApiKey();
        const validPattern = /^[A-Za-z0-9_-]+$/;
        
        expect(validPattern.test(key)).toBe(true);
      });
    });

    describe('createSafeHash', () => {
      it('should create safe hash for valid value', () => {
        const value = 'test-api-key-12345';
        const hash = AuthUtils.createSafeHash(value);
        
        expect(hash).toBe('test-api...');
        expect(hash).toHaveLength(11);
      });

      it('should return "invalid" for short values', () => {
        expect(AuthUtils.createSafeHash('short')).toBe('invalid');
        expect(AuthUtils.createSafeHash('1234567')).toBe('invalid');
      });

      it('should return "invalid" for empty or null values', () => {
        expect(AuthUtils.createSafeHash('')).toBe('invalid');
        expect(AuthUtils.createSafeHash(null as any)).toBe('invalid');
        expect(AuthUtils.createSafeHash(undefined as any)).toBe('invalid');
      });
    });

    describe('isValidApiKeyFormat', () => {
      it('should validate correct API key format', () => {
        const validKeys = [
          'test-api-key-123456',
          'VALID_API_KEY_12345',
          'mix3d-K3y_F0rm4t-123',
          'a'.repeat(16), // minimum length
          'a'.repeat(64)  // longer key
        ];

        validKeys.forEach(key => {
          expect(AuthUtils.isValidApiKeyFormat(key)).toBe(true);
        });
      });

      it('should reject invalid API key format', () => {
        const invalidKeys = [
          'short',           // too short
          'key with spaces', // contains space
          'key@with#special', // special characters
          '',               // empty
          'key.with.dots',  // contains dots
          'key+with+plus',  // contains plus
        ];

        invalidKeys.forEach(key => {
          expect(AuthUtils.isValidApiKeyFormat(key)).toBe(false);
        });
      });
    });
  });

  describe('Environment utilities', () => {
    describe('getApiKey', () => {
      it('should return API key from environment', () => {
        const originalApiKey = process.env['API_KEY'];
        process.env['API_KEY'] = 'test-env-key';
        
        const apiKey = getApiKey();
        
        expect(apiKey).toBe('test-env-key');
        
        // Restore original value
        if (originalApiKey) {
          process.env['API_KEY'] = originalApiKey;
        } else {
          delete process.env['API_KEY'];
        }
      });

      it('should return undefined when no API key is set', () => {
        const originalApiKey = process.env['API_KEY'];
        delete process.env['API_KEY'];
        
        const apiKey = getApiKey();
        
        expect(apiKey).toBeUndefined();
        
        // Restore original value
        if (originalApiKey) {
          process.env['API_KEY'] = originalApiKey;
        }
      });
    });

    describe('isApiKeyProtectionEnabled', () => {
      it('should return true when API key is set', () => {
        const originalApiKey = process.env['API_KEY'];
        process.env['API_KEY'] = 'test-key';
        
        const isEnabled = isApiKeyProtectionEnabled();
        
        expect(isEnabled).toBe(true);
        
        // Restore original value
        if (originalApiKey) {
          process.env['API_KEY'] = originalApiKey;
        } else {
          delete process.env['API_KEY'];
        }
      });

      it('should return false when no API key is set', () => {
        const originalApiKey = process.env['API_KEY'];
        delete process.env['API_KEY'];
        
        const isEnabled = isApiKeyProtectionEnabled();
        
        expect(isEnabled).toBe(false);
        
        // Restore original value
        if (originalApiKey) {
          process.env['API_KEY'] = originalApiKey;
        }
      });
    });
  });

  describe('AuthenticationError', () => {
    it('should create error with all properties', () => {
      const error = new AuthenticationError(
        AuthErrorType.INVALID_TOKEN,
        'Invalid token message',
        401
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('AuthenticationError');
      expect(error.type).toBe(AuthErrorType.INVALID_TOKEN);
      expect(error.message).toBe('Invalid token message');
      expect(error.statusCode).toBe(401);
    });

    it('should create error with default status code', () => {
      const error = new AuthenticationError(
        AuthErrorType.MISSING_TOKEN,
        'Missing token message'
      );

      expect(error.statusCode).toBe(401);
    });

    it('should be instance of Error', () => {
      const error = new AuthenticationError(
        AuthErrorType.MALFORMED_HEADER,
        'Malformed header message'
      );

      expect(error instanceof Error).toBe(true);
      expect(error instanceof AuthenticationError).toBe(true);
    });
  });

  describe('AuthErrorType enum', () => {
    it('should have all required error types', () => {
      expect(AuthErrorType.MISSING_TOKEN).toBe('missing_token');
      expect(AuthErrorType.INVALID_TOKEN).toBe('invalid_token');
      expect(AuthErrorType.MALFORMED_HEADER).toBe('malformed_header');
    });
  });
});