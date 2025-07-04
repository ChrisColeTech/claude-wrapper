"use strict";
/**
 * Authentication utilities for route handlers
 * Extracted from auth.ts for SRP compliance (under 200 lines)
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
exports.isApiKeyProtectionEnabled = exports.getAuthErrors = exports.getCurrentAuthMethod = exports.isAuthenticationConfigured = exports.getAuthMethodString = exports.getApiKeySource = void 0;
var auth_manager_1 = require("../auth/auth-manager");
var interfaces_1 = require("../auth/interfaces");
/**
 * Determine API key source
 * Based on Python main.py:766 api_key_source logic
 */
function getApiKeySource(activeApiKey) {
    if (!activeApiKey) {
        return 'none';
    }
    // Check if API key comes from environment
    if (process.env.API_KEY) {
        return 'environment';
    }
    // Otherwise it's runtime-generated
    return 'runtime';
}
exports.getApiKeySource = getApiKeySource;
/**
 * Convert AuthMethod enum to string
 * Matches Python authentication method strings
 */
function getAuthMethodString(method) {
    switch (method) {
        case interfaces_1.AuthMethod.ANTHROPIC:
            return 'anthropic';
        case interfaces_1.AuthMethod.BEDROCK:
            return 'bedrock';
        case interfaces_1.AuthMethod.VERTEX:
            return 'vertex';
        case interfaces_1.AuthMethod.CLAUDE_CLI:
            return 'claude_cli';
        default:
            return 'claude_cli'; // Default fallback matches Python
    }
}
exports.getAuthMethodString = getAuthMethodString;
/**
 * Check if authentication is configured
 * Helper method for status checks
 */
function isAuthenticationConfigured() {
    return __awaiter(this, void 0, void 0, function () {
        var status;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, auth_manager_1.authManager.getAuthStatus()];
                case 1:
                    status = _a.sent();
                    return [2 /*return*/, status.authenticated];
            }
        });
    });
}
exports.isAuthenticationConfigured = isAuthenticationConfigured;
/**
 * Get current authentication method string
 * Helper method for external usage
 */
function getCurrentAuthMethod() {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, auth_manager_1.authManager.detectAuthMethod()];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, getAuthMethodString(result.method)];
            }
        });
    });
}
exports.getCurrentAuthMethod = getCurrentAuthMethod;
/**
 * Get authentication validation errors
 * Helper method for troubleshooting
 */
function getAuthErrors() {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, auth_manager_1.authManager.detectAuthMethod()];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.errors];
            }
        });
    });
}
exports.getAuthErrors = getAuthErrors;
/**
 * Check if server has API key protection enabled
 * Helper method for security status
 */
function isApiKeyProtectionEnabled() {
    return auth_manager_1.authManager.isProtected();
}
exports.isApiKeyProtectionEnabled = isApiKeyProtectionEnabled;
