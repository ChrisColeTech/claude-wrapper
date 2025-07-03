/**
 * Debug Router - Debug and Compatibility Endpoints
 * Phase 14A Implementation: Complete debug and compatibility endpoints
 * Based on Python main.py:659-751 debug and compatibility endpoints
 * 
 * Single Responsibility: HTTP endpoint handling for debugging and compatibility analysis
 */

import { Router, Request, Response } from 'express';
import { ChatCompletionRequestSchema, type ChatCompletionRequest } from '../models/chat';
import { CompatibilityReporter } from '../validation/compatibility';
// ParameterValidator is not needed for this implementation
import { getLogger } from '../utils/logger';

const logger = getLogger('DebugRouter');

/**
 * Compatibility check response interface
 * Based on Python POST /v1/compatibility endpoint response
 */
export interface CompatibilityCheckResponse {
  compatibility_report: {
    supported_parameters: string[];
    unsupported_parameters: string[];
    warnings: string[];
    suggestions: string[];
  };
  claude_code_sdk_options: {
    supported: string[];
    custom_headers: string[];
  };
}

/**
 * Debug request validation response interface
 * Based on Python POST /v1/debug/request endpoint response
 */
export interface DebugRequestResponse {
  debug_info: {
    headers: Record<string, string>;
    method: string;
    url: string;
    raw_body: string;
    json_parse_error?: string;
    parsed_body?: any;
    validation_result: {
      valid: boolean;
      errors?: Array<{
        field: string;
        message: string;
        type: string;
        input?: any;
      }>;
      validated_data?: any;
    };
    debug_mode_enabled: boolean;
    example_valid_request: {
      model: string;
      messages: Array<{
        role: string;
        content: string;
      }>;
      stream: boolean;
    };
  };
}

/**
 * Debug Router class
 * Handles debug and compatibility analysis endpoints with Python compatibility
 */
export class DebugRouter {
  
  /**
   * Create Express router with debug endpoints
   * Based on Python FastAPI app debug route definitions
   */
  static createRouter(): Router {
    const router = Router();

    // POST /v1/compatibility - Check OpenAI API compatibility
    router.post('/v1/compatibility', this.checkCompatibility.bind(this));

    // POST /v1/debug/request - Debug request validation
    router.post('/v1/debug/request', this.debugRequestValidation.bind(this));

    logger.info('DebugRouter configured with 2 endpoints');
    return router;
  }

