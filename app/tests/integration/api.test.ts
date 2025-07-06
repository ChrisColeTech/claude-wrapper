/**
 * API Integration Tests
 * Tests the OpenAI-compatible API endpoints with minimal mocking
 */

import { mockClaudeSDK, generateMockMessageStream } from '../mocks/claude-cli';
import { setupGlobalMocks, cleanupGlobalMocks } from '../mocks/external-deps';

// Mock only external dependencies, not internal components
jest.mock('@anthropic-ai/claude-code', () => mockClaudeSDK);
jest.mock('../../src/utils/logger', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('API Integration Tests', () => {
  beforeAll(async () => {
    setupGlobalMocks();
  });

  afterAll(() => {
    cleanupGlobalMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default successful response
    const mockMessages = generateMockMessageStream('API test message');
    mockClaudeSDK.query.mockImplementation(async function*() {
      for (const message of mockMessages) {
        yield message;
      }
    });
  });

  describe('Service Integration', () => {
    it('should integrate Claude service with message conversion', async () => {
      // Test service integration without HTTP layer
      const { ClaudeService } = await import('../../src/claude/service');
      const service = new ClaudeService();

      const messages = [{ role: 'user', content: 'Integration test' }];
      const result = await service.createCompletion(messages);

      expect(result.content).toContain('Mock response');
      expect(result.metadata).toBeDefined();
      expect(mockClaudeSDK.query).toHaveBeenCalled();
    });

    it('should handle different request formats', async () => {
      const { ClaudeService } = await import('../../src/claude/service');
      const service = new ClaudeService();

      // Test with different message formats
      const testCases = [
        [{ role: 'user', content: 'Simple test' }],
        [{ role: 'system', content: 'System prompt' }, { role: 'user', content: 'User query' }],
        [{ role: 'user', content: 'Multi-turn' }, { role: 'assistant', content: 'Response' }, { role: 'user', content: 'Follow-up' }]
      ];

      for (const messages of testCases) {
        const mockMessages = generateMockMessageStream(`Test with ${messages.length} messages`);
        mockClaudeSDK.query.mockImplementationOnce(async function*() {
          for (const message of mockMessages) {
            yield message;
          }
        });

        const result = await service.createCompletion(messages);
        expect(result.content).toContain('Mock response');
      }

      expect(mockClaudeSDK.query).toHaveBeenCalledTimes(testCases.length);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle SDK errors gracefully across service layers', async () => {
      const { ClaudeService } = await import('../../src/claude/service');
      const service = new ClaudeService();

      // Mock SDK error
      mockClaudeSDK.query.mockRejectedValueOnce(new Error('Integration test error'));

      const messages = [{ role: 'user', content: 'Error test' }];
      
      await expect(service.createCompletion(messages)).rejects.toThrow('Integration test error');
    });

    it('should maintain service state across multiple calls', async () => {
      const { ClaudeService } = await import('../../src/claude/service');
      const service = new ClaudeService();

      // Multiple successful calls
      for (let i = 0; i < 3; i++) {
        const mockMessages = generateMockMessageStream(`Call ${i + 1}`);
        mockClaudeSDK.query.mockImplementationOnce(async function*() {
          for (const message of mockMessages) {
            yield message;
          }
        });

        const messages = [{ role: 'user', content: `Call ${i + 1}` }];
        const result = await service.createCompletion(messages);
        
        expect(result.content).toContain('Mock response');
        expect(service.isSDKAvailable()).toBe(true);
      }
    });
  });

  describe('Configuration Integration', () => {
    it('should apply different configurations correctly', async () => {
      const { ClaudeService } = await import('../../src/claude/service');
      
      const configs = [
        { timeout: 10000, cwd: '/test1' },
        { timeout: 20000, cwd: '/test2' },
        { timeout: 30000, cwd: '/test3' }
      ];

      for (const config of configs) {
        const service = new ClaudeService(config.timeout, config.cwd);
        
        expect(service.getTimeout()).toBe(config.timeout);
        expect(service.getCwd()).toBe(config.cwd);
      }
    });
  });
});