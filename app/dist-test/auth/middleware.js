"use strict";
/**
 * Bearer token authentication middleware
 * Based on Python auth.py bearer token validation
 *
 * Single Responsibility: Validate bearer tokens in HTTP requests
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
exports.getAuthHealthStatus = exports.authStatusMiddleware = exports.authMiddleware = exports.bearerTokenValidator = exports.BearerTokenValidator = void 0;
var auth_manager_1 = require("./auth-manager");
var crypto_1 = require("../utils/crypto");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('AuthMiddleware');
/**
 * Bearer token validator implementation
 */
var BearerTokenValidator = /** @class */ (function () {
    function BearerTokenValidator() {
    }
    /**
     * Validate bearer token from authorization header
     */
    BearerTokenValidator.prototype.validateToken = function (token) {
        var expectedToken = auth_manager_1.authManager.getApiKey();
        if (!expectedToken) {
            logger.debug('No API key configured - allowing request');
            return true; // No protection enabled
        }
        if (!token) {
            logger.debug('No token provided but API key protection enabled');
            return false;
        }
        var isValid = (0, crypto_1.secureCompare)(token, expectedToken);
        if (isValid) {
            logger.debug('Bearer token validation successful');
        }
        else {
            logger.warn('Bearer token validation failed');
        }
        return isValid;
    };
    /**
     * Extract token from authorization header
     */
    BearerTokenValidator.prototype.extractToken = function (authHeader) {
        if (!authHeader || typeof authHeader !== 'string') {
            return null;
        }
        // Check for Bearer token format
        var bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
        if (bearerMatch) {
            return bearerMatch[1];
        }
        logger.debug("Invalid authorization header format: ".concat(authHeader.substring(0, 20), "..."));
        return null;
    };
    return BearerTokenValidator;
}());
exports.BearerTokenValidator = BearerTokenValidator;
/**
 * Global bearer token validator instance
 */
exports.bearerTokenValidator = new BearerTokenValidator();
/**
 * Express middleware for bearer token authentication
 * Based on Python check_auth() function
 */
function authMiddleware(options) {
    if (options === void 0) { options = {}; }
    var _a = options.skipPaths, skipPaths = _a === void 0 ? ['/health', '/v1/models'] : _a, _b = options.validator, validator = _b === void 0 ? exports.bearerTokenValidator : _b;
    return function (req, res, next) {
        try {
            // Skip authentication for certain paths
            if (skipPaths.some(function (path) { return req.path === path || req.path.startsWith(path); })) {
                logger.debug("Skipping auth for path: ".concat(req.path));
                return next();
            }
            // Check if API key protection is enabled
            if (!auth_manager_1.authManager.isProtected()) {
                logger.debug('API key protection disabled - allowing request');
                return next();
            }
            // Extract authorization header
            var authHeader = req.headers.authorization;
            if (!authHeader) {
                logger.warn("Unauthorized request to ".concat(req.path, " - no authorization header"));
                res.status(401).json({
                    error: {
                        message: 'Authorization header required',
                        type: 'authentication_error',
                        code: 'missing_authorization'
                    }
                });
                return;
            }
            // Extract bearer token
            var token = validator.extractToken(authHeader);
            if (!token) {
                logger.warn("Unauthorized request to ".concat(req.path, " - invalid authorization format"));
                res.status(401).json({
                    error: {
                        message: 'Invalid authorization header format. Expected: Bearer <token>',
                        type: 'authentication_error',
                        code: 'invalid_authorization_format'
                    }
                });
                return;
            }
            // Validate token
            var isValid = validator.validateToken(token);
            if (!isValid) {
                logger.warn("Unauthorized request to ".concat(req.path, " - invalid token"));
                res.status(401).json({
                    error: {
                        message: 'Invalid or expired API key',
                        type: 'authentication_error',
                        code: 'invalid_api_key'
                    }
                });
                return;
            }
            // Token is valid - continue to next middleware
            logger.debug("Authorized request to ".concat(req.path));
            next();
        }
        catch (error) {
            logger.error("Authentication middleware error: ".concat(error));
            res.status(500).json({
                error: {
                    message: 'Internal authentication error',
                    type: 'authentication_error',
                    code: 'internal_error'
                }
            });
        }
    };
}
exports.authMiddleware = authMiddleware;
/**
 * Middleware to check authentication status and add to response headers
 */
function authStatusMiddleware(req, res, next) {
    try {
        var isProtected = auth_manager_1.authManager.isProtected();
        var currentMethod = auth_manager_1.authManager.getCurrentMethod();
        // Add auth status to response headers (for debugging)
        res.setHeader('X-Auth-Protected', isProtected ? 'true' : 'false');
        if (currentMethod) {
            res.setHeader('X-Auth-Method', currentMethod);
        }
        next();
    }
    catch (error) {
        logger.error("Auth status middleware error: ".concat(error));
        next(); // Continue even if status check fails
    }
}
exports.authStatusMiddleware = authStatusMiddleware;
/**
 * Health check for authentication system
 */
function getAuthHealthStatus() {
    return __awaiter(this, void 0, void 0, function () {
        var authStatus, providers, providerStatus, _i, providers_1, provider, result, error_1, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 8, , 9]);
                    return [4 /*yield*/, auth_manager_1.authManager.getAuthStatus()];
                case 1:
                    authStatus = _a.sent();
                    providers = auth_manager_1.authManager.getProviders();
                    providerStatus = {};
                    _i = 0, providers_1 = providers;
                    _a.label = 2;
                case 2:
                    if (!(_i < providers_1.length)) return [3 /*break*/, 7];
                    provider = providers_1[_i];
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, provider.validate()];
                case 4:
                    result = _a.sent();
                    providerStatus[provider.getMethod()] = result.valid;
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _a.sent();
                    providerStatus[provider.getMethod()] = false;
                    return [3 /*break*/, 6];
                case 6:
                    _i++;
                    return [3 /*break*/, 2];
                case 7: return [2 /*return*/, {
                        protected: auth_manager_1.authManager.isProtected(),
                        method: authStatus.method,
                        provider_status: providerStatus
                    }];
                case 8:
                    error_2 = _a.sent();
                    logger.error("Auth health check error: ".concat(error_2));
                    return [2 /*return*/, {
                            protected: false,
                            method: null,
                            provider_status: {}
                        }];
                case 9: return [2 /*return*/];
            }
        });
    });
}
exports.getAuthHealthStatus = getAuthHealthStatus;
