/**
 * Message service implementation
 * Business logic for message processing
 * Based on Python message_adapter.py approach exactly
 */

import { Message, MessageValidation } from '../models/message';
import { getLogger } from '../utils/logger';

const logger = getLogger('MessageService');

export class MessageService {
  /**
   * Convert OpenAI messages to Claude Code prompt format
   * Based on Python MessageAdapter.messages_to_prompt
   * Returns prompt and system_prompt
   */
  async convertToClaudeFormat(messages: Message[]): Promise<{ prompt: string; systemPrompt?: string }> {
    try {
      let systemPrompt: string | undefined;
      const conversationParts: string[] = [];

      for (const message of messages) {
        // Validate message structure
        const validatedMessage = MessageValidation.validateMessage(message);
        const content = MessageValidation.extractText(validatedMessage);

        if (validatedMessage.role === 'system') {
          // Use the last system message as the system prompt
          systemPrompt = content;
        } else if (validatedMessage.role === 'user') {
          conversationParts.push(`Human: ${content}`);
        } else if (validatedMessage.role === 'assistant') {
          conversationParts.push(`Assistant: ${content}`);
        }
      }

      // Join conversation parts
      let prompt = conversationParts.join('\n\n');

      // If the last message wasn't from the user, add a prompt for assistant
      if (messages.length > 0 && messages[messages.length - 1].role !== 'user') {
        prompt += '\n\nHuman: Please continue.';
      }

      logger.debug('Converted messages to Claude format', {
        messageCount: messages.length,
        promptLength: prompt.length,
        hasSystemPrompt: !!systemPrompt
      });

      return { prompt, systemPrompt };
    } catch (error) {
      logger.error('Failed to convert messages to Claude format', { error });
      throw new Error(`Message conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Filter content for unsupported features and tool usage
   * Based on Python MessageAdapter.filter_content
   */
  async filterContent(content: string): Promise<string> {
    if (!content) {
      return content;
    }

    try {
      let filteredContent = content;

      // Remove thinking blocks (common when tools are disabled but Claude tries to think)
      const thinkingPattern = /<thinking>.*?<\/thinking>/gs;
      filteredContent = filteredContent.replace(thinkingPattern, '');

      // Extract content from attempt_completion blocks (these contain the actual user response)
      const attemptCompletionPattern = /<attempt_completion>(.*?)<\/attempt_completion>/gs;
      const attemptMatches = [...filteredContent.matchAll(attemptCompletionPattern)];
      
      if (attemptMatches.length > 0) {
        // Use the content from the attempt_completion block
        let extractedContent = attemptMatches[0][1].trim();

        // If there's a <result> tag inside, extract from that
        const resultPattern = /<result>(.*?)<\/result>/gs;
        const resultMatches = [...extractedContent.matchAll(resultPattern)];
        
        if (resultMatches.length > 0) {
          extractedContent = resultMatches[0][1].trim();
        }

        if (extractedContent) {
          filteredContent = extractedContent;
        }
      } else {
        // Remove other tool usage blocks (when tools are disabled but Claude tries to use them)
        const toolPatterns = [
          /<read_file>.*?<\/read_file>/gs,
          /<write_file>.*?<\/write_file>/gs,
          /<bash>.*?<\/bash>/gs,
          /<search_files>.*?<\/search_files>/gs,
          /<str_replace_editor>.*?<\/str_replace_editor>/gs,
          /<args>.*?<\/args>/gs,
          /<ask_followup_question>.*?<\/ask_followup_question>/gs,
          /<attempt_completion>.*?<\/attempt_completion>/gs,
          /<question>.*?<\/question>/gs,
          /<follow_up>.*?<\/follow_up>/gs,
          /<suggest>.*?<\/suggest>/gs
        ];

        for (const pattern of toolPatterns) {
          filteredContent = filteredContent.replace(pattern, '');
        }
      }

      // Pattern to match image references or base64 data
      const imagePattern = /\[Image:.*?\]|data:image\/.*?;base64,.*?(?=\s|$)/g;
      filteredContent = filteredContent.replace(imagePattern, '[Image: Content not supported by Claude Code]');

      // Clean up extra whitespace and newlines
      filteredContent = filteredContent.replace(/\n\s*\n\s*\n/g, '\n\n'); // Multiple newlines to double
      filteredContent = filteredContent.trim();

      // If content is now empty or only whitespace, provide a fallback
      if (!filteredContent || /^\s*$/.test(filteredContent)) {
        filteredContent = "I understand you're testing the system. How can I help you today?";
      }

      logger.debug('Content filtered', {
        originalLength: content.length,
        filteredLength: filteredContent.length,
        hasChanges: content !== filteredContent
      });

      return filteredContent;
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
