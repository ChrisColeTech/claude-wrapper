/**
 * Enhanced In-Memory Session Storage
 * Based on Python session_manager.py storage patterns
 * Provides thread-safe, high-performance session storage with statistics
 */

import { SessionInfo, SessionStorage, SessionUtils } from '../models/session';
import { getLogger } from '../utils/logger';

const logger = getLogger('SessionStorage');

/**
 * Storage statistics for monitoring
 */
export interface StorageStats {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  memoryUsageBytes: number;
  avgSessionSizeBytes: number;
  oldestSessionAge: number;
  newestSessionAge: number;
  lastCleanupTime: Date | null;
  cleanupCount: number;
}

/**
 * Enhanced in-memory session storage
 * Based on Python threading.Lock() pattern for thread safety
 */
export class EnhancedMemorySessionStorage implements SessionStorage {
  private sessions = new Map<string, SessionInfo>();
  private accessCounts = new Map<string, number>();
  private lastCleanup: Date | null = null;
  private cleanupCount = 0;
  private readonly lock = new AsyncLock();

  constructor(
    private readonly maxSessions: number = 10000,
    private readonly trackAccess: boolean = true
  ) {
    logger.info('Enhanced memory session storage initialized', {
      maxSessions,
      trackAccess
    });
  }

  /**
   * Store a session with thread safety
   * Based on Python with self.lock pattern
   */
  async store(session: SessionInfo): Promise<void> {
    return this.lock.acquire('storage', async () => {
      // Check capacity limits
      if (this.sessions.size >= this.maxSessions) {
        // Remove oldest expired session to make room
        await this._evictOldestExpired();
        
        // If still at capacity, remove oldest session regardless of expiry
        if (this.sessions.size >= this.maxSessions) {
          await this._evictOldest();
        }
      }

      this.sessions.set(session.session_id, { ...session });
      
      if (this.trackAccess) {
        this.accessCounts.set(session.session_id, 0);
      }

      logger.debug('Session stored', {
        sessionId: session.session_id,
        totalSessions: this.sessions.size
      });
    });
  }

