import request from 'supertest';
import { Express } from 'express';
import { createServer } from '../../../src/api/server';
import { shutdownAllStreamingManagers } from '../../../src/streaming/manager';

// Mock the CoreWrapper to avoid actual Claude CLI calls
jest.mock('../../../src/core/wrapper', () => {
  const mockHandleChatCompletion = jest.fn();
  return {
    CoreWrapper: jest.fn().mockImplementation(() => ({
      handleChatCompletion: mockHandleChatCompletion
    })),
    mockHandleChatCompletion
  };
});

const { mockHandleChatCompletion } = jest.requireMock('../../../src/core/wrapper');

describe('Streaming Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    mockHandleChatCompletion.mockClear();
    app = createServer();
  });

  afterEach(() => {
    jest.clearAllMocks();
    
    // Clean up all streaming managers to prevent timeout leaks
    shutdownAllStreamingManagers();
  });

  describe('POST /v1/chat/completions validation', () => {
    it('should reject invalid streaming requests with empty messages', async () => {
      const invalidRequest = {
        model: 'sonnet',
        messages: [],
        stream: true
      };

      await request(app)
        .post('/v1/chat/completions')
        .send(invalidRequest)
        .expect(400);
    });

    it('should handle non-streaming requests', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'sonnet',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      };

      mockHandleChatCompletion.mockResolvedValue(mockResponse);

      const nonStreamingRequest = {
        model: 'sonnet',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false
      };

      await request(app)
        .post('/v1/chat/completions')
        .send(nonStreamingRequest)
        .expect(200);

      expect(mockHandleChatCompletion).toHaveBeenCalledWith(nonStreamingRequest);
    });

    it('should validate required fields', async () => {
      const invalidRequest = {
        stream: true
        // Missing model and messages
      };

      await request(app)
        .post('/v1/chat/completions')
        .send(invalidRequest)
        .expect(400);
    });

    it('should validate message roles', async () => {
      const invalidRequest = {
        model: 'sonnet',
        messages: [{ role: 'invalid_role', content: 'Test' }],
        stream: true
      };

      await request(app)
        .post('/v1/chat/completions')
        .send(invalidRequest)
        .expect(400);
    });

    it('should validate stream parameter type', async () => {
      const invalidRequest = {
        model: 'sonnet',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: 'true' // Should be boolean
      };

      await request(app)
        .post('/v1/chat/completions')
        .send(invalidRequest)
        .expect(400);
    });
  });

  describe('Models endpoint', () => {
    it('should return available models', async () => {
      const response = await request(app)
        .get('/v1/models')
        .expect(200);

      expect(response.body).toHaveProperty('object', 'list');
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Health endpoint', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'claude-wrapper');
    });
  });
});