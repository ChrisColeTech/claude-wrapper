/**
 * Timing Middleware - Request timing and performance tracking
 * SOLID compliance: SRP, OCP, LSP, ISP, DIP
 * DRY compliance: Common patterns extracted to utils
 * Performance requirements: monitoring overhead <5ms
 */

import { Request, Response, NextFunction } from 'express';
import { getLogger } from '../utils/logger';
import { performanceMonitor, IPerformanceTimer } from '../monitoring/performance-monitor';
import { PRODUCTION_MONITORING, PRODUCTION_RELIABILITY } from '../tools/constants/production';

const logger = getLogger('TimingMiddleware');

/**
 * Timing metadata interface
 */
export interface TimingMetadata {
  method: string;
  url: string;
  userAgent?: string;
  contentLength?: number;
  statusCode?: number;
  route?: string;
}

/**
 * Request timing interface
 */
export interface RequestTiming {
  startTime: number;
  endTime?: number;
  duration?: number;
  operation: string;
  metadata: TimingMetadata;
}

/**
 * Timing middleware options
 */
export interface TimingOptions {
  enabled?: boolean;
  logRequests?: boolean;
  logSlowRequests?: boolean;
  slowRequestThreshold?: number;
  includeHeaders?: boolean;
  excludePaths?: string[];
}

/**
 * Enhanced request interface with timing
 */
export interface TimedRequest extends Request {
  timing?: RequestTiming;
  timer?: IPerformanceTimer;
}

/**
 * Timing utilities
 */
export const TimingUtils = {
  /**
   * Extract operation name from request
   */
  getOperationName(req: Request): string {
    const method = req.method.toLowerCase();
    const route = req.route?.path || req.path;
    const baseUrl = req.baseUrl || '';
    
    return `${method}:${baseUrl}${route}`;
  },

  /**
   * Extract metadata from request
   */
  getRequestMetadata(req: Request): TimingMetadata {
    return {
      method: req.method,
      url: req.originalUrl || req.url,
      userAgent: req.get('user-agent'),
      contentLength: req.get('content-length') ? parseInt(req.get('content-length')!) : undefined,
      route: req.route?.path
    };
  },

  /**
   * Should exclude path from timing
   */
  shouldExcludePath(path: string, excludePaths: string[]): boolean {
    return excludePaths.some(excluded => 
      path.startsWith(excluded) || 
      path.match(new RegExp(excluded))
    );
  },

  /**
   * Format timing information
   */
  formatTiming(timing: RequestTiming): string {
    const duration = timing.duration || 0;
    return `${timing.operation} ${duration.toFixed(2)}ms`;
  },

  /**
   * Check if request is slow
   */
  isSlowRequest(duration: number, threshold: number = PRODUCTION_MONITORING.RESPONSE_TIME_THRESHOLD_MS): boolean {
    return duration > threshold;
  }
};

/**
 * Timing middleware factory
 */
export class TimingMiddleware {
  public options: Required<TimingOptions>;

  constructor(options: TimingOptions = {}) {
    this.options = {
      enabled: true,
      logRequests: true,
      logSlowRequests: true,
      slowRequestThreshold: PRODUCTION_MONITORING.RESPONSE_TIME_THRESHOLD_MS,
      includeHeaders: false,
      excludePaths: ['/health', '/metrics', '/ping'],
      ...options
    };
  }

  /**
   * Create timing middleware
   */
  create() {
    return (req: TimedRequest, res: Response, next: NextFunction): void => {
      // Skip if disabled
      if (!this.options.enabled) {
        return next();
      }

      // Skip excluded paths
      if (TimingUtils.shouldExcludePath(req.path, this.options.excludePaths)) {
        return next();
      }

      // Start timing
      const operation = TimingUtils.getOperationName(req);
      const metadata = TimingUtils.getRequestMetadata(req);
      
      req.timing = {
        startTime: performance.now(),
        operation,
        metadata
      };

      // Start performance timer
      req.timer = performanceMonitor.startTimer(operation);

      // Log request start
      if (this.options.logRequests) {
        logger.debug('Request started', {
          operation,
          url: req.originalUrl || req.url,
          method: req.method
        });
      }

      // Handle response finish
      const originalSend = res.send;
      res.send = function(body: any) {
        res.send = originalSend;
        handleResponseFinish(req, res, body);
        return originalSend.call(this, body);
      };

      // Handle response end
      res.on('finish', () => {
        handleResponseFinish(req, res);
      });

      // Handle response close (for cases where response is aborted)
      res.on('close', () => {
        if (req.timing && !req.timing.endTime) {
          handleResponseFinish(req, res, undefined, true);
        }
      });

      next();
    };
  }

