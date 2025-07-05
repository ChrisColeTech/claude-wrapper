/**
 * Comprehensive Unit Test Suite for Session API Models
 * Phase 02A Implementation: Python-compatible API models tests
 * 
 * Tests all Python-compatible response formats and utilities
 */

import {
  SessionAPIUtils,
  SESSION_API_CONSTANTS,
  PythonSessionInfo,
  PythonSessionStats,
  PythonSessionList,
  PythonSessionDelete,
  PythonErrorResponse
} from '../../../src/models/session-api';

describe('Session API Models Unit Tests', () => {
  const mockDate = new Date('2024-01-01T10:00:00.000Z');
  const mockSession = {
    session_id: 'test_session_123',
    created_at: mockDate,
    last_accessed: new Date('2024-01-01T10:30:00.000Z'),
    message_count: 5,
    expires_at: new Date('2024-01-01T11:00:00.000Z')
  };

  describe('SessionAPIUtils.toPythonSessionInfo', () => {
    it('should convert internal session to Python format', () => {
      const result = SessionAPIUtils.toPythonSessionInfo(mockSession);

      expect(result).toEqual({
        session_id: 'test_session_123',
        created_at: '2024-01-01T10:00:00.000Z',
        last_accessed: '2024-01-01T10:30:00.000Z',
        message_count: 5,
        expires_at: '2024-01-01T11:00:00.000Z'
      });
    });

    it('should handle zero message count', () => {
      const sessionWithZeroMessages = { ...mockSession, message_count: 0 };
      const result = SessionAPIUtils.toPythonSessionInfo(sessionWithZeroMessages);

      expect(result.message_count).toBe(0);
      expect(result.session_id).toBe('test_session_123');
    });

    it('should preserve all required fields', () => {
      const result = SessionAPIUtils.toPythonSessionInfo(mockSession);

      expect(result).toHaveProperty('session_id');
      expect(result).toHaveProperty('created_at');
      expect(result).toHaveProperty('last_accessed');
      expect(result).toHaveProperty('message_count');
      expect(result).toHaveProperty('expires_at');
    });

    it('should convert dates to ISO strings', () => {
      const result = SessionAPIUtils.toPythonSessionInfo(mockSession);

      expect(typeof result.created_at).toBe('string');
      expect(typeof result.last_accessed).toBe('string');
      expect(typeof result.expires_at).toBe('string');
      expect(result.created_at).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });
  });

  describe('SessionAPIUtils.toPythonSessionStats', () => {
    it('should convert session stats to Python format', () => {
      const stats = {
        activeSessions: 3,
        totalMessages: 15,
        expiredSessions: 2
      };
      const config = {
        cleanupIntervalMinutes: 5,
        defaultTtlHours: 1
      };

      const result = SessionAPIUtils.toPythonSessionStats(stats, config);

      expect(result).toEqual({
        session_stats: {
          active_sessions: 3,
          expired_sessions: 2,
          total_messages: 15
        },
        cleanup_interval_minutes: 5,
        default_ttl_hours: 1
      });
    });

    it('should handle zero values', () => {
      const stats = {
        activeSessions: 0,
        totalMessages: 0,
        expiredSessions: 0
      };
      const config = {
        cleanupIntervalMinutes: 10,
        defaultTtlHours: 2
      };

      const result = SessionAPIUtils.toPythonSessionStats(stats, config);

      expect(result.session_stats.active_sessions).toBe(0);
      expect(result.session_stats.total_messages).toBe(0);
      expect(result.session_stats.expired_sessions).toBe(0);
    });

    it('should default expired sessions to 0 when not provided', () => {
      const stats = {
        activeSessions: 5,
        totalMessages: 25
      };
      const config = {
        cleanupIntervalMinutes: 5,
        defaultTtlHours: 1
      };

      const result = SessionAPIUtils.toPythonSessionStats(stats, config);

      expect(result.session_stats.expired_sessions).toBe(0);
    });
  });

  describe('SessionAPIUtils.toPythonSessionList', () => {
    it('should convert session list to Python format', () => {
      const sessions = [mockSession, { ...mockSession, session_id: 'session_2' }];
      const result = SessionAPIUtils.toPythonSessionList(sessions);

      expect(result.total).toBe(2);
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0].session_id).toBe('test_session_123');
      expect(result.sessions[1].session_id).toBe('session_2');
    });

    it('should handle empty session list', () => {
      const result = SessionAPIUtils.toPythonSessionList([]);

      expect(result.total).toBe(0);
      expect(result.sessions).toHaveLength(0);
      expect(Array.isArray(result.sessions)).toBe(true);
    });

    it('should convert all session dates to ISO strings', () => {
      const result = SessionAPIUtils.toPythonSessionList([mockSession]);

      expect(typeof result.sessions[0].created_at).toBe('string');
      expect(typeof result.sessions[0].last_accessed).toBe('string');
      expect(typeof result.sessions[0].expires_at).toBe('string');
    });
  });

  describe('SessionAPIUtils.toPythonDeleteResponse', () => {
    it('should create proper delete response format', () => {
      const result = SessionAPIUtils.toPythonDeleteResponse('test_session_123');

      expect(result).toEqual({
        message: 'Session test_session_123 deleted successfully'
      });
    });

    it('should handle different session IDs', () => {
      const result = SessionAPIUtils.toPythonDeleteResponse('another_session_456');

      expect(result.message).toBe('Session another_session_456 deleted successfully');
    });
  });

  describe('SessionAPIUtils.toPythonErrorResponse', () => {
    it('should create proper error response format', () => {
      const result = SessionAPIUtils.toPythonErrorResponse('Session not found');

      expect(result).toEqual({
        detail: 'Session not found'
      });
    });

    it('should handle different error messages', () => {
      const result = SessionAPIUtils.toPythonErrorResponse('Invalid session ID');

      expect(result.detail).toBe('Invalid session ID');
    });
  });

  describe('Validation Functions', () => {
    describe('validatePythonSessionInfo', () => {
      it('should validate correct Python session info', () => {
        const validData = {
          session_id: 'test_123',
          created_at: '2024-01-01T10:00:00.000Z',
          last_accessed: '2024-01-01T10:30:00.000Z',
          message_count: 5,
          expires_at: '2024-01-01T11:00:00.000Z'
        };

        const result = SessionAPIUtils.validatePythonSessionInfo(validData);
        expect(result).toEqual(validData);
      });

      it('should reject invalid session info', () => {
        const invalidData = {
          session_id: 'test_123',
          created_at: 'invalid-date',
          message_count: -1
        };

        expect(() => SessionAPIUtils.validatePythonSessionInfo(invalidData)).toThrow();
      });

      it('should reject missing required fields', () => {
        const incompleteData = {
          session_id: 'test_123'
        };

        expect(() => SessionAPIUtils.validatePythonSessionInfo(incompleteData)).toThrow();
      });
    });

    describe('validatePythonSessionStats', () => {
      it('should validate correct Python session stats', () => {
        const validData = {
          session_stats: {
            active_sessions: 5,
            expired_sessions: 2,
            total_messages: 25
          },
          cleanup_interval_minutes: 5,
          default_ttl_hours: 1
        };

        const result = SessionAPIUtils.validatePythonSessionStats(validData);
        expect(result).toEqual(validData);
      });

      it('should reject invalid stats structure', () => {
        const invalidData = {
          session_stats: {
            active_sessions: 'invalid'
          }
        };

        expect(() => SessionAPIUtils.validatePythonSessionStats(invalidData)).toThrow();
      });
    });

    describe('validatePythonSessionList', () => {
      it('should validate correct Python session list', () => {
        const validData = {
          sessions: [{
            session_id: 'test_123',
            created_at: '2024-01-01T10:00:00.000Z',
            last_accessed: '2024-01-01T10:30:00.000Z',
            message_count: 5,
            expires_at: '2024-01-01T11:00:00.000Z'
          }],
          total: 1
        };

        const result = SessionAPIUtils.validatePythonSessionList(validData);
        expect(result).toEqual(validData);
      });

      it('should validate empty session list', () => {
        const validData = {
          sessions: [],
          total: 0
        };

        const result = SessionAPIUtils.validatePythonSessionList(validData);
        expect(result).toEqual(validData);
      });
    });

    describe('validatePythonDeleteResponse', () => {
      it('should validate correct delete response', () => {
        const validData = {
          message: 'Session test_123 deleted successfully'
        };

        const result = SessionAPIUtils.validatePythonDeleteResponse(validData);
        expect(result).toEqual(validData);
      });

      it('should reject invalid delete response', () => {
        const invalidData = {
          invalid_field: 'test'
        };

        expect(() => SessionAPIUtils.validatePythonDeleteResponse(invalidData)).toThrow();
      });
    });
  });

  describe('SESSION_API_CONSTANTS', () => {
    it('should have correct HTTP status codes', () => {
      expect(SESSION_API_CONSTANTS.HTTP_STATUS.OK).toBe(200);
      expect(SESSION_API_CONSTANTS.HTTP_STATUS.CREATED).toBe(201);
      expect(SESSION_API_CONSTANTS.HTTP_STATUS.BAD_REQUEST).toBe(400);
      expect(SESSION_API_CONSTANTS.HTTP_STATUS.NOT_FOUND).toBe(404);
      expect(SESSION_API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
    });

    it('should have session status values', () => {
      expect(SESSION_API_CONSTANTS.SESSION_STATUS.ACTIVE).toBe('active');
      expect(SESSION_API_CONSTANTS.SESSION_STATUS.EXPIRED).toBe('expired');
      expect(SESSION_API_CONSTANTS.SESSION_STATUS.DELETED).toBe('deleted');
    });

    it('should have error messages', () => {
      expect(SESSION_API_CONSTANTS.ERROR_MESSAGES.SESSION_NOT_FOUND).toBe('Session not found');
      expect(SESSION_API_CONSTANTS.ERROR_MESSAGES.SESSION_ID_REQUIRED).toBe('session_id parameter is required');
      expect(SESSION_API_CONSTANTS.ERROR_MESSAGES.INTERNAL_ERROR).toBe('Internal Server Error');
    });

    it('should have default values', () => {
      expect(SESSION_API_CONSTANTS.DEFAULTS.TTL_HOURS).toBe(1);
      expect(SESSION_API_CONSTANTS.DEFAULTS.CLEANUP_INTERVAL_MINUTES).toBe(5);
      expect(SESSION_API_CONSTANTS.DEFAULTS.MAX_SESSIONS_PER_USER).toBe(100);
      expect(SESSION_API_CONSTANTS.DEFAULTS.MAX_MESSAGES_PER_SESSION).toBe(1000);
    });

    it('should have performance targets', () => {
      expect(SESSION_API_CONSTANTS.PERFORMANCE_TARGETS.SESSION_LIST).toBe(100);
      expect(SESSION_API_CONSTANTS.PERFORMANCE_TARGETS.SESSION_GET).toBe(50);
      expect(SESSION_API_CONSTANTS.PERFORMANCE_TARGETS.SESSION_DELETE).toBe(25);
      expect(SESSION_API_CONSTANTS.PERFORMANCE_TARGETS.SESSION_STATS).toBe(50);
    });
  });

  describe('Python Compatibility Edge Cases', () => {
    it('should handle very large message counts', () => {
      const largeSession = { ...mockSession, message_count: 999999 };
      const result = SessionAPIUtils.toPythonSessionInfo(largeSession);

      expect(result.message_count).toBe(999999);
      expect(typeof result.message_count).toBe('number');
    });

    it('should handle sessions with identical timestamps', () => {
      const sameTimeSession = {
        ...mockSession,
        created_at: mockDate,
        last_accessed: mockDate,
        expires_at: mockDate
      };
      const result = SessionAPIUtils.toPythonSessionInfo(sameTimeSession);

      expect(result.created_at).toBe(result.last_accessed);
      expect(result.last_accessed).toBe(result.expires_at);
    });

    it('should handle large session lists efficiently', () => {
      const largeSessions = Array.from({ length: 1000 }, (_, i) => ({
        ...mockSession,
        session_id: `session_${i}`
      }));

      const startTime = process.hrtime.bigint();
      const result = SessionAPIUtils.toPythonSessionList(largeSessions);
      const endTime = process.hrtime.bigint();

      const durationMs = Number(endTime - startTime) / 1000000;

      expect(result.total).toBe(1000);
      expect(result.sessions).toHaveLength(1000);
      expect(durationMs).toBeLessThan(50); // Should complete quickly
    });

    it('should maintain data integrity in format conversions', () => {
      const result = SessionAPIUtils.toPythonSessionInfo(mockSession);

      // Verify no data loss or corruption
      expect(result.session_id).toBe(mockSession.session_id);
      expect(result.message_count).toBe(mockSession.message_count);
      expect(new Date(result.created_at)).toEqual(mockSession.created_at);
      expect(new Date(result.last_accessed)).toEqual(mockSession.last_accessed);
      expect(new Date(result.expires_at)).toEqual(mockSession.expires_at);
    });
  });

  describe('Type Safety', () => {
    it('should ensure Python response types are properly typed', () => {
      const sessionInfo: PythonSessionInfo = SessionAPIUtils.toPythonSessionInfo(mockSession);
      const stats: PythonSessionStats = SessionAPIUtils.toPythonSessionStats(
        { activeSessions: 1, totalMessages: 5 },
        { cleanupIntervalMinutes: 5, defaultTtlHours: 1 }
      );
      const list: PythonSessionList = SessionAPIUtils.toPythonSessionList([mockSession]);
      const deleteResp: PythonSessionDelete = SessionAPIUtils.toPythonDeleteResponse('test');
      const errorResp: PythonErrorResponse = SessionAPIUtils.toPythonErrorResponse('error');

      // TypeScript compilation serves as the test here
      expect(sessionInfo).toBeDefined();
      expect(stats).toBeDefined();
      expect(list).toBeDefined();
      expect(deleteResp).toBeDefined();
      expect(errorResp).toBeDefined();
    });
  });
});