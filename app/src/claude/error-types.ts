/**
 * Claude SDK Error Types
 * Based on CLAUDE_SDK_REFERENCE.md error handling patterns
 * 
 * Single Responsibility: Define consistent error types for Claude SDK operations
 */

/**
 * Base error class for all Claude SDK operations
 */
export class ClaudeSDKError extends Error {
  public readonly code?: string;
  
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ClaudeSDKError';
    this.code = code;
    
    // Maintain proper stack trace for debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClaudeSDKError);
    }
  }
}

/**
 * Authentication-specific error for Claude SDK
 */
export class AuthenticationError extends ClaudeSDKError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_FAILED');
    this.name = 'AuthenticationError';
  }
}

/**
 * Streaming-specific error for Claude SDK
 */
export class StreamingError extends ClaudeSDKError {
  constructor(message: string) {
    super(message, 'STREAMING_FAILED');
    this.name = 'StreamingError';
  }
}

/**
 * SDK verification error
 */
export class VerificationError extends ClaudeSDKError {
  constructor(message: string) {
    super(message, 'VERIFICATION_FAILED');
    this.name = 'VerificationError';
  }
}

/**
 * Error handling wrapper for Claude SDK calls
 * Based on CLAUDE_SDK_REFERENCE.md handleClaudeSDKCall pattern
 */
export async function handleClaudeSDKCall<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Preserve existing Claude SDK error types
    if (error instanceof ClaudeSDKError) {
      throw error;
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerMessage = errorMessage.toLowerCase();
    
    if (lowerMessage.includes('authentication') || lowerMessage.includes('auth')) {
      throw new AuthenticationError(`Claude Code authentication failed: ${errorMessage}`);
    }
    if (lowerMessage.includes('stream')) {
      throw new StreamingError(`Streaming failed: ${errorMessage}`);
    }
    throw new ClaudeSDKError(`SDK operation failed: ${errorMessage}`);
  }
}