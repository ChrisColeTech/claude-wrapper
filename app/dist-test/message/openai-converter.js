"use strict";
/**
 * Claude to OpenAI Format Converter
 * SRP: Handles only Claude to OpenAI message format conversion
 * Based on CLAUDE_SDK_REFERENCE.md response conversion patterns
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
exports.openaiConverter = exports.OpenAIConverterFactory = exports.OpenAIConversionUtils = exports.OpenAIConverter = void 0;
var constants_1 = require("./constants");
var errors_1 = require("./errors");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('OpenAIConverter');
/**
 * Claude to OpenAI message converter
 * SRP: Single responsibility for Claude -> OpenAI conversion
 * Max file size: <200 lines, functions <50 lines
 */
var OpenAIConverter = /** @class */ (function () {
    function OpenAIConverter() {
    }
    /**
     * Convert Claude response to OpenAI format
     * Performance requirement: <50ms per request
     */
    OpenAIConverter.prototype.convert = function (claudeMessages, model) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, (0, errors_1.handleMessageConversionCall)(function () { return __awaiter(_this, void 0, void 0, function () {
                        var startTime, timeoutPromise, conversionPromise, result, processingTime;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    startTime = Date.now();
                                    // Validate input
                                    this.validateClaudeMessages(claudeMessages);
                                    timeoutPromise = new Promise(function (_, reject) {
                                        setTimeout(function () {
                                            reject(new errors_1.ConversionTimeoutError(constants_1.MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS, 'Claude to OpenAI conversion'));
                                        }, constants_1.MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS);
                                    });
                                    conversionPromise = this.performConversion(claudeMessages, model);
                                    return [4 /*yield*/, Promise.race([conversionPromise, timeoutPromise])];
                                case 1:
                                    result = _a.sent();
                                    processingTime = Date.now() - startTime;
                                    logger.debug('Claude to OpenAI conversion completed', {
                                        messageCount: claudeMessages.length,
                                        processingTimeMs: processingTime,
                                        contentLength: result.content.length
                                    });
                                    return [2 /*return*/, result];
                            }
                        });
                    }); }, 'Claude to OpenAI conversion')];
            });
        });
    };
    /**
     * Convert single Claude message
     */
    OpenAIConverter.prototype.convertMessage = function (claudeMessage) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.convert([claudeMessage])];
            });
        });
    };
    /**
     * Extract session ID from Claude messages
     */
    OpenAIConverter.prototype.extractSessionId = function (claudeMessages) {
        var _a, _b;
        for (var _i = 0, claudeMessages_1 = claudeMessages; _i < claudeMessages_1.length; _i++) {
            var message = claudeMessages_1[_i];
            // Check direct session_id property
            if (message.session_id) {
                return message.session_id;
            }
            // Check in data object for system init messages
            if (message.type === 'system' && message.subtype === 'init' && ((_a = message.data) === null || _a === void 0 ? void 0 : _a.session_id)) {
                return message.data.session_id;
            }
            // Check in message object
            if ((_b = message.message) === null || _b === void 0 ? void 0 : _b.session_id) {
                return message.message.session_id;
            }
        }
        return undefined;
    };
    /**
     * Validate Claude messages array
     */
    OpenAIConverter.prototype.validateClaudeMessages = function (claudeMessages) {
        if (!claudeMessages || claudeMessages.length === 0) {
            throw new errors_1.MessageParsingError('Claude messages array cannot be empty');
        }
        // Check for at least one assistant or result message
        var hasContent = claudeMessages.some(function (m) {
            return m.type === 'assistant' ||
                m.type === 'result' ||
                (m.type === 'system' && m.content);
        });
        if (!hasContent) {
            throw new errors_1.MessageParsingError('No content found in Claude messages');
        }
    };
    /**
     * Perform the actual conversion logic
     * DRY: Extracted common conversion pattern
     */
    OpenAIConverter.prototype.performConversion = function (claudeMessages, model) {
        return __awaiter(this, void 0, void 0, function () {
            var content, sessionId, finishReason;
            return __generator(this, function (_a) {
                content = this.extractContentFromMessages(claudeMessages);
                sessionId = this.extractSessionId(claudeMessages);
                finishReason = this.determineFinishReason(claudeMessages);
                return [2 /*return*/, {
                        content: content,
                        role: constants_1.OPENAI_FORMAT_CONSTANTS.ROLE_ASSISTANT,
                        finishReason: finishReason,
                        model: model,
                        sessionId: sessionId
                    }];
            });
        });
    };
    /**
     * Extract content from Claude messages using parsing hierarchy
     */
    OpenAIConverter.prototype.extractContentFromMessages = function (claudeMessages) {
        var _a;
        // Strategy 1: Look for assistant messages with content
        for (var _i = 0, claudeMessages_2 = claudeMessages; _i < claudeMessages_2.length; _i++) {
            var message = claudeMessages_2[_i];
            if (message.type === 'assistant' && message.content) {
                return this.parseClaudeContent(message.content);
            }
        }
        // Strategy 2: Look for result messages with data
        for (var _b = 0, claudeMessages_3 = claudeMessages; _b < claudeMessages_3.length; _b++) {
            var message = claudeMessages_3[_b];
            if (message.type === 'result' && message.data) {
                var content = this.extractFromResultData(message.data);
                if (content) {
                    return content;
                }
            }
        }
        // Strategy 3: Look for system messages with content
        for (var _c = 0, claudeMessages_4 = claudeMessages; _c < claudeMessages_4.length; _c++) {
            var message = claudeMessages_4[_c];
            if (message.type === 'system' && message.content) {
                return this.parseClaudeContent(message.content);
            }
        }
        // Strategy 4: Look in message objects
        for (var _d = 0, claudeMessages_5 = claudeMessages; _d < claudeMessages_5.length; _d++) {
            var message = claudeMessages_5[_d];
            if ((_a = message.message) === null || _a === void 0 ? void 0 : _a.content) {
                return this.parseClaudeContent(message.message.content);
            }
        }
        throw new errors_1.MessageParsingError('No extractable content found in Claude messages');
    };
    /**
     * Parse Claude content handling various formats
     */
    OpenAIConverter.prototype.parseClaudeContent = function (content) {
        if (typeof content === 'string') {
            return content;
        }
        if (Array.isArray(content)) {
            // Handle content blocks format
            return content
                .map(function (block) {
                if (typeof block === 'string') {
                    return block;
                }
                if (block.text) {
                    return block.text;
                }
                if (block.content) {
                    return block.content;
                }
                return String(block);
            })
                .join('');
        }
        if (content && typeof content === 'object') {
            // Handle object with text property
            if (content.text) {
                return content.text;
            }
            if (content.content) {
                return content.content;
            }
        }
        return String(content);
    };
    /**
     * Extract content from result data
     */
    OpenAIConverter.prototype.extractFromResultData = function (data) {
        if (!data) {
            return null;
        }
        if (typeof data === 'string') {
            return data;
        }
        if (data.content) {
            return this.parseClaudeContent(data.content);
        }
        if (data.response) {
            return this.parseClaudeContent(data.response);
        }
        if (data.message) {
            return this.parseClaudeContent(data.message);
        }
        return null;
    };
    /**
     * Determine finish reason from Claude messages
     */
    OpenAIConverter.prototype.determineFinishReason = function (claudeMessages) {
        var _a;
        // Look for result messages with finish reason
        for (var _i = 0, claudeMessages_6 = claudeMessages; _i < claudeMessages_6.length; _i++) {
            var message = claudeMessages_6[_i];
            if (message.type === 'result') {
                if (message.subtype === 'error') {
                    return 'content_filter';
                }
                if (message.subtype === 'success') {
                    return constants_1.OPENAI_FORMAT_CONSTANTS.DEFAULT_FINISH_REASON;
                }
            }
        }
        // Check for explicit stop reasons
        for (var _b = 0, claudeMessages_7 = claudeMessages; _b < claudeMessages_7.length; _b++) {
            var message = claudeMessages_7[_b];
            if (message.stop_reason) {
                return message.stop_reason;
            }
            if ((_a = message.message) === null || _a === void 0 ? void 0 : _a.stop_reason) {
                return message.message.stop_reason;
            }
        }
        return constants_1.OPENAI_FORMAT_CONSTANTS.DEFAULT_FINISH_REASON;
    };
    return OpenAIConverter;
}());
exports.OpenAIConverter = OpenAIConverter;
/**
 * OpenAI conversion utility functions
 * DRY: Common conversion patterns extracted
 */
