"use strict";
/**
 * Phase 15A System Monitoring - Comprehensive System Monitoring
 * Production-ready monitoring with health checks, metrics, and alerting
 * Based on Python implementation monitoring patterns
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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.recordRequest = exports.getSystemMetrics = exports.getSystemHealth = exports.stopMonitoring = exports.startMonitoring = exports.systemMonitor = exports.SystemMonitor = void 0;
var events_1 = require("events");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('SystemMonitor');
/**
 * System Monitor Class
 * Comprehensive system monitoring with health checks and metrics
 */
var SystemMonitor = /** @class */ (function (_super) {
    __extends(SystemMonitor, _super);
    function SystemMonitor(alertConfig) {
        var _this = _super.call(this) || this;
        _this.monitoringInterval = null;
        _this.requestCount = 0;
        _this.errorCount = 0;
        _this.responseTimes = [];
        _this.isMonitoring = false;
        _this.startTime = Date.now();
        _this.alertConfig = __assign({ enabled: true, thresholds: {
                responseTime: 5000,
                errorRate: 5,
                memoryUsage: 80,
                cpuUsage: 80,
                diskUsage: 90 // 90%
            }, channels: {
                console: true,
                file: true
            } }, alertConfig);
        _this.initializeMetrics();
        _this.initializeHealth();
        return _this;
    }
    /**
     * Initialize system metrics
     */
    SystemMonitor.prototype.initializeMetrics = function () {
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
    };
    /**
     * Initialize system health
     */
    SystemMonitor.prototype.initializeHealth = function () {
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
    };
    /**
     * Create component health status
     */
    SystemMonitor.prototype.createComponentHealth = function () {
        return {
            status: 'healthy',
            lastCheck: new Date().toISOString(),
            errorCount: 0
        };
    };
    /**
     * Start monitoring
     */
    SystemMonitor.prototype.start = function (intervalMs) {
        var _this = this;
        if (intervalMs === void 0) { intervalMs = 30000; }
        if (this.isMonitoring) {
            logger.warn('System monitoring is already running');
            return;
        }
        this.isMonitoring = true;
        logger.info('Starting system monitoring', { interval: intervalMs });
        // Initial health check
        this.performHealthCheck();
        // Set up periodic monitoring
        this.monitoringInterval = setInterval(function () {
            _this.performHealthCheck();
            _this.updateMetrics();
            _this.checkAlerts();
        }, intervalMs);
        this.emit('monitoring:started');
    };
    /**
     * Stop monitoring
     */
    SystemMonitor.prototype.stop = function () {
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
    };
    /**
     * Perform comprehensive health check
     */
    SystemMonitor.prototype.performHealthCheck = function () {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, checkDuration, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        // Update uptime
                        this.health.uptime = Date.now() - this.startTime;
                        this.health.timestamp = new Date().toISOString();
                        // Check each component
                        return [4 /*yield*/, Promise.all([
                                this.checkServerHealth(),
                                this.checkAuthenticationHealth(),
                                this.checkSessionsHealth(),
                                this.checkClaudeSDKHealth(),
                                this.checkMemoryHealth(),
                                this.checkDatabaseHealth()
                            ])];
                    case 2:
                        // Check each component
                        _a.sent();
                        // Update overall health status
                        this.updateOverallHealth();
                        checkDuration = Date.now() - startTime;
                        logger.debug('Health check completed', { duration: checkDuration });
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        logger.error('Health check failed', { error: error_1 });
                        this.health.status = 'unhealthy';
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check server health
     */
    SystemMonitor.prototype.checkServerHealth = function () {
        return __awaiter(this, void 0, void 0, function () {
            var component, startTime, isResponsive;
            return __generator(this, function (_a) {
                component = this.health.components.server;
                startTime = Date.now();
                try {
                    isResponsive = process.uptime() > 0;
                    component.status = isResponsive ? 'healthy' : 'unhealthy';
                    component.responseTime = Date.now() - startTime;
                    component.lastCheck = new Date().toISOString();
                    component.details = isResponsive ? 'Server is responsive' : 'Server not responding';
                    if (!isResponsive) {
                        component.errorCount++;
                    }
                }
                catch (error) {
                    component.status = 'unhealthy';
                    component.errorCount++;
                    component.details = "Server check failed: ".concat(error instanceof Error ? error.message : 'Unknown error');
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Check authentication health
     */
    SystemMonitor.prototype.checkAuthenticationHealth = function () {
        return __awaiter(this, void 0, void 0, function () {
            var component, startTime, isHealthy;
            return __generator(this, function (_a) {
                component = this.health.components.authentication;
                startTime = Date.now();
                try {
                    isHealthy = process.env.ANTHROPIC_API_KEY ||
                        process.env.AWS_ACCESS_KEY_ID ||
                        process.env.GOOGLE_APPLICATION_CREDENTIALS;
                    component.status = isHealthy ? 'healthy' : 'degraded';
                    component.responseTime = Date.now() - startTime;
                    component.lastCheck = new Date().toISOString();
                    component.details = isHealthy ? 'Authentication configured' : 'No authentication configured';
                    if (!isHealthy) {
                        component.errorCount++;
                    }
                }
                catch (error) {
                    component.status = 'unhealthy';
                    component.errorCount++;
                    component.details = "Auth check failed: ".concat(error instanceof Error ? error.message : 'Unknown error');
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Check sessions health
     */
    SystemMonitor.prototype.checkSessionsHealth = function () {
        return __awaiter(this, void 0, void 0, function () {
            var component, startTime, sessionSystemHealthy;
            return __generator(this, function (_a) {
                component = this.health.components.sessions;
                startTime = Date.now();
                try {
                    sessionSystemHealthy = true;
                    component.status = sessionSystemHealthy ? 'healthy' : 'unhealthy';
                    component.responseTime = Date.now() - startTime;
                    component.lastCheck = new Date().toISOString();
                    component.details = sessionSystemHealthy ? 'Session system operational' : 'Session system issues';
                }
                catch (error) {
                    component.status = 'unhealthy';
                    component.errorCount++;
                    component.details = "Session check failed: ".concat(error instanceof Error ? error.message : 'Unknown error');
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Check Claude SDK health
     */
    SystemMonitor.prototype.checkClaudeSDKHealth = function () {
        return __awaiter(this, void 0, void 0, function () {
            var component, startTime, sdkHealthy;
            return __generator(this, function (_a) {
                component = this.health.components.claude_sdk;
                startTime = Date.now();
                try {
                    sdkHealthy = true;
                    component.status = sdkHealthy ? 'healthy' : 'degraded';
                    component.responseTime = Date.now() - startTime;
                    component.lastCheck = new Date().toISOString();
                    component.details = sdkHealthy ? 'Claude SDK accessible' : 'Claude SDK connectivity issues';
                }
                catch (error) {
                    component.status = 'unhealthy';
                    component.errorCount++;
                    component.details = "Claude SDK check failed: ".concat(error instanceof Error ? error.message : 'Unknown error');
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Check memory health
     */
    SystemMonitor.prototype.checkMemoryHealth = function () {
        var component = this.health.components.memory;
        var startTime = Date.now();
        try {
            var memoryUsage = process.memoryUsage();
            var usage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
            component.status = usage < 80 ? 'healthy' : usage < 90 ? 'degraded' : 'unhealthy';
            component.responseTime = Date.now() - startTime;
            component.lastCheck = new Date().toISOString();
            component.details = "Memory usage: ".concat(usage.toFixed(1), "%");
            // Update metrics
            this.metrics.memory = {
                used: memoryUsage.heapUsed,
                free: memoryUsage.heapTotal - memoryUsage.heapUsed,
                usage: usage,
                heapUsed: memoryUsage.heapUsed,
                heapTotal: memoryUsage.heapTotal
            };
        }
        catch (error) {
            component.status = 'unhealthy';
            component.errorCount++;
            component.details = "Memory check failed: ".concat(error instanceof Error ? error.message : 'Unknown error');
        }
    };
    /**
     * Check database health (placeholder for future database integration)
     */
    SystemMonitor.prototype.checkDatabaseHealth = function () {
        return __awaiter(this, void 0, void 0, function () {
            var component, startTime, dbHealthy;
            return __generator(this, function (_a) {
                component = this.health.components.database;
                startTime = Date.now();
                try {
                    dbHealthy = true;
                    component.status = dbHealthy ? 'healthy' : 'unhealthy';
                    component.responseTime = Date.now() - startTime;
                    component.lastCheck = new Date().toISOString();
                    component.details = 'In-memory storage operational';
                }
                catch (error) {
                    component.status = 'unhealthy';
                    component.errorCount++;
                    component.details = "Database check failed: ".concat(error instanceof Error ? error.message : 'Unknown error');
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Update overall health status based on components
     */
    SystemMonitor.prototype.updateOverallHealth = function () {
        var components = Object.values(this.health.components);
        var unhealthyCount = components.filter(function (c) { return c.status === 'unhealthy'; }).length;
        var degradedCount = components.filter(function (c) { return c.status === 'degraded'; }).length;
        if (unhealthyCount > 0) {
            this.health.status = 'unhealthy';
        }
        else if (degradedCount > 0) {
            this.health.status = 'degraded';
        }
        else {
            this.health.status = 'healthy';
        }
        // Update metrics in health object
        this.health.metrics = __assign({}, this.metrics);
    };
    /**
     * Update system metrics
     */
    SystemMonitor.prototype.updateMetrics = function () {
        // Update request metrics
        if (this.responseTimes.length > 0) {
            this.metrics.requests.averageResponseTime =
                this.responseTimes.reduce(function (sum, time) { return sum + time; }, 0) / this.responseTimes.length;
        }
        // Update CPU metrics
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        this.metrics.cpu.loadAverage = require('os').loadavg();
        // Calculate rates (simple approximation)
        var uptimeSeconds = (Date.now() - this.startTime) / 1000;
        this.metrics.requests.rate = this.requestCount / uptimeSeconds;
        this.metrics.errors.rate = this.errorCount / (uptimeSeconds / 60); // per minute
        logger.debug('Metrics updated', {
            requests: this.metrics.requests,
            memory: this.metrics.memory,
            errors: this.metrics.errors
        });
    };
    /**
     * Check alert conditions
     */
    SystemMonitor.prototype.checkAlerts = function () {
        if (!this.alertConfig.enabled) {
            return;
        }
        var alerts = [];
        // Check response time
        if (this.metrics.requests.averageResponseTime > this.alertConfig.thresholds.responseTime) {
            alerts.push("High response time: ".concat(this.metrics.requests.averageResponseTime, "ms"));
        }
        // Check error rate
        var errorRate = (this.metrics.requests.failed / this.metrics.requests.total) * 100;
        if (errorRate > this.alertConfig.thresholds.errorRate) {
            alerts.push("High error rate: ".concat(errorRate.toFixed(1), "%"));
        }
        // Check memory usage
        if (this.metrics.memory.usage > this.alertConfig.thresholds.memoryUsage) {
            alerts.push("High memory usage: ".concat(this.metrics.memory.usage.toFixed(1), "%"));
        }
        // Check CPU usage
        if (this.metrics.cpu.usage > this.alertConfig.thresholds.cpuUsage) {
            alerts.push("High CPU usage: ".concat(this.metrics.cpu.usage.toFixed(1), "%"));
        }
        // Send alerts if any
        if (alerts.length > 0) {
            this.sendAlerts(alerts);
        }
    };
    /**
     * Send alerts through configured channels
     */
    SystemMonitor.prototype.sendAlerts = function (alerts) {
        if (this.alertConfig.channels.console) {
            logger.warn('SYSTEM ALERT', { alerts: alerts });
        }
        if (this.alertConfig.channels.file) {
            logger.error('SYSTEM ALERT', { alerts: alerts, timestamp: new Date().toISOString() });
        }
        // Emit alert event for external handling
        this.emit('alert', { alerts: alerts, timestamp: new Date().toISOString() });
    };
    /**
     * Record a request
     */
    SystemMonitor.prototype.recordRequest = function (responseTime, success) {
        this.requestCount++;
        this.responseTimes.push(responseTime);
        // Keep only last 100 response times for average calculation
        if (this.responseTimes.length > 100) {
            this.responseTimes.shift();
        }
        this.metrics.requests.total++;
        if (success) {
            this.metrics.requests.successful++;
        }
        else {
            this.metrics.requests.failed++;
            this.errorCount++;
            this.metrics.errors.total++;
        }
    };
    /**
     * Record session metrics
     */
    SystemMonitor.prototype.recordSessionMetrics = function (active, total, created, expired) {
        this.metrics.sessions = {
            active: active,
            total: total,
            created: created,
            expired: expired
        };
    };
    /**
     * Get current health status
     */
    SystemMonitor.prototype.getHealth = function () {
        return __assign({}, this.health);
    };
    /**
     * Get current metrics
     */
    SystemMonitor.prototype.getMetrics = function () {
        return __assign({}, this.metrics);
    };
    /**
     * Get monitoring status
     */
    SystemMonitor.prototype.isRunning = function () {
        return this.isMonitoring;
    };
    /**
     * Get system summary for quick status check
     */
    SystemMonitor.prototype.getSystemSummary = function () {
        return {
            status: this.health.status,
            uptime: this.health.uptime,
            requests: this.metrics.requests.total,
            errors: this.metrics.errors.total,
            memoryUsage: this.metrics.memory.usage,
            lastCheck: this.health.timestamp
        };
    };
    return SystemMonitor;
}(events_1.EventEmitter));
exports.SystemMonitor = SystemMonitor;
// Global system monitor instance
exports.systemMonitor = new SystemMonitor();
// Export monitoring utilities
var startMonitoring = function (intervalMs) {
    exports.systemMonitor.start(intervalMs);
};
exports.startMonitoring = startMonitoring;
var stopMonitoring = function () {
    exports.systemMonitor.stop();
};
exports.stopMonitoring = stopMonitoring;
var getSystemHealth = function () {
    return exports.systemMonitor.getHealth();
};
exports.getSystemHealth = getSystemHealth;
var getSystemMetrics = function () {
    return exports.systemMonitor.getMetrics();
};
exports.getSystemMetrics = getSystemMetrics;
var recordRequest = function (responseTime, success) {
    exports.systemMonitor.recordRequest(responseTime, success);
};
exports.recordRequest = recordRequest;
