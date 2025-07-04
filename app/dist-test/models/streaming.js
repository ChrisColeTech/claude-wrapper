"use strict";
/**
 * Streaming Response Models for OpenAI Chat Completions API
 * Based on Python models.py:131-143 (StreamChoice, ChatCompletionStreamResponse)
 * Provides complete OpenAI-compatible streaming structure with Zod validation
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.StreamValidationError = exports.StreamProcessingError = exports.StreamingUtils = exports.StreamDeltaTypes = exports.ChatCompletionStreamResponseSchema = exports.StreamChoiceSchema = void 0;
var zod_1 = require("zod");
var error_1 = require("./error");
/**
 * Stream choice schema for streaming chat completion response
 * Based on Python StreamChoice class
 */
exports.StreamChoiceSchema = zod_1.z.object({
    index: zod_1.z.number().int().nonnegative(),
    delta: zod_1.z.record(zod_1.z.string(), zod_1.z.any()),
    finish_reason: zod_1.z["enum"](["stop", "length", "content_filter", "null"]).nullable().optional()
});
/**
 * Chat completion streaming response schema
 * Based on Python ChatCompletionStreamResponse class
 */
exports.ChatCompletionStreamResponseSchema = zod_1.z.object({
    id: zod_1.z.string()["default"](function () { return "chatcmpl-".concat(generateStreamId()); }),
    object: zod_1.z.literal("chat.completion.chunk")["default"]("chat.completion.chunk"),
    created: zod_1.z.number().int()["default"](function () { return Math.floor(Date.now() / 1000); }),
    model: zod_1.z.string(),
    choices: zod_1.z.array(exports.StreamChoiceSchema),
    system_fingerprint: zod_1.z.string().optional()
});
/**
 * Common delta types for streaming
 */
exports.StreamDeltaTypes = {
    /**
     * Delta with role (first chunk)
     */
    role: function (role) { return ({
        role: role
    }); },
    /**
     * Delta with content (content chunks)
     */
    content: function (content) { return ({
        content: content
    }); },
    /**
     * Empty delta (final chunk)
     */
    empty: function () { return ({}); }
};
/**
 * Streaming utilities
 */
exports.StreamingUtils = {
    /**
     * Create initial streaming response chunk (with role)
     */
    createInitialChunk: function (id, model, role) {
        if (role === void 0) { role = "assistant"; }
        return ({
            id: id,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
                    index: 0,
                    delta: exports.StreamDeltaTypes.role(role),
                    finish_reason: null
                }],
            system_fingerprint: undefined
        });
    },
    /**
     * Create content streaming chunk
     */
    createContentChunk: function (id, model, content) { return ({
        id: id,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
                index: 0,
                delta: exports.StreamDeltaTypes.content(content),
                finish_reason: null
            }],
        system_fingerprint: undefined
    }); },
    /**
     * Create final streaming chunk (with finish_reason)
     */
    createFinalChunk: function (id, model, finishReason) {
        if (finishReason === void 0) { finishReason = "stop"; }
        return ({
            id: id,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
                    index: 0,
                    delta: exports.StreamDeltaTypes.empty(),
                    finish_reason: finishReason
                }],
            system_fingerprint: undefined
        });
    },
    /**
     * Create streaming response from content string
     */
    createStreamFromContent: function (content, model, chunkSize) {
        var id, i, chunk;
        if (chunkSize === void 0) { chunkSize = 50; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    id = "chatcmpl-".concat(generateStreamId());
                    // Initial chunk with role
                    return [4 /*yield*/, this.createInitialChunk(id, model)];
                case 1:
                    // Initial chunk with role
                    _a.sent();
                    i = 0;
                    _a.label = 2;
                case 2:
                    if (!(i < content.length)) return [3 /*break*/, 5];
                    chunk = content.slice(i, i + chunkSize);
                    return [4 /*yield*/, this.createContentChunk(id, model, chunk)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    i += chunkSize;
                    return [3 /*break*/, 2];
                case 5: 
                // Final chunk
                return [4 /*yield*/, this.createFinalChunk(id, model)];
                case 6:
                    // Final chunk
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    },
    /**
     * Convert streaming response to Server-Sent Events format
     */
    toSSE: function (chunk) {
        var data = JSON.stringify(chunk);
        return "data: ".concat(data, "\n\n");
    },
    /**
     * Create done event for SSE
     */
    createDoneEvent: function () {
        return "data: [DONE]\n\n";
    },
    /**
     * Validate streaming response
     */
    validateStreamResponse: function (response) {
        return exports.ChatCompletionStreamResponseSchema.parse(response);
    }
};
/**
 * Generate unique ID for streaming chat completion
 */
function generateStreamId() {
    return Math.random().toString(36).substring(2, 10);
}
/**
 * Streaming error types
 */
var StreamProcessingError = /** @class */ (function (_super) {
    __extends(StreamProcessingError, _super);
    function StreamProcessingError(message) {
        return _super.call(this, "Stream processing error: ".concat(message)) || this;
    }
    return StreamProcessingError;
}(error_1.StreamingError));
exports.StreamProcessingError = StreamProcessingError;
var StreamValidationError = /** @class */ (function (_super) {
    __extends(StreamValidationError, _super);
    function StreamValidationError(message) {
        return _super.call(this, "Stream validation error: ".concat(message)) || this;
    }
    return StreamValidationError;
}(error_1.StreamingError));
exports.StreamValidationError = StreamValidationError;
