/**
 * Claude SDK Service Interfaces
 * Based on CLAUDE_SDK_REFERENCE.md patterns and Python claude_cli.py
 * 
 * Single Responsibility: Define clean interfaces for Claude SDK integration
 */

import { ClaudeCodeOptions, ClaudeCodeMessage, ResponseMetadata } from './client';

/**
 * Core Claude SDK Service Interface
 * Based on Python ClaudeCodeCLI class interface
 */
export interface IClaudeService {
  /**
   * Verify Claude SDK availability and authentication
   */
  verifySDK(): Promise<{ available: boolean; error?: string }>;

  /**
   * Create a completion using Claude SDK
   */
  createCompletion(
    messages: Array<{ role: string; content: string }>,
    options?: ClaudeCompletionOptions
  ): Promise<ClaudeCompletionResponse>;

  /**
   * Create a streaming completion using Claude SDK
   */
  createStreamingCompletion(
    messages: Array<{ role: string; content: string }>,
    options?: ClaudeCompletionOptions
  ): AsyncGenerator<ClaudeStreamChunk, void, unknown>;

  /**
   * Check if Claude SDK is available
   */
  isSDKAvailable(): boolean;

  /**
   * Get current timeout setting
   */
  getTimeout(): number;
}

/**
 * Claude SDK Client Interface
 * Based on Python SDK wrapper interface
 */
export interface IClaudeSDKClient {
  /**
   * Verify Claude SDK availability
   */
  verifySDK(): Promise<VerificationResult>;

  /**
   * Run completion with Claude SDK
   */
  runCompletion(
    prompt: string,
    options?: ClaudeCodeOptions
  ): AsyncGenerator<ClaudeCodeMessage, void, unknown>;

  /**
   * Check if SDK is available
   */
  isAvailable(): boolean;

  /**
   * Get timeout value
   */
  getTimeout(): number;

  /**
   * Get current working directory
   */
  getCwd(): string;
}

/**
 * SDK Verification Interface
 * Based on CLAUDE_SDK_REFERENCE.md verification patterns
 */
export interface ISDKVerifier {
  /**
   * Verify SDK availability and authentication
   */
  verifySDK(): Promise<VerificationResult>;

  /**
   * Test basic SDK functionality
   */
  testSDKConnection(): Promise<boolean>;
}

/**
 * Claude Completion Options Interface
 * Based on OpenAI compatibility requirements
 */
export interface ClaudeCompletionOptions {
  /** Model to use for completion */
  model?: string;
  /** Maximum number of turns */
  max_turns?: number;
  /** Allowed tools */
  allowed_tools?: string[];
  /** Disallowed tools */
  disallowed_tools?: string[];
  /** System prompt */
  system_prompt?: string;
  /** Enable tools */
  enable_tools?: boolean;
  /** Stream response */
  stream?: boolean;
}

/**
 * Claude Completion Response Interface
 * Based on OpenAI compatibility requirements
 */
export interface ClaudeCompletionResponse {
  /** Response content */
  content: string;
  /** Response role */
  role: 'assistant';
  /** Response metadata */
  metadata: ResponseMetadata;
  /** Session ID */
  session_id?: string;
  /** Stop reason */
  stop_reason?: 'stop' | 'length' | 'content_filter' | null;
}

/**
 * Claude Stream Chunk Interface
 * Based on OpenAI streaming compatibility
 */
export interface ClaudeStreamChunk {
  /** Current content */
  content: string;
  /** Delta content */
  delta?: string;
  /** Whether response is finished */
  finished: boolean;
  /** Response metadata */
  metadata?: ResponseMetadata;
}

/**
 * SDK Verification Result Interface
 * Based on CLAUDE_SDK_REFERENCE.md verification patterns
 */
export interface VerificationResult {
  /** Whether SDK is available */
  available: boolean;
  /** SDK version */
  version?: string;
  /** Authentication status */
  authentication?: boolean;
  /** Error message */
  error?: string;
  /** Suggestion for fixing issues */
  suggestion?: string;
}

/**
 * Authentication Provider Interface
 * Based on multi-provider authentication patterns
 */
export interface IAuthProvider {
  /** Provider name */
  name: string;
  /** Check if provider is available */
  isAvailable(): Promise<boolean>;
  /** Get environment variables for provider */
  getEnvVars(): Record<string, string>;
  /** Verify authentication */
  verify(): Promise<boolean>;
}

/**
 * Message Adapter Interface
 * Based on message conversion patterns
 */
export interface IMessageAdapter {
  /**
   * Convert messages to Claude prompt format
   */
  convertToClaudePrompt(messages: Array<{ role: string; content: string }>): string;

  /**
   * Convert Claude response to OpenAI format
   */
  convertToOpenAIFormat(response: ClaudeCodeMessage[]): any;
}

/**
 * Response Parser Interface
 * Based on Python response parsing patterns
 */
export interface IResponseParser {
  /**
   * Parse Claude messages to OpenAI response
   */
  parseToOpenAIResponse(messages: ClaudeCodeMessage[]): any;

  /**
   * Check if response is complete
   */
  isCompleteResponse(messages: ClaudeCodeMessage[]): boolean;

  /**
   * Parse Claude message content
   */
  parseClaudeMessage(messages: ClaudeCodeMessage[]): string | null;
}

/**
 * Metadata Extractor Interface
 * Based on Python metadata extraction patterns
 */
export interface IMetadataExtractor {
  /**
   * Extract metadata from Claude response
   */
  extractMetadata(messages: ClaudeCodeMessage[]): ResponseMetadata;

  /**
   * Extract token usage information
   */
  extractTokenUsage(messages: ClaudeCodeMessage[]): {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Claude SDK Configuration
 * Based on CLAUDE_SDK_REFERENCE.md configuration patterns
 */
export interface ClaudeSDKConfig {
  /** Default timeout in milliseconds */
  timeout: number;
  /** Default working directory */
  cwd: string;
  /** Default model */
  model: string;
  /** Default maximum turns */
  max_turns: number;
  /** Authentication method priority */
  auth_priority: string[];
}

/**
 * Claude SDK Constants
 * Based on CLAUDE_SDK_REFERENCE.md constants
 */
export const CLAUDE_SDK_CONSTANTS = {
  /** Default timeout */
  DEFAULT_TIMEOUT: 600000, // 10 minutes
  /** Default model */
  DEFAULT_MODEL: 'claude-3-5-sonnet-20241022',
  /** Default max turns */
  DEFAULT_MAX_TURNS: 1,
  /** Performance requirement */
  PERFORMANCE_REQUIREMENT_MS: 2000, // 2 seconds
  /** Authentication methods */
  AUTH_METHODS: {
    ANTHROPIC_API_KEY: 'anthropic',
    BEDROCK: 'bedrock',
    VERTEX: 'vertex',
    CLAUDE_CLI: 'claude-cli'
  },
  /** SDK timeouts */
  SDK_TIMEOUTS: {
    VERIFICATION: 5000, // 5 seconds
    COMPLETION: 600000, // 10 minutes
    STREAMING: 30000 // 30 seconds
  }
} as const;