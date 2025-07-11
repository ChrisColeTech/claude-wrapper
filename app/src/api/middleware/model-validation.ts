import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

// Valid Claude models - only confirmed models from CLI reference
const VALID_CLAUDE_MODELS = ['sonnet', 'opus'];

export class ModelValidationError extends Error {
  public readonly statusCode: number;
  public readonly type: string;
  public readonly code: string;

  constructor(message: string, providedModel?: string) {
    super(message);
    this.name = 'ModelValidationError';
    this.statusCode = 400;
    this.type = 'invalid_request_error';
    this.code = 'model_not_found';
    
    if (providedModel) {
      this.message = `The model '${providedModel}' does not exist. Valid models are: ${VALID_CLAUDE_MODELS.join(', ')}`;
    }
  }
}

/**
 * Validates if the provided model is a valid Claude model
 * @param model - The model string to validate
 * @returns boolean indicating if the model is valid
 */
export function isValidClaudeModel(model: string): boolean {
  if (!model || typeof model !== 'string') {
    return false;
  }

  // Only accept exact matches from the confirmed list
  return VALID_CLAUDE_MODELS.includes(model.toLowerCase());
}

/**
 * Express middleware for validating Claude models in requests
 * Returns OpenAI-compatible error responses for invalid models
 */
export function modelValidationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { model } = req.body;

  // Skip validation if no model provided (will be caught by other validation)
  if (!model) {
    return next();
  }

  logger.debug('Validating model', { model });

  if (!isValidClaudeModel(model)) {
    logger.warn('Invalid model provided', { 
      model, 
      validModels: VALID_CLAUDE_MODELS,
      endpoint: req.path 
    });

    const error = new ModelValidationError(
      `The model '${model}' does not exist. Valid models are: ${VALID_CLAUDE_MODELS.join(', ')}`,
      model
    );

    // Return OpenAI-compatible error response
    res.status(400).json({
      error: {
        message: error.message,
        type: error.type,
        param: 'model',
        code: error.code
      }
    });
    return;
  }

  logger.debug('Model validation passed', { model });
  next();
}

/**
 * Get list of valid Claude models for reference
 */
export function getValidModels(): string[] {
  return [...VALID_CLAUDE_MODELS];
}