/**
 * Debug Response Utilities (Phase 14B)
 * Single Responsibility: Response formatting and error handling for debug endpoints
 * 
 * Extracted from oversized debug-router.ts following SRP
 * Provides standardized response formatting and error handling
 */

import { Response } from 'express';
import {
  DEBUG_PERFORMANCE_LIMITS,
  DEBUG_ERROR_CODES,
  DEBUG_MESSAGES
} from '../../tools/constants';
import { getLogger } from '../../utils/logger';

const logger = getLogger('DebugResponseUtils');

/**
 * Standard debug response format
 */
export interface DebugResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    timestamp: number;
    responseTimeMs: number;
    debugMode: string;
    requestId?: string;
  };
}

/**
 * Debug error details
 */
export interface DebugError {
  code: string;
  message: string;
  category: 'validation' | 'processing' | 'timeout' | 'system';
  details?: Record<string, any>;
  statusCode: number;
}

/**
 * Response utility functions for debug endpoints
 */
export class DebugResponseUtils {

  /**
   * Send successful debug response
   */
  static sendSuccess<T>(
    res: Response, 
    data: T, 
    debugMode: string, 
    startTime: number,
    requestId?: string
  ): void {
    const responseTimeMs = performance.now() - startTime;
    
    // Check performance requirement
    if (responseTimeMs > DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS) {
      logger.warn(DEBUG_MESSAGES.DEBUG_ENDPOINT_TIMEOUT, { 
        responseTimeMs, 
        debugMode, 
        requestId 
      });
    }

    const response: DebugResponse<T> = {
      success: true,
      data,
      metadata: {
        timestamp: Date.now(),
        responseTimeMs,
        debugMode,
        requestId
      }
    };

    res.status(200).json(response);
    
    logger.info('Debug response sent successfully', { 
      debugMode, 
      responseTimeMs, 
      requestId 
    });
  }

  /**
   * Send error debug response
   */
  static sendError(
    res: Response, 
    error: DebugError, 
    debugMode: string, 
    startTime: number,
    requestId?: string
  ): void {
    const responseTimeMs = performance.now() - startTime;

    const response: DebugResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      },
      metadata: {
        timestamp: Date.now(),
        responseTimeMs,
        debugMode,
        requestId
      }
    };

    res.status(error.statusCode).json(response);
    
    logger.error('Debug error response sent', { 
      error: error.code, 
      message: error.message,
      debugMode, 
      responseTimeMs, 
      requestId 
    });
  }

  /**
   * Handle router-level errors
   */
  static handleRouterError(
    error: any, 
    debugMode: string, 
    startTime: number, 
    res: Response,
    requestId?: string
  ): void {
    logger.error('Router error occurred', { error, debugMode, requestId });

    const debugError: DebugError = {
      code: DEBUG_ERROR_CODES.DEBUG_FEATURE_DISABLED,
      message: error instanceof Error ? error.message : 'Unknown debug router error',
      category: 'system',
      details: {
        originalError: error instanceof Error ? error.stack : String(error),
        debugMode
      },
      statusCode: 500
    };

    this.sendError(res, debugError, debugMode, startTime, requestId);
  }

  /**
   * Check and validate performance requirements
   */
  static checkPerformanceRequirement(
    startTime: number, 
    operation: string,
    requestId?: string
  ): boolean {
    const responseTimeMs = performance.now() - startTime;
    const isWithinLimit = responseTimeMs <= DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS;

    if (!isWithinLimit) {
      logger.warn('Performance requirement violation', {
        operation,
        responseTimeMs,
        limit: DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS,
        requestId
      });
    }

    return isWithinLimit;
  }

  /**
   * Create validation error
   */
  static createValidationError(message: string, details?: any): DebugError {
    return {
      code: DEBUG_ERROR_CODES.INVALID_DEBUG_REQUEST,
      message: `Validation failed: ${message}`,
      category: 'validation',
      details,
      statusCode: 400
    };
  }

  /**
   * Create processing error
   */
  static createProcessingError(operation: string, originalError: any): DebugError {
    return {
      code: DEBUG_ERROR_CODES.TOOL_INSPECTION_FAILED,
      message: `${operation} failed: ${originalError instanceof Error ? originalError.message : 'Unknown error'}`,
      category: 'processing',
      details: {
        operation,
        originalError: originalError instanceof Error ? originalError.stack : String(originalError)
      },
      statusCode: 500
    };
  }

  /**
   * Create timeout error
   */
  static createTimeoutError(operation: string, timeoutMs: number): DebugError {
    return {
      code: DEBUG_ERROR_CODES.DEBUG_ENDPOINT_TIMEOUT,
      message: `${operation} exceeded ${timeoutMs}ms timeout`,
      category: 'timeout',
      details: {
        operation,
        timeoutMs,
        limit: DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS
      },
      statusCode: 408
    };
  }

  /**
   * Create feature disabled error
   */
  static createFeatureDisabledError(feature: string): DebugError {
    return {
      code: DEBUG_ERROR_CODES.DEBUG_FEATURE_DISABLED,
      message: `${feature} is currently disabled`,
      category: 'system',
      details: {
        feature,
        suggestion: 'Enable the feature in debug configuration'
      },
      statusCode: 503
    };
  }

  /**
   * Generate request ID for tracking
   */
  static generateRequestId(): string {
    return `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log request start
   */
  static logRequestStart(
    operation: string, 
    params: any, 
    requestId: string
  ): void {
    logger.info('Debug request started', {
      operation,
      requestId,
      params: this.sanitizeParams(params)
    });
  }

  /**
   * Log request completion
   */
  static logRequestComplete(
    operation: string, 
    requestId: string, 
    responseTimeMs: number,
    success: boolean
  ): void {
    logger.info('Debug request completed', {
      operation,
      requestId,
      responseTimeMs,
      success,
      withinPerformanceLimit: responseTimeMs <= DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS
    });
  }

  /**
   * Sanitize parameters for logging (remove sensitive data)
   */
  private static sanitizeParams(params: any): any {
    if (!params || typeof params !== 'object') {
      return params;
    }

    const sanitized = { ...params };
    
    // Remove potentially sensitive fields
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'authorization'];
    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}