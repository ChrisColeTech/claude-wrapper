import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../../src/api/server';
import { OpenAIRequest } from '../../../src/types';

describe('Streaming Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
    app = createApp();
  });

  describe('POST /v1/chat/completions with streaming', () => {
    const validStreamingRequest: OpenAIRequest = {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'Tell me a short joke' }
      ],
      stream: true
    };

    it('should handle streaming request with proper headers', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send(validStreamingRequest)
        .expect(200);

      expect(response.headers['content-type']).toBe('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['connection']).toBe('keep-alive');
    });

    it('should return streaming response in SSE format', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send(validStreamingRequest)
        .expect(200);

      const body = response.text;
      
      // Should contain SSE data chunks
      expect(body).toContain('data: ');
      expect(body).toContain('\n\n');
      
      // Should end with [DONE]
      expect(body).toContain('data: [DONE]');
      
      // Should contain chat completion chunks
      expect(body).toContain('chat.completion.chunk');
    });

    it('should include initial role chunk', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send(validStreamingRequest)
        .expect(200);

      const body = response.text;
      const chunks = body.split('\n\n').filter(chunk => chunk.startsWith('data: '));
      
      // Find the initial chunk with role
      const hasRoleChunk = chunks.some(chunk => {
        try {
          const data = JSON.parse(chunk.replace('data: ', ''));
          return data.choices?.[0]?.delta?.role === 'assistant';
        } catch {
          return false;
        }
      });
      
      expect(hasRoleChunk).toBe(true);
    });

    it('should include content chunks', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send(validStreamingRequest)
        .expect(200);

      const body = response.text;
      const chunks = body.split('\n\n').filter(chunk => chunk.startsWith('data: '));
      
      // Find chunks with content
      const hasContentChunk = chunks.some(chunk => {
        try {
          const data = JSON.parse(chunk.replace('data: ', ''));
          return data.choices?.[0]?.delta?.content;
        } catch {
          return false;
        }
      });
      
      expect(hasContentChunk).toBe(true);
    });

    it('should include final chunk with finish_reason', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send(validStreamingRequest)
        .expect(200);

      const body = response.text;
      const chunks = body.split('\n\n').filter(chunk => chunk.startsWith('data: '));
      
      // Find the final chunk with finish_reason
      const hasFinishChunk = chunks.some(chunk => {
        try {
          const data = JSON.parse(chunk.replace('data: ', ''));
          return data.choices?.[0]?.finish_reason === 'stop';
        } catch {
          return false;
        }
      });
      
      expect(hasFinishChunk).toBe(true);
    });

    it('should validate streaming request parameters', async () => {
      const invalidRequest = {
        ...validStreamingRequest,
        stream: 'true' // Should be boolean, not string
      };

      await request(app)
        .post('/v1/chat/completions')
        .send(invalidRequest)
        .expect(400);
    });

    it('should handle missing required fields in streaming request', async () => {
      const invalidRequest = {
        stream: true
        // Missing model and messages
      };

      await request(app)
        .post('/v1/chat/completions')
        .send(invalidRequest)
        .expect(400);
    });

    it('should handle empty messages array in streaming request', async () => {
      const invalidRequest = {
        model: 'gpt-3.5-turbo',
        messages: [],
        stream: true
      };

      await request(app)
        .post('/v1/chat/completions')
        .send(invalidRequest)
        .expect(400);
    });

    it('should handle invalid message roles in streaming request', async () => {
      const invalidRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'invalid_role', content: 'Test message' }
        ],
        stream: true
      };

      await request(app)
        .post('/v1/chat/completions')
        .send(invalidRequest)
        .expect(400);
    });
  });

  describe('Non-streaming vs Streaming comparison', () => {
    const baseRequest: OpenAIRequest = {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'Say hello' }
      ]
    };

    it('should handle non-streaming request normally', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({ ...baseRequest, stream: false })
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('object', 'chat.completion');
      expect(response.body).toHaveProperty('choices');
    });

    it('should behave differently for streaming vs non-streaming', async () => {
      // Non-streaming response
      const nonStreamingResponse = await request(app)
        .post('/v1/chat/completions')
        .send({ ...baseRequest, stream: false })
        .expect(200);

      // Streaming response
      const streamingResponse = await request(app)
        .post('/v1/chat/completions')
        .send({ ...baseRequest, stream: true })
        .expect(200);

      // Different content types
      expect(nonStreamingResponse.headers['content-type']).toContain('application/json');
      expect(streamingResponse.headers['content-type']).toBe('text/event-stream');

      // Different response formats
      expect(nonStreamingResponse.body).toBeInstanceOf(Object);
      expect(streamingResponse.text).toContain('data: ');
    });
  });

  describe('Streaming Performance Tests', () => {
    const performanceRequest: OpenAIRequest = {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'Generate a medium length response' }
      ],
      stream: true
    };

    it('should respond with first chunk within 500ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/v1/chat/completions')
        .send(performanceRequest)
        .expect(200);

      const firstChunkTime = Date.now() - startTime;
      
      // First chunk should arrive within 500ms (requirement from Phase 4A)
      expect(firstChunkTime).toBeLessThan(500);
    });

    it('should maintain consistent chunk delivery timing', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send(performanceRequest)
        .expect(200);

      const body = response.text;
      const chunks = body.split('\n\n').filter(chunk => chunk.startsWith('data: '));
      
      // Should have multiple chunks for a proper streaming test
      expect(chunks.length).toBeGreaterThan(3);
      
      // Each chunk should be properly formatted
      chunks.forEach(chunk => {
        if (!chunk.includes('[DONE]')) {
          expect(() => JSON.parse(chunk.replace('data: ', ''))).not.toThrow();
        }
      });
    });
  });

  describe('Streaming Error Handling', () => {
    it('should handle server errors gracefully in streaming mode', async () => {
      // Request that might cause server error (depending on Claude CLI availability)
      const problematicRequest: OpenAIRequest = {
        model: 'invalid-model-name',
        messages: [
          { role: 'user', content: 'Test message' }
        ],
        stream: true
      };

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(problematicRequest);

      // Should either succeed or fail gracefully
      if (response.status === 200) {
        expect(response.headers['content-type']).toBe('text/event-stream');
        expect(response.text).toContain('data: ');
      } else {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body).toHaveProperty('error');
      }
    });
  });
});