  /**
   * Retrieve a session with lazy cleanup
   * Based on Python get_session with expiry check
   */
  async get(sessionId: string): Promise<SessionInfo | null> {
    return this.lock.acquire('storage', async () => {
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        return null;
      }

      // Check expiration (lazy cleanup)
      if (SessionUtils.isExpired(session)) {
        this.sessions.delete(sessionId);
        this.accessCounts.delete(sessionId);
        
        logger.debug('Expired session removed during get', { sessionId });
        return null;
      }

      // Track access
      if (this.trackAccess) {
        const currentCount = this.accessCounts.get(sessionId) || 0;
        this.accessCounts.set(sessionId, currentCount + 1);
      }

      return { ...session };
    });
  }

  /**
   * Update an existing session
   */
  async update(session: SessionInfo): Promise<void> {
    return this.lock.acquire('storage', async () => {
      if (this.sessions.has(session.session_id)) {
        this.sessions.set(session.session_id, { ...session });
        
        logger.debug('Session updated', {
          sessionId: session.session_id,
          lastAccessed: session.last_accessed
        });
      } else {
        throw new Error(`Session not found for update: ${session.session_id}`);
      }
    });
  }

  /**
   * Delete a session
   */
  async delete(sessionId: string): Promise<void> {
    return this.lock.acquire('storage', async () => {
      const deleted = this.sessions.delete(sessionId);
      this.accessCounts.delete(sessionId);
      
      if (deleted) {
        logger.debug('Session deleted', {
          sessionId,
          remainingSessions: this.sessions.size
        });
      }
    });
  }

  /**
   * List all active sessions
   */
  async list(): Promise<SessionInfo[]> {
    return this.lock.acquire('storage', async () => {
      const allSessions = Array.from(this.sessions.values());
      return SessionUtils.filterActiveSessions(allSessions);
    });
  }

  /**
   * Clean up expired sessions
   * Based on Python _cleanup_expired_sessions method
   */
  async cleanup(): Promise<number> {
    return this.lock.acquire('storage', async () => {
      const startTime = Date.now();
      let cleaned = 0;

      for (const [sessionId, session] of this.sessions.entries()) {
        if (SessionUtils.isExpired(session)) {
          this.sessions.delete(sessionId);
          this.accessCounts.delete(sessionId);
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
    });
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    return this.lock.acquire('storage', async () => {
      const allSessions = Array.from(this.sessions.values());
      const activeSessions = SessionUtils.filterActiveSessions(allSessions);
      const expiredSessions = allSessions.length - activeSessions.length;

      // Calculate memory usage estimate
      const estimatedMemoryUsage = this._estimateMemoryUsage();
      const avgSessionSize = allSessions.length > 0 ? estimatedMemoryUsage / allSessions.length : 0;

      // Calculate session ages
      const now = Date.now();
      const sessionAges = activeSessions.map(s => now - s.created_at.getTime());
      const oldestSessionAge = sessionAges.length > 0 ? Math.max(...sessionAges) : 0;
      const newestSessionAge = sessionAges.length > 0 ? Math.min(...sessionAges) : 0;

      return {
        totalSessions: allSessions.length,
        activeSessions: activeSessions.length,
        expiredSessions,
        memoryUsageBytes: estimatedMemoryUsage,
        avgSessionSizeBytes: Math.round(avgSessionSize),
        oldestSessionAge: Math.round(oldestSessionAge / 1000), // seconds
        newestSessionAge: Math.round(newestSessionAge / 1000), // seconds
        lastCleanupTime: this.lastCleanup,
        cleanupCount: this.cleanupCount
      };
    });
  }

  /**
   * Get session access statistics
   */
  async getAccessStats(): Promise<Map<string, number>> {
    if (!this.trackAccess) {
      throw new Error('Access tracking is disabled');
    }

    return this.lock.acquire('storage', async () => {
      return new Map(this.accessCounts);
    });
  }

  /**
   * Get most accessed sessions
   */
  async getMostAccessedSessions(limit: number = 10): Promise<Array<{ sessionId: string; accessCount: number }>> {
    if (!this.trackAccess) {
      throw new Error('Access tracking is disabled');
    }

    return this.lock.acquire('storage', async () => {
      const entries = Array.from(this.accessCounts.entries())
        .map(([sessionId, count]) => ({ sessionId, accessCount: count }))
        .sort((a, b) => b.accessCount - a.accessCount)
        .slice(0, limit);

      return entries;
    });
  }

  /**
   * Clear all sessions (for testing/maintenance)
   */
  async clear(): Promise<void> {
    return this.lock.acquire('storage', async () => {
      const count = this.sessions.size;
      this.sessions.clear();
      this.accessCounts.clear();
      
      logger.info('All sessions cleared', { clearedCount: count });
    });
  }

  /**
   * Check storage health
   */
  async isHealthy(): Promise<boolean> {
    try {
      const stats = await this.getStats();
      return stats.totalSessions < this.maxSessions * 0.9; // 90% capacity threshold
    } catch (error) {
      logger.error('Health check failed', { error });
      return false;
    }
  }

  /**
   * Evict oldest expired session
   */
  private async _evictOldestExpired(): Promise<void> {
    const expiredSessions = Array.from(this.sessions.entries())
      .filter(([, session]) => SessionUtils.isExpired(session))
      .sort(([, a], [, b]) => a.expires_at.getTime() - b.expires_at.getTime());

    if (expiredSessions.length > 0) {
      const [sessionId] = expiredSessions[0];
      this.sessions.delete(sessionId);
      this.accessCounts.delete(sessionId);
      
      logger.debug('Evicted oldest expired session', { sessionId });
    }
  }

  /**
   * Evict oldest session regardless of expiry
   */
  private async _evictOldest(): Promise<void> {
    const oldestSession = Array.from(this.sessions.entries())
      .sort(([, a], [, b]) => a.created_at.getTime() - b.created_at.getTime())[0];

    if (oldestSession) {
      const [sessionId] = oldestSession;
      this.sessions.delete(sessionId);
      this.accessCounts.delete(sessionId);
      
      logger.warn('Evicted oldest session due to capacity limit', { sessionId });
    }
  }

  /**
   * Estimate memory usage of stored sessions
   */
  private _estimateMemoryUsage(): number {
    let totalBytes = 0;

    for (const session of this.sessions.values()) {
      // Rough estimate: JSON representation size
      const sessionStr = JSON.stringify(SessionUtils.toSerializable(session));
      totalBytes += sessionStr.length * 2; // UTF-16 encoding
    }

    // Add overhead for Map structure and access counters
    totalBytes += this.sessions.size * 50; // Map overhead estimate
    totalBytes += this.accessCounts.size * 12; // Number storage

    return totalBytes;
  }
}

/**
 * Simple async lock implementation
 * Based on Python threading.Lock() behavior
 */
class AsyncLock {
  private locks = new Map<string, Promise<void>>();

  async acquire<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // Wait for any existing lock
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }

    // Create new lock
    let resolve: () => void;
    const lockPromise = new Promise<void>((res) => {
      resolve = res;
    });

    this.locks.set(key, lockPromise);

    try {
      const result = await fn();
      return result;
    } finally {
      // Release lock
      this.locks.delete(key);
      resolve!();
    }
  }
}

/**
 * Session storage factory
 */
export class SessionStorageFactory {
  /**
   * Create enhanced memory storage
   */
  static createMemoryStorage(
    maxSessions: number = 10000,
    trackAccess: boolean = true
  ): EnhancedMemorySessionStorage {
    return new EnhancedMemorySessionStorage(maxSessions, trackAccess);
  }

  /**
   * Create storage based on configuration
   */
  static createStorage(
    type: 'memory' = 'memory',
    options: any = {}
  ): SessionStorage {
    if (type !== 'memory') {
      throw new Error(`Only memory storage is implemented. Requested: ${type}`);
    }
    
    return new EnhancedMemorySessionStorage(
      options.maxSessions,
      options.trackAccess
    );
  }
}