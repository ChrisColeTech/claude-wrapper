/**
 * OpenAI Formatter - Formats tool calls and responses in OpenAI-compliant format
 * Single Responsibility: Format tool calls and responses for OpenAI API compatibility
 * 
 * Based on OpenAI Tools API Implementation Plan
 */

import { OpenAIToolCall } from '../types';
import { GeneratedToolCall } from './tool-call-generator';
import { getLogger } from '../../utils/logger';

const logger = getLogger('openai-formatter');

/**
 * OpenAI chat completion choice with tool calls
 */
export interface OpenAIChatCompletionChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

/**
 * OpenAI streaming chunk for tool calls
 */
export interface OpenAIStreamingChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;
}

/**
 * Configuration for OpenAI formatting
 */
export interface OpenAIFormatterConfig {
  /** Include null content when tool calls are present */
  includeNullContent?: boolean;
  
  /** Generate unique response IDs */
  generateResponseIds?: boolean;
  
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * OpenAI Formatter - Formats responses for OpenAI API compatibility
 * 
 * Architecture:
 * - SRP: Single responsibility for OpenAI format conversion
 * - Immutability: Does not modify input objects
 * - Validation: Ensures output meets OpenAI specification
 */
export class OpenAIFormatter {
  private readonly config: Required<OpenAIFormatterConfig>;

  constructor(config: OpenAIFormatterConfig = {}) {
    this.config = {
      includeNullContent: config.includeNullContent ?? true,
      generateResponseIds: config.generateResponseIds ?? true,
      debug: config.debug ?? false,
    };

    if (this.config.debug) {
      logger.debug('OpenAIFormatter initialized', { config: this.config });
    }
  }

  /**
   * Format a chat completion response with tool calls
   * 
   * @param toolCalls - Generated tool calls to include
   * @param model - Model name for the response
   * @param responseContent - Assistant's text response (if any)
   * @returns OpenAI-compliant chat completion choice
   */
  formatChatCompletionWithToolCalls(
    toolCalls: GeneratedToolCall[],
    model: string,
    responseContent?: string
  ): OpenAIChatCompletionChoice {
    const validToolCalls = toolCalls
      .filter(tc => tc.validationErrors.length === 0)
      .map(tc => tc.toolCall);

    if (this.config.debug) {
      logger.debug('Formatting chat completion with tool calls', {
        toolCallCount: validToolCalls.length,
        hasContent: !!responseContent
      });
    }

    const choice: OpenAIChatCompletionChoice = {
      index: 0,
      message: {
        role: 'assistant',
        content: validToolCalls.length > 0 
          ? (this.config.includeNullContent ? null : responseContent || null)
          : responseContent || null,
      },
      finish_reason: validToolCalls.length > 0 ? 'tool_calls' : 'stop'
    };

    if (validToolCalls.length > 0) {
      choice.message.tool_calls = validToolCalls;
    }

    return choice;
  }

  /**
   * Format streaming chunks for tool calls
   * 
   * @param toolCalls - Tool calls to stream
   * @param model - Model name
   * @param responseId - Unique response ID
   * @returns Array of streaming chunks
   */
  formatStreamingToolCalls(
    toolCalls: GeneratedToolCall[],
    model: string,
    responseId?: string
  ): OpenAIStreamingChunk[] {
    const chunks: OpenAIStreamingChunk[] = [];
    const validToolCalls = toolCalls.filter(tc => tc.validationErrors.length === 0);
    const id = responseId || this.generateResponseId();
    const created = Math.floor(Date.now() / 1000);

    if (validToolCalls.length === 0) {
      return chunks;
    }

    if (this.config.debug) {
      logger.debug('Formatting streaming tool calls', {
        toolCallCount: validToolCalls.length,
        responseId: id
      });
    }

    // Initial chunk with role
    chunks.push({
      id,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{
        index: 0,
        delta: { role: 'assistant' },
        finish_reason: null
      }]
    });

