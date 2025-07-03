/**
 * Request validation middleware
 * Based on Python main.py:250-305 validation exception handlers
 * 
 * Single Responsibility: Request validation with detailed error responses
 */

import { Request, Response, NextFunction } from 'express';
import { ParameterValidator } from '../validation/validator';
import { ChatCompletionRequest } from '../models/chat';
import { createValidationError } from './error';
import { getLogger } from '../utils/logger';

const logger = getLogger('ValidationMiddleware');

/**
 * Validation configuration
 */
export interface ValidationConfig {
  enableDebugInfo: boolean;
  includeRawBody: boolean;
  logValidationErrors: boolean;
}

/**
 * Create chat completion request validation middleware
 * Based on Python RequestValidationError handling
 */
export function createChatCompletionValidationMiddleware(
  config: ValidationConfig = {
    enableDebugInfo: process.env.DEBUG_MODE?.toLowerCase() === 'true',
    includeRawBody: process.env.VERBOSE?.toLowerCase() === 'true',
    logValidationErrors: true
  }
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Only validate chat completion requests
      if (!req.path.includes('/chat/completions')) {
        return next();
      }

      // Ensure request body exists
      if (!req.body) {
        const error = createValidationError({
          valid: false,
          errors: ['Request body is required'],
          warnings: []
        });
        return next(error);
      }

      // Cast to chat completion request for validation
      const chatRequest = req.body as ChatCompletionRequest;
      
      // Validate request using parameter validator
      const validationResult = ParameterValidator.validateRequest(chatRequest);
      
      if (!validationResult.valid) {
        if (config.logValidationErrors) {
          logger.error(`❌ Request validation failed for ${req.method} ${req.url}`, {
            errors: validationResult.errors,
            warnings: validationResult.warnings,
            requestBody: config.includeRawBody ? chatRequest : '[REDACTED]'
          });
        }

        // Create detailed validation error
        const validationError = createValidationError(validationResult);
        
        // Add debug information if enabled
        if (config.enableDebugInfo) {
          validationError.details = {
            ...validationError.details,
            request_info: {
              method: req.method,
              path: req.path,
              content_type: req.get('Content-Type'),
              user_agent: req.get('User-Agent')
            }
          };
          
          if (config.includeRawBody) {
            validationError.details.raw_request_body = chatRequest;
          }
        }

        return next(validationError);
      }

      // Log warnings if any (non-blocking)
      if (validationResult.warnings.length > 0 && config.logValidationErrors) {
        logger.warn(`⚠️ Request validation warnings for ${req.method} ${req.url}`, {
          warnings: validationResult.warnings
        });
      }

      // Validation passed - continue to next middleware
      next();

    } catch (error) {
      logger.error(`Validation middleware error: ${error}`);
      const validationError = createValidationError({
        valid: false,
        errors: ['Internal validation error'],
        warnings: []
      });
      next(validationError);
    }
  };
}

/**
 * Generic request validation middleware
 * For basic request structure validation
 */
export function createGenericValidationMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate content type for POST requests
      if (req.method === 'POST') {
        const contentType = req.get('Content-Type');
        
        if (!contentType?.includes('application/json')) {
          const error = createValidationError({
            valid: false,
            errors: ['Content-Type must be application/json for POST requests'],
            warnings: []
          }, 'content-type');
          return next(error);
        }
      }

      // Validate content length
      const contentLength = req.get('Content-Length');
      if (contentLength && parseInt(contentLength) > 10485760) { // 10MB limit
        const error = createValidationError({
          valid: false,
          errors: ['Request body too large (max 10MB)'],
          warnings: []
        }, 'content-length');
        return next(error);
      }

      next();

    } catch (error) {
      logger.error(`Generic validation middleware error: ${error}`);
      next(error);
    }
  };
}

/**
 * Header validation middleware
 * Validates required headers and API key format
 */
export function createHeaderValidationMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const errors: string[] = [];
      
      // Validate authorization header format if present
      const authHeader = req.get('Authorization');
      if (authHeader && !authHeader.match(/^Bearer\s+.+$/i)) {
        errors.push('Invalid Authorization header format. Expected: Bearer <token>');
      }

      // Validate Claude-specific headers if present
      const claudeHeaders = Object.keys(req.headers).filter(header => 
        header.toLowerCase().startsWith('x-claude-')
      );
      
      for (const header of claudeHeaders) {
        const value = req.get(header);
        if (value === '') {
          errors.push(`Claude header ${header} cannot be empty`);
        }
      }

      if (errors.length > 0) {
        const error = createValidationError({
          valid: false,
          errors,
          warnings: []
        }, 'headers');
        return next(error);
      }

      next();

    } catch (error) {
      logger.error(`Header validation middleware error: ${error}`);
      next(error);
    }
  };
}

/**
 * Model validation middleware
 * Validates model parameter specifically
 */
export function createModelValidationMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Only validate requests with model parameter
      if (!req.body?.model) {
        return next();
      }

      const model = req.body.model;
      const modelValidation = ParameterValidator.validateModel(model);
      
      if (!modelValidation.valid) {
        const error = createValidationError(modelValidation, 'model');
        return next(error);
      }

      // Log model warnings
      if (modelValidation.warnings.length > 0) {
        logger.warn(`Model validation warnings for ${model}:`, {
          warnings: modelValidation.warnings
        });
      }

      next();

    } catch (error) {
      logger.error(`Model validation middleware error: ${error}`);
      next(error);
    }
  };
}

/**
 * Create validation middleware stack
 * Based on Python middleware ordering
 */
export function createValidationMiddlewareStack(config?: Partial<ValidationConfig>) {
  const validationConfig: ValidationConfig = {
    enableDebugInfo: process.env.DEBUG_MODE?.toLowerCase() === 'true',
    includeRawBody: process.env.VERBOSE?.toLowerCase() === 'true',
    logValidationErrors: true,
    ...config
  };

  return [
    createGenericValidationMiddleware(),
    createHeaderValidationMiddleware(), 
    createModelValidationMiddleware(),
    createChatCompletionValidationMiddleware(validationConfig)
  ];
}