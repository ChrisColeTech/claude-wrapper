/**
 * Debug Request Validator (Phase 14B)
 * Single Responsibility: Request validation and parameter checking for debug endpoints
 * 
 * Extracted from oversized debug-router.ts following SRP
 * Validates and sanitizes debug request parameters
 */

import { Request } from 'express';
import { 
  DEBUG_PERFORMANCE_LIMITS,
  DEBUG_MODES,
  DEBUG_ERROR_CODES
} from '../../tools/constants';
import { getLogger } from '../../utils/logger';

const logger = getLogger('DebugRequestValidator');

/**
 * Tool inspection request parameters
 */
export interface ToolInspectionRequest {
  sessionId: string;
  toolCallId: string;
  detailLevel?: 'basic' | 'detailed' | 'comprehensive';
  includeHistory?: boolean;
}

/**
 * Compatibility check request parameters
 */
export interface CompatibilityCheckRequest {
  tools: any[];
  request?: any;
  response?: any;
  strictMode?: boolean;
}

/**
 * History inspection request parameters
 */
export interface HistoryInspectionRequest {
  sessionId: string;
  limit?: number;
  includePerformanceData?: boolean;
  timeRange?: {
    startTime: number;
    endTime: number;
  };
}

/**
 * Performance analysis request parameters
 */
export interface PerformanceAnalysisRequest {
  sessionId: string;
  toolCallId?: string;
  includeBaseline?: boolean;
  generateRecommendations?: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedParams?: any;
}

/**
 * Request validator for debug endpoints
 */
export class DebugRequestValidator {

  /**
   * Validate tool inspection request
   */
  static validateToolInspectionRequest(req: Request): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const { sessionId, toolCallId, detailLevel, includeHistory } = req.body;

      // Validate required fields
      if (!sessionId || typeof sessionId !== 'string') {
        errors.push('sessionId is required and must be a string');
      } else if (sessionId.length === 0) {
        errors.push('sessionId cannot be empty');
      }

      if (!toolCallId || typeof toolCallId !== 'string') {
        errors.push('toolCallId is required and must be a string');
      } else if (toolCallId.length === 0) {
        errors.push('toolCallId cannot be empty');
      }

      // Validate optional fields
      if (detailLevel && !['basic', 'detailed', 'comprehensive'].includes(detailLevel)) {
        errors.push('detailLevel must be one of: basic, detailed, comprehensive');
      }

      if (includeHistory !== undefined && typeof includeHistory !== 'boolean') {
        warnings.push('includeHistory should be a boolean, converting to boolean');
      }

