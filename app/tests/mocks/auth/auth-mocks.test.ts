/**
 * Tests for Authentication Mocks
 * Validates that auth mock objects behave correctly
 * Single Responsibility: Ensure mock reliability
 */

import {
  MockRequest,
  MockResponse,
  MockNext,
  AuthMockFactory,
  AuthTestUtils,
  AuthMockSetup
} from './auth-mocks';

describe('Authentication Mocks', () => {
  beforeEach(() => {
    AuthMockSetup.setup();
  });

  afterEach(() => {
    AuthMockSetup.reset();
  });

  describe('MockRequest', () => {
    describe('constructor', () => {
      it('should create request with default path and method', () => {
        const req = new MockRequest();
        
        expect(req.path).toBe('/test');
        expect(req.method).toBe('GET');
      });

      it('should create request with custom path and method', () => {
        const req = new MockRequest('/api/custom', 'POST');
        
        expect(req.path).toBe('/api/custom');
        expect(req.method).toBe('POST');
      });
    });

    describe('header management', () => {
      it('should set and get headers', () => {
        const req = new MockRequest();
        
        req.setHeader('Content-Type', 'application/json');
        
        expect(req.get('Content-Type')).toBe('application/json');
      });

      it('should handle case-insensitive header lookup', () => {
        const req = new MockRequest();
        
        req.setHeader('Authorization', 'Bearer token');
        
        expect(req.get('authorization')).toBe('Bearer token');
        expect(req.get('AUTHORIZATION')).toBe('Bearer token');
        expect(req.get('Authorization')).toBe('Bearer token');
      });

      it('should return undefined for non-existent headers', () => {
        const req = new MockRequest();
        
        expect(req.get('NonExistent')).toBeUndefined();
      });

      it('should set multiple headers', () => {
        const req = new MockRequest();
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token',
          'User-Agent': 'test-agent'
        };
        
        req.setHeaders(headers);
        
        expect(req.get('Content-Type')).toBe('application/json');
        expect(req.get('Authorization')).toBe('Bearer token');
        expect(req.get('User-Agent')).toBe('test-agent');
      });

      it('should clear all headers', () => {
        const req = new MockRequest();
        
        req.setHeader('Authorization', 'Bearer token');
        req.clearHeaders();
        
        expect(req.get('Authorization')).toBeUndefined();
        expect(req.getAllHeaders()).toEqual({});
      });

      it('should get all headers', () => {
        const req = new MockRequest();
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token'
        };
        
        req.setHeaders(headers);
        
        expect(req.getAllHeaders()).toEqual(headers);
      });
    });
  });

  describe('MockResponse', () => {
    describe('status method', () => {
      it('should set status code and return this for chaining', () => {
        const res = new MockResponse();
        
        const result = res.status(401);
        
        expect(result).toBe(res);
        expect(res.statusCode).toBe(401);
        expect(res.wasStatusCalled()).toBe(true);
      });

      it('should track multiple status calls', () => {
        const res = new MockResponse();
        
        res.status(200).status(401);
        
        expect(res.statusCode).toBe(401);
        expect(res.wasStatusCalled()).toBe(true);
      });
    });

    describe('json method', () => {
      it('should set response data and return this for chaining', () => {
        const res = new MockResponse();
        const data = { message: 'test' };
        
        const result = res.json(data);
        
        expect(result).toBe(res);
        expect(res.responseData).toEqual(data);
        expect(res.wasJsonCalled()).toBe(true);
      });

      it('should handle complex response data', () => {
        const res = new MockResponse();
        const data = {
          error: {
            message: 'Authentication failed',
            type: 'authentication_error',
            code: 'invalid_token'
          }
        };
        
        res.json(data);
        
        expect(res.responseData).toEqual(data);
      });
    });

    describe('state tracking', () => {
      it('should track method calls correctly', () => {
        const res = new MockResponse();
        
        expect(res.wasStatusCalled()).toBe(false);
        expect(res.wasJsonCalled()).toBe(false);
        
        res.status(401);
        expect(res.wasStatusCalled()).toBe(true);
        expect(res.wasJsonCalled()).toBe(false);
        
        res.json({ error: 'test' });
        expect(res.wasStatusCalled()).toBe(true);
        expect(res.wasJsonCalled()).toBe(true);
      });

      it('should return complete state', () => {
        const res = new MockResponse();
        const data = { message: 'test' };
        
        res.status(401).json(data);
        
        const state = res.getState();
        expect(state).toEqual({
          statusCode: 401,
          responseData: data,
          statusCalled: true,
          jsonCalled: true
        });
      });

      it('should reset state correctly', () => {
        const res = new MockResponse();
        
        res.status(401).json({ error: 'test' });
        res.reset();
        
        const state = res.getState();
        expect(state).toEqual({
          statusCode: 200,
          responseData: null,
          statusCalled: false,
          jsonCalled: false
        });
      });
    });

    describe('method chaining', () => {
      it('should support Express-style method chaining', () => {
        const res = new MockResponse();
        const data = { error: 'test' };
        
        res.status(401).json(data);
        
        expect(res.statusCode).toBe(401);
        expect(res.responseData).toEqual(data);
      });
    });
  });

  describe('MockNext', () => {
    describe('function behavior', () => {
      it('should track when next() is called', () => {
        const next = new MockNext();
        
        expect(next.wasCalled()).toBe(false);
        
        next.fn();
        
        expect(next.wasCalled()).toBe(true);
      });

      it('should track when next() is called with error', () => {
        const next = new MockNext();
        const error = new Error('test error');
        
        next.fn(error);
        
        expect(next.wasCalledWithError()).toBe(true);
        expect(next.getError()).toBe(error);
      });

      it('should track when next() is called without error', () => {
        const next = new MockNext();
        
        next.fn();
        
        expect(next.wasCalled()).toBe(true);
        expect(next.wasCalledWithError()).toBe(false);
        expect(next.getError()).toBeUndefined();
      });
    });

    describe('state management', () => {
      it('should return complete state', () => {
        const next = new MockNext();
        const error = new Error('test');
        
        next.fn(error);
        
        const state = next.getState();
        expect(state).toEqual({
          called: true,
          calledWith: error
        });
      });

      it('should reset state correctly', () => {
        const next = new MockNext();
        
        next.fn(new Error('test'));
        next.reset();
        
        const state = next.getState();
        expect(state).toEqual({
          called: false,
          calledWith: undefined
        });
      });
    });
  });

  describe('AuthMockFactory', () => {
    describe('request creation', () => {
      it('should create request with bearer token', () => {
        const token = 'test-token-123';
        const path = '/api/protected';
        
        const req = AuthMockFactory.createRequestWithBearer(token, path);
        
        expect(req.path).toBe(path);
        expect(req.get('Authorization')).toBe(`Bearer ${token}`);
      });

      it('should create request with malformed auth', () => {
        const authValue = 'Invalid auth header';
        const path = '/api/test';
        
        const req = AuthMockFactory.createRequestWithMalformedAuth(authValue, path);
        
        expect(req.path).toBe(path);
        expect(req.get('Authorization')).toBe(authValue);
      });

      it('should create request without auth header', () => {
        const path = '/api/public';
        
        const req = AuthMockFactory.createRequestWithoutAuth(path);
        
        expect(req.path).toBe(path);
        expect(req.get('Authorization')).toBeUndefined();
      });

      it('should create request with case-variant auth header', () => {
        const token = 'test-token';
        const headerCase = 'authorization';
        
        const req = AuthMockFactory.createRequestWithCaseVariantAuth(token, headerCase);
        
        expect(req.get('authorization')).toBe(`Bearer ${token}`);
        expect(req.get('Authorization')).toBe(`Bearer ${token}`);
      });
    });

    describe('middleware setup', () => {
      it('should create complete middleware setup with token', () => {
        const token = 'test-token';
        const path = '/api/test';
        
        const { req, res, next } = AuthMockFactory.createMiddlewareSetup(token, path);
        
        expect(req.path).toBe(path);
        expect(req.get('Authorization')).toBe(`Bearer ${token}`);
        expect(res).toBeInstanceOf(MockResponse);
        expect(next).toBeInstanceOf(MockNext);
      });

      it('should create complete middleware setup without token', () => {
        const path = '/api/test';
        
        const { req, res, next } = AuthMockFactory.createMiddlewareSetup(undefined, path);
        
        expect(req.path).toBe(path);
        expect(req.get('Authorization')).toBeUndefined();
        expect(res).toBeInstanceOf(MockResponse);
        expect(next).toBeInstanceOf(MockNext);
      });
    });

    describe('individual mock creation', () => {
      it('should create fresh response', () => {
        const res = AuthMockFactory.createResponse();
        
        expect(res).toBeInstanceOf(MockResponse);
        expect(res.statusCode).toBe(200);
      });

      it('should create fresh next function', () => {
        const next = AuthMockFactory.createNext();
        
        expect(next).toBeInstanceOf(MockNext);
        expect(next.wasCalled()).toBe(false);
      });
    });
  });

  describe('AuthTestUtils', () => {
    describe('error validation', () => {
      it('should validate authentication error correctly', () => {
        const res = new MockResponse();
        res.status(401).json({
          error: {
            message: 'Invalid token',
            type: 'authentication_error',
            code: 'invalid_token'
          }
        });
        
        const isValid = AuthTestUtils.validateAuthError(
          res, 
          401, 
          'authentication_error', 
          'invalid_token'
        );
        
        expect(isValid).toBe(true);
      });

      it('should reject invalid authentication error', () => {
        const res = new MockResponse();
        res.status(500).json({
          error: {
            message: 'Server error',
            type: 'server_error',
            code: 'internal_error'
          }
        });
        
        const isValid = AuthTestUtils.validateAuthError(
          res, 
          401, 
          'authentication_error', 
          'invalid_token'
        );
        
        expect(isValid).toBe(false);
      });

      it('should reject response without error object', () => {
        const res = new MockResponse();
        res.status(401).json({ message: 'Error' });
        
        const isValid = AuthTestUtils.validateAuthError(
          res, 
          401, 
          'authentication_error', 
          'invalid_token'
        );
        
        expect(isValid).toBe(false);
      });

      it('should reject response where methods were not called', () => {
        const res = new MockResponse();
        
        const isValid = AuthTestUtils.validateAuthError(
          res, 
          401, 
          'authentication_error', 
          'invalid_token'
        );
        
        expect(isValid).toBe(false);
      });
    });

    describe('next function validation', () => {
      it('should validate successful next call', () => {
        const next = new MockNext();
        next.fn();
        
        const isValid = AuthTestUtils.validateSuccessfulNext(next);
        
        expect(isValid).toBe(true);
      });

      it('should reject next call with error', () => {
        const next = new MockNext();
        next.fn(new Error('test'));
        
        const isValid = AuthTestUtils.validateSuccessfulNext(next);
        
        expect(isValid).toBe(false);
      });

      it('should validate no next call', () => {
        const next = new MockNext();
        
        const isValid = AuthTestUtils.validateNoNext(next);
        
        expect(isValid).toBe(true);
      });

      it('should reject when next was called', () => {
        const next = new MockNext();
        next.fn();
        
        const isValid = AuthTestUtils.validateNoNext(next);
        
        expect(isValid).toBe(false);
      });
    });

    describe('token utilities', () => {
      it('should create test token of specified length', () => {
        const token = AuthTestUtils.createTestToken(24);
        
        expect(token).toHaveLength(24);
        expect(typeof token).toBe('string');
      });

      it('should create test token with default length', () => {
        const token = AuthTestUtils.createTestToken();
        
        expect(token).toHaveLength(32);
      });

      it('should create different tokens on each call', () => {
        const token1 = AuthTestUtils.createTestToken();
        const token2 = AuthTestUtils.createTestToken();
        
        expect(token1).not.toBe(token2);
      });

      it('should provide invalid token patterns', () => {
        const patterns = AuthTestUtils.getInvalidTokenPatterns();
        
        expect(Array.isArray(patterns)).toBe(true);
        expect(patterns.length).toBeGreaterThan(0);
        expect(patterns).toContain('');
        expect(patterns).toContain(' ');
        expect(patterns).toContain('a');
      });
    });
  });

  describe('AuthMockSetup', () => {
    describe('setup and cleanup', () => {
      it('should have setup method', () => {
        expect(typeof AuthMockSetup.setup).toBe('function');
        
        // Should not throw
        expect(() => AuthMockSetup.setup()).not.toThrow();
      });

      it('should have reset method', () => {
        expect(typeof AuthMockSetup.reset).toBe('function');
        
        // Should not throw
        expect(() => AuthMockSetup.reset()).not.toThrow();
      });

      it('should create fresh mock instances', () => {
        const mocks = AuthMockSetup.createFreshMocks();
        
        expect(mocks.request).toBeInstanceOf(MockRequest);
        expect(mocks.response).toBeInstanceOf(MockResponse);
        expect(mocks.next).toBeInstanceOf(MockNext);
      });

      it('should create independent mock instances', () => {
        const mocks1 = AuthMockSetup.createFreshMocks();
        const mocks2 = AuthMockSetup.createFreshMocks();
        
        expect(mocks1.request).not.toBe(mocks2.request);
        expect(mocks1.response).not.toBe(mocks2.response);
        expect(mocks1.next).not.toBe(mocks2.next);
      });
    });
  });
});