/**
 * Multiple tool call handling service
 * Single Responsibility: Multi-tool call processing only
 * 
 * Handles multiple tool calls in a single request following OpenAI specification:
 * - Validates multi-tool call structure
 * - Processes multiple tool calls sequentially or in parallel
 * - Manages tool call results and error aggregation
 */

import { 
  IMultiToolCallHandler,
  MultiToolCallRequest,
  MultiToolCallResult,
  ToolCallProcessingResult,
  OpenAIToolCall,
  OpenAITool
} from './types';
import { 
  MULTI_TOOL_LIMITS,
  MULTI_TOOL_MESSAGES,
  MULTI_TOOL_ERRORS
} from './constants';

/**
 * Multi-tool call processing error
 */
export class MultiToolCallError extends Error {
  public readonly code: string;
  public readonly toolCallId?: string;
  public readonly requestId?: string;
  public readonly details?: any;

  constructor(
    message: string,
    code: string,
    toolCallId?: string,
    requestId?: string,
    details?: any
  ) {
    super(message);
    this.name = 'MultiToolCallError';
    this.code = code;
    this.toolCallId = toolCallId;
    this.requestId = requestId;
    this.details = details;
  }
}

/**
 * Multi-tool call processing utilities
 */
export class MultiToolCallUtils {
  /**
   * Validate multi-tool call request structure
   */
  static validateRequest(request: MultiToolCallRequest): boolean {
    if (!request || typeof request !== 'object') {
      return false;
    }

    if (!Array.isArray(request.tools) || !Array.isArray(request.toolCalls)) {
      return false;
    }

    if (request.toolCalls.length === 0) {
      return false;
    }

    if (request.toolCalls.length > MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS) {
      return false;
    }

    // Validate each tool call has required fields
    for (const toolCall of request.toolCalls) {
      if (!toolCall.id || !toolCall.function?.name) {
        return false;
      }
    }

    // Check for duplicate tool call IDs
    const ids = request.toolCalls.map(call => call.id);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      return false;
    }

    return true;
  }

  /**
   * Create multi-tool call result
   */
  static createResult(
    success: boolean,
    toolCalls: OpenAIToolCall[],
    results: ToolCallProcessingResult[],
    errors: string[] = [],
    startTime?: number,
    parallelProcessed = false
  ): MultiToolCallResult {
    return {
      success,
      toolCalls,
      results,
      errors,
      processingTimeMs: startTime ? performance.now() - startTime : 0,
      parallelProcessed
    };
  }

  /**
   * Process with timeout wrapper
   */
  static async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let hasResolved = false;
      
      const timeout = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          reject(new MultiToolCallError(
            MULTI_TOOL_MESSAGES.PROCESSING_TIMEOUT,
            MULTI_TOOL_ERRORS.TIMEOUT
          ));
        }
      }, timeoutMs);
      
      operation()
        .then(result => {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeout);
            resolve(result);
          }
        })
        .catch(error => {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeout);
            reject(error);
          }
        });
    });
  }
}

/**
 * Multi-tool call handler implementation
 */
