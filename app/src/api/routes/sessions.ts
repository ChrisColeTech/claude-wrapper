/**
 * Session Management API Routes
 * Provides endpoints for optimized session operations
 * Exposes CoreWrapper's optimized session system
 */

import { Router, Request, Response } from 'express';
import { sharedCoreWrapper } from '../../core/shared-wrapper';
import { asyncHandler } from '../middleware/error';
import { logger } from '../../utils/logger';

const router = Router();

// Simple in-memory session interaction tracking for mock mode
const sessionInteractionCounts = new Map<string, number>();

/**
 * GET /v1/sessions
 * List all active optimized sessions
 */
router.get('/v1/sessions', asyncHandler(async (_req: Request, res: Response) => {
  logger.info('List optimized sessions request received');

  // Access the optimized session system from CoreWrapper
  const claudeSessions = sharedCoreWrapper.getOptimizedSessions();
  const sessions = Array.from(claudeSessions.entries()).map(([hash, state]) => ({
    system_prompt_hash: hash,
    claude_session_id: state.claudeSessionId,
    system_prompt_content: state.systemPromptContent.substring(0, 100) + '...',
    last_used: state.lastUsed,
    created_at: state.lastUsed // Using lastUsed as approximation
  }));
  
  logger.info('Optimized sessions listed successfully', {
    sessionCount: sessions.length
  });

  res.json({
    sessions,
    total: sessions.length,
    type: 'optimized_sessions'
  });
}));

/**
 * GET /v1/sessions/stats
 * Get optimized session statistics
 */
router.get('/v1/sessions/stats', asyncHandler(async (_req: Request, res: Response) => {
  logger.info('Optimized session stats request received');

  // Access the optimized session system from CoreWrapper
  const claudeSessions = sharedCoreWrapper.getOptimizedSessions();
  const now = new Date();
  
  let oldestSessionTime = now.getTime();
  let totalSystemPromptLength = 0;
  
  for (const [, state] of claudeSessions.entries()) {
    if (state.lastUsed.getTime() < oldestSessionTime) {
      oldestSessionTime = state.lastUsed.getTime();
    }
    totalSystemPromptLength += state.systemPromptContent.length;
  }

  const stats = {
    totalSessions: claudeSessions.size,
    activeSessions: claudeSessions.size, // All optimized sessions are active
    expiredSessions: 0, // Optimized sessions don't expire the same way
    averageSystemPromptLength: claudeSessions.size > 0 ? totalSystemPromptLength / claudeSessions.size : 0,
    oldestSessionAge: claudeSessions.size > 0 ? now.getTime() - oldestSessionTime : 0,
    sessionType: 'optimized_system_prompt_sessions'
  };
  
  logger.info('Optimized session stats retrieved successfully', {
    totalSessions: stats.totalSessions,
    activeSessions: stats.activeSessions
  });

  res.json(stats);
}));

/**
 * GET /v1/sessions/:sessionHash
 * Get specific optimized session details by system prompt hash
 */
router.get('/v1/sessions/:sessionHash', asyncHandler(async (req: Request, res: Response): Promise<Response> => {
  const { sessionHash } = req.params;
  
  logger.info('Get optimized session request received', { sessionHash });

  if (!sessionHash) {
    return res.status(400).json({
      error: {
        message: 'Session hash is required',
        type: 'invalid_request',
        code: '400'
      }
    });
  }

  // Access the optimized session system from CoreWrapper
  const claudeSessions = sharedCoreWrapper.getOptimizedSessions();
  const session = claudeSessions.get(sessionHash);
  
  if (!session) {
    logger.warn('Optimized session not found', { sessionHash });
    return res.status(404).json({
      error: {
        message: `Optimized session not found: ${sessionHash}`,
        type: 'session_not_found',
        code: '404'
      }
    });
  }

  logger.info('Optimized session retrieved successfully', { 
    sessionHash,
    claudeSessionId: session.claudeSessionId
  });

  return res.json({
    system_prompt_hash: sessionHash,
    claude_session_id: session.claudeSessionId,
    system_prompt_content: session.systemPromptContent,
    last_used: session.lastUsed,
    session_type: 'optimized_system_prompt_session'
  });
}));

