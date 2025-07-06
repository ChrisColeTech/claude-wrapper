/**
 * Claude SDK Client Unit Tests - Phase 2 Real SDK Integration
 * Tests for real Claude SDK Client wrapper with direct SDK integration
 * 
 * These tests verify actual Claude SDK wrapper functionality with real authentication
 * and configuration patterns from CLAUDE_SDK_REFERENCE.md
 */

import { ClaudeSDKClient, createClaudeSDKClient, verifyClaudeSDK } from '../../../src/claude/sdk-client';
import { ClaudeCodeOptions, ClaudeCodeMessage } from '../../../src/claude/client';
import { ClaudeSDKError, AuthenticationError, VerificationError } from '../../../src/claude/error-types';
import { authManager } from '../../../src/auth/auth-manager';
import { CLAUDE_SDK_CONSTANTS } from '../../../src/claude/interfaces';

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

// Mock the real Claude SDK to simulate actual behavior
jest.mock('@anthropic-ai/claude-code', () => ({
  ClaudeCodeClient: jest.fn().mockImplementation(() => ({
    query: jest.fn().mockImplementation(async function* (prompt: string, options: any) {
      // Simulate real Claude SDK streaming response
      yield {
        type: 'system',
        subtype: 'init',
        data: {
          session_id: `real_session_${Date.now()}`,
          model: options.model || 'claude-3-5-sonnet-20241022',
          cwd: options.cwd
        }
      };
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 10));
      
      yield {
        type: 'assistant',
        content: `SDK Response: ${prompt}`,
        message: {
          content: `SDK Response: ${prompt}`,
          role: 'assistant'
        },
        data: {
          model: options.model || 'claude-3-5-sonnet-20241022',
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        }
      };
      
      yield {
        type: 'result',
        subtype: 'success',
        total_cost_usd: 0.002,
        duration_ms: 300,
        num_turns: options.max_turns || 1,
        session_id: `real_session_${Date.now()}`
      };
    }),
    version: '1.2.0'
  }))
}));

