"use strict";
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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
exports.ProductionMonitoring = void 0;
var events_1 = require("events");
var ProductionMonitoring = /** @class */ (function (_super) {
    __extends(ProductionMonitoring, _super);
    function ProductionMonitoring(logger, config) {
        if (config === void 0) { config = {}; }
        var _this = _super.call(this) || this;
        _this.logger = logger;
        _this.startTime = Date.now();
        _this.toolMetrics = [];
        _this.performanceMetrics = [];
        _this.alerts = new Map();
        _this.metricsRetentionMs = config.metricsRetentionMs || 24 * 60 * 60 * 1000; // 24 hours
        // Start health check monitoring
        _this.healthCheckInterval = setInterval(function () { return _this.performHealthCheck(); }, config.healthCheckIntervalMs || 30000 // 30 seconds
        );
        // Cleanup old metrics every hour
        setInterval(function () { return _this.cleanupOldMetrics(); }, 60 * 60 * 1000);
        return _this;
    }
    ProductionMonitoring.prototype.recordToolOperation = function (toolName, duration, success, error) {
        var metric = {
            toolName: toolName,
            timestamp: Date.now(),
            duration: duration,
            success: success,
            error: error
        };
        this.toolMetrics.push(metric);
        // Log the operation
        this.logger.info("Tool operation recorded", {
            tool: toolName,
            duration: duration,
            success: success,
            error: error || undefined
        });
        // Check alerts
        this.checkToolAlerts(metric);
        // Emit event for real-time monitoring
        this.emit("toolOperation", metric);
    };
    ProductionMonitoring.prototype.recordPerformanceMetric = function (operation, duration) {
        var metric = {
            operation: operation,
            timestamp: Date.now(),
            duration: duration
        };
        this.performanceMetrics.push(metric);
        this.logger.info("Performance metric recorded", {
            operation: operation,
            duration: duration
        });
        // Check performance alerts
        this.checkPerformanceAlerts(metric);
        // Emit event for real-time monitoring
        this.emit("performanceMetric", metric);
    };
    ProductionMonitoring.prototype.getHealthStatus = function () {
        var now = Date.now();
        var uptime = now - this.startTime;
        var components = this.checkComponentHealth();
        var errors = components.filter(function (c) { return c.status === "unhealthy"; }).length;
        var warnings = components.filter(function (c) { return c.status === "degraded"; }).length;
        var criticalIssues = [];
        components.forEach(function (component) {
            if (component.status === "unhealthy" && component.error) {
                criticalIssues.push("".concat(component.name, ": ").concat(component.error));
            }
        });
        var overallStatus = "healthy";
        if (errors > 0) {
            overallStatus = "unhealthy";
        }
        else if (warnings > 0) {
            overallStatus = "degraded";
        }
        return {
            status: overallStatus,
            timestamp: now,
            uptime: uptime,
            components: components,
            overall: {
                errors: errors,
                warnings: warnings,
                criticalIssues: criticalIssues
            }
        };
    };
    ProductionMonitoring.prototype.getMetricsSummary = function () {
        var now = Date.now();
        var oneHourAgo = now - 60 * 60 * 1000;
        // Filter recent metrics
        var recentToolMetrics = this.toolMetrics.filter(function (m) { return m.timestamp >= oneHourAgo; });
        var recentPerfMetrics = this.performanceMetrics.filter(function (m) { return m.timestamp >= oneHourAgo; });
        // Calculate tool statistics
        var totalCalls = recentToolMetrics.length;
        var successfulCalls = recentToolMetrics.filter(function (m) { return m.success; }).length;
        var successRate = totalCalls > 0 ? successfulCalls / totalCalls : 1;
        var averageLatency = totalCalls > 0
            ? recentToolMetrics.reduce(function (sum, m) { return sum + m.duration; }, 0) / totalCalls
            : 0;
        var errorsByTool = {};
        var callsByTool = {};
        recentToolMetrics.forEach(function (metric) {
            callsByTool[metric.toolName] = (callsByTool[metric.toolName] || 0) + 1;
            if (!metric.success) {
                errorsByTool[metric.toolName] =
                    (errorsByTool[metric.toolName] || 0) + 1;
            }
        });
        // Calculate performance statistics
        var responseTimes = recentPerfMetrics
            .map(function (m) { return m.duration; })
            .sort(function (a, b) { return a - b; });
        var averageResponseTime = responseTimes.length > 0
            ? responseTimes.reduce(function (sum, t) { return sum + t; }, 0) / responseTimes.length
            : 0;
        var p95Index = Math.floor(responseTimes.length * 0.95);
        var p99Index = Math.floor(responseTimes.length * 0.99);
        var p95ResponseTime = responseTimes[p95Index] || 0;
        var p99ResponseTime = responseTimes[p99Index] || 0;
        var requestsPerSecond = recentPerfMetrics.length / 3600; // Per hour to per second
        var errorRate = 1 - successRate;
        // System metrics
        var memoryUsage = process.memoryUsage();
        var uptime = process.uptime();
        return {
            timestamp: now,
            period: {
                start: oneHourAgo,
                end: now,
                duration: 60 * 60 * 1000
            },
            tools: {
                totalCalls: totalCalls,
                successRate: successRate,
                averageLatency: averageLatency,
                errorsByTool: errorsByTool,
                callsByTool: callsByTool
            },
            performance: {
                averageResponseTime: averageResponseTime,
                p95ResponseTime: p95ResponseTime,
                p99ResponseTime: p99ResponseTime,
                requestsPerSecond: requestsPerSecond,
                errorRate: errorRate
            },
            system: {
                memoryUsage: memoryUsage.heapUsed / 1024 / 1024,
                cpuUsage: 0,
                uptime: uptime,
                activeConnections: 0
            }
        };
    };
    ProductionMonitoring.prototype.setupAlert = function (condition, callback) {
        var alertId = this.generateAlertId();
        var alertState = {
            id: alertId,
            condition: condition,
            callback: callback,
            active: true
        };
        this.alerts.set(alertId, alertState);
        this.logger.info("Alert configured", {
            alertId: alertId,
            condition: {
                metric: condition.metric,
                threshold: condition.threshold,
                operator: condition.operator
            }
        });
        return alertId;
    };
    ProductionMonitoring.prototype.removeAlert = function (alertId) {
        var success = this.alerts["delete"](alertId);
        if (success) {
            this.logger.info("Alert removed", { alertId: alertId });
        }
        return success;
    };
    ProductionMonitoring.prototype.performHealthCheck = function () {
        var healthStatus = this.getHealthStatus();
        this.logger.debug("Health check performed", {
            status: healthStatus.status,
            components: healthStatus.components.length,
            errors: healthStatus.overall.errors,
            warnings: healthStatus.overall.warnings
        });
        // Emit health status for monitoring
        this.emit("healthCheck", healthStatus);
        // Check for health-based alerts
        this.checkHealthAlerts(healthStatus);
    };
    ProductionMonitoring.prototype.checkComponentHealth = function () {
        var components = [];
        var now = Date.now();
        // Check tool operations health
        var recentToolMetrics = this.toolMetrics.filter(function (m) { return m.timestamp >= now - 5 * 60 * 1000; }); // Last 5 minutes
        var toolErrorRate = recentToolMetrics.length > 0
            ? recentToolMetrics.filter(function (m) { return !m.success; }).length /
                recentToolMetrics.length
            : 0;
        components.push({
            name: "tool_operations",
            status: toolErrorRate > 0.1
                ? "unhealthy"
                : toolErrorRate > 0.05
                    ? "degraded"
                    : "healthy",
            lastCheck: now,
            details: {
                recentCalls: recentToolMetrics.length,
                errorRate: toolErrorRate
            },
            error: toolErrorRate > 0.1
                ? "High error rate: ".concat((toolErrorRate * 100).toFixed(1), "%")
                : undefined
        });
        // Check memory usage
        var memoryUsage = process.memoryUsage();
        var memoryUsedMB = memoryUsage.heapUsed / 1024 / 1024;
        var memoryLimitMB = 512; // Assumed limit
        components.push({
            name: "memory_usage",
            status: memoryUsedMB > memoryLimitMB * 0.9
                ? "unhealthy"
                : memoryUsedMB > memoryLimitMB * 0.7
                    ? "degraded"
                    : "healthy",
            lastCheck: now,
            details: {
                usedMB: memoryUsedMB,
                limitMB: memoryLimitMB,
                percentage: ((memoryUsedMB / memoryLimitMB) * 100).toFixed(1)
            },
            error: memoryUsedMB > memoryLimitMB * 0.9
                ? "Memory usage critical"
                : undefined
        });
        // Check response times
        var recentPerfMetrics = this.performanceMetrics.filter(function (m) { return m.timestamp >= now - 5 * 60 * 1000; });
        var avgResponseTime = recentPerfMetrics.length > 0
            ? recentPerfMetrics.reduce(function (sum, m) { return sum + m.duration; }, 0) /
                recentPerfMetrics.length
            : 0;
        components.push({
            name: "response_times",
            status: avgResponseTime > 2000
                ? "unhealthy"
                : avgResponseTime > 1000
                    ? "degraded"
                    : "healthy",
            lastCheck: now,
            details: {
                averageMs: avgResponseTime,
                recentRequests: recentPerfMetrics.length
            },
            error: avgResponseTime > 2000
                ? "Slow response times: ".concat(avgResponseTime.toFixed(0), "ms")
                : undefined
        });
        return components;
    };
    ProductionMonitoring.prototype.checkToolAlerts = function (metric) {
        var _this = this;
        this.alerts.forEach(function (alert) {
            if (!alert.active)
                return;
            var condition = alert.condition;
            var currentValue;
            switch (condition.metric) {
                case "tool_error_rate":
                    currentValue = _this.calculateToolErrorRate(metric.toolName);
                    break;
                case "tool_latency":
                    currentValue = metric.duration;
                    break;
                default:
                    return;
            }
            if (_this.shouldTriggerAlert(condition, currentValue, alert.lastTriggered)) {
                _this.triggerAlert(alert, currentValue);
            }
        });
    };
    ProductionMonitoring.prototype.checkPerformanceAlerts = function (metric) {
        var _this = this;
        this.alerts.forEach(function (alert) {
            if (!alert.active)
                return;
            var condition = alert.condition;
            var currentValue;
            switch (condition.metric) {
                case "response_time":
                    currentValue = metric.duration;
                    break;
                case "avg_response_time":
                    currentValue = _this.calculateAverageResponseTime();
                    break;
                default:
                    return;
            }
            if (_this.shouldTriggerAlert(condition, currentValue, alert.lastTriggered)) {
                _this.triggerAlert(alert, currentValue);
            }
        });
    };
    ProductionMonitoring.prototype.checkHealthAlerts = function (healthStatus) {
        var _this = this;
        this.alerts.forEach(function (alert) {
            if (!alert.active)
                return;
            var condition = alert.condition;
            var currentValue;
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
            if (_this.shouldTriggerAlert(condition, currentValue, alert.lastTriggered)) {
                _this.triggerAlert(alert, currentValue);
            }
        });
    };
    ProductionMonitoring.prototype.shouldTriggerAlert = function (condition, currentValue, lastTriggered) {
        // Check threshold condition
        var conditionMet = false;
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
        if (!conditionMet)
            return false;
        // Check cooldown period
        if (lastTriggered && condition.cooldown) {
            var now = Date.now();
            if (now - lastTriggered < condition.cooldown) {
                return false;
            }
        }
        return true;
    };
    ProductionMonitoring.prototype.triggerAlert = function (alert, currentValue) {
        var now = Date.now();
        alert.lastTriggered = now;
        var alertEvent = {
            alertId: alert.id,
            condition: alert.condition,
            currentValue: currentValue,
            timestamp: now,
            message: "Alert triggered: ".concat(alert.condition.metric, " ").concat(alert.condition.operator, " ").concat(alert.condition.threshold, " (current: ").concat(currentValue, ")")
        };
        this.logger.warn("Production alert triggered", {
            alertEvent: alertEvent,
            metric: alert.condition.metric,
            threshold: alert.condition.threshold,
            currentValue: currentValue
        });
        // Call the alert callback
        try {
            alert.callback(alertEvent);
        }
        catch (error) {
            this.logger.error("Alert callback failed", {
                alertId: alert.id,
                error: error instanceof Error ? error.message : String(error)
            });
        }
        // Emit alert event
        this.emit("alert", alertEvent);
    };
    ProductionMonitoring.prototype.calculateToolErrorRate = function (toolName) {
        var now = Date.now();
        var recentMetrics = this.toolMetrics.filter(function (m) { return m.toolName === toolName && m.timestamp >= now - 5 * 60 * 1000; });
        if (recentMetrics.length === 0)
            return 0;
        var errors = recentMetrics.filter(function (m) { return !m.success; }).length;
        return errors / recentMetrics.length;
    };
    ProductionMonitoring.prototype.calculateAverageResponseTime = function () {
        var now = Date.now();
        var recentMetrics = this.performanceMetrics.filter(function (m) { return m.timestamp >= now - 5 * 60 * 1000; });
        if (recentMetrics.length === 0)
            return 0;
        return (recentMetrics.reduce(function (sum, m) { return sum + m.duration; }, 0) /
            recentMetrics.length);
    };
    ProductionMonitoring.prototype.cleanupOldMetrics = function () {
        var cutoff = Date.now() - this.metricsRetentionMs;
        var toolMetricsBefore = this.toolMetrics.length;
        var perfMetricsBefore = this.performanceMetrics.length;
        this.toolMetrics = this.toolMetrics.filter(function (m) { return m.timestamp >= cutoff; });
        this.performanceMetrics = this.performanceMetrics.filter(function (m) { return m.timestamp >= cutoff; });
        var toolMetricsRemoved = toolMetricsBefore - this.toolMetrics.length;
        var perfMetricsRemoved = perfMetricsBefore - this.performanceMetrics.length;
        if (toolMetricsRemoved > 0 || perfMetricsRemoved > 0) {
            this.logger.debug("Old metrics cleaned up", {
                toolMetricsRemoved: toolMetricsRemoved,
                perfMetricsRemoved: perfMetricsRemoved,
                totalRemaining: this.toolMetrics.length + this.performanceMetrics.length
            });
        }
    };
    ProductionMonitoring.prototype.generateAlertId = function () {
        return "alert_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9));
    };
    ProductionMonitoring.prototype.destroy = function () {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        this.removeAllListeners();
        this.alerts.clear();
    };
    return ProductionMonitoring;
}(events_1.EventEmitter));
exports.ProductionMonitoring = ProductionMonitoring;
exports["default"] = ProductionMonitoring;
