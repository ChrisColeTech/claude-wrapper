"use strict";
/**
 * Tool call ID management service
 * Single Responsibility: ID management coordination only
 *
 * Coordinates ID generation, tracking, and validation for tool calls
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
exports.toolCallIDManager = exports.ToolCallIDManager = exports.IDManagementUtils = exports.IDManagementError = void 0;
var id_generator_1 = require("./id-generator");
var id_tracker_1 = require("./id-tracker");
var constants_1 = require("./constants");
/**
 * ID management error class
 */
var IDManagementError = /** @class */ (function (_super) {
    __extends(IDManagementError, _super);
    function IDManagementError(message, code, id, sessionId, details) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.id = id;
        _this.sessionId = sessionId;
        _this.details = details;
        _this.name = 'IDManagementError';
        return _this;
    }
    return IDManagementError;
}(Error));
exports.IDManagementError = IDManagementError;
/**
 * ID management utilities
 */
var IDManagementUtils = /** @class */ (function () {
    function IDManagementUtils() {
    }
    /**
     * Validate operation within timeout
     */
    IDManagementUtils.validateWithTimeout = function (operation, timeoutMs) {
        if (timeoutMs === void 0) { timeoutMs = constants_1.ID_MANAGEMENT_LIMITS.MANAGEMENT_TIMEOUT_MS; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var hasResolved = false;
                        var timeout = setTimeout(function () {
                            if (!hasResolved) {
                                hasResolved = true;
                                reject(new IDManagementError(constants_1.ID_MANAGEMENT_MESSAGES.MANAGEMENT_TIMEOUT, constants_1.ID_MANAGEMENT_ERRORS.TIMEOUT));
                            }
                        }, timeoutMs);
                        try {
                            setImmediate(function () {
                                try {
                                    var result = operation();
                                    if (!hasResolved) {
                                        hasResolved = true;
                                        clearTimeout(timeout);
                                        resolve(result);
                                    }
                                }
                                catch (error) {
                                    if (!hasResolved) {
                                        hasResolved = true;
                                        clearTimeout(timeout);
                                        reject(error);
                                    }
                                }
                            });
                        }
                        catch (error) {
                            if (!hasResolved) {
                                hasResolved = true;
                                clearTimeout(timeout);
                                reject(error);
                            }
                        }
                    })];
            });
        });
    };
    /**
     * Create management result
     */
    IDManagementUtils.createResult = function (success, id, sessionId, errors, startTime) {
        if (errors === void 0) { errors = []; }
        return {
            success: success,
            id: id,
            sessionId: sessionId,
            errors: errors,
            managementTimeMs: startTime ? performance.now() - startTime : undefined
        };
    };
    return IDManagementUtils;
}());
exports.IDManagementUtils = IDManagementUtils;
/**
 * Tool call ID manager implementation
 */
