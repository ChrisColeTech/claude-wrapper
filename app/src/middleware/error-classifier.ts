/**
 * Error Classification and Categorization System
 * Comprehensive error handling for production deployments
 * 
 * Single Responsibility: Error classification, categorization, and severity assessment
 * Integrates with existing error middleware for enhanced error handling
 */

import { createLogger } from '../utils/logger';
import { config } from '../utils/env';
import winston from 'winston';

/**
 * Error severity levels for operational classification
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error categories for comprehensive classification
 */
export enum ErrorCategory {
  CLIENT_ERROR = 'client_error',
  SERVER_ERROR = 'server_error',
  VALIDATION_ERROR = 'validation_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  AUTHORIZATION_ERROR = 'authorization_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  NETWORK_ERROR = 'network_error',
  SYSTEM_ERROR = 'system_error'
}

/**
 * Retry strategy recommendations for clients
 */
export enum RetryStrategy {
  NO_RETRY = 'no_retry',
  IMMEDIATE_RETRY = 'immediate_retry',
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  LINEAR_BACKOFF = 'linear_backoff',
  AFTER_DELAY = 'after_delay'
}

/**
 * Comprehensive error classification result
 */
export interface ErrorClassification {
  category: ErrorCategory;
  severity: ErrorSeverity;
  retryStrategy: RetryStrategy;
  httpStatusCode: number;
  errorCode: string;
  isRetryable: boolean;
  suggestedDelay?: number;
  debugInfo?: Record<string, any>;
  operationalImpact: string;
  clientGuidance: string[];
}

/**
 * Error pattern for recognition and classification
 */
export interface ErrorPattern {
  matcher: (error: Error) => boolean;
  classification: Partial<ErrorClassification>;
  description: string;
}

/**
 * Error statistics for pattern analysis
 */
export interface ErrorStatistics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  retryableErrors: number;
  averageProcessingTime: number;
  lastProcessed: Date;
}

/**
 * Production-grade error classifier with comprehensive categorization
 * Follows SRP: handles only error classification and pattern recognition
 */
export class ErrorClassifier {
  private logger: winston.Logger;
  private errorPatterns: ErrorPattern[] = [];
  private statistics: ErrorStatistics;
  private processingTimes: number[] = [];

  constructor() {
    this.logger = createLogger(config);
    
    this.statistics = {
      totalErrors: 0,
      errorsByCategory: this.initializeCategoryStats(),
      errorsBySeverity: this.initializeSeverityStats(),
      retryableErrors: 0,
      averageProcessingTime: 0,
      lastProcessed: new Date()
    };

    this.registerDefaultPatterns();
  }

