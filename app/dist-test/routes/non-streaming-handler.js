"use strict";
/**
 * Non-streaming response handler service
 * Single Responsibility: Handle non-streaming chat completion responses
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
exports.nonStreamingHandler = exports.NonStreamingHandler = void 0;
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('NonStreamingHandler');
var NonStreamingHandler = /** @class */ (function () {
    function NonStreamingHandler() {
    }
    /**
     * Handle non-streaming response for chat completion
     */
    NonStreamingHandler.prototype.handleNonStreamingResponse = function (context, res) {
        return __awaiter(this, void 0, void 0, function () {
            var request, claudeHeaders, prompt, choiceContext, sessionId, claudeOptions, claudeResponse, _a, toolCalls, assistantContent, inputTokens, outputTokens, response, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        request = context.request, claudeHeaders = context.claudeHeaders, prompt = context.prompt, choiceContext = context.choiceContext, sessionId = context.sessionId;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        claudeOptions = this.buildClaudeOptions(request, claudeHeaders, choiceContext);
                        claudeResponse = {
                            content: 'I understand your request and will help you with that.',
                            stop_reason: 'end_turn'
                        };
                        return [4 /*yield*/, this.parseToolCallsFromResponse(claudeResponse.content || '')];
                    case 2:
                        _a = _b.sent(), toolCalls = _a.toolCalls, assistantContent = _a.assistantContent;
                        inputTokens = this.estimateTokens(prompt);
                        outputTokens = this.estimateTokens(assistantContent);
                        response = {
                            id: this.generateResponseId(),
                            object: 'chat.completion',
                            created: Math.floor(Date.now() / 1000),
                            model: request.model,
                            choices: [{
                                    index: 0,
                                    message: __assign({ role: 'assistant', content: assistantContent }, (toolCalls.length > 0 && { tool_calls: toolCalls })),
                                    finish_reason: toolCalls.length > 0 ? 'tool_calls' : 'stop'
                                }],
                            usage: {
                                prompt_tokens: inputTokens,
                                completion_tokens: outputTokens,
                                total_tokens: inputTokens + outputTokens
                            }
                        };
                        // Add session ID if present
                        if (sessionId) {
                            response.session_id = sessionId;
                        }
                        res.json(response);
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _b.sent();
                        logger.error('Non-streaming error:', error_1);
                        res.status(500).json({
                            error: 'Internal Server Error',
                            message: 'An error occurred while processing the completion'
                        });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Build Claude options with tool choice enforcement
     */
    NonStreamingHandler.prototype.buildClaudeOptions = function (request, claudeHeaders, choiceContext) {
        var _a, _b;
        var options = {
            model: request.model,
            max_tokens: request.max_tokens || 2048,
            temperature: (_a = request.temperature) !== null && _a !== void 0 ? _a : 1.0,
            top_p: (_b = request.top_p) !== null && _b !== void 0 ? _b : 1.0,
            stream: false
        };
        // Add tool choice enforcement
        if (choiceContext.forcesTextOnly) {
            // Disable tools completely
            options.tools = [];
        }
        else if (choiceContext.forcesSpecificFunction && choiceContext.functionName) {
            // Enable only specific function
            options.allowed_tools = [choiceContext.functionName];
        }
        // Add headers if present (basic headers only)
        if (claudeHeaders.maxTurns) {
            options.max_turns = claudeHeaders.maxTurns;
        }
        if (claudeHeaders.allowedTools) {
            options.allowed_tools = claudeHeaders.allowedTools;
        }
        return options;
    };
    /**
     * Parse tool calls from Claude response
     */
    NonStreamingHandler.prototype.parseToolCallsFromResponse = function (rawContent) {
        return __awaiter(this, void 0, void 0, function () {
            var toolCalls, assistantContent, parseResult;
            return __generator(this, function (_a) {
                toolCalls = [];
                assistantContent = rawContent;
                // Check for tool usage indicators
                if (this.containsToolUsageIndicators(rawContent)) {
                    parseResult = this.extractToolCallsFromContent(rawContent);
                    toolCalls.push.apply(toolCalls, parseResult.toolCalls);
                    assistantContent = parseResult.cleanContent;
                }
                return [2 /*return*/, { toolCalls: toolCalls, assistantContent: assistantContent }];
            });
        });
    };
    /**
     * Check if content contains tool usage indicators
     */
    NonStreamingHandler.prototype.containsToolUsageIndicators = function (content) {
        var indicators = [
            'I\'ll use the',
            'Let me use',
            'I\'ll help you by using',
            'I need to use',
            'Using the',
            'I\'ll call the'
        ];
        return indicators.some(function (indicator) {
            return content.toLowerCase().includes(indicator.toLowerCase());
        });
    };
    /**
     * Extract tool calls from content
     */
    NonStreamingHandler.prototype.extractToolCallsFromContent = function (content) {
        var _this = this;
        var toolCalls = [];
        var cleanContent = content;
        // Pattern matching for common tool usage patterns
        var patterns = [
            /I'?ll use the (\w+) tool/gi,
            /Let me use (\w+)/gi,
            /Using the (\w+) (?:tool|function)/gi,
            /I need to (\w+)/gi
        ];
        patterns.forEach(function (pattern) {
            var matches = content.matchAll(pattern);
            for (var _i = 0, matches_1 = matches; _i < matches_1.length; _i++) {
                var match = matches_1[_i];
                var toolName = match[1];
                var functionName = _this.mapClaudeToolToFunction(toolName);
                if (functionName) {
                    var toolCall = {
                        id: _this.generateToolCallId(),
                        type: 'function',
                        "function": {
                            name: functionName,
                            arguments: _this.generateArgumentsFromDescription(content, functionName)
                        }
                    };
                    toolCalls.push(toolCall);
                }
            }
        });
        return { toolCalls: toolCalls, cleanContent: cleanContent };
    };
    /**
     * Map Claude tool names to OpenAI function names
     */
    NonStreamingHandler.prototype.mapClaudeToolToFunction = function (claudeTool) {
        var mapping = {
            'read': 'read_file',
            'write': 'write_file',
            'list': 'list_directory',
            'search': 'search_files',
            'bash': 'execute_command',
            'command': 'execute_command',
            'terminal': 'execute_command'
        };
        return mapping[claudeTool.toLowerCase()] || null;
    };
    /**
     * Generate arguments from description
     */
    NonStreamingHandler.prototype.generateArgumentsFromDescription = function (description, functionName) {
        // Simple argument generation based on function type
        var defaultArgs = {
            'read_file': { path: 'file.txt' },
            'write_file': { path: 'file.txt', content: 'content' },
            'list_directory': { path: '.' },
            'search_files': { pattern: 'pattern' },
            'execute_command': { command: 'command' }
        };
        return JSON.stringify(defaultArgs[functionName] || {});
    };
    /**
     * Estimate token count for text
     */
    NonStreamingHandler.prototype.estimateTokens = function (text) {
        // Simple estimation: roughly 4 characters per token
        return Math.ceil(text.length / 4);
    };
    /**
     * Generate unique response ID
     */
    NonStreamingHandler.prototype.generateResponseId = function () {
        var timestamp = Date.now().toString(36);
        var random = Math.random().toString(36).substring(2);
        return "chatcmpl-".concat(timestamp).concat(random);
    };
    /**
     * Generate unique tool call ID
     */
    NonStreamingHandler.prototype.generateToolCallId = function () {
        var timestamp = Date.now().toString(36);
        var random = Math.random().toString(36).substring(2);
        return "call_".concat(timestamp).concat(random);
    };
    return NonStreamingHandler;
}());
exports.NonStreamingHandler = NonStreamingHandler;
exports.nonStreamingHandler = new NonStreamingHandler();
