/**
 * Debug Route Configuration (Phase 14B)
 * Single Responsibility: HTTP route configuration and middleware setup
 * 
 * Extracted from oversized debug-router.ts following SRP
 * Configures Express routes and middleware for debug endpoints
 */

import { Router } from 'express';
import { ToolInspectionHandlers } from '../handlers/tool-inspection-handlers';
import { CompatibilityHandlers } from '../handlers/compatibility-handlers';
import { DebugResponseUtils } from '../utils/debug-response-utils';
import {
  DEBUG_ENDPOINTS,
  DEBUG_PERFORMANCE_LIMITS,
  DEBUG_CONFIGURATION
} from '../../tools/constants';
import { getLogger } from '../../utils/logger';

const logger = getLogger('DebugRouteConfig');

/**
 * Debug router configuration
 */
export interface DebugRouterConfig {
  enableMiddleware: boolean;
  performanceLogging: boolean;
  requestSizeLimit: string;
  timeoutMs: number;
}

/**
 * Default configuration for debug router
 */
const DEFAULT_CONFIG: DebugRouterConfig = {
  enableMiddleware: true,
  performanceLogging: DEBUG_CONFIGURATION.PERFORMANCE_TRACKING_ENABLED,
  requestSizeLimit: '10mb',
  timeoutMs: DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS
};

/**
 * Debug route configuration class
 */
export class DebugRouteConfig {
  private toolInspectionHandlers: ToolInspectionHandlers;
  private compatibilityHandlers: CompatibilityHandlers;
  private config: DebugRouterConfig;

  constructor(config?: Partial<DebugRouterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.toolInspectionHandlers = new ToolInspectionHandlers();
    this.compatibilityHandlers = new CompatibilityHandlers();
  }

  /**
   * Create and configure debug router
   */
  createRouter(): Router {
    const router = Router();

    // Apply middleware if enabled
    if (this.config.enableMiddleware) {
      this.applyMiddleware(router);
    }

    // Configure tool inspection routes
    this.configureToolInspectionRoutes(router);

    // Configure compatibility routes
    this.configureCompatibilityRoutes(router);

    // Configure utility routes
    this.configureUtilityRoutes(router);

    // Apply error handling
    this.applyErrorHandling(router);

    logger.info('Debug router configured', { 
      config: this.config,
      endpoints: Object.values(DEBUG_ENDPOINTS)
    });

    return router;
  }

  /**
   * Apply common middleware to router
   */
  private applyMiddleware(router: Router): void {
    // Request logging middleware
    if (this.config.performanceLogging) {
      router.use((req, res, next) => {
        const startTime = performance.now();
        const requestId = DebugResponseUtils.generateRequestId();
        
        // Add request ID to headers
        res.setHeader('X-Request-ID', requestId);
        
        // Log request start
        logger.info('Debug request received', {
          method: req.method,
          path: req.path,
          requestId,
          userAgent: req.get('User-Agent')
        });

        // Override res.json to log response
        const originalJson = res.json;
        res.json = function(body: any) {
          const responseTime = performance.now() - startTime;
          logger.info('Debug request completed', {
            method: req.method,
            path: req.path,
            requestId,
            statusCode: res.statusCode,
            responseTimeMs: responseTime,
            withinLimit: responseTime <= DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS
          });
          return originalJson.call(this, body);
        };

        next();
      });
    }

    // JSON parsing middleware with size limit
    router.use((req, res, next) => {
      if (req.is('application/json')) {
        const contentLength = req.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) { // 10MB limit
          res.status(413).json({
            success: false,
            error: {
              code: 'REQUEST_TOO_LARGE',
              message: 'Request payload too large'
            }
          });
          return;
        }
      }
      next();
    });

