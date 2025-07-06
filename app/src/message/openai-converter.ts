/**
 * Claude to OpenAI Format Converter
 * SRP: Handles only Claude to OpenAI message format conversion
 * Based on CLAUDE_SDK_REFERENCE.md response conversion patterns
 */

import { ClaudeCodeMessage } from '../claude/client';
import { IClaudeToOpenAIConverter } from './interfaces';
import { OpenAIConversionResult } from './interfaces';
import { 
  OPENAI_FORMAT_CONSTANTS,
  MESSAGE_PERFORMANCE
} from './constants';
import { 
  MessageConversionError,
  MessageParsingError,
  ConversionTimeoutError,
  handleMessageConversionCall 
} from './errors';
import { getLogger } from '../utils/logger';

const logger = getLogger('OpenAIConverter');

/**
 * Claude to OpenAI message converter
 * SRP: Single responsibility for Claude -> OpenAI conversion
 * Max file size: <200 lines, functions <50 lines
 */
export class OpenAIConverter implements IClaudeToOpenAIConverter {

  /**
   * Convert Claude response to OpenAI format
   * Performance requirement: <50ms per request
   */
  async convert(
    claudeMessages: ClaudeCodeMessage[], 
    model?: string
  ): Promise<OpenAIConversionResult> {
    return handleMessageConversionCall(async () => {
      const startTime = Date.now();
      
      // Validate input
      this.validateClaudeMessages(claudeMessages);
      
      // Check timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new ConversionTimeoutError(
            MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS,
            'Claude to OpenAI conversion'
          ));
        }, MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS);
      });
      
      // Perform conversion
      const conversionPromise = this.performConversion(claudeMessages, model);
      
      const result = await Promise.race([conversionPromise, timeoutPromise]);
      
      const processingTime = Date.now() - startTime;
      logger.debug('Claude to OpenAI conversion completed', {
        messageCount: claudeMessages.length,
        processingTimeMs: processingTime,
        contentLength: result.content.length
      });
      
      return result;
    }, 'Claude to OpenAI conversion');
  }

  /**
   * Convert single Claude message
   */
  async convertMessage(claudeMessage: ClaudeCodeMessage): Promise<OpenAIConversionResult> {
    return this.convert([claudeMessage]);
  }

  /**
   * Extract session ID from Claude messages
   */
  extractSessionId(claudeMessages: ClaudeCodeMessage[]): string | undefined {
    for (const message of claudeMessages) {
      // Check direct session_id property
      if (message.session_id) {
        return message.session_id;
      }
      
      // Check in data object for system init messages
      if (message.type === 'system' && message.subtype === 'init' && message.data?.session_id) {
        return message.data.session_id;
      }
      
      // Check in message object (message is string type, not object)
      // message property is string, not object with session_id
    }
    
    return undefined;
  }

  /**
   * Validate Claude messages array
   */
  private validateClaudeMessages(claudeMessages: ClaudeCodeMessage[]): void {
    if (!claudeMessages || claudeMessages.length === 0) {
      throw new MessageParsingError('Claude messages array cannot be empty');
    }

    // Check for at least one assistant or result message
    const hasContent = claudeMessages.some(m => 
      m.type === 'assistant' || 
      m.type === 'result' || 
      (m.type === 'system' && m.content)
    );

    if (!hasContent) {
      throw new MessageParsingError('No content found in Claude messages');
    }
  }

  /**
   * Perform the actual conversion logic
   * DRY: Extracted common conversion pattern
   */
  private async performConversion(
    claudeMessages: ClaudeCodeMessage[], 
    model?: string
  ): Promise<OpenAIConversionResult> {
    // Extract content using parsing strategy
    const content = this.extractContentFromMessages(claudeMessages);
    
    // Get session ID
    const sessionId = this.extractSessionId(claudeMessages);
    
    // Determine finish reason
    const finishReason = this.determineFinishReason(claudeMessages);
    
    return {
      content,
      role: OPENAI_FORMAT_CONSTANTS.ROLE_ASSISTANT,
      finishReason,
      model,
      sessionId
    };
  }

  /**
   * Extract content from Claude messages using parsing hierarchy
   */
  private extractContentFromMessages(claudeMessages: ClaudeCodeMessage[]): string {
    // Strategy 1: Look for assistant messages with content
    for (const message of claudeMessages) {
      if (message.type === 'assistant' && message.content) {
        return this.parseClaudeContent(message.content);
      }
    }

    // Strategy 2: Look for result messages with data
    for (const message of claudeMessages) {
      if (message.type === 'result' && message.data) {
        const content = this.extractFromResultData(message.data);
        if (content) {
          return content;
        }
      }
    }

    // Strategy 3: Look for system messages with content
    for (const message of claudeMessages) {
      if (message.type === 'system' && message.content) {
        return this.parseClaudeContent(message.content);
      }
    }

    // Strategy 4: Look in message objects (message is string type, not object)
    for (const message of claudeMessages) {
      if (message.message && typeof message.message === 'string') {
        return message.message;
      }
    }

    throw new MessageParsingError('No extractable content found in Claude messages');
  }

  /**
   * Parse Claude content handling various formats
   */
  private parseClaudeContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      // Handle content blocks format
      return content
        .map(block => {
          if (typeof block === 'string') {
            return block;
          }
          if (block.text) {
            return block.text;
          }
          if (block.content) {
            return block.content;
          }
          return String(block);
        })
        .join('');
    }

    if (content && typeof content === 'object') {
      // Handle object with text property
      if (content.text) {
        return content.text;
      }
      if (content.content) {
        return content.content;
      }
    }

    return String(content);
  }

  /**
   * Extract content from result data
   */
  private extractFromResultData(data: any): string | null {
    if (!data) {
      return null;
    }

    if (typeof data === 'string') {
      return data;
    }

    if (data.content) {
      return this.parseClaudeContent(data.content);
    }

    if (data.response) {
      return this.parseClaudeContent(data.response);
    }

    if (data.message) {
      return this.parseClaudeContent(data.message);
    }

    return null;
  }

  /**
   * Determine finish reason from Claude messages
   */
  private determineFinishReason(claudeMessages: ClaudeCodeMessage[]): string {
    // Look for result messages with finish reason
    for (const message of claudeMessages) {
      if (message.type === 'result') {
        if (message.subtype === 'error') {
          return 'content_filter';
        }
        if (message.subtype === 'success') {
          return OPENAI_FORMAT_CONSTANTS.DEFAULT_FINISH_REASON;
        }
      }
    }

    // Check for explicit stop reasons
    for (const message of claudeMessages) {
      if (message.stop_reason) {
        return message.stop_reason;
      }
      // message property is string, not object with stop_reason
      // Skip checking message.message.stop_reason as message is string type
    }

    return OPENAI_FORMAT_CONSTANTS.DEFAULT_FINISH_REASON;
  }
}

