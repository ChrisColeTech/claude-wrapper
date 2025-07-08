/**
 * Session Manager with TTL and Background Cleanup
 * Simplified from original claude-wrapper for POC requirements
 * Follows SRP and DRY principles with interfaces for testability
 */

import { OpenAIMessage, SessionInfo, ISessionManager, ISessionCleanup, SessionStats } from '../types';
import { MemorySessionStorage, SessionUtils } from './storage';
import { SESSION_CONFIG } from '../config/constants';
import { logger } from '../utils/logger';

/**
 * Session class for individual session management
 * Simplified from original Session class
 */
export class Session {
  session_id: string;
  messages: OpenAIMessage[];
  created_at: Date;
  last_accessed: Date;
  expires_at: Date;

  constructor(session_id: string) {
    this.session_id = session_id;
    this.messages = [];
    this.created_at = new Date();
    this.last_accessed = new Date();
    this.expires_at = new Date(Date.now() + SESSION_CONFIG.DEFAULT_TTL_HOURS * 60 * 60 * 1000);
  }

  touch(): void {
    SessionUtils.touchSession(this);
  }

  addMessages(messages: OpenAIMessage[]): void {
    // Add new messages first
    this.messages.push(...messages);
    
    // Then limit message history to prevent memory bloat
    if (this.messages.length > SESSION_CONFIG.MAX_MESSAGE_HISTORY) {
      const removeCount = this.messages.length - SESSION_CONFIG.MAX_MESSAGE_HISTORY;
      this.messages.splice(0, removeCount);
    }

    this.touch();
  }

  getAllMessages(): OpenAIMessage[] {
    return [...this.messages];
  }

  isExpired(): boolean {
    return SessionUtils.isExpired(this);
  }

  toSessionInfo(): SessionInfo {
    return {
      session_id: this.session_id,
      messages: [...this.messages],
      created_at: this.created_at,
      last_accessed: this.last_accessed,
      expires_at: this.expires_at
    };
  }
}

/**
 * Simple synchronous lock for thread safety
 * Node.js single-threaded execution makes this simple
 */
class SyncLock {
  private locked = false;

  acquire<T>(fn: () => T): T {
    if (this.locked) {
      logger.warn('Lock contention detected - this should not happen in single-threaded Node.js');
    }
    
    this.locked = true;
    try {
      return fn();
    } finally {
      this.locked = false;
    }
  }
}

/**
 * Session Manager class
 * Simplified from original SessionManager for POC requirements
 */
export class SessionManager implements ISessionManager, ISessionCleanup {
  private sessions: Map<string, Session> = new Map();
  // Storage for future persistence features
  private _storage: MemorySessionStorage;
  private lock = new SyncLock();
  private cleanupTask: NodeJS.Timeout | null = null;

  constructor(
    private readonly _defaultTtlHours: number = SESSION_CONFIG.DEFAULT_TTL_HOURS,
    private readonly cleanupIntervalMinutes: number = SESSION_CONFIG.CLEANUP_INTERVAL_MINUTES
  ) {
    this._storage = new MemorySessionStorage();
    
    logger.info('SessionManager initialized', {
      defaultTtlHours: this._defaultTtlHours,
      cleanupIntervalMinutes
    });
  }

  startCleanupTask(): void {
    if (this.cleanupTask) {
      logger.warn('Cleanup task already running');
      return;
    }

    const intervalMs = this.cleanupIntervalMinutes * 60 * 1000;
    
    // Skip interval creation in test environment to prevent memory leaks
    if (process.env['NODE_ENV'] === 'test' || process.env['JEST_WORKER_ID']) {
      logger.info('Skipping cleanup task interval creation in test environment');
      return;
    }
    
    this.cleanupTask = setInterval(() => {
      try {
        this.cleanupExpiredSessions();
      } catch (error) {
        logger.error('Error during session cleanup', undefined, { error });
      }
    }, intervalMs);

    logger.info('Background cleanup task started', {
      intervalMinutes: this.cleanupIntervalMinutes
    });
  }

