/**
 * Production Security Middleware - Phase 15A
 * Single Responsibility: Express middleware for production security hardening
 * 
 * Integration point for SecurityHardening class with Express middleware layer
 * Provides rate limiting, input sanitization, and audit logging for tool requests
 */

import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { SecurityHardening, ISecurityHardening } from '../production/security-hardening';
import { ProductionMonitoring, IMonitoring } from '../production/monitoring';
import { PRODUCTION_LIMITS, PRODUCTION_SECURITY } from '../tools/constants';

export interface SecurityMiddlewareConfig {
  rateLimitWindowMs?: number;
  rateLimitMaxRequests?: number;
  enableAuditLogging?: boolean;
  enableInputSanitization?: boolean;
}

export interface RequestWithSecurity extends Request {
  securityContext?: {
    sanitizedBody?: any;
    userId?: string;
    sessionId?: string;
    auditDetails?: any;
  };
}

export class ProductionSecurityMiddleware {
  private securityHardening: ISecurityHardening;
  private monitoring: IMonitoring;
  private logger: winston.Logger;
  private config: Required<SecurityMiddlewareConfig>;

  constructor(
    logger: winston.Logger,
    monitoring: IMonitoring,
    config: SecurityMiddlewareConfig = {}
  ) {
    this.logger = logger;
    this.monitoring = monitoring;
    
    this.config = {
      rateLimitWindowMs: config.rateLimitWindowMs || PRODUCTION_LIMITS.RATE_LIMIT_WINDOW_MS,
      rateLimitMaxRequests: config.rateLimitMaxRequests || PRODUCTION_LIMITS.RATE_LIMIT_MAX_REQUESTS,
      enableAuditLogging: config.enableAuditLogging ?? true,
      enableInputSanitization: config.enableInputSanitization ?? true,
      ...config
    };

    this.securityHardening = new SecurityHardening(logger, {
      windowMs: this.config.rateLimitWindowMs,
      maxRequests: this.config.rateLimitMaxRequests
    });
  }

  /**
   * Rate limiting middleware for production environments
   * Performance requirement: <1ms overhead per request
   */
  rateLimit() {
    return async (req: RequestWithSecurity, res: Response, next: NextFunction): Promise<void> => {
      const startTime = Date.now();
      
      try {
        const rateLimitResult = await this.securityHardening.checkRateLimit(req);
        
        if (!rateLimitResult.allowed) {
          const duration = Date.now() - startTime;
          
          // Record rate limit violation
          this.monitoring.recordToolOperation('rate_limit_check', duration, false, rateLimitResult.reason);
          
          // Send rate limit response
          res.status(429).json({
            error: 'Too Many Requests',
            message: rateLimitResult.reason || 'Rate limit exceeded',
            retryAfter: rateLimitResult.retryAfter
          });
          return;
        }

        // Record successful rate limit check
        const duration = Date.now() - startTime;
        this.monitoring.recordToolOperation('rate_limit_check', duration, true);
        
        next();
        
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        this.logger.error('Rate limit check failed', {
          error: errorMessage,
          duration,
          path: req.path
        });
        
        this.monitoring.recordToolOperation('rate_limit_check', duration, false, errorMessage);
        
        // Fail open for availability
        next();
      }
    };
  }

  /**
   * Input sanitization middleware for tool requests
   */
  sanitizeInput() {
    return (req: RequestWithSecurity, res: Response, next: NextFunction): void => {
      const startTime = Date.now();
      
      try {
        if (!this.config.enableInputSanitization) {
          next();
          return;
        }

        // Initialize security context
        req.securityContext = req.securityContext || {};
        
        // Sanitize request body
        if (req.body) {
          req.securityContext.sanitizedBody = this.securityHardening.sanitizeToolInput(req.body);
          
          // Replace original body with sanitized version
          req.body = req.securityContext.sanitizedBody;
        }

        // Extract security identifiers
        req.securityContext.userId = this.extractUserId(req);
        req.securityContext.sessionId = this.extractSessionId(req);

        const duration = Date.now() - startTime;
        this.monitoring.recordPerformanceMetric('input_sanitization', duration);
        
        next();
        
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        this.logger.error('Input sanitization failed', {
          error: errorMessage,
          duration,
          path: req.path
        });
        
        this.monitoring.recordToolOperation('input_sanitization', duration, false, errorMessage);
        
        res.status(400).json({
          error: 'Bad Request',
          message: 'Request could not be processed safely'
        });
      }
    };
  }

