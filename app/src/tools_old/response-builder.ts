/**
 * Tool call response construction service
 * Single Responsibility: Response building only
 * 
 * Constructs complete OpenAI-compatible chat completion responses with tool calls
 */

import { 
  OpenAIToolCall, 
  IResponseBuilder,
  MultiToolCallResult
} from './types';
import { 
  RESPONSE_FORMATS, 
  RESPONSE_FORMATTING_MESSAGES, 
  RESPONSE_FORMATTING_ERRORS,
  MULTI_TOOL_MESSAGES
} from './constants';

/**
 * Response building error
 */
export class ResponseBuildingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly response?: any
  ) {
    super(message);
    this.name = 'ResponseBuildingError';
  }
}

/**
 * Chat completion response structure (OpenAI format)
 */
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: string;
    multi_tool_metadata?: {
      total_tool_calls: number;
      successful_calls: number;
      failed_calls: number;
      processing_time_ms: number;
      parallel_processed: boolean;
      errors: string[];
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Response builder implementation
 */
export class ToolCallResponseBuilder implements IResponseBuilder {
  /**
   * Build chat completion response with tool calls
   */
  buildToolCallResponse(toolCalls: OpenAIToolCall[], content?: string): ChatCompletionResponse {
    try {
      // Validate input
      if (!Array.isArray(toolCalls)) {
        throw new ResponseBuildingError(
          'Tool calls must be an array',
          RESPONSE_FORMATTING_ERRORS.INVALID_STRUCTURE
        );
      }

      // Create base response structure
      const response: ChatCompletionResponse = {
        id: this.generateResponseId(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'claude-3-sonnet-20240229', // Default model, should be overridden
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: content || null
            },
            finish_reason: RESPONSE_FORMATS.FINISH_REASON_STOP
          }
        ]
      };

      // Add tool calls if present
      if (toolCalls.length > 0) {
        response.choices[0].message.tool_calls = toolCalls;
        response.choices[0].finish_reason = RESPONSE_FORMATS.FINISH_REASON_TOOL_CALLS;
      }

      // Validate response structure
      if (!this.validateResponseStructure(response)) {
        throw new ResponseBuildingError(
          RESPONSE_FORMATTING_MESSAGES.RESPONSE_STRUCTURE_INVALID,
          RESPONSE_FORMATTING_ERRORS.INVALID_STRUCTURE,
          response
        );
      }

      return response;

    } catch (error) {
      if (error instanceof ResponseBuildingError) {
        throw error;
      }
      
      throw new ResponseBuildingError(
        error instanceof Error ? error.message : 'Response building failed',
        RESPONSE_FORMATTING_ERRORS.FORMATTING_FAILED
      );
    }
  }

  /**
   * Set appropriate finish reason based on tool calls presence
   */
  setFinishReason(response: any, hasToolCalls: boolean): any {
    try {
      if (!response || !response.choices || !Array.isArray(response.choices)) {
        throw new ResponseBuildingError(
          'Invalid response structure for setting finish reason',
          RESPONSE_FORMATTING_ERRORS.INVALID_STRUCTURE,
          response
        );
      }

      // Clone response to avoid mutation
      const updatedResponse = { ...response };
      updatedResponse.choices = response.choices.map((choice: any, _index: number) => ({
        ...choice,
        finish_reason: hasToolCalls ? RESPONSE_FORMATS.FINISH_REASON_TOOL_CALLS : RESPONSE_FORMATS.FINISH_REASON_STOP
      }));

      return updatedResponse;

    } catch (error) {
      if (error instanceof ResponseBuildingError) {
        throw error;
      }
      
      throw new ResponseBuildingError(
        error instanceof Error ? error.message : 'Failed to set finish reason',
        RESPONSE_FORMATTING_ERRORS.FORMATTING_FAILED,
        response
      );
    }
  }

  /**
   * Validate response structure follows OpenAI format
   */
  validateResponseStructure(response: any): boolean {
    try {
      // Check basic structure
      if (!response || typeof response !== 'object') {
        return false;
      }

      // Check required fields
      if (!response.id || typeof response.id !== 'string') {
        return false;
      }

      if (response.object !== 'chat.completion') {
        return false;
      }

      if (!response.created || typeof response.created !== 'number') {
        return false;
      }

      if (!response.model || typeof response.model !== 'string') {
        return false;
      }

      if (!response.choices || !Array.isArray(response.choices)) {
        return false;
      }

      // Validate choices array
      for (const choice of response.choices) {
        if (!this.validateChoice(choice)) {
          return false;
        }
      }

      return true;

    } catch (error) {
      return false;
    }
  }

  /**
   * Validate individual choice structure
   */
  private validateChoice(choice: any): boolean {
    try {
      if (!choice || typeof choice !== 'object') {
        return false;
      }

      if (typeof choice.index !== 'number') {
        return false;
      }

      if (!choice.message || typeof choice.message !== 'object') {
        return false;
      }

      const message = choice.message;

      if (message.role !== 'assistant') {
        return false;
      }

      if (message.content !== null && typeof message.content !== 'string') {
        return false;
      }

      if (!choice.finish_reason || typeof choice.finish_reason !== 'string') {
        return false;
      }

      // Validate tool_calls if present
      if (message.tool_calls !== undefined) {
        if (!Array.isArray(message.tool_calls)) {
          return false;
        }

        for (const toolCall of message.tool_calls) {
          if (!this.validateToolCall(toolCall)) {
            return false;
          }
        }
      }

      return true;

    } catch (error) {
      return false;
    }
  }

  /**
   * Validate tool call structure in response
   */
  private validateToolCall(toolCall: any): boolean {
    try {
      if (!toolCall || typeof toolCall !== 'object') {
        return false;
      }

      if (!toolCall.id || typeof toolCall.id !== 'string') {
        return false;
      }

      if (toolCall.type !== 'function') {
        return false;
      }

      if (!toolCall.function || typeof toolCall.function !== 'object') {
        return false;
      }

      const func = toolCall.function;

      if (!func.name || typeof func.name !== 'string') {
        return false;
      }

      if (typeof func.arguments !== 'string') {
        return false;
      }

      // Validate arguments are valid JSON
      try {
        JSON.parse(func.arguments);
      } catch {
        return false;
      }

      return true;

    } catch (error) {
      return false;
    }
  }

  /**
   * Generate unique response ID
   */
  private generateResponseId(): string {
    // Generate a unique response ID in OpenAI format
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `chatcmpl-${timestamp}${random}`;
  }
}

