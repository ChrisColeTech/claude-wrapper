/**
 * OpenAI to Claude Format Converter
 * SRP: Handles only OpenAI to Claude message format conversion
 * Based on CLAUDE_SDK_REFERENCE.md OpenAIToClaudeMapping patterns
 */

import { Message } from '../models/message';
import { MessageValidation } from '../models/message';
import { IOpenAIToClaudeConverter } from './interfaces';
import { ClaudeConversionResult } from './interfaces';
import { 
  MESSAGE_ROLES, 
  CLAUDE_PROMPT_FORMATS,
  MESSAGE_PERFORMANCE,
  SESSION_CONSTANTS 
} from './constants';
import { 
  MessageConversionError, 
  MessageValidationError,
  ConversionTimeoutError,
  handleMessageConversionCall 
} from './errors';
import { getLogger } from '../utils/logger';

const logger = getLogger('ClaudeConverter');

/**
 * OpenAI to Claude message converter
 * SRP: Single responsibility for OpenAI -> Claude conversion
 * Max file size: <200 lines, functions <50 lines
 */
export class ClaudeConverter implements IOpenAIToClaudeConverter {
  
  /**
   * Convert OpenAI messages to Claude format
   * Performance requirement: <50ms per request
   */
  async convert(messages: Message[]): Promise<ClaudeConversionResult> {
    return handleMessageConversionCall(async () => {
      const startTime = Date.now();
      
      // Validate input
      this.validateMessages(messages);
      
      // Check timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new ConversionTimeoutError(
            MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS,
            'OpenAI to Claude conversion'
          ));
        }, MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS);
      });
      
      // Perform conversion
      const conversionPromise = this.performConversion(messages);
      
      const result = await Promise.race([conversionPromise, timeoutPromise]);
      
      const processingTime = Date.now() - startTime;
      logger.debug('OpenAI to Claude conversion completed', {
        messageCount: messages.length,
        processingTimeMs: processingTime,
        hasSystemPrompt: !!result.systemPrompt
      });
      
      return result;
    }, 'OpenAI to Claude conversion');
  }

  /**
   * Convert with session continuity support
   */
  async convertWithSession(
    messages: Message[], 
    sessionId?: string
  ): Promise<ClaudeConversionResult> {
    const result = await this.convert(messages);
    
    if (sessionId) {
      result.sessionId = sessionId;
      result.continueConversation = sessionId;
    }
    
    return result;
  }

  /**
   * Validate OpenAI message format
   */
  validateMessages(messages: Message[]): boolean {
    if (!messages || messages.length === 0) {
      throw new MessageValidationError('Messages array cannot be empty');
    }

    if (messages.length > MESSAGE_PERFORMANCE.MAX_MESSAGES_PER_REQUEST) {
      throw new MessageValidationError(
        `Too many messages: ${messages.length} exceeds limit of ${MESSAGE_PERFORMANCE.MAX_MESSAGES_PER_REQUEST}`
      );
    }

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      if (!message.role || (!message.content && message.content !== '')) {
        throw new MessageValidationError(
          `Message at index ${i} missing required fields: role or content`
        );
      }

      // Check if role is a known OpenAI role (even if we don't support it in conversion)
      const validOpenAIRoles = ['system', 'user', 'assistant', 'tool', 'function'];
      if (!validOpenAIRoles.includes(message.role)) {
        throw new MessageValidationError(
          `Message at index ${i} has invalid role: ${message.role}`
        );
      }

      // For supported roles, validate content length
      const isSupportedRole = Object.values(MESSAGE_ROLES).includes(message.role as any);
      if (!isSupportedRole) {
        // Skip content validation for unsupported roles - they'll be filtered during conversion
        continue;
      }

      const content = MessageValidation.extractText(message);
      if (content.length > MESSAGE_PERFORMANCE.MAX_MESSAGE_LENGTH) {
        throw new MessageValidationError(
          `Message at index ${i} exceeds maximum length: ${content.length} > ${MESSAGE_PERFORMANCE.MAX_MESSAGE_LENGTH}`
        );
      }
    }

    return true;
  }

  /**
   * Perform the actual conversion logic
   * DRY: Extracted common conversion pattern
   */
  private async performConversion(messages: Message[]): Promise<ClaudeConversionResult> {
    let systemPrompt: string | undefined;
    const conversationParts: string[] = [];

    for (const message of messages) {
      const content = MessageValidation.extractText(message);
      
      switch (message.role) {
        case MESSAGE_ROLES.SYSTEM:
          // Use the last system message as the system prompt
          systemPrompt = content;
          break;
          
        case MESSAGE_ROLES.USER:
          conversationParts.push(
            `${CLAUDE_PROMPT_FORMATS.HUMAN_PREFIX} ${content}`
          );
          break;
          
        case MESSAGE_ROLES.ASSISTANT:
          conversationParts.push(
            `${CLAUDE_PROMPT_FORMATS.ASSISTANT_PREFIX} ${content}`
          );
          break;
          
        default:
          // Skip unsupported roles like 'tool' or 'function'
          logger.debug(`Skipping unsupported message role: ${message.role}`);
      }
    }

    // Join conversation parts
    let prompt = conversationParts.join(CLAUDE_PROMPT_FORMATS.SEPARATOR);

    // Add continuation prompt if needed
    if (this.needsContinuationPrompt(messages)) {
      prompt += CLAUDE_PROMPT_FORMATS.SEPARATOR + CLAUDE_PROMPT_FORMATS.CONTINUATION_PROMPT;
    }

    return {
      prompt,
      systemPrompt
    };
  }

  /**
   * Determine if conversation needs continuation prompt
   * DRY: Extracted continuation logic
   */
  private needsContinuationPrompt(messages: Message[]): boolean {
    if (messages.length === 0) {
      return false;
    }

    const lastMessage = messages[messages.length - 1];
    return lastMessage.role !== MESSAGE_ROLES.USER;
  }
}

