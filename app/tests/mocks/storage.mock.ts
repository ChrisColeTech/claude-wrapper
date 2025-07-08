/**
 * Storage Mock
 * Provides mock implementation for session storage
 */

import { SessionInfo, SessionStorage } from '../../src/types';
import { StorageStats } from '../../src/session/storage';

export class MockSessionStorage implements SessionStorage {
  private sessions = new Map<string, SessionInfo>();
  private mockStats: Partial<StorageStats> = {};

  async store(session: SessionInfo): Promise<void> {
    this.sessions.set(session.session_id, { ...session });
  }

  async get(sessionId: string): Promise<SessionInfo | null> {
    return this.sessions.get(sessionId) || null;
  }

  async update(session: SessionInfo): Promise<void> {
    if (this.sessions.has(session.session_id)) {
      this.sessions.set(session.session_id, { ...session });
    } else {
      throw new Error(`Session not found for update: ${session.session_id}`);
    }
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async list(): Promise<SessionInfo[]> {
    return Array.from(this.sessions.values());
  }

  async cleanup(): Promise<number> {
    const now = new Date();
    let cleaned = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expires_at) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  async getStats(): Promise<StorageStats> {
    const sessions = Array.from(this.sessions.values());
    const activeSessions = sessions.filter(s => new Date() <= s.expires_at);
    
    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      expiredSessions: sessions.length - activeSessions.length,
      memoryUsageBytes: this.mockStats.memoryUsageBytes || 1024,
      oldestSessionAge: this.mockStats.oldestSessionAge || 0,
      lastCleanupTime: this.mockStats.lastCleanupTime || new Date(),
      cleanupCount: this.mockStats.cleanupCount || 0
    };
  }

  async clear(): Promise<void> {
    this.sessions.clear();
  }

  async isHealthy(): Promise<boolean> {
    return this.sessions.size < 1000;
  }

  // Test utilities
  setMockStats(stats: Partial<StorageStats>): void {
    this.mockStats = { ...this.mockStats, ...stats };
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }
}