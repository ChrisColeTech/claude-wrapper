/**
 * Parallel tool call processing engine
 * Single Responsibility: Parallel processing operations only
 * 
 * Handles concurrent execution of multiple tool calls with:
 * - Parallel processing of independent tool calls
 * - Concurrency management and resource limits
 * - Result aggregation and error handling
 */

import { 
  IParallelProcessor,
  ParallelProcessingResult,
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
 * Parallel processing error
 */
export class ParallelProcessingError extends Error {
  public readonly code: string;
  public readonly parallelId?: string;
  public readonly details?: any;

  constructor(
    message: string,
    code: string,
    parallelId?: string,
    details?: any
  ) {
    super(message);
    this.name = 'ParallelProcessingError';
    this.code = code;
    this.parallelId = parallelId;
    this.details = details;
  }
}

/**
 * Parallel processing utilities
 */
export class ParallelProcessingUtils {
  /**
   * Check if tool calls can be processed in parallel
   */
  static canProcessInParallel(toolCalls: OpenAIToolCall[]): boolean {
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
      return false;
    }

    // Allow processing even if exceeding concurrent limit - will be handled with concurrency control
    if (toolCalls.length > MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS) {
      return false;
    }

    // Check for conflicting operations that shouldn't run in parallel
    const fileOperations = toolCalls.filter(call => 
      ['read_file', 'write_file', 'edit_file'].includes(call.function.name)
    );

    // If multiple file operations target the same file, they can't be parallel
    if (fileOperations.length > 1) {
      const filePaths = new Set();
      for (const call of fileOperations) {
        try {
          const args = JSON.parse(call.function.arguments || '{}');
          if (args.path) {
            if (filePaths.has(args.path)) {
              return false; // Same file targeted by multiple operations
            }
            filePaths.add(args.path);
          }
        } catch {
          // If we can't parse arguments, err on the side of caution
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Create parallel processing result
   */
  static createResult(
    success: boolean,
    results: ToolCallProcessingResult[],
    errors: string[] = [],
    startTime?: number
  ): ParallelProcessingResult {
    const processedCalls = results.length;
    const successfulCalls = results.filter(r => r.success).length;
    const failedCalls = results.filter(r => !r.success).length;
    const totalProcessingTimeMs = startTime ? performance.now() - startTime : 0;
    const averageProcessingTimeMs = processedCalls > 0 
      ? results.reduce((sum, r) => sum + r.processingTimeMs, 0) / processedCalls 
      : 0;

    return {
      success,
      processedCalls,
      successfulCalls,
      failedCalls,
      results,
      errors,
      totalProcessingTimeMs,
      averageProcessingTimeMs
    };
  }

  /**
   * Detect conflicts between tool calls that cannot run in parallel
   */
  static detectConflicts(toolCalls: OpenAIToolCall[]): string[] {
    const conflicts: string[] = [];
    const fileOperations = new Map<string, { id: string, operation: string }>();

    for (const call of toolCalls) {
      try {
        const args = JSON.parse(call.function.arguments || '{}');
        const path = args.path || args.file || args.directory;
        
        if (path && ['write_file', 'edit_file', 'delete_file', 'move_file'].includes(call.function.name)) {
          const existing = fileOperations.get(path);
          if (existing) {
            conflicts.push(`Conflict: ${call.id} and ${existing.id} both target ${path}`);
          } else {
            fileOperations.set(path, { id: call.id, operation: call.function.name });
          }
        }
      } catch {
        // Ignore invalid JSON arguments
      }
    }

    return conflicts;
  }

  /**
   * Create batches for parallel processing
   */
  static createBatches<T>(items: T[], batchSize: number): T[][] {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Calculate parallel processing efficiency
   */
  static calculateEfficiency(
    sequentialTime: number,
    parallelTime: number,
    toolCallCount: number
  ): number {
    if (parallelTime <= 0 || toolCallCount <= 0 || sequentialTime <= 0) {
      return 0;
    }

    const speedup = sequentialTime / parallelTime;
    const efficiency = speedup / toolCallCount;
    
    return Math.min(efficiency, 1); // Cap at 100% efficiency
  }

  /**
   * Process with concurrency limit
   */
  static async processWithConcurrencyLimit<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    concurrencyLimit: number
  ): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];

    for (const item of items) {
      const promise = processor(item).then(result => {
        results.push(result);
      });

      executing.push(promise);

      if (executing.length >= concurrencyLimit) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex(p => p === promise), 
          1
        );
      }
    }

    await Promise.all(executing);
    return results;
  }
}

/**
 * Parallel processor implementation
 */
export class ParallelProcessor implements IParallelProcessor {
  private stats = {
    totalParallelSessions: 0,
    successfulSessions: 0,
    failedSessions: 0,
    totalToolCallsProcessed: 0,
    averageParallelismDegree: 0,
    totalProcessingTime: 0
  };

  private readonly maxConcurrency: number;

