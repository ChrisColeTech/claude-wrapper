"use strict";
/**
 * Tool calling state management service
 * Single Responsibility: Tool calling state management only
 *
 * Manages tool calling state across conversation turns:
 * - Tool call creation and tracking
 * - State transitions and completion
 * - State cleanup and memory management
 * - Tool call history maintenance
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
exports.toolStateManager = exports.ToolStateUtils = exports.ToolStateManager = void 0;
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('ToolStateManager');
/**
 * Tool state manager implementation
 */
var ToolStateManager = /** @class */ (function () {
    function ToolStateManager() {
        this.states = new Map();
        this.snapshots = new Map();
    }
    /**
     * Create new tool call state entry
     */
    ToolStateManager.prototype.createToolCall = function (sessionId, toolCall, metadata) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var startTime, entry, sessionStates, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = Date.now();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        if (!sessionId || !(toolCall === null || toolCall === void 0 ? void 0 : toolCall.id)) {
                            throw new Error('Session ID and tool call ID are required');
                        }
                        entry = {
                            id: toolCall.id,
                            toolCall: toolCall,
                            state: 'pending',
                            createdAt: startTime,
                            updatedAt: startTime,
                            metadata: metadata
                        };
                        // Initialize session state if needed
                        if (!this.states.has(sessionId)) {
                            this.states.set(sessionId, new Map());
                        }
                        sessionStates = this.states.get(sessionId);
                        sessionStates.set(toolCall.id, entry);
                        // Update snapshot
                        return [4 /*yield*/, this.updateSnapshot(sessionId)];
                    case 2:
                        // Update snapshot
                        _b.sent();
                        logger.debug('Tool call state created', {
                            sessionId: sessionId,
                            toolCallId: toolCall.id,
                            functionName: (_a = toolCall["function"]) === null || _a === void 0 ? void 0 : _a.name,
                            processingTime: Date.now() - startTime
                        });
                        return [2 /*return*/, entry];
                    case 3:
                        error_1 = _b.sent();
                        logger.error('Failed to create tool call state', {
                            sessionId: sessionId,
                            toolCallId: toolCall === null || toolCall === void 0 ? void 0 : toolCall.id,
                            error: error_1 instanceof Error ? error_1.message : String(error_1)
                        });
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update tool call state with transition
     */
    ToolStateManager.prototype.updateToolCallState = function (sessionId, request) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, sessionStates, entry, previousState, transitionTime, error_2, transitionTime, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        sessionStates = this.states.get(sessionId);
                        if (!sessionStates) {
                            throw new Error("Session ".concat(sessionId, " not found"));
                        }
                        entry = sessionStates.get(request.toolCallId);
                        if (!entry) {
                            throw new Error("Tool call ".concat(request.toolCallId, " not found in session ").concat(sessionId));
                        }
                        previousState = entry.state;
                        // Validate state transition
                        if (!this.isValidTransition(previousState, request.newState)) {
                            throw new Error("Invalid state transition from ".concat(previousState, " to ").concat(request.newState));
                        }
                        // Update entry
                        entry.state = request.newState;
                        entry.updatedAt = Date.now();
                        if (request.result !== undefined) {
                            entry.result = request.result;
                        }
                        if (request.error) {
                            entry.error = request.error;
                        }
                        if (request.metadata) {
                            entry.metadata = __assign(__assign({}, entry.metadata), request.metadata);
                        }
                        // Set completion timestamp for terminal states
                        if (['completed', 'failed', 'cancelled'].includes(request.newState)) {
                            entry.completedAt = Date.now();
                        }
                        // Update snapshot
                        return [4 /*yield*/, this.updateSnapshot(sessionId)];
                    case 2:
                        // Update snapshot
                        _a.sent();
                        transitionTime = Date.now() - startTime;
                        logger.debug('Tool call state updated', {
                            sessionId: sessionId,
                            toolCallId: request.toolCallId,
                            previousState: previousState,
                            newState: request.newState,
                            transitionTime: transitionTime
                        });
                        return [2 /*return*/, {
                                success: true,
                                previousState: previousState,
                                newState: request.newState,
                                transitionTimeMs: transitionTime
                            }];
                    case 3:
                        error_2 = _a.sent();
                        transitionTime = Date.now() - startTime;
                        errorMessage = error_2 instanceof Error ? error_2.message : String(error_2);
                        logger.error('Failed to update tool call state', {
                            sessionId: sessionId,
                            toolCallId: request.toolCallId,
                            error: errorMessage,
                            transitionTime: transitionTime
                        });
                        return [2 /*return*/, {
                                success: false,
                                transitionTimeMs: transitionTime,
                                error: errorMessage
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get tool call state by ID
     */
    ToolStateManager.prototype.getToolCallState = function (sessionId, toolCallId) {
        return __awaiter(this, void 0, void 0, function () {
            var sessionStates;
            return __generator(this, function (_a) {
                sessionStates = this.states.get(sessionId);
                if (!sessionStates) {
                    return [2 /*return*/, null];
                }
                return [2 /*return*/, sessionStates.get(toolCallId) || null];
            });
        });
    };
    /**
     * Get all pending tool calls for session
     */
    ToolStateManager.prototype.getPendingToolCalls = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.getToolCallsByState(sessionId, ['pending', 'in_progress'])];
            });
        });
    };
    /**
     * Get all completed tool calls for session
     */
    ToolStateManager.prototype.getCompletedToolCalls = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.getToolCallsByState(sessionId, ['completed', 'failed', 'cancelled'])];
            });
        });
    };
    /**
     * Get all tool calls for session
     */
    ToolStateManager.prototype.getAllToolCalls = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var sessionStates;
            return __generator(this, function (_a) {
                sessionStates = this.states.get(sessionId);
                if (!sessionStates) {
                    return [2 /*return*/, []];
                }
                return [2 /*return*/, Array.from(sessionStates.values()).sort(function (a, b) { return a.createdAt - b.createdAt; })];
            });
        });
    };
    /**
     * Get all tool call IDs for session
     */
    ToolStateManager.prototype.getSessionToolCalls = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var sessionStates;
            return __generator(this, function (_a) {
                sessionStates = this.states.get(sessionId);
                if (!sessionStates) {
                    return [2 /*return*/, []];
                }
                return [2 /*return*/, Array.from(sessionStates.keys()).sort()];
            });
        });
    };
    /**
     * Get current state snapshot for session
     */
    ToolStateManager.prototype.getStateSnapshot = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.snapshots.get(sessionId) || null];
            });
        });
    };
    /**
     * Clean up expired tool call states
     */
    ToolStateManager.prototype.cleanupExpiredStates = function (maxAgeMs) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, cutoffTime, cleanedEntries, remainingEntries, bytesFreed, _i, _a, _b, sessionId, sessionStates, toDelete, _c, _d, _e, toolCallId, entry, _f, toDelete_1, toolCallId, cleanupTime, error_3;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        startTime = Date.now();
                        cutoffTime = Date.now() - maxAgeMs;
                        cleanedEntries = 0;
                        remainingEntries = 0;
                        bytesFreed = 0;
                        _g.label = 1;
                    case 1:
                        _g.trys.push([1, 7, , 8]);
                        _i = 0, _a = Array.from(this.states.entries());
                        _g.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 6];
                        _b = _a[_i], sessionId = _b[0], sessionStates = _b[1];
                        toDelete = [];
                        for (_c = 0, _d = Array.from(sessionStates.entries()); _c < _d.length; _c++) {
                            _e = _d[_c], toolCallId = _e[0], entry = _e[1];
                            // Only clean up completed/failed states that are old enough
                            if (['completed', 'failed', 'cancelled'].includes(entry.state) &&
                                (entry.completedAt || entry.updatedAt) < cutoffTime) {
                                toDelete.push(toolCallId);
                                cleanedEntries++;
                                bytesFreed += this.estimateEntrySize(entry);
                            }
                            else {
                                remainingEntries++;
                            }
                        }
                        // Remove expired entries
                        for (_f = 0, toDelete_1 = toDelete; _f < toDelete_1.length; _f++) {
                            toolCallId = toDelete_1[_f];
                            sessionStates["delete"](toolCallId);
                        }
                        if (!(sessionStates.size === 0)) return [3 /*break*/, 3];
                        this.states["delete"](sessionId);
                        this.snapshots["delete"](sessionId);
                        return [3 /*break*/, 5];
                    case 3: 
                    // Update snapshot for sessions with remaining entries
                    return [4 /*yield*/, this.updateSnapshot(sessionId)];
                    case 4:
                        // Update snapshot for sessions with remaining entries
                        _g.sent();
                        _g.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 2];
                    case 6:
                        cleanupTime = Date.now() - startTime;
                        logger.info('State cleanup completed', {
                            cleanedEntries: cleanedEntries,
                            remainingEntries: remainingEntries,
                            cleanupTime: cleanupTime,
                            bytesFreed: bytesFreed
                        });
                        return [2 /*return*/, {
                                cleanedEntries: cleanedEntries,
                                remainingEntries: remainingEntries,
                                cleanupTimeMs: cleanupTime,
                                bytesFreed: bytesFreed
                            }];
                    case 7:
                        error_3 = _g.sent();
                        logger.error('State cleanup failed', {
                            error: error_3 instanceof Error ? error_3.message : String(error_3)
                        });
                        throw error_3;
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Clear all state for a session
     */
    ToolStateManager.prototype.clearSessionState = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                try {
                    this.states["delete"](sessionId);
                    this.snapshots["delete"](sessionId);
                    logger.debug('Session state cleared', { sessionId: sessionId });
                    return [2 /*return*/, true];
                }
                catch (error) {
                    logger.error('Failed to clear session state', {
                        sessionId: sessionId,
                        error: error instanceof Error ? error.message : String(error)
                    });
                    return [2 /*return*/, false];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Get tool calls by state
     */
    ToolStateManager.prototype.getToolCallsByState = function (sessionId, states) {
        return __awaiter(this, void 0, void 0, function () {
            var sessionStates;
            return __generator(this, function (_a) {
                sessionStates = this.states.get(sessionId);
                if (!sessionStates) {
                    return [2 /*return*/, []];
                }
                return [2 /*return*/, Array.from(sessionStates.values())
                        .filter(function (entry) { return states.includes(entry.state); })
                        .sort(function (a, b) { return a.createdAt - b.createdAt; })];
            });
        });
    };
    /**
     * Update state snapshot for session
     */
    ToolStateManager.prototype.updateSnapshot = function (sessionId) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var sessionStates, allCalls, pendingCalls, completedCalls, snapshot;
            return __generator(this, function (_b) {
                sessionStates = this.states.get(sessionId);
                if (!sessionStates) {
                    return [2 /*return*/];
                }
                allCalls = Array.from(sessionStates.values());
                pendingCalls = allCalls.filter(function (entry) { return ['pending', 'in_progress'].includes(entry.state); });
                completedCalls = allCalls.filter(function (entry) { return ['completed', 'failed', 'cancelled'].includes(entry.state); });
                snapshot = {
                    sessionId: sessionId,
                    conversationTurn: this.calculateConversationTurn(allCalls),
                    pendingCalls: pendingCalls,
                    completedCalls: completedCalls,
                    totalCalls: allCalls.length,
                    createdAt: ((_a = this.snapshots.get(sessionId)) === null || _a === void 0 ? void 0 : _a.createdAt) || Date.now(),
                    updatedAt: Date.now()
                };
                this.snapshots.set(sessionId, snapshot);
                return [2 /*return*/];
            });
        });
    };
    /**
     * Calculate current conversation turn
     */
    ToolStateManager.prototype.calculateConversationTurn = function (entries) {
        if (entries.length === 0)
            return 0;
        // Each completed tool call represents a conversation turn
        // Count distinct completed calls
        var completedCount = entries.filter(function (entry) {
            return ['completed', 'failed', 'cancelled'].includes(entry.state);
        }).length;
        // If we have pending calls, add 1 for the current turn
        var hasPending = entries.some(function (entry) {
            return ['pending', 'in_progress'].includes(entry.state);
        });
        return completedCount + (hasPending ? 1 : 0);
    };
    /**
     * Validate state transition
     */
    ToolStateManager.prototype.isValidTransition = function (from, to) {
        var _a;
        var validTransitions = {
            'pending': ['in_progress', 'cancelled'],
            'in_progress': ['completed', 'failed', 'cancelled'],
            'completed': [],
            'failed': [],
            'cancelled': [] // Terminal state
        };
        return ((_a = validTransitions[from]) === null || _a === void 0 ? void 0 : _a.includes(to)) || false;
    };
    /**
     * Estimate memory size of entry
     */
    ToolStateManager.prototype.estimateEntrySize = function (entry) {
        return JSON.stringify(entry).length * 2; // Rough UTF-16 byte estimate
    };
    return ToolStateManager;
}());
exports.ToolStateManager = ToolStateManager;
/**
 * State management utilities
 */
exports.ToolStateUtils = {
    /**
     * Check if state is terminal
     */
    isTerminalState: function (state) {
        return ['completed', 'failed', 'cancelled'].includes(state);
    },
    /**
     * Check if state is active
     */
    isActiveState: function (state) {
        return ['pending', 'in_progress'].includes(state);
    },
    /**
     * Get state priority for sorting
     */
    getStatePriority: function (state) {
        var priorities = {
            'in_progress': 0,
            'pending': 1,
            'completed': 2,
            'failed': 3,
            'cancelled': 4
        };
        return priorities[state] !== undefined ? priorities[state] : 999;
    },
    /**
     * Filter entries by age
     */
    filterByAge: function (entries, maxAgeMs) {
        var cutoff = Date.now() - maxAgeMs;
        return entries.filter(function (entry) { return entry.createdAt >= cutoff; });
    },
    /**
     * Get completion rate for entries
     */
    getCompletionRate: function (entries) {
        if (entries.length === 0)
            return 0;
        var completed = entries.filter(function (entry) { return entry.state === 'completed'; }).length;
        return completed / entries.length;
    }
};
exports.toolStateManager = new ToolStateManager();
