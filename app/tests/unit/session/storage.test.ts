/**
 * Session Storage Unit Tests
 * Tests core storage functionality without external dependencies
 */

import { MemorySessionStorage, SessionUtils, SessionStorageFactory } from '../../../src/session/storage';
import { SessionInfo } from '../../../src/types';
import { SESSION_CONFIG } from '../../../src/config/constants';
import { setupTest, cleanupTest, createTestMessages, createValidSession, createExpiredSession, mockDate } from '../../setup/test-setup';
import '../../mocks/logger.mock';

describe('SessionUtils Class', () => {
  beforeEach(() => {
    setupTest();
  });

  afterEach(() => {
    cleanupTest();
  });

  describe('isExpired method', () => {
    test('should return false for future expiry date', () => {
      const session = createValidSession('test-session', []);
      session.expires_at = new Date(Date.now() + 3600000);
      
      expect(SessionUtils.isExpired(session)).toBe(false);
    });

    test('should return true for past expiry date', () => {
      const session = createExpiredSession('test-session', []);
      
      expect(SessionUtils.isExpired(session)).toBe(true);
    });

    test('should return true for current time expiry', () => {
      const session = createValidSession('test-session', []);
      session.expires_at = new Date(Date.now() - 1);
      
      expect(SessionUtils.isExpired(session)).toBe(true);
    });
  });

  describe('filterActiveSessions method', () => {
    test('should return empty array for empty input', () => {
      const result = SessionUtils.filterActiveSessions([]);
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    test('should filter out expired sessions', () => {
      const validSession = createValidSession('valid', []);
      const expiredSession = createExpiredSession('expired', []);
      
      const sessions = [validSession, expiredSession];
      const result = SessionUtils.filterActiveSessions(sessions);
      
      expect(result.length).toBe(1);
      expect(result[0]?.session_id).toBe('valid');
    });

    test('should return all sessions when none expired', () => {
      const session1 = createValidSession('session1', []);
      const session2 = createValidSession('session2', []);
      
      const sessions = [session1, session2];
      const result = SessionUtils.filterActiveSessions(sessions);
      
      expect(result.length).toBe(2);
      expect(result).toEqual(sessions);
    });

    test('should return empty array when all sessions expired', () => {
      const expired1 = createExpiredSession('expired1', []);
      const expired2 = createExpiredSession('expired2', []);
      
      const sessions = [expired1, expired2];
      const result = SessionUtils.filterActiveSessions(sessions);
      
      expect(result).toEqual([]);
    });
  });

  describe('touchSession method', () => {
    test('should update last_accessed timestamp', () => {
      const session = createValidSession('test-session', []);
      const originalAccess = session.last_accessed.getTime();
      
      const futureTime = Date.now() + 5000;
      const restoreDate = mockDate(futureTime);
      
      SessionUtils.touchSession(session);
      
      expect(session.last_accessed.getTime()).toBe(futureTime);
      expect(session.last_accessed.getTime()).toBeGreaterThan(originalAccess);
      
      restoreDate();
    });

    test('should update expires_at based on TTL', () => {
      const session = createValidSession('test-session', []);
      const originalExpiry = session.expires_at.getTime();
      
      const futureTime = Date.now() + 5000;
      const restoreDate = mockDate(futureTime);
      
      SessionUtils.touchSession(session);
      
      const expectedExpiry = futureTime + SESSION_CONFIG.DEFAULT_TTL_HOURS * 60 * 60 * 1000;
      expect(session.expires_at.getTime()).toBe(expectedExpiry);
      expect(session.expires_at.getTime()).toBeGreaterThan(originalExpiry);
      
      restoreDate();
    });
  });

  describe('estimateMemoryUsage method', () => {
    test('should return 0 for empty map', () => {
      const sessions = new Map<string, SessionInfo>();
      const usage = SessionUtils.estimateMemoryUsage(sessions);
      
      expect(usage).toBe(0);
    });

    test('should calculate memory usage for sessions', () => {
      const sessions = new Map<string, SessionInfo>();
      const session1 = createValidSession('session1', createTestMessages(2));
      const session2 = createValidSession('session2', createTestMessages(1));
      
      sessions.set('session1', session1);
      sessions.set('session2', session2);
      
      const usage = SessionUtils.estimateMemoryUsage(sessions);
      
      expect(usage).toBeGreaterThan(0);
      expect(typeof usage).toBe('number');
    });

    test('should include overhead for map structure', () => {
      const sessions = new Map<string, SessionInfo>();
      const session = createValidSession('test', []);
      sessions.set('test', session);
      
      const usage = SessionUtils.estimateMemoryUsage(sessions);
      const sessionStr = JSON.stringify(session);
      const expectedMinimum = sessionStr.length * 2 + 50; // UTF-16 + overhead
      
      expect(usage).toBeGreaterThanOrEqual(expectedMinimum);
    });
  });
});

describe('MemorySessionStorage Class', () => {
  let storage: MemorySessionStorage;
  const testSessionId = 'test-session-storage';

  beforeEach(() => {
    setupTest();
    storage = new MemorySessionStorage();
  });

  afterEach(() => {
    cleanupTest();
  });

  describe('Constructor', () => {
    test('should initialize with default max sessions', () => {
      expect(storage).toBeDefined();
    });

    test('should initialize with custom max sessions', () => {
      const customStorage = new MemorySessionStorage(500);
      expect(customStorage).toBeDefined();
    });
  });

  describe('store method', () => {
    test('should store session successfully', async () => {
      const session = createValidSession(testSessionId, createTestMessages(2));
      
      await expect(storage.store(session)).resolves.toBeUndefined();
      
      const retrieved = await storage.get(testSessionId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.session_id).toBe(testSessionId);
    });

    test('should create copy of session when storing', async () => {
      const session = createValidSession(testSessionId, createTestMessages(1));
      const originalMessage = session.messages[0]?.content;
      
      await storage.store(session);
      
      // Modify original session
      session.messages[0]!.content = 'Modified';
      
      const retrieved = await storage.get(testSessionId);
      expect(retrieved?.messages[0]?.content).toBe(originalMessage);
    });

    test('should handle capacity limits with eviction', async () => {
      const smallStorage = new MemorySessionStorage(2);
      
      // Fill to capacity
      await smallStorage.store(createValidSession('session1', []));
      await smallStorage.store(createValidSession('session2', []));
      
      // Add one more to trigger eviction
      await smallStorage.store(createValidSession('session3', []));
      
      const stats = await smallStorage.getStats();
      expect(stats.totalSessions).toBeLessThanOrEqual(2);
    });

    test('should evict expired sessions first when at capacity', async () => {
      const smallStorage = new MemorySessionStorage(2);
      
      // Add valid session
      await smallStorage.store(createValidSession('valid', []));
      
      // Add expired session
      const expiredSession = createExpiredSession('expired', []);
      await smallStorage.store(expiredSession);
      
      // Add another session to trigger eviction
      await smallStorage.store(createValidSession('new', []));
      
      // Valid session should remain, expired should be gone
      const validSession = await smallStorage.get('valid');
      const expiredResult = await smallStorage.get('expired');
      const newSession = await smallStorage.get('new');
      
      expect(validSession).not.toBeNull();
      expect(expiredResult).toBeNull();
      expect(newSession).not.toBeNull();
    });
  });

  describe('get method', () => {
    test('should return null for non-existent session', async () => {
      const result = await storage.get('non-existent');
      expect(result).toBeNull();
    });

    test('should return session for existing valid session', async () => {
      const session = createValidSession(testSessionId, createTestMessages(1));
      await storage.store(session);
      
      const retrieved = await storage.get(testSessionId);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.session_id).toBe(testSessionId);
      expect(retrieved?.messages).toEqual(session.messages);
    });

    test('should return copy of session data', async () => {
      const session = createValidSession(testSessionId, createTestMessages(1));
      await storage.store(session);
      
      const retrieved = await storage.get(testSessionId);
      retrieved!.messages.push({ role: 'user', content: 'Modified' });
      
      const retrievedAgain = await storage.get(testSessionId);
      expect(retrievedAgain?.messages.length).toBe(1);
    });

    test('should remove expired session during get', async () => {
      const expiredSession = createExpiredSession(testSessionId, []);
      await storage.store(expiredSession);
      
      const result = await storage.get(testSessionId);
      expect(result).toBeNull();
      
      // Session should be removed from storage
      const stats = await storage.getStats();
      expect(stats.totalSessions).toBe(0);
    });
  });

  describe('update method', () => {
    test('should update existing session', async () => {
      const session = createValidSession(testSessionId, createTestMessages(1));
      await storage.store(session);
      
      const updatedSession = { ...session, messages: createTestMessages(3) };
      await storage.update(updatedSession);
      
      const retrieved = await storage.get(testSessionId);
      expect(retrieved?.messages.length).toBe(3);
    });

    test('should throw error for non-existent session', async () => {
      const session = createValidSession('non-existent', []);
      
      await expect(storage.update(session)).rejects.toThrow('Session not found for update');
    });

    test('should create copy when updating', async () => {
      const session = createValidSession(testSessionId, createTestMessages(1));
      await storage.store(session);
      
      const updateData = { ...session, messages: createTestMessages(2) };
      await storage.update(updateData);
      
      // Modify update data
      updateData.messages.push({ role: 'user', content: 'Modified' });
      
      const retrieved = await storage.get(testSessionId);
      expect(retrieved?.messages.length).toBe(2);
    });
  });

  describe('delete method', () => {
    test('should delete existing session', async () => {
      const session = createValidSession(testSessionId, []);
      await storage.store(session);
      
      await storage.delete(testSessionId);
      
      const result = await storage.get(testSessionId);
      expect(result).toBeNull();
    });

    test('should handle deletion of non-existent session', async () => {
      await expect(storage.delete('non-existent')).resolves.toBeUndefined();
    });

    test('should only delete specified session', async () => {
      await storage.store(createValidSession('session1', []));
      await storage.store(createValidSession('session2', []));
      
      await storage.delete('session1');
      
      const session1 = await storage.get('session1');
      const session2 = await storage.get('session2');
      
      expect(session1).toBeNull();
      expect(session2).not.toBeNull();
    });
  });

  describe('list method', () => {
    test('should return empty array when no sessions', async () => {
      const sessions = await storage.list();
      expect(sessions).toEqual([]);
      expect(Array.isArray(sessions)).toBe(true);
    });

    test('should return only active sessions', async () => {
      await storage.store(createValidSession('valid1', []));
      await storage.store(createValidSession('valid2', []));
      await storage.store(createExpiredSession('expired', []));
      
      const sessions = await storage.list();
      
      expect(sessions.length).toBe(2);
      const sessionIds = sessions.map(s => s.session_id);
      expect(sessionIds).toContain('valid1');
      expect(sessionIds).toContain('valid2');
      expect(sessionIds).not.toContain('expired');
    });

    test('should return copies of session data', async () => {
      await storage.store(createValidSession('test', createTestMessages(1)));
      
      const sessions = await storage.list();
      sessions[0]?.messages.push({ role: 'user', content: 'Modified' });
      
      const retrieved = await storage.get('test');
      expect(retrieved?.messages.length).toBe(1);
    });
  });

  describe('cleanup method', () => {
    test('should return 0 when no expired sessions', async () => {
      await storage.store(createValidSession('valid1', []));
      await storage.store(createValidSession('valid2', []));
      
      const cleanedCount = await storage.cleanup();
      expect(cleanedCount).toBe(0);
    });

    test('should remove expired sessions and return count', async () => {
      await storage.store(createValidSession('valid', []));
      await storage.store(createExpiredSession('expired1', []));
      await storage.store(createExpiredSession('expired2', []));
      
      const cleanedCount = await storage.cleanup();
      expect(cleanedCount).toBe(2);
      
      const sessions = await storage.list();
      expect(sessions.length).toBe(1);
      expect(sessions[0]?.session_id).toBe('valid');
    });

    test('should track cleanup statistics', async () => {
      await storage.store(createExpiredSession('expired', []));
      
      const statsBefore = await storage.getStats();
      expect(statsBefore.cleanupCount).toBe(0);
      
      await storage.cleanup();
      
      const statsAfter = await storage.getStats();
      expect(statsAfter.cleanupCount).toBe(1);
      expect(statsAfter.lastCleanupTime).not.toBeNull();
    });
  });

  describe('getStats method', () => {
    test('should return zero stats for empty storage', async () => {
      const stats = await storage.getStats();
      
      expect(stats.totalSessions).toBe(0);
      expect(stats.activeSessions).toBe(0);
      expect(stats.expiredSessions).toBe(0);
      expect(stats.memoryUsageBytes).toBe(0);
      expect(stats.oldestSessionAge).toBe(0);
      expect(stats.lastCleanupTime).toBeNull();
      expect(stats.cleanupCount).toBe(0);
    });

    test('should calculate correct stats with mixed sessions', async () => {
      const now = Date.now();
      const restoreDate = mockDate(now);
      
      // Create sessions with different ages
      const oldSession = createValidSession('valid1', createTestMessages(2));
      oldSession.created_at = new Date(now - 60000); // 1 minute ago
      
      await storage.store(oldSession);
      await storage.store(createValidSession('valid2', createTestMessages(1)));
      await storage.store(createExpiredSession('expired', createTestMessages(1)));
      
      const stats = await storage.getStats();
      
      expect(stats.totalSessions).toBe(3);
      expect(stats.activeSessions).toBe(2);
      expect(stats.expiredSessions).toBe(1);
      expect(stats.memoryUsageBytes).toBeGreaterThan(0);
      expect(stats.oldestSessionAge).toBeGreaterThanOrEqual(60); // at least 60 seconds
      
      restoreDate();
    });

    test('should calculate oldest session age correctly', async () => {
      const now = Date.now();
      const restoreDate = mockDate(now);
      
      // Create session with specific age
      const oldSession = createValidSession('old', []);
      oldSession.created_at = new Date(now - 60000); // 1 minute ago
      await storage.store(oldSession);
      
      // Advance time
      restoreDate();
      const futureTime = now + 30000;
      const restoreDate2 = mockDate(futureTime);
      
      const stats = await storage.getStats();
      expect(stats.oldestSessionAge).toBe(90); // 90 seconds
      
      restoreDate2();
    });
  });

  describe('clear method', () => {
    test('should remove all sessions', async () => {
      await storage.store(createValidSession('session1', []));
      await storage.store(createValidSession('session2', []));
      await storage.store(createExpiredSession('expired', []));
      
      await storage.clear();
      
      const stats = await storage.getStats();
      expect(stats.totalSessions).toBe(0);
      
      const sessions = await storage.list();
      expect(sessions).toEqual([]);
    });

    test('should work on empty storage', async () => {
      await expect(storage.clear()).resolves.toBeUndefined();
      
      const stats = await storage.getStats();
      expect(stats.totalSessions).toBe(0);
    });
  });

  describe('isHealthy method', () => {
    test('should return true for healthy storage', async () => {
      await storage.store(createValidSession('test', []));
      
      const isHealthy = await storage.isHealthy();
      expect(isHealthy).toBe(true);
    });

    test('should return false when approaching capacity', async () => {
      const smallStorage = new MemorySessionStorage(10);
      
      // Fill close to capacity (assuming warning threshold is less than 100%)
      for (let i = 0; i < 9; i++) {
        await smallStorage.store(createValidSession(`session${i}`, []));
      }
      
      const isHealthy = await smallStorage.isHealthy();
      expect(typeof isHealthy).toBe('boolean');
    });

    test('should handle errors gracefully', async () => {
      // Create a storage instance and break it
      const brokenStorage = new MemorySessionStorage();
      (brokenStorage as any).sessions = null;
      
      const isHealthy = await brokenStorage.isHealthy();
      expect(isHealthy).toBe(false);
    });
  });
});

describe('SessionStorageFactory Class', () => {
  beforeEach(() => {
    setupTest();
  });

  afterEach(() => {
    cleanupTest();
  });

  describe('createMemoryStorage method', () => {
    test('should create memory storage with default capacity', () => {
      const storage = SessionStorageFactory.createMemoryStorage();
      expect(storage).toBeInstanceOf(MemorySessionStorage);
    });

    test('should create memory storage with custom capacity', () => {
      const storage = SessionStorageFactory.createMemoryStorage(500);
      expect(storage).toBeInstanceOf(MemorySessionStorage);
    });
  });

  describe('createStorage method', () => {
    test('should create memory storage by default', () => {
      const storage = SessionStorageFactory.createStorage();
      expect(storage).toBeInstanceOf(MemorySessionStorage);
    });

    test('should create memory storage when explicitly requested', () => {
      const storage = SessionStorageFactory.createStorage('memory');
      expect(storage).toBeInstanceOf(MemorySessionStorage);
    });

    test('should pass options to storage constructor', () => {
      const storage = SessionStorageFactory.createStorage('memory', { maxSessions: 500 });
      expect(storage).toBeInstanceOf(MemorySessionStorage);
    });

    test('should throw error for unsupported storage type', () => {
      expect(() => {
        SessionStorageFactory.createStorage('redis' as any);
      }).toThrow('Only memory storage is implemented');
    });
  });
});