  constructor(maxConcurrency: number = MULTI_TOOL_LIMITS.MAX_CONCURRENT_PROCESSING) {
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * Process multiple tool calls in parallel
   */
  async processInParallel(
    toolCalls: OpenAIToolCall[], 
    tools: OpenAITool[]
  ): Promise<ParallelProcessingResult> {
    const startTime = performance.now();
    this.stats.totalParallelSessions++;

    try {
      // Validate parallel processing capability
      if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
        const result = ParallelProcessingUtils.createResult(
          false,
          [],
          [MULTI_TOOL_MESSAGES.INVALID_MULTI_CALL_STRUCTURE],
          startTime
        );
        this.stats.failedSessions++;
        return result;
      }

      if (toolCalls.length > MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS) {
        const result = ParallelProcessingUtils.createResult(
          false,
          [],
          [MULTI_TOOL_MESSAGES.TOO_MANY_PARALLEL_CALLS],
          startTime
        );
        this.stats.failedSessions++;
        return result;
      }

      if (!this.canProcessInParallel(toolCalls)) {
        const result = ParallelProcessingUtils.createResult(
          false,
          [],
          [MULTI_TOOL_MESSAGES.PARALLEL_PROCESSING_FAILED],
          startTime
        );
        this.stats.failedSessions++;
        return result;
      }

      this.stats.totalToolCallsProcessed += toolCalls.length;
      this.stats.averageParallelismDegree = 
        (this.stats.averageParallelismDegree * (this.stats.totalParallelSessions - 1) + toolCalls.length) 
        / this.stats.totalParallelSessions;

      // Process tool calls in parallel with concurrency limit
      const results = await ParallelProcessingUtils.processWithConcurrencyLimit(
        toolCalls,
        (toolCall) => this.processSingleToolCall(toolCall, tools),
        this.maxConcurrency
      );

      // Aggregate results and errors
      const errors: string[] = [];
      results.forEach(result => {
        if (!result.success) {
          errors.push(...result.errors);
        }
      });

      const allSuccessful = results.every(r => r.success);
      const finalResult = ParallelProcessingUtils.createResult(
        allSuccessful,
        results,
        errors,
        startTime
      );

      if (allSuccessful) {
        this.stats.successfulSessions++;
      } else {
        this.stats.failedSessions++;
      }

      this.stats.totalProcessingTime += finalResult.totalProcessingTimeMs;
      return finalResult;

    } catch (error) {
      this.stats.failedSessions++;
      return ParallelProcessingUtils.createResult(
        false,
        [],
        [error instanceof Error ? error.message : MULTI_TOOL_MESSAGES.PARALLEL_PROCESSING_FAILED],
        startTime
      );
    }
  }

  /**
   * Check if tool calls can be processed in parallel
   */
  canProcessInParallel(toolCalls: OpenAIToolCall[]): boolean {
    return ParallelProcessingUtils.canProcessInParallel(toolCalls) &&
           toolCalls.length <= this.maxConcurrency;
  }

  /**
   * Get current processing capacity
   */
  getProcessingCapacity(): number {
    return this.maxConcurrency;
  }

  /**
   * Process a single tool call with timeout
   */
  private async processSingleToolCall(
    toolCall: OpenAIToolCall,
    tools: OpenAITool[]
  ): Promise<ToolCallProcessingResult> {
    const startTime = performance.now();

    try {
      // Apply processing timeout
      const result = await Promise.race([
        this.executeToolCall(toolCall, tools),
        this.createTimeoutPromise(toolCall.id)
      ]);

      return {
        ...result,
        processingTimeMs: performance.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        toolCallId: toolCall.id,
        toolName: toolCall.function.name,
        errors: [error instanceof Error ? error.message : 'Unknown parallel processing error'],
        processingTimeMs: performance.now() - startTime
      };
    }
  }

  /**
   * Execute individual tool call
   */
  private async executeToolCall(
    toolCall: OpenAIToolCall,
    tools: OpenAITool[]
  ): Promise<Omit<ToolCallProcessingResult, 'processingTimeMs'>> {
    // Find the tool definition
    const tool = tools.find(t => t.function.name === toolCall.function.name);
    if (!tool) {
      return {
        success: false,
        toolCallId: toolCall.id,
        toolName: toolCall.function.name,
        errors: [`Tool '${toolCall.function.name}' not found in tools array`]
      };
    }

    // Simulate tool call processing (following OpenAI spec - no actual execution)
    // In real OpenAI API, this would prepare tool call for user execution
    return {
      success: true,
      toolCallId: toolCall.id,
      toolName: toolCall.function.name,
      result: {
        call_id: toolCall.id,
        function_name: toolCall.function.name,
        arguments: toolCall.function.arguments,
        status: 'ready_for_parallel_execution',
        parallel_group: 'default'
      },
      errors: []
    };
  }

  /**
   * Create timeout promise for tool call processing
   */
  private createTimeoutPromise(toolCallId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new ParallelProcessingError(
          MULTI_TOOL_MESSAGES.PROCESSING_TIMEOUT,
          MULTI_TOOL_ERRORS.TIMEOUT,
          toolCallId
        ));
      }, MULTI_TOOL_LIMITS.PROCESSING_TIMEOUT_MS);
    });
  }

  /**
   * Get parallel processing statistics
   */
  getParallelProcessingStats() {
    return {
      ...this.stats,
      averageProcessingTime: this.stats.totalParallelSessions > 0
        ? this.stats.totalProcessingTime / this.stats.totalParallelSessions
        : 0,
      successRate: this.stats.totalParallelSessions > 0
        ? this.stats.successfulSessions / this.stats.totalParallelSessions
        : 0,
      maxConcurrency: this.maxConcurrency
    };
  }

  /**
   * Reset parallel processing statistics
   */
  resetStats(): void {
    this.stats = {
      totalParallelSessions: 0,
      successfulSessions: 0,
      failedSessions: 0,
      totalToolCallsProcessed: 0,
      averageParallelismDegree: 0,
      totalProcessingTime: 0
    };
  }
}

/**
 * Factory for creating parallel processor
 */
export class ParallelProcessorFactory {
  static create(maxConcurrency?: number): IParallelProcessor {
    return new ParallelProcessor(maxConcurrency);
  }
}

/**
 * Singleton parallel processor instance
 */
export const parallelProcessor = ParallelProcessorFactory.create();