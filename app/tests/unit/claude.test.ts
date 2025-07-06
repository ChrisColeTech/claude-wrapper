/**
 * Claude Wrapper Core Tests
 * Tests the main Claude wrapper functionality with proper mocking
 */

import { ClaudeService } from '../../src/claude/service';
import { ClaudeSDKClient } from '../../src/claude/sdk-client';
import { mockClaudeSDK, generateMockMessageStream } from '../mocks/claude-cli';
import { setupGlobalMocks, cleanupGlobalMocks } from '../mocks/external-deps';

// Mock external dependencies
jest.mock('child_process');
jest.mock('@anthropic-ai/claude-code', () => mockClaudeSDK);
jest.mock('../../src/utils/logger', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('Claude Wrapper Core', () => {
  let claudeService: ClaudeService;
  let sdkClient: ClaudeSDKClient;

  beforeAll(() => {
    setupGlobalMocks();
  });

  afterAll(() => {
    cleanupGlobalMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    claudeService = new ClaudeService();
    sdkClient = new ClaudeSDKClient();
  });

  afterEach(() => {
    // Cleanup any hanging resources
    jest.clearAllTimers();
  });

  describe('ClaudeService', () => {
    it('should initialize successfully', () => {
      expect(claudeService).toBeDefined();
      expect(claudeService.isSDKAvailable()).toBe(true);
    });

    it('should verify SDK successfully', async () => {
      const result = await claudeService.verifySDK();
      
      expect(result.available).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should create completion with mock messages', async () => {
      // Setup mock message stream
      const mockMessages = generateMockMessageStream('Hello, world!');
      mockClaudeSDK.query.mockImplementationOnce(async function*() {
        for (const message of mockMessages) {
          yield message;
        }
      });

      const messages = [{ role: 'user', content: 'Hello, world!' }];
      const result = await claudeService.createCompletion(messages);

      expect(result.content).toContain('Mock response to: Hello, world!');
      expect(result.role).toBe('assistant');
      expect(result.metadata).toBeDefined();
      expect(mockClaudeSDK.query).toHaveBeenCalled();
    });

    it('should handle streaming completion', async () => {
      // Setup mock streaming messages
      const mockMessages = generateMockMessageStream('Tell me a story', { chunks: 3 });
      mockClaudeSDK.query.mockImplementationOnce(async function*() {
        for (const message of mockMessages) {
          yield message;
        }
      });

      const messages = [{ role: 'user', content: 'Tell me a story' }];
      const chunks = [];
      
      for await (const chunk of claudeService.createStreamingCompletion(messages)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].finished).toBe(true);
      expect(mockClaudeSDK.query).toHaveBeenCalled();
    });
  });

  describe('ClaudeSDKClient', () => {
    it('should initialize successfully', () => {
      expect(sdkClient).toBeDefined();
    });

    it('should verify SDK availability', async () => {
      const result = await sdkClient.verifySDK();
      
      expect(result.available).toBe(true);
      expect(result.version).toBeDefined();
      expect(result.authentication).toBe(true);
    });

    it('should run completion with options', async () => {
      const mockMessages = generateMockMessageStream('Test prompt');
      mockClaudeSDK.query.mockImplementationOnce(async function*() {
        for (const message of mockMessages) {
          yield message;
        }
      });

      const messages = [];
      for await (const message of sdkClient.runCompletion('Test prompt', { model: 'claude-3-5-sonnet-20241022' })) {
        messages.push(message);
      }

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].type).toBe('system');
      expect(messages[0].subtype).toBe('init');
      expect(mockClaudeSDK.query).toHaveBeenCalledWith('Test prompt', expect.objectContaining({
        model: 'claude-3-5-sonnet-20241022'
      }));
    });
  });

  describe('Error Handling', () => {
    it('should handle SDK errors gracefully', async () => {
      mockClaudeSDK.query.mockRejectedValueOnce(new Error('SDK Error'));

      const messages = [{ role: 'user', content: 'Test error handling' }];
      
      await expect(claudeService.createCompletion(messages)).rejects.toThrow();
    });

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'TimeoutError';
      mockClaudeSDK.query.mockRejectedValueOnce(timeoutError);

      const result = await claudeService.verifySDK();
      expect(result.available).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('Configuration', () => {
    it('should handle custom timeout configuration', () => {
      const customService = new ClaudeService(15000, '/custom/cwd');
      
      expect(customService.getTimeout()).toBe(15000);
      expect(customService.getCwd()).toBe('/custom/cwd');
    });

    it('should handle different model configurations', async () => {
      const mockMessages = generateMockMessageStream('Model test');
      mockClaudeSDK.query.mockImplementationOnce(async function*() {
        for (const message of mockMessages) {
          yield message;
        }
      });

      const messages = [{ role: 'user', content: 'Model test' }];
      const options = { model: 'claude-3-haiku-20240307' };
      
      await claudeService.createCompletion(messages, options);
      
      expect(mockClaudeSDK.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ model: 'claude-3-haiku-20240307' })
      );
    });
  });
});