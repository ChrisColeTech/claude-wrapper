/**
 * Sessions Router - Pure Routing Configuration
 * Phase 2A Implementation: Clean routing layer with dependency injection
 * Based on Python main.py:772-817 session endpoints
 * 
 * Single Responsibility: HTTP route configuration only
 */

import { Router } from 'express';
import { sessionService } from '../services/session-service';
import { getLogger } from '../utils/logger';

const logger = getLogger('SessionsRouter');

/**
 * Sessions Router Factory
 * Creates router with dependency-injected controller
 * Pure routing configuration - no business logic
 */
export class SessionsRouter {
  /**
   * Create Express router with all session endpoints
   * Uses dependency injection for clean architecture
   */
  static createRouter(): Router {
    const router = Router();
    
    // Simplified session endpoints

    // GET /v1/sessions - List all active sessions
    router.get('/', (req, res) => {
      const sessions = sessionService.getAllSessions();
      res.json({ sessions });
    });

    // GET /v1/sessions/stats - Session manager statistics  
    router.get('/stats', (req, res) => {
      res.json({ 
        totalSessions: sessionService.getSessionCount(),
        activeSessions: sessionService.getSessionCount() 
      });
    });

    // GET /v1/sessions/{session_id} - Get information about a specific session
    router.get('/:session_id', (req, res) => {
      const session = sessionService.getSession(req.params.session_id);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      res.json(session);
    });

    // DELETE /v1/sessions/{session_id} - Delete a specific session
    router.delete('/:session_id', (req, res) => {
      const deleted = sessionService.deleteSession(req.params.session_id);
      if (!deleted) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      res.json({ success: true });
    });

    logger.info('SessionsRouter configured with 6 endpoints');
    return router;
  }

}

// Export default router
const router = SessionsRouter.createRouter();
export default router;