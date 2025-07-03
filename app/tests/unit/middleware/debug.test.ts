/**
 * Comprehensive Test Suite for Debug Middleware
 * Phase 9A Implementation: Complete debug middleware tests
 * Based on Python main.py:188-247 DebugLoggingMiddleware behavior
 */

// Mock logger to capture and verify log calls - MUST be before imports
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

jest.mock('../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => mockLogger)
}));

import { Request, Response, NextFunction } from 'express';
import { createDebugMiddleware, createDebugMiddlewareFromEnv } from '../../../src/middleware/debug';

describe('Debug Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let originalSend: jest.Mock;
  let originalJson: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock response methods
    originalSend = jest.fn();
    originalJson = jest.fn();

    mockReq = {
      method: 'POST',
      path: '/v1/chat/completions',
      query: { test: 'query' },
      body: { model: 'claude-3-opus', messages: [] },
      get: jest.fn((header: string) => {
        const headers: Record<string, string | string[]> = {
          'User-Agent': 'test-client/1.0',
          'Content-Type': 'application/json',
          'Content-Length': '150'
        };
        return headers[header];
      }) as any,
      headers: {
        'user-agent': 'test-client/1.0',
        'content-type': 'application/json',
        'authorization': 'Bearer test-token'
      }
    };

    mockRes = {
      statusCode: 200,
      send: originalSend,
      json: originalJson,
      get: jest.fn((header: string) => {
        const headers: Record<string, string | string[]> = {
          'Content-Type': 'application/json'
        };
        return headers[header];
      }) as any
    };

    mockNext = jest.fn();
  });

  describe('createDebugMiddleware', () => {
    it('should skip logging when debug disabled', () => {
      const middleware = createDebugMiddleware({
        enabled: false,
        verbose: false
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should log request details when debug enabled', () => {
      const middleware = createDebugMiddleware({
        enabled: true,
        verbose: false
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/🔍.*POST.*\/v1\/chat\/completions/),
        expect.objectContaining({
          method: 'POST',
          path: '/v1/chat/completions',
          query: { test: 'query' },
          userAgent: 'test-client/1.0',
          contentType: 'application/json',
          contentLength: '150'
        })
      );
    });

    it('should log verbose headers when verbose enabled', () => {
      const middleware = createDebugMiddleware({
        enabled: true,
        verbose: true
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/📋.*Request headers:/),
        expect.objectContaining({
          headers: expect.objectContaining({
            'user-agent': 'test-client/1.0',
            'content-type': 'application/json',
            'authorization': 'Bearer ***' // Should be sanitized
          })
        })
      );
    });

    it('should log request body for POST requests under size limit', () => {
      const middleware = createDebugMiddleware({
        enabled: true,
        verbose: false,
        maxBodySize: 1000,
        logRequestBodies: true
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/📝.*Request body:/),
        expect.objectContaining({
          body: expect.stringContaining('claude-3-opus')
        })
      );
    });

    it('should skip request body logging for large requests', () => {
      // Mock large content length
      (mockReq.get as jest.Mock).mockImplementation((header: string) => {
        if (header === 'Content-Length') return '200000'; // 200KB
        return 'test-value';
      });

      const middleware = createDebugMiddleware({
        enabled: true,
        verbose: false,
        maxBodySize: 100000, // 100KB limit
        logRequestBodies: true
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/📝 \[[^\]]+\] Request body too large to log/)
      );
    });

    it('should override response.send and log timing', () => {
      const middleware = createDebugMiddleware({
        enabled: true,
        verbose: false
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Simulate response
      const responseBody = 'test response';
      mockRes.send!(responseBody);

      expect(originalSend).toHaveBeenCalledWith(responseBody);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/✅.*POST.*\/v1\/chat\/completions.*→.*200.*\(\d+\.\d+ms\)/),
        expect.objectContaining({
          method: 'POST',
          path: '/v1/chat/completions',
          statusCode: 200,
          duration: expect.any(Number)
        })
      );
    });

    it('should override response.json and log timing', () => {
      const middleware = createDebugMiddleware({
        enabled: true,
        verbose: false
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Simulate JSON response
      const responseData = { result: 'success' };
      mockRes.json!(responseData);

      expect(originalJson).toHaveBeenCalledWith(responseData);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/✅.*POST.*\/v1\/chat\/completions.*→.*200.*\(\d+\.\d+ms\)/),
        expect.objectContaining({
          method: 'POST',
          path: '/v1/chat/completions',
          statusCode: 200,
          duration: expect.any(Number)
        })
      );
    });

    it('should log response body in verbose mode', () => {
      const middleware = createDebugMiddleware({
        enabled: true,
        verbose: true,
        logResponseBodies: true
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      const responseData = { result: 'success', data: 'test' };
      mockRes.json!(responseData);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/📤.*Response body:/),
        expect.objectContaining({
          body: expect.stringContaining('success')
        })
      );
    });

    it('should use correct status emoji for different response codes', () => {
      const testCases = [
        { statusCode: 200, emoji: '✅' },
        { statusCode: 301, emoji: '🔄' },
        { statusCode: 404, emoji: '❌' },
        { statusCode: 500, emoji: '💥' }
      ];

      testCases.forEach(({ statusCode, emoji }) => {
        jest.clearAllMocks();
        mockRes.statusCode = statusCode;

        const middleware = createDebugMiddleware({
          enabled: true,
          verbose: false
        });

        middleware(mockReq as Request, mockRes as Response, mockNext);
        mockRes.send!('test');

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringMatching(new RegExp(`${emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)),
          expect.anything()
        );
      });
    });

    it('should handle request body logging errors gracefully', () => {
      mockReq.body = null; // This will cause JSON.stringify to fail in certain scenarios
      
      const middleware = createDebugMiddleware({
        enabled: true,
        verbose: false,
        logRequestBodies: true
      });

      expect(() => {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle response body logging errors gracefully', () => {
      const middleware = createDebugMiddleware({
        enabled: true,
        verbose: true,
        logResponseBodies: true
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Create circular reference that will fail JSON.stringify
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      expect(() => {
        mockRes.json!(circularObj);
      }).not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/❌ \[[^\]]+\] Failed to log response body/)
      );
    });
  });

  describe('createDebugMiddlewareFromEnv', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should create middleware with DEBUG_MODE=true', () => {
      process.env.DEBUG_MODE = 'true';
      process.env.VERBOSE = 'false';

      const middleware = createDebugMiddlewareFromEnv();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockLogger.info).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Debug middleware configuration:',
        expect.objectContaining({
          enabled: true,
          verbose: false
        })
      );
    });

    it('should create middleware with VERBOSE=true', () => {
      process.env.DEBUG_MODE = 'false';
      process.env.VERBOSE = 'true';

      const middleware = createDebugMiddlewareFromEnv();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockLogger.info).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Debug middleware configuration:',
        expect.objectContaining({
          enabled: false,
          verbose: true
        })
      );
    });

    it('should parse custom environment configuration', () => {
      process.env.DEBUG_MODE = 'true';
      process.env.DEBUG_MAX_BODY_SIZE = '50000';
      process.env.DEBUG_LOG_REQUEST_BODIES = 'false';
      process.env.DEBUG_LOG_RESPONSE_BODIES = 'true';

      const middleware = createDebugMiddlewareFromEnv();
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Debug middleware configuration:',
        expect.objectContaining({
          enabled: true,
          maxBodySize: 50000,
          logRequestBodies: false,
          logResponseBodies: true
        })
      );
    });

    it('should use default values for invalid environment variables', () => {
      process.env.DEBUG_MODE = 'true';
      process.env.DEBUG_MAX_BODY_SIZE = 'invalid';

      const middleware = createDebugMiddlewareFromEnv();
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Debug middleware configuration:',
        expect.objectContaining({
          maxBodySize: 100000 // Default value
        })
      );
    });
  });

  describe('header sanitization', () => {
    it('should sanitize authorization headers', () => {
      const middleware = createDebugMiddleware({
        enabled: true,
        verbose: true
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/📋.*Request headers:/),
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: 'Bearer ***'
          })
        })
      );
    });

    it('should sanitize cookie headers', () => {
      mockReq.headers = {
        ...mockReq.headers,
        cookie: 'session=abc123; token=xyz789'
      };

      const middleware = createDebugMiddleware({
        enabled: true,
        verbose: true
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/📋.*Request headers:/),
        expect.objectContaining({
          headers: expect.objectContaining({
            cookie: '[REDACTED]'
          })
        })
      );
    });
  });

  describe('body truncation', () => {
    it('should truncate large request bodies', () => {
      const largeBody = 'x'.repeat(2000);
      mockReq.body = largeBody;

      const middleware = createDebugMiddleware({
        enabled: true,
        verbose: false,
        logRequestBodies: true
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/📝.*Request body:/),
        expect.objectContaining({
          body: expect.stringMatching(/.*\[truncated \d+ chars\]$/)
        })
      );
    });

    it('should truncate large response bodies', () => {
      const largeResponse = 'y'.repeat(1000);
      
      const middleware = createDebugMiddleware({
        enabled: true,
        verbose: true,
        logResponseBodies: true
      });

      middleware(mockReq as Request, mockRes as Response, mockNext);
      mockRes.send!(largeResponse);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/📤.*Response body:/),
        expect.objectContaining({
          body: expect.stringMatching(/.*\[truncated \d+ chars\]$/)
        })
      );
    });
  });

  describe('performance', () => {
    it('should have minimal overhead when disabled', () => {
      const middleware = createDebugMiddleware({
        enabled: false,
        verbose: false
      });

      const start = process.hrtime.bigint();
      middleware(mockReq as Request, mockRes as Response, mockNext);
      const end = process.hrtime.bigint();

      const durationMs = Number(end - start) / 1000000;
      expect(durationMs).toBeLessThan(1); // Should be very fast when disabled
    });

    it('should complete quickly even with logging enabled', () => {
      const middleware = createDebugMiddleware({
        enabled: true,
        verbose: true,
        logRequestBodies: true,
        logResponseBodies: true
      });

      const start = process.hrtime.bigint();
      middleware(mockReq as Request, mockRes as Response, mockNext);
      mockRes.json!({ test: 'data' });
      const end = process.hrtime.bigint();

      const durationMs = Number(end - start) / 1000000;
      expect(durationMs).toBeLessThan(10); // Should complete within 10ms
    });
  });
});