var ToolCallIDManager = /** @class */ (function () {
    function ToolCallIDManager(generator, tracker) {
        this.stats = {
            totalIdsGenerated: 0,
            totalIdsTracked: 0,
            successfulOperations: 0,
            failedOperations: 0,
            totalOperationTime: 0
        };
        this.generator = generator || new id_generator_1.ToolCallIdGenerator();
        this.tracker = tracker || new id_tracker_1.ToolCallIDTracker();
    }
    /**
     * Generate a unique tool call ID
     */
    ToolCallIDManager.prototype.generateId = function () {
        var startTime = performance.now();
        try {
            var id = this.generator.generateId();
            this.stats.totalIdsGenerated++;
            this.updateStats(true, performance.now() - startTime);
            return id;
        }
        catch (error) {
            this.updateStats(false, performance.now() - startTime);
            throw new IDManagementError(error instanceof Error ? error.message : constants_1.ID_MANAGEMENT_MESSAGES.ID_TRACKING_FAILED, constants_1.ID_MANAGEMENT_ERRORS.TRACKING_FAILED);
        }
    };
    /**
     * Track a tool call ID for conversation continuity
     */
    ToolCallIDManager.prototype.trackId = function (id, sessionId) {
        var startTime = performance.now();
        try {
            // Validate ID format
            if (!this.generator.isValidId(id)) {
                var result = IDManagementUtils.createResult(false, id, sessionId, [constants_1.ID_MANAGEMENT_MESSAGES.ID_TRACKING_FAILED], startTime);
                this.updateStats(false, performance.now() - startTime);
                return result;
            }
            // Track the ID
            var trackingResult = this.tracker.addId(id, sessionId);
            if (trackingResult.success) {
                this.stats.totalIdsTracked++;
                this.updateStats(true, performance.now() - startTime);
            }
            else {
                this.updateStats(false, performance.now() - startTime);
            }
            return {
                success: trackingResult.success,
                id: trackingResult.id,
                sessionId: trackingResult.sessionId,
                errors: trackingResult.errors,
                managementTimeMs: performance.now() - startTime
            };
        }
        catch (error) {
            this.updateStats(false, performance.now() - startTime);
            return IDManagementUtils.createResult(false, id, sessionId, [error instanceof Error ? error.message : constants_1.ID_MANAGEMENT_MESSAGES.ID_TRACKING_FAILED], startTime);
        }
    };
    /**
     * Check if ID is being tracked
     */
    ToolCallIDManager.prototype.isIdTracked = function (id) {
        return this.tracker.hasId(id);
    };
    /**
     * Get all tracked IDs for a session
     */
    ToolCallIDManager.prototype.getSessionIds = function (sessionId) {
        return this.tracker.getIds(sessionId);
    };
    /**
     * Clear all tracked IDs for a session
     */
    ToolCallIDManager.prototype.clearSession = function (sessionId) {
        this.tracker.clear(sessionId);
    };
    /**
     * Generate and track an ID in one operation
     */
    ToolCallIDManager.prototype.generateAndTrackId = function (sessionId) {
        var startTime = performance.now();
        try {
            var id = this.generateId();
            var trackingResult = this.trackId(id, sessionId);
            return {
                success: trackingResult.success,
                id: trackingResult.id,
                sessionId: trackingResult.sessionId,
                errors: trackingResult.errors,
                managementTimeMs: performance.now() - startTime
            };
        }
        catch (error) {
            this.updateStats(false, performance.now() - startTime);
            return IDManagementUtils.createResult(false, undefined, sessionId, [error instanceof Error ? error.message : constants_1.ID_MANAGEMENT_MESSAGES.ID_TRACKING_FAILED], startTime);
        }
    };
    /**
     * Validate and track multiple IDs
     */
    ToolCallIDManager.prototype.trackMultipleIds = function (ids, sessionId) {
        var _this = this;
        return ids.map(function (id) { return _this.trackId(id, sessionId); });
    };
    /**
     * Remove ID from tracking
     */
    ToolCallIDManager.prototype.untrackId = function (id) {
        var startTime = performance.now();
        try {
            var result = this.tracker.removeId(id);
            if (result.success) {
                this.updateStats(true, performance.now() - startTime);
            }
            else {
                this.updateStats(false, performance.now() - startTime);
            }
            return {
                success: result.success,
                id: result.id,
                sessionId: result.sessionId,
                errors: result.errors,
                managementTimeMs: performance.now() - startTime
            };
        }
        catch (error) {
            this.updateStats(false, performance.now() - startTime);
            return IDManagementUtils.createResult(false, id, undefined, [error instanceof Error ? error.message : constants_1.ID_MANAGEMENT_MESSAGES.ID_TRACKING_FAILED], startTime);
        }
    };
    /**
     * Get management statistics
     */
    ToolCallIDManager.prototype.getManagementStats = function () {
        return __assign(__assign({}, this.stats), { averageOperationTime: this.stats.successfulOperations > 0
                ? this.stats.totalOperationTime / this.stats.successfulOperations
                : 0 });
    };
    /**
     * Clear all management data
     */
    ToolCallIDManager.prototype.clearAll = function () {
        this.tracker.clear();
        this.generator.clearUsedIds();
        this.resetStats();
    };
    /**
     * Reset statistics
     */
    ToolCallIDManager.prototype.resetStats = function () {
        this.stats = {
            totalIdsGenerated: 0,
            totalIdsTracked: 0,
            successfulOperations: 0,
            failedOperations: 0,
            totalOperationTime: 0
        };
    };
    /**
     * Update operation statistics
     */
    ToolCallIDManager.prototype.updateStats = function (success, operationTime) {
        if (success) {
            this.stats.successfulOperations++;
        }
        else {
            this.stats.failedOperations++;
        }
        this.stats.totalOperationTime += operationTime;
    };
    return ToolCallIDManager;
}());
exports.ToolCallIDManager = ToolCallIDManager;
/**
 * Default tool call ID manager instance
 */
exports.toolCallIDManager = new ToolCallIDManager();
