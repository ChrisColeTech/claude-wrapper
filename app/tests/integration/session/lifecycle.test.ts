/**
 * Integration tests for complete session lifecycle
 * Tests the complete flow from session creation to cleanup
 * Based on Python session_manager.py integration patterns
 */

import { SessionManager, Session } from '../../../src/session/manager';
import { EnhancedMemorySessionStorage } from '../../../src/session/storage';
import { MessageHelpers } from '../../../src/models/message';

// Mock logger to avoid console output during tests
jest.mock('../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('Session Lifecycle Integration', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager(1, 5); // 1 hour TTL, 5 minute cleanup
  });

  afterEach(() => {
    sessionManager.shutdown();
  });

  describe('Complete session workflow', () => {
    it('should handle complete chat session lifecycle', () => {
      const sessionId = 'chat_session_test';
      
      // 1. Start stateless conversation
      const initialMessages = [
        MessageHelpers.user('Hello, I need help with TypeScript')
      ];
      
      const [statelessResult, statelessSessionId] = sessionManager.process_messages(initialMessages, null);
      
      expect(statelessResult).toEqual(initialMessages);
      expect(statelessSessionId).toBeNull();
      
      // 2. Start session-based conversation
      const [sessionResult1, returnedSessionId1] = sessionManager.process_messages(
        initialMessages, 
        sessionId
      );
      
      expect(sessionResult1).toEqual(initialMessages);
      expect(returnedSessionId1).toBe(sessionId);
      
      // 3. Continue conversation with more messages
      const followupMessages = [
        MessageHelpers.assistant('I can help you with TypeScript! What specific topic?'),
        MessageHelpers.user('I want to learn about interfaces')
      ];
      
      const [sessionResult2, returnedSessionId2] = sessionManager.process_messages(
        followupMessages,
        sessionId
      );
      
      expect(sessionResult2).toHaveLength(3); // All previous + new messages
      expect(sessionResult2[0]).toEqual(initialMessages[0]);
      expect(sessionResult2[1]).toEqual(followupMessages[0]);
      expect(sessionResult2[2]).toEqual(followupMessages[1]);
      expect(returnedSessionId2).toBe(sessionId);
      
      // 4. Add more conversation
      const moreMessages = [
        MessageHelpers.assistant('TypeScript interfaces define the shape of objects...'),
        MessageHelpers.user('Can you show me an example?')
      ];
      
      const [sessionResult3, returnedSessionId3] = sessionManager.process_messages(
        moreMessages,
        sessionId
      );
      
      expect(sessionResult3).toHaveLength(5); // All messages accumulated
      expect(returnedSessionId3).toBe(sessionId);
      
      // 5. Verify session exists in list
      const allSessions = sessionManager.list_sessions();
      expect(allSessions).toHaveLength(1);
      expect(allSessions[0].session_id).toBe(sessionId);
      expect(allSessions[0].messages).toHaveLength(5);
      
      // 6. Delete session
      sessionManager.delete_session(sessionId);
      
      // 7. Verify session is gone
      const remainingSessions = sessionManager.list_sessions();
      expect(remainingSessions).toHaveLength(0);
    });

    it('should handle multiple concurrent sessions', () => {
      const sessionIds = ['session1', 'session2', 'session3'];
      const conversations = sessionIds.map(id => ({
        id,
        messages: [
          MessageHelpers.user(`Hello from ${id}`),
          MessageHelpers.assistant(`Hi there from ${id}!`)
        ]
      }));
      
      // Start all sessions
      conversations.forEach(conv => {
        const [result, returnedId] = sessionManager.process_messages(
          [conv.messages[0]], 
          conv.id
        );
        expect(result).toEqual([conv.messages[0]]);
        expect(returnedId).toBe(conv.id);
      });
      
      // Continue all conversations
      conversations.forEach(conv => {
        const [result, returnedId] = sessionManager.process_messages(
          [conv.messages[1]], 
          conv.id
        );
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(conv.messages[0]);
        expect(result[1]).toEqual(conv.messages[1]);
        expect(returnedId).toBe(conv.id);
      });
      
      // Verify all sessions exist
      const allSessions = sessionManager.list_sessions();
      expect(allSessions).toHaveLength(3);
      
      const sessionIdList = allSessions.map(s => s.session_id);
      sessionIds.forEach(id => {
        expect(sessionIdList).toContain(id);
      });
      
      // Clean up sessions
      sessionIds.forEach(id => {
        sessionManager.delete_session(id);
      });
      
      expect(sessionManager.list_sessions()).toHaveLength(0);
    });

    it('should handle session expiration and recreation', () => {
      const sessionId = 'expiration_test';
      
      // 1. Create session
      const session = sessionManager.get_or_create_session(sessionId);
      expect(session.session_id).toBe(sessionId);
      
      // 2. Manually expire the session
      session.expires_at = new Date(Date.now() - 1000);
      
      // 3. Try to get the session again - should create new one
      const newSession = sessionManager.get_or_create_session(sessionId);
      expect(newSession.session_id).toBe(sessionId);
      expect(newSession.messages).toHaveLength(0); // Should be fresh
      expect(newSession.is_expired()).toBe(false);
      
      // 4. Add messages to new session
      const messages = [MessageHelpers.user('Hello again')];
      const [result, returnedId] = sessionManager.process_messages(messages, sessionId);
      
      expect(result).toEqual(messages);
      expect(returnedId).toBe(sessionId);
    });

    it('should handle automatic cleanup of expired sessions', () => {
      const activeSessionId = 'active_session';
      const expiredSessionId = 'expired_session';
      
      // Create active session
      const activeSession = sessionManager.get_or_create_session(activeSessionId);
      const activeMessages = [MessageHelpers.user('I am active')];
      sessionManager.process_messages(activeMessages, activeSessionId);
      
      // Create expired session
      const expiredSession = sessionManager.get_or_create_session(expiredSessionId);
      const expiredMessages = [MessageHelpers.user('I will expire')];
      sessionManager.process_messages(expiredMessages, expiredSessionId);
      
      // Verify both sessions exist initially (before expiring)
      let allSessions = sessionManager.list_sessions();
      expect(allSessions).toHaveLength(2);
      
      // Manually expire one session
      expiredSession.expires_at = new Date(Date.now() - 1000);
      
      // Trigger cleanup manually
      (sessionManager as any)._cleanup_expired_sessions();
      
      // Verify only active session remains (list_sessions filters expired automatically)
      allSessions = sessionManager.list_sessions();
      expect(allSessions).toHaveLength(1);
      expect(allSessions[0].session_id).toBe(activeSessionId);
    });

    it('should handle mixed stateless and session-based processing', () => {
      const sessionId = 'mixed_test';
      
      // 1. Process some messages statelessly
      const stateless1 = [MessageHelpers.user('Stateless message 1')];
      const [result1, id1] = sessionManager.process_messages(stateless1, null);
      expect(result1).toEqual(stateless1);
      expect(id1).toBeNull();
      
      // 2. Process messages with session
      const session1 = [MessageHelpers.user('Session message 1')];
      const [result2, id2] = sessionManager.process_messages(session1, sessionId);
      expect(result2).toEqual(session1);
      expect(id2).toBe(sessionId);
      
      // 3. More stateless processing
      const stateless2 = [MessageHelpers.user('Stateless message 2')];
      const [result3, id3] = sessionManager.process_messages(stateless2, undefined);
      expect(result3).toEqual(stateless2);
      expect(id3).toBeNull();
      
      // 4. Continue the session
      const session2 = [MessageHelpers.assistant('Session response')];
      const [result4, id4] = sessionManager.process_messages(session2, sessionId);
      expect(result4).toHaveLength(2); // Both session messages
      expect(result4[0]).toEqual(session1[0]);
      expect(result4[1]).toEqual(session2[0]);
      expect(id4).toBe(sessionId);
      
      // 5. Verify only session was stored
      const allSessions = sessionManager.list_sessions();
      expect(allSessions).toHaveLength(1);
      expect(allSessions[0].session_id).toBe(sessionId);
      expect(allSessions[0].messages).toHaveLength(2);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle empty message arrays gracefully', () => {
      const sessionId = 'empty_test';
      
      // Process empty message array in stateless mode
      const [result1, id1] = sessionManager.process_messages([], null);
      expect(result1).toEqual([]);
      expect(id1).toBeNull();
      
      // Process empty message array with session
      const [result2, id2] = sessionManager.process_messages([], sessionId);
      expect(result2).toEqual([]);
      expect(id2).toBe(sessionId);
      
      // Verify session was created but has no messages
      const sessions = sessionManager.list_sessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].session_id).toBe(sessionId);
      expect(sessions[0].messages).toHaveLength(0);
    });

    it('should handle deleting non-existent sessions gracefully', () => {
      expect(() => {
        sessionManager.delete_session('non_existent_session');
      }).not.toThrow();
      
      expect(sessionManager.list_sessions()).toHaveLength(0);
    });

    it('should handle session recreation with same ID', () => {
      const sessionId = 'recreation_test';
      
      // Create and populate session
      const messages1 = [MessageHelpers.user('First conversation')];
      const [result1, id1] = sessionManager.process_messages(messages1, sessionId);
      expect(result1).toEqual(messages1);
      expect(id1).toBe(sessionId);
      
      // Delete session
      sessionManager.delete_session(sessionId);
      expect(sessionManager.list_sessions()).toHaveLength(0);
      
      // Recreate session with same ID
      const messages2 = [MessageHelpers.user('New conversation')];
      const [result2, id2] = sessionManager.process_messages(messages2, sessionId);
      expect(result2).toEqual(messages2); // Should only have new messages
      expect(id2).toBe(sessionId);
      
      // Verify new session exists with only new messages
      const sessions = sessionManager.list_sessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].session_id).toBe(sessionId);
      expect(sessions[0].messages).toEqual(messages2);
    });
  });

  describe('Background cleanup integration', () => {
    it('should start and stop cleanup task without errors', () => {
      expect(() => {
        sessionManager.start_cleanup_task();
      }).not.toThrow();
      
      expect(() => {
        sessionManager.shutdown();
      }).not.toThrow();
    });

    it('should handle multiple cleanup task start attempts', () => {
      sessionManager.start_cleanup_task();
      
      // Should not throw when starting again
      expect(() => {
        sessionManager.start_cleanup_task();
      }).not.toThrow();
      
      sessionManager.shutdown();
    });
  });

  describe('Performance and scalability', () => {
    it('should handle large numbers of sessions efficiently', () => {
      const sessionCount = 100;
      const sessionIds: string[] = [];
      
      // Create many sessions
      for (let i = 0; i < sessionCount; i++) {
        const sessionId = `performance_test_${i}`;
        sessionIds.push(sessionId);
        
        const messages = [MessageHelpers.user(`Message from session ${i}`)];
        const [result, returnedId] = sessionManager.process_messages(messages, sessionId);
        
        expect(result).toEqual(messages);
        expect(returnedId).toBe(sessionId);
      }
      
      // Verify all sessions exist
      const allSessions = sessionManager.list_sessions();
      expect(allSessions).toHaveLength(sessionCount);
      
      // Clean up all sessions
      sessionIds.forEach(id => {
        sessionManager.delete_session(id);
      });
      
      expect(sessionManager.list_sessions()).toHaveLength(0);
    });

    it('should handle long conversation histories', () => {
      const sessionId = 'long_conversation';
      const messageCount = 50;
      
      // Add many messages to single session
      for (let i = 0; i < messageCount; i++) {
        const message = i % 2 === 0 
          ? MessageHelpers.user(`User message ${i}`)
          : MessageHelpers.assistant(`Assistant message ${i}`);
        
        const [result, returnedId] = sessionManager.process_messages([message], sessionId);
        
        expect(result).toHaveLength(i + 1);
        expect(returnedId).toBe(sessionId);
      }
      
      // Verify session has all messages
      const sessions = sessionManager.list_sessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].messages).toHaveLength(messageCount);
    });
  });
});