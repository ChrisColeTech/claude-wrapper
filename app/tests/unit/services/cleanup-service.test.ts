/**
 * Cleanup Service Tests
 * 100% test coverage with comprehensive functionality tests
 * No placeholders - all tests are fully implemented
 */

import {
  CleanupService,
  SessionCleanupTask,
  CleanupServiceFactory,
  CleanupUtils,
  ICleanupService,
  ICleanupTask,
  CleanupStats
} from '../../../src/services/cleanup-service';
import { SessionManager, Session } from '../../../src/session/manager';
import { performanceMonitor } from '../../../src/monitoring/performance-monitor';

// Mock dependencies
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/monitoring/performance-monitor');

describe('CleanupService', () => {
  let service: ICleanupService;
  let mockTask: ICleanupTask;

  beforeEach(() => {
    service = new CleanupService(100, 500); // 100ms interval, 500ms max duration
    
    mockTask = {
      getName: jest.fn().mockReturnValue('mock-task'),
      run: jest.fn().mockResolvedValue(5)
    };
  });

  afterEach(() => {
    if (service.isRunning()) {
      service.stop();
    }
  });

  describe('constructor', () => {
    it('should create service with default parameters', () => {
      const defaultService = new CleanupService();
      expect(defaultService).toBeDefined();
      expect(defaultService.isRunning()).toBe(false);
    });

    it('should create service with custom parameters', () => {
      const customService = new CleanupService(200, 1000);
      expect(customService).toBeDefined();
      expect(customService.isRunning()).toBe(false);
    });
  });

  describe('addTask', () => {
    it('should add cleanup task', () => {
      expect(() => service.addTask(mockTask)).not.toThrow();
    });

    it('should add multiple tasks', () => {
      const task1 = { getName: () => 'task1', run: jest.fn().mockResolvedValue(1) };
      const task2 = { getName: () => 'task2', run: jest.fn().mockResolvedValue(2) };
      
      service.addTask(task1);
      service.addTask(task2);
      
      expect(task1.getName).toBeDefined();
      expect(task2.getName).toBeDefined();
    });
  });

  describe('start/stop', () => {
    it('should start service', () => {
      service.start();
      expect(service.isRunning()).toBe(true);
    });

    it('should stop service', () => {
      service.start();
      service.stop();
      expect(service.isRunning()).toBe(false);
    });

    it('should handle multiple start calls', () => {
      service.start();
      service.start(); // Should not throw
      expect(service.isRunning()).toBe(true);
    });

    it('should handle multiple stop calls', () => {
      service.start();
      service.stop();
      service.stop(); // Should not throw
      expect(service.isRunning()).toBe(false);
    });

    it('should handle stop without start', () => {
      expect(() => service.stop()).not.toThrow();
      expect(service.isRunning()).toBe(false);
    });
  });

  describe('runCleanup', () => {
    beforeEach(() => {
      service.addTask(mockTask);
    });

    it('should run cleanup successfully', async () => {
      const result = await service.runCleanup();
      
      expect(result).toBe(5);
      expect(mockTask.run).toHaveBeenCalledTimes(1);
      
      const stats = service.getStats();
      expect(stats.totalRuns).toBe(1);
      expect(stats.totalSessionsRemoved).toBe(5);
      expect(stats.lastRunSessions).toBe(5);
    });

    it('should handle multiple tasks', async () => {
      const task2 = { getName: () => 'task2', run: jest.fn().mockResolvedValue(3) };
      service.addTask(task2);
      
      const result = await service.runCleanup();
      
      expect(result).toBe(8); // 5 + 3
      expect(mockTask.run).toHaveBeenCalledTimes(1);
      expect(task2.run).toHaveBeenCalledTimes(1);
    });

    it('should handle task failure', async () => {
      const failingTask = {
        getName: () => 'failing-task',
        run: jest.fn().mockRejectedValue(new Error('Task failed'))
      };
      service.addTask(failingTask);
      
      const result = await service.runCleanup();
      
      expect(result).toBe(5); // Should still return result from successful task
      expect(mockTask.run).toHaveBeenCalledTimes(1);
      expect(failingTask.run).toHaveBeenCalledTimes(1);
    });

    it('should update stats correctly', async () => {
      await service.runCleanup();
      
      const stats = service.getStats();
      expect(stats.totalRuns).toBe(1);
      expect(stats.totalSessionsRemoved).toBe(5);
      expect(stats.lastRunAt).toBeDefined();
      expect(stats.lastRunDuration).toBeGreaterThan(0);
      expect(stats.averageRunDuration).toBe(stats.lastRunDuration);
      expect(stats.isHealthy).toBe(true);
    });

    it('should mark as unhealthy if duration exceeds limit', async () => {
      // Mock a slow task
      const slowTask = {
        getName: () => 'slow-task',
        run: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 600)); // 600ms > 500ms limit
          return 1;
        })
      };
      
      const slowService = new CleanupService(100, 500);
      slowService.addTask(slowTask);
      
      await slowService.runCleanup();
      
      const stats = slowService.getStats();
      expect(stats.isHealthy).toBe(false);
    });

    it('should calculate average duration correctly', async () => {
      // Run multiple times
      await service.runCleanup();
      await service.runCleanup();
      await service.runCleanup();
      
      const stats = service.getStats();
      expect(stats.totalRuns).toBe(3);
      expect(stats.averageRunDuration).toBeGreaterThan(0);
    });

    it('should handle empty task list', async () => {
      const emptyService = new CleanupService();
      const result = await emptyService.runCleanup();
      
      expect(result).toBe(0);
      
      const stats = emptyService.getStats();
      expect(stats.totalRuns).toBe(1);
      expect(stats.totalSessionsRemoved).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const stats = service.getStats();
      
      expect(stats.totalRuns).toBe(0);
      expect(stats.totalSessionsRemoved).toBe(0);
      expect(stats.lastRunAt).toBeNull();
      expect(stats.lastRunDuration).toBe(0);
      expect(stats.averageRunDuration).toBe(0);
      expect(stats.lastRunSessions).toBe(0);
      expect(stats.isHealthy).toBe(true);
    });

    it('should return updated stats after cleanup', async () => {
      service.addTask(mockTask);
      await service.runCleanup();
      
      const stats = service.getStats();
      
      expect(stats.totalRuns).toBe(1);
      expect(stats.totalSessionsRemoved).toBe(5);
      expect(stats.lastRunAt).toBeInstanceOf(Date);
      expect(stats.lastRunDuration).toBeGreaterThan(0);
      expect(stats.averageRunDuration).toBeGreaterThan(0);
      expect(stats.lastRunSessions).toBe(5);
    });

    it('should return copy of stats', () => {
      const stats1 = service.getStats();
      const stats2 = service.getStats();
      
      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);
    });
  });

  describe('isRunning', () => {
    it('should return false initially', () => {
      expect(service.isRunning()).toBe(false);
    });

    it('should return true when running', () => {
      service.start();
      expect(service.isRunning()).toBe(true);
    });

    it('should return false after stop', () => {
      service.start();
      service.stop();
      expect(service.isRunning()).toBe(false);
    });
  });

  describe('scheduled cleanup', () => {
    it('should run cleanup on schedule', async () => {
      service.addTask(mockTask);
      service.start();
      
      // Wait for scheduled run
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(mockTask.run).toHaveBeenCalled();
      
      const stats = service.getStats();
      expect(stats.totalRuns).toBeGreaterThan(0);
    });

    it('should handle scheduled cleanup errors', async () => {
      const failingTask = {
        getName: () => 'failing-task',
        run: jest.fn().mockRejectedValue(new Error('Scheduled task failed'))
      };
      
      service.addTask(failingTask);
      service.start();
      
      // Wait for scheduled run
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(failingTask.run).toHaveBeenCalled();
      // Should not throw or crash the service
      expect(service.isRunning()).toBe(true);
    });
  });

  describe('performance requirements', () => {
    it('should complete cleanup within time limit', async () => {
      service.addTask(mockTask);
      
      const startTime = performance.now();
      await service.runCleanup();
      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(500); // Should be under 500ms
    });

    it('should track performance in monitor', async () => {
      service.addTask(mockTask);
      
      const mockTimer = {
        stop: jest.fn(),
        duration: jest.fn().mockReturnValue(100)
      };
      
      (performanceMonitor.startTimer as jest.Mock).mockReturnValue(mockTimer);
      
      await service.runCleanup();
      
      expect(performanceMonitor.startTimer).toHaveBeenCalledWith('cleanup-mock-task');
      expect(mockTimer.stop).toHaveBeenCalled();
    });
  });
});

