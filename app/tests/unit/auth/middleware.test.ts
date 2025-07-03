/**
 * Test suite for Authentication Middleware
 * Comprehensive unit tests for bearer token validation and middleware
 */

import { Request, Response, NextFunction } from 'express';
import { 
  BearerTokenValidator, 
  bearerTokenValidator,
  authMiddleware,
  authStatusMiddleware,
  getAuthHealthStatus
} from '../../../src/auth/middleware';
import { authManager } from '../../../src/auth/auth-manager';
import { AuthMethod } from '../../../src/auth/interfaces';

// Mock dependencies
jest.mock('../../../src/auth/auth-manager');
jest.mock('../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

const mockAuthManager = authManager as jest.Mocked<typeof authManager>;

describe('Authentication Middleware', () => {
  let req: Partial<Request>;
  let res: any;
  let next: NextFunction;
  let jsonSpy: jest.SpyInstance;
  let statusSpy: jest.SpyInstance;
  let setHeaderSpy: jest.SpyInstance;

  beforeEach(() => {
    // Setup request mock
    req = {
      path: '/v1/chat/completions',
      headers: {}
    };

    // Setup response mock spies
    jsonSpy = jest.fn();
    statusSpy = jest.fn();
    setHeaderSpy = jest.fn();
    
    // Create mock response object
    res = {
      status: statusSpy,
      json: jsonSpy,
      setHeader: setHeaderSpy
    };
    
    // Make status return the response object for chaining
    statusSpy.mockReturnValue(res);

    // Setup next function mock
    next = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();
    mockAuthManager.isProtected.mockReturnValue(false);
    mockAuthManager.getApiKey.mockReturnValue(undefined);
    mockAuthManager.getCurrentMethod.mockReturnValue(null);
  });

  describe('BearerTokenValidator', () => {
    let validator: BearerTokenValidator;

    beforeEach(() => {
      validator = new BearerTokenValidator();
    });

    describe('extractToken', () => {
      it('should extract token from valid Bearer header', () => {
        const token = validator.extractToken('Bearer abc123xyz');
        expect(token).toBe('abc123xyz');
      });

      it('should extract token from Bearer header with case insensitive', () => {
        const token = validator.extractToken('bearer abc123xyz');
        expect(token).toBe('abc123xyz');
      });

      it('should extract token from Bearer header with extra spaces', () => {
        const token = validator.extractToken('Bearer    abc123xyz   ');
        expect(token).toBe('abc123xyz   '); // Preserves trailing spaces in token
      });

      it('should return null for missing header', () => {
        expect(validator.extractToken('')).toBe(null);
        expect(validator.extractToken(null as any)).toBe(null);
        expect(validator.extractToken(undefined as any)).toBe(null);
      });

      it('should return null for invalid format', () => {
        expect(validator.extractToken('Basic abc123')).toBe(null);
        expect(validator.extractToken('abc123')).toBe(null);
        expect(validator.extractToken('Bearer')).toBe(null); // Missing token
      });

      it('should return null for non-string input', () => {
        expect(validator.extractToken(123 as any)).toBe(null);
        expect(validator.extractToken({} as any)).toBe(null);
      });
    });

    describe('validateToken', () => {
      it('should return true when no API key is configured', () => {
        mockAuthManager.getApiKey.mockReturnValue(undefined);
        
        const result = validator.validateToken('any-token');
        expect(result).toBe(true);
      });

      it('should return false when no token provided but API key protection enabled', () => {
        mockAuthManager.getApiKey.mockReturnValue('expected-key');
        
        const result = validator.validateToken('');
        expect(result).toBe(false);
      });

      it('should return true when tokens match', () => {
        const expectedToken = 'test-api-key-123';
        mockAuthManager.getApiKey.mockReturnValue(expectedToken);
        
        const result = validator.validateToken(expectedToken);
        expect(result).toBe(true);
      });

      it('should return false when tokens do not match', () => {
        mockAuthManager.getApiKey.mockReturnValue('expected-key');
        
        const result = validator.validateToken('wrong-key');
        expect(result).toBe(false);
      });

      it('should handle null/undefined tokens', () => {
        mockAuthManager.getApiKey.mockReturnValue('expected-key');
        
        expect(validator.validateToken(null as any)).toBe(false);
        expect(validator.validateToken(undefined as any)).toBe(false);
      });
    });
  });

  describe('authMiddleware', () => {
    it('should skip authentication for health endpoint', () => {
      const healthReq = { ...req, path: '/health' };
      mockAuthManager.isProtected.mockReturnValue(true);
      
      const middleware = authMiddleware();
      middleware(healthReq as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should skip authentication for models endpoint', () => {
      const modelsReq = { ...req, path: '/v1/models' };
      mockAuthManager.isProtected.mockReturnValue(true);
      
      const middleware = authMiddleware();
      middleware(modelsReq as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should skip authentication for custom skip paths', () => {
      const skipReq = { ...req, path: '/custom/skip' };
      mockAuthManager.isProtected.mockReturnValue(true);
      
      const middleware = authMiddleware({ skipPaths: ['/custom/skip'] });
      middleware(skipReq as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should allow requests when API key protection is disabled', () => {
      mockAuthManager.isProtected.mockReturnValue(false);
      
      const middleware = authMiddleware();
      middleware(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header is missing', () => {
      mockAuthManager.isProtected.mockReturnValue(true);
      
      const middleware = authMiddleware();
      middleware(req as Request, res as Response, next);
      
      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: {
          message: 'Authorization header required',
          type: 'authentication_error',
          code: 'missing_authorization'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid authorization header format', () => {
      req.headers!.authorization = 'Basic abc123';
      mockAuthManager.isProtected.mockReturnValue(true);
      
      const middleware = authMiddleware();
      middleware(req as Request, res as Response, next);
      
      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: {
          message: 'Invalid authorization header format. Expected: Bearer <token>',
          type: 'authentication_error',
          code: 'invalid_authorization_format'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid API key', () => {
      req.headers!.authorization = 'Bearer wrong-key';
      mockAuthManager.isProtected.mockReturnValue(true);
      mockAuthManager.getApiKey.mockReturnValue('correct-key');
      
      const middleware = authMiddleware();
      middleware(req as Request, res as Response, next);
      
      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: {
          message: 'Invalid or expired API key',
          type: 'authentication_error',
          code: 'invalid_api_key'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow requests with valid API key', () => {
      const validKey = 'test-api-key';
      req.headers!.authorization = `Bearer ${validKey}`;
      mockAuthManager.isProtected.mockReturnValue(true);
      mockAuthManager.getApiKey.mockReturnValue(validKey);
      
      const middleware = authMiddleware();
      middleware(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should use custom validator when provided', () => {
      const mockValidator = {
        extractToken: jest.fn().mockReturnValue('extracted-token'),
        validateToken: jest.fn().mockReturnValue(true)
      };
      
      req.headers!.authorization = 'Bearer test-token';
      mockAuthManager.isProtected.mockReturnValue(true);
      
      const middleware = authMiddleware({ validator: mockValidator });
      middleware(req as Request, res as Response, next);
      
      expect(mockValidator.extractToken).toHaveBeenCalledWith('Bearer test-token');
      expect(mockValidator.validateToken).toHaveBeenCalledWith('extracted-token');
      expect(next).toHaveBeenCalled();
    });

    it('should handle middleware errors gracefully', () => {
      mockAuthManager.isProtected.mockImplementation(() => {
        throw new Error('Auth manager error');
      });
      
      const middleware = authMiddleware();
      middleware(req as Request, res as Response, next);
      
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: {
          message: 'Internal authentication error',
          type: 'authentication_error',
          code: 'internal_error'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authStatusMiddleware', () => {
    it('should add auth status headers', () => {
      mockAuthManager.isProtected.mockReturnValue(true);
      mockAuthManager.getCurrentMethod.mockReturnValue(AuthMethod.ANTHROPIC);
      
      authStatusMiddleware(req as Request, res as Response, next);
      
      expect(setHeaderSpy).toHaveBeenCalledWith('X-Auth-Protected', 'true');
      expect(setHeaderSpy).toHaveBeenCalledWith('X-Auth-Method', AuthMethod.ANTHROPIC);
      expect(next).toHaveBeenCalled();
    });

    it('should add headers for unprotected state', () => {
      mockAuthManager.isProtected.mockReturnValue(false);
      mockAuthManager.getCurrentMethod.mockReturnValue(null);
      
      authStatusMiddleware(req as Request, res as Response, next);
      
      expect(setHeaderSpy).toHaveBeenCalledWith('X-Auth-Protected', 'false');
      expect(setHeaderSpy).toHaveBeenCalledTimes(1); // No method header when null
      expect(next).toHaveBeenCalled();
    });

    it('should continue on error', () => {
      mockAuthManager.isProtected.mockImplementation(() => {
        throw new Error('Auth manager error');
      });
      
      authStatusMiddleware(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });
  });

  describe('getAuthHealthStatus', () => {
    it('should return health status with all provider statuses', async () => {
      const mockProvider1 = {
        getMethod: () => AuthMethod.ANTHROPIC,
        validate: jest.fn().mockResolvedValue({ valid: true }),
        getRequiredEnvVars: () => [],
        isConfigured: () => true
      };
      
      const mockProvider2 = {
        getMethod: () => AuthMethod.BEDROCK,
        validate: jest.fn().mockResolvedValue({ valid: false }),
        getRequiredEnvVars: () => [],
        isConfigured: () => false
      };

      mockAuthManager.isProtected.mockReturnValue(true);
      mockAuthManager.getAuthStatus.mockResolvedValue({
        authenticated: true,
        method: AuthMethod.ANTHROPIC,
        apiKeyProtected: true,
        errors: []
      });
      mockAuthManager.getProviders.mockReturnValue([mockProvider1, mockProvider2] as any);
      
      const status = await getAuthHealthStatus();
      
      expect(status).toEqual({
        protected: true,
        method: AuthMethod.ANTHROPIC,
        provider_status: {
          [AuthMethod.ANTHROPIC]: true,
          [AuthMethod.BEDROCK]: false
        }
      });
    });

    it('should handle provider validation errors', async () => {
      const mockProvider = {
        getMethod: () => AuthMethod.ANTHROPIC,
        validate: jest.fn().mockRejectedValue(new Error('Validation failed')),
        getRequiredEnvVars: () => [],
        isConfigured: () => true
      };

      mockAuthManager.isProtected.mockReturnValue(false);
      mockAuthManager.getAuthStatus.mockResolvedValue({
        authenticated: false,
        method: null,
        apiKeyProtected: false,
        errors: ['No auth configured']
      });
      mockAuthManager.getProviders.mockReturnValue([mockProvider] as any);
      
      const status = await getAuthHealthStatus();
      
      expect(status.provider_status[AuthMethod.ANTHROPIC]).toBe(false);
    });

    it('should handle auth manager errors', async () => {
      mockAuthManager.getAuthStatus.mockRejectedValue(new Error('Auth manager error'));
      
      const status = await getAuthHealthStatus();
      
      expect(status).toEqual({
        protected: false,
        method: null,
        provider_status: {}
      });
    });
  });

  describe('bearerTokenValidator (global instance)', () => {
    it('should be instance of BearerTokenValidator', () => {
      expect(bearerTokenValidator).toBeInstanceOf(BearerTokenValidator);
    });

    it('should work as global validator', () => {
      const token = bearerTokenValidator.extractToken('Bearer test123');
      expect(token).toBe('test123');
    });
  });
});