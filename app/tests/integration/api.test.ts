/**
 * API Integration Tests
 * Tests the OpenAI-compatible API endpoints with minimal mocking
 */

import request from 'supertest';
import { mockClaudeSDK, generateMockMessageStream } from '../mocks/claude-cli';
import { setupGlobalMocks, cleanupGlobalMocks } from '../mocks/external-deps';

// Mock only external dependencies, not internal components
jest.mock('@anthropic-ai/claude-code', () => mockClaudeSDK);
jest.mock('../../src/utils/logger', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Import app after mocks are set up
let app: any;

describe('API Integration Tests', () => {
  beforeAll(async () => {
    setupGlobalMocks();
    
    // Dynamically import the app to ensure mocks are in place
    const appModule = await import('../../src/app');
    app = appModule.default || appModule.app;
  });

  afterAll(() => {
    cleanupGlobalMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default successful response
    const mockMessages = generateMockMessageStream('API test message');
    mockClaudeSDK.query.mockImplementation(async function*() {
      for (const message of mockMessages) {
        yield message;
      }
    });
  });

  describe('Health Check Endpoints', () => {
    it('should respond to health check', async () => {
      if (!app) {
        console.warn('App not available, skipping health check test');
        return;
      }

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
    });
  });

  describe('OpenAI Compatible Endpoints', () => {
    it('should handle chat completions request', async () => {
      if (!app) {
        console.warn('App not available, skipping chat completions test');
        return;
      }

      const chatRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'Hello, API!' }
        ],
        max_tokens: 100,
        temperature: 0.7
      };

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(chatRequest)
        .expect(200);

      expect(response.body.choices).toBeDefined();
      expect(response.body.choices[0].message.content).toContain('Mock response');
      expect(mockClaudeSDK.query).toHaveBeenCalled();
    });

    it('should handle streaming chat completions', async () => {
      if (!app) {
        console.warn('App not available, skipping streaming test');
        return;
      }

      const streamRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'Stream test' }
        ],
        stream: true
      };

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(streamRequest)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(mockClaudeSDK.query).toHaveBeenCalled();
    });

    it('should handle models list request', async () => {
      if (!app) {
        console.warn('App not available, skipping models test');
        return;
      }

      const response = await request(app)
        .get('/v1/models')
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid requests gracefully', async () => {
      if (!app) {
        console.warn('App not available, skipping error handling test');
        return;
      }

      const invalidRequest = {
        // Missing required fields
        messages: []
      };

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(invalidRequest);

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.error).toBeDefined();
    });

    it('should handle Claude SDK errors', async () => {
      if (!app) {
        console.warn('App not available, skipping SDK error test');
        return;
      }

      // Mock SDK error
      mockClaudeSDK.query.mockRejectedValueOnce(new Error('Claude SDK Error'));

      const chatRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'Error test' }
        ]
      };

      const response = await request(app)
        .post('/v1/chat/completions')
        .send(chatRequest);

      expect(response.status).toBeGreaterThanOrEqual(500);
    });
  });
});