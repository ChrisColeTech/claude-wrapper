/**
 * Unit tests for Enhanced Memory Session Storage
 * Tests src/session/storage.ts components
 * Based on Python session_manager.py storage validation patterns
 */

import { EnhancedMemorySessionStorage, SessionStorageFactory, StorageStats } from '../../../src/session/storage';
import { SessionInfo, SessionUtils } from '../../../src/models/session';

// Mock logger to avoid console output during tests
jest.mock('../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('EnhancedMemorySessionStorage', () => {
  let storage: EnhancedMemorySessionStorage;

  beforeEach(() => {
    storage = new EnhancedMemorySessionStorage(100, true); // 100 max sessions, track access
  });

  afterEach(async () => {
    await storage.clear();
  });

  describe('Storage initialization', () => {
    it('should initialize with default values', () => {
      const defaultStorage = new EnhancedMemorySessionStorage();
      expect(defaultStorage).toBeInstanceOf(EnhancedMemorySessionStorage);
    });

    it('should initialize with custom values', () => {
      const customStorage = new EnhancedMemorySessionStorage(500, false);
      expect(customStorage).toBeInstanceOf(EnhancedMemorySessionStorage);
    });
  });

  describe('Session storage operations', () => {
    const createTestSession = (sessionId: string): SessionInfo => ({
      session_id: sessionId,
      message_count: 0,
      created_at: new Date(),
      last_accessed: new Date(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
    });

    it('should store a session successfully', async () => {
      const session = createTestSession('test_session');
      
      await storage.store(session);
      
      const retrieved = await storage.get('test_session');
      expect(retrieved).toBeDefined();
      expect(retrieved!.session_id).toBe('test_session');
    });

    it('should retrieve existing session', async () => {
      const session = createTestSession('retrieve_test');
      await storage.store(session);
      
      const retrieved = await storage.get('retrieve_test');
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.session_id).toBe('retrieve_test');
      expect(retrieved!.message_count).toBe(0);
    });

    it('should return null for non-existent session', async () => {
      const retrieved = await storage.get('non_existent');
      
      expect(retrieved).toBeNull();
    });

    it('should update existing session', async () => {
      const session = createTestSession('update_test');
      await storage.store(session);
      
      // Wait a moment to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 5));
      
      const updatedSession = { ...session, last_accessed: new Date() };
      await storage.update(updatedSession);
      
      const retrieved = await storage.get('update_test');
      expect(retrieved).toBeDefined();
      expect(retrieved!.last_accessed.getTime()).toBeGreaterThanOrEqual(session.last_accessed.getTime());
    });

    it('should throw error when updating non-existent session', async () => {
      const session = createTestSession('non_existent');
      
      await expect(storage.update(session))
        .rejects.toThrow('Session not found for update: non_existent');
    });

    it('should delete existing session', async () => {
      const session = createTestSession('delete_test');
      await storage.store(session);
      
      await storage.delete('delete_test');
      
      const retrieved = await storage.get('delete_test');
      expect(retrieved).toBeNull();
    });

    it('should handle deleting non-existent session gracefully', async () => {
      await expect(storage.delete('non_existent')).resolves.not.toThrow();
    });
  });

  describe('Session expiration handling', () => {
    it('should remove expired session during get', async () => {
      const expiredSession: SessionInfo = {
        session_id: 'expired_test',
        message_count: 0,
        created_at: new Date(Date.now() - 2000),
        last_accessed: new Date(Date.now() - 2000),
        expires_at: new Date(Date.now() - 1000) // Expired 1 second ago
      };
      
      await storage.store(expiredSession);
      const retrieved = await storage.get('expired_test');
      
      expect(retrieved).toBeNull();
    });

    it('should exclude expired sessions from list', async () => {
      const activeSession: SessionInfo = {
        session_id: 'active',
        message_count: 0,
        created_at: new Date(),
        last_accessed: new Date(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
      };

      const expiredSession: SessionInfo = {
        session_id: 'expired',
        message_count: 0,
        created_at: new Date(Date.now() - 2000),
        last_accessed: new Date(Date.now() - 2000),
        expires_at: new Date(Date.now() - 1000) // Expired 1 second ago
      };
      
      await storage.store(activeSession);
      await storage.store(expiredSession);
      
      const sessions = await storage.list();
      
      expect(sessions).toHaveLength(1);
      expect(sessions[0].session_id).toBe('active');
    });
  });

  describe('Session cleanup operations', () => {
    it('should clean up expired sessions', async () => {
      const activeSession: SessionInfo = {
        session_id: 'active_cleanup',
        message_count: 0,
        created_at: new Date(),
        last_accessed: new Date(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000)
      };

      const expiredSession: SessionInfo = {
        session_id: 'expired_cleanup',
        message_count: 0,
        created_at: new Date(Date.now() - 2000),
        last_accessed: new Date(Date.now() - 2000),
        expires_at: new Date(Date.now() - 1000)
      };
      
      await storage.store(activeSession);
      await storage.store(expiredSession);
      
      const cleanedCount = await storage.cleanup();
      
      expect(cleanedCount).toBe(1);
      
      const sessions = await storage.list();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].session_id).toBe('active_cleanup');
    });

    it('should return zero when no expired sessions', async () => {
      const activeSession: SessionInfo = {
        session_id: 'active_only',
        message_count: 0,
        created_at: new Date(),
        last_accessed: new Date(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000)
      };
      
      await storage.store(activeSession);
      
      const cleanedCount = await storage.cleanup();
      
      expect(cleanedCount).toBe(0);
    });
  });

  describe('Access tracking', () => {
    it('should track access counts when enabled', async () => {
      const session: SessionInfo = {
        session_id: 'access_test',
        message_count: 0,
        created_at: new Date(),
        last_accessed: new Date(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000)
      };
      
      await storage.store(session);
      
      // Access session multiple times
      await storage.get('access_test');
      await storage.get('access_test');
      await storage.get('access_test');
      
      const accessStats = await storage.getAccessStats();
      expect(accessStats.get('access_test')).toBe(3);
    });

    it('should throw error when access tracking disabled', async () => {
      const noTrackingStorage = new EnhancedMemorySessionStorage(100, false);
      
      await expect(noTrackingStorage.getAccessStats())
        .rejects.toThrow('Access tracking is disabled');
    });

    it('should return most accessed sessions', async () => {
      const session1: SessionInfo = {
        session_id: 'session1',
        message_count: 0,
        created_at: new Date(),
        last_accessed: new Date(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000)
      };

      const session2: SessionInfo = {
        session_id: 'session2',
        message_count: 0,
        created_at: new Date(),
        last_accessed: new Date(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000)
      };
      
      await storage.store(session1);
      await storage.store(session2);
      
      // Access session2 more times
      await storage.get('session1');
      await storage.get('session2');
      await storage.get('session2');
      await storage.get('session2');
      
      const mostAccessed = await storage.getMostAccessedSessions(2);
      
      expect(mostAccessed).toHaveLength(2);
      expect(mostAccessed[0].sessionId).toBe('session2');
      expect(mostAccessed[0].accessCount).toBe(3);
      expect(mostAccessed[1].sessionId).toBe('session1');
      expect(mostAccessed[1].accessCount).toBe(1);
    });
  });

  describe('Capacity management', () => {
    it('should evict oldest expired session when at capacity', async () => {
      const smallStorage = new EnhancedMemorySessionStorage(2, true);
      
      // Add expired session
      const expiredSession: SessionInfo = {
        session_id: 'expired_old',
        message_count: 0,
        created_at: new Date(Date.now() - 3000),
        last_accessed: new Date(Date.now() - 3000),
        expires_at: new Date(Date.now() - 2000)
      };
      
      const activeSession1: SessionInfo = {
        session_id: 'active1',
        message_count: 0,
        created_at: new Date(),
        last_accessed: new Date(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000)
      };
      
      const activeSession2: SessionInfo = {
        session_id: 'active2',
        message_count: 0,
        created_at: new Date(),
        last_accessed: new Date(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000)
      };
      
      await smallStorage.store(expiredSession);
      await smallStorage.store(activeSession1);
      
      // This should trigger eviction of expired session
      await smallStorage.store(activeSession2);
      
      const expired = await smallStorage.get('expired_old');
      const active1 = await smallStorage.get('active1');
      const active2 = await smallStorage.get('active2');
      
      expect(expired).toBeNull();
      expect(active1).toBeDefined();
      expect(active2).toBeDefined();
    });

    it('should evict oldest session when at capacity with no expired sessions', async () => {
      const smallStorage = new EnhancedMemorySessionStorage(2, true);
      
      const oldSession: SessionInfo = {
        session_id: 'old_session',
        message_count: 0,
        created_at: new Date(Date.now() - 1000),
        last_accessed: new Date(Date.now() - 1000),
        expires_at: new Date(Date.now() + 60 * 60 * 1000)
      };
      
      const newSession1: SessionInfo = {
        session_id: 'new_session1',
        message_count: 0,
        created_at: new Date(),
        last_accessed: new Date(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000)
      };
      
      const newSession2: SessionInfo = {
        session_id: 'new_session2',
        message_count: 0,
        created_at: new Date(),
        last_accessed: new Date(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000)
      };
      
      await smallStorage.store(oldSession);
      await smallStorage.store(newSession1);
      
      // This should trigger eviction of oldest session
      await smallStorage.store(newSession2);
      
      const old = await smallStorage.get('old_session');
      const new1 = await smallStorage.get('new_session1');
      const new2 = await smallStorage.get('new_session2');
      
      expect(old).toBeNull();
      expect(new1).toBeDefined();
      expect(new2).toBeDefined();
    });
  });

  describe('Storage statistics', () => {
    it('should provide accurate storage statistics', async () => {
      const activeSession: SessionInfo = {
        session_id: 'stats_active',
        message_count: 0,
        created_at: new Date(),
        last_accessed: new Date(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000)
      };

      const expiredSession: SessionInfo = {
        session_id: 'stats_expired',
        message_count: 0,
        created_at: new Date(Date.now() - 2000),
        last_accessed: new Date(Date.now() - 2000),
        expires_at: new Date(Date.now() - 1000)
      };
      
      await storage.store(activeSession);
      await storage.store(expiredSession);
      
      const stats: StorageStats = await storage.getStats();
      
      expect(stats.totalSessions).toBe(2);
      expect(stats.activeSessions).toBe(1);
      expect(stats.expiredSessions).toBe(1);
      expect(stats.memoryUsageBytes).toBeGreaterThan(0);
      expect(stats.avgSessionSizeBytes).toBeGreaterThan(0);
      expect(stats.oldestSessionAge).toBeGreaterThanOrEqual(0);
      expect(stats.newestSessionAge).toBeGreaterThanOrEqual(0);
      expect(stats.lastCleanupTime).toBeNull();
      expect(stats.cleanupCount).toBe(0);
    });

    it('should update cleanup statistics after cleanup', async () => {
      const expiredSession: SessionInfo = {
        session_id: 'cleanup_stats',
        message_count: 0,
        created_at: new Date(Date.now() - 2000),
        last_accessed: new Date(Date.now() - 2000),
        expires_at: new Date(Date.now() - 1000)
      };
      
      await storage.store(expiredSession);
      await storage.cleanup();
      
      const stats = await storage.getStats();
      
      expect(stats.lastCleanupTime).toBeDefined();
      expect(stats.cleanupCount).toBe(1);
    });
  });

  describe('Health monitoring', () => {
    it('should report healthy when under capacity', async () => {
      const isHealthy = await storage.isHealthy();
      expect(isHealthy).toBe(true);
    });

    it('should report unhealthy when over capacity threshold', async () => {
      const smallStorage = new EnhancedMemorySessionStorage(10, true);
      
      // Add sessions to exceed 90% capacity (9+ sessions)
      for (let i = 0; i < 10; i++) {
        const session: SessionInfo = {
          session_id: `session_${i}`,
          message_count: 0,
          created_at: new Date(),
          last_accessed: new Date(),
          expires_at: new Date(Date.now() + 60 * 60 * 1000)
        };
        await smallStorage.store(session);
      }
      
      const isHealthy = await smallStorage.isHealthy();
      expect(isHealthy).toBe(false);
    });
  });

  describe('Clear operations', () => {
    it('should clear all sessions', async () => {
      const session1: SessionInfo = {
        session_id: 'clear_test1',
        message_count: 0,
        created_at: new Date(),
        last_accessed: new Date(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000)
      };

      const session2: SessionInfo = {
        session_id: 'clear_test2',
        message_count: 0,
        created_at: new Date(),
        last_accessed: new Date(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000)
      };
      
      await storage.store(session1);
      await storage.store(session2);
      
      await storage.clear();
      
      const sessions = await storage.list();
      expect(sessions).toHaveLength(0);
    });
  });
});

describe('SessionStorageFactory', () => {
  describe('createMemoryStorage', () => {
    it('should create memory storage with default values', () => {
      const storage = SessionStorageFactory.createMemoryStorage();
      expect(storage).toBeInstanceOf(EnhancedMemorySessionStorage);
    });

    it('should create memory storage with custom values', () => {
      const storage = SessionStorageFactory.createMemoryStorage(500, false);
      expect(storage).toBeInstanceOf(EnhancedMemorySessionStorage);
    });
  });

  describe('createStorage', () => {
    it('should create memory storage by default', () => {
      const storage = SessionStorageFactory.createStorage();
      expect(storage).toBeInstanceOf(EnhancedMemorySessionStorage);
    });

    it('should create memory storage with options', () => {
      const storage = SessionStorageFactory.createStorage('memory', {
        maxSessions: 200,
        trackAccess: false
      });
      expect(storage).toBeInstanceOf(EnhancedMemorySessionStorage);
    });

    it('should throw error for unsupported storage type', () => {
      expect(() => SessionStorageFactory.createStorage('redis' as any))
        .toThrow('Only memory storage is implemented. Requested: redis');
    });
  });
});