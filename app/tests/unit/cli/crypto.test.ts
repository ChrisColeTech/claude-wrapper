/**
 * Unit tests for Crypto utilities - Core functionality only
 * Tests secure token generation and validation logic
 */

import { 
  generateSecureToken, 
  validateTokenFormat, 
  createSafeHash,
  TokenGenerationError 
} from '../../../src/utils/crypto';
import { API_KEY_SECURITY } from '../../../src/config/security-constants';

describe('Crypto utilities', () => {
  describe('generateSecureToken', () => {
    it('should generate token with default length', () => {
      const token = generateSecureToken();
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(API_KEY_SECURITY.DEFAULT_LENGTH);
    });

    it('should generate token with custom length', () => {
      const customLength = 16;
      const token = generateSecureToken(customLength);
      
      expect(token.length).toBe(customLength);
    });

    it('should generate tokens with only valid characters', () => {
      const token = generateSecureToken();
      const validChars = new Set(API_KEY_SECURITY.VALID_CHARACTERS);
      
      for (const char of token) {
        expect(validChars.has(char)).toBe(true);
      }
    });

    it('should generate different tokens on multiple calls', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      
      expect(token1).not.toBe(token2);
    });

    it('should throw TokenGenerationError for token length below minimum', () => {
      expect(() => {
        generateSecureToken(API_KEY_SECURITY.MIN_LENGTH - 1);
      }).toThrow(TokenGenerationError);
      
      expect(() => {
        generateSecureToken(7);
      }).toThrow('Token length must be at least 8 characters');
    });

    it('should throw TokenGenerationError for token length above maximum', () => {
      expect(() => {
        generateSecureToken(API_KEY_SECURITY.MAX_LENGTH + 1);
      }).toThrow(TokenGenerationError);
      
      expect(() => {
        generateSecureToken(257);
      }).toThrow('Token length must be at most 256 characters');
    });

    it('should generate token at boundary values', () => {
      const minToken = generateSecureToken(API_KEY_SECURITY.MIN_LENGTH);
      const maxToken = generateSecureToken(API_KEY_SECURITY.MAX_LENGTH);
      
      expect(minToken.length).toBe(API_KEY_SECURITY.MIN_LENGTH);
      expect(maxToken.length).toBe(API_KEY_SECURITY.MAX_LENGTH);
    });
  });

  describe('validateTokenFormat', () => {
    it('should validate valid token', () => {
      const validToken = generateSecureToken();
      expect(validateTokenFormat(validToken)).toBe(true);
    });

    it('should reject invalid inputs', () => {
      expect(validateTokenFormat(null as any)).toBe(false);
      expect(validateTokenFormat(undefined as any)).toBe(false);
      expect(validateTokenFormat('')).toBe(false);
      expect(validateTokenFormat(123 as any)).toBe(false);
      expect(validateTokenFormat({} as any)).toBe(false);
    });

    it('should reject tokens with invalid length', () => {
      const shortToken = 'a'.repeat(API_KEY_SECURITY.MIN_LENGTH - 1);
      const longToken = 'a'.repeat(API_KEY_SECURITY.MAX_LENGTH + 1);
      
      expect(validateTokenFormat(shortToken)).toBe(false);
      expect(validateTokenFormat(longToken)).toBe(false);
    });

    it('should reject token with invalid characters', () => {
      const invalidToken = 'a'.repeat(API_KEY_SECURITY.MIN_LENGTH - 1) + '!@#$';
      expect(validateTokenFormat(invalidToken)).toBe(false);
    });

    it('should accept token with all valid character types', () => {
      const validToken = 'ABCDEFGHabcdefgh01234567-_';
      expect(validateTokenFormat(validToken)).toBe(true);
    });

    it('should accept tokens at boundary lengths', () => {
      const minToken = 'a'.repeat(API_KEY_SECURITY.MIN_LENGTH);
      const maxToken = 'a'.repeat(API_KEY_SECURITY.MAX_LENGTH);
      
      expect(validateTokenFormat(minToken)).toBe(true);
      expect(validateTokenFormat(maxToken)).toBe(true);
    });
  });

  describe('createSafeHash', () => {
    it('should create hash for valid input', () => {
      const input = 'test-string';
      const hash = createSafeHash(input);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(API_KEY_SECURITY.HASH_DISPLAY_LENGTH);
    });

    it('should create consistent hash for same input', () => {
      const input = 'test-string';
      const hash1 = createSafeHash(input);
      const hash2 = createSafeHash(input);
      
      expect(hash1).toBe(hash2);
    });

    it('should create different hashes for different inputs', () => {
      const hash1 = createSafeHash('input1');
      const hash2 = createSafeHash('input2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty and null inputs', () => {
      expect(createSafeHash('')).toBe('empty');
      expect(createSafeHash(null as any)).toBe('empty');
      expect(createSafeHash(undefined as any)).toBe('empty');
    });

    it('should create hex hash', () => {
      const hash = createSafeHash('test');
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('TokenGenerationError', () => {
    it('should be instance of Error', () => {
      const error = new TokenGenerationError('test message');
      
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('TokenGenerationError');
      expect(error.message).toBe('Token generation failed: test message');
    });
  });

  describe('integration scenarios', () => {
    it('should generate and validate token in sequence', () => {
      const token = generateSecureToken(16);
      const isValid = validateTokenFormat(token);
      const hash = createSafeHash(token);
      
      expect(isValid).toBe(true);
      expect(hash).toBeDefined();
      expect(hash.length).toBe(8);
    });

    it('should handle various token lengths', () => {
      const lengths = [8, 16, 32, 64, 128];
      
      lengths.forEach(length => {
        const token = generateSecureToken(length);
        expect(token.length).toBe(length);
        expect(validateTokenFormat(token)).toBe(true);
        
        const hash = createSafeHash(token);
        expect(hash.length).toBe(8);
      });
    });
  });
});