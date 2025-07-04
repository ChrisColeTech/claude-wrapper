/**
 * Chat request validation service
 * Single Responsibility: Validate chat completion requests
 */

import { ParameterValidator } from '../validation/validator';
import { ChatCompletionRequest } from '../models/chat';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class RequestValidator {
  /**
   * Validate chat completion request
   */
  validateChatRequest(body: any): ValidationResult {
    const errors: string[] = [];

    // Basic structure validation
    if (!body || typeof body !== 'object') {
      return {
        isValid: false,
        errors: ['Request body must be a valid JSON object']
      };
    }

    // Model validation
    if (!body.model || typeof body.model !== 'string') {
      errors.push('Model parameter is required and must be a string');
    }

    // Messages validation
    if (!body.messages || !Array.isArray(body.messages)) {
      errors.push('Messages parameter is required and must be an array');
    } else if (body.messages.length === 0) {
      errors.push('Messages array cannot be empty');
    } else {
      // Validate each message
      body.messages.forEach((message: any, index: number) => {
        if (!message || typeof message !== 'object') {
          errors.push(`Message at index ${index} must be an object`);
        } else {
          if (!message.role || typeof message.role !== 'string') {
            errors.push(`Message at index ${index} must have a valid role`);
          } else if (!['system', 'user', 'assistant'].includes(message.role)) {
            errors.push(`Message at index ${index} has invalid role: ${message.role}`);
          }

          if (!message.content || typeof message.content !== 'string') {
            errors.push(`Message at index ${index} must have valid content`);
          }
        }
      });
    }

    // Optional parameter validation
    if (body.temperature !== undefined) {
      if (typeof body.temperature !== 'number' || body.temperature < 0 || body.temperature > 2) {
        errors.push('Temperature must be a number between 0 and 2');
      }
    }

    if (body.top_p !== undefined) {
      if (typeof body.top_p !== 'number' || body.top_p < 0 || body.top_p > 1) {
        errors.push('Top_p must be a number between 0 and 1');
      }
    }

    if (body.max_tokens !== undefined) {
      if (typeof body.max_tokens !== 'number' || body.max_tokens < 1) {
        errors.push('Max_tokens must be a positive number');
      }
    }

    if (body.stream !== undefined) {
      if (typeof body.stream !== 'boolean') {
        errors.push('Stream must be a boolean');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate request using parameter validator
   */
  validateWithParameterValidator(request: ChatCompletionRequest): ValidationResult {
    const validation = ParameterValidator.validateRequest(request);
    
    return {
      isValid: validation.valid,
      errors: validation.errors
    };
  }

  /**
   * Validate model support
   */
  validateModelSupport(model: string): ValidationResult {
    const validation = ParameterValidator.validateModel(model);
    
    return {
      isValid: validation.valid,
      errors: validation.errors
    };
  }
}

export const requestValidator = new RequestValidator();