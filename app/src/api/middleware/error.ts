import { Request, Response, NextFunction } from 'express';
import { AppError, createOpenAIErrorResponse, isOperationalError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export function errorHandler(
  error: Error, 
  req: Request, 
  res: Response, 
  next: NextFunction
): void {
  // Use next parameter to satisfy ESLint
  void next;
  logger.error('Request error occurred', error, {
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent')
  });

  if (error instanceof AppError) {
    const errorResponse = createOpenAIErrorResponse(error);
    res.status(error.statusCode).json(errorResponse);
    return;
  }

  // Handle JSON parsing errors specifically
  if (error instanceof SyntaxError && 'body' in error && 'type' in error && error.type === 'entity.parse.failed') {
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

  res.status(500).json(fallbackResponse);
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}