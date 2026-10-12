import { Request, Response, NextFunction } from 'express';
import { AppError, createOpenAIErrorResponse, isOperationalError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { anthropicError, isAnthropicMessagesPath } from '../anthropic';

export function errorHandler(
  error: Error, 
  req: Request, 
  res: Response, 
  next: NextFunction
): void {
  // Use next parameter to satisfy ESLint
  void next;
  const isAnthropic = isAnthropicMessagesPath(req.path);
  logger.error('Request error occurred', isAnthropic ? undefined : error, {
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent')
  });

  if (error instanceof AppError) {
    if (isAnthropic) {
      res.status(error.statusCode).json(anthropicError(error.code, error.message));
      return;
    }
    const errorResponse = createOpenAIErrorResponse(error);
    res.status(error.statusCode).json(errorResponse);
    return;
  }

  // Handle JSON parsing errors specifically
  if (error instanceof SyntaxError && 'body' in error && 'type' in error && error.type === 'entity.parse.failed') {
    if (isAnthropic) {
      res.status(400).json(anthropicError('invalid_request_error', 'Invalid JSON format'));
      return;
    }
    res.status(400).json({
      error: {
        message: 'Invalid JSON format',
        type: 'invalid_request_error',
        code: 'parse_error'
      }
    });
    return;
  }

  if (!isOperationalError(error)) {
    logger.error('Non-operational error occurred', error);
  }

  const fallbackResponse = {
    error: {
      message: 'Internal server error',
      type: 'api_error',
      code: 'internal_error'
    }
  };

  if (isAnthropic) {
    res.status(500).json(anthropicError('api_error', 'Internal server error'));
    return;
  }

  res.status(500).json(fallbackResponse);
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
