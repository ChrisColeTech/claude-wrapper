/**
 * Claude Code SDK Client Tests for Phase 6A
 * Tests for src/claude/client.ts ClaudeClient class
 * Validates Python compatibility and SDK integration behavior
 */

import { ClaudeClient, ClaudeCodeOptions, ClaudeCodeMessage, VerificationResult } from '../../../src/claude/client';
import { authManager } from '../../../src/auth/auth-manager';
import { ClaudeClientError, AuthenticationError, StreamingError } from '../../../src/models/error';

// Mock dependencies
jest.mock('../../../src/auth/auth-manager');
jest.mock('../../../src/utils/logger');

describe('Phase 6A: Claude Code SDK Client Tests', () => {
  let client: ClaudeClient;
  const mockAuthManager = authManager as jest.Mocked<typeof authManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new ClaudeClient(300000, '/test/cwd');
    
    // Setup default auth manager mocks
    mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({
      ANTHROPIC_API_KEY: 'test-api-key'
    });
    
    mockAuthManager.getAuthStatus.mockResolvedValue({
      authenticated: true,
      method: 'anthropic',
      provider: 'AnthropicProvider'
    });
  });

  describe('ClaudeClient.constructor', () => {
    it('should initialize with default timeout and cwd', () => {
      const defaultClient = new ClaudeClient();
      
      expect(defaultClient.getTimeout()).toBe(600000); // 10 minutes default
      expect(defaultClient.getCwd()).toBe(process.cwd());
    });

    it('should initialize with custom timeout and cwd', () => {
      const customClient = new ClaudeClient(120000, '/custom/path');
      
      expect(customClient.getTimeout()).toBe(120000);
      expect(customClient.getCwd()).toBe('/custom/path');
    });
  });

  describe('ClaudeClient.verifySDK', () => {
    it('should verify SDK successfully with stub implementation', async () => {
      const result = await client.verifySDK();

      expect(result.available).toBe(true);
      expect(result.authentication).toBe(true);
      expect(result.version).toBe('claude-code-sdk');
      expect(result.error).toBeUndefined();
    });

    it('should handle SDK verification failure', async () => {
      // Mock auth manager to return no authentication
      mockAuthManager.getAuthStatus.mockResolvedValue({
        authenticated: false,
        method: null,
        provider: null
      });

      const result = await client.verifySDK();

      expect(result.available).toBe(false);
      expect(result.authentication).toBe(false);
      expect(result.error).toContain('SDK verification failed');
    });

    it('should handle authentication setup failure', async () => {
      mockAuthManager.getClaudeCodeEnvVars.mockImplementation(() => {
        throw new Error('Auth setup failed');
      });

      const result = await client.verifySDK();

      expect(result.available).toBe(false);
      expect(result.error).toContain('Auth setup failed');
    });
  });

  describe('ClaudeClient.runCompletion', () => {
    it('should run completion with stub SDK', async () => {
      const messages: ClaudeCodeMessage[] = [];
      const options: ClaudeCodeOptions = {
        max_turns: 1,
        model: 'claude-3-5-sonnet-20241022'
      };

      for await (const message of client.runCompletion('Hello world', options)) {
        messages.push(message);
      }

      expect(messages).toHaveLength(3); // init, assistant, result
      expect(messages[0].type).toBe('system');
      expect(messages[0].subtype).toBe('init');
      expect(messages[1].type).toBe('assistant');
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

      const messages: ClaudeCodeMessage[] = [];
      for await (const message of client.runCompletion('Test', {})) {
        messages.push(message);
        if (message.type === 'assistant') break;
      }

      // Should have set environment variables during execution
      expect(mockAuthManager.getClaudeCodeEnvVars).toHaveBeenCalled();
      
      // Environment should be restored after completion
      expect(process.env.ANTHROPIC_API_KEY).toBe(originalEnv);
    });

    it('should handle authentication error during setup', async () => {
      mockAuthManager.getAuthStatus.mockResolvedValue({
        authenticated: false,
        method: null,
        provider: null
      });

      await expect(async () => {
        for await (const message of client.runCompletion('Test', {})) {
          // Should not reach here
        }
      }).rejects.toThrow(AuthenticationError);
    });

    it('should pass options to stub SDK correctly', async () => {
      const options: ClaudeCodeOptions = {
        max_turns: 5,
        model: 'claude-opus-4-20250514',
        allowed_tools: ['read', 'write'],
        system_prompt: 'You are helpful'
      };

      const messages: ClaudeCodeMessage[] = [];
      for await (const message of client.runCompletion('Test prompt', options)) {
        messages.push(message);
      }

      // Verify init message contains model info
      const initMessage = messages.find(m => m.type === 'system' && m.subtype === 'init');
      expect(initMessage?.data?.model).toBe('claude-opus-4-20250514');
    });
  });

  describe('ClaudeClient.normalizeMessage', () => {
    it('should normalize message with __dict__ property', () => {
      const mockMessage = {
        __dict__: {
          type: 'assistant',
          content: 'Hello',
          _private: 'should be ignored',
          someFunction: () => 'should be ignored'
        }
      };

      // Access private method through type assertion
      const normalized = (client as any).normalizeMessage(mockMessage);

      expect(normalized.type).toBe('assistant');
      expect(normalized.content).toBe('Hello');
      expect(normalized._private).toBeUndefined();
      expect(normalized.someFunction).toBeUndefined();
    });

    it('should normalize plain object message', () => {
      const message: ClaudeCodeMessage = {
        type: 'assistant',
        content: 'Test response'
      };

      const normalized = (client as any).normalizeMessage(message);

      expect(normalized).toEqual(message);
    });

    it('should handle non-object message', () => {
      const message = 'Simple string message';

      const normalized = (client as any).normalizeMessage(message);

      expect(normalized.type).toBe('assistant');
      expect(normalized.content).toBe('Simple string message');
    });
  });

  describe('ClaudeClient.stubQuery', () => {
    it('should generate realistic stub response sequence', async () => {
      const messages: ClaudeCodeMessage[] = [];
      const options: ClaudeCodeOptions = {
        model: 'claude-3-haiku-20240307'
      };

      // Access private method through type assertion
      for await (const message of (client as any).stubQuery('Test prompt', options)) {
        messages.push(message);
      }

      expect(messages).toHaveLength(3);

      // Verify system init message
      expect(messages[0].type).toBe('system');
      expect(messages[0].subtype).toBe('init');
      expect(messages[0].data?.model).toBe('claude-3-haiku-20240307');
      expect(messages[0].data?.session_id).toBeDefined();

      // Verify assistant response
      expect(messages[1].type).toBe('assistant');
      expect(messages[1].content).toContain('Test prompt');
      expect(messages[1].message?.content).toBeDefined();

      // Verify result message
      expect(messages[2].type).toBe('result');
      expect(messages[2].subtype).toBe('success');
      expect(messages[2].total_cost_usd).toBe(0.01);
      expect(messages[2].duration_ms).toBe(1000);
      expect(messages[2].num_turns).toBe(1);
      expect(messages[2].session_id).toBeDefined();
    });
  });

  describe('ClaudeClient.setupEnvironment', () => {
    it('should setup environment variables correctly', async () => {
      const envVars = {
        ANTHROPIC_API_KEY: 'test-key',
        AWS_ACCESS_KEY_ID: 'test-access-key',
        CLAUDE_CODE_USE_BEDROCK: '1'
      };

      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue(envVars);

      // Access private method through type assertion
      await (client as any).setupEnvironment();

      expect(mockAuthManager.getClaudeCodeEnvVars).toHaveBeenCalled();
      expect(mockAuthManager.getAuthStatus).toHaveBeenCalled();
    });

    it('should throw AuthenticationError when no auth available', async () => {
      mockAuthManager.getAuthStatus.mockResolvedValue({
        authenticated: false,
        method: null,
        provider: null
      });

      await expect((client as any).setupEnvironment()).rejects.toThrow(AuthenticationError);
    });
  });

  describe('ClaudeClient.restoreEnvironment', () => {
    it('should restore original environment variables', async () => {
      const originalValue = process.env.TEST_VAR;
      process.env.TEST_VAR = 'new-value';

      // Setup original env vars
      (client as any).originalEnvVars = {
        TEST_VAR: originalValue
      };

      // Access private method through type assertion
      (client as any).restoreEnvironment();

      expect(process.env.TEST_VAR).toBe(originalValue);
      expect((client as any).originalEnvVars).toEqual({});
    });

    it('should delete environment variables that were not set originally', async () => {
      process.env.TEMP_TEST_VAR = 'should-be-deleted';

      // Setup to indicate this var was not set originally
      (client as any).originalEnvVars = {
        TEMP_TEST_VAR: undefined
      };

      (client as any).restoreEnvironment();

      expect(process.env.TEMP_TEST_VAR).toBeUndefined();
    });
  });

  describe('ClaudeClient.isAvailable', () => {
    it('should return true when SDK is initialized', () => {
      expect(client.isAvailable()).toBe(true);
    });
  });

  describe('ClaudeClient timeout and cwd getters', () => {
    it('should return correct timeout value', () => {
      expect(client.getTimeout()).toBe(300000);
    });

    it('should return correct cwd value', () => {
      expect(client.getCwd()).toBe('/test/cwd');
    });
  });
});

describe('Claude SDK Error Handling', () => {
  describe('handleClaudeSDKCall', () => {
    const { handleClaudeSDKCall } = require('../../../src/claude/client');

    it('should handle successful operation', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await handleClaudeSDKCall(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should handle authentication error', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('authentication failed'));
      
      await expect(handleClaudeSDKCall(operation)).rejects.toThrow(AuthenticationError);
    });

    it('should handle streaming error', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('stream connection failed'));
      
      await expect(handleClaudeSDKCall(operation)).rejects.toThrow(StreamingError);
    });

    it('should handle generic SDK error', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('unexpected SDK error'));
      
      await expect(handleClaudeSDKCall(operation)).rejects.toThrow(ClaudeClientError);
    });
  });
});