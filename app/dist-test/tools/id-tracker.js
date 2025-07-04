"use strict";
/**
 * Tool call ID tracking service
 * Single Responsibility: ID tracking only
 *
 * Tracks tool call IDs across conversation turns and sessions
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
exports.toolCallIDTracker = exports.ToolCallIDTracker = exports.IDTrackingUtils = exports.IDTrackingError = void 0;
var constants_1 = require("./constants");
/**
 * ID tracking error class
 */
var IDTrackingError = /** @class */ (function (_super) {
    __extends(IDTrackingError, _super);
    function IDTrackingError(message, code, id, sessionId) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.id = id;
        _this.sessionId = sessionId;
        _this.name = 'IDTrackingError';
        return _this;
    }
    return IDTrackingError;
}(Error));
exports.IDTrackingError = IDTrackingError;
/**
 * ID tracking utilities
 */
var IDTrackingUtils = /** @class */ (function () {
    function IDTrackingUtils() {
    }
    /**
     * Validate session ID format
     */
    IDTrackingUtils.validateSessionId = function (sessionId) {
        return typeof sessionId === 'string' && sessionId.length > 0 && sessionId.length <= 100;
    };
    /**
     * Validate tool call ID format
     */
    IDTrackingUtils.validateToolCallId = function (id) {
        return typeof id === 'string' &&
            id.startsWith(constants_1.ID_FORMATS.CALL_PREFIX) &&
            id.length === constants_1.ID_FORMATS.CALL_ID_LENGTH;
    };
    /**
     * Create tracking key for storage
     */
    IDTrackingUtils.createTrackingKey = function (id, sessionId) {
        return sessionId ? "".concat(sessionId, ":").concat(id) : id;
    };
    /**
     * Extract session from tracking key
     */
    IDTrackingUtils.extractSessionFromKey = function (key) {
        var parts = key.split(':');
        return parts.length > 1 ? parts[0] : null;
    };
    /**
     * Extract ID from tracking key
     */
    IDTrackingUtils.extractIdFromKey = function (key) {
        var parts = key.split(':');
        return parts.length > 1 ? parts[1] : parts[0];
    };
    return IDTrackingUtils;
}());
exports.IDTrackingUtils = IDTrackingUtils;
/**
 * Tool call ID tracker implementation
 */
