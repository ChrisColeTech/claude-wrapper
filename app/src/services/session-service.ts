/**
 * Session Service - Business Logic Layer
 * Based on Python session_manager.py business logic
 * Provides high-level session operations with validation and error handling
 */

import { SessionManager, Session } from '../session/manager';
import { SessionInfo, SessionUtils, SessionListResponse } from '../models/session';
import { Message } from '../models/message';
import { getLogger } from '../utils/logger';

const logger = getLogger('SessionService');

/**
 * Session service configuration
 */
export interface SessionServiceConfig {
  defaultTtlHours: number;
  cleanupIntervalMinutes: number;
  maxSessionsPerUser: number;
  maxMessagesPerSession: number;
  enableAutoCleanup: boolean;
}

/**
 * Default session service configuration
 */
const DEFAULT_SESSION_CONFIG: SessionServiceConfig = {
  defaultTtlHours: 1,
  cleanupIntervalMinutes: 5,
  maxSessionsPerUser: 100,
  maxMessagesPerSession: 1000,
  enableAutoCleanup: true
};

/**
 * Session service business logic layer
 * Provides validated session operations matching Python behavior
 */
export class SessionService {
  private sessionManager: SessionManager;
  private config: SessionServiceConfig;

  constructor(config: Partial<SessionServiceConfig> = {}) {
    this.config = { ...DEFAULT_SESSION_CONFIG, ...config };
    
    this.sessionManager = new SessionManager(
      this.config.defaultTtlHours, 
      this.config.cleanupIntervalMinutes
    );

    if (this.config.enableAutoCleanup) {
      this.sessionManager.start_cleanup_task();
    }

    logger.info('SessionService initialized', this.config);
  }

