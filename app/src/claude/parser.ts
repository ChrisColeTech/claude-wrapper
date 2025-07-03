/**
 * Claude Code SDK Response Parser
 * Parses Claude Code SDK responses into OpenAI-compatible format
 * Based on Python claude_cli.py parse_claude_message implementation
 */

// import { getLogger } from '../utils/logger';
import { ClaudeCodeMessage } from './client';

// const _logger = getLogger('ClaudeParser');

/**
 * Parsed Claude response interface
 */
export interface ParsedClaudeResponse {
  content: string;
  role: 'assistant';
  stop_reason?: 'stop' | 'length' | 'content_filter' | null;
  session_id?: string;
}

/**
 * Claude Code SDK Response Parser
 * Extracts assistant messages from Claude Code SDK response stream
 */
export class ClaudeResponseParser {
  /**
   * Parse Claude Code SDK messages to extract assistant response
   * Based on Python parse_claude_message method
   */
  static parseClaudeMessage(messages: ClaudeCodeMessage[]): string | null {
    for (const message of messages) {
      // Handle new SDK format - AssistantMessage with content blocks
      if (message.content && Array.isArray(message.content)) {
        const textParts: string[] = [];
        
        for (const block of message.content) {
          if (this.hasTextProperty(block)) {
            textParts.push(block.text);
          } else if (this.isTextBlock(block)) {
            textParts.push(block.text || '');
          } else if (typeof block === 'string') {
            textParts.push(block);
          }
        }
        
        if (textParts.length > 0) {
          return textParts.join('\n');
        }
      }
      
      // Handle old format fallback
      else if (message.type === 'assistant' && message.message) {
        const sdkMessage = message.message;
        if (this.isMessageWithContent(sdkMessage)) {
          const content = sdkMessage.content;
          
          if (Array.isArray(content)) {
            const textParts: string[] = [];
            for (const block of content) {
              if (this.isTextBlock(block)) {
                textParts.push(block.text || '');
              }
            }
            return textParts.length > 0 ? textParts.join('\n') : null;
          } else if (typeof content === 'string') {
            return content;
          }
        }
      }
      
      // Handle direct content string
      else if (message.type === 'assistant' && typeof message.content === 'string') {
        return message.content;
      }
    }
    
    return null;
  }

  /**
   * Parse messages into OpenAI-compatible response
   */
  static parseToOpenAIResponse(messages: ClaudeCodeMessage[]): ParsedClaudeResponse | null {
    const content = this.parseClaudeMessage(messages);
    
    if (!content) {
      return null;
    }

    // Extract session ID from messages
    const sessionId = this.extractSessionId(messages);
    
    return {
      content,
      role: 'assistant',
      stop_reason: 'stop',
      session_id: sessionId
    };
  }

  /**
   * Extract session ID from messages
   */
  static extractSessionId(messages: ClaudeCodeMessage[]): string | undefined {
    for (const message of messages) {
      if (message.session_id) {
        return message.session_id;
      }
      
      // Check in data field for system init messages
      if (message.type === 'system' && message.subtype === 'init' && message.data?.session_id) {
        return message.data.session_id;
      }
    }
    
    return undefined;
  }

  /**
   * Filter assistant messages from response stream
   */
  static filterAssistantMessages(messages: ClaudeCodeMessage[]): ClaudeCodeMessage[] {
    return messages.filter(message => 
      message.type === 'assistant' || 
      (message.type === 'system' && message.subtype === 'init')
    );
  }

  /**
   * Check if response contains complete assistant message
   */
  static isCompleteResponse(messages: ClaudeCodeMessage[]): boolean {
    const hasAssistant = messages.some(msg => msg.type === 'assistant');
    const hasResult = messages.some(msg => msg.type === 'result' && msg.subtype === 'success');
    
    return hasAssistant && hasResult;
  }

  /**
   * Type guard for objects with text property
   */
  private static hasTextProperty(obj: any): obj is { text: string } {
    return obj && typeof obj === 'object' && typeof obj.text === 'string';
  }

  /**
   * Type guard for text block objects
   */
  private static isTextBlock(obj: any): obj is { type: 'text'; text: string } {
    return obj && typeof obj === 'object' && obj.type === 'text' && typeof obj.text === 'string';
  }

  /**
   * Type guard for messages with content
   */
  private static isMessageWithContent(obj: any): obj is { content: any } {
    return obj && typeof obj === 'object' && 'content' in obj;
  }
}

/**
 * Stream response parser for handling streaming responses
 */
export class StreamResponseParser {
  private buffer: ClaudeCodeMessage[] = [];

  /**
   * Add message to buffer
   */
  addMessage(message: ClaudeCodeMessage): void {
    this.buffer.push(message);
  }

  /**
   * Get current parsed content
   */
  getCurrentContent(): string | null {
    return ClaudeResponseParser.parseClaudeMessage(this.buffer);
  }

  /**
   * Check if response is complete
   */
  isComplete(): boolean {
    return ClaudeResponseParser.isCompleteResponse(this.buffer);
  }

  /**
   * Get final parsed response
   */
  getFinalResponse(): ParsedClaudeResponse | null {
    return ClaudeResponseParser.parseToOpenAIResponse(this.buffer);
  }

  /**
   * Reset parser buffer
   */
  reset(): void {
    this.buffer = [];
  }

  /**
   * Get all buffered messages
   */
  getMessages(): ClaudeCodeMessage[] {
    return [...this.buffer];
  }
}