/**
 * Authentication Debug Mock for externalized test mocking
 * Externalized mock following clean architecture principles
 * 
 * Single Responsibility: Mock authentication debugging utilities and validation
 */

import { AuthenticationError, AuthErrorType, BearerTokenValidator, AuthUtils } from '../../../src/auth/middleware';

export interface AuthDebugMockConfig {
  apiKey?: string;
  shouldFailTokenValidation?: boolean;
  shouldFailTokenExtraction?: boolean;
  shouldFailApiKeyGeneration?: boolean;
  shouldFailHashGeneration?: boolean;
  shouldFailFormatValidation?: boolean;
  debugMode?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  customEnvironmentVariables?: Record<string, string>;
}

export interface MockBearerTokenValidator {
  validateToken: jest.MockedFunction<(token: string) => boolean>;
  extractToken: jest.MockedFunction<(authHeader: string) => string | null>;
}

export interface MockAuthUtils {
  generateSecureApiKey: jest.MockedFunction<(length?: number) => string>;
  createSafeHash: jest.MockedFunction<(value: string) => string>;
  isValidApiKeyFormat: jest.MockedFunction<(apiKey: string) => boolean>;
}

export interface MockAuthEnvironment {
  getApiKey: jest.MockedFunction<() => string | undefined>;
  isApiKeyProtectionEnabled: jest.MockedFunction<() => boolean>;
}

/**
 * Authentication debug mock utility for externalized test mocking
 */
export class AuthDebugMock {
  private static mockBearerTokenValidator: MockBearerTokenValidator | null = null;
  private static mockAuthUtils: MockAuthUtils | null = null;
  private static mockAuthEnvironment: MockAuthEnvironment | null = null;
  private static config: AuthDebugMockConfig = {};
  private static originalEnv: Record<string, string | undefined> = {};
  private static debugLogs: string[] = [];
  private static errorInstances: AuthenticationError[] = [];

  /**
   * Setup authentication debug mock with configuration
   */
  static setup(config: AuthDebugMockConfig = {}): void {
    this.config = { ...this.config, ...config };
    
    // Store original environment
    this.originalEnv = { ...process.env };
    
    // Apply custom environment variables
    if (config.customEnvironmentVariables) {
      Object.assign(process.env, config.customEnvironmentVariables);
    }
    
    // Set API key if provided
    if (config.apiKey) {
      process.env['API_KEY'] = config.apiKey;
    }
    
    this.debugLogs = [];
    this.errorInstances = [];
  }

  /**
   * Create mock BearerTokenValidator
   */
  static createMockBearerTokenValidator(): MockBearerTokenValidator {
    const mockValidateToken = jest.fn((token: string): boolean => {
      if (this.config.shouldFailTokenValidation) {
        return false;
      }
      
      if (!this.config.apiKey) {
        return true; // No token protection configured
      }
      
      // Simulate constant-time comparison
      return token === this.config.apiKey;
    });

    const mockExtractToken = jest.fn((authHeader: string): string | null => {
      if (this.config.shouldFailTokenExtraction) {
        return null;
      }
      
      if (!authHeader) {
        return null;
      }
      
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return null;
      }
      
      return parts[1] || null;
    });

    this.mockBearerTokenValidator = {
      validateToken: mockValidateToken,
      extractToken: mockExtractToken
    };