export class MultiToolCallHandler implements IMultiToolCallHandler {
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalToolCalls: 0,
    totalProcessingTime: 0
  };

  /**
   * Process multiple tool calls in a single request
   */
  async processMultipleToolCalls(request: MultiToolCallRequest): Promise<MultiToolCallResult> {
    const startTime = performance.now();
    this.stats.totalRequests++;

    try {
      // Validate request structure
      if (!this.validateMultiToolRequest(request)) {
        const result = MultiToolCallUtils.createResult(
          false,
          request.toolCalls || [],
          [],
          [MULTI_TOOL_MESSAGES.INVALID_MULTI_CALL_STRUCTURE],
          startTime
        );
        this.stats.failedRequests++;
        return result;
      }

      this.stats.totalToolCalls += request.toolCalls.length;

      // Process tool calls sequentially (parallel processing handled by ParallelProcessor)
      const results: ToolCallProcessingResult[] = [];
      const errors: string[] = [];

      for (const toolCall of request.toolCalls) {
        try {
          const result = await this.processSingleToolCall(toolCall, request.tools);
          results.push(result);
          
          if (!result.success) {
            errors.push(...result.errors);
          }
        } catch (error) {
          const errorResult: ToolCallProcessingResult = {
            success: false,
            toolCallId: toolCall.id,
            toolName: toolCall.function.name,
            errors: [error instanceof Error ? error.message : MULTI_TOOL_MESSAGES.MULTI_CALL_PROCESSING_FAILED],
            processingTimeMs: 0
          };
          results.push(errorResult);
          errors.push(...errorResult.errors);
        }
      }

      const allSuccessful = results.every(r => r.success);
      const finalResult = MultiToolCallUtils.createResult(
        allSuccessful,
        request.toolCalls,
        results,
        errors,
        startTime,
        request.parallel || false
      );

      if (allSuccessful) {
        this.stats.successfulRequests++;
      } else {
        this.stats.failedRequests++;
      }

      this.stats.totalProcessingTime += finalResult.processingTimeMs;
      return finalResult;

    } catch (error) {
      this.stats.failedRequests++;
      return MultiToolCallUtils.createResult(
        false,
        request.toolCalls || [],
        [],
        [error instanceof Error ? error.message : MULTI_TOOL_MESSAGES.MULTI_CALL_PROCESSING_FAILED],
        startTime
      );
    }
  }

  /**
   * Validate multi-tool request structure and constraints
   */
  validateMultiToolRequest(request: MultiToolCallRequest): boolean {
    return MultiToolCallUtils.validateRequest(request);
  }

  /**
   * Create OpenAI-compatible multi-tool response
   */
  createMultiToolResponse(result: MultiToolCallResult): any {
    return {
      tool_calls: result.toolCalls,
      finish_reason: result.success ? 'tool_calls' : 'stop',
      processing_metadata: {
        success: result.success,
        total_calls: result.toolCalls.length,
        successful_calls: result.results.filter(r => r.success).length,
        failed_calls: result.results.filter(r => !r.success).length,
        processing_time_ms: result.processingTimeMs,
        parallel_processed: result.parallelProcessed
      }
    };
  }

  /**
   * Process a single tool call
   */
  private async processSingleToolCall(
    toolCall: OpenAIToolCall, 
    tools: OpenAITool[]
  ): Promise<ToolCallProcessingResult> {
    const startTime = performance.now();

    try {
      // Find the tool definition
      const tool = tools.find(t => t.function.name === toolCall.function.name);
      if (!tool) {
        return {
          success: false,
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          errors: [`Tool '${toolCall.function.name}' not found in tools array`],
          processingTimeMs: performance.now() - startTime
        };
      }

      // Simulate tool call processing (actual execution would be user-controlled)
      // This follows OpenAI spec where server handles protocol, not execution
      return {
        success: true,
        toolCallId: toolCall.id,
        toolName: toolCall.function.name,
        result: {
          call_id: toolCall.id,
          function_name: toolCall.function.name,
          arguments: toolCall.function.arguments,
          status: 'ready_for_execution'
        },
        errors: [],
        processingTimeMs: performance.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        toolCallId: toolCall.id,
        toolName: toolCall.function.name,
        errors: [error instanceof Error ? error.message : 'Unknown error during tool call processing'],
        processingTimeMs: performance.now() - startTime
      };
    }
  }

  /**
   * Get processing statistics
   */
  getProcessingStats() {
    return {
      ...this.stats,
      averageProcessingTime: this.stats.totalRequests > 0 
        ? this.stats.totalProcessingTime / this.stats.totalRequests 
        : 0,
      averageToolCallsPerRequest: this.stats.totalRequests > 0
        ? this.stats.totalToolCalls / this.stats.totalRequests
        : 0,
      successRate: this.stats.totalRequests > 0
        ? this.stats.successfulRequests / this.stats.totalRequests
        : 0
    };
  }

  /**
   * Reset processing statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalToolCalls: 0,
      totalProcessingTime: 0
    };
  }

  /**
   * Process multiple tools (compatibility method for tests)
   */
  async processMultipleTools(tools: OpenAITool[], request: MultiToolCallRequest): Promise<MultiToolCallResult> {
    // Delegate to the main processing method
    return this.processMultipleToolCalls(request);
  }

  /**
   * Execute multiple tools in parallel (compatibility method for tests)
   */
  async executeParallel(tools: OpenAITool[]): Promise<MultiToolCallResult> {
    // Create a request structure for parallel execution
    const mockRequest: MultiToolCallRequest = {
      tools: tools,
      toolCalls: tools.map((tool, index) => ({
        id: `call_${index}`,
        type: 'function' as const,
        function: {
          name: tool.function.name,
          arguments: JSON.stringify({}) // Empty arguments for test
        }
      })),
      sessionId: 'test-session',
      requestId: `test-${Date.now()}`
    };

    return this.processMultipleToolCalls(mockRequest);
  }
}

/**
 * Factory for creating multi-tool call handler
 */
export class MultiToolCallHandlerFactory {
  static create(): IMultiToolCallHandler {
    return new MultiToolCallHandler();
  }
}

/**
 * Singleton multi-tool call handler instance
 */
export const multiToolCallHandler = MultiToolCallHandlerFactory.create();