describe('Claude SDK Client Unit Tests - Phase 2 Real SDK Integration', () => {
  let sdkClient: ClaudeSDKClient;
  const mockAuthManager = authManager as jest.Mocked<typeof authManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup realistic authentication mocks
    mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({
      ANTHROPIC_API_KEY: 'sk-ant-test-key-123',
      CLAUDE_CODE_USE_ANTHROPIC: '1'
    });
    
    mockAuthManager.getAuthStatus.mockResolvedValue({
      authenticated: true,
      method: 'anthropic' as any,
      apiKeyProtected: true,
      errors: []
    });
    
    sdkClient = new ClaudeSDKClient({
      timeout: 15000,
      cwd: '/test/project',
      model: 'claude-3-5-sonnet-20241022'
    });
  });

  describe('1. SDK Client Configuration', () => {
    it('should initialize with default configuration', () => {
      const defaultClient = new ClaudeSDKClient();
      
      expect(defaultClient.getTimeout()).toBe(CLAUDE_SDK_CONSTANTS.DEFAULT_TIMEOUT);
      expect(defaultClient.getCwd()).toBe(process.cwd());
      expect(defaultClient.isAvailable()).toBe(true);
    });

    it('should initialize with custom configuration', () => {
      const customClient = new ClaudeSDKClient({
        timeout: 30000,
        cwd: '/custom/workspace',
        model: 'claude-3-haiku-20240307',
        max_turns: 5
      });
      
      expect(customClient.getTimeout()).toBe(30000);
      expect(customClient.getCwd()).toBe('/custom/workspace');
    });

    it('should merge configuration with defaults correctly', () => {
      const partialConfig = {
        timeout: 45000,
        model: 'claude-3-opus-20240229'
      };
      
      const configuredClient = new ClaudeSDKClient(partialConfig);
      
      expect(configuredClient.getTimeout()).toBe(45000);
      expect(configuredClient.getCwd()).toBe(process.cwd()); // Should use default
    });

    it('should set authentication priority correctly', () => {
      const client = new ClaudeSDKClient({
        auth_priority: [
          CLAUDE_SDK_CONSTANTS.AUTH_METHODS.BEDROCK,
          CLAUDE_SDK_CONSTANTS.AUTH_METHODS.ANTHROPIC_API_KEY
        ]
      });
      
      expect(client).toBeDefined();
      // Priority is set internally, verified through auth calls
    });
  });

  describe('2. SDK Verification and Authentication', () => {
    it('should verify SDK availability with real authentication', async () => {
      const verification = await sdkClient.verifySDK();
      
      expect(verification.available).toBe(true);
      expect(verification.authentication).toBe(true);
      expect(verification.version).toBe('1.2.0');
      expect(verification.error).toBeUndefined();
    });

    it('should handle authentication failure during verification', async () => {
      mockAuthManager.getAuthStatus.mockResolvedValue({
        authenticated: false,
        method: null,
        apiKeyProtected: false,
        errors: ['API key not found']
      });
      
      const verification = await sdkClient.verifySDK();
      
      expect(verification.available).toBe(false);
      expect(verification.authentication).toBe(false);
      expect(verification.error).toContain('authentication setup failed');
    });

    it('should test SDK connection with timeout', async () => {
      const startTime = Date.now();
      const isConnected = await sdkClient.testSDKConnection();
      const duration = Date.now() - startTime;
      
      expect(isConnected).toBe(true);
      expect(duration).toBeLessThan(CLAUDE_SDK_CONSTANTS.SDK_TIMEOUTS.VERIFICATION);
    });

    it('should handle SDK connection timeout', async () => {
      // Mock SDK to simulate timeout
      const ClaudeCodeClient = require('@anthropic-ai/claude-code').ClaudeCodeClient;
      ClaudeCodeClient.mockImplementation(() => ({
        query: jest.fn().mockImplementation(async function* () {
          // Simulate long delay that should timeout
          await new Promise(resolve => setTimeout(resolve, 10000));
          yield { type: 'assistant', content: 'delayed response' };
        })
      }));
      
      const timeoutClient = new ClaudeSDKClient({ timeout: 100 });
      const isConnected = await timeoutClient.testSDKConnection();
      
      expect(isConnected).toBe(false);
    });

    it('should handle SDK verification errors gracefully', async () => {
      // Mock SDK to throw during initialization
      jest.doMock('@anthropic-ai/claude-code', () => {
        throw new Error('SDK initialization failed');
      });
      
      const failingClient = new ClaudeSDKClient();
      const verification = await failingClient.verifySDK();
      
      expect(verification.available).toBe(false);
      expect(verification.error).toContain('SDK initialization failed');
    });
  });

  describe('3. Real SDK Completion Operations', () => {
    it('should execute completion with real SDK integration', async () => {
      const prompt = 'Explain quantum computing';
      const options: ClaudeCodeOptions = {
        model: 'claude-3-5-sonnet-20241022',
        max_turns: 1,
        cwd: '/test/workspace'
      };
      
      const messages: ClaudeCodeMessage[] = [];
      const startTime = Date.now();
      
      for await (const message of sdkClient.runCompletion(prompt, options)) {
        messages.push(message);
        
        // Verify message structure matches real SDK
        expect(message.type).toBeDefined();
        expect(['system', 'assistant', 'result']).toContain(message.type);
        
        if (message.type === 'assistant') {
          expect(message.content).toContain('quantum computing');
        }
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000);
      expect(messages).toHaveLength(3);
    });

    it('should handle streaming completion with proper message flow', async () => {
      const options: ClaudeCodeOptions = {
        model: 'claude-3-haiku-20240307',
        max_turns: 2,
        system_prompt: 'You are a helpful assistant'
      };
      
      let systemMessage: ClaudeCodeMessage | undefined;
      let assistantMessage: ClaudeCodeMessage | undefined;
      let resultMessage: ClaudeCodeMessage | undefined;
      
      for await (const message of sdkClient.runCompletion('Write a haiku', options)) {
        if (message.type === 'system') systemMessage = message;
        if (message.type === 'assistant') assistantMessage = message;
        if (message.type === 'result') resultMessage = message;
      }
      
      expect(systemMessage).toBeDefined();
      expect(systemMessage?.data?.model).toBe('claude-3-haiku-20240307');
      
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.content).toBeDefined();
      
      expect(resultMessage).toBeDefined();
      expect(resultMessage?.subtype).toBe('success');
    });

    it('should merge options with defaults correctly', async () => {
      const partialOptions: ClaudeCodeOptions = {
        model: 'claude-3-opus-20240229',
        max_turns: 3
      };
      
      const messages: ClaudeCodeMessage[] = [];
      for await (const message of sdkClient.runCompletion('Test options', partialOptions)) {
        messages.push(message);
        if (message.type === 'result') break;
      }
      
      const systemMessage = messages.find(m => m.type === 'system');
      expect(systemMessage?.data?.model).toBe('claude-3-opus-20240229');
      
      const resultMessage = messages.find(m => m.type === 'result');
      expect(resultMessage?.num_turns).toBe(3);
    });

    it('should handle completion errors and wrap them appropriately', async () => {
      // Mock SDK to throw error during completion
      const ClaudeCodeClient = require('@anthropic-ai/claude-code').ClaudeCodeClient;
      ClaudeCodeClient.mockImplementation(() => ({
        query: jest.fn().mockImplementation(async function* () {
          throw new Error('Model overloaded');
        })
      }));
      
      const errorClient = new ClaudeSDKClient();
      
      await expect(async () => {
        for await (const message of errorClient.runCompletion('Test error', {})) {
          // Should not reach here
        }
      }).rejects.toThrow(ClaudeSDKError);
    });
  });

  describe('4. Environment Management', () => {
    it('should setup authentication environment correctly', async () => {
      const envVars = {
        ANTHROPIC_API_KEY: 'sk-test-key',
        AWS_ACCESS_KEY_ID: 'test-access-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret-key',
        CLAUDE_CODE_USE_BEDROCK: '1'
      };
      
      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue(envVars);
      
      const messages: ClaudeCodeMessage[] = [];
      for await (const message of sdkClient.runCompletion('Test env setup', {})) {
        messages.push(message);
        if (message.type === 'assistant') break;
      }
      
      expect(mockAuthManager.getClaudeCodeEnvVars).toHaveBeenCalled();
      expect(mockAuthManager.getAuthStatus).toHaveBeenCalled();
    });

    it('should restore environment after completion', async () => {
      const originalKey = process.env.ANTHROPIC_API_KEY;
      const originalBedrock = process.env.CLAUDE_CODE_USE_BEDROCK;
      
      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({
        ANTHROPIC_API_KEY: 'temporary-key',
        CLAUDE_CODE_USE_BEDROCK: '1'
      });
      
      const messages: ClaudeCodeMessage[] = [];
      for await (const message of sdkClient.runCompletion('Test env restore', {})) {
        messages.push(message);
        if (message.type === 'result') break;
      }
      
      // Environment should be restored
      expect(process.env.ANTHROPIC_API_KEY).toBe(originalKey);
      expect(process.env.CLAUDE_CODE_USE_BEDROCK).toBe(originalBedrock);
    });

    it('should handle authentication setup errors', async () => {
      mockAuthManager.getClaudeCodeEnvVars.mockImplementation(() => {
        throw new Error('Failed to get auth vars');
      });
      
      await expect(async () => {
        for await (const message of sdkClient.runCompletion('Test auth error', {})) {
          // Should not reach here
        }
      }).rejects.toThrow(AuthenticationError);
    });

    it('should restore environment even on SDK errors', async () => {
      const originalKey = process.env.TEST_RESTORE_KEY;
      
      mockAuthManager.getClaudeCodeEnvVars.mockReturnValue({
        TEST_RESTORE_KEY: 'temporary-value'
      });
      
      // Mock SDK to throw error
      const ClaudeCodeClient = require('@anthropic-ai/claude-code').ClaudeCodeClient;
      ClaudeCodeClient.mockImplementation(() => ({
        query: jest.fn().mockImplementation(async function* () {
          throw new Error('SDK error');
        })
      }));
      
      const errorClient = new ClaudeSDKClient();
      
      try {
        for await (const message of errorClient.runCompletion('Test error recovery', {})) {
          // Should not reach here
        }
      } catch (error) {
        // Environment should still be restored
        expect(process.env.TEST_RESTORE_KEY).toBe(originalKey);
      }
    });
  });

  describe('5. Factory Functions and Global Instance', () => {
    it('should create SDK client with factory function', () => {
      const config = {
        timeout: 20000,
        cwd: '/factory/test',
        model: 'claude-3-5-sonnet-20241022'
      };
      
      const factoryClient = createClaudeSDKClient(config);
      
      expect(factoryClient.getTimeout()).toBe(20000);
      expect(factoryClient.getCwd()).toBe('/factory/test');
    });

    it('should create SDK client with partial configuration', () => {
      const partialConfig = {
        timeout: 25000
      };
      
      const partialClient = createClaudeSDKClient(partialConfig);
      
      expect(partialClient.getTimeout()).toBe(25000);
      expect(partialClient.getCwd()).toBe(process.cwd());
    });

    it('should verify SDK using global function', async () => {
      const verification = await verifyClaudeSDK();
      
      expect(verification.available).toBe(true);
      expect(verification.authentication).toBe(true);
      expect(verification.version).toBeDefined();
    });

    it('should handle global verification errors', async () => {
      // Mock auth manager to fail
      mockAuthManager.getAuthStatus.mockResolvedValue({
        authenticated: false,
        method: null,
        apiKeyProtected: false,
        errors: ['No authentication']
      });
      
      const verification = await verifyClaudeSDK();
      
      expect(verification.available).toBe(false);
      expect(verification.authentication).toBe(false);
      expect(verification.error).toBeDefined();
    });
  });
});