  /**
   * Tool security validation middleware
   */
  validateToolSecurity() {
    return (req: RequestWithSecurity, res: Response, next: NextFunction): void => {
      const startTime = Date.now();
      
      try {
        // Extract tool information from request
        const toolName = this.extractToolName(req);
        const parameters = req.body || {};

        if (toolName) {
          const validationResult = this.securityHardening.validateToolSecurity(toolName, parameters);
          
          if (!validationResult.valid) {
            const duration = Date.now() - startTime;
            
            this.monitoring.recordToolOperation('tool_security_validation', duration, false, 
              validationResult.errors?.join(', '));
            
            // Audit security violation
            if (this.config.enableAuditLogging) {
              this.securityHardening.auditLog('security_violation', {
                userId: req.securityContext?.userId,
                sessionId: req.securityContext?.sessionId,
                toolName,
                parameters,
                timestamp: Date.now(),
                success: false,
                error: validationResult.errors?.join(', ')
              });
            }

            res.status(400).json({
              error: 'Security Validation Failed',
              message: 'Tool request failed security validation',
              details: validationResult.errors
            });
            return;
          }

          // Update request with sanitized parameters
          if (validationResult.sanitizedParameters) {
            req.body = validationResult.sanitizedParameters;
          }
        }

        const duration = Date.now() - startTime;
        this.monitoring.recordToolOperation('tool_security_validation', duration, true);
        
        next();
        
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        this.logger.error('Tool security validation failed', {
          error: errorMessage,
          duration,
          path: req.path
        });
        
        this.monitoring.recordToolOperation('tool_security_validation', duration, false, errorMessage);
        
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Security validation could not be performed'
        });
      }
    };
  }

  /**
   * Audit logging middleware for tool operations
   */
  auditLogging() {
    return (req: RequestWithSecurity, res: Response, next: NextFunction): void => {
      if (!this.config.enableAuditLogging) {
        next();
        return;
      }

      const startTime = Date.now();
      
      // Store original response methods
      const originalSend = res.send;
      const originalJson = res.json;
      
      // Track response for audit
      let responseData: any = null;
      let responseSent = false;

      // Override response methods to capture data
      res.send = function(data: any) {
        if (!responseSent) {
          responseData = data;
          responseSent = true;
        }
        return originalSend.call(this, data);
      };

      res.json = function(data: any) {
        if (!responseSent) {
          responseData = data;
          responseSent = true;
        }
        return originalJson.call(this, data);
      };

      // Capture request completion
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const toolName = this.extractToolName(req);
        const success = res.statusCode < 400;

        if (toolName) {
          this.securityHardening.auditLog('tool_operation', {
            userId: req.securityContext?.userId,
            sessionId: req.securityContext?.sessionId,
            toolName,
            parameters: req.body,
            result: responseData,
            timestamp: startTime,
            duration,
            success,
            error: success ? undefined : `HTTP ${res.statusCode}`
          });
        }
      });

      next();
    };
  }

  /**
   * Combined security middleware that applies all security measures
   */
  applyProductionSecurity() {
    return [
      this.rateLimit(),
      this.sanitizeInput(),
      this.validateToolSecurity(),
      this.auditLogging()
    ];
  }

  private extractUserId(req: Request): string | undefined {
    return (req as any).userId || (req as any).user?.id || req.headers['x-user-id'] as string;
  }

  private extractSessionId(req: Request): string | undefined {
    return req.headers['x-session-id'] as string || (req as any).sessionId;
  }

  private extractToolName(req: Request): string | undefined {
    // Extract tool name from request path or body
    if (req.path.includes('/tools/')) {
      const pathParts = req.path.split('/');
      const toolIndex = pathParts.indexOf('tools');
      return pathParts[toolIndex + 1];
    }
    
    // Check if it's in the request body
    if (req.body && req.body.tools && Array.isArray(req.body.tools)) {
      return req.body.tools[0]?.function?.name;
    }
    
    return undefined;
  }

  public destroy(): void {
    // Cleanup any resources if needed
    this.logger.info('Production security middleware destroyed');
  }
}

/**
 * Factory function to create production security middleware
 */
export function createProductionSecurityMiddleware(
  logger: winston.Logger,
  monitoring: IMonitoring,
  config?: SecurityMiddlewareConfig
): ProductionSecurityMiddleware {
  return new ProductionSecurityMiddleware(logger, monitoring, config);
}

export default ProductionSecurityMiddleware;