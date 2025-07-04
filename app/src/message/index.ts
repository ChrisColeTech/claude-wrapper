/**
 * Message module exports
 * Phase 2A: Updated with new message conversion components
 */

// Legacy components (backwards compatibility)
export * from './adapter';
export * from './filter';
export * from './tokens';

// Phase 2A: New message format conversion components
export * from './constants';
export * from './interfaces';
export * from './errors';
export * from './claude-converter';
export * from './openai-converter';
export { MessageParser, MessageParserFactory } from './message-parser';

// Re-export key types for convenience
export type {
  MessageConversionResult,
  ClaudeConversionResult,
  OpenAIConversionResult,
  ContentFilterResult,
  MessageConversionContext
} from './interfaces';

// Re-export key constants
export {
  MESSAGE_FORMATS,
  CONVERSION_MODES,
  MESSAGE_ROLES,
  MESSAGE_PERFORMANCE
} from './constants';

// Re-export main converter instances
export { claudeConverter } from './claude-converter';
export { openaiConverter } from './openai-converter';
export { messageParser, contentFilter } from './message-parser';
