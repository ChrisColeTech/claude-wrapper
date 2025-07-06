/**
 * Production Health Monitoring System
 * Provides comprehensive health monitoring and status tracking for production deployments
 * 
 * Single Responsibility: Health status monitoring and reporting
 * Integrates with existing health system for Claude SDK compatibility
 */

import { createLogger } from '../utils/logger';
import { config } from '../utils/env';
import { productionConfig } from '../../config/production.config';
import { PortUtils } from '../utils/port';
import { ResourceManager } from '../utils/resource-manager';
import winston from 'winston';

/**
 * Health check status levels
 */
export type HealthStatus = 'healthy' | 'warning' | 'unhealthy' | 'unknown';

/**
 * Individual health check result
 */
export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  message: string;
  duration: number;
  timestamp: Date;
  details?: Record<string, any>;
}

/**
 * Comprehensive system health report
 */
export interface SystemHealthReport {
  overall: HealthStatus;
  uptime: number;
  timestamp: Date;
  checks: HealthCheckResult[];
  summary: {
    healthy: number;
    warning: number;
    unhealthy: number;
    total: number;
  };
  performance: {
    avgResponseTime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage?: number;
  };
}

/**
 * Health monitor configuration
 */
export interface HealthMonitorConfig {
  checkInterval: number;
  timeout: number;
  retryAttempts: number;
  alertThresholds: {
    memoryUsage: number;
    responseTime: number;
    consecutiveFailures: number;
  };
  enableDetailedMetrics: boolean;
  enablePerformanceTracking: boolean;
}

/**
 * Health check function interface
 */
export type HealthCheckFunction = () => Promise<HealthCheckResult>;

/**
 * Production-grade health monitoring system
 * Follows SRP: handles only health monitoring and status reporting
 */
export class HealthMonitor {
  private logger: winston.Logger;
  private config: HealthMonitorConfig;
  private checks: Map<string, HealthCheckFunction> = new Map();
  private lastReport: SystemHealthReport | null = null;
  private startTime: Date = new Date();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private failureCount: Map<string, number> = new Map();
  private responseTimeHistory: number[] = [];
  private activeServerPort: number | null = null;
  private resourceManager: ResourceManager;

  constructor(healthConfig?: Partial<HealthMonitorConfig>) {
    this.logger = createLogger(config);
    this.resourceManager = new ResourceManager('HealthMonitor');

    this.config = {
      checkInterval: productionConfig.getMonitoringConfig().healthCheckInterval,
      timeout: 5000,
      retryAttempts: 2,
      alertThresholds: {
        memoryUsage: 0.8, // 80% of available memory
        responseTime: 1000, // 1 second
        consecutiveFailures: 3
      },
      enableDetailedMetrics: productionConfig.getFeatureFlags().verboseLogging,
      enablePerformanceTracking: true,
      ...healthConfig
    };

    this.registerCoreHealthChecks();
  }

  /**
   * Start continuous health monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      this.logger.warn('Health monitoring already started');
      return;
    }

    this.logger.info(`Starting health monitoring (interval: ${this.config.checkInterval}ms)`);
    
    this.monitoringInterval = this.resourceManager.trackInterval(async () => {
      try {
        await this.runHealthChecks();
      } catch (error) {
        this.logger.error(`Health monitoring error: ${error}`);
      }
    }, this.config.checkInterval, 'Health monitoring interval');

    // Initial health check
    this.runHealthChecks().catch(error => {
      this.logger.error(`Initial health check failed: ${error}`);
    });
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info('Health monitoring stopped');
    }
  }

  /**
   * Register a custom health check
   */
  registerHealthCheck(name: string, checkFunction: HealthCheckFunction): void {
    if (this.checks.has(name)) {
      this.logger.warn(`Health check '${name}' already registered, overwriting`);
    }

    this.checks.set(name, checkFunction);
    this.logger.debug(`Registered health check: ${name}`);
  }

  /**
   * Unregister a health check
   */
  unregisterHealthCheck(name: string): boolean {
    const removed = this.checks.delete(name);
    if (removed) {
      this.failureCount.delete(name);
      this.logger.debug(`Unregistered health check: ${name}`);
    }
    return removed;
  }

