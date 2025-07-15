/**
 * Unit tests for Enhanced Mock Claude Resolver
 * Tests the enhanced mock resolver functionality with template-based responses
 */

import { MockClaudeResolver } from '../../../src/mocks/core/mock-claude-resolver';

describe('MockClaudeResolver', () => {
  let resolver: MockClaudeResolver;

  beforeEach(() => {
    resolver = MockClaudeResolver.getInstance();
    resolver.clearHistory();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = MockClaudeResolver.getInstance();
      const instance2 = MockClaudeResolver.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('findClaudeCommand', () => {
    it('should return mock Claude path', async () => {
      const path = await resolver.findClaudeCommand();
      expect(path).toBe('/mock/path/to/claude');
    });

    it('should simulate realistic delay', async () => {
      const startTime = Date.now();
      await resolver.findClaudeCommand();
      const elapsed = Date.now() - startTime;
      
      expect(elapsed).toBeGreaterThan(50); // Minimum delay
      expect(elapsed).toBeLessThan(1000); // Reasonable upper bound
    });
  });

  describe('executeCommand', () => {
    it('should execute basic command and return Claude CLI format', async () => {
      const result = await resolver.executeCommand('Hello', 'sonnet');
      
      expect(result).toBeTruthy();
      
      // Should be valid JSON in Claude CLI format
      const parsed = JSON.parse(result);
      expect(parsed.type).toBe('result');
      expect(parsed.subtype).toBe('success');
      expect(parsed.is_error).toBe(false);
      expect(parsed.result).toBeTruthy();
      expect(parsed.session_id).toMatch(/^mock-session-/);
      expect(parsed.usage).toBeDefined();
      expect(parsed.duration_ms).toBeGreaterThan(0);
    });

    it('should handle programming requests with enhanced responses', async () => {
      const result = await resolver.executeCommand(
        'Write a Python function to calculate prime numbers',
        'sonnet'
      );
      
      const parsed = JSON.parse(result);
      expect(parsed.result).toBeTruthy();
      expect(parsed.result.toLowerCase()).toMatch(/function|def|python|typescript|code/);
      expect(parsed.usage.output_tokens).toBeGreaterThan(20);
    });

    it('should support session IDs', async () => {
      const sessionId = 'test-session-123';
      const result = await resolver.executeCommand('Hello', 'sonnet', sessionId);
      
      const parsed = JSON.parse(result);
      expect(parsed.result).toBeTruthy();
      
      // Check execution history
      const history = resolver.getExecutionHistory();
      expect(history.length).toBe(1);
      expect(history[0]?.sessionId).toBe(sessionId);
    });

    it('should vary responses for same input', async () => {
      const result1 = await resolver.executeCommand('Hello', 'sonnet');
      const result2 = await resolver.executeCommand('Hello', 'sonnet');
      
      const parsed1 = JSON.parse(result1);
      const parsed2 = JSON.parse(result2);
      
      // Should have different session IDs
      expect(parsed1.session_id).not.toBe(parsed2.session_id);
    });

    it('should track execution history', async () => {
      await resolver.executeCommand('First message', 'sonnet');
      await resolver.executeCommand('Second message', 'haiku');
      
      const history = resolver.getExecutionHistory();
      expect(history.length).toBe(2);
      expect(history[0]?.prompt).toBe('First message');
      expect(history[0]?.model).toBe('sonnet');
      expect(history[1]?.prompt).toBe('Second message');
      expect(history[1]?.model).toBe('haiku');
    });
  });

  describe('executeCommandStreaming', () => {
    it('should return readable stream', async () => {
      const stream = await resolver.executeCommandStreaming('Tell me a story', 'sonnet');
      
      expect(stream).toBeDefined();
      expect(typeof stream.read).toBe('function');
      expect(typeof stream.on).toBe('function');
    });

    it('should emit streaming chunks', (done) => {
      resolver.executeCommandStreaming('Write a long essay', 'sonnet')
        .then(stream => {
          const chunks: string[] = [];
          
          stream.on('data', (chunk) => {
            chunks.push(chunk.toString());
          });
          
          stream.on('end', () => {
            expect(chunks.length).toBeGreaterThan(0);
            expect(chunks.join('')).toBeTruthy();
            done();
          });
          
          stream.on('error', done);
        })
        .catch(done);
    });
  });

  describe('executeOpenAIRequest', () => {
    it('should handle OpenAI format requests', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'sonnet'
      };
      
      const result = await resolver.executeOpenAIRequest(request);
      
      expect(result).toBeDefined();
      expect(result.id).toMatch(/^chatcmpl-enhanced-/);
      expect(result.object).toBe('chat.completion');
      expect(result.model).toBe('sonnet');
      expect(result.choices).toHaveLength(1);
      expect(result.choices[0].message.role).toBe('assistant');
      expect(result.choices[0].message.content).toBeTruthy();
      expect(result.usage).toBeDefined();
    });

    it('should handle tool calling requests', async () => {
      const request = {
        messages: [{ role: 'user', content: 'What\'s the weather?' }],
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
      
      const result = await resolver.executeOpenAIRequest(request);
      
      if (result.choices[0].finish_reason === 'tool_calls') {
        expect(result.choices[0].message.tool_calls).toBeDefined();
        expect(result.choices[0].message.tool_calls.length).toBeGreaterThan(0);
        expect(result.choices[0].message.tool_calls[0].type).toBe('function');
      }
    });
  });

  describe('executeOpenAIStreamingRequest', () => {
    it('should return OpenAI format streaming response', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Write a tutorial' }],
        model: 'sonnet',
        stream: true
      };
      
      const stream = await resolver.executeOpenAIStreamingRequest(request);
      
      expect(stream).toBeDefined();
      expect(typeof stream.read).toBe('function');
    });

    it('should emit properly formatted SSE chunks', (done) => {
      const request = {
        messages: [{ role: 'user', content: 'Tell me about AI' }],
        model: 'sonnet',
        stream: true
      };
      
      resolver.executeOpenAIStreamingRequest(request)
        .then(stream => {
          const chunks: string[] = [];
          
          stream.on('data', (chunk) => {
            const chunkStr = chunk.toString();
            chunks.push(chunkStr);
            
            // Validate SSE format
            if (chunkStr.startsWith('data: ') && !chunkStr.includes('[DONE]')) {
              const jsonStr = chunkStr.replace('data: ', '').trim();
              const parsed = JSON.parse(jsonStr);
              expect(parsed.object).toBe('chat.completion.chunk');
              expect(parsed.choices).toHaveLength(1);
            }
          });
          
          stream.on('end', () => {
            expect(chunks.length).toBeGreaterThan(0);
            
            // Should end with [DONE]
            const lastChunk = chunks[chunks.length - 1];
            expect(lastChunk).toContain('[DONE]');
            done();
          });
          
          stream.on('error', done);
        })
        .catch(done);
    });
  });

  describe('isClaudeAvailable', () => {
    it('should always return true in mock mode', async () => {
      const available = await resolver.isClaudeAvailable();
      expect(available).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return comprehensive statistics', async () => {
      await resolver.executeCommand('Test 1', 'sonnet');
      await resolver.executeCommand('Test 2', 'haiku');
      
      const stats = resolver.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.executions).toBe(2);
      expect(stats.responseGenerator).toBeDefined();
      expect(stats.config).toBeDefined();
    });
  });

  describe('clearHistory', () => {
    it('should clear execution history', async () => {
      await resolver.executeCommand('Test', 'sonnet');
      
      let history = resolver.getExecutionHistory();
      expect(history.length).toBe(1);
      
      resolver.clearHistory();
      
      history = resolver.getExecutionHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle malformed requests gracefully', async () => {
      const result = await resolver.executeCommand('', 'invalid-model');
      
      expect(result).toBeTruthy();
      const parsed = JSON.parse(result);
      expect(parsed.type).toBe('result');
    });

    it('should validate OpenAI request format', async () => {
      const invalidRequest = {
        messages: [],
        model: 'sonnet'
      };
      
      const result = await resolver.executeOpenAIRequest(invalidRequest);
      expect(result).toBeDefined();
    });
  });

  describe('performance', () => {
    it('should respond within reasonable time limits', async () => {
      const startTime = Date.now();
      await resolver.executeCommand('Performance test', 'sonnet');
      const elapsed = Date.now() - startTime;
      
      expect(elapsed).toBeLessThan(1000); // Should be under 1 second
    });

    it('should handle multiple concurrent requests', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        resolver.executeCommand(`Concurrent request ${i}`, 'sonnet')
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeTruthy();
        const parsed = JSON.parse(result);
        expect(parsed.type).toBe('result');
      });
    });
  });

  describe('response format validation', () => {
    it('should return valid Claude CLI JSON format', async () => {
      const result = await resolver.executeCommand('Validation test', 'sonnet');
      
      const parsed = JSON.parse(result);
      
      // Validate required Claude CLI fields
      expect(parsed).toHaveProperty('type');
      expect(parsed).toHaveProperty('subtype');
      expect(parsed).toHaveProperty('is_error');
      expect(parsed).toHaveProperty('duration_ms');
      expect(parsed).toHaveProperty('result');
      expect(parsed).toHaveProperty('session_id');
      expect(parsed).toHaveProperty('usage');
      
      // Validate usage structure (the Claude CLI format differs from OpenAI format)
      expect(parsed.usage).toHaveProperty('input_tokens');
      expect(parsed.usage).toHaveProperty('output_tokens');
      expect(parsed.usage).toHaveProperty('server_tool_use');
      expect(parsed.usage).toHaveProperty('service_tier');
    });

    it('should maintain consistent response structure', async () => {
      const results = await Promise.all([
        resolver.executeCommand('Test 1', 'sonnet'),
        resolver.executeCommand('Test 2', 'haiku'),
        resolver.executeCommand('Test 3', 'opus')
      ]);
      
      results.forEach(result => {
        const parsed = JSON.parse(result);
        expect(parsed.type).toBe('result');
        expect(parsed.subtype).toBe('success');
        expect(parsed.is_error).toBe(false);
        expect(typeof parsed.duration_ms).toBe('number');
        expect(typeof parsed.result).toBe('string');
        expect(typeof parsed.session_id).toBe('string');
        expect(typeof parsed.usage).toBe('object');
      });
    });
  });
});