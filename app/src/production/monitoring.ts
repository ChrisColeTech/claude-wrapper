/**
 * Production Monitoring System
 * Single Responsibility: Comprehensive metrics, health checks, and alerting
 *
 * Based on Phase 15A requirements:
 * - Comprehensive monitoring and alerting for tool operations
 * - Performance monitoring for production workloads
 * - Health checks and system status monitoring
 * - Production logging and audit trails
 */

import winston from "winston";
import { EventEmitter } from "events";

export interface IMonitoring {
  recordToolOperation(
    toolName: string,
    duration: number,
    success: boolean,
    error?: string
  ): void;
  recordPerformanceMetric(operation: string, duration: number): void;
  getHealthStatus(): HealthStatus;
  getMetricsSummary(): MetricsSummary;
  setupAlert(condition: AlertCondition, callback: AlertCallback): string;
  removeAlert(alertId: string): boolean;
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: number;
  uptime: number;
  components: ComponentHealth[];
  overall: {
    errors: number;
    warnings: number;
    criticalIssues: string[];
  };
}

export interface ComponentHealth {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  lastCheck: number;
  details?: any;
  error?: string;
}

export interface MetricsSummary {
  timestamp: number;
  period: {
    start: number;
    end: number;
    duration: number;
  };
  tools: {
    totalCalls: number;
    successRate: number;
    averageLatency: number;
    errorsByTool: Record<string, number>;
    callsByTool: Record<string, number>;
  };
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
  };
  system: {
    memoryUsage: number;
    cpuUsage: number;
    uptime: number;
    activeConnections: number;
  };
}

export interface AlertCondition {
  metric: string;
  threshold: number;
  operator: "gt" | "lt" | "eq" | "gte" | "lte";
  window?: number; // Time window in ms
  cooldown?: number; // Cooldown period in ms
}

export type AlertCallback = (alert: AlertEvent) => void;

export interface AlertEvent {
  alertId: string;
  condition: AlertCondition;
  currentValue: number;
  timestamp: number;
  message: string;
}

export interface ToolOperationMetric {
  toolName: string;
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
}

export interface PerformanceMetric {
  operation: string;
  timestamp: number;
  duration: number;
}

export interface AlertState {
  id: string;
  condition: AlertCondition;
  callback: AlertCallback;
  lastTriggered?: number;
  active: boolean;
}

export class ProductionMonitoring extends EventEmitter implements IMonitoring {
  private logger: winston.Logger;
  private startTime: number;
  private toolMetrics: ToolOperationMetric[];
  private performanceMetrics: PerformanceMetric[];
  private alerts: Map<string, AlertState>;
  private healthCheckInterval: NodeJS.Timeout;
  private cleanupInterval: NodeJS.Timeout;
  private metricsRetentionMs: number;

