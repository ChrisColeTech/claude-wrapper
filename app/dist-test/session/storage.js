"use strict";
/**
 * Enhanced In-Memory Session Storage
 * Based on Python session_manager.py storage patterns
 * Provides thread-safe, high-performance session storage with statistics
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
exports.SessionStorageFactory = exports.EnhancedMemorySessionStorage = void 0;
var session_1 = require("../models/session");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('SessionStorage');
/**
 * Enhanced in-memory session storage
 * Based on Python threading.Lock() pattern for thread safety
 */
var EnhancedMemorySessionStorage = /** @class */ (function () {
    function EnhancedMemorySessionStorage(maxSessions, trackAccess) {
        if (maxSessions === void 0) { maxSessions = 10000; }
        if (trackAccess === void 0) { trackAccess = true; }
        this.maxSessions = maxSessions;
        this.trackAccess = trackAccess;
        this.sessions = new Map();
        this.accessCounts = new Map();
        this.lastCleanup = null;
        this.cleanupCount = 0;
        this.lock = new AsyncLock();
        logger.info('Enhanced memory session storage initialized', {
            maxSessions: maxSessions,
            trackAccess: trackAccess
        });
    }
    /**
     * Store a session with thread safety
     * Based on Python with self.lock pattern
     */
    EnhancedMemorySessionStorage.prototype.store = function (session) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.lock.acquire('storage', function () { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (!(this.sessions.size >= this.maxSessions)) return [3 /*break*/, 3];
                                    // Remove oldest expired session to make room
                                    return [4 /*yield*/, this._evictOldestExpired()];
                                case 1:
                                    // Remove oldest expired session to make room
                                    _a.sent();
                                    if (!(this.sessions.size >= this.maxSessions)) return [3 /*break*/, 3];
                                    return [4 /*yield*/, this._evictOldest()];
                                case 2:
                                    _a.sent();
                                    _a.label = 3;
                                case 3:
                                    this.sessions.set(session.session_id, __assign({}, session));
                                    if (this.trackAccess) {
                                        this.accessCounts.set(session.session_id, 0);
                                    }
                                    logger.debug('Session stored', {
                                        sessionId: session.session_id,
                                        totalSessions: this.sessions.size
                                    });
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        });
    };
    /**
     * Retrieve a session with lazy cleanup
     * Based on Python get_session with expiry check
     */
    EnhancedMemorySessionStorage.prototype.get = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.lock.acquire('storage', function () { return __awaiter(_this, void 0, void 0, function () {
                        var session, currentCount;
                        return __generator(this, function (_a) {
                            session = this.sessions.get(sessionId);
                            if (!session) {
                                return [2 /*return*/, null];
                            }
                            // Check expiration (lazy cleanup)
                            if (session_1.SessionUtils.isExpired(session)) {
                                this.sessions["delete"](sessionId);
                                this.accessCounts["delete"](sessionId);
                                logger.debug('Expired session removed during get', { sessionId: sessionId });
                                return [2 /*return*/, null];
                            }
                            // Track access
                            if (this.trackAccess) {
                                currentCount = this.accessCounts.get(sessionId) || 0;
                                this.accessCounts.set(sessionId, currentCount + 1);
                            }
                            return [2 /*return*/, __assign({}, session)];
                        });
                    }); })];
            });
        });
    };
    /**
     * Update an existing session
     */
    EnhancedMemorySessionStorage.prototype.update = function (session) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.lock.acquire('storage', function () { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            if (this.sessions.has(session.session_id)) {
                                this.sessions.set(session.session_id, __assign({}, session));
                                logger.debug('Session updated', {
                                    sessionId: session.session_id,
                                    lastAccessed: session.last_accessed
                                });
                            }
                            else {
                                throw new Error("Session not found for update: ".concat(session.session_id));
                            }
                            return [2 /*return*/];
                        });
                    }); })];
            });
        });
    };
    /**
     * Delete a session
     */
    EnhancedMemorySessionStorage.prototype["delete"] = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.lock.acquire('storage', function () { return __awaiter(_this, void 0, void 0, function () {
                        var deleted;
                        return __generator(this, function (_a) {
                            deleted = this.sessions["delete"](sessionId);
                            this.accessCounts["delete"](sessionId);
                            if (deleted) {
                                logger.debug('Session deleted', {
                                    sessionId: sessionId,
                                    remainingSessions: this.sessions.size
                                });
                            }
                            return [2 /*return*/];
                        });
                    }); })];
            });
        });
    };
    /**
     * List all active sessions
     */
    EnhancedMemorySessionStorage.prototype.list = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.lock.acquire('storage', function () { return __awaiter(_this, void 0, void 0, function () {
                        var allSessions;
                        return __generator(this, function (_a) {
                            allSessions = Array.from(this.sessions.values());
                            return [2 /*return*/, session_1.SessionUtils.filterActiveSessions(allSessions)];
                        });
                    }); })];
            });
        });
    };
    /**
     * Clean up expired sessions
     * Based on Python _cleanup_expired_sessions method
     */
    EnhancedMemorySessionStorage.prototype.cleanup = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.lock.acquire('storage', function () { return __awaiter(_this, void 0, void 0, function () {
                        var startTime, cleaned, _i, _a, _b, sessionId, session, duration;
                        return __generator(this, function (_c) {
                            startTime = Date.now();
                            cleaned = 0;
                            for (_i = 0, _a = this.sessions.entries(); _i < _a.length; _i++) {
                                _b = _a[_i], sessionId = _b[0], session = _b[1];
                                if (session_1.SessionUtils.isExpired(session)) {
                                    this.sessions["delete"](sessionId);
                                    this.accessCounts["delete"](sessionId);
                                    cleaned++;
                                }
                            }
                            this.lastCleanup = new Date();
                            this.cleanupCount++;
                            duration = Date.now() - startTime;
                            if (cleaned > 0) {
                                logger.info('Storage cleanup completed', {
                                    cleanedSessions: cleaned,
                                    remainingSessions: this.sessions.size,
                                    durationMs: duration,
                                    cleanupCount: this.cleanupCount
                                });
                            }
                            return [2 /*return*/, cleaned];
                        });
                    }); })];
            });
        });
    };
    /**
     * Get storage statistics
     */
    EnhancedMemorySessionStorage.prototype.getStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.lock.acquire('storage', function () { return __awaiter(_this, void 0, void 0, function () {
                        var allSessions, activeSessions, expiredSessions, estimatedMemoryUsage, avgSessionSize, now, sessionAges, oldestSessionAge, newestSessionAge;
                        return __generator(this, function (_a) {
                            allSessions = Array.from(this.sessions.values());
                            activeSessions = session_1.SessionUtils.filterActiveSessions(allSessions);
                            expiredSessions = allSessions.length - activeSessions.length;
                            estimatedMemoryUsage = this._estimateMemoryUsage();
                            avgSessionSize = allSessions.length > 0 ? estimatedMemoryUsage / allSessions.length : 0;
                            now = Date.now();
                            sessionAges = activeSessions.map(function (s) { return now - s.created_at.getTime(); });
                            oldestSessionAge = sessionAges.length > 0 ? Math.max.apply(Math, sessionAges) : 0;
                            newestSessionAge = sessionAges.length > 0 ? Math.min.apply(Math, sessionAges) : 0;
                            return [2 /*return*/, {
                                    totalSessions: allSessions.length,
                                    activeSessions: activeSessions.length,
                                    expiredSessions: expiredSessions,
                                    memoryUsageBytes: estimatedMemoryUsage,
                                    avgSessionSizeBytes: Math.round(avgSessionSize),
                                    oldestSessionAge: Math.round(oldestSessionAge / 1000),
                                    newestSessionAge: Math.round(newestSessionAge / 1000),
                                    lastCleanupTime: this.lastCleanup,
                                    cleanupCount: this.cleanupCount
                                }];
                        });
                    }); })];
            });
        });
    };
    /**
     * Get session access statistics
     */
    EnhancedMemorySessionStorage.prototype.getAccessStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (!this.trackAccess) {
                    throw new Error('Access tracking is disabled');
                }
                return [2 /*return*/, this.lock.acquire('storage', function () { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, new Map(this.accessCounts)];
                        });
                    }); })];
            });
        });
    };
    /**
     * Get most accessed sessions
     */
    EnhancedMemorySessionStorage.prototype.getMostAccessedSessions = function (limit) {
        if (limit === void 0) { limit = 10; }
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (!this.trackAccess) {
                    throw new Error('Access tracking is disabled');
                }
                return [2 /*return*/, this.lock.acquire('storage', function () { return __awaiter(_this, void 0, void 0, function () {
                        var entries;
                        return __generator(this, function (_a) {
                            entries = Array.from(this.accessCounts.entries())
                                .map(function (_a) {
                                var sessionId = _a[0], count = _a[1];
                                return ({ sessionId: sessionId, accessCount: count });
                            })
                                .sort(function (a, b) { return b.accessCount - a.accessCount; })
                                .slice(0, limit);
                            return [2 /*return*/, entries];
                        });
                    }); })];
            });
        });
    };
    /**
     * Clear all sessions (for testing/maintenance)
     */
    EnhancedMemorySessionStorage.prototype.clear = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.lock.acquire('storage', function () { return __awaiter(_this, void 0, void 0, function () {
                        var count;
                        return __generator(this, function (_a) {
                            count = this.sessions.size;
                            this.sessions.clear();
                            this.accessCounts.clear();
                            logger.info('All sessions cleared', { clearedCount: count });
                            return [2 /*return*/];
                        });
                    }); })];
            });
        });
    };
    /**
     * Check storage health
     */
    EnhancedMemorySessionStorage.prototype.isHealthy = function () {
        return __awaiter(this, void 0, void 0, function () {
            var stats, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.getStats()];
                    case 1:
                        stats = _a.sent();
                        return [2 /*return*/, stats.totalSessions < this.maxSessions * 0.9]; // 90% capacity threshold
                    case 2:
                        error_1 = _a.sent();
                        logger.error('Health check failed', { error: error_1 });
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Evict oldest expired session
     */
    EnhancedMemorySessionStorage.prototype._evictOldestExpired = function () {
        return __awaiter(this, void 0, void 0, function () {
            var expiredSessions, sessionId;
            return __generator(this, function (_a) {
                expiredSessions = Array.from(this.sessions.entries())
                    .filter(function (_a) {
                    var session = _a[1];
                    return session_1.SessionUtils.isExpired(session);
                })
                    .sort(function (_a, _b) {
                    var a = _a[1];
                    var b = _b[1];
                    return a.expires_at.getTime() - b.expires_at.getTime();
                });
                if (expiredSessions.length > 0) {
                    sessionId = expiredSessions[0][0];
                    this.sessions["delete"](sessionId);
                    this.accessCounts["delete"](sessionId);
                    logger.debug('Evicted oldest expired session', { sessionId: sessionId });
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Evict oldest session regardless of expiry
     */
    EnhancedMemorySessionStorage.prototype._evictOldest = function () {
        return __awaiter(this, void 0, void 0, function () {
            var oldestSession, sessionId;
            return __generator(this, function (_a) {
                oldestSession = Array.from(this.sessions.entries())
                    .sort(function (_a, _b) {
                    var a = _a[1];
                    var b = _b[1];
                    return a.created_at.getTime() - b.created_at.getTime();
                })[0];
                if (oldestSession) {
                    sessionId = oldestSession[0];
                    this.sessions["delete"](sessionId);
                    this.accessCounts["delete"](sessionId);
                    logger.warn('Evicted oldest session due to capacity limit', { sessionId: sessionId });
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Estimate memory usage of stored sessions
     */
    EnhancedMemorySessionStorage.prototype._estimateMemoryUsage = function () {
        var totalBytes = 0;
        for (var _i = 0, _a = this.sessions.values(); _i < _a.length; _i++) {
            var session = _a[_i];
            // Rough estimate: JSON representation size
            var sessionStr = JSON.stringify(session_1.SessionUtils.toSerializable(session));
            totalBytes += sessionStr.length * 2; // UTF-16 encoding
        }
        // Add overhead for Map structure and access counters
        totalBytes += this.sessions.size * 50; // Map overhead estimate
        totalBytes += this.accessCounts.size * 12; // Number storage
        return totalBytes;
    };
    return EnhancedMemorySessionStorage;
}());
exports.EnhancedMemorySessionStorage = EnhancedMemorySessionStorage;
/**
 * Simple async lock implementation
 * Based on Python threading.Lock() behavior
 */
var AsyncLock = /** @class */ (function () {
    function AsyncLock() {
        this.locks = new Map();
    }
    AsyncLock.prototype.acquire = function (key, fn) {
        return __awaiter(this, void 0, void 0, function () {
            var resolve, lockPromise, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.locks.has(key)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.locks.get(key)];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 0];
                    case 2:
                        lockPromise = new Promise(function (res) {
                            resolve = res;
                        });
                        this.locks.set(key, lockPromise);
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, , 5, 6]);
                        return [4 /*yield*/, fn()];
                    case 4:
                        result = _a.sent();
                        return [2 /*return*/, result];
                    case 5:
                        // Release lock
                        this.locks["delete"](key);
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        resolve();
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return AsyncLock;
}());
/**
 * Session storage factory
 */
var SessionStorageFactory = /** @class */ (function () {
    function SessionStorageFactory() {
    }
    /**
     * Create enhanced memory storage
     */
    SessionStorageFactory.createMemoryStorage = function (maxSessions, trackAccess) {
        if (maxSessions === void 0) { maxSessions = 10000; }
        if (trackAccess === void 0) { trackAccess = true; }
        return new EnhancedMemorySessionStorage(maxSessions, trackAccess);
    };
    /**
     * Create storage based on configuration
     */
    SessionStorageFactory.createStorage = function (type, options) {
        if (type === void 0) { type = 'memory'; }
        if (options === void 0) { options = {}; }
        if (type !== 'memory') {
            throw new Error("Only memory storage is implemented. Requested: ".concat(type));
        }
        return new EnhancedMemorySessionStorage(options.maxSessions, options.trackAccess);
    };
    return SessionStorageFactory;
}());
exports.SessionStorageFactory = SessionStorageFactory;
