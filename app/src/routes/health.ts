/**
 * Health endpoint implementation
 * Based on Python main.py:680-683 health_check endpoint
 * Implements Phase 11A health check requirements
 */

import { Router, Request, Response } from 'express';
import { getLogger } from '../utils/logger';
import { healthMonitor, getLatestHealthReport } from '../monitoring/health-monitor';
import { portManager } from '../utils/port-manager';

const logger = getLogger('HealthRouter');

/**
 * Health check response interface
 * Based on Python health check response format
 */
export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  service: string;
  version?: string;
  timestamp?: string;
  uptime?: number;
}

/**
 * Enhanced health response with detailed information
 */
export interface DetailedHealthResponse extends HealthResponse {
  details: {
    server: 'running' | 'starting' | 'stopping';
    authentication: 'configured' | 'not_configured';
    memory_usage: {
      used: number;
      total: number;
      percentage: number;
    };
    port_management?: {
      active_reservations: number;
      port_scan_performance: string;
    };
    monitoring?: {
      health_checks_active: boolean;
      last_check: string | null;
      overall_status: string;
      check_count: number;
    };
  };
}

/**
 * Production health response with comprehensive monitoring data
 */
export interface ProductionHealthResponse extends DetailedHealthResponse {
  production_metrics: {
    startup_time?: number;
    response_times: {
      average: number;
      recent: number[];
    };
    resource_usage: {
      cpu_usage?: number;
      memory_trend: string;
      port_conflicts_resolved: number;
    };
    health_history: {
      consecutive_healthy_checks: number;
      last_failure?: string;
      uptime_percentage: number;
    };
  };
}

/**
 * Health router class implementing health check endpoints
 * Based on Python health_check endpoint
 */
export class HealthRouter {
  private static startTime: number = Date.now();

  /**
   * Create Express router with health endpoints
   */
  static createRouter(): Router {
    const router = Router();

    // GET /health - Basic health check
    router.get('/health', this.basicHealthCheck.bind(this));
    
    // GET /health/detailed - Detailed health check
    router.get('/health/detailed', this.detailedHealthCheck.bind(this));

    // GET /health/production - Production-grade comprehensive health check
    router.get('/health/production', HealthRouter.productionHealthCheck.bind(HealthRouter));

    // GET /health/monitoring - Real-time monitoring data
    router.get('/health/monitoring', HealthRouter.monitoringHealthCheck.bind(HealthRouter));

    return router;
  }

  /**
   * Basic health check endpoint
   * Based on Python main.py:680-683 health_check function
   */
  static async basicHealthCheck(_req: Request, res: Response): Promise<void> {
    try {
      logger.debug('Basic health check requested');

      const response: HealthResponse = {
        status: 'healthy',
        service: 'claude-code-openai-wrapper'
      };

      logger.debug('Health check: healthy');
      res.json(response);
    } catch (error) {
      logger.error('Error in basic health check:', error);
      res.status(503).json({
        status: 'unhealthy',
        service: 'claude-code-openai-wrapper',
        error: 'Health check failed'
      });
    }
  }

  /**
   * Detailed health check endpoint with system information
   * Enhanced version providing more diagnostic information
   */
  static async detailedHealthCheck(_req: Request, res: Response): Promise<void> {
    try {
      logger.debug('Detailed health check requested');

      const memoryUsage = process.memoryUsage();
      const uptime = Date.now() - this.startTime;

      // Get port manager status
      const portManagerStatus = portManager.getStatus();

      // Get latest health monitoring data if available
      const latestHealthReport = getLatestHealthReport();

      const response: DetailedHealthResponse = {
        status: 'healthy',
        service: 'claude-code-openai-wrapper',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime,
        details: {
          server: 'running',
          authentication: this.checkAuthenticationStatus(),
          memory_usage: {
            used: memoryUsage.heapUsed,
            total: memoryUsage.heapTotal,
            percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
          },
          port_management: {
            active_reservations: portManagerStatus.activeReservations,
            port_scan_performance: 'optimal'
          },
          monitoring: latestHealthReport ? {
            health_checks_active: true,
            last_check: latestHealthReport.timestamp.toISOString(),
            overall_status: latestHealthReport.overall,
            check_count: latestHealthReport.checks.length
          } : {
            health_checks_active: false,
            last_check: null,
            overall_status: 'unknown',
            check_count: 0
          }
        }
      };

      // Adjust overall status based on health monitoring
      if (latestHealthReport && latestHealthReport.overall !== 'healthy') {
        response.status = 'unhealthy';
      }

      logger.debug('Detailed health check completed', {
        status: response.status,
        uptime,
        portReservations: portManagerStatus.activeReservations,
        monitoringActive: !!latestHealthReport
      });
      
      res.json(response);
    } catch (error) {
      logger.error('Error in detailed health check:', error);
      res.status(503).json({
        status: 'unhealthy',
        service: 'claude-code-openai-wrapper',
        error: 'Detailed health check failed'
      });
    }
  }

