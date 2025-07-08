/**
 * Comprehensive auth providers tests for 100% coverage
 */

import { 
  AnthropicProvider, 
  BedrockProvider, 
  VertexProvider, 
  ClaudeCliProvider,
  AuthMethod
} from '../../../src/auth/providers';
import { spawn } from 'child_process';
import * as fs from 'fs';

// Mock external dependencies 
jest.mock('child_process');
jest.mock('fs');

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Auth Providers Complete Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    // Clear environment variables
    delete process.env['ANTHROPIC_API_KEY'];
    delete process.env['AWS_ACCESS_KEY_ID'];
    delete process.env['AWS_SECRET_ACCESS_KEY'];
    delete process.env['AWS_REGION'];
    delete process.env['CLAUDE_CODE_USE_BEDROCK'];
    delete process.env['CLAUDE_CODE_USE_VERTEX'];
    delete process.env['GOOGLE_APPLICATION_CREDENTIALS'];
    delete process.env['GOOGLE_CLOUD_PROJECT'];
    delete process.env['API_KEY'];
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('AnthropicProvider', () => {
    let provider: AnthropicProvider;

    beforeEach(() => {
      provider = new AnthropicProvider();
    });

    it('should return correct method', () => {
      expect(provider.getMethod()).toBe(AuthMethod.ANTHROPIC);
    });

    it('should return required environment variables', () => {
      expect(provider.getRequiredEnvVars()).toEqual(['ANTHROPIC_API_KEY']);
    });

    it('should detect configuration when API key present', () => {
      expect(provider.isConfigured()).toBe(false);
      
      process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test123456789012345';
      expect(provider.isConfigured()).toBe(true);
    });

    it('should validate with proper API key and successful CLI', async () => {
      process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test123456789012345';
      
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };
      
      mockSpawn.mockReturnValue(mockChild as any);
      
      // Simulate successful CLI response
      setTimeout(() => {
        const stdoutCallback = mockChild.stdout.on.mock.calls.find(call => call[0] === 'data')?.[1];
        if (stdoutCallback) stdoutCallback('Success response');
        
        const closeCallback = mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1];
        if (closeCallback) closeCallback(0);
      }, 1);
      
      const result = await provider.validate();
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.method).toBe(AuthMethod.ANTHROPIC);
    });

    it('should fail validation when API key not set', async () => {
      const result = await provider.validate();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('ANTHROPIC_API_KEY environment variable not set');
      expect(result.method).toBe(AuthMethod.ANTHROPIC);
    });

    it('should fail validation with invalid API key format', async () => {
      process.env['ANTHROPIC_API_KEY'] = 'invalid-key';
      
      const result = await provider.validate();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('ANTHROPIC_API_KEY must start with "sk-ant-"');
    });

    it('should fail validation with short API key', async () => {
      process.env['ANTHROPIC_API_KEY'] = 'sk-ant-short';
      
      const result = await provider.validate();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('ANTHROPIC_API_KEY appears to be too short');
    });
  });

  describe('BedrockProvider', () => {
    let provider: BedrockProvider;

    beforeEach(() => {
      provider = new BedrockProvider();
    });

    it('should return correct method', () => {
      expect(provider.getMethod()).toBe(AuthMethod.BEDROCK);
    });

    it('should return required environment variables', () => {
      expect(provider.getRequiredEnvVars()).toEqual([
        'AWS_ACCESS_KEY_ID', 
        'AWS_SECRET_ACCESS_KEY', 
        'AWS_REGION'
      ]);
    });

    it('should require credentials for configuration', () => {
      expect(provider.isConfigured()).toBe(false);
      
      process.env['AWS_ACCESS_KEY_ID'] = 'AKIATEST123456789';
      expect(provider.isConfigured()).toBe(false);
      
      process.env['AWS_SECRET_ACCESS_KEY'] = 'test-secret-key';
      expect(provider.isConfigured()).toBe(true);
    });

    it('should test canDetect with flag requirement', () => {
      expect(provider.canDetect()).toBe(false);
      
      process.env['AWS_ACCESS_KEY_ID'] = 'AKIATEST123456789';
      process.env['AWS_SECRET_ACCESS_KEY'] = 'test-secret-key';
      expect(provider.canDetect()).toBe(false);
      
      process.env['CLAUDE_CODE_USE_BEDROCK'] = '1';
      expect(provider.canDetect()).toBe(true);
    });

    it('should validate successfully with proper credentials', async () => {
      process.env['AWS_ACCESS_KEY_ID'] = 'AKIATEST123456789';
      process.env['AWS_SECRET_ACCESS_KEY'] = 'test-secret-key';
      process.env['AWS_REGION'] = 'us-east-1';
      
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };
      
      mockSpawn.mockReturnValue(mockChild as any);
      
      setTimeout(() => {
        const stdoutCallback = mockChild.stdout.on.mock.calls.find(call => call[0] === 'data')?.[1];
        if (stdoutCallback) stdoutCallback('Bedrock success');
        
        const closeCallback = mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1];
        if (closeCallback) closeCallback(0);
      }, 1);
      
      const result = await provider.validate();
      
      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.BEDROCK);
    });

    it('should fail validation when credentials missing', async () => {
      const result = await provider.validate();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('AWS_ACCESS_KEY_ID environment variable not set');
      expect(result.errors).toContain('AWS_SECRET_ACCESS_KEY environment variable not set');
      expect(result.errors).toContain('AWS_REGION environment variable not set');
    });

    it('should fail validation with invalid access key format', async () => {
      process.env['AWS_ACCESS_KEY_ID'] = 'invalid-key';
      process.env['AWS_SECRET_ACCESS_KEY'] = 'test-secret';
      process.env['AWS_REGION'] = 'us-east-1';
      
      const result = await provider.validate();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('AWS_ACCESS_KEY_ID format appears invalid');
    });
  });

  describe('VertexProvider', () => {
    let provider: VertexProvider;

    beforeEach(() => {
      provider = new VertexProvider();
    });

    it('should return correct method', () => {
      expect(provider.getMethod()).toBe(AuthMethod.VERTEX);
    });

    it('should return required environment variables', () => {
      expect(provider.getRequiredEnvVars()).toEqual([
        'GOOGLE_APPLICATION_CREDENTIALS', 
        'GOOGLE_CLOUD_PROJECT'
      ]);
    });

    it('should require credentials for configuration', () => {
      expect(provider.isConfigured()).toBe(false);
      
      process.env['GOOGLE_APPLICATION_CREDENTIALS'] = '/path/to/creds.json';
      expect(provider.isConfigured()).toBe(false);
      
      process.env['GOOGLE_CLOUD_PROJECT'] = 'test-project';
      expect(provider.isConfigured()).toBe(true);
    });

    it('should work with GCLOUD_PROJECT alternative', () => {
      process.env['GOOGLE_APPLICATION_CREDENTIALS'] = '/path/to/creds.json';
      process.env['GCLOUD_PROJECT'] = 'test-project';
      expect(provider.isConfigured()).toBe(true);
    });

    it('should test canDetect with flag requirement', () => {
      expect(provider.canDetect()).toBe(false);
      
      process.env['GOOGLE_APPLICATION_CREDENTIALS'] = '/path/to/creds.json';
      process.env['GOOGLE_CLOUD_PROJECT'] = 'test-project';
      expect(provider.canDetect()).toBe(false);
      
      process.env['CLAUDE_CODE_USE_VERTEX'] = '1';
      expect(provider.canDetect()).toBe(true);
    });

    it('should validate successfully with proper credentials and file', async () => {
      process.env['GOOGLE_APPLICATION_CREDENTIALS'] = '/path/to/creds.json';
      process.env['GOOGLE_CLOUD_PROJECT'] = 'test-project';
      
      mockFs.existsSync.mockReturnValue(true);
      
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };
      
      mockSpawn.mockReturnValue(mockChild as any);
      
      setTimeout(() => {
        const stdoutCallback = mockChild.stdout.on.mock.calls.find(call => call[0] === 'data')?.[1];
        if (stdoutCallback) stdoutCallback('Vertex success');
        
        const closeCallback = mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1];
        if (closeCallback) closeCallback(0);
      }, 1);
      
      const result = await provider.validate();
      
      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.VERTEX);
    });

    it('should fail validation when credentials missing', async () => {
      const result = await provider.validate();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });

    it('should fail validation when credentials file missing', async () => {
      process.env['GOOGLE_APPLICATION_CREDENTIALS'] = '/nonexistent/creds.json';
      process.env['GOOGLE_CLOUD_PROJECT'] = 'test-project';
      
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await provider.validate();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Google Application Credentials file does not exist');
    });
  });

  describe('ClaudeCliProvider', () => {
    let provider: ClaudeCliProvider;

    beforeEach(() => {
      provider = new ClaudeCliProvider();
    });

    it('should return correct method', () => {
      expect(provider.getMethod()).toBe(AuthMethod.CLAUDE_CLI);
    });

    it('should return empty required environment variables', () => {
      expect(provider.getRequiredEnvVars()).toEqual([]);
    });

    it('should always be configured as fallback', () => {
      expect(provider.isConfigured()).toBe(true);
    });

    it('should validate successfully with working CLI', async () => {
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };
      
      mockSpawn.mockReturnValue(mockChild as any);
      
      setTimeout(() => {
        const stdoutCallback = mockChild.stdout.on.mock.calls.find(call => call[0] === 'data')?.[1];
        if (stdoutCallback) stdoutCallback('CLI success');
        
        const closeCallback = mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1];
        if (closeCallback) closeCallback(0);
      }, 1);
      
      const result = await provider.validate();
      
      expect(result.valid).toBe(true);
      expect(result.method).toBe(AuthMethod.CLAUDE_CLI);
    });

    it('should fail validation when CLI fails', async () => {
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };
      
      mockSpawn.mockReturnValue(mockChild as any);
      
      setTimeout(() => {
        const stderrCallback = mockChild.stderr.on.mock.calls.find(call => call[0] === 'data')?.[1];
        if (stderrCallback) stderrCallback('CLI not authenticated');
        
        const closeCallback = mockChild.on.mock.calls.find(call => call[0] === 'close')?.[1];
        if (closeCallback) closeCallback(1);
      }, 1);
      
      const result = await provider.validate();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Claude CLI authentication failed: CLI not authenticated');
    });

    it('should handle spawn errors gracefully', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Command not found');
      });
      
      const result = await provider.validate();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('CLI test failed: Command not found');
    });
  });
});