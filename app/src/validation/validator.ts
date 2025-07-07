/**
 * Enhanced Parameter Validator
 * Python-compatible validation with comprehensive error handling
 */

import { ChatCompletionRequest } from '../models/chat';
import { Message, MessageValidation } from '../models/message';
import { getLogger } from '../utils/logger';
// Tool validation constants for Phase 16A protocol compatibility
const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant', 
  SYSTEM: 'system',
  TOOL: 'tool'
} as const;

const MESSAGE_PROCESSING_MESSAGES = {
  TOOL_CALL_ID_INVALID: 'Tool call ID format is invalid'
} as const;

const TOOL_MESSAGE_VALIDATION = {
  TOOL_CALL_ID_PATTERN: /^call_[a-zA-Z0-9_-]+$/,
  MAX_CONTENT_LENGTH: 10000
} as const;
import { ModelValidationHelper } from './model-validation-helper';
import { 
  getValidationHandler, 
  ValidationErrorReport,
  FieldValidationError,
  ValidationContext 
} from '../middleware/validation-handler';

const logger = getLogger('ParameterValidator');

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Enhanced validation result with detailed field-level reporting
 */
export interface EnhancedValidationResult {
  valid: boolean;
  errors: FieldValidationError[];
  warnings: string[];
  processingTime: number;
  classification?: any;
  context?: ValidationContext;
}

export class ParameterValidator {
  /**
   * Supported Claude Code SDK models (Python compatible)
   */
  static readonly SUPPORTED_MODELS = new Set([
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022'
  ]);

  /**
   * Validate complete chat completion request
   */
  static validateRequest(request: ChatCompletionRequest): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate model
    const modelResult = this.validateModel(request.model);
    errors.push(...modelResult.errors);
    warnings.push(...modelResult.warnings);

    // Validate messages
    const messagesResult = this.validateMessages(request.messages);
    errors.push(...messagesResult.errors);
    warnings.push(...messagesResult.warnings);

    // Tools will be passed through to Claude Code CLI for client-side execution
    if (request.tool_choice && !request.tools) {
      errors.push('tool_choice can only be specified when tools are provided');
    }

    // Validate n parameter (Claude Code only supports single response)
    if (request.n > 1) {
      errors.push('Claude Code SDK does not support multiple choices (n > 1). Only single response generation is supported.');
    }

    // Validate parameter ranges (matches Python validation)
    if (request.temperature < 0 || request.temperature > 2) {
      errors.push(`temperature must be between 0 and 2, got ${request.temperature}`);
    }

    if (request.top_p < 0 || request.top_p > 1) {
      errors.push(`top_p must be between 0 and 1, got ${request.top_p}`);
    }

    if (request.presence_penalty < -2 || request.presence_penalty > 2) {
      errors.push(`presence_penalty must be between -2 and 2, got ${request.presence_penalty}`);
    }

    if (request.frequency_penalty < -2 || request.frequency_penalty > 2) {
      errors.push(`frequency_penalty must be between -2 and 2, got ${request.frequency_penalty}`);
    }

    if (request.max_tokens !== undefined && request.max_tokens < 0) {
      errors.push(`max_tokens must be non-negative, got ${request.max_tokens}`);
    }

    this.logUnsupportedParameterWarnings(request, warnings);

    const isValid = errors.length === 0;
    
    if (!isValid) {
      logger.error(`Request validation failed: ${errors.join(', ')}`);
    }

    if (warnings.length > 0) {
      logger.warn(`Request validation warnings: ${warnings.join(', ')}`);
    }

