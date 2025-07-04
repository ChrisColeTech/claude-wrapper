"use strict";
/**
 * Production Reliability Features
 * Single Responsibility: Reliability mechanisms for tool operations
 *
 * Based on Phase 15A requirements:
 * - Circuit breakers for tool operations
 * - Timeout handling and recovery
 * - Graceful failure handling
 * - Recovery mechanisms
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
exports.ProductionReliability = void 0;
var events_1 = require("events");
var CircuitBreaker = /** @class */ (function () {
    function CircuitBreaker(operation, options, logger) {
        this.operation = operation;
        this.options = options;
        this.logger = logger;
        this.state = 'closed';
        this.failureCount = 0;
        this.successCount = 0;
        this.callHistory = [];
    }
    CircuitBreaker.prototype.execute = function (execution) {
        return __awaiter(this, void 0, void 0, function () {
            var error, startTime, result, duration, error_1, duration;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.isExecutionAllowed()) {
                            error = new Error("Circuit breaker is ".concat(this.state, " for operation: ").concat(this.operation));
                            this.logger.warn('Circuit breaker rejected execution', {
                                operation: this.operation,
                                state: this.state,
                                nextAttempt: this.nextAttemptTime
                            });
                            throw error;
                        }
                        startTime = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, execution()];
                    case 2:
                        result = _a.sent();
                        duration = Date.now() - startTime;
                        this.onSuccess(duration);
                        return [2 /*return*/, result];
                    case 3:
                        error_1 = _a.sent();
                        duration = Date.now() - startTime;
                        this.onFailure(duration);
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    CircuitBreaker.prototype.isExecutionAllowed = function () {
        var now = Date.now();
        switch (this.state) {
            case 'closed':
                return true;
            case 'open':
                if (this.nextAttemptTime && now >= this.nextAttemptTime) {
                    this.setState('half-open');
                    return true;
                }
                return false;
            case 'half-open':
                return true;
            default:
                return false;
        }
    };
    CircuitBreaker.prototype.onSuccess = function (duration) {
        this.recordCall(true, duration);
        this.successCount++;
        if (this.state === 'half-open') {
            this.setState('closed');
            this.reset();
        }
    };
    CircuitBreaker.prototype.onFailure = function (duration) {
        this.recordCall(false, duration);
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.shouldOpenCircuit()) {
            this.setState('open');
            this.nextAttemptTime = Date.now() + this.options.resetTimeoutMs;
        }
    };
    CircuitBreaker.prototype.shouldOpenCircuit = function () {
        var now = Date.now();
        var windowStart = now - this.options.monitoringWindowMs;
        // Get calls within the monitoring window
        var recentCalls = this.callHistory.filter(function (call) { return call.timestamp >= windowStart; });
        if (recentCalls.length < this.options.minimumCalls) {
            return false;
        }
        var failures = recentCalls.filter(function (call) { return !call.success; }).length;
        var failureRate = failures / recentCalls.length;
        return failureRate >= this.options.failureThreshold;
    };
    CircuitBreaker.prototype.recordCall = function (success, duration) {
        var now = Date.now();
        this.callHistory.push({
            timestamp: now,
            success: success,
            duration: duration
        });
        // Keep only recent calls within monitoring window
        var windowStart = now - this.options.monitoringWindowMs;
        this.callHistory = this.callHistory.filter(function (call) { return call.timestamp >= windowStart; });
    };
    CircuitBreaker.prototype.setState = function (newState) {
        var oldState = this.state;
        this.state = newState;
        this.logger.info('Circuit breaker state changed', {
            operation: this.operation,
            oldState: oldState,
            newState: newState,
            failureCount: this.failureCount,
            successCount: this.successCount
        });
    };
    CircuitBreaker.prototype.reset = function () {
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = undefined;
        this.nextAttemptTime = undefined;
    };
    CircuitBreaker.prototype.getState = function () {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime,
            nextAttemptTime: this.nextAttemptTime,
            isExecutionAllowed: this.isExecutionAllowed()
        };
    };
    CircuitBreaker.prototype.forceReset = function () {
        this.setState('closed');
        this.reset();
    };
    CircuitBreaker.prototype.getStats = function () {
        var _this = this;
        var recentCalls = this.callHistory.filter(function (call) { return call.timestamp >= Date.now() - _this.options.monitoringWindowMs; });
        var totalCalls = recentCalls.length;
        var successfulCalls = recentCalls.filter(function (call) { return call.success; }).length;
        var failedCalls = totalCalls - successfulCalls;
        var rejectedCalls = 0; // Would need to track separately
        var averageResponseTime = totalCalls > 0
            ? recentCalls.reduce(function (sum, call) { return sum + call.duration; }, 0) / totalCalls
            : 0;
        return {
            operation: this.operation,
            state: this.getState(),
            totalCalls: totalCalls,
            successfulCalls: successfulCalls,
            failedCalls: failedCalls,
            rejectedCalls: rejectedCalls,
            averageResponseTime: averageResponseTime,
            lastStateChange: this.lastFailureTime || Date.now()
        };
    };
    return CircuitBreaker;
}());
var ProductionReliability = /** @class */ (function (_super) {
    __extends(ProductionReliability, _super);
    function ProductionReliability(logger, config) {
        if (config === void 0) { config = {}; }
        var _this = _super.call(this) || this;
        _this.logger = logger;
        _this.circuitBreakers = new Map();
        _this.defaultCircuitBreakerOptions = __assign({ failureThreshold: 0.5, resetTimeoutMs: 60000, monitoringWindowMs: 120000, minimumCalls: 5 }, config.circuitBreaker);
        _this.defaultRetryOptions = __assign({ maxAttempts: 3, backoffMs: 1000, maxBackoffMs: 30000, backoffMultiplier: 2, retryCondition: function (error) {
                // Retry on network errors, timeouts, and 5xx server errors
                return error.code === 'ECONNRESET' ||
                    error.code === 'ETIMEDOUT' ||
                    error.code === 'ENOTFOUND' ||
                    (error.response && error.response.status >= 500);
            } }, config.retry);
        return _this;
    }
    ProductionReliability.prototype.executeWithCircuitBreaker = function (operation, execution, options) {
        return __awaiter(this, void 0, void 0, function () {
            var circuitBreaker, result, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        circuitBreaker = this.getOrCreateCircuitBreaker(operation, options);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, circuitBreaker.execute(execution)];
                    case 2:
                        result = _a.sent();
                        this.emit('circuitBreakerSuccess', {
                            operation: operation,
                            state: circuitBreaker.getState()
                        });
                        return [2 /*return*/, result];
                    case 3:
                        error_2 = _a.sent();
                        this.emit('circuitBreakerFailure', {
                            operation: operation,
                            error: error_2,
                            state: circuitBreaker.getState()
                        });
                        throw error_2;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    ProductionReliability.prototype.executeWithTimeout = function (execution, timeoutMs) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var timeoutId = setTimeout(function () {
                            var timeoutError = new Error("Operation timed out after ".concat(timeoutMs, "ms"));
                            timeoutError.code = 'ETIMEDOUT';
                            reject(timeoutError);
                        }, timeoutMs);
                        execution()
                            .then(function (result) {
                            clearTimeout(timeoutId);
                            resolve(result);
                        })["catch"](function (error) {
                            clearTimeout(timeoutId);
                            reject(error);
                        });
                    })];
            });
        });
    };
    ProductionReliability.prototype.executeWithRetry = function (execution, options) {
        return __awaiter(this, void 0, void 0, function () {
            var retryOptions, lastError, attempt, result, error_3, backoffDelay;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        retryOptions = __assign(__assign({}, this.defaultRetryOptions), options);
                        attempt = 1;
                        _a.label = 1;
                    case 1:
                        if (!(attempt <= retryOptions.maxAttempts)) return [3 /*break*/, 7];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 6]);
                        return [4 /*yield*/, execution()];
                    case 3:
                        result = _a.sent();
                        if (attempt > 1) {
                            this.logger.info('Operation succeeded after retry', {
                                attempt: attempt,
                                totalAttempts: retryOptions.maxAttempts
                            });
                        }
                        return [2 /*return*/, result];
                    case 4:
                        error_3 = _a.sent();
                        lastError = error_3;
                        this.logger.warn('Operation attempt failed', {
                            attempt: attempt,
                            totalAttempts: retryOptions.maxAttempts,
                            error: error_3 instanceof Error ? error_3.message : String(error_3)
                        });
                        // Check if we should retry
                        if (attempt === retryOptions.maxAttempts || !retryOptions.retryCondition(error_3)) {
                            return [3 /*break*/, 7];
                        }
                        backoffDelay = Math.min(retryOptions.backoffMs * Math.pow(retryOptions.backoffMultiplier, attempt - 1), retryOptions.maxBackoffMs);
                        return [4 /*yield*/, this.sleep(backoffDelay)];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 6:
                        attempt++;
                        return [3 /*break*/, 1];
                    case 7:
                        this.logger.error('Operation failed after all retry attempts', {
                            totalAttempts: retryOptions.maxAttempts,
                            finalError: lastError instanceof Error ? lastError.message : String(lastError)
                        });
                        throw lastError;
                }
            });
        });
    };
    ProductionReliability.prototype.getCircuitBreakerStatus = function (operation) {
        var circuitBreaker = this.circuitBreakers.get(operation);
        if (!circuitBreaker) {
            // Return default state for non-existent circuit breakers
            return {
                state: 'closed',
                failureCount: 0,
                successCount: 0,
                isExecutionAllowed: true
            };
        }
        return circuitBreaker.getState();
    };
    ProductionReliability.prototype.resetCircuitBreaker = function (operation) {
        var circuitBreaker = this.circuitBreakers.get(operation);
        if (!circuitBreaker) {
            return false;
        }
        circuitBreaker.forceReset();
        this.logger.info('Circuit breaker manually reset', { operation: operation });
        this.emit('circuitBreakerReset', { operation: operation });
        return true;
    };
    ProductionReliability.prototype.getAllCircuitBreakerStats = function () {
        var stats = [];
        for (var _i = 0, _a = this.circuitBreakers.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], _operation = _b[0], circuitBreaker = _b[1];
            stats.push(circuitBreaker.getStats());
        }
        return stats;
    };
    ProductionReliability.prototype.executeWithFullReliability = function (operation, execution, options) {
        if (options === void 0) { options = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var startTime, attempts, result, duration, error_4, duration;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        attempts = 0;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.executeWithCircuitBreaker(operation, function () { return __awaiter(_this, void 0, void 0, function () {
                                var _this = this;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.executeWithRetry(function () { return __awaiter(_this, void 0, void 0, function () {
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0:
                                                            attempts++;
                                                            if (!options.timeoutMs) return [3 /*break*/, 2];
                                                            return [4 /*yield*/, this.executeWithTimeout(execution, options.timeoutMs)];
                                                        case 1: return [2 /*return*/, _a.sent()];
                                                        case 2: return [4 /*yield*/, execution()];
                                                        case 3: return [2 /*return*/, _a.sent()];
                                                    }
                                                });
                                            }); }, options.retry)];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                });
                            }); }, options.circuitBreaker)];
                    case 2:
                        result = _a.sent();
                        duration = Date.now() - startTime;
                        return [2 /*return*/, {
                                success: true,
                                result: result,
                                duration: duration,
                                attempts: attempts
                            }];
                    case 3:
                        error_4 = _a.sent();
                        duration = Date.now() - startTime;
                        return [2 /*return*/, {
                                success: false,
                                error: error_4 instanceof Error ? error_4 : new Error(String(error_4)),
                                duration: duration,
                                attempts: attempts
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    ProductionReliability.prototype.getOrCreateCircuitBreaker = function (operation, options) {
        var circuitBreaker = this.circuitBreakers.get(operation);
        if (!circuitBreaker) {
            var mergedOptions = __assign(__assign({}, this.defaultCircuitBreakerOptions), options);
            circuitBreaker = new CircuitBreaker(operation, mergedOptions, this.logger);
            this.circuitBreakers.set(operation, circuitBreaker);
            this.logger.debug('Created new circuit breaker', {
                operation: operation,
                options: mergedOptions
            });
        }
        return circuitBreaker;
    };
    ProductionReliability.prototype.sleep = function (ms) {
        return new Promise(function (resolve) { return setTimeout(resolve, ms); });
    };
    ProductionReliability.prototype.destroy = function () {
        this.circuitBreakers.clear();
        this.removeAllListeners();
    };
    return ProductionReliability;
}(events_1.EventEmitter));
exports.ProductionReliability = ProductionReliability;
exports["default"] = ProductionReliability;
