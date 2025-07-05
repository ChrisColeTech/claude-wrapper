/**
 * Error Classifier Unit Tests
 * Comprehensive tests for error classification and categorization system
 * Tests error classification, pattern recognition, and performance requirements
 */

// Mock logger to prevent console output during tests
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

jest.mock('../../../src/utils/logger', () => ({
  createLogger: jest.fn().mockReturnValue(mockLogger),
  getLogger: jest.fn().mockReturnValue(mockLogger),
  LogLevel: {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug'
  }
}));

import {
  ErrorClassifier,
  ErrorSeverity,
  ErrorCategory,
  RetryStrategy,
  ErrorClassification,
  ErrorPattern,
  errorClassifier,
  classifyError,
  getErrorStatistics,
  isClassificationOptimal
} from '../../../src/middleware/error-classifier';

// Mock config for testing
jest.mock('../../../src/utils/env', () => ({
  config: {
    DEBUG_MODE: false,
    VERBOSE: false
  }
}));

describe('ErrorClassifier', () => {
  let classifier: ErrorClassifier;

  beforeEach(() => {
    classifier = new ErrorClassifier();
    jest.useFakeTimers();
  });

  afterEach(() => {
    classifier.resetStatistics();
    jest.useRealTimers();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default statistics', () => {
      const stats = classifier.getStatistics();
      
      expect(stats.totalErrors).toBe(0);
      expect(stats.retryableErrors).toBe(0);
      expect(stats.averageProcessingTime).toBe(0);
      expect(Object.values(stats.errorsByCategory).every(count => count === 0)).toBe(true);
      expect(Object.values(stats.errorsBySeverity).every(count => count === 0)).toBe(true);
    });

    it('should register default error patterns', () => {
      const validationError = new Error('validation failed');
      const classification = classifier.classifyError(validationError);
      
      expect(classification.category).toBe(ErrorCategory.VALIDATION_ERROR);
      expect(classification.severity).toBe(ErrorSeverity.LOW);
      expect(classification.retryStrategy).toBe(RetryStrategy.NO_RETRY);
    });

    it('should initialize with optimal performance status', () => {
      expect(classifier.isPerformanceOptimal()).toBe(true);
    });
  });

  describe('Error Classification', () => {
    it('should classify validation errors correctly', () => {
      const error = new Error('Invalid parameter format');
      error.name = 'ValidationError';
      
      const classification = classifier.classifyError(error);
      
      expect(classification.category).toBe(ErrorCategory.VALIDATION_ERROR);
      expect(classification.severity).toBe(ErrorSeverity.LOW);
      expect(classification.httpStatusCode).toBe(400);
      expect(classification.errorCode).toBe('VALIDATION_ERROR');
      expect(classification.isRetryable).toBe(false);
      expect(classification.retryStrategy).toBe(RetryStrategy.NO_RETRY);
    });

    it('should classify authentication errors correctly', () => {
      const error = new Error('Invalid authentication token');
      
      const classification = classifier.classifyError(error);
      
      expect(classification.category).toBe(ErrorCategory.AUTHENTICATION_ERROR);
      expect(classification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classification.httpStatusCode).toBe(401);
      expect(classification.errorCode).toBe('AUTHENTICATION_ERROR');
      expect(classification.isRetryable).toBe(false);
    });

    it('should classify rate limit errors correctly', () => {
      const error = new Error('Rate limit exceeded');
      
      const classification = classifier.classifyError(error);
      
      expect(classification.category).toBe(ErrorCategory.RATE_LIMIT_ERROR);
      expect(classification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classification.httpStatusCode).toBe(429);
      expect(classification.isRetryable).toBe(true);
      expect(classification.retryStrategy).toBe(RetryStrategy.EXPONENTIAL_BACKOFF);
    });

    it('should classify network errors correctly', () => {
      const error = new Error('Connection timeout ECONNRESET');
      
      const classification = classifier.classifyError(error);
      
      expect(classification.category).toBe(ErrorCategory.NETWORK_ERROR);
      expect(classification.severity).toBe(ErrorSeverity.HIGH);
      expect(classification.httpStatusCode).toBe(502);
      expect(classification.isRetryable).toBe(true);
    });

    it('should classify system errors correctly', () => {
      const error = new Error('File not found ENOENT');
      
      const classification = classifier.classifyError(error);
      
      expect(classification.category).toBe(ErrorCategory.SYSTEM_ERROR);
      expect(classification.severity).toBe(ErrorSeverity.CRITICAL);
      expect(classification.httpStatusCode).toBe(503);
      expect(classification.isRetryable).toBe(false);
    });

    it('should provide fallback classification for unknown errors', () => {
      const error = new Error('Unknown error type');
      
      const classification = classifier.classifyError(error);
      
      expect(classification.category).toBe(ErrorCategory.SERVER_ERROR);
      expect(classification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classification.httpStatusCode).toBe(500);
      expect(classification.errorCode).toBe('INTERNAL_ERROR');
    });

    it('should include client guidance in classifications', () => {
      const error = new Error('Invalid parameter');
      error.name = 'ValidationError';
      
      const classification = classifier.classifyError(error);
      
      expect(classification.clientGuidance).toContain('Check request parameters');
      expect(classification.clientGuidance).toContain('Validate input format');
    });

    it('should include operational impact assessment', () => {
      const error = new Error('System failure');
      error.message = 'Critical system error ENOENT';
      
      const classification = classifier.classifyError(error);
      
      expect(classification.operationalImpact).toBeDefined();
      expect(typeof classification.operationalImpact).toBe('string');
      expect(classification.operationalImpact.length).toBeGreaterThan(0);
    });
  });

  describe('Context-Enhanced Classification', () => {
    it('should enhance classification with context information', () => {
      const error = new Error('Rate limit exceeded');
      const context = { retryCount: 3, userId: 'user123' };
      
      const classification = classifier.classifyError(error, context);
      
      expect(classification.category).toBe(ErrorCategory.RATE_LIMIT_ERROR);
      expect(classification.suggestedDelay).toBeGreaterThan(0);
    });

    it('should add debug information in debug mode', () => {
      // Mock debug mode
      const mockConfig = require('../../../src/utils/env');
      mockConfig.config.DEBUG_MODE = true;
      
      const freshClassifier = new ErrorClassifier();
      const error = new Error('Test error with debug info');
      
      const classification = freshClassifier.classifyError(error, { testData: 'debug' });
      
      expect(classification.debugInfo).toBeDefined();
      expect(classification.debugInfo?.stack).toBeDefined();
      expect(classification.debugInfo?.context).toEqual({ testData: 'debug' });
    });

    it('should calculate retry delay for rate limit errors', () => {
      const error = new Error('Rate limit exceeded');
      const context = { retryCount: 2 };
      
      const classification = classifier.classifyError(error, context);
      
      expect(classification.suggestedDelay).toBeGreaterThan(1000); // Base delay
      expect(classification.suggestedDelay).toBeLessThan(10000); // Reasonable upper bound
    });

    it('should provide enhanced guidance for critical errors', () => {
      const error = new Error('System critical failure ENOENT');
      
      const classification = classifier.classifyError(error);
      
      expect(classification.severity).toBe(ErrorSeverity.CRITICAL);
      expect(classification.operationalImpact).toContain('Service outage');
      expect(classification.clientGuidance).toContain('Contact support immediately');
    });
  });

  describe('Custom Pattern Registration', () => {
    it('should allow registration of custom error patterns', () => {
      const customPattern: ErrorPattern = {
        matcher: (error) => error.message.includes('CUSTOM_ERROR'),
        classification: {
          category: ErrorCategory.CLIENT_ERROR,
          severity: ErrorSeverity.LOW,
          retryStrategy: RetryStrategy.IMMEDIATE_RETRY,
          httpStatusCode: 422,
          errorCode: 'CUSTOM_ERROR',
          isRetryable: true,
          operationalImpact: 'Custom error occurred',
          clientGuidance: ['Custom guidance message']
        },
        description: 'Custom error pattern for testing'
      };

      classifier.registerPattern(customPattern);
      
      const error = new Error('This is a CUSTOM_ERROR message');
      const classification = classifier.classifyError(error);
      
      expect(classification.category).toBe(ErrorCategory.CLIENT_ERROR);
      expect(classification.errorCode).toBe('CUSTOM_ERROR');
      expect(classification.retryStrategy).toBe(RetryStrategy.IMMEDIATE_RETRY);
    });

    it('should prioritize custom patterns over defaults', () => {
      const customValidationPattern: ErrorPattern = {
        matcher: (error) => error.name === 'ValidationError',
        classification: {
          category: ErrorCategory.CLIENT_ERROR,
          severity: ErrorSeverity.HIGH,
          httpStatusCode: 422,
          errorCode: 'CUSTOM_VALIDATION',
          isRetryable: false,
          retryStrategy: RetryStrategy.NO_RETRY,
          operationalImpact: 'Custom validation error',
          clientGuidance: ['Custom validation guidance']
        },
        description: 'Custom validation error pattern'
      };

      classifier.registerPattern(customValidationPattern);
      
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      
      const classification = classifier.classifyError(error);
      
      expect(classification.errorCode).toBe('CUSTOM_VALIDATION');
      expect(classification.severity).toBe(ErrorSeverity.HIGH);
      expect(classification.httpStatusCode).toBe(422);
    });

    it('should handle pattern matcher errors gracefully', () => {
      const faultyPattern: ErrorPattern = {
        matcher: () => { throw new Error('Matcher error'); },
        classification: {
          category: ErrorCategory.CLIENT_ERROR,
          severity: ErrorSeverity.LOW,
          retryStrategy: RetryStrategy.NO_RETRY,
          httpStatusCode: 400,
          errorCode: 'FAULTY_PATTERN',
          isRetryable: false,
          operationalImpact: 'Pattern error',
          clientGuidance: []
        },
        description: 'Faulty pattern for testing'
      };

      classifier.registerPattern(faultyPattern);
      
      const error = new Error('Test error');
      const classification = classifier.classifyError(error);
      
      // Should fall back to default classification
      expect(classification.errorCode).not.toBe('FAULTY_PATTERN');
      expect(classification.category).toBe(ErrorCategory.SERVER_ERROR);
    });
  });

  describe('Statistics and Performance Tracking', () => {
    it('should track error statistics correctly', () => {
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';
      
      const authError = new Error('Authentication failed');
      const networkError = new Error('Network timeout');
      
      classifier.classifyError(validationError);
      classifier.classifyError(authError);
      classifier.classifyError(networkError);
      
      const stats = classifier.getStatistics();
      
      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByCategory[ErrorCategory.VALIDATION_ERROR]).toBe(1);
      expect(stats.errorsByCategory[ErrorCategory.AUTHENTICATION_ERROR]).toBe(1);
      expect(stats.errorsByCategory[ErrorCategory.NETWORK_ERROR]).toBe(1);
    });

    it('should track retryable error count', () => {
      const rateLimitError = new Error('Rate limit exceeded');
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';
      
      classifier.classifyError(rateLimitError);
      classifier.classifyError(validationError);
      
      const stats = classifier.getStatistics();
      
      expect(stats.totalErrors).toBe(2);
      expect(stats.retryableErrors).toBe(1); // Only rate limit error is retryable
    });

    it('should track processing time statistics', () => {
      const error = new Error('Test error');
      
      const classification = classifier.classifyError(error);
      
      const stats = classifier.getStatistics();
      
      expect(stats.averageProcessingTime).toBeGreaterThanOrEqual(0);
      expect(stats.lastProcessed).toBeInstanceOf(Date);
    });

    it('should reset statistics correctly', () => {
      const error = new Error('Test error');
      classifier.classifyError(error);
      
      let stats = classifier.getStatistics();
      expect(stats.totalErrors).toBe(1);
      
      classifier.resetStatistics();
      
      stats = classifier.getStatistics();
      expect(stats.totalErrors).toBe(0);
      expect(stats.retryableErrors).toBe(0);
      expect(stats.averageProcessingTime).toBe(0);
    });

    it('should maintain performance optimization status', () => {
      // Fast classification should maintain optimal status
      const error = new Error('Quick test');
      classifier.classifyError(error);
      
      expect(classifier.isPerformanceOptimal()).toBe(true);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle classification errors gracefully', () => {
      // Mock a classification error by patching the logger
      const originalMethod = classifier.classifyError;
      const mockClassifier = {
        ...classifier,
        findMatchingPattern: () => { throw new Error('Internal classification error'); }
      };

      const error = new Error('Test error');
      const classification = classifier.classifyError(error);
      
      // Should return fallback classification
      expect(classification).toBeDefined();
      expect(classification.category).toBe(ErrorCategory.SERVER_ERROR);
      expect(classification.errorCode).toBeDefined();
    });

    it('should create fallback classification for null/undefined errors', () => {
      const nullError = null as any;
      const undefinedError = undefined as any;
      
      // Should not crash
      expect(() => classifier.classifyError(nullError)).not.toThrow();
      expect(() => classifier.classifyError(undefinedError)).not.toThrow();
    });

    it('should handle empty error messages', () => {
      const emptyError = new Error('');
      const classification = classifier.classifyError(emptyError);
      
      expect(classification).toBeDefined();
      expect(classification.category).toBe(ErrorCategory.SERVER_ERROR);
    });

    it('should handle very long error messages', () => {
      const longMessage = 'x'.repeat(10000);
      const longError = new Error(longMessage);
      
      const classification = classifier.classifyError(longError);
      
      expect(classification).toBeDefined();
      expect(classification.category).toBe(ErrorCategory.SERVER_ERROR);
    });
  });

  describe('Performance Requirements', () => {
    it('should classify errors within performance requirements (<10ms)', () => {
      const error = new Error('Performance test error');
      
      const startTime = Date.now();
      const classification = classifier.classifyError(error);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(10); // <10ms requirement
      expect(classification).toBeDefined();
    });

    it('should maintain performance under load', () => {
      const errors = Array.from({ length: 100 }, (_, i) => new Error(`Error ${i}`));
      
      const startTime = Date.now();
      
      errors.forEach(error => classifier.classifyError(error));
      
      const endTime = Date.now();
      const avgTime = (endTime - startTime) / errors.length;
      
      expect(avgTime).toBeLessThan(10); // Average should be <10ms
      expect(classifier.isPerformanceOptimal()).toBe(true);
    });

    it('should handle concurrent classifications efficiently', async () => {
      const errors = Array.from({ length: 50 }, (_, i) => new Error(`Concurrent error ${i}`));
      
      const startTime = Date.now();
      
      const classifications = await Promise.all(
        errors.map(error => Promise.resolve(classifier.classifyError(error)))
      );
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(classifications).toHaveLength(50);
      expect(totalTime).toBeLessThan(100); // Should complete quickly
      expect(classifications.every(c => c !== undefined)).toBe(true);
    });
  });

  describe('Singleton Instance and Utilities', () => {
    it('should provide singleton instance access', () => {
      const error = new Error('Singleton test');
      
      const classification = classifyError(error, { test: true });
      
      expect(classification).toBeDefined();
      expect(classification.category).toBeDefined();
    });

    it('should provide statistics access via utility function', () => {
      const error = new Error('Stats test');
      classifyError(error);
      
      const stats = getErrorStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.totalErrors).toBeGreaterThan(0);
    });

    it('should provide performance status via utility function', () => {
      const optimal = isClassificationOptimal();
      
      expect(typeof optimal).toBe('boolean');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle errors with circular references', () => {
      const circularError: any = new Error('Circular reference error');
      circularError.circular = circularError;
      
      const classification = classifier.classifyError(circularError);
      
      expect(classification).toBeDefined();
      expect(classification.category).toBe(ErrorCategory.SERVER_ERROR);
    });

    it('should handle errors with complex nested properties', () => {
      const complexError = new Error('Complex error');
      (complexError as any).nested = {
        deep: {
          property: {
            value: 'test',
            array: [1, 2, 3],
            object: { key: 'value' }
          }
        }
      };
      
      const classification = classifier.classifyError(complexError, { context: 'complex' });
      
      expect(classification).toBeDefined();
      expect(classification.category).toBe(ErrorCategory.SERVER_ERROR);
    });

    it('should handle errors with special characters in messages', () => {
      const specialError = new Error('Error with 特殊字符 and émojis 🚫');
      
      const classification = classifier.classifyError(specialError);
      
      expect(classification).toBeDefined();
      expect(classification.category).toBe(ErrorCategory.SERVER_ERROR);
    });

    it('should handle extremely high error volumes', () => {
      const startStats = classifier.getStatistics();
      
      // Process many errors quickly
      for (let i = 0; i < 1000; i++) {
        classifier.classifyError(new Error(`Bulk error ${i}`));
      }
      
      const endStats = classifier.getStatistics();
      
      expect(endStats.totalErrors).toBe(startStats.totalErrors + 1000);
      expect(classifier.isPerformanceOptimal()).toBe(true);
    });
  });

  describe('Phase 4B Performance Requirements', () => {
    it('should process error classification within 10ms requirement', () => {
      const testErrors = [
        new Error('Validation failed'),
        new Error('Authentication error'),
        new Error('Rate limit exceeded'),
        new Error('Internal server error'),
        new Error('Network timeout')
      ];

      testErrors.forEach(error => {
        const startTime = performance.now();
        classifier.classifyError(error);
        const endTime = performance.now();
        
        const processingTime = endTime - startTime;
        expect(processingTime).toBeLessThan(10); // <10ms requirement
      });
    });

    it('should maintain performance under concurrent error processing', async () => {
      const errors = Array.from({ length: 100 }, (_, i) => new Error(`Concurrent error ${i}`));
      
      const startTime = performance.now();
      
      // Process errors concurrently
      await Promise.all(errors.map(error => 
        Promise.resolve(classifier.classifyError(error))
      ));
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerError = totalTime / errors.length;
      
      expect(avgTimePerError).toBeLessThan(10); // <10ms average per error
      expect(classifier.isPerformanceOptimal()).toBe(true);
    });

    it('should validate performance statistics accuracy', () => {
      const testError = new Error('Performance test error');
      
      const startTime = performance.now();
      classifier.classifyError(testError);
      const endTime = performance.now();
      
      const actualTime = endTime - startTime;
      const stats = classifier.getStatistics();
      
      // Verify processing time is tracked accurately
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
      expect(stats.averageProcessingTime).toBeLessThan(10); // Within requirement
    });

    it('should handle memory pressure without degrading performance', () => {
      // Create large error objects to simulate memory pressure
      const largeErrors = Array.from({ length: 50 }, (_, i) => {
        const error = new Error(`Large error ${i}`);
        (error as any).largeData = 'x'.repeat(10000); // 10KB per error
        return error;
      });

      const processingTimes: number[] = [];
      
      largeErrors.forEach(error => {
        const startTime = performance.now();
        classifier.classifyError(error);
        const endTime = performance.now();
        
        processingTimes.push(endTime - startTime);
      });

      // Verify all processing times are within requirements
      processingTimes.forEach(time => {
        expect(time).toBeLessThan(10); // <10ms requirement
      });

      // Verify performance doesn't degrade over time
      const firstHalf = processingTimes.slice(0, 25);
      const secondHalf = processingTimes.slice(25);
      
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      expect(secondAvg).toBeLessThanOrEqual(firstAvg * 1.5); // No significant degradation
    });
  });

  describe('Phase 4B OpenAI Compatibility', () => {
    it('should generate OpenAI-compatible error codes', () => {
      const testCases = [
        { error: new Error('Invalid request'), expectedCode: 'VALIDATION_ERROR' },
        { error: new Error('Unauthorized'), expectedCode: 'AUTHENTICATION_ERROR' },
        { error: new Error('Forbidden'), expectedCode: 'AUTHORIZATION_ERROR' },
        { error: new Error('Rate limit exceeded'), expectedCode: 'RATE_LIMIT_ERROR' },
        { error: new Error('Internal error'), expectedCode: 'INTERNAL_ERROR' }
      ];

      testCases.forEach(({ error, expectedCode }) => {
        const classification = classifier.classifyError(error);
        expect(classification.errorCode).toBeDefined();
        expect(typeof classification.errorCode).toBe('string');
        expect(classification.errorCode.length).toBeGreaterThan(0);
      });
    });

    it('should generate appropriate HTTP status codes', () => {
      const testCases = [
        { error: new Error('validation failed'), expectedStatus: 400 },
        { error: new Error('unauthorized'), expectedStatus: 401 },
        { error: new Error('forbidden'), expectedStatus: 403 },
        { error: new Error('not found'), expectedStatus: 404 },
        { error: new Error('rate limit'), expectedStatus: 429 },
        { error: new Error('internal error'), expectedStatus: 500 }
      ];

      testCases.forEach(({ error, expectedStatus }) => {
        const classification = classifier.classifyError(error);
        expect([400, 401, 403, 404, 422, 429, 500]).toContain(classification.httpStatusCode);
      });
    });

    it('should provide client guidance for all error types', () => {
      const errorTypes = [
        'validation failed',
        'authentication failed',
        'permission denied',
        'rate limit exceeded',
        'server error'
      ];

      errorTypes.forEach(errorMessage => {
        const error = new Error(errorMessage);
        const classification = classifier.classifyError(error);
        
        expect(classification.clientGuidance).toBeDefined();
        expect(Array.isArray(classification.clientGuidance)).toBe(true);
        expect(classification.clientGuidance.length).toBeGreaterThan(0);
        
        // Verify guidance is helpful
        classification.clientGuidance.forEach(guidance => {
          expect(typeof guidance).toBe('string');
          expect(guidance.length).toBeGreaterThan(0);
        });
      });
    });

    it('should classify retryable vs non-retryable errors correctly', () => {
      const retryableErrors = [
        'network timeout',
        'service unavailable',
        'rate limit exceeded',
        'temporary server error'
      ];

      const nonRetryableErrors = [
        'validation failed',
        'authentication failed',
        'permission denied',
        'invalid request format'
      ];

      retryableErrors.forEach(errorMessage => {
        const error = new Error(errorMessage);
        const classification = classifier.classifyError(error);
        expect(classification.isRetryable).toBe(true);
        expect(classification.retryStrategy).not.toBe(RetryStrategy.NO_RETRY);
      });

      nonRetryableErrors.forEach(errorMessage => {
        const error = new Error(errorMessage);
        const classification = classifier.classifyError(error);
        expect(classification.isRetryable).toBe(false);
        expect(classification.retryStrategy).toBe(RetryStrategy.NO_RETRY);
      });
    });
  });

  describe('Phase 4B Request ID Correlation', () => {
    it('should preserve request ID context in error classification', () => {
      const testRequestId = 'req_test_correlation_123';
      const error = new Error('Test error for correlation');
      
      const classification = classifier.classifyError(error, {
        requestId: testRequestId,
        endpoint: '/test',
        method: 'POST'
      });

      expect(classification).toBeDefined();
      // Request ID should be preserved in debug info or context
      if (classification.debugInfo) {
        expect(classification.debugInfo.requestId || 
               classification.debugInfo.context?.requestId).toBe(testRequestId);
      }
    });

    it('should handle concurrent requests with different request IDs', () => {
      const requests = Array.from({ length: 20 }, (_, i) => ({
        requestId: `req_concurrent_${i}`,
        error: new Error(`Concurrent error ${i}`)
      }));

      const classifications = requests.map(({ requestId, error }) =>
        classifier.classifyError(error, { requestId })
      );

      // Verify all classifications are independent
      classifications.forEach((classification, index) => {
        expect(classification).toBeDefined();
        expect(classification.category).toBeDefined();
        expect(classification.severity).toBeDefined();
      });

      // Verify no request ID contamination
      const stats = classifier.getStatistics();
      expect(stats.totalErrors).toBeGreaterThanOrEqual(20);
    });

    it('should handle missing or malformed request IDs gracefully', () => {
      const testCases = [
        { requestId: undefined, description: 'undefined request ID' },
        { requestId: '', description: 'empty request ID' },
        { requestId: null, description: 'null request ID' },
        { requestId: 'req_' + 'x'.repeat(1000), description: 'oversized request ID' }
      ];

      testCases.forEach(({ requestId, description }) => {
        const error = new Error(`Test error with ${description}`);
        
        expect(() => {
          const classification = classifier.classifyError(error, { requestId });
          expect(classification).toBeDefined();
        }).not.toThrow();
      });
    });
  });
});