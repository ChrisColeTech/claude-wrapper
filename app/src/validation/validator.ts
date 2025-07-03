/**
 * Parameter validator for chat completion requests
 * Based on Python parameter_validator.py ParameterValidator class
 * Implements Python-compatible validation logic for Phase 3B
 */

import { ChatCompletionRequest } from '../models/chat';
import { Message } from '../models/message';
import { getLogger } from '../utils/logger';

const logger = getLogger('ParameterValidator');

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class ParameterValidator {
  /**
   * Supported Claude Code SDK models (matches Python SUPPORTED_MODELS)
   * Based on Python parameter_validator.py model list
   */
  static readonly SUPPORTED_MODELS = new Set([
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
    'claude-haiku-4-20250514',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
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
   * Validate messages array
   * Based on Python ParameterValidator.validate_messages()
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
      } else if (!['system', 'user', 'assistant'].includes(message.role)) {
        errors.push(`Message at index ${i} has invalid role '${message.role}'. Must be 'system', 'user', or 'assistant'`);
      }

      if (!message.content) {
        errors.push(`Message at index ${i} is missing required 'content' field`);
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
}
