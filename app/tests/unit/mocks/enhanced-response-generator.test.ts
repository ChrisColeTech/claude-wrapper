/**
 * Unit tests for Enhanced Response Generator
 * Tests the sophisticated response generation and template selection logic
 */

import { EnhancedResponseGenerator } from '../../../src/mocks/core/enhanced-response-generator';

describe('EnhancedResponseGenerator', () => {
  let generator: EnhancedResponseGenerator;

  beforeEach(() => {
    generator = EnhancedResponseGenerator.getInstance();
    generator.clearHistory();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = EnhancedResponseGenerator.getInstance();
      const instance2 = EnhancedResponseGenerator.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('generateResponse', () => {
    it('should generate response for basic greeting', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Hello! Can you introduce yourself?' }],
        model: 'sonnet'
      };

      const response = await generator.generateResponse(request);

      expect(response).toBeDefined();
      expect(response.id).toMatch(/^chatcmpl-enhanced-/);
      expect(response.content).toBeTruthy();
      expect(response.model).toBe('sonnet');
      expect(response.finishReason).toBe('stop');
      expect(response.tokenUsage).toBeDefined();
      expect(response.tokenUsage?.prompt_tokens).toBeGreaterThan(0);
      expect(response.tokenUsage?.completion_tokens).toBeGreaterThan(0);
    });

    it('should generate programming response for code requests', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Write a Python function to calculate fibonacci numbers' }],
        model: 'sonnet'
      };

      const response = await generator.generateResponse(request);

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
      expect(response.content?.toLowerCase()).toMatch(/function|def|code|python|typescript/);
      expect(response.tokenUsage?.completion_tokens).toBeGreaterThan(20);
    });

    it('should generate tool calls for tool requests', async () => {
      const request = {
        messages: [{ role: 'user', content: 'What\'s the weather like in San Francisco?' }],
        model: 'sonnet',
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather information'
            }
          }
        ]
      };

      const response = await generator.generateResponse(request);

      expect(response).toBeDefined();
      expect(response.toolCalls).toBeDefined();
      expect(response.finishReason).toBe('tool_calls');
      if (response.toolCalls) {
        expect(response.toolCalls.length).toBeGreaterThan(0);
        expect(response.toolCalls[0].type).toBe('function');
        expect(response.toolCalls[0].function.name).toBeTruthy();
      }
    });

    it('should generate streaming-suitable response for comprehensive requests', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Write a comprehensive guide to machine learning basics' }],
        model: 'sonnet'
      };

      const response = await generator.generateResponse(request);

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
      expect(response.content!.length).toBeGreaterThan(200);
      expect(response.tokenUsage?.completion_tokens).toBeGreaterThan(50);
    });

    it('should add conversation context for multi-turn conversations', async () => {
      const request = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you today?' }
        ],
        model: 'sonnet'
      };

      const response = await generator.generateResponse(request);

      expect(response).toBeDefined();
      expect(response.content).toContain('#3');
    });

    it('should generate unique IDs for each response', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Test message' }],
        model: 'sonnet'
      };

      const response1 = await generator.generateResponse(request);
      const response2 = await generator.generateResponse(request);

      expect(response1.id).not.toBe(response2.id);
    });
  });

  describe('generateStreamingResponse', () => {
    it('should generate streaming chunks for long content', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Explain artificial intelligence in detail' }],
        model: 'sonnet',
        stream: true
      };

      const response = await generator.generateStreamingResponse(request);

      expect(response).toBeDefined();
      expect(response.streamingChunks).toBeDefined();
      if (response.streamingChunks) {
        expect(response.streamingChunks.length).toBeGreaterThan(1);
        response.streamingChunks.forEach(chunk => {
          expect(chunk).toBeTruthy();
          expect(typeof chunk).toBe('string');
        });
      }
    });

    it('should create chunks automatically if not present', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Short message' }],
        model: 'sonnet',
        stream: true
      };

      const response = await generator.generateStreamingResponse(request);

      expect(response).toBeDefined();
      expect(response.streamingChunks).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return initial empty stats', () => {
      const stats = generator.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalResponses).toBe(0);
      expect(stats.categoryCounts).toEqual({});
      expect(stats.recentResponses).toEqual([]);
    });

    it('should track response statistics', async () => {
      const request1 = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'sonnet'
      };

      const request2 = {
        messages: [{ role: 'user', content: 'Write Python code' }],
        model: 'sonnet'
      };

      await generator.generateResponse(request1);
      await generator.generateResponse(request2);

      const stats = generator.getStats();

      expect(stats.totalResponses).toBe(2);
      expect(Object.keys(stats.categoryCounts).length).toBeGreaterThan(0);
      expect(stats.recentResponses.length).toBe(2);
    });
  });

  describe('clearHistory', () => {
    it('should clear response history', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'sonnet'
      };

      await generator.generateResponse(request);
      
      let stats = generator.getStats();
      expect(stats.totalResponses).toBe(1);

      generator.clearHistory();
      
      stats = generator.getStats();
      expect(stats.totalResponses).toBe(0);
      expect(stats.recentResponses).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle invalid template loading gracefully', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Test message' }],
        model: 'sonnet'
      };

      // Should not throw even if templates fail to load
      const response = await generator.generateResponse(request);
      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
    });

    it('should handle empty messages array', async () => {
      const request = {
        messages: [],
        model: 'sonnet'
      };

      const response = await generator.generateResponse(request);
      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
    });

    it('should handle missing model', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Test' }]
      };

      const response = await generator.generateResponse(request);
      expect(response).toBeDefined();
    });
  });

  describe('template selection', () => {
    it('should select appropriate template based on content keywords', async () => {
      const programmingRequest = {
        messages: [{ role: 'user', content: 'Create a JavaScript function for sorting arrays' }],
        model: 'sonnet'
      };

      const greetingRequest = {
        messages: [{ role: 'user', content: 'Hi there, how are you?' }],
        model: 'sonnet'
      };

      const programmingResponse = await generator.generateResponse(programmingRequest);
      const greetingResponse = await generator.generateResponse(greetingRequest);

      // Both responses should exist
      expect(programmingResponse.content).toBeTruthy();
      expect(greetingResponse.content).toBeTruthy();
      
      // Programming response should contain code-related content
      expect(programmingResponse.content?.toLowerCase()).toMatch(/function|javascript|code|typescript/);
      
      // Programming response should generally be longer
      if (programmingResponse.content && greetingResponse.content) {
        expect(programmingResponse.content.length).toBeGreaterThan(greetingResponse.content.length);
      }
    });

    it('should fall back to default template for unknown categories', async () => {
      const unknownRequest = {
        messages: [{ role: 'user', content: 'Xyzzylicious quantum flibbertigibbet' }],
        model: 'sonnet'
      };

      const response = await generator.generateResponse(unknownRequest);
      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
      expect(response.finishReason).toBe('stop');
    });
  });

  describe('token calculation', () => {
    it('should calculate realistic token usage', async () => {
      const request = {
        messages: [{ role: 'user', content: 'This is a test message with some words to calculate tokens.' }],
        model: 'sonnet'
      };

      const response = await generator.generateResponse(request);

      expect(response.tokenUsage).toBeDefined();
      expect(response.tokenUsage!.prompt_tokens).toBeGreaterThan(0);
      expect(response.tokenUsage!.completion_tokens).toBeGreaterThan(0);
      expect(response.tokenUsage!.total_tokens).toBe(
        response.tokenUsage!.prompt_tokens + response.tokenUsage!.completion_tokens
      );

      // Rough validation: should be approximately content length / 4
      const expectedPromptTokens = Math.ceil((request.messages[0]?.content || '').length / 4);
      expect(response.tokenUsage!.prompt_tokens).toBeCloseTo(expectedPromptTokens, 5);
    });
  });
});