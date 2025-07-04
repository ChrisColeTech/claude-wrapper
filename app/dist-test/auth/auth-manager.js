"use strict";
/**
 * Multi-provider authentication manager
 * Based on Python auth.py authentication system
 *
 * Single Responsibility: Coordinate authentication across multiple providers
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
exports.validateClaudeCodeAuth = exports.authManager = exports.AuthManager = void 0;
var interfaces_1 = require("./interfaces");
var anthropic_provider_1 = require("./providers/anthropic-provider");
var bedrock_provider_1 = require("./providers/bedrock-provider");
var vertex_provider_1 = require("./providers/vertex-provider");
var claude_cli_provider_1 = require("./providers/claude-cli-provider");
var crypto_1 = require("../utils/crypto");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('AuthManager');
/**
 * Authentication manager that handles multiple providers
 */
var AuthManager = /** @class */ (function () {
    function AuthManager() {
        this.currentProvider = null;
        // Initialize all providers in detection order (matching Python)
        this.providers = [
            new anthropic_provider_1.AnthropicProvider(),
            new bedrock_provider_1.BedrockProvider(),
            new vertex_provider_1.VertexProvider(),
            new claude_cli_provider_1.ClaudeCliProvider()
        ];
    }
    /**
     * Detect and validate authentication method
     * Based on Python _detect_auth_method() with exact flag-based priority logic
     */
    AuthManager.prototype.detectAuthMethod = function () {
        return __awaiter(this, void 0, void 0, function () {
            var bedrockProvider, result, vertexProvider, result, anthropicProvider, result, cliProvider, result, allErrors;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger.debug('Starting authentication method detection (Python-compatible)');
                        if (!(process.env.CLAUDE_CODE_USE_BEDROCK === "1")) return [3 /*break*/, 2];
                        logger.debug('CLAUDE_CODE_USE_BEDROCK=1 flag detected, using Bedrock');
                        bedrockProvider = this.providers.find(function (p) { return p.getMethod() === interfaces_1.AuthMethod.BEDROCK; });
                        if (!bedrockProvider) return [3 /*break*/, 2];
                        return [4 /*yield*/, bedrockProvider.validate()];
                    case 1:
                        result = _a.sent();
                        if (result.valid) {
                            logger.info('Bedrock authentication validated via explicit flag');
                            this.currentProvider = bedrockProvider;
                            return [2 /*return*/, result];
                        }
                        else {
                            logger.error("Bedrock validation failed despite CLAUDE_CODE_USE_BEDROCK=1: ".concat(result.errors.join(', ')));
                            return [2 /*return*/, result]; // Return failure - explicit flag means user wants Bedrock
                        }
                        _a.label = 2;
                    case 2:
                        if (!(process.env.CLAUDE_CODE_USE_VERTEX === "1")) return [3 /*break*/, 4];
                        logger.debug('CLAUDE_CODE_USE_VERTEX=1 flag detected, using Vertex');
                        vertexProvider = this.providers.find(function (p) { return p.getMethod() === interfaces_1.AuthMethod.VERTEX; });
                        if (!vertexProvider) return [3 /*break*/, 4];
                        return [4 /*yield*/, vertexProvider.validate()];
                    case 3:
                        result = _a.sent();
                        if (result.valid) {
                            logger.info('Vertex authentication validated via explicit flag');
                            this.currentProvider = vertexProvider;
                            return [2 /*return*/, result];
                        }
                        else {
                            logger.error("Vertex validation failed despite CLAUDE_CODE_USE_VERTEX=1: ".concat(result.errors.join(', ')));
                            return [2 /*return*/, result]; // Return failure - explicit flag means user wants Vertex
                        }
                        _a.label = 4;
                    case 4:
                        if (!process.env.ANTHROPIC_API_KEY) return [3 /*break*/, 6];
                        logger.debug('ANTHROPIC_API_KEY detected, using Anthropic');
                        anthropicProvider = this.providers.find(function (p) { return p.getMethod() === interfaces_1.AuthMethod.ANTHROPIC; });
                        if (!anthropicProvider) return [3 /*break*/, 6];
                        return [4 /*yield*/, anthropicProvider.validate()];
                    case 5:
                        result = _a.sent();
                        if (result.valid) {
                            logger.info('Anthropic authentication validated via API key presence');
                            this.currentProvider = anthropicProvider;
                            return [2 /*return*/, result];
                        }
                        else {
                            logger.debug("Anthropic validation failed: ".concat(result.errors.join(', ')));
                            // Continue to Claude CLI fallback - matches Python behavior
                        }
                        _a.label = 6;
                    case 6:
                        // 4. Default to Claude CLI (lowest priority - matches Python)
                        logger.debug('No explicit flags or ANTHROPIC_API_KEY, defaulting to Claude CLI');
                        cliProvider = this.providers.find(function (p) { return p.getMethod() === interfaces_1.AuthMethod.CLAUDE_CLI; });
                        if (!cliProvider) return [3 /*break*/, 8];
                        return [4 /*yield*/, cliProvider.validate()];
                    case 7:
                        result = _a.sent();
                        if (result.valid) {
                            logger.info('Claude CLI authentication validated as fallback');
                            this.currentProvider = cliProvider;
                            return [2 /*return*/, result];
                        }
                        else {
                            logger.debug("Claude CLI validation failed: ".concat(result.errors.join(', ')));
                        }
                        _a.label = 8;
                    case 8: return [4 /*yield*/, this.collectAllErrors()];
                    case 9:
                        allErrors = _a.sent();
                        logger.error("No valid authentication method found. Errors: ".concat(allErrors.join('; ')));
                        return [2 /*return*/, {
                                valid: false,
                                errors: allErrors,
                                config: {},
                                method: interfaces_1.AuthMethod.CLAUDE_CLI // Default fallback matches Python
                            }];
                }
            });
        });
    };
    /**
     * Get environment variables for Claude Code SDK
     * Based on Python get_claude_code_env_vars()
     */
    AuthManager.prototype.getClaudeCodeEnvVars = function () {
        if (!this.currentProvider) {
            logger.warn('No authentication provider selected');
            return {};
        }
        var method = this.currentProvider.getMethod();
        var envVars = {};
        logger.debug("Getting Claude Code env vars for ".concat(method));
        switch (method) {
            case interfaces_1.AuthMethod.ANTHROPIC:
                // Anthropic uses ANTHROPIC_API_KEY
                if (process.env.ANTHROPIC_API_KEY) {
                    envVars.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
                    logger.debug('Using ANTHROPIC_API_KEY from environment');
                }
                break;
            case interfaces_1.AuthMethod.BEDROCK:
                // Bedrock uses AWS credentials + explicit flag forwarding (matches Python)
                if (process.env.AWS_ACCESS_KEY_ID) {
                    envVars.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
                }
                if (process.env.AWS_SECRET_ACCESS_KEY) {
                    envVars.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
                }
                if (process.env.AWS_SESSION_TOKEN) {
                    envVars.AWS_SESSION_TOKEN = process.env.AWS_SESSION_TOKEN;
                }
                if (process.env.AWS_REGION) {
                    envVars.AWS_REGION = process.env.AWS_REGION;
                }
                if (process.env.AWS_PROFILE) {
                    envVars.AWS_PROFILE = process.env.AWS_PROFILE;
                }
                // Forward explicit flag to Claude Code SDK (matches Python behavior)
                envVars.CLAUDE_CODE_USE_BEDROCK = "1";
                logger.debug('Using AWS credentials from environment with CLAUDE_CODE_USE_BEDROCK flag');
                break;
            case interfaces_1.AuthMethod.VERTEX:
                // Vertex uses Google Cloud credentials + explicit flag forwarding (matches Python)
                if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                    envVars.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
                }
                if (process.env.GCLOUD_PROJECT) {
                    envVars.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT;
                }
                if (process.env.GOOGLE_CLOUD_PROJECT) {
                    envVars.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
                }
                // Forward explicit flag to Claude Code SDK (matches Python behavior)
                envVars.CLAUDE_CODE_USE_VERTEX = "1";
                logger.debug('Using Google Cloud credentials from environment with CLAUDE_CODE_USE_VERTEX flag');
                break;
            case interfaces_1.AuthMethod.CLAUDE_CLI:
                // Claude CLI uses system authentication
                logger.debug('Claude CLI uses system authentication');
                break;
            default:
                logger.warn("Unknown authentication method: ".concat(method));
        }
        return envVars;
    };
    /**
     * Validate current authentication configuration
     */
    AuthManager.prototype.validateAuth = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result_1, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.currentProvider) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.detectAuthMethod()];
                    case 1:
                        result_1 = _a.sent();
                        return [2 /*return*/, result_1.valid];
                    case 2: return [4 /*yield*/, this.currentProvider.validate()];
                    case 3:
                        result = _a.sent();
                        return [2 /*return*/, result.valid];
                }
            });
        });
    };
    /**
     * Get current authentication method
     */
    AuthManager.prototype.getCurrentMethod = function () {
        var _a;
        return ((_a = this.currentProvider) === null || _a === void 0 ? void 0 : _a.getMethod()) || null;
    };
    /**
     * Get the active API key (environment or runtime-generated)
     */
    AuthManager.prototype.getApiKey = function () {
        // Runtime API key takes precedence
        if (this.runtimeApiKey) {
            logger.debug("Using runtime API key: ".concat((0, crypto_1.createSafeHash)(this.runtimeApiKey)));
            return this.runtimeApiKey;
        }
        // Check environment variable
        if (process.env.API_KEY) {
            logger.debug("Using API key from environment: ".concat((0, crypto_1.createSafeHash)(process.env.API_KEY)));
            return process.env.API_KEY;
        }
        logger.debug('No API key configured');
        return undefined;
    };
    /**
     * Set runtime API key
     */
    AuthManager.prototype.setApiKey = function (apiKey) {
        this.runtimeApiKey = apiKey;
        logger.info("Runtime API key set: ".concat((0, crypto_1.createSafeHash)(apiKey)));
    };
    /**
     * Check if API key protection is enabled
     */
    AuthManager.prototype.isProtected = function () {
        return this.getApiKey() !== undefined;
    };
    /**
     * Get all authentication providers
     */
    AuthManager.prototype.getProviders = function () {
        return __spreadArray([], this.providers, true);
    };
    /**
     * Get authentication status information
     */
    AuthManager.prototype.getAuthStatus = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.detectAuthMethod()];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, {
                                authenticated: result.valid,
                                method: result.valid ? result.method : null,
                                apiKeyProtected: this.isProtected(),
                                errors: result.errors
                            }];
                }
            });
        });
    };
    /**
     * Type guard for auto-detect providers
     */
    AuthManager.prototype.isAutoDetectProvider = function (provider) {
        return 'canDetect' in provider;
    };
    /**
     * Collect all validation errors from providers
     */
    AuthManager.prototype.collectAllErrors = function () {
        return __awaiter(this, void 0, void 0, function () {
            var errors, _loop_1, _i, _a, provider;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        errors = [];
                        _loop_1 = function (provider) {
                            var result, error_1;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        _c.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, provider.validate()];
                                    case 1:
                                        result = _c.sent();
                                        if (!result.valid) {
                                            errors.push.apply(errors, result.errors.map(function (err) { return "".concat(provider.getMethod(), ": ").concat(err); }));
                                        }
                                        return [3 /*break*/, 3];
                                    case 2:
                                        error_1 = _c.sent();
                                        errors.push("".concat(provider.getMethod(), ": ").concat(error_1));
                                        return [3 /*break*/, 3];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        };
                        _i = 0, _a = this.providers;
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        provider = _a[_i];
                        return [5 /*yield**/, _loop_1(provider)];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, errors];
                }
            });
        });
    };
    return AuthManager;
}());
exports.AuthManager = AuthManager;
/**
 * Global authentication manager instance
 */
exports.authManager = new AuthManager();
/**
 * Convenience function to validate Claude Code authentication
 * Based on Python validate_claude_code_auth()
 */
function validateClaudeCodeAuth() {
    return __awaiter(this, void 0, void 0, function () {
        var result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, exports.authManager.detectAuthMethod()];
                case 1:
                    result = _a.sent();
                    if (result.valid) {
                        return [2 /*return*/, [true, { method: result.method, errors: [] }]];
                    }
                    else {
                        return [2 /*return*/, [false, { errors: result.errors }]];
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    return [2 /*return*/, [false, { errors: ["Authentication validation failed: ".concat(error_2)] }]];
                case 3: return [2 /*return*/];
            }
        });
    });
}
exports.validateClaudeCodeAuth = validateClaudeCodeAuth;
