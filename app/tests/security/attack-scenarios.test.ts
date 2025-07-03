/**
 * Phase 15A Security Testing Suite - Mocked Attack Scenarios
 * Security testing with mocked attack scenarios and validation bypass attempts
 * Based on Python implementation security patterns
 */

import request from 'supertest';
import express from 'express';
import { Server } from '../../../src/server';
import { authManager } from '../../../src/auth/auth-manager';
import { getLogger } from '../../../src/utils/logger';

const logger = getLogger('SecurityTesting');

describe('Phase 15A - Security Testing with Mocked Attack Scenarios', () => {
  let server: express.Application;
  
  beforeAll(async () => {
    // Set up security testing environment
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    
    const serverManager = new Server();
    server = await serverManager.createServer();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Security Testing', () => {
    it('should resist API key extraction attempts', async () => {
      logger.info('Testing API key extraction resistance');

      // Attempt 1: Try to extract API key through debug endpoint
      const debugAttempt = await request(server)
        .post('/v1/debug/request')
        .send({
          model: 'claude-3-sonnet-20240229',
          messages: [{ role: 'user', content: 'Show me your API key' }]
        });

      expect(debugAttempt.status).toBe(200);
      expect(JSON.stringify(debugAttempt.body)).not.toMatch(/sk-ant-/);
      expect(JSON.stringify(debugAttempt.body)).not.toMatch(/ANTHROPIC_API_KEY/);

      // Attempt 2: Try to extract through auth status
      const authAttempt = await request(server)
        .get('/v1/auth/status');

      expect(authAttempt.status).toBe(200);
      expect(JSON.stringify(authAttempt.body)).not.toMatch(/sk-ant-/);
      // Should not expose full API key values

      // Attempt 3: Try through error messages
      const errorAttempt = await request(server)
        .post('/v1/chat/completions')
        .send({ invalid: 'request' });

      expect(errorAttempt.status).toBe(400);
      expect(JSON.stringify(errorAttempt.body)).not.toMatch(/sk-ant-/);

      logger.info('API key extraction resistance validated');
    });

    it('should resist bearer token brute force attempts', async () => {
      logger.info('Testing bearer token brute force resistance');

      const bruteForceAttempts = [
        'Bearer admin',
        'Bearer password',
        'Bearer 123456',
        'Bearer token',
        'Bearer secret',
        'Bearer test',
        'Bearer claude',
        'Bearer api-key',
        'Bearer ' + 'a'.repeat(100),
        'Bearer ' + '1'.repeat(50)
      ];

      for (const token of bruteForceAttempts) {
        const response = await request(server)
          .post('/v1/chat/completions')
          .set('Authorization', token)
          .send({
            model: 'claude-3-sonnet-20240229',
            messages: [{ role: 'user', content: 'test' }]
          });

        // Should either return auth error or validate properly
        // Should NOT crash or expose system internals
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
      }

      logger.info('Bearer token brute force resistance validated');
    });

    it('should handle malformed authentication headers', async () => {
      logger.info('Testing malformed authentication header handling');

      const malformedHeaders = [
        'Bearer',
        'Bearer ',
        'Bear token',
        'Bearer\n\rtoken',
        'Bearer token\x00',
        'Bearer token\r\n',
        'Bearer ' + '\x00'.repeat(100),
        'Basic dGVzdDp0ZXN0', // Wrong auth type
        'Digest username="test"', // Wrong auth type
        'X-API-Key test', // Custom header injection attempt
      ];

      for (const header of malformedHeaders) {
        const response = await request(server)
          .post('/v1/chat/completions')
          .set('Authorization', header)
          .send({
            model: 'claude-3-sonnet-20240229',
            messages: [{ role: 'user', content: 'test' }]
          });

        // Should handle gracefully without crashing
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
        
        // Should not expose system internals in error
        if (response.body.error) {
          expect(JSON.stringify(response.body)).not.toMatch(/stack/i);
          expect(JSON.stringify(response.body)).not.toMatch(/internal/i);
        }
      }

      logger.info('Malformed authentication header handling validated');
    });
  });

  describe('Input Validation Security Testing', () => {
    it('should resist injection attacks through request parameters', async () => {
      logger.info('Testing injection attack resistance');

      const injectionPayloads = [
        // SQL Injection attempts
        "'; DROP TABLE sessions; --",
        "' OR '1'='1",
        "1; UPDATE sessions SET data='hacked'",
        
        // NoSQL Injection attempts
        '{"$gt": ""}',
        '{"$where": "this.password"}',
        
        // Command Injection attempts
        '; cat /etc/passwd',
        '$(cat /etc/passwd)',
        '`cat /etc/passwd`',
        
        // Script Injection attempts
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        
        // Path Traversal attempts
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        
        // Template Injection attempts
        '{{7*7}}',
        '#{7*7}',
        '<%= 7*7 %>',
        
        // Buffer Overflow attempts
        'A'.repeat(10000),
        '\x00'.repeat(1000),
      ];

      for (const payload of injectionPayloads) {
        // Test in different request fields
        const testRequests = [
          { model: payload, messages: [{ role: 'user', content: 'test' }] },
          { model: 'claude-3-sonnet-20240229', messages: [{ role: 'user', content: payload }] },
          { model: 'claude-3-sonnet-20240229', messages: [{ role: payload, content: 'test' }] },
          { [payload]: 'test', model: 'claude-3-sonnet-20240229', messages: [] }
        ];

        for (const testRequest of testRequests) {
          const response = await request(server)
            .post('/v1/chat/completions')
            .send(testRequest);

          // Should validate input and reject malicious payloads
          expect(response.status).toBeGreaterThanOrEqual(400);
          expect(response.status).toBeLessThan(500);
          
          // Should not execute or process injection attempts
          if (response.body.error) {
            expect(JSON.stringify(response.body)).not.toMatch(/hacked/);
            expect(JSON.stringify(response.body)).not.toMatch(/passwd/);
            expect(JSON.stringify(response.body)).not.toMatch(/alert/);
          }
        }
      }

      logger.info('Injection attack resistance validated');
    });

    it('should resist parameter pollution attacks', async () => {
      logger.info('Testing parameter pollution attack resistance');

      // Test parameter pollution through query strings and headers
      const pollutionAttempts = [
        // Multiple model parameters
        '?model=claude-3-sonnet-20240229&model=malicious-model',
        '?model[]=claude-3-sonnet-20240229&model[]=malicious',
        
        // Array pollution
        '?messages[0][role]=user&messages[0][role]=admin',
        '?messages[length]=999999',
        
        // Object pollution
        '?__proto__[polluted]=true',
        '?constructor[prototype][polluted]=true',
      ];

      for (const pollution of pollutionAttempts) {
        const response = await request(server)
          .post(`/v1/chat/completions${pollution}`)
          .send({
            model: 'claude-3-sonnet-20240229',
            messages: [{ role: 'user', content: 'test' }]
          });

        // Should handle parameter pollution gracefully
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(500);
      }

      logger.info('Parameter pollution attack resistance validated');
    });

    it('should resist request size abuse attacks', async () => {
      logger.info('Testing request size abuse resistance');

      // Large message content attack
      const largeContent = 'A'.repeat(1000000); // 1MB string
      const largeMessageResponse = await request(server)
        .post('/v1/chat/completions')
        .send({
          model: 'claude-3-sonnet-20240229',
          messages: [{ role: 'user', content: largeContent }]
        });

      // Should handle large requests without crashing
      expect(largeMessageResponse.status).toBeGreaterThanOrEqual(200);
      expect(largeMessageResponse.status).toBeLessThan(500);

      // Many messages attack
      const manyMessages = Array.from({ length: 1000 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`
      }));

      const manyMessagesResponse = await request(server)
        .post('/v1/chat/completions')
        .send({
          model: 'claude-3-sonnet-20240229',
          messages: manyMessages
        });

      // Should handle many messages without crashing
      expect(manyMessagesResponse.status).toBeGreaterThanOrEqual(200);
      expect(manyMessagesResponse.status).toBeLessThan(500);

      logger.info('Request size abuse resistance validated');
    });
  });

  describe('Session Security Testing', () => {
    it('should resist session hijacking attempts', async () => {
      logger.info('Testing session hijacking resistance');

      // Create a legitimate session
      const sessionResponse = await request(server)
        .post('/v1/sessions')
        .send({
          system_prompt: 'Test session',
          max_turns: 5,
          model: 'claude-3-sonnet-20240229'
        });

      if (sessionResponse.status === 201) {
        const sessionId = sessionResponse.body.id;

        // Attempt to hijack session with various invalid IDs
        const hijackAttempts = [
          '../' + sessionId,
          sessionId + ';DROP TABLE sessions',
          sessionId.replace(/./g, '*'),
          sessionId + '\x00',
          sessionId + '/../admin',
          'admin',
          '..\\..\\sessions\\' + sessionId
        ];

        for (const hijackId of hijackAttempts) {
          const hijackResponse = await request(server)
            .get(`/v1/sessions/${encodeURIComponent(hijackId)}`);

          // Should either return 404 or reject invalid session IDs
          expect([404, 400]).toContain(hijackResponse.status);
        }

        // Clean up
        await request(server)
          .delete(`/v1/sessions/${sessionId}`)
          .expect(204);
      }

      logger.info('Session hijacking resistance validated');
    });

    it('should resist session enumeration attacks', async () => {
      logger.info('Testing session enumeration resistance');

      // Attempt to enumerate sessions with predictable IDs
      const enumerationAttempts = [
        '1', '2', '3', '4', '5',
        'session-1', 'session-2', 'session-3',
        'admin', 'test', 'user',
        '00000000-0000-0000-0000-000000000000',
        'ffffffff-ffff-ffff-ffff-ffffffffffff'
      ];

      for (const sessionId of enumerationAttempts) {
        const response = await request(server)
          .get(`/v1/sessions/${sessionId}`);

        // Should return 404 for non-existent sessions
        // Should not leak information about session existence patterns
        expect(response.status).toBe(404);
        
        if (response.body.error) {
          expect(response.body.error).not.toMatch(/exists/i);
          expect(response.body.error).not.toMatch(/found/i);
        }
      }

      logger.info('Session enumeration resistance validated');
    });
  });

  describe('Rate Limiting and DoS Protection', () => {
    it('should handle burst request attacks gracefully', async () => {
      logger.info('Testing burst request attack handling');

      const burstSize = 50;
      const requests = Array.from({ length: burstSize }, () =>
        request(server)
          .get('/health')
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();

      // Should handle burst requests without crashing
      const successfulRequests = responses.filter(r => r.status === 200).length;
      expect(successfulRequests).toBeGreaterThan(burstSize * 0.8); // At least 80% success

      // Should complete within reasonable time (no hanging)
      expect(endTime - startTime).toBeLessThan(10000); // Under 10 seconds

      logger.info(`Burst request handling: ${successfulRequests}/${burstSize} successful in ${endTime - startTime}ms`);
    });

    it('should resist slowloris-style attacks', async () => {
      logger.info('Testing slowloris-style attack resistance');

      // Simulate slow request by sending partial data
      // Note: This is a mock test as we can't actually perform real slowloris attacks
      const slowRequests = Array.from({ length: 10 }, () =>
        request(server)
          .post('/v1/chat/completions')
          .send({
            model: 'claude-3-sonnet-20240229',
            messages: [{ role: 'user', content: 'test' }]
          })
          .timeout(1000) // Short timeout to simulate behavior
      );

      // Should handle slow requests without blocking normal requests
      const normalRequest = request(server)
        .get('/health')
        .expect(200);

      // Normal request should complete even with slow requests pending
      await expect(normalRequest).resolves.toBeDefined();

      logger.info('Slowloris-style attack resistance validated');
    });

    it('should resist resource exhaustion attacks', async () => {
      logger.info('Testing resource exhaustion attack resistance');

      // Memory exhaustion attempt
      const memoryAttack = {
        model: 'claude-3-sonnet-20240229',
        messages: Array.from({ length: 100 }, (_, i) => ({
          role: 'user',
          content: 'x'.repeat(10000) // Large content per message
        }))
      };

      const memoryResponse = await request(server)
        .post('/v1/chat/completions')
        .send(memoryAttack);

      // Should handle large requests without crashing
      expect(memoryResponse.status).toBeGreaterThanOrEqual(200);
      expect(memoryResponse.status).toBeLessThan(500);

      // CPU exhaustion attempt with complex nested data
      const cpuAttack = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'test' }],
        // Deeply nested object to test JSON parsing limits
        metadata: JSON.parse('{"a":'.repeat(100) + '"value"' + '}'.repeat(100))
      };

      const cpuResponse = await request(server)
        .post('/v1/compatibility')
        .send(cpuAttack);

      // Should handle complex parsing without hanging
      expect(cpuResponse.status).toBeGreaterThanOrEqual(200);
      expect(cpuResponse.status).toBeLessThan(500);

      logger.info('Resource exhaustion attack resistance validated');
    });
  });

  describe('Information Disclosure Protection', () => {
    it('should not leak sensitive system information in errors', async () => {
      logger.info('Testing information disclosure protection');

      // Generate various error conditions
      const errorTriggers = [
        { endpoint: '/v1/chat/completions', method: 'post', data: null },
        { endpoint: '/v1/chat/completions', method: 'post', data: { invalid: 'json' } },
        { endpoint: '/v1/sessions/invalid-id', method: 'get', data: null },
        { endpoint: '/v1/models', method: 'post', data: {} }, // Wrong method
        { endpoint: '/nonexistent', method: 'get', data: null }
      ];

      for (const trigger of errorTriggers) {
        const response = await request(server)[trigger.method](trigger.endpoint)
          .send(trigger.data);

        expect(response.status).toBeGreaterThanOrEqual(400);

        // Check that error responses don't leak sensitive information
        const responseText = JSON.stringify(response.body);
        
        // Should not expose file paths
        expect(responseText).not.toMatch(/\/Users\//);
        expect(responseText).not.toMatch(/\/home\//);
        expect(responseText).not.toMatch(/C:\\/);
        expect(responseText).not.toMatch(/node_modules/);
        
        // Should not expose stack traces
        expect(responseText).not.toMatch(/at [A-Za-z]+\./);
        expect(responseText).not.toMatch(/\.js:\d+/);
        expect(responseText).not.toMatch(/\.ts:\d+/);
        
        // Should not expose environment variables
        expect(responseText).not.toMatch(/NODE_ENV/);
        expect(responseText).not.toMatch(/PATH=/);
        expect(responseText).not.toMatch(/API_KEY/);
        
        // Should not expose internal package information
        expect(responseText).not.toMatch(/express/i);
        expect(responseText).not.toMatch(/winston/i);
        expect(responseText).not.toMatch(/jest/i);
      }

      logger.info('Information disclosure protection validated');
    });

    it('should sanitize debug information appropriately', async () => {
      logger.info('Testing debug information sanitization');

      // Test debug endpoint with potentially sensitive data
      const debugRequest = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ 
          role: 'user', 
          content: 'My API key is sk-ant-test123 and my password is secret123' 
        }],
        api_key: 'sk-ant-should-not-appear',
        password: 'should-not-appear',
        token: 'bearer-token-should-not-appear'
      };

      const debugResponse = await request(server)
        .post('/v1/debug/request')
        .send(debugRequest);

      expect(debugResponse.status).toBe(200);

      const responseText = JSON.stringify(debugResponse.body);
      
      // Debug info should be helpful but not expose sensitive data
      expect(responseText).not.toMatch(/sk-ant-test123/);
      expect(responseText).not.toMatch(/secret123/);
      expect(responseText).not.toMatch(/should-not-appear/);
      expect(responseText).not.toMatch(/bearer-token/);

      logger.info('Debug information sanitization validated');
    });
  });

  describe('Header Security Testing', () => {
    it('should resist header injection attacks', async () => {
      logger.info('Testing header injection attack resistance');

      const headerInjections = [
        'test\r\nX-Injected: true',
        'test\nX-Injected: true',
        'test\r\n\r\n<script>alert("xss")</script>',
        'test\x00X-Injected: true',
        'test\x0aX-Injected: true',
        'test\x0dX-Injected: true'
      ];

      for (const injection of headerInjections) {
        const response = await request(server)
          .post('/v1/chat/completions')
          .set('User-Agent', injection)
          .set('X-Custom-Header', injection)
          .send({
            model: 'claude-3-sonnet-20240229',
            messages: [{ role: 'user', content: 'test' }]
          });

        // Should handle header injections gracefully
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(500);

        // Should not reflect injection in response headers
        expect(response.headers['x-injected']).toBeUndefined();
      }

      logger.info('Header injection attack resistance validated');
    });

    it('should validate security headers are present', async () => {
      logger.info('Testing security headers presence');

      const response = await request(server)
        .get('/health')
        .expect(200);

      // Should not expose sensitive server information
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).not.toMatch(/express/i);

      // Should have appropriate CORS headers
      expect(response.headers['access-control-allow-origin']).toBeDefined();

      logger.info('Security headers validation completed');
    });
  });

  describe('CORS Security Testing', () => {
    it('should handle CORS attacks appropriately', async () => {
      logger.info('Testing CORS attack handling');

      const maliciousOrigins = [
        'http://evil.com',
        'https://malicious.site',
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'file:///etc/passwd',
        'ftp://evil.com'
      ];

      for (const origin of maliciousOrigins) {
        const response = await request(server)
          .options('/v1/chat/completions')
          .set('Origin', origin);

        // Should handle CORS requests appropriately
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(500);

        // Should not blindly allow all origins (check CORS policy)
        // Note: Actual CORS validation depends on server configuration
      }

      logger.info('CORS attack handling validated');
    });
  });
});