"use strict";
/**
 * Phase 15A Health Check Service
 * Advanced health check service for production monitoring
 * Based on Python implementation health patterns
 */
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
exports.registerHealthCheck = exports.getDetailedHealth = exports.getLiveness = exports.getReadiness = exports.getSimpleHealth = exports.performHealthCheck = exports.healthCheckService = exports.HealthCheckService = void 0;
var logger_1 = require("../utils/logger");
var system_monitor_1 = require("./system-monitor");
var logger = (0, logger_1.getLogger)('HealthCheck');
/**
 * Health Check Service
 * Provides standardized health check endpoints and monitoring
 */
var HealthCheckService = /** @class */ (function () {
    function HealthCheckService(config) {
        this.startTime = Date.now();
        this.config = __assign({ serviceName: 'claude-wrapper', version: '1.0.0', environment: process.env.NODE_ENV || 'development', includeSystemInfo: true, includeMetrics: false, checks: {} }, config);
        this.registerDefaultChecks();
    }
    /**
     * Register default health checks
     */
    HealthCheckService.prototype.registerDefaultChecks = function () {
        var _this = this;
        // Basic server health check
        this.registerCheck('server', function () { return __awaiter(_this, void 0, void 0, function () {
            var uptime;
            return __generator(this, function (_a) {
                uptime = process.uptime();
                return [2 /*return*/, {
                        status: uptime > 0 ? 'pass' : 'fail',
                        output: "Server uptime: ".concat(uptime, " seconds")
                    }];
            });
        }); });
        // Memory health check
        this.registerCheck('memory', function () { return __awaiter(_this, void 0, void 0, function () {
            var memoryUsage, heapUsedMB, heapTotalMB, usage, status;
            return __generator(this, function (_a) {
                memoryUsage = process.memoryUsage();
                heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
                heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
                usage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
                status = 'pass';
                if (usage > 90) {
                    status = 'fail';
                }
                else if (usage > 80) {
                    status = 'warn';
                }
                return [2 /*return*/, {
                        status: status,
                        output: "Memory usage: ".concat(heapUsedMB, "MB / ").concat(heapTotalMB, "MB (").concat(usage.toFixed(1), "%)")
                    }];
            });
        }); });
        // Event loop health check
        this.registerCheck('eventloop', function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) {
                        var start = process.hrtime.bigint();
                        setImmediate(function () {
                            var end = process.hrtime.bigint();
                            var delayMs = Number(end - start) / 1000000;
                            var status = 'pass';
                            if (delayMs > 100) {
                                status = 'fail';
                            }
                            else if (delayMs > 50) {
                                status = 'warn';
                            }
                            resolve({
                                status: status,
                                output: "Event loop delay: ".concat(delayMs.toFixed(2), "ms")
                            });
                        });
                    })];
            });
        }); });
        // Authentication check
        this.registerCheck('authentication', function () { return __awaiter(_this, void 0, void 0, function () {
            var hasAnthropicKey, hasAwsCredentials, hasGoogleCredentials, hasAuth;
            return __generator(this, function (_a) {
                hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
                hasAwsCredentials = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
                hasGoogleCredentials = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
                hasAuth = hasAnthropicKey || hasAwsCredentials || hasGoogleCredentials;
                return [2 /*return*/, {
                        status: hasAuth ? 'pass' : 'warn',
                        output: hasAuth ? 'Authentication configured' : 'No authentication configured'
                    }];
            });
        }); });
        // Environment variables check
        this.registerCheck('environment', function () { return __awaiter(_this, void 0, void 0, function () {
            var requiredEnvVars, missingVars;
            return __generator(this, function (_a) {
                requiredEnvVars = ['NODE_ENV'];
                missingVars = requiredEnvVars.filter(function (varName) { return !process.env[varName]; });
                return [2 /*return*/, {
                        status: missingVars.length === 0 ? 'pass' : 'warn',
                        output: missingVars.length === 0
                            ? 'All required environment variables present'
                            : "Missing environment variables: ".concat(missingVars.join(', '))
                    }];
            });
        }); });
    };
    /**
     * Register a custom health check
     */
    HealthCheckService.prototype.registerCheck = function (name, check) {
        this.config.checks[name] = check;
    };
    /**
     * Remove a health check
     */
    HealthCheckService.prototype.unregisterCheck = function (name) {
        delete this.config.checks[name];
    };
    /**
     * Perform all health checks
     */
    HealthCheckService.prototype.performHealthCheck = function () {
        return __awaiter(this, void 0, void 0, function () {
            var timestamp, uptime, checks, overallStatus, _i, _a, _b, name_1, checkFn, startTime, result, duration, error_1, response, metrics;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        timestamp = new Date().toISOString();
                        uptime = Date.now() - this.startTime;
                        logger.debug('Performing health check');
                        checks = {};
                        overallStatus = 'healthy';
                        _i = 0, _a = Object.entries(this.config.checks);
                        _c.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 6];
                        _b = _a[_i], name_1 = _b[0], checkFn = _b[1];
                        startTime = Date.now();
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, checkFn()];
                    case 3:
                        result = _c.sent();
                        duration = Date.now() - startTime;
                        checks[name_1] = {
                            status: result.status,
                            time: new Date().toISOString(),
                            duration: duration,
                            output: result.output
                        };
                        // Update overall status
                        if (result.status === 'fail') {
                            overallStatus = 'unhealthy';
                        }
                        else if (result.status === 'warn' && overallStatus === 'healthy') {
                            overallStatus = 'degraded';
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _c.sent();
                        checks[name_1] = {
                            status: 'fail',
                            time: new Date().toISOString(),
                            duration: Date.now() - startTime,
                            output: "Check failed: ".concat(error_1 instanceof Error ? error_1.message : 'Unknown error')
                        };
                        overallStatus = 'unhealthy';
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6:
                        response = {
                            status: overallStatus,
                            timestamp: timestamp,
                            uptime: uptime,
                            version: this.config.version,
                            service: this.config.serviceName,
                            environment: this.config.environment,
                            checks: checks
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
                        if (this.config.includeMetrics && system_monitor_1.systemMonitor.isRunning()) {
                            metrics = system_monitor_1.systemMonitor.getMetrics();
                            response.metadata = __assign(__assign({}, response.metadata), { metrics: {
                                    requests_total: metrics.requests.total,
                                    requests_rate: metrics.requests.rate,
                                    memory_usage: metrics.memory.usage,
                                    error_rate: metrics.errors.rate
                                } });
                        }
                        logger.debug('Health check completed', {
                            status: overallStatus,
                            checksCount: Object.keys(checks).length
                        });
                        return [2 /*return*/, response];
                }
            });
        });
    };
    /**
     * Get simple health status (for basic health checks)
     */
    HealthCheckService.prototype.getSimpleHealth = function () {
        return __awaiter(this, void 0, void 0, function () {
            var uptime, isHealthy;
            return __generator(this, function (_a) {
                uptime = Date.now() - this.startTime;
                isHealthy = process.uptime() > 0;
                return [2 /*return*/, {
                        status: isHealthy ? 'healthy' : 'unhealthy',
                        uptime: uptime,
                        timestamp: new Date().toISOString()
                    }];
            });
        });
    };
    /**
     * Get readiness status (for Kubernetes readiness probes)
     */
    HealthCheckService.prototype.getReadiness = function () {
        return __awaiter(this, void 0, void 0, function () {
            var healthCheck, failedChecks, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.performHealthCheck()];
                    case 1:
                        healthCheck = _a.sent();
                        failedChecks = Object.entries(healthCheck.checks)
                            .filter(function (_a) {
                            var check = _a[1];
                            return check.status === 'fail';
                        })
                            .map(function (_a) {
                            var name = _a[0];
                            return name;
                        });
                        return [2 /*return*/, {
                                ready: healthCheck.status !== 'unhealthy',
                                checks: failedChecks
                            }];
                    case 2:
                        error_2 = _a.sent();
                        return [2 /*return*/, {
                                ready: false,
                                checks: ['health_check_error']
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get liveness status (for Kubernetes liveness probes)
     */
    HealthCheckService.prototype.getLiveness = function () {
        return __awaiter(this, void 0, void 0, function () {
            var uptime;
            return __generator(this, function (_a) {
                uptime = process.uptime();
                return [2 /*return*/, {
                        alive: uptime > 0,
                        uptime: uptime
                    }];
            });
        });
    };
    /**
     * Get detailed system health (includes system monitor data)
     */
    HealthCheckService.prototype.getDetailedHealth = function () {
        return __awaiter(this, void 0, void 0, function () {
            var health, system;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.performHealthCheck()];
                    case 1:
                        health = _a.sent();
                        system = system_monitor_1.systemMonitor.isRunning() ? system_monitor_1.systemMonitor.getHealth() : null;
                        return [2 /*return*/, {
                                health: health,
                                system: system
                            }];
                }
            });
        });
    };
    /**
     * Configure health check settings
     */
    HealthCheckService.prototype.configure = function (config) {
        this.config = __assign(__assign({}, this.config), config);
    };
    /**
     * Get current configuration
     */
    HealthCheckService.prototype.getConfiguration = function () {
        return __assign({}, this.config);
    };
    return HealthCheckService;
}());
exports.HealthCheckService = HealthCheckService;
// Global health check service instance
exports.healthCheckService = new HealthCheckService();
// Export utility functions
var performHealthCheck = function () {
    return exports.healthCheckService.performHealthCheck();
};
exports.performHealthCheck = performHealthCheck;
var getSimpleHealth = function () {
    return exports.healthCheckService.getSimpleHealth();
};
exports.getSimpleHealth = getSimpleHealth;
var getReadiness = function () {
    return exports.healthCheckService.getReadiness();
};
exports.getReadiness = getReadiness;
var getLiveness = function () {
    return exports.healthCheckService.getLiveness();
};
exports.getLiveness = getLiveness;
var getDetailedHealth = function () {
    return exports.healthCheckService.getDetailedHealth();
};
exports.getDetailedHealth = getDetailedHealth;
var registerHealthCheck = function (name, check) {
    exports.healthCheckService.registerCheck(name, check);
};
exports.registerHealthCheck = registerHealthCheck;
