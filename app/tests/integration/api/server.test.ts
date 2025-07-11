import request from 'supertest';
import { createServer } from '../../../src/api/server';
import { shutdownAllStreamingManagers } from '../../../src/streaming/manager';

// Mock the CoreWrapper to avoid actual Claude CLI calls in tests
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

describe('API Integration Tests', () => {
  let app: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockHandleChatCompletion.mockClear();
    
    // The mock is already set up at module level
    
    app = createServer();
  });

  afterEach(() => {
    jest.clearAllMocks();
    
    // Clean up all streaming managers to prevent timeout leaks
    shutdownAllStreamingManagers();
  });

  describe('Health endpoint', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        service: 'claude-wrapper',
        version: expect.any(String),
        description: expect.any(String),
        timestamp: expect.any(String)
      });
    });
  });

  describe('Models endpoint', () => {
    it('should return available models', async () => {
      const response = await request(app)
        .get('/v1/models')
        .expect(200);

      expect(response.body).toEqual({
        object: 'list',
        data: expect.arrayContaining([
          expect.objectContaining({ 
            id: 'sonnet', 
            object: 'model', 
            owned_by: 'anthropic' 
          }),
          expect.objectContaining({ 
            id: 'opus', 
            object: 'model', 
            owned_by: 'anthropic' 
          })
        ])
      });
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Chat completions endpoint', () => {
    it('should handle valid chat completion request', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion' as const,
        created: 1677652288,
        model: 'sonnet',
        choices: [{
          index: 0,
          message: { role: 'assistant' as const, content: 'Hello! How can I help you today?' },
          finish_reason: 'stop' as const
        }],
        usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 }
      };

      mockHandleChatCompletion.mockResolvedValue(mockResponse);

      const requestBody = {
        model: 'sonnet',
        messages: [
          { role: 'user', content: 'Hello, how are you?' }
        ]
      };

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual(mockResponse);
      expect(mockHandleChatCompletion).toHaveBeenCalledWith(requestBody);
    });

    it('should reject request with missing model', async () => {
      const requestBody = {
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(requestBody)
        .expect(400);

      expect(response.body).toEqual({
        error: {
          message: 'Invalid request format: model and messages are required',
          type: 'api_error',
          code: 'INVALID_REQUEST'
        }
      });
    });

    it('should reject request with missing messages', async () => {
      const requestBody = {
        model: 'sonnet'
      };

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(requestBody)
        .expect(400);

      expect(response.body).toEqual({
        error: {
          message: 'Invalid request format: model and messages are required',
          type: 'api_error',
          code: 'INVALID_REQUEST'
        }
      });
    });

    it('should reject request with empty messages array', async () => {
      const requestBody = {
        model: 'sonnet',
        messages: []
      };

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(requestBody)
        .expect(400);

      expect(response.body).toEqual({
        error: {
          message: 'Messages array cannot be empty',
          type: 'api_error',
          code: 'INVALID_REQUEST'
        }
      });
    });

    it('should reject request with invalid message role', async () => {
      const requestBody = {
        model: 'sonnet',
        messages: [
          { role: 'invalid_role', content: 'Hello' }
        ]
      };

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(requestBody)
        .expect(400);

      expect(response.body).toEqual({
        error: {
          message: 'Invalid message role. Must be one of: system, user, assistant, tool',
          type: 'api_error',
          code: 'INVALID_REQUEST'
        }
      });
    });

    it('should reject request with missing message content', async () => {
      const requestBody = {
        model: 'sonnet',
        messages: [
          { role: 'user' }
        ]
      };

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(requestBody)
        .expect(400);

      expect(response.body).toEqual({
        error: {
          message: 'Message content is required',
          type: 'api_error',
          code: 'INVALID_REQUEST'
        }
      });
    });

    it('should handle internal errors gracefully', async () => {
      mockHandleChatCompletion.mockRejectedValue(new Error('Internal processing error'));

      const requestBody = {
        model: 'sonnet',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(requestBody)
        .expect(500);

      expect(response.body).toEqual({
        error: {
          message: 'Internal server error',
          type: 'api_error',
          code: 'internal_error'
        }
      });
    });

    it('should handle complex message arrays correctly', async () => {
      const mockResponse = {
        id: 'chatcmpl-456',
        object: 'chat.completion' as const,
        created: 1677652300,
        model: 'sonnet',
        choices: [{
          index: 0,
          message: { role: 'assistant' as const, content: 'I understand the context.' },
          finish_reason: 'stop' as const
        }],
        usage: { prompt_tokens: 25, completion_tokens: 10, total_tokens: 35 }
      };

      mockHandleChatCompletion.mockResolvedValue(mockResponse);

      const requestBody = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello!' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' }
        ]
      };

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual(mockResponse);
      expect(mockHandleChatCompletion).toHaveBeenCalledWith(requestBody);
    });
  });

  describe('Error handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle non-existent endpoints', async () => {
      await request(app)
        .get('/v1/nonexistent')
        .expect(404);
    });
  });
});