  shutdown(): void {
    if (this.cleanupTask) {
      clearInterval(this.cleanupTask);
      this.cleanupTask = null;
      logger.info('Background cleanup task stopped');
    }
  }

  isRunning(): boolean {
    return this.cleanupTask !== null;
  }

  getOrCreateSession(sessionId: string): SessionInfo {
    return this.lock.acquire(() => {
      if (this.sessions.has(sessionId)) {
        const session = this.sessions.get(sessionId)!;
        if (session.isExpired()) {
          logger.info(`Session ${sessionId} expired, creating new session`);
          this.sessions.delete(sessionId);
          const newSession = new Session(sessionId);
          this.sessions.set(sessionId, newSession);
          return newSession.toSessionInfo();
        } else {
          session.touch();
          return session.toSessionInfo();
        }
      } else {
        const session = new Session(sessionId);
        this.sessions.set(sessionId, session);
        logger.info(`Created new session: ${sessionId}`);
        return session.toSessionInfo();
      }
    });
  }

  processMessages(messages: OpenAIMessage[], sessionId?: string | null): [OpenAIMessage[], string | null] {
    if (sessionId === null || sessionId === undefined) {
      // Stateless mode - return messages as-is
      return [messages, null];
    }

    this.getOrCreateSession(sessionId);
    const session = this.sessions.get(sessionId)!;
    session.addMessages(messages);
    const allMessages = session.getAllMessages();
    
    return [allMessages, sessionId];
  }

  listSessions(): SessionInfo[] {
    return this.lock.acquire(() => {
      const activeSessions: SessionInfo[] = [];
      
      for (const session of this.sessions.values()) {
        if (!session.isExpired()) {
          activeSessions.push(session.toSessionInfo());
        }
      }
      
      return activeSessions;
    });
  }

  deleteSession(sessionId: string): void {
    this.lock.acquire(() => {
      this.sessions.delete(sessionId);
      logger.info(`Session deleted: ${sessionId}`);
    });
  }

  getSessionCount(): number {
    return this.lock.acquire(() => {
      return this.sessions.size;
    });
  }

  getSessionStats(): SessionStats {
    return this.lock.acquire(() => {
      let activeSessions = 0;
      let expiredSessions = 0;
      let totalMessages = 0;
      let oldestSessionTime = Date.now();

      for (const session of this.sessions.values()) {
        if (session.isExpired()) {
          expiredSessions++;
        } else {
          activeSessions++;
        }
        
        totalMessages += session.messages.length;
        
        if (session.created_at.getTime() < oldestSessionTime) {
          oldestSessionTime = session.created_at.getTime();
        }
      }

      return {
        totalSessions: this.sessions.size,
        activeSessions,
        expiredSessions,
        averageMessageCount: this.sessions.size > 0 ? totalMessages / this.sessions.size : 0,
        oldestSessionAge: this.sessions.size > 0 ? Date.now() - oldestSessionTime : 0
      };
    });
  }

  addAssistantResponse(sessionId: string, message: OpenAIMessage): void {
    this.lock.acquire(() => {
      const session = this.sessions.get(sessionId);
      if (session && !session.isExpired()) {
        session.addMessages([message]);
        logger.debug('Assistant response added to session', { sessionId });
      }
    });
  }

  getSession(sessionId: string): SessionInfo | null {
    return this.lock.acquire(() => {
      const session = this.sessions.get(sessionId);
      if (!session || session.isExpired()) {
        return null;
      }
      return session.toSessionInfo();
    });
  }

  private cleanupExpiredSessions(): void {
    this.lock.acquire(() => {
      let cleanedCount = 0;
      const expiredSessionIds: string[] = [];
      
      for (const [sessionId, session] of this.sessions.entries()) {
        if (session.isExpired()) {
          expiredSessionIds.push(sessionId);
        }
      }
      
      for (const sessionId of expiredSessionIds) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
      
      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} expired sessions`);
      }
    });
  }

  // Getter for storage (for future use)
  get storage(): MemorySessionStorage {
    return this._storage;
  }
}

// Global session manager instance
export const sessionManager = new SessionManager();