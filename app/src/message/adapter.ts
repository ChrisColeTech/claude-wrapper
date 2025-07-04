/**
 * Message Adapter for OpenAI to Claude Format Conversion
 * Based on Python message_adapter.py:6-34 (MessageAdapter class)
 * Converts between OpenAI message format and Claude Code prompts
 */

import { Message, MessageValidation } from "../models/message";
import { getLogger } from "../utils/logger";
import { MESSAGE_ROLES } from "../tools/constants";

const logger = getLogger("MessageAdapter");

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
      } else if (message.role === "tool") {
        // Phase 9A: Handle tool messages in conversation flow
        this.handleToolMessage(message, conversationParts);
      }
    }

    // Join conversation parts
    let prompt = conversationParts.join("\n\n");

    // If there are conversation parts and the last message wasn't from the user, add a prompt for assistant
    if (
      conversationParts.length > 0 &&
      messages.length > 0 &&
      messages[messages.length - 1].role !== "user"
    ) {
      prompt += "\n\nHuman: Please continue.";
    }

    logger.debug(`Converted ${messages.length} messages to Claude format`, {
      messageCount: messages.length,
      hasSystemPrompt: systemPrompt !== null,
      promptLength: prompt.length,
    });

    return {
      prompt,
      systemPrompt,
    };
  }

  /**
   * Convert OpenAI messages to Claude prompt string
   * For Claude Code SDK integration
   */
  convertToClaudePrompt(messages: Message[]): string {
    const result = MessageAdapter.messagesToPrompt(messages);
    return result.prompt;
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
      model,
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
      logger.warn("Message validation failed: empty message array");
      return false;
    }

    // Find the last non-system message
    const lastNonSystemMessage = messages
      .slice()
      .reverse()
      .find((msg) => msg.role !== "system");

    if (!lastNonSystemMessage) {
      logger.warn("Message validation failed: no non-system messages found");
      return false;
    }

    if (lastNonSystemMessage.role !== "user") {
      logger.warn("Message validation failed: last message is not from user", {
        lastMessageRole: lastNonSystemMessage.role,
      });
      return false;
    }

    return true;
  }

  /**
   * Count messages by role for analytics
   * Phase 9A: Updated to include tool messages
   *
   * @param messages Array of messages to analyze
   * @returns Object with count for each role
   */
  static analyzeMessages(messages: Message[]): {
    system: number;
    user: number;
    assistant: number;
    tool: number;
    total: number;
  } {
    const counts = {
      system: 0,
      user: 0,
      assistant: 0,
      tool: 0,
      total: messages.length,
    };

    for (const message of messages) {
      if (message.role === MESSAGE_ROLES.SYSTEM) counts.system++;
      else if (message.role === MESSAGE_ROLES.USER) counts.user++;
      else if (message.role === MESSAGE_ROLES.ASSISTANT) counts.assistant++;
      else if (message.role === MESSAGE_ROLES.TOOL) counts.tool++;
    }

    return {
      system: counts.system,
      user: counts.user,
      assistant: counts.assistant,
      tool: counts.tool,
      total: counts.total,
    };
  }

  /**
   * Handle tool message in conversation flow (Phase 9A)
   * Tool messages represent results from tool executions
   *
   * @param message Tool message to handle
   * @param conversationParts Array to append formatted message to
   */
  private static handleToolMessage(
    message: Message,
    conversationParts: string[]
  ): void {
    if (!message.tool_call_id) {
      logger.warn("Tool message missing tool_call_id, skipping", {
        messageRole: message.role,
      });
      return;
    }

    const textContent = MessageValidation.extractText(message);

    // Format tool result for Claude Code SDK
    // Tools results are presented as system information about tool execution
    const toolResult = `System: Tool execution result (ID: ${message.tool_call_id}): ${textContent}`;

    conversationParts.push(toolResult);

    logger.debug("Processed tool message in conversation flow", {
      toolCallId: message.tool_call_id,
      contentLength: textContent.length,
    });
  }

  /**
   * Filter messages to include only tool messages (Phase 9A)
   *
   * @param messages Array of messages to filter
   * @returns Array containing only tool messages
   */
  static filterToolMessages(messages: Message[]): Message[] {
    return messages.filter((msg) => msg.role === MESSAGE_ROLES.TOOL);
  }

  /**
   * Validate tool messages have required fields (Phase 9A)
   *
   * @param messages Array of messages to validate
   * @returns True if all tool messages are valid
   */
  static validateToolMessages(messages: Message[]): boolean {
    const toolMessages = this.filterToolMessages(messages);

    for (const message of toolMessages) {
      if (!MessageValidation.isValidToolMessage(message)) {
        logger.warn("Invalid tool message found", {
          messageRole: message.role,
          hasToolCallId: Boolean(message.tool_call_id),
          hasContent: Boolean(message.content),
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Extract tool call IDs from tool messages (Phase 9A)
   *
   * @param messages Array of messages to extract from
   * @returns Array of tool call IDs from tool messages
   */
  static extractToolCallIds(messages: Message[]): string[] {
    return this.filterToolMessages(messages)
      .map((msg) => msg.tool_call_id)
      .filter((id): id is string => Boolean(id));
  }
}
