/**
 * Comprehensive Unit Test Suite for Session Controller
 * Phase 02A Implementation: Session controller tests with Python compatibility
 * 
 * Tests session management endpoints for Python response format compliance
 */

import { SessionsRouter } from '../../../src/routes/sessions';
import { SessionService } from '../../../src/services/session-service';
import { 
  SessionAPIUtils, 
  SESSION_API_CONSTANTS,
  PythonSessionInfo,
  PythonSessionStats,
  PythonSessionList,
  PythonSessionDelete
} from '../../../src/models/session-api';

// Mock the session service
jest.mock('../../../src/services/session-service');
const MockSessionService = SessionService as jest.MockedClass<typeof SessionService>;

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('Session Controller Python Compatibility Tests', () => {
  let mockSessionService: jest.Mocked<SessionService>;
  let mockReq: any;
  let mockRes: any;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSessionService = {
      getSessionStats: jest.fn(),
      listSessions: jest.fn(),
      getSession: jest.fn(),
      deleteSession: jest.fn(),
      getConfig: jest.fn(),
      getExpiredSessionCount: jest.fn(),
      isHealthy: jest.fn(),
      cleanupExpiredSessions: jest.fn(),
      shutdown: jest.fn()
    } as any;

    (SessionsRouter as any).sessionService = mockSessionService;

    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    
    mockReq = {
      params: {}
    };
    mockRes = {
      json: mockJson,
      status: mockStatus
    };
  });

  describe('GET /v1/sessions/{id} Python Response Format', () => {
    it('should return Python-compatible SessionInfo format', async () => {
      const sessionId = 'test_session_123';
      mockReq.params.session_id = sessionId;

      const mockSessionInfo = {
        session_id: sessionId,
        created_at: new Date('2024-01-01T10:00:00.000Z'),
        last_accessed: new Date('2024-01-01T10:30:00.000Z'),
        message_count: 5,
        expires_at: new Date('2024-01-01T11:00:00.000Z'),
        id: sessionId,
        model: 'claude-3-sonnet-20240229',
        system_prompt: 'You are a helpful assistant.',
        max_turns: 10,
        status: 'active' as const
      };

      mockSessionService.getSession.mockReturnValue(mockSessionInfo);

      await SessionsRouter.getSession(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(SESSION_API_CONSTANTS.HTTP_STATUS.OK);
      
      const expectedResponse: PythonSessionInfo = {
        session_id: sessionId,
        created_at: '2024-01-01T10:00:00.000Z',
        last_accessed: '2024-01-01T10:30:00.000Z',
        message_count: 5,
        expires_at: '2024-01-01T11:00:00.000Z'
      };

      expect(mockJson).toHaveBeenCalledWith(expectedResponse);
    });

    it('should return Python-compatible 404 error format', async () => {
      const sessionId = 'nonexistent_session';
      mockReq.params.session_id = sessionId;

      mockSessionService.getSession.mockReturnValue(null);

      await SessionsRouter.getSession(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(SESSION_API_CONSTANTS.HTTP_STATUS.NOT_FOUND);
      expect(mockJson).toHaveBeenCalledWith({
        detail: `Session ${sessionId} not found`
      });
    });

    it('should return Python-compatible 400 error for missing session_id', async () => {
      mockReq.params = {};

      await SessionsRouter.getSession(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(SESSION_API_CONSTANTS.HTTP_STATUS.BAD_REQUEST);
      expect(mockJson).toHaveBeenCalledWith({
        detail: SESSION_API_CONSTANTS.ERROR_MESSAGES.SESSION_ID_REQUIRED
      });
    });

    it('should return Python-compatible 500 error for service failures', async () => {
      const sessionId = 'error_session';
      mockReq.params.session_id = sessionId;

      mockSessionService.getSession.mockImplementation(() => {
        throw new Error('Service error');
      });

      await SessionsRouter.getSession(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(SESSION_API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(mockJson).toHaveBeenCalledWith({
        detail: SESSION_API_CONSTANTS.ERROR_MESSAGES.INTERNAL_ERROR
      });
    });
  });

  describe('GET /v1/sessions/stats Python Response Format', () => {
    it('should return Python-compatible SessionStats format', async () => {
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
        toolStateCleanupIntervalMinutes: 15
      };

      mockSessionService.getSessionStats.mockReturnValue(mockStats);
      mockSessionService.getConfig.mockReturnValue(mockConfig);
      mockSessionService.listSessions.mockReturnValue({ sessions: [], total: 0 });
      mockSessionService.getExpiredSessionCount.mockReturnValue(2);

      await SessionsRouter.getSessionStats(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(SESSION_API_CONSTANTS.HTTP_STATUS.OK);
      
      const expectedResponse: PythonSessionStats = {
        session_stats: {
          active_sessions: 3,
          expired_sessions: 2,
          total_messages: 15
        },
        cleanup_interval_minutes: 5,
        default_ttl_hours: 1
      };

      expect(mockJson).toHaveBeenCalledWith(expectedResponse);
    });

    it('should handle zero statistics correctly', async () => {
      const mockEmptyStats = {
        activeSessions: 0,
        totalMessages: 0,
        avgMessagesPerSession: 0,
        oldestSession: null,
        newestSession: null
      };

      const mockConfig = {
        cleanupIntervalMinutes: 5,
        defaultTtlHours: 1,
        maxSessionsPerUser: 100,
        maxMessagesPerSession: 1000,
        enableAutoCleanup: true,
        enableToolStateTracking: true,
        toolStateCleanupIntervalMinutes: 15
      };

      mockSessionService.getSessionStats.mockReturnValue(mockEmptyStats);
      mockSessionService.getConfig.mockReturnValue(mockConfig);
      mockSessionService.listSessions.mockReturnValue({ sessions: [], total: 0 });
      mockSessionService.getExpiredSessionCount.mockReturnValue(0);

      await SessionsRouter.getSessionStats(mockReq, mockRes);

      expect(mockJson).toHaveBeenCalledWith({
        session_stats: {
          active_sessions: 0,
          expired_sessions: 0,
          total_messages: 0
        },
        cleanup_interval_minutes: 5,
        default_ttl_hours: 1
      });
    });

    it('should return Python-compatible error for stats failure', async () => {
      mockSessionService.getSessionStats.mockImplementation(() => {
        throw new Error('Stats service failed');
      });

      await SessionsRouter.getSessionStats(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(SESSION_API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(mockJson).toHaveBeenCalledWith({
        detail: SESSION_API_CONSTANTS.ERROR_MESSAGES.SESSION_STATS_FAILED
      });
    });
  });

  describe('GET /v1/sessions Python Response Format', () => {
    it('should return Python-compatible SessionList format', async () => {
      const mockSessionList = {
        sessions: [
          {
            session_id: 'session_1',
            created_at: new Date('2024-01-01T10:00:00.000Z'),
            last_accessed: new Date('2024-01-01T10:30:00.000Z'),
            message_count: 3,
            expires_at: new Date('2024-01-01T11:00:00.000Z')
          },
          {
            session_id: 'session_2',
            created_at: new Date('2024-01-01T11:00:00.000Z'),
            last_accessed: new Date('2024-01-01T11:15:00.000Z'),
            message_count: 2,
            expires_at: new Date('2024-01-01T12:00:00.000Z')
          }
        ],
        total: 2
      };

      mockSessionService.listSessions.mockReturnValue(mockSessionList);

      await SessionsRouter.listSessions(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(SESSION_API_CONSTANTS.HTTP_STATUS.OK);
      
      const expectedResponse: PythonSessionList = {
        sessions: [
          {
            session_id: 'session_1',
            created_at: '2024-01-01T10:00:00.000Z',
            last_accessed: '2024-01-01T10:30:00.000Z',
            message_count: 3,
            expires_at: '2024-01-01T11:00:00.000Z'
          },
          {
            session_id: 'session_2',
            created_at: '2024-01-01T11:00:00.000Z',
            last_accessed: '2024-01-01T11:15:00.000Z',
            message_count: 2,
            expires_at: '2024-01-01T12:00:00.000Z'
          }
        ],
        total: 2
      };

      expect(mockJson).toHaveBeenCalledWith(expectedResponse);
    });

    it('should return empty list in Python format', async () => {
      const mockEmptyList = {
        sessions: [],
        total: 0
      };

      mockSessionService.listSessions.mockReturnValue(mockEmptyList);

      await SessionsRouter.listSessions(mockReq, mockRes);

      expect(mockJson).toHaveBeenCalledWith({
        sessions: [],
        total: 0
      });
    });

    it('should return Python-compatible error for list failure', async () => {
      mockSessionService.listSessions.mockImplementation(() => {
        throw new Error('List service failed');
      });

      await SessionsRouter.listSessions(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(SESSION_API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(mockJson).toHaveBeenCalledWith({
        detail: SESSION_API_CONSTANTS.ERROR_MESSAGES.SESSION_LIST_FAILED
      });
    });
  });

  describe('DELETE /v1/sessions/{id} Python Response Format', () => {
    it('should return Python-compatible delete confirmation', async () => {
      const sessionId = 'delete_test_session';
      mockReq.params.session_id = sessionId;

      mockSessionService.deleteSession.mockReturnValue(true);

      await SessionsRouter.deleteSession(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(SESSION_API_CONSTANTS.HTTP_STATUS.OK);
      
      const expectedResponse: PythonSessionDelete = {
        message: `Session ${sessionId} deleted successfully`
      };

      expect(mockJson).toHaveBeenCalledWith(expectedResponse);
    });

    it('should return Python-compatible 404 for non-existent session', async () => {
      const sessionId = 'nonexistent_delete_session';
      mockReq.params.session_id = sessionId;

      mockSessionService.deleteSession.mockReturnValue(false);

      await SessionsRouter.deleteSession(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(SESSION_API_CONSTANTS.HTTP_STATUS.NOT_FOUND);
      expect(mockJson).toHaveBeenCalledWith({
        detail: `Session ${sessionId} not found`
      });
    });

    it('should return Python-compatible 400 for missing session_id', async () => {
      mockReq.params = {};

      await SessionsRouter.deleteSession(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(SESSION_API_CONSTANTS.HTTP_STATUS.BAD_REQUEST);
      expect(mockJson).toHaveBeenCalledWith({
        detail: SESSION_API_CONSTANTS.ERROR_MESSAGES.SESSION_ID_REQUIRED
      });
    });

    it('should return Python-compatible error for deletion failure', async () => {
      const sessionId = 'error_delete_session';
      mockReq.params.session_id = sessionId;

      mockSessionService.deleteSession.mockImplementation(() => {
        throw new Error('Deletion failed');
      });

      await SessionsRouter.deleteSession(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(SESSION_API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(mockJson).toHaveBeenCalledWith({
        detail: SESSION_API_CONSTANTS.ERROR_MESSAGES.SESSION_DELETION_FAILED
      });
    });
  });

  describe('Python Compatibility Validation', () => {
    it('should ensure all responses are valid Python format', async () => {
      // Test session info
      const sessionId = 'test_session';
      mockReq.params.session_id = sessionId;

      const mockSessionInfo = {
        session_id: sessionId,
        created_at: new Date('2024-01-01T10:00:00.000Z'),
        last_accessed: new Date('2024-01-01T10:30:00.000Z'),
        message_count: 5,
        expires_at: new Date('2024-01-01T11:00:00.000Z'),
        id: sessionId,
        model: 'claude-3-sonnet-20240229',
        system_prompt: 'You are a helpful assistant.',
        max_turns: 10,
        status: 'active' as const
      };

      mockSessionService.getSession.mockReturnValue(mockSessionInfo);

      await SessionsRouter.getSession(mockReq, mockRes);

      const sessionResponse = mockJson.mock.calls[0][0];
      
      // Validate using utility function
      expect(() => SessionAPIUtils.validatePythonSessionInfo(sessionResponse)).not.toThrow();
    });

    it('should ensure date formats are ISO strings', async () => {
      const sessionId = 'test_session';
      mockReq.params.session_id = sessionId;

      const mockSessionInfo = {
        session_id: sessionId,
        created_at: new Date('2024-01-01T10:00:00.000Z'),
        last_accessed: new Date('2024-01-01T10:30:00.000Z'),
        message_count: 5,
        expires_at: new Date('2024-01-01T11:00:00.000Z'),
        id: sessionId,
        model: 'claude-3-sonnet-20240229',
        system_prompt: 'You are a helpful assistant.',
        max_turns: 10,
        status: 'active' as const
      };

      mockSessionService.getSession.mockReturnValue(mockSessionInfo);

      await SessionsRouter.getSession(mockReq, mockRes);

      const response = mockJson.mock.calls[0][0];
      
      expect(typeof response.created_at).toBe('string');
      expect(typeof response.last_accessed).toBe('string');
      expect(typeof response.expires_at).toBe('string');
      expect(response.created_at).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });
  });

  describe('Performance Requirements', () => {
    it('should meet session get performance target (<50ms)', async () => {
      const sessionId = 'perf_test_session';
      mockReq.params.session_id = sessionId;

      const mockSessionInfo = {
        session_id: sessionId,
        created_at: new Date(),
        last_accessed: new Date(),
        message_count: 5,
        expires_at: new Date(),
        id: sessionId,
        model: 'claude-3-sonnet-20240229',
        system_prompt: 'You are a helpful assistant.',
        max_turns: 10,
        status: 'active' as const
      };

      mockSessionService.getSession.mockReturnValue(mockSessionInfo);

      const startTime = process.hrtime.bigint();
      await SessionsRouter.getSession(mockReq, mockRes);
      const endTime = process.hrtime.bigint();

      const durationMs = Number(endTime - startTime) / 1000000;
      expect(durationMs).toBeLessThan(SESSION_API_CONSTANTS.PERFORMANCE_TARGETS.SESSION_GET);
    });

    it('should meet session delete performance target (<25ms)', async () => {
      const sessionId = 'perf_delete_session';
      mockReq.params.session_id = sessionId;

      mockSessionService.deleteSession.mockReturnValue(true);

      const startTime = process.hrtime.bigint();
      await SessionsRouter.deleteSession(mockReq, mockRes);
      const endTime = process.hrtime.bigint();

      const durationMs = Number(endTime - startTime) / 1000000;
      expect(durationMs).toBeLessThan(SESSION_API_CONSTANTS.PERFORMANCE_TARGETS.SESSION_DELETE);
    });

    it('should meet session stats performance target (<50ms)', async () => {
      const mockStats = {
        activeSessions: 100,
        totalMessages: 500,
        avgMessagesPerSession: 5.0,
        oldestSession: new Date(),
        newestSession: new Date()
      };

      const mockConfig = {
        cleanupIntervalMinutes: 5,
        defaultTtlHours: 1,
        maxSessionsPerUser: 100,
        maxMessagesPerSession: 1000,
        enableAutoCleanup: true,
        enableToolStateTracking: true,
        toolStateCleanupIntervalMinutes: 15
      };

      mockSessionService.getSessionStats.mockReturnValue(mockStats);
      mockSessionService.getConfig.mockReturnValue(mockConfig);
      mockSessionService.listSessions.mockReturnValue({ sessions: [], total: 0 });
      mockSessionService.getExpiredSessionCount.mockReturnValue(0);

      const startTime = process.hrtime.bigint();
      await SessionsRouter.getSessionStats(mockReq, mockRes);
      const endTime = process.hrtime.bigint();

      const durationMs = Number(endTime - startTime) / 1000000;
      expect(durationMs).toBeLessThan(SESSION_API_CONSTANTS.PERFORMANCE_TARGETS.SESSION_STATS);
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle null session_id parameter', async () => {
      mockReq.params.session_id = null;

      await SessionsRouter.getSession(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(SESSION_API_CONSTANTS.HTTP_STATUS.BAD_REQUEST);
      expect(mockJson).toHaveBeenCalledWith({
        detail: SESSION_API_CONSTANTS.ERROR_MESSAGES.SESSION_ID_REQUIRED
      });
    });

    it('should handle undefined session_id parameter', async () => {
      mockReq.params.session_id = undefined;

      await SessionsRouter.deleteSession(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(SESSION_API_CONSTANTS.HTTP_STATUS.BAD_REQUEST);
      expect(mockJson).toHaveBeenCalledWith({
        detail: SESSION_API_CONSTANTS.ERROR_MESSAGES.SESSION_ID_REQUIRED
      });
    });

    it('should handle service returning null config', async () => {
      mockSessionService.getSessionStats.mockReturnValue({
        activeSessions: 1,
        totalMessages: 5,
        avgMessagesPerSession: 5.0,
        oldestSession: new Date(),
        newestSession: new Date()
      });

      mockSessionService.getConfig.mockReturnValue(null as any);

      await SessionsRouter.getSessionStats(mockReq, mockRes);

      expect(mockStatus).toHaveBeenCalledWith(SESSION_API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });
  });
});