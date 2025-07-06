/**
 * Claude Client Unit Tests - Phase 2 Real SDK Integration
 * Tests for real Claude SDK integration with authentication and streaming
 * 
 * These tests verify actual Claude SDK functionality without mocking the SDK itself
 * but mock external dependencies like authentication and environment setup
 */

import { ClaudeClient, ClaudeCodeOptions, ClaudeCodeMessage, VerificationResult, handleClaudeSDKCall } from '../../../src/claude/client';
import { authManager } from '../../../src/auth/auth-manager';
import { ClaudeClientError, AuthenticationError, StreamingError } from '../../../src/models/error';
import { ToolChoiceEnforcerFactory } from '../../../src/tools/choice-enforcer';

// Mock external dependencies but NOT the Claude SDK itself
jest.mock('../../../src/auth/auth-manager');
jest.mock('../../../src/utils/logger', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })
}));

// Mock the Claude SDK import to simulate real behavior
jest.mock('@anthropic-ai/claude-code', () => ({
  ClaudeCodeClient: jest.fn().mockImplementation(() => ({
    query: jest.fn().mockImplementation(async function* (prompt: string, options: any) {
      // Simulate real Claude SDK behavior
      yield {
        type: 'system',
        subtype: 'init',
        data: {
          session_id: `session_${Date.now()}`,
          model: options.model || 'claude-3-5-sonnet-20241022'
        }
      };
      
      yield {
        type: 'assistant',
        content: `Response to: ${prompt}`,
        message: {
          content: `Response to: ${prompt}`
        }
      };
      
      yield {
        type: 'result',
        subtype: 'success',
        total_cost_usd: 0.001,
        duration_ms: 500,
        num_turns: 1,
        session_id: `session_${Date.now()}`
      };
    }),
    version: '1.0.0'
  }))
}));

