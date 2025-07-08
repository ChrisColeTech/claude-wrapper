/**
 * Claude Config Mock for externalized test mocking
 * Externalized mock following clean architecture principles
 * 
 * Single Responsibility: Mock configuration loading and environment management
 */

import { EnvironmentConfig } from '../../../src/types';

export interface ClaudeConfigMockConfig {
  port?: number;
  timeout?: number;
  claudeCommand?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  environmentVariables?: Record<string, string>;
  shouldFailValidation?: boolean;
  isProduction?: boolean;
  isDevelopment?: boolean;
  apiKey?: string;
  isVerboseMode?: boolean;
  isDebugMode?: boolean;
  isDaemonMode?: boolean;
  requireApiKey?: boolean;
}

export interface MockEnvironmentManager {
  getConfig: jest.MockedFunction<() => EnvironmentConfig>;
  isProduction: jest.MockedFunction<() => boolean>;
  isDevelopment: jest.MockedFunction<() => boolean>;
  getApiKey: jest.MockedFunction<() => string | undefined>;
  isVerboseMode: jest.MockedFunction<() => boolean>;
  isDebugMode: jest.MockedFunction<() => boolean>;
  isDaemonMode: jest.MockedFunction<() => boolean>;
  getRequiredApiKey: jest.MockedFunction<() => boolean>;
}

/**
 * Claude config mock utility for externalized test mocking
 */
export class ClaudeConfigMock {
  private static mockInstance: MockEnvironmentManager | null = null;
  private static config: ClaudeConfigMockConfig = {};
  private static originalEnv: Record<string, string | undefined> = {};

  /**
   * Setup Claude config mock with configuration
   */
  static setup(config: ClaudeConfigMockConfig = {}): MockEnvironmentManager {
    this.config = { ...this.config, ...config };
    
    // Store original environment
    this.originalEnv = { ...process.env };

    // Apply environment variable mocks
    if (config.environmentVariables) {
      Object.assign(process.env, config.environmentVariables);
    }

    // Create mock configuration
    const mockConfig: EnvironmentConfig = {
      port: config.port || 8000,
      timeout: config.timeout || 30000,
      claudeCommand: config.claudeCommand,
      logLevel: config.logLevel || 'info'
    };

    // Create mock functions
    const mockGetConfig = jest.fn((): EnvironmentConfig => {
      if (this.config.shouldFailValidation) {
        throw new Error('Configuration validation failed');
      }
      return mockConfig;
    });

    const mockIsProduction = jest.fn((): boolean => {
      return this.config.isProduction || false;
    });

    const mockIsDevelopment = jest.fn((): boolean => {
      return this.config.isDevelopment || false;
    });

    const mockGetApiKey = jest.fn((): string | undefined => {
      return this.config.apiKey;
    });

    const mockIsVerboseMode = jest.fn((): boolean => {
      return this.config.isVerboseMode || false;
    });

    const mockIsDebugMode = jest.fn((): boolean => {
      return this.config.isDebugMode || false;
    });

    const mockIsDaemonMode = jest.fn((): boolean => {
      return this.config.isDaemonMode || false;
    });

    const mockGetRequiredApiKey = jest.fn((): boolean => {
      return this.config.requireApiKey || false;
    });

    this.mockInstance = {
      getConfig: mockGetConfig,
      isProduction: mockIsProduction,
      isDevelopment: mockIsDevelopment,
      getApiKey: mockGetApiKey,
      isVerboseMode: mockIsVerboseMode,
      isDebugMode: mockIsDebugMode,
      isDaemonMode: mockIsDaemonMode,
      getRequiredApiKey: mockGetRequiredApiKey
    };

    return this.mockInstance;
  }

  /**
   * Create development environment configuration
   */
  static createDevelopmentConfig(): ClaudeConfigMockConfig {
    return {
      port: 8000,
      timeout: 30000,
      claudeCommand: '/usr/local/bin/claude',
      logLevel: 'debug',
      isProduction: false,
      isDevelopment: true,
      isVerboseMode: true,
      isDebugMode: true,
      isDaemonMode: false,
      requireApiKey: false
    };
  }

  /**
   * Create production environment configuration
   */
  static createProductionConfig(): ClaudeConfigMockConfig {
    return {
      port: 8000,
      timeout: 60000,
      claudeCommand: 'docker run --rm anthropic/claude',
      logLevel: 'info',
      isProduction: true,
      isDevelopment: false,
      isVerboseMode: false,
      isDebugMode: false,
      isDaemonMode: true,
      requireApiKey: true,
      apiKey: 'prod-api-key-123'
    };
  }

