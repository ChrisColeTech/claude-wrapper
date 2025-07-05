/**
 * Request ID Generation and Tracking System
 * Comprehensive request correlation for error tracking and debugging
 * 
 * Single Responsibility: Request ID lifecycle management and correlation
 * Integrates with error handling for comprehensive request tracking
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { config } from '../utils/env';
import winston from 'winston';
import { randomBytes, createHash } from 'crypto';

/**
 * Request metadata for correlation and tracking
 */
export interface RequestMetadata {
  requestId: string;
  correlationId?: string;
  parentRequestId?: string;
  timestamp: Date;
  method: string;
  endpoint: string;
  userAgent?: string;
  clientIP?: string;
  duration?: number;
  statusCode?: number;
  errorOccurred: boolean;
  errorCount: number;
}

/**
 * Request tracking statistics
 */
export interface RequestTrackingStats {
  totalRequests: number;
  activeRequests: number;
  completedRequests: number;
  errorRequests: number;
  averageDuration: number;
  requestsPerSecond: number;
  lastActivity: Date;
}

/**
 * Request context for correlation
 */
export interface RequestContext {
  requestId: string;
  startTime: Date;
  metadata: RequestMetadata;
  correlatedData: Map<string, any>;
}

/**
 * Production-grade request ID manager with comprehensive tracking
 * Follows SRP: handles only request ID generation and correlation
 */
export class RequestIdManager {
  private logger: winston.Logger;
  private activeRequests: Map<string, RequestContext> = new Map();
  private completedRequests: RequestMetadata[] = [];
  private statistics: RequestTrackingStats;
  private maxHistorySize: number = 10000;

  constructor() {
    this.logger = createLogger(config);
    
    this.statistics = {
      totalRequests: 0,
      activeRequests: 0,
      completedRequests: 0,
      errorRequests: 0,
      averageDuration: 0,
      requestsPerSecond: 0,
      lastActivity: new Date()
    };

    // Cleanup old requests periodically
    this.startCleanupScheduler();
  }

  /**
   * Generate unique request ID with entropy and timestamp
   */
  generateRequestId(prefix: string = 'req'): string {
    const timestamp = Date.now().toString(36);
    const entropy = randomBytes(8).toString('hex');
    const sequence = this.statistics.totalRequests.toString(36);
    
    return `${prefix}_${timestamp}_${entropy}_${sequence}`;
  }

  /**
   * Generate correlation ID for related requests
   */
  generateCorrelationId(): string {
    const timestamp = Date.now();
    const hash = createHash('sha256')
      .update(`${timestamp}_${randomBytes(16).toString('hex')}`)
      .digest('hex')
      .substring(0, 16);
    
    return `corr_${hash}`;
  }

  /**
   * Express middleware for request ID injection and tracking
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const startTime = Date.now();
      
      try {
        // Generate or extract request ID
        const requestId = this.extractOrGenerateRequestId(req);
        
        // Create request metadata
        const metadata: RequestMetadata = {
          requestId,
          correlationId: this.extractCorrelationId(req),
          parentRequestId: this.extractParentRequestId(req),
          timestamp: new Date(),
          method: req.method,
          endpoint: this.normalizeEndpoint(req.path),
          userAgent: req.get('User-Agent'),
          clientIP: this.extractClientIP(req),
          errorOccurred: false,
          errorCount: 0
        };

        // Create request context
        const context: RequestContext = {
          requestId,
          startTime: new Date(),
          metadata,
          correlatedData: new Map()
        };

        // Store in active requests
        this.activeRequests.set(requestId, context);
        
        // Inject into request and response
        req.requestId = requestId;
        req.requestMetadata = metadata;
        req.requestContext = context;
        
        // Set response headers
        res.setHeader('X-Request-ID', requestId);
        if (metadata.correlationId) {
          res.setHeader('X-Correlation-ID', metadata.correlationId);
        }

        // Update statistics
        this.updateRequestStartStats();

        // Log request start
        this.logger.info('Request started', {
          requestId,
          method: req.method,
          endpoint: metadata.endpoint,
          userAgent: metadata.userAgent,
          clientIP: metadata.clientIP
        });

        // Setup completion tracking
        this.setupCompletionTracking(req, res, context);

        next();

      } catch (error) {
        this.logger.error('Request ID middleware error', {
          error: error instanceof Error ? error.message : String(error),
          path: req.path,
          method: req.method
        });

        // Continue with basic request ID
        const fallbackId = this.generateRequestId('fallback');
        req.requestId = fallbackId;
        res.setHeader('X-Request-ID', fallbackId);
        
        next();
      }
    };
  }

  /**
   * Add correlation data to request context
   */
  addCorrelationData(requestId: string, key: string, data: any): void {
    const context = this.activeRequests.get(requestId);
    if (context) {
      context.correlatedData.set(key, data);
      
      this.logger.debug('Added correlation data', {
        requestId,
        key,
        dataType: typeof data
      });
    }
  }

