/**
 * Parameter validator for chat completion requests
 * Based on Python parameter_validator.py ParameterValidator class
 * Implements Python-compatible validation logic for Phase 3B
 */

import { ChatCompletionRequest } from '../models/chat';
import { Message, MessageValidation } from '../models/message';
import { getLogger } from '../utils/logger';
import { toolValidator } from '../tools';
import { 
  MESSAGE_ROLES, 
  MESSAGE_PROCESSING_MESSAGES,
  TOOL_MESSAGE_VALIDATION 
} from '../tools/constants';

const logger = getLogger('ParameterValidator');

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class ParameterValidator {
  /**
   * Supported Claude Code SDK models (matches Python SUPPORTED_MODELS exactly)
   * Based on Python parameter_validator.py:16-22 model list
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
   * Based on Python ParameterValidator.validate_request()
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

    // Validate OpenAI tools if provided
    if (request.tools || request.tool_choice) {
      const toolsResult = this.validateOpenAITools(request.tools, request.tool_choice);
      errors.push(...toolsResult.errors);
      warnings.push(...toolsResult.warnings);
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

    // Log warnings for unsupported parameters (matches Python behavior)
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
   * Validate model parameter
   * Based on Python ParameterValidator.validate_model()
   */
  static validateModel(model: string): ValidationResult {
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
   * Validate OpenAI tools array and tool choice
   * Based on Phase 1A OpenAI tools validation requirements
   */
  static validateOpenAITools(tools?: any[], toolChoice?: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (tools) {
        const toolsResult = toolValidator.validateToolArray(tools);
        if (!toolsResult.valid) {
          errors.push(...toolsResult.errors);
        }
        
        if (toolChoice) {
          const choiceResult = toolValidator.validateToolChoice(toolChoice, toolsResult.validTools);
          if (!choiceResult.valid) {
            errors.push(...choiceResult.errors);
          }
        }
      } else if (toolChoice) {
        errors.push('tool_choice parameter provided without tools array');
      }
    } catch (error) {
      errors.push(`Tools validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
   * Log warnings for unsupported parameters (matches Python behavior)
   * Based on Python parameter_validator.py log_unsupported_parameters()
   */
  private static logUnsupportedParameterWarnings(request: ChatCompletionRequest, warnings: string[]): void {
    // Check for non-default values that aren't supported by Claude Code SDK
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
   * Valid permission modes for Claude Code SDK
   * Based on Python parameter_validator.py:25 VALID_PERMISSION_MODES
   */
  static readonly VALID_PERMISSION_MODES = new Set([
    'default',
    'acceptEdits', 
    'bypassPermissions'
  ]);

  /**
   * Validate permission mode parameter
   * Based on Python ParameterValidator.validate_permission_mode()
   */
  static validatePermissionMode(permissionMode: string): boolean {
    if (!this.VALID_PERMISSION_MODES.has(permissionMode)) {
      logger.error(`Invalid permission_mode '${permissionMode}'. Valid options: ${Array.from(this.VALID_PERMISSION_MODES).join(', ')}`);
      return false;
    }
    return true;
  }

  /**
   * Validate tool names (basic validation for non-empty strings)
   * Based on Python ParameterValidator.validate_tools()
   */
  static validateTools(tools: string[]): boolean {
    if (!tools.every(tool => typeof tool === 'string' && tool.trim().length > 0)) {
      logger.error('All tool names must be non-empty strings');
      return false;
    }
    return true;
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

  /**
   * Create enhanced Claude Code SDK options with additional parameters
   * Based on Python ParameterValidator.create_enhanced_options() lines 52-93
   * 
   * This allows API users to pass Claude-Code-specific parameters that don't
   * exist in the OpenAI API through custom headers or environment variables.
   */
  static createEnhancedOptions(
    request: ChatCompletionRequest,
    maxTurns?: number,
    allowedTools?: string[],
    disallowedTools?: string[],
    permissionMode?: string,
    maxThinkingTokens?: number
  ): Record<string, any> {
    // Start with basic options from request (would normally come from request.to_claude_options())
    const options: Record<string, any> = {
      model: request.model,
      messages: request.messages,
      stream: request.stream,
      user: request.user
    };

    // Add Claude Code SDK specific options
    if (maxTurns !== undefined) {
      if (maxTurns < 1 || maxTurns > 100) {
        logger.warn(`max_turns=${maxTurns} is outside recommended range (1-100)`);
      }
      options.max_turns = maxTurns;
    }

    if (allowedTools) {
      if (this.validateTools(allowedTools)) {
        options.allowed_tools = allowedTools;
      }
    }

    if (disallowedTools) {
      if (this.validateTools(disallowedTools)) {
        options.disallowed_tools = disallowedTools;
      }
    }

    if (permissionMode) {
      if (this.validatePermissionMode(permissionMode)) {
        options.permission_mode = permissionMode;
      }
    }

    if (maxThinkingTokens !== undefined) {
      if (maxThinkingTokens < 0 || maxThinkingTokens > 50000) {
        logger.warn(`max_thinking_tokens=${maxThinkingTokens} is outside recommended range (0-50000)`);
      }
      options.max_thinking_tokens = maxThinkingTokens;
    }

    return options;
  }
}
