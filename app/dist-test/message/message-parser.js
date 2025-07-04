"use strict";
/**
 * Claude Message Parser
 * SRP: Handles only Claude message parsing and content extraction
 * Based on CLAUDE_SDK_REFERENCE.md ClaudeMessageProcessor patterns
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
exports.contentFilter = exports.messageParser = exports.MessageParserFactory = exports.ContentFilter = exports.MessageParser = void 0;
var constants_1 = require("./constants");
var errors_1 = require("./errors");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('MessageParser');
/**
 * Claude message parser
 * SRP: Single responsibility for parsing Claude messages
 * Max file size: <200 lines, functions <50 lines
 */
var MessageParser = /** @class */ (function () {
    function MessageParser() {
    }
    /**
     * Parse Claude SDK messages to extract content
     */
    MessageParser.prototype.parseClaudeMessages = function (messages) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, (0, errors_1.handleMessageConversionCall)(function () { return __awaiter(_this, void 0, void 0, function () {
                        var startTime, timeoutPromise, parsingPromise, result, processingTime;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    startTime = Date.now();
                                    timeoutPromise = new Promise(function (_, reject) {
                                        setTimeout(function () {
                                            reject(new errors_1.ConversionTimeoutError(constants_1.MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS, 'Claude message parsing'));
                                        }, constants_1.MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS);
                                    });
                                    parsingPromise = this.performParsing(messages);
                                    return [4 /*yield*/, Promise.race([parsingPromise, timeoutPromise])];
                                case 1:
                                    result = _a.sent();
                                    processingTime = Date.now() - startTime;
                                    logger.debug('Claude message parsing completed', {
                                        messageCount: messages.length,
                                        processingTimeMs: processingTime,
                                        contentLength: result.length
                                    });
                                    return [2 /*return*/, result];
                            }
                        });
                    }); }, 'Claude message parsing')];
            });
        });
    };
    /**
     * Extract content from Claude messages
     */
    MessageParser.prototype.extractContent = function (messages) {
        if (!messages || messages.length === 0) {
            throw new errors_1.MessageParsingError('Messages array cannot be empty');
        }
        // Find assistant messages first
        var assistantMessages = messages.filter(function (m) { return m.type === 'assistant'; });
        if (assistantMessages.length > 0) {
            var content = this.extractMessageContent(assistantMessages[0]);
            if (content) {
                return content;
            }
        }
        // Fall back to any message with content
        for (var _i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
            var message = messages_1[_i];
            var content = this.extractMessageContent(message);
            if (content) {
                return content;
            }
        }
        throw new errors_1.MessageParsingError('No content found in any message');
    };
    /**
     * Check if messages represent complete response
     */
    MessageParser.prototype.isCompleteResponse = function (messages) {
        var _this = this;
        if (!messages || messages.length === 0) {
            return false;
        }
        // Check for result message indicating completion
        var hasResult = messages.some(function (m) {
            return m.type === 'result' &&
                (m.subtype === 'success' || m.subtype === 'error');
        });
        if (hasResult) {
            return true;
        }
        // Check for assistant message with content
        var hasAssistantContent = messages.some(function (m) {
            return m.type === 'assistant' &&
                _this.extractMessageContent(m);
        });
        return hasAssistantContent;
    };
    /**
     * Perform the parsing operation
     */
    MessageParser.prototype.performParsing = function (messages) {
        return __awaiter(this, void 0, void 0, function () {
            var rawContent, contentFilter, filterResult;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        rawContent = this.extractContent(messages);
                        contentFilter = new ContentFilter();
                        return [4 /*yield*/, contentFilter.filter(rawContent)];
                    case 1:
                        filterResult = _a.sent();
                        return [2 /*return*/, filterResult.content];
                }
            });
        });
    };
    /**
     * Extract content from a single message
     */
    MessageParser.prototype.extractMessageContent = function (message) {
        var _a, _b;
        // Check direct content property
        if (message.content) {
            return this.parseContentValue(message.content);
        }
        // Check message object
        if ((_a = message.message) === null || _a === void 0 ? void 0 : _a.content) {
            return this.parseContentValue(message.message.content);
        }
        // Check data object
        if ((_b = message.data) === null || _b === void 0 ? void 0 : _b.content) {
            return this.parseContentValue(message.data.content);
        }
        return null;
    };
    /**
     * Parse content value handling different formats
     */
    MessageParser.prototype.parseContentValue = function (content) {
        if (typeof content === 'string') {
            return content;
        }
        if (Array.isArray(content)) {
            return content
                .map(function (block) {
                if (typeof block === 'string') {
                    return block;
                }
                if (block.text) {
                    return block.text;
                }
                return String(block);
            })
                .join('');
        }
        if (content && typeof content === 'object' && content.text) {
            return content.text;
        }
        return null;
    };
    return MessageParser;
}());
exports.MessageParser = MessageParser;
/**
 * Content filter implementation
 * SRP: Single responsibility for content filtering
 */
