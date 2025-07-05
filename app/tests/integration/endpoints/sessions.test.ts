/**
 * Comprehensive Integration Test Suite for Sessions Endpoints
 * Phase 13A Implementation: Complete session endpoints integration tests
 * Based on Python main.py:772-817 session endpoints behavior
 */

import request from 'supertest';
import express from 'express';
import { SessionsRouter } from '../../../src/routes/sessions';
import { SessionService } from '../../../src/services/session-service';
import { authMiddleware } from '../../../src/auth/middleware';

// Mock the SessionService class
jest.mock('../../../src/services/session-service');

// Mock dependencies
jest.mock('../../../src/auth/middleware', () => ({
  authMiddleware: jest.fn(() => (_req: any, _res: any, next: any) => next())
}));

jest.mock('../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('Sessions Endpoints Integration Tests', () => {
  let app: express.Application;
  let mockSessionService: jest.Mocked<SessionService>;

  beforeEach(() => {
    // Create Express app with sessions router
    app = express();
    app.use(express.json());
    
    // Mock auth middleware to allow all requests
    (authMiddleware as jest.Mock).mockImplementation(() => 
      (_req: any, _res: any, next: any) => next()
    );

    // Setup the mocked SessionService instance
    mockSessionService = {
      getSessionStats: jest.fn(),
      listSessions: jest.fn(),
      getSession: jest.fn(),
      deleteSession: jest.fn(),
      getConfig: jest.fn(),
      getExpiredSessionCount: jest.fn(),
      isHealthy: jest.fn(),
      cleanupExpiredSessions: jest.fn(),
      createSession: jest.fn(),
      updateSession: jest.fn(),
      shutdown: jest.fn()
    } as any;

    // Mock the SessionService constructor to return our mock instance
    (SessionService as jest.MockedClass<typeof SessionService>).mockImplementation(() => mockSessionService);

    // Mount the sessions router
    app.use(SessionsRouter.createRouter());

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('GET /v1/sessions/stats', () => {
    it('should return session statistics successfully', async () => {
      const mockStats = {
        activeSessions: 3,
        totalMessages: 15,
        avgMessagesPerSession: 5.0,
        oldestSession: new Date('2024-01-01T10:00:00Z'),
        newestSession: new Date('2024-01-01T15:00:00Z')
      };

      const mockConfig = {
        cleanupIntervalMinutes: 5,
        defaultTtlHours: 1,
        maxSessionsPerUser: 100,
        maxMessagesPerSession: 1000,
        enableAutoCleanup: true,
        enableToolStateTracking: true,
        toolStateCleanupIntervalMinutes: 10
      };

      mockSessionService.getSessionStats.mockReturnValue(mockStats);
      mockSessionService.getConfig.mockReturnValue(mockConfig);
      mockSessionService.getExpiredSessionCount.mockReturnValue(2);

      const response = await request(app)
        .get('/v1/sessions/stats')
        .expect(200);

      // Verify Python-compatible response format
      expect(response.body).toEqual({
        session_stats: {
          active_sessions: mockStats.activeSessions,
          expired_sessions: 2, // From mock
          total_messages: mockStats.totalMessages
        },
        cleanup_interval_minutes: 5,
        default_ttl_hours: 1
      });

      expect(mockSessionService.getSessionStats).toHaveBeenCalledTimes(1);
      expect(mockSessionService.getConfig).toHaveBeenCalledTimes(1);
    });

    it('should return 500 when session service fails', async () => {
      mockSessionService.getSessionStats.mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      const response = await request(app)
        .get('/v1/sessions/stats')
        .expect(500);

      expect(response.body).toEqual({
        detail: 'Failed to get session statistics'
      });
    });

    it('should handle empty statistics correctly', async () => {
      const mockEmptyStats = {
        activeSessions: 0,
        totalMessages: 0,
        avgMessagesPerSession: 0,
        oldestSession: null,
        newestSession: null
      };

      const mockConfig = {
        cleanupIntervalMinutes: 10,
        defaultTtlHours: 2,
        maxSessionsPerUser: 50,
        maxMessagesPerSession: 500,
        enableAutoCleanup: false,
        enableToolStateTracking: true,
        toolStateCleanupIntervalMinutes: 10
      };

      mockSessionService.getSessionStats.mockReturnValue(mockEmptyStats);
      mockSessionService.getConfig.mockReturnValue(mockConfig);
      mockSessionService.getExpiredSessionCount.mockReturnValue(0);

      const response = await request(app)
        .get('/v1/sessions/stats')
        .expect(200);

      expect(response.body).toEqual({
        session_stats: {
          active_sessions: mockEmptyStats.activeSessions,
          expired_sessions: 0,
          total_messages: mockEmptyStats.totalMessages
        },
        cleanup_interval_minutes: 10,
        default_ttl_hours: 2
      });
    });
  });

  describe('GET /v1/sessions', () => {
    it('should return list of sessions successfully', async () => {
      const mockSessionList = {
        sessions: [
          {
            session_id: 'session_1',
            created_at: new Date('2024-01-01T10:00:00Z'),
            last_accessed: new Date('2024-01-01T10:30:00Z'),
            message_count: 3,
            expires_at: new Date('2024-01-01T11:00:00Z')
          },
          {
            session_id: 'session_2',
            created_at: new Date('2024-01-01T11:00:00Z'),
            last_accessed: new Date('2024-01-01T11:15:00Z'),
            message_count: 2,
            expires_at: new Date('2024-01-01T12:00:00Z')
          }
        ],
        total: 2
      };

      mockSessionService.listSessions.mockReturnValue(mockSessionList);

      const response = await request(app)
        .get('/v1/sessions')
        .expect(200);

      // Dates get serialized to ISO strings in JSON response
      const expectedSessionList = {
        sessions: mockSessionList.sessions.map(session => ({
          session_id: session.session_id,
          created_at: session.created_at.toISOString(),
          last_accessed: session.last_accessed.toISOString(),
          message_count: session.message_count,
          expires_at: session.expires_at.toISOString()
        })),
        total: mockSessionList.total
      };
      expect(response.body).toEqual(expectedSessionList);
      expect(mockSessionService.listSessions).toHaveBeenCalledTimes(1);
    });

    it('should return empty list when no sessions exist', async () => {
      const mockEmptyList = {
        sessions: [],
        total: 0
      };

      mockSessionService.listSessions.mockReturnValue(mockEmptyList);

      const response = await request(app)
        .get('/v1/sessions')
        .expect(200);

      expect(response.body).toEqual(mockEmptyList);
    });

    it('should return 500 when listing sessions fails', async () => {
      mockSessionService.listSessions.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .get('/v1/sessions')
        .expect(500);

      expect(response.body).toEqual({
        detail: 'Failed to list sessions'
      });
    });

    it('should handle Content-Type header correctly', async () => {
      const mockSessionList = {
        sessions: [],
        total: 0
      };

      mockSessionService.listSessions.mockReturnValue(mockSessionList);

      const response = await request(app)
        .get('/v1/sessions')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual(mockSessionList);
    });
  });

  describe('GET /v1/sessions/:session_id', () => {
    it('should return session info when session exists', async () => {
      const sessionId = 'test_session_123';
      const mockSessionInfo = {
        session_id: sessionId,
        created_at: new Date('2024-01-01T10:00:00Z'),
        last_accessed: new Date('2024-01-01T10:30:00Z'),
        message_count: 5,
        expires_at: new Date('2024-01-01T11:00:00Z'),
        // Extended properties for test compatibility
        id: sessionId,
        model: 'claude-3-sonnet-20240229',
        system_prompt: 'You are a helpful assistant.',
        max_turns: 10,
        status: 'active' as const
      };

      mockSessionService.getSession.mockReturnValue(mockSessionInfo);

      const response = await request(app)
        .get(`/v1/sessions/${sessionId}`)
        .expect(200);

      // Dates get serialized to ISO strings in JSON response
      expect(response.body).toEqual({
        session_id: mockSessionInfo.session_id,
        created_at: mockSessionInfo.created_at.toISOString(),
        last_accessed: mockSessionInfo.last_accessed.toISOString(),
        message_count: mockSessionInfo.message_count,
        expires_at: mockSessionInfo.expires_at.toISOString()
      });
      expect(mockSessionService.getSession).toHaveBeenCalledWith(sessionId);
    });

    it('should return 404 when session does not exist', async () => {
      const sessionId = 'nonexistent_session';

      mockSessionService.getSession.mockReturnValue(null);

      const response = await request(app)
        .get(`/v1/sessions/${sessionId}`)
        .expect(404);

      expect(response.body).toEqual({
        detail: `Session ${sessionId} not found`
      });
    });

    it('should return 500 when session service fails', async () => {
      const sessionId = 'error_session';

      mockSessionService.getSession.mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await request(app)
        .get(`/v1/sessions/${sessionId}`)
        .expect(500);

      expect(response.body).toEqual({
        detail: 'Internal Server Error'
      });
    });

    it('should handle special characters in session ID', async () => {
      const sessionId = 'session_with-special_chars_123';
      const mockSessionInfo = {
        session_id: sessionId,
        created_at: new Date('2024-01-01T10:00:00Z'),
        last_accessed: new Date('2024-01-01T10:30:00Z'),
        message_count: 1,
        expires_at: new Date('2024-01-01T11:00:00Z'),
        // Extended properties for test compatibility
        id: sessionId,
        model: 'claude-3-sonnet-20240229',
        system_prompt: 'You are a helpful assistant.',
        max_turns: 10,
        status: 'active' as const
      };

      mockSessionService.getSession.mockReturnValue(mockSessionInfo);

      const response = await request(app)
        .get(`/v1/sessions/${encodeURIComponent(sessionId)}`)
        .expect(200);

      // Dates get serialized to ISO strings in JSON response
      expect(response.body).toEqual({
        session_id: mockSessionInfo.session_id,
        created_at: mockSessionInfo.created_at.toISOString(),
        last_accessed: mockSessionInfo.last_accessed.toISOString(),
        message_count: mockSessionInfo.message_count,
        expires_at: mockSessionInfo.expires_at.toISOString()
      });
    });

    it('should handle URL-encoded session IDs correctly', async () => {
      const sessionId = 'session with spaces';
      const encodedSessionId = encodeURIComponent(sessionId);
      const mockSessionInfo = {
        session_id: sessionId,
        created_at: new Date('2024-01-01T10:00:00Z'),
        last_accessed: new Date('2024-01-01T10:30:00Z'),
        message_count: 2,
        expires_at: new Date('2024-01-01T11:00:00Z'),
        // Extended properties for test compatibility
        id: sessionId,
        model: 'claude-3-sonnet-20240229',
        system_prompt: 'You are a helpful assistant.',
        max_turns: 10,
        status: 'active' as const
      };

      mockSessionService.getSession.mockReturnValue(mockSessionInfo);

      const response = await request(app)
        .get(`/v1/sessions/${encodedSessionId}`)
        .expect(200);

      // Dates get serialized to ISO strings in JSON response
      expect(response.body).toEqual({
        session_id: mockSessionInfo.session_id,
        created_at: mockSessionInfo.created_at.toISOString(),
        last_accessed: mockSessionInfo.last_accessed.toISOString(),
        message_count: mockSessionInfo.message_count,
        expires_at: mockSessionInfo.expires_at.toISOString()
      });
      expect(mockSessionService.getSession).toHaveBeenCalledWith(sessionId);
    });
  });

  describe('DELETE /v1/sessions/:session_id', () => {
    it('should delete session successfully when session exists', async () => {
      const sessionId = 'delete_test_session';

      mockSessionService.deleteSession.mockReturnValue(true);

      const response = await request(app)
        .delete(`/v1/sessions/${sessionId}`)
        .expect(200);

      expect(response.body).toEqual({
        message: `Session ${sessionId} deleted successfully`
      });
      expect(mockSessionService.deleteSession).toHaveBeenCalledWith(sessionId);
    });

    it('should return 404 when session does not exist for deletion', async () => {
      const sessionId = 'nonexistent_delete_session';

      mockSessionService.deleteSession.mockReturnValue(false);

      const response = await request(app)
        .delete(`/v1/sessions/${sessionId}`)
        .expect(404);

      expect(response.body).toEqual({
        detail: `Session ${sessionId} not found`
      });
    });

    it('should return 500 when deletion service fails', async () => {
      const sessionId = 'error_delete_session';

      mockSessionService.deleteSession.mockImplementation(() => {
        throw new Error('Deletion failed');
      });

      const response = await request(app)
        .delete(`/v1/sessions/${sessionId}`)
        .expect(500);

      expect(response.body).toEqual({
        detail: 'Failed to delete session'
      });
    });

    it('should handle special characters in deletion session ID', async () => {
      const sessionId = 'session_to-delete_with-chars_456';

      mockSessionService.deleteSession.mockReturnValue(true);

      const response = await request(app)
        .delete(`/v1/sessions/${encodeURIComponent(sessionId)}`)
        .expect(200);

      expect(response.body).toEqual({
        message: `Session ${sessionId} deleted successfully`
      });
    });

    it('should handle concurrent deletion requests', async () => {
      const sessionId = 'concurrent_delete_session';

      // First deletion succeeds, second fails (session no longer exists)
      mockSessionService.deleteSession
        .mockReturnValueOnce(true)   // First call succeeds
        .mockReturnValueOnce(false); // Second call fails (session not found)

      const [response1, response2] = await Promise.all([
        request(app).delete(`/v1/sessions/${sessionId}`),
        request(app).delete(`/v1/sessions/${sessionId}`)
      ]);

      // One should succeed, one should fail with 404
      const successResponse = [response1, response2].find(r => r.status === 200);
      const failResponse = [response1, response2].find(r => r.status === 404);

      expect(successResponse).toBeDefined();
      expect(failResponse).toBeDefined();
      expect(mockSessionService.deleteSession).toHaveBeenCalledTimes(2);
    });
  });

  describe('HTTP methods and routing', () => {
    it('should reject unsupported HTTP methods on session endpoints', async () => {
      // POST to stats endpoint should be 404 (route not found)
      await request(app)
        .post('/v1/sessions/stats')
        .expect(404);

      // PUT to individual session should be 404
      await request(app)
        .put('/v1/sessions/test_session')
        .expect(404);

      // PATCH to sessions list should be 404
      await request(app)
        .patch('/v1/sessions')
        .expect(404);
    });

    it('should handle malformed URLs gracefully', async () => {
      // Set up mock for list sessions
      mockSessionService.listSessions.mockReturnValue({ sessions: [], total: 0 });
      
      // Empty session ID
      await request(app)
        .get('/v1/sessions/')
        .expect(200); // This hits the list sessions endpoint

      // Multiple slashes
      await request(app)
        .get('/v1/sessions//test')
        .expect(404);
    });

    it('should validate route parameter structure', async () => {
      mockSessionService.getSession.mockReturnValue(null);

      // Very long session ID
      const longSessionId = 'a'.repeat(200);
      await request(app)
        .get(`/v1/sessions/${longSessionId}`)
        .expect(404);

      expect(mockSessionService.getSession).toHaveBeenCalledWith(longSessionId);
    });
  });

  describe('response format and headers', () => {
    it('should return correct Content-Type headers', async () => {
      mockSessionService.listSessions.mockReturnValue({
        sessions: [],
        total: 0
      });

      await request(app)
        .get('/v1/sessions')
        .expect('Content-Type', /application\/json/)
        .expect(200);
    });

    it('should handle JSON serialization correctly', async () => {
      const mockSessionInfo = {
        session_id: 'json_test_session',
        created_at: new Date('2024-01-01T10:00:00.000Z'),
        last_accessed: new Date('2024-01-01T10:30:00.000Z'),
        message_count: 3,
        expires_at: new Date('2024-01-01T11:00:00.000Z'),
        // Extended properties for test compatibility
        id: 'json_test_session',
        model: 'claude-3-sonnet-20240229',
        system_prompt: 'You are a helpful assistant.',
        max_turns: 10,
        status: 'active' as const
      };

      mockSessionService.getSession.mockReturnValue(mockSessionInfo);

      const response = await request(app)
        .get('/v1/sessions/json_test_session')
        .expect(200);

      // Dates should be serialized as ISO strings
      expect(response.body.created_at).toBe('2024-01-01T10:00:00.000Z');
    });

    it('should maintain response structure consistency', async () => {
      const statsResponse = {
        activeSessions: 2,
        totalMessages: 10,
        avgMessagesPerSession: 5.0,
        oldestSession: new Date('2024-01-01T09:00:00Z'),
        newestSession: new Date('2024-01-01T10:00:00Z')
      };

      const configResponse = {
        cleanupIntervalMinutes: 5,
        defaultTtlHours: 1,
        maxSessionsPerUser: 100,
        maxMessagesPerSession: 1000,
        enableAutoCleanup: true,
        enableToolStateTracking: true,
        toolStateCleanupIntervalMinutes: 10
      };

      mockSessionService.getSessionStats.mockReturnValue(statsResponse);
      mockSessionService.getConfig.mockReturnValue(configResponse);

      const response = await request(app)
        .get('/v1/sessions/stats')
        .expect(200);

      // Should have exact structure match with Python response
      expect(response.body).toHaveProperty('session_stats');
      expect(response.body).toHaveProperty('cleanup_interval_minutes');
      expect(response.body).toHaveProperty('default_ttl_hours');
      expect(Object.keys(response.body)).toHaveLength(3);
    });
  });

  describe('error response format', () => {
    it('should return consistent error response format', async () => {
      mockSessionService.getSessionStats.mockImplementation(() => {
        throw new Error('Test error');
      });

      const response = await request(app)
        .get('/v1/sessions/stats')
        .expect(500);

      expect(response.body).toHaveProperty('detail');
      expect(response.body.detail).toBe('Failed to get session statistics');
    });

    it('should maintain error format consistency across endpoints', async () => {
      mockSessionService.listSessions.mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .get('/v1/sessions')
        .expect(500);

      expect(response.body).toEqual({
        detail: 'Failed to list sessions'
      });
    });
  });

  describe('Python compatibility validation', () => {
    it('should match Python FastAPI response structure for stats endpoint', async () => {
      // Simulate exact Python response structure
      const pythonStats = {
        activeSessions: 1,
        totalMessages: 5,
        avgMessagesPerSession: 5.0,
        oldestSession: new Date('2024-01-01T10:00:00Z'),
        newestSession: new Date('2024-01-01T10:00:00Z')
      };

      const pythonConfig = {
        cleanupIntervalMinutes: 5,
        defaultTtlHours: 1,
        maxSessionsPerUser: 100,
        maxMessagesPerSession: 1000,
        enableAutoCleanup: true,
        enableToolStateTracking: true,
        toolStateCleanupIntervalMinutes: 10
      };

      mockSessionService.getSessionStats.mockReturnValue(pythonStats);
      mockSessionService.getConfig.mockReturnValue(pythonConfig);

      const response = await request(app)
        .get('/v1/sessions/stats')
        .expect(200);

      // Verify exact structure match with Python main.py:772-783
      // Dates get serialized to ISO strings in JSON response
      expect(response.body).toEqual({
        session_stats: {
          active_sessions: pythonStats.activeSessions,
          expired_sessions: 0,
          total_messages: pythonStats.totalMessages
        },
        cleanup_interval_minutes: 5,
        default_ttl_hours: 1
      });
    });

    it('should match Python FastAPI response for session deletion', async () => {
      const sessionId = 'python_compat_session';
      mockSessionService.deleteSession.mockReturnValue(true);

      const response = await request(app)
        .delete(`/v1/sessions/${sessionId}`)
        .expect(200);

      // Verify exact message format matches Python main.py:817
      expect(response.body).toEqual({
        message: `Session ${sessionId} deleted successfully`
      });
    });

    it('should match Python FastAPI 404 error format', async () => {
      const sessionId = 'nonexistent_python_session';
      mockSessionService.getSession.mockReturnValue(null);

      const response = await request(app)
        .get(`/v1/sessions/${sessionId}`)
        .expect(404);

      // Verify error format matches Python HTTPException structure
      expect(response.body).toEqual({
        detail: `Session ${sessionId} not found`
      });
    });
  });
});