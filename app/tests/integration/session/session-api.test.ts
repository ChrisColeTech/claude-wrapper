/**
 * Session API Integration Tests
 * Tests the complete session management flow including middleware, routes, and storage
 */

import request from 'supertest';
import express from 'express';
import sessionRoutes from '../../../src/api/routes/sessions';
import { sessionProcessingMiddleware } from '../../../src/api/middleware/session';
import { sessionManager } from '../../../src/session/manager';
import { OpenAIMessage } from '../../../src/types';
import { setupTest, cleanupTest } from '../../setup/test-setup';
import '../../mocks/logger.mock';

// Mock async handler
jest.mock('../../../src/api/middleware/error', () => ({
  asyncHandler: (fn: any) => fn
}));

describe('Session API Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    setupTest();
    
    // Setup Express app with session middleware and routes
    app = express();
    app.use(express.json());
    app.use(sessionProcessingMiddleware);
    app.use('/', sessionRoutes);
    
    // Clear session manager
    sessionManager.shutdown();
    (sessionManager as any).sessions.clear();
  });

  afterEach(() => {
    cleanupTest();
    sessionManager.shutdown();
  });

  describe('Session Management Workflow', () => {
    test('should create and manage session through complete flow', async () => {
      const sessionId = 'integration-test-session';
      const initialMessages: OpenAIMessage[] = [
        { role: 'user', content: 'Hello, this is a test message' }
      ];

      // 1. Add messages to create session
      const addResponse = await request(app)
        .post(`/v1/sessions/${sessionId}/messages`)
        .send({ messages: initialMessages })
        .expect(200);

      expect(addResponse.body.session_id).toBe(sessionId);
      expect(addResponse.body.message_count).toBe(1);
      expect(addResponse.body.messages).toHaveLength(1);

      // 2. Verify session exists in list
      const listResponse = await request(app)
        .get('/v1/sessions')
        .expect(200);

      expect(listResponse.body.total).toBe(1);
      expect(listResponse.body.sessions[0].session_id).toBe(sessionId);

      // 3. Get specific session details
      const getResponse = await request(app)
        .get(`/v1/sessions/${sessionId}`)
        .expect(200);

      expect(getResponse.body.session_id).toBe(sessionId);
      expect(getResponse.body.messages).toHaveLength(1);
      expect(getResponse.body.messages[0].content).toBe('Hello, this is a test message');

      // 4. Add more messages to existing session
      const additionalMessages: OpenAIMessage[] = [
        { role: 'assistant', content: 'Hello! How can I help you?' },
        { role: 'user', content: 'Can you help me with programming?' }
      ];

      const addMoreResponse = await request(app)
        .post(`/v1/sessions/${sessionId}/messages`)
        .send({ messages: additionalMessages })
        .expect(200);

      expect(addMoreResponse.body.message_count).toBe(3);
      expect(addMoreResponse.body.messages).toHaveLength(3);

      // 5. Verify updated session
      const updatedGetResponse = await request(app)
        .get(`/v1/sessions/${sessionId}`)
        .expect(200);

      expect(updatedGetResponse.body.messages).toHaveLength(3);
      expect(updatedGetResponse.body.messages[2].content).toBe('Can you help me with programming?');

      // 6. Check session statistics
      const statsResponse = await request(app)
        .get('/v1/sessions/stats')
        .expect(200);

      expect(statsResponse.body.totalSessions).toBe(1);
      expect(statsResponse.body.activeSessions).toBe(1);
      expect(statsResponse.body.expiredSessions).toBe(0);
      expect(statsResponse.body.averageMessageCount).toBe(3);

      // 7. Delete session
      const deleteResponse = await request(app)
        .delete(`/v1/sessions/${sessionId}`)
        .expect(200);

      expect(deleteResponse.body.message).toContain('deleted successfully');
      expect(deleteResponse.body.session_id).toBe(sessionId);

      // 8. Verify session is gone
      await request(app)
        .get(`/v1/sessions/${sessionId}`)
        .expect(404);

      // 9. Verify empty session list
      const finalListResponse = await request(app)
        .get('/v1/sessions')
        .expect(200);

      expect(finalListResponse.body.total).toBe(0);
      expect(finalListResponse.body.sessions).toEqual([]);
    });

    test('should handle multiple concurrent sessions', async () => {
      const session1Id = 'concurrent-session-1';
      const session2Id = 'concurrent-session-2';
      const session3Id = 'concurrent-session-3';

      const messages1: OpenAIMessage[] = [
        { role: 'user', content: 'Session 1 message' }
      ];
      const messages2: OpenAIMessage[] = [
        { role: 'user', content: 'Session 2 message' },
        { role: 'assistant', content: 'Response for session 2' }
      ];
      const messages3: OpenAIMessage[] = [
        { role: 'user', content: 'Session 3 message' },
        { role: 'assistant', content: 'Response for session 3' },
        { role: 'user', content: 'Follow up for session 3' }
      ];

      // Create multiple sessions concurrently
      await Promise.all([
        request(app)
          .post(`/v1/sessions/${session1Id}/messages`)
          .send({ messages: messages1 }),
        request(app)
          .post(`/v1/sessions/${session2Id}/messages`)
          .send({ messages: messages2 }),
        request(app)
          .post(`/v1/sessions/${session3Id}/messages`)
          .send({ messages: messages3 })
      ]);

      // Verify all sessions exist
      const listResponse = await request(app)
        .get('/v1/sessions')
        .expect(200);

      expect(listResponse.body.total).toBe(3);
      
      const sessionIds = listResponse.body.sessions.map((s: any) => s.session_id);
      expect(sessionIds).toContain(session1Id);
      expect(sessionIds).toContain(session2Id);
      expect(sessionIds).toContain(session3Id);

      // Verify individual sessions have correct message counts
      const [get1, get2, get3] = await Promise.all([
        request(app).get(`/v1/sessions/${session1Id}`),
        request(app).get(`/v1/sessions/${session2Id}`),
        request(app).get(`/v1/sessions/${session3Id}`)
      ]);

      expect(get1.body.messages).toHaveLength(1);
      expect(get2.body.messages).toHaveLength(2);
      expect(get3.body.messages).toHaveLength(3);

      // Check statistics
      const statsResponse = await request(app)
        .get('/v1/sessions/stats')
        .expect(200);

      expect(statsResponse.body.totalSessions).toBe(3);
      expect(statsResponse.body.activeSessions).toBe(3);
      expect(statsResponse.body.averageMessageCount).toBe(2); // (1 + 2 + 3) / 3
    });

    test('should validate message formats correctly', async () => {
      const sessionId = 'validation-test-session';

      // Test invalid role
      await request(app)
        .post(`/v1/sessions/${sessionId}/messages`)
        .send({ 
          messages: [{ role: 'invalid', content: 'Test' }] 
        })
        .expect(400);

      // Test missing content
      await request(app)
        .post(`/v1/sessions/${sessionId}/messages`)
        .send({ 
          messages: [{ role: 'user' }] 
        })
        .expect(400);

      // Test missing messages array
      await request(app)
        .post(`/v1/sessions/${sessionId}/messages`)
        .send({})
        .expect(400);

      // Test non-array messages
      await request(app)
        .post(`/v1/sessions/${sessionId}/messages`)
        .send({ messages: 'not-an-array' })
        .expect(400);

      // Test valid messages after validation failures
      const validMessages: OpenAIMessage[] = [
        { role: 'user', content: 'Valid message' },
        { role: 'assistant', content: 'Valid response' }
      ];

      const validResponse = await request(app)
        .post(`/v1/sessions/${sessionId}/messages`)
        .send({ messages: validMessages })
        .expect(200);

      expect(validResponse.body.message_count).toBe(2);
    });

    test('should handle session not found scenarios', async () => {
      const nonExistentSessionId = 'non-existent-session';

      // Try to get non-existent session
      await request(app)
        .get(`/v1/sessions/${nonExistentSessionId}`)
        .expect(404);

      // Try to delete non-existent session
      await request(app)
        .delete(`/v1/sessions/${nonExistentSessionId}`)
        .expect(404);

      // Adding messages to non-existent session should create it
      const messages: OpenAIMessage[] = [
        { role: 'user', content: 'Creating new session' }
      ];

      await request(app)
        .post(`/v1/sessions/${nonExistentSessionId}/messages`)
        .send({ messages })
        .expect(200);

      // Now the session should exist
      await request(app)
        .get(`/v1/sessions/${nonExistentSessionId}`)
        .expect(200);
    });

    test('should handle large message volumes', async () => {
      const sessionId = 'large-volume-session';
      const largeMessageCount = 50;

      // Create many messages
      const messages: OpenAIMessage[] = [];
      for (let i = 0; i < largeMessageCount; i++) {
        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message number ${i + 1} with some content to test memory usage`
        });
      }

      const addResponse = await request(app)
        .post(`/v1/sessions/${sessionId}/messages`)
        .send({ messages })
        .expect(200);

      expect(addResponse.body.message_count).toBe(largeMessageCount);

      // Verify session was created with all messages
      const getResponse = await request(app)
        .get(`/v1/sessions/${sessionId}`)
        .expect(200);

      expect(getResponse.body.messages).toHaveLength(largeMessageCount);
      expect(getResponse.body.messages[0].content).toBe('Message number 1 with some content to test memory usage');
      expect(getResponse.body.messages[largeMessageCount - 1].content).toBe(`Message number ${largeMessageCount} with some content to test memory usage`);

      // Check memory stats
      const statsResponse = await request(app)
        .get('/v1/sessions/stats')
        .expect(200);

      expect(statsResponse.body.totalSessions).toBe(1);
      expect(statsResponse.body.averageMessageCount).toBe(largeMessageCount);
    });

    test('should handle all valid message roles', async () => {
      const sessionId = 'all-roles-session';
      
      const allRoleMessages: OpenAIMessage[] = [
        { role: 'system', content: 'System initialization message' },
        { role: 'user', content: 'User question' },
        { role: 'assistant', content: 'Assistant response' },
        { role: 'tool', content: 'Tool execution result', tool_call_id: 'call-123' }
      ];

      const addResponse = await request(app)
        .post(`/v1/sessions/${sessionId}/messages`)
        .send({ messages: allRoleMessages })
        .expect(200);

      expect(addResponse.body.message_count).toBe(4);

      const getResponse = await request(app)
        .get(`/v1/sessions/${sessionId}`)
        .expect(200);

      const messages = getResponse.body.messages;
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[2].role).toBe('assistant');
      expect(messages[3].role).toBe('tool');
      expect(messages[3].tool_call_id).toBe('call-123');
    });

    test('should maintain session isolation', async () => {
      const session1Id = 'isolation-session-1';
      const session2Id = 'isolation-session-2';

      // Add different messages to each session
      const messages1: OpenAIMessage[] = [
        { role: 'user', content: 'Session 1 specific content' }
      ];
      const messages2: OpenAIMessage[] = [
        { role: 'user', content: 'Session 2 specific content' }
      ];

      await request(app)
        .post(`/v1/sessions/${session1Id}/messages`)
        .send({ messages: messages1 })
        .expect(200);

      await request(app)
        .post(`/v1/sessions/${session2Id}/messages`)
        .send({ messages: messages2 })
        .expect(200);

      // Verify each session has its own messages
      const get1Response = await request(app)
        .get(`/v1/sessions/${session1Id}`)
        .expect(200);

      const get2Response = await request(app)
        .get(`/v1/sessions/${session2Id}`)
        .expect(200);

      expect(get1Response.body.messages[0].content).toBe('Session 1 specific content');
      expect(get2Response.body.messages[0].content).toBe('Session 2 specific content');

      // Add more messages to session 1 only
      await request(app)
        .post(`/v1/sessions/${session1Id}/messages`)
        .send({ 
          messages: [{ role: 'assistant', content: 'Response only for session 1' }] 
        })
        .expect(200);

      // Verify session 1 has 2 messages, session 2 still has 1
      const updated1Response = await request(app)
        .get(`/v1/sessions/${session1Id}`)
        .expect(200);

      const updated2Response = await request(app)
        .get(`/v1/sessions/${session2Id}`)
        .expect(200);

      expect(updated1Response.body.messages).toHaveLength(2);
      expect(updated2Response.body.messages).toHaveLength(1);
      expect(updated2Response.body.messages[0].content).toBe('Session 2 specific content');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON gracefully', async () => {
      const sessionId = 'malformed-json-session';

      // This should be handled by Express JSON middleware
      await request(app)
        .post(`/v1/sessions/${sessionId}/messages`)
        .send('{ invalid json }')
        .expect(400);

      // Express should handle the JSON parsing error
    });

    test('should handle empty session ID gracefully', async () => {
      // Try with empty session ID
      await request(app)
        .post('/v1/sessions//messages')
        .send({ messages: [{ role: 'user', content: 'test' }] })
        .expect(404); // Should not match route

      await request(app)
        .get('/v1/sessions/')
        .expect(200); // Should match sessions list route
    });

    test('should handle extremely long content', async () => {
      const sessionId = 'long-content-session';
      const longContent = 'A'.repeat(10000); // 10KB of content

      const messages: OpenAIMessage[] = [
        { role: 'user', content: longContent }
      ];

      const response = await request(app)
        .post(`/v1/sessions/${sessionId}/messages`)
        .send({ messages })
        .expect(200);

      expect(response.body.message_count).toBe(1);

      const getResponse = await request(app)
        .get(`/v1/sessions/${sessionId}`)
        .expect(200);

      expect(getResponse.body.messages[0].content).toBe(longContent);
    });
  });
});