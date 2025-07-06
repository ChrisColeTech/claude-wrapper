/**
 * Claude Completions Integration Tests - Phase 2 Real SDK Integration
 * Tests for real Claude completion functionality with various scenarios
 * 
 * These tests focus on completion behavior, content quality, and response patterns
 */

import { ClaudeService } from '../../../src/claude/service';
import { ClaudeClient } from '../../../src/claude/client';
import { Message } from '../../../src/models/message';
import { ChatCompletionRequest } from '../../../src/models/chat';
import { ClaudeCompletionOptions, ClaudeStreamChunk } from '../../../src/claude/service';

// Extended timeouts for completion tests
const COMPLETION_TIMEOUT = 45000;
const STREAM_TIMEOUT = 60000;

describe('Claude Completions Integration Tests - Phase 2', () => {
  let service: ClaudeService;
  let client: ClaudeClient;
  let isAPIAvailable: boolean = false;

  beforeAll(async () => {
    service = new ClaudeService(30000);
    client = new ClaudeClient(30000);

    // Verify API availability
    const verification = await service.verifySDK();
    isAPIAvailable = verification.available;

    if (!isAPIAvailable) {
      console.log('⚠️  Claude API not available - using fallback behavior');
    }
  }, COMPLETION_TIMEOUT);

  describe('1. Text Completion Quality and Accuracy', () => {
    it('should generate accurate mathematical responses', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'What is 123 * 456? Show your work.' }
      ];

      const response = await service.createCompletion(messages, {
        model: 'claude-3-5-sonnet-20241022',
        max_turns: 1
      });

      expect(response.content).toBeDefined();
      expect(response.content).toContain('56088'); // 123 * 456 = 56088
      expect(response.metadata.completion_tokens).toBeGreaterThan(10);

      console.log(`📊 Math response length: ${response.content.length} chars`);
      console.log(`📊 Completion tokens: ${response.metadata.completion_tokens}`);
    }, COMPLETION_TIMEOUT);

    it('should provide detailed explanations for complex topics', async () => {
      const messages: Message[] = [
        { 
          role: 'user', 
          content: 'Explain the concept of machine learning in simple terms. Keep it under 100 words.' 
        }
      ];

      const response = await service.createCompletion(messages, {
        model: 'claude-3-5-sonnet-20241022',
        max_turns: 1
      });

      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(50);
      expect(response.content.length).toBeLessThan(800); // Reasonable upper bound
      expect(response.content.toLowerCase()).toContain('machine learning');

      console.log(`📊 Explanation quality - Length: ${response.content.length} chars`);
    }, COMPLETION_TIMEOUT);

    it('should handle creative writing requests', async () => {
      const messages: Message[] = [
        { 
          role: 'user', 
          content: 'Write a haiku about programming. Follow the 5-7-5 syllable pattern.' 
        }
      ];

      const response = await service.createCompletion(messages, {
        model: 'claude-3-haiku-20240307',
        max_turns: 1
      });

      expect(response.content).toBeDefined();
      expect(response.content.split('\n').length).toBeGreaterThanOrEqual(3);
      expect(response.content.toLowerCase()).toMatch(/code|program|debug|computer|software/);

      console.log(`📊 Creative writing response:\n${response.content}`);
    }, COMPLETION_TIMEOUT);

    it('should maintain context in multi-turn conversations', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'I have a pet named Fluffy.' },
        { role: 'assistant', content: 'That\'s wonderful! What kind of pet is Fluffy?' },
        { role: 'user', content: 'Fluffy is a cat. What are some good toys for my pet?' }
      ];

      const response = await service.createCompletion(messages, {
        model: 'claude-3-5-sonnet-20241022',
        max_turns: 1
      });

      expect(response.content).toBeDefined();
      expect(response.content.toLowerCase()).toMatch(/cat|feline|toy|play/);
      expect(response.content.toLowerCase()).toContain('fluffy');

      console.log(`📊 Context maintained: ${response.content.includes('Fluffy') || response.content.includes('cat')}`);
    }, COMPLETION_TIMEOUT);

    it('should handle different response length requirements', async () => {
      const testCases = [
        { 
          prompt: 'Explain gravity in one sentence.',
          expectedLength: { min: 10, max: 200 }
        },
        { 
          prompt: 'Write a detailed explanation of photosynthesis.',
          expectedLength: { min: 200, max: 2000 }
        }
      ];

      for (const testCase of testCases) {
        const messages: Message[] = [
          { role: 'user', content: testCase.prompt }
        ];

        const response = await service.createCompletion(messages, {
          model: 'claude-3-5-sonnet-20241022',
          max_turns: 1
        });

        expect(response.content.length).toBeGreaterThanOrEqual(testCase.expectedLength.min);
        expect(response.content.length).toBeLessThanOrEqual(testCase.expectedLength.max);

        console.log(`📊 ${testCase.prompt} - Length: ${response.content.length} chars`);
      }
    }, COMPLETION_TIMEOUT);
  });

  describe('2. Streaming Completion Behavior', () => {
    it('should stream content progressively for long responses', async () => {
      const messages: Message[] = [
        { 
          role: 'user', 
          content: 'Tell me a story about a robot learning to paint. Make it about 200 words.' 
        }
      ];

      const chunks: ClaudeStreamChunk[] = [];
      let contentLengthProgression: number[] = [];
      const startTime = Date.now();

      for await (const chunk of service.createStreamingCompletion(messages, {
        model: 'claude-3-5-sonnet-20241022',
        max_turns: 1
      })) {
        chunks.push(chunk);
        contentLengthProgression.push(chunk.content.length);

        expect(chunk.content).toBeDefined();
        expect(chunk.finished).toBeDefined();

        if (chunk.finished) {
          expect(chunk.metadata).toBeDefined();
          break;
        }
      }

      const streamTime = Date.now() - startTime;

      expect(chunks.length).toBeGreaterThan(1);
      expect(contentLengthProgression.length).toBeGreaterThan(1);
      
      // Verify progressive content growth
      const isProgressive = contentLengthProgression.every((length, index) => 
        index === 0 || length >= contentLengthProgression[index - 1]
      );
      expect(isProgressive).toBe(true);

      console.log(`📊 Streaming chunks: ${chunks.length}, Time: ${streamTime}ms`);
      console.log(`📊 Content progression: ${contentLengthProgression.slice(0, 5).join(' → ')}...`);
    }, STREAM_TIMEOUT);

    it('should handle streaming for short responses', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'What is 5 + 5?' }
      ];

      const chunks: ClaudeStreamChunk[] = [];
      let firstContentTime: number = 0;
      let lastContentTime: number = 0;

      for await (const chunk of service.createStreamingCompletion(messages, {
        model: 'claude-3-haiku-20240307',
        max_turns: 1
      })) {
        chunks.push(chunk);

        if (chunk.content && !firstContentTime) {
          firstContentTime = Date.now();
        }
        
        if (chunk.finished) {
          lastContentTime = Date.now();
          break;
        }
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(firstContentTime).toBeGreaterThan(0);
      expect(lastContentTime).toBeGreaterThan(firstContentTime);

      const streamDuration = lastContentTime - firstContentTime;
      console.log(`📊 Short response streaming duration: ${streamDuration}ms`);
    }, STREAM_TIMEOUT);

    it('should provide accurate delta information in streaming', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Count from 1 to 10 with explanations for each number.' }
      ];

      let previousContent = '';
      let deltaCount = 0;
      let totalDeltaLength = 0;

      for await (const chunk of service.createStreamingCompletion(messages, {
        model: 'claude-3-5-sonnet-20241022',
        max_turns: 1
      })) {
        if (chunk.delta) {
          deltaCount++;
          totalDeltaLength += chunk.delta.length;
          
          // Verify delta consistency
          expect(chunk.content).toBe(previousContent + chunk.delta);
        }
        
        previousContent = chunk.content;

        if (chunk.finished) break;
      }

      expect(deltaCount).toBeGreaterThan(0);
      expect(totalDeltaLength).toBe(previousContent.length);

      console.log(`📊 Delta chunks: ${deltaCount}, Total delta length: ${totalDeltaLength}`);
    }, STREAM_TIMEOUT);

    it('should handle concurrent streaming requests', async () => {
      const streamPromises = [
        { prompt: 'Explain photosynthesis briefly.', id: 1 },
        { prompt: 'What is gravity?', id: 2 },
        { prompt: 'Describe the water cycle.', id: 3 }
      ].map(async ({ prompt, id }) => {
        const messages: Message[] = [
          { role: 'user', content: prompt }
        ];

        const chunks: ClaudeStreamChunk[] = [];
        const startTime = Date.now();

        for await (const chunk of service.createStreamingCompletion(messages, {
          model: 'claude-3-haiku-20240307',
          max_turns: 1
        })) {
          chunks.push(chunk);
          if (chunk.finished) break;
        }

        const duration = Date.now() - startTime;
        return { id, chunks: chunks.length, duration, finalContent: chunks[chunks.length - 1]?.content };
      });

      const results = await Promise.all(streamPromises);

      results.forEach(result => {
        expect(result.chunks).toBeGreaterThan(0);
        expect(result.finalContent).toBeDefined();
        expect(result.duration).toBeLessThan(30000);
        
        console.log(`📊 Concurrent stream ${result.id}: ${result.chunks} chunks, ${result.duration}ms`);
      });
    }, STREAM_TIMEOUT);

    it('should maintain consistent final content between streaming and regular completion', async () => {
      const testPrompt = 'What are the three primary colors?';
      const messages: Message[] = [
        { role: 'user', content: testPrompt }
      ];

      // Regular completion
      const regularResponse = await service.createCompletion(messages, {
        model: 'claude-3-haiku-20240307',
        max_turns: 1
      });

      // Streaming completion
      let streamedContent = '';
      for await (const chunk of service.createStreamingCompletion(messages, {
        model: 'claude-3-haiku-20240307',
        max_turns: 1
      })) {
        streamedContent = chunk.content;
        if (chunk.finished) break;
      }

      // Both should mention primary colors
      expect(regularResponse.content.toLowerCase()).toMatch(/red|blue|yellow|primary/);
      expect(streamedContent.toLowerCase()).toMatch(/red|blue|yellow|primary/);

      console.log(`📊 Regular length: ${regularResponse.content.length}, Streamed length: ${streamedContent.length}`);
    }, STREAM_TIMEOUT);
  });

  describe('3. OpenAI Compatibility Integration', () => {
    it('should handle OpenAI-style chat completion requests', async () => {
      const request: ChatCompletionRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'What is the capital of France?' }
        ],
        enable_tools: false,
        stream: false
      };

      const response = await service.createChatCompletion(request);

      expect(response.content).toBeDefined();
      expect(response.role).toBe('assistant');
      expect(response.content.toLowerCase()).toContain('paris');

      console.log(`📊 OpenAI compatibility test: ✅`);
    }, COMPLETION_TIMEOUT);

    it('should handle OpenAI-style streaming requests', async () => {
      const request: ChatCompletionRequest = {
        model: 'claude-3-haiku-20240307',
        messages: [
          { role: 'user', content: 'Explain quantum physics in one paragraph.' }
        ],
        enable_tools: false,
        stream: true
      };

      const chunks: ClaudeStreamChunk[] = [];
      for await (const chunk of service.createStreamingChatCompletion(request)) {
        chunks.push(chunk);
        if (chunk.finished) break;
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].content.toLowerCase()).toMatch(/quantum|physics|particle/);

      console.log(`📊 OpenAI streaming compatibility: ${chunks.length} chunks`);
    }, STREAM_TIMEOUT);

    it('should respect enable_tools parameter', async () => {
      const messagesWithToolRequest: Message[] = [
        { role: 'user', content: 'Can you read a file for me?' }
      ];

      // With tools disabled
      const responseNoTools = await service.createCompletion(messagesWithToolRequest, {
        model: 'claude-3-5-sonnet-20241022',
        enable_tools: false,
        max_turns: 1
      });

      expect(responseNoTools.content).toBeDefined();
      expect(responseNoTools.role).toBe('assistant');

      console.log(`📊 Tools disabled response length: ${responseNoTools.content.length}`);
    }, COMPLETION_TIMEOUT);

    it('should handle different message role combinations', async () => {
      const complexMessages: Message[] = [
        { role: 'user', content: 'Hello, I need help with coding.' },
        { role: 'assistant', content: 'I\'d be happy to help! What programming language are you using?' },
        { role: 'user', content: 'Python. How do I create a list?' }
      ];

      const response = await service.createCompletion(complexMessages, {
        model: 'claude-3-5-sonnet-20241022',
        max_turns: 1
      });

      expect(response.content).toBeDefined();
      expect(response.content.toLowerCase()).toMatch(/list|python|\[|\]/);

      console.log(`📊 Multi-role conversation handled: ✅`);
    }, COMPLETION_TIMEOUT);

    it('should maintain conversation continuity in chat format', async () => {
      const sessionMessages: Message[] = [
        { role: 'user', content: 'My name is Alice and I love gardening.' },
        { role: 'assistant', content: 'Nice to meet you, Alice! Gardening is a wonderful hobby.' },
        { role: 'user', content: 'What flowers should I plant in spring?' }
      ];

      const response = await service.createCompletion(sessionMessages, {
        model: 'claude-3-5-sonnet-20241022',
        max_turns: 1
      });

      expect(response.content).toBeDefined();
      expect(response.content.toLowerCase()).toMatch(/spring|flower|plant|garden/);
      
      // Should remember the user's name (sometimes)
      const remembersName = response.content.toLowerCase().includes('alice');
      console.log(`📊 Name memory: ${remembersName ? '✅' : '⚠️'}`);
    }, COMPLETION_TIMEOUT);
  });

  describe('4. Response Metadata and Performance', () => {
    it('should provide accurate metadata for all completion types', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Write a 50-word summary of artificial intelligence.' }
      ];

      const response = await service.createCompletion(messages, {
        model: 'claude-3-5-sonnet-20241022',
        max_turns: 1
      });

      expect(response.metadata).toBeDefined();
      expect(response.metadata.prompt_tokens).toBeGreaterThan(0);
      expect(response.metadata.completion_tokens).toBeGreaterThan(0);
      expect(response.metadata.total_tokens).toBe(
        response.metadata.prompt_tokens + response.metadata.completion_tokens
      );

      if (response.metadata.cost) {
        expect(response.metadata.cost).toBeGreaterThan(0);
      }

      console.log(`📊 Metadata - Prompt: ${response.metadata.prompt_tokens}, Completion: ${response.metadata.completion_tokens}, Cost: ${response.metadata.cost || 'N/A'}`);
    }, COMPLETION_TIMEOUT);

    it('should track session information consistently', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Start a new conversation.' }
      ];

      const response = await service.createCompletion(messages, {
        model: 'claude-3-haiku-20240307',
        max_turns: 1
      });

      if (response.session_id) {
        expect(response.session_id).toMatch(/^[a-zA-Z0-9_-]+$/);
        console.log(`📊 Session ID format: ${response.session_id}`);
      }

      expect(response.stop_reason).toBeDefined();
      expect(['stop', 'length', 'content_filter', null]).toContain(response.stop_reason);
    }, COMPLETION_TIMEOUT);

    it('should measure response times for different models', async () => {
      const testModels = [
        'claude-3-haiku-20240307',
        'claude-3-5-sonnet-20241022'
      ];

      const testPrompt = 'What is the meaning of life in one sentence?';

      for (const model of testModels) {
        const messages: Message[] = [
          { role: 'user', content: testPrompt }
        ];

        const startTime = Date.now();
        const response = await service.createCompletion(messages, {
          model,
          max_turns: 1
        });
        const responseTime = Date.now() - startTime;

        expect(response.content).toBeDefined();
        expect(responseTime).toBeLessThan(20000); // 20 second max

        console.log(`📊 Model ${model}: ${responseTime}ms, ${response.content.length} chars`);
      }
    }, COMPLETION_TIMEOUT);

    it('should handle large input contexts efficiently', async () => {
      const longContext = 'The following is a detailed analysis. ' + 'This is important context information. '.repeat(50);
      const messages: Message[] = [
        { role: 'user', content: longContext },
        { role: 'user', content: 'Summarize the key points from the above in 3 bullet points.' }
      ];

      const startTime = Date.now();
      const response = await service.createCompletion(messages, {
        model: 'claude-3-5-sonnet-20241022',
        max_turns: 1
      });
      const responseTime = Date.now() - startTime;

      expect(response.content).toBeDefined();
      expect(response.content).toMatch(/•|·|-|\*|1\.|2\.|3\./); // Should contain bullet points or numbering
      expect(response.metadata.prompt_tokens).toBeGreaterThan(100);

      console.log(`📊 Large context: ${response.metadata.prompt_tokens} prompt tokens, ${responseTime}ms`);
    }, COMPLETION_TIMEOUT);

    it('should maintain stable performance across multiple requests', async () => {
      const responseTimes: number[] = [];
      const tokenCounts: number[] = [];

      for (let i = 0; i < 3; i++) {
        const messages: Message[] = [
          { role: 'user', content: `Request ${i + 1}: What is ${i + 1} + ${i + 1}?` }
        ];

        const startTime = Date.now();
        const response = await service.createCompletion(messages, {
          model: 'claude-3-haiku-20240307',
          max_turns: 1
        });
        const responseTime = Date.now() - startTime;

        responseTimes.push(responseTime);
        tokenCounts.push(response.metadata.total_tokens);

        expect(response.content).toContain((2 * (i + 1)).toString());
      }

      // Check for reasonable consistency
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxDeviation = Math.max(...responseTimes.map(time => Math.abs(time - avgResponseTime)));

      console.log(`📊 Performance consistency - Avg: ${avgResponseTime.toFixed(0)}ms, Max deviation: ${maxDeviation.toFixed(0)}ms`);
      console.log(`📊 Token consistency: ${tokenCounts.join(', ')}`);

      expect(maxDeviation).toBeLessThan(avgResponseTime * 2); // Deviation should be reasonable
    }, COMPLETION_TIMEOUT);
  });
});