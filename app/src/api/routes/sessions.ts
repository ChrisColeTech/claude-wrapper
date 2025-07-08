/**
 * Session Management API Routes
 * Provides endpoints for session CRUD operations
 * Follows RESTful API patterns
 */

import { Router, Request, Response } from 'express';
import { sessionManager } from '../../session/manager';
import { asyncHandler } from '../middleware/error';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /v1/sessions
 * List all active sessions
 */
router.get('/v1/sessions', asyncHandler(async (_req: Request, res: Response) => {
  logger.info('List sessions request received');

  const sessions = sessionManager.listSessions();
  
  logger.info('Sessions listed successfully', {
    sessionCount: sessions.length
  });

  res.json({
    sessions,
    total: sessions.length
  });
}));

/**
 * GET /v1/sessions/stats
 * Get session statistics
 */
router.get('/v1/sessions/stats', asyncHandler(async (_req: Request, res: Response) => {
  logger.info('Session stats request received');

  const stats = sessionManager.getSessionStats();
  
  logger.info('Session stats retrieved successfully', {
    totalSessions: stats.totalSessions,
    activeSessions: stats.activeSessions
  });

  res.json(stats);
}));

/**
 * GET /v1/sessions/:sessionId
 * Get specific session details
 */
router.get('/v1/sessions/:sessionId', asyncHandler(async (req: Request, res: Response): Promise<Response> => {
  const { sessionId } = req.params;
  
  logger.info('Get session request received', { sessionId });

  if (!sessionId) {
    return res.status(400).json({
      error: {
        message: 'Session ID is required',
        type: 'invalid_request',
        code: '400'
      }
    });
  }

  const session = sessionManager.getSession(sessionId);
  
  if (!session) {
    logger.warn('Session not found', { sessionId });
    return res.status(404).json({
      error: {
        message: `Session not found: ${sessionId}`,
        type: 'session_not_found',
        code: '404'
      }
    });
  }

  logger.info('Session retrieved successfully', { 
    sessionId,
    messageCount: session.messages.length
  });

  return res.json(session);
}));

/**
 * DELETE /v1/sessions/:sessionId
 * Delete a specific session
 */
router.delete('/v1/sessions/:sessionId', asyncHandler(async (req: Request, res: Response): Promise<Response> => {
  const { sessionId } = req.params;
  
  logger.info('Delete session request received', { sessionId });

  if (!sessionId) {
    return res.status(400).json({
      error: {
        message: 'Session ID is required',
        type: 'invalid_request',
        code: '400'
      }
    });
  }

  // Check if session exists first
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    logger.warn('Cannot delete session - not found', { sessionId });
    return res.status(404).json({
      error: {
        message: `Session not found: ${sessionId}`,
        type: 'session_not_found',
        code: '404'
      }
    });
  }

  sessionManager.deleteSession(sessionId);
  
  logger.info('Session deleted successfully', { sessionId });

  return res.json({
    message: `Session ${sessionId} deleted successfully`,
    session_id: sessionId
  });
}));

/**
 * POST /v1/sessions/:sessionId/messages
 * Add messages to a session (for testing/debugging)
 */
router.post('/v1/sessions/:sessionId/messages', asyncHandler(async (req: Request, res: Response): Promise<Response> => {
  const { sessionId } = req.params;
  const { messages } = req.body;
  
  logger.info('Add messages to session request received', { 
    sessionId,
    messageCount: messages?.length 
  });

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({
      error: {
        message: 'Messages array is required',
        type: 'invalid_request',
        code: '400'
      }
    });
  }

  // Validate message format
  for (const message of messages) {
    if (!message.role || !['system', 'user', 'assistant', 'tool'].includes(message.role)) {
      return res.status(400).json({
        error: {
          message: 'Invalid message role. Must be one of: system, user, assistant, tool',
          type: 'invalid_request',
          code: '400'
        }
      });
    }
    if (message.content === undefined || message.content === null) {
      return res.status(400).json({
        error: {
          message: 'Message content is required',
          type: 'invalid_request',
          code: '400'
        }
      });
    }
  }

  // Get or create session and add messages
  if (!sessionId) {
    return res.status(400).json({
      error: {
        message: 'Session ID is required',
        type: 'invalid_request',
        code: '400'
      }
    });
  }

  sessionManager.getOrCreateSession(sessionId);
  const [allMessages] = sessionManager.processMessages(messages, sessionId);
  
  logger.info('Messages added to session successfully', { 
    sessionId,
    totalMessages: allMessages.length
  });

  return res.json({
    session_id: sessionId,
    message_count: allMessages.length,
    messages: allMessages
  });
}));

export default router;