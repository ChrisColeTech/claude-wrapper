/**
 * Integration tests for end-to-end mock mode functionality
 * Tests the complete mock mode flow from CLI to response
 */

import request from 'supertest';
import { createServer } from '../../src/api/server';

// Mock environment to enable mock mode
jest.mock('../../src/config/env', () => ({
  EnvironmentManager: {
    getConfig: jest.fn(() => ({
      port: 8000,
      timeout: 10000
    })),
    isProduction: jest.fn(() => false),
    isDevelopment: jest.fn(() => true),
    isDebugMode: jest.fn(() => false),
    isDaemonMode: jest.fn(() => false),
    getApiKey: jest.fn(() => undefined),
    getRequiredApiKey: jest.fn(() => false),
    isMockMode: jest.fn(() => true) // Enable mock mode
  }
}));

// Mock the ClaudeResolver to always use mock mode
jest.mock('../../src/core/claude-resolver/claude-resolver', () => {
  const { MockClaudeResolver } = require('../../src/mocks/core/mock-claude-resolver');
  return {
    ClaudeResolver: {
      getInstance: jest.fn(() => new MockClaudeResolver()),
      getInstanceAsync: jest.fn(async () => new MockClaudeResolver()),
      clearInstance: jest.fn()
    }
  };
});

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  }
}));

// Mock temp file manager
jest.mock('../../src/utils/temp-file-manager', () => ({
  TempFileManager: {
    cleanupOnStartup: jest.fn(),
    createTempFile: jest.fn(),
    cleanupTempFile: jest.fn()
  }
}));

