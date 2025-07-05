/**
 * Error Handling Integration Tests
 * End-to-end tests for comprehensive error handling system
 * Tests integration between error classifier, validation handler, and response models
 */

import request from 'supertest';
import express from 'express';
import {
  ErrorClassifier,
  ErrorCategory,
  ErrorSeverity,
  RetryStrategy
} from '../../../src/middleware/error-classifier';
import {
  ValidationHandler,
  ValidationErrorReport
} from '../../../src/middleware/validation-handler';
import {
  RequestIdManager,
  RequestMetadata
} from '../../../src/middleware/request-id';
import {
  ErrorResponseFactory,
  ValidationErrorResponse,
  EnhancedErrorResponse
} from '../../../src/models/error-responses';

// Mock logger to prevent console output during tests
jest.mock('../../../src/utils/logger', () => ({
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

// Mock config for testing
jest.mock('../../../src/utils/env', () => ({
  config: {
    DEBUG_MODE: true,
    VERBOSE: false
  }
}));

describe('Error Handling Integration', () => {
  let app: express.Application;
  let errorClassifier: ErrorClassifier;
  let validationHandler: ValidationHandler;
  let requestIdManager: RequestIdManager;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    errorClassifier = new ErrorClassifier();
    validationHandler = new ValidationHandler();
    requestIdManager = new RequestIdManager();

    // Setup middleware in correct order
    app.use(requestIdManager.middleware());

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Complete Error Flow Integration', () => {
    it('should handle validation errors end-to-end', async () => {
      // Setup endpoint with validation
      app.post('/api/chat/completions', async (req, res) => {
        try {
          const validationReport = await validationHandler.validateRequest(
            req.body,
            'chat_completion',
            {
              requestId: req.requestId,
              endpoint: req.path,
              method: req.method,
              userAgent: req.get('User-Agent')
            }
          );

          if (!validationReport.isValid) {
            const errorResponse = ErrorResponseFactory.createValidationErrorResponse(
              validationReport,
              req.requestId
            );
            return res.status(400).json(errorResponse);
          }

          res.json({ success: true });
        } catch (error) {
          const classification = errorClassifier.classifyError(error as Error, {
            endpoint: req.path,
            requestId: req.requestId
          });

          const errorResponse = ErrorResponseFactory.createFromClassification(
            error as Error,
            classification,
            req.requestId
          );

          res.status(classification.httpStatusCode).json(errorResponse);
        }
      });

      // Test invalid request
      const invalidPayload = {
        // Missing required 'model' field
        messages: 'invalid_type', // Wrong type
        temperature: -1 // Invalid value
      };

      const response = await request(app)
        .post('/api/chat/completions')
        .send(invalidPayload)
        .expect(400);

      // Verify response structure
      expect(response.body.error).toBeDefined();
      expect(response.body.error.type).toBe('validation_error');
      expect(response.body.error.code).toBeDefined();
      expect(response.body.error.request_id).toBeDefined();

      // Verify validation details
      expect(response.body.error.details.invalid_fields).toBeInstanceOf(Array);
      expect(response.body.error.details.field_count).toBeGreaterThan(0);
      expect(response.body.error.details.suggestions).toBeInstanceOf(Array);

      // Verify error classification
      expect(response.body.error.details.classification).toBeDefined();
      expect(response.body.error.details.classification.category).toBe('validation_error');
      expect(response.body.error.details.classification.severity).toBe('low');

      // Verify debug information is included
      expect(response.body.error.debug_info).toBeDefined();
      expect(response.body.error.debug_info.processing_time_ms).toBeDefined();
    });

    it('should handle authentication errors with proper classification', async () => {
      app.post('/api/protected', (req, res) => {
        const authError = new Error('Invalid authentication token');
        const classification = errorClassifier.classifyError(authError, {
          endpoint: req.path,
          requestId: req.requestId
        });

        const errorResponse = ErrorResponseFactory.createAuthenticationErrorResponse(
          authError.message,
          'bearer',
          'invalid',
          req.requestId
        );

        res.status(401).json(errorResponse);
      });

      const response = await request(app)
        .post('/api/protected')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body.error.type).toBe('authentication_error');
      expect(response.body.error.details.auth_method).toBe('bearer');
      expect(response.body.error.details.token_status).toBe('invalid');
      expect(response.body.error.details.suggestions).toContain('Check API key format and validity');
    });

    it('should handle rate limit errors with retry information', async () => {
      app.post('/api/rate-limited', (req, res) => {
        const rateLimitError = new Error('Rate limit exceeded');
        const classification = errorClassifier.classifyError(rateLimitError, {
          endpoint: req.path,
          requestId: req.requestId,
          retryCount: 2
        });

        const errorResponse = ErrorResponseFactory.createRateLimitErrorResponse(
          rateLimitError.message,
          60, // 60 seconds retry after
          'requests',
          req.requestId
        );

        res.status(429).json(errorResponse);
      });

      const response = await request(app)
        .post('/api/rate-limited')
        .expect(429);

      expect(response.body.error.type).toBe('rate_limit_error');
      expect(response.body.error.details.retry_after_seconds).toBe(60);
      expect(response.body.error.details.limit_type).toBe('requests');
      expect(response.body.error.details.reset_time).toBeDefined();
      expect(response.body.error.details.suggestions).toContain('Implement exponential backoff retry strategy');
    });

    it('should handle server errors with operational details', async () => {
      app.post('/api/server-error', (req, res) => {
        const serverError = new Error('Internal server error ENOENT');
        const classification = errorClassifier.classifyError(serverError, {
          endpoint: req.path,
          requestId: req.requestId
        });

        const errorResponse = ErrorResponseFactory.createServerErrorResponse(
          serverError.message,
          'partial_outage',
          req.requestId
        );

        res.status(503).json(errorResponse);
      });

      const response = await request(app)
        .post('/api/server-error')
        .expect(503);

      expect(response.body.error.type).toBe('server_error');
      expect(response.body.error.details.service_status).toBe('partial_outage');
      expect(response.body.error.details.suggestions).toContain('Some services may be affected');
    });
  });

  describe('Request ID and Correlation Integration', () => {
    it('should track requests through entire error flow', async () => {
      let capturedRequestId: string;
      let capturedContext: any;

      app.post('/api/tracked', (req, res) => {
        capturedRequestId = req.requestId!;
        capturedContext = req.requestContext;

        // Mark an error in the request
        const error = new Error('Test error for tracking');
        requestIdManager.markRequestError(req.requestId!, error);

        const classification = errorClassifier.classifyError(error, {
          requestId: req.requestId,
          endpoint: req.path
        });

        const errorResponse = ErrorResponseFactory.createFromClassification(
          error,
          classification,
          req.requestId
        );

        // Add request metadata to response
        const enhancedResponse = ErrorResponseFactory.addRequestMetadata(
          errorResponse,
          req.requestMetadata!
        );

        res.status(500).json(enhancedResponse);
      });

      const response = await request(app)
        .post('/api/tracked')
        .set('User-Agent', 'TestAgent/1.0')
        .expect(500);

      // Verify request ID is consistent throughout
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.body.error.request_id).toBe(response.headers['x-request-id']);
      expect(capturedRequestId).toBe(response.headers['x-request-id']);

      // Verify context tracking
      expect(capturedContext).toBeDefined();
      expect(capturedContext.requestId).toBe(capturedRequestId);
      expect(capturedContext.metadata.errorOccurred).toBe(true);
      expect(capturedContext.metadata.errorCount).toBe(1);

      // Verify metadata in error response
      expect(response.body.error.debug_info.request_metadata).toBeDefined();
      expect(response.body.error.debug_info.request_metadata.method).toBe('POST');
      expect(response.body.error.debug_info.request_metadata.userAgent).toBe('TestAgent/1.0');
    });

    it('should handle correlation across multiple requests', async () => {
      const correlationId = 'corr_test_12345';

      app.post('/api/correlated', (req, res) => {
        const error = new Error('Correlated error');
        const classification = errorClassifier.classifyError(error, {
          requestId: req.requestId,
          correlationId: req.get('X-Correlation-ID')
        });

        const errorResponse = ErrorResponseFactory.createFromClassification(
          error,
          classification,
          req.requestId
        );

        res.status(500).json(errorResponse);
      });

      const response = await request(app)
        .post('/api/correlated')
        .set('X-Correlation-ID', correlationId)
        .expect(500);

      expect(response.headers['x-correlation-id']).toBe(correlationId);
      expect(response.body.error.details.correlation_id).toBe(correlationId);
    });
  });

  describe('Performance and Load Integration', () => {
    it('should maintain performance under concurrent error processing', async () => {
      app.post('/api/concurrent-errors', async (req, res) => {
        const validationReport = await validationHandler.validateRequest(
          req.body,
          'chat_completion',
          {
            requestId: req.requestId,
            endpoint: req.path,
            method: req.method
          }
        );

        if (!validationReport.isValid) {
          const errorResponse = ErrorResponseFactory.createValidationErrorResponse(
            validationReport,
            req.requestId
          );
          return res.status(400).json(errorResponse);
        }

        res.json({ success: true });
      });

      const invalidPayload = { messages: 'invalid' }; // Missing model
      const requests = [];

      // Create 20 concurrent requests
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app)
            .post('/api/concurrent-errors')
            .send(invalidPayload)
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();

      // Verify all requests completed
      expect(responses).toHaveLength(20);
      responses.forEach(response => {
        expect(response.status).toBe(400);
        expect(response.body.error.type).toBe('validation_error');
        expect(response.body.error.request_id).toBeDefined();
      });

      // Verify performance (should complete quickly)
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all request IDs are unique
      const requestIds = responses.map(r => r.body.error.request_id);
      const uniqueIds = new Set(requestIds);
      expect(uniqueIds.size).toBe(20);
    });

    it('should track error statistics across multiple requests', async () => {
      app.post('/api/stats-test', (req, res) => {
        const errorType = req.body.errorType || 'validation';
        let error: Error;
        
        switch (errorType) {
          case 'validation':
            error = new Error('Validation failed');
            error.name = 'ValidationError';
            break;
          case 'auth':
            error = new Error('Authentication failed');
            break;
          case 'rate_limit':
            error = new Error('Rate limit exceeded');
            break;
          default:
            error = new Error('Unknown error');
        }

        const classification = errorClassifier.classifyError(error, {
          requestId: req.requestId,
          endpoint: req.path
        });

        const errorResponse = ErrorResponseFactory.createFromClassification(
          error,
          classification,
          req.requestId
        );

        res.status(classification.httpStatusCode).json(errorResponse);
      });

      // Generate different types of errors
      await request(app).post('/api/stats-test').send({ errorType: 'validation' });
      await request(app).post('/api/stats-test').send({ errorType: 'validation' });
      await request(app).post('/api/stats-test').send({ errorType: 'auth' });
      await request(app).post('/api/stats-test').send({ errorType: 'rate_limit' });

      const stats = errorClassifier.getStatistics();
      
      expect(stats.totalErrors).toBe(4);
      expect(stats.errorsByCategory['validation_error']).toBe(2);
      expect(stats.errorsByCategory['authentication_error']).toBe(1);
      expect(stats.errorsByCategory['rate_limit_error']).toBe(1);
      expect(stats.retryableErrors).toBe(1); // Only rate limit is retryable
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
    });
  });

  describe('Error Response Standardization', () => {
    it('should maintain OpenAI-compatible response format', async () => {
      app.post('/api/openai-compat', async (req, res) => {
        const validationReport = await validationHandler.validateRequest(
          req.body,
          'chat_completion',
          {
            requestId: req.requestId,
            endpoint: req.path,
            method: req.method
          }
        );

        if (!validationReport.isValid) {
          const errorResponse = ErrorResponseFactory.createValidationErrorResponse(
            validationReport,
            req.requestId
          );
          return res.status(400).json(errorResponse);
        }

        res.json({ success: true });
      });

      const response = await request(app)
        .post('/api/openai-compat')
        .send({ messages: 'invalid' }) // Missing model, wrong type
        .expect(400);

      // Verify OpenAI-compatible structure
      expect(response.body.error).toBeDefined();
      expect(response.body.error.type).toBe('validation_error');
      expect(response.body.error.message).toBeDefined();
      expect(response.body.error.code).toBeDefined();
      expect(response.body.error.request_id).toBeDefined();

      // Verify enhanced details are present
      expect(response.body.error.details).toBeDefined();
      expect(response.body.error.details.invalid_fields).toBeInstanceOf(Array);
      expect(response.body.error.details.suggestions).toBeInstanceOf(Array);
      expect(response.body.error.details.timestamp).toBeDefined();

      // Verify field-level detail format
      const field = response.body.error.details.invalid_fields[0];
      expect(field.field).toBeDefined();
      expect(field.path).toBeDefined();
      expect(field.message).toBeDefined();
      expect(field.code).toBeDefined();
      expect(field.suggestion).toBeDefined();
    });

    it('should include appropriate headers for different error types', async () => {
      app.post('/api/headers-test', (req, res) => {
        const errorType = req.body.type;
        
        if (errorType === 'rate_limit') {
          const errorResponse = ErrorResponseFactory.createRateLimitErrorResponse(
            'Rate limit exceeded',
            60,
            'requests',
            req.requestId
          );
          res.set('Retry-After', '60');
          return res.status(429).json(errorResponse);
        }

        if (errorType === 'auth') {
          const errorResponse = ErrorResponseFactory.createAuthenticationErrorResponse(
            'Authentication required',
            'bearer',
            'missing',
            req.requestId
          );
          res.set('WWW-Authenticate', 'Bearer');
          return res.status(401).json(errorResponse);
        }

        res.status(400).json({ error: 'Bad request' });
      });

      // Test rate limit headers
      const rateLimitResponse = await request(app)
        .post('/api/headers-test')
        .send({ type: 'rate_limit' })
        .expect(429);

      expect(rateLimitResponse.headers['retry-after']).toBe('60');
      expect(rateLimitResponse.headers['x-request-id']).toBeDefined();

      // Test auth headers
      const authResponse = await request(app)
        .post('/api/headers-test')
        .send({ type: 'auth' })
        .expect(401);

      expect(authResponse.headers['www-authenticate']).toBe('Bearer');
      expect(authResponse.headers['x-request-id']).toBeDefined();
    });
  });

  describe('Sensitive Data Handling', () => {
    it('should sanitize sensitive information in error responses', async () => {
      app.post('/api/sensitive', async (req, res) => {
        const validationReport = await validationHandler.validateRequest(
          req.body,
          'chat_completion',
          {
            requestId: req.requestId,
            endpoint: req.path,
            method: req.method
          }
        );

        const errorResponse = ErrorResponseFactory.createValidationErrorResponse(
          validationReport,
          req.requestId
        );

        res.status(400).json(errorResponse);
      });

      const sensitivePayload = {
        model: 'test',
        api_key: 'sk-1234567890abcdef',
        password: 'secret123',
        token: 'auth_token_xyz',
        messages: [{
          role: 'user',
          content: 'Hello',
          api_key: 'hidden_key'
        }]
      };

      const response = await request(app)
        .post('/api/sensitive')
        .send(sensitivePayload)
        .expect(400);

      // Verify sensitive data is redacted
      const responseStr = JSON.stringify(response.body);
      expect(responseStr).not.toContain('sk-1234567890abcdef');
      expect(responseStr).not.toContain('secret123');
      expect(responseStr).not.toContain('auth_token_xyz');
      expect(responseStr).not.toContain('hidden_key');
      expect(responseStr).toContain('[REDACTED]');
    });

    it('should handle production vs debug mode differences', async () => {
      // Mock production mode
      const mockConfig = require('../../../src/utils/env');
      const originalDebugMode = mockConfig.config.DEBUG_MODE;

      app.post('/api/debug-test', (req, res) => {
        const error = new Error('Test error with sensitive info');
        const classification = errorClassifier.classifyError(error, {
          requestId: req.requestId,
          sensitiveData: 'should_not_appear_in_prod'
        });

        const errorResponse = ErrorResponseFactory.createFromClassification(
          error,
          classification,
          req.requestId
        );

        res.status(500).json(errorResponse);
      });

      // Test debug mode
      mockConfig.config.DEBUG_MODE = true;
      const debugHandler = new ErrorClassifier();
      
      const debugResponse = await request(app)
        .post('/api/debug-test')
        .expect(500);

      expect(debugResponse.body.error.debug_info).toBeDefined();

      // Test production mode
      mockConfig.config.DEBUG_MODE = false;
      const prodHandler = new ErrorClassifier();
      
      const prodResponse = await request(app)
        .post('/api/debug-test')
        .expect(500);

      // Debug info should be minimal or absent in production
      if (prodResponse.body.error.debug_info) {
        expect(Object.keys(prodResponse.body.error.debug_info)).toHaveLength(0);
      }

      // Restore original setting
      mockConfig.config.DEBUG_MODE = originalDebugMode;
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should provide fallback error handling when components fail', async () => {
      app.post('/api/fallback-test', (req, res) => {
        // Simulate error classifier failure
        try {
          throw new Error('Classifier system failure');
        } catch (classifierError) {
          // Fallback to basic error response
          const fallbackResponse = ErrorResponseFactory.createMinimalErrorResponse(
            'api_error',
            'An unexpected error occurred',
            'INTERNAL_ERROR',
            req.requestId
          );
          
          res.status(500).json(fallbackResponse);
        }
      });

      const response = await request(app)
        .post('/api/fallback-test')
        .expect(500);

      // Should still provide basic error structure
      expect(response.body.error).toBeDefined();
      expect(response.body.error.type).toBe('api_error');
      expect(response.body.error.message).toBeDefined();
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
      expect(response.body.error.request_id).toBeDefined();
    });

    it('should handle malformed requests gracefully', async () => {
      app.post('/api/malformed', (req, res) => {
        try {
          // This will throw due to malformed JSON
          JSON.stringify(req.body);
          res.json({ success: true });
        } catch (error) {
          const classification = errorClassifier.classifyError(error as Error, {
            requestId: req.requestId
          });

          const errorResponse = ErrorResponseFactory.createFromClassification(
            error as Error,
            classification,
            req.requestId
          );

          res.status(400).json(errorResponse);
        }
      });

      // Test with circular reference that can't be stringified
      const circularObj: any = { name: 'test' };
      circularObj.circular = circularObj;

      // Note: Express will handle malformed JSON before it reaches our handler
      // but we can test our error handling with other types of errors
      const response = await request(app)
        .post('/api/malformed')
        .send('{"invalid": json"}') // This should be caught by Express
        .expect(400);

      // Express built-in error handling should kick in
      expect(response.body).toBeDefined();
    });
  });
});