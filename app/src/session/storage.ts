/**
 * Enhanced In-Memory Session Storage
 * Simplified from original claude-wrapper for POC requirements
 * Follows SRP and DRY principles
 */

import { SessionInfo, SessionStorage } from '../types';
import { SESSION_CONFIG, SESSION_PERFORMANCE } from '../config/constants';
import { logger } from '../utils/logger';

/**
 * Storage statistics for monitoring
 */
export interface StorageStats {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  memoryUsageBytes: number;
  oldestSessionAge: number;
  lastCleanupTime: Date | null;
  cleanupCount: number;
}

/**
 * Session utilities for common operations
 */
export class SessionUtils {
  static isExpired(session: SessionInfo): boolean {
    return new Date() > session.expires_at;
  }

  static filterActiveSessions(sessions: SessionInfo[]): SessionInfo[] {
    return sessions.filter(session => !this.isExpired(session));
  }

  static touchSession(session: SessionInfo): void {
    session.last_accessed = new Date();
    session.expires_at = new Date(Date.now() + SESSION_CONFIG.DEFAULT_TTL_HOURS * 60 * 60 * 1000);
  }

  static estimateMemoryUsage(sessions: Map<string, SessionInfo>): number {
    let totalBytes = 0;

    for (const session of sessions.values()) {
      const sessionStr = JSON.stringify(session);
      totalBytes += sessionStr.length * 2; // UTF-16 encoding
    }

    // Add overhead for Map structure
    totalBytes += sessions.size * 50;
    return totalBytes;
  }
}

/**
 * Simple synchronous lock for thread safety
 * Adapted from original's async pattern for Node.js single-threaded execution
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
 * Enhanced in-memory session storage
 * Simplified from original claude-wrapper for POC requirements
 */
export class MemorySessionStorage implements SessionStorage {
  private sessions = new Map<string, SessionInfo>();
  private lastCleanup: Date | null = null;
  private cleanupCount = 0;
  private readonly lock = new SyncLock();

  constructor(
    private readonly maxSessions: number = SESSION_CONFIG.MAX_SESSIONS
  ) {
    logger.info('Memory session storage initialized', { maxSessions });
  }

  async store(session: SessionInfo): Promise<void> {
    return Promise.resolve(this.lock.acquire(() => {
      // Check capacity limits
      if (this.sessions.size >= this.maxSessions) {
        this.evictOldestExpired();
        
        // If still at capacity, remove oldest session
        if (this.sessions.size >= this.maxSessions) {
          this.evictOldest();
        }
      }

      this.sessions.set(session.session_id, {
        ...session,
        messages: session.messages.map(msg => ({ ...msg }))
      });

      logger.debug('Session stored', {
        sessionId: session.session_id,
        totalSessions: this.sessions.size
      });
    }));
  }

