/**
 * Session Controller - HTTP Request/Response Handler
 * Phase 2A Implementation: Clean architecture session controller
 * 
 * Single Responsibility: HTTP session endpoint handling only
 * Follows SOLID principles and dependency inversion
 */

import { Request, Response } from 'express';
import { 
  ISessionController, 
  SessionIdValidationResult, 
  SessionOperationResult, 
  SessionErrorType,
  SessionAPIError 
} from './interfaces';
import { ISessionService } from '../services/interfaces';
import { 
  SessionAPIUtils, 
  SESSION_API_CONSTANTS,
  PythonSessionInfo,
  PythonSessionStats,
  PythonSessionList,
  PythonSessionDelete
} from '../models/session-api';
import { getLogger } from '../utils/logger';

const logger = getLogger('SessionController');

/**
 * Session Controller Implementation
 * Handles HTTP layer for session management endpoints
 * Depends only on ISessionService abstraction (Dependency Inversion)
 */
export class SessionController implements ISessionController {
  constructor(private readonly sessionService: ISessionService) {}

  /**
   * POST /v1/sessions endpoint
   * Create a new session with proper validation
   */
  async createSession(req: Request, res: Response): Promise<void> {
    try {
      logger.debug('Creating new session', { body: req.body });

      const { system_prompt, max_turns, model } = req.body;

      // Validate required fields
      if (!model) {
        this.sendErrorResponse(res, {
          type: SessionErrorType.VALIDATION_ERROR,
          message: 'model is required',
          statusCode: SESSION_API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
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

      res.status(SESSION_API_CONSTANTS.HTTP_STATUS.CREATED).json({
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
      this.sendErrorResponse(res, {
        type: SessionErrorType.SERVICE_ERROR,
        message: SESSION_API_CONSTANTS.ERROR_MESSAGES.SESSION_CREATION_FAILED,
        statusCode: SESSION_API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
      });
    }
  }

  /**
   * GET /v1/sessions/stats endpoint
   * Returns Python-compatible session statistics
   */
  async getSessionStats(req: Request, res: Response): Promise<void> {
    try {
      logger.debug('Getting session statistics');

      const sessionStats = this.sessionService.getSessionStats();
      const config = this.sessionService.getConfig();
      const expiredSessions = this.sessionService.getExpiredSessionCount();

      const pythonResponse: PythonSessionStats = SessionAPIUtils.toPythonSessionStats(
        {
          activeSessions: sessionStats.activeSessions,
          totalMessages: sessionStats.totalMessages,
          expiredSessions: expiredSessions
        },
        {
          cleanupIntervalMinutes: config.cleanupIntervalMinutes,
          defaultTtlHours: config.defaultTtlHours
        }
      );

      logger.debug('Session statistics retrieved', {
        activeSessions: sessionStats.activeSessions,
        totalMessages: sessionStats.totalMessages,
        expiredSessions: expiredSessions
      });

      res.status(SESSION_API_CONSTANTS.HTTP_STATUS.OK).json(pythonResponse);
    } catch (error) {
      logger.error('Failed to get session statistics', { error });
      this.sendPythonErrorResponse(res, SESSION_API_CONSTANTS.ERROR_MESSAGES.SESSION_STATS_FAILED);
    }
  }

  /**
   * GET /v1/sessions endpoint
   * Returns Python-compatible session list
   */
  async listSessions(req: Request, res: Response): Promise<void> {
    try {
      logger.debug('Listing all sessions');

      const sessionList = this.sessionService.listSessions();

      const pythonResponse: PythonSessionList = SessionAPIUtils.toPythonSessionList(
        sessionList.sessions.map(session => ({
          session_id: session.session_id,
          created_at: session.created_at,
          last_accessed: session.last_accessed,
          message_count: session.message_count,
          expires_at: session.expires_at
        }))
      );

      logger.debug('Sessions listed', {
        total: pythonResponse.total,
        count: pythonResponse.sessions.length
      });

      res.status(SESSION_API_CONSTANTS.HTTP_STATUS.OK).json(pythonResponse);
    } catch (error) {
      logger.error('Failed to list sessions', { error });
      this.sendPythonErrorResponse(res, SESSION_API_CONSTANTS.ERROR_MESSAGES.SESSION_LIST_FAILED);
    }
  }

  /**
   * GET /v1/sessions/{session_id} endpoint
   * Returns session info or proper 404
   */
  async getSession(req: Request, res: Response): Promise<void> {
    try {
      const validation = this.validateSessionId(req.params.session_id);
      
      if (!validation.isValid) {
        this.sendPythonErrorResponse(res, validation.error!, validation.statusCode!);
        return;
      }

      logger.debug('Getting session info', { sessionId: validation.sessionId });

      const sessionInfo = this.sessionService.getSession(validation.sessionId!);

      if (!sessionInfo) {
        logger.debug('Session not found', { sessionId: validation.sessionId });
        this.sendPythonErrorResponse(res, 
          `Session ${validation.sessionId} not found`, 
          SESSION_API_CONSTANTS.HTTP_STATUS.NOT_FOUND
        );
        return;
      }

      logger.debug('Session info retrieved', {
        sessionId: validation.sessionId,
        messageCount: sessionInfo.message_count
      });

      const pythonResponse: PythonSessionInfo = SessionAPIUtils.toPythonSessionInfo({
        session_id: sessionInfo.session_id,
        created_at: sessionInfo.created_at,
        last_accessed: sessionInfo.last_accessed,
        message_count: sessionInfo.message_count,
        expires_at: sessionInfo.expires_at
      });

      res.status(SESSION_API_CONSTANTS.HTTP_STATUS.OK).json(pythonResponse);
    } catch (error) {
      logger.error('Failed to get session', { error, sessionId: req.params.session_id });
      this.sendPythonErrorResponse(res, SESSION_API_CONSTANTS.ERROR_MESSAGES.INTERNAL_ERROR);
    }
  }

  /**
   * PATCH /v1/sessions/{session_id} endpoint
   * Updates session with proper 404 handling
   */
  async updateSession(req: Request, res: Response): Promise<void> {
    try {
      const validation = this.validateSessionId(req.params.session_id);
      
      if (!validation.isValid) {
        this.sendErrorResponse(res, {
          type: SessionErrorType.MISSING_SESSION_ID,
          message: SESSION_API_CONSTANTS.ERROR_MESSAGES.SESSION_ID_REQUIRED,
          statusCode: SESSION_API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
        });
        return;
      }

      logger.debug('Updating session', { sessionId: validation.sessionId, updates: req.body });

      try {
        const session = this.sessionService.updateSession(validation.sessionId!, req.body);
        
        logger.debug('Session updated', { sessionId: validation.sessionId });

        res.json({
          id: session.id,
          created_at: session.created_at,
          model: session.model,
          system_prompt: session.system_prompt,
          max_turns: session.max_turns,
          message_count: session.message_count,
          status: session.status
        });
      } catch (serviceError: any) {
        // Check if this is a "not found" error from service
        if (serviceError.message?.includes('Session not found')) {
          this.sendErrorResponse(res, {
            type: SessionErrorType.SESSION_NOT_FOUND,
            message: SESSION_API_CONSTANTS.ERROR_MESSAGES.SESSION_NOT_FOUND,
            statusCode: SESSION_API_CONSTANTS.HTTP_STATUS.NOT_FOUND
          });
          return;
        }
        throw serviceError; // Re-throw for general error handling
      }
    } catch (error) {
      logger.error('Failed to update session', { error });
      this.sendErrorResponse(res, {
        type: SessionErrorType.SERVICE_ERROR,
        message: SESSION_API_CONSTANTS.ERROR_MESSAGES.SESSION_UPDATE_FAILED,
        statusCode: SESSION_API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
      });
    }
  }

  /**
   * DELETE /v1/sessions/{session_id} endpoint
   * Deletes session with proper 404 handling
   */
  async deleteSession(req: Request, res: Response): Promise<void> {
    try {
      const validation = this.validateSessionId(req.params.session_id);
      
      if (!validation.isValid) {
        this.sendPythonErrorResponse(res, 
          SESSION_API_CONSTANTS.ERROR_MESSAGES.SESSION_ID_REQUIRED,
          SESSION_API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
        );
        return;
      }

      logger.debug('Deleting session', { sessionId: validation.sessionId });

      const deleted = this.sessionService.deleteSession(validation.sessionId!);

      if (!deleted) {
        logger.debug('Session not found for deletion', { sessionId: validation.sessionId });
        this.sendPythonErrorResponse(res, 
          `Session ${validation.sessionId} not found`,
          SESSION_API_CONSTANTS.HTTP_STATUS.NOT_FOUND
        );
        return;
      }

      logger.info('Session deleted successfully', { sessionId: validation.sessionId });
      
      const pythonResponse: PythonSessionDelete = SessionAPIUtils.toPythonDeleteResponse(validation.sessionId!);
      res.status(SESSION_API_CONSTANTS.HTTP_STATUS.OK).json(pythonResponse);
    } catch (error) {
      logger.error('Failed to delete session', { error, sessionId: req.params.session_id });
      this.sendPythonErrorResponse(res, SESSION_API_CONSTANTS.ERROR_MESSAGES.SESSION_DELETION_FAILED);
    }
  }

  /**
   * Validate session ID parameter
   * Returns validation result with proper error codes
   */
  private validateSessionId(sessionId: string | undefined): SessionIdValidationResult {
    if (!sessionId || sessionId.trim().length === 0) {
      return {
        isValid: false,
        error: SESSION_API_CONSTANTS.ERROR_MESSAGES.SESSION_ID_REQUIRED,
        statusCode: SESSION_API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
      };
    }

    if (sessionId.length > 200) {
      return {
        isValid: false,
        error: SESSION_API_CONSTANTS.ERROR_MESSAGES.INVALID_SESSION_ID,
        statusCode: SESSION_API_CONSTANTS.HTTP_STATUS.BAD_REQUEST
      };
    }

    return {
      isValid: true,
      sessionId: sessionId.trim()
    };
  }

  /**
   * Send standardized error response
   */
  private sendErrorResponse(res: Response, error: SessionAPIError): void {
    res.status(error.statusCode).json({
      error: this.getErrorTypeDescription(error.type),
      message: error.message
    });
  }

  /**
   * Send Python-compatible error response  
   */
  private sendPythonErrorResponse(res: Response, message: string, statusCode: number = SESSION_API_CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR): void {
    res.status(statusCode).json({
      detail: message
    });
  }

  /**
   * Get human-readable error type description
   */
  private getErrorTypeDescription(type: SessionErrorType): string {
    switch (type) {
      case SessionErrorType.MISSING_SESSION_ID:
      case SessionErrorType.INVALID_SESSION_ID:
      case SessionErrorType.VALIDATION_ERROR:
        return 'Bad Request';
      case SessionErrorType.SESSION_NOT_FOUND:
        return 'Not Found';
      case SessionErrorType.SERVICE_ERROR:
      case SessionErrorType.INTERNAL_ERROR:
      default:
        return 'Internal Server Error';
    }
  }
}