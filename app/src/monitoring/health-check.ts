/**
 * Phase 15A Health Check Service
 * Advanced health check service for production monitoring
 * Based on Python implementation health patterns
 */

import { getLogger } from '../utils/logger';
import { systemMonitor, SystemHealth } from './system-monitor';

const logger = getLogger('HealthCheck');

/**
 * Health Check Response Interface
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  service: string;
  environment: string;
  checks: {
    [key: string]: {
      status: 'pass' | 'warn' | 'fail';
      time: string;
      duration?: number;
      output?: string;
    };
  };
  metadata?: {
    [key: string]: any;
  };
}

/**
 * Health Check Configuration
 */
export interface HealthCheckConfig {
  serviceName: string;
  version: string;
  environment: string;
  includeSystemInfo: boolean;
  includeMetrics: boolean;
  checks: {
    [key: string]: () => Promise<{ status: 'pass' | 'warn' | 'fail'; output?: string }>;
  };
}

/**
 * Health Check Service
 * Provides standardized health check endpoints and monitoring
 */
export class HealthCheckService {
  private config: HealthCheckConfig;
  private startTime: number;

  constructor(config?: Partial<HealthCheckConfig>) {
    this.startTime = Date.now();
    
    this.config = {
      serviceName: 'claude-wrapper',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      includeSystemInfo: true,
      includeMetrics: false,
      checks: {},
      ...config
    };

    this.registerDefaultChecks();
  }

  /**
   * Register default health checks
   */
  private registerDefaultChecks(): void {
    // Basic server health check
    this.registerCheck('server', async () => {
      const uptime = process.uptime();
      return {
        status: uptime > 0 ? 'pass' : 'fail',
        output: `Server uptime: ${uptime} seconds`
      };
    });

    // Memory health check
    this.registerCheck('memory', async () => {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
      const usage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

      let status: 'pass' | 'warn' | 'fail' = 'pass';
      if (usage > 90) {
        status = 'fail';
      } else if (usage > 80) {
        status = 'warn';
      }

      return {
        status,
        output: `Memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${usage.toFixed(1)}%)`
      };
    });

    // Event loop health check
    this.registerCheck('eventloop', async () => {
      return new Promise((resolve) => {
        const start = process.hrtime.bigint();
        setImmediate(() => {
          const end = process.hrtime.bigint();
          const delayMs = Number(end - start) / 1000000;
          
          let status: 'pass' | 'warn' | 'fail' = 'pass';
          if (delayMs > 100) {
            status = 'fail';
          } else if (delayMs > 50) {
            status = 'warn';
          }

          resolve({
            status,
            output: `Event loop delay: ${delayMs.toFixed(2)}ms`
          });
        });
      });
    });

    // Authentication check
    this.registerCheck('authentication', async () => {
      const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
      const hasAwsCredentials = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
      const hasGoogleCredentials = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
      
      const hasAuth = hasAnthropicKey || hasAwsCredentials || hasGoogleCredentials;
      
      return {
        status: hasAuth ? 'pass' : 'warn',
        output: hasAuth ? 'Authentication configured' : 'No authentication configured'
      };
    });

    // Environment variables check
    this.registerCheck('environment', async () => {
      const requiredEnvVars = ['NODE_ENV'];
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      
      return {
        status: missingVars.length === 0 ? 'pass' : 'warn',
        output: missingVars.length === 0 
          ? 'All required environment variables present'
          : `Missing environment variables: ${missingVars.join(', ')}`
      };
    });
  }

  /**
   * Register a custom health check
   */
  registerCheck(name: string, check: () => Promise<{ status: 'pass' | 'warn' | 'fail'; output?: string }>): void {
    this.config.checks[name] = check;
  }

  /**
   * Remove a health check
   */
  unregisterCheck(name: string): void {
    delete this.config.checks[name];
  }

