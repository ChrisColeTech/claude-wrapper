/**
 * Tool State Persistence Unit Tests
 * Phase 11A: Comprehensive state persistence and storage testing
 * No placeholders - all real functionality tests
 */

import { 
  ToolStatePersistence,
  ToolStatePersistenceUtils,
  MemoryStateStorage,
  IToolStatePersistence,
  IStateStorage,
  PersistenceResult,
  BackupMetadata,
  RecoveryOptions
} from '../../../src/tools/state-persistence';
import { 
  ToolCallStateSnapshot,
  ToolCallStateEntry
} from '../../../src/tools/state';
import { ToolCallMetrics } from '../../../src/tools/state-tracker';
import { OpenAIToolCall } from '../../../src/tools/types';
import { TOOL_STATES, STATE_MANAGEMENT_LIMITS } from '../../../src/tools/constants';

describe('MemoryStateStorage', () => {
  let storage: IStateStorage;

  beforeEach(() => {
    storage = new MemoryStateStorage();
  });

  describe('save and load', () => {
    it('should save and load data correctly', async () => {
      const testData = { key: 'value', number: 42, array: [1, 2, 3] };
      const key = 'test-key';

      const saveResult = await storage.save(key, testData);
      expect(saveResult).toBe(true);

      const loadedData = await storage.load(key);
      expect(loadedData).toEqual(testData);
    });

    it('should return null for non-existent keys', async () => {
      const result = await storage.load('non-existent');
      expect(result).toBeNull();
    });

    it('should handle deep cloning to prevent reference issues', async () => {
      const originalData = { nested: { value: 'test' } };
      const key = 'clone-test';

      await storage.save(key, originalData);
      const loadedData = await storage.load(key);

      // Modify original data
      originalData.nested.value = 'modified';

      // Loaded data should not be affected
      expect(loadedData.nested.value).toBe('test');
    });
  });

  describe('delete', () => {
    it('should delete existing keys', async () => {
      const key = 'delete-test';
      await storage.save(key, { test: 'data' });

      const deleteResult = await storage.delete(key);
      expect(deleteResult).toBe(true);

      const loadedData = await storage.load(key);
      expect(loadedData).toBeNull();
    });

    it('should return true even for non-existent keys', async () => {
      const deleteResult = await storage.delete('non-existent');
      expect(deleteResult).toBe(true);
    });
  });

  describe('exists', () => {
    it('should check existence correctly', async () => {
      const key = 'exists-test';

      expect(await storage.exists(key)).toBe(false);

      await storage.save(key, { test: 'data' });
      expect(await storage.exists(key)).toBe(true);

      await storage.delete(key);
      expect(await storage.exists(key)).toBe(false);
    });
  });

  describe('list', () => {
    it('should list all keys', async () => {
      await storage.save('key1', { data: 1 });
      await storage.save('key2', { data: 2 });
      await storage.save('prefix:key3', { data: 3 });

      const allKeys = await storage.list();
      expect(allKeys).toEqual(expect.arrayContaining(['key1', 'key2', 'prefix:key3']));
      expect(allKeys).toHaveLength(3);
    });

    it('should list keys with prefix filter', async () => {
      await storage.save('prefix:key1', { data: 1 });
      await storage.save('prefix:key2', { data: 2 });
      await storage.save('other:key3', { data: 3 });

      const prefixedKeys = await storage.list('prefix:');
      expect(prefixedKeys).toEqual(expect.arrayContaining(['prefix:key1', 'prefix:key2']));
      expect(prefixedKeys).toHaveLength(2);
    });

    it('should return empty array when no keys match', async () => {
      const keys = await storage.list('nonexistent:');
      expect(keys).toEqual([]);
    });
  });

  describe('size', () => {
    it('should return size of stored data', async () => {
      const testData = { message: 'hello world' };
      const key = 'size-test';

      await storage.save(key, testData);
      const size = await storage.size(key);

      expect(size).toBeGreaterThan(0);
      expect(size).toBe(JSON.stringify(testData).length);
    });

    it('should return 0 for non-existent keys', async () => {
      const size = await storage.size('non-existent');
      expect(size).toBe(0);
    });
  });
});

