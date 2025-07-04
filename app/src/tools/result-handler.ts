/**
 * Tool Result Handler (Phase 9A)
 * Single Responsibility: Tool result handling only
 * 
 * Handles tool execution results from tool messages
 * Following SOLID principles and architecture guidelines
 */

import { Message } from '../models/message';
import { 
  MESSAGE_PROCESSING_LIMITS,
  MESSAGE_PROCESSING_MESSAGES,
  MESSAGE_PROCESSING_ERRORS,
  MESSAGE_TYPES
} from './constants';

/**
 * Tool result data structure
 */
export interface ToolResult {
  toolCallId: string;
  content: string;
  success: boolean;
  metadata?: Record<string, any>;
  timestamp: number;
}

/**
 * Tool result handling result
 */
export interface ToolResultHandlingResult {
  success: boolean;
  result?: ToolResult;
  errors: string[];
  handlingTimeMs: number;
}

/**
 * Batch tool result handling result
 */
export interface BatchToolResultHandlingResult {
  success: boolean;
  results: ToolResult[];
  totalHandled: number;
  errors: string[];
  handlingTimeMs: number;
  failedResults: number;
}

/**
 * Tool result handler interface (ISP compliance)
 */
export interface IToolResultHandler {
  handleToolResult(message: Message): Promise<ToolResultHandlingResult>;
  handleBatchToolResults(messages: Message[]): Promise<BatchToolResultHandlingResult>;
  extractToolResult(message: Message): ToolResult | null;
  validateToolResult(result: ToolResult): boolean;
}

/**
 * Tool result handling error
 */
export class ToolResultHandlingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly handlingTimeMs?: number
  ) {
    super(message);
    this.name = 'ToolResultHandlingError';
  }
}

/**
 * Tool Result Handler implementation
 * SRP: Handles only tool result processing logic
 * File size: <200 lines, functions <50 lines, max 5 parameters
 */
export class ToolResultHandler implements IToolResultHandler {

  /**
   * Handle a single tool result from a tool message
   * @param message Tool message containing result
   * @returns Result handling outcome
   */
  async handleToolResult(message: Message): Promise<ToolResultHandlingResult> {
    const startTime = performance.now();

    try {
      // Early return for invalid messages
      if (!this.isValidToolMessage(message)) {
        return {
          success: false,
          errors: [MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE],
          handlingTimeMs: performance.now() - startTime
        };
      }

      // Extract tool result
      const result = this.extractToolResult(message);
      if (!result) {
        return {
          success: false,
          errors: [MESSAGE_PROCESSING_MESSAGES.RESULT_HANDLING_FAILED],
          handlingTimeMs: performance.now() - startTime
        };
      }

      // Validate extracted result
      if (!this.validateToolResult(result)) {
        return {
          success: false,
          errors: [MESSAGE_PROCESSING_MESSAGES.MALFORMED_TOOL_RESULT],
          handlingTimeMs: performance.now() - startTime
        };
      }

      const handlingTime = performance.now() - startTime;

      // Check timeout requirement (<5ms)
      if (handlingTime > MESSAGE_PROCESSING_LIMITS.RESULT_HANDLING_TIMEOUT_MS) {
        throw new ToolResultHandlingError(
          MESSAGE_PROCESSING_MESSAGES.RESULT_TIMEOUT,
          MESSAGE_PROCESSING_ERRORS.TIMEOUT,
          handlingTime
        );
      }

      return {
        success: true,
        result,
        errors: [],
        handlingTimeMs: handlingTime
      };

    } catch (error) {
      const handlingTime = performance.now() - startTime;

      if (error instanceof ToolResultHandlingError) {
        return {
          success: false,
          errors: [error.message],
          handlingTimeMs: handlingTime
        };
      }

      return {
        success: false,
        errors: [MESSAGE_PROCESSING_MESSAGES.RESULT_HANDLING_FAILED],
        handlingTimeMs: handlingTime
      };
    }
  }

  /**
   * Handle multiple tool results in batch
   * @param messages Array of tool messages with results
   * @returns Batch handling outcome
   */
  async handleBatchToolResults(messages: Message[]): Promise<BatchToolResultHandlingResult> {
    const startTime = performance.now();

    try {
      // Early return for empty array
      if (!messages || messages.length === 0) {
        return {
          success: true,
          results: [],
          totalHandled: 0,
          errors: [],
          handlingTimeMs: performance.now() - startTime,
          failedResults: 0
        };
      }

      const results: ToolResult[] = [];
      const errors: string[] = [];
      let failedResults = 0;

      // Process each message
      for (const message of messages) {
        try {
          const handlingResult = await this.handleToolResult(message);
          
          if (handlingResult.success && handlingResult.result) {
            results.push(handlingResult.result);
          } else {
            errors.push(...handlingResult.errors);
            failedResults++;
          }
        } catch (error) {
          errors.push(`Result handling failed: ${error}`);
          failedResults++;
        }
      }

      const handlingTime = performance.now() - startTime;

      return {
        success: errors.length === 0,
        results,
        totalHandled: results.length,
        errors,
        handlingTimeMs: handlingTime,
        failedResults
      };

    } catch (error) {
      const handlingTime = performance.now() - startTime;

      return {
        success: false,
        results: [],
        totalHandled: 0,
        errors: [error instanceof Error ? error.message : 'Unknown batch handling error'],
        handlingTimeMs: handlingTime,
        failedResults: messages.length
      };
    }
  }

  /**
   * Extract tool result from tool message
   * @param message Tool message to extract from
   * @returns Extracted tool result or null
   */
  extractToolResult(message: Message): ToolResult | null {
    try {
      // Guard clause for invalid messages
      if (!this.isValidToolMessage(message)) {
        return null;
      }

      // Extract content as result
      const content = typeof message.content === 'string' 
        ? message.content 
        : JSON.stringify(message.content);

      const result: ToolResult = {
        toolCallId: message.tool_call_id!,
        content: content.trim(),
        success: true, // Assume success if we got a result
        timestamp: Date.now()
      };

      // Add metadata if message has name
      if (message.name) {
        result.metadata = { name: message.name };
      }

      return result;

    } catch (error) {
      return null;
    }
  }

  /**
   * Validate tool result structure
   * @param result Tool result to validate
   * @returns True if valid result
   */
  validateToolResult(result: ToolResult): boolean {
    try {
      // Check required fields
      if (!result.toolCallId || typeof result.toolCallId !== 'string') {
        return false;
      }

      if (!result.content || typeof result.content !== 'string') {
        return false;
      }

      if (typeof result.success !== 'boolean') {
        return false;
      }

      if (typeof result.timestamp !== 'number') {
        return false;
      }

      // Check content length
      if (result.content.length === 0) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if message is a valid tool message
   * @param message Message to check
   * @returns True if valid tool message
   */
  private isValidToolMessage(message: Message): boolean {
    return message && 
           message.role === 'tool' && 
           Boolean(message.tool_call_id) && 
           Boolean(message.content);
  }
}

/**
 * Create tool result handler instance
 * Factory function for dependency injection
 */
export function createToolResultHandler(): IToolResultHandler {
  return new ToolResultHandler();
}