/**
 * Response building utilities
 */
export const ResponseBuildingUtils = {
  /**
   * Extract tool calls from response
   */
  extractToolCalls: (response: ChatCompletionResponse): OpenAIToolCall[] => {
    try {
      const choice = response.choices?.[0];
      return choice?.message?.tool_calls || [];
    } catch {
      return [];
    }
  },

  /**
   * Check if response has tool calls
   */
  hasToolCalls: (response: ChatCompletionResponse): boolean => {
    const toolCalls = ResponseBuildingUtils.extractToolCalls(response);
    return toolCalls.length > 0;
  },

  /**
   * Get finish reason from response
   */
  getFinishReason: (response: ChatCompletionResponse): string | null => {
    try {
      return response.choices?.[0]?.finish_reason || null;
    } catch {
      return null;
    }
  },

  /**
   * Check if finish reason indicates tool calls
   */
  isToolCallFinish: (response: ChatCompletionResponse): boolean => {
    const finishReason = ResponseBuildingUtils.getFinishReason(response);
    return finishReason === RESPONSE_FORMATS.FINISH_REASON_TOOL_CALLS;
  },

  /**
   * Update response model
   */
  updateModel: (response: ChatCompletionResponse, model: string): ChatCompletionResponse => {
    return {
      ...response,
      model
    };
  },

  /**
   * Add usage information to response
   */
  addUsage: (
    response: ChatCompletionResponse, 
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  ): ChatCompletionResponse => {
    return {
      ...response,
      usage
    };
  },

  /**
   * Merge multiple tool call responses
   */
  mergeToolCallResponses: (responses: ChatCompletionResponse[]): ChatCompletionResponse | null => {
    try {
      if (responses.length === 0) {
        return null;
      }

      if (responses.length === 1) {
        return responses[0];
      }

      const baseResponse = responses[0];
      const allToolCalls: OpenAIToolCall[] = [];

      for (const response of responses) {
        const toolCalls = ResponseBuildingUtils.extractToolCalls(response);
        allToolCalls.push(...toolCalls);
      }

      return {
        ...baseResponse,
        choices: [
          {
            ...baseResponse.choices[0],
            message: {
              ...baseResponse.choices[0].message,
              tool_calls: allToolCalls
            },
            finish_reason: allToolCalls.length > 0 
              ? RESPONSE_FORMATS.FINISH_REASON_TOOL_CALLS 
              : RESPONSE_FORMATS.FINISH_REASON_STOP
          }
        ]
      };

    } catch {
      return null;
    }
  },

  /**
   * Build basic response with tool calls (helper method)
   */
  buildResponse(
    toolCalls: OpenAIToolCall[],
    content?: string,
    model?: string,
    requestId?: string
  ): ChatCompletionResponse {
    const responseBuilder = new ToolCallResponseBuilder();
    const response = responseBuilder.buildToolCallResponse(toolCalls, content);
    
    if (model) {
      response.model = model;
    }
    
    if (requestId) {
      response.id = requestId;
    }
    
    return response;
  },

  /**
   * Validate response structure (helper method)
   */
  validateResponseStructure(response: any): boolean {
    const responseBuilder = new ToolCallResponseBuilder();
    return responseBuilder.validateResponseStructure(response);
  },

  /**
   * Build response from multi-tool call result (Phase 7A)
   */
  buildMultiToolResponse(
    result: MultiToolCallResult,
    content?: string,
    model?: string,
    requestId?: string
  ): any {
    try {
      const baseResponse = ResponseBuildingUtils.buildResponse(
        result.toolCalls,
        content || 'I\'ll help you with those multiple requests.',
        model,
        requestId
      );

      // Add multi-tool metadata
      if (baseResponse && baseResponse.choices && baseResponse.choices[0]) {
        baseResponse.choices[0].multi_tool_metadata = {
          total_tool_calls: result.toolCalls.length,
          successful_calls: result.results.filter(r => r.success).length,
          failed_calls: result.results.filter(r => !r.success).length,
          processing_time_ms: result.processingTimeMs,
          parallel_processed: result.parallelProcessed,
          errors: result.errors
        };
      }

      return baseResponse;

    } catch (error) {
      throw new ResponseBuildingError(
        error instanceof Error ? error.message : MULTI_TOOL_MESSAGES.MULTI_CALL_PROCESSING_FAILED,
        RESPONSE_FORMATTING_ERRORS.FORMATTING_FAILED
      );
    }
  },

  /**
   * Validate multi-tool response structure
   */
  validateMultiToolResponse(response: any): boolean {
    try {
      if (!ResponseBuildingUtils.validateResponseStructure(response)) {
        return false;
      }

      // Additional validation for multi-tool responses
      if (response.choices && response.choices[0] && response.choices[0].multi_tool_metadata) {
        const metadata = response.choices[0].multi_tool_metadata;
        
        if (typeof metadata.total_tool_calls !== 'number' ||
            typeof metadata.successful_calls !== 'number' ||
            typeof metadata.failed_calls !== 'number' ||
            typeof metadata.processing_time_ms !== 'number' ||
            typeof metadata.parallel_processed !== 'boolean') {
          return false;
        }

        // Validate that successful + failed = total
        if (metadata.successful_calls + metadata.failed_calls !== metadata.total_tool_calls) {
          return false;
        }
      }

      return true;

    } catch {
      return false;
    }
  }
};

/**
 * Default response builder instance
 */
export const toolCallResponseBuilder = new ToolCallResponseBuilder();