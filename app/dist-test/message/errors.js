"use strict";
/**
 * Message Conversion Errors
 * Single Responsibility: Define error types for message conversion operations
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
exports.handleMessageConversionCall = exports.ConversionTimeoutError = exports.MessageValidationError = exports.MessageParsingError = exports.ContentFilteringError = exports.InvalidMessageFormatError = exports.MessageConversionError = void 0;
var constants_1 = require("./constants");
/**
 * Base error class for message conversion operations
 */
var MessageConversionError = /** @class */ (function (_super) {
    __extends(MessageConversionError, _super);
    function MessageConversionError(message, code, details) {
        if (code === void 0) { code = constants_1.MESSAGE_ERROR_CODES.CONVERSION_FAILED; }
        var _this = _super.call(this, message) || this;
        _this.name = 'MessageConversionError';
        _this.code = code;
        _this.details = details;
        _this.processingTimeMs = details === null || details === void 0 ? void 0 : details.processingTimeMs;
        // Maintain proper stack trace for debugging
        if (Error.captureStackTrace) {
            Error.captureStackTrace(_this, MessageConversionError);
        }
        return _this;
    }
    return MessageConversionError;
}(Error));
exports.MessageConversionError = MessageConversionError;
/**
 * Format-specific error for invalid message formats
 */
var InvalidMessageFormatError = /** @class */ (function (_super) {
    __extends(InvalidMessageFormatError, _super);
    function InvalidMessageFormatError(message, format) {
        var _this = _super.call(this, "Invalid message format".concat(format ? " (".concat(format, ")") : '', ": ").concat(message), constants_1.MESSAGE_ERROR_CODES.INVALID_FORMAT) || this;
        _this.name = 'InvalidMessageFormatError';
        return _this;
    }
    return InvalidMessageFormatError;
}(MessageConversionError));
exports.InvalidMessageFormatError = InvalidMessageFormatError;
/**
 * Content filtering error
 */
var ContentFilteringError = /** @class */ (function (_super) {
    __extends(ContentFilteringError, _super);
    function ContentFilteringError(message, originalContent) {
        var _this = _super.call(this, message, constants_1.MESSAGE_ERROR_CODES.CONTENT_FILTERING_FAILED, {
            code: constants_1.MESSAGE_ERROR_CODES.CONTENT_FILTERING_FAILED,
            message: message,
            source: originalContent
        }) || this;
        _this.name = 'ContentFilteringError';
        return _this;
    }
    return ContentFilteringError;
}(MessageConversionError));
exports.ContentFilteringError = ContentFilteringError;
/**
 * Message parsing error
 */
var MessageParsingError = /** @class */ (function (_super) {
    __extends(MessageParsingError, _super);
    function MessageParsingError(message, sourceMessages) {
        var _this = _super.call(this, message, constants_1.MESSAGE_ERROR_CODES.PARSING_FAILED, {
            code: constants_1.MESSAGE_ERROR_CODES.PARSING_FAILED,
            message: message,
            source: sourceMessages
        }) || this;
        _this.name = 'MessageParsingError';
        return _this;
    }
    return MessageParsingError;
}(MessageConversionError));
exports.MessageParsingError = MessageParsingError;
/**
 * Message validation error
 */
var MessageValidationError = /** @class */ (function (_super) {
    __extends(MessageValidationError, _super);
    function MessageValidationError(message, invalidMessages) {
        var _this = _super.call(this, message, constants_1.MESSAGE_ERROR_CODES.VALIDATION_FAILED, {
            code: constants_1.MESSAGE_ERROR_CODES.VALIDATION_FAILED,
            message: message,
            source: invalidMessages
        }) || this;
        _this.name = 'MessageValidationError';
        return _this;
    }
    return MessageValidationError;
}(MessageConversionError));
exports.MessageValidationError = MessageValidationError;
/**
 * Conversion timeout error
 */
var ConversionTimeoutError = /** @class */ (function (_super) {
    __extends(ConversionTimeoutError, _super);
    function ConversionTimeoutError(timeoutMs, operation) {
        var _this = _super.call(this, "Message conversion timeout: ".concat(operation, " exceeded ").concat(timeoutMs, "ms"), constants_1.MESSAGE_ERROR_CODES.TIMEOUT_EXCEEDED, {
            code: constants_1.MESSAGE_ERROR_CODES.TIMEOUT_EXCEEDED,
            message: "Timeout after ".concat(timeoutMs, "ms"),
            processingTimeMs: timeoutMs
        }) || this;
        _this.name = 'ConversionTimeoutError';
        return _this;
    }
    return ConversionTimeoutError;
}(MessageConversionError));
exports.ConversionTimeoutError = ConversionTimeoutError;
/**
 * Error handling wrapper for message conversion operations
 */
function handleMessageConversionCall(operation, context) {
    return __awaiter(this, void 0, void 0, function () {
        var startTime, error_1, processingTime, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    startTime = Date.now();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, operation()];
                case 2: return [2 /*return*/, _a.sent()];
                case 3:
                    error_1 = _a.sent();
                    processingTime = Date.now() - startTime;
                    errorMessage = error_1 instanceof Error ? error_1.message : String(error_1);
                    // Re-throw message conversion errors as-is
                    if (error_1 instanceof MessageConversionError) {
                        throw error_1;
                    }
                    // Wrap other errors in MessageConversionError
                    throw new MessageConversionError("".concat(context ? context + ': ' : '').concat(errorMessage), constants_1.MESSAGE_ERROR_CODES.CONVERSION_FAILED, {
                        code: constants_1.MESSAGE_ERROR_CODES.CONVERSION_FAILED,
                        message: errorMessage,
                        source: error_1,
                        processingTimeMs: processingTime
                    });
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.handleMessageConversionCall = handleMessageConversionCall;