  constructor(
    logger: winston.Logger,
    config: {
      metricsRetentionMs?: number;
      healthCheckIntervalMs?: number;
    } = {}
  ) {
    super();
    this.logger = logger;
    this.startTime = Date.now();
    this.toolMetrics = [];
    this.performanceMetrics = [];
    this.alerts = new Map();
    this.metricsRetentionMs = config.metricsRetentionMs || 24 * 60 * 60 * 1000; // 24 hours

    // Skip interval creation in test environment to prevent memory leaks
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
      // Start health check monitoring
      this.healthCheckInterval = setInterval(
        () => this.performHealthCheck(),
        config.healthCheckIntervalMs || 30000 // 30 seconds
      );

      // Cleanup old metrics every hour
      this.cleanupInterval = setInterval(() => this.cleanupOldMetrics(), 60 * 60 * 1000);
    }
  }

  recordToolOperation(
    toolName: string,
    duration: number,
    success: boolean,
    error?: string
  ): void {
    const metric: ToolOperationMetric = {
      toolName,
      timestamp: Date.now(),
      duration,
      success,
      error,
    };

    this.toolMetrics.push(metric);

    // Log the operation
    this.logger.info("Tool operation recorded", {
      tool: toolName,
      duration,
      success,
      error: error || undefined,
    });

    // Check alerts
    this.checkToolAlerts(metric);

    // Emit event for real-time monitoring
    this.emit("toolOperation", metric);
  }

  recordPerformanceMetric(operation: string, duration: number): void {
    const metric: PerformanceMetric = {
      operation,
      timestamp: Date.now(),
      duration,
    };

    this.performanceMetrics.push(metric);

    this.logger.info("Performance metric recorded", {
      operation: operation,
      duration: duration,
    });

    // Check performance alerts
    this.checkPerformanceAlerts(metric);

    // Emit event for real-time monitoring
    this.emit("performanceMetric", metric);
  }

  getHealthStatus(): HealthStatus {
    const now = Date.now();
    const uptime = now - this.startTime;

    const components = this.checkComponentHealth();
    const errors = components.filter((c) => c.status === "unhealthy").length;
    const warnings = components.filter((c) => c.status === "degraded").length;

    const criticalIssues: string[] = [];
    components.forEach((component) => {
      if (component.status === "unhealthy" && component.error) {
        criticalIssues.push(`${component.name}: ${component.error}`);
      }
    });

    let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (errors > 0) {
      overallStatus = "unhealthy";
    } else if (warnings > 0) {
      overallStatus = "degraded";
    }

    return {
      status: overallStatus,
      timestamp: now,
      uptime,
      components,
      overall: {
        errors,
        warnings,
        criticalIssues,
      },
    };
  }

  getMetricsSummary(): MetricsSummary {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Filter recent metrics
    const recentToolMetrics = this.toolMetrics.filter(
      (m) => m.timestamp >= oneHourAgo
    );
    const recentPerfMetrics = this.performanceMetrics.filter(
      (m) => m.timestamp >= oneHourAgo
    );

    // Calculate tool statistics
    const totalCalls = recentToolMetrics.length;
    const successfulCalls = recentToolMetrics.filter((m) => m.success).length;
    const successRate = totalCalls > 0 ? successfulCalls / totalCalls : 1;

    const averageLatency =
      totalCalls > 0
        ? recentToolMetrics.reduce((sum, m) => sum + m.duration, 0) / totalCalls
        : 0;

    const errorsByTool: Record<string, number> = {};
    const callsByTool: Record<string, number> = {};

    recentToolMetrics.forEach((metric) => {
      callsByTool[metric.toolName] = (callsByTool[metric.toolName] || 0) + 1;
      if (!metric.success) {
        errorsByTool[metric.toolName] =
          (errorsByTool[metric.toolName] || 0) + 1;
      }
    });

    // Calculate performance statistics
    const responseTimes = recentPerfMetrics
      .map((m) => m.duration)
      .sort((a, b) => a - b);
    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
        : 0;

    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);
    const p95ResponseTime = responseTimes[p95Index] || 0;
    const p99ResponseTime = responseTimes[p99Index] || 0;

    const requestsPerSecond = recentPerfMetrics.length / 3600; // Per hour to per second
    const errorRate = 1 - successRate;

    // System metrics
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      timestamp: now,
      period: {
        start: oneHourAgo,
        end: now,
        duration: 60 * 60 * 1000,
      },
      tools: {
        totalCalls,
        successRate,
        averageLatency,
        errorsByTool,
        callsByTool,
      },
      performance: {
        averageResponseTime,
        p95ResponseTime,
        p99ResponseTime,
        requestsPerSecond,
        errorRate,
      },
      system: {
        memoryUsage: memoryUsage.heapUsed / 1024 / 1024, // MB
        cpuUsage: 0, // Would need additional monitoring for actual CPU
        uptime,
        activeConnections: 0, // Would need server integration
      },
    };
  }

  setupAlert(condition: AlertCondition, callback: AlertCallback): string {
    const alertId = this.generateAlertId();
    const alertState: AlertState = {
      id: alertId,
      condition,
      callback,
      active: true,
    };

    this.alerts.set(alertId, alertState);

    this.logger.info("Alert configured", {
      alertId,
      condition: {
        metric: condition.metric,
        threshold: condition.threshold,
        operator: condition.operator,
      },
    });

    return alertId;
  }

  removeAlert(alertId: string): boolean {
    const success = this.alerts.delete(alertId);

    if (success) {
      this.logger.info("Alert removed", { alertId });
    }

    return success;
  }

  private performHealthCheck(): void {
    const healthStatus = this.getHealthStatus();

    this.logger.debug("Health check performed", {
      status: healthStatus.status,
      components: healthStatus.components.length,
      errors: healthStatus.overall.errors,
      warnings: healthStatus.overall.warnings,
    });

    // Emit health status for monitoring
    this.emit("healthCheck", healthStatus);

    // Check for health-based alerts
    this.checkHealthAlerts(healthStatus);
  }

  private checkComponentHealth(): ComponentHealth[] {
    const components: ComponentHealth[] = [];
    const now = Date.now();

    // Check tool operations health
    const recentToolMetrics = this.toolMetrics.filter(
      (m) => m.timestamp >= now - 5 * 60 * 1000
    ); // Last 5 minutes
    const toolErrorRate =
      recentToolMetrics.length > 0
        ? recentToolMetrics.filter((m) => !m.success).length /
          recentToolMetrics.length
        : 0;

    components.push({
      name: "tool_operations",
      status:
        toolErrorRate > 0.1
          ? "unhealthy"
          : toolErrorRate > 0.05
          ? "degraded"
          : "healthy",
      lastCheck: now,
      details: {
        recentCalls: recentToolMetrics.length,
        errorRate: toolErrorRate,
      },
      error:
        toolErrorRate > 0.1
          ? `High error rate: ${(toolErrorRate * 100).toFixed(1)}%`
          : undefined,
    });

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    const memoryLimitMB = 512; // Assumed limit

    components.push({
      name: "memory_usage",
      status:
        memoryUsedMB > memoryLimitMB * 0.9
          ? "unhealthy"
          : memoryUsedMB > memoryLimitMB * 0.7
          ? "degraded"
          : "healthy",
      lastCheck: now,
      details: {
        usedMB: memoryUsedMB,
        limitMB: memoryLimitMB,
        percentage: ((memoryUsedMB / memoryLimitMB) * 100).toFixed(1),
      },
      error:
        memoryUsedMB > memoryLimitMB * 0.9
          ? "Memory usage critical"
          : undefined,
    });

    // Check response times
    const recentPerfMetrics = this.performanceMetrics.filter(
      (m) => m.timestamp >= now - 5 * 60 * 1000
    );
    const avgResponseTime =
      recentPerfMetrics.length > 0
        ? recentPerfMetrics.reduce((sum, m) => sum + m.duration, 0) /
          recentPerfMetrics.length
        : 0;

    components.push({
      name: "response_times",
      status:
        avgResponseTime > 2000
          ? "unhealthy"
          : avgResponseTime > 1000
          ? "degraded"
          : "healthy",
      lastCheck: now,
      details: {
        averageMs: avgResponseTime,
        recentRequests: recentPerfMetrics.length,
      },
      error:
        avgResponseTime > 2000
          ? `Slow response times: ${avgResponseTime.toFixed(0)}ms`
          : undefined,
    });

    return components;
  }

  private checkToolAlerts(metric: ToolOperationMetric): void {
    this.alerts.forEach((alert) => {
      if (!alert.active) return;

      const condition = alert.condition;
      let currentValue: number;

      switch (condition.metric) {
        case "tool_error_rate":
          currentValue = this.calculateToolErrorRate(metric.toolName);
          break;
        case "tool_latency":
          currentValue = metric.duration;
          break;
        default:
          return;
      }

      if (
        this.shouldTriggerAlert(condition, currentValue, alert.lastTriggered)
      ) {
        this.triggerAlert(alert, currentValue);
      }
    });
  }

  private checkPerformanceAlerts(metric: PerformanceMetric): void {
    this.alerts.forEach((alert) => {
      if (!alert.active) return;

      const condition = alert.condition;
      let currentValue: number;

      switch (condition.metric) {
        case "response_time":
          currentValue = metric.duration;
          break;
        case "avg_response_time":
          currentValue = this.calculateAverageResponseTime();
          break;
        default:
          return;
      }

      if (
        this.shouldTriggerAlert(condition, currentValue, alert.lastTriggered)
      ) {
        this.triggerAlert(alert, currentValue);
      }
    });
  }

  private checkHealthAlerts(healthStatus: HealthStatus): void {
    this.alerts.forEach((alert) => {
      if (!alert.active) return;

      const condition = alert.condition;
      let currentValue: number;

      switch (condition.metric) {
        case "error_count":
          currentValue = healthStatus.overall.errors;
          break;
        case "warning_count":
          currentValue = healthStatus.overall.warnings;
          break;
        default:
          return;
      }

      if (
        this.shouldTriggerAlert(condition, currentValue, alert.lastTriggered)
      ) {
        this.triggerAlert(alert, currentValue);
      }
    });
  }

  private shouldTriggerAlert(
    condition: AlertCondition,
    currentValue: number,
    lastTriggered?: number
  ): boolean {
    // Check threshold condition
    let conditionMet = false;
    switch (condition.operator) {
      case "gt":
        conditionMet = currentValue > condition.threshold;
        break;
      case "gte":
        conditionMet = currentValue >= condition.threshold;
        break;
      case "lt":
        conditionMet = currentValue < condition.threshold;
        break;
      case "lte":
        conditionMet = currentValue <= condition.threshold;
        break;
      case "eq":
        conditionMet = currentValue === condition.threshold;
        break;
    }

    if (!conditionMet) return false;

    // Check cooldown period
    if (lastTriggered && condition.cooldown) {
      const now = Date.now();
      if (now - lastTriggered < condition.cooldown) {
        return false;
      }
    }

    return true;
  }

  private triggerAlert(alert: AlertState, currentValue: number): void {
    const now = Date.now();
    alert.lastTriggered = now;

    const alertEvent: AlertEvent = {
      alertId: alert.id,
      condition: alert.condition,
      currentValue,
      timestamp: now,
      message: `Alert triggered: ${alert.condition.metric} ${alert.condition.operator} ${alert.condition.threshold} (current: ${currentValue})`,
    };

    this.logger.warn("Production alert triggered", {
      alertEvent,
      metric: alert.condition.metric,
      threshold: alert.condition.threshold,
      currentValue,
    });

    // Call the alert callback
    try {
      alert.callback(alertEvent);
    } catch (error) {
      this.logger.error("Alert callback failed", {
        alertId: alert.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Emit alert event
    this.emit("alert", alertEvent);
  }

  private calculateToolErrorRate(toolName: string): number {
    const now = Date.now();
    const recentMetrics = this.toolMetrics.filter(
      (m) => m.toolName === toolName && m.timestamp >= now - 5 * 60 * 1000
    );

    if (recentMetrics.length === 0) return 0;

    const errors = recentMetrics.filter((m) => !m.success).length;
    return errors / recentMetrics.length;
  }

  private calculateAverageResponseTime(): number {
    const now = Date.now();
    const recentMetrics = this.performanceMetrics.filter(
      (m) => m.timestamp >= now - 5 * 60 * 1000
    );

    if (recentMetrics.length === 0) return 0;

    return (
      recentMetrics.reduce((sum, m) => sum + m.duration, 0) /
      recentMetrics.length
    );
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.metricsRetentionMs;

    const toolMetricsBefore = this.toolMetrics.length;
    const perfMetricsBefore = this.performanceMetrics.length;

    this.toolMetrics = this.toolMetrics.filter((m) => m.timestamp >= cutoff);
    this.performanceMetrics = this.performanceMetrics.filter(
      (m) => m.timestamp >= cutoff
    );

    const toolMetricsRemoved = toolMetricsBefore - this.toolMetrics.length;
    const perfMetricsRemoved =
      perfMetricsBefore - this.performanceMetrics.length;

    if (toolMetricsRemoved > 0 || perfMetricsRemoved > 0) {
      this.logger.debug("Old metrics cleaned up", {
        toolMetricsRemoved,
        perfMetricsRemoved,
        totalRemaining:
          this.toolMetrics.length + this.performanceMetrics.length,
      });
    }
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.removeAllListeners();
    this.alerts.clear();
  }
}

export default ProductionMonitoring;
