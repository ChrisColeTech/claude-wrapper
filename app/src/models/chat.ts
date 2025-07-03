/**
 * Chat Completion Models for OpenAI Chat Completions API
 * Based on Python models.py:39-128 (ChatCompletionRequest, Choice, Usage, ChatCompletionResponse)
 * Provides complete OpenAI-compatible chat completion structure with Zod validation
 */

import { z } from 'zod';
import { MessageSchema } from './message';
import { getLogger } from '../utils/logger';

const logger = getLogger('ChatModels');

/**
 * Chat completion request schema
 * Based on Python ChatCompletionRequest class
 */
export const ChatCompletionRequestSchema = z.object({
  model: z.string(),
  messages: z.array(MessageSchema),
  temperature: z.number().min(0).max(2).default(1.0),
  top_p: z.number().min(0).max(1).default(1.0),
  n: z.number().int().min(1).default(1),
  stream: z.boolean().default(false),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  max_tokens: z.number().int().min(0).optional(),
  presence_penalty: z.number().min(-2).max(2).default(0),
  frequency_penalty: z.number().min(-2).max(2).default(0),
  logit_bias: z.record(z.string(), z.number()).optional(),
  user: z.string().optional(),
  session_id: z.string().optional().describe("Optional session ID for conversation continuity"),
  enable_tools: z.boolean().default(false).describe("Enable Claude Code tools (Read, Write, Bash, etc.) - disabled by default for OpenAI compatibility")
}).refine((data) => {
  // Validate n parameter (Claude Code SDK only supports single response)
  if (data.n > 1) {
    throw new Error("Claude Code SDK does not support multiple choices (n > 1). Only single response generation is supported.");
  }
  return true;
});

export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>;

/**
 * Log warnings for unsupported parameters (Python compatibility)
 */
export function logUnsupportedParameters(data: ChatCompletionRequest): void {
  const warnings: string[] = [];
  
  if (data.temperature !== 1.0) {
    warnings.push(`temperature=${data.temperature} is not supported by Claude Code SDK and will be ignored`);
  }
  
  if (data.top_p !== 1.0) {
    warnings.push(`top_p=${data.top_p} is not supported by Claude Code SDK and will be ignored`);
  }
  
  if (data.max_tokens !== undefined) {
    warnings.push(`max_tokens=${data.max_tokens} is not supported by Claude Code SDK and will be ignored. Consider using max_turns to limit conversation length`);
  }
  
  if (data.presence_penalty !== 0) {
    warnings.push(`presence_penalty=${data.presence_penalty} is not supported by Claude Code SDK and will be ignored`);
  }
  
  if (data.frequency_penalty !== 0) {
    warnings.push(`frequency_penalty=${data.frequency_penalty} is not supported by Claude Code SDK and will be ignored`);
  }
  
  if (data.logit_bias) {
    warnings.push(`logit_bias is not supported by Claude Code SDK and will be ignored`);
  }
  
  if (data.stop) {
    warnings.push(`stop sequences are not supported by Claude Code SDK and will be ignored`);
  }
  
  // Log all warnings
  for (const warning of warnings) {
    logger.warn(`OpenAI API compatibility: ${warning}`);
  }
}

/**
 * Choice schema for chat completion response
 * Based on Python Choice class
 */
export const ChoiceSchema = z.object({
  index: z.number().int().nonnegative(),
  message: MessageSchema,
  finish_reason: z.enum(["stop", "length", "content_filter", "null"]).nullable().optional()
});

export type Choice = z.infer<typeof ChoiceSchema>;

/**
 * Usage schema for token counting
 * Based on Python Usage class
 */
export const UsageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative()
});

export type Usage = z.infer<typeof UsageSchema>;

/**
 * Chat completion response schema
 * Based on Python ChatCompletionResponse class
 */
export const ChatCompletionResponseSchema = z.object({
  id: z.string().default(() => `chatcmpl-${generateId()}`),
  object: z.literal("chat.completion").default("chat.completion"),
  created: z.number().int().default(() => Math.floor(Date.now() / 1000)),
  model: z.string(),
  choices: z.array(ChoiceSchema),
  usage: UsageSchema.optional(),
  system_fingerprint: z.string().optional()
});

export type ChatCompletionResponse = z.infer<typeof ChatCompletionResponseSchema>;

/**
 * Chat completion utilities
 */
export const ChatCompletionUtils = {
  /**
   * Convert request to Claude Code SDK options
   * Based on Python ChatCompletionRequest.to_claude_options
   */
  toClaudeOptions: (request: ChatCompletionRequest): Record<string, any> => {
    const options: Record<string, any> = {};
    
    // Direct mappings
    if (request.model) {
      options.model = request.model;
    }
    
    // Use user field for session identification if provided
    if (request.user) {
      logger.info(`Request from user: ${request.user}`);
    }
    
    return options;
  },

  /**
   * Create a basic chat completion response
   */
  createResponse: (
    model: string,
    content: string,
    usage?: Usage,
    finishReason: Choice['finish_reason'] = "stop"
  ): ChatCompletionResponse => {
    const choice: Choice = {
      index: 0,
      message: {
        role: "assistant",
        content
      },
      finish_reason: finishReason
    };

    return {
      id: `chatcmpl-${generateId()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [choice],
      usage,
      system_fingerprint: undefined
    };
  },

  /**
   * Create usage information from token counts
   */
  createUsage: (promptTokens: number, completionTokens: number): Usage => ({
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens
  }),

  /**
   * Validate chat completion request
   */
  validateRequest: (request: unknown): ChatCompletionRequest => {
    return ChatCompletionRequestSchema.parse(request);
  },

  /**
   * Validate chat completion response
   */
  validateResponse: (response: unknown): ChatCompletionResponse => {
    return ChatCompletionResponseSchema.parse(response);
  }
};

/**
 * Generate unique ID for chat completion
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}