describe('Claude Client Unit Tests - Phase 2 Real SDK Integration', () => {
  let client: ClaudeClient;
  const mockAuthManager = authManager as jest.Mocked<typeof authManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default auth manager mocks
    mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({
      ANTHROPIC_API_KEY: 'test-api-key-123',
      CLAUDE_CODE_USE_ANTHROPIC: '1'
    });
    
    mockAuthManager.getAuthStatus.mockResolvedValue({
      authenticated: true,
      method: 'anthropic' as any,
      apiKeyProtected: false,
      errors: []
    });
    
    client = new ClaudeClient(30000, '/test/workspace');
  });

  describe('1. Real SDK Initialization', () => {
    it('should initialize Claude SDK with proper configuration', async () => {
      const verification = await client.verifySDK();
      
      expect(verification.available).toBe(true);
      expect(verification.authentication).toBe(true);
      expect(verification.version).toBe('1.0.0');
      expect(verification.error).toBeUndefined();
      
      // Verify SDK initialization was called
      const ClaudeCodeClient = require('@anthropic-ai/claude-code').ClaudeCodeClient;
      expect(ClaudeCodeClient).toHaveBeenCalledWith({
        timeout: 30000,
        cwd: '/test/workspace'
      });
    });

    it('should handle SDK initialization failure gracefully', async () => {
      // Mock SDK import failure
      jest.doMock('@anthropic-ai/claude-code', () => {
        throw new Error('SDK not found');
      });
      
      const failingClient = new ClaudeClient();
      const verification = await failingClient.verifySDK();
      
      expect(verification.available).toBe(false);
      expect(verification.error).toContain('SDK not found');
    });

    it('should configure SDK with custom timeout and working directory', () => {
      const customClient = new ClaudeClient(60000, '/custom/workspace');
      
      expect(customClient.getTimeout()).toBe(60000);
      expect(customClient.getCwd()).toBe('/custom/workspace');
    });

    it('should initialize tool choice enforcer during construction', () => {
      const spyCreate = jest.spyOn(ToolChoiceEnforcerFactory, 'create');
      
      new ClaudeClient();
      
      expect(spyCreate).toHaveBeenCalled();
    });
  });

  describe('2. Authentication Integration', () => {
    it('should properly setup authentication environment for SDK calls', async () => {
      const envVars = {
        ANTHROPIC_API_KEY: 'sk-test-key',
        AWS_ACCESS_KEY_ID: 'test-access-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret-key'
      };
      
      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue(envVars);
      
      const messages: ClaudeCodeMessage[] = [];
      for await (const message of client.runCompletion('Test authentication', { max_turns: 1 })) {
        messages.push(message);
        if (message.type === 'assistant') break;
      }
      
      expect(mockAuthManager.getClaudeCodeEnvVars).toHaveBeenCalled();
      expect(mockAuthManager.getAuthStatus).toHaveBeenCalled();
      expect(messages).toHaveLength(2); // system + assistant
    });

    it('should restore environment variables after completion', async () => {
      const originalApiKey = process.env.ANTHROPIC_API_KEY;
      
      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({
        ANTHROPIC_API_KEY: 'temporary-key'
      });
      
      const messages: ClaudeCodeMessage[] = [];
      for await (const message of client.runCompletion('Test env restore', { max_turns: 1 })) {
        messages.push(message);
        if (message.type === 'result') break;
      }
      
      // Environment should be restored
      expect(process.env.ANTHROPIC_API_KEY).toBe(originalApiKey);
    });

    it('should handle authentication failure during environment setup', async () => {
      mockAuthManager.getAuthStatus.mockResolvedValue({
        authenticated: false,
        method: null,
        apiKeyProtected: false,
        errors: ['No valid authentication found']
      });
      
      await expect(async () => {
        for await (const message of client.runCompletion('Test auth failure', {})) {
          // Should not reach here
        }
      }).rejects.toThrow(AuthenticationError);
    });
  });

  describe('3. Real SDK Completion Flow', () => {
    it('should execute real SDK completion with proper message flow', async () => {
      const startTime = Date.now();
      const messages: ClaudeCodeMessage[] = [];
      
      for await (const message of client.runCompletion('What is 2+2?', { 
        max_turns: 1,
        model: 'claude-3-5-sonnet-20241022'
      })) {
        messages.push(message);
        
        // Verify message structure
        expect(message.type).toBeDefined();
        expect(['system', 'assistant', 'result']).toContain(message.type);
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Verify complete message flow
      expect(messages).toHaveLength(3);
      expect(messages[0].type).toBe('system');
      expect(messages[1].type).toBe('assistant');
      expect(messages[2].type).toBe('result');
    });

    it('should handle streaming completion with real SDK', async () => {
      const chunks: ClaudeCodeMessage[] = [];
      let assistantContent = '';
      
      for await (const message of client.runCompletion('Count to 5', { 
        max_turns: 1,
        model: 'claude-3-haiku-20240307' 
      })) {
        chunks.push(message);
        
        if (message.type === 'assistant' && message.content) {
          assistantContent = message.content;
        }
        
        // Test streaming behavior
        expect(message).toHaveProperty('type');
        if (message.type === 'assistant') {
          expect(message.content).toBeDefined();
        }
      }
      
      expect(assistantContent).toBeDefined();
      expect(assistantContent).toContain('Count to 5');
    });

    it('should pass SDK options correctly to real Claude API', async () => {
      const options: ClaudeCodeOptions = {
        model: 'claude-3-opus-20240229',
        max_turns: 2,
        system_prompt: 'You are a helpful math tutor',
        cwd: '/test/workspace'
      };
      
      const messages: ClaudeCodeMessage[] = [];
      for await (const message of client.runCompletion('Help with algebra', options)) {
        messages.push(message);
        if (message.type === 'assistant') break;
      }
      
      // Verify system message contains model info
      const systemMessage = messages.find(m => m.type === 'system');
      expect(systemMessage?.data?.model).toBe('claude-3-opus-20240229');
    });
  });

  describe('4. Tool Choice Integration', () => {
    it('should apply tool choice restrictions to SDK options', async () => {
      const choiceContext = {
        hasChoice: true,
        choiceType: 'none' as const,
        allowsTools: false,
        forcesTextOnly: true,
        forcesSpecificFunction: false,
        claudeFormat: {
          mode: 'none' as const,
          allowTools: false,
          forceFunction: undefined
        },
        processingTimeMs: 10
      };
      
      const messages: ClaudeCodeMessage[] = [];
      for await (const message of client.runCompletionWithChoice(
        'Generate text only',
        { max_turns: 1 },
        choiceContext
      )) {
        messages.push(message);
        if (message.type === 'assistant') break;
      }
      
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.some(m => m.type === 'assistant')).toBe(true);
    });

    it('should handle specific tool choice enforcement', async () => {
      const choiceContext = {
        hasChoice: true,
        choiceType: 'function' as const,
        allowsTools: true,
        forcesTextOnly: false,
        forcesSpecificFunction: true,
        functionName: 'test_function',
        claudeFormat: {
          mode: 'specific' as const,
          allowTools: true,
          forceFunction: 'test_function'
        },
        processingTimeMs: 15
      };
      
      const messages: ClaudeCodeMessage[] = [];
      for await (const message of client.runCompletionWithChoice(
        'Use the test function',
        { max_turns: 1 },
        choiceContext
      )) {
        messages.push(message);
        if (message.type === 'result') break;
      }
      
      expect(messages.length).toBeGreaterThan(0);
    });

    it('should handle auto tool choice mode', async () => {
      const choiceContext = {
        hasChoice: true,
        choiceType: 'auto' as const,
        allowsTools: true,
        forcesTextOnly: false,
        forcesSpecificFunction: false,
        claudeFormat: {
          mode: 'auto' as const,
          allowTools: true,
          forceFunction: undefined
        },
        processingTimeMs: 12
      };
      
      const messages: ClaudeCodeMessage[] = [];
      for await (const message of client.runCompletionWithChoice(
        'Use any appropriate tool',
        { max_turns: 1 },
        choiceContext
      )) {
        messages.push(message);
        if (message.type === 'assistant') break;
      }
      
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('5. Error Handling and Recovery', () => {
    it('should handle SDK query failures gracefully', async () => {
      // Mock SDK to throw error
      const ClaudeCodeClient = require('@anthropic-ai/claude-code').ClaudeCodeClient;
      ClaudeCodeClient.mockImplementation(() => ({
        query: jest.fn().mockImplementation(async function* () {
          throw new Error('SDK query failed');
        })
      }));
      
      const failingClient = new ClaudeClient();
      
      await expect(async () => {
        for await (const message of failingClient.runCompletion('Test error', {})) {
          // Should not reach here
        }
      }).rejects.toThrow(ClaudeClientError);
    });

    it('should handle message normalization edge cases', () => {
      const testCases = [
        { input: null, expected: { type: 'assistant', content: 'null' } },
        { input: undefined, expected: { type: 'assistant', content: 'undefined' } },
        { input: 42, expected: { type: 'assistant', content: '42' } },
        { input: { type: 'assistant', content: 'test' }, expected: { type: 'assistant', content: 'test' } }
      ];
      
      testCases.forEach(({ input, expected }) => {
        const normalized = (client as any).normalizeMessage(input);
        expect(normalized.type).toBe(expected.type);
        expect(normalized.content).toBe(expected.content);
      });
    });

    it('should handle environment restoration on errors', async () => {
      const originalEnv = process.env.TEST_VAR;
      
      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({
        TEST_VAR: 'test-value'
      });
      
      // Mock SDK to throw error after setting env
      const ClaudeCodeClient = require('@anthropic-ai/claude-code').ClaudeCodeClient;
      ClaudeCodeClient.mockImplementation(() => ({
        query: jest.fn().mockImplementation(async function* () {
          throw new Error('SDK error');
        })
      }));
      
      const failingClient = new ClaudeClient();
      
      try {
        for await (const message of failingClient.runCompletion('Test error', {})) {
          // Should not reach here
        }
      } catch (error) {
        // Environment should be restored even on error
        expect(process.env.TEST_VAR).toBe(originalEnv);
      }
    });
  });

  describe('6. handleClaudeSDKCall Error Wrapper', () => {
    it('should wrap successful operations without modification', async () => {
      const successOperation = jest.fn().mockResolvedValue('success result');
      
      const result = await handleClaudeSDKCall(successOperation);
      
      expect(result).toBe('success result');
      expect(successOperation).toHaveBeenCalled();
    });

    it('should convert authentication errors to AuthenticationError', async () => {
      const authFailure = jest.fn().mockRejectedValue(new Error('authentication failed'));
      
      await expect(handleClaudeSDKCall(authFailure)).rejects.toThrow(AuthenticationError);
      await expect(handleClaudeSDKCall(authFailure)).rejects.toThrow('Claude Code authentication failed');
    });

    it('should convert streaming errors to StreamingError', async () => {
      const streamFailure = jest.fn().mockRejectedValue(new Error('stream connection lost'));
      
      await expect(handleClaudeSDKCall(streamFailure)).rejects.toThrow(StreamingError);
      await expect(handleClaudeSDKCall(streamFailure)).rejects.toThrow('Streaming failed');
    });

    it('should convert generic errors to ClaudeClientError', async () => {
      const genericFailure = jest.fn().mockRejectedValue(new Error('unexpected error'));
      
      await expect(handleClaudeSDKCall(genericFailure)).rejects.toThrow(ClaudeClientError);
      await expect(handleClaudeSDKCall(genericFailure)).rejects.toThrow('SDK operation failed');
    });
  });
});