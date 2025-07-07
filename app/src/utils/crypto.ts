/**
 * Cryptographic utilities for secure token generation
 * Based on original claude-wrapper crypto utils
 * Single Responsibility: Secure random token generation
 */

import { randomBytes, createHash } from 'crypto';
import { API_KEY_SECURITY } from '../config/security-constants';

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
 * Based on original generateSecureToken() function
 * 
 * @param length Token length (default: 32)
 * @returns Secure random token
 */
export function generateSecureToken(length: number = API_KEY_SECURITY.DEFAULT_LENGTH): string {
  if (length < API_KEY_SECURITY.MIN_LENGTH) {
    throw new TokenGenerationError(`Token length must be at least ${API_KEY_SECURITY.MIN_LENGTH} characters`);
  }

  if (length > API_KEY_SECURITY.MAX_LENGTH) {
    throw new TokenGenerationError(`Token length must be at most ${API_KEY_SECURITY.MAX_LENGTH} characters`);
  }

  try {
    // Generate random bytes
    const randomBuffer = randomBytes(length);
    
    // Convert to secure token using alphabet
    let token = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = randomBuffer[i]! % API_KEY_SECURITY.VALID_CHARACTERS.length;
      token += API_KEY_SECURITY.VALID_CHARACTERS[randomIndex];
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
  if (token.length < API_KEY_SECURITY.MIN_LENGTH) {
    return false;
  }

  // Check maximum length
  if (token.length > API_KEY_SECURITY.MAX_LENGTH) {
    return false;
  }

  // Check that token only contains valid characters
  const validChars = new Set(API_KEY_SECURITY.VALID_CHARACTERS);
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
  return hash.substring(0, API_KEY_SECURITY.HASH_DISPLAY_LENGTH);
}