/**
 * Message conversion utility functions
 * DRY: Common conversion patterns extracted
 */
export class MessageConversionUtils {
  
  /**
   * Estimate token count for Claude format
   */
  static estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / MESSAGE_PERFORMANCE.TOKEN_ESTIMATION_RATIO);
  }

  /**
   * Truncate conversation history for performance
   */
  static truncateHistory(messages: Message[]): Message[] {
    if (messages.length <= SESSION_CONSTANTS.HISTORY_TRUNCATION_THRESHOLD) {
      return messages;
    }

    // Keep system messages and recent conversation
    const systemMessages = messages.filter(m => m.role === MESSAGE_ROLES.SYSTEM);
    const recentMessages = messages
      .filter(m => m.role !== MESSAGE_ROLES.SYSTEM)
      .slice(-SESSION_CONSTANTS.HISTORY_TRUNCATION_THRESHOLD);

    return [...systemMessages, ...recentMessages];
  }

  /**
   * Merge system prompts when multiple exist
   */
  static mergeSystemPrompts(messages: Message[]): string | undefined {
    const systemMessages = messages.filter(m => m.role === MESSAGE_ROLES.SYSTEM);
    
    if (systemMessages.length === 0) {
      return undefined;
    }

    if (systemMessages.length === 1) {
      return MessageValidation.extractText(systemMessages[0]);
    }

    // Merge multiple system messages
    return systemMessages
      .map(m => MessageValidation.extractText(m))
      .join('\n\n');
  }
}

/**
 * Factory for creating Claude converters
 */
export class ClaudeConverterFactory {
  
  /**
   * Create a Claude converter instance
   */
  static create(): IOpenAIToClaudeConverter {
    return new ClaudeConverter();
  }

  /**
   * Create converter with performance constraints
   */
  static createWithConstraints(
    timeoutMs: number = MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS
  ): IOpenAIToClaudeConverter {
    // Currently returns standard converter
    // Can be extended for custom timeout handling
    return new ClaudeConverter();
  }
}

/**
 * Global Claude converter instance
 */
export const claudeConverter = ClaudeConverterFactory.create();