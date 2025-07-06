/**
 * Tool calling state persistence service
 * Single Responsibility: State persistence and storage only
 * 
 * Handles persistent storage of tool calling state:
 * - Session state serialization and deserialization
 * - State backup and recovery operations
 * - Cross-session state persistence
 * - Storage optimization and compression
 */

import { ToolCallStateEntry, ToolCallStateSnapshot, IToolStateManager } from './state';
import { ToolCallMetrics, IToolStateTracker } from './state-tracker';
import { getLogger } from '../utils/logger';

const logger = getLogger('ToolStatePersistence');

/**
 * Persistence configuration
 */
export interface PersistenceConfig {
  enableCompression: boolean;
  maxStateSize: number;
  backupInterval: number;
  retentionPeriod: number;
  enableEncryption: boolean;
}

/**
 * Persistence operation result
 */
export interface PersistenceResult {
  success: boolean;
  operationType: 'save' | 'load' | 'backup' | 'restore' | 'cleanup';
  sessionId?: string;
  bytesProcessed: number;
  operationTimeMs: number;
  cleanedEntries?: number;
  error?: string;
}

/**
 * State storage interface
 */
export interface IStateStorage {
  save(key: string, data: any): Promise<boolean>;
  load(key: string): Promise<any | null>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  list(prefix?: string): Promise<string[]>;
  size(key: string): Promise<number>;
}

/**
 * Backup metadata
 */
export interface BackupMetadata {
  backupId: string;
  sessionId: string;
  timestamp: number;
  stateCount: number;
  sizeBytes: number;
  compressionRatio: number;
  checksum: string;
}

/**
 * Recovery options
 */
export interface RecoveryOptions {
  targetTimestamp?: number;
  includeMetrics?: boolean;
  validateIntegrity?: boolean;
  mergeStrategy?: 'overwrite' | 'merge' | 'skip_existing';
}

/**
 * State persistence interface
 */
export interface IToolStatePersistence {
  saveSessionState(sessionId: string, snapshot: ToolCallStateSnapshot, metrics?: ToolCallMetrics): Promise<PersistenceResult>;
  loadSessionState(sessionId: string): Promise<{ snapshot: ToolCallStateSnapshot | null; metrics: ToolCallMetrics | null }>;
  getToolCallData(toolCallId: string): Promise<any>;
  backupSessionState(sessionId: string): Promise<PersistenceResult>;
  restoreSessionState(sessionId: string, options?: RecoveryOptions): Promise<PersistenceResult>;
  listBackups(sessionId?: string): Promise<BackupMetadata[]>;
  cleanupExpiredStates(maxAgeMs: number): Promise<PersistenceResult>;
  getStorageStats(): Promise<{ totalSessions: number; totalSizeBytes: number; oldestState: number }>;
}

/**
 * In-memory state storage implementation
 */
export class MemoryStateStorage implements IStateStorage {
  private storage: Map<string, any> = new Map();

  async save(key: string, data: any): Promise<boolean> {
    try {
      this.storage.set(key, JSON.parse(JSON.stringify(data))); // Deep clone
      return true;
    } catch (error) {
      logger.error('Memory storage save failed', { key, error });
      return false;
    }
  }

  async load(key: string): Promise<any | null> {
    const data = this.storage.get(key);
    return data ? JSON.parse(JSON.stringify(data)) : null; // Deep clone
  }

  async delete(key: string): Promise<boolean> {
    this.storage.delete(key);
    return true; // Always return true to match expected behavior
  }

  async exists(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.storage.keys());
    return prefix ? keys.filter(key => key.startsWith(prefix)) : keys;
  }

  async size(key: string): Promise<number> {
    const data = this.storage.get(key);
    return data ? JSON.stringify(data).length : 0;
  }
}

/**
 * Tool state persistence implementation
 */
export class ToolStatePersistence implements IToolStatePersistence {
  private storage: IStateStorage;
  private config: PersistenceConfig;

  constructor(storage?: IStateStorage, config?: Partial<PersistenceConfig>) {
    this.storage = storage || new MemoryStateStorage();
    this.config = {
      enableCompression: false,
      maxStateSize: 10 * 1024 * 1024, // 10MB
      backupInterval: 3600000, // 1 hour
      retentionPeriod: 7 * 24 * 3600000, // 7 days
      enableEncryption: false,
      ...config
    };
  }

