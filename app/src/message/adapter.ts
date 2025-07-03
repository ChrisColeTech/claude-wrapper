/**
 * Message Adapter for OpenAI to Claude Format Conversion
 * Based on Python message_adapter.py:6-34 (MessageAdapter class)
 * Converts between OpenAI message format and Claude Code prompts
 */

import { Message, MessageValidation } from '../models/message';
import { getLogger } from '../utils/logger';

const logger = getLogger('MessageAdapter');

/**
 * Result of message conversion to Claude format
 */
export interface MessageConversionResult {
  prompt: string;
  systemPrompt: string | null;
}

/**
 * MessageAdapter class for converting OpenAI messages to Claude Code format
 * Based on Python MessageAdapter class
 */
export class MessageAdapter {
  /**
   * Convert OpenAI messages to Claude Code prompt format
   * Based on Python messages_to_prompt method (lines 10-34)
   * 
   * @param messages Array of OpenAI format messages
   * @returns Object with prompt and systemPrompt
   */
  static messagesToPrompt(messages: Message[]): MessageConversionResult {
    let systemPrompt: string | null = null;
    const conversationParts: string[] = [];
    
    for (const message of messages) {
      // Extract text content (handles both string and array content)
      const textContent = MessageValidation.extractText(message);
      
      if (message.role === "system") {
        // Use the last system message as the system prompt
        systemPrompt = textContent;
      } else if (message.role === "user") {
        conversationParts.push(`Human: ${textContent}`);
      } else if (message.role === "assistant") {
        conversationParts.push(`Assistant: ${textContent}`);
      }
    }
    
    // Join conversation parts
    let prompt = conversationParts.join("\n\n");
    
    // If there are conversation parts and the last message wasn't from the user, add a prompt for assistant
    if (conversationParts.length > 0 && messages.length > 0 && messages[messages.length - 1].role !== "user") {
      prompt += "\n\nHuman: Please continue.";
    }
    
    logger.debug(`Converted ${messages.length} messages to Claude format`, {
      messageCount: messages.length,
      hasSystemPrompt: systemPrompt !== null,
      promptLength: prompt.length
    });
    
    return {
      prompt,
      systemPrompt
    };
  }
  
  /**
   * Legacy method for backward compatibility
   * @deprecated Use messagesToPrompt instead
   */
  static convertToClaudeFormat(messages: Message[]): string {
    const result = this.messagesToPrompt(messages);
    return result.prompt;
  }
  
  /**
   * Legacy method for backward compatibility
   * @deprecated Use messagesToPrompt instead
   */
  static extractSystemPrompt(messages: Message[]): string | null {
    const result = this.messagesToPrompt(messages);
    return result.systemPrompt;
  }
  
  /**
   * Format Claude response for OpenAI compatibility
   * Based on Python format_claude_response method (lines 102-109)
   * 
   * @param content Response content from Claude
   * @param model Model used for the response
   * @param finishReason Reason for completion finishing
   * @returns OpenAI compatible response object
   */
  static formatClaudeResponse(
    content: string,
    model: string,
    finishReason: string = "stop"
  ): {
    role: "assistant";
    content: string;
    finish_reason: string;
    model: string;
  } {
    return {
      role: "assistant",
      content,
      finish_reason: finishReason,
      model
    };
  }
  
  /**
   * Validate that messages array is not empty and ends with user message
   * This ensures proper conversation flow for Claude
   * 
   * @param messages Array of messages to validate
   * @returns True if valid, false otherwise
   */
  static validateMessageFlow(messages: Message[]): boolean {
    if (messages.length === 0) {
      logger.warn('Message validation failed: empty message array');
      return false;
    }
    
    // Find the last non-system message
    const lastNonSystemMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.role !== 'system');
    
    if (!lastNonSystemMessage) {
      logger.warn('Message validation failed: no non-system messages found');
      return false;
    }
    
    if (lastNonSystemMessage.role !== 'user') {
      logger.warn('Message validation failed: last message is not from user', {
        lastMessageRole: lastNonSystemMessage.role
      });
      return false;
    }
    
    return true;
  }
  
  /**
   * Count messages by role for analytics
   * 
   * @param messages Array of messages to analyze
   * @returns Object with count for each role
   */
  static analyzeMessages(messages: Message[]): {
    system: number;
    user: number;
    assistant: number;
    total: number;
  } {
    const counts = { system: 0, user: 0, assistant: 0, total: messages.length };
    
    for (const message of messages) {
      counts[message.role]++;
    }
    
    return counts;
  }
}
