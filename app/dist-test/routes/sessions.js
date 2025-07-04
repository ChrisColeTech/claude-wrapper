"use strict";
/**
 * Sessions Router - Complete Session Management Endpoints
 * Phase 13A Implementation: Complete session endpoints (/v1/sessions/*)
 * Based on Python main.py:772-817 session endpoints
 *
 * Single Responsibility: HTTP endpoint handling for all session operations
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
exports.SessionsRouter = void 0;
var express_1 = require("express");
var session_service_1 = require("../services/session-service");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('SessionsRouter');
/**
 * Sessions Router class
 * Handles all session management endpoints with Python compatibility
 */
var SessionsRouter = /** @class */ (function () {
    function SessionsRouter() {
    }
    /**
     * Create Express router with all session endpoints
     * Based on Python FastAPI app session route definitions
     */
    SessionsRouter.createRouter = function () {
        var router = (0, express_1.Router)();
        // POST /v1/sessions - Create a new session
        router.post('/v1/sessions', this.createSession.bind(this));
        // GET /v1/sessions/stats - Session manager statistics
        router.get('/v1/sessions/stats', this.getSessionStats.bind(this));
        // GET /v1/sessions - List all active sessions
        router.get('/v1/sessions', this.listSessions.bind(this));
        // GET /v1/sessions/{session_id} - Get information about a specific session
        router.get('/v1/sessions/:session_id', this.getSession.bind(this));
        // PATCH /v1/sessions/{session_id} - Update a session
        router.patch('/v1/sessions/:session_id', this.updateSession.bind(this));
        // DELETE /v1/sessions/{session_id} - Delete a specific session
        router["delete"]('/v1/sessions/:session_id', this.deleteSession.bind(this));
        logger.info('SessionsRouter configured with 6 endpoints');
        return router;
    };
    /**
     * POST /v1/sessions endpoint
     * Create a new session
     */
    SessionsRouter.createSession = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, system_prompt, max_turns, model, sessionData, session;
            return __generator(this, function (_b) {
                try {
                    logger.debug('Creating new session', { body: req.body });
                    _a = req.body, system_prompt = _a.system_prompt, max_turns = _a.max_turns, model = _a.model;
                    // Validate required fields
                    if (!model) {
                        res.status(400).json({
                            error: 'Bad Request',
                            message: 'model is required'
                        });
                        return [2 /*return*/];
                    }
                    sessionData = {
                        system_prompt: system_prompt || 'You are a helpful assistant.',
                        max_turns: max_turns || 10,
                        model: model,
                        message_count: 0,
                        status: 'active'
                    };
                    session = this.sessionService.createSession(sessionData);
                    logger.debug('Session created', { sessionId: session.id });
                    res.status(201).json({
                        id: session.id,
                        created_at: session.created_at,
                        model: session.model,
                        system_prompt: session.system_prompt,
                        max_turns: session.max_turns,
                        message_count: session.message_count,
                        status: session.status
                    });
                }
                catch (error) {
                    logger.error('Failed to create session', { error: error });
                    res.status(500).json({
                        error: 'Internal Server Error',
                        message: 'Failed to create session'
                    });
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * PATCH /v1/sessions/{session_id} endpoint
     * Update an existing session
     */
    SessionsRouter.updateSession = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var session_id, updates, session;
            return __generator(this, function (_a) {
                try {
                    session_id = req.params.session_id;
                    updates = req.body;
                    if (!session_id) {
                        res.status(400).json({
                            error: 'Bad Request',
                            message: 'session_id parameter is required'
                        });
                        return [2 /*return*/];
                    }
                    logger.debug('Updating session', { sessionId: session_id, updates: updates });
                    session = this.sessionService.updateSession(session_id, updates);
                    if (!session) {
                        logger.debug('Session not found for update', { sessionId: session_id });
                        res.status(404).json({
                            error: 'Not Found',
                            message: 'Session not found'
                        });
                        return [2 /*return*/];
                    }
                    logger.debug('Session updated', { sessionId: session_id });
                    res.json({
                        id: session.id,
                        created_at: session.created_at,
                        model: session.model,
                        system_prompt: session.system_prompt,
                        max_turns: session.max_turns,
                        message_count: session.message_count,
                        status: session.status
                    });
                }
                catch (error) {
                    logger.error('Failed to update session', { error: error });
                    res.status(500).json({
                        error: 'Internal Server Error',
                        message: 'Failed to update session'
                    });
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * GET /v1/sessions/stats endpoint
     * Based on Python main.py:772-783 get_session_stats
     */
    SessionsRouter.getSessionStats = function (_req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var sessionStats, config, response;
            return __generator(this, function (_a) {
                try {
                    logger.debug('Getting session statistics');
                    sessionStats = this.sessionService.getSessionStats();
                    config = this.sessionService.getConfig();
                    response = {
                        session_stats: sessionStats,
                        cleanup_interval_minutes: config.cleanupIntervalMinutes,
                        default_ttl_hours: config.defaultTtlHours
                    };
                    logger.debug('Session statistics retrieved', {
                        activeSessions: sessionStats.activeSessions,
                        totalMessages: sessionStats.totalMessages
                    });
                    res.json(response);
                }
                catch (error) {
                    logger.error('Failed to get session statistics', { error: error });
                    res.status(500).json({
                        error: 'Internal Server Error',
                        message: 'Failed to get session statistics'
                    });
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * GET /v1/sessions endpoint
     * Based on Python main.py:785-791 list_sessions
     */
    SessionsRouter.listSessions = function (_req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var sessionList, response;
            return __generator(this, function (_a) {
                try {
                    logger.debug('Listing all sessions');
                    sessionList = this.sessionService.listSessions();
                    response = {
                        sessions: sessionList.sessions.map(function (session) { return ({
                            session_id: session.session_id,
                            created_at: session.created_at,
                            last_accessed: session.last_accessed,
                            message_count: session.message_count,
                            expires_at: session.expires_at
                        }); }),
                        total: sessionList.total
                    };
                    logger.debug('Sessions listed', {
                        total: sessionList.total,
                        count: sessionList.sessions.length
                    });
                    res.json(response);
                }
                catch (error) {
                    logger.error('Failed to list sessions', { error: error });
                    res.status(500).json({
                        error: 'Internal Server Error',
                        message: 'Failed to list sessions'
                    });
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * GET /v1/sessions/{session_id} endpoint
     * Based on Python main.py:794-804 get_session
     */
    SessionsRouter.getSession = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var session_id, sessionInfo;
            return __generator(this, function (_a) {
                try {
                    session_id = req.params.session_id;
                    if (!session_id) {
                        res.status(400).json({
                            error: 'Bad Request',
                            message: 'session_id parameter is required'
                        });
                        return [2 /*return*/];
                    }
                    logger.debug('Getting session info', { sessionId: session_id });
                    sessionInfo = this.sessionService.getSession(session_id);
                    if (!sessionInfo) {
                        logger.debug('Session not found', { sessionId: session_id });
                        res.status(404).json({
                            error: 'Session not found',
                            message: "Session ".concat(session_id, " not found")
                        });
                        return [2 /*return*/];
                    }
                    logger.debug('Session info retrieved', {
                        sessionId: session_id,
                        messageCount: sessionInfo.message_count
                    });
                    // Return session in expected format
                    res.json({
                        id: sessionInfo.id,
                        created_at: sessionInfo.created_at,
                        model: sessionInfo.model,
                        system_prompt: sessionInfo.system_prompt,
                        max_turns: sessionInfo.max_turns,
                        message_count: sessionInfo.message_count,
                        status: sessionInfo.status
                    });
                }
                catch (error) {
                    logger.error('Failed to get session', { error: error, sessionId: req.params.session_id });
                    res.status(500).json({
                        error: 'Internal Server Error',
                        message: 'Failed to get session information'
                    });
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * DELETE /v1/sessions/{session_id} endpoint
     * Based on Python main.py:807-817 delete_session
     */
    SessionsRouter.deleteSession = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var session_id, deleted;
            return __generator(this, function (_a) {
                try {
                    session_id = req.params.session_id;
                    if (!session_id) {
                        res.status(400).json({
                            error: 'Bad Request',
                            message: 'session_id parameter is required'
                        });
                        return [2 /*return*/];
                    }
                    logger.debug('Deleting session', { sessionId: session_id });
                    deleted = this.sessionService.deleteSession(session_id);
                    if (!deleted) {
                        logger.debug('Session not found for deletion', { sessionId: session_id });
                        res.status(404).json({
                            error: 'Session not found',
                            message: "Session ".concat(session_id, " not found")
                        });
                        return [2 /*return*/];
                    }
                    logger.info('Session deleted successfully', { sessionId: session_id });
                    // Return message format matching Python main.py:817
                    res.status(200).json({
                        message: "Session ".concat(session_id, " deleted successfully")
                    });
                }
                catch (error) {
                    logger.error('Failed to delete session', { error: error, sessionId: req.params.session_id });
                    res.status(500).json({
                        error: 'Internal Server Error',
                        message: 'Failed to delete session'
                    });
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Utility method to check if sessions service is available
     * For health checks and testing
     */
    SessionsRouter.isServiceAvailable = function () {
        try {
            return this.sessionService.isHealthy();
        }
        catch (error) {
            logger.error('Session service health check failed', { error: error });
            return false;
        }
    };
    /**
     * Utility method to get current session count
     * For monitoring and diagnostics
     */
    SessionsRouter.getSessionCount = function () {
        try {
            var stats = this.sessionService.getSessionStats();
            return stats.activeSessions;
        }
        catch (error) {
            logger.error('Failed to get session count', { error: error });
            return 0;
        }
    };
    /**
     * Utility method to force session cleanup
     * For administrative operations
     */
    SessionsRouter.forceCleanup = function () {
        try {
            var cleanedCount = this.sessionService.cleanupExpiredSessions();
            logger.info('Forced session cleanup completed', { cleanedCount: cleanedCount });
            return cleanedCount;
        }
        catch (error) {
            logger.error('Failed to force session cleanup', { error: error });
            return 0;
        }
    };
    /**
     * Get session service configuration
     * For debugging and monitoring
     */
    SessionsRouter.getServiceConfig = function () {
        try {
            return this.sessionService.getConfig();
        }
        catch (error) {
            logger.error('Failed to get service config', { error: error });
            return {};
        }
    };
    /**
     * Shutdown sessions service
     * For graceful application shutdown
     */
    SessionsRouter.shutdown = function () {
        try {
            this.sessionService.shutdown();
            logger.info('SessionsRouter service shut down');
        }
        catch (error) {
            logger.error('Error during SessionsRouter shutdown', { error: error });
        }
    };
    SessionsRouter.sessionService = new session_service_1.SessionService();
    return SessionsRouter;
}());
exports.SessionsRouter = SessionsRouter;
