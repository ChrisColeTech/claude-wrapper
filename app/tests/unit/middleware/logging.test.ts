import { Request, Response, NextFunction } from 'express';
import { requestLoggingMiddleware, errorLoggingMiddleware } from '../../../src/api/middleware/logging';
import { logger } from '../../../src/utils/logger';

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    http: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  }
}));

describe('Logging Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRequest = {
      method: 'GET',
      originalUrl: '/test',
      path: '/test',
      headers: {
        'user-agent': 'test-agent',
        'content-type': 'application/json'
      },
      query: { param: 'value' },
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-agent'),
      body: null
    };

    mockResponse = {
      statusCode: 200,
      statusMessage: 'OK',
      headersSent: false,
      getHeaders: jest.fn().mockReturnValue({
        'content-type': 'application/json'
      }),
      send: jest.fn(),
      json: jest.fn(),
      write: jest.fn(),
      end: jest.fn()
    };

    mockNext = jest.fn();
  });

  describe('requestLoggingMiddleware', () => {
    it('should add requestId and startTime to request', () => {
      requestLoggingMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.requestId).toBeDefined();
      expect(mockRequest.startTime).toBeDefined();
      expect(typeof mockRequest.requestId).toBe('string');
      expect(typeof mockRequest.startTime).toBe('number');
    });

    it('should log incoming request with basic info', () => {
      requestLoggingMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.http).toHaveBeenCalledWith(
        'request',
        'GET /test',
        expect.objectContaining({
          method: 'GET',
          url: '/test',
          headers: mockRequest.headers,
          query: mockRequest.query,
          userAgent: 'test-agent',
          ip: '127.0.0.1',
          requestId: expect.any(String)
        }),
        expect.any(String)
      );
    });

    it('should log request body for non-GET requests', () => {
      mockRequest.method = 'POST';
      mockRequest.body = { test: 'data' };

      requestLoggingMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.http).toHaveBeenCalledWith(
        'request',
        'POST /test',
        expect.objectContaining({
          method: 'POST',
          body: { test: 'data' }
        }),
        expect.any(String)
      );
    });

    it('should handle large request bodies', () => {
      mockRequest.method = 'POST';
      mockRequest.body = { data: 'x'.repeat(15000) }; // Large body

      requestLoggingMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      const logCall = (logger.http as jest.Mock).mock.calls[0][2];
      expect(logCall.bodySize).toContain('bytes (too large to log)');
      expect(logCall.body).toBeUndefined();
    });

    it('should not log body for GET requests', () => {
      mockRequest.method = 'GET';
      mockRequest.body = { test: 'data' };

      requestLoggingMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      const logCall = (logger.http as jest.Mock).mock.calls[0][2];
      expect(logCall.body).toBeUndefined();
    });

    it('should call next middleware', () => {
      requestLoggingMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should intercept response.send', () => {
      requestLoggingMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate response
      const responseData = { message: 'success' };
      (mockResponse as any).send(responseData);

      expect(logger.http).toHaveBeenCalledWith(
        'response',
        expect.stringContaining('GET /test - 200 OK'),
        expect.objectContaining({
          statusCode: 200,
          statusMessage: 'OK',
          duration: expect.stringContaining('ms'),
          requestId: expect.any(String)
        }),
        expect.any(String)
      );
    });

    it('should intercept response.json', () => {
      requestLoggingMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate JSON response
      const responseData = { message: 'success' };
      (mockResponse as any).json(responseData);

      expect(logger.http).toHaveBeenCalledWith(
        'response',
        expect.stringContaining('GET /test - 200 OK'),
        expect.objectContaining({
          statusCode: 200,
          body: responseData
        }),
        expect.any(String)
      );
    });

    it('should detect streaming responses', () => {
      requestLoggingMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate SSE streaming
      (mockResponse as any).write('data: chunk1\n\n');
      (mockResponse as any).write('data: chunk2\n\n');
      (mockResponse as any).end();

      expect(logger.http).toHaveBeenCalledWith(
        'response',
        expect.stringContaining('GET /test - 200 OK'),
        expect.objectContaining({
          isStreaming: true,
          streamingData: 'SSE streaming response'
        }),
        expect.any(String)
      );
    });

    it('should handle large response bodies', () => {
      requestLoggingMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate large response
      const largeResponse = { data: 'x'.repeat(8000) };
      (mockResponse as any).json(largeResponse);

      const responseLogCall = (logger.http as jest.Mock).mock.calls.find(call => 
        call[0] === 'response'
      );
      expect(responseLogCall[2].bodySize).toContain('bytes (too large to log)');
    });

    it('should log errors for 4xx responses', () => {
      mockResponse.statusCode = 404;
      mockResponse.statusMessage = 'Not Found';

      requestLoggingMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      (mockResponse as any).send('Not found');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('GET /test - 404 Not Found'),
        expect.any(Object)
      );
    });

    it('should log errors for 5xx responses', () => {
      mockResponse.statusCode = 500;
      mockResponse.statusMessage = 'Internal Server Error';

      requestLoggingMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      (mockResponse as any).send('Server error');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('GET /test - 500 Internal Server Error'),
        undefined,
        expect.any(Object)
      );
    });
  });

  describe('errorLoggingMiddleware', () => {
    it('should log unhandled errors', () => {
      const error = new Error('Test error');
      const mockNext = jest.fn();

      errorLoggingMiddleware(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Unhandled error in GET /test',
        error,
        expect.objectContaining({
          message: 'Test error',
          stack: error.stack,
          requestId: mockRequest.requestId,
          method: 'GET',
          url: '/test',
          headers: mockRequest.headers,
          body: mockRequest.body
        })
      );
    });

    it('should call next with the error', () => {
      const error = new Error('Test error');
      const mockNext = jest.fn();

      errorLoggingMiddleware(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle errors without stack trace', () => {
      const error = new Error('Test error');
      delete error.stack;

      errorLoggingMiddleware(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Unhandled error in GET /test',
        error,
        expect.objectContaining({
          message: 'Test error',
          stack: undefined
        })
      );
    });
  });
});