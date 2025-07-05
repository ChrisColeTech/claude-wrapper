/**
 * Comprehensive Unit Test Suite for Enhanced Session Service
 * Phase 02A Implementation: Enhanced session service tests
 * 
 * Tests all session service operations with Python compatibility focus
 */

import { SessionService } from '../../../src/services/session-service';
import { SessionManager } from '../../../src/session/manager';

// Mock dependencies
jest.mock('../../../src/session/manager');
jest.mock('../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

// Mock tool-related modules
jest.mock('../../../src/tools/id-manager', () => ({
  toolCallIDManager: {
    trackId: jest.fn(),
    getSessionIds: jest.fn(),
    isIdTracked: jest.fn(),
    clearSession: jest.fn()
  }
}));

jest.mock('../../../src/tools/state', () => ({
  toolStateManager: {
    createToolCall: jest.fn(),
    updateToolCallState: jest.fn(),
    getStateSnapshot: jest.fn(),
    cleanupExpiredStates: jest.fn()
  }
}));

jest.mock('../../../src/tools/state-persistence', () => ({
  toolStatePersistence: {
    saveSessionState: jest.fn()
  }
}));

const MockSessionManager = SessionManager as jest.MockedClass<typeof SessionManager>;

describe('Enhanced Session Service Unit Tests', () => {
  let sessionService: SessionService;
  let mockSessionManager: jest.Mocked<SessionManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSessionManager = {
      get_or_create_session: jest.fn(),
      list_sessions: jest.fn(),
      delete_session: jest.fn(),
      start_cleanup_task: jest.fn(),
      shutdown: jest.fn()
    } as any;

    MockSessionManager.mockImplementation(() => mockSessionManager);
    
    sessionService = new SessionService();
  });

  describe('Session Creation', () => {
    it('should create session with default values', () => {
      const mockSession = {
        session_id: 'session_123',
        created_at: new Date('2024-01-01T10:00:00.000Z'),
        last_accessed: new Date('2024-01-01T10:00:00.000Z'),
        messages: [],
        expires_at: new Date('2024-01-01T11:00:00.000Z')
      };

      mockSessionManager.get_or_create_session.mockReturnValue(mockSession);

      const result = sessionService.createSession();

      expect(result).toMatchObject({
        session_id: 'session_123',
        created_at: mockSession.created_at,
        last_accessed: mockSession.last_accessed,
        message_count: 0,
        expires_at: mockSession.expires_at,
        // Test compatibility fields
        id: 'session_123',
        model: 'claude-3-sonnet-20240229',
        system_prompt: 'You are a helpful assistant.',
        max_turns: 10,
        status: 'active'
      });
    });

    it('should create session with custom parameters', () => {
      const mockSession = {
        session_id: 'custom_session',
        created_at: new Date('2024-01-01T10:00:00.000Z'),
        last_accessed: new Date('2024-01-01T10:00:00.000Z'),
        messages: [],
        expires_at: new Date('2024-01-01T11:00:00.000Z')
      };

      mockSessionManager.get_or_create_session.mockReturnValue(mockSession);

      const sessionData = {
        system_prompt: 'Custom prompt',
        max_turns: 20,
        model: 'claude-3-opus-20240229',
        message_count: 0,
        status: 'active'
      };

      const result = sessionService.createSession(sessionData);

      expect(result.model).toBe('claude-3-opus-20240229');
      expect(result.system_prompt).toBe('Custom prompt');
      expect(result.max_turns).toBe(20);
      expect(result.status).toBe('active');
    });

    it('should handle session creation errors', () => {
      mockSessionManager.get_or_create_session.mockImplementation(() => {
        throw new Error('Creation failed');
      });

      expect(() => sessionService.createSession()).toThrow('Session creation failed: Creation failed');
    });

    it('should validate session ID format', () => {
      // The service generates its own session ID, so test the validation indirectly
      const mockSession = {
        session_id: '',
        created_at: new Date(),
        last_accessed: new Date(),
        messages: [],
        expires_at: new Date()
      };

      mockSessionManager.get_or_create_session.mockReturnValue(mockSession);

      expect(() => sessionService.createSession()).toThrow('Invalid session ID format');
    });
  });

  describe('Session Retrieval', () => {
    it('should get existing session with extended format', () => {
      const mockSession = {
        session_id: 'test_session',
        created_at: new Date('2024-01-01T10:00:00.000Z'),
        last_accessed: new Date('2024-01-01T10:30:00.000Z'),
        messages: [{ role: 'user', content: 'test' }, { role: 'assistant', content: 'response' }],
        expires_at: new Date('2024-01-01T11:00:00.000Z')
      };

      mockSessionManager.list_sessions.mockReturnValue([mockSession]);

      const result = sessionService.getSession('test_session');

      expect(result).toMatchObject({
        session_id: 'test_session',
        created_at: mockSession.created_at,
        last_accessed: mockSession.last_accessed,
        message_count: 2,
        expires_at: mockSession.expires_at,
        // Test compatibility fields
        id: 'test_session',
        model: 'claude-3-sonnet-20240229',
        system_prompt: 'You are a helpful assistant.',
        max_turns: 10,
        status: 'active'
      });
    });

    it('should return null for non-existent session', () => {
      mockSessionManager.list_sessions.mockReturnValue([]);

      const result = sessionService.getSession('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle invalid session ID', () => {
      expect(() => sessionService.getSession('')).toThrow('Invalid session ID format');
    });

    it('should handle session retrieval errors', () => {
      mockSessionManager.list_sessions.mockImplementation(() => {
        throw new Error('Retrieval failed');
      });

      expect(() => sessionService.getSession('test')).toThrow('Session retrieval failed: Retrieval failed');
    });
  });

  describe('Session Listing', () => {
    it('should list all sessions in correct format', () => {
      const mockSessions = [
        {
          session_id: 'session_1',
          created_at: new Date('2024-01-01T10:00:00.000Z'),
          last_accessed: new Date('2024-01-01T10:30:00.000Z'),
          messages: [{ role: 'user', content: 'test1' }],
          expires_at: new Date('2024-01-01T11:00:00.000Z')
        },
        {
          session_id: 'session_2',
          created_at: new Date('2024-01-01T11:00:00.000Z'),
          last_accessed: new Date('2024-01-01T11:15:00.000Z'),
          messages: [{ role: 'user', content: 'test2' }, { role: 'assistant', content: 'response2' }],
          expires_at: new Date('2024-01-01T12:00:00.000Z')
        }
      ];

      mockSessionManager.list_sessions.mockReturnValue(mockSessions);

      const result = sessionService.listSessions();

      expect(result.total).toBe(2);
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0].session_id).toBe('session_1');
      expect(result.sessions[0].message_count).toBe(1);
      expect(result.sessions[1].session_id).toBe('session_2');
      expect(result.sessions[1].message_count).toBe(2);
    });

    it('should handle empty session list', () => {
      mockSessionManager.list_sessions.mockReturnValue([]);

      const result = sessionService.listSessions();

      expect(result.total).toBe(0);
      expect(result.sessions).toHaveLength(0);
      expect(Array.isArray(result.sessions)).toBe(true);
    });

    it('should handle listing errors', () => {
      mockSessionManager.list_sessions.mockImplementation(() => {
        throw new Error('Listing failed');
      });

      expect(() => sessionService.listSessions()).toThrow('Session listing failed: Listing failed');
    });
  });

  describe('Session Deletion', () => {
    it('should delete existing session successfully', () => {
      mockSessionManager.delete_session.mockReturnValue(undefined);

      const result = sessionService.deleteSession('test_session');

      expect(result).toBe(true);
      expect(mockSessionManager.delete_session).toHaveBeenCalledWith('test_session');
    });

    it('should handle deletion errors', () => {
      mockSessionManager.delete_session.mockImplementation(() => {
        throw new Error('Deletion failed');
      });

      expect(() => sessionService.deleteSession('test_session')).toThrow('Session deletion failed: Deletion failed');
    });

    it('should validate session ID before deletion', () => {
      expect(() => sessionService.deleteSession('')).toThrow('Invalid session ID format');
    });
  });

  describe('Session Updates', () => {
    it('should update session successfully', () => {
      const mockSession = {
        session_id: 'test_session',
        created_at: new Date('2024-01-01T10:00:00.000Z'),
        last_accessed: new Date('2024-01-01T10:30:00.000Z'),
        messages: [],
        expires_at: new Date('2024-01-01T11:00:00.000Z')
      };

      mockSessionManager.list_sessions.mockReturnValue([mockSession]);

      const updates = {
        system_prompt: 'Updated prompt',
        max_turns: 15
      };

      const result = sessionService.updateSession('test_session', updates);

      expect(result.system_prompt).toBe('Updated prompt');
      expect(result.max_turns).toBe(15);
      expect(result.session_id).toBe('test_session');
    });

    it('should handle update of non-existent session', () => {
      mockSessionManager.list_sessions.mockReturnValue([]);

      expect(() => sessionService.updateSession('nonexistent', {})).toThrow('Session not found: nonexistent');
    });

    it('should validate session ID before update', () => {
      expect(() => sessionService.updateSession('', {})).toThrow('Invalid session ID format');
    });
  });

  describe('Session Statistics', () => {
    it('should calculate session statistics correctly', () => {
      const mockSessions = [
        {
          session_id: 'session_1',
          created_at: new Date('2024-01-01T10:00:00.000Z'),
          last_accessed: new Date('2024-01-01T10:30:00.000Z'),
          messages: [{ role: 'user', content: 'test1' }, { role: 'assistant', content: 'response1' }],
          expires_at: new Date('2024-01-01T11:00:00.000Z')
        },
        {
          session_id: 'session_2',
          created_at: new Date('2024-01-01T09:00:00.000Z'),
          last_accessed: new Date('2024-01-01T11:15:00.000Z'),
          messages: [{ role: 'user', content: 'test2' }],
          expires_at: new Date('2024-01-01T12:00:00.000Z')
        }
      ];

      mockSessionManager.list_sessions.mockReturnValue(mockSessions);

      const stats = sessionService.getSessionStats();

      expect(stats.activeSessions).toBe(2);
      expect(stats.totalMessages).toBe(3);
      expect(stats.avgMessagesPerSession).toBe(1.5);
      expect(stats.oldestSession).toEqual(new Date('2024-01-01T09:00:00.000Z'));
      expect(stats.newestSession).toEqual(new Date('2024-01-01T10:00:00.000Z'));
    });

    it('should handle empty statistics', () => {
      mockSessionManager.list_sessions.mockReturnValue([]);

      const stats = sessionService.getSessionStats();

      expect(stats.activeSessions).toBe(0);
      expect(stats.totalMessages).toBe(0);
      expect(stats.avgMessagesPerSession).toBe(0);
      expect(stats.oldestSession).toBeNull();
      expect(stats.newestSession).toBeNull();
    });

    it('should handle statistics calculation errors', () => {
      mockSessionManager.list_sessions.mockImplementation(() => {
        throw new Error('Stats failed');
      });

      expect(() => sessionService.getSessionStats()).toThrow('Session statistics failed: Stats failed');
    });
  });

  describe('Expired Session Count', () => {
    it('should return expired session count', () => {
      const count = sessionService.getExpiredSessionCount();

      // Current implementation returns 0 (expired sessions are cleaned up)
      expect(count).toBe(0);
      expect(typeof count).toBe('number');
    });

    it('should handle expired session count errors gracefully', () => {
      // Simulate error in future implementation
      const originalMethod = sessionService.getExpiredSessionCount;
      sessionService.getExpiredSessionCount = jest.fn().mockImplementation(() => {
        throw new Error('Count failed');
      });

      const count = sessionService.getExpiredSessionCount();
      expect(count).toBe(0); // Should return 0 on error

      // Restore original method
      sessionService.getExpiredSessionCount = originalMethod;
    });
  });

  describe('Session Cleanup', () => {
    it('should cleanup expired sessions', () => {
      const mockSessions = [
        {
          session_id: 'active_session',
          is_expired: () => false,
          messages: []
        },
        {
          session_id: 'expired_session',
          is_expired: () => true,
          messages: []
        }
      ];

      mockSessionManager.list_sessions.mockReturnValue(mockSessions);
      mockSessionManager.delete_session.mockReturnValue(undefined);

      const cleanedCount = sessionService.cleanupExpiredSessions();

      expect(cleanedCount).toBe(1);
      expect(mockSessionManager.delete_session).toHaveBeenCalledWith('expired_session');
    });

    it('should handle cleanup errors gracefully', () => {
      mockSessionManager.list_sessions.mockImplementation(() => {
        throw new Error('Cleanup failed');
      });

      const cleanedCount = sessionService.cleanupExpiredSessions();

      expect(cleanedCount).toBe(0);
    });
  });

  describe('Session with Messages', () => {
    it('should get session with full message data', () => {
      const mockSession = {
        session_id: 'test_session',
        created_at: new Date(),
        last_accessed: new Date(),
        messages: [{ role: 'user', content: 'test' }],
        expires_at: new Date()
      };

      mockSessionManager.list_sessions.mockReturnValue([mockSession]);

      const result = sessionService.getSessionWithMessages('test_session');

      expect(result).toEqual(mockSession);
      expect(result?.messages).toHaveLength(1);
    });

    it('should return null for non-existent session', () => {
      mockSessionManager.list_sessions.mockReturnValue([]);

      const result = sessionService.getSessionWithMessages('nonexistent');

      expect(result).toBeNull();
    });

    it('should validate session ID', () => {
      expect(() => sessionService.getSessionWithMessages('')).toThrow('Invalid session ID format');
    });
  });

  describe('Health Checks', () => {
    it('should return healthy when service is operational', () => {
      mockSessionManager.list_sessions.mockReturnValue([]);

      const isHealthy = sessionService.isHealthy();

      expect(isHealthy).toBe(true);
    });

    it('should return unhealthy when service has errors', () => {
      mockSessionManager.list_sessions.mockImplementation(() => {
        throw new Error('Service error');
      });

      const isHealthy = sessionService.isHealthy();

      expect(isHealthy).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should return service configuration', () => {
      const config = sessionService.getConfig();

      expect(config).toHaveProperty('defaultTtlHours');
      expect(config).toHaveProperty('cleanupIntervalMinutes');
      expect(config).toHaveProperty('maxSessionsPerUser');
      expect(config).toHaveProperty('maxMessagesPerSession');
      expect(config).toHaveProperty('enableAutoCleanup');
      expect(config).toHaveProperty('enableToolStateTracking');
    });

    it('should use default configuration values', () => {
      const config = sessionService.getConfig();

      expect(config.defaultTtlHours).toBe(1);
      expect(config.cleanupIntervalMinutes).toBe(5);
      expect(config.maxSessionsPerUser).toBe(100);
      expect(config.maxMessagesPerSession).toBe(1000);
      expect(config.enableAutoCleanup).toBe(true);
      expect(config.enableToolStateTracking).toBe(true);
    });
  });

  describe('Service Shutdown', () => {
    it('should shutdown service gracefully', () => {
      expect(() => sessionService.shutdown()).not.toThrow();
      expect(mockSessionManager.shutdown).toHaveBeenCalled();
    });

    it('should handle shutdown errors gracefully', () => {
      mockSessionManager.shutdown.mockImplementation(() => {
        throw new Error('Shutdown failed');
      });

      expect(() => sessionService.shutdown()).not.toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('should handle large session lists efficiently', () => {
      const largeSessions = Array.from({ length: 1000 }, (_, i) => ({
        session_id: `session_${i}`,
        created_at: new Date(),
        last_accessed: new Date(),
        messages: [{ role: 'user', content: `test_${i}` }],
        expires_at: new Date()
      }));

      mockSessionManager.list_sessions.mockReturnValue(largeSessions);

      const startTime = process.hrtime.bigint();
      const result = sessionService.listSessions();
      const endTime = process.hrtime.bigint();

      const durationMs = Number(endTime - startTime) / 1000000;

      expect(result.total).toBe(1000);
      expect(durationMs).toBeLessThan(100); // Should complete under 100ms
    });

    it('should handle complex statistics calculation efficiently', () => {
      const complexSessions = Array.from({ length: 500 }, (_, i) => ({
        session_id: `session_${i}`,
        created_at: new Date(Date.now() - i * 1000 * 60), // Different creation times
        last_accessed: new Date(),
        messages: Array.from({ length: i % 10 }, () => ({ role: 'user', content: 'test' })),
        expires_at: new Date()
      }));

      mockSessionManager.list_sessions.mockReturnValue(complexSessions);

      const startTime = process.hrtime.bigint();
      const stats = sessionService.getSessionStats();
      const endTime = process.hrtime.bigint();

      const durationMs = Number(endTime - startTime) / 1000000;

      expect(stats.activeSessions).toBe(500);
      expect(stats.totalMessages).toBeGreaterThan(0);
      expect(durationMs).toBeLessThan(50); // Should complete under 50ms
    });
  });

  describe('Input Validation', () => {
    it('should validate session ID length limits', () => {
      const longSessionId = 'a'.repeat(300); // Exceeds 200 char limit
      
      expect(() => sessionService.getSession(longSessionId)).toThrow('Invalid session ID format');
    });

    it('should handle special characters in session IDs', () => {
      const specialCharId = 'session_with-special.chars_123';
      
      // Should not throw for valid special characters
      expect(() => sessionService.getSession(specialCharId)).not.toThrow();
    });

    it('should reject null or undefined session IDs', () => {
      expect(() => sessionService.getSession(null as any)).toThrow();
      expect(() => sessionService.getSession(undefined as any)).toThrow();
    });
  });
});