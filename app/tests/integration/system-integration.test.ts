/**
 * Phase 15A Integration Test Suite - Complete System Integration
 * Complete end-to-end integration testing of all phases working together
 * Based on Python implementation integration patterns
 */

import request from 'supertest';
import express from 'express';

// Mock all external dependencies before imports
jest.mock('../../src/auth/auth-manager', () => ({
  authManager: {
    isProtected: jest.fn(() => false),
    getApiKey: jest.fn(() => null),
    getCurrentMethod: jest.fn(() => null),
    getAuthStatus: jest.fn(() => Promise.resolve({
      authenticated: false,
      method: null,
      apiKeyProtected: false,
      errors: []
    })),
    getProviders: jest.fn(() => []),
    getClaudeCodeEnvVars: jest.fn(() => ({})),
    detectAuthMethod: jest.fn(() => Promise.resolve({
      method: null,
      valid: false,
      errors: ['No authentication method configured'],
      config: null
    }))
  }
}));

// Create a global session storage that persists across mock instances
const globalMockSessions = new Map();

jest.mock('../../src/session/manager', () => {
  return {
    SessionManager: jest.fn(() => ({
      get_or_create_session: jest.fn((sessionId) => {
        const session = {
          session_id: sessionId || 'test-session',
          messages: [],
          created_at: new Date(),
          last_accessed: new Date(),
          expires_at: new Date(Date.now() + 60 * 60 * 1000),
          touch: jest.fn(),
          add_messages: jest.fn(),
          get_all_messages: jest.fn(() => []),
          is_expired: jest.fn(() => false)
        };
        globalMockSessions.set(sessionId, session);
        return session;
      }),
      list_sessions: jest.fn(() => Array.from(globalMockSessions.values())),
      delete_session: jest.fn((sessionId) => {
        globalMockSessions.delete(sessionId);
      }),
      start_cleanup_task: jest.fn(),
      shutdown: jest.fn(),
      process_messages: jest.fn((messages, sessionId) => [messages, sessionId]),
      _cleanup_expired_sessions: jest.fn(() => 0),
      get_session_count: jest.fn(() => globalMockSessions.size)
    }))
  };
});

jest.mock('../../src/claude/service', () => ({
  claudeService: {
    isConfigured: jest.fn(() => false),
    processMessage: jest.fn(() => Promise.resolve({
      id: 'test-completion',
      object: 'chat.completion',
      choices: [{ message: { role: 'assistant', content: 'Test response' } }]
    }))
  }
}));