    // Request timeout middleware
    router.use((req, res, next) => {
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          const error = DebugResponseUtils.createTimeoutError(
            `${req.method} ${req.path}`,
            this.config.timeoutMs
          );
          DebugResponseUtils.sendError(res, error, 'timeout', performance.now(), req.get('X-Request-ID'));
        }
      }, this.config.timeoutMs);

      res.on('finish', () => clearTimeout(timeout));
      res.on('close', () => clearTimeout(timeout));

      next();
    });
  }

  /**
   * Configure tool inspection routes
   */
  private configureToolInspectionRoutes(router: Router): void {
    // Tool call inspection
    router.post(
      DEBUG_ENDPOINTS.TOOL_INSPECT,
      this.toolInspectionHandlers.handleToolInspection.bind(this.toolInspectionHandlers)
    );

    // Tool call history
    router.post(
      DEBUG_ENDPOINTS.TOOL_HISTORY,
      this.toolInspectionHandlers.handleHistoryInspection.bind(this.toolInspectionHandlers)
    );

    // Tool validation
    router.post(
      DEBUG_ENDPOINTS.TOOL_VALIDATION,
      this.toolInspectionHandlers.handleChainValidation.bind(this.toolInspectionHandlers)
    );

    // Tool call status (GET endpoint)
    router.get(
      '/debug/tools/:sessionId/:toolCallId/status',
      this.toolInspectionHandlers.handleToolCallStatus.bind(this.toolInspectionHandlers)
    );
  }

  /**
   * Configure compatibility routes
   */
  private configureCompatibilityRoutes(router: Router): void {
    // OpenAI compatibility check
    router.post(
      DEBUG_ENDPOINTS.COMPATIBILITY_CHECK,
      this.compatibilityHandlers.handleCompatibilityCheck.bind(this.compatibilityHandlers)
    );

    // Performance analysis
    router.post(
      DEBUG_ENDPOINTS.PERFORMANCE_MONITOR,
      this.compatibilityHandlers.handlePerformanceAnalysis.bind(this.compatibilityHandlers)
    );

    // OpenAI compliance verification
    router.post(
      DEBUG_ENDPOINTS.OPENAI_COMPLIANCE,
      this.compatibilityHandlers.handleOpenAIVerification.bind(this.compatibilityHandlers)
    );

    // Debug report generation
    router.post(
      '/debug/reports/generate',
      this.compatibilityHandlers.handleDebugReport.bind(this.compatibilityHandlers)
    );
  }

  /**
   * Configure utility routes
   */
  private configureUtilityRoutes(router: Router): void {
    // Health check endpoint
    router.get('/debug/health', (req, res) => {
      const startTime = performance.now();
      const requestId = DebugResponseUtils.generateRequestId();

      const healthData = {
        status: 'healthy',
        timestamp: Date.now(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        configuration: {
          toolInspectionEnabled: DEBUG_CONFIGURATION.ENABLE_TOOL_INSPECTION,
          compatibilityCheckingEnabled: DEBUG_CONFIGURATION.ENABLE_COMPATIBILITY_CHECKING,
          performanceMonitoringEnabled: DEBUG_CONFIGURATION.ENABLE_PERFORMANCE_MONITORING,
          errorTrackingEnabled: DEBUG_CONFIGURATION.ENABLE_ERROR_TRACKING
        },
        limits: {
          endpointTimeoutMs: DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS,
          maxConcurrentRequests: DEBUG_PERFORMANCE_LIMITS.MAX_CONCURRENT_DEBUG_REQUESTS,
          maxHistoryEntries: DEBUG_PERFORMANCE_LIMITS.MAX_HISTORY_ENTRIES
        }
      };

      DebugResponseUtils.sendSuccess(res, healthData, 'health', startTime, requestId);
    });

    // Configuration endpoint
    router.get('/debug/config', (req, res) => {
      const startTime = performance.now();
      const requestId = DebugResponseUtils.generateRequestId();

      const configData = {
        debugConfiguration: DEBUG_CONFIGURATION,
        performanceLimits: DEBUG_PERFORMANCE_LIMITS,
        endpoints: DEBUG_ENDPOINTS,
        routerConfig: this.config
      };

      DebugResponseUtils.sendSuccess(res, configData, 'config', startTime, requestId);
    });
  }

  /**
   * Apply error handling middleware
   */
  private applyErrorHandling(router: Router): void {
    // 404 handler for unmatched debug routes
    router.use('*', (req, res) => {
      const startTime = performance.now();
      const requestId = req.get('X-Request-ID') || DebugResponseUtils.generateRequestId();

      const error = {
        code: 'ENDPOINT_NOT_FOUND',
        message: `Debug endpoint not found: ${req.method} ${req.originalUrl}`,
        category: 'validation' as const,
        details: {
          method: req.method,
          path: req.originalUrl,
          availableEndpoints: Object.values(DEBUG_ENDPOINTS)
        },
        statusCode: 404
      };

      DebugResponseUtils.sendError(res, error, 'not-found', startTime, requestId);
    });

    // Global error handler
    router.use((error: any, req: any, res: any, next: any) => {
      const startTime = performance.now();
      const requestId = req.get('X-Request-ID') || DebugResponseUtils.generateRequestId();

      logger.error('Unhandled error in debug router', { 
        error: error.message || error,
        stack: error.stack,
        requestId,
        path: req.path
      });

      DebugResponseUtils.handleRouterError(error, 'error', startTime, res, requestId);
    });
  }
}