  /**
   * Get correlation data from request context
   */
  getCorrelationData(requestId: string, key: string): any {
    const context = this.activeRequests.get(requestId);
    return context?.correlatedData.get(key);
  }

  /**
   * Mark request as having an error
   */
  markRequestError(requestId: string, error: Error): void {
    const context = this.activeRequests.get(requestId);
    if (context) {
      context.metadata.errorOccurred = true;
      context.metadata.errorCount++;
      
      this.addCorrelationData(requestId, 'lastError', {
        message: error.message,
        name: error.name,
        timestamp: new Date()
      });

      this.logger.debug('Request error marked', {
        requestId,
        errorCount: context.metadata.errorCount,
        errorMessage: error.message
      });
    }
  }

  /**
   * Get request context by ID
   */
  getRequestContext(requestId: string): RequestContext | undefined {
    return this.activeRequests.get(requestId);
  }

  /**
   * Get tracking statistics
   */
  getStatistics(): RequestTrackingStats {
    return { ...this.statistics };
  }

  /**
   * Get recent completed requests for analysis
   */
  getRecentRequests(limit: number = 100): RequestMetadata[] {
    return this.completedRequests
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get requests with errors for analysis
   */
  getErrorRequests(limit: number = 50): RequestMetadata[] {
    return this.completedRequests
      .filter(req => req.errorOccurred)
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clear request tracking history
   */
  clearHistory(): void {
    this.completedRequests = [];
    this.statistics.completedRequests = 0;
    this.statistics.errorRequests = 0;
    
    this.logger.info('Request tracking history cleared');
  }

  /**
   * Extract or generate request ID from request
   */
  private extractOrGenerateRequestId(req: Request): string {
    // Check headers for existing request ID
    const headerRequestId = req.get('X-Request-ID') || req.get('Request-ID');
    if (headerRequestId && this.isValidRequestId(headerRequestId)) {
      return headerRequestId;
    }

    // Generate new request ID
    return this.generateRequestId();
  }

  /**
   * Extract correlation ID from request headers
   */
  private extractCorrelationId(req: Request): string | undefined {
    const correlationId = req.get('X-Correlation-ID') || req.get('Correlation-ID');
    return correlationId && this.isValidCorrelationId(correlationId) ? correlationId : undefined;
  }

  /**
   * Extract parent request ID from headers
   */
  private extractParentRequestId(req: Request): string | undefined {
    const parentId = req.get('X-Parent-Request-ID') || req.get('Parent-Request-ID');
    return parentId && this.isValidRequestId(parentId) ? parentId : undefined;
  }

  /**
   * Extract client IP address with proxy support
   */
  private extractClientIP(req: Request): string {
    return (
      req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      req.get('X-Real-IP') ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Normalize endpoint path for consistent tracking
   */
  private normalizeEndpoint(path: string): string {
    // Remove query parameters
    const basePath = path.split('?')[0];
    
    // Replace IDs with placeholders for grouping
    return basePath
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/{uuid}')
      .replace(/\/\d+/g, '/{id}')
      .replace(/\/sess_[a-zA-Z0-9_-]+/g, '/{session_id}');
  }

  /**
   * Setup request completion tracking
   */
  private setupCompletionTracking(req: Request, res: Response, context: RequestContext): void {
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;

    // Track response completion
    const completeRequest = () => {
      const duration = Date.now() - context.startTime.getTime();
      
      // Update metadata
      context.metadata.duration = duration;
      context.metadata.statusCode = res.statusCode;

      // Move to completed requests
      this.activeRequests.delete(context.requestId);
      this.completedRequests.push(context.metadata);

      // Maintain history size
      if (this.completedRequests.length > this.maxHistorySize) {
        this.completedRequests.shift();
      }

      // Update statistics
      this.updateRequestCompletionStats(context.metadata);

      // Log completion
      this.logger.info('Request completed', {
        requestId: context.requestId,
        duration,
        statusCode: res.statusCode,
        errorOccurred: context.metadata.errorOccurred,
        errorCount: context.metadata.errorCount
      });
    };

    // Wrap response methods
    res.send = function(body: any) {
      completeRequest();
      return originalSend.call(this, body);
    };

    res.json = function(body: any) {
      completeRequest();
      return originalJson.call(this, body);
    };

    res.end = function(chunk?: any, encoding?: any) {
      completeRequest();
      return originalEnd.call(this, chunk, encoding);
    };
  }

  /**
   * Update statistics for request start
   */
  private updateRequestStartStats(): void {
    this.statistics.totalRequests++;
    this.statistics.activeRequests = this.activeRequests.size;
    this.statistics.lastActivity = new Date();
  }

  /**
   * Update statistics for request completion
   */
  private updateRequestCompletionStats(metadata: RequestMetadata): void {
    this.statistics.activeRequests = this.activeRequests.size;
    this.statistics.completedRequests++;

    if (metadata.errorOccurred) {
      this.statistics.errorRequests++;
    }

    // Update average duration
    if (metadata.duration) {
      const totalDuration = this.statistics.averageDuration * (this.statistics.completedRequests - 1) + metadata.duration;
      this.statistics.averageDuration = totalDuration / this.statistics.completedRequests;
    }

    // Calculate requests per second (over last minute)
    const oneMinuteAgo = Date.now() - 60000;
    const recentRequests = this.completedRequests.filter(
      req => req.timestamp.getTime() > oneMinuteAgo
    ).length;
    this.statistics.requestsPerSecond = recentRequests / 60;
  }

  /**
   * Validate request ID format
   */
  private isValidRequestId(requestId: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(requestId) && requestId.length >= 10 && requestId.length <= 100;
  }

  /**
   * Validate correlation ID format
   */
  private isValidCorrelationId(correlationId: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(correlationId) && correlationId.length >= 8 && correlationId.length <= 50;
  }

  /**
   * Start cleanup scheduler for old completed requests
   */
  private startCleanupScheduler(): void {
    setInterval(() => {
      this.cleanupStaleRequests();
    }, 300000); // Every 5 minutes
  }

  /**
   * Clean up stale active requests and old completed requests
   */
  private cleanupStaleRequests(): void {
    const staleThreshold = Date.now() - 3600000; // 1 hour ago
    const initialActiveCount = this.activeRequests.size;
    const initialCompletedCount = this.completedRequests.length;

    // Remove stale active requests
    for (const [requestId, context] of this.activeRequests.entries()) {
      if (context.startTime.getTime() < staleThreshold) {
        this.activeRequests.delete(requestId);
        this.logger.warn('Removed stale active request', { requestId });
      }
    }

    // Trim old completed requests
    const keepCount = Math.floor(this.maxHistorySize * 0.8); // Keep 80% of max
    if (this.completedRequests.length > keepCount) {
      this.completedRequests = this.completedRequests.slice(-keepCount);
    }

    const activeRemoved = initialActiveCount - this.activeRequests.size;
    const completedRemoved = initialCompletedCount - this.completedRequests.length;

    if (activeRemoved > 0 || completedRemoved > 0) {
      this.logger.info('Request cleanup completed', {
        activeRequestsRemoved: activeRemoved,
        completedRequestsRemoved: completedRemoved,
        currentActiveRequests: this.activeRequests.size,
        currentCompletedRequests: this.completedRequests.length
      });
    }
  }
}

// Extend Express Request interface
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
      requestMetadata?: RequestMetadata;
      requestContext?: RequestContext;
    }
  }
}

// Production-ready singleton instance
export const requestIdManager = new RequestIdManager();

// Export middleware and utilities
export const requestIdMiddleware = requestIdManager.middleware();
export const generateRequestId = (prefix?: string) => requestIdManager.generateRequestId(prefix);
export const addCorrelationData = (requestId: string, key: string, data: any) =>
  requestIdManager.addCorrelationData(requestId, key, data);
export const getCorrelationData = (requestId: string, key: string) =>
  requestIdManager.getCorrelationData(requestId, key);
export const markRequestError = (requestId: string, error: Error) =>
  requestIdManager.markRequestError(requestId, error);
export const getRequestStats = () => requestIdManager.getStatistics();