/**
 * Performance tests for Enhanced Mock Mode
 * Tests response generation speed, memory usage, and concurrent handling
 */

import { EnhancedResponseGenerator } from '../../../src/mocks/core/enhanced-response-generator';
import { MockClaudeResolver } from '../../../src/mocks/core/mock-claude-resolver';

describe('Enhanced Mock Mode Performance', () => {
  let generator: EnhancedResponseGenerator;
  let resolver: MockClaudeResolver;

  beforeAll(() => {
    generator = EnhancedResponseGenerator.getInstance();
    resolver = MockClaudeResolver.getInstance();
  });

  beforeEach(() => {
    generator.clearHistory();
    resolver.clearHistory();
  });

  describe('Response Generation Speed', () => {
    it('should generate basic responses under 100ms', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Hello, how are you?' }],
        model: 'sonnet'
      };

      const startTime = Date.now();
      const response = await generator.generateResponse(request);
      const elapsed = Date.now() - startTime;

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
      expect(elapsed).toBeLessThan(100);
    });

    it('should generate programming responses under 200ms', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Write a complex sorting algorithm in TypeScript with detailed comments and error handling' }],
        model: 'sonnet'
      };

      const startTime = Date.now();
      const response = await generator.generateResponse(request);
      const elapsed = Date.now() - startTime;

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
      expect(elapsed).toBeLessThan(200);
    });

    it('should generate tool calling responses under 150ms', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Search for weather information and save it to a file' }],
        model: 'sonnet',
        tools: [
          { type: 'function', function: { name: 'get_weather', description: 'Get weather' } },
          { type: 'function', function: { name: 'save_file', description: 'Save file' } }
        ]
      };

      const startTime = Date.now();
      const response = await generator.generateResponse(request);
      const elapsed = Date.now() - startTime;

      expect(response).toBeDefined();
      expect(elapsed).toBeLessThan(150);
    });

    it('should generate streaming responses under 100ms', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Write a comprehensive tutorial on machine learning' }],
        model: 'sonnet',
        stream: true
      };

      const startTime = Date.now();
      const response = await generator.generateStreamingResponse(request);
      const elapsed = Date.now() - startTime;

      expect(response).toBeDefined();
      expect(response.streamingChunks).toBeDefined();
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('Mock Resolver Performance', () => {
    it('should execute commands under 500ms (including mock delays)', async () => {
      const startTime = Date.now();
      const result = await resolver.executeCommand('Test command', 'sonnet');
      const elapsed = Date.now() - startTime;

      expect(result).toBeTruthy();
      expect(elapsed).toBeLessThan(500); // Including mock delay
    });

    it('should execute OpenAI requests under 600ms', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Performance test' }],
        model: 'sonnet'
      };

      const startTime = Date.now();
      const result = await resolver.executeOpenAIRequest(request);
      const elapsed = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(elapsed).toBeLessThan(600);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle 10 concurrent basic requests efficiently', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        messages: [{ role: 'user', content: `Concurrent request ${i}` }],
        model: 'sonnet'
      }));

      const startTime = Date.now();
      const promises = requests.map(request => generator.generateResponse(request));
      const responses = await Promise.all(promises);
      const elapsed = Date.now() - startTime;

      expect(responses).toHaveLength(10);
      responses.forEach((response: any) => {
        expect(response).toBeDefined();
        expect(response.content).toBeTruthy();
      });

      // Should complete all 10 requests in under 1 second
      expect(elapsed).toBeLessThan(1000);
    });

    it('should handle 25 concurrent programming requests', async () => {
      const requests = Array.from({ length: 25 }, (_, i) => ({
        messages: [{ role: 'user', content: `Write a function to process data type ${i}` }],
        model: 'sonnet'
      }));

      const startTime = Date.now();
      const promises = requests.map(request => generator.generateResponse(request));
      const responses = await Promise.all(promises);
      const elapsed = Date.now() - startTime;

      expect(responses).toHaveLength(25);
      responses.forEach((response: any) => {
        expect(response).toBeDefined();
        expect(response.content).toBeTruthy();
      });

      // Should complete all 25 requests in under 2 seconds
      expect(elapsed).toBeLessThan(2000);
    });

    it('should handle 50 concurrent resolver commands', async () => {
      const startTime = Date.now();
      const promises = Array.from({ length: 50 }, (_, i) =>
        resolver.executeCommand(`Concurrent command ${i}`, 'sonnet')
      );
      const results = await Promise.all(promises);
      const elapsed = Date.now() - startTime;

      expect(results).toHaveLength(50);
      results.forEach((result: any) => {
        expect(result).toBeTruthy();
        const parsed = JSON.parse(result);
        expect(parsed.type).toBe('result');
      });

      // Should complete all 50 requests in under 30 seconds (accounting for mock delays)
      expect(elapsed).toBeLessThan(30000);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not accumulate excessive memory with many requests', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Generate 100 responses
      for (let i = 0; i < 100; i++) {
        const request = {
          messages: [{ role: 'user', content: `Memory test request ${i}` }],
          model: 'sonnet'
        };
        await generator.generateResponse(request);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should clear history efficiently', async () => {
      // Clear history first to get accurate count
      generator.clearHistory();
      
      // Generate some responses to build history
      for (let i = 0; i < 20; i++) {
        const request = {
          messages: [{ role: 'user', content: `History test ${i}` }],
          model: 'sonnet'
        };
        await generator.generateResponse(request);
      }

      let stats = generator.getStats();
      expect(stats.totalResponses).toBe(20);

      const memoryBeforeClear = process.memoryUsage().heapUsed;
      generator.clearHistory();
      const memoryAfterClear = process.memoryUsage().heapUsed;

      stats = generator.getStats();
      expect(stats.totalResponses).toBe(0);

      // Memory should decrease or stay roughly the same after clearing
      expect(memoryAfterClear).toBeLessThanOrEqual(memoryBeforeClear + 1024 * 1024); // Allow 1MB tolerance
    });
  });

  describe('Template System Performance', () => {
    it('should select appropriate templates quickly', async () => {
      const testCases = [
        { content: 'Hello world', expectedCategory: 'simple-qa' },
        { content: 'Write a function', expectedCategory: 'code-generation' },
        { content: 'Comprehensive guide to AI', expectedCategory: 'streaming' }
      ];

      for (const testCase of testCases) {
        const request = {
          messages: [{ role: 'user', content: testCase.content }],
          model: 'sonnet'
        };

        const startTime = Date.now();
        const response = await generator.generateResponse(request);
        const elapsed = Date.now() - startTime;

        expect(response).toBeDefined();
        expect(response.content).toBeTruthy();
        expect(elapsed).toBeLessThan(50); // Template selection should be very fast
      }
    });

    it('should handle fallback templates efficiently', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Xyzzylicious quantum flibbertigibbet nonsensical' }],
        model: 'sonnet'
      };

      const startTime = Date.now();
      const response = await generator.generateResponse(request);
      const elapsed = Date.now() - startTime;

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
      expect(elapsed).toBeLessThan(50); // Fallback should be very fast
    });
  });

  describe('Statistical Performance', () => {
    it('should maintain performance statistics accurately', async () => {
      // Clear history first to get accurate count
      generator.clearHistory();
      
      const requestCount = 15;
      
      const startTime = Date.now();
      
      for (let i = 0; i < requestCount; i++) {
        const request = {
          messages: [{ role: 'user', content: `Stats test ${i}` }],
          model: 'sonnet'
        };
        await generator.generateResponse(request);
      }
      
      const elapsed = Date.now() - startTime;
      const stats = generator.getStats();

      expect(stats.totalResponses).toBe(requestCount);
      expect(stats.recentResponses).toHaveLength(Math.min(requestCount, 10)); // Limited to last 10
      expect(Object.keys(stats.categoryCounts).length).toBeGreaterThan(0);

      // Statistical operations should not significantly impact performance
      expect(elapsed).toBeLessThan(1000);
    });

    it('should calculate token usage efficiently', async () => {
      const request = {
        messages: [{ 
          role: 'user', 
          content: 'This is a test message with multiple words to test token calculation performance and accuracy in the enhanced mock mode system.' 
        }],
        model: 'sonnet'
      };

      const startTime = Date.now();
      const response = await generator.generateResponse(request);
      const elapsed = Date.now() - startTime;

      expect(response).toBeDefined();
      expect(response.tokenUsage).toBeDefined();
      expect(response.tokenUsage!.prompt_tokens).toBeGreaterThan(0);
      expect(response.tokenUsage!.completion_tokens).toBeGreaterThan(0);
      expect(response.tokenUsage!.total_tokens).toBe(
        response.tokenUsage!.prompt_tokens + response.tokenUsage!.completion_tokens
      );

      // Token calculation should be very fast
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle invalid requests efficiently', async () => {
      const invalidRequests = [
        { messages: [], model: 'sonnet' },
        { messages: [{ role: 'user', content: '' }], model: 'sonnet' },
        { messages: [{ role: 'user', content: 'test' }] }, // missing model
      ];

      for (const request of invalidRequests) {
        const startTime = Date.now();
        const response = await generator.generateResponse(request);
        const elapsed = Date.now() - startTime;

        expect(response).toBeDefined();
        expect(elapsed).toBeLessThan(100); // Error handling should be fast
      }
    });
  });
});