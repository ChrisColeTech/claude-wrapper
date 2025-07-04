/**
 * Claude Code SDK Integration
 * Exports all Claude SDK related functionality
 */

export * from './client';
export * from './sdk-client';
export * from './interfaces';
export { ClaudeSDKError, AuthenticationError, StreamingError, VerificationError } from './error-types';
export * from './parser';
export * from './metadata';
export * from './service';

// Re-export common interfaces for convenience
export type {
  ClaudeCodeOptions,
  ClaudeCodeMessage,
  ParsedClaudeMessage,
  ResponseMetadata,
  VerificationResult
} from './client';

export type {
  IClaudeService,
  IClaudeSDKClient,
  ISDKVerifier,
  ClaudeCompletionOptions,
  ClaudeCompletionResponse,
  ClaudeStreamChunk,
  ClaudeSDKConfig
} from './interfaces';

export type {
  ParsedClaudeResponse
} from './parser';

export type {
  ResponseMetadata as MetadataResponse,
  TokenUsage
} from './metadata';