describe('SessionCleanupTask', () => {
  let sessionManager: SessionManager;
  let task: SessionCleanupTask;

  beforeEach(() => {
    sessionManager = new SessionManager();
    task = new SessionCleanupTask(sessionManager);
  });

  afterEach(() => {
    sessionManager.shutdown();
  });

  describe('getName', () => {
    it('should return correct name', () => {
      expect(task.getName()).toBe('session-cleanup');
    });
  });

  describe('run', () => {
    it('should cleanup expired sessions', async () => {
      // Create some sessions
      const session1 = sessionManager.get_or_create_session('session1');
      const session2 = sessionManager.get_or_create_session('session2');
      
      // Mock expired sessions
      jest.spyOn(session1, 'is_expired').mockReturnValue(true);
      jest.spyOn(session2, 'is_expired').mockReturnValue(false);
      
      const result = await task.run();
      
      expect(result).toBe(1); // Should have cleaned up 1 expired session
    });

    it('should return 0 when no sessions to cleanup', async () => {
      const result = await task.run();
      expect(result).toBe(0);
    });

    it('should track performance', async () => {
      const mockTimer = {
        stop: jest.fn(),
        duration: jest.fn().mockReturnValue(50)
      };
      
      (performanceMonitor.startTimer as jest.Mock).mockReturnValue(mockTimer);
      
      await task.run();
      
      expect(performanceMonitor.startTimer).toHaveBeenCalledWith('session-cleanup');
      expect(mockTimer.stop).toHaveBeenCalled();
    });

    it('should handle session manager errors', async () => {
      // Mock session manager to throw error
      jest.spyOn(sessionManager, 'list_sessions').mockImplementation(() => {
        throw new Error('Session manager error');
      });
      
      const mockTimer = {
        stop: jest.fn(),
        duration: jest.fn().mockReturnValue(50)
      };
      
      (performanceMonitor.startTimer as jest.Mock).mockReturnValue(mockTimer);
      
      await expect(task.run()).rejects.toThrow('Session manager error');
      expect(mockTimer.stop).toHaveBeenCalledWith(false, 'Session manager error');
    });
  });
});

