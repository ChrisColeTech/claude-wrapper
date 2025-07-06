/**
 * End-to-End Workflow Tests
 * Tests complete user workflows with minimal mocking
 */

import { mockClaudeSDK, generateMockMessageStream } from '../mocks/claude-cli';
import { setupGlobalMocks, cleanupGlobalMocks } from '../mocks/external-deps';

// Only mock the Claude CLI, not internal components
jest.mock('@anthropic-ai/claude-code', () => mockClaudeSDK);

describe('E2E Workflow Tests', () => {
  beforeAll(() => {
    setupGlobalMocks();
  });

  afterAll(() => {
    cleanupGlobalMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Chat Workflow', () => {
    it('should complete a full chat workflow', async () => {
      // Mock successful Claude response
      const mockMessages = generateMockMessageStream('Complete workflow test', { 
        includeThinking: true,
        chunks: 2 
      });
      
      mockClaudeSDK.query.mockImplementation(async function*() {
        for (const message of mockMessages) {
          yield message;
        }
      });

      // Test the complete workflow
      const { ClaudeService } = await import('../../src/claude/service');
      const service = new ClaudeService();

      // 1. Verify SDK is available
      const verification = await service.verifySDK();
      expect(verification.available).toBe(true);

      // 2. Create a completion
      const messages = [
        { role: 'user', content: 'Complete workflow test' }
      ];
      
      const result = await service.createCompletion(messages, {
        model: 'claude-3-5-sonnet-20241022',
        max_turns: 1
      });

      // 3. Verify results
      expect(result.content).toContain('Mock response');
      expect(result.metadata.total_cost_usd).toBeGreaterThan(0);
      expect(result.metadata.duration_ms).toBeGreaterThan(0);
      expect(mockClaudeSDK.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          model: 'claude-3-5-sonnet-20241022',
          max_turns: 1
        })
      );
    });

    it('should handle streaming workflow', async () => {
      // Mock streaming response
      const mockMessages = generateMockMessageStream('Streaming workflow test', { 
        chunks: 3 
      });
      
      mockClaudeSDK.query.mockImplementation(async function*() {
        for (const message of mockMessages) {
          yield message;
        }
      });

      const { ClaudeService } = await import('../../src/claude/service');
      const service = new ClaudeService();

      const messages = [
        { role: 'user', content: 'Streaming workflow test' }
      ];
      
      const chunks = [];
      for await (const chunk of service.createStreamingCompletion(messages)) {
        chunks.push(chunk);
      }

      // Verify streaming behavior
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].finished).toBe(false);
      expect(chunks[chunks.length - 1].finished).toBe(true);
      expect(chunks[chunks.length - 1].metadata).toBeDefined();
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should handle and recover from transient errors', async () => {
      const { ClaudeService } = await import('../../src/claude/service');
      const service = new ClaudeService();

      // First call fails
      mockClaudeSDK.query.mockRejectedValueOnce(new Error('Transient error'));
      
      // Second call succeeds
      const mockMessages = generateMockMessageStream('Recovery test');
      mockClaudeSDK.query.mockImplementationOnce(async function*() {
        for (const message of mockMessages) {
          yield message;
        }
      });

      const messages = [{ role: 'user', content: 'Recovery test' }];

      // First attempt should fail
      await expect(service.createCompletion(messages)).rejects.toThrow('Transient error');

      // Second attempt should succeed
      const result = await service.createCompletion(messages);
      expect(result.content).toContain('Mock response');
    });
  });

  describe('Multi-Model Workflow', () => {
    it('should handle different models in sequence', async () => {
      const { ClaudeService } = await import('../../src/claude/service');
      const service = new ClaudeService();

      const models = [
        'claude-3-5-sonnet-20241022',
        'claude-3-haiku-20240307',
        'claude-3-opus-20240229'
      ];

      for (const model of models) {
        const mockMessages = generateMockMessageStream(`Test with ${model}`);
        mockClaudeSDK.query.mockImplementationOnce(async function*() {
          for (const message of mockMessages) {
            yield message;
          }
        });

        const messages = [{ role: 'user', content: `Test with ${model}` }];
        const result = await service.createCompletion(messages, { model });

        expect(result.content).toContain('Mock response');
        expect(mockClaudeSDK.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ model })
        );
      }

      expect(mockClaudeSDK.query).toHaveBeenCalledTimes(models.length);
    });
  });
});