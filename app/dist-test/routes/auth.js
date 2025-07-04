"use strict";
/**
 * Authentication status endpoint implementation
 * Based on Python main.py:754-769 get_auth_status endpoint
 * Implements Phase 12A authentication status requirements
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
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
exports.isApiKeyProtectionEnabled = exports.getAuthErrors = exports.getCurrentAuthMethod = exports.isAuthenticationConfigured = exports.AuthRouter = void 0;
var express_1 = require("express");
var auth_manager_1 = require("../auth/auth-manager");
var logger_1 = require("../utils/logger");
var auth_utils_1 = require("./auth-utils");
// HTTP Status Code Constants (architecture compliance)
var HTTP_STATUS = {
    INTERNAL_SERVER_ERROR: 500
};
var logger = (0, logger_1.getLogger)('AuthRouter');
/**
 * Authentication router class implementing auth status endpoints
 * Based on Python get_auth_status endpoint
 */
var AuthRouter = /** @class */ (function () {
    function AuthRouter() {
    }
    /**
     * Create Express router with authentication endpoints
     */
    AuthRouter.createRouter = function () {
        var router = (0, express_1.Router)();
        // GET /v1/auth/status - Get Claude Code authentication status
        router.get('/v1/auth/status', this.getAuthStatus.bind(this));
        return router;
    };
    /**
     * Get Claude Code authentication status endpoint
     * Based on Python main.py:754-769 get_auth_status function
     */
    AuthRouter.getAuthStatus = function (_req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var authInfo, activeApiKey, serverInfo, response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        logger.debug('Getting Claude Code authentication status');
                        return [4 /*yield*/, this.getClaudeCodeAuthInfo()];
                    case 1:
                        authInfo = _a.sent();
                        activeApiKey = auth_manager_1.authManager.getApiKey();
                        serverInfo = {
                            api_key_required: !!activeApiKey,
                            api_key_source: (0, auth_utils_1.getApiKeySource)(activeApiKey),
                            version: '1.0.0'
                        };
                        response = {
                            claude_code_auth: authInfo,
                            server_info: serverInfo
                        };
                        logger.debug('Authentication status compiled successfully', {
                            method: authInfo.method,
                            valid: authInfo.status.valid,
                            api_key_required: serverInfo.api_key_required,
                            api_key_source: serverInfo.api_key_source
                        });
                        res.json(response);
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        logger.error('Error getting authentication status:', error_1);
                        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                            error: 'Internal Server Error',
                            message: 'Failed to get authentication status'
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get Claude Code authentication information for diagnostics
     * Based on Python auth.py:260-266 get_claude_code_auth_info function
     */
    AuthRouter.getClaudeCodeAuthInfo = function () {
        return __awaiter(this, void 0, void 0, function () {
            var validationResult, envVars, environmentVariables;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, auth_manager_1.authManager.detectAuthMethod()];
                    case 1:
                        validationResult = _a.sent();
                        envVars = auth_manager_1.authManager.getClaudeCodeEnvVars();
                        environmentVariables = Object.keys(envVars);
                        // Build auth info structure (matches Python exactly)
                        return [2 /*return*/, {
                                method: (0, auth_utils_1.getAuthMethodString)(validationResult.method),
                                status: {
                                    method: (0, auth_utils_1.getAuthMethodString)(validationResult.method),
                                    valid: validationResult.valid,
                                    errors: validationResult.errors,
                                    config: validationResult.config
                                },
                                environment_variables: environmentVariables
                            }];
                }
            });
        });
    };
    return AuthRouter;
}());
exports.AuthRouter = AuthRouter;
// Re-export utility methods for backward compatibility
var auth_utils_2 = require("./auth-utils");
__createBinding(exports, auth_utils_2, "isAuthenticationConfigured");
__createBinding(exports, auth_utils_2, "getCurrentAuthMethod");
__createBinding(exports, auth_utils_2, "getAuthErrors");
__createBinding(exports, auth_utils_2, "isApiKeyProtectionEnabled");
exports["default"] = AuthRouter;
