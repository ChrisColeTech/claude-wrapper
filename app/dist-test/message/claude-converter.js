"use strict";
/**
 * OpenAI to Claude Format Converter
 * SRP: Handles only OpenAI to Claude message format conversion
 * Based on CLAUDE_SDK_REFERENCE.md OpenAIToClaudeMapping patterns
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
exports.claudeConverter = exports.ClaudeConverterFactory = exports.MessageConversionUtils = exports.ClaudeConverter = void 0;
var message_1 = require("../models/message");
var constants_1 = require("./constants");
var errors_1 = require("./errors");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('ClaudeConverter');
/**
 * OpenAI to Claude message converter
 * SRP: Single responsibility for OpenAI -> Claude conversion
 * Max file size: <200 lines, functions <50 lines
 */
var ClaudeConverter = /** @class */ (function () {
    function ClaudeConverter() {
    }
    /**
     * Convert OpenAI messages to Claude format
     * Performance requirement: <50ms per request
     */
    ClaudeConverter.prototype.convert = function (messages) {
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
                                    this.validateMessages(messages);
                                    timeoutPromise = new Promise(function (_, reject) {
                                        setTimeout(function () {
                                            reject(new errors_1.ConversionTimeoutError(constants_1.MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS, 'OpenAI to Claude conversion'));
                                        }, constants_1.MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS);
                                    });
                                    conversionPromise = this.performConversion(messages);
                                    return [4 /*yield*/, Promise.race([conversionPromise, timeoutPromise])];
                                case 1:
                                    result = _a.sent();
                                    processingTime = Date.now() - startTime;
                                    logger.debug('OpenAI to Claude conversion completed', {
                                        messageCount: messages.length,
                                        processingTimeMs: processingTime,
                                        hasSystemPrompt: !!result.systemPrompt
                                    });
                                    return [2 /*return*/, result];
                            }
                        });
                    }); }, 'OpenAI to Claude conversion')];
            });
        });
    };
    /**
     * Convert with session continuity support
     */
    ClaudeConverter.prototype.convertWithSession = function (messages, sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.convert(messages)];
                    case 1:
                        result = _a.sent();
                        if (sessionId) {
                            result.sessionId = sessionId;
                            result.continueConversation = sessionId;
                        }
                        return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * Validate OpenAI message format
     */
    ClaudeConverter.prototype.validateMessages = function (messages) {
        if (!messages || messages.length === 0) {
            throw new errors_1.MessageValidationError('Messages array cannot be empty');
        }
        if (messages.length > constants_1.MESSAGE_PERFORMANCE.MAX_MESSAGES_PER_REQUEST) {
            throw new errors_1.MessageValidationError("Too many messages: ".concat(messages.length, " exceeds limit of ").concat(constants_1.MESSAGE_PERFORMANCE.MAX_MESSAGES_PER_REQUEST));
        }
        for (var i = 0; i < messages.length; i++) {
            var message = messages[i];
            if (!message.role || !message.content) {
                throw new errors_1.MessageValidationError("Message at index ".concat(i, " missing required fields: role or content"));
            }
            if (!Object.values(constants_1.MESSAGE_ROLES).includes(message.role)) {
                throw new errors_1.MessageValidationError("Message at index ".concat(i, " has invalid role: ").concat(message.role));
            }
            var content = message_1.MessageValidation.extractText(message);
            if (content.length > constants_1.MESSAGE_PERFORMANCE.MAX_MESSAGE_LENGTH) {
                throw new errors_1.MessageValidationError("Message at index ".concat(i, " exceeds maximum length: ").concat(content.length, " > ").concat(constants_1.MESSAGE_PERFORMANCE.MAX_MESSAGE_LENGTH));
            }
        }
        return true;
    };
    /**
     * Perform the actual conversion logic
     * DRY: Extracted common conversion pattern
     */
    ClaudeConverter.prototype.performConversion = function (messages) {
        return __awaiter(this, void 0, void 0, function () {
            var systemPrompt, conversationParts, _i, messages_1, message, content, prompt;
            return __generator(this, function (_a) {
                conversationParts = [];
                for (_i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
                    message = messages_1[_i];
                    content = message_1.MessageValidation.extractText(message);
                    switch (message.role) {
                        case constants_1.MESSAGE_ROLES.SYSTEM:
                            // Use the last system message as the system prompt
                            systemPrompt = content;
                            break;
                        case constants_1.MESSAGE_ROLES.USER:
                            conversationParts.push("".concat(constants_1.CLAUDE_PROMPT_FORMATS.HUMAN_PREFIX, " ").concat(content));
                            break;
                        case constants_1.MESSAGE_ROLES.ASSISTANT:
                            conversationParts.push("".concat(constants_1.CLAUDE_PROMPT_FORMATS.ASSISTANT_PREFIX, " ").concat(content));
                            break;
                        default:
                            // Skip unsupported roles like 'tool' or 'function'
                            logger.debug("Skipping unsupported message role: ".concat(message.role));
                    }
                }
                prompt = conversationParts.join(constants_1.CLAUDE_PROMPT_FORMATS.SEPARATOR);
                // Add continuation prompt if needed
                if (this.needsContinuationPrompt(messages)) {
                    prompt += constants_1.CLAUDE_PROMPT_FORMATS.SEPARATOR + constants_1.CLAUDE_PROMPT_FORMATS.CONTINUATION_PROMPT;
                }
                return [2 /*return*/, {
                        prompt: prompt,
                        systemPrompt: systemPrompt
                    }];
            });
        });
    };
    /**
     * Determine if conversation needs continuation prompt
     * DRY: Extracted continuation logic
     */
    ClaudeConverter.prototype.needsContinuationPrompt = function (messages) {
        if (messages.length === 0) {
            return false;
        }
        var lastMessage = messages[messages.length - 1];
        return lastMessage.role !== constants_1.MESSAGE_ROLES.USER;
    };
    return ClaudeConverter;
}());
exports.ClaudeConverter = ClaudeConverter;
/**
 * Message conversion utility functions
 * DRY: Common conversion patterns extracted
 */
