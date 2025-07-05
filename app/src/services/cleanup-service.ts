/**
 * Cleanup Service - Automated session cleanup with statistics
 * SOLID compliance: SRP, OCP, LSP, ISP, DIP
 * DRY compliance: Common patterns extracted to utils
 * Performance requirements: cleanup operations <500ms
 */

import { getLogger } from '../utils/logger';
import { SessionManager } from '../session/manager';
import { performanceMonitor } from '../monitoring/performance-monitor';
import { PRODUCTION_LIMITS, PRODUCTION_MONITORING } from '../tools/constants/production';

const logger = getLogger('CleanupService');

/**
 * Cleanup statistics interface
 */
export interface CleanupStats {
  totalRuns: number;
  totalSessionsRemoved: number;
  lastRunAt: Date | null;
  lastRunDuration: number;
  averageRunDuration: number;
  lastRunSessions: number;
  isHealthy: boolean;
}

/**
 * Cleanup service interface (ISP compliance)
 */
export interface ICleanupService {
  start(): void;
  stop(): void;
  runCleanup(): Promise<number>;
  getStats(): CleanupStats;
  isRunning(): boolean;
}

/**
 * Cleanup task interface
 */
export interface ICleanupTask {
  run(): Promise<number>;
  getName(): string;
}

/**
 * Session cleanup task implementation
 */
export class SessionCleanupTask implements ICleanupTask {
  constructor(private sessionManager: SessionManager) {}

