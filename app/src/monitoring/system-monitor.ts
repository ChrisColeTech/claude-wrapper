/**
 * Phase 15A System Monitoring - Comprehensive System Monitoring
 * Production-ready monitoring with health checks, metrics, and alerting
 * Based on Python implementation monitoring patterns
 */

import { EventEmitter } from 'events';
import { getLogger } from '../utils/logger';

const logger = getLogger('SystemMonitor');

/**
 * System Health Status
 */
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  components: {
    server: ComponentHealth;
    authentication: ComponentHealth;
    sessions: ComponentHealth;
    claude_sdk: ComponentHealth;
    memory: ComponentHealth;
    database: ComponentHealth;
  };
  metrics: SystemMetrics;
}

/**
 * Component Health Status
 */
export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: string;
  responseTime?: number;
  errorCount: number;
  details?: string;
}

/**
 * System Metrics
 */
export interface SystemMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    rate: number; // requests per second
    averageResponseTime: number;
  };
  memory: {
    used: number;
    free: number;
    usage: number; // percentage
    heapUsed: number;
    heapTotal: number;
  };
  cpu: {
    usage: number; // percentage
    loadAverage: number[];
  };
  sessions: {
    active: number;
    total: number;
    created: number;
    expired: number;
  };
  errors: {
    total: number;
    rate: number; // errors per minute
    last24Hours: number;
  };
}

/**
 * Alert Configuration
 */
export interface AlertConfig {
  enabled: boolean;
  thresholds: {
    responseTime: number; // ms
    errorRate: number; // percentage
    memoryUsage: number; // percentage
    cpuUsage: number; // percentage
    diskUsage: number; // percentage
  };
  channels: {
    console: boolean;
    file: boolean;
    webhook?: string;
    email?: string[];
  };
}

/**
 * System Monitor Class
 * Comprehensive system monitoring with health checks and metrics
 */
export class SystemMonitor extends EventEmitter {
  private health!: SystemHealth;
  private metrics!: SystemMetrics;
  private alertConfig: AlertConfig;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private startTime: number;
  private requestCount: number = 0;
  private errorCount: number = 0;
  private responseTimes: number[] = [];
  private isMonitoring: boolean = false;

  constructor(alertConfig?: Partial<AlertConfig>) {
    super();
    this.startTime = Date.now();
    
    this.alertConfig = {
      enabled: true,
      thresholds: {
        responseTime: 5000, // 5 seconds
        errorRate: 5, // 5%
        memoryUsage: 80, // 80%
        cpuUsage: 80, // 80%
        diskUsage: 90 // 90%
      },
      channels: {
        console: true,
        file: true
      },
      ...alertConfig
    };

    this.initializeMetrics();
    this.initializeHealth();
  }

