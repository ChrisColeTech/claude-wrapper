/**
 * Phase 15A End-to-End Test Suite - Complete Workflow Scenarios
 * Comprehensive E2E testing that simulates real user workflows
 * Based on Python implementation end-to-end patterns
 */

import request from 'supertest';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';
import { getLogger } from '../../../src/utils/logger';

const logger = getLogger('E2EWorkflow');

describe('Phase 15A - End-to-End Complete Workflow Test Suite', () => {
  let serverProcess: ChildProcess | null = null;
  let serverUrl: string;
  let serverPort: number;

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    
    // Find available port
    serverPort = await findAvailablePort();
    serverUrl = `http://localhost:${serverPort}`;
    
    // Start server process for true E2E testing
    await startServerProcess();
    
    // Wait for server to be ready
    await waitForServerReady();
  });

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

  describe('Complete User Workflow Scenarios', () => {
    it('should complete full OpenAI API migration workflow', async () => {
      logger.info('Starting OpenAI API migration workflow test');

      // Step 1: User checks if their existing OpenAI code is compatible
      const existingOpenAIRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello, how are you?' }
        ],
        temperature: 0.7,
        max_tokens: 150,
        top_p: 1.0,
        frequency_penalty: 0,
        presence_penalty: 0
      };

      const compatibilityResponse = await request(serverUrl)
        .post('/v1/compatibility')
        .send(existingOpenAIRequest)
        .expect(200);

      expect(compatibilityResponse.body).toMatchObject({
        compatibility_report: {
          supported_parameters: expect.arrayContaining(['model', 'messages']),
          unsupported_parameters: expect.arrayContaining(['temperature', 'max_tokens']),
          warnings: expect.any(Array),
          suggestions: expect.any(Array)
        }
      });

      // Step 2: User adapts their request based on compatibility report
      const adaptedRequest = {
        model: 'claude-3-sonnet-20240229',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello, how are you?' }
        ],
        stream: false
      };

      // Step 3: User creates a session for better conversation management
      const sessionRequest = {
        system_prompt: 'You are a helpful assistant.',
        max_turns: 10,
        model: 'claude-3-sonnet-20240229'
      };

      const sessionResponse = await request(serverUrl)
        .post('/v1/sessions')
        .send(sessionRequest)
        .expect(201);

      const sessionId = sessionResponse.body.id;

      // Step 4: User conducts conversation using session
      const chatResponse = await request(serverUrl)
        .post('/v1/chat/completions')
        .send({
          ...adaptedRequest,
          session_id: sessionId
        });

      // Should either succeed (200) or fail with auth error (not 400/404)
      expect([200, 401, 500]).toContain(chatResponse.status);

      // Step 5: User manages their session
      const sessionListResponse = await request(serverUrl)
        .get('/v1/sessions')
        .expect(200);

      expect(sessionListResponse.body.data).toContainEqual(
        expect.objectContaining({ id: sessionId })
      );

      // Step 6: User cleans up
      await request(serverUrl)
        .delete(`/v1/sessions/${sessionId}`)
        .expect(204);

      logger.info('OpenAI API migration workflow completed successfully');
    });

    it('should complete development debugging workflow', async () => {
      logger.info('Starting development debugging workflow test');

      // Step 1: Developer makes a mistake in their request
      const buggyRequest = {
        model: '', // Empty model
        messages: [], // Empty messages
        invalid_param: 'should_not_exist',
        temperature: 'not_a_number' // Wrong type
      };

      // Step 2: Developer uses debug endpoint to understand what's wrong
      const debugResponse = await request(serverUrl)
        .post('/v1/debug/request')
        .send(buggyRequest)
        .expect(200);

      expect(debugResponse.body.debug_info).toMatchObject({
        method: 'POST',
        url: '/v1/debug/request',
        parsed_body: buggyRequest,
        validation_result: {
          valid: false,
          errors: expect.any(Array)
        },
        example_valid_request: expect.any(Object)
      });

      // Step 3: Developer fixes their request based on debug info
      const fixedRequest = {
        model: 'claude-3-sonnet-20240229',
        messages: [
          { role: 'user', content: 'Now this should work!' }
        ],
        stream: false
      };

      // Step 4: Developer validates the fix works
      const validationResponse = await request(serverUrl)
        .post('/v1/debug/request')
        .send(fixedRequest)
        .expect(200);

      expect(validationResponse.body.debug_info.validation_result.valid).toBe(true);

      // Step 5: Developer tries the actual chat endpoint
      const actualChatResponse = await request(serverUrl)
        .post('/v1/chat/completions')
        .send(fixedRequest);

      // Should not be 400 (bad request) since request format is now valid
      expect(actualChatResponse.status).not.toBe(400);

      logger.info('Development debugging workflow completed successfully');
    });

    it('should complete production monitoring workflow', async () => {
      logger.info('Starting production monitoring workflow test');

      // Step 1: Monitor service health
      const healthResponse = await request(serverUrl)
        .get('/health')
        .expect(200);

      expect(healthResponse.body).toMatchObject({
        status: 'healthy',
        service: 'claude-wrapper',
        timestamp: expect.any(String)
      });

      // Step 2: Check authentication status
      const authResponse = await request(serverUrl)
        .get('/v1/auth/status')
        .expect(200);

      expect(authResponse.body).toMatchObject({
        claude_code_auth: {
          method: expect.any(String),
          status: expect.any(Object)
        },
        server_info: {
          version: '1.0.0'
        }
      });

      // Step 3: Verify available models
      const modelsResponse = await request(serverUrl)
        .get('/v1/models')
        .expect(200);

      expect(modelsResponse.body).toMatchObject({
        object: 'list',
        data: expect.any(Array)
      });

      // Step 4: Test API responsiveness under load
      const concurrentRequests = 5;
      const loadTestPromises = Array.from({ length: concurrentRequests }, (_, i) =>
        request(serverUrl)
          .get('/health')
          .expect(200)
      );

      const startTime = Date.now();
      await Promise.all(loadTestPromises);
      const endTime = Date.now();

      // Should handle concurrent requests quickly
      expect(endTime - startTime).toBeLessThan(2000);

      logger.info('Production monitoring workflow completed successfully');
    });

    it('should complete error recovery workflow', async () => {
      logger.info('Starting error recovery workflow test');

      // Step 1: Simulate various error conditions
      const errorScenarios = [
        {
          name: 'Missing required fields',
          request: {},
          expectedStatus: 400
        },
        {
          name: 'Invalid model name',
          request: { 
            model: 'invalid-model-name',
            messages: [{ role: 'user', content: 'test' }]
          },
          expectedStatus: [400, 401, 500] // Depends on auth/validation
        },
        {
          name: 'Malformed message structure',
          request: {
            model: 'claude-3-sonnet-20240229',
            messages: [{ invalid: 'structure' }]
          },
          expectedStatus: 400
        }
      ];

      for (const scenario of errorScenarios) {
        const response = await request(serverUrl)
          .post('/v1/chat/completions')
          .send(scenario.request);

        if (Array.isArray(scenario.expectedStatus)) {
          expect(scenario.expectedStatus).toContain(response.status);
        } else {
          expect(response.status).toBe(scenario.expectedStatus);
        }

        // All error responses should have proper error structure
        if (response.status >= 400) {
          expect(response.body).toHaveProperty('error');
        }
      }

      // Step 2: Verify service remains healthy after errors
      const healthCheckResponse = await request(serverUrl)
        .get('/health')
        .expect(200);

      expect(healthCheckResponse.body.status).toBe('healthy');

      logger.info('Error recovery workflow completed successfully');
    });

    it('should complete session management workflow', async () => {
      logger.info('Starting session management workflow test');

      // Step 1: Create multiple sessions
      const sessions = [];
      for (let i = 0; i < 3; i++) {
        const sessionResponse = await request(serverUrl)
          .post('/v1/sessions')
          .send({
            system_prompt: `Test session ${i + 1}`,
            max_turns: 5 + i,
            model: 'claude-3-sonnet-20240229'
          })
          .expect(201);

        sessions.push(sessionResponse.body);
      }

      // Step 2: List and verify all sessions
      const listResponse = await request(serverUrl)
        .get('/v1/sessions')
        .expect(200);

      expect(listResponse.body.data).toHaveLength(sessions.length);
      sessions.forEach(session => {
        expect(listResponse.body.data).toContainEqual(
          expect.objectContaining({ id: session.id })
        );
      });

      // Step 3: Update sessions
      for (const session of sessions) {
        const updateResponse = await request(serverUrl)
          .patch(`/v1/sessions/${session.id}`)
          .send({
            system_prompt: `Updated ${session.system_prompt}`,
            max_turns: session.max_turns + 5
          })
          .expect(200);

        expect(updateResponse.body.system_prompt).toContain('Updated');
        expect(updateResponse.body.max_turns).toBe(session.max_turns + 5);
      }

      // Step 4: Delete sessions one by one
      for (const session of sessions) {
        await request(serverUrl)
          .delete(`/v1/sessions/${session.id}`)
          .expect(204);

        // Verify session is gone
        await request(serverUrl)
          .get(`/v1/sessions/${session.id}`)
          .expect(404);
      }

      // Step 5: Verify no sessions remain
      const finalListResponse = await request(serverUrl)
        .get('/v1/sessions')
        .expect(200);

      expect(finalListResponse.body.data).toHaveLength(0);

      logger.info('Session management workflow completed successfully');
    });
  });

  describe('Real-World Integration Scenarios', () => {
    it('should handle realistic development team collaboration scenario', async () => {
      logger.info('Starting development team collaboration scenario');

      // Team member 1: Sets up session for code review
      const codeReviewSession = await request(serverUrl)
        .post('/v1/sessions')
        .send({
          system_prompt: 'You are a senior developer conducting code reviews.',
          max_turns: 20,
          model: 'claude-3-sonnet-20240229'
        })
        .expect(201);

      // Team member 2: Tests compatibility of their OpenAI integration
      const teamMemberRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Review this function for bugs.' }
        ],
        temperature: 0.2,
        max_tokens: 500
      };

      const compatibilityCheck = await request(serverUrl)
        .post('/v1/compatibility')
        .send(teamMemberRequest)
        .expect(200);

      expect(compatibilityCheck.body.compatibility_report.unsupported_parameters)
        .toContain('temperature');

      // Team member 3: Uses debug endpoint to understand API structure
      const debugCheck = await request(serverUrl)
        .post('/v1/debug/request')
        .send({
          model: 'claude-3-sonnet-20240229',
          messages: [{ role: 'user', content: 'Analyze this code.' }]
        })
        .expect(200);

      expect(debugCheck.body.debug_info.validation_result.valid).toBe(true);

      // Clean up session
      await request(serverUrl)
        .delete(`/v1/sessions/${codeReviewSession.body.id}`)
        .expect(204);

      logger.info('Development team collaboration scenario completed');
    });

    it('should handle production deployment verification scenario', async () => {
      logger.info('Starting production deployment verification scenario');

      // DevOps: Health check sequence
      const healthChecks = await Promise.all([
        request(serverUrl).get('/health'),
        request(serverUrl).get('/v1/models'),
        request(serverUrl).get('/v1/auth/status'),
        request(serverUrl).get('/v1/sessions')
      ]);

      healthChecks.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Load testing simulation
      const loadTestResults = await Promise.all(
        Array.from({ length: 10 }, () =>
          request(serverUrl).get('/health').expect(200)
        )
      );

      expect(loadTestResults).toHaveLength(10);

      // API endpoint verification
      const endpointTests = [
        { method: 'POST', path: '/v1/compatibility', body: { model: 'test', messages: [] } },
        { method: 'POST', path: '/v1/debug/request', body: { model: 'test', messages: [] } },
        { method: 'POST', path: '/v1/sessions', body: { model: 'claude-3-sonnet-20240229' } }
      ];

      for (const test of endpointTests) {
        const response = await request(serverUrl)[test.method.toLowerCase()](test.path)
          .send(test.body);
        
        // Should not return 404 (endpoint exists) or 500 (no crashes)
        expect(response.status).not.toBe(404);
        expect(response.status).toBeLessThan(500);
      }

      logger.info('Production deployment verification scenario completed');
    });
  });

  // Helper functions
  async function findAvailablePort(): Promise<number> {
    // Simple port finding - in real scenarios you'd use a proper port finder
    return 3000 + Math.floor(Math.random() * 1000);
  }

  async function startServerProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      const serverPath = path.join(__dirname, '../../../dist/index.js');
      
      serverProcess = spawn('node', [serverPath], {
        env: {
          ...process.env,
          PORT: serverPort.toString(),
          NODE_ENV: 'test'
        },
        stdio: 'pipe'
      });

      serverProcess.on('error', reject);
      
      // Wait a bit for server to start
      setTimeout(resolve, 2000);
    });
  }

  async function waitForServerReady(): Promise<void> {
    const maxAttempts = 30;
    const delayMs = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await request(serverUrl).get('/health');
        if (response.status === 200) {
          logger.info(`Server ready after ${attempt + 1} attempts`);
          return;
        }
      } catch (error) {
        // Server not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new Error('Server failed to become ready within timeout');
  }
});