  async run(): Promise<number> {
    const timer = performanceMonitor.startTimer('session-cleanup');
    
    try {
      // Get count before cleanup
      const beforeCount = this.sessionManager.get_session_count();
      
      // Run cleanup (this method should be exposed or we need to access it differently)
      const cleanedCount = await this.runSessionCleanup();
      
      timer.stop(true, undefined, { 
        beforeCount, 
        cleanedCount,
        afterCount: this.sessionManager.get_session_count()
      });
      
      return cleanedCount;
    } catch (error) {
      timer.stop(false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  getName(): string {
    return 'session-cleanup';
  }

  /**
   * Run session cleanup - mirrors the private method from SessionManager
   */
  private async runSessionCleanup(): Promise<number> {
    // This is a simplified version - in production we'd need better access
    const sessions = this.sessionManager.list_sessions();
    let cleanedCount = 0;
    
    for (const session of sessions) {
      if (session.is_expired()) {
        this.sessionManager.delete_session(session.session_id);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }
}

/**
 * Cleanup Service implementation
 * SRP: Single responsibility for cleanup operations
 * OCP: Open for extension via task interface
 * LSP: Substitutable via interface
 * ISP: Interface segregation with focused interfaces
 * DIP: Depends on abstractions
 */
export class CleanupService implements ICleanupService {
  private isActive: boolean = false;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private tasks: ICleanupTask[] = [];
  private stats: CleanupStats = {
    totalRuns: 0,
    totalSessionsRemoved: 0,
    lastRunAt: null,
    lastRunDuration: 0,
    averageRunDuration: 0,
    lastRunSessions: 0,
    isHealthy: true
  };

  constructor(
    private intervalMs: number = PRODUCTION_LIMITS.HEALTH_CHECK_INTERVAL_MS,
    private maxDurationMs: number = 500 // Phase 6A requirement: <500ms
  ) {}

  /**
   * Add cleanup task
   */
  addTask(task: ICleanupTask): void {
    this.tasks.push(task);
    logger.info(`Added cleanup task: ${task.getName()}`);
  }

  /**
   * Start the cleanup service
   */
  start(): void {
    if (this.isActive) {
      logger.warn('Cleanup service already running');
      return;
    }

    this.isActive = true;
    this.cleanupInterval = setInterval(() => {
      this.runCleanupSafe();
    }, this.intervalMs);

    logger.info('Cleanup service started', {
      intervalMs: this.intervalMs,
      maxDurationMs: this.maxDurationMs,
      taskCount: this.tasks.length
    });
  }

  /**
   * Stop the cleanup service
   */
  stop(): void {
    if (!this.isActive) {
      logger.warn('Cleanup service not running');
      return;
    }

    this.isActive = false;
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    logger.info('Cleanup service stopped');
  }

  /**
   * Run cleanup manually
   */
  async runCleanup(): Promise<number> {
    const startTime = performance.now();
    let totalRemoved = 0;

    try {
      logger.debug('Starting cleanup run', { taskCount: this.tasks.length });

      for (const task of this.tasks) {
        const timer = performanceMonitor.startTimer(`cleanup-${task.getName()}`);
        
        try {
          const removed = await task.run();
          totalRemoved += removed;
          
          timer.stop(true, undefined, { removedCount: removed });
          
          logger.debug(`Cleanup task completed: ${task.getName()}`, {
            removedCount: removed
          });
        } catch (error) {
          timer.stop(false, error instanceof Error ? error.message : 'Unknown error');
          logger.error(`Cleanup task failed: ${task.getName()}`, { error });
        }
      }

      const duration = performance.now() - startTime;
      this.updateStats(totalRemoved, duration);

      // Check performance requirement
      if (duration > this.maxDurationMs) {
        logger.warn('Cleanup exceeded maximum duration', {
          duration,
          maxDurationMs: this.maxDurationMs
        });
        this.stats.isHealthy = false;
      } else {
        this.stats.isHealthy = true;
      }

      logger.info('Cleanup run completed', {
        totalRemoved,
        duration,
        tasksRun: this.tasks.length
      });

      return totalRemoved;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.updateStats(totalRemoved, duration);
      this.stats.isHealthy = false;
      
      logger.error('Cleanup run failed', { error, duration });
      throw error;
    }
  }

  /**
   * Get cleanup statistics
   */
  getStats(): CleanupStats {
    return { ...this.stats };
  }

  /**
   * Check if cleanup service is running
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Run cleanup safely with error handling
   */
  private async runCleanupSafe(): Promise<void> {
    try {
      await this.runCleanup();
    } catch (error) {
      logger.error('Scheduled cleanup failed', { error });
    }
  }

  /**
   * Update cleanup statistics
   */
  private updateStats(removedCount: number, duration: number): void {
    this.stats.totalRuns++;
    this.stats.totalSessionsRemoved += removedCount;
    this.stats.lastRunAt = new Date();
    this.stats.lastRunDuration = duration;
    this.stats.lastRunSessions = removedCount;
    
    // Update average duration
    const totalDuration = (this.stats.averageRunDuration * (this.stats.totalRuns - 1)) + duration;
    this.stats.averageRunDuration = totalDuration / this.stats.totalRuns;
  }
}

/**
 * Cleanup service factory
 */
export class CleanupServiceFactory {
  /**
   * Create cleanup service with session manager
   */
  static createWithSessionManager(sessionManager: SessionManager): ICleanupService {
    const service = new CleanupService();
    const sessionCleanupTask = new SessionCleanupTask(sessionManager);
    
    service.addTask(sessionCleanupTask);
    
    return service;
  }

  /**
   * Create cleanup service with custom configuration
   */
  static createWithConfig(
    intervalMs: number = PRODUCTION_LIMITS.HEALTH_CHECK_INTERVAL_MS,
    maxDurationMs: number = 500
  ): ICleanupService {
    return new CleanupService(intervalMs, maxDurationMs);
  }
}

/**
 * Cleanup utilities
 */
export const CleanupUtils = {
  /**
   * Check if cleanup stats are healthy
   */
  isStatsHealthy(stats: CleanupStats): boolean {
    return stats.isHealthy &&
           stats.lastRunDuration < 500 &&
           stats.averageRunDuration < 250;
  },

  /**
   * Get cleanup health status
   */
  getHealthStatus(stats: CleanupStats): 'healthy' | 'warning' | 'critical' {
    if (!stats.isHealthy) {
      return 'critical';
    }
    
    if (stats.averageRunDuration > 300) {
      return 'warning';
    }
    
    return 'healthy';
  },

  /**
   * Format cleanup stats for display
   */
  formatStats(stats: CleanupStats): Record<string, any> {
    return {
      totalRuns: stats.totalRuns,
      totalSessionsRemoved: stats.totalSessionsRemoved,
      lastRunAt: stats.lastRunAt?.toISOString(),
      lastRunDuration: `${stats.lastRunDuration.toFixed(2)}ms`,
      averageRunDuration: `${stats.averageRunDuration.toFixed(2)}ms`,
      lastRunSessions: stats.lastRunSessions,
      healthStatus: CleanupUtils.getHealthStatus(stats)
    };
  }
};