"use strict";
/**
 * Session Manager with TTL and Background Cleanup
 * Based on Python session_manager.py exactly
 * Matches Python behavior and method signatures
 */
exports.__esModule = true;
exports.SessionManager = exports.Session = void 0;
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('SessionManager');
/**
 * Session class matching Python Session dataclass exactly
 * Based on Python Session dataclass
 */
var Session = /** @class */ (function () {
    function Session(session_id) {
        this.session_id = session_id;
        this.messages = [];
        this.created_at = new Date();
        this.last_accessed = new Date();
        this.expires_at = new Date(Date.now() + 60 * 60 * 1000); // 1 hour default
    }
    /**
     * Touch session to extend TTL
     * Based on Python Session.touch method
     */
    Session.prototype.touch = function () {
        this.last_accessed = new Date();
        this.expires_at = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    };
    /**
     * Add messages to session
     * Based on Python Session.add_messages method
     */
    Session.prototype.add_messages = function (messages) {
        var _a;
        (_a = this.messages).push.apply(_a, messages);
        this.touch();
    };
    /**
     * Get all messages
     * Based on Python Session.get_all_messages method
     */
    Session.prototype.get_all_messages = function () {
        return this.messages;
    };
    /**
     * Check if session is expired
     * Based on Python Session.is_expired method
     */
    Session.prototype.is_expired = function () {
        return new Date() > this.expires_at;
    };
    return Session;
}());
exports.Session = Session;
/**
 * Simple synchronous lock for thread safety
 * Based on Python threading.Lock() behavior
 * Note: In Node.js this is just for code organization since JS is single-threaded
 */
var SyncLock = /** @class */ (function () {
    function SyncLock() {
        this.locked = false;
    }
    SyncLock.prototype.acquire = function (fn) {
        if (this.locked) {
            // In a real threading environment this would block
            // For Node.js single-threaded execution, we just execute
            logger.warn('Lock contention detected - this should not happen in single-threaded Node.js');
        }
        this.locked = true;
        try {
            var result = fn();
            return result;
        }
        finally {
            this.locked = false;
        }
    };
    return SyncLock;
}());
/**
 * Session Manager class
 * Based on Python SessionManager class exactly
 */
var SessionManager = /** @class */ (function () {
    function SessionManager(default_ttl_hours, cleanup_interval_minutes) {
        if (default_ttl_hours === void 0) { default_ttl_hours = 1; }
        if (cleanup_interval_minutes === void 0) { cleanup_interval_minutes = 5; }
        this.sessions = new Map();
        this.lock = new SyncLock();
        this.cleanup_task = null;
        this.default_ttl_hours = default_ttl_hours;
        this.cleanup_interval_minutes = cleanup_interval_minutes;
        logger.info('SessionManager initialized', {
            default_ttl_hours: default_ttl_hours,
            cleanup_interval_minutes: cleanup_interval_minutes
        });
    }
    /**
     * Start the background cleanup task
     * Based on Python start_cleanup_task method
     */
    SessionManager.prototype.start_cleanup_task = function () {
        var _this = this;
        if (this.cleanup_task) {
            logger.warn('Cleanup task already running');
            return;
        }
        var intervalMs = this.cleanup_interval_minutes * 60 * 1000;
        this.cleanup_task = setInterval(function () {
            try {
                _this._cleanup_expired_sessions();
            }
            catch (error) {
                logger.error('Error during session cleanup', { error: error });
            }
        }, intervalMs);
        logger.info('Background cleanup task started', {
            intervalMinutes: this.cleanup_interval_minutes
        });
    };
    /**
     * Stop the background cleanup task
     * Based on Python shutdown method
     */
    SessionManager.prototype.shutdown = function () {
        if (this.cleanup_task) {
            clearInterval(this.cleanup_task);
            this.cleanup_task = null;
            logger.info('Background cleanup task stopped');
        }
    };
    /**
     * Get or create a session
     * Based on Python get_or_create_session method
     */
    SessionManager.prototype.get_or_create_session = function (session_id) {
        var _this = this;
        return this.lock.acquire(function () {
            if (_this.sessions.has(session_id)) {
                var session = _this.sessions.get(session_id);
                if (session.is_expired()) {
                    logger.info("Session ".concat(session_id, " expired, creating new session"));
                    _this.sessions["delete"](session_id);
                    var newSession = new Session(session_id);
                    _this.sessions.set(session_id, newSession);
                    return newSession;
                }
                else {
                    session.touch();
                    return session;
                }
            }
            else {
                var session = new Session(session_id);
                _this.sessions.set(session_id, session);
                logger.info("Created new session: ".concat(session_id));
                return session;
            }
        });
    };
    /**
     * Process messages with optional session
     * Based on Python process_messages method
     */
    SessionManager.prototype.process_messages = function (messages, session_id) {
        if (session_id === null || session_id === undefined) {
            // Stateless mode - return messages as-is
            return [messages, null];
        }
        var session = this.get_or_create_session(session_id);
        session.add_messages(messages);
        var all_messages = session.get_all_messages();
        return [all_messages, session_id];
    };
    /**
     * List all active sessions
     * Based on Python list_sessions method
     */
    SessionManager.prototype.list_sessions = function () {
        var _this = this;
        return this.lock.acquire(function () {
            var active_sessions = [];
            for (var _i = 0, _a = _this.sessions.values(); _i < _a.length; _i++) {
                var session = _a[_i];
                if (!session.is_expired()) {
                    active_sessions.push(session);
                }
            }
            return active_sessions;
        });
    };
    /**
     * Delete a session
     * Based on Python delete_session method
     */
    SessionManager.prototype.delete_session = function (session_id) {
        var _this = this;
        this.lock.acquire(function () {
            _this.sessions["delete"](session_id);
            logger.info("Session deleted: ".concat(session_id));
            return; // Explicit return for void
        });
    };
    /**
     * Clean up expired sessions
     * Based on Python _cleanup_expired_sessions method
     */
    SessionManager.prototype._cleanup_expired_sessions = function () {
        var _this = this;
        this.lock.acquire(function () {
            var cleaned_count = 0;
            var expired_session_ids = [];
            for (var _i = 0, _a = _this.sessions.entries(); _i < _a.length; _i++) {
                var _b = _a[_i], session_id = _b[0], session = _b[1];
                if (session.is_expired()) {
                    expired_session_ids.push(session_id);
                }
            }
            for (var _c = 0, expired_session_ids_1 = expired_session_ids; _c < expired_session_ids_1.length; _c++) {
                var session_id = expired_session_ids_1[_c];
                _this.sessions["delete"](session_id);
                cleaned_count++;
            }
            if (cleaned_count > 0) {
                logger.info("Cleaned up ".concat(cleaned_count, " expired sessions"));
            }
            return cleaned_count; // Return for testing
        });
    };
    /**
     * Get session count
     * For monitoring and statistics
     */
    SessionManager.prototype.get_session_count = function () {
        var _this = this;
        return this.lock.acquire(function () {
            return _this.sessions.size;
        });
    };
    return SessionManager;
}());
exports.SessionManager = SessionManager;
