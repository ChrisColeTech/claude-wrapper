/**
 * Authentication system mocks for testing
 * Provides reusable mocks for auth providers and manager
 */

import { AuthMethod, AuthValidationResult } from '../../src/auth/providers';

export const mockAuthProviders = {
  createAnthropicProvider: () => ({
    getMethod: jest.fn().mockReturnValue(AuthMethod.ANTHROPIC),
    validate: jest.fn(),
    getRequiredEnvVars: jest.fn().mockReturnValue(['ANTHROPIC_API_KEY']),
    isConfigured: jest.fn(),
    canDetect: jest.fn()
  }),

  createBedrockProvider: () => ({
    getMethod: jest.fn().mockReturnValue(AuthMethod.BEDROCK),
    validate: jest.fn(),
    getRequiredEnvVars: jest.fn().mockReturnValue(['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION']),
    isConfigured: jest.fn(),
    canDetect: jest.fn()
  }),

  createVertexProvider: () => ({
    getMethod: jest.fn().mockReturnValue(AuthMethod.VERTEX),
    validate: jest.fn(),
    getRequiredEnvVars: jest.fn().mockReturnValue(['GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_CLOUD_PROJECT']),
    isConfigured: jest.fn(),
    canDetect: jest.fn()
  }),

  createCliProvider: () => ({
    getMethod: jest.fn().mockReturnValue(AuthMethod.CLAUDE_CLI),
    validate: jest.fn(),
    getRequiredEnvVars: jest.fn().mockReturnValue([]),
    isConfigured: jest.fn().mockReturnValue(true)
  })
};

export const mockAuthResults = {
  createValidResult: (method: AuthMethod, config: any = {}): AuthValidationResult => ({
    valid: true,
    errors: [],
    config: { validated: true, ...config },
    method
  }),

  createInvalidResult: (method: AuthMethod, errors: string[] = ['Mock error']): AuthValidationResult => ({
    valid: false,
    errors,
    config: {},
    method
  })
};

export const mockSpawnProcess = {
  createSuccessProcess: (output: string = 'Mock success') => ({
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn(),
    kill: jest.fn(),
    simulateSuccess: function(this: any) {
      setTimeout(() => {
        const stdoutCallback = this.stdout.on.mock.calls.find((call: any) => call[0] === 'data')?.[1];
        if (stdoutCallback) stdoutCallback(output);
        
        const closeCallback = this.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
        if (closeCallback) closeCallback(0);
      }, 10);
    }
  }),

  createFailureProcess: (error: string = 'Mock error') => ({
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn(),
    kill: jest.fn(),
    simulateFailure: function(this: any) {
      setTimeout(() => {
        const stderrCallback = this.stderr.on.mock.calls.find((call: any) => call[0] === 'data')?.[1];
        if (stderrCallback) stderrCallback(error);
        
        const closeCallback = this.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
        if (closeCallback) closeCallback(1);
      }, 10);
    }
  })
};

export const mockEnvironment = {
  clear: () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_REGION;
    delete process.env.CLAUDE_CODE_USE_BEDROCK;
    delete process.env.CLAUDE_CODE_USE_VERTEX;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GCLOUD_PROJECT;
    delete process.env.API_KEY;
  },

  setAnthropic: (apiKey: string = 'sk-ant-test123456789012345') => {
    process.env.ANTHROPIC_API_KEY = apiKey;
  },

  setBedrock: (accessKey: string = 'AKIATEST123456789', secretKey: string = 'test-secret-key', region: string = 'us-east-1') => {
    process.env.AWS_ACCESS_KEY_ID = accessKey;
    process.env.AWS_SECRET_ACCESS_KEY = secretKey;
    process.env.AWS_REGION = region;
    process.env.CLAUDE_CODE_USE_BEDROCK = '1';
  },

  setVertex: (credsPath: string = '/path/to/creds.json', project: string = 'test-project') => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credsPath;
    process.env.GOOGLE_CLOUD_PROJECT = project;
    process.env.CLAUDE_CODE_USE_VERTEX = '1';
  },

  setApiKey: (apiKey: string = 'test-api-key-123456789') => {
    process.env.API_KEY = apiKey;
  }
};