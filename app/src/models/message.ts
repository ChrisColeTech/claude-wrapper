/**
 * Message Models for OpenAI Chat Completions API
 * Based on Python models.py:10-36 (ContentPart, Message)
 * Provides complete OpenAI-compatible message structure with Zod validation
 */

import { z } from 'zod';

/**
 * Content part for multimodal messages (OpenAI format)
 * Based on Python ContentPart class
 */
export const ContentPartSchema = z.object({
  type: z.literal("text"),
  text: z.string()
});

export type ContentPart = z.infer<typeof ContentPartSchema>;

/**
 * Tool call schema for OpenAI assistant messages
 */
export const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string()
  })
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

/**
 * Message schema with role, content, and optional name
 * Based on Python Message class with content normalization
 * Phase 9A: Added tool role and tool_call_id for tool message processing
 */
export const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.union([
    z.string(),
    z.array(ContentPartSchema)
  ]),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(ToolCallSchema).optional()
}).transform((data) => {
  // Convert array content to string for Claude Code compatibility
  // Replicates Python Message.normalize_content validator
  if (Array.isArray(data.content)) {
    const textParts: string[] = [];
    
    for (const part of data.content) {
      if (part.type === "text") {
        textParts.push(part.text);
      }
    }
    
    return {
      ...data,
      content: textParts.length > 0 ? textParts.join("\n") : ""
    };
  }
  
  return data;
});

export type Message = z.infer<typeof MessageSchema>;

/**
 * Message creation helper functions
 */
export const MessageHelpers = {
  /**
   * Create a system message
   */
  system: (content: string): Message => ({
    role: "system",
    content
  }),

  /**
   * Create a user message
   */
  user: (content: string | ContentPart[]): Message => ({
    role: "user",
    content
  }),

  /**
   * Create an assistant message
   */
  assistant: (content: string): Message => ({
    role: "assistant",
    content
  }),

  /**
   * Create a tool message (Phase 9A)
   */
  tool: (content: string, toolCallId: string): Message => ({
    role: "tool",
    content,
    tool_call_id: toolCallId
  }),

  /**
   * Create a multimodal message with text parts
   */
  multimodal: (role: "user" | "assistant", textParts: string[]): Message => ({
    role,
    content: textParts.map(text => ({ type: "text" as const, text }))
  })
};

/**
 * Message validation utilities
 */
export const MessageValidation = {
  /**
   * Validate a single message
   */
  validateMessage: (message: unknown): Message => {
    return MessageSchema.parse(message);
  },

  /**
   * Validate an array of messages
   */
  validateMessages: (messages: unknown[]): Message[] => {
    return messages.map(msg => MessageSchema.parse(msg));
  },

  /**
   * Check if content is multimodal
   */
  isMultimodal: (content: Message['content']): content is ContentPart[] => {
    return Array.isArray(content);
  },

  /**
   * Extract text content from message
   */
  extractText: (message: Message): string => {
    if (typeof message.content === 'string') {
      return message.content;
    }
    
    // Should not happen after transform, but handle gracefully
    return message.content.map(part => part.text).join('\n');
  },

  /**
   * Validate tool message (Phase 9A)
   */
  isValidToolMessage: (message: Message): boolean => {
    return message.role === 'tool' && Boolean(message.tool_call_id);
  },

  /**
   * Check if message is a tool message (Phase 9A)
   */
  isToolMessage: (message: Message): boolean => {
    return message.role === 'tool';
  }
};
