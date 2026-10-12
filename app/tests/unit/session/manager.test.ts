/**
 * Session Manager Unit Tests
 * Tests core session management functionality without external dependencies
 */

import { SessionManager, Session } from '../../../src/session/manager';
import { OpenAIMessage } from '../../../src/types';
import { SESSION_CONFIG } from '../../../src/config/constants';
import { setupTest, cleanupTest, createTestMessages, mockDate } from '../../setup/test-setup';
import '../../mocks/logger.mock';

describe('Session Class', () => {
  const sessionId = 'test-session-123';
  let session: Session;

  beforeEach(() => {
    setupTest();
    session = new Session(sessionId);
  });

  afterEach(() => {
    cleanupTest();
  });

  describe('Constructor', () => {
    test('should initialize with correct session_id', () => {
      expect(session.session_id).toBe(sessionId);
    });

    test('should initialize with empty messages array', () => {
      expect(session.messages).toEqual([]);
      expect(Array.isArray(session.messages)).toBe(true);
    });

    test('should set created_at to current time', () => {
      const now = Date.now();
      const sessionTime = session.created_at.getTime();
      expect(sessionTime).toBeGreaterThanOrEqual(now - 1000);
      expect(sessionTime).toBeLessThanOrEqual(now + 1000);
    });

    test('should set last_accessed to current time', () => {
      const now = Date.now();
      const accessTime = session.last_accessed.getTime();
      expect(accessTime).toBeGreaterThanOrEqual(now - 1000);
      expect(accessTime).toBeLessThanOrEqual(now + 1000);
    });

    test('should set expires_at based on TTL configuration', () => {
      const expectedExpiry = Date.now() + SESSION_CONFIG.DEFAULT_TTL_HOURS * 60 * 60 * 1000;
      const actualExpiry = session.expires_at.getTime();
      expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(1000);
    });
  });

  describe('touch method', () => {
    test('should update last_accessed timestamp', () => {
      const originalAccess = session.last_accessed.getTime();
      
      // Mock time advancement
      const futureTime = Date.now() + 5000;
      const restoreDate = mockDate(futureTime);
      
      session.touch();
      
      expect(session.last_accessed.getTime()).toBe(futureTime);
      expect(session.last_accessed.getTime()).toBeGreaterThan(originalAccess);
      
      restoreDate();
    });

    test('should update expires_at timestamp', () => {
      const originalExpiry = session.expires_at.getTime();
      
      // Mock time advancement
      const futureTime = Date.now() + 5000;
      const restoreDate = mockDate(futureTime);
      
      session.touch();
      
      const expectedExpiry = futureTime + SESSION_CONFIG.DEFAULT_TTL_HOURS * 60 * 60 * 1000;
      expect(session.expires_at.getTime()).toBe(expectedExpiry);
      expect(session.expires_at.getTime()).toBeGreaterThan(originalExpiry);
      
      restoreDate();
    });
  });

  describe('addMessages method', () => {
    test('should add messages to empty session', () => {
      const messages = createTestMessages(2);
      session.addMessages(messages);
      
      expect(session.messages).toEqual(messages);
      expect(session.messages.length).toBe(2);
    });

    test('should append messages to existing messages', () => {
      const firstMessages = createTestMessages(2);
      const secondMessages = createTestMessages(1);
      
      session.addMessages(firstMessages);
      session.addMessages(secondMessages);
      
      expect(session.messages.length).toBe(3);
      expect(session.messages).toEqual([...firstMessages, ...secondMessages]);
    });

    test('should limit messages to MAX_MESSAGE_HISTORY', () => {
      const maxMessages = SESSION_CONFIG.MAX_MESSAGE_HISTORY;
      const excessMessages: OpenAIMessage[] = [];
      
      // Create messages beyond the limit
      for (let i = 0; i < maxMessages + 5; i++) {
        excessMessages.push({ role: 'user', content: `Message ${i}` });
      }
      
      session.addMessages(excessMessages);
      
      expect(session.messages.length).toBe(maxMessages);
      expect(session.messages[0]?.content).toBe('Message 5');
      expect(session.messages[maxMessages - 1]?.content).toBe(`Message ${maxMessages + 4}`);
    });

    test('should call touch when adding messages', () => {
      const originalAccess = session.last_accessed.getTime();
      const messages = createTestMessages(1);
      
      // Mock time advancement
      const futureTime = Date.now() + 1000;
      const restoreDate = mockDate(futureTime);
      
      session.addMessages(messages);
      
      expect(session.last_accessed.getTime()).toBeGreaterThan(originalAccess);
      
      restoreDate();
    });
  });

  describe('getAllMessages method', () => {
    test('should return empty array for new session', () => {
      const messages = session.getAllMessages();
      expect(messages).toEqual([]);
      expect(Array.isArray(messages)).toBe(true);
    });

    test('should return all messages', () => {
      const testMessages = createTestMessages(3);
      session.addMessages(testMessages);
      
      const retrievedMessages = session.getAllMessages();
      expect(retrievedMessages).toEqual(testMessages);
    });

    test('should return copy of messages array', () => {
      const testMessages = createTestMessages(2);
      session.addMessages(testMessages);
      
      const retrievedMessages = session.getAllMessages();
      retrievedMessages.push({ role: 'user', content: 'Modified' });
      
      expect(session.messages.length).toBe(2);
      expect(retrievedMessages.length).toBe(3);
    });
  });

  describe('isExpired method', () => {
    test('should return false for new session', () => {
      expect(session.isExpired()).toBe(false);
    });

    test('should return true for expired session', () => {
      session.expires_at = new Date(Date.now() - 1000);
      expect(session.isExpired()).toBe(true);
    });

    test('should return false for session expiring in future', () => {
      session.expires_at = new Date(Date.now() + 3600000);
      expect(session.isExpired()).toBe(false);
    });
  });

  describe('toSessionInfo method', () => {
    test('should return complete session information', () => {
      const messages = createTestMessages(2);
      session.addMessages(messages);
      
      const sessionInfo = session.toSessionInfo();
      
      expect(sessionInfo.session_id).toBe(sessionId);
      expect(sessionInfo.messages).toEqual(messages);
      expect(sessionInfo.created_at).toBe(session.created_at);
      expect(sessionInfo.last_accessed).toBe(session.last_accessed);
      expect(sessionInfo.expires_at).toBe(session.expires_at);
    });

    test('should return deep copy of messages', () => {
      const messages = createTestMessages(1);
      session.addMessages(messages);
      
      const sessionInfo = session.toSessionInfo();
      sessionInfo.messages.push({ role: 'user', content: 'Modified' });
      
      expect(session.messages.length).toBe(1);
      expect(sessionInfo.messages.length).toBe(2);
    });
  });
});

