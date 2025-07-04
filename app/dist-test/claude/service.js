"use strict";
/**
 * Claude Code SDK Service
 * High-level service for Claude Code SDK integration
 * Based on Python claude_cli.py ClaudeCodeCLI class
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
exports.claudeService = exports.ClaudeService = void 0;
var client_1 = require("./client");
var sdk_client_1 = require("./sdk-client");
var parser_1 = require("./parser");
var metadata_1 = require("./metadata");
var adapter_1 = require("../message/adapter");
var error_1 = require("../models/error");
var error_types_1 = require("./error-types");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('ClaudeService');
/**
 * Claude Code SDK Service
 * Provides high-level interface for Claude completions
 */
var ClaudeService = /** @class */ (function () {
    function ClaudeService(timeout, cwd) {
        if (timeout === void 0) { timeout = 600000; }
        this.client = new client_1.ClaudeClient(timeout, cwd);
        this.sdkClient = new sdk_client_1.ClaudeSDKClient({ timeout: timeout, cwd: cwd });
        this.messageAdapter = new adapter_1.MessageAdapter();
    }
    /**
     * Verify Claude Code SDK is available and authenticated
     */
    ClaudeService.prototype.verifySDK = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, (0, error_types_1.handleClaudeSDKCall)(function () { return __awaiter(_this, void 0, void 0, function () {
                        var result, error_2;
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, this.sdkClient.verifySDK()];
                                case 1:
                                    result = _b.sent();
                                    logger.info('Claude SDK verification result', {
                                        available: result.available,
                                        authentication: result.authentication,
                                        version: result.version
                                    });
                                    return [2 /*return*/, {
                                            available: result.available && ((_a = result.authentication) !== null && _a !== void 0 ? _a : false),
                                            error: result.error
                                        }];
                                case 2:
                                    error_2 = _b.sent();
                                    logger.error('Claude SDK verification error', { error: error_2 });
                                    return [2 /*return*/, {
                                            available: false,
                                            error: "SDK verification failed: ".concat(error_2)
                                        }];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        });
    };
    /**
     * Create a completion using Claude Code SDK
     * Based on Python run_completion method
     */
    ClaudeService.prototype.createCompletion = function (messages, options) {
        if (options === void 0) { options = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, (0, error_types_1.handleClaudeSDKCall)(function () { return __awaiter(_this, void 0, void 0, function () {
                        var prompt_1, claudeOptions, claudeMessages, startTime, _a, _b, _c, message, e_1_1, responseTime, parsedResponse, metadata, response, error_3;
                        var _d, e_1, _e, _f;
                        return __generator(this, function (_g) {
                            switch (_g.label) {
                                case 0:
                                    _g.trys.push([0, 13, , 14]);
                                    logger.info('Creating Claude completion', {
                                        messageCount: messages.length,
                                        model: options.model,
                                        maxTurns: options.max_turns
                                    });
                                    prompt_1 = this.messageAdapter.convertToClaudePrompt(messages);
                                    claudeOptions = this.prepareClaudeOptions(options);
                                    claudeMessages = [];
                                    startTime = Date.now();
                                    _g.label = 1;
                                case 1:
                                    _g.trys.push([1, 6, 7, 12]);
                                    _a = true, _b = __asyncValues(this.sdkClient.runCompletion(prompt_1, claudeOptions));
                                    _g.label = 2;
                                case 2: return [4 /*yield*/, _b.next()];
                                case 3:
                                    if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 5];
                                    _f = _c.value;
                                    _a = false;
                                    try {
                                        message = _f;
                                        claudeMessages.push(message);
                                        // Break early if we get a complete assistant response
                                        if (message.type === 'assistant' && parser_1.ClaudeResponseParser.isCompleteResponse(claudeMessages)) {
                                            return [3 /*break*/, 5];
                                        }
                                    }
                                    finally {
                                        _a = true;
                                    }
                                    _g.label = 4;
                                case 4: return [3 /*break*/, 2];
                                case 5: return [3 /*break*/, 12];
                                case 6:
                                    e_1_1 = _g.sent();
                                    e_1 = { error: e_1_1 };
                                    return [3 /*break*/, 12];
                                case 7:
                                    _g.trys.push([7, , 10, 11]);
                                    if (!(!_a && !_d && (_e = _b["return"]))) return [3 /*break*/, 9];
                                    return [4 /*yield*/, _e.call(_b)];
                                case 8:
                                    _g.sent();
                                    _g.label = 9;
                                case 9: return [3 /*break*/, 11];
                                case 10:
                                    if (e_1) throw e_1.error;
                                    return [7 /*endfinally*/];
                                case 11: return [7 /*endfinally*/];
                                case 12:
                                    responseTime = Date.now() - startTime;
                                    logger.info('Claude completion response time', { responseTime: responseTime, messageCount: claudeMessages.length });
                                    parsedResponse = parser_1.ClaudeResponseParser.parseToOpenAIResponse(claudeMessages);
                                    if (!parsedResponse) {
                                        throw new error_types_1.ClaudeSDKError('No valid response received from Claude Code SDK');
                                    }
                                    metadata = metadata_1.ClaudeMetadataExtractor.extractMetadata(claudeMessages);
                                    response = {
                                        content: parsedResponse.content,
                                        role: 'assistant',
                                        metadata: metadata,
                                        session_id: parsedResponse.session_id,
                                        stop_reason: parsedResponse.stop_reason
                                    };
                                    logger.info('Claude completion successful', {
                                        contentLength: response.content.length,
                                        responseTime: responseTime,
                                        tokenUsage: metadata
                                    });
                                    return [2 /*return*/, response];
                                case 13:
                                    error_3 = _g.sent();
                                    logger.error('Claude completion failed', { error: error_3 });
                                    if (error_3 instanceof error_types_1.ClaudeSDKError) {
                                        throw error_3;
                                    }
                                    throw new error_types_1.ClaudeSDKError("Completion failed: ".concat(error_3));
                                case 14: return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        });
    };
    /**
     * Create a streaming completion using Claude Code SDK
     */
    ClaudeService.prototype.createStreamingCompletion = function (messages, options) {
        if (options === void 0) { options = {}; }
        return __asyncGenerator(this, arguments, function createStreamingCompletion_1() {
            var prompt_2, claudeOptions, streamParser, lastContent, startTime, _a, _b, _c, message, currentContent, delta, responseTime, metadata, e_2_1, error_4;
            var _d, e_2, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        _g.trys.push([0, 21, , 22]);
                        logger.info('Creating Claude streaming completion', {
                            messageCount: messages.length,
                            model: options.model
                        });
                        prompt_2 = this.messageAdapter.convertToClaudePrompt(messages);
                        claudeOptions = this.prepareClaudeOptions(options);
                        streamParser = new parser_1.StreamResponseParser();
                        lastContent = '';
                        startTime = Date.now();
                        _g.label = 1;
                    case 1:
                        _g.trys.push([1, 14, 15, 20]);
                        _a = true, _b = __asyncValues(this.sdkClient.runCompletion(prompt_2, claudeOptions));
                        _g.label = 2;
                    case 2: return [4 /*yield*/, __await(_b.next())];
                    case 3:
                        if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 13];
                        _f = _c.value;
                        _a = false;
                        _g.label = 4;
                    case 4:
                        _g.trys.push([4, , 11, 12]);
                        message = _f;
                        streamParser.addMessage(message);
                        currentContent = streamParser.getCurrentContent() || '';
                        delta = currentContent.slice(lastContent.length);
                        if (!delta) return [3 /*break*/, 7];
                        return [4 /*yield*/, __await({
                                content: currentContent,
                                delta: delta,
                                finished: false
                            })];
                    case 5: return [4 /*yield*/, _g.sent()];
                    case 6:
                        _g.sent();
                        lastContent = currentContent;
                        _g.label = 7;
                    case 7:
                        if (!streamParser.isComplete()) return [3 /*break*/, 10];
                        responseTime = Date.now() - startTime;
                        logger.info('Claude streaming completion finished', { responseTime: responseTime });
                        streamParser.getFinalResponse();
                        metadata = metadata_1.ClaudeMetadataExtractor.extractMetadata(streamParser.getMessages());
                        return [4 /*yield*/, __await({
                                content: currentContent,
                                finished: true,
                                metadata: metadata
                            })];
                    case 8: return [4 /*yield*/, _g.sent()];
                    case 9:
                        _g.sent();
                        return [3 /*break*/, 13];
                    case 10: return [3 /*break*/, 12];
                    case 11:
                        _a = true;
                        return [7 /*endfinally*/];
                    case 12: return [3 /*break*/, 2];
                    case 13: return [3 /*break*/, 20];
                    case 14:
                        e_2_1 = _g.sent();
                        e_2 = { error: e_2_1 };
                        return [3 /*break*/, 20];
                    case 15:
                        _g.trys.push([15, , 18, 19]);
                        if (!(!_a && !_d && (_e = _b["return"]))) return [3 /*break*/, 17];
                        return [4 /*yield*/, __await(_e.call(_b))];
                    case 16:
                        _g.sent();
                        _g.label = 17;
                    case 17: return [3 /*break*/, 19];
                    case 18:
                        if (e_2) throw e_2.error;
                        return [7 /*endfinally*/];
                    case 19: return [7 /*endfinally*/];
                    case 20: return [3 /*break*/, 22];
                    case 21:
                        error_4 = _g.sent();
                        logger.error('Claude streaming completion failed', { error: error_4 });
                        if (error_4 instanceof error_types_1.ClaudeSDKError) {
                            throw error_4;
                        }
                        throw new error_1.StreamingError("Streaming completion failed: ".concat(error_4));
                    case 22: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create completion from OpenAI chat completion request
     */
    ClaudeService.prototype.createChatCompletion = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var options;
            return __generator(this, function (_a) {
                options = {
                    model: request.model,
                    enable_tools: request.enable_tools,
                    stream: request.stream
                };
                if (request.stream) {
                    throw new Error('Use createStreamingChatCompletion for streaming requests');
                }
                return [2 /*return*/, this.createCompletion(request.messages, options)];
            });
        });
    };
    /**
     * Create streaming completion from OpenAI chat completion request
     */
    ClaudeService.prototype.createStreamingChatCompletion = function (request) {
        return __asyncGenerator(this, arguments, function createStreamingChatCompletion_1() {
            var options;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = {
                            model: request.model,
                            enable_tools: request.enable_tools,
                            stream: true
                        };
                        return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(this.createStreamingCompletion(request.messages, options))))];
                    case 1: return [4 /*yield*/, __await.apply(void 0, [_a.sent()])];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Parse messages from a completed Claude response
     * Based on Python parse_claude_message
     */
    ClaudeService.prototype.parseClaudeMessages = function (messages) {
        return parser_1.ClaudeResponseParser.parseClaudeMessage(messages);
    };
    /**
     * Extract metadata from Claude response
     * Based on Python extract_metadata
     */
    ClaudeService.prototype.extractMetadata = function (messages) {
        return metadata_1.ClaudeMetadataExtractor.extractMetadata(messages);
    };
    /**
     * Check if Claude Code SDK is available
     */
    ClaudeService.prototype.isSDKAvailable = function () {
        return this.client.isAvailable();
    };
    /**
     * Get client timeout
     */
    ClaudeService.prototype.getTimeout = function () {
        return this.client.getTimeout();
    };
    /**
     * Get current working directory
     */
    ClaudeService.prototype.getCwd = function () {
        return this.client.getCwd();
    };
    /**
     * Prepare Claude Code SDK options from our options
     */
    ClaudeService.prototype.prepareClaudeOptions = function (options) {
        var claudeOptions = {
            cwd: this.client.getCwd()
        };
        if (options.model) {
            claudeOptions.model = options.model;
        }
        if (options.max_turns !== undefined) {
            claudeOptions.max_turns = options.max_turns;
        }
        if (options.system_prompt) {
            claudeOptions.system_prompt = options.system_prompt;
        }
        if (options.allowed_tools) {
            claudeOptions.allowed_tools = options.allowed_tools;
        }
        if (options.disallowed_tools) {
            claudeOptions.disallowed_tools = options.disallowed_tools;
        }
        // Default tools configuration based on enable_tools flag
        if (options.enable_tools === false && !options.disallowed_tools) {
            claudeOptions.disallowed_tools = ['*']; // Disable all tools
        }
        return claudeOptions;
    };
    return ClaudeService;
}());
exports.ClaudeService = ClaudeService;
/**
 * Global Claude service instance
 */
exports.claudeService = new ClaudeService();