/**
 * OpenAI conversion utility functions
 * DRY: Common conversion patterns extracted
 */
export class OpenAIConversionUtils {
  
  /**
   * Create OpenAI streaming chunk format
   */
  static createStreamChunk(
    content: string,
    delta: string,
    finished: boolean,
    model?: string
  ): any {
    return {
      id: `chatcmpl-${Date.now()}`,
      object: OPENAI_FORMAT_CONSTANTS.COMPLETION_CHUNK_OBJECT,
      created: Math.floor(Date.now() / 1000),
      model: model || 'claude-3-5-sonnet-20241022',
      choices: [{
        index: 0,
        delta: finished ? {} : { content: delta },
        finish_reason: finished ? OPENAI_FORMAT_CONSTANTS.DEFAULT_FINISH_REASON : null
      }]
    };
  }

  /**
   * Create OpenAI completion format
   */
  static createCompletion(
    content: string,
    model?: string,
    finishReason: string = OPENAI_FORMAT_CONSTANTS.DEFAULT_FINISH_REASON
  ): any {
    return {
      id: `chatcmpl-${Date.now()}`,
      object: OPENAI_FORMAT_CONSTANTS.COMPLETION_OBJECT,
      created: Math.floor(Date.now() / 1000),
      model: model || 'claude-3-5-sonnet-20241022',
      choices: [{
        index: 0,
        message: {
          role: OPENAI_FORMAT_CONSTANTS.ROLE_ASSISTANT,
          content
        },
        finish_reason: finishReason
      }]
    };
  }
}

/**
 * Factory for creating OpenAI converters
 */
export class OpenAIConverterFactory {
  
  /**
   * Create an OpenAI converter instance
   */
  static create(): IClaudeToOpenAIConverter {
    return new OpenAIConverter();
  }
}

/**
 * Global OpenAI converter instance
 */
export const openaiConverter = OpenAIConverterFactory.create();