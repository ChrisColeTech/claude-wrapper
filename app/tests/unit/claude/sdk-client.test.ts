/**
 * Claude SDK Client Unit Tests for Phase 1A
 * Tests for src/claude/sdk-client.ts ClaudeSDKClient class
 * Validates SDK integration and error handling behavior
 */

import { ClaudeSDKClient, createClaudeSDKClient, verifyClaudeSDK } from '../../../src/claude/sdk-client';
import { ClaudeSDKError, AuthenticationError } from '../../../src/claude/error-types';
import { authManager } from '../../../src/auth/auth-manager';
import { CLAUDE_SDK_CONSTANTS } from '../../../src/claude/interfaces';

// Mock dependencies
jest.mock('../../../src/auth/auth-manager');
jest.mock('../../../src/utils/logger', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })
}));

describe('Phase 1A: Claude SDK Client Tests', () => {
  let sdkClient: ClaudeSDKClient;
  const mockAuthManager = authManager as jest.Mocked<typeof authManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default auth manager setup
    mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({
      ANTHROPIC_API_KEY: 'test-api-key'
    });
    
    mockAuthManager.getAuthStatus.mockResolvedValue({
      authenticated: true,
      method: 'anthropic' as any,
      apiKeyProtected: false,
      errors: []
    });
    
    sdkClient = new ClaudeSDKClient();
  });

  describe('ClaudeSDKClient.constructor', () => {
    it('should initialize with default configuration', () => {
      const client = new ClaudeSDKClient();
      
      expect(client.getTimeout()).toBe(CLAUDE_SDK_CONSTANTS.DEFAULT_TIMEOUT);
      expect(client.getCwd()).toBe(process.cwd());
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        timeout: 120000,
        cwd: '/custom/path',
        model: 'claude-opus-4-20250514'
      };
      
      const client = new ClaudeSDKClient(customConfig);
      
      expect(client.getTimeout()).toBe(120000);
      expect(client.getCwd()).toBe('/custom/path');
    });
  });

  describe('ClaudeSDKClient.verifySDK', () => {
    it('should verify SDK successfully with fallback implementation', async () => {
      const result = await sdkClient.verifySDK();

      expect(result.available).toBe(true);
      expect(result.authentication).toBe(true);
      expect(result.version).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should handle SDK verification failure', async () => {
      // Mock authentication failure
      mockAuthManager.getAuthStatus.mockResolvedValue({
        authenticated: false,
        method: null,
        apiKeyProtected: false,
        errors: ['No authentication found']
      });

      const result = await sdkClient.verifySDK();

      expect(result.available).toBe(false);
      expect(result.authentication).toBe(false);
      expect(result.error).toContain('verification failed');
      expect(result.suggestion).toContain('Claude Code');
    });

    it('should handle environment setup failure', async () => {
      mockAuthManager.getClaudeCodeEnvVars.mockImplementation(() => {
        throw new Error('Environment setup failed');
      });

      const result = await sdkClient.verifySDK();

      expect(result.available).toBe(false);
      expect(result.error).toContain('Environment setup failed');
    });
  });

  describe('ClaudeSDKClient.testSDKConnection', () => {
    it('should test SDK connection successfully', async () => {
      const result = await sdkClient.testSDKConnection();

      // Should return true for fallback implementation
      expect(result).toBe(true);
    });

    it('should handle connection test timeout', async () => {
      // Mock a slow connection that times out
      const originalSetTimeout = global.setTimeout;
      const mockSetTimeout = jest.fn((callback, _timeout) => {
        // Immediately trigger timeout
        if (typeof callback === 'function') {
          callback();
        }
        return 1 as any;
      }) as any;
      mockSetTimeout.__promisify__ = jest.fn();
      global.setTimeout = mockSetTimeout;

      try {
        const result = await sdkClient.testSDKConnection();
        expect(result).toBe(false);
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });
  });

  describe('ClaudeSDKClient.runCompletion', () => {
    it('should run completion with fallback SDK', async () => {
      const messages: any[] = [];
      const options = {
        max_turns: 1,
        model: 'claude-3-5-sonnet-20241022'
      };

      for await (const message of sdkClient.runCompletion('Hello world', options)) {
        messages.push(message);
      }

      expect(messages).toHaveLength(3); // init, assistant, result
      expect(messages[0].type).toBe('system');
      expect(messages[0].subtype).toBe('init');
      expect(messages[1].type).toBe('assistant');
      expect(messages[1].content).toContain('Hello world');
      expect(messages[2].type).toBe('result');
      expect(messages[2].subtype).toBe('success');
    });

    it('should setup and restore environment variables', async () => {
      const originalEnv = process.env.ANTHROPIC_API_KEY;
      
      // Mock different environment variables
      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({
        ANTHROPIC_API_KEY: 'test-key-123',
        CLAUDE_CODE_USE_BEDROCK: '1'
      });

      const messages: any[] = [];
      for await (const message of sdkClient.runCompletion('Test', {})) {
        messages.push(message);
        if (message.type === 'assistant') break;
      }

      // Should have called auth manager methods
      expect(mockAuthManager.getClaudeCodeEnvVars).toHaveBeenCalled();
      expect(mockAuthManager.getAuthStatus).toHaveBeenCalled();
      
      // Environment should be restored after completion
      expect(process.env.ANTHROPIC_API_KEY).toBe(originalEnv);
    });

    it('should handle authentication error during setup', async () => {
      mockAuthManager.getAuthStatus.mockResolvedValue({
        authenticated: false,
        method: null,
        apiKeyProtected: false,
        errors: ['No auth found']
      });

      await expect(async () => {
        for await (const message of sdkClient.runCompletion('Test', {})) {
          // Should not reach here
        }
      }).rejects.toThrow(AuthenticationError);
    });

    it('should pass options to fallback SDK correctly', async () => {
      const options = {
        max_turns: 5,
        model: 'claude-opus-4-20250514',
        allowed_tools: ['read', 'write'],
        system_prompt: 'You are helpful'
      };

      const messages: any[] = [];
      for await (const message of sdkClient.runCompletion('Test prompt', options)) {
        messages.push(message);
      }

      // Verify init message contains model info
      const initMessage = messages.find(m => m.type === 'system' && m.subtype === 'init');
      expect(initMessage?.data?.model).toBe('claude-opus-4-20250514');
    });
  });

  describe('ClaudeSDKClient.isAvailable', () => {
    it('should return true when SDK is initialized', () => {
      expect(sdkClient.isAvailable()).toBe(true);
    });
  });

  describe('ClaudeSDKClient accessors', () => {
    it('should return correct timeout value', () => {
      expect(sdkClient.getTimeout()).toBe(CLAUDE_SDK_CONSTANTS.DEFAULT_TIMEOUT);
    });

    it('should return correct cwd value', () => {
      expect(sdkClient.getCwd()).toBe(process.cwd());
    });
  });

  describe('SDK Factory Functions', () => {
    describe('createClaudeSDKClient', () => {
      it('should create SDK client with default config', () => {
        const client = createClaudeSDKClient();
        expect(client).toBeInstanceOf(ClaudeSDKClient);
        expect(client.getTimeout()).toBe(CLAUDE_SDK_CONSTANTS.DEFAULT_TIMEOUT);
      });

      it('should create SDK client with custom config', () => {
        const config = { timeout: 30000, cwd: '/test' };
        const client = createClaudeSDKClient(config);
        expect(client.getTimeout()).toBe(30000);
        expect(client.getCwd()).toBe('/test');
      });
    });

    describe('verifyClaudeSDK', () => {
      it('should verify global SDK client', async () => {
        const result = await verifyClaudeSDK();
        expect(result).toBeDefined();
        expect(typeof result.available).toBe('boolean');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle SDK initialization errors', async () => {
      // Mock import failure
      const originalImport = require;
      jest.doMock('@anthropic-ai/claude-code', () => {
        throw new Error('Module not found');
      });

      const client = new ClaudeSDKClient();
      
      // Should still work with fallback
      expect(client.isAvailable()).toBe(true);
    });

    it('should wrap SDK errors properly', async () => {
      // Mock auth manager to throw error
      mockAuthManager.getClaudeCodeEnvVars.mockImplementation(() => {
        throw new Error('Auth error');
      });

      await expect(async () => {
        for await (const message of sdkClient.runCompletion('Test', {})) {
          // Should not reach here
        }
      }).rejects.toThrow(AuthenticationError);
    });
  });

  describe('Environment Management', () => {
    it('should properly setup authentication environment', async () => {
      const envVars = {
        ANTHROPIC_API_KEY: 'test-key',
        AWS_ACCESS_KEY_ID: 'test-access-key',
        CLAUDE_CODE_USE_BEDROCK: '1'
      };

      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue(envVars);

      // Run a completion to trigger environment setup
      const messages: any[] = [];
      for await (const message of sdkClient.runCompletion('Test', { max_turns: 1 })) {
        messages.push(message);
        if (message.type === 'assistant') break;
      }

      expect(mockAuthManager.getClaudeCodeEnvVars).toHaveBeenCalled();
      expect(mockAuthManager.getAuthStatus).toHaveBeenCalled();
    });

    it('should restore environment variables after completion', async () => {
      const originalValue = process.env.TEST_VAR;
      
      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({
        TEST_VAR: 'new-value'
      });

      // Run completion
      const messages: any[] = [];
      for await (const message of sdkClient.runCompletion('Test', { max_turns: 1 })) {
        messages.push(message);
        if (message.type === 'assistant') break;
      }

      // Environment should be restored to original value (or undefined if not set originally)
      expect(process.env.TEST_VAR).toBe(originalValue);
    });
  });

  describe('Performance Requirements', () => {
    it('should meet Phase 1A performance requirements for simple completions', async () => {
      const startTime = Date.now();
      
      const messages: any[] = [];
      for await (const message of sdkClient.runCompletion('Hi', { max_turns: 1 })) {
        messages.push(message);
        if (message.type === 'assistant') break;
      }
      
      const responseTime = Date.now() - startTime;
      
      // Phase 1A Critical Requirement: <2s response time
      expect(responseTime).toBeLessThan(CLAUDE_SDK_CONSTANTS.PERFORMANCE_REQUIREMENT_MS);
      
      expect(messages.length).toBeGreaterThan(0);
    });
  });
});