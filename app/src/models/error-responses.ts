/**
 * Standardized Error Response Models
 * OpenAI-compatible error response structures with enhanced debugging
 * 
 * Single Responsibility: Error response formatting and standardization
 * Integrates with error classification and validation handling
 */

import { ErrorClassification } from '../middleware/error-classifier';
import { ValidationErrorReport } from '../middleware/validation-handler';
import { RequestMetadata } from '../middleware/request-id';

/**
 * Base error response structure following OpenAI API format
 */
export interface BaseErrorResponse {
  error: {
    type: string;
    message: string;
    code: string;
    param?: string;
    request_id?: string;
  };
}

/**
 * Enhanced error response with detailed debugging information
 */
export interface EnhancedErrorResponse extends BaseErrorResponse {
  error: BaseErrorResponse['error'] & {
    details?: {
      classification?: {
        category: string;
        severity: string;
        retry_strategy: string;
        operational_impact: string;
      };
      suggestions?: string[];
      documentation_url?: string;
      timestamp: string;
      endpoint?: string;
      correlation_id?: string;
    };
    debug_info?: {
      request_metadata?: Partial<RequestMetadata>;
      processing_time_ms?: number;
      error_context?: Record<string, any>;
      stack_trace?: string;
    };
  };
}

/**
 * Validation error response with field-level details
 */
export interface ValidationErrorResponse extends EnhancedErrorResponse {
  error: EnhancedErrorResponse['error'] & {
    type: 'validation_error';
    details: EnhancedErrorResponse['error']['details'] & {
      invalid_fields: {
        field: string;
        path: string;
        message: string;
        code: string;
        value?: any;
        suggestion?: string;
        constraint?: string;
      }[];
      field_count: number;
      validation_schema?: string;
    };
  };
}

/**
 * Authentication error response
 */
export interface AuthenticationErrorResponse extends EnhancedErrorResponse {
  error: EnhancedErrorResponse['error'] & {
    type: 'authentication_error';
    details: EnhancedErrorResponse['error']['details'] & {
      auth_method?: string;
      token_status?: 'missing' | 'invalid' | 'expired';
      required_scopes?: string[];
    };
  };
}

/**
 * Rate limit error response with retry information
 */
export interface RateLimitErrorResponse extends EnhancedErrorResponse {
  error: EnhancedErrorResponse['error'] & {
    type: 'rate_limit_error';
    details: EnhancedErrorResponse['error']['details'] & {
      retry_after_seconds?: number;
      limit_type: 'requests' | 'tokens' | 'bandwidth';
      current_usage?: number;
      limit_value?: number;
      reset_time?: string;
    };
  };
}

/**
 * Server error response with operational details
 */
export interface ServerErrorResponse extends EnhancedErrorResponse {
  error: EnhancedErrorResponse['error'] & {
    type: 'server_error';
    details: EnhancedErrorResponse['error']['details'] & {
      service_status?: 'degraded' | 'partial_outage' | 'outage';
      affected_services?: string[];
      estimated_recovery?: string;
      incident_id?: string;
    };
  };
}

/**
 * Error response factory for creating standardized error responses
 */
export class ErrorResponseFactory {
  private static readonly DOCUMENTATION_BASE_URL = 'https://docs.anthropic.com/claude/errors';

  /**
   * Create basic error response from classification
   */
  static createFromClassification(
    error: Error,
    classification: ErrorClassification,
    requestId?: string
  ): EnhancedErrorResponse {
    const baseResponse: EnhancedErrorResponse = {
      error: {
        type: this.mapCategoryToType(classification.category),
        message: error.message,
        code: classification.errorCode,
        request_id: requestId,
        details: {
          classification: {
            category: classification.category,
            severity: classification.severity,
            retry_strategy: classification.retryStrategy,
            operational_impact: classification.operationalImpact
          },
          suggestions: classification.clientGuidance,
          documentation_url: this.getDocumentationUrl(classification.category),
          timestamp: new Date().toISOString()
        }
      }
    };

    // Add debug information if available
    if (classification.debugInfo) {
      baseResponse.error.debug_info = {
        error_context: classification.debugInfo,
        processing_time_ms: Date.now() // Will be updated by caller
      };
    }

    return baseResponse;
  }

