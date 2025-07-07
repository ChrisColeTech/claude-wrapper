/**
 * Tool Result Processor - Handles tool results from client and continues conversation
 * Single Responsibility: Process tool execution results and maintain conversation flow
 * 
 * Based on OpenAI Tools API Implementation Plan
 */

import { OpenAIToolCall } from '../types';
import { OpenAIFormatter } from './openai-formatter';
import { getLogger } from '../../utils/logger';

const logger = getLogger('tool-result-processor');

/**
 * Tool execution result from client
 */
export interface ToolExecutionResult {
  /** ID of the tool call this result responds to */
  toolCallId: string;
  
  /** Result data from tool execution */
  result: any;
  
  /** Whether the tool execution was successful */
  success: boolean;
  
  /** Error message if execution failed */
  error?: string;
  
  /** Execution metadata */
  metadata?: {
    duration?: number;
    timestamp?: Date;
    toolName?: string;
  };
}

/**
 * Tool message for conversation continuity
 */
export interface ToolMessage {
  role: 'tool';
  tool_call_id: string;
  content: string;
}

/**
 * Processed tool results ready for Claude integration
 */
export interface ProcessedToolResults {
  /** Tool messages for conversation history */
  toolMessages: ToolMessage[];
  
  /** Any errors that occurred during processing */
  errors: string[];
  
  /** Summary of tool execution results */
  summary: {
    totalResults: number;
    successfulResults: number;
    failedResults: number;
    totalExecutionTime?: number;
  };
}

/**
 * Configuration for tool result processing
 */
export interface ToolResultProcessorConfig {
  /** Maximum content length for tool results */
  maxContentLength?: number;
  
  /** Whether to include error details in tool messages */
  includeErrorDetails?: boolean;
  
  /** Whether to validate tool call IDs */
  validateToolCallIds?: boolean;
  
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Tool Result Processor - Processes tool execution results from client
 * 
 * Architecture:
 * - SRP: Single responsibility for processing tool results
 * - Error Handling: Graceful handling of tool execution failures
 * - Validation: Ensures tool results are properly formatted
 */
export class ToolResultProcessor {
  private readonly formatter: OpenAIFormatter;
  private readonly config: Required<ToolResultProcessorConfig>;

  constructor(
    config: ToolResultProcessorConfig = {},
    formatter?: OpenAIFormatter
  ) {
    this.config = {
      maxContentLength: config.maxContentLength ?? 50000,
      includeErrorDetails: config.includeErrorDetails ?? true,
      validateToolCallIds: config.validateToolCallIds ?? true,
      debug: config.debug ?? false,
    };

    this.formatter = formatter ?? new OpenAIFormatter();

    if (this.config.debug) {
      logger.debug('ToolResultProcessor initialized', { config: this.config });
    }
  }

