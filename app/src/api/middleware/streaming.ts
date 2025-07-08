import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

/**
 * Streaming middleware - Validates and prepares streaming requests
 * Single Responsibility: Streaming request validation and setup
 */

/**
 * Validate streaming request parameters
 */
export const validateStreamingRequest = (req: Request, res: Response, next: NextFunction): Response | void => {
  try {
    const { stream } = req.body;
    
    // If not a streaming request, continue normally
    if (!stream) {
      return next();
    }
    
    // Validate stream parameter is boolean
    if (typeof stream !== 'boolean') {
      return res.status(400).json({
        error: {
          message: 'stream parameter must be a boolean',
          type: 'invalid_request_error',
          code: 'invalid_stream_parameter'
        }
      });
    }
    
    logger.debug('Streaming request validated', { 
      isStreaming: stream,
      userAgent: req.headers['user-agent']
    });
    
    next();
    
  } catch (error) {
    logger.error('Streaming validation error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: {
        message: 'Internal server error during streaming validation',
        type: 'server_error',
        code: 'streaming_validation_error'
      }
    });
  }
};

/**
 * Setup streaming response headers early
 */
export const prepareStreamingResponse = (req: Request, res: Response, next: NextFunction): void => {
  const { stream } = req.body;
  
  if (stream) {
    // Disable response buffering for streaming
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Cache-Control', 'no-cache');
    
    logger.debug('Streaming response prepared', {
      headers: {
        'X-Accel-Buffering': 'no',
        'Cache-Control': 'no-cache'
      }
    });
  }
  
  next();
};

/**
 * Combined streaming middleware
 */
export const streamingMiddleware = [
  validateStreamingRequest,
  prepareStreamingResponse
];