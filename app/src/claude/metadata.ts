/**
 * Claude Code SDK Metadata Extractor
 * Extracts metadata like costs, tokens, and session info from SDK messages
 * Based on Python claude_cli.py extract_metadata implementation
 */

// import { getLogger } from '../utils/logger';
import { ClaudeCodeMessage } from './client';

// const _logger = getLogger('ClaudeMetadata');

/**
 * Response metadata interface
 */
export interface ResponseMetadata {
  session_id?: string;
  total_cost_usd: number;
  duration_ms: number;
  num_turns: number;
  model?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Claude Code SDK Metadata Extractor
 * Processes SDK messages to extract performance and usage metadata
 */
export class ClaudeMetadataExtractor {
  /**
   * Extract metadata from Claude Code SDK messages
   * Based on Python extract_metadata method
   */
  static extractMetadata(messages: ClaudeCodeMessage[]): ResponseMetadata {
    const metadata: ResponseMetadata = {
      total_cost_usd: 0.0,
      duration_ms: 0,
      num_turns: 0,
      model: undefined,
      session_id: undefined
    };

    for (const message of messages) {
      // Handle new SDK format - ResultMessage
      if (message.type === 'result' && message.subtype === 'success') {
        if (typeof message.total_cost_usd === 'number') {
          metadata.total_cost_usd = message.total_cost_usd;
        }
        if (typeof message.duration_ms === 'number') {
          metadata.duration_ms = message.duration_ms;
        }
        if (typeof message.num_turns === 'number') {
          metadata.num_turns = message.num_turns;
        }
        if (message.session_id) {
          metadata.session_id = message.session_id;
        }
      }
      
      // Handle SystemMessage for session info
      else if (message.type === 'system' && message.subtype === 'init' && message.data) {
        const data = message.data;
        if (data.session_id) {
          metadata.session_id = data.session_id;
        }
        if (data.model) {
          metadata.model = data.model;
        }
      }
    }

    // Estimate token usage if not provided
    const tokenUsage = this.estimateTokenUsage(messages);
    metadata.prompt_tokens = tokenUsage.prompt_tokens;
    metadata.completion_tokens = tokenUsage.completion_tokens;
    metadata.total_tokens = tokenUsage.total_tokens;

    return metadata;
  }

  /**
   * Estimate token usage from message content
   * Based on rough 4-characters-per-token estimation
   */
  static estimateTokenUsage(messages: ClaudeCodeMessage[]): TokenUsage {
    let promptChars = 0;
    let completionChars = 0;

    for (const message of messages) {
      if (message.type === 'user' || message.type === 'system') {
        // Count as prompt tokens
        const content = this.extractTextContent(message);
        promptChars += content.length;
      } else if (message.type === 'assistant') {
        // Count as completion tokens
        const content = this.extractTextContent(message);
        completionChars += content.length;
      }
    }

    // Rough estimation: 4 characters per token
    const prompt_tokens = Math.ceil(promptChars / 4);
    const completion_tokens = Math.ceil(completionChars / 4);
    const total_tokens = prompt_tokens + completion_tokens;

    return {
      prompt_tokens,
      completion_tokens,
      total_tokens
    };
  }

  /**
   * Extract text content from message
   */
  private static extractTextContent(message: ClaudeCodeMessage): string {
    // Handle array content
    if (Array.isArray(message.content)) {
      const textParts: string[] = [];
      for (const block of message.content) {
        if (typeof block === 'string') {
          textParts.push(block);
        } else if (block && typeof block === 'object' && block.text) {
          textParts.push(block.text);
        }
      }
      return textParts.join('\n');
    }
    
    // Handle string content
    if (typeof message.content === 'string') {
      return message.content;
    }
    
    // Handle message with nested content (message is string type, not object)
    if (message.message && typeof message.message === 'string') {
      return message.message;
    }
    
    return '';
  }

  /**
   * Get session information from messages
   */
  static getSessionInfo(messages: ClaudeCodeMessage[]): { session_id?: string; model?: string } {
    for (const message of messages) {
      if (message.type === 'system' && message.subtype === 'init' && message.data) {
        return {
          session_id: message.data.session_id,
          model: message.data.model
        };
      }
      
      if (message.session_id) {
        return {
          session_id: message.session_id,
          model: undefined
        };
      }
    }
    
    return {};
  }

  /**
   * Get cost information from messages
   */
  static getCostInfo(messages: ClaudeCodeMessage[]): { cost: number; currency: string } {
    for (const message of messages) {
      if (message.type === 'result' && message.subtype === 'success' && typeof message.total_cost_usd === 'number') {
        return {
          cost: message.total_cost_usd,
          currency: 'USD'
        };
      }
    }
    
    return {
      cost: 0.0,
      currency: 'USD'
    };
  }

  /**
   * Get performance information from messages
   */
  static getPerformanceInfo(messages: ClaudeCodeMessage[]): { duration_ms: number; num_turns: number } {
    for (const message of messages) {
      if (message.type === 'result' && message.subtype === 'success') {
        return {
          duration_ms: message.duration_ms || 0,
          num_turns: message.num_turns || 0
        };
      }
    }
    
    return {
      duration_ms: 0,
      num_turns: 0
    };
  }

  /**
   * Check if messages contain cost information
   */
  static hasCostInfo(messages: ClaudeCodeMessage[]): boolean {
    return messages.some(msg => 
      msg.type === 'result' && 
      msg.subtype === 'success' && 
      typeof msg.total_cost_usd === 'number'
    );
  }

  /**
   * Check if messages contain performance information
   */
  static hasPerformanceInfo(messages: ClaudeCodeMessage[]): boolean {
    return messages.some(msg => 
      msg.type === 'result' && 
      msg.subtype === 'success' && 
      (typeof msg.duration_ms === 'number' || typeof msg.num_turns === 'number')
    );
  }

  /**
   * Convert metadata to OpenAI Usage format
   */
  static toOpenAIUsage(metadata: ResponseMetadata): TokenUsage {
    return {
      prompt_tokens: metadata.prompt_tokens || 0,
      completion_tokens: metadata.completion_tokens || 0,
      total_tokens: metadata.total_tokens || 0
    };
  }
}