var ToolCallIDTracker = /** @class */ (function () {
    function ToolCallIDTracker() {
        this.trackedIds = new Map(); // key -> sessionId
        this.sessionIds = new Map(); // sessionId -> Set of IDs
    }
    /**
     * Add ID to tracking
     */
    ToolCallIDTracker.prototype.addId = function (id, sessionId) {
        var startTime = performance.now();
        try {
            // Validate inputs
            if (!IDTrackingUtils.validateToolCallId(id)) {
                return {
                    success: false,
                    id: id,
                    sessionId: sessionId,
                    errors: [constants_1.ID_MANAGEMENT_MESSAGES.ID_TRACKING_FAILED],
                    trackingTimeMs: performance.now() - startTime
                };
            }
            if (sessionId !== undefined && !IDTrackingUtils.validateSessionId(sessionId)) {
                return {
                    success: false,
                    id: id,
                    sessionId: sessionId,
                    errors: [constants_1.ID_MANAGEMENT_MESSAGES.INVALID_SESSION_ID],
                    trackingTimeMs: performance.now() - startTime
                };
            }
            // Check if already tracked
            if (this.trackedIds.has(id)) {
                return {
                    success: false,
                    id: id,
                    sessionId: sessionId,
                    errors: [constants_1.ID_MANAGEMENT_MESSAGES.ID_ALREADY_TRACKED],
                    trackingTimeMs: performance.now() - startTime
                };
            }
            // Check session limits
            if (sessionId) {
                var sessionIdSet = this.sessionIds.get(sessionId);
                if (sessionIdSet && sessionIdSet.size >= constants_1.ID_MANAGEMENT_LIMITS.MAX_IDS_PER_SESSION) {
                    return {
                        success: false,
                        id: id,
                        sessionId: sessionId,
                        errors: [constants_1.ID_MANAGEMENT_MESSAGES.TRACKING_LIMIT_EXCEEDED],
                        trackingTimeMs: performance.now() - startTime
                    };
                }
            }
            // Add to tracking
            this.trackedIds.set(id, sessionId || '');
            if (sessionId) {
                if (!this.sessionIds.has(sessionId)) {
                    this.sessionIds.set(sessionId, new Set());
                }
                this.sessionIds.get(sessionId).add(id);
            }
            return {
                success: true,
                id: id,
                sessionId: sessionId,
                errors: [],
                trackingTimeMs: performance.now() - startTime
            };
        }
        catch (error) {
            return {
                success: false,
                id: id,
                sessionId: sessionId,
                errors: [error instanceof Error ? error.message : constants_1.ID_MANAGEMENT_MESSAGES.ID_TRACKING_FAILED],
                trackingTimeMs: performance.now() - startTime
            };
        }
    };
    /**
     * Check if ID is being tracked
     */
    ToolCallIDTracker.prototype.hasId = function (id) {
        return this.trackedIds.has(id);
    };
    /**
     * Get all tracked IDs, optionally filtered by session
     */
    ToolCallIDTracker.prototype.getIds = function (sessionId) {
        if (sessionId) {
            var sessionIdSet = this.sessionIds.get(sessionId);
            return sessionIdSet ? Array.from(sessionIdSet) : [];
        }
        return Array.from(this.trackedIds.keys());
    };
    /**
     * Remove ID from tracking
     */
    ToolCallIDTracker.prototype.removeId = function (id) {
        var startTime = performance.now();
        try {
            if (!this.trackedIds.has(id)) {
                return {
                    success: false,
                    id: id,
                    errors: [constants_1.ID_MANAGEMENT_MESSAGES.ID_NOT_TRACKED],
                    trackingTimeMs: performance.now() - startTime
                };
            }
            var sessionId = this.trackedIds.get(id);
            this.trackedIds["delete"](id);
            if (sessionId) {
                var sessionIdSet = this.sessionIds.get(sessionId);
                if (sessionIdSet) {
                    sessionIdSet["delete"](id);
                    if (sessionIdSet.size === 0) {
                        this.sessionIds["delete"](sessionId);
                    }
                }
            }
            return {
                success: true,
                id: id,
                sessionId: sessionId || undefined,
                errors: [],
                trackingTimeMs: performance.now() - startTime
            };
        }
        catch (error) {
            return {
                success: false,
                id: id,
                errors: [error instanceof Error ? error.message : constants_1.ID_MANAGEMENT_MESSAGES.ID_TRACKING_FAILED],
                trackingTimeMs: performance.now() - startTime
            };
        }
    };
    /**
     * Clear tracking data
     */
    ToolCallIDTracker.prototype.clear = function (sessionId) {
        if (sessionId) {
            var sessionIdSet = this.sessionIds.get(sessionId);
            if (sessionIdSet) {
                // Remove all IDs for this session
                for (var _i = 0, sessionIdSet_1 = sessionIdSet; _i < sessionIdSet_1.length; _i++) {
                    var id = sessionIdSet_1[_i];
                    this.trackedIds["delete"](id);
                }
                this.sessionIds["delete"](sessionId);
            }
        }
        else {
            // Clear all tracking data
            this.trackedIds.clear();
            this.sessionIds.clear();
        }
    };
    /**
     * Get tracking statistics (for testing/monitoring)
     */
    ToolCallIDTracker.prototype.getTrackingStats = function () {
        return {
            totalTrackedIds: this.trackedIds.size,
            totalSessions: this.sessionIds.size,
            averageIdsPerSession: this.sessionIds.size > 0
                ? this.trackedIds.size / this.sessionIds.size
                : 0
        };
    };
    /**
     * Get session ID for a tracked ID
     */
    ToolCallIDTracker.prototype.getSessionForId = function (id) {
        var sessionId = this.trackedIds.get(id);
        return sessionId || null;
    };
    /**
     * Check if session exists
     */
    ToolCallIDTracker.prototype.hasSession = function (sessionId) {
        return this.sessionIds.has(sessionId);
    };
    return ToolCallIDTracker;
}());
exports.ToolCallIDTracker = ToolCallIDTracker;
/**
 * Default tool call ID tracker instance
 */
exports.toolCallIDTracker = new ToolCallIDTracker();