  /**
   * POST /v1/compatibility endpoint
   * Based on Python main.py:659-677 check_compatibility
   */
  static async checkCompatibility(req: Request, res: Response): Promise<void> {
    try {
      logger.debug('Processing compatibility check request');

      // Parse request body as ChatCompletionRequest
      let chatRequest: ChatCompletionRequest;
      try {
        chatRequest = ChatCompletionRequestSchema.parse(req.body);
      } catch (error) {
        logger.warn('Invalid request format for compatibility check', { error });
        res.status(400).json({
          error: 'Bad Request',
          message: 'Request body must be a valid ChatCompletionRequest format',
          details: error instanceof Error ? error.message : 'Unknown validation error'
        });
        return;
      }

      // Generate compatibility report using existing CompatibilityReporter
      const compatibilityReport = CompatibilityReporter.generateCompatibilityReport(chatRequest);

      // Create response matching Python format exactly
      const response: CompatibilityCheckResponse = {
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
      };

      logger.debug('Compatibility report generated', {
        supportedParams: compatibilityReport.supported_parameters.length,
        unsupportedParams: compatibilityReport.unsupported_parameters.length,
        warnings: compatibilityReport.warnings.length,
        suggestions: compatibilityReport.suggestions.length
      });

      res.json(response);
    } catch (error) {
      logger.error('Failed to process compatibility check', { error });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to analyze request compatibility'
      });
    }
  }

  /**
   * POST /v1/debug/request endpoint
   * Based on Python main.py:686-751 debug_request_validation
   */
  static async debugRequestValidation(req: Request, res: Response): Promise<void> {
    try {
      logger.debug('Processing debug request validation');

      // Get the raw request body (req.body is already parsed by express.json())
      const rawBody = JSON.stringify(req.body || {}, null, 2);

      // Try to parse and validate the request body
      let parsedBody: any = null;
      let jsonError: string | undefined = undefined;
      let validationResult: DebugRequestResponse['debug_info']['validation_result'] = {
        valid: false,
        errors: []
      };

      try {
        parsedBody = req.body || {};
        
        // Try to validate against ChatCompletionRequest model
        if (parsedBody && typeof parsedBody === 'object') {
          try {
            const chatRequest = ChatCompletionRequestSchema.parse(parsedBody);
            validationResult = {
              valid: true,
              validated_data: chatRequest
            };
          } catch (validationError) {
            if (validationError instanceof Error) {
              // Parse validation errors if they're in a structured format
              const errorMessage = validationError.message;
              validationResult = {
                valid: false,
                errors: [{
                  field: 'request',
                  message: errorMessage,
                  type: 'validation_error',
                  input: parsedBody
                }]
              };
            }
          }
        }
      } catch (parseError) {
        jsonError = parseError instanceof Error ? parseError.message : 'Unknown JSON parse error';
      }

      // Check if debug mode is enabled (check environment variables)
      const debugModeEnabled = this.isDebugModeEnabled();

      // Create debug response matching Python format exactly
      const debugResponse: DebugRequestResponse = {
        debug_info: {
          headers: this.extractHeaders(req),
          method: req?.method || 'UNKNOWN',
          url: req?.url || 'UNKNOWN',
          raw_body: rawBody,
          json_parse_error: jsonError,
          parsed_body: parsedBody,
          validation_result: validationResult,
          debug_mode_enabled: debugModeEnabled,
          example_valid_request: {
            model: "claude-3-sonnet-20240229",
            messages: [
              {"role": "user", "content": "Hello, world!"}
            ],
            stream: false
          }
        }
      };

      logger.debug('Debug request analysis completed', {
        method: req.method,
        url: req.url,
        bodySize: rawBody.length,
        validationPassed: validationResult.valid,
        debugMode: debugModeEnabled
      });

      res.json(debugResponse);
    } catch (error) {
      logger.error('Debug request validation failed', { error });
      
      // Return error response in debug format (with error field as extension)
      const errorResponse = {
        debug_info: {
          error: `Debug endpoint error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          headers: this.extractHeaders(req),
          method: req?.method || 'UNKNOWN',
          url: req?.url || 'UNKNOWN',
          raw_body: '',
          validation_result: { valid: false },
          debug_mode_enabled: this.isDebugModeEnabled(),
          example_valid_request: {
            model: "claude-3-sonnet-20240229",
            messages: [
              {"role": "user", "content": "Hello, world!"}
            ],
            stream: false
          }
        }
      };

      res.status(500).json(errorResponse);
    }
  }

  /**
   * Extract headers from request as plain object
   * Handles both string and string[] header values
   */
  private static extractHeaders(req: Request): Record<string, string> {
    const headers: Record<string, string> = {};
    
    // Handle case where req might be null/undefined
    if (!req || !req.headers) {
      return headers;
    }
    
    Object.entries(req.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers[key] = value;
      } else if (Array.isArray(value)) {
        headers[key] = value.join(', ');
      } else if (value !== undefined) {
        headers[key] = String(value);
      }
    });

    return headers;
  }

  /**
   * Check if debug mode is enabled
   * Based on Python DEBUG_MODE or VERBOSE environment variables
   */
  private static isDebugModeEnabled(): boolean {
    const debugMode = process.env.DEBUG_MODE?.toLowerCase();
    const verbose = process.env.VERBOSE?.toLowerCase();
    
    return (
      debugMode === 'true' || debugMode === '1' || debugMode === 'yes' || debugMode === 'on' ||
      verbose === 'true' || verbose === '1' || verbose === 'yes' || verbose === 'on'
    );
  }

  /**
   * Utility method to validate a raw request object
   * Used for testing and validation purposes
   */
  static validateRequestObject(requestData: any): {
    valid: boolean;
    errors: string[];
    parsedRequest?: ChatCompletionRequest;
  } {
    try {
      const chatRequest = ChatCompletionRequestSchema.parse(requestData);
      return {
        valid: true,
        errors: [],
        parsedRequest: chatRequest
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Validation failed']
      };
    }
  }

  /**
   * Utility method to get supported parameter information
   * For administrative and monitoring purposes
   */
  static getSupportedParameters(): {
    claude_sdk_supported: string[];
    openai_compatible: string[];
    custom_headers: string[];
  } {
    return {
      claude_sdk_supported: [
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
      openai_compatible: [
        "model",
        "messages", 
        "stream",
        "user"
      ],
      custom_headers: [
        "X-Claude-Max-Turns", 
        "X-Claude-Allowed-Tools", 
        "X-Claude-Disallowed-Tools", 
        "X-Claude-Permission-Mode",
        "X-Claude-Max-Thinking-Tokens"
      ]
    };
  }

  /**
   * Utility method to analyze request compatibility
   * For programmatic access to compatibility checking
   */
  static analyzeCompatibility(requestData: any): {
    isCompatible: boolean;
    supportedCount: number;
    unsupportedCount: number;
    suggestions: string[];
  } {
    try {
      const chatRequest = ChatCompletionRequestSchema.parse(requestData);
      const report = CompatibilityReporter.generateCompatibilityReport(chatRequest);
      
      return {
        isCompatible: report.unsupported_parameters.length === 0,
        supportedCount: report.supported_parameters.length,
        unsupportedCount: report.unsupported_parameters.length,
        suggestions: report.suggestions
      };
    } catch (error) {
      return {
        isCompatible: false,
        supportedCount: 0,
        unsupportedCount: 0,
        suggestions: ['Request format is invalid and cannot be analyzed']
      };
    }
  }
}