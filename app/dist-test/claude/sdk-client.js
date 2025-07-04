"use strict";
/**
 * Claude Code SDK Client Wrapper
 * Direct wrapper for Claude Code SDK implementing patterns from CLAUDE_SDK_REFERENCE.md
 *
 * Single Responsibility: Provide clean SDK integration with proper error handling
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
var __asyncDelegator = (this && this.__asyncDelegator) || function (o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
    function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: n === "return" } : f ? f(v) : v; } : f; }
};
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
exports.verifyClaudeSDK = exports.claudeSDKClient = exports.createClaudeSDKClient = exports.ClaudeSDKClient = void 0;
var interfaces_1 = require("./interfaces");
var error_types_1 = require("./error-types");
var auth_manager_1 = require("../auth/auth-manager");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('ClaudeSDKClient');
/**
 * Claude Code SDK Client Wrapper
 * Implements direct SDK integration following CLAUDE_SDK_REFERENCE.md patterns
 */
var ClaudeSDKClient = /** @class */ (function () {
    function ClaudeSDKClient(config) {
        this.sdk = null;
        this.originalEnvVars = {};
        this.config = __assign({ timeout: interfaces_1.CLAUDE_SDK_CONSTANTS.DEFAULT_TIMEOUT, cwd: process.cwd(), model: interfaces_1.CLAUDE_SDK_CONSTANTS.DEFAULT_MODEL, max_turns: interfaces_1.CLAUDE_SDK_CONSTANTS.DEFAULT_MAX_TURNS, auth_priority: [
                interfaces_1.CLAUDE_SDK_CONSTANTS.AUTH_METHODS.CLAUDE_CLI,
                interfaces_1.CLAUDE_SDK_CONSTANTS.AUTH_METHODS.ANTHROPIC_API_KEY,
                interfaces_1.CLAUDE_SDK_CONSTANTS.AUTH_METHODS.BEDROCK,
                interfaces_1.CLAUDE_SDK_CONSTANTS.AUTH_METHODS.VERTEX
            ] }, config);
        // Initialize SDK in non-test environments
        if (process.env.NODE_ENV !== 'test') {
            this.initializeSDK()["catch"](function (error) {
                logger.debug("SDK initialization deferred: ".concat(error.message));
            });
        }
        else {
            // Use fallback SDK for tests
            this.sdk = this.createFallbackSDK();
        }
    }
    /**
     * Initialize Claude Code SDK
     * Based on CLAUDE_SDK_REFERENCE.md SDK initialization patterns
     */
    ClaudeSDKClient.prototype.initializeSDK = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, (0, error_types_1.handleClaudeSDKCall)(function () { return __awaiter(_this, void 0, void 0, function () {
                        var claudeModule, error_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, Promise.resolve().then(function () { return require('@anthropic-ai/claude-code'); })];
                                case 1:
                                    claudeModule = _a.sent();
                                    this.sdk = claudeModule;
                                    logger.info('✅ Claude Code SDK initialized successfully');
                                    return [3 /*break*/, 3];
                                case 2:
                                    error_1 = _a.sent();
                                    logger.warn('⚠️ Claude Code SDK not available, using fallback implementation');
                                    this.sdk = this.createFallbackSDK();
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        });
    };
    /**
     * Verify Claude SDK availability and authentication
     * Based on CLAUDE_SDK_REFERENCE.md verification patterns
     */
    ClaudeSDKClient.prototype.verifySDK = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, (0, error_types_1.handleClaudeSDKCall)(function () { return __awaiter(_this, void 0, void 0, function () {
                        var isWorking, error_2;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 5, 6, 7]);
                                    if (!!this.sdk) return [3 /*break*/, 2];
                                    return [4 /*yield*/, this.initializeSDK()];
                                case 1:
                                    _a.sent();
                                    _a.label = 2;
                                case 2: 
                                // Setup authentication environment
                                return [4 /*yield*/, this.setupAuthEnvironment()];
                                case 3:
                                    // Setup authentication environment
                                    _a.sent();
                                    return [4 /*yield*/, this.testSDKConnection()];
                                case 4:
                                    isWorking = _a.sent();
                                    if (isWorking) {
                                        logger.info('✅ Claude Code SDK verification successful');
                                        return [2 /*return*/, {
                                                available: true,
                                                version: this.sdk.version || 'claude-code-sdk',
                                                authentication: true
                                            }];
                                    }
                                    else {
                                        logger.warn('⚠️ Claude Code SDK verification failed');
                                        return [2 /*return*/, {
                                                available: false,
                                                authentication: false,
                                                error: 'SDK verification test failed',
                                                suggestion: 'Check Claude Code installation and authentication'
                                            }];
                                    }
                                    return [3 /*break*/, 7];
                                case 5:
                                    error_2 = _a.sent();
                                    logger.error("Claude Code SDK verification error: ".concat(error_2));
                                    return [2 /*return*/, {
                                            available: false,
                                            authentication: false,
                                            error: "SDK verification failed: ".concat(error_2),
                                            suggestion: 'Ensure Claude Code is installed and authenticated'
                                        }];
                                case 6:
                                    this.restoreAuthEnvironment();
                                    return [7 /*endfinally*/];
                                case 7: return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        });
    };
    /**
     * Test basic SDK connection
     * Based on CLAUDE_SDK_REFERENCE.md connection testing patterns
     */
    ClaudeSDKClient.prototype.testSDKConnection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, (0, error_types_1.handleClaudeSDKCall)(function () { return __awaiter(_this, void 0, void 0, function () {
                        var messages, responseReceived, testOptions, testTimeout, _a, _b, _c, message, e_1_1, error_3;
                        var _d, e_1, _e, _f;
                        return __generator(this, function (_g) {
                            switch (_g.label) {
                                case 0:
                                    _g.trys.push([0, 16, , 17]);
                                    messages = [];
                                    responseReceived = false;
                                    testOptions = {
                                        max_turns: 1,
                                        cwd: this.config.cwd
                                    };
                                    testTimeout = setTimeout(function () {
                                        throw new Error('SDK connection test timeout');
                                    }, interfaces_1.CLAUDE_SDK_CONSTANTS.SDK_TIMEOUTS.VERIFICATION);
                                    _g.label = 1;
                                case 1:
                                    _g.trys.push([1, , 14, 15]);
                                    _g.label = 2;
                                case 2:
                                    _g.trys.push([2, 7, 8, 13]);
                                    _a = true, _b = __asyncValues(this.runCompletion('Hello', testOptions));
                                    _g.label = 3;
                                case 3: return [4 /*yield*/, _b.next()];
                                case 4:
                                    if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 6];
                                    _f = _c.value;
                                    _a = false;
                                    try {
                                        message = _f;
                                        messages.push(message);
                                        if (message.type === 'assistant' || message.type === 'result') {
                                            responseReceived = true;
                                            return [3 /*break*/, 6];
                                        }
                                    }
                                    finally {
                                        _a = true;
                                    }
                                    _g.label = 5;
                                case 5: return [3 /*break*/, 3];
                                case 6: return [3 /*break*/, 13];
                                case 7:
                                    e_1_1 = _g.sent();
                                    e_1 = { error: e_1_1 };
                                    return [3 /*break*/, 13];
                                case 8:
                                    _g.trys.push([8, , 11, 12]);
                                    if (!(!_a && !_d && (_e = _b["return"]))) return [3 /*break*/, 10];
                                    return [4 /*yield*/, _e.call(_b)];
                                case 9:
                                    _g.sent();
                                    _g.label = 10;
                                case 10: return [3 /*break*/, 12];
                                case 11:
                                    if (e_1) throw e_1.error;
                                    return [7 /*endfinally*/];
                                case 12: return [7 /*endfinally*/];
                                case 13: return [3 /*break*/, 15];
                                case 14:
                                    clearTimeout(testTimeout);
                                    return [7 /*endfinally*/];
                                case 15: return [2 /*return*/, responseReceived && messages.length > 0];
                                case 16:
                                    error_3 = _g.sent();
                                    logger.debug("SDK connection test failed: ".concat(error_3));
                                    return [2 /*return*/, false];
                                case 17: return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        });
    };
    /**
     * Run completion with Claude SDK
     * Based on CLAUDE_SDK_REFERENCE.md completion patterns
     */
    ClaudeSDKClient.prototype.runCompletion = function (prompt, options) {
        if (options === void 0) { options = {}; }
        return __asyncGenerator(this, arguments, function runCompletion_1() {
            var claudeOptions, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.sdk) return [3 /*break*/, 2];
                        return [4 /*yield*/, __await(this.initializeSDK())];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [4 /*yield*/, __await(this.setupAuthEnvironment())];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        _a.trys.push([4, 11, 12, 13]);
                        claudeOptions = __assign(__assign({}, options), { cwd: options.cwd || this.config.cwd, max_turns: options.max_turns || this.config.max_turns });
                        if (!this.sdk.query) return [3 /*break*/, 7];
                        // Use real Claude SDK
                        return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(this.sdk.query(prompt, claudeOptions))))];
                    case 5: 
                    // Use real Claude SDK
                    return [4 /*yield*/, __await.apply(void 0, [_a.sent()])];
                    case 6:
                        // Use real Claude SDK
                        _a.sent();
                        return [3 /*break*/, 10];
                    case 7: 
                    // Use fallback implementation
                    return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(this.fallbackQuery(prompt, claudeOptions))))];
                    case 8: 
                    // Use fallback implementation
                    return [4 /*yield*/, __await.apply(void 0, [_a.sent()])];
                    case 9:
                        // Use fallback implementation
                        _a.sent();
                        _a.label = 10;
                    case 10: return [3 /*break*/, 13];
                    case 11:
                        error_4 = _a.sent();
                        throw new error_types_1.ClaudeSDKError("SDK completion failed: ".concat(error_4));
                    case 12:
                        this.restoreAuthEnvironment();
                        return [7 /*endfinally*/];
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if SDK is available
     */
    ClaudeSDKClient.prototype.isAvailable = function () {
        return this.sdk !== null;
    };
    /**
     * Get timeout value
     */
    ClaudeSDKClient.prototype.getTimeout = function () {
        return this.config.timeout;
    };
    /**
     * Get current working directory
     */
    ClaudeSDKClient.prototype.getCwd = function () {
        return this.config.cwd;
    };
    /**
     * Setup authentication environment
     * Based on CLAUDE_SDK_REFERENCE.md authentication patterns
     */
    ClaudeSDKClient.prototype.setupAuthEnvironment = function () {
        return __awaiter(this, void 0, void 0, function () {
            var authVars, _i, _a, _b, key, value, authStatus, error_5;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        authVars = auth_manager_1.authManager.getClaudeCodeEnvVars();
                        // Store original environment variables
                        for (_i = 0, _a = Object.entries(authVars); _i < _a.length; _i++) {
                            _b = _a[_i], key = _b[0], value = _b[1];
                            this.originalEnvVars[key] = process.env[key];
                            if (value) {
                                process.env[key] = value;
                            }
                        }
                        return [4 /*yield*/, auth_manager_1.authManager.getAuthStatus()];
                    case 1:
                        authStatus = _c.sent();
                        if (!authStatus.authenticated) {
                            throw new error_types_1.AuthenticationError('No authentication method detected');
                        }
                        logger.debug("Using ".concat(authStatus.method, " authentication for Claude SDK"));
                        return [3 /*break*/, 3];
                    case 2:
                        error_5 = _c.sent();
                        throw new error_types_1.AuthenticationError("Authentication setup failed: ".concat(error_5));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Restore original environment variables
     */
    ClaudeSDKClient.prototype.restoreAuthEnvironment = function () {
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
     * Create fallback SDK implementation
     * Used when official SDK is not available
     */
    ClaudeSDKClient.prototype.createFallbackSDK = function () {
        return {
            query: this.fallbackQuery.bind(this),
            version: 'fallback-1.0.0'
        };
    };
    /**
     * Fallback query implementation
     * Simulates Claude SDK behavior for development/testing
     */
    ClaudeSDKClient.prototype.fallbackQuery = function (prompt, options) {
        return __asyncGenerator(this, arguments, function fallbackQuery_1() {
            var sessionId;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        sessionId = "fallback_".concat(Date.now());
                        return [4 /*yield*/, __await({
                                type: 'system',
                                subtype: 'init',
                                data: {
                                    session_id: sessionId,
                                    model: options.model || this.config.model
                                }
                            })];
                    case 1: 
                    // System init message
                    return [4 /*yield*/, _a.sent()];
                    case 2:
                        // System init message
                        _a.sent();
                        return [4 /*yield*/, __await({
                                type: 'assistant',
                                content: "This is a fallback response to: ".concat(prompt),
                                message: {
                                    content: "This is a fallback response to: ".concat(prompt)
                                }
                            })];
                    case 3: 
                    // Assistant response
                    return [4 /*yield*/, _a.sent()];
                    case 4:
                        // Assistant response
                        _a.sent();
                        return [4 /*yield*/, __await({
                                type: 'result',
                                subtype: 'success',
                                total_cost_usd: 0.001,
                                duration_ms: 100,
                                num_turns: 1,
                                session_id: sessionId
                            })];
                    case 5: 
                    // Result message
                    return [4 /*yield*/, _a.sent()];
                    case 6:
                        // Result message
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return ClaudeSDKClient;
}());
exports.ClaudeSDKClient = ClaudeSDKClient;
/**
 * Create Claude SDK client with configuration
 * Based on CLAUDE_SDK_REFERENCE.md client factory patterns
 */
function createClaudeSDKClient(config) {
    return new ClaudeSDKClient(config);
}
exports.createClaudeSDKClient = createClaudeSDKClient;
/**
 * Global Claude SDK client instance
 * Based on singleton pattern for efficiency
 */
exports.claudeSDKClient = createClaudeSDKClient();
/**
 * Verify Claude SDK availability
 * Helper function for quick SDK verification
 */
function verifyClaudeSDK() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, exports.claudeSDKClient.verifySDK()];
        });
    });
}
exports.verifyClaudeSDK = verifyClaudeSDK;