  /**
   * Create a new session
   * Based on Python create_session business logic
   */
  createSession(sessionId?: string): SessionInfo {
    try {
      if (sessionId && !this.isValidSessionId(sessionId)) {
        throw new Error(`Invalid session ID format: ${sessionId}`);
      }

      const session = this.sessionManager.get_or_create_session(sessionId || `session_${Date.now()}`);
      
      logger.info('Session created', {
        sessionId: session.session_id,
        expiresAt: session.expires_at
      });

      return {
        session_id: session.session_id,
        created_at: session.created_at,
        last_accessed: session.last_accessed,
        message_count: session.messages.length,
        expires_at: session.expires_at
      };
    } catch (error) {
      logger.error('Failed to create session', { error, sessionId });
      throw new Error(`Session creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get an existing session
   * Based on Python get_session with validation
   */
  getSession(sessionId: string): SessionInfo | null {
    try {
      if (!this.isValidSessionId(sessionId)) {
        throw new Error(`Invalid session ID format: ${sessionId}`);
      }

      const session = this.getSessionById(sessionId);
      
      if (!session) {
        logger.debug('Session not found', { sessionId });
        return null;
      }

      logger.debug('Session retrieved', {
        sessionId: session.session_id,
        messageCount: session.messages.length
      });

      return {
        session_id: session.session_id,
        created_at: session.created_at,
        last_accessed: session.last_accessed,
        message_count: session.messages.length,
        expires_at: session.expires_at
      };
    } catch (error) {
      logger.error('Failed to get session', { error, sessionId });
      throw new Error(`Session retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get session with messages
   * For chat completion processing
   */
  getSessionWithMessages(sessionId: string): Session | null {
    try {
      if (!this.isValidSessionId(sessionId)) {
        throw new Error(`Invalid session ID format: ${sessionId}`);
      }

      const session = this.getSessionById(sessionId);
      
      if (session) {
        logger.debug('Session with messages retrieved', {
          sessionId: session.session_id,
          messageCount: session.messages.length
        });
      }

      return session;
    } catch (error) {
      logger.error('Failed to get session with messages', { error, sessionId });
      throw new Error(`Session retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add messages to a session
   * Used by chat completion processing
   */
  addMessagesToSession(sessionId: string, messages: Message[]): SessionInfo {
    try {
      if (!this.isValidSessionId(sessionId)) {
        throw new Error(`Invalid session ID format: ${sessionId}`);
      }

      if (!messages || messages.length === 0) {
        throw new Error('At least one message is required');
      }

      // Validate messages
      for (const message of messages) {
        if (!message.role || !message.content) {
          throw new Error('Invalid message format: role and content are required');
        }
      }

      const session = this.addMessagesViaManager(sessionId, messages);
      
      logger.info('Messages added to session', {
        sessionId: session.session_id,
        addedCount: messages.length,
        totalCount: session.messages.length
      });

      return {
        session_id: session.session_id,
        created_at: session.created_at,
        last_accessed: session.last_accessed,
        message_count: session.messages.length,
        expires_at: session.expires_at
      };
    } catch (error) {
      logger.error('Failed to add messages to session', { error, sessionId, messageCount: messages.length });
      throw new Error(`Adding messages failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update session metadata
   * Touch session to extend TTL
   */
  updateSession(sessionId: string): SessionInfo {
    try {
      if (!this.isValidSessionId(sessionId)) {
        throw new Error(`Invalid session ID format: ${sessionId}`);
      }

      const existingSession = this.getSessionById(sessionId);
      
      if (!existingSession) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      existingSession.touch();
      const updatedSession = existingSession;
      
      logger.debug('Session updated', {
        sessionId: updatedSession.session_id,
        newExpiresAt: updatedSession.expires_at
      });

      return {
        session_id: updatedSession.session_id,
        created_at: updatedSession.created_at,
        last_accessed: updatedSession.last_accessed,
        message_count: updatedSession.messages.length,
        expires_at: updatedSession.expires_at
      };
    } catch (error) {
      logger.error('Failed to update session', { error, sessionId });
      throw new Error(`Session update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a session
   * Based on Python delete_session
   */
  deleteSession(sessionId: string): boolean {
    try {
      if (!this.isValidSessionId(sessionId)) {
        throw new Error(`Invalid session ID format: ${sessionId}`);
      }

      const existingSession = this.getSessionById(sessionId);
      
      if (!existingSession) {
        logger.debug('Session not found for deletion', { sessionId });
        return false;
      }

      this.sessionManager.delete_session(sessionId);
      
      logger.info('Session deleted', { sessionId });
      return true;
    } catch (error) {
      logger.error('Failed to delete session', { error, sessionId });
      throw new Error(`Session deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all active sessions
   * Based on Python list_sessions with filtering
   */
  listSessions(): SessionListResponse {
    try {
      const sessions = this.sessionManager.list_sessions();
      
      const sessionInfos = sessions.map(session => ({
        session_id: session.session_id,
        created_at: session.created_at,
        last_accessed: session.last_accessed,
        message_count: session.messages.length,
        expires_at: session.expires_at
      }));

      const response = SessionUtils.createSessionList(sessionInfos);
      
      logger.debug('Sessions listed', { total: response.total });
      
      return response;
    } catch (error) {
      logger.error('Failed to list sessions', { error });
      throw new Error(`Session listing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up expired sessions
   * Based on Python cleanup_expired_sessions
   */
  cleanupExpiredSessions(): number {
    try {
      const cleanedCount = (this.sessionManager as any)._cleanup_expired_sessions();
      
      if (cleanedCount > 0) {
        logger.info('Session cleanup completed', { cleanedCount });
      }
      
      return cleanedCount;
    } catch (error) {
      logger.error('Session cleanup failed', { error });
      throw new Error(`Session cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get session statistics
   * For monitoring and health checks
   */
  getSessionStats(): {
    activeSessions: number;
    totalMessages: number;
    avgMessagesPerSession: number;
    oldestSession: Date | null;
    newestSession: Date | null;
  } {
    try {
      const sessions = this.sessionManager.list_sessions();
      const stats = {
        activeSessions: sessions.length,
        totalMessages: sessions.reduce((sum, s) => sum + s.messages.length, 0),
        avgMessagesPerSession: sessions.length > 0 ? sessions.reduce((sum, s) => sum + s.messages.length, 0) / sessions.length : 0,
        oldestSession: sessions.length > 0 ? new Date(Math.min(...sessions.map(s => s.created_at.getTime()))) : null,
        newestSession: sessions.length > 0 ? new Date(Math.max(...sessions.map(s => s.created_at.getTime()))) : null
      };
      
      logger.debug('Session statistics retrieved', stats);
      
      return stats;
    } catch (error) {
      logger.error('Failed to get session statistics', { error });
      throw new Error(`Session statistics failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if service is healthy
   */
  isHealthy(): boolean {
    const sessions = this.sessionManager.list_sessions();
    return sessions.length < this.config.maxSessionsPerUser;
  }

  /**
   * Get service configuration
   */
  getConfig(): SessionServiceConfig {
    return { ...this.config };
  }

  /**
   * Shutdown the service
   * Clean up resources and stop background tasks
   */
  shutdown(): void {
    logger.info('SessionService shutting down');
    this.sessionManager.shutdown();
  }

  /**
   * Get session by ID from manager
   * Helper method to bridge SessionManager interface
   */
  private getSessionById(sessionId: string): Session | null {
    const allSessions = this.sessionManager.list_sessions();
    return allSessions.find(s => s.session_id === sessionId) || null;
  }

  /**
   * Add messages using SessionManager interface
   */
  private addMessagesViaManager(sessionId: string, messages: Message[]): Session {
    const [processedMessages, resultSessionId] = this.sessionManager.process_messages(messages, sessionId);
    const session = this.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session not found after processing: ${sessionId}`);
    }
    return session;
  }

  /**
   * Validate session ID format
   * Ensures consistent session ID formatting
   */
  private isValidSessionId(sessionId: string): boolean {
    if (!sessionId || typeof sessionId !== 'string') {
      return false;
    }

    // Session ID should be non-empty and reasonable length
    if (sessionId.length < 1 || sessionId.length > 100) {
      return false;
    }

    // Should contain only valid characters (alphanumeric, hyphens, underscores)
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    return validPattern.test(sessionId);
  }
}
