/**
 * Debug logging middleware
 * Based on Python main.py:188-247 DebugLoggingMiddleware
 * 
 * Single Responsibility: Request/response debug logging with timing
 */

import { Request, Response, NextFunction } from 'express';
import { getLogger } from '../utils/logger';

const logger = getLogger('DebugMiddleware');

export interface DebugConfig {
  enabled: boolean;
  verbose: boolean;
  maxBodySize?: number;
  logRequestBodies?: boolean;
  logResponseBodies?: boolean;
}

/**
 * Create debug logging middleware
 * Based on Python DebugLoggingMiddleware class behavior
 */
export function createDebugMiddleware(config: DebugConfig) {
  const { 
    enabled, 
    verbose, 
    maxBodySize = 100000, // 100KB limit like Python
    logRequestBodies = true,
    logResponseBodies = false 
  } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip if debug mode disabled (matches Python behavior)
    if (!enabled && !verbose) {
      return next();
    }

    const startTime = process.hrtime.bigint();
    const requestId = generateRequestId();

    // Log request details
    logRequestDetails(req, requestId, { 
      logBodies: logRequestBodies, 
      maxBodySize,
      verbose 
    });

    // Capture original response methods for timing
    const originalSend = res.send;
    const originalJson = res.json;

    // Override send to capture response timing
    res.send = function(body?: any) {
      logResponseDetails(req, res, body, startTime, requestId, {
        logBodies: logResponseBodies,
        verbose
      });
      return originalSend.call(this, body);
    };

    // Override json to capture JSON response timing
    res.json = function(obj: any) {
      logResponseDetails(req, res, obj, startTime, requestId, {
        logBodies: logResponseBodies,
        verbose
      });
      return originalJson.call(this, obj);
    };

    next();
  };
}

/**
 * Generate unique request ID for correlation
 */
function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Log request details with body inspection
 * Based on Python request logging logic
 */
function logRequestDetails(
  req: Request, 
  requestId: string, 
  options: { logBodies: boolean; maxBodySize: number; verbose: boolean }
): void {
  const { logBodies, maxBodySize, verbose } = options;

  // Basic request info (always logged in debug mode)
  logger.info(`🔍 [${requestId}] ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length')
  });

  // Enhanced logging in verbose mode
  if (verbose) {
    logger.debug(`📋 [${requestId}] Request headers:`, {
      headers: sanitizeHeaders(req.headers)
    });
  }

  // Log request body for POST requests (like Python behavior)
  if (logBodies && req.method === 'POST' && req.path.startsWith('/v1/')) {
    const contentLength = req.get('Content-Length');
    
    if (contentLength && parseInt(contentLength) < maxBodySize) {
      try {
        // Request body should be available if body parser middleware ran
        if (req.body) {
          const bodyStr = typeof req.body === 'string' 
            ? req.body 
            : JSON.stringify(req.body);
          
          logger.debug(`📝 [${requestId}] Request body:`, {
            body: truncateBody(bodyStr, 1000) // Truncate for readability
          });
        }
      } catch (error) {
        logger.warn(`❌ [${requestId}] Failed to log request body: ${error}`);
      }
    } else {
      logger.debug(`📝 [${requestId}] Request body too large to log (${contentLength} bytes)`);
    }
  }
}

/**
 * Log response details with timing
 * Based on Python response timing logic
 */
function logResponseDetails(
  req: Request,
  res: Response,
  body: any,
  startTime: bigint,
  requestId: string,
  options: { logBodies: boolean; verbose: boolean }
): void {
  const { logBodies, verbose } = options;
  
  // Calculate duration in milliseconds (matches Python timing)
  const endTime = process.hrtime.bigint();
  const durationMs = Number(endTime - startTime) / 1000000;

  // Status emoji based on response code (like Python)
  const statusEmoji = getStatusEmoji(res.statusCode);
  
  logger.info(`${statusEmoji} [${requestId}] ${req.method} ${req.path} → ${res.statusCode} (${durationMs.toFixed(2)}ms)`, {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    duration: durationMs,
    contentType: res.get('Content-Type')
  });

  // Log response body in verbose mode
  if (verbose && logBodies && body) {
    try {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      logger.debug(`📤 [${requestId}] Response body:`, {
        body: truncateBody(bodyStr, 500) // Smaller truncation for responses
      });
    } catch (error) {
      logger.warn(`❌ [${requestId}] Failed to log response body: ${error}`);
    }
  }
}

/**
 * Get status emoji based on HTTP status code
 * Matches Python emoji patterns
 */
function getStatusEmoji(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) return '✅';
  if (statusCode >= 300 && statusCode < 400) return '🔄';
  if (statusCode >= 400 && statusCode < 500) return '❌';
  if (statusCode >= 500) return '💥';
  return '❓';
}

/**
 * Sanitize headers for logging (remove sensitive data)
 */
function sanitizeHeaders(headers: any): any {
  const sanitized = { ...headers };
  
  // Remove or mask sensitive headers
  if (sanitized.authorization) {
    sanitized.authorization = 'Bearer ***';
  }
  
  if (sanitized.cookie) {
    sanitized.cookie = '[REDACTED]';
  }

  return sanitized;
}

/**
 * Truncate body for logging readability
 */
function truncateBody(body: string, maxLength: number): string {
  if (body.length <= maxLength) {
    return body;
  }
  
  return body.substring(0, maxLength) + `... [truncated ${body.length - maxLength} chars]`;
}

/**
 * Create debug middleware with environment-based configuration
 * Matches Python environment variable behavior
 */
export function createDebugMiddlewareFromEnv(): (req: Request, res: Response, next: NextFunction) => void {
  const debugMode = process.env.DEBUG_MODE?.toLowerCase() === 'true';
  const verbose = process.env.VERBOSE?.toLowerCase() === 'true';
  
  const maxBodySize = parseInt(process.env.DEBUG_MAX_BODY_SIZE || '100000');
  
  const config: DebugConfig = {
    enabled: debugMode,
    verbose: verbose,
    maxBodySize: isNaN(maxBodySize) ? 100000 : maxBodySize,
    logRequestBodies: process.env.DEBUG_LOG_REQUEST_BODIES?.toLowerCase() !== 'false',
    logResponseBodies: process.env.DEBUG_LOG_RESPONSE_BODIES?.toLowerCase() === 'true'
  };

  logger.debug('Debug middleware configuration:', config);
  
  return createDebugMiddleware(config);
}