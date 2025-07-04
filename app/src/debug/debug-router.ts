/**
 * Debug Endpoints Router
 * Single Responsibility: HTTP routing for debug endpoints only
 * 
 * Provides HTTP endpoint routing for debug functionality:
 * - Tool call inspection endpoints
 * - OpenAI compatibility verification endpoints
 * - Performance monitoring endpoints
 * - Debug reporting and analysis endpoints
 */

import { Router, Request, Response } from 'express';
import { toolInspector } from './tool-inspector';
import { compatibilityChecker } from './compatibility-checker';
import { getLogger } from '../utils/logger';
import {
  DEBUG_ENDPOINTS,
  DEBUG_PERFORMANCE_LIMITS,
  DEBUG_MESSAGES,
  DEBUG_ERROR_CODES
} from '../tools/constants';

const logger = getLogger('DebugRouter');

/**
 * Debug request parameters interface
 */
export interface DebugRequest {
  sessionId: string;
  toolCallId?: string;
  reportType?: string;
  limit?: number;
}

/**
 * Compatibility check request interface
 */
export interface CompatibilityRequest {
  request: any;
  toolSpecification?: any;
  endpoint?: string;
}

/**
 * Debug router interface
 */
export interface IDebugRouter {
  getRouter(): Router;
  handleToolInspection(req: Request, res: Response): Promise<void>;
  handleCompatibilityCheck(req: Request, res: Response): Promise<void>;
  handlePerformanceAnalysis(req: Request, res: Response): Promise<void>;
  handleDebugReport(req: Request, res: Response): Promise<void>;
  handleHistoryInspection(req: Request, res: Response): Promise<void>;
}

/**
 * Debug router implementation
 */
export class DebugRouter implements IDebugRouter {
  private router: Router;

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  /**
   * Get Express router instance
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * Setup debug routes
   */
  private setupRoutes(): void {
    // Tool inspection endpoints
    this.router.get(
      DEBUG_ENDPOINTS.TOOL_INSPECT + '/:sessionId/:toolCallId', 
      this.validateDebugRequest.bind(this),
      this.handleToolInspection.bind(this)
    );

    this.router.get(
      DEBUG_ENDPOINTS.TOOL_HISTORY + '/:sessionId',
      this.validateDebugRequest.bind(this),
      this.handleHistoryInspection.bind(this)
    );

    this.router.get(
      DEBUG_ENDPOINTS.PERFORMANCE_MONITOR + '/:sessionId/:toolCallId',
      this.validateDebugRequest.bind(this),
      this.handlePerformanceAnalysis.bind(this)
    );

    // Compatibility verification endpoints
    this.router.post(
      DEBUG_ENDPOINTS.COMPATIBILITY_CHECK,
      this.validateCompatibilityRequest.bind(this),
      this.handleCompatibilityCheck.bind(this)
    );

    // OpenAI compliance endpoints
    this.router.get(
      DEBUG_ENDPOINTS.OPENAI_COMPLIANCE + '/:sessionId',
      this.validateDebugRequest.bind(this),
      this.handleDebugReport.bind(this)
    );

    this.router.get(
      DEBUG_ENDPOINTS.TOOL_VALIDATION + '/:sessionId',
      this.validateDebugRequest.bind(this),
      this.handleChainValidation.bind(this)
    );

    logger.debug('Debug routes configured', {
      routes: Object.keys(DEBUG_ENDPOINTS)
    });
  }

  /**
   * Validate debug request parameters
   */
  private validateDebugRequest(req: Request, res: Response, next: Function): void {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      res.status(400).json({
        error: DEBUG_ERROR_CODES.INVALID_DEBUG_REQUEST,
        message: DEBUG_MESSAGES.INVALID_DEBUG_REQUEST
      });
      return;
    }