    // Stream each tool call
    validToolCalls.forEach((toolCall, toolIndex) => {
      // Tool call start chunk (id, type, function name)
      chunks.push({
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{
          index: 0,
          delta: {
            tool_calls: [{
              index: toolIndex,
              id: toolCall.toolCall.id,
              type: 'function',
              function: { name: toolCall.toolCall.function.name }
            }]
          },
          finish_reason: null
        }]
      });

      // Stream arguments in chunks (simulating progressive generation)
      const arguments_ = toolCall.toolCall.function.arguments;
      const chunkSize = Math.max(10, Math.floor(arguments_.length / 3));
      
      for (let i = 0; i < arguments_.length; i += chunkSize) {
        const argumentChunk = arguments_.slice(i, i + chunkSize);
        
        chunks.push({
          id,
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
        });
      }
    });

    // Final chunk with finish_reason
    chunks.push({
      id,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'tool_calls'
      }]
    });

    return chunks;
  }

  /**
   * Format a tool message for conversation continuity
   * 
   * @param toolCallId - ID of the tool call this responds to
   * @param toolResult - Result from tool execution
   * @returns OpenAI-compliant tool message
   */
  formatToolMessage(toolCallId: string, toolResult: any): {
    role: 'tool';
    tool_call_id: string;
    content: string;
  } {
    let content: string;
    
    if (typeof toolResult === 'string') {
      content = toolResult;
    } else if (toolResult === null || toolResult === undefined) {
      content = 'null';
    } else {
      try {
        content = JSON.stringify(toolResult, null, 2);
      } catch {
        content = String(toolResult);
      }
    }

    return {
      role: 'tool',
      tool_call_id: toolCallId,
      content
    };
  }

  /**
   * Validate OpenAI tool call format
   * 
   * @param toolCall - Tool call to validate
   * @returns Array of validation errors (empty if valid)
   */
  validateOpenAIToolCall(toolCall: OpenAIToolCall): string[] {
    const errors: string[] = [];

    if (!toolCall.id) {
      errors.push('Tool call ID is required');
    }

    if (toolCall.type !== 'function') {
      errors.push(`Invalid tool call type: ${toolCall.type} (expected: function)`);
    }

    if (!toolCall.function) {
      errors.push('Tool call function is required');
    } else {
      if (!toolCall.function.name) {
        errors.push('Tool call function name is required');
      }

      if (typeof toolCall.function.arguments !== 'string') {
        errors.push('Tool call function arguments must be a JSON string');
      } else {
        try {
          JSON.parse(toolCall.function.arguments);
        } catch {
          errors.push('Tool call function arguments must be valid JSON');
        }
      }
    }

    return errors;
  }

  /**
   * Create a streaming chunk for text content (non-tool response)
   * 
   * @param content - Text content to stream
   * @param model - Model name
   * @param responseId - Response ID
   * @param isFirst - Whether this is the first chunk
   * @param isLast - Whether this is the last chunk
   * @returns Streaming chunk
   */
  formatTextStreamingChunk(
    content: string,
    model: string,
    responseId: string,
    isFirst: boolean = false,
    isLast: boolean = false
  ): OpenAIStreamingChunk {
    const chunk: OpenAIStreamingChunk = {
      id: responseId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: isLast ? 'stop' : null
      }]
    };

    if (isFirst) {
      chunk.choices[0].delta.role = 'assistant';
    }

    if (content) {
      chunk.choices[0].delta.content = content;
    }

    return chunk;
  }

  /**
   * Generate a unique response ID for streaming
   */
  private generateResponseId(): string {
    return `chatcmpl-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get formatter configuration
   */
  getConfig(): OpenAIFormatterConfig {
    return { ...this.config };
  }
}

/**
 * Default OpenAI formatter instance
 */
export const openaiFormatter = new OpenAIFormatter();