  /**
   * Save session state with snapshot and metrics
   */
  async saveSessionState(
    sessionId: string, 
    snapshot: ToolCallStateSnapshot, 
    metrics?: ToolCallMetrics
  ): Promise<PersistenceResult> {
    const startTime = Date.now();
    
    try {
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      const stateData = {
        snapshot,
        metrics,
        savedAt: Date.now(),
        version: '1.0'
      };

      // Compress if enabled
      const serializedData = this.config.enableCompression 
        ? await this.compressData(stateData)
        : stateData;

      // Check size limits
      const dataSize = JSON.stringify(serializedData).length;
      if (dataSize > this.config.maxStateSize) {
        throw new Error(`State size ${dataSize} exceeds maximum ${this.config.maxStateSize}`);
      }

      // Save to storage
      const saveSuccess = await this.storage.save(
        this.getStateKey(sessionId), 
        serializedData
      );

      if (!saveSuccess) {
        throw new Error('Storage save operation failed');
      }

      const operationTime = Date.now() - startTime;

      logger.debug('Session state saved', {
        sessionId,
        dataSize,
        operationTime,
        compressed: this.config.enableCompression
      });

      return {
        success: true,
        operationType: 'save',
        sessionId,
        bytesProcessed: dataSize,
        operationTimeMs: operationTime
      };
    } catch (error) {
      const operationTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Failed to save session state', {
        sessionId,
        error: errorMessage,
        operationTime
      });

