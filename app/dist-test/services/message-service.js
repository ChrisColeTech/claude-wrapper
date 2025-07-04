"use strict";
/**
 * Message service implementation
 * Business logic for message processing
 * Updated for Phase 2A: Uses new message converters
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
exports.MessageService = void 0;
var message_1 = require("../models/message");
var claude_converter_1 = require("../message/claude-converter");
var message_parser_1 = require("../message/message-parser");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('MessageService');
var MessageService = /** @class */ (function () {
    function MessageService() {
    }
    /**
     * Convert OpenAI messages to Claude Code prompt format
     * Phase 2A: Uses new ClaudeConverter with proper error handling
     * Returns prompt and system_prompt
     */
    MessageService.prototype.convertToClaudeFormat = function (messages) {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, claude_converter_1.claudeConverter.convert(messages)];
                    case 1:
                        result = _a.sent();
                        logger.debug('Converted messages to Claude format using new converter', {
                            messageCount: messages.length,
                            promptLength: result.prompt.length,
                            hasSystemPrompt: !!result.systemPrompt
                        });
                        return [2 /*return*/, {
                                prompt: result.prompt,
                                systemPrompt: result.systemPrompt
                            }];
                    case 2:
                        error_1 = _a.sent();
                        logger.error('Failed to convert messages to Claude format', { error: error_1 });
                        throw new Error("Message conversion failed: ".concat(error_1 instanceof Error ? error_1.message : 'Unknown error'));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Filter content for unsupported features and tool usage
     * Phase 2A: Uses new ContentFilter with enhanced filtering
     */
    MessageService.prototype.filterContent = function (content) {
        return __awaiter(this, void 0, void 0, function () {
            var filterResult, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!content) {
                            return [2 /*return*/, content];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, message_parser_1.contentFilter.filter(content)];
                    case 2:
                        filterResult = _a.sent();
                        logger.debug('Content filtered using new filter', {
                            originalLength: content.length,
                            filteredLength: filterResult.content.length,
                            wasFiltered: filterResult.wasFiltered,
                            filtersApplied: filterResult.filtersApplied,
                            processingTimeMs: filterResult.processingTimeMs
                        });
                        return [2 /*return*/, filterResult.content];
                    case 3:
                        error_2 = _a.sent();
                        logger.error('Failed to filter content', { error: error_2, contentLength: content.length });
                        return [2 /*return*/, content]; // Return original content on error
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Estimate token count from text
     * Based on Python MessageAdapter.estimate_tokens
     * OpenAI's rule of thumb: ~4 characters per token for English text
     */
    MessageService.prototype.estimateTokens = function (text) {
        if (!text)
            return 0;
        return Math.ceil(text.length / 4);
    };
    /**
     * Format Claude response for OpenAI compatibility
     * Based on Python MessageAdapter.format_claude_response
     */
    MessageService.prototype.formatClaudeResponse = function (content, model, finishReason) {
        if (finishReason === void 0) { finishReason = 'stop'; }
        return {
            role: 'assistant',
            content: content,
            finish_reason: finishReason,
            model: model
        };
    };
    /**
     * Process message with validation and error handling
     * Wrapper for common message processing operations
     */
    MessageService.prototype.processMessage = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var validatedMessage;
            return __generator(this, function (_a) {
                try {
                    validatedMessage = message_1.MessageValidation.validateMessage(message);
                    logger.debug('Message processed', {
                        role: validatedMessage.role,
                        contentLength: typeof validatedMessage.content === 'string'
                            ? validatedMessage.content.length
                            : validatedMessage.content.length,
                        hasName: !!validatedMessage.name
                    });
                    return [2 /*return*/, validatedMessage];
                }
                catch (error) {
                    logger.error('Failed to process message', { error: error, message: message });
                    throw new Error("Message processing failed: ".concat(error instanceof Error ? error.message : 'Unknown error'));
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Validate and normalize a batch of messages
     * Ensures all messages meet Claude Code requirements
     */
    MessageService.prototype.processMessages = function (messages) {
        return __awaiter(this, void 0, void 0, function () {
            var processedMessages, error_3;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Promise.all(messages.map(function (message) { return _this.processMessage(message); }))];
                    case 1:
                        processedMessages = _a.sent();
                        logger.debug('Messages batch processed', {
                            count: processedMessages.length,
                            roles: processedMessages.map(function (m) { return m.role; })
                        });
                        return [2 /*return*/, processedMessages];
                    case 2:
                        error_3 = _a.sent();
                        logger.error('Failed to process messages batch', { error: error_3, messageCount: messages.length });
                        throw new Error("Messages batch processing failed: ".concat(error_3 instanceof Error ? error_3.message : 'Unknown error'));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return MessageService;
}());
exports.MessageService = MessageService;
