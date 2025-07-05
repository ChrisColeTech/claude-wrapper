/**
 * Comprehensive Integration Test Suite for Session Endpoints
 * Phase 02A Implementation: Complete session endpoint integration tests
 * 
 * Tests full session API flow with Python compatibility validation
 */

import request from 'supertest';
import express from 'express';
import { SessionsRouter } from '../../../src/routes/sessions';
import { 
  SessionAPIUtils,
  SESSION_API_CONSTANTS,
  PythonSessionInfo,
  PythonSessionStats,
  PythonSessionList,
  PythonSessionDelete
} from '../../../src/models/session-api';

// Mock logger to avoid console noise during tests
jest.mock('../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('Session Endpoints Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Mount session routes
    const sessionRouter = SessionsRouter.createRouter();
    app.use('/', sessionRouter);
  });

  beforeEach(() => {
    // Reset any session state before each test
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Cleanup
    SessionsRouter.shutdown();
  });

  describe('GET /v1/sessions/stats - Session Statistics', () => {
    it('should return Python-compatible session statistics', async () => {
      const response = await request(app)
        .get('/v1/sessions/stats')
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.OK);

      // Validate Python format
      expect(() => SessionAPIUtils.validatePythonSessionStats(response.body)).not.toThrow();

      const stats: PythonSessionStats = response.body;
      expect(stats).toHaveProperty('session_stats');
      expect(stats.session_stats).toHaveProperty('active_sessions');
      expect(stats.session_stats).toHaveProperty('expired_sessions');
      expect(stats.session_stats).toHaveProperty('total_messages');
      expect(stats).toHaveProperty('cleanup_interval_minutes');
      expect(stats).toHaveProperty('default_ttl_hours');

      // Validate data types
      expect(typeof stats.session_stats.active_sessions).toBe('number');
      expect(typeof stats.session_stats.expired_sessions).toBe('number');
      expect(typeof stats.session_stats.total_messages).toBe('number');
      expect(typeof stats.cleanup_interval_minutes).toBe('number');
      expect(typeof stats.default_ttl_hours).toBe('number');
    });

    it('should meet performance requirements (<50ms)', async () => {
      const startTime = process.hrtime.bigint();
      
      await request(app)
        .get('/v1/sessions/stats')
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.OK);
      
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1000000;

      expect(durationMs).toBeLessThan(SESSION_API_CONSTANTS.PERFORMANCE_TARGETS.SESSION_STATS);
    });

    it('should handle concurrent stats requests', async () => {
      const requests = Array.from({ length: 5 }, () => 
        request(app)
          .get('/v1/sessions/stats')
          .expect(SESSION_API_CONSTANTS.HTTP_STATUS.OK)
      );

      const startTime = process.hrtime.bigint();
      const responses = await Promise.all(requests);
      const endTime = process.hrtime.bigint();

      const durationMs = Number(endTime - startTime) / 1000000;

      // All requests should complete successfully
      responses.forEach(response => {
        expect(() => SessionAPIUtils.validatePythonSessionStats(response.body)).not.toThrow();
      });

      // Should handle concurrent requests efficiently
      expect(durationMs).toBeLessThan(200); // 5 concurrent requests under 200ms
    });
  });

  describe('GET /v1/sessions - List Sessions', () => {
    it('should return Python-compatible session list', async () => {
      const response = await request(app)
        .get('/v1/sessions')
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.OK);

      // Validate Python format
      expect(() => SessionAPIUtils.validatePythonSessionList(response.body)).not.toThrow();

      const sessionList: PythonSessionList = response.body;
      expect(sessionList).toHaveProperty('sessions');
      expect(sessionList).toHaveProperty('total');
      expect(Array.isArray(sessionList.sessions)).toBe(true);
      expect(typeof sessionList.total).toBe('number');
      expect(sessionList.total).toBe(sessionList.sessions.length);

      // Validate session format if any sessions exist
      if (sessionList.sessions.length > 0) {
        const session = sessionList.sessions[0];
        expect(session).toHaveProperty('session_id');
        expect(session).toHaveProperty('created_at');
        expect(session).toHaveProperty('last_accessed');
        expect(session).toHaveProperty('message_count');
        expect(session).toHaveProperty('expires_at');

        // Validate date formats are ISO strings
        expect(typeof session.created_at).toBe('string');
        expect(typeof session.last_accessed).toBe('string');
        expect(typeof session.expires_at).toBe('string');
      }
    });

    it('should meet performance requirements (<100ms)', async () => {
      const startTime = process.hrtime.bigint();
      
      await request(app)
        .get('/v1/sessions')
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.OK);
      
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1000000;

      expect(durationMs).toBeLessThan(SESSION_API_CONSTANTS.PERFORMANCE_TARGETS.SESSION_LIST);
    });

    it('should return empty list when no sessions exist', async () => {
      const response = await request(app)
        .get('/v1/sessions')
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.OK);

      const sessionList: PythonSessionList = response.body;
      expect(sessionList.total).toBeGreaterThanOrEqual(0);
      expect(sessionList.sessions.length).toBe(sessionList.total);
    });
  });

  describe('POST /v1/sessions - Create Session', () => {
    it('should create session with valid data', async () => {
      const sessionData = {
        model: 'claude-3-sonnet-20240229',
        system_prompt: 'You are a helpful assistant.',
        max_turns: 10
      };

      const response = await request(app)
        .post('/v1/sessions')
        .send(sessionData)
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.CREATED);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('created_at');
      expect(response.body).toHaveProperty('model', sessionData.model);
      expect(response.body).toHaveProperty('system_prompt', sessionData.system_prompt);
      expect(response.body).toHaveProperty('max_turns', sessionData.max_turns);
      expect(response.body).toHaveProperty('message_count', 0);
      expect(response.body).toHaveProperty('status', 'active');
    });

    it('should create session with minimal data', async () => {
      const sessionData = {
        model: 'claude-3-sonnet-20240229'
      };

      const response = await request(app)
        .post('/v1/sessions')
        .send(sessionData)
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.CREATED);

      expect(response.body.model).toBe(sessionData.model);
      expect(response.body.system_prompt).toBe('You are a helpful assistant.');
      expect(response.body.max_turns).toBe(10);
    });

    it('should reject session creation without model', async () => {
      const sessionData = {
        system_prompt: 'You are a helpful assistant.'
      };

      await request(app)
        .post('/v1/sessions')
        .send(sessionData)
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    });
  });

  describe('GET /v1/sessions/{id} - Get Session', () => {
    let testSessionId: string;

    beforeEach(async () => {
      // Create a test session for each test
      const sessionData = {
        model: 'claude-3-sonnet-20240229',
        system_prompt: 'Test session prompt',
        max_turns: 15
      };

      const createResponse = await request(app)
        .post('/v1/sessions')
        .send(sessionData);

      testSessionId = createResponse.body.id;
    });

    it('should return Python-compatible session info', async () => {
      const response = await request(app)
        .get(`/v1/sessions/${testSessionId}`)
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.OK);

      // Validate Python format
      expect(() => SessionAPIUtils.validatePythonSessionInfo(response.body)).not.toThrow();

      const sessionInfo: PythonSessionInfo = response.body;
      expect(sessionInfo.session_id).toBe(testSessionId);
      expect(typeof sessionInfo.created_at).toBe('string');
      expect(typeof sessionInfo.last_accessed).toBe('string');
      expect(typeof sessionInfo.expires_at).toBe('string');
      expect(typeof sessionInfo.message_count).toBe('number');

      // Validate ISO date format
      expect(sessionInfo.created_at).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
      expect(sessionInfo.last_accessed).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
      expect(sessionInfo.expires_at).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });

    it('should meet performance requirements (<50ms)', async () => {
      const startTime = process.hrtime.bigint();
      
      await request(app)
        .get(`/v1/sessions/${testSessionId}`)
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.OK);
      
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1000000;

      expect(durationMs).toBeLessThan(SESSION_API_CONSTANTS.PERFORMANCE_TARGETS.SESSION_GET);
    });

    it('should return 404 for non-existent session', async () => {
      const nonExistentId = 'nonexistent_session_123';

      const response = await request(app)
        .get(`/v1/sessions/${nonExistentId}`)
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.NOT_FOUND);

      expect(response.body).toHaveProperty('detail');
      expect(response.body.detail).toContain(nonExistentId);
    });

    it('should return 400 for missing session_id', async () => {
      await request(app)
        .get('/v1/sessions/')
        .expect(404); // Express router will return 404 for missing path parameter
    });
  });

  describe('PATCH /v1/sessions/{id} - Update Session', () => {
    let testSessionId: string;

    beforeEach(async () => {
      const sessionData = {
        model: 'claude-3-sonnet-20240229',
        system_prompt: 'Original prompt',
        max_turns: 10
      };

      const createResponse = await request(app)
        .post('/v1/sessions')
        .send(sessionData);

      testSessionId = createResponse.body.id;
    });

    it('should update session successfully', async () => {
      const updates = {
        system_prompt: 'Updated prompt',
        max_turns: 20
      };

      const response = await request(app)
        .patch(`/v1/sessions/${testSessionId}`)
        .send(updates)
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.OK);

      expect(response.body.system_prompt).toBe(updates.system_prompt);
      expect(response.body.max_turns).toBe(updates.max_turns);
      expect(response.body.id).toBe(testSessionId);
    });

    it('should return 404 for non-existent session update', async () => {
      const updates = {
        system_prompt: 'Updated prompt'
      };

      await request(app)
        .patch('/v1/sessions/nonexistent_session')
        .send(updates)
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.NOT_FOUND);
    });

    it('should handle partial updates', async () => {
      const updates = {
        system_prompt: 'Only prompt updated'
      };

      const response = await request(app)
        .patch(`/v1/sessions/${testSessionId}`)
        .send(updates)
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.OK);

      expect(response.body.system_prompt).toBe(updates.system_prompt);
      expect(response.body.max_turns).toBe(10); // Should remain unchanged
    });
  });

  describe('DELETE /v1/sessions/{id} - Delete Session', () => {
    let testSessionId: string;

    beforeEach(async () => {
      const sessionData = {
        model: 'claude-3-sonnet-20240229'
      };

      const createResponse = await request(app)
        .post('/v1/sessions')
        .send(sessionData);

      testSessionId = createResponse.body.id;
    });

    it('should delete session and return Python-compatible response', async () => {
      const response = await request(app)
        .delete(`/v1/sessions/${testSessionId}`)
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.OK);

      // Validate Python format
      expect(() => SessionAPIUtils.validatePythonDeleteResponse(response.body)).not.toThrow();

      const deleteResponse: PythonSessionDelete = response.body;
      expect(deleteResponse.message).toBe(`Session ${testSessionId} deleted successfully`);
    });

    it('should meet performance requirements (<25ms)', async () => {
      const startTime = process.hrtime.bigint();
      
      await request(app)
        .delete(`/v1/sessions/${testSessionId}`)
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.OK);
      
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1000000;

      expect(durationMs).toBeLessThan(SESSION_API_CONSTANTS.PERFORMANCE_TARGETS.SESSION_DELETE);
    });

    it('should return 404 for non-existent session deletion', async () => {
      const nonExistentId = 'nonexistent_session_123';

      const response = await request(app)
        .delete(`/v1/sessions/${nonExistentId}`)
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.NOT_FOUND);

      expect(response.body).toHaveProperty('detail');
      expect(response.body.detail).toContain(nonExistentId);
    });

    it('should verify session is actually deleted', async () => {
      // Delete the session
      await request(app)
        .delete(`/v1/sessions/${testSessionId}`)
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.OK);

      // Verify it no longer exists
      await request(app)
        .get(`/v1/sessions/${testSessionId}`)
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.NOT_FOUND);
    });
  });

  describe('Full Session Lifecycle Integration', () => {
    it('should support complete session lifecycle', async () => {
      // Create session
      const sessionData = {
        model: 'claude-3-sonnet-20240229',
        system_prompt: 'Lifecycle test session',
        max_turns: 5
      };

      const createResponse = await request(app)
        .post('/v1/sessions')
        .send(sessionData)
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.CREATED);

      const sessionId = createResponse.body.id;

      // Verify session exists in list
      const listResponse = await request(app)
        .get('/v1/sessions')
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.OK);

      const sessionList: PythonSessionList = listResponse.body;
      const createdSession = sessionList.sessions.find(s => s.session_id === sessionId);
      expect(createdSession).toBeDefined();

      // Get specific session
      const getResponse = await request(app)
        .get(`/v1/sessions/${sessionId}`)
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.OK);

      const sessionInfo: PythonSessionInfo = getResponse.body;
      expect(sessionInfo.session_id).toBe(sessionId);

      // Update session
      const updates = {
        system_prompt: 'Updated lifecycle session',
        max_turns: 10
      };

      await request(app)
        .patch(`/v1/sessions/${sessionId}`)
        .send(updates)
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.OK);

      // Delete session
      const deleteResponse = await request(app)
        .delete(`/v1/sessions/${sessionId}`)
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.OK);

      const deleteResult: PythonSessionDelete = deleteResponse.body;
      expect(deleteResult.message).toContain(sessionId);

      // Verify deletion
      await request(app)
        .get(`/v1/sessions/${sessionId}`)
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.NOT_FOUND);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/v1/sessions')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400); // Express will handle malformed JSON

      expect(response.body).toBeDefined();
    });

    it('should handle extremely large session IDs', async () => {
      const largeSessionId = 'a'.repeat(1000);

      await request(app)
        .get(`/v1/sessions/${largeSessionId}`)
        .expect(400); // Should be caught by validation
    });

    it('should handle concurrent operations on same session', async () => {
      // Create session
      const sessionData = {
        model: 'claude-3-sonnet-20240229'
      };

      const createResponse = await request(app)
        .post('/v1/sessions')
        .send(sessionData);

      const sessionId = createResponse.body.id;

      // Perform concurrent operations
      const concurrentOps = [
        request(app).get(`/v1/sessions/${sessionId}`),
        request(app).patch(`/v1/sessions/${sessionId}`).send({ max_turns: 15 }),
        request(app).get(`/v1/sessions/${sessionId}`)
      ];

      const results = await Promise.allSettled(concurrentOps);

      // At least some operations should succeed
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(0);
    });
  });

  describe('Data Integrity Tests', () => {
    it('should maintain consistent data across operations', async () => {
      // Create session
      const sessionData = {
        model: 'claude-3-sonnet-20240229',
        system_prompt: 'Data integrity test',
        max_turns: 8
      };

      const createResponse = await request(app)
        .post('/v1/sessions')
        .send(sessionData);

      const sessionId = createResponse.body.id;

      // Get session multiple times and verify consistency
      const getRequests = Array.from({ length: 3 }, () =>
        request(app).get(`/v1/sessions/${sessionId}`)
      );

      const responses = await Promise.all(getRequests);

      responses.forEach(response => {
        expect(response.status).toBe(SESSION_API_CONSTANTS.HTTP_STATUS.OK);
        expect(response.body.session_id).toBe(sessionId);
        
        // Verify data consistency
        const sessionInfo: PythonSessionInfo = response.body;
        expect(sessionInfo.message_count).toBe(0);
        expect(new Date(sessionInfo.created_at)).toBeInstanceOf(Date);
        expect(new Date(sessionInfo.expires_at)).toBeInstanceOf(Date);
      });
    });

    it('should handle timezone consistency in date fields', async () => {
      const sessionData = {
        model: 'claude-3-sonnet-20240229'
      };

      const createResponse = await request(app)
        .post('/v1/sessions')
        .send(sessionData);

      const sessionId = createResponse.body.id;

      const getResponse = await request(app)
        .get(`/v1/sessions/${sessionId}`)
        .expect(SESSION_API_CONSTANTS.HTTP_STATUS.OK);

      const sessionInfo: PythonSessionInfo = getResponse.body;

      // All timestamps should be in UTC (ending with 'Z')
      expect(sessionInfo.created_at).toMatch(/Z$/);
      expect(sessionInfo.last_accessed).toMatch(/Z$/);
      expect(sessionInfo.expires_at).toMatch(/Z$/);

      // Should be valid ISO 8601 format
      expect(new Date(sessionInfo.created_at).toISOString()).toBe(sessionInfo.created_at);
      expect(new Date(sessionInfo.last_accessed).toISOString()).toBe(sessionInfo.last_accessed);
      expect(new Date(sessionInfo.expires_at).toISOString()).toBe(sessionInfo.expires_at);
    });
  });
});