/**
 * Sessions Router - Complete Session Management Endpoints
 * Phase 13A Implementation: Complete session endpoints (/v1/sessions/*)
 * Based on Python main.py:772-817 session endpoints
 * 
 * Single Responsibility: HTTP endpoint handling for all session operations
 */

import { Router, Request, Response } from 'express';
import { SessionService } from '../services/session-service';
import { getLogger } from '../utils/logger';

const logger = getLogger('SessionsRouter');

/**
 * Session stats response interface
 * Based on Python get_session_stats endpoint response
 */
export interface SessionStatsResponse {
  session_stats: {
    activeSessions: number;
    totalMessages: number;
    avgMessagesPerSession: number;
    oldestSession: Date | null;
    newestSession: Date | null;
  };
  cleanup_interval_minutes: number;
  default_ttl_hours: number;
}

/**
 * Session deletion response interface
 * Based on Python delete_session endpoint response
 */
export interface SessionDeleteResponse {
  message: string;
}

/**
 * Sessions Router class
 * Handles all session management endpoints with Python compatibility
 */
export class SessionsRouter {
  private static sessionService: SessionService = new SessionService();

  /**
   * Create Express router with all session endpoints
   * Based on Python FastAPI app session route definitions
   */
  static createRouter(): Router {
    const router = Router();

    // POST /v1/sessions - Create a new session
    router.post('/v1/sessions', this.createSession.bind(this));

    // GET /v1/sessions/stats - Session manager statistics
    router.get('/v1/sessions/stats', this.getSessionStats.bind(this));

    // GET /v1/sessions - List all active sessions
    router.get('/v1/sessions', this.listSessions.bind(this));

    // GET /v1/sessions/{session_id} - Get information about a specific session
    router.get('/v1/sessions/:session_id', this.getSession.bind(this));

    // PATCH /v1/sessions/{session_id} - Update a session
    router.patch('/v1/sessions/:session_id', this.updateSession.bind(this));

    // DELETE /v1/sessions/{session_id} - Delete a specific session
    router.delete('/v1/sessions/:session_id', this.deleteSession.bind(this));

    logger.info('SessionsRouter configured with 6 endpoints');
    return router;
  }

