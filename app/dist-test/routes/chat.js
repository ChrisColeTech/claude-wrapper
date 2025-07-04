"use strict";
/**
 * Chat completions endpoint implementation
 * Single Responsibility: OpenAI-compatible chat completions API endpoint
 * Refactored for Phase 5B architecture compliance
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
exports.ChatRouter = void 0;
var express_1 = require("express");
var validator_1 = require("../validation/validator");
var headers_1 = require("../validation/headers");
var compatibility_1 = require("../validation/compatibility");
var session_service_1 = require("../services/session-service");
var message_service_1 = require("../services/message-service");
var tools_1 = require("../tools");
var streaming_handler_1 = require("./streaming-handler");
var non_streaming_handler_1 = require("./non-streaming-handler");
var request_validator_1 = require("./request-validator");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('ChatRouter');
/**
 * Chat router class implementing OpenAI chat completions endpoint
 * Refactored for Phase 5B compliance with SRP and DRY principles
 */
var ChatRouter = /** @class */ (function () {
    function ChatRouter() {
        this.sessionService = new session_service_1.SessionService();
        this.messageService = new message_service_1.MessageService();
    }
    /**
     * Create Express router with chat endpoints
     */
    ChatRouter.createRouter = function () {
        var router = (0, express_1.Router)();
        var chatRouter = new ChatRouter();
        router.post('/v1/chat/completions', chatRouter.createChatCompletion.bind(chatRouter));
        return router;
    };
    /**
     * Create chat completion endpoint
     * Refactored for Phase 5B architecture compliance
     */
    ChatRouter.prototype.createChatCompletion = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var validation, paramValidation, compatibilityOptions, modelValidation, supportedModels, claudeHeaders, request, choiceContext, multiToolResult, sessionData, messageConversion, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 9, , 10]);
                        logger.info('Chat completion request received');
                        validation = request_validator_1.requestValidator.validateChatRequest(req.body);
                        if (!validation.isValid) {
                            res.status(400).json({
                                error: 'Bad Request',
                                message: 'Invalid request parameters',
                                details: validation.errors
                            });
                            return [2 /*return*/];
                        }
                        paramValidation = request_validator_1.requestValidator.validateWithParameterValidator(req.body);
                        if (!paramValidation.isValid) {
                            res.status(400).json({
                                error: 'Bad Request',
                                message: 'Request validation failed',
                                details: paramValidation.errors
                            });
                            return [2 /*return*/];
                        }
                        compatibilityOptions = compatibility_1.CompatibilityReporter.getClaudeSDKOptions(req.body);
                        modelValidation = request_validator_1.requestValidator.validateModelSupport(compatibilityOptions.model || req.body.model);
                        if (!modelValidation.isValid) {
                            supportedModels = validator_1.ParameterValidator.getSupportedModels();
                            res.status(400).json({
                                error: 'Bad Request',
                                message: "Model ".concat(compatibilityOptions.model || req.body.model, " is not supported"),
                                supported_models: supportedModels,
                                details: modelValidation.errors
                            });
                            return [2 /*return*/];
                        }
                        claudeHeaders = headers_1.HeaderProcessor.extractClaudeHeaders(req.headers);
                        request = req.body;
                        return [4 /*yield*/, this.processToolChoice(request)];
                    case 1:
                        choiceContext = _a.sent();
                        return [4 /*yield*/, this.processMultiToolCalls(request)];
                    case 2:
                        multiToolResult = _a.sent();
                        if (!multiToolResult.success && multiToolResult.errors.length > 0) {
                            logger.warn('Multi-tool processing warnings:', multiToolResult.errors);
                        }
                        return [4 /*yield*/, this.processSessionMessages(request)];
                    case 3:
                        sessionData = _a.sent();
                        return [4 /*yield*/, this.messageService.convertToClaudeFormat(sessionData.messages)];
                    case 4:
                        messageConversion = _a.sent();
                        if (!request.stream) return [3 /*break*/, 6];
                        return [4 /*yield*/, streaming_handler_1.streamingHandler.handleStreamingResponse({
                                request: request,
                                claudeHeaders: claudeHeaders,
                                prompt: messageConversion.prompt,
                                sessionId: sessionData.sessionId
                            }, res)];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 8];
                    case 6: return [4 /*yield*/, non_streaming_handler_1.nonStreamingHandler.handleNonStreamingResponse({
                            request: request,
                            claudeHeaders: claudeHeaders,
                            prompt: messageConversion.prompt,
                            choiceContext: choiceContext,
                            sessionId: sessionData.sessionId
                        }, res)];
                    case 7:
                        _a.sent();
                        _a.label = 8;
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        error_1 = _a.sent();
                        logger.error('Chat completion error:', error_1);
                        if (!res.headersSent) {
                            res.status(500).json({
                                error: 'Internal Server Error',
                                message: 'An error occurred while processing the completion'
                            });
                        }
                        return [3 /*break*/, 10];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Process tool choice context
     */
    ChatRouter.prototype.processToolChoice = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var choiceContext, startTime, choiceResult, behavior, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        choiceContext = {
                            hasChoice: !!request.tool_choice,
                            choiceType: 'auto',
                            allowsTools: request.enable_tools !== false,
                            forcesTextOnly: false,
                            forcesSpecificFunction: false,
                            functionName: undefined,
                            claudeFormat: {
                                mode: 'auto',
                                allowTools: true
                            },
                            processingTimeMs: 0
                        };
                        if (!request.tool_choice) return [3 /*break*/, 4];
                        startTime = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, tools_1.toolChoiceProcessor.processChoice({
                                choice: request.tool_choice,
                                tools: request.tools || []
                            })];
                    case 2:
                        choiceResult = _a.sent();
                        if (choiceResult.success && choiceResult.processedChoice) {
                            behavior = choiceResult.processedChoice.behavior;
                            if ((behavior === null || behavior === void 0 ? void 0 : behavior.toString()) === 'none') {
                                choiceContext.forcesTextOnly = true;
                                choiceContext.choiceType = 'none';
                            }
                            else if ((behavior === null || behavior === void 0 ? void 0 : behavior.toString()) === 'specific' && choiceResult.processedChoice.functionName) {
                                choiceContext.forcesSpecificFunction = true;
                                choiceContext.functionName = choiceResult.processedChoice.functionName;
                                choiceContext.choiceType = 'function';
                            }
                        }
                        choiceContext.processingTimeMs = Date.now() - startTime;
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        logger.warn('Tool choice processing failed:', error_2);
                        choiceContext.processingTimeMs = Date.now() - startTime;
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, choiceContext];
                }
            });
        });
    };
    /**
     * Process multi-tool calls (Phase 7A)
     */
    ChatRouter.prototype.processMultiToolCalls = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var toolCalls, _i, _a, message, startTime, multiToolRequest, result, error_3, processingTime;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!request.tools || request.tools.length === 0) {
                            return [2 /*return*/, {
                                    success: true,
                                    toolCalls: [],
                                    errors: [],
                                    processingTimeMs: 0
                                }];
                        }
                        toolCalls = [];
                        for (_i = 0, _a = request.messages; _i < _a.length; _i++) {
                            message = _a[_i];
                            if (message.role === 'assistant' && message.tool_calls) {
                                toolCalls.push.apply(toolCalls, message.tool_calls);
                            }
                        }
                        if (toolCalls.length === 0) {
                            return [2 /*return*/, {
                                    success: true,
                                    toolCalls: [],
                                    errors: [],
                                    processingTimeMs: 0
                                }];
                        }
                        startTime = Date.now();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        multiToolRequest = {
                            tools: request.tools,
                            toolCalls: toolCalls,
                            sessionId: request.session_id,
                            requestId: "req-".concat(Date.now()),
                            parallel: toolCalls.length > 1 // Use parallel processing for multiple calls
                        };
                        return [4 /*yield*/, tools_1.multiToolCallHandler.processMultipleToolCalls(multiToolRequest)];
                    case 2:
                        result = _b.sent();
                        return [2 /*return*/, {
                                success: result.success,
                                toolCalls: result.toolCalls,
                                errors: result.errors,
                                processingTimeMs: Date.now() - startTime
                            }];
                    case 3:
                        error_3 = _b.sent();
                        processingTime = Date.now() - startTime;
                        logger.error('Multi-tool processing failed:', error_3);
                        return [2 /*return*/, {
                                success: false,
                                toolCalls: [],
                                errors: [error_3 instanceof Error ? error_3.message : 'Multi-tool processing failed'],
                                processingTimeMs: processingTime
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Process session messages
     */
    ChatRouter.prototype.processSessionMessages = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var messages, sessionId, existingSession;
            return __generator(this, function (_a) {
                messages = request.messages;
                sessionId = request.session_id;
                // Handle session continuity
                if (sessionId) {
                    existingSession = this.sessionService.getSessionWithMessages(sessionId);
                    if (existingSession) {
                        // Merge existing messages with new ones
                        messages = __spreadArray(__spreadArray([], existingSession.messages, true), request.messages, true);
                    }
                    else {
                        // Create new session
                        this.sessionService.createSession({
                            model: request.model,
                            system_prompt: 'You are a helpful assistant.',
                            max_turns: 10
                        });
                    }
                }
                return [2 /*return*/, { messages: messages, sessionId: sessionId }];
            });
        });
    };
    return ChatRouter;
}());
exports.ChatRouter = ChatRouter;
exports["default"] = ChatRouter;
