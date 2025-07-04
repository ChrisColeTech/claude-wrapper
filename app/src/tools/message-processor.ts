/**
 * Tool Message Processor (Phase 9A)
 * Single Responsibility: Tool message processing only
 * 
 * Processes tool messages with role "tool" in conversation flow
 * Following SOLID principles and architecture guidelines
 */

import { Message } from '../models/message';
import { 
  MESSAGE_ROLES, 
  MESSAGE_PROCESSING_LIMITS, 
  MESSAGE_PROCESSING_MESSAGES,
  MESSAGE_PROCESSING_ERRORS,
  TOOL_MESSAGE_VALIDATION
} from './constants';

/**
 * Tool message processing result interface
 */
export interface ToolMessageProcessingResult {
  success: boolean;
  processedMessage?: Message;
  errors: string[];
  processingTimeMs: number;
  validationPassed: boolean;
}

/**
 * Batch tool message processing result interface
 */
export interface BatchToolMessageResult {
  success: boolean;
  processedMessages: Message[];
  totalProcessed: number;
  errors: string[];
  processingTimeMs: number;
  validationFailures: number;
  failedMessages: number;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Tool message processor interface (ISP compliance)
 */
export interface IToolMessageProcessor {
  processToolMessage(message: Message): Promise<ToolMessageProcessingResult>;
  processBatchToolMessages(messages: Message[]): Promise<BatchToolMessageResult>;
  validateToolMessage(message: Message): boolean;
  validateToolMessageWithErrors(message: Message): ValidationResult;
  extractToolCallId(message: Message): string | null;
}

/**
 * Tool message validation error
 */
export class ToolMessageValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'ToolMessageValidationError';
  }
}

/**
 * Tool message processing error
 */
export class ToolMessageProcessingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly processingTimeMs?: number
  ) {
    super(message);
    this.name = 'ToolMessageProcessingError';
  }
}

/**
 * Tool Message Processor implementation
 * SRP: Handles only tool message processing logic
 * File size: <200 lines, functions <50 lines, max 5 parameters
 */
export class ToolMessageProcessor implements IToolMessageProcessor {
  
  /**
   * Process a single tool message
   * @param message Tool message to process
   * @returns Processing result with timing and validation info
   */
  async processToolMessage(message: Message): Promise<ToolMessageProcessingResult> {
    const startTime = performance.now();
    
    try {
      // Early return pattern for validation with detailed errors
      const validationResult = this.validateToolMessageWithErrors(message);
      if (!validationResult.valid) {
        return {
          success: false,
          errors: validationResult.errors,
          processingTimeMs: performance.now() - startTime,
          validationPassed: false
        };
      }

      // Process the validated tool message
      const processedMessage = await this.performToolMessageProcessing(message);
      
      const processingTime = performance.now() - startTime;
      
      // Check timeout requirement (<8ms)
      if (processingTime > MESSAGE_PROCESSING_LIMITS.PROCESSING_TIMEOUT_MS) {
        throw new ToolMessageProcessingError(
          MESSAGE_PROCESSING_MESSAGES.PROCESSING_TIMEOUT,
          MESSAGE_PROCESSING_ERRORS.TIMEOUT,
          processingTime
        );
      }

      return {
        success: true,
        processedMessage,
        errors: [],
        processingTimeMs: processingTime,
        validationPassed: true
      };

    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      if (error instanceof ToolMessageProcessingError) {
        return {
          success: false,
          errors: [error.message],
          processingTimeMs: processingTime,
          validationPassed: false
        };
      }

      return {
        success: false,
        errors: [MESSAGE_PROCESSING_MESSAGES.TOOL_MESSAGE_PROCESSING_FAILED],
        processingTimeMs: processingTime,
        validationPassed: false
      };
    }
  }

  /**
   * Process multiple tool messages in batch
   * @param messages Array of tool messages to process
   * @returns Batch processing result
   */
  async processBatchToolMessages(messages: Message[]): Promise<BatchToolMessageResult> {
    const startTime = performance.now();
    
    try {
      // Early return for empty array
      if (!messages || messages.length === 0) {
        return {
          success: true,
          processedMessages: [],
          totalProcessed: 0,
          errors: [],
          processingTimeMs: performance.now() - startTime,
          validationFailures: 0,
          failedMessages: 0
        };
      }

      // Check batch size limits
      if (messages.length > MESSAGE_PROCESSING_LIMITS.MAX_TOOL_MESSAGES_PER_BATCH) {
        throw new ToolMessageProcessingError(
          `Too many messages in batch: ${messages.length}`,
          MESSAGE_PROCESSING_ERRORS.PROCESSING_FAILED
        );
      }

      const processedMessages: Message[] = [];
      const errors: string[] = [];
      let validationFailures = 0;
      let failedMessages = 0;

      // Process each message
      for (const message of messages) {
        try {
          const result = await this.processToolMessage(message);
          
          if (result.success && result.processedMessage) {
            processedMessages.push(result.processedMessage);
          } else {
            errors.push(...result.errors);
            failedMessages++;
            if (!result.validationPassed) {
              validationFailures++;
            }
          }
        } catch (error) {
          errors.push(`Message processing failed: ${error}`);
          failedMessages++;
          validationFailures++;
        }
      }

      const processingTime = performance.now() - startTime;

      return {
        success: errors.length === 0,
        processedMessages,
        totalProcessed: processedMessages.length,
        errors,
        processingTimeMs: processingTime,
        validationFailures,
        failedMessages
      };

    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      return {
        success: false,
        processedMessages: [],
        totalProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown batch processing error'],
        processingTimeMs: processingTime,
        validationFailures: messages.length,
        failedMessages: messages.length
      };
    }
  }

