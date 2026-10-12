import { SessionManager } from '../../../src/session/manager';
import { OpenAIMessage } from '../../../src/types';

describe('Session Integration', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  afterEach(() => {
    sessionManager.shutdown();
  });

  it('should create and retrieve a session', () => {
    const sessionId = 'test-session-1';
    const session = sessionManager.getOrCreateSession(sessionId);
    
    expect(session).toBeDefined();
    expect(session.session_id).toBe(sessionId);
    expect(session.messages).toEqual([]);
    
    const retrievedSession = sessionManager.getSession(sessionId);
    expect(retrievedSession).toBeDefined();
    expect(retrievedSession?.session_id).toBe(sessionId);
  });

  it('should process messages and add to session', () => {
    const sessionId = 'test-session-2';
    
    const messages: OpenAIMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ];
    
    const [processedMessages, resultSessionId] = sessionManager.processMessages(messages, sessionId);
    
    expect(processedMessages).toHaveLength(2);
    expect(processedMessages[0]?.role).toBe('user');
    expect(processedMessages[1]?.role).toBe('assistant');
    expect(resultSessionId).toBe(sessionId);
  });

  it('should get session info', () => {
    const sessionId = 'test-session-3';
    sessionManager.getOrCreateSession(sessionId);
    
    const info = sessionManager.getSession(sessionId);
    
    expect(info).toBeDefined();
    expect(info?.session_id).toBe(sessionId);
    expect(info?.messages).toHaveLength(0);
    expect(info?.created_at).toBeDefined();
    expect(info?.last_accessed).toBeDefined();
  });

  it('should list all sessions', () => {
    const sessionId1 = 'test-session-4';
    const sessionId2 = 'test-session-5';
    
    sessionManager.getOrCreateSession(sessionId1);
    sessionManager.getOrCreateSession(sessionId2);
    
    const sessions = sessionManager.listSessions();
    
    expect(sessions).toHaveLength(2);
    expect(sessions.some(s => s.session_id === sessionId1)).toBe(true);
    expect(sessions.some(s => s.session_id === sessionId2)).toBe(true);
  });

  it('should delete a session', () => {
    const sessionId = 'test-session-6';
    sessionManager.getOrCreateSession(sessionId);
    
    expect(sessionManager.getSession(sessionId)).toBeDefined();
    
    sessionManager.deleteSession(sessionId);
    
    expect(sessionManager.getSession(sessionId)).toBeNull();
  });

  it('should get session count', () => {
    const sessionId1 = 'test-session-7';
    const sessionId2 = 'test-session-8';
    
    sessionManager.getOrCreateSession(sessionId1);
    sessionManager.getOrCreateSession(sessionId2);
    
    const count = sessionManager.getSessionCount();
    expect(count).toBe(2);
  });

  it('should get session stats', () => {
    const sessionId = 'test-session-9';
    sessionManager.getOrCreateSession(sessionId);
    
    const stats = sessionManager.getSessionStats();
    
    expect(stats).toBeDefined();
    expect(stats.totalSessions).toBe(1);
    expect(stats.activeSessions).toBe(1);
    expect(stats.expiredSessions).toBe(0);
  });
});