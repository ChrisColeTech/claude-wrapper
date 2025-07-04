/**
 * Message service implementation
 * Business logic for message processing
 * Updated for Phase 2A: Uses new message converters
 */

import { Message, MessageValidation } from '../models/message';
import { claudeConverter } from '../message/claude-converter';
import { contentFilter } from '../message/message-parser';
import { ClaudeConversionResult } from '../message/interfaces';
import { getLogger } from '../utils/logger';

const logger = getLogger('MessageService');

export class MessageService {
  /**
   * Convert OpenAI messages to Claude Code prompt format
   * Phase 2A: Uses new ClaudeConverter with proper error handling
   * Returns prompt and system_prompt
   */
  async convertToClaudeFormat(messages: Message[]): Promise<{ prompt: string; systemPrompt?: string }> {
    try {
      // Use new Claude converter from Phase 2A
      const result: ClaudeConversionResult = await claudeConverter.convert(messages);

      logger.debug('Converted messages to Claude format using new converter', {
        messageCount: messages.length,
        promptLength: result.prompt.length,
        hasSystemPrompt: !!result.systemPrompt
      });

      return { 
        prompt: result.prompt, 
        systemPrompt: result.systemPrompt 
      };
    } catch (error) {
      logger.error('Failed to convert messages to Claude format', { error });
      throw new Error(`Message conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Filter content for unsupported features and tool usage
   * Phase 2A: Uses new ContentFilter with enhanced filtering
   */
  async filterContent(content: string): Promise<string> {
    if (!content) {
      return content;
    }

    try {
      // Use new content filter from Phase 2A
      const filterResult = await contentFilter.filter(content);

      logger.debug('Content filtered using new filter', {
        originalLength: content.length,
        filteredLength: filterResult.content.length,
        wasFiltered: filterResult.wasFiltered,
        filtersApplied: filterResult.filtersApplied,
        processingTimeMs: filterResult.processingTimeMs
      });

      return filterResult.content;
    } catch (error) {
      logger.error('Failed to filter content', { error, contentLength: content.length });
      return content; // Return original content on error
    }
  }

  /**
   * Estimate token count from text
   * Based on Python MessageAdapter.estimate_tokens
   * OpenAI's rule of thumb: ~4 characters per token for English text
   */
  estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Format Claude response for OpenAI compatibility
   * Based on Python MessageAdapter.format_claude_response
   */
  formatClaudeResponse(content: string, model: string, finishReason: string = 'stop'): {
    role: 'assistant';
    content: string;
    finish_reason: string;
    model: string;
  } {
    return {
      role: 'assistant',
      content,
      finish_reason: finishReason,
      model
    };
  }

  /**
   * Process message with validation and error handling
   * Wrapper for common message processing operations
   */
  async processMessage(message: any): Promise<Message> {
    try {
      const validatedMessage = MessageValidation.validateMessage(message);
      
      logger.debug('Message processed', {
        role: validatedMessage.role,
        contentLength: typeof validatedMessage.content === 'string' 
          ? validatedMessage.content.length 
          : validatedMessage.content.length,
        hasName: !!validatedMessage.name
      });

      return validatedMessage;
    } catch (error) {
      logger.error('Failed to process message', { error, message });
      throw new Error(`Message processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate and normalize a batch of messages
   * Ensures all messages meet Claude Code requirements
   */
  async processMessages(messages: any[]): Promise<Message[]> {
    try {
      const processedMessages = await Promise.all(
        messages.map(message => this.processMessage(message))
      );

      logger.debug('Messages batch processed', {
        count: processedMessages.length,
        roles: processedMessages.map(m => m.role)
      });

      return processedMessages;
    } catch (error) {
      logger.error('Failed to process messages batch', { error, messageCount: messages.length });
      throw new Error(`Messages batch processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
