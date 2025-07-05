/**
 * Debug Router - Debug and Compatibility Endpoints
 * Phase 14A Implementation: Complete debug and compatibility endpoints
 * Based on Phase 14A requirements for tool call inspection and debugging
 * 
 * Single Responsibility: HTTP endpoint handling for debugging and compatibility analysis
 */

import { Router } from 'express';
import { debugRouter } from '../debug/debug-router';
import { CompatibilityReporter } from '../validation/compatibility';
import { ChatCompletionRequestSchema } from '../models/chat';
import { getLogger } from '../utils/logger';

const logger = getLogger('DebugRouter');

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Compatibility analysis result interface
 */
export interface CompatibilityAnalysisResult {
  isCompatible: boolean;
  supportedCount: number;
  unsupportedCount: number;
  suggestions: string[];
}

/**
 * Debug request response interface
 */
export interface DebugRequestResponse {
  debug_info: {
    headers: any;
    method: string;
    url: string;
    raw_body: string;
    json_parse_error?: string;
    parsed_body: any;
    validation_result: ValidationResult;
    debug_mode_enabled: boolean;
    example_valid_request: any;
  };
}

/**
 * Compatibility check response interface
 */
export interface CompatibilityCheckResponse {
  isCompatible: boolean;
  supportedCount: number;
  unsupportedCount: number;
  suggestions: string[];
  compatibility_report: any;
}

/**
 * Debug Router class
 * Phase 14A implementation using new debug services
 */
export class DebugRouter {
  
  /**
   * Create Express router with debug endpoints
   * Uses the new Phase 14A debug-router implementation
   */
  static createRouter(): Router {
    const router = debugRouter.getRouter();
    logger.info('DebugRouter configured with Phase 14A debug services');
    return router;
  }

  /**
   * Validate request object against ChatCompletionRequestSchema
   */
  static validateRequestObject(request: any): ValidationResult & { parsedRequest?: any } {
    try {
      const parsedRequest = ChatCompletionRequestSchema.parse(request);
      return { valid: true, errors: [], parsedRequest };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Validation failed';
      return { valid: false, errors: [errorMessage] };
    }
  }

  /**
   * Get supported parameters information
   */
  static getSupportedParameters() {
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
   * Analyze OpenAI compatibility of request
   */
  static analyzeCompatibility(request: any): CompatibilityAnalysisResult {
    try {
      ChatCompletionRequestSchema.parse(request);
      const report = CompatibilityReporter.generateCompatibilityReport(request);
      
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

  /**
   * Check if debug mode is enabled
   */
  private static isDebugModeEnabled(): boolean {
    const debugMode = process.env.DEBUG_MODE?.toLowerCase();
    const verbose = process.env.VERBOSE?.toLowerCase();
    
    const debugValues = ['true', '1', 'yes', 'on'];
    
    return debugValues.includes(debugMode || '') || debugValues.includes(verbose || '');
  }

  /**
   * Extract and normalize headers from request
   */
  private static extractHeaders(request: any): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (request.headers) {
      for (const [key, value] of Object.entries(request.headers)) {
        if (Array.isArray(value)) {
          headers[key] = value.join(', ');
        } else if (value !== undefined) {
          headers[key] = String(value);
        }
      }
    }
    
    return headers;
  }

  /**
   * Debug request validation handler
   * For unit testing and debugging purposes
   */
  static async debugRequestValidation(req: any, res: any): Promise<void> {
    try {
      const body = req.body || {};
      const rawBody = JSON.stringify(body, null, 2);
      
      // Check debug mode from environment  
      const debugModeEnabled = DebugRouter.isDebugModeEnabled();
      
      // Try to validate the request if it looks like a chat completion request
      let validationResult: any = { valid: false, errors: [] };
      
      try {
        if (Object.keys(body).length > 0) {
          const chatRequest = ChatCompletionRequestSchema.parse(body);
          validationResult = {
            valid: true,
            validated_data: chatRequest
          };
        }
      } catch (error) {
        validationResult = {
          valid: false,
          errors: [{
            field: 'request',
            message: error instanceof Error ? error.message : String(error),
            type: 'validation_error',
            input: body
          }]
        };
      }
      
      // Return debug info in expected format (matching test expectations)
      res.json({
        debug_info: {
          headers: DebugRouter.extractHeaders(req),
          method: req.method,
          url: req.url,
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
    } catch (error) {
      logger.error('Debug request validation error:', error);
      res.status(500).json({
        debug_info: {
          error: `Debug endpoint error: ${error instanceof Error ? error.message : String(error)}`,
          method: req?.method || 'UNKNOWN',
          url: req?.url || 'UNKNOWN',
          raw_body: req?.body ? JSON.stringify(req.body, null, 2) : '',
          validation_result: { valid: false },
          debug_mode_enabled: false
        }
      });
    }
  }

  /**
   * Compatibility check handler
   * For unit testing and debugging purposes
   */
  static async checkCompatibility(req: any, res: any): Promise<void> {
    try {
      const request = req.body || {};
      
      // Validate request format first - call parse directly for test compatibility
      let parsedRequest;
      try {
        parsedRequest = ChatCompletionRequestSchema.parse(request);
      } catch (error) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Request body must be a valid ChatCompletionRequest format',
          details: error instanceof Error ? error.message : String(error)
        });
        return;
      }

      const report = CompatibilityReporter.generateCompatibilityReport(parsedRequest);

      // Return format matching Python main.py and test expectations
      res.json({
        compatibility_report: report,
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
}

/**
 * Default export for backward compatibility
 */
export default DebugRouter.createRouter();