var OpenAIConversionUtils = /** @class */ (function () {
    function OpenAIConversionUtils() {
    }
    /**
     * Create OpenAI streaming chunk format
     */
    OpenAIConversionUtils.createStreamChunk = function (content, delta, finished, model) {
        return {
            id: "chatcmpl-".concat(Date.now()),
            object: constants_1.OPENAI_FORMAT_CONSTANTS.COMPLETION_CHUNK_OBJECT,
            created: Math.floor(Date.now() / 1000),
            model: model || 'claude-3-5-sonnet-20241022',
            choices: [{
                    index: 0,
                    delta: finished ? {} : { content: delta },
                    finish_reason: finished ? constants_1.OPENAI_FORMAT_CONSTANTS.DEFAULT_FINISH_REASON : null
                }]
        };
    };
    /**
     * Create OpenAI completion format
     */
    OpenAIConversionUtils.createCompletion = function (content, model, finishReason) {
        if (finishReason === void 0) { finishReason = constants_1.OPENAI_FORMAT_CONSTANTS.DEFAULT_FINISH_REASON; }
        return {
            id: "chatcmpl-".concat(Date.now()),
            object: constants_1.OPENAI_FORMAT_CONSTANTS.COMPLETION_OBJECT,
            created: Math.floor(Date.now() / 1000),
            model: model || 'claude-3-5-sonnet-20241022',
            choices: [{
                    index: 0,
                    message: {
                        role: constants_1.OPENAI_FORMAT_CONSTANTS.ROLE_ASSISTANT,
                        content: content
                    },
                    finish_reason: finishReason
                }]
        };
    };
    return OpenAIConversionUtils;
}());
exports.OpenAIConversionUtils = OpenAIConversionUtils;
/**
 * Factory for creating OpenAI converters
 */
var OpenAIConverterFactory = /** @class */ (function () {
    function OpenAIConverterFactory() {
    }
    /**
     * Create an OpenAI converter instance
     */
    OpenAIConverterFactory.create = function () {
        return new OpenAIConverter();
    };
    return OpenAIConverterFactory;
}());
exports.OpenAIConverterFactory = OpenAIConverterFactory;
/**
 * Global OpenAI converter instance
 */
exports.openaiConverter = OpenAIConverterFactory.create();