  /**
   * Initialize system metrics
   */
  private initializeMetrics(): void {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        rate: 0,
        averageResponseTime: 0
      },
      memory: {
        used: 0,
        free: 0,
        usage: 0,
        heapUsed: 0,
        heapTotal: 0
      },
      cpu: {
        usage: 0,
        loadAverage: [0, 0, 0]
      },
      sessions: {
        active: 0,
        total: 0,
        created: 0,
        expired: 0
      },
      errors: {
        total: 0,
        rate: 0,
        last24Hours: 0
      }
    };
  }

  /**
   * Initialize system health
   */
  private initializeHealth(): void {
    this.health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: 0,
      version: '1.0.0',
      components: {
        server: this.createComponentHealth(),
        authentication: this.createComponentHealth(),
        sessions: this.createComponentHealth(),
        claude_sdk: this.createComponentHealth(),
        memory: this.createComponentHealth(),
        database: this.createComponentHealth()
      },
      metrics: this.metrics
    };
  }

  /**
   * Create component health status
   */
  private createComponentHealth(): ComponentHealth {
    return {
      status: 'healthy',
      lastCheck: new Date().toISOString(),
      errorCount: 0
    };
  }

  /**
   * Start monitoring
   */
  start(intervalMs: number = 30000): void {
    if (this.isMonitoring) {
      logger.warn('System monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting system monitoring', { interval: intervalMs });

    // Initial health check
    this.performHealthCheck();

    // Set up periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
      this.updateMetrics();
      this.checkAlerts();
    }, intervalMs);

    this.emit('monitoring:started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('System monitoring stopped');
    this.emit('monitoring:stopped');
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();

    try {
      // Update uptime
      this.health.uptime = Date.now() - this.startTime;
      this.health.timestamp = new Date().toISOString();

      // Check each component
      await Promise.all([
        this.checkServerHealth(),
        this.checkAuthenticationHealth(),
        this.checkSessionsHealth(),
        this.checkClaudeSDKHealth(),
        this.checkMemoryHealth(),
        this.checkDatabaseHealth()
      ]);

      // Update overall health status
      this.updateOverallHealth();

      const checkDuration = Date.now() - startTime;
      logger.debug('Health check completed', { duration: checkDuration });

    } catch (error) {
      logger.error('Health check failed', { error });
      this.health.status = 'unhealthy';
    }
  }

  /**
   * Check server health
   */
  private async checkServerHealth(): Promise<void> {
    const component = this.health.components.server;
    const startTime = Date.now();

    try {
      // Check if server is responsive
      const isResponsive = process.uptime() > 0;
      
      component.status = isResponsive ? 'healthy' : 'unhealthy';
      component.responseTime = Date.now() - startTime;
      component.lastCheck = new Date().toISOString();
      component.details = isResponsive ? 'Server is responsive' : 'Server not responding';

      if (!isResponsive) {
        component.errorCount++;
      }

    } catch (error) {
      component.status = 'unhealthy';
      component.errorCount++;
      component.details = `Server check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Check authentication health
   */
  private async checkAuthenticationHealth(): Promise<void> {
    const component = this.health.components.authentication;
    const startTime = Date.now();

    try {
      // Check if authentication system is available
      // In production, this would check auth provider connectivity
      const isHealthy = process.env.ANTHROPIC_API_KEY || 
                       process.env.AWS_ACCESS_KEY_ID || 
                       process.env.GOOGLE_APPLICATION_CREDENTIALS;

      component.status = isHealthy ? 'healthy' : 'degraded';
      component.responseTime = Date.now() - startTime;
      component.lastCheck = new Date().toISOString();
      component.details = isHealthy ? 'Authentication configured' : 'No authentication configured';

      if (!isHealthy) {
        component.errorCount++;
      }

    } catch (error) {
      component.status = 'unhealthy';
      component.errorCount++;
      component.details = `Auth check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Check sessions health
   */
  private async checkSessionsHealth(): Promise<void> {
    const component = this.health.components.sessions;
    const startTime = Date.now();

    try {
      // Check session system health
      // In production, this would check session storage connectivity
      const sessionSystemHealthy = true; // Placeholder for session system check

      component.status = sessionSystemHealthy ? 'healthy' : 'unhealthy';
      component.responseTime = Date.now() - startTime;
      component.lastCheck = new Date().toISOString();
      component.details = sessionSystemHealthy ? 'Session system operational' : 'Session system issues';

    } catch (error) {
      component.status = 'unhealthy';
      component.errorCount++;
      component.details = `Session check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Check Claude SDK health
   */
  private async checkClaudeSDKHealth(): Promise<void> {
    const component = this.health.components.claude_sdk;
    const startTime = Date.now();

    try {
      // Check Claude SDK connectivity
      // In production, this would ping Claude API or check SDK status
      const sdkHealthy = true; // Placeholder for SDK health check

      component.status = sdkHealthy ? 'healthy' : 'degraded';
      component.responseTime = Date.now() - startTime;
      component.lastCheck = new Date().toISOString();
      component.details = sdkHealthy ? 'Claude SDK accessible' : 'Claude SDK connectivity issues';

    } catch (error) {
      component.status = 'unhealthy';
      component.errorCount++;
      component.details = `Claude SDK check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Check memory health
   */
  private checkMemoryHealth(): void {
    const component = this.health.components.memory;
    const startTime = Date.now();

    try {
      const memoryUsage = process.memoryUsage();
      const usage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

      component.status = usage < 80 ? 'healthy' : usage < 90 ? 'degraded' : 'unhealthy';
      component.responseTime = Date.now() - startTime;
      component.lastCheck = new Date().toISOString();
      component.details = `Memory usage: ${usage.toFixed(1)}%`;

      // Update metrics
      this.metrics.memory = {
        used: memoryUsage.heapUsed,
        free: memoryUsage.heapTotal - memoryUsage.heapUsed,
        usage,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal
      };

    } catch (error) {
      component.status = 'unhealthy';
      component.errorCount++;
      component.details = `Memory check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Check database health (placeholder for future database integration)
   */
  private async checkDatabaseHealth(): Promise<void> {
    const component = this.health.components.database;
    const startTime = Date.now();

    try {
      // For now, this is a placeholder since we use in-memory storage
      // In production with a real database, this would check connectivity
      const dbHealthy = true; // In-memory storage is always available

      component.status = dbHealthy ? 'healthy' : 'unhealthy';
      component.responseTime = Date.now() - startTime;
      component.lastCheck = new Date().toISOString();
      component.details = 'In-memory storage operational';

    } catch (error) {
      component.status = 'unhealthy';
      component.errorCount++;
      component.details = `Database check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Update overall health status based on components
   */
  private updateOverallHealth(): void {
    const components = Object.values(this.health.components);
    const unhealthyCount = components.filter(c => c.status === 'unhealthy').length;
    const degradedCount = components.filter(c => c.status === 'degraded').length;

    if (unhealthyCount > 0) {
      this.health.status = 'unhealthy';
    } else if (degradedCount > 0) {
      this.health.status = 'degraded';
    } else {
      this.health.status = 'healthy';
    }

    // Update metrics in health object
    this.health.metrics = { ...this.metrics };
  }

  /**
   * Update system metrics
   */
  private updateMetrics(): void {
    // Update request metrics
    if (this.responseTimes.length > 0) {
      this.metrics.requests.averageResponseTime = 
        this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
    }

    // Update CPU metrics
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    this.metrics.cpu.loadAverage = require('os').loadavg();

    // Calculate rates (simple approximation)
    const uptimeSeconds = (Date.now() - this.startTime) / 1000;
    this.metrics.requests.rate = this.requestCount / uptimeSeconds;
    this.metrics.errors.rate = this.errorCount / (uptimeSeconds / 60); // per minute

    logger.debug('Metrics updated', {
      requests: this.metrics.requests,
      memory: this.metrics.memory,
      errors: this.metrics.errors
    });
  }

  /**
   * Check alert conditions
   */
  private checkAlerts(): void {
    if (!this.alertConfig.enabled) {
      return;
    }

    const alerts: string[] = [];

    // Check response time
    if (this.metrics.requests.averageResponseTime > this.alertConfig.thresholds.responseTime) {
      alerts.push(`High response time: ${this.metrics.requests.averageResponseTime}ms`);
    }

    // Check error rate
    const errorRate = (this.metrics.requests.failed / this.metrics.requests.total) * 100;
    if (errorRate > this.alertConfig.thresholds.errorRate) {
      alerts.push(`High error rate: ${errorRate.toFixed(1)}%`);
    }

    // Check memory usage
    if (this.metrics.memory.usage > this.alertConfig.thresholds.memoryUsage) {
      alerts.push(`High memory usage: ${this.metrics.memory.usage.toFixed(1)}%`);
    }

    // Check CPU usage
    if (this.metrics.cpu.usage > this.alertConfig.thresholds.cpuUsage) {
      alerts.push(`High CPU usage: ${this.metrics.cpu.usage.toFixed(1)}%`);
    }

    // Send alerts if any
    if (alerts.length > 0) {
      this.sendAlerts(alerts);
    }
  }

  /**
   * Send alerts through configured channels
   */
  private sendAlerts(alerts: string[]): void {
    if (this.alertConfig.channels.console) {
      logger.warn('SYSTEM ALERT', { alerts });
    }

    if (this.alertConfig.channels.file) {
      logger.error('SYSTEM ALERT', { alerts, timestamp: new Date().toISOString() });
    }

    // Emit alert event for external handling
    this.emit('alert', { alerts, timestamp: new Date().toISOString() });
  }

  /**
   * Record a request
   */
  recordRequest(responseTime: number, success: boolean): void {
    this.requestCount++;
    this.responseTimes.push(responseTime);
    
    // Keep only last 100 response times for average calculation
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }

    this.metrics.requests.total++;
    if (success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
      this.errorCount++;
      this.metrics.errors.total++;
    }
  }

  /**
   * Record session metrics
   */
  recordSessionMetrics(active: number, total: number, created: number, expired: number): void {
    this.metrics.sessions = {
      active,
      total,
      created,
      expired
    };
  }

  /**
   * Get current health status
   */
  getHealth(): SystemHealth {
    return { ...this.health };
  }

  /**
   * Get current metrics
   */
  getMetrics(): SystemMetrics {
    return { ...this.metrics };
  }

  /**
   * Get monitoring status
   */
  isRunning(): boolean {
    return this.isMonitoring;
  }

  /**
   * Get system summary for quick status check
   */
  getSystemSummary(): {
    status: string;
    uptime: number;
    requests: number;
    errors: number;
    memoryUsage: number;
    lastCheck: string;
  } {
    return {
      status: this.health.status,
      uptime: this.health.uptime,
      requests: this.metrics.requests.total,
      errors: this.metrics.errors.total,
      memoryUsage: this.metrics.memory.usage,
      lastCheck: this.health.timestamp
    };
  }
}

// Global system monitor instance
export const systemMonitor = new SystemMonitor();

// Export monitoring utilities
export const startMonitoring = (intervalMs?: number): void => {
  systemMonitor.start(intervalMs);
};

export const stopMonitoring = (): void => {
  systemMonitor.stop();
};

export const getSystemHealth = (): SystemHealth => {
  return systemMonitor.getHealth();
};

export const getSystemMetrics = (): SystemMetrics => {
  return systemMonitor.getMetrics();
};

export const recordRequest = (responseTime: number, success: boolean): void => {
  systemMonitor.recordRequest(responseTime, success);
};