/**
 * Monitoring Routes - API endpoints for metrics and status
 * SOLID compliance: SRP, OCP, LSP, ISP, DIP
 * DRY compliance: Common patterns extracted to utils
 * Performance requirements: monitoring overhead <5ms
 */

import { Router, Request, Response } from 'express';
import { getLogger } from '../utils/logger';
import { performanceMonitor, PerformanceStats } from '../monitoring/performance-monitor';
import { CleanupUtils } from '../services/cleanup-service';
import { TimingUtils } from '../middleware/timing';
import { PRODUCTION_MONITORING, PRODUCTION_LIMITS } from '../tools/constants/production';

const logger = getLogger('MonitoringRoutes');

/**
 * Monitoring response interfaces
 */
export interface MonitoringStatus {
  status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
  uptime: number;
  version: string;
}

export interface PerformanceMetrics {
  operations: Record<string, PerformanceStats>;
  summary: {
    totalOperations: number;
    averageResponseTime: number;
    errorRate: number;
    slowOperations: string[];
  };
}

export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
  };
  cpu: {
    loadAverage: number[];
    usage: number;
  };
  process: {
    pid: number;
    uptime: number;
    version: string;
  };
}

/**
 * Monitoring utilities
 */
export const MonitoringUtils = {
  /**
   * Get system memory metrics
   */
  getMemoryMetrics(): SystemMetrics['memory'] {
    const memUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      used: usedMemory,
      total: totalMemory,
      percentage: (usedMemory / totalMemory) * 100,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal
    };
  },

  /**
   * Get CPU metrics
   */
  getCpuMetrics(): SystemMetrics['cpu'] {
    const os = require('os');
    return {
      loadAverage: os.loadavg(),
      usage: process.cpuUsage().user / 1000000 // Convert to seconds
    };
  },

  /**
   * Get process metrics
   */
  getProcessMetrics(): SystemMetrics['process'] {
    return {
      pid: process.pid,
      uptime: process.uptime(),
      version: process.version
    };
  },

  /**
   * Calculate overall health status
   */
  calculateHealthStatus(
    performanceStats: Map<string, PerformanceStats>,
    memoryMetrics: SystemMetrics['memory'],
    cleanupStats?: any
  ): 'healthy' | 'warning' | 'critical' {
    // Check memory usage
    if (memoryMetrics.percentage > PRODUCTION_MONITORING.MEMORY_CRITICAL_THRESHOLD * 100) {
      return 'critical';
    }

    // Check performance stats
    for (const [operation, stats] of performanceStats) {
      if (stats.errorRate > PRODUCTION_MONITORING.ERROR_RATE_THRESHOLD) {
        return 'critical';
      }
      if (stats.p95Duration > PRODUCTION_MONITORING.RESPONSE_TIME_THRESHOLD_MS) {
        return 'warning';
      }
    }

    // Check cleanup stats if provided
    if (cleanupStats && !CleanupUtils.isStatsHealthy(cleanupStats)) {
      return 'warning';
    }

    return 'healthy';
  },

  /**
   * Get slow operations
   */
  getSlowOperations(performanceStats: Map<string, PerformanceStats>): string[] {
    const slowOps: string[] = [];
    
    for (const [operation, stats] of performanceStats) {
      if (stats.p95Duration > PRODUCTION_MONITORING.RESPONSE_TIME_THRESHOLD_MS) {
        slowOps.push(operation);
      }
    }
    
    return slowOps;
  },

  /**
   * Calculate summary metrics
   */
  calculateSummaryMetrics(performanceStats: Map<string, PerformanceStats>): PerformanceMetrics['summary'] {
    let totalOperations = 0;
    let totalDuration = 0;
    let totalErrors = 0;
    let totalRequests = 0;

    for (const stats of performanceStats.values()) {
      totalOperations++;
      totalDuration += stats.avgDuration * stats.count;
      totalErrors += stats.count * stats.errorRate;
      totalRequests += stats.count;
    }

    return {
      totalOperations,
      averageResponseTime: totalRequests > 0 ? totalDuration / totalRequests : 0,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      slowOperations: MonitoringUtils.getSlowOperations(performanceStats)
    };
  }
};

/**
 * Monitoring routes implementation
 */
