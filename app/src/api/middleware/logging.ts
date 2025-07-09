import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Generate unique request ID
  req.requestId = uuidv4();
  req.startTime = Date.now();

  // Log incoming request
  const requestInfo = {
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    query: req.query,
    userAgent: req.get('user-agent'),
    ip: req.ip,
    requestId: req.requestId
  };

  // Log request body for non-GET requests (but be careful with large bodies)
  if (req.method !== 'GET' && req.body) {
    const bodySize = JSON.stringify(req.body).length;
    if (bodySize < 10000) { // Only log small bodies
      (requestInfo as any)['body'] = req.body;
    } else {
      (requestInfo as any)['bodySize'] = `${bodySize} bytes (too large to log)`;
    }
  }

  logger.http('request', `${req.method} ${req.originalUrl}`, requestInfo, req.requestId);

  // Capture response details
  const originalSend = res.send;
  const originalJson = res.json;
  
  res.send = function(body: any) {
    logResponse(req, res, body);
    return originalSend.call(this, body);
  };

  res.json = function(body: any) {
    logResponse(req, res, body);
    return originalJson.call(this, body);
  };

  // Handle streaming responses
  const originalWrite = res.write;
  const originalEnd = res.end;
  let responseBody = '';
  let isStreaming = false;

  res.write = function(chunk: any, encoding?: any) {
    if (typeof chunk === 'string') {
      responseBody += chunk;
      if (chunk.includes('data: ')) {
        isStreaming = true;
      }
    }
    return originalWrite.call(this, chunk, encoding);
  };

  res.end = function(chunk?: any, encoding?: any) {
    if (chunk && typeof chunk === 'string') {
      responseBody += chunk;
    }
    
    if (!res.headersSent) {
      logResponse(req, res, responseBody || null, isStreaming);
    }
    
    return originalEnd.call(this, chunk, encoding);
  };

  next();
}

function logResponse(req: Request, res: Response, body: any, isStreaming: boolean = false): void {
  const duration = req.startTime ? Date.now() - req.startTime : 0;
  
  const responseInfo = {
    statusCode: res.statusCode,
    statusMessage: res.statusMessage,
    headers: res.getHeaders(),
    duration: `${duration}ms`,
    requestId: req.requestId,
    isStreaming
  };

  // Log response body for small responses or streaming info
  if (isStreaming) {
    (responseInfo as any)['streamingData'] = 'SSE streaming response';
    (responseInfo as any)['firstChunk'] = body ? body.substring(0, 200) + '...' : null;
  } else if (body && typeof body === 'string' && body.length < 5000) {
    (responseInfo as any)['body'] = body;
  } else if (body && typeof body === 'object') {
    try {
      const bodyStr = JSON.stringify(body);
      if (bodyStr.length < 5000) {
        (responseInfo as any)['body'] = body;
      } else {
        (responseInfo as any)['bodySize'] = `${bodyStr.length} bytes (too large to log)`;
      }
    } catch (e) {
      (responseInfo as any)['bodyError'] = 'Failed to serialize response body';
    }
  }

  const statusClass = Math.floor(res.statusCode / 100);
  const logMessage = `${req.method} ${req.originalUrl} - ${res.statusCode} ${res.statusMessage} (${duration}ms)`;
  
  // Log as error for 5xx, warn for 4xx, info for others
  if (statusClass === 5) {
    logger.error(logMessage, undefined, responseInfo);
  } else if (statusClass === 4) {
    logger.warn(logMessage, responseInfo);
  } else {
    logger.http('response', logMessage, responseInfo, req.requestId);
  }
}

export function errorLoggingMiddleware(error: Error, req: Request, _res: Response, next: NextFunction): void {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    body: req.body
  };

  logger.error(`Unhandled error in ${req.method} ${req.originalUrl}`, error, errorInfo);
  
  // Don't handle the error, just log it
  next(error);
}