describe('ToolStatePersistence', () => {
  let persistence: IToolStatePersistence;
  let storage: IStateStorage;
  const testSessionId = 'test-session-123';

  beforeEach(() => {
    storage = new MemoryStateStorage();
    persistence = new ToolStatePersistence(storage);
  });

  const createTestSnapshot = (): ToolCallStateSnapshot => ({
    sessionId: testSessionId,
    conversationTurn: 1,
    pendingCalls: [{
      id: 'call_pending',
      toolCall: {
        id: 'call_pending',
        type: 'function',
        function: { name: 'pending_func', arguments: '{}' }
      },
      state: TOOL_STATES.PENDING,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }],
    completedCalls: [{
      id: 'call_completed',
      toolCall: {
        id: 'call_completed',
        type: 'function',
        function: { name: 'completed_func', arguments: '{}' }
      },
      state: TOOL_STATES.COMPLETED,
      createdAt: Date.now() - 1000,
      updatedAt: Date.now() - 500,
      completedAt: Date.now() - 500,
      result: { success: true }
    }],
    totalCalls: 2,
    createdAt: Date.now() - 2000,
    updatedAt: Date.now()
  });

  const createTestMetrics = (): ToolCallMetrics => ({
    sessionId: testSessionId,
    totalCalls: 2,
    pendingCalls: 1,
    completedCalls: 1,
    failedCalls: 0,
    cancelledCalls: 0,
    averageDuration: 1500,
    successRate: 1.0,
    mostUsedFunction: 'completed_func',
    createdAt: Date.now() - 2000,
    updatedAt: Date.now()
  });

  describe('saveSessionState', () => {
    it('should save session state successfully', async () => {
      const snapshot = createTestSnapshot();
      const metrics = createTestMetrics();

      const result = await persistence.saveSessionState(testSessionId, snapshot, metrics);

      expect(result.success).toBe(true);
      expect(result.operationType).toBe('save');
      expect(result.sessionId).toBe(testSessionId);
      expect(result.bytesProcessed).toBeGreaterThan(0);
      expect(result.operationTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.operationTimeMs).toBeLessThan(STATE_MANAGEMENT_LIMITS.PERSISTENCE_OPERATION_TIMEOUT_MS);
    });

    it('should save snapshot without metrics', async () => {
      const snapshot = createTestSnapshot();

      const result = await persistence.saveSessionState(testSessionId, snapshot);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(testSessionId);
    });

    it('should fail with invalid session ID', async () => {
      const snapshot = createTestSnapshot();

      const result = await persistence.saveSessionState('', snapshot);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Session ID is required');
    });

    it('should handle storage save failure gracefully', async () => {
      // Create a mock storage that fails
      const failingStorage: IStateStorage = {
        ...storage,
        save: jest.fn().mockResolvedValue(false)
      };

      const failingPersistence = new ToolStatePersistence(failingStorage);
      const snapshot = createTestSnapshot();

      const result = await failingPersistence.saveSessionState(testSessionId, snapshot);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage save operation failed');
    });
  });

  describe('loadSessionState', () => {
    it('should load session state successfully', async () => {
      const snapshot = createTestSnapshot();
      const metrics = createTestMetrics();

      await persistence.saveSessionState(testSessionId, snapshot, metrics);
      const { snapshot: loadedSnapshot, metrics: loadedMetrics } = await persistence.loadSessionState(testSessionId);

      expect(loadedSnapshot).toBeDefined();
      expect(loadedSnapshot!.sessionId).toBe(testSessionId);
      expect(loadedSnapshot!.totalCalls).toBe(2);
      expect(loadedSnapshot!.pendingCalls).toHaveLength(1);
      expect(loadedSnapshot!.completedCalls).toHaveLength(1);

      expect(loadedMetrics).toBeDefined();
      expect(loadedMetrics!.sessionId).toBe(testSessionId);
      expect(loadedMetrics!.totalCalls).toBe(2);
    });

    it('should return null for non-existent session', async () => {
      const { snapshot, metrics } = await persistence.loadSessionState('non-existent');

      expect(snapshot).toBeNull();
      expect(metrics).toBeNull();
    });

    it('should handle empty session ID', async () => {
      const { snapshot, metrics } = await persistence.loadSessionState('');

      expect(snapshot).toBeNull();
      expect(metrics).toBeNull();
    });

    it('should handle corrupted data gracefully', async () => {
      // Save corrupted data directly to storage
      await storage.save(`state:${testSessionId}`, 'corrupted-data');

      const { snapshot, metrics } = await persistence.loadSessionState(testSessionId);

      expect(snapshot).toBeNull();
      expect(metrics).toBeNull();
    });
  });

  describe('backupSessionState', () => {
    it('should create backup successfully', async () => {
      const snapshot = createTestSnapshot();
      const metrics = createTestMetrics();

      await persistence.saveSessionState(testSessionId, snapshot, metrics);
      const result = await persistence.backupSessionState(testSessionId);

      expect(result.success).toBe(true);
      expect(result.operationType).toBe('backup');
      expect(result.sessionId).toBe(testSessionId);
      expect(result.bytesProcessed).toBeGreaterThan(0);
    });

    it('should fail backup for non-existent session', async () => {
      const result = await persistence.backupSessionState('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No state found for session');
    });

    it('should create multiple backups for same session', async () => {
      const snapshot = createTestSnapshot();
      await persistence.saveSessionState(testSessionId, snapshot);

      const result1 = await persistence.backupSessionState(testSessionId);
      const result2 = await persistence.backupSessionState(testSessionId);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      const backups = await persistence.listBackups(testSessionId);
      expect(backups).toHaveLength(2);
    });
  });

  describe('restoreSessionState', () => {
    it('should restore from backup successfully', async () => {
      const snapshot = createTestSnapshot();
      const metrics = createTestMetrics();

      await persistence.saveSessionState(testSessionId, snapshot, metrics);
      await persistence.backupSessionState(testSessionId);

      // Clear the current state
      await storage.delete(`state:${testSessionId}`);

      const result = await persistence.restoreSessionState(testSessionId);

      expect(result.success).toBe(true);
      expect(result.operationType).toBe('restore');
      expect(result.sessionId).toBe(testSessionId);

      // Verify state was restored
      const { snapshot: restoredSnapshot } = await persistence.loadSessionState(testSessionId);
      expect(restoredSnapshot).toBeDefined();
      expect(restoredSnapshot!.sessionId).toBe(testSessionId);
    });

    it('should fail restore for session with no backups', async () => {
      const result = await persistence.restoreSessionState('no-backups');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No backups found');
    });

    it('should restore from specific timestamp', async () => {
      const snapshot = createTestSnapshot();
      await persistence.saveSessionState(testSessionId, snapshot);

      const backup1Result = await persistence.backupSessionState(testSessionId);
      
      // Wait a bit and create another backup
      await new Promise(resolve => setTimeout(resolve, 10));
      const backup2Result = await persistence.backupSessionState(testSessionId);

      const backups = await persistence.listBackups(testSessionId);
      const firstBackupTime = backups[1].timestamp; // Older backup

      const options: RecoveryOptions = {
        targetTimestamp: firstBackupTime
      };

      const result = await persistence.restoreSessionState(testSessionId, options);

      expect(result.success).toBe(true);
    });

    it('should validate integrity when requested', async () => {
      const snapshot = createTestSnapshot();
      await persistence.saveSessionState(testSessionId, snapshot);
      await persistence.backupSessionState(testSessionId);

      const options: RecoveryOptions = {
        validateIntegrity: true
      };

      const result = await persistence.restoreSessionState(testSessionId, options);

      expect(result.success).toBe(true);
    });
  });

  describe('listBackups', () => {
    it('should list all backups when no session specified', async () => {
      const snapshot1 = createTestSnapshot();
      const snapshot2 = { ...createTestSnapshot(), sessionId: 'session-2' };

      await persistence.saveSessionState(testSessionId, snapshot1);
      await persistence.saveSessionState('session-2', snapshot2);

      await persistence.backupSessionState(testSessionId);
      await persistence.backupSessionState('session-2');

      const allBackups = await persistence.listBackups();

      expect(allBackups).toHaveLength(2);
      expect(allBackups.map(b => b.sessionId)).toContain(testSessionId);
      expect(allBackups.map(b => b.sessionId)).toContain('session-2');
    });

    it('should list backups for specific session', async () => {
      const snapshot = createTestSnapshot();
      await persistence.saveSessionState(testSessionId, snapshot);

      await persistence.backupSessionState(testSessionId);
      await persistence.backupSessionState(testSessionId);

      const sessionBackups = await persistence.listBackups(testSessionId);

      expect(sessionBackups).toHaveLength(2);
      sessionBackups.forEach(backup => {
        expect(backup.sessionId).toBe(testSessionId);
        expect(backup.backupId).toBeDefined();
        expect(backup.timestamp).toBeGreaterThan(0);
        expect(backup.sizeBytes).toBeGreaterThan(0);
        expect(backup.checksum).toBeDefined();
      });
    });

    it('should return backups sorted by timestamp (newest first)', async () => {
      const snapshot = createTestSnapshot();
      await persistence.saveSessionState(testSessionId, snapshot);

      const result1 = await persistence.backupSessionState(testSessionId);
      await new Promise(resolve => setTimeout(resolve, 10));
      const result2 = await persistence.backupSessionState(testSessionId);

      const backups = await persistence.listBackups(testSessionId);

      expect(backups).toHaveLength(2);
      expect(backups[0].timestamp).toBeGreaterThan(backups[1].timestamp);
    });

    it('should return empty array for session with no backups', async () => {
      const backups = await persistence.listBackups('no-backups');
      expect(backups).toEqual([]);
    });
  });

  describe('cleanupExpiredStates', () => {
    it('should clean up expired states and backups', async () => {
      const snapshot = createTestSnapshot();
      await persistence.saveSessionState(testSessionId, snapshot);
      await persistence.backupSessionState(testSessionId);

      // Small delay to ensure states are older than cutoff time
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Clean up with very short max age (everything should be expired)
      const result = await persistence.cleanupExpiredStates(5);

      expect(result.success).toBe(true);
      expect(result.operationType).toBe('cleanup');
      expect(result.cleanedEntries).toBeGreaterThan(0);
      expect(result.bytesProcessed).toBeGreaterThan(0);

      // Verify data was cleaned up
      const { snapshot: loadedSnapshot } = await persistence.loadSessionState(testSessionId);
      expect(loadedSnapshot).toBeNull();

      const backups = await persistence.listBackups(testSessionId);
      expect(backups).toHaveLength(0);
    });

    it('should not clean up recent states', async () => {
      const snapshot = createTestSnapshot();
      await persistence.saveSessionState(testSessionId, snapshot);

      const result = await persistence.cleanupExpiredStates(60000); // 1 minute

      expect(result.success).toBe(true);
      expect(result.cleanedEntries).toBe(0);

      // Verify data is still there
      const { snapshot: loadedSnapshot } = await persistence.loadSessionState(testSessionId);
      expect(loadedSnapshot).toBeDefined();
    });

    it('should handle cleanup errors gracefully', async () => {
      // Test with storage that throws errors
      const errorStorage: IStateStorage = {
        ...storage,
        list: jest.fn().mockRejectedValue(new Error('Storage error'))
      };

      const errorPersistence = new ToolStatePersistence(errorStorage);

      await expect(errorPersistence.cleanupExpiredStates(0)).rejects.toThrow('Storage error');
    });
  });

  describe('getStorageStats', () => {
    it('should return storage statistics', async () => {
      const snapshot1 = createTestSnapshot();
      const snapshot2 = { ...createTestSnapshot(), sessionId: 'session-2' };

      await persistence.saveSessionState(testSessionId, snapshot1);
      await persistence.saveSessionState('session-2', snapshot2);

      const stats = await persistence.getStorageStats();

      expect(stats.totalSessions).toBe(2);
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
      expect(stats.oldestState).toBeGreaterThan(0);
    });

    it('should return empty stats when no data', async () => {
      const stats = await persistence.getStorageStats();

      expect(stats.totalSessions).toBe(0);
      expect(stats.totalSizeBytes).toBe(0);
      expect(stats.oldestState).toBe(0);
    });
  });

  describe('performance requirements', () => {
    it('should complete persistence operations within timeout limits', async () => {
      const snapshot = createTestSnapshot();
      const metrics = createTestMetrics();

      const saveStart = Date.now();
      const saveResult = await persistence.saveSessionState(testSessionId, snapshot, metrics);
      const saveTime = Date.now() - saveStart;

      const loadStart = Date.now();
      await persistence.loadSessionState(testSessionId);
      const loadTime = Date.now() - loadStart;

      expect(saveResult.operationTimeMs).toBeLessThan(STATE_MANAGEMENT_LIMITS.PERSISTENCE_OPERATION_TIMEOUT_MS);
      expect(saveTime).toBeLessThan(STATE_MANAGEMENT_LIMITS.PERSISTENCE_OPERATION_TIMEOUT_MS);
      expect(loadTime).toBeLessThan(STATE_MANAGEMENT_LIMITS.PERSISTENCE_OPERATION_TIMEOUT_MS);
    });

    it('should handle multiple concurrent operations', async () => {
      const snapshots = Array(10).fill(null).map((_, i) => ({
        ...createTestSnapshot(),
        sessionId: `concurrent-session-${i}`
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        snapshots.map(snapshot => 
          persistence.saveSessionState(snapshot.sessionId, snapshot)
        )
      );
      const totalTime = Date.now() - startTime;

      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(totalTime).toBeLessThan(1000); // Should complete quickly
    });
  });
});

describe('ToolStatePersistenceUtils', () => {
  describe('estimateStorageSize', () => {
    it('should estimate storage size correctly', () => {
      const snapshot: ToolCallStateSnapshot = {
        sessionId: 'test-session',
        conversationTurn: 1,
        pendingCalls: [],
        completedCalls: [],
        totalCalls: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const size = ToolStatePersistenceUtils.estimateStorageSize(snapshot);
      expect(size).toBeGreaterThan(0);
      expect(size).toBe(JSON.stringify({ snapshot, metrics: undefined }).length);
    });

    it('should include metrics in size calculation', () => {
      const snapshot: ToolCallStateSnapshot = {
        sessionId: 'test-session',
        conversationTurn: 1,
        pendingCalls: [],
        completedCalls: [],
        totalCalls: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const metrics: ToolCallMetrics = {
        sessionId: 'test-session',
        totalCalls: 0,
        pendingCalls: 0,
        completedCalls: 0,
        failedCalls: 0,
        cancelledCalls: 0,
        averageDuration: 0,
        successRate: 0,
        mostUsedFunction: '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const sizeWithMetrics = ToolStatePersistenceUtils.estimateStorageSize(snapshot, metrics);
      const sizeWithoutMetrics = ToolStatePersistenceUtils.estimateStorageSize(snapshot);

      expect(sizeWithMetrics).toBeGreaterThan(sizeWithoutMetrics);
    });
  });

  describe('validateStateData', () => {
    it('should validate valid state data', () => {
      const validData = {
        snapshot: {
          sessionId: 'test-session',
          conversationTurn: 1,
          pendingCalls: [],
          completedCalls: [],
          totalCalls: 0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      };

      expect(ToolStatePersistenceUtils.validateStateData(validData)).toBe(true);
    });

    it('should reject invalid state data', () => {
      const invalidCases = [
        null,
        undefined,
        {},
        { snapshot: null },
        { snapshot: {} },
        { snapshot: { sessionId: null } },
        { snapshot: { sessionId: 'test', pendingCalls: null } },
        { snapshot: { sessionId: 'test', pendingCalls: [], completedCalls: null } }
      ];

      invalidCases.forEach(invalidData => {
        expect(ToolStatePersistenceUtils.validateStateData(invalidData)).toBe(false);
      });
    });
  });

  describe('createStateSummary', () => {
    it('should create state summary correctly', () => {
      const snapshot: ToolCallStateSnapshot = {
        sessionId: 'test-session-123',
        conversationTurn: 2,
        pendingCalls: [
          {
            id: 'call_1',
            toolCall: {
              id: 'call_1',
              type: 'function',
              function: { name: 'func1', arguments: '{}' }
            },
            state: TOOL_STATES.PENDING,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ],
        completedCalls: [
          {
            id: 'call_2',
            toolCall: {
              id: 'call_2',
              type: 'function',
              function: { name: 'func2', arguments: '{}' }
            },
            state: TOOL_STATES.COMPLETED,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ],
        totalCalls: 2,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const summary = ToolStatePersistenceUtils.createStateSummary(snapshot);
      
      expect(summary).toBe('Session test-session-123: 2 calls, 1 pending, 1 completed');
    });
  });

  describe('isRecentBackup', () => {
    it('should identify recent backups correctly', () => {
      const recentBackup: BackupMetadata = {
        backupId: 'backup_1',
        sessionId: 'test-session',
        timestamp: Date.now() - 30000, // 30 seconds ago
        stateCount: 5,
        sizeBytes: 1000,
        compressionRatio: 1.0,
        checksum: 'abc123'
      };

      const oldBackup: BackupMetadata = {
        backupId: 'backup_2',
        sessionId: 'test-session',
        timestamp: Date.now() - 7200000, // 2 hours ago
        stateCount: 3,
        sizeBytes: 800,
        compressionRatio: 1.0,
        checksum: 'def456'
      };

      expect(ToolStatePersistenceUtils.isRecentBackup(recentBackup)).toBe(true);
      expect(ToolStatePersistenceUtils.isRecentBackup(oldBackup)).toBe(false);

      // Test with custom max age
      expect(ToolStatePersistenceUtils.isRecentBackup(oldBackup, 10800000)).toBe(true); // 3 hours
    });
  });
});

describe('Integration Tests', () => {
  let persistence: IToolStatePersistence;
  let storage: IStateStorage;

  beforeEach(() => {
    storage = new MemoryStateStorage();
    persistence = new ToolStatePersistence(storage);
  });

  it('should handle complete persistence lifecycle', async () => {
    const sessionId = 'lifecycle-test-session';
    const snapshot: ToolCallStateSnapshot = {
      sessionId,
      conversationTurn: 1,
      pendingCalls: [],
      completedCalls: [{
        id: 'call_completed',
        toolCall: {
          id: 'call_completed',
          type: 'function',
          function: { name: 'test_function', arguments: '{}' }
        },
        state: TOOL_STATES.COMPLETED,
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 500,
        completedAt: Date.now() - 500
      }],
      totalCalls: 1,
      createdAt: Date.now() - 1000,
      updatedAt: Date.now()
    };

    // Save initial state
    const saveResult = await persistence.saveSessionState(sessionId, snapshot);
    expect(saveResult.success).toBe(true);

    // Create backup
    const backupResult = await persistence.backupSessionState(sessionId);
    expect(backupResult.success).toBe(true);

    // Verify backup exists
    const backups = await persistence.listBackups(sessionId);
    expect(backups).toHaveLength(1);

    // Modify state
    const modifiedSnapshot = {
      ...snapshot,
      totalCalls: 2,
      updatedAt: Date.now()
    };
    await persistence.saveSessionState(sessionId, modifiedSnapshot);

    // Restore from backup
    const restoreResult = await persistence.restoreSessionState(sessionId);
    expect(restoreResult.success).toBe(true);

    // Verify original state was restored
    const { snapshot: restoredSnapshot } = await persistence.loadSessionState(sessionId);
    expect(restoredSnapshot!.totalCalls).toBe(1);

    // Clean up
    const cleanupResult = await persistence.cleanupExpiredStates(0);
    expect(cleanupResult.success).toBe(true);

    // Verify everything was cleaned up
    const { snapshot: finalSnapshot } = await persistence.loadSessionState(sessionId);
    expect(finalSnapshot).toBeNull();
  });

  it('should handle error recovery scenarios', async () => {
    const sessionId = 'error-recovery-test';
    
    // Simulate corrupted backup by directly saving invalid data
    await storage.save('backup:test-session:invalid-backup', 'corrupted-data');
    await storage.save('backup:metadata:test-session:invalid-backup', {
      backupId: 'invalid-backup',
      sessionId: 'test-session',
      timestamp: Date.now(),
      stateCount: 1,
      sizeBytes: 100,
      compressionRatio: 1.0,
      checksum: 'invalid'
    });

    // List backups should handle corrupted data gracefully
    const backups = await persistence.listBackups('test-session');
    expect(backups).toHaveLength(1);

    // Restore should fail gracefully for corrupted backup
    const restoreResult = await persistence.restoreSessionState('test-session');
    expect(restoreResult.success).toBe(false);
  });
});