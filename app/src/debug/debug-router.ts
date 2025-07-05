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

import { Router, Request, Response, NextFunction } from 'express';
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

    // Test-expected endpoints for backward compatibility
    this.router.post('/compatibility', this.handleCompatibilityCheck.bind(this));
    this.router.post('/debug/request', this.handleDebugRequest.bind(this));
    this.router.get('/debug/request', this.handleDebugRequest.bind(this));

    logger.debug('Debug routes configured', {
      routes: Object.keys(DEBUG_ENDPOINTS),
      totalRoutes: this.router.stack ? this.router.stack.length : 0
    });
  }

  /**
   * Validate debug request parameters
   */
  private validateDebugRequest(req: Request, res: Response, next: NextFunction): void {
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
  private validateCompatibilityRequest(req: Request, res: Response, next: NextFunction): void {
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
    try {
      // Import CompatibilityReporter dynamically to handle mocking in tests
      const { CompatibilityReporter } = await import('../validation/compatibility');
      const { ChatCompletionRequestSchema } = await import('../models/chat');

      // For the compatibility endpoint, expect the request body to be the OpenAI request
      const requestBody = req.body;
      
      if (!requestBody) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Request body is required'
        });
        return;
      }

      // Validate the request using the schema first
      let chatRequest;
      try {
        chatRequest = ChatCompletionRequestSchema.parse(requestBody);
      } catch (validationError) {
        // Handle validation errors
        res.status(400).json({
          error: 'Invalid Request',
          message: 'Request validation failed',
          details: String(validationError)
        });
        return;
      }
      
      // Generate compatibility report (this can throw internal errors)
      const compatibilityReport = CompatibilityReporter.generateCompatibilityReport(chatRequest);

      // Return response in expected format (matching Python main.py)
      res.json({
        compatibility_report: compatibilityReport,
        claude_code_sdk_options: {
          supported: [
            "model", 
            "system_prompt", 
            "max_turns", 
            "allowed_tools", 
            "disallowed_tools", 
            "permission_mode", 
            "max_thinking_tokens",
            "continue_conversation", 
            "resume", 
            "cwd"
          ],
          custom_headers: [
            "X-Claude-Max-Turns", 
            "X-Claude-Allowed-Tools", 
            "X-Claude-Disallowed-Tools", 
            "X-Claude-Permission-Mode",
            "X-Claude-Max-Thinking-Tokens"
          ]
        }
      });

    } catch (error) {
      logger.error('Compatibility check error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to analyze request compatibility'
      });
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
   * Handle generic debug request (for test compatibility)
   */
  async handleDebugRequest(req: Request, res: Response): Promise<void> {
    try {
      // Get raw request body
      const body = req.body || {};
      const rawBody = JSON.stringify(body, null, 2);
      
      // Check debug mode from environment  
      const debugModeEnabled = process.env.DEBUG_MODE === 'true' || process.env.VERBOSE === '1';
      
      // Try to validate the request if it looks like a chat completion request
      let validationResult: any = { valid: false, errors: [] };
      
      try {
        if (Object.keys(body).length > 0) {
          // Import schema dynamically to handle mocking in tests
          const { ChatCompletionRequestSchema } = await import('../models/chat');
          ChatCompletionRequestSchema.parse(body);
          validationResult = {
            valid: true,
            errors: []
          };
        }
      } catch (error) {
        validationResult = {
          valid: false,
          errors: [error instanceof Error ? error.message : String(error)]
        };
      }
      
      // Return debug info in expected format (matching Python main.py)
      res.json({
        debug_info: {
          headers: req.headers,
          method: req.method,
          url: req.originalUrl || req.url,
          raw_body: rawBody,
          parsed_body: body,
          validation_result: validationResult,
          debug_mode_enabled: debugModeEnabled,
          example_valid_request: {
            model: "claude-3-sonnet-20240229",
            messages: [
              { role: "user", content: "Hello, world!" }
            ],
            stream: false
          }
        }
      });

      logger.debug('Debug request processed', {
        method: req.method,
        url: req.url,
        hasBody: Object.keys(body).length > 0,
        debugMode: debugModeEnabled
      });

    } catch (error) {
      logger.error('Debug request error:', error);
      res.status(500).json({
        debug_info: {
          error: `Debug endpoint error: ${String(error)}`,
          headers: req.headers,
          method: req.method,
          url: req.url
        }
      });
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