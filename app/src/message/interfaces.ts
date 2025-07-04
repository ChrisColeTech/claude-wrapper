/**
 * Message Conversion Interfaces
 * ISP compliance: Single-purpose interfaces with max 5 methods each
 * 
 * Single Responsibility: Define clean interfaces for message conversion
 */

import { Message } from '../models/message';
import { ClaudeCodeMessage } from '../claude/client';
import { MessageFormat, ConversionMode } from './constants';

/**
 * Message conversion result interface
 */
export interface MessageConversionResult {
  /** Converted content */
  content: string;
  /** System prompt if extracted */
  systemPrompt?: string;
  /** Conversion metadata */
  metadata: {
    originalFormat: MessageFormat;
    targetFormat: MessageFormat;
    conversionMode: ConversionMode;
    processingTimeMs: number;
    messageCount: number;
  };
}

/**
 * Claude conversion result interface
 */
export interface ClaudeConversionResult {
  /** Claude-formatted prompt */
  prompt: string;
  /** System prompt */
  systemPrompt?: string;
  /** Continue conversation flag */
  continueConversation?: string;
  /** Session ID for continuity */
  sessionId?: string;
}

/**
 * OpenAI conversion result interface
 */
export interface OpenAIConversionResult {
  /** Message content */
  content: string;
  /** Message role */
  role: 'assistant';
  /** Finish reason */
  finishReason: string;
  /** Model used */
  model?: string;
  /** Session ID */
  sessionId?: string;
}

/**
 * Content filtering result interface
 */
export interface ContentFilterResult {
  /** Filtered content */
  content: string;
  /** Whether content was modified */
  wasFiltered: boolean;
  /** Filters applied */
  filtersApplied: string[];
  /** Processing time */
  processingTimeMs: number;
}

/**
 * OpenAI to Claude converter interface
 * ISP: Focused on OpenAI -> Claude conversion only
 */
export interface IOpenAIToClaudeConverter {
  /**
   * Convert OpenAI messages to Claude format
   */
  convert(messages: Message[]): Promise<ClaudeConversionResult>;

  /**
   * Convert with session continuity
   */
  convertWithSession(
    messages: Message[], 
    sessionId?: string
  ): Promise<ClaudeConversionResult>;

  /**
   * Validate OpenAI message format
   */
  validateMessages(messages: Message[]): boolean;
}

/**
 * Claude to OpenAI converter interface
 * ISP: Focused on Claude -> OpenAI conversion only
 */
export interface IClaudeToOpenAIConverter {
  /**
   * Convert Claude response to OpenAI format
   */
  convert(
    claudeMessages: ClaudeCodeMessage[], 
    model?: string
  ): Promise<OpenAIConversionResult>;

  /**
   * Convert single Claude message
   */
  convertMessage(
    claudeMessage: ClaudeCodeMessage
  ): Promise<OpenAIConversionResult>;

  /**
   * Extract session ID from Claude messages
   */
  extractSessionId(claudeMessages: ClaudeCodeMessage[]): string | undefined;
}

/**
 * Message parser interface
 * ISP: Focused on parsing operations only
 */
export interface IMessageParser {
  /**
   * Parse Claude SDK messages
   */
  parseClaudeMessages(messages: ClaudeCodeMessage[]): Promise<string>;

  /**
   * Extract content from Claude messages
   */
  extractContent(messages: ClaudeCodeMessage[]): string;

  /**
   * Check if messages represent complete response
   */
  isCompleteResponse(messages: ClaudeCodeMessage[]): boolean;
}

/**
 * Content filter interface
 * ISP: Focused on content filtering only
 */
export interface IContentFilter {
  /**
   * Filter content based on patterns
   */
  filter(content: string): Promise<ContentFilterResult>;

  /**
   * Remove thinking blocks
   */
  removeThinkingBlocks(content: string): string;

  /**
   * Remove tool usage patterns
   */
  removeToolUsage(content: string): string;

  /**
   * Extract attempt completion content
   */
  extractAttemptCompletion(content: string): string | null;
}

/**
 * Message conversion context
 */
export interface MessageConversionContext {
  /** Source format */
  sourceFormat: MessageFormat;
  /** Target format */
  targetFormat: MessageFormat;
  /** Session information */
  session?: {
    id: string;
    continueConversation: boolean;
  };
  /** Performance constraints */
  performance?: {
    timeoutMs: number;
    maxMessageLength: number;
  };
  /** Filtering options */
  filtering?: {
    enableThinkingRemoval: boolean;
    enableToolUsageRemoval: boolean;
    enableImageFiltering: boolean;
  };
}

/**
 * Conversion error details
 */
export interface ConversionErrorDetails {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Source that caused error */
  source?: any;
  /** Conversion context */
  context?: MessageConversionContext;
  /** Processing time before error */
  processingTimeMs?: number;
}