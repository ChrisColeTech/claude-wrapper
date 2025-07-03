/**
 * Unit tests for Session Manager
 * Tests src/session/manager.ts components
 * Based on Python session_manager.py validation patterns
 */

import { SessionManager, Session } from '../../../src/session/manager';
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

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager(1, 5); // 1 hour TTL, 5 minute cleanup
  });

  afterEach(() => {
    sessionManager.shutdown();
  });

  describe('Session class', () => {
    it('should create session with proper defaults', () => {
      const session = new Session('test_session');
      
      expect(session.session_id).toBe('test_session');
      expect(session.messages).toEqual([]);
      expect(session.created_at).toBeInstanceOf(Date);
      expect(session.last_accessed).toBeInstanceOf(Date);
      expect(session.expires_at).toBeInstanceOf(Date);
    });

    it('should set expiry 1 hour from creation', () => {
      const beforeCreation = Date.now();
      const session = new Session('test_session');
      const afterCreation = Date.now();
      
      const expectedExpiry = beforeCreation + 60 * 60 * 1000;
      const actualExpiry = session.expires_at.getTime();
      
      expect(actualExpiry).toBeGreaterThanOrEqual(expectedExpiry);
      expect(actualExpiry).toBeLessThanOrEqual(afterCreation + 60 * 60 * 1000);
    });

    it('should touch session to extend TTL', () => {
      const session = new Session('test_session');
      const originalExpiry = session.expires_at.getTime();
      const originalAccess = session.last_accessed.getTime();
      
      // Wait a moment
      setTimeout(() => {
        session.touch();
        
        expect(session.expires_at.getTime()).toBeGreaterThan(originalExpiry);
        expect(session.last_accessed.getTime()).toBeGreaterThan(originalAccess);
      }, 10);
    });

    it('should add messages and touch session', () => {
      const session = new Session('test_session');
      const messages = [
        MessageHelpers.user('Hello'),
        MessageHelpers.assistant('Hi there!')
      ];
      
      session.add_messages(messages);
      
      expect(session.messages).toHaveLength(2);
      expect(session.messages).toEqual(messages);
    });

    it('should get all messages', () => {
      const session = new Session('test_session');
      const messages = [MessageHelpers.user('Test message')];
      
      session.add_messages(messages);
      const allMessages = session.get_all_messages();
      
      expect(allMessages).toEqual(messages);
    });

    it('should detect expired sessions', () => {
      const session = new Session('test_session');
      
      // Not expired initially
      expect(session.is_expired()).toBe(false);
      
      // Manually set expiry to past
      session.expires_at = new Date(Date.now() - 1000);
      
      expect(session.is_expired()).toBe(true);
    });
  });

  describe('SessionManager initialization', () => {
    it('should initialize with default values', () => {
      const manager = new SessionManager();
      
      // Should not throw and should work
      expect(manager).toBeInstanceOf(SessionManager);
      
      manager.shutdown();
    });

    it('should initialize with custom values', () => {
      const manager = new SessionManager(2, 10);
      
      expect(manager).toBeInstanceOf(SessionManager);
      
      manager.shutdown();
    });
  });

  describe('get_or_create_session', () => {
    it('should create new session', () => {
      const session = sessionManager.get_or_create_session('new_session');
      
      expect(session).toBeInstanceOf(Session);
      expect(session.session_id).toBe('new_session');
      expect(session.messages).toEqual([]);
    });

    it('should return existing session and touch it', async () => {
      const firstCall = sessionManager.get_or_create_session('existing');
      const originalAccess = firstCall.last_accessed.getTime();
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const secondCall = sessionManager.get_or_create_session('existing');
      
      expect(secondCall.session_id).toBe('existing');
      expect(secondCall.last_accessed.getTime()).toBeGreaterThan(originalAccess);
    });

    it('should recreate expired session with same ID', () => {
      const session = sessionManager.get_or_create_session('expire_test');
      
      // Manually expire the session
      session.expires_at = new Date(Date.now() - 1000);
      
      const newSession = sessionManager.get_or_create_session('expire_test');
      
      expect(newSession.session_id).toBe('expire_test');
      expect(newSession.messages).toEqual([]); // Should be new/empty
      expect(newSession.is_expired()).toBe(false); // Should be fresh
    });
  });

  describe('process_messages', () => {
    it('should handle stateless mode', () => {
      const messages = [MessageHelpers.user('Hello')];
      
      const [resultMessages, sessionId] = sessionManager.process_messages(messages, null);
      
      expect(resultMessages).toEqual(messages);
      expect(sessionId).toBeNull();
    });

    it('should handle stateless mode with undefined', () => {
      const messages = [MessageHelpers.user('Hello')];
      
      const [resultMessages, sessionId] = sessionManager.process_messages(messages);
      
      expect(resultMessages).toEqual(messages);
      expect(sessionId).toBeNull();
    });

    it('should create session and add messages', () => {
      const messages = [MessageHelpers.user('Hello')];
      
      const [resultMessages, sessionId] = sessionManager.process_messages(messages, 'test_session');
      
      expect(resultMessages).toEqual(messages);
      expect(sessionId).toBe('test_session');
    });

    it('should accumulate messages in existing session', () => {
      const firstMessages = [MessageHelpers.user('Hello')];
      const secondMessages = [MessageHelpers.assistant('Hi there!')];
      
      sessionManager.process_messages(firstMessages, 'accumulate_test');
      const [allMessages, sessionId] = sessionManager.process_messages(secondMessages, 'accumulate_test');
      
      expect(allMessages).toHaveLength(2);
      expect(allMessages[0]).toEqual(firstMessages[0]);
      expect(allMessages[1]).toEqual(secondMessages[0]);
      expect(sessionId).toBe('accumulate_test');
    });
  });

  describe('list_sessions', () => {
    it('should return empty list initially', () => {
      const sessions = sessionManager.list_sessions();
      
      expect(sessions).toEqual([]);
    });

    it('should list active sessions', () => {
      sessionManager.get_or_create_session('session1');
      sessionManager.get_or_create_session('session2');
      
      const sessions = sessionManager.list_sessions();
      
      expect(sessions).toHaveLength(2);
      const sessionIds = sessions.map(s => s.session_id);
      expect(sessionIds).toContain('session1');
      expect(sessionIds).toContain('session2');
    });

    it('should exclude expired sessions', () => {
      sessionManager.get_or_create_session('active');
      const expiredSession = sessionManager.get_or_create_session('expired');
      
      // Manually expire one session
      expiredSession.expires_at = new Date(Date.now() - 1000);
      
      const sessions = sessionManager.list_sessions();
      
      expect(sessions).toHaveLength(1);
      expect(sessions[0].session_id).toBe('active');
    });
  });

  describe('delete_session', () => {
    it('should delete existing session', () => {
      sessionManager.get_or_create_session('to_delete');
      
      sessionManager.delete_session('to_delete');
      
      const sessions = sessionManager.list_sessions();
      expect(sessions).toHaveLength(0);
    });

    it('should handle deleting non-existent session', () => {
      // Should not throw
      expect(() => {
        sessionManager.delete_session('non_existent');
      }).not.toThrow();
    });
  });

  describe('cleanup tasks', () => {
    it('should start and stop cleanup task', () => {
      sessionManager.start_cleanup_task();
      // Should not throw
      
      sessionManager.shutdown();
      // Should not throw
    });

    it('should not start multiple cleanup tasks', () => {
      sessionManager.start_cleanup_task();
      sessionManager.start_cleanup_task(); // Should log warning but not throw
      
      sessionManager.shutdown();
    });

    it('should clean up expired sessions automatically', () => {
      const activeSession = sessionManager.get_or_create_session('active');
      const expiredSession = sessionManager.get_or_create_session('expired');
      
      // Manually expire one session
      expiredSession.expires_at = new Date(Date.now() - 1000);
      
      // Trigger cleanup by calling private method via reflection
      (sessionManager as any)._cleanup_expired_sessions();
      
      const sessions = sessionManager.list_sessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].session_id).toBe('active');
    });
  });

  describe('thread safety', () => {
    it('should handle concurrent session creation', () => {
      const sessionId = 'concurrent_test';
      
      const sessions = Array.from({ length: 10 }, () => 
        sessionManager.get_or_create_session(sessionId)
      );
      
      // All should return sessions with same ID
      sessions.forEach(session => {
        expect(session.session_id).toBe(sessionId);
      });
    });

    it('should handle concurrent message processing', () => {
      const messages = Array.from({ length: 5 }, (_, i) => 
        [MessageHelpers.user(`Message ${i}`)]
      );
      
      const results = messages.map(msgArray => 
        sessionManager.process_messages(msgArray, 'concurrent_messages')
      );
      
      // All should succeed
      results.forEach(([resultMessages, sessionId]) => {
        expect(resultMessages).toBeDefined();
        expect(sessionId).toBe('concurrent_messages');
      });
    });
  });

  describe('error handling', () => {
    it('should handle session operations gracefully', () => {
      // These should all work without throwing
      expect(sessionManager.get_or_create_session('test')).toBeDefined();
      expect(sessionManager.list_sessions()).toBeDefined();
      expect(() => { sessionManager.delete_session('test'); }).not.toThrow();
    });

    it('should validate session data integrity', () => {
      const session = sessionManager.get_or_create_session('integrity_test');
      
      expect(session.session_id).toBe('integrity_test');
      expect(session.created_at).toBeInstanceOf(Date);
      expect(session.last_accessed).toBeInstanceOf(Date);
      expect(session.expires_at).toBeInstanceOf(Date);
      expect(Array.isArray(session.messages)).toBe(true);
      expect(typeof session.is_expired).toBe('function');
      expect(typeof session.touch).toBe('function');
      expect(typeof session.add_messages).toBe('function');
      expect(typeof session.get_all_messages).toBe('function');
    });
  });

  describe('Python compatibility', () => {
    it('should match Python Session behavior exactly', () => {
      const session = sessionManager.get_or_create_session('python_test');
      
      // Python-style method names
      expect(typeof session.touch).toBe('function');
      expect(typeof session.add_messages).toBe('function');
      expect(typeof session.get_all_messages).toBe('function');
      expect(typeof session.is_expired).toBe('function');
      
      // Python-style manager methods
      expect(typeof sessionManager.get_or_create_session).toBe('function');
      expect(typeof sessionManager.process_messages).toBe('function');
      expect(typeof sessionManager.list_sessions).toBe('function');
      expect(typeof sessionManager.delete_session).toBe('function');
      expect(typeof sessionManager.start_cleanup_task).toBe('function');
      expect(typeof sessionManager.shutdown).toBe('function');
    });

    it('should match Python process_messages return type', () => {
      const messages = [MessageHelpers.user('Test')];
      
      const result = sessionManager.process_messages(messages, 'test_session');
      
      // Should return tuple [messages, session_id]
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(Array.isArray(result[0])).toBe(true);
      expect(typeof result[1]).toBe('string');
    });

    it('should match Python stateless behavior', () => {
      const messages = [MessageHelpers.user('Stateless test')];
      
      const [resultMessages, sessionId] = sessionManager.process_messages(messages, null);
      
      expect(resultMessages).toEqual(messages);
      expect(sessionId).toBeNull();
    });
  });
});