  /**
   * POST /v1/sessions endpoint
   * Create a new session
   */
  static async createSession(req: Request, res: Response): Promise<void> {
    try {
      logger.debug('Creating new session', { body: req.body });

      const { system_prompt, max_turns, model } = req.body;

      // Validate required fields
      if (!model) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'model is required'
        });
        return;
      }

      // Create session with SessionService
      const sessionData = {
        system_prompt: system_prompt || 'You are a helpful assistant.',
        max_turns: max_turns || 10,
        model,
        message_count: 0,
        status: 'active' as const
      };

      const session = this.sessionService.createSession(sessionData);

      logger.debug('Session created', { sessionId: session.id });

      res.status(201).json({
        id: session.id,
        created_at: session.created_at,
        model: session.model,
        system_prompt: session.system_prompt,
        max_turns: session.max_turns,
        message_count: session.message_count,
        status: session.status
      });
    } catch (error) {
      logger.error('Failed to create session', { error });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create session'
      });
    }
  }

  /**
   * PATCH /v1/sessions/{session_id} endpoint
   * Update an existing session
   */
  static async updateSession(req: Request, res: Response): Promise<void> {
    try {
      const { session_id } = req.params;
      const updates = req.body;

      if (!session_id) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'session_id parameter is required'
        });
        return;
      }

      logger.debug('Updating session', { sessionId: session_id, updates });

      const session = this.sessionService.updateSession(session_id, updates);

      if (!session) {
        logger.debug('Session not found for update', { sessionId: session_id });
        res.status(404).json({
          error: 'Not Found',
          message: 'Session not found'
        });
        return;
      }

      logger.debug('Session updated', { sessionId: session_id });

      res.json({
        id: session.id,
        created_at: session.created_at,
        model: session.model,
        system_prompt: session.system_prompt,
        max_turns: session.max_turns,
        message_count: session.message_count,
        status: session.status
      });
    } catch (error) {
      logger.error('Failed to update session', { error });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update session'
      });
    }
  }

  /**
   * GET /v1/sessions/stats endpoint
   * Based on Python main.py:772-783 get_session_stats
   */
  static async getSessionStats(_req: Request, res: Response): Promise<void> {
    try {
      logger.debug('Getting session statistics');

      const sessionStats = this.sessionService.getSessionStats();
      const config = this.sessionService.getConfig();

      const response: SessionStatsResponse = {
        session_stats: sessionStats,
        cleanup_interval_minutes: config.cleanupIntervalMinutes,
        default_ttl_hours: config.defaultTtlHours
      };

      logger.debug('Session statistics retrieved', {
        activeSessions: sessionStats.activeSessions,
        totalMessages: sessionStats.totalMessages
      });

      res.json(response);
    } catch (error) {
      logger.error('Failed to get session statistics', { error });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get session statistics'
      });
    }
  }

  /**
   * GET /v1/sessions endpoint
   * Based on Python main.py:785-791 list_sessions
   */
  static async listSessions(_req: Request, res: Response): Promise<void> {
    try {
      logger.debug('Listing all sessions');

      const sessionList = this.sessionService.listSessions();

      // Format response to match Python SessionListResponse format
      const response = {
        sessions: sessionList.sessions.map(session => ({
          session_id: session.session_id,
          created_at: session.created_at,
          last_accessed: session.last_accessed,
          message_count: session.message_count,
          expires_at: session.expires_at
        })),
        total: sessionList.total
      };

      logger.debug('Sessions listed', {
        total: sessionList.total,
        count: sessionList.sessions.length
      });

      res.json(response);
    } catch (error) {
      logger.error('Failed to list sessions', { error });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to list sessions'
      });
    }
  }

  /**
   * GET /v1/sessions/{session_id} endpoint
   * Based on Python main.py:794-804 get_session
   */
  static async getSession(req: Request, res: Response): Promise<void> {
    try {
      const { session_id } = req.params;

      if (!session_id) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'session_id parameter is required'
        });
        return;
      }

      logger.debug('Getting session info', { sessionId: session_id });

      const sessionInfo = this.sessionService.getSession(session_id);

      if (!sessionInfo) {
        logger.debug('Session not found', { sessionId: session_id });
        res.status(404).json({
          error: 'Session not found',
          message: `Session ${session_id} not found`
        });
        return;
      }

      logger.debug('Session info retrieved', {
        sessionId: session_id,
        messageCount: sessionInfo.message_count
      });

      // Return session in expected format
      res.json({
        id: sessionInfo.id,
        created_at: sessionInfo.created_at,
        model: sessionInfo.model,
        system_prompt: sessionInfo.system_prompt,
        max_turns: sessionInfo.max_turns,
        message_count: sessionInfo.message_count,
        status: sessionInfo.status
      });
    } catch (error) {
      logger.error('Failed to get session', { error, sessionId: req.params.session_id });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get session information'
      });
    }
  }

  /**
   * DELETE /v1/sessions/{session_id} endpoint
   * Based on Python main.py:807-817 delete_session
   */
  static async deleteSession(req: Request, res: Response): Promise<void> {
    try {
      const { session_id } = req.params;

      if (!session_id) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'session_id parameter is required'
        });
        return;
      }

      logger.debug('Deleting session', { sessionId: session_id });

      const deleted = this.sessionService.deleteSession(session_id);

      if (!deleted) {
        logger.debug('Session not found for deletion', { sessionId: session_id });
        res.status(404).json({
          error: 'Session not found',
          message: `Session ${session_id} not found`
        });
        return;
      }

      logger.info('Session deleted successfully', { sessionId: session_id });
      
      // Return message format matching Python main.py:817
      res.status(200).json({
        message: `Session ${session_id} deleted successfully`
      });
    } catch (error) {
      logger.error('Failed to delete session', { error, sessionId: req.params.session_id });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete session'
      });
    }
  }

  /**
   * Utility method to check if sessions service is available
   * For health checks and testing
   */
  static isServiceAvailable(): boolean {
    try {
      return this.sessionService.isHealthy();
    } catch (error) {
      logger.error('Session service health check failed', { error });
      return false;
    }
  }

  /**
   * Utility method to get current session count
   * For monitoring and diagnostics
   */
  static getSessionCount(): number {
    try {
      const stats = this.sessionService.getSessionStats();
      return stats.activeSessions;
    } catch (error) {
      logger.error('Failed to get session count', { error });
      return 0;
    }
  }

  /**
   * Utility method to force session cleanup
   * For administrative operations
   */
  static forceCleanup(): number {
    try {
      const cleanedCount = this.sessionService.cleanupExpiredSessions();
      logger.info('Forced session cleanup completed', { cleanedCount });
      return cleanedCount;
    } catch (error) {
      logger.error('Failed to force session cleanup', { error });
      return 0;
    }
  }

  /**
   * Get session service configuration
   * For debugging and monitoring
   */
  static getServiceConfig(): any {
    try {
      return this.sessionService.getConfig();
    } catch (error) {
      logger.error('Failed to get service config', { error });
      return {};
    }
  }

  /**
   * Shutdown sessions service
   * For graceful application shutdown
   */
  static shutdown(): void {
    try {
      this.sessionService.shutdown();
      logger.info('SessionsRouter service shut down');
    } catch (error) {
      logger.error('Error during SessionsRouter shutdown', { error });
    }
  }
}