  /**
   * Validate tool message structure and content
   * @param message Message to validate
   * @returns True if valid tool message
   */
  validateToolMessage(message: Message): boolean {
    try {
      // Check role
      if (message.role !== MESSAGE_ROLES.TOOL) {
        return false;
      }

      // Check required tool_call_id
      if (!message.tool_call_id) {
        return false;
      }

      // Validate tool_call_id format
      if (!TOOL_MESSAGE_VALIDATION.TOOL_CALL_ID_PATTERN.test(message.tool_call_id)) {
        return false;
      }

      // Check content
      if (!message.content || typeof message.content !== 'string') {
        return false;
      }

      // Check content length
      if (message.content.length < TOOL_MESSAGE_VALIDATION.MIN_CONTENT_LENGTH ||
          message.content.length > TOOL_MESSAGE_VALIDATION.MAX_CONTENT_LENGTH) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate tool message with detailed error information
   * @param message Message to validate
   * @returns Validation result with specific errors
   */
  validateToolMessageWithErrors(message: Message): ValidationResult {
    const errors: string[] = [];

    try {
      // Check if message exists
      if (!message) {
        errors.push(MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
        return { valid: false, errors };
      }

      // Check role - with error handling for property access
      try {
        if (message.role !== MESSAGE_ROLES.TOOL) {
          errors.push(MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
        }
      } catch {
        errors.push(MESSAGE_PROCESSING_MESSAGES.PROCESSING_FAILED);
      }

      // Check required tool_call_id - with error handling for property access
      try {
        if (!message.tool_call_id) {
          errors.push(MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
        } else if (!TOOL_MESSAGE_VALIDATION.TOOL_CALL_ID_PATTERN.test(message.tool_call_id)) {
          errors.push(MESSAGE_PROCESSING_MESSAGES.TOOL_CALL_ID_INVALID);
        }
      } catch {
        errors.push(MESSAGE_PROCESSING_MESSAGES.PROCESSING_FAILED);
      }

      // Check content - with error handling for property access
      try {
        if (!message.content || typeof message.content !== 'string') {
          errors.push(MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
        } else if (message.content.length < TOOL_MESSAGE_VALIDATION.MIN_CONTENT_LENGTH ||
                   message.content.length > TOOL_MESSAGE_VALIDATION.MAX_CONTENT_LENGTH) {
          errors.push(MESSAGE_PROCESSING_MESSAGES.INVALID_MESSAGE_STRUCTURE);
        }
      } catch {
        errors.push(MESSAGE_PROCESSING_MESSAGES.PROCESSING_FAILED);
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch {
      return {
        valid: false,
        errors: [MESSAGE_PROCESSING_MESSAGES.PROCESSING_FAILED]
      };
    }
  }

  /**
   * Perform the actual tool message processing
   * @param message Validated tool message
   * @returns Processed message
   */
  private async performToolMessageProcessing(message: Message): Promise<Message> {
    // Extract validation ensures message is properly formatted
    const processedMessage: Message = {
      role: message.role,
      content: message.content,
      tool_call_id: message.tool_call_id,
      ...(message.name && { name: message.name })
    };

    // Normalize content (trim whitespace, handle edge cases)
    if (typeof processedMessage.content === 'string') {
      processedMessage.content = processedMessage.content.trim();
    }

    return processedMessage;
  }

  /**
   * Extract tool call ID from message
   * @param message Message to extract from
   * @returns Tool call ID or null if not found
   */
  extractToolCallId(message: Message): string | null {
    try {
      if (!message || !message.tool_call_id) {
        return null;
      }
      return message.tool_call_id;
    } catch {
      return null;
    }
  }
}

/**
 * Create tool message processor instance
 * Factory function for dependency injection
 */
export function createToolMessageProcessor(): IToolMessageProcessor {
  return new ToolMessageProcessor();
}