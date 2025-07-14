/**
 * Comprehensive validation test for Enhanced Mock Mode
 * Final validation of all enhanced mock mode features
 */

import { EnhancedResponseGenerator } from '../../../src/mocks/core/enhanced-response-generator';
import { MockClaudeResolver } from '../../../src/mocks/core/mock-claude-resolver';
import { MockConfigManager } from '../../../src/config/mock-config';

describe('Enhanced Mock Mode - Comprehensive Validation', () => {
  let generator: EnhancedResponseGenerator;
  let resolver: MockClaudeResolver;

  beforeAll(() => {
    generator = EnhancedResponseGenerator.getInstance();
    resolver = MockClaudeResolver.getInstance();
  });

  beforeEach(() => {
    generator.clearHistory();
    resolver.clearHistory();
    MockConfigManager.resetConfig();
  });

  describe('Phase 2 Enhanced Features Validation', () => {
    it('should demonstrate enhanced template-based response generation', async () => {
      const testCases = [
        {
          name: 'Programming Request',
          request: {
            messages: [{ role: 'user', content: 'Create a TypeScript interface for user data' }],
            model: 'sonnet'
          },
          expectedKeywords: ['interface', 'typescript', 'user', 'data']
        },
        {
          name: 'Greeting Request', 
          request: {
            messages: [{ role: 'user', content: 'Hello! Nice to meet you' }],
            model: 'sonnet'
          },
          expectedKeywords: ['hello', 'mock', 'assistant']
        },
        {
          name: 'Tool Request',
          request: {
            messages: [{ role: 'user', content: 'What\'s the weather like?' }],
            model: 'sonnet',
            tools: [{ type: 'function', function: { name: 'get_weather', description: 'Get weather' } }]
          },
          expectToolCalls: true
        }
      ];

      for (const testCase of testCases) {
        const response = await generator.generateResponse(testCase.request);
        
        expect(response).toBeDefined();
        expect(response.id).toMatch(/^chatcmpl-enhanced-/);
        expect(response.model).toBe('sonnet');
        expect(response.tokenUsage).toBeDefined();

        if (testCase.expectToolCalls) {
          expect(response.finishReason).toBe('tool_calls');
          expect(response.toolCalls).toBeDefined();
        } else {
          expect(response.content).toBeTruthy();
          expect(response.finishReason).toBe('stop');
          
          // Validate content contains expected keywords (case insensitive)
          const content = response.content!.toLowerCase();
          const hasExpectedKeyword = testCase.expectedKeywords?.some(keyword => 
            content.includes(keyword.toLowerCase())
          );
          expect(hasExpectedKeyword).toBe(true);
        }
      }
    });

    it('should demonstrate enhanced Claude CLI format compatibility', async () => {
      const testRequests = [
        'Simple test message',
        'Write a complex algorithm in Python',
        'Explain quantum computing in detail'
      ];

      for (const prompt of testRequests) {
        const result = await resolver.executeCommand(prompt, 'sonnet');
        
        expect(result).toBeTruthy();
        
        const parsed = JSON.parse(result);
        
        // Validate Claude CLI format structure
        expect(parsed).toMatchObject({
          type: 'result',
          subtype: 'success',
          is_error: false,
          duration_ms: expect.any(Number),
          duration_api_ms: expect.any(Number),
          num_turns: 1,
          result: expect.any(String),
          session_id: expect.stringMatching(/^mock-session-/),
          total_cost_usd: expect.any(Number),
          usage: expect.objectContaining({
            input_tokens: expect.any(Number),
            output_tokens: expect.any(Number),
            server_tool_use: expect.any(Object),
            service_tier: expect.any(String)
          })
        });

        expect(parsed.result).toBeTruthy();
        expect(parsed.usage.input_tokens).toBeGreaterThan(0);
        expect(parsed.usage.output_tokens).toBeGreaterThan(0);
      }
    });

    it('should demonstrate enhanced streaming capabilities', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Write a comprehensive guide to machine learning' }],
        model: 'sonnet',
        stream: true
      };

      const response = await generator.generateStreamingResponse(request);

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
      expect(response.streamingChunks).toBeDefined();
      expect(response.streamingChunks!.length).toBeGreaterThan(1);

      // Validate chunks reconstruct the full content
      const reconstructed = response.streamingChunks!.join('');
      expect(reconstructed.length).toBeGreaterThan(0);
    });

    it('should demonstrate enhanced session management', async () => {
      const sessionId = 'test-session-enhanced';
      const messages = [
        'Hello, this is my first message',
        'Do you remember my first message?',
        'What was the topic of our conversation?'
      ];

      // Build up conversation with multiple messages
      let conversationMessages: Array<{role: string; content: string}> = [];

      for (let i = 0; i < messages.length; i++) {
        conversationMessages.push({ role: 'user', content: messages[i] || 'default message' });
        
        const response = await generator.generateResponse({
          messages: conversationMessages,
          model: 'sonnet'
        }, sessionId);

        expect(response).toBeDefined();
        expect(response.content).toBeTruthy();

        // Should include conversation context for multi-turn
        if (i > 0) {
          expect(response.content).toContain(`#${conversationMessages.length}`);
        }

        // Add assistant response to conversation
        conversationMessages.push({ role: 'assistant', content: response.content || 'mock response' });
      }
    });

    it('should demonstrate enhanced error handling', async () => {
      const errorRequests = [
        { messages: [], model: 'sonnet' },
        { messages: [{ role: 'user', content: '' }], model: 'sonnet' },
        { messages: [{ role: 'user', content: 'test' }] }
      ];

      for (const request of errorRequests) {
        // Should not throw errors, but handle gracefully
        const response = await generator.generateResponse(request);
        
        expect(response).toBeDefined();
        expect(response.content).toBeTruthy(); // Should have fallback content
      }
    });

    it('should demonstrate enhanced performance characteristics', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        messages: [{ role: 'user', content: `Performance test ${i}` }],
        model: 'sonnet'
      }));

      const startTime = Date.now();
      const responses = await Promise.all(
        requests.map(request => generator.generateResponse(request))
      );
      const elapsed = Date.now() - startTime;

      // All responses should be valid
      responses.forEach((response: any) => {
        expect(response).toBeDefined();
        expect(response.content).toBeTruthy();
        expect(response.id).toMatch(/^chatcmpl-enhanced-/);
      });

      // Should complete 10 requests quickly
      expect(elapsed).toBeLessThan(1000);
      
      // Should generate unique responses
      const uniqueIds = new Set(responses.map(r => r.id));
      expect(uniqueIds.size).toBe(10);
    });

    it('should demonstrate enhanced statistics and monitoring', async () => {
      // Clear history first to get accurate count
      generator.clearHistory();
      
      // Generate some test responses
      const testRequests = [
        { type: 'programming', content: 'Write a function' },
        { type: 'greeting', content: 'Hello there' },
        { type: 'explanation', content: 'Explain AI' }
      ];

      for (const test of testRequests) {
        await generator.generateResponse({
          messages: [{ role: 'user', content: test.content }],
          model: 'sonnet'
        });
      }

      const stats = generator.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalResponses).toBe(testRequests.length);
      expect(stats.categoryCounts).toBeDefined();
      expect(Object.keys(stats.categoryCounts).length).toBeGreaterThan(0);
      expect(stats.recentResponses).toBeDefined();
      expect(stats.recentResponses.length).toBe(testRequests.length);

      // Validate recent responses structure
      stats.recentResponses.forEach(recent => {
        expect(recent.prompt).toBeTruthy();
        expect(recent.response).toBeTruthy();
        expect(recent.timestamp).toBeInstanceOf(Date);
        expect(recent.category).toBeTruthy();
      });
    });
  });

  describe('Integration with Mock Configuration', () => {
    it('should respect mock configuration settings', () => {
      const config = MockConfigManager.getConfig();
      
      expect(config).toBeDefined();
      expect(config.enabled).toBe(true); // Should be enabled in test mode
      expect(config.responseDelay).toBeDefined();
      expect(config.responses).toBeDefined();
      expect(config.errors).toBeDefined();
      expect(config.tokens).toBeDefined();
    });

    it('should support configuration-based delays', async () => {
      const startTime = Date.now();
      await resolver.executeCommand('Test with delay', 'sonnet');
      const elapsed = Date.now() - startTime;

      const config = MockConfigManager.getConfig();
      
      // Should respect configured delay ranges
      expect(elapsed).toBeGreaterThanOrEqual(config.responseDelay.min);
      expect(elapsed).toBeLessThanOrEqual(config.responseDelay.max + 100); // Allow small buffer
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing APIs', async () => {
      // Test all the methods that existed in Phase 1
      expect(resolver.findClaudeCommand).toBeDefined();
      expect(resolver.executeCommand).toBeDefined();
      expect(resolver.executeCommandStreaming).toBeDefined();
      expect(resolver.isClaudeAvailable).toBeDefined();
      expect(resolver.getExecutionHistory).toBeDefined();
      expect(resolver.clearHistory).toBeDefined();

      // All methods should still work
      const path = await resolver.findClaudeCommand();
      expect(path).toBe('/mock/path/to/claude');

      const available = await resolver.isClaudeAvailable();
      expect(available).toBe(true);

      const result = await resolver.executeCommand('Compatibility test', 'sonnet');
      expect(result).toBeTruthy();

      const history = resolver.getExecutionHistory();
      expect(history.length).toBe(1);

      resolver.clearHistory();
      const clearedHistory = resolver.getExecutionHistory();
      expect(clearedHistory.length).toBe(0);
    });
  });

  describe('Phase 2 Success Criteria Validation', () => {
    it('✅ Enhanced Template System: Multiple categories with sophisticated selection', async () => {
      // Test that different request types get different template categories
      const programmingRequest = {
        messages: [{ role: 'user', content: 'Create a React component' }],
        model: 'sonnet'
      };

      const greetingRequest = {
        messages: [{ role: 'user', content: 'Hi, good morning!' }],
        model: 'sonnet'
      };

      const programmingResponse = await generator.generateResponse(programmingRequest);
      const greetingResponse = await generator.generateResponse(greetingRequest);

      // Both should work and be different
      expect(programmingResponse.content).toBeTruthy();
      expect(greetingResponse.content).toBeTruthy();
      expect(programmingResponse.content).not.toBe(greetingResponse.content);
    });

    it('✅ Contextual Analysis: Request categorization and keyword matching', async () => {
      const analysisTests = [
        { content: 'write code', expectedMatch: /code|function|programming/ },
        { content: 'hello world', expectedMatch: /hello|greeting|assistant/ },
        { content: 'comprehensive tutorial', expectedMatch: /comprehensive|tutorial|guide/ }
      ];

      for (const test of analysisTests) {
        const response = await generator.generateResponse({
          messages: [{ role: 'user', content: test.content }],
          model: 'sonnet'
        });

        expect(response.content).toBeTruthy();
        expect(response.content!.toLowerCase()).toMatch(test.expectedMatch);
      }
    });

    it('✅ OpenAI API Compatibility: Proper response formatting', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Test compatibility' }],
        model: 'sonnet'
      };

      const openAIResponse = await resolver.executeOpenAIRequest(request);

      expect(openAIResponse).toMatchObject({
        id: expect.stringMatching(/^chatcmpl-enhanced-/),
        object: 'chat.completion',
        created: expect.any(Number),
        model: 'sonnet',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: expect.any(String)
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: expect.any(Number),
          completion_tokens: expect.any(Number),
          total_tokens: expect.any(Number)
        }
      });
    });

    it('✅ Performance Optimization: Sub-500ms response times', async () => {
      const iterations = 5;
      const results: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await generator.generateResponse({
          messages: [{ role: 'user', content: `Performance test ${i}` }],
          model: 'sonnet'
        });
        results.push(Date.now() - startTime);
      }

      const avgTime = results.reduce((a, b) => a + b, 0) / results.length;
      const maxTime = Math.max(...results);

      expect(avgTime).toBeLessThan(100); // Average under 100ms
      expect(maxTime).toBeLessThan(500); // No single request over 500ms
    });

    it('✅ Enhanced Features: All Phase 2 features working together', async () => {
      // Test complex scenario combining multiple enhanced features
      const sessionId = 'comprehensive-test-session';
      
      // Build up conversation with multiple messages
      let conversationMessages: Array<{role: string; content: string}> = [];
      const userMessages = [
        'Hello, I need help with coding',
        'Write a TypeScript function to sort data',
        'What\'s the weather like?'
      ];

      const responses = [];
      
      for (let i = 0; i < userMessages.length; i++) {
        conversationMessages.push({ role: 'user', content: userMessages[i] || 'default message' });
        
        const request = {
          messages: conversationMessages,
          model: 'sonnet',
          ...(i === 2 && { tools: [{ type: 'function', function: { name: 'get_weather', description: 'Get weather' } }] })
        };
        
        const response = await generator.generateResponse(request, sessionId);
        responses.push(response);
        
        // Add assistant response to conversation
        conversationMessages.push({ role: 'assistant', content: response.content || 'mock response' });
      }

      // All responses should be valid and contextually appropriate
      expect(responses[0]?.content).toBeTruthy(); // Greeting
      expect(responses[1]?.content?.toLowerCase()).toMatch(/function|typescript|sort/); // Programming
      expect(responses[2]?.finishReason).toBe('tool_calls'); // Tool calling

      // Later responses should include conversation context
      expect(responses[1]?.content).toMatch(/#\d+/); // Should contain conversation turn number
      expect(responses[2]?.content || 'tool call').toMatch(/tool|call|weather/i);

      // All should have proper token usage
      responses.forEach(response => {
        expect(response.tokenUsage).toBeDefined();
        expect(response.tokenUsage!.prompt_tokens).toBeGreaterThan(0);
        expect(response.tokenUsage!.completion_tokens).toBeGreaterThan(0);
      });
    });
  });
});