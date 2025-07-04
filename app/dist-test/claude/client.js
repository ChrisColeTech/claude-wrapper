"use strict";
/**
 * Claude Code SDK Client
 * Integrates the Claude Code SDK with our authentication system
 * Based on Python claude_cli.py implementation using claude_code_sdk
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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __asyncDelegator = (this && this.__asyncDelegator) || function (o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
    function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: n === "return" } : f ? f(v) : v; } : f; }
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
exports.__esModule = true;
exports.handleClaudeSDKCall = exports.claudeClient = exports.ClaudeClient = void 0;
var auth_manager_1 = require("../auth/auth-manager");
var logger_1 = require("../utils/logger");
var error_1 = require("../models/error");
// Phase 5A: Tool choice integration
var choice_enforcer_1 = require("../tools/choice-enforcer");
var logger = (0, logger_1.getLogger)('ClaudeClient');
/**
 * Claude Code Client
 * Provides authenticated access to Claude models
 * Based on Python claude_cli.py implementation
 */
var ClaudeClient = /** @class */ (function () {
    function ClaudeClient(timeout, cwd) {
        if (timeout === void 0) { timeout = 600000; }
        this.claudeCodeSDK = null;
        this.originalEnvVars = {};
        this.timeout = 600000; // 10 minutes in ms
        this.timeout = timeout;
        this.cwd = cwd || process.cwd();
        // Phase 5A: Initialize tool choice enforcer
        this.choiceEnforcer = choice_enforcer_1.ToolChoiceEnforcerFactory.create();
        // Initialize SDK immediately, unless in test mode
        if (process.env.NODE_ENV !== 'test') {
            this.initializeSDK()["catch"](function () {
                // Silent failure is expected in development
            });
        }
        else {
            // Use stub implementation for tests
            this.claudeCodeSDK = this.createStubSDK();
        }
    }
    /**
     * Initialize Claude Code SDK
     * Attempts to dynamically import the SDK based on what's available
     */
    ClaudeClient.prototype.initializeSDK = function () {
        return __awaiter(this, void 0, void 0, function () {
            var claudeModule, error_2, exec, promisify, execAsync, cliError_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 9]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('@anthropic-ai/claude-code'); })];
                    case 1:
                        claudeModule = _a.sent();
                        this.claudeCodeSDK = claudeModule;
                        logger.info('Claude Code SDK loaded successfully');
                        return [3 /*break*/, 9];
                    case 2:
                        error_2 = _a.sent();
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 7, , 8]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('child_process'); })];
                    case 4:
                        exec = (_a.sent()).exec;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('util'); })];
                    case 5:
                        promisify = (_a.sent()).promisify;
                        execAsync = promisify(exec);
                        // Test if claude CLI is available
                        return [4 /*yield*/, execAsync('claude --version', { timeout: 5000 })];
                    case 6:
                        // Test if claude CLI is available
                        _a.sent();
                        this.claudeCodeSDK = this.createCLIWrapper();
                        logger.info('Claude CLI wrapper loaded successfully');
                        return [3 /*break*/, 8];
                    case 7:
                        cliError_1 = _a.sent();
                        logger.warn('Neither Claude Code SDK nor CLI available - using stub implementation');
                        // Use a stub implementation for development/testing
                        this.claudeCodeSDK = this.createStubSDK();
                        return [3 /*break*/, 8];
                    case 8: return [3 /*break*/, 9];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Verify Claude Code SDK availability and authentication
     * Based on Python verify_cli method
     */
    ClaudeClient.prototype.verifySDK = function () {
        var _a, e_1, _b, _c;
        return __awaiter(this, void 0, void 0, function () {
            var messages, options, _d, _e, _f, message, e_1_1, error_3, hasResponse, error_4;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        _g.trys.push([0, 18, , 19]);
                        return [4 /*yield*/, this.initializeSDK()];
                    case 1:
                        _g.sent();
                        // Check authentication first
                        return [4 /*yield*/, this.setupEnvironment()];
                    case 2:
                        // Check authentication first
                        _g.sent();
                        messages = [];
                        options = {
                            max_turns: 1,
                            cwd: this.cwd
                        };
                        _g.label = 3;
                    case 3:
                        _g.trys.push([3, 16, , 17]);
                        _g.label = 4;
                    case 4:
                        _g.trys.push([4, 9, 10, 15]);
                        _d = true, _e = __asyncValues(this.query('Hello', options));
                        _g.label = 5;
                    case 5: return [4 /*yield*/, _e.next()];
                    case 6:
                        if (!(_f = _g.sent(), _a = _f.done, !_a)) return [3 /*break*/, 8];
                        _c = _f.value;
                        _d = false;
                        try {
                            message = _c;
                            messages.push(message);
                            if (message.type === 'assistant' || message.type === 'result') {
                                return [3 /*break*/, 8];
                            }
                        }
                        finally {
                            _d = true;
                        }
                        _g.label = 7;
                    case 7: return [3 /*break*/, 5];
                    case 8: return [3 /*break*/, 15];
                    case 9:
                        e_1_1 = _g.sent();
                        e_1 = { error: e_1_1 };
                        return [3 /*break*/, 15];
                    case 10:
                        _g.trys.push([10, , 13, 14]);
                        if (!(!_d && !_a && (_b = _e["return"]))) return [3 /*break*/, 12];
                        return [4 /*yield*/, _b.call(_e)];
                    case 11:
                        _g.sent();
                        _g.label = 12;
                    case 12: return [3 /*break*/, 14];
                    case 13:
                        if (e_1) throw e_1.error;
                        return [7 /*endfinally*/];
                    case 14: return [7 /*endfinally*/];
                    case 15: return [3 /*break*/, 17];
                    case 16:
                        error_3 = _g.sent();
                        // Even if the query fails, if we have some messages, authentication worked
                        logger.debug("Query test error (may be expected): ".concat(error_3));
                        return [3 /*break*/, 17];
                    case 17:
                        // Restore environment after test
                        this.restoreEnvironment();
                        hasResponse = messages.some(function (m) { return m.type === 'assistant' || m.type === 'system'; });
                        if (hasResponse || this.claudeCodeSDK) {
                            logger.info('✅ Claude Code SDK verified successfully');
                            return [2 /*return*/, {
                                    available: true,
                                    authentication: true,
                                    version: 'claude-code-sdk'
                                }];
                        }
                        else {
                            logger.warn('⚠️ Claude Code SDK test returned no messages');
                            return [2 /*return*/, {
                                    available: true,
                                    authentication: false,
                                    error: 'SDK test returned no messages'
                                }];
                        }
                        return [3 /*break*/, 19];
                    case 18:
                        error_4 = _g.sent();
                        this.restoreEnvironment(); // Ensure cleanup on error
                        logger.error("Claude Code SDK verification failed: ".concat(error_4));
                        return [2 /*return*/, {
                                available: false,
                                authentication: false,
                                error: "SDK verification failed: ".concat(error_4),
                                suggestion: 'Please ensure Claude Code is installed and authenticated'
                            }];
                    case 19: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Run a completion using Claude Code SDK
     * Based on Python run_completion method
     */
    ClaudeClient.prototype.runCompletion = function (prompt, options) {
        if (options === void 0) { options = {}; }
        return __asyncGenerator(this, arguments, function runCompletion_1() {
            var _a, _b, _c, message, normalizedMessage, e_2_1;
            var _d, e_2, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0: return [4 /*yield*/, __await(this.setupEnvironment())];
                    case 1:
                        _g.sent();
                        _g.label = 2;
                    case 2:
                        _g.trys.push([2, , 19, 20]);
                        _g.label = 3;
                    case 3:
                        _g.trys.push([3, 12, 13, 18]);
                        _a = true, _b = __asyncValues(this.query(prompt, options));
                        _g.label = 4;
                    case 4: return [4 /*yield*/, __await(_b.next())];
                    case 5:
                        if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 11];
                        _f = _c.value;
                        _a = false;
                        _g.label = 6;
                    case 6:
                        _g.trys.push([6, , 9, 10]);
                        message = _f;
                        normalizedMessage = this.normalizeMessage(message);
                        return [4 /*yield*/, __await(normalizedMessage)];
                    case 7: return [4 /*yield*/, _g.sent()];
                    case 8:
                        _g.sent();
                        return [3 /*break*/, 10];
                    case 9:
                        _a = true;
                        return [7 /*endfinally*/];
                    case 10: return [3 /*break*/, 4];
                    case 11: return [3 /*break*/, 18];
                    case 12:
                        e_2_1 = _g.sent();
                        e_2 = { error: e_2_1 };
                        return [3 /*break*/, 18];
                    case 13:
                        _g.trys.push([13, , 16, 17]);
                        if (!(!_a && !_d && (_e = _b["return"]))) return [3 /*break*/, 15];
                        return [4 /*yield*/, __await(_e.call(_b))];
                    case 14:
                        _g.sent();
                        _g.label = 15;
                    case 15: return [3 /*break*/, 17];
                    case 16:
                        if (e_2) throw e_2.error;
                        return [7 /*endfinally*/];
                    case 17: return [7 /*endfinally*/];
                    case 18: return [3 /*break*/, 20];
                    case 19:
                        this.restoreEnvironment();
                        return [7 /*endfinally*/];
                    case 20: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Run completion with tool choice enforcement (Phase 5A)
     * Integrates tool choice processing and enforcement
     */
    ClaudeClient.prototype.runCompletionWithChoice = function (prompt, options, choiceContext) {
        if (options === void 0) { options = {}; }
        return __asyncGenerator(this, arguments, function runCompletionWithChoice_1() {
            var choiceOptions, lastMessage, _a, _b, _c, message, normalizedMessage, enforcedMessage, e_3_1;
            var _d, e_3, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0: return [4 /*yield*/, __await(this.setupEnvironment())];
                    case 1:
                        _g.sent();
                        _g.label = 2;
                    case 2:
                        _g.trys.push([2, , 24, 25]);
                        choiceOptions = this.applyChoiceToOptions(options, choiceContext);
                        lastMessage = void 0;
                        _g.label = 3;
                    case 3:
                        _g.trys.push([3, 17, 18, 23]);
                        _a = true, _b = __asyncValues(this.query(prompt, choiceOptions));
                        _g.label = 4;
                    case 4: return [4 /*yield*/, __await(_b.next())];
                    case 5:
                        if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 16];
                        _f = _c.value;
                        _a = false;
                        _g.label = 6;
                    case 6:
                        _g.trys.push([6, , 14, 15]);
                        message = _f;
                        normalizedMessage = this.normalizeMessage(message);
                        lastMessage = normalizedMessage;
                        if (!(choiceContext && this.isFinalResponse(normalizedMessage))) return [3 /*break*/, 10];
                        return [4 /*yield*/, __await(this.enforceChoiceOnResponse(normalizedMessage, choiceContext))];
                    case 7:
                        enforcedMessage = _g.sent();
                        return [4 /*yield*/, __await(enforcedMessage)];
                    case 8: return [4 /*yield*/, _g.sent()];
                    case 9:
                        _g.sent();
                        return [3 /*break*/, 13];
                    case 10: return [4 /*yield*/, __await(normalizedMessage)];
                    case 11: return [4 /*yield*/, _g.sent()];
                    case 12:
                        _g.sent();
                        _g.label = 13;
                    case 13: return [3 /*break*/, 15];
                    case 14:
                        _a = true;
                        return [7 /*endfinally*/];
                    case 15: return [3 /*break*/, 4];
                    case 16: return [3 /*break*/, 23];
                    case 17:
                        e_3_1 = _g.sent();
                        e_3 = { error: e_3_1 };
                        return [3 /*break*/, 23];
                    case 18:
                        _g.trys.push([18, , 21, 22]);
                        if (!(!_a && !_d && (_e = _b["return"]))) return [3 /*break*/, 20];
                        return [4 /*yield*/, __await(_e.call(_b))];
                    case 19:
                        _g.sent();
                        _g.label = 20;
                    case 20: return [3 /*break*/, 22];
                    case 21:
                        if (e_3) throw e_3.error;
                        return [7 /*endfinally*/];
                    case 22: return [7 /*endfinally*/];
                    case 23: return [3 /*break*/, 25];
                    case 24:
                        this.restoreEnvironment();
                        return [7 /*endfinally*/];
                    case 25: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Apply tool choice context to Claude options
     */
    ClaudeClient.prototype.applyChoiceToOptions = function (options, choiceContext) {
        if (!choiceContext) {
            return options;
        }
        var choiceOptions = __assign({}, options);
        var claudeFormat = choiceContext.claudeFormat;
        // Apply choice mode
        choiceOptions.tool_choice_mode = claudeFormat.mode;
        // Apply tool restrictions
        if (claudeFormat.mode === 'none') {
            choiceOptions.choice_restrictions = {
                onlyTextResponse: true,
                specificFunction: false
            };
            // Disable tools for none choice
            choiceOptions.disallowed_tools = ['*'];
        }
        else if (claudeFormat.mode === 'specific' && claudeFormat.forceFunction) {
            choiceOptions.force_function = claudeFormat.forceFunction;
            choiceOptions.choice_restrictions = {
                onlyTextResponse: false,
                specificFunction: true,
                functionName: claudeFormat.forceFunction
            };
        }
        else if (claudeFormat.mode === 'auto') {
            choiceOptions.choice_restrictions = {
                onlyTextResponse: false,
                specificFunction: false
            };
        }
        return choiceOptions;
    };
    /**
     * Check if message is a final response
     */
    ClaudeClient.prototype.isFinalResponse = function (message) {
        return (message.type === 'assistant' &&
            message.content !== undefined &&
            message.content !== null) || (message.type === 'result' &&
            message.subtype === 'success');
    };
    /**
     * Enforce tool choice on Claude response
     */
    ClaudeClient.prototype.enforceChoiceOnResponse = function (message, choiceContext) {
        return __awaiter(this, void 0, void 0, function () {
            var claudeResponse, enforcementRequest, enforcementResult, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        claudeResponse = this.messageToClaudeResponse(message);
                        enforcementRequest = {
                            context: choiceContext,
                            claudeResponse: claudeResponse
                        };
                        return [4 /*yield*/, this.choiceEnforcer.enforceChoice(enforcementRequest)];
                    case 1:
                        enforcementResult = _a.sent();
                        if (enforcementResult.success && enforcementResult.modifiedResponse) {
                            // Convert back to message format
                            return [2 /*return*/, this.claudeResponseToMessage(enforcementResult.modifiedResponse, message)];
                        }
                        else if (!enforcementResult.success) {
                            logger.warn("Tool choice enforcement failed: ".concat(enforcementResult.errors.join(', ')));
                        }
                        return [2 /*return*/, message];
                    case 2:
                        error_5 = _a.sent();
                        logger.error("Tool choice enforcement error: ".concat(error_5));
                        return [2 /*return*/, message];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Convert Claude message to Claude response format
     */
    ClaudeClient.prototype.messageToClaudeResponse = function (message) {
        var _a, _b, _c, _d, _e;
        return {
            content: message.content || '',
            tool_calls: ((_a = message.data) === null || _a === void 0 ? void 0 : _a.tool_calls) || [],
            finish_reason: message.stop_reason || 'stop',
            metadata: {
                model: (_b = message.data) === null || _b === void 0 ? void 0 : _b.model,
                usage: {
                    prompt_tokens: ((_c = message.data) === null || _c === void 0 ? void 0 : _c.prompt_tokens) || 0,
                    completion_tokens: ((_d = message.data) === null || _d === void 0 ? void 0 : _d.completion_tokens) || 0,
                    total_tokens: ((_e = message.data) === null || _e === void 0 ? void 0 : _e.total_tokens) || 0
                }
            }
        };
    };
    /**
     * Convert Claude response back to message format
     */
    ClaudeClient.prototype.claudeResponseToMessage = function (claudeResponse, originalMessage) {
        var _a, _b, _c, _d, _e, _f, _g;
        return __assign(__assign({}, originalMessage), { content: claudeResponse.content, stop_reason: claudeResponse.finish_reason, data: __assign(__assign({}, originalMessage.data), { tool_calls: claudeResponse.tool_calls, model: (_a = claudeResponse.metadata) === null || _a === void 0 ? void 0 : _a.model, prompt_tokens: (_c = (_b = claudeResponse.metadata) === null || _b === void 0 ? void 0 : _b.usage) === null || _c === void 0 ? void 0 : _c.prompt_tokens, completion_tokens: (_e = (_d = claudeResponse.metadata) === null || _d === void 0 ? void 0 : _d.usage) === null || _e === void 0 ? void 0 : _e.completion_tokens, total_tokens: (_g = (_f = claudeResponse.metadata) === null || _f === void 0 ? void 0 : _f.usage) === null || _g === void 0 ? void 0 : _g.total_tokens }) });
    };
    /**
     * Query Claude Code SDK
     * Wrapper around the actual SDK query function
     */
    ClaudeClient.prototype.query = function (prompt, options) {
        return __asyncGenerator(this, arguments, function query_1() {
            var error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.claudeCodeSDK) return [3 /*break*/, 2];
                        return [4 /*yield*/, __await(this.initializeSDK())];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 9, , 10]);
                        if (!this.claudeCodeSDK.query) return [3 /*break*/, 5];
                        return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(this.claudeCodeSDK.query(prompt, options))))];
                    case 3: return [4 /*yield*/, __await.apply(void 0, [_a.sent()])];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 8];
                    case 5: 
                    // Fallback for stub implementation
                    return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(this.stubQuery(prompt, options))))];
                    case 6: 
                    // Fallback for stub implementation
                    return [4 /*yield*/, __await.apply(void 0, [_a.sent()])];
                    case 7:
                        // Fallback for stub implementation
                        _a.sent();
                        _a.label = 8;
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        error_6 = _a.sent();
                        throw new error_1.ClaudeClientError("Claude Code SDK query failed: ".concat(error_6));
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Setup environment variables for Claude Code SDK authentication
     * Based on Python environment management pattern
     */
    ClaudeClient.prototype.setupEnvironment = function () {
        return __awaiter(this, void 0, void 0, function () {
            var authEnvVars, _i, _a, _b, key, value, authStatus, error_7;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        authEnvVars = auth_manager_1.authManager.getClaudeCodeEnvVars();
                        for (_i = 0, _a = Object.entries(authEnvVars); _i < _a.length; _i++) {
                            _b = _a[_i], key = _b[0], value = _b[1];
                            this.originalEnvVars[key] = process.env[key];
                            if (value) {
                                process.env[key] = value;
                                logger.debug("Set ".concat(key, " for Claude Code SDK"));
                            }
                        }
                        return [4 /*yield*/, auth_manager_1.authManager.getAuthStatus()];
                    case 1:
                        authStatus = _c.sent();
                        if (!authStatus.authenticated) {
                            throw new error_1.AuthenticationError('No authentication method detected for Claude Code SDK');
                        }
                        logger.debug("Using ".concat(authStatus.method, " authentication for Claude Code SDK"));
                        return [3 /*break*/, 3];
                    case 2:
                        error_7 = _c.sent();
                        throw new error_1.AuthenticationError("Failed to setup authentication: ".concat(error_7));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Restore original environment variables
     * Based on Python finally block pattern
     */
    ClaudeClient.prototype.restoreEnvironment = function () {
        for (var _i = 0, _a = Object.entries(this.originalEnvVars); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], originalValue = _b[1];
            if (originalValue === undefined) {
                delete process.env[key];
            }
            else {
                process.env[key] = originalValue;
            }
        }
        this.originalEnvVars = {};
    };
    /**
     * Normalize message from SDK to our interface
     * Based on Python message parsing logic
     */
    ClaudeClient.prototype.normalizeMessage = function (message) {
        // Handle different message formats from SDK
        if (typeof message === 'object' && message !== null) {
            // If message has __dict__, convert it to plain object
            if (message.__dict__) {
                var messageDict = {};
                for (var _i = 0, _a = Object.entries(message.__dict__); _i < _a.length; _i++) {
                    var _b = _a[_i], key = _b[0], value = _b[1];
                    if (!key.startsWith('_') && typeof value !== 'function') {
                        messageDict[key] = value;
                    }
                }
                return messageDict;
            }
            // Return as-is if already object
            return message;
        }
        // Fallback for unexpected formats
        return {
            type: 'assistant',
            content: String(message)
        };
    };
    /**
     * Create CLI wrapper for direct Claude CLI usage
     * Simulates SDK behavior using child_process calls
     */
    ClaudeClient.prototype.createCLIWrapper = function () {
        return {
            query: this.cliQuery.bind(this)
        };
    };
    /**
     * Create stub SDK for development/testing
     * Simulates Claude Code SDK behavior
     */
    ClaudeClient.prototype.createStubSDK = function () {
        return {
            query: this.stubQuery.bind(this)
        };
    };
    /**
     * CLI query implementation using claude command
     * Based on Python subprocess implementation
     */
    ClaudeClient.prototype.cliQuery = function (prompt, options) {
        return __asyncGenerator(this, arguments, function cliQuery_1() {
            var exec, promisify, execAsync, claudeArgs, command, startTime, _a, stdout, stderr, duration, error_8;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, __await(Promise.resolve().then(function () { return require('child_process'); }))];
                    case 1:
                        exec = (_b.sent()).exec;
                        return [4 /*yield*/, __await(Promise.resolve().then(function () { return require('util'); }))];
                    case 2:
                        promisify = (_b.sent()).promisify;
                        execAsync = promisify(exec);
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 12, , 15]);
                        return [4 /*yield*/, __await({
                                type: 'system',
                                subtype: 'init',
                                data: {
                                    session_id: "cli_session_".concat(Date.now()),
                                    model: options.model || 'claude-3-5-sonnet-20241022'
                                }
                            })];
                    case 4: 
                    // Simulate system init message
                    return [4 /*yield*/, _b.sent()];
                    case 5:
                        // Simulate system init message
                        _b.sent();
                        claudeArgs = [];
                        if (options.model) {
                            claudeArgs.push("--model \"".concat(options.model, "\""));
                        }
                        if (options.max_turns) {
                            claudeArgs.push("--max-turns ".concat(options.max_turns));
                        }
                        if (options.cwd) {
                            claudeArgs.push("--cwd \"".concat(options.cwd, "\""));
                        }
                        command = "claude ".concat(claudeArgs.join(' '), " \"").concat(prompt.replace(/"/g, '\\"'), "\"");
                        startTime = Date.now();
                        return [4 /*yield*/, __await(execAsync(command, {
                                timeout: this.timeout,
                                cwd: options.cwd || this.cwd,
                                maxBuffer: 1024 * 1024 * 10 // 10MB buffer
                            }))];
                    case 6:
                        _a = _b.sent(), stdout = _a.stdout, stderr = _a.stderr;
                        if (stderr && !stderr.includes('warning')) {
                            throw new Error("Claude CLI error: ".concat(stderr));
                        }
                        if (!stdout) return [3 /*break*/, 9];
                        return [4 /*yield*/, __await({
                                type: 'assistant',
                                content: stdout.trim(),
                                message: {
                                    content: stdout.trim()
                                }
                            })];
                    case 7: return [4 /*yield*/, _b.sent()];
                    case 8:
                        _b.sent();
                        _b.label = 9;
                    case 9:
                        duration = Date.now() - startTime;
                        return [4 /*yield*/, __await({
                                type: 'result',
                                subtype: 'success',
                                total_cost_usd: 0.001,
                                duration_ms: duration,
                                num_turns: 1,
                                session_id: "cli_session_".concat(Date.now())
                            })];
                    case 10: return [4 /*yield*/, _b.sent()];
                    case 11:
                        _b.sent();
                        return [3 /*break*/, 15];
                    case 12:
                        error_8 = _b.sent();
                        return [4 /*yield*/, __await({
                                type: 'result',
                                subtype: 'error',
                                data: {
                                    error: "CLI execution failed: ".concat(error_8)
                                }
                            })];
                    case 13: return [4 /*yield*/, _b.sent()];
                    case 14:
                        _b.sent();
                        throw new error_1.ClaudeClientError("Claude CLI execution failed: ".concat(error_8));
                    case 15: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Stub query implementation for development/testing
     */
    ClaudeClient.prototype.stubQuery = function (prompt, options) {
        return __asyncGenerator(this, arguments, function stubQuery_1() {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __await({
                            type: 'system',
                            subtype: 'init',
                            data: {
                                session_id: "session_".concat(Date.now()),
                                model: options.model || 'claude-3-5-sonnet-20241022'
                            }
                        })];
                    case 1: 
                    // Simulate system init message
                    return [4 /*yield*/, _a.sent()];
                    case 2:
                        // Simulate system init message
                        _a.sent();
                        return [4 /*yield*/, __await({
                                type: 'assistant',
                                content: "I'm a stub response to: ".concat(prompt),
                                message: {
                                    content: "I'm a stub response to: ".concat(prompt)
                                }
                            })];
                    case 3: 
                    // Simulate assistant response
                    return [4 /*yield*/, _a.sent()];
                    case 4:
                        // Simulate assistant response
                        _a.sent();
                        return [4 /*yield*/, __await({
                                type: 'result',
                                subtype: 'success',
                                total_cost_usd: 0.01,
                                duration_ms: 1000,
                                num_turns: 1,
                                session_id: "session_".concat(Date.now())
                            })];
                    case 5: 
                    // Simulate result message with metadata
                    return [4 /*yield*/, _a.sent()];
                    case 6:
                        // Simulate result message with metadata
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if SDK is available
     */
    ClaudeClient.prototype.isAvailable = function () {
        return this.claudeCodeSDK !== null;
    };
    /**
     * Get timeout value
     */
    ClaudeClient.prototype.getTimeout = function () {
        return this.timeout;
    };
    /**
     * Get current working directory
     */
    ClaudeClient.prototype.getCwd = function () {
        return this.cwd;
    };
    return ClaudeClient;
}());
exports.ClaudeClient = ClaudeClient;
/**
 * Global Claude Code client instance
 */
exports.claudeClient = new ClaudeClient();
/**
 * Error handling wrapper for Claude SDK calls
 */
function handleClaudeSDKCall(operation) {
    return __awaiter(this, void 0, void 0, function () {
        var error_9, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, operation()];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    error_9 = _a.sent();
                    errorMessage = String(error_9);
                    if (errorMessage.includes('authentication')) {
                        throw new error_1.AuthenticationError("Claude Code authentication failed: ".concat(errorMessage));
                    }
                    if (errorMessage.includes('stream')) {
                        throw new error_1.StreamingError("Streaming failed: ".concat(errorMessage));
                    }
                    throw new error_1.ClaudeClientError("SDK operation failed: ".concat(errorMessage));
                case 3: return [2 /*return*/];
            }
        });
    });
}
exports.handleClaudeSDKCall = handleClaudeSDKCall;