describe('Mock Mode Integration Tests', () => {
  let app: any;

  beforeAll(async () => {
    // Enable mock mode for testing
    process.env['MOCK_MODE'] = 'true';
    process.env['NODE_ENV'] = 'test';
    
    // Clear any existing resolver instances
    const ClaudeResolver = require('../../src/core/claude-resolver/claude-resolver').ClaudeResolver;
    ClaudeResolver.clearInstance && ClaudeResolver.clearInstance();
    
    // Wait a bit for environment setup
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Create server instance
    app = createServer();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Chat Completions API', () => {
    test('should handle basic chat completion in mock mode', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'sonnet',
          messages: [
            { role: 'user', content: 'Hello, how are you?' }
          ],
          max_tokens: 100
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('object', 'chat.completion');
      expect(response.body).toHaveProperty('created');
      expect(response.body).toHaveProperty('model');
      expect(response.body).toHaveProperty('choices');
      expect(response.body).toHaveProperty('usage');
      
      expect(response.body.choices).toHaveLength(1);
      expect(response.body.choices[0]).toHaveProperty('message');
      expect(response.body.choices[0].message).toHaveProperty('role', 'assistant');
      expect(response.body.choices[0].message).toHaveProperty('content');
      expect(response.body.choices[0].message.content).toContain('mock');
    });

    test('should handle system prompt in mock mode', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'sonnet',
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'What is the weather like?' }
          ],
          max_tokens: 100
        });

      expect(response.status).toBe(200);
      expect(response.body.choices[0].message.content).toContain('mock');
    });

    test('should handle multi-turn conversation in mock mode', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'sonnet',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
            { role: 'user', content: 'How are you?' }
          ],
          max_tokens: 100
        });

      expect(response.status).toBe(200);
      expect(response.body.choices[0].message.content).toContain('mock');
    });

    test('should return fast response in mock mode', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'sonnet',
          messages: [
            { role: 'user', content: 'This is a test message' }
          ],
          max_tokens: 100
        });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500); // Should be much faster than real Claude CLI
    });

    test('should handle different models in mock mode', async () => {
      const models = ['sonnet', 'opus'];
      
      for (const model of models) {
        const response = await request(app)
          .post('/v1/chat/completions')
          .send({
            model: model,
            messages: [
              { role: 'user', content: 'Test message' }
            ],
            max_tokens: 100
          });

        expect(response.status).toBe(200);
        expect(response.body.model).toBe(model);
      }
    });
  });

  describe('Streaming Chat Completions', () => {
    test('should handle streaming in mock mode', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'sonnet',
          messages: [
            { role: 'user', content: 'Count to 5' }
          ],
          stream: true,
          max_tokens: 100
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/event-stream');
      
      // Parse streaming response
      const chunks = response.text.split('\n').filter(line => line.startsWith('data: '));
      expect(chunks.length).toBeGreaterThan(0);
      
      // Should end with [DONE]
      expect(response.text).toContain('data: [DONE]');
    });

    test('should stream fast in mock mode', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'sonnet',
          messages: [
            { role: 'user', content: 'Tell me a story' }
          ],
          stream: true,
          max_tokens: 100
        });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000); // Should be much faster than real streaming
    });

    test('should handle streaming with system prompt in mock mode', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'sonnet',
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Help me with something' }
          ],
          stream: true,
          max_tokens: 100
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/event-stream');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid request in mock mode', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          // Missing required fields
          max_tokens: 100
        });

      expect(response.status).toBe(400);
    });

    test('should handle empty messages in mock mode', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'sonnet',
          messages: [],
          max_tokens: 100
        });

      expect(response.status).toBe(400);
    });
  });

  describe('API Endpoints', () => {
    test('should return available models in mock mode', async () => {
      const response = await request(app)
        .get('/v1/models');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should return health status in mock mode', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
    });

    test('should handle sessions endpoint in mock mode', async () => {
      const response = await request(app)
        .get('/v1/sessions');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessions');
    });
  });

  describe('Session Management', () => {
    test('should handle session creation in mock mode', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'sonnet',
          messages: [
            { role: 'user', content: 'Hello' }
          ],
          max_tokens: 100,
          session_id: 'test-session-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.choices[0].message.content).toContain('mock');
    });

    test('should handle session continuity in mock mode', async () => {
      const sessionId = 'test-session-continuity';
      
      // First request
      const response1 = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'sonnet',
          messages: [
            { role: 'user', content: 'My name is Alice' }
          ],
          max_tokens: 100,
          session_id: sessionId
        });

      expect(response1.status).toBe(200);

      // Second request with same session
      const response2 = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'sonnet',
          messages: [
            { role: 'user', content: 'What is my name?' }
          ],
          max_tokens: 100,
          session_id: sessionId
        });

      expect(response2.status).toBe(200);
      expect(response2.body.choices[0].message.content).toContain('mock');
    });
  });

  describe('Performance Characteristics', () => {
    test('should handle concurrent requests in mock mode', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        request(app)
          .post('/v1/chat/completions')
          .send({
            model: 'sonnet',
            messages: [
              { role: 'user', content: `Test message ${i}` }
            ],
            max_tokens: 100
          })
      );

      const responses = await Promise.all(promises);
      
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.choices[0].message.content).toContain('mock');
      });
    });

    test('should handle large prompt in mock mode', async () => {
      const largePrompt = 'This is a large prompt. '.repeat(1000);
      
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'sonnet',
          messages: [
            { role: 'user', content: largePrompt }
          ],
          max_tokens: 100
        });

      expect(response.status).toBe(200);
      expect(response.body.choices[0].message.content).toContain('mock');
    });
  });

  describe('Format Compliance', () => {
    test('should return OpenAI-compatible format in mock mode', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'sonnet',
          messages: [
            { role: 'user', content: 'Test' }
          ],
          max_tokens: 100
        });

      expect(response.status).toBe(200);
      
      // Check OpenAI format compliance
      expect(response.body).toMatchObject({
        id: expect.any(String),
        object: 'chat.completion',
        created: expect.any(Number),
        model: 'sonnet',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: expect.any(String)
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: expect.any(Number),
          completion_tokens: expect.any(Number),
          total_tokens: expect.any(Number)
        }
      });
    });
  });
});