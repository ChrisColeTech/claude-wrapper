"use strict";
/**
 * Health endpoint implementation
 * Based on Python main.py:680-683 health_check endpoint
 * Implements Phase 11A health check requirements
 */
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
exports.HealthRouter = void 0;
var express_1 = require("express");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('HealthRouter');
/**
 * Health router class implementing health check endpoints
 * Based on Python health_check endpoint
 */
var HealthRouter = /** @class */ (function () {
    function HealthRouter() {
    }
    /**
     * Create Express router with health endpoints
     */
    HealthRouter.createRouter = function () {
        var router = (0, express_1.Router)();
        // GET /health - Basic health check
        router.get('/health', this.basicHealthCheck.bind(this));
        // GET /health/detailed - Detailed health check
        router.get('/health/detailed', this.detailedHealthCheck.bind(this));
        return router;
    };
    /**
     * Basic health check endpoint
     * Based on Python main.py:680-683 health_check function
     */
    HealthRouter.basicHealthCheck = function (_req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                try {
                    logger.debug('Basic health check requested');
                    response = {
                        status: 'healthy',
                        service: 'claude-code-openai-wrapper'
                    };
                    logger.debug('Health check: healthy');
                    res.json(response);
                }
                catch (error) {
                    logger.error('Error in basic health check:', error);
                    res.status(503).json({
                        status: 'unhealthy',
                        service: 'claude-code-openai-wrapper',
                        error: 'Health check failed'
                    });
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Detailed health check endpoint with system information
     * Enhanced version providing more diagnostic information
     */
    HealthRouter.detailedHealthCheck = function (_req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var memoryUsage, uptime, response;
            return __generator(this, function (_a) {
                try {
                    logger.debug('Detailed health check requested');
                    memoryUsage = process.memoryUsage();
                    uptime = Date.now() - this.startTime;
                    response = {
                        status: 'healthy',
                        service: 'claude-code-openai-wrapper',
                        version: '1.0.0',
                        timestamp: new Date().toISOString(),
                        uptime: uptime,
                        details: {
                            server: 'running',
                            authentication: this.checkAuthenticationStatus(),
                            memory_usage: {
                                used: memoryUsage.heapUsed,
                                total: memoryUsage.heapTotal,
                                percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
                            }
                        }
                    };
                    logger.debug('Detailed health check: healthy', {
                        uptime: uptime,
                        memoryUsage: response.details.memory_usage
                    });
                    res.json(response);
                }
                catch (error) {
                    logger.error('Error in detailed health check:', error);
                    res.status(503).json({
                        status: 'unhealthy',
                        service: 'claude-code-openai-wrapper',
                        error: 'Detailed health check failed'
                    });
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Check authentication configuration status
     * Returns 'configured' if auth is available, 'not_configured' otherwise
     */
    HealthRouter.checkAuthenticationStatus = function () {
        // Check for common authentication environment variables
        var hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
        var hasClaudeConfig = !!process.env.CLAUDE_CONFIG_DIR;
        var hasAwsConfig = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
        var hasGcpConfig = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
        return (hasAnthropicKey || hasClaudeConfig || hasAwsConfig || hasGcpConfig)
            ? 'configured'
            : 'not_configured';
    };
    /**
     * Set server start time (called during initialization)
     */
    HealthRouter.setStartTime = function (startTime) {
        this.startTime = startTime;
    };
    /**
     * Get current server uptime in milliseconds
     */
    HealthRouter.getUptime = function () {
        return Date.now() - this.startTime;
    };
    /**
     * Check if server is healthy
     * Can be used internally for health status checks
     */
    HealthRouter.isHealthy = function () {
        try {
            // Basic health checks
            var memoryUsage = process.memoryUsage();
            var memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
            // Consider unhealthy if memory usage is above 90%
            if (memoryPercentage > 90) {
                logger.warn("High memory usage: ".concat(memoryPercentage.toFixed(1), "%"));
                return false;
            }
            return true;
        }
        catch (error) {
            logger.error('Error checking health status:', error);
            return false;
        }
    };
    HealthRouter.startTime = Date.now();
    return HealthRouter;
}());
exports.HealthRouter = HealthRouter;
exports["default"] = HealthRouter;