    return {
      valid: isValid,
      errors,
      warnings
    };
  }

  /**
   * Enhanced request validation with detailed field-level error reporting
   * Integrates with Phase 4A error handling system
   */
  static async validateRequestEnhanced(
    request: ChatCompletionRequest,
    context: Partial<ValidationContext>
  ): Promise<ValidationErrorReport> {
    const startTime = Date.now();
    
    try {
      // Use the validation handler for comprehensive validation
      const report = await getValidationHandler().validateRequest(
        request,
        'chat_completion',
        {
          endpoint: '/v1/chat/completions',
          method: 'POST',
          timestamp: new Date(),
          ...context
        }
      );

      // Add additional Claude-specific validations
      const additionalErrors = await this.performClaudeSpecificValidation(request);
      report.errors.push(...additionalErrors);
      report.errorCount = report.errors.length;
      report.isValid = report.errors.length === 0;

      // Update processing time
      report.processingTime = Date.now() - startTime;

      return report;
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          field: 'request',
          path: 'request',
          value: null,
          message: `Validation system error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'VALIDATION_SYSTEM_ERROR',
          suggestion: 'Contact support if error persists'
        }],
        errorCount: 1,
        classification: {
          category: 'validation_error' as any,
          severity: 'high' as any,
          retryStrategy: 'no_retry' as any,
          httpStatusCode: 500,
          errorCode: 'VALIDATION_SYSTEM_ERROR',
          isRetryable: false,
          operationalImpact: 'Validation system failure',
          clientGuidance: ['Contact support']
        },
        context: {
          endpoint: '/v1/chat/completions',
          method: 'POST',
          timestamp: new Date(),
          ...context
        },
        suggestions: ['Contact support for validation system issues'],
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Perform Claude-specific validation that extends base validation
   */
  private static async performClaudeSpecificValidation(
    request: ChatCompletionRequest
  ): Promise<FieldValidationError[]> {
    const errors: FieldValidationError[] = [];

    // Validate model with enhanced error details
    if (!this.SUPPORTED_MODELS.has(request.model)) {
      errors.push({
        field: 'model',
        path: 'model',
        value: request.model,
        message: `Model '${request.model}' is not supported by Claude Code SDK`,
        code: 'UNSUPPORTED_MODEL',
        suggestion: `Use one of the supported models: ${Array.from(this.SUPPORTED_MODELS).join(', ')}`,
        constraint: `supported_models: [${Array.from(this.SUPPORTED_MODELS).join(', ')}]`
      });
    }

    // Validate n parameter with detailed error
    if (request.n && request.n > 1) {
      errors.push({
        field: 'n',
        path: 'n',
        value: request.n,
        message: 'Claude Code SDK does not support multiple choices',
        code: 'MULTIPLE_CHOICES_NOT_SUPPORTED',
        suggestion: 'Set n to 1 or omit the parameter',
        constraint: 'max_value: 1'
      });
    }

    // Validate temperature with enhanced details
    if (request.temperature !== undefined && (request.temperature < 0 || request.temperature > 2)) {
      errors.push({
        field: 'temperature',
        path: 'temperature',
        value: request.temperature,
        message: 'Temperature must be between 0 and 2',
        code: 'INVALID_TEMPERATURE_RANGE',
        suggestion: 'Use a temperature value between 0.0 and 2.0',
        constraint: 'range: [0, 2]'
      });
    }

    // Validate top_p with enhanced details
    if (request.top_p !== undefined && (request.top_p < 0 || request.top_p > 1)) {
      errors.push({
        field: 'top_p',
        path: 'top_p',
        value: request.top_p,
        message: 'Top_p must be between 0 and 1',
        code: 'INVALID_TOP_P_RANGE',
        suggestion: 'Use a top_p value between 0.0 and 1.0',
        constraint: 'range: [0, 1]'
      });
    }

    // Validate max_tokens with enhanced details
    if (request.max_tokens !== undefined && request.max_tokens < 0) {
      errors.push({
        field: 'max_tokens',
        path: 'max_tokens',
        value: request.max_tokens,
        message: 'Max_tokens must be non-negative',
        code: 'INVALID_MAX_TOKENS',
        suggestion: 'Use a positive integer or omit the parameter',
        constraint: 'min_value: 0'
      });
    }

    // Validate messages array with enhanced details
    if (!request.messages || !Array.isArray(request.messages)) {
      errors.push({
        field: 'messages',
        path: 'messages',
        value: request.messages,
        message: 'Messages must be a non-empty array',
        code: 'INVALID_MESSAGES_ARRAY',
        suggestion: 'Provide an array of message objects with role and content'
      });
    } else if (request.messages.length === 0) {
      errors.push({
        field: 'messages',
        path: 'messages',
        value: request.messages,
        message: 'Messages array cannot be empty',
        code: 'EMPTY_MESSAGES_ARRAY',
        suggestion: 'Include at least one message in the conversation'
      });
    } else {
      // Validate individual messages
      const messageErrors = await this.validateMessagesEnhanced(request.messages);
      errors.push(...messageErrors);
    }

    return errors;
  }

  /**
   * Enhanced message validation with detailed field-level reporting
   */
  private static async validateMessagesEnhanced(messages: Message[]): Promise<FieldValidationError[]> {
    const errors: FieldValidationError[] = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const basePath = `messages[${i}]`;

      // Validate role
      if (!message.role) {
        errors.push({
          field: 'role',
          path: `${basePath}.role`,
          value: message.role,
          message: 'Message role is required',
          code: 'MISSING_MESSAGE_ROLE',
          suggestion: `Specify a valid role: ${Object.values(MESSAGE_ROLES).join(', ')}`
        });
      } else if (!Object.values(MESSAGE_ROLES).includes(message.role as any)) {
        errors.push({
          field: 'role',
          path: `${basePath}.role`,
          value: message.role,
          message: `Invalid message role '${message.role}'`,
          code: 'INVALID_MESSAGE_ROLE',
          suggestion: `Use one of the valid roles: ${Object.values(MESSAGE_ROLES).join(', ')}`,
          constraint: `allowed_values: [${Object.values(MESSAGE_ROLES).join(', ')}]`
        });
      }

      // Validate content
      if (!message.content) {
        errors.push({
          field: 'content',
          path: `${basePath}.content`,
          value: message.content,
          message: 'Message content is required',
          code: 'MISSING_MESSAGE_CONTENT',
          suggestion: 'Provide content for the message'
        });
      } else if (typeof message.content === 'string' && message.content.trim().length === 0) {
        errors.push({
          field: 'content',
          path: `${basePath}.content`,
          value: message.content,
          message: 'Message content cannot be empty',
          code: 'EMPTY_MESSAGE_CONTENT',
          suggestion: 'Provide meaningful content for the message'
        });
      }

      // Validate tool messages
      if (message.role === MESSAGE_ROLES.TOOL) {
        const toolErrors = await this.validateToolMessageEnhanced(message, i);
        errors.push(...toolErrors);
      }
    }

    return errors;
  }

  /**
   * Enhanced tool message validation with detailed error reporting
   */
  private static async validateToolMessageEnhanced(message: Message, index: number): Promise<FieldValidationError[]> {
    const errors: FieldValidationError[] = [];
    const basePath = `messages[${index}]`;

    // Validate tool_call_id
    if (!message.tool_call_id) {
      errors.push({
        field: 'tool_call_id',
        path: `${basePath}.tool_call_id`,
        value: message.tool_call_id,
        message: 'Tool call ID is required for tool messages',
        code: 'MISSING_TOOL_CALL_ID',
        suggestion: 'Provide a valid tool_call_id that matches a previous tool call'
      });
    } else if (typeof message.tool_call_id !== 'string') {
      errors.push({
        field: 'tool_call_id',
        path: `${basePath}.tool_call_id`,
        value: message.tool_call_id,
        message: 'Tool call ID must be a string',
        code: 'INVALID_TOOL_CALL_ID_TYPE',
        suggestion: 'Provide tool_call_id as a string value'
      });
    } else if (!TOOL_MESSAGE_VALIDATION.TOOL_CALL_ID_PATTERN.test(message.tool_call_id)) {
      errors.push({
        field: 'tool_call_id',
        path: `${basePath}.tool_call_id`,
        value: message.tool_call_id,
        message: 'Tool call ID format is invalid',
        code: 'INVALID_TOOL_CALL_ID_FORMAT',
        suggestion: 'Use a valid tool call ID format that matches the expected pattern',
        constraint: `pattern: ${TOOL_MESSAGE_VALIDATION.TOOL_CALL_ID_PATTERN.source}`
      });
    }

    // Validate content length for tool messages
    if (message.content) {
      const contentLength = typeof message.content === 'string' 
        ? message.content.length 
        : JSON.stringify(message.content).length;

      if (contentLength > TOOL_MESSAGE_VALIDATION.MAX_CONTENT_LENGTH) {
        errors.push({
          field: 'content',
          path: `${basePath}.content`,
          value: message.content,
          message: `Tool message content exceeds maximum length of ${TOOL_MESSAGE_VALIDATION.MAX_CONTENT_LENGTH} characters`,
          code: 'TOOL_MESSAGE_CONTENT_TOO_LONG',
          suggestion: `Reduce content length to ${TOOL_MESSAGE_VALIDATION.MAX_CONTENT_LENGTH} characters or less`,
          constraint: `max_length: ${TOOL_MESSAGE_VALIDATION.MAX_CONTENT_LENGTH}`
        });
      }
    }

    return errors;
  }

  /**
   * Validate model parameter
   * Phase 5A: Enhanced with strict validation and model registry integration
   */
  static validateModel(model: string): ValidationResult {
    return ModelValidationHelper.validateModelForRequest(model);
  }

  /**
   * Legacy model validation for backwards compatibility
   */
  static validateModelBasic(model: string): ValidationResult {
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!model || typeof model !== 'string') {
        errors.push('Model parameter is required and must be a string');
        return { valid: false, errors, warnings };
      }

      if (!this.SUPPORTED_MODELS.has(model)) {
        warnings.push(`Model '${model}' is not officially supported by Claude Code SDK. Supported models: ${Array.from(this.SUPPORTED_MODELS).join(', ')}`);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    }

  /**
   * Phase 16A: Tool validation - reject with helpful message
   */
  static validateOpenAITools(tools?: any[], toolChoice?: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (tools || toolChoice) {
      errors.push('Tool execution is not supported. This API provides OpenAI-compatible chat completions only. Tools should be executed client-side and results included in message content.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate messages array
   * Based on Python ParameterValidator.validate_messages()
   * Phase 9A: Updated to include tool message validation
   */
  static validateMessages(messages: Message[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!messages || !Array.isArray(messages)) {
      errors.push('Messages parameter is required and must be an array');
      return { valid: false, errors, warnings };
    }

    if (messages.length === 0) {
      errors.push('Messages array cannot be empty');
      return { valid: false, errors, warnings };
    }

    // Validate message structure
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      if (!message.role) {
        errors.push(`Message at index ${i} is missing required 'role' field`);
      } else if (!Object.values(MESSAGE_ROLES).includes(message.role as any)) {
        errors.push(`Message at index ${i} has invalid role '${message.role}'. Must be one of: ${Object.values(MESSAGE_ROLES).join(', ')}`);
      }

      if (!message.content) {
        errors.push(`Message at index ${i} is missing required 'content' field`);
      }

      // Phase 9A: Validate tool messages specifically
      if (message.role === MESSAGE_ROLES.TOOL) {
        const toolValidation = this.validateToolMessage(message, i);
        errors.push(...toolValidation.errors);
        warnings.push(...toolValidation.warnings);
      }
    }

    // Validate conversation flow (should end with user message for Claude)
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role !== 'user') {
      warnings.push('Conversation should typically end with a user message for optimal Claude Code SDK performance');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Log warnings for unsupported parameters
   */
  private static logUnsupportedParameterWarnings(request: ChatCompletionRequest, warnings: string[]): void {
    if (request.temperature !== 1.0) {
      warnings.push(`temperature=${request.temperature} is not supported by Claude Code SDK and will be ignored`);
    }

    if (request.top_p !== 1.0) {
      warnings.push(`top_p=${request.top_p} is not supported by Claude Code SDK and will be ignored`);
    }

    if (request.max_tokens !== undefined) {
      warnings.push(`max_tokens=${request.max_tokens} is not supported by Claude Code SDK and will be ignored. Consider using max_turns to limit conversation length`);
    }

    if (request.presence_penalty !== 0) {
      warnings.push(`presence_penalty=${request.presence_penalty} is not supported by Claude Code SDK and will be ignored`);
    }

    if (request.frequency_penalty !== 0) {
      warnings.push(`frequency_penalty=${request.frequency_penalty} is not supported by Claude Code SDK and will be ignored`);
    }

    if (request.logit_bias) {
      warnings.push('logit_bias is not supported by Claude Code SDK and will be ignored');
    }

    if (request.stop) {
      warnings.push('stop sequences are not supported by Claude Code SDK and will be ignored');
    }

    if (request.stream === true) {
      warnings.push('Streaming responses have limited Claude Code SDK support');
    }
  }

  /**
   * Check if model is supported by Claude Code SDK
   */
  static isSupportedModel(model: string): boolean {
    return this.SUPPORTED_MODELS.has(model);
  }

  /**
   * Get list of supported models
   */
  static getSupportedModels(): string[] {
    return Array.from(this.SUPPORTED_MODELS);
  }


  /**
   * Validate tool message structure and required fields (Phase 9A)
   * @param message Tool message to validate
   * @param index Message index for error reporting
   * @returns Validation result with errors and warnings
   */
  static validateToolMessage(message: Message, index: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check role first
    if (message.role !== MESSAGE_ROLES.TOOL) {
      errors.push(`Message at index ${index} has invalid role '${message.role}' for tool message. Must be 'tool'`);
    }

    // Check required tool_call_id field
    if (!message.tool_call_id) {
      errors.push(`Tool message at index ${index} is missing required 'tool_call_id' field`);
    } else if (typeof message.tool_call_id !== 'string') {
      errors.push(`Tool message at index ${index} has invalid 'tool_call_id' type. Must be string`);
    } else if (!TOOL_MESSAGE_VALIDATION.TOOL_CALL_ID_PATTERN.test(message.tool_call_id)) {
      errors.push(`Tool message at index ${index} has invalid 'tool_call_id' format. Must match pattern: ${TOOL_MESSAGE_VALIDATION.TOOL_CALL_ID_PATTERN.source}`);
    }

    // Check content requirements for tool messages
    if (!message.content) {
      errors.push(`Tool message at index ${index} is missing required 'content' field`);
    } else {
      const contentLength = typeof message.content === 'string' 
        ? message.content.length 
        : JSON.stringify(message.content).length;

      if (contentLength > TOOL_MESSAGE_VALIDATION.MAX_CONTENT_LENGTH) {
        errors.push(`Tool message at index ${index} content exceeds maximum length of ${TOOL_MESSAGE_VALIDATION.MAX_CONTENT_LENGTH} characters`);
      }

      if (contentLength === 0) {
        errors.push(`Tool message at index ${index} has empty content`);
      }
    }

    // Validate tool message name if provided
    if (message.name && typeof message.name !== 'string') {
      errors.push(`Tool message at index ${index} has invalid 'name' type. Must be string if provided`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate tool call ID format (Phase 9A)
   * @param toolCallId Tool call ID to validate
   * @returns True if valid format
   */
  static validateToolCallId(toolCallId: string): boolean {
    if (!toolCallId || typeof toolCallId !== 'string') {
      logger.error(MESSAGE_PROCESSING_MESSAGES.TOOL_CALL_ID_INVALID);
      return false;
    }

    if (!TOOL_MESSAGE_VALIDATION.TOOL_CALL_ID_PATTERN.test(toolCallId)) {
      logger.error(`Tool call ID format invalid: ${toolCallId}`);
      return false;
    }

    return true;
  }

  /**
   * Validate tool message correlation (Phase 9A)
   * Ensures tool messages have valid structure for correlation
   * @param messages Array of messages to validate
   * @returns Validation result
   */
  static validateToolMessageCorrelation(messages: Message[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const toolCallIds = new Set<string>();

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      if (message.role === MESSAGE_ROLES.TOOL) {
        // Check for duplicate tool call IDs
        if (message.tool_call_id) {
          if (toolCallIds.has(message.tool_call_id)) {
            errors.push(`Duplicate tool_call_id '${message.tool_call_id}' found at message index ${i}`);
          } else {
            toolCallIds.add(message.tool_call_id);
          }
        }
      }
    }

    // Check for orphaned tool messages (tool messages without corresponding assistant messages)
    const assistantMessages = messages.filter(m => m.role === MESSAGE_ROLES.ASSISTANT);
    const toolMessages = messages.filter(m => m.role === MESSAGE_ROLES.TOOL);

    if (toolMessages.length > 0 && assistantMessages.length === 0) {
      warnings.push('Tool messages found without corresponding assistant messages. Tool messages should follow assistant messages that contain tool calls.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