    next();
  }

  /**
   * Validate compatibility check request
   */
  private validateCompatibilityRequest(req: Request, res: Response, next: Function): void {
    const { request } = req.body;
    
    if (!request) {
      res.status(400).json({
        error: DEBUG_ERROR_CODES.INVALID_DEBUG_REQUEST,
        message: 'Request body is required for compatibility checking'
      });
      return;
    }

    next();
  }

  /**
   * Handle tool call inspection
   */
  async handleToolInspection(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { sessionId, toolCallId } = req.params;
      
      if (!toolCallId) {
        res.status(400).json({
          error: DEBUG_ERROR_CODES.INVALID_DEBUG_REQUEST,
          message: 'Tool call ID is required'
        });
        return;
      }

      const result = await toolInspector.inspectToolCall(sessionId, toolCallId);
      
      const responseTime = Date.now() - startTime;
      this.checkPerformanceRequirement(responseTime);

      res.json({
        success: true,
        data: result,
        responseTimeMs: responseTime
      });

      logger.debug('Tool inspection completed', {
        sessionId,
        toolCallId,
        responseTime
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.handleRouterError(res, error, 'tool inspection', responseTime);
    }
  }

  /**
   * Handle tool call history inspection
   */
  async handleHistoryInspection(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { sessionId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await toolInspector.generateToolCallHistoryReport(sessionId);
      
      const responseTime = Date.now() - startTime;
      this.checkPerformanceRequirement(responseTime);

      res.json({
        success: true,
        data: result,
        responseTimeMs: responseTime
      });

      logger.debug('History inspection completed', {
        sessionId,
        limit,
        responseTime
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.handleRouterError(res, error, 'history inspection', responseTime);
    }
  }

  /**
   * Handle performance analysis
   */
  async handlePerformanceAnalysis(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { sessionId, toolCallId } = req.params;
      
      if (!toolCallId) {
        res.status(400).json({
          error: DEBUG_ERROR_CODES.INVALID_DEBUG_REQUEST,
          message: 'Tool call ID is required for performance analysis'
        });
        return;
      }

      const result = await toolInspector.analyzePerformanceTrends(sessionId);
      
      const responseTime = Date.now() - startTime;
      this.checkPerformanceRequirement(responseTime);

      res.json({
        success: true,
        data: result,
        responseTimeMs: responseTime
      });

      logger.debug('Performance analysis completed', {
        sessionId,
        toolCallId,
        responseTime
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.handleRouterError(res, error, 'performance analysis', responseTime);
    }
  }

  /**
   * Handle compatibility checking
   */
  async handleCompatibilityCheck(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { request, toolSpecification, endpoint } = req.body;

      let result;
      
      if (toolSpecification) {
        result = await compatibilityChecker.validateToolSpecification(toolSpecification);
      } else if (endpoint) {
        result = await compatibilityChecker.verifyEndpointCompliance(endpoint);
      } else {
        result = await compatibilityChecker.checkOpenAICompatibility(request);
      }
      
      const responseTime = Date.now() - startTime;
      this.checkPerformanceRequirement(responseTime);

      res.json({
        success: true,
        data: result,
        responseTimeMs: responseTime
      });

      logger.debug('Compatibility check completed', {
        hasToolSpec: !!toolSpecification,
        hasEndpoint: !!endpoint,
        responseTime
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.handleRouterError(res, error, 'compatibility check', responseTime);
    }
  }

  /**
   * Handle debug report generation
   */
  async handleDebugReport(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { sessionId } = req.params;
      const reportType = req.query.type as string || 'full';

      const result = await toolInspector.generateInspectionReport(sessionId);
      
      const responseTime = Date.now() - startTime;
      this.checkPerformanceRequirement(responseTime);

      res.json({
        success: true,
        data: result,
        responseTimeMs: responseTime
      });

      logger.debug('Debug report generated', {
        sessionId,
        reportType,
        responseTime
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.handleRouterError(res, error, 'debug report generation', responseTime);
    }
  }

  /**
   * Handle tool call chain validation
   */
  async handleChainValidation(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { sessionId } = req.params;

      const toolCallIds = req.body.toolCallIds || [];
      const result = await toolInspector.validateToolCallChain(toolCallIds, sessionId);
      
      const responseTime = Date.now() - startTime;
      this.checkPerformanceRequirement(responseTime);

      res.json({
        success: true,
        data: result,
        responseTimeMs: responseTime
      });

      logger.debug('Chain validation completed', {
        sessionId,
        responseTime
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.handleRouterError(res, error, 'chain validation', responseTime);
    }
  }

  /**
   * Check performance requirement compliance
   */
  private checkPerformanceRequirement(responseTime: number): void {
    if (responseTime > DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS) {
      logger.warn('Debug endpoint exceeded performance requirement', {
        responseTime,
        limit: DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS
      });
    }
  }

  /**
   * Handle router errors
   */
  private handleRouterError(
    res: Response, 
    error: any, 
    operation: string, 
    responseTime: number
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error(`Debug router ${operation} failed`, {
      error: errorMessage,
      responseTime
    });

    res.status(500).json({
      success: false,
      error: DEBUG_ERROR_CODES.TOOL_INSPECTION_FAILED,
      message: `${operation} failed: ${errorMessage}`,
      responseTimeMs: responseTime
    });
  }
}

/**
 * Default debug router instance
 */
export const debugRouter = new DebugRouter();