/**
 * DELETE /v1/sessions/:sessionHash
 * Delete a specific optimized session by system prompt hash
 */
router.delete('/v1/sessions/:sessionHash', asyncHandler(async (req: Request, res: Response): Promise<Response> => {
  const { sessionHash } = req.params;
  
  logger.info('Delete optimized session request received', { sessionHash });

  if (!sessionHash) {
    return res.status(400).json({
      error: {
        message: 'Session hash is required',
        type: 'invalid_request',
        code: '400'
      }
    });
  }

  // Access the optimized session system from CoreWrapper
  const claudeSessions = sharedCoreWrapper.getOptimizedSessions();
  
  // Check if session exists first
  const session = claudeSessions.get(sessionHash);
  if (!session) {
    logger.warn('Cannot delete optimized session - not found', { sessionHash });
    return res.status(404).json({
      error: {
        message: `Optimized session not found: ${sessionHash}`,
        type: 'session_not_found',
        code: '404'
      }
    });
  }

  sharedCoreWrapper.deleteOptimizedSession(sessionHash);
  
  logger.info('Optimized session deleted successfully', { sessionHash });

  return res.json({
    message: `Optimized session ${sessionHash} deleted successfully`,
    session_hash: sessionHash,
    claude_session_id: session.claudeSessionId
  });
}));

/**
 * POST /v1/sessions
 * Create a new session with given system prompt
 */
router.post('/v1/sessions', asyncHandler(async (req: Request, res: Response): Promise<Response> => {
  const { name, system_prompt } = req.body;
  
  logger.info('Create session request received', { name, systemPromptLength: system_prompt?.length });

  if (!system_prompt) {
    return res.status(400).json({
      error: {
        message: 'system_prompt is required',
        type: 'invalid_request',
        code: '400'
      }
    });
  }

  // Generate a session ID (this would normally create a session, but for mock mode we'll just return a hash)
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  
  logger.info('Session created successfully', { sessionId, name });

  return res.status(201).json({
    id: sessionId,
    name: name || 'Unnamed Session',
    system_prompt,
    created_at: new Date().toISOString(),
    type: 'manual_session'
  });
}));

/**
 * POST /v1/sessions/:sessionId/messages
 * Send a message to a specific session
 */
router.post('/v1/sessions/:sessionId/messages', asyncHandler(async (req: Request, res: Response): Promise<Response> => {
  const { sessionId } = req.params;
  const { messages, model } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({
      error: {
        message: 'Session ID is required',
        type: 'invalid_request',
        code: '400'
      }
    });
  }
  
  logger.info('Session message request received', { sessionId, messageCount: messages?.length, model });

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: {
        message: 'messages array is required and must not be empty',
        type: 'invalid_request',
        code: '400'
      }
    });
  }

  // For mock mode, generate a response that includes interaction context
  // Increment interaction count for this session
  const currentCount = sessionInteractionCounts.get(sessionId) || 0;
  const interactionNumber = currentCount + 1;
  sessionInteractionCounts.set(sessionId, interactionNumber);
  
  const mockContent = `This is a mock response for session ${sessionId}, interaction #${interactionNumber}. Your message was: "${messages[messages.length - 1].content}"`;
  
  logger.info('Session message processed successfully', { sessionId, interactionNumber });

  return res.json({
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model || 'sonnet',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: mockContent
        },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: 20,
      completion_tokens: 15,
      total_tokens: 35
    }
  });
}));

/**
 * POST /v1/sessions/clear
 * Clear all optimized sessions (for testing/debugging)
 */
router.post('/v1/sessions/clear', asyncHandler(async (_req: Request, res: Response): Promise<Response> => {
  logger.info('Clear all optimized sessions request received');

  // Access the optimized session system from CoreWrapper
  const sessionCount = sharedCoreWrapper.clearOptimizedSessions();
  
  logger.info('All optimized sessions cleared successfully', { 
    clearedCount: sessionCount
  });

  return res.json({
    message: `Cleared ${sessionCount} optimized sessions`,
    cleared_count: sessionCount,
    operation: 'clear_all_sessions'
  });
}));

export default router;