  /**
   * Classify error with comprehensive categorization
   * Performance requirement: <10ms processing time
   */
  classifyError(error: Error, context?: Record<string, any>): ErrorClassification {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Classifying error', { 
        errorType: error.constructor.name,
        message: error.message,
        context 
      });

      // Find matching pattern
      const pattern = this.findMatchingPattern(error);
      
      // Build base classification
      const classification: ErrorClassification = {
        category: ErrorCategory.SERVER_ERROR,
        severity: ErrorSeverity.MEDIUM,
        retryStrategy: RetryStrategy.NO_RETRY,
        httpStatusCode: 500,
        errorCode: 'INTERNAL_ERROR',
        isRetryable: false,
        operationalImpact: 'Service degradation possible',
        clientGuidance: ['Contact support if error persists'],
        ...pattern?.classification
      };

      // Apply context-specific enhancements
      this.enhanceClassification(classification, error, context);
      
      // Update statistics
      this.updateStatistics(classification, startTime);
      
      this.logger.debug('Error classification completed', {
        category: classification.category,
        severity: classification.severity,
        retryable: classification.isRetryable,
        processingTime: Date.now() - startTime
      });

      return classification;

    } catch (classificationError) {
      this.logger.error('Error classification failed', {
        originalError: error.message,
        classificationError: classificationError instanceof Error ? classificationError.message : String(classificationError)
      });

      // Fallback classification
      return this.createFallbackClassification(error);
    }
  }

  /**
   * Register custom error pattern for classification
   */
  registerPattern(pattern: ErrorPattern): void {
    this.errorPatterns.push(pattern);
    this.logger.debug('Registered error pattern', { description: pattern.description });
  }

  /**
   * Get comprehensive error statistics
   */
  getStatistics(): ErrorStatistics {
    return { ...this.statistics };
  }

  /**
   * Check if error classification meets performance requirements
   */
  isPerformanceOptimal(): boolean {
    return this.statistics.averageProcessingTime < 10; // <10ms requirement
  }

  /**
   * Reset statistics (useful for monitoring periods)
   */
  resetStatistics(): void {
    this.statistics = {
      totalErrors: 0,
      errorsByCategory: this.initializeCategoryStats(),
      errorsBySeverity: this.initializeSeverityStats(),
      retryableErrors: 0,
      averageProcessingTime: 0,
      lastProcessed: new Date()
    };
    this.processingTimes = [];
    
    this.logger.info('Error classification statistics reset');
  }

  /**
   * Find matching error pattern for classification
   */
  private findMatchingPattern(error: Error): ErrorPattern | null {
    for (const pattern of this.errorPatterns) {
      try {
        if (pattern.matcher(error)) {
          return pattern;
        }
      } catch (matcherError) {
        this.logger.warn('Error pattern matcher failed', {
          pattern: pattern.description,
          error: matcherError instanceof Error ? matcherError.message : String(matcherError)
        });
      }
    }
    return null;
  }

  /**
   * Enhance classification with context-specific information
   */
  private enhanceClassification(
    classification: ErrorClassification, 
    error: Error, 
    context?: Record<string, any>
  ): void {
    // Add debug information in development
    if (config.DEBUG_MODE) {
      classification.debugInfo = {
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
        errorConstructor: error.constructor.name
      };
    }

    // Enhance retry strategy based on error characteristics
    if (classification.category === ErrorCategory.RATE_LIMIT_ERROR) {
      classification.suggestedDelay = this.calculateRetryDelay(context);
    }

    // Add operational impact assessment
    if (classification.severity === ErrorSeverity.CRITICAL) {
      classification.operationalImpact = 'Service outage or severe degradation';
      classification.clientGuidance = [
        'Immediate retry not recommended',
        'Check service status page',
        'Contact support immediately'
      ];
    }
  }

  /**
   * Calculate appropriate retry delay for rate limit errors
   */
  private calculateRetryDelay(context?: Record<string, any>): number {
    const baseDelay = 1000; // 1 second base delay
    const retryCount = context?.retryCount || 0;
    
    // Exponential backoff with jitter
    return baseDelay * Math.pow(2, retryCount) + Math.random() * 1000;
  }

  /**
   * Register default error patterns for common scenarios
   */
  private registerDefaultPatterns(): void {
    // Validation errors
    this.registerPattern({
      matcher: (error) => error.name === 'ValidationError' || error.message.includes('validation'),
      classification: {
        category: ErrorCategory.VALIDATION_ERROR,
        severity: ErrorSeverity.LOW,
        retryStrategy: RetryStrategy.NO_RETRY,
        httpStatusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        isRetryable: false,
        operationalImpact: 'Request rejected due to invalid input',
        clientGuidance: ['Check request parameters', 'Validate input format']
      },
      description: 'Input validation failures'
    });

    // Authentication errors
    this.registerPattern({
      matcher: (error) => error.message.includes('auth') || error.message.includes('token'),
      classification: {
        category: ErrorCategory.AUTHENTICATION_ERROR,
        severity: ErrorSeverity.MEDIUM,
        retryStrategy: RetryStrategy.NO_RETRY,
        httpStatusCode: 401,
        errorCode: 'AUTHENTICATION_ERROR',
        isRetryable: false,
        operationalImpact: 'Access denied',
        clientGuidance: ['Check API key', 'Verify authentication headers']
      },
      description: 'Authentication and authorization failures'
    });

    // Rate limit errors
    this.registerPattern({
      matcher: (error) => error.message.includes('rate limit') || error.message.includes('quota'),
      classification: {
        category: ErrorCategory.RATE_LIMIT_ERROR,
        severity: ErrorSeverity.MEDIUM,
        retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        httpStatusCode: 429,
        errorCode: 'RATE_LIMIT_ERROR',
        isRetryable: true,
        operationalImpact: 'Request throttled',
        clientGuidance: ['Reduce request rate', 'Implement exponential backoff']
      },
      description: 'Rate limiting and quota violations'
    });

    // Network errors
    this.registerPattern({
      matcher: (error) => error.message.includes('ECONNRESET') || error.message.includes('timeout'),
      classification: {
        category: ErrorCategory.NETWORK_ERROR,
        severity: ErrorSeverity.HIGH,
        retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
        httpStatusCode: 502,
        errorCode: 'NETWORK_ERROR',
        isRetryable: true,
        operationalImpact: 'Network connectivity issues',
        clientGuidance: ['Retry with backoff', 'Check network connectivity']
      },
      description: 'Network connectivity and timeout issues'
    });

    // System errors
    this.registerPattern({
      matcher: (error) => error.message.includes('ENOENT') || error.message.includes('EACCES'),
      classification: {
        category: ErrorCategory.SYSTEM_ERROR,
        severity: ErrorSeverity.CRITICAL,
        retryStrategy: RetryStrategy.NO_RETRY,
        httpStatusCode: 503,
        errorCode: 'SYSTEM_ERROR',
        isRetryable: false,
        operationalImpact: 'System resource unavailable',
        clientGuidance: ['Contact system administrator', 'Check service status']
      },
      description: 'System resource and file system errors'
    });
  }

  /**
   * Create fallback classification for unhandled errors
   */
  private createFallbackClassification(error: Error): ErrorClassification {
    return {
      category: ErrorCategory.SERVER_ERROR,
      severity: ErrorSeverity.HIGH,
      retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
      httpStatusCode: 500,
      errorCode: 'UNKNOWN_ERROR',
      isRetryable: true,
      operationalImpact: 'Unexpected error occurred',
      clientGuidance: ['Retry after delay', 'Contact support if error persists'],
      debugInfo: config.DEBUG_MODE ? {
        message: error.message,
        name: error.name,
        stack: error.stack
      } : undefined
    };
  }

  /**
   * Update processing statistics
   */
  private updateStatistics(classification: ErrorClassification, startTime: number): void {
    const processingTime = Date.now() - startTime;
    
    this.statistics.totalErrors++;
    this.statistics.errorsByCategory[classification.category]++;
    this.statistics.errorsBySeverity[classification.severity]++;
    
    if (classification.isRetryable) {
      this.statistics.retryableErrors++;
    }

    this.processingTimes.push(processingTime);
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift(); // Keep last 100 measurements
    }

    this.statistics.averageProcessingTime = 
      this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
    
    this.statistics.lastProcessed = new Date();
  }

  /**
   * Initialize category statistics
   */
  private initializeCategoryStats(): Record<ErrorCategory, number> {
    const stats: Record<ErrorCategory, number> = {} as Record<ErrorCategory, number>;
    Object.values(ErrorCategory).forEach(category => {
      stats[category] = 0;
    });
    return stats;
  }

  /**
   * Initialize severity statistics
   */
  private initializeSeverityStats(): Record<ErrorSeverity, number> {
    const stats: Record<ErrorSeverity, number> = {} as Record<ErrorSeverity, number>;
    Object.values(ErrorSeverity).forEach(severity => {
      stats[severity] = 0;
    });
    return stats;
  }
}

// Production-ready singleton instance
export const errorClassifier = new ErrorClassifier();

// Export utilities for easy access
export const classifyError = (error: Error, context?: Record<string, any>) => 
  errorClassifier.classifyError(error, context);
export const getErrorStatistics = () => errorClassifier.getStatistics();
export const isClassificationOptimal = () => errorClassifier.isPerformanceOptimal();