/**
 * Authentication Mocks
 * Externalized mocks for Express Request/Response objects and authentication utilities
 * Single Responsibility: Provide reusable authentication test doubles
 */

import { NextFunction } from 'express';

/**
 * Mock Express Request object
 * Provides minimal interface needed for authentication middleware testing
 */
export class MockRequest {
  public path: string = '/test';
  public method: string = 'GET';
  private headers: Record<string, string> = {};

  constructor(path: string = '/test', method: string = 'GET') {
    this.path = path;
    this.method = method;
  }

  /**
   * Mock Express req.get() method for header retrieval
   * Implements case-insensitive header lookup like Express
   */
  get(name: string): string | undefined {
    const lowerName = name.toLowerCase();
    const headerKey = Object.keys(this.headers).find(
      key => key.toLowerCase() === lowerName
    );
    return headerKey ? this.headers[headerKey] : undefined;
  }

  /**
   * Set header value for testing
   */
  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  /**
   * Clear all headers
   */
  clearHeaders(): void {
    this.headers = {};
  }

  /**
   * Set multiple headers at once
   */
  setHeaders(headers: Record<string, string>): void {
    this.headers = { ...headers };
  }

  /**
   * Get all headers (for testing purposes)
   */
  getAllHeaders(): Record<string, string> {
    return { ...this.headers };
  }
}

/**
 * Mock Express Response object
 * Provides methods needed for authentication middleware testing
 */
export class MockResponse {
  public statusCode: number = 200;
  public responseData: any = null;
  private statusCalled: boolean = false;
  private jsonCalled: boolean = false;

  /**
   * Mock Express res.status() method
   * Returns this for method chaining like Express
   */
  status(code: number): this {
    this.statusCode = code;
    this.statusCalled = true;
    return this;
  }

  /**
   * Mock Express res.json() method
   */
  json(data: any): this {
    this.responseData = data;
    this.jsonCalled = true;
    return this;
  }

  /**
   * Check if status() was called
   */
  wasStatusCalled(): boolean {
    return this.statusCalled;
  }

  /**
   * Check if json() was called
   */
  wasJsonCalled(): boolean {
    return this.jsonCalled;
  }

  /**
   * Reset mock state
   */
  reset(): void {
    this.statusCode = 200;
    this.responseData = null;
    this.statusCalled = false;
    this.jsonCalled = false;
  }

  /**
   * Get response state for assertions
   */
  getState() {
    return {
      statusCode: this.statusCode,
      responseData: this.responseData,
      statusCalled: this.statusCalled,
      jsonCalled: this.jsonCalled
    };
  }
}

/**
 * Mock Next function for Express middleware
 */
export class MockNext {
  private called: boolean = false;
  private calledWith: any = undefined;

  /**
   * Mock next function
   */
  public fn: NextFunction = (error?: any) => {
    this.called = true;
    this.calledWith = error;
  };

  /**
   * Check if next() was called
   */
  wasCalled(): boolean {
    return this.called;
  }

  /**
   * Check if next() was called with error
   */
  wasCalledWithError(): boolean {
    return this.called && this.calledWith !== undefined;
  }

  /**
   * Get the error passed to next()
   */
  getError(): any {
    return this.calledWith;
  }

  /**
   * Reset mock state
   */
  reset(): void {
    this.called = false;
    this.calledWith = undefined;
  }

  /**
   * Get mock state for assertions
   */
  getState() {
    return {
      called: this.called,
      calledWith: this.calledWith
    };
  }
}

/**
 * Authentication Mock Factory
 * Factory functions for creating mock objects with common configurations
 * Follows DRY principle for test setup
 */
export class AuthMockFactory {
  /**
   * Create mock request with Authorization header
   */
  static createRequestWithBearer(token: string, path: string = '/test'): MockRequest {
    const req = new MockRequest(path);
    req.setHeader('Authorization', `Bearer ${token}`);
    return req;
  }

  /**
   * Create mock request with malformed Authorization header
   */
  static createRequestWithMalformedAuth(authValue: string, path: string = '/test'): MockRequest {
    const req = new MockRequest(path);
    req.setHeader('Authorization', authValue);
    return req;
  }

  /**
   * Create mock request without Authorization header
   */
  static createRequestWithoutAuth(path: string = '/test'): MockRequest {
    return new MockRequest(path);
  }

  /**
   * Create mock request with case-variant Authorization header
   */
  static createRequestWithCaseVariantAuth(token: string, headerCase: string = 'authorization'): MockRequest {
    const req = new MockRequest();
    req.setHeader(headerCase, `Bearer ${token}`);
    return req;
  }

  /**
   * Create fresh mock response
   */
  static createResponse(): MockResponse {
    return new MockResponse();
  }

  /**
   * Create fresh mock next function
   */
  static createNext(): MockNext {
    return new MockNext();
  }

  /**
   * Create complete middleware test setup
   */
  static createMiddlewareSetup(token?: string, path: string = '/test') {
    const req = (token !== undefined && token !== null) 
      ? this.createRequestWithBearer(token, path)
      : this.createRequestWithoutAuth(path);
    const res = this.createResponse();
    const next = this.createNext();

    return { req, res, next };
  }
}

/**
 * Authentication Test Utilities
 * Helper functions for common auth testing patterns
 */
export class AuthTestUtils {
  /**
   * Validate that response contains authentication error
   */
  static validateAuthError(
    res: MockResponse, 
    expectedStatus: number, 
    expectedType: string,
    expectedCode: string
  ): boolean {
    const state = res.getState();
    
    if (!state.statusCalled || !state.jsonCalled) {
      return false;
    }

    if (state.statusCode !== expectedStatus) {
      return false;
    }

    const error = state.responseData?.error;
    if (!error) {
      return false;
    }

    return error.type === expectedType && error.code === expectedCode;
  }

  /**
   * Validate that middleware called next() successfully
   */
  static validateSuccessfulNext(next: MockNext): boolean {
    const state = next.getState();
    return state.called && state.calledWith === undefined;
  }

  /**
   * Validate that middleware did NOT call next()
   */
  static validateNoNext(next: MockNext): boolean {
    return !next.wasCalled();
  }

  /**
   * Create test token of specified length
   */
  static createTestToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  /**
   * Create invalid token patterns for testing
   */
  static getInvalidTokenPatterns(): string[] {
    return [
      '', // empty
      ' ', // whitespace
      'a', // too short
      'invalid-token', // wrong format
      'Bearer token', // contains space
      '!@#$%^&*()', // special characters
    ];
  }
}

/**
 * Setup and cleanup utilities for auth tests
 */
export class AuthMockSetup {
  /**
   * Setup function for auth tests
   */
  static setup() {
    // Any global setup needed for auth mocks
    // Currently no global state needed
  }

  /**
   * Reset function for auth tests
   */
  static reset() {
    // Any global cleanup needed for auth mocks
    // Currently no global state to clean
  }

  /**
   * Create fresh mock instances
   */
  static createFreshMocks() {
    return {
      request: new MockRequest(),
      response: new MockResponse(),
      next: new MockNext()
    };
  }
}