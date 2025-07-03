/**
 * Streaming Response Models for OpenAI Chat Completions API
 * Based on Python models.py:131-143 (StreamChoice, ChatCompletionStreamResponse)
 * Provides complete OpenAI-compatible streaming structure with Zod validation
 */

import { z } from 'zod';

/**
 * Stream choice schema for streaming chat completion response
 * Based on Python StreamChoice class
 */
export const StreamChoiceSchema = z.object({
  index: z.number().int().nonnegative(),
  delta: z.record(z.string(), z.any()),
  finish_reason: z.enum(["stop", "length", "content_filter", "null"]).nullable().optional()
});

export type StreamChoice = z.infer<typeof StreamChoiceSchema>;

/**
 * Chat completion streaming response schema
 * Based on Python ChatCompletionStreamResponse class
 */
export const ChatCompletionStreamResponseSchema = z.object({
  id: z.string().default(() => `chatcmpl-${generateStreamId()}`),
  object: z.literal("chat.completion.chunk").default("chat.completion.chunk"),
  created: z.number().int().default(() => Math.floor(Date.now() / 1000)),
  model: z.string(),
  choices: z.array(StreamChoiceSchema),
  system_fingerprint: z.string().optional()
});

export type ChatCompletionStreamResponse = z.infer<typeof ChatCompletionStreamResponseSchema>;

/**
 * Common delta types for streaming
 */
export const StreamDeltaTypes = {
  /**
   * Delta with role (first chunk)
   */
  role: (role: "assistant"): StreamChoice['delta'] => ({
    role
  }),

  /**
   * Delta with content (content chunks)
   */
  content: (content: string): StreamChoice['delta'] => ({
    content
  }),

  /**
   * Empty delta (final chunk)
   */
  empty: (): StreamChoice['delta'] => ({})
};

/**
 * Streaming utilities
 */
export const StreamingUtils = {
  /**
   * Create initial streaming response chunk (with role)
   */
  createInitialChunk: (
    id: string,
    model: string,
    role: "assistant" = "assistant"
  ): ChatCompletionStreamResponse => ({
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      delta: StreamDeltaTypes.role(role),
      finish_reason: null
    }],
    system_fingerprint: undefined
  }),

  /**
   * Create content streaming chunk
   */
  createContentChunk: (
    id: string,
    model: string,
    content: string
  ): ChatCompletionStreamResponse => ({
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      delta: StreamDeltaTypes.content(content),
      finish_reason: null
    }],
    system_fingerprint: undefined
  }),

  /**
   * Create final streaming chunk (with finish_reason)
   */
  createFinalChunk: (
    id: string,
    model: string,
    finishReason: StreamChoice['finish_reason'] = "stop"
  ): ChatCompletionStreamResponse => ({
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      delta: StreamDeltaTypes.empty(),
      finish_reason: finishReason
    }],
    system_fingerprint: undefined
  }),

  /**
   * Create streaming response from content string
   */
  createStreamFromContent: function* (
    content: string,
    model: string,
    chunkSize: number = 50
  ): Generator<ChatCompletionStreamResponse> {
    const id = `chatcmpl-${generateStreamId()}`;
    
    // Initial chunk with role
    yield this.createInitialChunk(id, model);
    
    // Content chunks
    for (let i = 0; i < content.length; i += chunkSize) {
      const chunk = content.slice(i, i + chunkSize);
      yield this.createContentChunk(id, model, chunk);
    }
    
    // Final chunk
    yield this.createFinalChunk(id, model);
  },

  /**
   * Convert streaming response to Server-Sent Events format
   */
  toSSE: (chunk: ChatCompletionStreamResponse): string => {
    const data = JSON.stringify(chunk);
    return `data: ${data}\n\n`;
  },

  /**
   * Create done event for SSE
   */
  createDoneEvent: (): string => {
    return "data: [DONE]\n\n";
  },

  /**
   * Validate streaming response
   */
  validateStreamResponse: (response: unknown): ChatCompletionStreamResponse => {
    return ChatCompletionStreamResponseSchema.parse(response);
  }
};

/**
 * Generate unique ID for streaming chat completion
 */
function generateStreamId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Streaming error types
 */
export class StreamingError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'StreamingError';
  }
}

export class StreamProcessingError extends StreamingError {
  constructor(message: string) {
    super(message, 'STREAM_PROCESSING_ERROR');
  }
}

export class StreamValidationError extends StreamingError {
  constructor(message: string) {
    super(message, 'STREAM_VALIDATION_ERROR');
  }
}
