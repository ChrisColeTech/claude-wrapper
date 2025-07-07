/**
 * Streaming Tool Calls - Handles real-time streaming of tool calls
 * Single Responsibility: Stream tool calls in real-time as they're generated
 * 
 * Based on OpenAI Tools API Implementation Plan
 */

import { OpenAIToolCall } from '../types';
import { GeneratedToolCall } from './tool-call-generator';
import { OpenAIStreamingChunk, OpenAIFormatter } from './openai-formatter';
import { getLogger } from '../../utils/logger';

const logger = getLogger('streaming-tool-calls');

/**
 * Streaming chunk generator for tool calls
 */
export interface ToolCallStreamChunk {
  /** Type of chunk */
  type: 'role' | 'tool_call_start' | 'tool_call_arguments' | 'tool_call_complete' | 'done';
  
  /** Tool call index for this chunk */
  toolIndex?: number;
  
  /** Chunk data */
  data: any;
  
  /** Whether this is the final chunk */
  final: boolean;
}

/**
 * Configuration for streaming tool calls
 */
export interface StreamingToolCallsConfig {
  /** Chunk size for arguments streaming */
  argumentChunkSize?: number;
  
  /** Delay between chunks (ms) for simulation */
  chunkDelay?: number;
  
  /** Whether to enable progressive argument streaming */
  progressiveArguments?: boolean;
  
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Streaming Tool Calls Handler - Streams tool calls in real-time
 * 
 * Architecture:
 * - SRP: Single responsibility for streaming tool calls
 * - Generator Pattern: Uses async generators for streaming
 * - Chunk Management: Proper SSE formatting for tool calls
 */
export class StreamingToolCalls {
  private readonly formatter: OpenAIFormatter;
  private readonly config: Required<StreamingToolCallsConfig>;

  constructor(
    config: StreamingToolCallsConfig = {},
    formatter?: OpenAIFormatter
  ) {
    this.config = {
      argumentChunkSize: config.argumentChunkSize ?? 20,
      chunkDelay: config.chunkDelay ?? 50,
      progressiveArguments: config.progressiveArguments ?? true,
      debug: config.debug ?? false,
    };

    this.formatter = formatter ?? new OpenAIFormatter();

    if (this.config.debug) {
      logger.debug('StreamingToolCalls initialized', { config: this.config });
    }
  }

  /**
   * Stream tool calls as OpenAI-compatible chunks
   * 
   * @param toolCalls - Tool calls to stream
   * @param model - Model name for responses
   * @param responseId - Unique response ID
   * @yields OpenAI streaming chunks
   */
  async* streamToolCalls(
    toolCalls: GeneratedToolCall[],
    model: string,
    responseId?: string
  ): AsyncGenerator<OpenAIStreamingChunk, void, unknown> {
    const validToolCalls = toolCalls.filter(tc => tc.validationErrors.length === 0);
    const id = responseId || this.generateResponseId();
    const created = Math.floor(Date.now() / 1000);

    if (validToolCalls.length === 0) {
      if (this.config.debug) {
        logger.debug('No valid tool calls to stream');
      }
      return;
    }

    if (this.config.debug) {
      logger.debug('Starting tool call streaming', {
        toolCallCount: validToolCalls.length,
        responseId: id
      });
    }

    // Initial chunk with assistant role
    yield {
      id,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{
        index: 0,
        delta: { role: 'assistant' },
        finish_reason: null
      }]
    };

    if (this.config.chunkDelay > 0) {
      await this.delay(this.config.chunkDelay);
    }

    // Stream each tool call
    for (let toolIndex = 0; toolIndex < validToolCalls.length; toolIndex++) {
      const toolCall = validToolCalls[toolIndex];
      
      yield* this.streamSingleToolCall(
        toolCall.toolCall,
        toolIndex,
        id,
        created,
        model
      );
    }