jest.mock('../../src/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })),
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

// Mock child_process for any subprocess calls
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

import { createApp } from '../../src/server';
import { authManager } from '../../src/auth/auth-manager';
import { SessionManager } from '../../src/session/manager';
const sessionManager = new SessionManager();
import { claudeService } from '../../src/claude/service';
import { AuthMethod } from '../../src/auth/interfaces';
import { getLogger } from '../../src/utils/logger';

const logger = getLogger('SystemIntegration');

describe('Phase 15A - Complete System Integration Test Suite', () => {
  let server: express.Application;
  let serverInstance: any;
  
  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error'; // Suppress logs during testing
    process.env.PORT = '0'; // Use random available port
    
    // Initialize server with all components
    const mockConfig = {
      DEBUG_MODE: false,
      VERBOSE: false,
      PORT: 8000,
      CORS_ORIGINS: '[\"*\"]',
      MAX_TIMEOUT: 600000,
      API_KEY: undefined
    };
    server = createApp(mockConfig);
  });

  afterAll(async () => {
    if (serverInstance) {
      await new Promise<void>((resolve) => {
        serverInstance.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    // Clear global session storage but keep mock functions
    globalMockSessions.clear();
    
    // Clear environment variables that might affect tests
    delete process.env.API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CLAUDE_CODE_USE_BEDROCK;
    delete process.env.CLAUDE_CODE_USE_VERTEX;
  });

  describe('Complete Application Flow Integration', () => {
    it('should integrate all phases for complete chat completion flow', async () => {
      // Phase 1A: CLI and Server Foundation
      const healthResponse = await request(server)
        .get('/health')
        .expect(200);
      
      expect(healthResponse.body).toMatchObject({
        status: 'healthy',
        service: 'claude-code-openai-wrapper'
      });

      // Phase 12A: Authentication Status Integration
      const authStatusResponse = await request(server)
        .get('/v1/auth/status')
        .expect(200);

      expect(authStatusResponse.body).toMatchObject({
        claude_code_auth: {
          method: expect.any(String),
          status: expect.any(Object)
        },
        server_info: {
          api_key_required: expect.any(Boolean),
          version: '1.0.0'
        }
      });

      // Phase 9A: Models Endpoint Integration
      const modelsResponse = await request(server)
        .get('/v1/models')
        .expect(200);

      expect(modelsResponse.body).toMatchObject({
        object: 'list',
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            object: 'model',
            owned_by: 'anthropic'
          })
        ])
      });

      // Phase 14A: Debug and Compatibility Integration
      const compatibilityRequest = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Test integration' }],
        stream: false
      };

      const compatibilityResponse = await request(server)
        .post('/v1/compatibility')
        .send(compatibilityRequest)
        .expect(200);

      expect(compatibilityResponse.body).toMatchObject({
        compatibility_report: {
          supported_parameters: expect.any(Array),
          unsupported_parameters: expect.any(Array),
          warnings: expect.any(Array),
          suggestions: expect.any(Array)
        },
        claude_code_sdk_options: {
          supported: expect.any(Array),
          custom_headers: expect.any(Array)
        }
      });

      // Phase 14A: Debug Request Validation Integration
      const debugResponse = await request(server)
        .post('/v1/debug/request')
        .send(compatibilityRequest)
        .expect(200);

      expect(debugResponse.body).toMatchObject({
        debug_info: {
          headers: expect.any(Object),
          method: 'POST',
          url: '/v1/debug/request',
          raw_body: expect.any(String),
          parsed_body: compatibilityRequest,
          validation_result: {
            valid: expect.any(Boolean)
          },
          debug_mode_enabled: expect.any(Boolean),
          example_valid_request: expect.any(Object)
        }
      });

      logger.info('Complete application flow integration test passed');
    });

    it('should handle complete session lifecycle with all components', async () => {
      // Create session using Phase 13A functionality
      const createSessionRequest = {
        system_prompt: "You are a helpful assistant for integration testing.",
        max_turns: 5,
        model: "claude-3-sonnet-20240229"
      };

      const createResponse = await request(server)
        .post('/v1/sessions')
        .send(createSessionRequest);

      // Debug the actual response
      console.log('Session creation response status:', createResponse.status);
      console.log('Session creation response body:', createResponse.body);
      console.log('Session creation response text:', createResponse.text);
      
      expect(createResponse.status).toBe(201);

      expect(createResponse.body).toMatchObject({
        id: expect.any(String),
        created_at: expect.any(String),
        model: "claude-3-sonnet-20240229",
        system_prompt: createSessionRequest.system_prompt,
        max_turns: 5,
        message_count: 0,
        status: 'active'
      });

      const sessionId = createResponse.body.id;

      // List sessions
      const listResponse = await request(server)
        .get('/v1/sessions')
        .expect(200);

      expect(listResponse.body).toMatchObject({
        sessions: expect.arrayContaining([
          expect.objectContaining({
            session_id: sessionId
          })
        ]),
        total: expect.any(Number)
      });

      // Get specific session
      const getResponse = await request(server)
        .get(`/v1/sessions/${sessionId}`)
        .expect(200);

      expect(getResponse.body).toMatchObject({
        id: sessionId,
        model: "claude-3-sonnet-20240229",
        status: 'active'
      });

      // Update session
      const updateRequest = {
        system_prompt: "Updated system prompt for integration testing.",
        max_turns: 10
      };

      const updateResponse = await request(server)
        .patch(`/v1/sessions/${sessionId}`)
        .send(updateRequest)
        .expect(200);

      expect(updateResponse.body).toMatchObject({
        id: sessionId,
        system_prompt: updateRequest.system_prompt,
        max_turns: 10
      });

      // Delete session
      await request(server)
        .delete(`/v1/sessions/${sessionId}`)
        .expect(200);

      // Verify session is deleted
      await request(server)
        .get(`/v1/sessions/${sessionId}`)
        .expect(404);

      logger.info('Complete session lifecycle integration test passed');
    });

    it('should integrate middleware and error handling across all endpoints', async () => {
      // Test validation middleware integration
      const invalidChatRequest = {
        // Missing model and messages - should trigger validation
        invalid_field: 'test'
      };

      const chatErrorResponse = await request(server)
        .post('/v1/chat/completions')
        .send(invalidChatRequest)
        .expect(400);

      expect(chatErrorResponse.body).toHaveProperty('error');

      // Test invalid session creation
      const invalidSessionRequest = {
        max_turns: -1, // Invalid negative value
        model: '' // Empty model
      };

      const sessionErrorResponse = await request(server)
        .post('/v1/sessions')
        .send(invalidSessionRequest)
        .expect(400);

      expect(sessionErrorResponse.body).toHaveProperty('error');

      // Test 404 handling for non-existent endpoints
      await request(server)
        .get('/v1/nonexistent')
        .expect(404);

      // Test 404 handling for non-existent session
      await request(server)
        .get('/v1/sessions/nonexistent-session-id')
        .expect(404);

      logger.info('Middleware and error handling integration test passed');
    });

    it('should validate complete CORS and security integration', async () => {
      // Test CORS headers on all endpoints
      const corsEndpoints = [
        '/health',
        '/v1/models',
        '/v1/auth/status',
        '/v1/sessions',
        '/v1/compatibility'
      ];

      for (const endpoint of corsEndpoints) {
        const response = await request(server)
          .options(endpoint)
          .set('Origin', 'http://localhost:3000')
          .expect(204);

        expect(response.headers).toMatchObject({
          'access-control-allow-origin': expect.any(String),
          'access-control-allow-methods': expect.stringContaining('GET'),
          'access-control-allow-headers': expect.any(String)
        });
      }

      // Test security headers
      const healthResponse = await request(server)
        .get('/health')
        .expect(200);

      // Should not expose sensitive information in headers
      expect(healthResponse.headers).not.toHaveProperty('x-powered-by');

      logger.info('CORS and security integration test passed');
    });
  });

  describe('Python Compatibility Integration Validation', () => {
    it('should match Python FastAPI endpoint behavior patterns', async () => {
      // Test OpenAI-compatible chat completion endpoint structure
      const chatRequest = {
        model: 'claude-3-sonnet-20240229',
        messages: [
          { role: 'user', content: 'Test Python compatibility' }
        ],
        stream: false
      };

      // Note: This will likely fail without proper Claude authentication
      // but we're testing the endpoint structure and error handling
      const chatResponse = await request(server)
        .post('/v1/chat/completions')
        .send(chatRequest);

      // Should return either 200 (if auth works) or 401/500 (if auth fails)
      // but NOT 404 (endpoint exists) or 400 (request format is valid)
      expect([200, 401, 500]).toContain(chatResponse.status);

      if (chatResponse.status === 200) {
        // If successful, validate OpenAI-compatible response structure
        expect(chatResponse.body).toMatchObject({
          id: expect.any(String),
          object: 'chat.completion',
          created: expect.any(Number),
          model: expect.any(String),
          choices: expect.any(Array)
        });
      }

      logger.info('Python FastAPI endpoint behavior compatibility validated');
    });

    it('should validate Python-compatible error response formats', async () => {
      // Test error format matches Python FastAPI error structure
      const invalidRequest = {};

      const errorResponse = await request(server)
        .post('/v1/chat/completions')
        .send(invalidRequest)
        .expect(400);

      // Should match Python FastAPI error format
      expect(errorResponse.body).toHaveProperty('error');

      logger.info('Python-compatible error response format validated');
    });

    it('should validate authentication flow matches Python implementation', async () => {
      // Test that auth status endpoint provides Python-compatible information
      const authResponse = await request(server)
        .get('/v1/auth/status')
        .expect(200);

      // Validate structure matches Python main.py:754-769 get_auth_status
      expect(authResponse.body).toMatchObject({
        claude_code_auth: {
          method: expect.any(String),
          status: expect.objectContaining({
            method: expect.any(String),
            valid: expect.any(Boolean)
          }),
          environment_variables: expect.any(Array)
        },
        server_info: {
          api_key_required: expect.any(Boolean),
          api_key_source: expect.any(String),
          version: expect.any(String)
        }
      });

      logger.info('Python authentication flow compatibility validated');
    });
  });

  describe('Performance and Scalability Integration', () => {
    it('should handle concurrent requests across all endpoints', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();

      // Create array of different endpoint requests
      const requests = Array.from({ length: concurrentRequests }, (_, i) => {
        const endpoints = [
          () => request(server).get('/health'),
          () => request(server).get('/v1/models'),
          () => request(server).get('/v1/auth/status'),
          () => request(server).post('/v1/compatibility').send({
            model: 'claude-3-sonnet-20240229',
            messages: [{ role: 'user', content: `Test ${i}` }]
          }),
          () => request(server).post('/v1/debug/request').send({
            model: 'claude-3-sonnet-20240229',
            messages: [{ role: 'user', content: `Debug ${i}` }]
          })
        ];
        
        return endpoints[i % endpoints.length]();
      });

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should complete successfully
      responses.forEach(response => {
        expect([200, 201, 204]).toContain(response.status);
      });

      // Should handle concurrent requests efficiently (under 5 seconds)
      expect(totalTime).toBeLessThan(5000);

      logger.info(`Concurrent requests handled in ${totalTime}ms`);
    });

    it('should maintain consistent performance across components', async () => {
      const performanceTests = [
        { name: 'Health Check', test: () => request(server).get('/health') },
        { name: 'Models List', test: () => request(server).get('/v1/models') },
        { name: 'Auth Status', test: () => request(server).get('/v1/auth/status') },
        { name: 'Sessions List', test: () => request(server).get('/v1/sessions') }
      ];

      for (const { name, test } of performanceTests) {
        const startTime = process.hrtime.bigint();
        await test().expect(200);
        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1000000;

        // Each endpoint should respond within 1000ms
        expect(durationMs).toBeLessThan(1000);
        logger.debug(`${name} completed in ${durationMs.toFixed(2)}ms`);
      }

      logger.info('Performance consistency validated across all components');
    });
  });

  describe('Production Readiness Validation', () => {
    it('should validate all endpoints have proper error handling', async () => {
      const endpoints = [
        { method: 'GET', path: '/health' },
        { method: 'GET', path: '/v1/models' },
        { method: 'GET', path: '/v1/auth/status' },
        { method: 'GET', path: '/v1/sessions' },
        { method: 'POST', path: '/v1/sessions' },
        { method: 'POST', path: '/v1/compatibility' },
        { method: 'POST', path: '/v1/debug/request' },
        { method: 'POST', path: '/v1/chat/completions' }
      ];

      for (const { method, path } of endpoints) {
        let response;
        if (method === 'GET') {
          response = await request(server).get(path);
        } else if (method === 'POST') {
          response = await request(server).post(path).send({});
        } else {
          throw new Error(`Unsupported method: ${method}`);
        }
        
        // Should never return 5xx errors for valid endpoint access
        // (may return 4xx for validation, auth issues)
        expect(response.status).toBeLessThan(500);
      }

      logger.info('Error handling validated for all endpoints');
    });

    it('should validate proper HTTP status codes and response formats', async () => {
      // GET endpoints should return 200
      const getEndpoints = ['/health', '/v1/models', '/v1/auth/status', '/v1/sessions'];
      
      for (const endpoint of getEndpoints) {
        const response = await request(server).get(endpoint).expect(200);
        expect(response.headers['content-type']).toMatch(/application\/json/);
      }

      // POST endpoints should handle validation properly
      const postEndpoints = [
        { endpoint: '/v1/sessions', expectedStatuses: [400, 401, 500] },
        { endpoint: '/v1/compatibility', expectedStatuses: [400, 401, 500] }, 
        { endpoint: '/v1/debug/request', expectedStatuses: [200] }, // Debug endpoint returns 200 with debug info
        { endpoint: '/v1/chat/completions', expectedStatuses: [400, 401, 500] }
      ];

      for (const { endpoint, expectedStatuses } of postEndpoints) {
        // Empty body should trigger validation (400) or auth error (401/500), except debug endpoint
        const response = await request(server).post(endpoint).send({});
        expect(expectedStatuses).toContain(response.status);
      }

      logger.info('HTTP status codes and response formats validated');
    });

    it('should validate system is ready for production deployment', async () => {
      // Verify server starts and responds
      const healthResponse = await request(server).get('/health').expect(200);
      expect(healthResponse.body.status).toBe('healthy');

      // Verify authentication system is functional
      const authResponse = await request(server).get('/v1/auth/status').expect(200);
      expect(authResponse.body.claude_code_auth).toBeDefined();

      // Verify API compatibility layer is functional
      const modelsResponse = await request(server).get('/v1/models').expect(200);
      expect(modelsResponse.body.data).toBeInstanceOf(Array);

      // Verify session management is functional
      const sessionsResponse = await request(server).get('/v1/sessions').expect(200);
      expect(sessionsResponse.body).toHaveProperty('sessions');
      expect(sessionsResponse.body).toHaveProperty('total');

      // Verify debug and compatibility tools are functional
      const compatibilityResponse = await request(server)
        .post('/v1/compatibility')
        .send({
          model: 'claude-3-sonnet-20240229',
          messages: [{ role: 'user', content: 'Production readiness test' }]
        })
        .expect(200);
      expect(compatibilityResponse.body.compatibility_report).toBeDefined();

      logger.info('System validated as ready for production deployment');
    });
  });
});