      const sanitizedParams: ToolInspectionRequest = {
        sessionId: sessionId?.trim(),
        toolCallId: toolCallId?.trim(),
        detailLevel: detailLevel || 'detailed',
        includeHistory: Boolean(includeHistory)
      };

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        sanitizedParams
      };

    } catch (error) {
      logger.error('Tool inspection request validation failed', { error });
      return {
        valid: false,
        errors: ['Invalid request format'],
        warnings: []
      };
    }
  }

  /**
   * Validate compatibility check request
   */
  static validateCompatibilityCheckRequest(req: Request): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const { tools, request, response, strictMode } = req.body;

      // Validate tools array
      if (!tools || !Array.isArray(tools)) {
        errors.push('tools is required and must be an array');
      } else if (tools.length === 0) {
        errors.push('tools array cannot be empty');
      } else {
        // Basic tool structure validation
        tools.forEach((tool, index) => {
          if (!tool || typeof tool !== 'object') {
            errors.push(`tools[${index}] must be an object`);
          } else if (!tool.type || tool.type !== 'function') {
            errors.push(`tools[${index}] must have type 'function'`);
          } else if (!tool.function || !tool.function.name) {
            errors.push(`tools[${index}] must have a function with a name`);
          }
        });
      }

      // Validate optional fields
      if (strictMode !== undefined && typeof strictMode !== 'boolean') {
        warnings.push('strictMode should be a boolean, converting to boolean');
      }

      if (request && typeof request !== 'object') {
        warnings.push('request parameter should be an object');
      }

      if (response && typeof response !== 'object') {
        warnings.push('response parameter should be an object');
      }

      const sanitizedParams: CompatibilityCheckRequest = {
        tools: tools || [],
        request,
        response,
        strictMode: Boolean(strictMode)
      };

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        sanitizedParams
      };

    } catch (error) {
      logger.error('Compatibility check request validation failed', { error });
      return {
        valid: false,
        errors: ['Invalid request format'],
        warnings: []
      };
    }
  }

  /**
   * Validate history inspection request
   */
  static validateHistoryInspectionRequest(req: Request): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const { sessionId, limit, includePerformanceData, timeRange } = req.body;

      // Validate required fields
      if (!sessionId || typeof sessionId !== 'string') {
        errors.push('sessionId is required and must be a string');
      } else if (sessionId.length === 0) {
        errors.push('sessionId cannot be empty');
      }

      // Validate optional fields
      if (limit !== undefined) {
        if (typeof limit !== 'number' || limit <= 0) {
          errors.push('limit must be a positive number');
        } else if (limit > DEBUG_PERFORMANCE_LIMITS.MAX_HISTORY_ENTRIES) {
          warnings.push(`limit exceeds maximum of ${DEBUG_PERFORMANCE_LIMITS.MAX_HISTORY_ENTRIES}, will be capped`);
        }
      }

      if (includePerformanceData !== undefined && typeof includePerformanceData !== 'boolean') {
        warnings.push('includePerformanceData should be a boolean, converting to boolean');
      }

      // Validate time range
      if (timeRange) {
        if (typeof timeRange !== 'object') {
          errors.push('timeRange must be an object');
        } else {
          if (typeof timeRange.startTime !== 'number' || typeof timeRange.endTime !== 'number') {
            errors.push('timeRange must have numeric startTime and endTime');
          } else if (timeRange.startTime >= timeRange.endTime) {
            errors.push('timeRange startTime must be before endTime');
          }
        }
      }

      const sanitizedParams: HistoryInspectionRequest = {
        sessionId: sessionId?.trim(),
        limit: Math.min(limit || DEBUG_PERFORMANCE_LIMITS.MAX_HISTORY_ENTRIES, DEBUG_PERFORMANCE_LIMITS.MAX_HISTORY_ENTRIES),
        includePerformanceData: Boolean(includePerformanceData),
        timeRange
      };

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        sanitizedParams
      };

    } catch (error) {
      logger.error('History inspection request validation failed', { error });
      return {
        valid: false,
        errors: ['Invalid request format'],
        warnings: []
      };
    }
  }

  /**
   * Validate performance analysis request
   */
  static validatePerformanceAnalysisRequest(req: Request): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const { sessionId, toolCallId, includeBaseline, generateRecommendations } = req.body;

      // Validate required fields
      if (!sessionId || typeof sessionId !== 'string') {
        errors.push('sessionId is required and must be a string');
      } else if (sessionId.length === 0) {
        errors.push('sessionId cannot be empty');
      }

      // toolCallId is optional for performance analysis
      if (toolCallId && typeof toolCallId !== 'string') {
        errors.push('toolCallId must be a string if provided');
      }

      // Validate optional fields
      if (includeBaseline !== undefined && typeof includeBaseline !== 'boolean') {
        warnings.push('includeBaseline should be a boolean, converting to boolean');
      }

      if (generateRecommendations !== undefined && typeof generateRecommendations !== 'boolean') {
        warnings.push('generateRecommendations should be a boolean, converting to boolean');
      }

      const sanitizedParams: PerformanceAnalysisRequest = {
        sessionId: sessionId?.trim(),
        toolCallId: toolCallId?.trim(),
        includeBaseline: Boolean(includeBaseline),
        generateRecommendations: Boolean(generateRecommendations)
      };

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        sanitizedParams
      };

    } catch (error) {
      logger.error('Performance analysis request validation failed', { error });
      return {
        valid: false,
        errors: ['Invalid request format'],
        warnings: []
      };
    }
  }

  /**
   * Validate debug mode parameter
   */
  static validateDebugMode(mode: string): boolean {
    return Object.values(DEBUG_MODES).includes(mode as any);
  }

  /**
   * Extract and validate common debug parameters
   */
  static extractCommonParams(req: Request): {
    debugMode: string;
    requestId: string;
    timeout?: number;
  } {
    const debugMode = req.query.mode as string || DEBUG_MODES.INSPECTION;
    const requestId = req.headers['x-request-id'] as string || this.generateRequestId();
    const timeout = req.query.timeout ? parseInt(req.query.timeout as string, 10) : undefined;

    return {
      debugMode: this.validateDebugMode(debugMode) ? debugMode : DEBUG_MODES.INSPECTION,
      requestId,
      timeout: timeout && timeout > 0 && timeout <= DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS * 2 
        ? timeout 
        : undefined
    };
  }

  /**
   * Generate unique request ID
   */
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}