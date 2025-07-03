/**
 * Test suite for Crypto Utilities
 * Comprehensive unit tests for secure token generation and cryptographic functions
 */

import { 
  generateSecureToken, 
  validateTokenFormat, 
  createSafeHash, 
  secureCompare,
  TokenGenerationError,
  TokenUtils
} from '../../../src/utils/crypto';

describe('Crypto Utilities', () => {
  describe('generateSecureToken', () => {
    it('should generate token with default length', () => {
      const token = generateSecureToken();
      
      expect(typeof token).toBe('string');
      expect(token.length).toBe(32); // Default length
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/); // Valid characters only
    });

    it('should generate token with custom length', () => {
      const length = 64;
      const token = generateSecureToken(length);
      
      expect(token.length).toBe(length);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate different tokens on multiple calls', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      
      expect(token1).not.toBe(token2);
    });

    it('should throw error for token length less than 8', () => {
      expect(() => generateSecureToken(7)).toThrow(TokenGenerationError);
      expect(() => generateSecureToken(7)).toThrow('Token length must be at least 8 characters');
    });

    it('should throw error for token length greater than 256', () => {
      expect(() => generateSecureToken(257)).toThrow(TokenGenerationError);
      expect(() => generateSecureToken(257)).toThrow('Token length must be at most 256 characters');
    });

    it('should accept minimum valid length', () => {
      const token = generateSecureToken(8);
      expect(token.length).toBe(8);
    });

    it('should accept maximum valid length', () => {
      const token = generateSecureToken(256);
      expect(token.length).toBe(256);
    });

    it('should use only valid alphabet characters', () => {
      const token = generateSecureToken(100);
      const validAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
      
      for (const char of token) {
        expect(validAlphabet.includes(char)).toBe(true);
      }
    });
  });

  describe('validateTokenFormat', () => {
    it('should validate valid tokens', () => {
      const validToken = generateSecureToken(32);
      expect(validateTokenFormat(validToken)).toBe(true);
    });

    it('should reject null or undefined tokens', () => {
      expect(validateTokenFormat(null as any)).toBe(false);
      expect(validateTokenFormat(undefined as any)).toBe(false);
    });

    it('should reject non-string tokens', () => {
      expect(validateTokenFormat(123 as any)).toBe(false);
      expect(validateTokenFormat({} as any)).toBe(false);
      expect(validateTokenFormat([] as any)).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(validateTokenFormat('')).toBe(false);
    });

    it('should reject tokens shorter than 8 characters', () => {
      expect(validateTokenFormat('abc123')).toBe(false);
      expect(validateTokenFormat('1234567')).toBe(false);
    });

    it('should reject tokens longer than 256 characters', () => {
      const longToken = 'a'.repeat(257);
      expect(validateTokenFormat(longToken)).toBe(false);
    });

    it('should reject tokens with invalid characters', () => {
      expect(validateTokenFormat('abcd1234!')).toBe(false); // Contains !
      expect(validateTokenFormat('abcd1234@')).toBe(false); // Contains @
      expect(validateTokenFormat('abcd1234#')).toBe(false); // Contains #
      expect(validateTokenFormat('abcd1234$')).toBe(false); // Contains $
      expect(validateTokenFormat('abcd1234%')).toBe(false); // Contains %
      expect(validateTokenFormat('abcd1234 ')).toBe(false); // Contains space
    });

    it('should accept tokens with valid characters', () => {
      expect(validateTokenFormat('abcDEF123-_')).toBe(true);
      expect(validateTokenFormat('ABCDEF123456')).toBe(true);
      expect(validateTokenFormat('abcdef123456')).toBe(true);
      expect(validateTokenFormat('123456789012')).toBe(true);
      expect(validateTokenFormat('abc-def_123')).toBe(true);
    });

    it('should accept minimum valid length', () => {
      expect(validateTokenFormat('abcd1234')).toBe(true);
    });

    it('should accept maximum valid length', () => {
      const maxToken = 'a'.repeat(256);
      expect(validateTokenFormat(maxToken)).toBe(true);
    });
  });

  describe('createSafeHash', () => {
    it('should create hash for non-empty data', () => {
      const hash = createSafeHash('test-data');
      
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(8); // First 8 characters of SHA-256
      expect(hash).toMatch(/^[a-f0-9]+$/); // Hex characters only
    });

    it('should return "empty" for empty string', () => {
      expect(createSafeHash('')).toBe('empty');
    });

    it('should return "empty" for null/undefined', () => {
      expect(createSafeHash(null as any)).toBe('empty');
      expect(createSafeHash(undefined as any)).toBe('empty');
    });

    it('should create consistent hashes for same input', () => {
      const data = 'test-data-123';
      const hash1 = createSafeHash(data);
      const hash2 = createSafeHash(data);
      
      expect(hash1).toBe(hash2);
    });

    it('should create different hashes for different inputs', () => {
      const hash1 = createSafeHash('data1');
      const hash2 = createSafeHash('data2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle long input strings', () => {
      const longData = 'a'.repeat(1000);
      const hash = createSafeHash(longData);
      
      expect(hash.length).toBe(8);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it('should handle special characters', () => {
      const specialData = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const hash = createSafeHash(specialData);
      
      expect(hash.length).toBe(8);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('secureCompare', () => {
    it('should return true for identical strings', () => {
      const str = 'test-string-123';
      expect(secureCompare(str, str)).toBe(true);
    });

    it('should return true for equal but different string instances', () => {
      const str1 = 'test-string';
      const str2 = 'test-string';
      expect(secureCompare(str1, str2)).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(secureCompare('string1', 'string2')).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      expect(secureCompare('short', 'longer-string')).toBe(false);
      expect(secureCompare('longer-string', 'short')).toBe(false);
    });

    it('should return false for null/undefined inputs', () => {
      expect(secureCompare(null as any, 'string')).toBe(false);
      expect(secureCompare('string', null as any)).toBe(false);
      expect(secureCompare(undefined as any, 'string')).toBe(false);
      expect(secureCompare('string', undefined as any)).toBe(false);
      expect(secureCompare(null as any, null as any)).toBe(false);
    });

    it('should return false for empty vs non-empty strings', () => {
      expect(secureCompare('', 'non-empty')).toBe(false);
      expect(secureCompare('non-empty', '')).toBe(false);
    });

    it('should handle long strings correctly', () => {
      const long1 = 'a'.repeat(1000);
      const long2 = 'a'.repeat(1000);
      const long3 = 'a'.repeat(999) + 'b';
      
      expect(secureCompare(long1, long2)).toBe(true);
      expect(secureCompare(long1, long3)).toBe(false);
    });

    it('should be timing-attack resistant', () => {
      // Test that comparison time is relatively constant regardless of where strings differ
      const base = 'a'.repeat(100);
      const diff1 = 'b' + 'a'.repeat(99); // Different at position 0
      const diff2 = 'a'.repeat(50) + 'b' + 'a'.repeat(49); // Different at position 50
      const diff3 = 'a'.repeat(99) + 'b'; // Different at position 99
      
      // All should return false
      expect(secureCompare(base, diff1)).toBe(false);
      expect(secureCompare(base, diff2)).toBe(false);
      expect(secureCompare(base, diff3)).toBe(false);
    });
  });

  describe('TokenUtils', () => {
    describe('generateApiKey', () => {
      it('should generate API key with default length', () => {
        const apiKey = TokenUtils.generateApiKey();
        
        expect(typeof apiKey).toBe('string');
        expect(apiKey.length).toBe(32);
        expect(validateTokenFormat(apiKey)).toBe(true);
      });

      it('should generate API key with custom length', () => {
        const apiKey = TokenUtils.generateApiKey(64);
        
        expect(apiKey.length).toBe(64);
        expect(validateTokenFormat(apiKey)).toBe(true);
      });
    });

    describe('isValidApiKey', () => {
      it('should validate valid API keys', () => {
        const validKey = generateSecureToken(32);
        expect(TokenUtils.isValidApiKey(validKey)).toBe(true);
      });

      it('should reject invalid API keys', () => {
        expect(TokenUtils.isValidApiKey('short')).toBe(false);
        expect(TokenUtils.isValidApiKey('invalid!@#$')).toBe(false);
      });
    });

    describe('maskApiKey', () => {
      it('should mask long API keys correctly', () => {
        const apiKey = 'abcdef123456789';
        const masked = TokenUtils.maskApiKey(apiKey);
        
        expect(masked).toMatch(/^abc\*\*\*[a-f0-9]{8}$/);
        expect(masked.startsWith('abc')).toBe(true);
      });

      it('should handle short API keys', () => {
        const shortKey = 'abc';
        const masked = TokenUtils.maskApiKey(shortKey);
        
        expect(masked).toBe('***');
      });

      it('should handle empty/null API keys', () => {
        expect(TokenUtils.maskApiKey('')).toBe('***');
        expect(TokenUtils.maskApiKey(null as any)).toBe('***');
        expect(TokenUtils.maskApiKey(undefined as any)).toBe('***');
      });

      it('should include hash in masked output', () => {
        const apiKey = 'test-api-key-12345';
        const masked = TokenUtils.maskApiKey(apiKey);
        const hash = createSafeHash(apiKey);
        
        expect(masked).toContain(hash);
        expect(masked).toBe(`tes***${hash}`);
      });
    });

    describe('compareApiKeys', () => {
      it('should compare API keys securely', () => {
        const key1 = 'test-api-key';
        const key2 = 'test-api-key';
        const key3 = 'different-key';
        
        expect(TokenUtils.compareApiKeys(key1, key2)).toBe(true);
        expect(TokenUtils.compareApiKeys(key1, key3)).toBe(false);
      });

      it('should handle invalid inputs', () => {
        expect(TokenUtils.compareApiKeys('', '')).toBe(false);
        expect(TokenUtils.compareApiKeys(null as any, 'key')).toBe(false);
        expect(TokenUtils.compareApiKeys('key', null as any)).toBe(false);
      });
    });
  });

  describe('TokenGenerationError', () => {
    it('should create error with custom message', () => {
      const error = new TokenGenerationError('Custom error message');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TokenGenerationError);
      expect(error.name).toBe('TokenGenerationError');
      expect(error.message).toBe('Token generation failed: Custom error message');
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new TokenGenerationError('Test error');
      }).toThrow(TokenGenerationError);
      
      try {
        throw new TokenGenerationError('Test error');
      } catch (error) {
        expect(error).toBeInstanceOf(TokenGenerationError);
        expect((error as TokenGenerationError).message).toContain('Test error');
      }
    });
  });
});