describe('SessionManager Class', () => {
  let sessionManager: SessionManager;
  const testSessionId = 'test-session-456';

  beforeEach(() => {
    setupTest();
    sessionManager = new SessionManager();
  });

  afterEach(() => {
    cleanupTest();
    sessionManager.shutdown();
  });

  describe('Constructor', () => {
    test('should initialize with default configuration', () => {
      expect(sessionManager).toBeDefined();
      expect(sessionManager.getSessionCount()).toBe(0);
    });

    test('should initialize with custom configuration', () => {
      const customManager = new SessionManager(2, 10);
      expect(customManager).toBeDefined();
      expect(customManager.getSessionCount()).toBe(0);
      customManager.shutdown();
    });
  });

  describe('getOrCreateSession method', () => {
    test('should create new session when none exists', () => {
      const sessionInfo = sessionManager.getOrCreateSession(testSessionId);
      
      expect(sessionInfo.session_id).toBe(testSessionId);
      expect(sessionInfo.messages).toEqual([]);
      expect(sessionManager.getSessionCount()).toBe(1);
    });

    test('should return existing valid session', () => {
      const firstCall = sessionManager.getOrCreateSession(testSessionId);
      const secondCall = sessionManager.getOrCreateSession(testSessionId);
      
      expect(secondCall.session_id).toBe(firstCall.session_id);
      expect(secondCall.created_at).toEqual(firstCall.created_at);
      expect(sessionManager.getSessionCount()).toBe(1);
    });

    test('should touch existing session on retrieval', () => {
      const firstCall = sessionManager.getOrCreateSession(testSessionId);
      const originalAccess = firstCall.last_accessed.getTime();
      
      // Mock time advancement
      const futureTime = Date.now() + 2000;
      const restoreDate = mockDate(futureTime);
      
      const secondCall = sessionManager.getOrCreateSession(testSessionId);
      
      expect(secondCall.last_accessed.getTime()).toBeGreaterThan(originalAccess);
      
      restoreDate();
    });

    test('should create new session when existing is expired', () => {
      // Create session
      const firstSession = sessionManager.getOrCreateSession(testSessionId);
      const firstCreatedTime = firstSession.created_at.getTime();
      
      // Access internal session and expire it
      const internalSessions = (sessionManager as any).sessions;
      const session = internalSessions.get(testSessionId);
      session.expires_at = new Date(Date.now() - 1000);
      
      // Wait a small amount to ensure timestamp difference
      jest.advanceTimersByTime(10);
      
      // Get session again
      const newSession = sessionManager.getOrCreateSession(testSessionId);
      
      expect(newSession.session_id).toBe(testSessionId);
      expect(newSession.created_at.getTime()).toBeGreaterThanOrEqual(firstCreatedTime);
      expect(sessionManager.getSessionCount()).toBe(1);
    });
  });

  describe('processMessages method', () => {
    test('should handle stateless requests (null sessionId)', () => {
      const messages = createTestMessages(2);
      const [processedMessages, returnedSessionId] = sessionManager.processMessages(messages, null);
      
      expect(processedMessages).toEqual(messages);
      expect(returnedSessionId).toBeNull();
      expect(sessionManager.getSessionCount()).toBe(0);
    });

    test('should handle stateless requests (undefined sessionId)', () => {
      const messages = createTestMessages(2);
      const [processedMessages, returnedSessionId] = sessionManager.processMessages(messages, undefined);
      
      expect(processedMessages).toEqual(messages);
      expect(returnedSessionId).toBeNull();
      expect(sessionManager.getSessionCount()).toBe(0);
    });

    test('should process first message in session', () => {
      const messages = createTestMessages(1);
      const [processedMessages, returnedSessionId] = sessionManager.processMessages(messages, testSessionId);
      
      expect(processedMessages).toEqual(messages);
      expect(returnedSessionId).toBe(testSessionId);
      expect(sessionManager.getSessionCount()).toBe(1);
    });

    test('should accumulate messages across requests', () => {
      const firstMessages = createTestMessages(1);
      const secondMessages = createTestMessages(1);
      
      // First request
      const [first] = sessionManager.processMessages(firstMessages, testSessionId);
      expect(first).toEqual(firstMessages);
      
      // Second request should include history
      const [second] = sessionManager.processMessages(secondMessages, testSessionId);
      expect(second).toEqual([...firstMessages, ...secondMessages]);
      
      expect(sessionManager.getSessionCount()).toBe(1);
    });
  });

  describe('listSessions method', () => {
    test('should return empty array when no sessions exist', () => {
      const sessions = sessionManager.listSessions();
      expect(sessions).toEqual([]);
      expect(Array.isArray(sessions)).toBe(true);
    });

    test('should return active sessions only', () => {
      const activeSessionId = 'active-session';
      const expiredSessionId = 'expired-session';
      
      // Create sessions
      sessionManager.getOrCreateSession(activeSessionId);
      sessionManager.getOrCreateSession(expiredSessionId);
      
      // Expire one session
      const internalSessions = (sessionManager as any).sessions;
      const expiredSession = internalSessions.get(expiredSessionId);
      expiredSession.expires_at = new Date(Date.now() - 1000);
      
      const activeSessions = sessionManager.listSessions();
      expect(activeSessions.length).toBe(1);
      expect(activeSessions[0]?.session_id).toBe(activeSessionId);
    });

    test('should return multiple active sessions', () => {
      const sessionIds = ['session1', 'session2', 'session3'];
      
      sessionIds.forEach(id => sessionManager.getOrCreateSession(id));
      
      const sessions = sessionManager.listSessions();
      expect(sessions.length).toBe(3);
      
      const returnedIds = sessions.map(s => s.session_id);
      sessionIds.forEach(id => expect(returnedIds).toContain(id));
    });
  });

  describe('deleteSession method', () => {
    test('should delete existing session', () => {
      sessionManager.getOrCreateSession(testSessionId);
      expect(sessionManager.getSessionCount()).toBe(1);
      
      sessionManager.deleteSession(testSessionId);
      expect(sessionManager.getSessionCount()).toBe(0);
    });

    test('should handle deletion of non-existent session', () => {
      expect(() => sessionManager.deleteSession('non-existent')).not.toThrow();
      expect(sessionManager.getSessionCount()).toBe(0);
    });

    test('should only delete specified session', () => {
      const sessionId1 = 'session1';
      const sessionId2 = 'session2';
      
      sessionManager.getOrCreateSession(sessionId1);
      sessionManager.getOrCreateSession(sessionId2);
      expect(sessionManager.getSessionCount()).toBe(2);
      
      sessionManager.deleteSession(sessionId1);
      expect(sessionManager.getSessionCount()).toBe(1);
      
      const remainingSessions = sessionManager.listSessions();
      expect(remainingSessions[0]?.session_id).toBe(sessionId2);
    });
  });

  describe('getSessionCount method', () => {
    test('should return 0 for empty manager', () => {
      expect(sessionManager.getSessionCount()).toBe(0);
    });

    test('should return correct count with sessions', () => {
      sessionManager.getOrCreateSession('session1');
      expect(sessionManager.getSessionCount()).toBe(1);
      
      sessionManager.getOrCreateSession('session2');
      expect(sessionManager.getSessionCount()).toBe(2);
      
      sessionManager.deleteSession('session1');
      expect(sessionManager.getSessionCount()).toBe(1);
    });
  });

  describe('getSessionStats method', () => {
    test('should return zero stats for empty manager', () => {
      const stats = sessionManager.getSessionStats();
      
      expect(stats.totalSessions).toBe(0);
      expect(stats.activeSessions).toBe(0);
      expect(stats.expiredSessions).toBe(0);
      expect(stats.averageMessageCount).toBe(0);
      expect(stats.oldestSessionAge).toBe(0);
    });

    test('should calculate correct stats with active sessions', () => {
      const sessionId1 = 'session1';
      const sessionId2 = 'session2';
      
      // Create sessions with different message counts
      sessionManager.processMessages([{ role: 'user', content: 'Hello' }], sessionId1);
      
      // Wait a moment to ensure age difference
      jest.advanceTimersByTime(100);
      
      sessionManager.processMessages([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
        { role: 'user', content: 'How are you?' }
      ], sessionId2);
      
      const stats = sessionManager.getSessionStats();
      
      expect(stats.totalSessions).toBe(2);
      expect(stats.activeSessions).toBe(2);
      expect(stats.expiredSessions).toBe(0);
      expect(stats.averageMessageCount).toBe(2); // (1 + 3) / 2
      expect(stats.oldestSessionAge).toBeGreaterThanOrEqual(0);
    });

    test('should count expired sessions correctly', () => {
      const activeSessionId = 'active';
      const expiredSessionId = 'expired';
      
      sessionManager.getOrCreateSession(activeSessionId);
      sessionManager.getOrCreateSession(expiredSessionId);
      
      // Expire one session
      const internalSessions = (sessionManager as any).sessions;
      const expiredSession = internalSessions.get(expiredSessionId);
      expiredSession.expires_at = new Date(Date.now() - 1000);
      
      const stats = sessionManager.getSessionStats();
      
      expect(stats.totalSessions).toBe(2);
      expect(stats.activeSessions).toBe(1);
      expect(stats.expiredSessions).toBe(1);
    });
  });

  describe('addAssistantResponse method', () => {
    test('should add response to existing session', () => {
      const assistantMessage: OpenAIMessage = {
        role: 'assistant',
        content: 'Assistant response'
      };
      
      sessionManager.getOrCreateSession(testSessionId);
      sessionManager.addAssistantResponse(testSessionId, assistantMessage);
      
      const session = sessionManager.getSession(testSessionId);
      expect(session?.messages).toContain(assistantMessage);
      expect(session?.messages.length).toBe(1);
    });

    test('should handle non-existent session gracefully', () => {
      const assistantMessage: OpenAIMessage = {
        role: 'assistant',
        content: 'Response'
      };
      
      expect(() => {
        sessionManager.addAssistantResponse('non-existent', assistantMessage);
      }).not.toThrow();
      
      expect(sessionManager.getSessionCount()).toBe(0);
    });

    test('should handle expired session gracefully', () => {
      const assistantMessage: OpenAIMessage = {
        role: 'assistant',
        content: 'Response'
      };
      
      sessionManager.getOrCreateSession(testSessionId);
      
      // Expire the session
      const internalSessions = (sessionManager as any).sessions;
      const session = internalSessions.get(testSessionId);
      session.expires_at = new Date(Date.now() - 1000);
      
      expect(() => {
        sessionManager.addAssistantResponse(testSessionId, assistantMessage);
      }).not.toThrow();
    });
  });

  describe('getSession method', () => {
    test('should return null for non-existent session', () => {
      const session = sessionManager.getSession('non-existent');
      expect(session).toBeNull();
    });

    test('should return session info for existing session', () => {
      const messages = createTestMessages(2);
      sessionManager.processMessages(messages, testSessionId);
      
      const session = sessionManager.getSession(testSessionId);
      
      expect(session).not.toBeNull();
      expect(session?.session_id).toBe(testSessionId);
      expect(session?.messages).toEqual(messages);
    });

    test('should return null for expired session', () => {
      sessionManager.getOrCreateSession(testSessionId);
      
      // Expire the session
      const internalSessions = (sessionManager as any).sessions;
      const session = internalSessions.get(testSessionId);
      session.expires_at = new Date(Date.now() - 1000);
      
      const retrievedSession = sessionManager.getSession(testSessionId);
      expect(retrievedSession).toBeNull();
    });
  });

  describe('cleanup functionality', () => {
    test('should handle cleanup task lifecycle', () => {
      expect(sessionManager.isRunning()).toBe(false);
      
      sessionManager.startCleanupTask();
      // In test environment, task doesn't actually start
      expect(() => sessionManager.startCleanupTask()).not.toThrow();
      
      sessionManager.shutdown();
      expect(sessionManager.isRunning()).toBe(false);
    });

    test('should handle multiple shutdown calls', () => {
      sessionManager.shutdown();
      expect(() => sessionManager.shutdown()).not.toThrow();
      expect(sessionManager.isRunning()).toBe(false);
    });
  });
});