  /**
   * Create validation error response from validation report
   */
  static createValidationErrorResponse(
    report: ValidationErrorReport,
    requestId?: string
  ): ValidationErrorResponse {
    return {
      error: {
        type: 'validation_error',
        message: `Request validation failed with ${report.errorCount} error(s)`,
        code: report.classification.errorCode,
        request_id: requestId,
        details: {
          classification: {
            category: report.classification.category,
            severity: report.classification.severity,
            retry_strategy: report.classification.retryStrategy,
            operational_impact: report.classification.operationalImpact
          },
          invalid_fields: report.errors.map(error => ({
            field: error.field,
            path: error.path,
            message: error.message,
            code: error.code,
            value: this.sanitizeValue(error.value),
            suggestion: error.suggestion,
            constraint: error.constraint
          })),
          field_count: report.errorCount,
          suggestions: report.suggestions,
          documentation_url: this.getDocumentationUrl('validation'),
          timestamp: report.context.timestamp.toISOString(),
          endpoint: report.context.endpoint,
          correlation_id: report.context.requestId
        },
        debug_info: report.debugInfo ? {
          request_metadata: {
            method: report.context.method,
            endpoint: report.context.endpoint,
            timestamp: report.context.timestamp,
            userAgent: report.context.userAgent
          },
          processing_time_ms: report.processingTime,
          error_context: {
            validation_schema: 'standard',
            total_fields_validated: report.errors.length
          }
        } : undefined
      }
    };
  }

  /**
   * Create authentication error response
   */
  static createAuthenticationErrorResponse(
    message: string,
    authMethod?: string,
    tokenStatus?: 'missing' | 'invalid' | 'expired',
    requestId?: string
  ): AuthenticationErrorResponse {
    return {
      error: {
        type: 'authentication_error',
        message,
        code: 'AUTHENTICATION_FAILED',
        request_id: requestId,
        details: {
          classification: {
            category: 'authentication_error',
            severity: 'medium',
            retry_strategy: 'no_retry',
            operational_impact: 'Access denied - request rejected'
          },
          auth_method: authMethod,
          token_status: tokenStatus,
          suggestions: this.getAuthenticationSuggestions(tokenStatus),
          documentation_url: this.getDocumentationUrl('authentication'),
          timestamp: new Date().toISOString()
        }
      }
    };
  }

  /**
   * Create rate limit error response
   */
  static createRateLimitErrorResponse(
    message: string,
    retryAfter?: number,
    limitType: 'requests' | 'tokens' | 'bandwidth' = 'requests',
    requestId?: string
  ): RateLimitErrorResponse {
    return {
      error: {
        type: 'rate_limit_error',
        message,
        code: 'RATE_LIMIT_EXCEEDED',
        request_id: requestId,
        details: {
          classification: {
            category: 'rate_limit_error',
            severity: 'medium',
            retry_strategy: 'exponential_backoff',
            operational_impact: 'Request throttled - temporary limitation'
          },
          retry_after_seconds: retryAfter,
          limit_type: limitType,
          reset_time: retryAfter ? new Date(Date.now() + retryAfter * 1000).toISOString() : undefined,
          suggestions: [
            'Implement exponential backoff retry strategy',
            'Reduce request frequency',
            'Check rate limit headers in response'
          ],
          documentation_url: this.getDocumentationUrl('rate_limits'),
          timestamp: new Date().toISOString()
        }
      }
    };
  }

  /**
   * Create server error response
   */
  static createServerErrorResponse(
    message: string,
    serviceStatus: 'degraded' | 'partial_outage' | 'outage' = 'degraded',
    requestId?: string
  ): ServerErrorResponse {
    return {
      error: {
        type: 'server_error',
        message,
        code: 'INTERNAL_SERVER_ERROR',
        request_id: requestId,
        details: {
          classification: {
            category: 'server_error',
            severity: serviceStatus === 'outage' ? 'critical' : 'high',
            retry_strategy: 'exponential_backoff',
            operational_impact: this.getServiceImpactMessage(serviceStatus)
          },
          service_status: serviceStatus,
          suggestions: this.getServerErrorSuggestions(serviceStatus),
          documentation_url: this.getDocumentationUrl('server_errors'),
          timestamp: new Date().toISOString()
        }
      }
    };
  }

  /**
   * Create minimal error response for production (without debug info)
   */
  static createMinimalErrorResponse(
    type: string,
    message: string,
    code: string,
    requestId?: string
  ): BaseErrorResponse {
    return {
      error: {
        type,
        message,
        code,
        request_id: requestId
      }
    };
  }

  /**
   * Add request metadata to error response
   */
  static addRequestMetadata(
    response: EnhancedErrorResponse,
    metadata: RequestMetadata
  ): EnhancedErrorResponse {
    if (!response.error.debug_info) {
      response.error.debug_info = {};
    }

    response.error.debug_info.request_metadata = {
      method: metadata.method,
      endpoint: metadata.endpoint,
      timestamp: metadata.timestamp,
      userAgent: metadata.userAgent,
      clientIP: metadata.clientIP,
      duration: metadata.duration,
      errorCount: metadata.errorCount
    };

    if (metadata.correlationId) {
      if (!response.error.details) {
        response.error.details = { timestamp: new Date().toISOString() };
      }
      response.error.details.correlation_id = metadata.correlationId;
    }

    return response;
  }