      return {
        success: false,
        operationType: 'save',
        sessionId,
        bytesProcessed: 0,
        operationTimeMs: operationTime,
        error: errorMessage
      };
    }
  }

  /**
   * Load session state with snapshot and metrics
   */
  async loadSessionState(sessionId: string): Promise<{ snapshot: ToolCallStateSnapshot | null; metrics: ToolCallMetrics | null }> {
    try {
      if (!sessionId) {
        return { snapshot: null, metrics: null };
      }

      const stateData = await this.storage.load(this.getStateKey(sessionId));
      if (!stateData) {
        return { snapshot: null, metrics: null };
      }

      // Decompress if needed
      const decompressedData = this.config.enableCompression 
        ? await this.decompressData(stateData)
        : stateData;

      logger.debug('Session state loaded', {
        sessionId,
        hasSnapshot: !!decompressedData.snapshot,
        hasMetrics: !!decompressedData.metrics
      });

      return {
        snapshot: decompressedData.snapshot || null,
        metrics: decompressedData.metrics || null
      };
    } catch (error) {
      logger.error('Failed to load session state', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return { snapshot: null, metrics: null };
    }
  }

  /**
   * Get persisted tool call data
   */
  async getToolCallData(toolCallId: string): Promise<any> {
    // Return persisted data for the specific tool call
    try {
      const data = await this.storage.load(`toolcall:${toolCallId}`);
      return data || {
        isPersisted: false,
        toolCallId,
        lastPersisted: null
      };
    } catch (error) {
      logger.warn('Failed to get tool call data', { toolCallId, error });
      return {
        isPersisted: false,
        toolCallId,
        lastPersisted: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Create backup of session state
   */
  async backupSessionState(sessionId: string): Promise<PersistenceResult> {
    const startTime = Date.now();
    
    try {
      const { snapshot, metrics } = await this.loadSessionState(sessionId);
      if (!snapshot) {
        throw new Error(`No state found for session ${sessionId}`);
      }

      const backupId = this.generateBackupId(sessionId);
      const backupData = {
        backupId,
        sessionId,
        snapshot,
        metrics,
        timestamp: Date.now(),
        version: '1.0'
      };

      const serializedData = JSON.stringify(backupData);
      const dataSize = serializedData.length;

      const saveSuccess = await this.storage.save(
        this.getBackupKey(sessionId, backupId),
        backupData
      );

      if (!saveSuccess) {
        throw new Error('Backup save operation failed');
      }

      // Save backup metadata
      const metadata: BackupMetadata = {
        backupId,
        sessionId,
        timestamp: Date.now(),
        stateCount: snapshot.totalCalls,
        sizeBytes: dataSize,
        compressionRatio: 1.0,
        checksum: this.calculateChecksum(serializedData)
      };

      await this.storage.save(
        this.getBackupMetadataKey(sessionId, backupId),
        metadata
      );

      const operationTime = Date.now() - startTime;

      logger.info('Session state backed up', {
        sessionId,
        backupId,
        dataSize,
        operationTime
      });

      return {
        success: true,
        operationType: 'backup',
        sessionId,
        bytesProcessed: dataSize,
        operationTimeMs: operationTime
      };
    } catch (error) {
      const operationTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Failed to backup session state', {
        sessionId,
        error: errorMessage,
        operationTime
      });

      return {
        success: false,
        operationType: 'backup',
        sessionId,
        bytesProcessed: 0,
        operationTimeMs: operationTime,
        error: errorMessage
      };
    }
  }

  /**
   * Restore session state from backup
   */
  async restoreSessionState(sessionId: string, options: RecoveryOptions = {}): Promise<PersistenceResult> {
    const startTime = Date.now();
    
    try {
      const backups = await this.listBackups(sessionId);
      if (backups.length === 0) {
        throw new Error(`No backups found for session ${sessionId}`);
      }

      // Find appropriate backup
      let targetBackup = backups[0]; // Most recent by default
      if (options.targetTimestamp) {
        targetBackup = backups.reduce((closest, backup) => 
          Math.abs(backup.timestamp - options.targetTimestamp!) < 
          Math.abs(closest.timestamp - options.targetTimestamp!) ? backup : closest
        );
      }

      // Load backup data
      const backupData = await this.storage.load(
        this.getBackupKey(sessionId, targetBackup.backupId)
      );

      if (!backupData) {
        throw new Error(`Backup data not found for backup ${targetBackup.backupId}`);
      }

      // Validate backup data structure
      if (!backupData.snapshot || typeof backupData.snapshot !== 'object') {
        throw new Error('Corrupted backup data: invalid snapshot structure');
      }

      // Validate integrity if requested
      if (options.validateIntegrity) {
        const dataChecksum = this.calculateChecksum(JSON.stringify(backupData));
        if (dataChecksum !== targetBackup.checksum) {
          throw new Error('Backup integrity validation failed');
        }
      }

      // Restore state
      const restoreResult = await this.saveSessionState(
        sessionId,
        backupData.snapshot,
        options.includeMetrics ? backupData.metrics : undefined
      );

      if (!restoreResult.success) {
        throw new Error(`Failed to restore state: ${restoreResult.error}`);
      }

      const operationTime = Date.now() - startTime;

      logger.info('Session state restored', {
        sessionId,
        backupId: targetBackup.backupId,
        backupTimestamp: targetBackup.timestamp,
        operationTime
      });

      return {
        success: true,
        operationType: 'restore',
        sessionId,
        bytesProcessed: targetBackup.sizeBytes,
        operationTimeMs: operationTime
      };
    } catch (error) {
      const operationTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Failed to restore session state', {
        sessionId,
        error: errorMessage,
        operationTime
      });

      return {
        success: false,
        operationType: 'restore',
        sessionId,
        bytesProcessed: 0,
        operationTimeMs: operationTime,
        error: errorMessage
      };
    }
  }

  /**
   * List available backups
   */
  async listBackups(sessionId?: string): Promise<BackupMetadata[]> {
    try {
      const prefix = sessionId ? `backup:metadata:${sessionId}:` : 'backup:metadata:';
      const metadataKeys = await this.storage.list(prefix);
      
      const backups: BackupMetadata[] = [];
      for (const key of metadataKeys) {
        const metadata = await this.storage.load(key);
        if (metadata) {
          backups.push(metadata);
        }
      }

      return backups.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      logger.error('Failed to list backups', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Clean up expired states and backups
   */
  async cleanupExpiredStates(maxAgeMs: number): Promise<PersistenceResult> {
    const startTime = Date.now();
    const cutoffTime = Date.now() - maxAgeMs;
    let cleanedCount = 0;
    let totalBytes = 0;

    try {
      // Clean up expired session states
      const stateKeys = await this.storage.list('state:');
      for (const key of stateKeys) {
        const data = await this.storage.load(key);
        if (data && data.savedAt <= cutoffTime) {
          const size = await this.storage.size(key);
          await this.storage.delete(key);
          cleanedCount++;
          totalBytes += size;
        }
      }

      // Clean up expired backups
      const backupKeys = await this.storage.list('backup:');
      for (const key of backupKeys) {
        const data = await this.storage.load(key);
        if (data && data.timestamp <= cutoffTime) {
          const size = await this.storage.size(key);
          await this.storage.delete(key);
          cleanedCount++;
          totalBytes += size;
        }
      }

      // Clean up orphaned metadata
      const metadataKeys = await this.storage.list('backup:metadata:');
      for (const key of metadataKeys) {
        const metadata = await this.storage.load(key);
        if (metadata && metadata.timestamp <= cutoffTime) {
          await this.storage.delete(key);
          cleanedCount++;
        }
      }

      const operationTime = Date.now() - startTime;

      logger.info('Expired states cleaned up', {
        cleanedCount,
        totalBytes,
        cutoffTime,
        operationTime
      });

      return {
        success: true,
        operationType: 'cleanup',
        bytesProcessed: totalBytes,
        operationTimeMs: operationTime,
        cleanedEntries: cleanedCount
      };
    } catch (error) {
      const operationTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Failed to cleanup expired states', {
        error: errorMessage,
        operationTime
      });

      // Throw the error for critical storage failures
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{ totalSessions: number; totalSizeBytes: number; oldestState: number }> {
    try {
      const stateKeys = await this.storage.list('state:');
      let totalSizeBytes = 0;
      let oldestState = Date.now();

      for (const key of stateKeys) {
        const size = await this.storage.size(key);
        totalSizeBytes += size;

        const data = await this.storage.load(key);
        if (data && data.savedAt < oldestState) {
          oldestState = data.savedAt;
        }
      }

      return {
        totalSessions: stateKeys.length,
        totalSizeBytes,
        oldestState: stateKeys.length > 0 ? oldestState : 0
      };
    } catch (error) {
      logger.error('Failed to get storage stats', {
        error: error instanceof Error ? error.message : String(error)
      });
      return { totalSessions: 0, totalSizeBytes: 0, oldestState: 0 };
    }
  }

  /**
   * Generate storage keys
   */
  private getStateKey(sessionId: string): string {
    return `state:${sessionId}`;
  }

  private getBackupKey(sessionId: string, backupId: string): string {
    return `backup:${sessionId}:${backupId}`;
  }

  private getBackupMetadataKey(sessionId: string, backupId: string): string {
    return `backup:metadata:${sessionId}:${backupId}`;
  }

  /**
   * Generate backup ID
   */
  private generateBackupId(sessionId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${sessionId}_${timestamp}_${random}`;
  }

  /**
   * Calculate simple checksum
   */
  private calculateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Compress data (placeholder - would use actual compression library)
   */
  private async compressData(data: any): Promise<any> {
    // In real implementation, would use compression library like zlib
    return data;
  }

  /**
   * Decompress data (placeholder - would use actual compression library)
   */
  private async decompressData(data: any): Promise<any> {
    // In real implementation, would use compression library like zlib
    return data;
  }
}

/**
 * State persistence utilities
 */
export const ToolStatePersistenceUtils = {
  /**
   * Estimate storage size
   */
  estimateStorageSize: (snapshot: ToolCallStateSnapshot, metrics?: ToolCallMetrics): number => {
    const data = { snapshot, metrics };
    return JSON.stringify(data).length;
  },

  /**
   * Validate state data
   */
  validateStateData: (data: any): boolean => {
    if (!data || !data.snapshot) return false;
    return typeof data.snapshot.sessionId === 'string' &&
           Array.isArray(data.snapshot.pendingCalls) &&
           Array.isArray(data.snapshot.completedCalls);
  },

  /**
   * Create state summary
   */
  createStateSummary: (snapshot: ToolCallStateSnapshot): string => {
    return `Session ${snapshot.sessionId}: ${snapshot.totalCalls} calls, ` +
           `${snapshot.pendingCalls.length} pending, ${snapshot.completedCalls.length} completed`;
  },

  /**
   * Check if backup is recent
   */
  isRecentBackup: (backup: BackupMetadata, maxAgeMs: number = 3600000): boolean => {
    return Date.now() - backup.timestamp <= maxAgeMs;
  }
};

export const toolStatePersistence = new ToolStatePersistence();