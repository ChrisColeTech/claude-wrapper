"use strict";
/**
 * Session Models for Claude Code Chat Continuity
 * Based on Python models.py:157-166 (SessionInfo, SessionListResponse)
 * Provides session management with Zod validation
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
exports.__esModule = true;
exports.MemorySessionStorage = exports.SessionUtils = exports.SessionCreateOptionsSchema = exports.SessionListResponseSchema = exports.SessionInfoSchema = void 0;
var zod_1 = require("zod");
/**
 * Session info schema
 * Based on Python SessionInfo class
 */
exports.SessionInfoSchema = zod_1.z.object({
    session_id: zod_1.z.string(),
    created_at: zod_1.z.date(),
    last_accessed: zod_1.z.date(),
    message_count: zod_1.z.number().int().nonnegative(),
    expires_at: zod_1.z.date(),
    tool_call_state_snapshot: zod_1.z.any().optional() // ToolCallStateSnapshot - using any for now to avoid circular import
});
/**
 * Session list response schema
 * Based on Python SessionListResponse class
 */
exports.SessionListResponseSchema = zod_1.z.object({
    sessions: zod_1.z.array(exports.SessionInfoSchema),
    total: zod_1.z.number().int().nonnegative()
});
/**
 * Session creation options
 */
exports.SessionCreateOptionsSchema = zod_1.z.object({
    session_id: zod_1.z.string().optional(),
    expires_in_minutes: zod_1.z.number().int().positive()["default"](60 * 24),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    enable_tool_state_tracking: zod_1.z.boolean()["default"](true)
});
/**
 * Session utilities
 */
exports.SessionUtils = {
    /**
     * Generate a new session ID
     */
    generateSessionId: function () {
        var timestamp = Date.now().toString(36);
        var random = Math.random().toString(36).substring(2, 10);
        return "session_".concat(timestamp, "_").concat(random);
    },
    /**
     * Create a new session
     */
    createSession: function (options) {
        if (options === void 0) { options = {}; }
        var now = new Date();
        var expiresAt = new Date(now.getTime() + (options.expires_in_minutes || 1440) * 60 * 1000);
        return {
            session_id: options.session_id || exports.SessionUtils.generateSessionId(),
            created_at: now,
            last_accessed: now,
            message_count: 0,
            expires_at: expiresAt,
            tool_call_state_snapshot: undefined
        };
    },
    /**
     * Check if session is expired
     */
    isExpired: function (session) {
        return new Date() > session.expires_at;
    },
    /**
     * Update session with new message
     */
    updateSession: function (session) {
        return __assign(__assign({}, session), { last_accessed: new Date(), message_count: session.message_count + 1 });
    },
    /**
     * Extend session expiration
     */
    extendSession: function (session, minutes) {
        var newExpiresAt = new Date(session.expires_at.getTime() + minutes * 60 * 1000);
        return __assign(__assign({}, session), { expires_at: newExpiresAt });
    },
    /**
     * Create session list response
     */
    createSessionList: function (sessions) {
        return {
            sessions: sessions,
            total: sessions.length
        };
    },
    /**
     * Filter active sessions (not expired)
     */
    filterActiveSessions: function (sessions) {
        return sessions.filter(function (session) { return !exports.SessionUtils.isExpired(session); });
    },
    /**
     * Sort sessions by last accessed (most recent first)
     */
    sortByLastAccessed: function (sessions) {
        return __spreadArray([], sessions, true).sort(function (a, b) { return b.last_accessed.getTime() - a.last_accessed.getTime(); });
    },
    /**
     * Validate session info
     */
    validateSession: function (session) {
        return exports.SessionInfoSchema.parse(session);
    },
    /**
     * Validate session list response
     */
    validateSessionList: function (response) {
        return exports.SessionListResponseSchema.parse(response);
    },
    /**
     * Convert session to serializable format
     */
    toSerializable: function (session) {
        return {
            session_id: session.session_id,
            created_at: session.created_at.toISOString(),
            last_accessed: session.last_accessed.toISOString(),
            message_count: session.message_count,
            expires_at: session.expires_at.toISOString(),
            tool_call_state_snapshot: session.tool_call_state_snapshot
        };
    },
    /**
     * Parse session from serializable format
     */
    fromSerializable: function (data) {
        return {
            session_id: data.session_id,
            created_at: new Date(data.created_at),
            last_accessed: new Date(data.last_accessed),
            message_count: data.message_count,
            expires_at: new Date(data.expires_at),
            tool_call_state_snapshot: data.tool_call_state_snapshot
        };
    },
    /**
     * Update session with tool call state snapshot
     */
    updateToolCallState: function (session, snapshot) {
        return __assign(__assign({}, session), { tool_call_state_snapshot: snapshot, last_accessed: new Date() });
    },
    /**
     * Check if session has tool call state tracking enabled
     */
    hasToolStateTracking: function (session) {
        return session.tool_call_state_snapshot !== undefined;
    },
    /**
     * Get tool call state summary for session
     */
    getToolCallStateSummary: function (session) {
        if (!session.tool_call_state_snapshot) {
            return { totalCalls: 0, pendingCalls: 0, completedCalls: 0 };
        }
        var snapshot = session.tool_call_state_snapshot;
        return {
            totalCalls: snapshot.totalCalls,
            pendingCalls: snapshot.pendingCalls.length,
            completedCalls: snapshot.completedCalls.length
        };
    }
};
/**
 * In-memory session storage implementation
 */
var MemorySessionStorage = /** @class */ (function () {
    function MemorySessionStorage() {
        this.sessions = new Map();
    }
    MemorySessionStorage.prototype.store = function (session) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.sessions.set(session.session_id, session);
                return [2 /*return*/];
            });
        });
    };
    MemorySessionStorage.prototype.get = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var session;
            return __generator(this, function (_a) {
                session = this.sessions.get(sessionId);
                if (!session) {
                    return [2 /*return*/, null];
                }
                if (exports.SessionUtils.isExpired(session)) {
                    this.sessions["delete"](sessionId);
                    return [2 /*return*/, null];
                }
                return [2 /*return*/, session];
            });
        });
    };
    MemorySessionStorage.prototype.update = function (session) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (this.sessions.has(session.session_id)) {
                    this.sessions.set(session.session_id, session);
                }
                return [2 /*return*/];
            });
        });
    };
    MemorySessionStorage.prototype["delete"] = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.sessions["delete"](sessionId);
                return [2 /*return*/];
            });
        });
    };
    MemorySessionStorage.prototype.list = function () {
        return __awaiter(this, void 0, void 0, function () {
            var allSessions;
            return __generator(this, function (_a) {
                allSessions = Array.from(this.sessions.values());
                return [2 /*return*/, exports.SessionUtils.filterActiveSessions(allSessions)];
            });
        });
    };
    MemorySessionStorage.prototype.cleanup = function () {
        return __awaiter(this, void 0, void 0, function () {
            var cleaned, _i, _a, _b, sessionId, session;
            return __generator(this, function (_c) {
                cleaned = 0;
                for (_i = 0, _a = this.sessions.entries(); _i < _a.length; _i++) {
                    _b = _a[_i], sessionId = _b[0], session = _b[1];
                    if (exports.SessionUtils.isExpired(session)) {
                        this.sessions["delete"](sessionId);
                        cleaned++;
                    }
                }
                return [2 /*return*/, cleaned];
            });
        });
    };
    return MemorySessionStorage;
}());
exports.MemorySessionStorage = MemorySessionStorage;
