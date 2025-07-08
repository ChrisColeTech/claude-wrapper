/**
 * Tests for Claude Config Mock
 * Ensures mock utilities work correctly for testing
 */

import { ClaudeConfigMock } from './claude-config-mock';

describe('ClaudeConfigMock', () => {
  beforeEach(() => {
    ClaudeConfigMock.reset();
  });

  afterEach(() => {
    ClaudeConfigMock.reset();
  });

  describe('setup', () => {
    it('should create mock instance with default configuration', () => {
      const mockInstance = ClaudeConfigMock.setup();

      expect(mockInstance).toBeDefined();
      expect(mockInstance.getConfig).toBeDefined();
      expect(mockInstance.isProduction).toBeDefined();
      expect(mockInstance.isDevelopment).toBeDefined();
      expect(mockInstance.getApiKey).toBeDefined();
      expect(mockInstance.isVerboseMode).toBeDefined();
      expect(mockInstance.isDebugMode).toBeDefined();
      expect(mockInstance.isDaemonMode).toBeDefined();
      expect(mockInstance.getRequiredApiKey).toBeDefined();
      expect(ClaudeConfigMock.getMockInstance()).toBe(mockInstance);
    });

    it('should create mock instance with custom configuration', () => {
      const config = {
        port: 9999,
        timeout: 60000,
        claudeCommand: '/custom/claude',
        logLevel: 'debug' as const,
        isProduction: true
      };

      const mockInstance = ClaudeConfigMock.setup(config);
      const envConfig = mockInstance.getConfig();

      expect(envConfig.port).toBe(9999);
      expect(envConfig.timeout).toBe(60000);
      expect(envConfig.claudeCommand).toBe('/custom/claude');
      expect(envConfig.logLevel).toBe('debug');
      expect(mockInstance.isProduction()).toBe(true);
    });

    it('should apply environment variables', () => {
      const envVars = { 'TEST_VAR': 'test_value' };
      ClaudeConfigMock.setup({ environmentVariables: envVars });

      expect(process.env['TEST_VAR']).toBe('test_value');
    });
  });

  describe('getConfig', () => {
    it('should return default configuration', () => {
      const mockInstance = ClaudeConfigMock.setup();
      const config = mockInstance.getConfig();

      expect(config).toEqual({
        port: 8000,
        timeout: 30000,
        claudeCommand: undefined,
        logLevel: 'info'
      });
    });

    it('should return custom configuration', () => {
      const customConfig = {
        port: 9999,
        timeout: 45000,
        claudeCommand: '/opt/claude',
        logLevel: 'warn' as const
      };

      const mockInstance = ClaudeConfigMock.setup(customConfig);
      const config = mockInstance.getConfig();

      expect(config).toEqual(customConfig);
    });

    it('should throw error when validation fails', () => {
      const mockInstance = ClaudeConfigMock.setup({ shouldFailValidation: true });

      expect(() => mockInstance.getConfig()).toThrow('Configuration validation failed');
    });
  });

  describe('environment mode methods', () => {
    it('should return production mode status', () => {
      const mockInstance = ClaudeConfigMock.setup({ isProduction: true });
      expect(mockInstance.isProduction()).toBe(true);
    });

    it('should return development mode status', () => {
      const mockInstance = ClaudeConfigMock.setup({ isDevelopment: true });
      expect(mockInstance.isDevelopment()).toBe(true);
    });

    it('should return API key', () => {
      const mockInstance = ClaudeConfigMock.setup({ apiKey: 'test-key-123' });
      expect(mockInstance.getApiKey()).toBe('test-key-123');
    });

    it('should return undefined for missing API key', () => {
      const mockInstance = ClaudeConfigMock.setup();
      expect(mockInstance.getApiKey()).toBeUndefined();
    });

    it('should return verbose mode status', () => {
      const mockInstance = ClaudeConfigMock.setup({ isVerboseMode: true });
      expect(mockInstance.isVerboseMode()).toBe(true);
    });

    it('should return debug mode status', () => {
      const mockInstance = ClaudeConfigMock.setup({ isDebugMode: true });
      expect(mockInstance.isDebugMode()).toBe(true);
    });

    it('should return daemon mode status', () => {
      const mockInstance = ClaudeConfigMock.setup({ isDaemonMode: true });
      expect(mockInstance.isDaemonMode()).toBe(true);
    });

    it('should return required API key status', () => {
      const mockInstance = ClaudeConfigMock.setup({ requireApiKey: true });
      expect(mockInstance.getRequiredApiKey()).toBe(true);
    });
  });

  describe('configuration presets', () => {
    it('should create development configuration', () => {
      const config = ClaudeConfigMock.createDevelopmentConfig();

      expect(config).toEqual({
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
      });
    });

    it('should create production configuration', () => {
      const config = ClaudeConfigMock.createProductionConfig();

      expect(config).toEqual({
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
      });
    });

    it('should create test configuration', () => {
      const config = ClaudeConfigMock.createTestConfig();

      expect(config).toEqual({
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
      });
    });

    it('should create environment variable configuration', () => {
      const config = ClaudeConfigMock.createEnvVarConfig();

      expect(config.environmentVariables).toEqual({
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
      });
    });

    it('should create incomplete configuration', () => {
      const config = ClaudeConfigMock.createIncompleteConfig();

      expect(config).toEqual({
        port: undefined,
        timeout: undefined,
        claudeCommand: undefined,
        logLevel: undefined,
        shouldFailValidation: false
      });
    });

    it('should create failing configuration', () => {
      const config = ClaudeConfigMock.createFailingConfig();

      expect(config).toEqual({
        shouldFailValidation: true
      });
    });

    it('should create Docker configuration', () => {
      const config = ClaudeConfigMock.createDockerConfig();

      expect(config).toEqual({
        port: 8000,
        timeout: 120000,
        claudeCommand: 'docker run --rm anthropic/claude',
        logLevel: 'info',
        environmentVariables: {
          'CLAUDE_DOCKER_IMAGE': 'anthropic/claude:latest',
          'DOCKER_CLAUDE_CMD': 'docker run --rm anthropic/claude'
        }
      });
    });

    it('should create Windows configuration', () => {
      const config = ClaudeConfigMock.createWindowsConfig();

      expect(config).toEqual({
        port: 8000,
        timeout: 30000,
        claudeCommand: 'C:\\Users\\user\\AppData\\Roaming\\npm\\claude.cmd',
        logLevel: 'info',
        environmentVariables: {
          'CLAUDE_COMMAND': 'C:\\Users\\user\\AppData\\Roaming\\npm\\claude.cmd'
        }
      });
    });
  });

  describe('configuration setters', () => {
    it('should set port', () => {
      ClaudeConfigMock.setPort(9999);
      const mockInstance = ClaudeConfigMock.setup();
      expect(mockInstance.getConfig().port).toBe(9999);
    });

    it('should set timeout', () => {
      ClaudeConfigMock.setTimeout(60000);
      const mockInstance = ClaudeConfigMock.setup();
      expect(mockInstance.getConfig().timeout).toBe(60000);
    });

    it('should set Claude command', () => {
      ClaudeConfigMock.setClaudeCommand('/custom/claude');
      const mockInstance = ClaudeConfigMock.setup();
      expect(mockInstance.getConfig().claudeCommand).toBe('/custom/claude');
    });

    it('should set log level', () => {
      ClaudeConfigMock.setLogLevel('debug');
      const mockInstance = ClaudeConfigMock.setup();
      expect(mockInstance.getConfig().logLevel).toBe('debug');
    });

    it('should set environment variables', () => {
      const envVars = { 'CUSTOM_VAR': 'custom_value' };
      ClaudeConfigMock.setEnvironmentVariables(envVars);
      expect(process.env['CUSTOM_VAR']).toBe('custom_value');
    });

    it('should set production mode', () => {
      ClaudeConfigMock.setProductionMode(true);
      const mockInstance = ClaudeConfigMock.setup();
      expect(mockInstance.isProduction()).toBe(true);
      expect(mockInstance.isDevelopment()).toBe(false);
    });

    it('should set development mode', () => {
      ClaudeConfigMock.setDevelopmentMode(true);
      const mockInstance = ClaudeConfigMock.setup();
      expect(mockInstance.isDevelopment()).toBe(true);
      expect(mockInstance.isProduction()).toBe(false);
    });

    it('should set API key', () => {
      ClaudeConfigMock.setApiKey('new-api-key');
      const mockInstance = ClaudeConfigMock.setup();
      expect(mockInstance.getApiKey()).toBe('new-api-key');
    });

    it('should set verbose mode', () => {
      ClaudeConfigMock.setVerboseMode(true);
      const mockInstance = ClaudeConfigMock.setup();
      expect(mockInstance.isVerboseMode()).toBe(true);
    });

    it('should set debug mode', () => {
      ClaudeConfigMock.setDebugMode(true);
      const mockInstance = ClaudeConfigMock.setup();
      expect(mockInstance.isDebugMode()).toBe(true);
    });

    it('should set daemon mode', () => {
      ClaudeConfigMock.setDaemonMode(true);
      const mockInstance = ClaudeConfigMock.setup();
      expect(mockInstance.isDaemonMode()).toBe(true);
    });

    it('should set require API key', () => {
      ClaudeConfigMock.setRequireApiKey(true);
      const mockInstance = ClaudeConfigMock.setup();
      expect(mockInstance.getRequiredApiKey()).toBe(true);
    });

    it('should set validation failure', () => {
      ClaudeConfigMock.setValidationFailure(true);
      const mockInstance = ClaudeConfigMock.setup();
      expect(() => mockInstance.getConfig()).toThrow('Configuration validation failed');
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const mockInstance = ClaudeConfigMock.setup({ port: 8000 });
      expect(mockInstance.getConfig().port).toBe(8000);

      ClaudeConfigMock.updateConfig({ port: 9999 });
      const updatedMockInstance = ClaudeConfigMock.setup();
      expect(updatedMockInstance.getConfig().port).toBe(9999);
    });

    it('should get current configuration', () => {
      const config = { port: 9999, timeout: 45000 };
      ClaudeConfigMock.setup(config);

      const currentConfig = ClaudeConfigMock.getCurrentConfig();
      expect(currentConfig).toEqual(expect.objectContaining(config));
    });

    it('should return empty configuration when not set', () => {
      const currentConfig = ClaudeConfigMock.getCurrentConfig();
      expect(currentConfig).toEqual({});
    });
  });

  describe('reset', () => {
    it('should reset all configurations', () => {
      const originalEnv = process.env['TEST_VAR'];

      ClaudeConfigMock.setup({
        port: 9999,
        environmentVariables: { 'TEST_VAR': 'test_value' }
      });

      expect(process.env['TEST_VAR']).toBe('test_value');

      ClaudeConfigMock.reset();

      expect(process.env['TEST_VAR']).toBe(originalEnv);
      expect(ClaudeConfigMock.getMockInstance()).toBeNull();
      expect(ClaudeConfigMock.getCurrentConfig()).toEqual({});
    });

    it('should restore original environment variables', () => {
      process.env['EXISTING_VAR'] = 'original_value';

      ClaudeConfigMock.setup({
        environmentVariables: { 'EXISTING_VAR': 'modified_value' }
      });

      expect(process.env['EXISTING_VAR']).toBe('modified_value');

      ClaudeConfigMock.reset();

      expect(process.env['EXISTING_VAR']).toBe('original_value');
    });
  });

  describe('mock instance management', () => {
    it('should return null when no mock instance exists', () => {
      expect(ClaudeConfigMock.getMockInstance()).toBeNull();
    });

    it('should return mock instance after setup', () => {
      const mockInstance = ClaudeConfigMock.setup();
      expect(ClaudeConfigMock.getMockInstance()).toBe(mockInstance);
    });

    it('should return null after reset', () => {
      ClaudeConfigMock.setup();
      ClaudeConfigMock.reset();
      expect(ClaudeConfigMock.getMockInstance()).toBeNull();
    });
  });

  describe('preset configuration integration', () => {
    it('should work with development configuration preset', () => {
      const devConfig = ClaudeConfigMock.createDevelopmentConfig();
      const mockInstance = ClaudeConfigMock.setup(devConfig);

      expect(mockInstance.getConfig().logLevel).toBe('debug');
      expect(mockInstance.isProduction()).toBe(false);
      expect(mockInstance.isDevelopment()).toBe(true);
      expect(mockInstance.isVerboseMode()).toBe(true);
      expect(mockInstance.isDebugMode()).toBe(true);
      expect(mockInstance.isDaemonMode()).toBe(false);
      expect(mockInstance.getRequiredApiKey()).toBe(false);
    });

    it('should work with production configuration preset', () => {
      const prodConfig = ClaudeConfigMock.createProductionConfig();
      const mockInstance = ClaudeConfigMock.setup(prodConfig);

      expect(mockInstance.getConfig().logLevel).toBe('info');
      expect(mockInstance.isProduction()).toBe(true);
      expect(mockInstance.isDevelopment()).toBe(false);
      expect(mockInstance.isVerboseMode()).toBe(false);
      expect(mockInstance.isDebugMode()).toBe(false);
      expect(mockInstance.isDaemonMode()).toBe(true);
      expect(mockInstance.getRequiredApiKey()).toBe(true);
      expect(mockInstance.getApiKey()).toBe('prod-api-key-123');
    });

    it('should work with environment variable configuration preset', () => {
      const envConfig = ClaudeConfigMock.createEnvVarConfig();
      ClaudeConfigMock.setup(envConfig);

      expect(process.env['PORT']).toBe('9999');
      expect(process.env['TIMEOUT']).toBe('45000');
      expect(process.env['CLAUDE_COMMAND']).toBe('/opt/claude/bin/claude');
      expect(process.env['LOG_LEVEL']).toBe('warn');
      expect(process.env['NODE_ENV']).toBe('development');
      expect(process.env['API_KEY']).toBe('test-api-key-456');
      expect(process.env['VERBOSE']).toBe('true');
      expect(process.env['DEBUG_MODE']).toBe('true');
      expect(process.env['CLAUDE_WRAPPER_DAEMON']).toBe('true');
      expect(process.env['REQUIRE_API_KEY']).toBe('true');
    });
  });
});