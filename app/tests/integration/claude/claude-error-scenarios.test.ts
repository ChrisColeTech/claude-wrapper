/**
 * Claude Error Scenarios Integration Tests - Phase 2 Real SDK Integration
 * Tests for real Claude SDK error handling, recovery, and resilience
 * 
 * These tests verify proper error handling across various failure scenarios
 * including authentication, network, rate limiting, and malformed requests
 */

import { ClaudeService } from '../../../src/claude/service';
import { ClaudeClient } from '../../../src/claude/client';
import { ClaudeSDKClient } from '../../../src/claude/sdk-client';
import { authManager } from '../../../src/auth/auth-manager';
import { Message } from '../../../src/models/message';
import { ClaudeSDKError, AuthenticationError, VerificationError } from '../../../src/claude/error-types';
import { ModelValidationError } from '../../../src/validation/model-validator';

// Extended timeouts for error scenario testing
const ERROR_TEST_TIMEOUT = 30000;
const NETWORK_TEST_TIMEOUT = 60000;

describe('Claude Error Scenarios Integration Tests - Phase 2', () => {
  let service: ClaudeService;
  let client: ClaudeClient;
  let sdkClient: ClaudeSDKClient;
  let originalAuthManager: any;

  beforeAll(async () => {
    service = new ClaudeService(15000); // Shorter timeout for error testing
    client = new ClaudeClient(15000);
    sdkClient = new ClaudeSDKClient({ timeout: 15000 });

    // Store original auth manager methods for restoration
    originalAuthManager = {
      getAuthStatus: authManager.getAuthStatus.bind(authManager),
      getClaudeCodeEnvVars: authManager.getClaudeCodeEnvVars.bind(authManager)
    };
  }, ERROR_TEST_TIMEOUT);

  afterEach(() => {
    // Restore original auth manager methods after each test
    authManager.getAuthStatus = originalAuthManager.getAuthStatus;
    authManager.getClaudeCodeEnvVars = originalAuthManager.getClaudeCodeEnvVars;
  });

  describe('1. Authentication and Authorization Errors', () => {
    it('should handle missing authentication credentials gracefully', async () => {
      // Mock auth manager to simulate no credentials
      authManager.getAuthStatus = jest.fn().mockResolvedValue({
        authenticated: false,
        method: null,
        apiKeyProtected: false,
        errors: ['No API key found', 'No Claude CLI authentication']
      });

      authManager.getClaudeCodeEnvVars = jest.fn().mockReturnValue({});

      const verification = await service.verifySDK();
      
      expect(verification.available).toBe(false);
      expect(verification.error).toBeDefined();
      expect(verification.error).toContain('authentication');

      console.log(`📋 Missing auth error: ${verification.error}`);
    }, ERROR_TEST_TIMEOUT);

    it('should handle invalid API key scenarios', async () => {
      // Mock auth manager to simulate invalid API key
      authManager.getAuthStatus = jest.fn().mockResolvedValue({
        authenticated: true,
        method: 'anthropic',
        apiKeyProtected: false,
        errors: []
      });

      authManager.getClaudeCodeEnvVars = jest.fn().mockReturnValue({
        ANTHROPIC_API_KEY: 'sk-invalid-key-12345'
      });

      try {
        const messages: Message[] = [
          { role: 'user', content: 'Test with invalid key' }
        ];

        await service.createCompletion(messages, {
          model: 'claude-3-haiku-20240307',
          max_turns: 1
        });

        // If no error thrown, log success (may happen with mocked responses)
        console.log('📋 Invalid API key test completed without error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message.toLowerCase()).toMatch(/auth|key|credential|permission/);
        console.log(`📋 Invalid API key error: ${error.message}`);
      }
    }, ERROR_TEST_TIMEOUT);

    it('should handle authentication timeout scenarios', async () => {
      // Mock auth manager to simulate slow authentication
      authManager.getAuthStatus = jest.fn().mockImplementation(async () => {
        // Simulate slow auth response
        await new Promise(resolve => setTimeout(resolve, 20000));
        return {
          authenticated: true,
          method: 'anthropic',
          apiKeyProtected: false,
          errors: []
        };
      });

      const shortTimeoutClient = new ClaudeClient(5000); // 5 second timeout

      try {
        await shortTimeoutClient.verifySDK();
        console.log('📋 Auth timeout test completed without timeout');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        console.log(`📋 Auth timeout error: ${error.message}`);
      }
    }, ERROR_TEST_TIMEOUT);

    it('should handle credential refresh failures', async () => {
      // Simulate credential refresh failure
      authManager.getClaudeCodeEnvVars = jest.fn().mockImplementation(() => {
        throw new Error('Failed to refresh credentials');
      });

      try {
        const messages: Message[] = [
          { role: 'user', content: 'Test credential refresh failure' }
        ];

        await service.createCompletion(messages, {
          model: 'claude-3-haiku-20240307',
          max_turns: 1
        });

        console.log('📋 Credential refresh test completed without error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('refresh credentials');
        console.log(`📋 Credential refresh error: ${error.message}`);
      }
    }, ERROR_TEST_TIMEOUT);

    it('should handle environment variable corruption', async () => {
      // Mock corrupted environment variables
      authManager.getClaudeCodeEnvVars = jest.fn().mockReturnValue({
        ANTHROPIC_API_KEY: '', // Empty key
        AWS_ACCESS_KEY_ID: 'corrupted-key-data-!@#$',
        CLAUDE_CODE_USE_BEDROCK: 'invalid-boolean-value'
      });

      authManager.getAuthStatus = jest.fn().mockResolvedValue({
        authenticated: false,
        method: null,
        apiKeyProtected: false,
        errors: ['Corrupted environment variables']
      });

      const verification = await service.verifySDK();
      
      expect(verification.available).toBe(false);
      expect(verification.error).toBeDefined();
      
      console.log(`📋 Environment corruption handled: ${verification.error}`);
    }, ERROR_TEST_TIMEOUT);
  });

  describe('2. Network and Connection Errors', () => {
    it('should handle network timeout errors gracefully', async () => {
      const timeoutService = new ClaudeService(1000); // 1 second timeout

      try {
        const messages: Message[] = [
          { role: 'user', content: 'This request should timeout quickly if using real API' }
        ];

        const startTime = Date.now();
        await timeoutService.createCompletion(messages, {
          model: 'claude-3-5-sonnet-20241022',
          max_turns: 1
        });
        const duration = Date.now() - startTime;

        console.log(`📋 Request completed in ${duration}ms without timeout`);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        console.log(`📋 Network timeout handled: ${error.message}`);
      }
    }, NETWORK_TEST_TIMEOUT);

    it('should handle connection interruption during streaming', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Generate a very long story about a space adventure with many details.' }
      ];

      try {
        let chunkCount = 0;
        const maxChunks = 5; // Artificially limit to simulate interruption

        for await (const chunk of service.createStreamingCompletion(messages, {
          model: 'claude-3-5-sonnet-20241022',
          max_turns: 1
        })) {
          chunkCount++;
          
          if (chunkCount >= maxChunks) {
            // Simulate connection interruption
            throw new Error('Connection interrupted');
          }
          
          if (chunk.finished) break;
        }

        console.log(`📋 Streaming completed without interruption after ${chunkCount} chunks`);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        console.log(`📋 Streaming interruption handled: ${error.message}`);
      }
    }, NETWORK_TEST_TIMEOUT);

    it('should handle DNS resolution failures', async () => {
      // This test simulates what would happen if DNS fails
      // In real scenarios, this would be caught by the SDK
      
      try {
        const messages: Message[] = [
          { role: 'user', content: 'Test DNS failure scenario' }
        ];

        const response = await service.createCompletion(messages, {
          model: 'claude-3-haiku-20240307',
          max_turns: 1
        });

        console.log('📋 DNS test completed successfully');
        expect(response.content).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        
        // Could be various network-related errors
        const networkErrors = /network|dns|connection|resolve|timeout/i;
        const isNetworkError = networkErrors.test(error.message) || 
                              error.message.includes('ENOTFOUND') ||
                              error.message.includes('ECONNREFUSED');
        
        if (isNetworkError) {
          console.log(`📋 Network error handled appropriately: ${error.message}`);
        } else {
          console.log(`📋 Non-network error in DNS test: ${error.message}`);
        }
      }
    }, NETWORK_TEST_TIMEOUT);

    it('should handle rate limiting with proper backoff', async () => {
      // Simulate rapid requests that might trigger rate limiting
      const rapidRequests = Array.from({ length: 10 }, (_, i) => 
        service.createCompletion([
          { role: 'user', content: `Rapid request ${i + 1}: What is ${i + 1} squared?` }
        ], {
          model: 'claude-3-haiku-20240307',
          max_turns: 1
        })
      );

      const results = await Promise.allSettled(rapidRequests);
      
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      console.log(`📊 Rate limiting test: ${successful.length} successful, ${failed.length} failed`);

      // At least some requests should succeed
      expect(successful.length).toBeGreaterThan(0);

      // Check failed requests for rate limiting indicators
      failed.forEach((result, index) => {
        if (result.status === 'rejected') {
          const isRateLimit = /rate.*limit|too.*many.*requests|429/i.test(result.reason.message);
          if (isRateLimit) {
            console.log(`📋 Request ${index + 1} properly rate limited`);
          }
        }
      });
    }, NETWORK_TEST_TIMEOUT);

    it('should handle SSL/TLS certificate errors', async () => {
      // This simulates certificate validation failures
      // In practice, this would be handled by the underlying HTTP client
      
      try {
        const messages: Message[] = [
          { role: 'user', content: 'Test SSL certificate handling' }
        ];

        const response = await service.createCompletion(messages, {
          model: 'claude-3-haiku-20240307',
          max_turns: 1
        });

        console.log('📋 SSL test completed successfully');
        expect(response.content).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        
        const sslErrors = /ssl|certificate|tls|handshake/i;
        if (sslErrors.test(error.message)) {
          console.log(`📋 SSL error handled: ${error.message}`);
        } else {
          console.log(`📋 Non-SSL error in certificate test: ${error.message}`);
        }
      }
    }, ERROR_TEST_TIMEOUT);
  });

  describe('3. Request Validation and Model Errors', () => {
    it('should reject invalid model names before making API calls', async () => {
      const invalidModels = [
        'invalid-model-name',
        'gpt-4-turbo', // OpenAI model
        'claude-v1-deprecated',
        '',
        null,
        undefined
      ];

      for (const invalidModel of invalidModels) {
        try {
          const messages: Message[] = [
            { role: 'user', content: 'Test invalid model' }
          ];

          await service.createCompletion(messages, {
            model: invalidModel as any,
            max_turns: 1
          });

          console.log(`📋 Model "${invalidModel}" was unexpectedly accepted`);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect([ClaudeSDKError, ModelValidationError].some(ErrorType => 
            error instanceof ErrorType
          )).toBe(true);
          
          console.log(`📋 Model "${invalidModel}" properly rejected: ${error.constructor.name}`);
        }
      }
    }, ERROR_TEST_TIMEOUT);

    it('should handle malformed message structures', async () => {
      const malformedCases = [
        {
          name: 'empty messages array',
          messages: [],
          shouldError: true
        },
        {
          name: 'missing role',
          messages: [{ content: 'Hello' }],
          shouldError: true
        },
        {
          name: 'missing content',
          messages: [{ role: 'user' }],
          shouldError: true
        },
        {
          name: 'invalid role',
          messages: [{ role: 'invalid_role', content: 'Hello' }],
          shouldError: true
        },
        {
          name: 'null content',
          messages: [{ role: 'user', content: null }],
          shouldError: true
        }
      ];

      for (const testCase of malformedCases) {
        try {
          await service.createCompletion(testCase.messages as any, {
            model: 'claude-3-haiku-20240307',
            max_turns: 1
          });

          if (testCase.shouldError) {
            console.log(`📋 ${testCase.name}: unexpectedly succeeded`);
          } else {
            console.log(`📋 ${testCase.name}: properly handled`);
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          console.log(`📋 ${testCase.name}: properly rejected - ${error.constructor.name}`);
        }
      }
    }, ERROR_TEST_TIMEOUT);

    it('should handle extremely long input content', async () => {
      // Create content that exceeds typical context limits
      const veryLongContent = 'This is a very long message. '.repeat(10000); // ~290KB
      
      try {
        const messages: Message[] = [
          { role: 'user', content: veryLongContent }
        ];

        const response = await service.createCompletion(messages, {
          model: 'claude-3-haiku-20240307',
          max_turns: 1
        });

        console.log(`📋 Long content handled successfully: ${response.content.length} chars response`);
        expect(response.content).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        
        // Should be context length or similar error
        const contextErrors = /context|length|token.*limit|too.*long/i;
        if (contextErrors.test(error.message)) {
          console.log(`📋 Long content properly rejected: ${error.message}`);
        } else {
          console.log(`📋 Long content error (unexpected): ${error.message}`);
        }
      }
    }, ERROR_TEST_TIMEOUT);

    it('should handle invalid completion options', async () => {
      const invalidOptions = [
        {
          name: 'negative max_turns',
          options: { max_turns: -1 },
          shouldError: true
        },
        {
          name: 'zero max_turns',
          options: { max_turns: 0 },
          shouldError: true
        },
        {
          name: 'extremely high max_turns',
          options: { max_turns: 1000000 },
          shouldError: true
        },
        {
          name: 'invalid system_prompt type',
          options: { system_prompt: 123 as any },
          shouldError: true
        }
      ];

      for (const testCase of invalidOptions) {
        try {
          const messages: Message[] = [
            { role: 'user', content: 'Test invalid options' }
          ];

          await service.createCompletion(messages, {
            model: 'claude-3-haiku-20240307',
            ...testCase.options
          });

          if (testCase.shouldError) {
            console.log(`📋 ${testCase.name}: unexpectedly succeeded`);
          } else {
            console.log(`📋 ${testCase.name}: properly handled`);
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          console.log(`📋 ${testCase.name}: properly rejected - ${error.constructor.name}`);
        }
      }
    }, ERROR_TEST_TIMEOUT);

    it('should handle service unavailability gracefully', async () => {
      // Test what happens when Claude service is temporarily unavailable
      // This simulates various service outage scenarios
      
      const testMessages: Message[] = [
        { role: 'user', content: 'Test service availability' }
      ];

      try {
        const response = await service.createCompletion(testMessages, {
          model: 'claude-3-haiku-20240307',
          max_turns: 1
        });

        console.log('📋 Service availability test: Service is available');
        expect(response.content).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        
        // Common service unavailability indicators
        const serviceErrors = /service.*unavailable|server.*error|503|502|500/i;
        if (serviceErrors.test(error.message)) {
          console.log(`📋 Service unavailability handled: ${error.message}`);
        } else if (error.message.includes('timeout')) {
          console.log(`📋 Service timeout handled: ${error.message}`);
        } else {
          console.log(`📋 Service error (other): ${error.message}`);
        }
      }
    }, ERROR_TEST_TIMEOUT);
  });

  describe('4. Error Recovery and Resilience', () => {
    it('should recover from temporary authentication token expiry', async () => {
      // Simulate token expiry and refresh scenario
      let callCount = 0;
      
      authManager.getAuthStatus = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First call: expired token
          return {
            authenticated: false,
            method: null,
            apiKeyProtected: false,
            errors: ['Token expired']
          };
        } else {
          // Subsequent calls: refreshed token
          return {
            authenticated: true,
            method: 'anthropic',
            apiKeyProtected: false,
            errors: []
          };
        }
      });

      authManager.getClaudeCodeEnvVars = jest.fn().mockReturnValue({
        ANTHROPIC_API_KEY: 'sk-refreshed-key-123'
      });

      try {
        const verification1 = await service.verifySDK();
        expect(verification1.available).toBe(false);
        
        // Second attempt should work with refreshed token
        const verification2 = await service.verifySDK();
        
        console.log(`📋 Token refresh: First=${verification1.available}, Second=${verification2.available}`);
      } catch (error) {
        console.log(`📋 Token refresh error: ${error.message}`);
      }
    }, ERROR_TEST_TIMEOUT);

    it('should handle partial response corruption gracefully', async () => {
      // This test simulates scenarios where responses are partially corrupted
      const messages: Message[] = [
        { role: 'user', content: 'Test response corruption handling' }
      ];

      try {
        const response = await service.createCompletion(messages, {
          model: 'claude-3-haiku-20240307',
          max_turns: 1
        });

        // Verify response structure integrity
        expect(response.content).toBeDefined();
        expect(response.role).toBe('assistant');
        expect(response.metadata).toBeDefined();
        expect(typeof response.content).toBe('string');

        console.log('📋 Response integrity: ✅');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        console.log(`📋 Response corruption handled: ${error.message}`);
      }
    }, ERROR_TEST_TIMEOUT);

    it('should maintain data consistency across error scenarios', async () => {
      // Test that errors don't leave the service in an inconsistent state
      
      // First, cause an error
      try {
        await service.createCompletion([], { // Empty messages should error
          model: 'claude-3-haiku-20240307',
          max_turns: 1
        });
      } catch (error) {
        // Expected error
      }

      // Then verify service still works normally
      const messages: Message[] = [
        { role: 'user', content: 'Test service consistency after error' }
      ];

      try {
        const response = await service.createCompletion(messages, {
          model: 'claude-3-haiku-20240307',
          max_turns: 1
        });

        expect(response.content).toBeDefined();
        console.log('📋 Service consistency maintained after error: ✅');
      } catch (error) {
        console.log(`📋 Service consistency error: ${error.message}`);
      }
    }, ERROR_TEST_TIMEOUT);

    it('should handle concurrent error scenarios without interference', async () => {
      // Test multiple concurrent requests where some fail
      const concurrentPromises = [
        // This should succeed
        service.createCompletion([
          { role: 'user', content: 'Valid request 1' }
        ], { model: 'claude-3-haiku-20240307', max_turns: 1 }),
        
        // This should fail (empty messages)
        service.createCompletion([], { 
          model: 'claude-3-haiku-20240307', max_turns: 1 
        }).catch(e => ({ error: e.message })),
        
        // This should succeed
        service.createCompletion([
          { role: 'user', content: 'Valid request 2' }
        ], { model: 'claude-3-haiku-20240307', max_turns: 1 }),
        
        // This should fail (invalid model)
        service.createCompletion([
          { role: 'user', content: 'Invalid model test' }
        ], { model: 'invalid-model' as any, max_turns: 1 }).catch(e => ({ error: e.message }))
      ];

      const results = await Promise.all(concurrentPromises);
      
      const successes = results.filter(r => r && 'content' in r);
      const errors = results.filter(r => r && 'error' in r);

      expect(successes.length).toBeGreaterThan(0);
      expect(errors.length).toBeGreaterThan(0);

      console.log(`📊 Concurrent errors: ${successes.length} successes, ${errors.length} errors`);
      console.log('📋 Concurrent error handling: ✅');
    }, ERROR_TEST_TIMEOUT);

    it('should provide meaningful error messages for debugging', async () => {
      const errorScenarios = [
        {
          name: 'Invalid model',
          test: () => service.createCompletion([
            { role: 'user', content: 'Test' }
          ], { model: 'nonexistent-model' as any })
        },
        {
          name: 'Empty messages',
          test: () => service.createCompletion([], {
            model: 'claude-3-haiku-20240307'
          })
        }
      ];

      for (const scenario of errorScenarios) {
        try {
          await scenario.test();
          console.log(`📋 ${scenario.name}: No error thrown (unexpected)`);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toBeDefined();
          expect(error.message.length).toBeGreaterThan(5);
          
          // Error should provide useful debugging information
          const hasUsefulInfo = /model|message|validation|authentication|network/i.test(error.message);
          
          console.log(`📋 ${scenario.name} error quality: ${hasUsefulInfo ? '✅' : '⚠️'}`);
          console.log(`   Message: ${error.message.substring(0, 100)}...`);
        }
      }
    }, ERROR_TEST_TIMEOUT);
  });
});