  async get(sessionId: string): Promise<SessionInfo | null> {
    return Promise.resolve(this.lock.acquire(() => {
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        return null;
      }

      // Check expiration (lazy cleanup)
      if (SessionUtils.isExpired(session)) {
        this.sessions.delete(sessionId);
        logger.debug('Expired session removed during get', { sessionId });
        return null;
      }

      return {
        ...session,
        messages: session.messages.map(msg => ({ ...msg }))
      };
    }));
  }

  async update(session: SessionInfo): Promise<void> {
    return Promise.resolve(this.lock.acquire(() => {
      if (this.sessions.has(session.session_id)) {
        this.sessions.set(session.session_id, {
          ...session,
          messages: session.messages.map(msg => ({ ...msg }))
        });
        
        logger.debug('Session updated', {
          sessionId: session.session_id,
          lastAccessed: session.last_accessed
        });
      } else {
        throw new Error(`Session not found for update: ${session.session_id}`);
      }
    }));
  }

  async delete(sessionId: string): Promise<void> {
    return Promise.resolve(this.lock.acquire(() => {
      const deleted = this.sessions.delete(sessionId);
      
      if (deleted) {
        logger.debug('Session deleted', {
          sessionId,
          remainingSessions: this.sessions.size
        });
      }
    }));
  }

  async list(): Promise<SessionInfo[]> {
    return Promise.resolve(this.lock.acquire(() => {
      const allSessions = Array.from(this.sessions.values()).map(session => ({
        ...session,
        messages: session.messages.map(msg => ({ ...msg }))
      }));
      return SessionUtils.filterActiveSessions(allSessions);
    }));
  }

  async cleanup(): Promise<number> {
    return Promise.resolve(this.lock.acquire(() => {
      const startTime = Date.now();
      let cleaned = 0;

      for (const [sessionId, session] of this.sessions.entries()) {
        if (SessionUtils.isExpired(session)) {
          this.sessions.delete(sessionId);
          cleaned++;
        }
      }

      this.lastCleanup = new Date();
      this.cleanupCount++;

      const duration = Date.now() - startTime;

      if (cleaned > 0) {
        logger.info('Storage cleanup completed', {
          cleanedSessions: cleaned,
          remainingSessions: this.sessions.size,
          durationMs: duration,
          cleanupCount: this.cleanupCount
        });
      }

      return cleaned;
    }));
  }

  async getStats(): Promise<StorageStats> {
    return Promise.resolve(this.lock.acquire(() => {
      const allSessions = Array.from(this.sessions.values());
      const activeSessions = SessionUtils.filterActiveSessions(allSessions);
      const expiredSessions = allSessions.length - activeSessions.length;

      // Calculate memory usage estimate
      const memoryUsage = SessionUtils.estimateMemoryUsage(this.sessions);

      // Calculate session ages
      const now = Date.now();
      const sessionAges = activeSessions.map(s => now - s.created_at.getTime());
      const oldestSessionAge = sessionAges.length > 0 ? Math.max(...sessionAges) : 0;

      return {
        totalSessions: allSessions.length,
        activeSessions: activeSessions.length,
        expiredSessions,
        memoryUsageBytes: memoryUsage,
        oldestSessionAge: Math.round(oldestSessionAge / 1000), // seconds
        lastCleanupTime: this.lastCleanup,
        cleanupCount: this.cleanupCount
      };
    }));
  }

  async clear(): Promise<void> {
    return Promise.resolve(this.lock.acquire(() => {
      const count = this.sessions.size;
      this.sessions.clear();
      
      logger.info('All sessions cleared', { clearedCount: count });
    }));
  }

  async isHealthy(): Promise<boolean> {
    try {
      const stats = await this.getStats();
      return stats.totalSessions < this.maxSessions * SESSION_PERFORMANCE.MEMORY_WARNING_THRESHOLD;
    } catch (error) {
      logger.error('Health check failed', undefined, { error });
      return false;
    }
  }

  private evictOldestExpired(): void {
    const expiredSessions = Array.from(this.sessions.entries())
      .filter(([, session]) => SessionUtils.isExpired(session))
      .sort(([, a], [, b]) => a.expires_at.getTime() - b.expires_at.getTime());

    if (expiredSessions.length > 0) {
      const firstExpired = expiredSessions[0];
      if (firstExpired) {
        const [sessionId] = firstExpired;
        this.sessions.delete(sessionId);
        
        logger.debug('Evicted oldest expired session', { sessionId });
      }
    }
  }

  private evictOldest(): void {
    const oldestSession = Array.from(this.sessions.entries())
      .sort(([, a], [, b]) => a.created_at.getTime() - b.created_at.getTime())[0];

    if (oldestSession) {
      const [sessionId] = oldestSession;
      this.sessions.delete(sessionId);
      
      logger.warn('Evicted oldest session due to capacity limit', { sessionId });
    }
  }
}

/**
 * Session storage factory
 */
export class SessionStorageFactory {
  static createMemoryStorage(maxSessions: number = SESSION_CONFIG.MAX_SESSIONS): MemorySessionStorage {
    return new MemorySessionStorage(maxSessions);
  }

  static createStorage(type: 'memory' = 'memory', options: any = {}): SessionStorage {
    if (type !== 'memory') {
      throw new Error(`Only memory storage is implemented. Requested: ${type}`);
    }
    
    return new MemorySessionStorage(options.maxSessions);
  }
}