    // Final chunk with finish_reason
    yield {
      id,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'tool_calls'
      }]
    };

    if (this.config.debug) {
      logger.debug('Tool call streaming completed', { responseId: id });
    }
  }

  /**
   * Stream a single tool call with progressive argument building
   * 
   * @param toolCall - Tool call to stream
   * @param toolIndex - Index of this tool call
   * @param responseId - Response ID
   * @param created - Creation timestamp
   * @param model - Model name
   * @yields OpenAI streaming chunks for this tool call
   */
  async* streamSingleToolCall(
    toolCall: OpenAIToolCall,
    toolIndex: number,
    responseId: string,
    created: number,
    model: string
  ): AsyncGenerator<OpenAIStreamingChunk, void, unknown> {
    // Tool call start chunk (id, type, function name)
    yield {
      id: responseId,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{
        index: 0,
        delta: {
          tool_calls: [{
            index: toolIndex,
            id: toolCall.id,
            type: 'function',
            function: { name: toolCall.function.name }
          }]
        },
        finish_reason: null
      }]
    };

    if (this.config.chunkDelay > 0) {
      await this.delay(this.config.chunkDelay);
    }

    // Stream arguments progressively if enabled
    if (this.config.progressiveArguments) {
      yield* this.streamArguments(
        toolCall.function.arguments,
        toolIndex,
        responseId,
        created,
        model
      );
    } else {
      // Send all arguments at once
      yield {
        id: responseId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{
          index: 0,
          delta: {
            tool_calls: [{
              index: toolIndex,
              function: { arguments: toolCall.function.arguments }
            }]
          },
          finish_reason: null
        }]
      };
    }
  }

  /**
   * Stream tool call arguments in progressive chunks
   * 
   * @param arguments_ - JSON arguments string
   * @param toolIndex - Tool call index
   * @param responseId - Response ID
   * @param created - Creation timestamp
   * @param model - Model name
   * @yields Argument chunks
   */
  async* streamArguments(
    arguments_: string,
    toolIndex: number,
    responseId: string,
    created: number,
    model: string
  ): AsyncGenerator<OpenAIStreamingChunk, void, unknown> {
    const chunkSize = this.config.argumentChunkSize;
    
    for (let i = 0; i < arguments_.length; i += chunkSize) {
      const argumentChunk = arguments_.slice(i, i + chunkSize);
      
      yield {
        id: responseId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{
          index: 0,
          delta: {
            tool_calls: [{
              index: toolIndex,
              function: { arguments: argumentChunk }
            }]
          },
          finish_reason: null
        }]
      };

      // Add delay between argument chunks for realistic streaming
      if (this.config.chunkDelay > 0 && i + chunkSize < arguments_.length) {
        await this.delay(this.config.chunkDelay);
      }
    }
  }

  /**
   * Create a mixed stream that includes both text and tool calls
   * 
   * @param textContent - Text content to stream first
   * @param toolCalls - Tool calls to stream after text
   * @param model - Model name
   * @param responseId - Response ID
   * @yields Mixed content stream
   */
  async* streamMixedContent(
    textContent: string,
    toolCalls: GeneratedToolCall[],
    model: string,
    responseId?: string
  ): AsyncGenerator<OpenAIStreamingChunk, void, unknown> {
    const id = responseId || this.generateResponseId();
    const created = Math.floor(Date.now() / 1000);

    if (this.config.debug) {
      logger.debug('Starting mixed content streaming', {
        textLength: textContent.length,
        toolCallCount: toolCalls.length
      });
    }

    // Initial role chunk
    yield {
      id,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{
        index: 0,
        delta: { role: 'assistant' },
        finish_reason: null
      }]
    };

    // Stream text content first if present
    if (textContent) {
      yield* this.streamTextContent(textContent, id, created, model);
    }

    // Stream tool calls if present
    if (toolCalls.length > 0) {
      const validToolCalls = toolCalls.filter(tc => tc.validationErrors.length === 0);
      
      for (let toolIndex = 0; toolIndex < validToolCalls.length; toolIndex++) {
        yield* this.streamSingleToolCall(
          validToolCalls[toolIndex].toolCall,
          toolIndex,
          id,
          created,
          model
        );
      }

      // Finish with tool_calls reason
      yield {
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'tool_calls'
        }]
      };
    } else {
      // Finish with stop reason for text-only
      yield {
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }]
      };
    }
  }

  /**
   * Stream text content in chunks
   */
  private async* streamTextContent(
    content: string,
    responseId: string,
    created: number,
    model: string
  ): AsyncGenerator<OpenAIStreamingChunk, void, unknown> {
    const words = content.split(' ');
    const wordsPerChunk = Math.max(1, Math.floor(words.length / 10));

    for (let i = 0; i < words.length; i += wordsPerChunk) {
      const wordChunk = words.slice(i, i + wordsPerChunk).join(' ');
      const contentChunk = i === 0 ? wordChunk : ' ' + wordChunk;

      yield {
        id: responseId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{
          index: 0,
          delta: { content: contentChunk },
          finish_reason: null
        }]
      };

      if (this.config.chunkDelay > 0 && i + wordsPerChunk < words.length) {
        await this.delay(this.config.chunkDelay);
      }
    }
  }

  /**
   * Delay utility for chunk timing
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate a unique response ID
   */
  private generateResponseId(): string {
    return `chatcmpl-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get streaming configuration
   */
  getConfig(): StreamingToolCallsConfig {
    return { ...this.config };
  }
}

/**
 * Default streaming tool calls instance
 */
export const streamingToolCalls = new StreamingToolCalls();