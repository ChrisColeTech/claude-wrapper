/**
 * Sessions Router - Pure Routing Configuration
 * Phase 2A Implementation: Clean routing layer with dependency injection
 * Based on Python main.py:772-817 session endpoints
 * 
 * Single Responsibility: HTTP route configuration only
 */

import { Router } from 'express';
import { SessionController } from '../controllers/session-controller';
import { SessionService } from '../services/session-service';
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
    
    // Initialize dependencies
    const sessionService = new SessionService();
    const sessionController = new SessionController(sessionService);

    // POST /v1/sessions - Create a new session
    router.post('/v1/sessions', (req, res) => sessionController.createSession(req, res));

    // GET /v1/sessions/stats - Session manager statistics  
    router.get('/v1/sessions/stats', (req, res) => sessionController.getSessionStats(req, res));

    // GET /v1/sessions - List all active sessions
    router.get('/v1/sessions', (req, res) => sessionController.listSessions(req, res));

    // GET /v1/sessions/{session_id} - Get information about a specific session
    router.get('/v1/sessions/:session_id', (req, res) => sessionController.getSession(req, res));

    // PATCH /v1/sessions/{session_id} - Update a session
    router.patch('/v1/sessions/:session_id', (req, res) => sessionController.updateSession(req, res));

    // DELETE /v1/sessions/{session_id} - Delete a specific session
    router.delete('/v1/sessions/:session_id', (req, res) => sessionController.deleteSession(req, res));

    logger.info('SessionsRouter configured with 6 endpoints');
    return router;
  }

  /**
   * Get reference to session service for backwards compatibility
   * @deprecated Use dependency injection instead
   */
  static getSessionService(): SessionService {
    return new SessionService();
  }
}