export class MonitoringRoutes {
  private router: Router;
  private startTime: number = Date.now();

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  /**
   * Setup monitoring routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.router.get('/health', this.handleHealthCheck.bind(this));
    
    // Detailed status endpoint
    this.router.get('/status', this.handleStatus.bind(this));
    
    // Performance metrics endpoint
    this.router.get('/metrics', this.handleMetrics.bind(this));
    
    // Performance metrics for specific operation
    this.router.get('/metrics/:operation', this.handleOperationMetrics.bind(this));
    
    // System metrics endpoint
    this.router.get('/system', this.handleSystemMetrics.bind(this));
    
    // Combined monitoring endpoint
    this.router.get('/dashboard', this.handleDashboard.bind(this));
    
    // Clear metrics endpoint (admin only)
    this.router.delete('/metrics', this.handleClearMetrics.bind(this));
    
    // Clear specific operation metrics
    this.router.delete('/metrics/:operation', this.handleClearOperationMetrics.bind(this));
  }

  /**
   * Handle health check
   */
  private handleHealthCheck(req: Request, res: Response): void {
    const timer = performanceMonitor.startTimer('monitoring-health');
    
    try {
      const memoryMetrics = MonitoringUtils.getMemoryMetrics();
      const performanceStats = performanceMonitor.getAllStats();
      const status = MonitoringUtils.calculateHealthStatus(performanceStats, memoryMetrics);
      
      const response: MonitoringStatus = {
        status,
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        version: process.env.npm_package_version || '1.0.0'
      };
      
      timer.stop(true);
      res.json(response);
    } catch (error) {
      timer.stop(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('Health check failed', { error });
      res.status(500).json({ error: 'Health check failed' });
    }
  }

  /**
   * Handle detailed status
   */
  private handleStatus(req: Request, res: Response): void {
    const timer = performanceMonitor.startTimer('monitoring-status');
    
    try {
      const memoryMetrics = MonitoringUtils.getMemoryMetrics();
      const performanceStats = performanceMonitor.getAllStats();
      const systemMetrics = {
        memory: memoryMetrics,
        cpu: MonitoringUtils.getCpuMetrics(),
        process: MonitoringUtils.getProcessMetrics()
      };
      
      const status = MonitoringUtils.calculateHealthStatus(performanceStats, memoryMetrics);
      
      const response = {
        status,
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        system: systemMetrics,
        performance: {
          operationCount: performanceStats.size,
          summary: MonitoringUtils.calculateSummaryMetrics(performanceStats)
        }
      };
      
      timer.stop(true);
      res.json(response);
    } catch (error) {
      timer.stop(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('Status check failed', { error });
      res.status(500).json({ error: 'Status check failed' });
    }
  }

  /**
   * Handle performance metrics
   */
  private handleMetrics(req: Request, res: Response): void {
    const timer = performanceMonitor.startTimer('monitoring-metrics');
    
    try {
      const performanceStats = performanceMonitor.getAllStats();
      const operations: Record<string, PerformanceStats> = {};
      
      for (const [operation, stats] of performanceStats) {
        operations[operation] = stats;
      }
      
      const response: PerformanceMetrics = {
        operations,
        summary: MonitoringUtils.calculateSummaryMetrics(performanceStats)
      };
      
      timer.stop(true);
      res.json(response);
    } catch (error) {
      timer.stop(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('Metrics retrieval failed', { error });
      res.status(500).json({ error: 'Metrics retrieval failed' });
    }
  }

  /**
   * Handle operation-specific metrics
   */
  private handleOperationMetrics(req: Request, res: Response): void {
    const timer = performanceMonitor.startTimer('monitoring-operation-metrics');
    
    try {
      const { operation } = req.params;
      const stats = performanceMonitor.getStats(operation);
      
      if (!stats) {
        timer.stop(false, 'Operation not found');
        res.status(404).json({ error: 'Operation not found' });
        return;
      }
      
      timer.stop(true);
      res.json({ operation, stats });
    } catch (error) {
      timer.stop(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('Operation metrics retrieval failed', { error });
      res.status(500).json({ error: 'Operation metrics retrieval failed' });
    }
  }

  /**
   * Handle system metrics
   */
  private handleSystemMetrics(req: Request, res: Response): void {
    const timer = performanceMonitor.startTimer('monitoring-system');
    
    try {
      const response: SystemMetrics = {
        memory: MonitoringUtils.getMemoryMetrics(),
        cpu: MonitoringUtils.getCpuMetrics(),
        process: MonitoringUtils.getProcessMetrics()
      };
      
      timer.stop(true);
      res.json(response);
    } catch (error) {
      timer.stop(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('System metrics retrieval failed', { error });
      res.status(500).json({ error: 'System metrics retrieval failed' });
    }
  }

  /**
   * Handle dashboard (combined metrics)
   */
  private handleDashboard(req: Request, res: Response): void {
    const timer = performanceMonitor.startTimer('monitoring-dashboard');
    
    try {
      const memoryMetrics = MonitoringUtils.getMemoryMetrics();
      const performanceStats = performanceMonitor.getAllStats();
      
      const response = {
        status: MonitoringUtils.calculateHealthStatus(performanceStats, memoryMetrics),
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        system: {
          memory: memoryMetrics,
          cpu: MonitoringUtils.getCpuMetrics(),
          process: MonitoringUtils.getProcessMetrics()
        },
        performance: {
          operations: Object.fromEntries(performanceStats),
          summary: MonitoringUtils.calculateSummaryMetrics(performanceStats)
        }
      };
      
      timer.stop(true);
      res.json(response);
    } catch (error) {
      timer.stop(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('Dashboard retrieval failed', { error });
      res.status(500).json({ error: 'Dashboard retrieval failed' });
    }
  }

  /**
   * Handle clear metrics
   */
  private handleClearMetrics(req: Request, res: Response): void {
    const timer = performanceMonitor.startTimer('monitoring-clear-metrics');
    
    try {
      performanceMonitor.clearMetrics();
      
      timer.stop(true);
      res.json({ message: 'All metrics cleared' });
    } catch (error) {
      timer.stop(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('Clear metrics failed', { error });
      res.status(500).json({ error: 'Clear metrics failed' });
    }
  }

  /**
   * Handle clear operation metrics
   */
  private handleClearOperationMetrics(req: Request, res: Response): void {
    const timer = performanceMonitor.startTimer('monitoring-clear-operation-metrics');
    
    try {
      const { operation } = req.params;
      performanceMonitor.clearMetrics(operation);
      
      timer.stop(true);
      res.json({ message: `Metrics cleared for operation: ${operation}` });
    } catch (error) {
      timer.stop(false, error instanceof Error ? error.message : 'Unknown error');
      logger.error('Clear operation metrics failed', { error });
      res.status(500).json({ error: 'Clear operation metrics failed' });
    }
  }

  /**
   * Get router
   */
  getRouter(): Router {
    return this.router;
  }
}

/**
 * Create monitoring routes
 */
export function createMonitoringRoutes(): Router {
  const monitoringRoutes = new MonitoringRoutes();
  return monitoringRoutes.getRouter();
}

/**
 * Default monitoring routes instance
 */
export const monitoringRoutes = createMonitoringRoutes();