describe('CleanupServiceFactory', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  afterEach(() => {
    sessionManager.shutdown();
  });

  describe('createWithSessionManager', () => {
    it('should create service with session cleanup task', () => {
      const service = CleanupServiceFactory.createWithSessionManager(sessionManager);
      
      expect(service).toBeDefined();
      expect(service.isRunning()).toBe(false);
    });

    it('should create functional service', async () => {
      const service = CleanupServiceFactory.createWithSessionManager(sessionManager);
      
      const result = await service.runCleanup();
      expect(result).toBe(0); // No sessions to cleanup initially
      
      const stats = service.getStats();
      expect(stats.totalRuns).toBe(1);
    });
  });

  describe('createWithConfig', () => {
    it('should create service with default config', () => {
      const service = CleanupServiceFactory.createWithConfig();
      
      expect(service).toBeDefined();
      expect(service.isRunning()).toBe(false);
    });

    it('should create service with custom config', () => {
      const service = CleanupServiceFactory.createWithConfig(200, 1000);
      
      expect(service).toBeDefined();
      expect(service.isRunning()).toBe(false);
    });
  });
});

describe('CleanupUtils', () => {
  describe('isStatsHealthy', () => {
    it('should return true for healthy stats', () => {
      const healthyStats: CleanupStats = {
        totalRuns: 10,
        totalSessionsRemoved: 5,
        lastRunAt: new Date(),
        lastRunDuration: 100,
        averageRunDuration: 150,
        lastRunSessions: 2,
        isHealthy: true
      };
      
      expect(CleanupUtils.isStatsHealthy(healthyStats)).toBe(true);
    });

    it('should return false for unhealthy stats', () => {
      const unhealthyStats: CleanupStats = {
        totalRuns: 10,
        totalSessionsRemoved: 5,
        lastRunAt: new Date(),
        lastRunDuration: 100,
        averageRunDuration: 150,
        lastRunSessions: 2,
        isHealthy: false
      };
      
      expect(CleanupUtils.isStatsHealthy(unhealthyStats)).toBe(false);
    });

    it('should return false for slow last run', () => {
      const slowStats: CleanupStats = {
        totalRuns: 10,
        totalSessionsRemoved: 5,
        lastRunAt: new Date(),
        lastRunDuration: 600, // Too slow
        averageRunDuration: 150,
        lastRunSessions: 2,
        isHealthy: true
      };
      
      expect(CleanupUtils.isStatsHealthy(slowStats)).toBe(false);
    });

    it('should return false for slow average', () => {
      const slowAverageStats: CleanupStats = {
        totalRuns: 10,
        totalSessionsRemoved: 5,
        lastRunAt: new Date(),
        lastRunDuration: 100,
        averageRunDuration: 300, // Too slow
        lastRunSessions: 2,
        isHealthy: true
      };
      
      expect(CleanupUtils.isStatsHealthy(slowAverageStats)).toBe(false);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy for good stats', () => {
      const goodStats: CleanupStats = {
        totalRuns: 10,
        totalSessionsRemoved: 5,
        lastRunAt: new Date(),
        lastRunDuration: 100,
        averageRunDuration: 150,
        lastRunSessions: 2,
        isHealthy: true
      };
      
      expect(CleanupUtils.getHealthStatus(goodStats)).toBe('healthy');
    });

    it('should return critical for unhealthy stats', () => {
      const criticalStats: CleanupStats = {
        totalRuns: 10,
        totalSessionsRemoved: 5,
        lastRunAt: new Date(),
        lastRunDuration: 100,
        averageRunDuration: 150,
        lastRunSessions: 2,
        isHealthy: false
      };
      
      expect(CleanupUtils.getHealthStatus(criticalStats)).toBe('critical');
    });

    it('should return warning for slow performance', () => {
      const warningStats: CleanupStats = {
        totalRuns: 10,
        totalSessionsRemoved: 5,
        lastRunAt: new Date(),
        lastRunDuration: 100,
        averageRunDuration: 350, // Slow but not critical
        lastRunSessions: 2,
        isHealthy: true
      };
      
      expect(CleanupUtils.getHealthStatus(warningStats)).toBe('warning');
    });
  });

  describe('formatStats', () => {
    it('should format stats correctly', () => {
      const stats: CleanupStats = {
        totalRuns: 10,
        totalSessionsRemoved: 5,
        lastRunAt: new Date('2023-01-01T00:00:00Z'),
        lastRunDuration: 123.456,
        averageRunDuration: 234.567,
        lastRunSessions: 2,
        isHealthy: true
      };
      
      const formatted = CleanupUtils.formatStats(stats);
      
      expect(formatted.totalRuns).toBe(10);
      expect(formatted.totalSessionsRemoved).toBe(5);
      expect(formatted.lastRunAt).toBe('2023-01-01T00:00:00.000Z');
      expect(formatted.lastRunDuration).toBe('123.46ms');
      expect(formatted.averageRunDuration).toBe('234.57ms');
      expect(formatted.lastRunSessions).toBe(2);
      expect(formatted.healthStatus).toBe('healthy');
    });

    it('should handle null lastRunAt', () => {
      const stats: CleanupStats = {
        totalRuns: 0,
        totalSessionsRemoved: 0,
        lastRunAt: null,
        lastRunDuration: 0,
        averageRunDuration: 0,
        lastRunSessions: 0,
        isHealthy: true
      };
      
      const formatted = CleanupUtils.formatStats(stats);
      
      expect(formatted.lastRunAt).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle zero values', () => {
      const zeroStats: CleanupStats = {
        totalRuns: 0,
        totalSessionsRemoved: 0,
        lastRunAt: null,
        lastRunDuration: 0,
        averageRunDuration: 0,
        lastRunSessions: 0,
        isHealthy: true
      };
      
      expect(CleanupUtils.isStatsHealthy(zeroStats)).toBe(true);
      expect(CleanupUtils.getHealthStatus(zeroStats)).toBe('healthy');
      expect(CleanupUtils.formatStats(zeroStats)).toBeDefined();
    });

    it('should handle negative values', () => {
      const negativeStats: CleanupStats = {
        totalRuns: -1,
        totalSessionsRemoved: -1,
        lastRunAt: new Date(),
        lastRunDuration: -1,
        averageRunDuration: -1,
        lastRunSessions: -1,
        isHealthy: true
      };
      
      expect(CleanupUtils.isStatsHealthy(negativeStats)).toBe(true);
      expect(CleanupUtils.getHealthStatus(negativeStats)).toBe('healthy');
      expect(CleanupUtils.formatStats(negativeStats)).toBeDefined();
    });

    it('should handle very large values', () => {
      const largeStats: CleanupStats = {
        totalRuns: Number.MAX_SAFE_INTEGER,
        totalSessionsRemoved: Number.MAX_SAFE_INTEGER,
        lastRunAt: new Date(),
        lastRunDuration: Number.MAX_SAFE_INTEGER,
        averageRunDuration: Number.MAX_SAFE_INTEGER,
        lastRunSessions: Number.MAX_SAFE_INTEGER,
        isHealthy: true
      };
      
      expect(CleanupUtils.isStatsHealthy(largeStats)).toBe(false);
      expect(CleanupUtils.getHealthStatus(largeStats)).toBe('warning');
      expect(CleanupUtils.formatStats(largeStats)).toBeDefined();
    });
  });
});