  /**
   * Production-grade comprehensive health check
   * Provides detailed metrics for production monitoring and alerting
   */
  static async productionHealthCheck(_req: Request, res: Response): Promise<void> {
    try {
      logger.debug('Production health check requested');

      const memoryUsage = process.memoryUsage();
      const uptime = Date.now() - this.startTime;
      const portManagerStatus = portManager.getStatus();
      const latestHealthReport = getLatestHealthReport();
      const monitoringStats = healthMonitor.getStatistics();

      // Calculate memory trend
      const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      const memoryTrend = memoryPercentage < 50 ? 'low' : memoryPercentage < 80 ? 'normal' : 'high';

      // Calculate uptime percentage (assume 99.9% for new instances)
      const uptimeHours = uptime / (1000 * 60 * 60);
      const uptimePercentage = Math.min(99.9, Math.max(95, 100 - (uptimeHours * 0.001)));

      const response: ProductionHealthResponse = {
        status: latestHealthReport?.overall === 'healthy' ? 'healthy' : 'unhealthy',
        service: 'claude-code-openai-wrapper',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime,
        details: {
          server: 'running',
          authentication: this.checkAuthenticationStatus(),
          memory_usage: {
            used: memoryUsage.heapUsed,
            total: memoryUsage.heapTotal,
            percentage: Math.round(memoryPercentage)
          },
          port_management: {
            active_reservations: portManagerStatus.activeReservations,
            port_scan_performance: monitoringStats.avgResponseTime < 500 ? 'optimal' : 'degraded'
          },
          monitoring: latestHealthReport ? {
            health_checks_active: true,
            last_check: latestHealthReport.timestamp.toISOString(),
            overall_status: latestHealthReport.overall,
            check_count: latestHealthReport.checks.length
          } : {
            health_checks_active: false,
            last_check: null,
            overall_status: 'unknown',
            check_count: 0
          }
        },
        production_metrics: {
          response_times: {
            average: monitoringStats.avgResponseTime,
            recent: [] // Could be enhanced with response time tracking
          },
          resource_usage: {
            memory_trend: memoryTrend,
            port_conflicts_resolved: Object.values(monitoringStats.failureRates).reduce((a, b) => a + b, 0)
          },
          health_history: {
            consecutive_healthy_checks: latestHealthReport?.summary.healthy || 0,
            uptime_percentage: uptimePercentage
          }
        }
      };

      const statusCode = response.status === 'healthy' ? 200 : 503;
      
      logger.debug('Production health check completed', {
        status: response.status,
        memoryTrend,
        uptimePercentage: uptimePercentage.toFixed(2)
      });
      
      res.status(statusCode).json(response);
    } catch (error) {
      logger.error('Error in production health check:', error);
      res.status(503).json({
        status: 'unhealthy',
        service: 'claude-code-openai-wrapper',
        error: 'Production health check failed'
      });
    }
  }

  /**
   * Real-time monitoring data endpoint
   * Provides current health monitoring system data
   */
  static async monitoringHealthCheck(_req: Request, res: Response): Promise<void> {
    try {
      logger.debug('Monitoring health check requested');

      const latestHealthReport = getLatestHealthReport();
      
      if (!latestHealthReport) {
        res.status(404).json({
          error: 'Health monitoring not active',
          message: 'Health monitoring system is not running'
        });
        return;
      }

      // Return the raw health monitoring data
      res.json({
        monitoring_active: true,
        last_updated: latestHealthReport.timestamp.toISOString(),
        report: latestHealthReport,
        statistics: healthMonitor.getStatistics()
      });

    } catch (error) {
      logger.error('Error in monitoring health check:', error);
      res.status(503).json({
        error: 'Monitoring health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Check authentication configuration status
   * Returns 'configured' if auth is available, 'not_configured' otherwise
   */
  private static checkAuthenticationStatus(): 'configured' | 'not_configured' {
    // Check for common authentication environment variables
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    const hasClaudeConfig = !!process.env.CLAUDE_CONFIG_DIR;
    const hasAwsConfig = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    const hasGcpConfig = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

    return (hasAnthropicKey || hasClaudeConfig || hasAwsConfig || hasGcpConfig) 
      ? 'configured' 
      : 'not_configured';
  }

  /**
   * Set server start time (called during initialization)
   */
  static setStartTime(startTime: number): void {
    this.startTime = startTime;
  }

  /**
   * Get current server uptime in milliseconds
   */
  static getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Check if server is healthy
   * Can be used internally for health status checks
   */
  static isHealthy(): boolean {
    try {
      // Basic health checks
      const memoryUsage = process.memoryUsage();
      const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      
      // Consider unhealthy if memory usage is above 90%
      if (memoryPercentage > 90) {
        logger.warn(`High memory usage: ${memoryPercentage.toFixed(1)}%`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error checking health status:', error);
      return false;
    }
  }
}

export default HealthRouter;