var ContentFilter = /** @class */ (function () {
    function ContentFilter() {
    }
    /**
     * Filter content based on patterns
     */
    ContentFilter.prototype.filter = function (content) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, (0, errors_1.handleMessageConversionCall)(function () { return __awaiter(_this, void 0, void 0, function () {
                        var startTime, originalContent, filtersApplied, filteredContent, beforeThinking, attemptContent, beforeToolRemoval, beforeImageFilter, processingTime;
                        return __generator(this, function (_a) {
                            startTime = Date.now();
                            originalContent = content;
                            filtersApplied = [];
                            if (!content) {
                                return [2 /*return*/, {
                                        content: constants_1.DEFAULT_FALLBACK_CONTENT.EMPTY_RESPONSE,
                                        wasFiltered: true,
                                        filtersApplied: ['empty_content_fallback'],
                                        processingTimeMs: Date.now() - startTime
                                    }];
                            }
                            filteredContent = content;
                            beforeThinking = filteredContent;
                            filteredContent = this.removeThinkingBlocks(filteredContent);
                            if (filteredContent !== beforeThinking) {
                                filtersApplied.push('thinking_blocks');
                            }
                            attemptContent = this.extractAttemptCompletion(filteredContent);
                            if (attemptContent) {
                                filteredContent = attemptContent;
                                filtersApplied.push('attempt_completion_extraction');
                            }
                            else {
                                beforeToolRemoval = filteredContent;
                                filteredContent = this.removeToolUsage(filteredContent);
                                if (filteredContent !== beforeToolRemoval) {
                                    filtersApplied.push('tool_usage_removal');
                                }
                            }
                            beforeImageFilter = filteredContent;
                            filteredContent = filteredContent.replace(constants_1.CONTENT_FILTER_PATTERNS.IMAGE_REFERENCES, '[Image: Content not supported by Claude Code]');
                            if (filteredContent !== beforeImageFilter) {
                                filtersApplied.push('image_filtering');
                            }
                            // Clean up whitespace
                            filteredContent = filteredContent.replace(constants_1.CONTENT_FILTER_PATTERNS.MULTIPLE_NEWLINES, '\n\n');
                            filteredContent = filteredContent.trim();
                            // Fallback for empty content
                            if (!filteredContent || /^\s*$/.test(filteredContent)) {
                                filteredContent = constants_1.DEFAULT_FALLBACK_CONTENT.EMPTY_RESPONSE;
                                filtersApplied.push('empty_result_fallback');
                            }
                            processingTime = Date.now() - startTime;
                            logger.debug('Content filtering completed', {
                                originalLength: originalContent.length,
                                filteredLength: filteredContent.length,
                                filtersApplied: filtersApplied,
                                processingTimeMs: processingTime
                            });
                            return [2 /*return*/, {
                                    content: filteredContent,
                                    wasFiltered: originalContent !== filteredContent,
                                    filtersApplied: filtersApplied,
                                    processingTimeMs: processingTime
                                }];
                        });
                    }); }, 'Content filtering')];
            });
        });
    };
    /**
     * Remove thinking blocks
     */
    ContentFilter.prototype.removeThinkingBlocks = function (content) {
        // Handle nested thinking blocks by finding outermost blocks
        var result = content;
        var startIndex = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            var thinkingStart = result.indexOf('<thinking>', startIndex);
            if (thinkingStart === -1)
                break;
            // Find the matching closing tag for this opening tag
            var depth = 1;
            var pos = thinkingStart + '<thinking>'.length;
            while (pos < result.length && depth > 0) {
                var nextOpen = result.indexOf('<thinking>', pos);
                var nextClose = result.indexOf('</thinking>', pos);
                if (nextClose === -1) {
                    // Unclosed tag - leave it as is and move on
                    startIndex = thinkingStart + 1;
                    break;
                }
                if (nextOpen !== -1 && nextOpen < nextClose) {
                    // Found another opening tag before closing
                    depth++;
                    pos = nextOpen + '<thinking>'.length;
                }
                else {
                    // Found closing tag
                    depth--;
                    pos = nextClose + '</thinking>'.length;
                }
            }
            if (depth === 0) {
                // Found matching closing tag - remove the entire block
                result = result.slice(0, thinkingStart) + result.slice(pos);
                startIndex = thinkingStart;
            }
            else {
                // Unclosed tag - leave it and continue searching
                startIndex = thinkingStart + 1;
            }
        }
        return result;
    };
    /**
     * Remove tool usage patterns
     */
    ContentFilter.prototype.removeToolUsage = function (content) {
        var filtered = content;
        for (var _i = 0, _a = constants_1.CONTENT_FILTER_PATTERNS.TOOL_USAGE; _i < _a.length; _i++) {
            var pattern = _a[_i];
            filtered = filtered.replace(pattern, '');
        }
        return filtered;
    };
    /**
     * Extract attempt completion content
     */
    ContentFilter.prototype.extractAttemptCompletion = function (content) {
        var matches = __spreadArray([], content.matchAll(constants_1.CONTENT_FILTER_PATTERNS.ATTEMPT_COMPLETION), true);
        if (matches.length === 0) {
            return null;
        }
        var extractedContent = matches[0][1].trim();
        // Check for nested result blocks
        var resultMatches = __spreadArray([], extractedContent.matchAll(constants_1.CONTENT_FILTER_PATTERNS.RESULT_BLOCKS), true);
        if (resultMatches.length > 0) {
            extractedContent = resultMatches[0][1].trim();
        }
        return extractedContent || null;
    };
    return ContentFilter;
}());
exports.ContentFilter = ContentFilter;
/**
 * Factory for creating message parsers
 */
var MessageParserFactory = /** @class */ (function () {
    function MessageParserFactory() {
    }
    /**
     * Create a message parser instance
     */
    MessageParserFactory.create = function () {
        return new MessageParser();
    };
    /**
     * Create content filter instance
     */
    MessageParserFactory.createContentFilter = function () {
        return new ContentFilter();
    };
    return MessageParserFactory;
}());
exports.MessageParserFactory = MessageParserFactory;
/**
 * Global message parser instance
 */
exports.messageParser = MessageParserFactory.create();
/**
 * Global content filter instance
 */
exports.contentFilter = MessageParserFactory.createContentFilter();