var MessageConversionUtils = /** @class */ (function () {
    function MessageConversionUtils() {
    }
    /**
     * Estimate token count for Claude format
     */
    MessageConversionUtils.estimateTokens = function (text) {
        if (!text)
            return 0;
        return Math.ceil(text.length / constants_1.MESSAGE_PERFORMANCE.TOKEN_ESTIMATION_RATIO);
    };
    /**
     * Truncate conversation history for performance
     */
    MessageConversionUtils.truncateHistory = function (messages) {
        if (messages.length <= constants_1.SESSION_CONSTANTS.HISTORY_TRUNCATION_THRESHOLD) {
            return messages;
        }
        // Keep system messages and recent conversation
        var systemMessages = messages.filter(function (m) { return m.role === constants_1.MESSAGE_ROLES.SYSTEM; });
        var recentMessages = messages
            .filter(function (m) { return m.role !== constants_1.MESSAGE_ROLES.SYSTEM; })
            .slice(-constants_1.SESSION_CONSTANTS.HISTORY_TRUNCATION_THRESHOLD);
        return __spreadArray(__spreadArray([], systemMessages, true), recentMessages, true);
    };
    /**
     * Merge system prompts when multiple exist
     */
    MessageConversionUtils.mergeSystemPrompts = function (messages) {
        var systemMessages = messages.filter(function (m) { return m.role === constants_1.MESSAGE_ROLES.SYSTEM; });
        if (systemMessages.length === 0) {
            return undefined;
        }
        if (systemMessages.length === 1) {
            return message_1.MessageValidation.extractText(systemMessages[0]);
        }
        // Merge multiple system messages
        return systemMessages
            .map(function (m) { return message_1.MessageValidation.extractText(m); })
            .join('\n\n');
    };
    return MessageConversionUtils;
}());
exports.MessageConversionUtils = MessageConversionUtils;
/**
 * Factory for creating Claude converters
 */
var ClaudeConverterFactory = /** @class */ (function () {
    function ClaudeConverterFactory() {
    }
    /**
     * Create a Claude converter instance
     */
    ClaudeConverterFactory.create = function () {
        return new ClaudeConverter();
    };
    /**
     * Create converter with performance constraints
     */
    ClaudeConverterFactory.createWithConstraints = function (timeoutMs) {
        if (timeoutMs === void 0) { timeoutMs = constants_1.MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS; }
        // Currently returns standard converter
        // Can be extended for custom timeout handling
        return new ClaudeConverter();
    };
    return ClaudeConverterFactory;
}());
exports.ClaudeConverterFactory = ClaudeConverterFactory;
/**
 * Global Claude converter instance
 */
exports.claudeConverter = ClaudeConverterFactory.create();
