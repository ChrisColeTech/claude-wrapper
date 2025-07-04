"use strict";
/**
 * Streaming response handler service
 * Single Responsibility: Handle streaming chat completion responses
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
exports.streamingHandler = exports.StreamingHandler = void 0;
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('StreamingHandler');
var StreamingHandler = /** @class */ (function () {
    function StreamingHandler() {
    }
    /**
     * Handle streaming response for chat completion
     */
    StreamingHandler.prototype.handleStreamingResponse = function (context, res) {
        return __awaiter(this, void 0, void 0, function () {
            var request, claudeHeaders, prompt, sessionId, responseId, created, claudeOptions, mockContent, i, chunk, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        request = context.request, claudeHeaders = context.claudeHeaders, prompt = context.prompt, sessionId = context.sessionId;
                        // Set streaming headers
                        res.setHeader('Content-Type', 'text/event-stream');
                        res.setHeader('Cache-Control', 'no-cache');
                        res.setHeader('Connection', 'keep-alive');
                        res.setHeader('Access-Control-Allow-Origin', '*');
                        res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
                        responseId = this.generateResponseId();
                        created = Math.floor(Date.now() / 1000);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        claudeOptions = this.buildClaudeOptions(request, claudeHeaders);
                        mockContent = 'I understand your request and will help you with that.';
                        i = 0;
                        _a.label = 2;
                    case 2:
                        if (!(i < mockContent.length)) return [3 /*break*/, 5];
                        chunk = mockContent.slice(i, i + 5);
                        this.sendStreamChunk(res, {
                            id: responseId,
                            created: created,
                            model: request.model,
                            content: chunk,
                            isComplete: false,
                            sessionId: sessionId
                        });
                        // Small delay to simulate streaming
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })];
                    case 3:
                        // Small delay to simulate streaming
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        i += 5;
                        return [3 /*break*/, 2];
                    case 5:
                        // Send final chunk
                        this.sendStreamChunk(res, {
                            id: responseId,
                            created: created,
                            model: request.model,
                            content: '',
                            isComplete: true,
                            sessionId: sessionId
                        });
                        // Send completion
                        this.sendStreamCompletion(res);
                        return [3 /*break*/, 7];
                    case 6:
                        error_1 = _a.sent();
                        logger.error('Streaming error:', error_1);
                        this.sendStreamError(res, error_1 instanceof Error ? error_1.message : 'Unknown error');
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Send streaming chunk
     */
    StreamingHandler.prototype.sendStreamChunk = function (res, data) {
        var chunk = {
            id: data.id,
            object: 'chat.completion.chunk',
            created: data.created,
            model: data.model,
            choices: [{
                    index: 0,
                    delta: data.isComplete ? {} : { content: data.content },
                    finish_reason: data.isComplete ? 'stop' : null
                }]
        };
        if (data.sessionId) {
            chunk.session_id = data.sessionId;
        }
        res.write("data: ".concat(JSON.stringify(chunk), "\n\n"));
    };
    /**
     * Send stream completion
     */
    StreamingHandler.prototype.sendStreamCompletion = function (res) {
        res.write('data: [DONE]\n\n');
        res.end();
    };
    /**
     * Send stream error
     */
    StreamingHandler.prototype.sendStreamError = function (res, error) {
        var errorChunk = {
            error: {
                message: error,
                type: 'server_error'
            }
        };
        res.write("data: ".concat(JSON.stringify(errorChunk), "\n\n"));
        res.write('data: [DONE]\n\n');
        res.end();
    };
    /**
     * Build Claude options from request
     */
    StreamingHandler.prototype.buildClaudeOptions = function (request, claudeHeaders) {
        var _a, _b;
        var options = {
            model: request.model,
            max_tokens: request.max_tokens || 2048,
            temperature: (_a = request.temperature) !== null && _a !== void 0 ? _a : 1.0,
            top_p: (_b = request.top_p) !== null && _b !== void 0 ? _b : 1.0,
            stream: true
        };
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
     * Generate unique response ID
     */
    StreamingHandler.prototype.generateResponseId = function () {
        var timestamp = Date.now().toString(36);
        var random = Math.random().toString(36).substring(2);
        return "chatcmpl-".concat(timestamp).concat(random);
    };
    return StreamingHandler;
}());
exports.StreamingHandler = StreamingHandler;
exports.streamingHandler = new StreamingHandler();
