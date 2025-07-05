/**
 * Phase 4B Performance Validation Tests
 * Validates that error handling meets the required performance benchmarks:
 * - Error processing: <10ms
 * - Validation processing: <25ms
 */

import {
  ErrorClassifier,
  errorClassifier
} from '../../src/middleware/error-classifier';
import {
  ValidationHandler,
  validationHandler
} from '../../src/middleware/validation-handler';
import {
  ErrorResponseFactory
} from '../../src/models/error-responses';

// Mock logger to prevent console output during tests
jest.mock('../../src/utils/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })),
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

jest.mock('../../src/utils/env', () => ({
  config: {
    DEBUG_MODE: false,
    VERBOSE: false
  }
}));

describe('Phase 4B Performance Validation', () => {
  let classifier: ErrorClassifier;
  let validator: ValidationHandler;

  beforeEach(() => {
    classifier = new ErrorClassifier();
    validator = new ValidationHandler();
  });

  afterEach(() => {
    classifier.resetStatistics();
  });

  describe('Error Processing Performance Requirements', () => {
    it('should process all error types within 10ms requirement', () => {
      const errorTypes = [
        new Error('Validation failed'),
        new Error('Authentication failed'),
        new Error('Permission denied'),
        new Error('Rate limit exceeded'),
        new Error('Network timeout'),
        new Error('Server unavailable'),
        new Error('Database connection failed'),
        new Error('Invalid request format'),
        new Error('Resource not found'),
        new Error('Service degraded')
      ];

      const processingTimes: number[] = [];

      errorTypes.forEach(error => {
        const startTime = performance.now();
        const classification = classifier.classifyError(error);
        const endTime = performance.now();

        const processingTime = endTime - startTime;
        processingTimes.push(processingTime);

        expect(processingTime).toBeLessThan(10); // <10ms requirement
        expect(classification).toBeDefined();
        expect(classification.category).toBeDefined();
        expect(classification.severity).toBeDefined();
      });

      // Verify average processing time is well within requirements
      const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      expect(avgProcessingTime).toBeLessThan(5); // Well below 10ms

      // Verify 95th percentile is within requirements
      const sortedTimes = processingTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(sortedTimes.length * 0.95);
      const p95Time = sortedTimes[p95Index];
      expect(p95Time).toBeLessThan(10);
    });

    it('should maintain error processing performance under load', () => {
      const iterations = 1000;
      const errors = Array.from({ length: iterations }, (_, i) => 
        new Error(`Load test error ${i}`)
      );

      const startTime = performance.now();
      const classifications = errors.map(error => classifier.classifyError(error));
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const avgTimePerError = totalTime / iterations;

      expect(avgTimePerError).toBeLessThan(10); // <10ms per error
      expect(classifications.length).toBe(iterations);
      expect(classifications.every(c => c !== null)).toBe(true);

      // Verify statistics
      const stats = classifier.getStatistics();
      expect(stats.averageProcessingTime).toBeLessThan(10);
      expect(stats.totalErrors).toBeGreaterThanOrEqual(iterations);
    });

    it('should process complex error objects within performance requirements', () => {
      const complexErrors = Array.from({ length: 100 }, (_, i) => {
        const error = new Error(`Complex error ${i}`);
        (error as any).stack = `Error: Complex error ${i}\n` + 'x'.repeat(1000); // Large stack trace
        (error as any).context = {
          requestId: `req_${i}`,
          timestamp: new Date(),
          metadata: {
            user: `user_${i}`,
            endpoint: `/api/endpoint_${i}`,
            nested: {
              deep: {
                property: 'value'.repeat(100)
              }
            }
          }
        };
        return error;
      });

      const processingTimes: number[] = [];

      complexErrors.forEach(error => {
        const startTime = performance.now();
        classifier.classifyError(error, error.context);
        const endTime = performance.now();

        const processingTime = endTime - startTime;
        processingTimes.push(processingTime);
        expect(processingTime).toBeLessThan(10);
      });

      const avgTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      expect(avgTime).toBeLessThan(8); // Even complex errors should be fast
    });
  });

  describe('Validation Processing Performance Requirements', () => {
    it('should validate all request types within 25ms requirement', async () => {
      const testRequests = [
        {
          schema: 'chat_completion',
          data: {
            model: 'claude-3-sonnet-20240229',
            messages: [{ role: 'user', content: 'Hello world' }],
            temperature: 1.0,
            max_tokens: 1000
          }
        },
        {
          schema: 'session',
          data: {
            session_id: 'test_session_123',
            title: 'Performance Test Session'
          }
        }
      ];

      for (const { schema, data } of testRequests) {
        const startTime = performance.now();
        const report = await validator.validateRequest(data, schema, {
          requestId: 'perf_test_request',
          endpoint: '/test',
          method: 'POST'
        });
        const endTime = performance.now();

        const processingTime = endTime - startTime;
        expect(processingTime).toBeLessThan(25); // <25ms requirement
        expect(report.processingTime).toBeLessThan(25);
      }
    });

    it('should maintain validation performance under concurrent load', async () => {
      const testData = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Performance test message' }],
        temperature: 1.0
      };

      const concurrentValidations = 200;
      const validationPromises = Array.from({ length: concurrentValidations }, (_, i) =>
        validator.validateRequest(testData, 'chat_completion', {
          requestId: `concurrent_perf_test_${i}`
        })
      );

      const startTime = performance.now();
      const results = await Promise.all(validationPromises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const avgTimePerValidation = totalTime / concurrentValidations;

      expect(avgTimePerValidation).toBeLessThan(25); // <25ms average
      expect(results.every(r => r.processingTime < 25)).toBe(true);

      // Verify performance statistics
      const stats = validator.getPerformanceStats();
      expect(stats.isOptimal).toBe(true);
      expect(stats.averageProcessingTime).toBeLessThan(25);
    });

    it('should validate large complex objects within performance requirements', async () => {
      const largeComplexData = {
        model: 'claude-3-sonnet-20240229',
        messages: Array.from({ length: 200 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'content '.repeat(100)}` // ~800 chars per message
        })),
        temperature: 1.0,
        max_tokens: 4000,
        stream: false,
        metadata: {
          user: {
            profile: {
              preferences: {
                theme: 'dark',
                language: 'en',
                notifications: {
                  email: true,
                  push: false,
                  sms: true
                }
              }
            }
          },
          request_context: {
            source: 'api',
            version: '1.0.0',
            client_info: {
              platform: 'web',
              version: '2.1.0',
              features: ['streaming', 'tools', 'images']
            }
          }
        }
      };

      const startTime = performance.now();
      const report = await validator.validateRequest(largeComplexData, 'chat_completion', {
        requestId: 'large_complex_test'
      });
      const endTime = performance.now();

      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(25); // <25ms even for large payloads
      expect(report.processingTime).toBeLessThan(25);
    });

    it('should validate requests with validation errors within performance requirements', async () => {
      const invalidRequests = [
        { data: {}, description: 'empty object' },
        { data: { model: 123 }, description: 'invalid model type' },
        { data: { model: 'test', messages: 'invalid' }, description: 'invalid messages type' },
        { data: { model: 'test', messages: [], temperature: 'invalid' }, description: 'invalid temperature' },
        { data: { model: 'test', messages: [], max_tokens: -1 }, description: 'negative max_tokens' }
      ];

      for (const { data, description } of invalidRequests) {
        const startTime = performance.now();
        const report = await validator.validateRequest(data, 'chat_completion', {
          requestId: `invalid_test_${description.replace(/\s+/g, '_')}`
        });
        const endTime = performance.now();

        const processingTime = endTime - startTime;
        expect(processingTime).toBeLessThan(25); // <25ms even for validation errors
        expect(report.processingTime).toBeLessThan(25);
        expect(report.isValid).toBe(false);
      }
    });
  });

  describe('End-to-End Error Response Performance', () => {
    it('should generate error responses within combined performance requirements', async () => {
      const testError = new Error('Test error for response generation');
      const invalidData = { invalid: 'request' };

      // Test error classification + response generation
      const classificationStart = performance.now();
      const classification = classifier.classifyError(testError);
      const classificationTime = performance.now() - classificationStart;

      const responseStart = performance.now();
      const errorResponse = ErrorResponseFactory.createFromClassification(
        testError,
        classification,
        'test_request_id'
      );
      const responseTime = performance.now() - responseStart;

      // Test validation + error response generation
      const validationStart = performance.now();
      const validationReport = await validator.validateRequest(invalidData, 'chat_completion', {
        requestId: 'validation_perf_test'
      });
      const validationTime = performance.now() - validationStart;

      const validationResponseStart = performance.now();
      const validationResponse = ErrorResponseFactory.createValidationErrorResponse(
        validationReport,
        'validation_perf_test'
      );
      const validationResponseTime = performance.now() - validationResponseStart;

      // Verify individual performance requirements
      expect(classificationTime).toBeLessThan(10); // Error classification <10ms
      expect(responseTime).toBeLessThan(5); // Response generation <5ms
      expect(validationTime).toBeLessThan(25); // Validation <25ms
      expect(validationResponseTime).toBeLessThan(5); // Validation response <5ms

      // Verify combined performance is still fast
      const totalErrorTime = classificationTime + responseTime;
      const totalValidationTime = validationTime + validationResponseTime;

      expect(totalErrorTime).toBeLessThan(15); // Combined error handling <15ms
      expect(totalValidationTime).toBeLessThan(30); // Combined validation <30ms

      // Verify responses are valid
      expect(errorResponse.error).toBeDefined();
      expect(validationResponse.error).toBeDefined();
    });

    it('should maintain performance under memory pressure', async () => {
      // Create large objects to simulate memory pressure
      const largeObjects = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        data: 'x'.repeat(10000), // 10KB per object
        nested: Array.from({ length: 100 }, (_, j) => ({ value: j }))
      }));

      const performanceResults: Array<{ 
        errorTime: number; 
        validationTime: number; 
        responseTime: number; 
      }> = [];

      for (let i = 0; i < 20; i++) {
        // Error processing test
        const error = new Error(`Memory pressure error ${i}`);
        (error as any).largeData = largeObjects;

        const errorStart = performance.now();
        const classification = classifier.classifyError(error);
        const errorTime = performance.now() - errorStart;

        // Validation test
        const invalidData = { 
          model: 123, 
          largeContext: largeObjects.slice(0, 10) // Include some large data
        };

        const validationStart = performance.now();
        const report = await validator.validateRequest(invalidData, 'chat_completion', {
          requestId: `memory_pressure_${i}`
        });
        const validationTime = performance.now() - validationStart;

        // Response generation test
        const responseStart = performance.now();
        const response = ErrorResponseFactory.createValidationErrorResponse(report, `memory_pressure_${i}`);
        const responseTime = performance.now() - responseStart;

        performanceResults.push({ errorTime, validationTime, responseTime });

        // Verify requirements are met even under memory pressure
        expect(errorTime).toBeLessThan(10);
        expect(validationTime).toBeLessThan(25);
        expect(responseTime).toBeLessThan(5);
      }

      // Verify performance doesn't degrade significantly over time
      const firstHalf = performanceResults.slice(0, 10);
      const secondHalf = performanceResults.slice(10);

      const firstAvgError = firstHalf.reduce((sum, r) => sum + r.errorTime, 0) / firstHalf.length;
      const secondAvgError = secondHalf.reduce((sum, r) => sum + r.errorTime, 0) / secondHalf.length;

      const firstAvgValidation = firstHalf.reduce((sum, r) => sum + r.validationTime, 0) / firstHalf.length;
      const secondAvgValidation = secondHalf.reduce((sum, r) => sum + r.validationTime, 0) / secondHalf.length;

      // Allow for some variation but no significant degradation
      expect(secondAvgError).toBeLessThanOrEqual(firstAvgError * 1.5);
      expect(secondAvgValidation).toBeLessThanOrEqual(firstAvgValidation * 1.5);
    });
  });
});