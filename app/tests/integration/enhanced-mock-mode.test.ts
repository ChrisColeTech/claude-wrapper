/**
 * Integration tests for Enhanced Mock Mode
 * Tests end-to-end functionality with the enhanced mock system
 */

import request from 'supertest';
import { Server } from 'http';
import { createServer } from '../../src/api/server';
import { MockConfigManager } from '../../src/config/mock-config';

describe('Enhanced Mock Mode Integration', () => {
  let server: Server;
  let app: any;

  beforeAll(async () => {
    // Enable mock mode for testing
    process.env['MOCK_MODE'] = 'true';
    MockConfigManager.resetConfig();
    
    app = createServer();
    server = app.listen(0); // Use random port
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  beforeEach(() => {
    // Reset any state between tests
    MockConfigManager.resetConfig();
  });

  describe('Basic Chat Completions', () => {
    it('should handle simple greeting with enhanced response', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          messages: [{ role: 'user', content: 'Hello! Can you introduce yourself?' }],
          model: 'sonnet'
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('object', 'chat.completion');
      expect(response.body).toHaveProperty('model', 'sonnet');
      expect(response.body).toHaveProperty('choices');
      expect(response.body.choices).toHaveLength(1);
      expect(response.body.choices[0].message.role).toBe('assistant');
      expect(response.body.choices[0].message.content).toBeTruthy();
      expect(response.body.choices[0].finish_reason).toBe('stop');
      expect(response.body).toHaveProperty('usage');
    });

    it('should handle programming requests with code generation', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          messages: [{ role: 'user', content: 'Write a TypeScript function to sort an array' }],
          model: 'sonnet'
        })
        .expect(200);

      expect(response.body.choices[0].message.content).toContain('function');
      expect(response.body.choices[0].message.content.toLowerCase()).toMatch(/typescript|javascript/);
      expect(response.body.usage.completion_tokens).toBeGreaterThan(20);
    });

    it('should handle multiple models correctly', async () => {
      const models = ['sonnet', 'haiku', 'opus'];
      
      for (const model of models) {
        const response = await request(app)
          .post('/v1/chat/completions')
          .send({
            messages: [{ role: 'user', content: 'Test message' }],
            model
          })
          .expect(200);

        expect(response.body.model).toBe(model);
        expect(response.body.choices[0].message.content).toBeTruthy();
      }
    });

    it('should provide realistic token usage', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          messages: [{ role: 'user', content: 'This is a moderately long message to test token calculation accuracy.' }],
          model: 'sonnet'
        })
        .expect(200);

      const usage = response.body.usage;
      expect(usage.prompt_tokens).toBeGreaterThan(10);
      expect(usage.completion_tokens).toBeGreaterThan(5);
      expect(usage.total_tokens).toBe(usage.prompt_tokens + usage.completion_tokens);
    });
  });

  describe('Tool Calling', () => {
    it('should handle tool calling requests', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          messages: [{ role: 'user', content: 'What\'s the weather like in New York?' }],
          model: 'sonnet',
          tools: [
            {
              type: 'function',
              function: {
                name: 'get_weather',
                description: 'Get weather information for a location',
                parameters: {
                  type: 'object',
                  properties: {
                    location: { type: 'string' }
                  }
                }
              }
            }
          ]
        })
        .expect(200);

      if (response.body.choices[0].finish_reason === 'tool_calls') {
        expect(response.body.choices[0].message.tool_calls).toBeDefined();
        expect(response.body.choices[0].message.tool_calls.length).toBeGreaterThan(0);
        expect(response.body.choices[0].message.tool_calls[0].type).toBe('function');
        expect(response.body.choices[0].message.tool_calls[0].function.name).toBeTruthy();
      }
    });

    it('should handle multiple tools', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          messages: [{ role: 'user', content: 'Search for Python tutorials and save the results' }],
          model: 'sonnet',
          tools: [
            {
              type: 'function',
              function: { name: 'web_search', description: 'Search the web' }
            },
            {
              type: 'function',
              function: { name: 'save_file', description: 'Save content to file' }
            }
          ]
        })
        .expect(200);

      // Should handle multi-tool scenarios appropriately
      expect(response.body.choices[0].message).toBeDefined();
    });
  });

  describe('Streaming Responses', () => {
    it('should handle streaming requests with proper SSE format', (done) => {
      const chunks: string[] = [];
      
      request(app)
        .post('/v1/chat/completions')
        .send({
          messages: [{ role: 'user', content: 'Write a comprehensive guide to machine learning' }],
          model: 'sonnet',
          stream: true
        })
        .expect(200)
        .expect('Content-Type', /text\/event-stream/)
        .buffer(false)
        .parse((res, callback) => {
          res.on('data', (chunk) => {
            chunks.push(chunk.toString());
          });
          res.on('end', () => {
            callback(null, chunks.join(''));
          });
        })
        .end((err) => {
          if (err) return done(err);
          
          expect(chunks.length).toBeGreaterThan(0);
          
          // Validate SSE format
          const dataChunks = chunks.filter(chunk => chunk.startsWith('data: '));
          expect(dataChunks.length).toBeGreaterThan(0);
          
          // Should end with [DONE]
          const lastChunk = chunks[chunks.length - 1];
          expect(lastChunk).toContain('[DONE]');
          
          done();
        });
    }, 10000);

    it('should provide streaming responses for long content', (done) => {
      const chunks: string[] = [];
      
      request(app)
        .post('/v1/chat/completions')
        .send({
          messages: [{ role: 'user', content: 'Explain artificial intelligence in great detail' }],
          model: 'sonnet',
          stream: true
        })
        .expect(200)
        .buffer(false)
        .parse((res, callback) => {
          res.on('data', (chunk) => {
            chunks.push(chunk.toString());
          });
          res.on('end', () => {
            callback(null, chunks.join(''));
          });
        })
        .end((err) => {
          if (err) return done(err);
          
          // Should have multiple chunks for long content
          const dataChunks = chunks.filter(chunk => 
            chunk.startsWith('data: ') && !chunk.includes('[DONE]')
          );
          expect(dataChunks.length).toBeGreaterThan(3);
          
          done();
        });
    }, 10000);
  });

  describe('Session Management', () => {
    it('should handle session-based conversations', async () => {
      // First, create a session
      const sessionResponse = await request(app)
        .post('/v1/sessions')
        .send({
          name: 'Test Enhanced Mock Session',
          system_prompt: 'You are a helpful AI assistant in mock mode.'
        })
        .expect(201);

      const sessionId = sessionResponse.body.id;

      // Send message to session
      const messageResponse = await request(app)
        .post(`/v1/sessions/${sessionId}/messages`)
        .send({
          messages: [{ role: 'user', content: 'Hello, this is my first message in this session' }],
          model: 'sonnet'
        })
        .expect(200);

      expect(messageResponse.body.choices[0].message.content).toBeTruthy();

      // Send follow-up message
      const followUpResponse = await request(app)
        .post(`/v1/sessions/${sessionId}/messages`)
        .send({
          messages: [{ role: 'user', content: 'Do you remember my previous message?' }],
          model: 'sonnet'
        })
        .expect(200);

      expect(followUpResponse.body.choices[0].message.content).toBeTruthy();
      
      // Response should indicate this is a follow-up (interaction #2)
      expect(followUpResponse.body.choices[0].message.content).toContain('#2');
    });

    it('should maintain session context across multiple interactions', async () => {
      const sessionResponse = await request(app)
        .post('/v1/sessions')
        .send({
          name: 'Context Test Session',
          system_prompt: 'Remember our conversation context.'
        })
        .expect(201);

      const sessionId = sessionResponse.body.id;

      // Send multiple messages
      for (let i = 1; i <= 3; i++) {
        const response = await request(app)
          .post(`/v1/sessions/${sessionId}/messages`)
          .send({
            messages: [{ role: 'user', content: `Message number ${i}` }],
            model: 'sonnet'
          })
          .expect(200);

        expect(response.body.choices[0].message.content).toContain(`#${i}`);
      }
    });
  });

  describe('API Compatibility', () => {
    it('should return OpenAI-compatible response format', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          messages: [{ role: 'user', content: 'Test OpenAI compatibility' }],
          model: 'sonnet'
        })
        .expect(200);

      // Validate OpenAI API schema compliance
      expect(response.body).toMatchObject({
        id: expect.stringMatching(/^chatcmpl-/),
        object: 'chat.completion',
        created: expect.any(Number),
        model: 'sonnet',
        choices: expect.arrayContaining([
          expect.objectContaining({
            index: 0,
            message: expect.objectContaining({
              role: 'assistant',
              content: expect.any(String)
            }),
            finish_reason: expect.stringMatching(/stop|tool_calls|length/)
          })
        ]),
        usage: expect.objectContaining({
          prompt_tokens: expect.any(Number),
          completion_tokens: expect.any(Number),
          total_tokens: expect.any(Number)
        })
      });
    });

    it('should handle OpenAI parameters correctly', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          messages: [{ role: 'user', content: 'Test with parameters' }],
          model: 'sonnet',
          temperature: 0.7,
          max_tokens: 150,
          top_p: 0.9
        })
        .expect(200);

      expect(response.body.model).toBe('sonnet');
      expect(response.body.choices[0].message.content).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid requests gracefully', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          messages: [],
          model: 'invalid-model'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'sonnet'
          // Missing messages
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Performance', () => {
    it('should respond quickly in mock mode', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          messages: [{ role: 'user', content: 'Performance test message' }],
          model: 'sonnet'
        })
        .expect(200);

      const elapsed = Date.now() - startTime;
      
      expect(response.body.choices[0].message.content).toBeTruthy();
      expect(elapsed).toBeLessThan(2000); // Should be much faster than 2 seconds
    });

    it('should handle concurrent requests efficiently', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/v1/chat/completions')
          .send({
            messages: [{ role: 'user', content: `Concurrent request ${i}` }],
            model: 'sonnet'
          })
          .expect(200)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach((response) => {
        expect(response.body.choices[0].message.content).toBeTruthy();
        expect(response.body.model).toBe('sonnet');
      });
    });
  });

  describe('Models Endpoint', () => {
    it('should list available models in mock mode', async () => {
      const response = await request(app)
        .get('/v1/models')
        .expect(200);

      expect(response.body).toHaveProperty('object', 'list');
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Should include standard Claude models
      const modelIds = response.body.data.map((model: any) => model.id);
      expect(modelIds).toContain('sonnet');
    });
  });

  describe('Health Check', () => {
    it('should report healthy status in mock mode', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('mock_mode', true);
    });
  });
});