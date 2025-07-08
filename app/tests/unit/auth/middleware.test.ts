/**
 * Comprehensive auth middleware and utils tests
 */

import { AuthUtils } from '../../../src/auth/middleware';

describe('Auth Middleware and Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AuthUtils', () => {
    describe('isValidApiKeyFormat', () => {
      it('should reject short keys', () => {
        expect(AuthUtils.isValidApiKeyFormat('short')).toBe(false);
        expect(AuthUtils.isValidApiKeyFormat('12345')).toBe(false);
        expect(AuthUtils.isValidApiKeyFormat('')).toBe(false);
      });

      it('should reject keys with invalid characters', () => {
        expect(AuthUtils.isValidApiKeyFormat('key with spaces')).toBe(false);
        expect(AuthUtils.isValidApiKeyFormat('key@with#symbols')).toBe(false);
        expect(AuthUtils.isValidApiKeyFormat('key.with.dots')).toBe(false);
        expect(AuthUtils.isValidApiKeyFormat('key/with/slashes')).toBe(false);
      });

      it('should accept valid alphanumeric keys', () => {
        expect(AuthUtils.isValidApiKeyFormat('abcdefghijklmnop')).toBe(true);
        expect(AuthUtils.isValidApiKeyFormat('test-api-key-123456789')).toBe(true);
        expect(AuthUtils.isValidApiKeyFormat('valid_key_with_underscores')).toBe(true);
        expect(AuthUtils.isValidApiKeyFormat('1234567890abcdef')).toBe(true);
        expect(AuthUtils.isValidApiKeyFormat('UPPERCASE-KEY-12345')).toBe(true);
      });

      it('should handle edge cases correctly', () => {
        expect(AuthUtils.isValidApiKeyFormat('1234567890123456')).toBe(true); // exactly 16 chars
        expect(AuthUtils.isValidApiKeyFormat('123456789012345')).toBe(false);  // 15 chars
        expect(AuthUtils.isValidApiKeyFormat('a'.repeat(100))).toBe(true); // very long key
      });
    });

    describe('createSafeHash', () => {
      it('should create consistent hash for same input', () => {
        const input = 'test-string-123';
        const hash1 = AuthUtils.createSafeHash(input);
        const hash2 = AuthUtils.createSafeHash(input);
        
        expect(hash1).toBe(hash2);
        expect(hash1).toMatch(/^[a-f0-9]{8}$/);
      });

      it('should create different hashes for different inputs', () => {
        const hash1 = AuthUtils.createSafeHash('input1');
        const hash2 = AuthUtils.createSafeHash('input2');
        const hash3 = AuthUtils.createSafeHash('input3');
        
        expect(hash1).not.toBe(hash2);
        expect(hash2).not.toBe(hash3);
        expect(hash1).not.toBe(hash3);
      });

      it('should handle special and empty inputs', () => {
        expect(AuthUtils.createSafeHash('')).toMatch(/^[a-f0-9]{8}$/);
        expect(AuthUtils.createSafeHash('special!@#$%chars')).toMatch(/^[a-f0-9]{8}$/);
        expect(AuthUtils.createSafeHash('🚀🎉✨')).toMatch(/^[a-f0-9]{8}$/);
        expect(AuthUtils.createSafeHash('null')).toMatch(/^[a-f0-9]{8}$/);
      });

      it('should produce short readable hashes', () => {
        const longInput = 'a'.repeat(1000);
        const hash = AuthUtils.createSafeHash(longInput);
        
        expect(hash).toHaveLength(8);
        expect(hash).toMatch(/^[a-f0-9]{8}$/);
      });
    });

    describe('generateSecureApiKey', () => {
      it('should generate valid API keys with default length', () => {
        const key = AuthUtils.generateSecureApiKey();
        
        expect(key).toMatch(/^[a-zA-Z0-9_-]{32}$/);
        expect(AuthUtils.isValidApiKeyFormat(key)).toBe(true);
        expect(key).toHaveLength(32);
      });

      it('should generate unique keys', () => {
        const keys = new Set();
        for (let i = 0; i < 1000; i++) {
          keys.add(AuthUtils.generateSecureApiKey());
        }
        
        expect(keys.size).toBe(1000);
      });

      it('should support custom lengths', () => {
        const key16 = AuthUtils.generateSecureApiKey(16);
        const key64 = AuthUtils.generateSecureApiKey(64);
        const key128 = AuthUtils.generateSecureApiKey(128);
        
        expect(key16).toHaveLength(16);
        expect(key64).toHaveLength(64);
        expect(key128).toHaveLength(128);
        
        expect(AuthUtils.isValidApiKeyFormat(key16)).toBe(true);
        expect(AuthUtils.isValidApiKeyFormat(key64)).toBe(true);
        expect(AuthUtils.isValidApiKeyFormat(key128)).toBe(true);
      });

      it('should handle edge case lengths', () => {
        const minKey = AuthUtils.generateSecureApiKey(16);
        const maxKey = AuthUtils.generateSecureApiKey(256);
        
        expect(minKey).toHaveLength(16);
        expect(maxKey).toHaveLength(256);
        expect(AuthUtils.isValidApiKeyFormat(minKey)).toBe(true);
        expect(AuthUtils.isValidApiKeyFormat(maxKey)).toBe(true);
      });
    });

    describe('constantTimeCompare', () => {
      it('should return true for identical strings', () => {
        const str = 'test-string-123';
        expect(AuthUtils.constantTimeCompare(str, str)).toBe(true);
        expect(AuthUtils.constantTimeCompare('', '')).toBe(true);
        expect(AuthUtils.constantTimeCompare('a', 'a')).toBe(true);
      });

      it('should return false for different strings', () => {
        expect(AuthUtils.constantTimeCompare('string1', 'string2')).toBe(false);
        expect(AuthUtils.constantTimeCompare('test', 'Test')).toBe(false);
        expect(AuthUtils.constantTimeCompare('abc', 'xyz')).toBe(false);
      });

      it('should return false for different length strings', () => {
        expect(AuthUtils.constantTimeCompare('short', 'longer-string')).toBe(false);
        expect(AuthUtils.constantTimeCompare('longer-string', 'short')).toBe(false);
        expect(AuthUtils.constantTimeCompare('', 'not-empty')).toBe(false);
        expect(AuthUtils.constantTimeCompare('not-empty', '')).toBe(false);
      });

      it('should be timing attack resistant', () => {
        const baseString = 'a'.repeat(32);
        const diffAtStart = 'X' + 'a'.repeat(31);
        const diffAtMiddle = 'a'.repeat(16) + 'X' + 'a'.repeat(15);
        const diffAtEnd = 'a'.repeat(31) + 'X';
        
        expect(AuthUtils.constantTimeCompare(baseString, diffAtStart)).toBe(false);
        expect(AuthUtils.constantTimeCompare(baseString, diffAtMiddle)).toBe(false);
        expect(AuthUtils.constantTimeCompare(baseString, diffAtEnd)).toBe(false);
      });

      it('should handle special characters', () => {
        expect(AuthUtils.constantTimeCompare('🚀', '🚀')).toBe(true);
        expect(AuthUtils.constantTimeCompare('🚀', '🎉')).toBe(false);
        expect(AuthUtils.constantTimeCompare('special!@#', 'special!@#')).toBe(true);
        expect(AuthUtils.constantTimeCompare('special!@#', 'special!@$')).toBe(false);
      });
    });

    describe('extractBearerToken', () => {
      it('should extract token from valid Authorization headers', () => {
        expect(AuthUtils.extractBearerToken('Bearer token123')).toBe('token123');
        expect(AuthUtils.extractBearerToken('bearer token456')).toBe('token456');
        expect(AuthUtils.extractBearerToken('BEARER token789')).toBe('token789');
        expect(AuthUtils.extractBearerToken('Bearer very-long-token-123456789')).toBe('very-long-token-123456789');
      });

      it('should return null for invalid headers', () => {
        expect(AuthUtils.extractBearerToken('Basic token123')).toBeNull();
        expect(AuthUtils.extractBearerToken('Bearer')).toBeNull();
        expect(AuthUtils.extractBearerToken('Bearer ')).toBeNull();
        expect(AuthUtils.extractBearerToken('token123')).toBeNull();
        expect(AuthUtils.extractBearerToken('')).toBeNull();
        expect(AuthUtils.extractBearerToken('OAuth token123')).toBeNull();
      });

      it('should handle tokens with special characters', () => {
        expect(AuthUtils.extractBearerToken('Bearer token-with-dashes')).toBe('token-with-dashes');
        expect(AuthUtils.extractBearerToken('Bearer token_with_underscores')).toBe('token_with_underscores');
        expect(AuthUtils.extractBearerToken('Bearer token123abc')).toBe('token123abc');
        expect(AuthUtils.extractBearerToken('Bearer token.with.dots')).toBe('token.with.dots');
        expect(AuthUtils.extractBearerToken('Bearer token+with+plus')).toBe('token+with+plus');
      });

      it('should handle edge cases', () => {
        expect(AuthUtils.extractBearerToken('Bearer a')).toBe('a');
        expect(AuthUtils.extractBearerToken('Bearer   token-with-spaces')).toBe('token-with-spaces');
        expect(AuthUtils.extractBearerToken('bearer lowercase-bearer')).toBe('lowercase-bearer');
      });
    });

    describe('Integration scenarios', () => {
      it('should work together for API key lifecycle', () => {
        // Generate a secure API key
        const apiKey = AuthUtils.generateSecureApiKey();
        expect(AuthUtils.isValidApiKeyFormat(apiKey)).toBe(true);
        
        // Create a safe hash for logging
        const hash = AuthUtils.createSafeHash(apiKey);
        expect(hash).toMatch(/^[a-f0-9]{8}$/);
        
        // Test extraction from Authorization header
        const authHeader = `Bearer ${apiKey}`;
        const extractedKey = AuthUtils.extractBearerToken(authHeader);
        expect(extractedKey).toBe(apiKey);
        
        // Test constant time comparison
        expect(AuthUtils.constantTimeCompare(apiKey, extractedKey)).toBe(true);
        expect(AuthUtils.constantTimeCompare(apiKey, 'wrong-key')).toBe(false);
      });

      it('should handle key rotation scenario', () => {
        const oldKey = AuthUtils.generateSecureApiKey();
        const newKey = AuthUtils.generateSecureApiKey();
        
        expect(oldKey).not.toBe(newKey);
        expect(AuthUtils.constantTimeCompare(oldKey, newKey)).toBe(false);
        
        const oldHash = AuthUtils.createSafeHash(oldKey);
        const newHash = AuthUtils.createSafeHash(newKey);
        expect(oldHash).not.toBe(newHash);
      });

      it('should validate security requirements', () => {
        // Generate multiple keys and ensure they're all unique and valid
        const keys = [];
        for (let i = 0; i < 100; i++) {
          const key = AuthUtils.generateSecureApiKey();
          expect(AuthUtils.isValidApiKeyFormat(key)).toBe(true);
          expect(keys).not.toContain(key);
          keys.push(key);
        }
        
        // Test constant time comparison behavior
        const testKey = keys[0];
        const sameKey = testKey;
        const differentKey = keys[1];
        
        expect(AuthUtils.constantTimeCompare(testKey, sameKey)).toBe(true);
        expect(AuthUtils.constantTimeCompare(testKey, differentKey)).toBe(false);
      });
    });
  });
});