  /**
   * Run all health checks and generate comprehensive report
   */
  async runHealthChecks(): Promise<SystemHealthReport> {
    const startTime = Date.now();
    const checkResults: HealthCheckResult[] = [];

    this.logger.debug(`Running ${this.checks.size} health checks...`);

    // Execute all health checks in parallel
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, checkFn]) => {
      return this.executeHealthCheck(name, checkFn);
    });

    try {
      const results = await Promise.allSettled(checkPromises);
      
      results.forEach((result, index) => {
        const checkName = Array.from(this.checks.keys())[index];
        
        if (result.status === 'fulfilled') {
          checkResults.push(result.value);
        } else {
          checkResults.push({
            name: checkName,
            status: 'unhealthy',
            message: `Check execution failed: ${result.reason}`,
            duration: 0,
            timestamp: new Date()
          });
        }
      });

    } catch (error) {
      this.logger.error(`Health checks execution failed: ${error}`);
    }

    // Calculate overall health status
    const overall = this.calculateOverallHealth(checkResults);
    
    // Generate performance metrics
    const performance = this.generatePerformanceMetrics();
    
    // Track response time
    const totalDuration = Date.now() - startTime;
    this.updateResponseTimeHistory(totalDuration);

    // Create comprehensive report
    const report: SystemHealthReport = {
      overall,
      uptime: Date.now() - this.startTime.getTime(),
      timestamp: new Date(),
      checks: checkResults,
      summary: this.generateSummary(checkResults),
      performance
    };

    this.lastReport = report;
    
    // Log health status
    this.logHealthStatus(report);
    
    // Check for alerts
    this.checkAlertConditions(report);

    return report;
  }

  /**
   * Get the latest health report
   */
  getLatestReport(): SystemHealthReport | null {
    return this.lastReport;
  }

  /**
   * Get health status for specific check
   */
  getCheckStatus(checkName: string): HealthCheckResult | null {
    if (!this.lastReport) {
      return null;
    }
    
    return this.lastReport.checks.find(check => check.name === checkName) || null;
  }

  /**
   * Get monitoring statistics
   */
  getStatistics(): {
    totalChecks: number;
    avgResponseTime: number;
    failureRates: Record<string, number>;
    uptime: number;
  } {
    const totalChecks = this.checks.size;
    const avgResponseTime = this.responseTimeHistory.length > 0
      ? this.responseTimeHistory.reduce((a, b) => a + b, 0) / this.responseTimeHistory.length
      : 0;

    const failureRates: Record<string, number> = {};
    for (const [name, failures] of this.failureCount.entries()) {
      failureRates[name] = failures;
    }

    return {
      totalChecks,
      avgResponseTime,
      failureRates,
      uptime: Date.now() - this.startTime.getTime()
    };
  }

  /**
   * Execute individual health check with timeout and retry logic
   */
  private async executeHealthCheck(name: string, checkFn: HealthCheckFunction): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        // Execute with timeout
        const result = await Promise.race([
          checkFn(),
          this.createTimeoutPromise(name)
        ]);

        // Reset failure count on success
        this.failureCount.set(name, 0);
        
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.config.retryAttempts) {
          this.logger.debug(`Health check '${name}' failed attempt ${attempt}, retrying...`);
          await this.delay(100 * attempt); // Exponential backoff
        }
      }
    }

    // All attempts failed
    const currentFailures = this.failureCount.get(name) || 0;
    this.failureCount.set(name, currentFailures + 1);

    return {
      name,
      status: 'unhealthy',
      message: lastError?.message || 'Health check failed',
      duration: Date.now() - startTime,
      timestamp: new Date(),
      details: { attempts: this.config.retryAttempts, error: lastError?.message }
    };
  }

  /**
   * Register core system health checks
   */
  private registerCoreHealthChecks(): void {
    // Memory usage check
    this.registerHealthCheck('memory', async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
      const usageRatio = heapUsedMB / heapTotalMB;

      let status: HealthStatus = 'healthy';
      if (usageRatio > this.config.alertThresholds.memoryUsage) {
        status = 'warning';
      }
      if (usageRatio > 0.95) {
        status = 'unhealthy';
      }

      return {
        name: 'memory',
        status,
        message: `Memory usage: ${heapUsedMB.toFixed(1)}MB / ${heapTotalMB.toFixed(1)}MB (${(usageRatio * 100).toFixed(1)}%)`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        details: { memoryUsage, usageRatio }
      };
    });

    // Server port check
    this.registerHealthCheck('server-port', async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();
      // Use active server port if available, otherwise fall back to production config
      const serverPort = this.activeServerPort || productionConfig.getServerConfig().port;

      try {
        const available = await PortUtils.isPortAvailable(serverPort);
        
        return {
          name: 'server-port',
          status: available ? 'unhealthy' : 'healthy', // Port should NOT be available if server is running
          message: available 
            ? `Server port ${serverPort} is not in use (server may not be running)`
            : `Server port ${serverPort} is active`,
          duration: Date.now() - startTime,
          timestamp: new Date(),
          details: { port: serverPort, available, activePort: this.activeServerPort }
        };
      } catch (error) {
        return {
          name: 'server-port',
          status: 'unhealthy',
          message: `Port check failed: ${error}`,
          duration: Date.now() - startTime,
          timestamp: new Date()
        };
      }
    });

    // System uptime check
    this.registerHealthCheck('uptime', async (): Promise<HealthCheckResult> => {
      const startTime = Date.now();
      const uptime = Date.now() - this.startTime.getTime();
      const uptimeSeconds = Math.floor(uptime / 1000);

      return {
        name: 'uptime',
        status: 'healthy',
        message: `System uptime: ${this.formatUptime(uptimeSeconds)}`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        details: { uptimeMs: uptime, uptimeSeconds }
      };
    });
  }

  /**
   * Calculate overall health status from individual checks
   */
  private calculateOverallHealth(checks: HealthCheckResult[]): HealthStatus {
    if (checks.length === 0) return 'unknown';

    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;

    if (unhealthyCount > 0) return 'unhealthy';
    if (warningCount > 0) return 'warning';
    
    return 'healthy';
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(checks: HealthCheckResult[]): SystemHealthReport['summary'] {
    return {
      healthy: checks.filter(c => c.status === 'healthy').length,
      warning: checks.filter(c => c.status === 'warning').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length,
      total: checks.length
    };
  }

  /**
   * Generate performance metrics
   */
  private generatePerformanceMetrics(): SystemHealthReport['performance'] {
    const memoryUsage = process.memoryUsage();
    const avgResponseTime = this.responseTimeHistory.length > 0
      ? this.responseTimeHistory.reduce((a, b) => a + b, 0) / this.responseTimeHistory.length
      : 0;

    return {
      avgResponseTime,
      memoryUsage,
      cpuUsage: this.config.enablePerformanceTracking ? process.cpuUsage().user / 1000000 : undefined
    };
  }

  /**
   * Update response time history (keep last 100 entries)
   */
  private updateResponseTimeHistory(duration: number): void {
    this.responseTimeHistory.push(duration);
    if (this.responseTimeHistory.length > 100) {
      this.responseTimeHistory.shift();
    }
  }

  /**
   * Log health status based on severity
   */
  private logHealthStatus(report: SystemHealthReport): void {
    const { overall, summary } = report;
    
    if (overall === 'healthy') {
      this.logger.debug(`Health check passed: ${summary.healthy}/${summary.total} checks healthy`);
    } else if (overall === 'warning') {
      this.logger.warn(`Health check warning: ${summary.warning} warnings, ${summary.unhealthy} failures`);
    } else {
      this.logger.error(`Health check failed: ${summary.unhealthy} failures, ${summary.warning} warnings`);
    }
  }

  /**
   * Check for alert conditions
   */
  private checkAlertConditions(report: SystemHealthReport): void {
    // Check consecutive failures
    for (const [checkName, failures] of this.failureCount.entries()) {
      if (failures >= this.config.alertThresholds.consecutiveFailures) {
        this.logger.error(`ALERT: Health check '${checkName}' has failed ${failures} consecutive times`);
      }
    }

    // Check response time
    if (report.performance.avgResponseTime > this.config.alertThresholds.responseTime) {
      this.logger.warn(`ALERT: Average response time ${report.performance.avgResponseTime}ms exceeds threshold`);
    }
  }

  /**
   * Create timeout promise for health checks
   */
  private createTimeoutPromise(checkName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check '${checkName}' timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);
    });
  }

  /**
   * Format uptime in human-readable format
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${secs}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set the active server port for monitoring
   */
  setActiveServerPort(port: number): void {
    this.activeServerPort = port;
    this.logger.debug(`Health monitor now tracking server port: ${port}`);
  }

  /**
   * Clear the active server port
   */
  clearActiveServerPort(): void {
    this.activeServerPort = null;
    this.logger.debug('Health monitor cleared active server port');
  }

  /**
   * Cleanup resources
   */
  shutdown(): void {
    this.stopMonitoring();
    this.checks.clear();
    this.failureCount.clear();
    this.responseTimeHistory = [];
    this.activeServerPort = null;
    this.logger.debug('HealthMonitor shutdown complete');
  }

  /**
   * Cleanup all resources and stop monitoring
   * Prevents memory leaks by properly cleaning up intervals and timers
   */
  cleanup(): void {
    this.logger.info('Cleaning up HealthMonitor resources');
    
    // Stop monitoring first
    this.shutdown();
    
    // Cleanup all tracked resources
    this.resourceManager.cleanup();
    
    this.logger.info('HealthMonitor cleanup completed');
  }

  /**
   * Destroy the monitor instance completely
   */
  destroy(): void {
    this.cleanup();
    this.resourceManager.destroy();
  }
}

// Production-ready singleton instance
export const healthMonitor = new HealthMonitor();

// Export utilities for easy access
export const startHealthMonitoring = () => healthMonitor.startMonitoring();
export const getHealthReport = () => healthMonitor.runHealthChecks();
export const getLatestHealthReport = () => healthMonitor.getLatestReport();
export const cleanupHealthMonitor = () => healthMonitor.cleanup();