  /**
   * Perform all health checks
   */
  async performHealthCheck(): Promise<HealthCheckResponse> {
    const timestamp = new Date().toISOString();
    const uptime = Date.now() - this.startTime;
    
    logger.debug('Performing health check');

    const checks: HealthCheckResponse['checks'] = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Execute all checks
    for (const [name, checkFn] of Object.entries(this.config.checks)) {
      const startTime = Date.now();
      
      try {
        const result = await checkFn();
        const duration = Date.now() - startTime;
        
        checks[name] = {
          status: result.status,
          time: new Date().toISOString(),
          duration,
          output: result.output
        };

        // Update overall status
        if (result.status === 'fail') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'warn' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }

      } catch (error) {
        checks[name] = {
          status: 'fail',
          time: new Date().toISOString(),
          duration: Date.now() - startTime,
          output: `Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
        overallStatus = 'unhealthy';
      }
    }

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp,
      uptime,
      version: this.config.version,
      service: this.config.serviceName,
      environment: this.config.environment,
      checks
    };

    // Add optional metadata
    if (this.config.includeSystemInfo) {
      response.metadata = {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid
      };
    }

    // Add metrics if enabled
    if (this.config.includeMetrics && systemMonitor.isRunning()) {
      const metrics = systemMonitor.getMetrics();
      response.metadata = {
        ...response.metadata,
        metrics: {
          requests_total: metrics.requests.total,
          requests_rate: metrics.requests.rate,
          memory_usage: metrics.memory.usage,
          error_rate: metrics.errors.rate
        }
      };
    }

    logger.debug('Health check completed', { 
      status: overallStatus, 
      checksCount: Object.keys(checks).length 
    });

    return response;
  }

  /**
   * Get simple health status (for basic health checks)
   */
  async getSimpleHealth(): Promise<{ status: string; uptime: number; timestamp: string }> {
    const uptime = Date.now() - this.startTime;
    const isHealthy = process.uptime() > 0;
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      uptime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get readiness status (for Kubernetes readiness probes)
   */
  async getReadiness(): Promise<{ ready: boolean; checks: string[] }> {
    try {
      const healthCheck = await this.performHealthCheck();
      const failedChecks = Object.entries(healthCheck.checks)
        .filter(([, check]) => check.status === 'fail')
        .map(([name]) => name);

      return {
        ready: healthCheck.status !== 'unhealthy',
        checks: failedChecks
      };
    } catch (error) {
      return {
        ready: false,
        checks: ['health_check_error']
      };
    }
  }

  /**
   * Get liveness status (for Kubernetes liveness probes)
   */
  async getLiveness(): Promise<{ alive: boolean; uptime: number }> {
    const uptime = process.uptime();
    
    return {
      alive: uptime > 0,
      uptime
    };
  }

  /**
   * Get detailed system health (includes system monitor data)
   */
  async getDetailedHealth(): Promise<{
    health: HealthCheckResponse;
    system: SystemHealth | null;
  }> {
    const health = await this.performHealthCheck();
    const system = systemMonitor.isRunning() ? systemMonitor.getHealth() : null;

    return {
      health,
      system
    };
  }

  /**
   * Configure health check settings
   */
  configure(config: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfiguration(): HealthCheckConfig {
    return { ...this.config };
  }
}

// Global health check service instance
export const healthCheckService = new HealthCheckService();

// Export utility functions
export const performHealthCheck = (): Promise<HealthCheckResponse> => {
  return healthCheckService.performHealthCheck();
};

export const getSimpleHealth = (): Promise<{ status: string; uptime: number; timestamp: string }> => {
  return healthCheckService.getSimpleHealth();
};

export const getReadiness = (): Promise<{ ready: boolean; checks: string[] }> => {
  return healthCheckService.getReadiness();
};

export const getLiveness = (): Promise<{ alive: boolean; uptime: number }> => {
  return healthCheckService.getLiveness();
};

export const getDetailedHealth = (): Promise<{
  health: HealthCheckResponse;
  system: SystemHealth | null;
}> => {
  return healthCheckService.getDetailedHealth();
};

export const registerHealthCheck = (
  name: string, 
  check: () => Promise<{ status: 'pass' | 'warn' | 'fail'; output?: string }>
): void => {
  healthCheckService.registerCheck(name, check);
};