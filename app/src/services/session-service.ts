/**
 * Session Service - Business Logic Layer
 * Based on Python session_manager.py business logic
 * Provides high-level session operations with validation and error handling
 */

import { SessionManager, Session } from '../session/manager';
import { SessionInfo, SessionUtils, SessionListResponse } from '../models/session';
import { Message } from '../models/message';
import { EnhancedMemorySessionStorage } from '../session/storage';
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
    
    const storage = new EnhancedMemorySessionStorage(
      this.config.maxSessionsPerUser * 10, // Allow more storage capacity
      true // Enable access tracking
    );

    this.sessionManager = new SessionManager(storage, {
      defaultTtlHours: this.config.defaultTtlHours,
      cleanupIntervalMinutes: this.config.cleanupIntervalMinutes,
      maxSessionsPerUser: this.config.maxSessionsPerUser,
      maxMessagesPerSession: this.config.maxMessagesPerSession
    });

    if (this.config.enableAutoCleanup) {
      this.sessionManager.startCleanupTask();
    }

    logger.info('SessionService initialized', this.config);
  }

  /**
   * Create a new session
   * Based on Python create_session business logic
   */
  async createSession(sessionId?: string): Promise<SessionInfo> {
    try {
      if (sessionId && !this.isValidSessionId(sessionId)) {
        throw new Error(`Invalid session ID format: ${sessionId}`);
      }

      const session = await this.sessionManager.getOrCreateSession(sessionId);
      
      logger.info('Session created', {
        sessionId: session.session_id,
        expiresAt: session.expires_at
      });

      return {
        session_id: session.session_id,
        created_at: session.created_at,
        last_accessed: session.last_accessed,
        message_count: session.message_count,
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
  async getSession(sessionId: string): Promise<SessionInfo | null> {
    try {
      if (!this.isValidSessionId(sessionId)) {
        throw new Error(`Invalid session ID format: ${sessionId}`);
      }

      const session = await this.sessionManager.getSession(sessionId);
      
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
        message_count: session.message_count,
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
  async getSessionWithMessages(sessionId: string): Promise<Session | null> {
    try {
      if (!this.isValidSessionId(sessionId)) {
        throw new Error(`Invalid session ID format: ${sessionId}`);
      }

      const session = await this.sessionManager.getSession(sessionId);
      
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
  async addMessagesToSession(sessionId: string, messages: Message[]): Promise<SessionInfo> {
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

      const session = await this.sessionManager.addMessages(sessionId, messages);
      
      logger.info('Messages added to session', {
        sessionId: session.session_id,
        addedCount: messages.length,
        totalCount: session.messages.length
      });

      return {
        session_id: session.session_id,
        created_at: session.created_at,
        last_accessed: session.last_accessed,
        message_count: session.message_count,
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
  async updateSession(sessionId: string): Promise<SessionInfo> {
    try {
      if (!this.isValidSessionId(sessionId)) {
        throw new Error(`Invalid session ID format: ${sessionId}`);
      }

      const existingSession = await this.sessionManager.getSession(sessionId);
      
      if (!existingSession) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const updatedSession = await this.sessionManager.touchSession(existingSession);
      
      logger.debug('Session updated', {
        sessionId: updatedSession.session_id,
        newExpiresAt: updatedSession.expires_at
      });

      return {
        session_id: updatedSession.session_id,
        created_at: updatedSession.created_at,
        last_accessed: updatedSession.last_accessed,
        message_count: updatedSession.message_count,
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
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      if (!this.isValidSessionId(sessionId)) {
        throw new Error(`Invalid session ID format: ${sessionId}`);
      }

      const existingSession = await this.sessionManager.getSession(sessionId);
      
      if (!existingSession) {
        logger.debug('Session not found for deletion', { sessionId });
        return false;
      }

      await this.sessionManager.deleteSession(sessionId);
      
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
  async listSessions(): Promise<SessionListResponse> {
    try {
      const sessions = await this.sessionManager.listSessions();
      
      const sessionInfos = sessions.map(session => ({
        session_id: session.session_id,
        created_at: session.created_at,
        last_accessed: session.last_accessed,
        message_count: session.message_count,
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
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const cleanedCount = await this.sessionManager.cleanupExpiredSessions();
      
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
  async getSessionStats(): Promise<{
    activeSessions: number;
    totalMessages: number;
    avgMessagesPerSession: number;
    oldestSession: Date | null;
    newestSession: Date | null;
  }> {
    try {
      const stats = await this.sessionManager.getSessionStats();
      
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
    return this.sessionManager.isHealthy();
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
