/**
 * Claude Code SDK Integration
 * Exports all Claude SDK related functionality
 */

export * from './client';
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
  ParsedClaudeResponse,
  TokenUsage
} from './parser';

export type {
  ResponseMetadata as MetadataResponse
} from './metadata';

export type {
  ClaudeCompletionOptions,
  ClaudeCompletionResponse,
  ClaudeStreamChunk
} from './service';