  /**
   * Map error category to OpenAI-compatible error type
   */
  private static mapCategoryToType(category: string): string {
    const mapping: Record<string, string> = {
      'client_error': 'invalid_request_error',
      'server_error': 'api_error',
      'validation_error': 'invalid_request_error',
      'authentication_error': 'authentication_error',
      'authorization_error': 'permission_error',
      'rate_limit_error': 'rate_limit_error',
      'network_error': 'api_connection_error',
      'system_error': 'api_error'
    };

    return mapping[category] || 'api_error';
  }

  /**
   * Get documentation URL for error category
   */
  private static getDocumentationUrl(category: string): string {
    const urlMap: Record<string, string> = {
      'validation': `${this.DOCUMENTATION_BASE_URL}/validation`,
      'authentication': `${this.DOCUMENTATION_BASE_URL}/authentication`,
      'rate_limits': `${this.DOCUMENTATION_BASE_URL}/rate-limits`,
      'server_errors': `${this.DOCUMENTATION_BASE_URL}/server-errors`
    };

    return urlMap[category] || `${this.DOCUMENTATION_BASE_URL}/general`;
  }

  /**
   * Get authentication error suggestions
   */
  private static getAuthenticationSuggestions(tokenStatus?: string): string[] {
    const basesSuggestions = [
      'Verify your API key is correct',
      'Check authentication headers format',
      'Ensure API key has required permissions'
    ];

    switch (tokenStatus) {
      case 'missing':
        return ['Provide a valid API key in the Authorization header', ...basesSuggestions];
      case 'invalid':
        return ['Check API key format and validity', ...basesSuggestions];
      case 'expired':
        return ['Renew your API key', 'Check key expiration date', ...basesSuggestions];
      default:
        return basesSuggestions;
    }
  }

  /**
   * Get server error suggestions based on service status
   */
  private static getServerErrorSuggestions(serviceStatus: string): string[] {
    const baseSuggestions = [
      'Retry the request with exponential backoff',
      'Check service status page for ongoing issues'
    ];

    switch (serviceStatus) {
      case 'outage':
        return [
          'Service is currently unavailable',
          'Monitor status page for recovery updates',
          'Contact support if issue persists'
        ];
      case 'partial_outage':
        return [
          'Some services may be affected',
          ...baseSuggestions,
          'Try alternative endpoints if available'
        ];
      default:
        return baseSuggestions;
    }
  }

  /**
   * Get service impact message for operational status
   */
  private static getServiceImpactMessage(serviceStatus: string): string {
    switch (serviceStatus) {
      case 'outage':
        return 'Service unavailable - complete outage';
      case 'partial_outage':
        return 'Service partially degraded - some features affected';
      case 'degraded':
        return 'Service degraded - performance may be affected';
      default:
        return 'Service experiencing issues';
    }
  }

  /**
   * Sanitize values for safe inclusion in error responses
   */
  private static sanitizeValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Redact sensitive patterns
    const sensitivePatterns = [
      /api[_-]?key/i,
      /password/i,
      /token/i,
      /secret/i,
      /auth/i,
      /bearer/i
    ];

    if (typeof value === 'string') {
      // Check for sensitive content
      for (const pattern of sensitivePatterns) {
        if (pattern.test(value)) {
          return '[REDACTED]';
        }
      }
      
      // Truncate long strings
      return value.length > 200 ? value.substring(0, 200) + '...' : value;
    }

    if (typeof value === 'object' && value !== null) {
      const sanitized: any = Array.isArray(value) ? [] : {};
      
      for (const [key, val] of Object.entries(value)) {
        const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));
        sanitized[key] = isSensitive ? '[REDACTED]' : this.sanitizeValue(val);
      }
      
      return sanitized;
    }

    return value;
  }
}

// Export error response types and factory
export {
  ErrorResponseFactory as ErrorResponse
};

// Common error response creators for convenience
export const createValidationError = (report: ValidationErrorReport, requestId?: string) =>
  ErrorResponseFactory.createValidationErrorResponse(report, requestId);

export const createAuthError = (message: string, requestId?: string) =>
  ErrorResponseFactory.createAuthenticationErrorResponse(message, undefined, undefined, requestId);

export const createRateLimitError = (message: string, retryAfter?: number, requestId?: string) =>
  ErrorResponseFactory.createRateLimitErrorResponse(message, retryAfter, 'requests', requestId);

export const createServerError = (message: string, requestId?: string) =>
  ErrorResponseFactory.createServerErrorResponse(message, 'degraded', requestId);