  /**
   * Process tool execution results from client
   * 
   * @param results - Tool execution results from client
   * @param originalToolCalls - Original tool calls that were executed
   * @returns Processed results ready for conversation continuity
   */
  processToolResults(
    results: ToolExecutionResult[],
    originalToolCalls: OpenAIToolCall[]
  ): ProcessedToolResults {
    const toolMessages: ToolMessage[] = [];
    const errors: string[] = [];
    let totalExecutionTime = 0;
    let successfulResults = 0;
    let failedResults = 0;

    if (this.config.debug) {
      logger.debug('Processing tool results', {
        resultCount: results.length,
        originalToolCallCount: originalToolCalls.length
      });
    }

    // Create a map of original tool calls for validation
    const toolCallMap = new Map<string, OpenAIToolCall>();
    originalToolCalls.forEach(call => {
      toolCallMap.set(call.id, call);
    });

    // Process each result
    for (const result of results) {
      try {
        const processed = this.processSingleResult(result, toolCallMap);
        
        if (processed.toolMessage) {
          toolMessages.push(processed.toolMessage);
        }
        
        if (processed.errors.length > 0) {
          errors.push(...processed.errors);
        }

        if (result.success) {
          successfulResults++;
        } else {
          failedResults++;
        }

        if (result.metadata?.duration) {
          totalExecutionTime += result.metadata.duration;
        }

      } catch (error) {
        const errorMessage = `Failed to process result for tool call ${result.toolCallId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
        errors.push(errorMessage);
        failedResults++;
        logger.error('Tool result processing failed', { 
          error, 
          toolCallId: result.toolCallId 
        });
      }
    }

    // Check for missing results
    const missingResults = this.findMissingResults(originalToolCalls, results);
    if (missingResults.length > 0) {
      errors.push(`Missing results for tool calls: ${missingResults.join(', ')}`);
    }

    const processedResults: ProcessedToolResults = {
      toolMessages,
      errors,
      summary: {
        totalResults: results.length,
        successfulResults,
        failedResults,
        totalExecutionTime: totalExecutionTime > 0 ? totalExecutionTime : undefined
      }
    };

    if (this.config.debug) {
      logger.debug('Tool result processing completed', {
        toolMessageCount: toolMessages.length,
        errorCount: errors.length,
        summary: processedResults.summary
      });
    }

    return processedResults;
  }

  /**
   * Create tool messages from simple result data (for testing/simple use cases)
   * 
   * @param toolCallResults - Map of tool call ID to result data
   * @returns Array of tool messages
   */
  createToolMessages(toolCallResults: Map<string, any>): ToolMessage[] {
    const toolMessages: ToolMessage[] = [];

    for (const [toolCallId, result] of toolCallResults) {
      try {
        const toolMessage = this.formatter.formatToolMessage(toolCallId, result);
        toolMessages.push(toolMessage);
      } catch (error) {
        logger.warn('Failed to create tool message', { 
          toolCallId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return toolMessages;
  }

  /**
   * Validate tool message format
   * 
   * @param toolMessage - Tool message to validate
   * @returns Array of validation errors (empty if valid)
   */
  validateToolMessage(toolMessage: ToolMessage): string[] {
    const errors: string[] = [];

    if (toolMessage.role !== 'tool') {
      errors.push(`Invalid tool message role: ${toolMessage.role} (expected: tool)`);
    }

    if (!toolMessage.tool_call_id) {
      errors.push('Tool message tool_call_id is required');
    }

    if (typeof toolMessage.content !== 'string') {
      errors.push('Tool message content must be a string');
    }

    if (toolMessage.content.length > this.config.maxContentLength) {
      errors.push(`Tool message content too long: ${toolMessage.content.length} > ${this.config.maxContentLength}`);
    }

    return errors;
  }

  /**
   * Process a single tool result
   */
  private processSingleResult(
    result: ToolExecutionResult,
    toolCallMap: Map<string, OpenAIToolCall>
  ): { toolMessage?: ToolMessage; errors: string[] } {
    const errors: string[] = [];

    // Validate tool call ID
    if (this.config.validateToolCallIds) {
      if (!toolCallMap.has(result.toolCallId)) {
        errors.push(`Unknown tool call ID: ${result.toolCallId}`);
        return { errors };
      }
    }

    // Create tool message content
    let content: string;
    
    if (!result.success && result.error) {
      if (this.config.includeErrorDetails) {
        content = `Error: ${result.error}`;
      } else {
        content = 'Tool execution failed';
      }
    } else {
      content = this.formatResultContent(result.result);
    }

    // Truncate content if too long
    if (content.length > this.config.maxContentLength) {
      content = content.substring(0, this.config.maxContentLength - 3) + '...';
    }

    const toolMessage = this.formatter.formatToolMessage(result.toolCallId, content);

    // Validate the generated tool message
    const validationErrors = this.validateToolMessage(toolMessage);
    errors.push(...validationErrors);

    return { toolMessage, errors };
  }

  /**
   * Format tool result content for inclusion in tool message
   */
  private formatResultContent(result: any): string {
    if (result === null || result === undefined) {
      return 'null';
    }

    if (typeof result === 'string') {
      return result;
    }

    if (typeof result === 'number' || typeof result === 'boolean') {
      return String(result);
    }

    // For objects and arrays, use JSON formatting
    try {
      return JSON.stringify(result, null, 2);
    } catch (error) {
      logger.warn('Failed to JSON stringify tool result', { error });
      return String(result);
    }
  }

  /**
   * Find tool calls that don't have corresponding results
   */
  private findMissingResults(
    originalToolCalls: OpenAIToolCall[],
    results: ToolExecutionResult[]
  ): string[] {
    const resultIds = new Set(results.map(r => r.toolCallId));
    
    return originalToolCalls
      .filter(call => !resultIds.has(call.id))
      .map(call => call.id);
  }

  /**
   * Get processor configuration
   */
  getConfig(): ToolResultProcessorConfig {
    return { ...this.config };
  }
}

/**
 * Default tool result processor instance
 */
export const toolResultProcessor = new ToolResultProcessor();