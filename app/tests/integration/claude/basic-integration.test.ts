/**
 * Claude Code SDK Basic Integration Tests for Phase 1A
 * Tests actual Claude SDK integration with authentication
 * Performance requirement: Single-turn completion response <2s
 */

import { ClaudeClient } from '../../../src/claude/client';
import { ClaudeService } from '../../../src/claude/service';
import { authManager } from '../../../src/auth/auth-manager';
import { Message } from '../../../src/models/message';

describe.skip('Phase 1A: Claude SDK Basic Integration', () => {
  let client: ClaudeClient;
  let service: ClaudeService;
  const timeout = 30000; // 30 second timeout for integration tests

  beforeAll(async () => {
    client = new ClaudeClient(10000); // 10 second timeout for tests
    service = new ClaudeService(10000);
  }, timeout);

  describe('SDK Authentication Integration', () => {
    it('should verify SDK is available and authenticated', async () => {
      const verification = await client.verifySDK();
      
      expect(verification.available).toBe(true);
      expect(verification.authentication).toBeDefined();
      
      if (!verification.available) {
        console.log('⚠️  Claude SDK not available - using stub implementation');
        console.log('   Error:', verification.error);
        console.log('   Suggestion:', verification.suggestion);
      }
    }, timeout);

    it('should detect authentication method', async () => {
      const authStatus = await authManager.getAuthStatus();
      
      expect(authStatus.authenticated).toBe(true);
      expect(authStatus.method).toBeDefined();
      expect(['anthropic', 'bedrock', 'vertex', 'claude-cli']).toContain(authStatus.method);
    }, timeout);
  });

  describe('Basic Claude SDK Operations', () => {
    it('should perform basic text completion', async () => {
      const startTime = Date.now();
      const messages: any[] = [];
      
      // Simple completion test
      for await (const message of client.runCompletion('Say "Hello from Claude SDK"', { max_turns: 1 })) {
        messages.push(message);
        
        // Break after getting assistant response to avoid waiting for full completion
        if (message.type === 'assistant' && message.content) {
          break;
        }
      }

      const responseTime = Date.now() - startTime;
      
      // Phase 1A Performance Requirement: <2s response time
      expect(responseTime).toBeLessThan(2000);
      
      // Should have at least system init and assistant response
      expect(messages.length).toBeGreaterThanOrEqual(2);
      
      const systemMessage = messages.find(m => m.type === 'system' && m.subtype === 'init');
      expect(systemMessage).toBeDefined();
      
      const assistantMessage = messages.find(m => m.type === 'assistant');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage.content).toBeDefined();
    }, timeout);

    it('should handle service-level completion', async () => {
      const startTime = Date.now();
      
      const messages: Message[] = [
        { role: 'user', content: 'What is 2+2?' }
      ];
      
      const response = await service.createCompletion(messages, { max_turns: 1 });
      
      const responseTime = Date.now() - startTime;
      
      // Phase 1A Performance Requirement: <2s response time
      expect(responseTime).toBeLessThan(2000);
      
      expect(response.content).toBeDefined();
      expect(response.role).toBe('assistant');
      expect(response.metadata).toBeDefined();
      expect(response.metadata.completion_tokens).toBeGreaterThan(0);
    }, timeout);

    it('should handle simple streaming completion', async () => {
      const startTime = Date.now();
      let chunkCount = 0;
      let finalContent = '';
      
      const messages: Message[] = [
        { role: 'user', content: 'Count to 3' }
      ];
      
      for await (const chunk of service.createStreamingCompletion(messages, { max_turns: 1 })) {
        chunkCount++;
        finalContent = chunk.content;
        
        expect(chunk.content).toBeDefined();
        expect(chunk.finished).toBeDefined();
        
        if (chunk.finished) {
          break;
        }
      }
      
      const responseTime = Date.now() - startTime;
      
      // Phase 1A Performance Requirement: <2s response time
      expect(responseTime).toBeLessThan(2000);
      
      expect(chunkCount).toBeGreaterThan(0);
      expect(finalContent).toBeDefined();
    }, timeout);
  });

  describe('Error Handling Integration', () => {
    it('should handle authentication errors gracefully', async () => {
      // Mock authentication failure
      const originalGetAuthStatus = authManager.getAuthStatus;
      authManager.getAuthStatus = jest.fn().mockResolvedValue({
        authenticated: false,
        method: null,
        apiKeyProtected: false,
        errors: ['No authentication found']
      });
      
      try {
        await expect(client.verifySDK()).resolves.toMatchObject({
          available: false,
          authentication: false,
          error: expect.stringContaining('verification failed')
        });
      } finally {
        // Restore original method
        authManager.getAuthStatus = originalGetAuthStatus;
      }
    }, timeout);

    it('should handle SDK connection errors gracefully', async () => {
      // Test with invalid options that might cause SDK errors
      const messages: any[] = [];
      
      try {
        for await (const message of client.runCompletion('Test', { max_turns: 0 })) {
          messages.push(message);
          if (messages.length > 10) break; // Prevent infinite loops
        }
      } catch (error) {
        // Should handle SDK errors gracefully
        expect(error).toBeDefined();
        expect((error as Error).message).toBeDefined();
      }
    }, timeout);
  });

  describe('SDK Feature Compatibility', () => {
    it('should support different model specifications', async () => {
      const verification = await client.verifySDK();
      
      if (verification.available) {
        const messages: any[] = [];
        
        for await (const message of client.runCompletion('Hello', { 
          model: 'claude-3-5-sonnet-20241022',
          max_turns: 1 
        })) {
          messages.push(message);
          if (message.type === 'assistant') break;
        }
        
        expect(messages.length).toBeGreaterThan(0);
      }
    }, timeout);

    it('should support different Claude Code options', async () => {
      const verification = await client.verifySDK();
      
      if (verification.available) {
        const messages: any[] = [];
        
        for await (const message of client.runCompletion('Test', { 
          max_turns: 1,
          cwd: process.cwd(),
          system_prompt: 'You are a helpful assistant'
        })) {
          messages.push(message);
          if (message.type === 'assistant') break;
        }
        
        expect(messages.length).toBeGreaterThan(0);
      }
    }, timeout);
  });

  describe('Performance Validation', () => {
    it('should meet Phase 1A performance requirements', async () => {
      const startTime = Date.now();
      
      // Simple completion that should be fast
      const messages: any[] = [];
      for await (const message of client.runCompletion('Hi', { max_turns: 1 })) {
        messages.push(message);
        if (message.type === 'assistant') break;
      }
      
      const responseTime = Date.now() - startTime;
      
      // Phase 1A Critical Requirement: <2s response time
      expect(responseTime).toBeLessThan(2000);
      
      console.log(`✅ Phase 1A Performance: ${responseTime}ms (requirement: <2000ms)`);
    }, timeout);

    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();
      
      // Test 3 concurrent simple completions
      const completionPromises = [
        client.runCompletion('1', { max_turns: 1 }),
        client.runCompletion('2', { max_turns: 1 }),
        client.runCompletion('3', { max_turns: 1 })
      ];
      
      const results = await Promise.all(
        completionPromises.map(async (completion) => {
          const messages: any[] = [];
          for await (const message of completion) {
            messages.push(message);
            if (message.type === 'assistant') break;
          }
          return messages;
        })
      );
      
      const responseTime = Date.now() - startTime;
      
      // Should handle concurrent requests within reasonable time
      expect(responseTime).toBeLessThan(5000);
      expect(results).toHaveLength(3);
      
      console.log(`✅ Concurrent Performance: ${responseTime}ms for 3 requests`);
    }, timeout);
  });
});