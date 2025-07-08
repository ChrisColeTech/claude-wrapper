/**
 * Session Routes Unit Tests
 * Tests session API routes functionality without external dependencies
 */

import request from 'supertest';
import express from 'express';
import sessionRoutes from '../../../src/api/routes/sessions';
import { SessionManager } from '../../../src/session/manager';
import { SessionInfo, SessionStats } from '../../../src/types';
import { setupTest, cleanupTest, createTestMessages, createValidSession } from '../../setup/test-setup';
import '../../mocks/logger.mock';

// Mock session manager
jest.mock('../../../src/session/manager', () => ({
  sessionManager: {
    listSessions: jest.fn(),
    getSessionStats: jest.fn(),
    getSession: jest.fn(),
    deleteSession: jest.fn(),
    getOrCreateSession: jest.fn(),
    processMessages: jest.fn()
  }
}));

// Mock async handler
jest.mock('../../../src/api/middleware/error', () => ({
  asyncHandler: (fn: any) => fn
}));

describe('Session Routes', () => {
  let app: express.Application;
  let mockSessionManager: jest.Mocked<SessionManager>;

  beforeEach(() => {
    setupTest();
    
    // Setup Express app with routes
    app = express();
    app.use(express.json());
    app.use('/', sessionRoutes);
    
    // Setup mock session manager
    mockSessionManager = require('../../../src/session/manager').sessionManager;
    mockSessionManager.listSessions.mockClear();
    mockSessionManager.getSessionStats.mockClear();
    mockSessionManager.getSession.mockClear();
    mockSessionManager.deleteSession.mockClear();
    mockSessionManager.getOrCreateSession.mockClear();
    mockSessionManager.processMessages.mockClear();
  });

  afterEach(() => {
    cleanupTest();
  });

  describe('GET /v1/sessions', () => {
    test('should return empty sessions list', async () => {
      mockSessionManager.listSessions.mockReturnValue([]);

      const response = await request(app)
        .get('/v1/sessions')
        .expect(200);

      expect(response.body).toEqual({
        sessions: [],
        total: 0
      });

      expect(mockSessionManager.listSessions).toHaveBeenCalledWith();
    });

    test('should return sessions list with data', async () => {
      const testSessions = [
        createValidSession('session1', createTestMessages(2)),
        createValidSession('session2', createTestMessages(1))
      ];

      mockSessionManager.listSessions.mockReturnValue(testSessions);

      const response = await request(app)
        .get('/v1/sessions')
        .expect(200);

      expect(response.body.total).toBe(2);
      expect(response.body.sessions).toHaveLength(2);
      expect(response.body.sessions[0].session_id).toBe('session1');
      expect(response.body.sessions[1].session_id).toBe('session2');

      expect(mockSessionManager.listSessions).toHaveBeenCalledWith();
    });

    test('should handle large number of sessions', async () => {
      const manySessions: SessionInfo[] = [];
      for (let i = 0; i < 100; i++) {
        manySessions.push(createValidSession(`session${i}`, []));
      }

      mockSessionManager.listSessions.mockReturnValue(manySessions);

      const response = await request(app)
        .get('/v1/sessions')
        .expect(200);

      expect(response.body.total).toBe(100);
      expect(response.body.sessions).toHaveLength(100);
    });
  });

  describe('GET /v1/sessions/stats', () => {
    test('should return session statistics', async () => {
      const testStats: SessionStats = {
        totalSessions: 5,
        activeSessions: 3,
        expiredSessions: 2,
        averageMessageCount: 2.5,
        oldestSessionAge: 3600
      };

      mockSessionManager.getSessionStats.mockReturnValue(testStats);

      const response = await request(app)
        .get('/v1/sessions/stats')
        .expect(200);

      expect(response.body).toEqual(testStats);
      expect(mockSessionManager.getSessionStats).toHaveBeenCalledWith();
    });

    test('should return zero stats when no sessions', async () => {
      const emptyStats: SessionStats = {
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0,
        averageMessageCount: 0,
        oldestSessionAge: 0
      };

      mockSessionManager.getSessionStats.mockReturnValue(emptyStats);

      const response = await request(app)
        .get('/v1/sessions/stats')
        .expect(200);

      expect(response.body).toEqual(emptyStats);
    });
  });

  describe('GET /v1/sessions/:sessionId', () => {
    test('should return session when found', async () => {
      const testSessionId = 'test-session-123';
      const testSession = createValidSession(testSessionId, createTestMessages(3));

      mockSessionManager.getSession.mockReturnValue(testSession);

      const response = await request(app)
        .get(`/v1/sessions/${testSessionId}`)
        .expect(200);

      expect(response.body.session_id).toBe(testSessionId);
      expect(response.body.messages).toHaveLength(3);
      expect(typeof response.body.created_at).toBe('string');
      expect(typeof response.body.expires_at).toBe('string');
      expect(typeof response.body.last_accessed).toBe('string');
      expect(mockSessionManager.getSession).toHaveBeenCalledWith(testSessionId);
    });

    test('should return 404 when session not found', async () => {
      const testSessionId = 'non-existent-session';

      mockSessionManager.getSession.mockReturnValue(null);

      const response = await request(app)
        .get(`/v1/sessions/${testSessionId}`)
        .expect(404);

      expect(response.body).toEqual({
        error: {
          message: `Session not found: ${testSessionId}`,
          type: 'session_not_found',
          code: '404'
        }
      });

      expect(mockSessionManager.getSession).toHaveBeenCalledWith(testSessionId);
    });

    test('should handle session with empty messages', async () => {
      const testSessionId = 'empty-session';
      const testSession = createValidSession(testSessionId, []);

      mockSessionManager.getSession.mockReturnValue(testSession);

      const response = await request(app)
        .get(`/v1/sessions/${testSessionId}`)
        .expect(200);

      expect(response.body.messages).toEqual([]);
    });

    test('should handle session with special characters in ID', async () => {
      const testSessionId = 'session-with-special-chars_123';
      const testSession = createValidSession(testSessionId, createTestMessages(1));

      mockSessionManager.getSession.mockReturnValue(testSession);

      const response = await request(app)
        .get(`/v1/sessions/${testSessionId}`)
        .expect(200);

      expect(response.body.session_id).toBe(testSessionId);
    });
  });

  describe('DELETE /v1/sessions/:sessionId', () => {
    test('should delete existing session', async () => {
      const testSessionId = 'session-to-delete';
      const testSession = createValidSession(testSessionId, createTestMessages(1));

      mockSessionManager.getSession.mockReturnValue(testSession);
      mockSessionManager.deleteSession.mockReturnValue(undefined);

      const response = await request(app)
        .delete(`/v1/sessions/${testSessionId}`)
        .expect(200);

      expect(response.body).toEqual({
        message: `Session ${testSessionId} deleted successfully`,
        session_id: testSessionId
      });

      expect(mockSessionManager.getSession).toHaveBeenCalledWith(testSessionId);
      expect(mockSessionManager.deleteSession).toHaveBeenCalledWith(testSessionId);
    });

    test('should return 404 when trying to delete non-existent session', async () => {
      const testSessionId = 'non-existent-session';

      mockSessionManager.getSession.mockReturnValue(null);

      const response = await request(app)
        .delete(`/v1/sessions/${testSessionId}`)
        .expect(404);

      expect(response.body).toEqual({
        error: {
          message: `Session not found: ${testSessionId}`,
          type: 'session_not_found',
          code: '404'
        }
      });

      expect(mockSessionManager.getSession).toHaveBeenCalledWith(testSessionId);
      expect(mockSessionManager.deleteSession).not.toHaveBeenCalled();
    });

    test('should handle deletion with special session ID', async () => {
      const testSessionId = 'special-session_with-chars-123';
      const testSession = createValidSession(testSessionId, []);

      mockSessionManager.getSession.mockReturnValue(testSession);
      mockSessionManager.deleteSession.mockReturnValue(undefined);

      const response = await request(app)
        .delete(`/v1/sessions/${testSessionId}`)
        .expect(200);

      expect(response.body.session_id).toBe(testSessionId);
    });
  });

  describe('POST /v1/sessions/:sessionId/messages', () => {
    test('should add messages to session successfully', async () => {
      const testSessionId = 'session-for-messages';
      const inputMessages = createTestMessages(2);
      const allMessages = createTestMessages(4);
      const testSession = createValidSession(testSessionId, []);

      mockSessionManager.getOrCreateSession.mockReturnValue(testSession);
      mockSessionManager.processMessages.mockReturnValue([allMessages, testSessionId]);

      const response = await request(app)
        .post(`/v1/sessions/${testSessionId}/messages`)
        .send({ messages: inputMessages })
        .expect(200);

      expect(response.body).toEqual({
        session_id: testSessionId,
        message_count: allMessages.length,
        messages: allMessages
      });

      expect(mockSessionManager.getOrCreateSession).toHaveBeenCalledWith(testSessionId);
      expect(mockSessionManager.processMessages).toHaveBeenCalledWith(inputMessages, testSessionId);
    });

    test('should return 400 when messages are missing', async () => {
      const testSessionId = 'session-missing-messages';

      const response = await request(app)
        .post(`/v1/sessions/${testSessionId}/messages`)
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: {
          message: 'Messages array is required',
          type: 'invalid_request',
          code: '400'
        }
      });

      expect(mockSessionManager.getOrCreateSession).not.toHaveBeenCalled();
    });

    test('should return 400 when messages is not an array', async () => {
      const testSessionId = 'session-invalid-messages';

      const response = await request(app)
        .post(`/v1/sessions/${testSessionId}/messages`)
        .send({ messages: 'not-an-array' })
        .expect(400);

      expect(response.body).toEqual({
        error: {
          message: 'Messages array is required',
          type: 'invalid_request',
          code: '400'
        }
      });
    });

    test('should return 400 when message has invalid role', async () => {
      const testSessionId = 'session-invalid-role';
      const invalidMessages = [
        { role: 'invalid-role', content: 'Test message' }
      ];

      const response = await request(app)
        .post(`/v1/sessions/${testSessionId}/messages`)
        .send({ messages: invalidMessages })
        .expect(400);

      expect(response.body).toEqual({
        error: {
          message: 'Invalid message role. Must be one of: system, user, assistant, tool',
          type: 'invalid_request',
          code: '400'
        }
      });
    });

    test('should return 400 when message has missing role', async () => {
      const testSessionId = 'session-missing-role';
      const invalidMessages = [
        { content: 'Test message without role' }
      ];

      const response = await request(app)
        .post(`/v1/sessions/${testSessionId}/messages`)
        .send({ messages: invalidMessages })
        .expect(400);

      expect(response.body).toEqual({
        error: {
          message: 'Invalid message role. Must be one of: system, user, assistant, tool',
          type: 'invalid_request',
          code: '400'
        }
      });
    });

    test('should return 400 when message has missing content', async () => {
      const testSessionId = 'session-missing-content';
      const invalidMessages = [
        { role: 'user' }
      ];

      const response = await request(app)
        .post(`/v1/sessions/${testSessionId}/messages`)
        .send({ messages: invalidMessages })
        .expect(400);

      expect(response.body).toEqual({
        error: {
          message: 'Message content is required',
          type: 'invalid_request',
          code: '400'
        }
      });
    });

    test('should return 400 when message has null content', async () => {
      const testSessionId = 'session-null-content';
      const invalidMessages = [
        { role: 'user', content: null }
      ];

      const response = await request(app)
        .post(`/v1/sessions/${testSessionId}/messages`)
        .send({ messages: invalidMessages })
        .expect(400);

      expect(response.body).toEqual({
        error: {
          message: 'Message content is required',
          type: 'invalid_request',
          code: '400'
        }
      });
    });

    test('should accept all valid message roles', async () => {
      const testSessionId = 'session-all-roles';
      const validMessages = [
        { role: 'system' as const, content: 'System message' },
        { role: 'user' as const, content: 'User message' },
        { role: 'assistant' as const, content: 'Assistant message' },
        { role: 'tool' as const, content: 'Tool message' }
      ];
      const testSession = createValidSession(testSessionId, []);

      mockSessionManager.getOrCreateSession.mockReturnValue(testSession);
      mockSessionManager.processMessages.mockReturnValue([validMessages, testSessionId]);

      const response = await request(app)
        .post(`/v1/sessions/${testSessionId}/messages`)
        .send({ messages: validMessages })
        .expect(200);

      expect(response.body.session_id).toBe(testSessionId);
      expect(mockSessionManager.processMessages).toHaveBeenCalledWith(validMessages, testSessionId);
    });

    test('should handle empty messages array', async () => {
      const testSessionId = 'session-empty-messages';
      const emptyMessages: any[] = [];
      const testSession = createValidSession(testSessionId, []);

      mockSessionManager.getOrCreateSession.mockReturnValue(testSession);
      mockSessionManager.processMessages.mockReturnValue([emptyMessages, testSessionId]);

      const response = await request(app)
        .post(`/v1/sessions/${testSessionId}/messages`)
        .send({ messages: emptyMessages })
        .expect(200);

      expect(response.body).toEqual({
        session_id: testSessionId,
        message_count: 0,
        messages: []
      });
    });

    test('should validate multiple messages correctly', async () => {
      const testSessionId = 'session-multiple-validation';
      const mixedMessages = [
        { role: 'user', content: 'Valid message' },
        { role: 'invalid-role', content: 'Invalid message' }
      ];

      const response = await request(app)
        .post(`/v1/sessions/${testSessionId}/messages`)
        .send({ messages: mixedMessages })
        .expect(400);

      expect(response.body.error.message).toContain('Invalid message role');
      expect(mockSessionManager.getOrCreateSession).not.toHaveBeenCalled();
    });

    test('should handle messages with empty string content', async () => {
      const testSessionId = 'session-empty-content';
      const messagesWithEmptyContent = [
        { role: 'user' as const, content: '' }
      ];
      const testSession = createValidSession(testSessionId, []);

      mockSessionManager.getOrCreateSession.mockReturnValue(testSession);
      mockSessionManager.processMessages.mockReturnValue([messagesWithEmptyContent, testSessionId]);

      const response = await request(app)
        .post(`/v1/sessions/${testSessionId}/messages`)
        .send({ messages: messagesWithEmptyContent })
        .expect(200);

      expect(response.body.session_id).toBe(testSessionId);
    });

    test('should handle messages with optional tool_call_id', async () => {
      const testSessionId = 'session-tool-calls';
      const toolMessages = [
        { role: 'tool' as const, content: 'Tool response', tool_call_id: 'call-123' }
      ];
      const testSession = createValidSession(testSessionId, []);

      mockSessionManager.getOrCreateSession.mockReturnValue(testSession);
      mockSessionManager.processMessages.mockReturnValue([toolMessages, testSessionId]);

      const response = await request(app)
        .post(`/v1/sessions/${testSessionId}/messages`)
        .send({ messages: toolMessages })
        .expect(200);

      expect(response.body.session_id).toBe(testSessionId);
    });
  });
});