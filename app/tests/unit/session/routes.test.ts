/**
 * Optimized Session Routes Unit Tests
 * Tests the new optimized session API routes functionality
 */

import request from 'supertest';
import express from 'express';
import sessionRoutes from '../../../src/api/routes/sessions';
import { sharedCoreWrapper } from '../../../src/core/shared-wrapper';
import { setupTest, cleanupTest } from '../../setup/test-setup';
import '../../mocks/logger.mock';

// Mock the shared CoreWrapper
jest.mock('../../../src/core/shared-wrapper', () => ({
  sharedCoreWrapper: {
    getOptimizedSessions: jest.fn(),
    clearOptimizedSessions: jest.fn(),
    deleteOptimizedSession: jest.fn()
  }
}));

const mockSharedCoreWrapper = sharedCoreWrapper as jest.Mocked<typeof sharedCoreWrapper>;

describe('Optimized Session Routes', () => {
  let app: express.Application;

  beforeEach(async () => {
    setupTest();
    app = express();
    app.use(express.json());
    app.use(sessionRoutes);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanupTest();
  });

  describe('GET /v1/sessions', () => {
    test('should return empty sessions list', async () => {
      const mockSessions = new Map();
      mockSharedCoreWrapper.getOptimizedSessions.mockReturnValue(mockSessions);

      const response = await request(app)
        .get('/v1/sessions')
        .expect(200);

      expect(response.body).toEqual({
        sessions: [],
        total: 0,
        type: 'optimized_sessions'
      });
      expect(mockSharedCoreWrapper.getOptimizedSessions).toHaveBeenCalledTimes(1);
    });

    test('should return sessions with proper format', async () => {
      const mockSessionState = {
        claudeSessionId: 'claude-123',
        systemPromptContent: 'You are a helpful assistant with detailed explanations.',
        lastUsed: new Date('2023-01-01T10:00:00Z'),
        systemPromptHash: 'hash123'
      };
      
      const mockSessions = new Map([
        ['hash123', mockSessionState]
      ]);
      mockSharedCoreWrapper.getOptimizedSessions.mockReturnValue(mockSessions);

      const response = await request(app)
        .get('/v1/sessions')
        .expect(200);

      expect(response.body.sessions).toHaveLength(1);
      expect(response.body.sessions[0]).toEqual({
        system_prompt_hash: 'hash123',
        claude_session_id: 'claude-123',
        system_prompt_content: 'You are a helpful assistant with detailed explanations....', // truncated
        last_used: '2023-01-01T10:00:00.000Z',
        created_at: '2023-01-01T10:00:00.000Z'
      });
      expect(response.body.total).toBe(1);
      expect(response.body.type).toBe('optimized_sessions');
    });
  });

  describe('GET /v1/sessions/stats', () => {
    test('should return empty stats', async () => {
      const mockSessions = new Map();
      mockSharedCoreWrapper.getOptimizedSessions.mockReturnValue(mockSessions);

      const response = await request(app)
        .get('/v1/sessions/stats')
        .expect(200);

      expect(response.body).toMatchObject({
        totalSessions: 0,
        activeSessions: 0,
        averageSystemPromptLength: 0,
        oldestSessionAge: 0,
        sessionType: 'optimized_system_prompt_sessions'
      });
    });

    test('should calculate stats correctly', async () => {
      const now = new Date();
      const mockSessionState = {
        claudeSessionId: 'claude-123',
        systemPromptContent: 'Short prompt', // 12 characters
        lastUsed: new Date(now.getTime() - 5000), // 5 seconds ago
        systemPromptHash: 'hash123'
      };
      
      const mockSessions = new Map([
        ['hash123', mockSessionState]
      ]);
      mockSharedCoreWrapper.getOptimizedSessions.mockReturnValue(mockSessions);

      const response = await request(app)
        .get('/v1/sessions/stats')
        .expect(200);

      expect(response.body.totalSessions).toBe(1);
      expect(response.body.activeSessions).toBe(1);
      expect(response.body.averageSystemPromptLength).toBe(12);
      expect(response.body.oldestSessionAge).toBeGreaterThan(4000); // At least 4 seconds
    });
  });

  describe('GET /v1/sessions/:sessionHash', () => {
    test('should return 404 for non-existent session', async () => {
      const mockSessions = new Map();
      mockSharedCoreWrapper.getOptimizedSessions.mockReturnValue(mockSessions);

      const response = await request(app)
        .get('/v1/sessions/nonexistent')
        .expect(404);

      expect(response.body.error.message).toContain('Optimized session not found');
    });

    test('should return session details', async () => {
      const mockSessionState = {
        claudeSessionId: 'claude-123',
        systemPromptContent: 'You are a helpful assistant.',
        lastUsed: new Date('2023-01-01T10:00:00Z'),
        systemPromptHash: 'hash123'
      };
      
      const mockSessions = new Map([
        ['hash123', mockSessionState]
      ]);
      mockSharedCoreWrapper.getOptimizedSessions.mockReturnValue(mockSessions);

      const response = await request(app)
        .get('/v1/sessions/hash123')
        .expect(200);

      expect(response.body).toEqual({
        system_prompt_hash: 'hash123',
        claude_session_id: 'claude-123',
        system_prompt_content: 'You are a helpful assistant.',
        last_used: '2023-01-01T10:00:00.000Z',
        session_type: 'optimized_system_prompt_session'
      });
    });
  });

  describe('DELETE /v1/sessions/:sessionHash', () => {
    test('should return 404 for non-existent session', async () => {
      const mockSessions = new Map();
      mockSharedCoreWrapper.getOptimizedSessions.mockReturnValue(mockSessions);

      const response = await request(app)
        .delete('/v1/sessions/nonexistent')
        .expect(404);

      expect(response.body.error.message).toContain('Optimized session not found');
    });

    test('should delete existing session', async () => {
      const mockSessionState = {
        claudeSessionId: 'claude-123',
        systemPromptContent: 'You are a helpful assistant.',
        lastUsed: new Date('2023-01-01T10:00:00Z'),
        systemPromptHash: 'hash123'
      };
      
      const mockSessions = new Map([
        ['hash123', mockSessionState]
      ]);
      mockSharedCoreWrapper.getOptimizedSessions.mockReturnValue(mockSessions);
      mockSharedCoreWrapper.deleteOptimizedSession.mockReturnValue(true);

      const response = await request(app)
        .delete('/v1/sessions/hash123')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Optimized session hash123 deleted successfully',
        session_hash: 'hash123',
        claude_session_id: 'claude-123'
      });
      expect(mockSharedCoreWrapper.deleteOptimizedSession).toHaveBeenCalledWith('hash123');
    });
  });

  describe('POST /v1/sessions/clear', () => {
    test('should clear all sessions', async () => {
      mockSharedCoreWrapper.clearOptimizedSessions.mockReturnValue(3);

      const response = await request(app)
        .post('/v1/sessions/clear')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Cleared 3 optimized sessions',
        cleared_count: 3,
        operation: 'clear_all_sessions'
      });
      expect(mockSharedCoreWrapper.clearOptimizedSessions).toHaveBeenCalledTimes(1);
    });

    test('should handle zero sessions to clear', async () => {
      mockSharedCoreWrapper.clearOptimizedSessions.mockReturnValue(0);

      const response = await request(app)
        .post('/v1/sessions/clear')
        .expect(200);

      expect(response.body.cleared_count).toBe(0);
    });
  });
});