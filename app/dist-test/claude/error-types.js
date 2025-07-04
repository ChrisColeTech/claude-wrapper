"use strict";
/**
 * Claude SDK Error Types
 * Based on CLAUDE_SDK_REFERENCE.md error handling patterns
 *
 * Single Responsibility: Define consistent error types for Claude SDK operations
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
exports.handleClaudeSDKCall = exports.VerificationError = exports.StreamingError = exports.AuthenticationError = exports.ClaudeSDKError = void 0;
/**
 * Base error class for all Claude SDK operations
 */
var ClaudeSDKError = /** @class */ (function (_super) {
    __extends(ClaudeSDKError, _super);
    function ClaudeSDKError(message, code) {
        var _this = _super.call(this, message) || this;
        _this.name = 'ClaudeSDKError';
        _this.code = code;
        // Maintain proper stack trace for debugging
        if (Error.captureStackTrace) {
            Error.captureStackTrace(_this, ClaudeSDKError);
        }
        return _this;
    }
    return ClaudeSDKError;
}(Error));
exports.ClaudeSDKError = ClaudeSDKError;
/**
 * Authentication-specific error for Claude SDK
 */
var AuthenticationError = /** @class */ (function (_super) {
    __extends(AuthenticationError, _super);
    function AuthenticationError(message) {
        var _this = _super.call(this, message, 'AUTHENTICATION_FAILED') || this;
        _this.name = 'AuthenticationError';
        return _this;
    }
    return AuthenticationError;
}(ClaudeSDKError));
exports.AuthenticationError = AuthenticationError;
/**
 * Streaming-specific error for Claude SDK
 */
var StreamingError = /** @class */ (function (_super) {
    __extends(StreamingError, _super);
    function StreamingError(message) {
        var _this = _super.call(this, message, 'STREAMING_FAILED') || this;
        _this.name = 'StreamingError';
        return _this;
    }
    return StreamingError;
}(ClaudeSDKError));
exports.StreamingError = StreamingError;
/**
 * SDK verification error
 */
var VerificationError = /** @class */ (function (_super) {
    __extends(VerificationError, _super);
    function VerificationError(message) {
        var _this = _super.call(this, message, 'VERIFICATION_FAILED') || this;
        _this.name = 'VerificationError';
        return _this;
    }
    return VerificationError;
}(ClaudeSDKError));
exports.VerificationError = VerificationError;
/**
 * Error handling wrapper for Claude SDK calls
 * Based on CLAUDE_SDK_REFERENCE.md handleClaudeSDKCall pattern
 */
function handleClaudeSDKCall(operation) {
    return __awaiter(this, void 0, void 0, function () {
        var error_1, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, operation()];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    error_1 = _a.sent();
                    errorMessage = error_1 instanceof Error ? error_1.message : String(error_1);
                    if (errorMessage.includes('authentication')) {
                        throw new AuthenticationError("Claude Code authentication failed: ".concat(errorMessage));
                    }
                    if (errorMessage.includes('stream')) {
                        throw new StreamingError("Streaming failed: ".concat(errorMessage));
                    }
                    throw new ClaudeSDKError("SDK operation failed: ".concat(errorMessage));
                case 3: return [2 /*return*/];
            }
        });
    });
}
exports.handleClaudeSDKCall = handleClaudeSDKCall;