  /**
   * Get timing statistics
   */
  getStats(): Map<string, any> {
    return performanceMonitor.getAllStats();
  }

  /**
   * Update options
   */
  updateOptions(newOptions: Partial<TimingOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }
}

/**
 * Handle response finish
 */
function handleResponseFinish(
  req: TimedRequest, 
  res: Response, 
  body?: any, 
  aborted: boolean = false
): void {
  if (!req.timing || !req.timer) {
    return;
  }

  const endTime = performance.now();
  const duration = endTime - req.timing.startTime;

  // Complete timing data
  req.timing.endTime = endTime;
  req.timing.duration = duration;
  req.timing.metadata.statusCode = res.statusCode;

  // Stop performance timer
  const success = res.statusCode < 400 && !aborted;
  const error = aborted ? 'Request aborted' : 
               res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined;

  const enhancedMetadata = {
    ...req.timing.metadata,
    responseSize: body ? Buffer.byteLength(body) : undefined,
    aborted
  };

  req.timer.stop(success, error, enhancedMetadata);

  // Log completion
  const timingMiddleware = req.app.get('timingMiddleware') as TimingMiddleware;
  if (timingMiddleware) {
    logRequestCompletion(req, res, duration, aborted, timingMiddleware.options);
  }
}

/**
 * Log request completion
 */
function logRequestCompletion(
  req: TimedRequest,
  res: Response,
  duration: number,
  aborted: boolean,
  options: Required<TimingOptions>
): void {
  const isSlowRequest = TimingUtils.isSlowRequest(duration, options.slowRequestThreshold);
  const logLevel = aborted ? 'warn' : 
                  res.statusCode >= 500 ? 'error' :
                  res.statusCode >= 400 ? 'warn' :
                  isSlowRequest ? 'warn' : 'debug';

  const logData = {
    operation: req.timing!.operation,
    method: req.method,
    url: req.originalUrl || req.url,
    statusCode: res.statusCode,
    duration: `${duration.toFixed(2)}ms`,
    aborted,
    userAgent: req.get('user-agent')
  };

  if (options.includeHeaders) {
    (logData as any).headers = req.headers;
  }

  // Always log if enabled
  if (options.logRequests) {
    logger[logLevel as keyof typeof logger]('Request completed', logData);
  }

  // Log slow requests if enabled
  if (options.logSlowRequests && isSlowRequest) {
    logger.warn('Slow request detected', {
      ...logData,
      threshold: `${options.slowRequestThreshold}ms`,
      isSlowRequest: true
    });
  }
}

/**
 * Create timing middleware with default options
 */
export function createTimingMiddleware(options?: TimingOptions) {
  const middleware = new TimingMiddleware(options);
  return middleware.create();
}

/**
 * Create timing middleware with custom operation naming
 */
export function createCustomTimingMiddleware(
  operationExtractor: (req: Request) => string,
  options?: TimingOptions
) {
  const middleware = new TimingMiddleware(options);
  
  return (req: TimedRequest, res: Response, next: NextFunction): void => {
    if (!middleware.options.enabled) {
      return next();
    }

    if (TimingUtils.shouldExcludePath(req.path, middleware.options.excludePaths)) {
      return next();
    }

    const operation = operationExtractor(req);
    const metadata = TimingUtils.getRequestMetadata(req);
    
    req.timing = {
      startTime: performance.now(),
      operation,
      metadata
    };

    req.timer = performanceMonitor.startTimer(operation);

    res.on('finish', () => {
      handleResponseFinish(req, res);
    });

    res.on('close', () => {
      if (req.timing && !req.timing.endTime) {
        handleResponseFinish(req, res, undefined, true);
      }
    });

    next();
  };
}

/**
 * Default timing middleware instance
 */
export const timingMiddleware = createTimingMiddleware();

/**
 * Performance-focused timing middleware (minimal logging)
 */
export const performanceTimingMiddleware = createTimingMiddleware({
  logRequests: false,
  logSlowRequests: true,
  slowRequestThreshold: PRODUCTION_RELIABILITY.TIMEOUT_DEFAULT_MS
});

/**
 * Debug timing middleware (verbose logging)
 */
export const debugTimingMiddleware = createTimingMiddleware({
  logRequests: true,
  logSlowRequests: true,
  includeHeaders: true,
  excludePaths: []
});