    return this.mockBearerTokenValidator;
  }

  /**
   * Create mock AuthUtils
   */
  static createMockAuthUtils(): MockAuthUtils {
    const mockGenerateSecureApiKey = jest.fn((length: number = 32): string => {
      if (this.config.shouldFailApiKeyGeneration) {
        throw new Error('API key generation failed');
      }
      
      // Generate test API key
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
      return result;
    });

    const mockCreateSafeHash = jest.fn((value: string): string => {
      if (this.config.shouldFailHashGeneration) {
        return 'hash-error';
      }
      
      if (!value || value.length < 8) {
        return 'invalid';
      }
      return value.substring(0, 8) + '...';
    });

    const mockIsValidApiKeyFormat = jest.fn((apiKey: string): boolean => {
      if (this.config.shouldFailFormatValidation) {
        return false;
      }
      
      const pattern = /^[A-Za-z0-9_-]{16,}$/;
      return pattern.test(apiKey);
    });

    this.mockAuthUtils = {
      generateSecureApiKey: mockGenerateSecureApiKey,
      createSafeHash: mockCreateSafeHash,
      isValidApiKeyFormat: mockIsValidApiKeyFormat
    };

    return this.mockAuthUtils;
  }

  /**
   * Create mock authentication environment functions
   */
  static createMockAuthEnvironment(): MockAuthEnvironment {
    const mockGetApiKey = jest.fn((): string | undefined => {
      return this.config.apiKey || process.env['API_KEY'];
    });

    const mockIsApiKeyProtectionEnabled = jest.fn((): boolean => {
      return this.config.apiKey !== undefined || process.env.API_KEY !== undefined;
    });

    this.mockAuthEnvironment = {
      getApiKey: mockGetApiKey,
      isApiKeyProtectionEnabled: mockIsApiKeyProtectionEnabled
    };

    return this.mockAuthEnvironment;
  }

  /**
   * Create mock AuthenticationError for testing
   */
  static createMockAuthenticationError(
    type: AuthErrorType,
    message: string,
    statusCode: number = 401
  ): AuthenticationError {
    const error = new AuthenticationError(type, message, statusCode);
    this.errorInstances.push(error);
    return error;
  }

  /**
   * Simulate debug logging
   */
  static addDebugLog(message: string): void {
    if (this.config.debugMode || this.config.logLevel === 'debug') {
      this.debugLogs.push(message);
    }
  }

  /**
   * Get debug logs for testing
   */
  static getDebugLogs(): string[] {
    return [...this.debugLogs];
  }

  /**
   * Get error instances for testing
   */
  static getErrorInstances(): AuthenticationError[] {
    return [...this.errorInstances];
  }

  /**
   * Clear debug logs
   */
  static clearDebugLogs(): void {
    this.debugLogs = [];
  }

  /**
   * Clear error instances
   */
  static clearErrorInstances(): void {
    this.errorInstances = [];
  }

  /**
   * Set API key for testing
   */
  static setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    process.env['API_KEY'] = apiKey;
  }

  /**
   * Remove API key for testing
   */
  static removeApiKey(): void {
    this.config.apiKey = undefined;
    delete process.env['API_KEY'];
  }

  /**
   * Set debug mode
   */
  static setDebugMode(enabled: boolean): void {
    this.config.debugMode = enabled;
  }

  /**
   * Set log level
   */
  static setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.config.logLevel = level;
  }

  /**
   * Enable token validation failure
   */
  static enableTokenValidationFailure(): void {
    this.config.shouldFailTokenValidation = true;
  }

  /**
   * Disable token validation failure
   */
  static disableTokenValidationFailure(): void {
    this.config.shouldFailTokenValidation = false;
  }

  /**
   * Enable token extraction failure
   */
  static enableTokenExtractionFailure(): void {
    this.config.shouldFailTokenExtraction = true;
  }

  /**
   * Disable token extraction failure
   */
  static disableTokenExtractionFailure(): void {
    this.config.shouldFailTokenExtraction = false;
  }

  /**
   * Enable API key generation failure
   */
  static enableApiKeyGenerationFailure(): void {
    this.config.shouldFailApiKeyGeneration = true;
  }

  /**
   * Disable API key generation failure
   */
  static disableApiKeyGenerationFailure(): void {
    this.config.shouldFailApiKeyGeneration = false;
  }

  /**
   * Enable hash generation failure
   */
  static enableHashGenerationFailure(): void {
    this.config.shouldFailHashGeneration = true;
  }

  /**
   * Disable hash generation failure
   */
  static disableHashGenerationFailure(): void {
    this.config.shouldFailHashGeneration = false;
  }

  /**
   * Enable format validation failure
   */
  static enableFormatValidationFailure(): void {
    this.config.shouldFailFormatValidation = true;
  }

  /**
   * Disable format validation failure
   */
  static disableFormatValidationFailure(): void {
    this.config.shouldFailFormatValidation = false;
  }

  /**
   * Get current mock instances
   */
  static getMockInstances(): {
    bearerTokenValidator: MockBearerTokenValidator | null;
    authUtils: MockAuthUtils | null;
    authEnvironment: MockAuthEnvironment | null;
  } {
    return {
      bearerTokenValidator: this.mockBearerTokenValidator,
      authUtils: this.mockAuthUtils,
      authEnvironment: this.mockAuthEnvironment
    };
  }

  /**
   * Get current configuration
   */
  static getCurrentConfig(): AuthDebugMockConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  static updateConfig(updates: Partial<AuthDebugMockConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Reset all mock configurations and instances
   */
  static reset(): void {
    this.config = {};
    this.mockBearerTokenValidator = null;
    this.mockAuthUtils = null;
    this.mockAuthEnvironment = null;
    this.debugLogs = [];
    this.errorInstances = [];
    
    // Restore original environment
    Object.keys(process.env).forEach(key => {
      if (!(key in this.originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, this.originalEnv);
  }
}

/**
 * Authentication debug test utilities
 */
export class AuthDebugTestUtils {
  /**
   * Create valid bearer token test patterns
   */
  static getValidBearerTokenPatterns(): string[] {
    return [
      'Bearer valid-token-123',
      'Bearer abcdef123456789',
      'Bearer test-api-key-456',
      'Bearer 1234567890abcdef',
      'Bearer secure-key-789'
    ];
  }

  /**
   * Create invalid bearer token test patterns
   */
  static getInvalidBearerTokenPatterns(): string[] {
    return [
      'Invalid token',
      'Bearer',
      'Bearer ',
      'Basic token123',
      'bearer token123',
      'Bearer token with spaces',
      'Bearer token\nwith\nnewlines',
      'Bearer token\twith\ttabs'
    ];
  }

  /**
   * Create valid API key test patterns
   */
  static getValidApiKeyPatterns(): string[] {
    return [
      'abcdef123456789012345',
      'ABCDEF123456789012345',
      'test-api-key-123456789',
      'secure_key_123456789',
      'mixed-Key_123456789'
    ];
  }

  /**
   * Create invalid API key test patterns
   */
  static getInvalidApiKeyPatterns(): string[] {
    return [
      'short',
      'contains spaces',
      'contains@symbols',
      'contains!special',
      'contains.dots',
      'contains,commas',
      'contains/slashes',
      'contains\\backslashes'
    ];
  }

  /**
   * Create authentication error test scenarios
   */
  static getAuthErrorScenarios(): Array<{
    type: AuthErrorType;
    message: string;
    statusCode: number;
    description: string;
  }> {
    return [
      {
        type: AuthErrorType.MISSING_TOKEN,
        message: 'Missing Authorization header',
        statusCode: 401,
        description: 'No Authorization header provided'
      },
      {
        type: AuthErrorType.INVALID_TOKEN,
        message: 'Invalid bearer token',
        statusCode: 401,
        description: 'Token validation failed'
      },
      {
        type: AuthErrorType.MALFORMED_HEADER,
        message: 'Malformed Authorization header',
        statusCode: 401,
        description: 'Authorization header format invalid'
      }
    ];
  }

  /**
   * Create test environment configurations
   */
  static getTestEnvironmentConfigs(): Array<{
    name: string;
    config: AuthDebugMockConfig;
    description: string;
  }> {
    return [
      {
        name: 'no-auth',
        config: { apiKey: undefined },
        description: 'No authentication configured'
      },
      {
        name: 'with-auth',
        config: { apiKey: 'test-api-key-123456789' },
        description: 'API key authentication enabled'
      },
      {
        name: 'debug-mode',
        config: { apiKey: 'test-key', debugMode: true, logLevel: 'debug' },
        description: 'Debug mode enabled'
      },
      {
        name: 'validation-failures',
        config: {
          apiKey: 'test-key',
          shouldFailTokenValidation: true,
          shouldFailTokenExtraction: true
        },
        description: 'All validation failures enabled'
      },
      {
        name: 'generation-failures',
        config: {
          shouldFailApiKeyGeneration: true,
          shouldFailHashGeneration: true,
          shouldFailFormatValidation: true
        },
        description: 'All generation failures enabled'
      }
    ];
  }

  /**
   * Validate authentication error structure
   */
  static validateAuthenticationError(
    error: AuthenticationError,
    expectedType: AuthErrorType,
    expectedMessage: string,
    expectedStatusCode: number
  ): boolean {
    return (
      error instanceof AuthenticationError &&
      error.type === expectedType &&
      error.message === expectedMessage &&
      error.statusCode === expectedStatusCode &&
      error.name === 'AuthenticationError'
    );
  }

  /**
   * Create test API key of specified length
   */
  static createTestApiKey(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  /**
   * Create test safe hash
   */
  static createTestSafeHash(value: string): string {
    if (!value || value.length < 8) {
      return 'invalid';
    }
    return value.substring(0, 8) + '...';
  }
}

/**
 * Authentication debug mock setup and cleanup utilities
 */
export class AuthDebugMockSetup {
  /**
   * Setup function for authentication debug tests
   */
  static setup(): void {
    AuthDebugMock.setup();
  }

  /**
   * Reset function for authentication debug tests
   */
  static reset(): void {
    AuthDebugMock.reset();
  }

  /**
   * Create fresh mock instances
   */
  static createFreshMocks(): {
    bearerTokenValidator: MockBearerTokenValidator;
    authUtils: MockAuthUtils;
    authEnvironment: MockAuthEnvironment;
  } {
    return {
      bearerTokenValidator: AuthDebugMock.createMockBearerTokenValidator(),
      authUtils: AuthDebugMock.createMockAuthUtils(),
      authEnvironment: AuthDebugMock.createMockAuthEnvironment()
    };
  }
}