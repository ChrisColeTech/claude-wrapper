/**
 * Cryptographic utilities for secure token generation
 * Based on Python main.py token generation
 * 
 * Single Responsibility: Secure random token generation
 */

import { randomBytes, createHash } from 'crypto';

/**
 * Constants for token generation
 */
const DEFAULT_TOKEN_LENGTH = 32;
const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Error thrown when token generation fails
 */
export class TokenGenerationError extends Error {
  constructor(message: string) {
    super(`Token generation failed: ${message}`);
    this.name = 'TokenGenerationError';
  }
}

/**
 * Generate a secure random token for API authentication
 * Based on Python generate_secure_token() function
 * 
 * @param length Token length (default: 32)
 * @returns Secure random token
 */
export function generateSecureToken(length: number = DEFAULT_TOKEN_LENGTH): string {
  if (length < 8) {
    throw new TokenGenerationError('Token length must be at least 8 characters');
  }

  if (length > 256) {
    throw new TokenGenerationError('Token length must be at most 256 characters');
  }

  try {
    // Generate random bytes
    const randomBuffer = randomBytes(length);
    
    // Convert to secure token using alphabet
    let token = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = randomBuffer[i] % TOKEN_ALPHABET.length;
      token += TOKEN_ALPHABET[randomIndex];
    }

    return token;
  } catch (error) {
    throw new TokenGenerationError(`Crypto operation failed: ${error}`);
  }
}

/**
 * Validate token format and security
 * 
 * @param token Token to validate
 * @returns True if token is valid format
 */
export function validateTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // Check minimum length
  if (token.length < 8) {
    return false;
  }

  // Check maximum length
  if (token.length > 256) {
    return false;
  }

  // Check that token only contains valid characters
  const validChars = new Set(TOKEN_ALPHABET);
  for (const char of token) {
    if (!validChars.has(char)) {
      return false;
    }
  }

  return true;
}

/**
 * Create a hash of sensitive data for logging/comparison
 * 
 * @param data Sensitive data to hash
 * @returns SHA-256 hash (first 8 characters)
 */
export function createSafeHash(data: string): string {
  if (!data) {
    return 'empty';
  }

  const hash = createHash('sha256').update(data).digest('hex');
  return hash.substring(0, 8); // First 8 characters for identification
}

/**
 * Secure comparison of two strings to prevent timing attacks
 * 
 * @param a First string
 * @param b Second string  
 * @returns True if strings are equal
 */
export function secureCompare(a: string, b: string): boolean {
  if (!a || !b) {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Token utility class for organized token operations
 */
export class TokenUtils {
  /**
   * Generate API key with specified length
   */
  static generateApiKey(length: number = DEFAULT_TOKEN_LENGTH): string {
    return generateSecureToken(length);
  }

  /**
   * Validate API key format
   */
  static isValidApiKey(apiKey: string): boolean {
    return validateTokenFormat(apiKey);
  }

  /**
   * Create safe representation of API key for logging
   */
  static maskApiKey(apiKey: string): string {
    if (!apiKey || apiKey.length < 8) {
      return '***';
    }

    const hash = createSafeHash(apiKey);
    const prefix = apiKey.substring(0, 3);
    return `${prefix}***${hash}`;
  }

  /**
   * Securely compare API keys
   */
  static compareApiKeys(provided: string, expected: string): boolean {
    return secureCompare(provided, expected);
  }
}