  /**
   * Create test environment configuration
   */
  static createTestConfig(): ClaudeConfigMockConfig {
    return {
      port: 9999,
      timeout: 5000,
      claudeCommand: '/usr/local/bin/claude',
      logLevel: 'error',
      isProduction: false,
      isDevelopment: false,
      isVerboseMode: false,
      isDebugMode: false,
      isDaemonMode: false,
      requireApiKey: false
    };
  }

  /**
   * Create configuration with environment variables
   */
  static createEnvVarConfig(): ClaudeConfigMockConfig {
    return {
      environmentVariables: {
        'PORT': '9999',
        'TIMEOUT': '45000',
        'CLAUDE_COMMAND': '/opt/claude/bin/claude',
        'LOG_LEVEL': 'warn',
        'NODE_ENV': 'development',
        'API_KEY': 'test-api-key-456',
        'VERBOSE': 'true',
        'DEBUG_MODE': 'true',
        'CLAUDE_WRAPPER_DAEMON': 'true',
        'REQUIRE_API_KEY': 'true'
      }
    };
  }

  /**
   * Create configuration with missing required values
   */
  static createIncompleteConfig(): ClaudeConfigMockConfig {
    return {
      port: undefined,
      timeout: undefined,
      claudeCommand: undefined,
      logLevel: undefined,
      shouldFailValidation: false
    };
  }

  /**
   * Create configuration that fails validation
   */
  static createFailingConfig(): ClaudeConfigMockConfig {
    return {
      shouldFailValidation: true
    };
  }

  /**
   * Create Docker-specific configuration
   */
  static createDockerConfig(): ClaudeConfigMockConfig {
    return {
      port: 8000,
      timeout: 120000,
      claudeCommand: 'docker run --rm anthropic/claude',
      logLevel: 'info',
      environmentVariables: {
        'CLAUDE_DOCKER_IMAGE': 'anthropic/claude:latest',
        'DOCKER_CLAUDE_CMD': 'docker run --rm anthropic/claude'
      }
    };
  }

  /**
   * Create Windows-specific configuration
   */
  static createWindowsConfig(): ClaudeConfigMockConfig {
    return {
      port: 8000,
      timeout: 30000,
      claudeCommand: 'C:\\Users\\user\\AppData\\Roaming\\npm\\claude.cmd',
      logLevel: 'info',
      environmentVariables: {
        'CLAUDE_COMMAND': 'C:\\Users\\user\\AppData\\Roaming\\npm\\claude.cmd'
      }
    };
  }

  /**
   * Set port configuration
   */
  static setPort(port: number): void {
    this.config.port = port;
  }

  /**
   * Set timeout configuration
   */
  static setTimeout(timeout: number): void {
    this.config.timeout = timeout;
  }

  /**
   * Set Claude command configuration
   */
  static setClaudeCommand(command: string): void {
    this.config.claudeCommand = command;
  }

  /**
   * Set log level configuration
   */
  static setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.config.logLevel = level;
  }

  /**
   * Set environment variables
   */
  static setEnvironmentVariables(envVars: Record<string, string>): void {
    this.config.environmentVariables = envVars;
    Object.assign(process.env, envVars);
  }

  /**
   * Set production mode
   */
  static setProductionMode(isProduction: boolean): void {
    this.config.isProduction = isProduction;
    this.config.isDevelopment = !isProduction;
  }

  /**
   * Set development mode
   */
  static setDevelopmentMode(isDevelopment: boolean): void {
    this.config.isDevelopment = isDevelopment;
    this.config.isProduction = !isDevelopment;
  }

  /**
   * Set API key
   */
  static setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
  }

  /**
   * Set verbose mode
   */
  static setVerboseMode(isVerbose: boolean): void {
    this.config.isVerboseMode = isVerbose;
  }

  /**
   * Set debug mode
   */
  static setDebugMode(isDebug: boolean): void {
    this.config.isDebugMode = isDebug;
  }

  /**
   * Set daemon mode
   */
  static setDaemonMode(isDaemon: boolean): void {
    this.config.isDaemonMode = isDaemon;
  }

  /**
   * Set require API key
   */
  static setRequireApiKey(require: boolean): void {
    this.config.requireApiKey = require;
  }

  /**
   * Set validation failure
   */
  static setValidationFailure(shouldFail: boolean = true): void {
    this.config.shouldFailValidation = shouldFail;
  }

  /**
   * Reset all mock configurations
   */
  static reset(): void {
    this.config = {};
    this.mockInstance = null;
    
    // Restore original environment
    process.env = this.originalEnv;
  }

  /**
   * Get current mock instance
   */
  static getMockInstance(): MockEnvironmentManager | null {
    return this.mockInstance;
  }

  /**
   * Update configuration
   */
  static updateConfig(updates: Partial<ClaudeConfigMockConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  static getCurrentConfig(): ClaudeConfigMockConfig {
    return { ...this.config };
  }
}