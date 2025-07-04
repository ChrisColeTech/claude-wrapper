"use strict";
/**
 * Anthropic authentication provider
 * Based on Python auth.py AnthropicAuth class
 *
 * Single Responsibility: Handle Anthropic API key authentication
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
exports.AnthropicProvider = void 0;
var interfaces_1 = require("../interfaces");
var logger_1 = require("../../utils/logger");
var logger = (0, logger_1.getLogger)('AnthropicProvider');
/**
 * Anthropic authentication provider
 */
var AnthropicProvider = /** @class */ (function () {
    function AnthropicProvider() {
    }
    /**
     * Validate Anthropic authentication configuration
     */
    AnthropicProvider.prototype.validate = function () {
        return __awaiter(this, void 0, void 0, function () {
            var errors, config, apiKey, isValid;
            return __generator(this, function (_a) {
                errors = [];
                config = {};
                apiKey = process.env.ANTHROPIC_API_KEY;
                if (!apiKey) {
                    errors.push('ANTHROPIC_API_KEY environment variable not set');
                }
                else if (!this.isValidApiKeyFormat(apiKey)) {
                    errors.push('ANTHROPIC_API_KEY format is invalid');
                }
                else {
                    config.api_key_present = true;
                    config.api_key_length = apiKey.length;
                    logger.debug("Anthropic API key found (length: ".concat(apiKey.length, ")"));
                }
                isValid = errors.length === 0;
                if (isValid) {
                    logger.info('Anthropic authentication validated successfully');
                }
                else {
                    logger.debug("Anthropic validation failed: ".concat(errors.join(', ')));
                }
                return [2 /*return*/, {
                        valid: isValid,
                        errors: errors,
                        config: config,
                        method: interfaces_1.AuthMethod.ANTHROPIC
                    }];
            });
        });
    };
    /**
     * Get authentication method type
     */
    AnthropicProvider.prototype.getMethod = function () {
        return interfaces_1.AuthMethod.ANTHROPIC;
    };
    /**
     * Get required environment variables for this provider
     */
    AnthropicProvider.prototype.getRequiredEnvVars = function () {
        return ['ANTHROPIC_API_KEY'];
    };
    /**
     * Check if this provider is configured
     */
    AnthropicProvider.prototype.isConfigured = function () {
        return !!process.env.ANTHROPIC_API_KEY;
    };
    /**
     * Detect if this provider should be used based on environment
     */
    AnthropicProvider.prototype.canDetect = function () {
        return this.isConfigured();
    };
    /**
     * Validate Anthropic API key format
     * Based on known Anthropic API key patterns
     */
    AnthropicProvider.prototype.isValidApiKeyFormat = function (apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }
        // Anthropic API keys typically start with 'sk-ant-' and are base64-like
        if (!apiKey.startsWith('sk-ant-')) {
            return false;
        }
        // Check reasonable length (Anthropic keys are typically 100+ chars)
        if (apiKey.length < 50) {
            return false;
        }
        // Check that it contains only valid base64-like characters after prefix
        var keyPart = apiKey.substring(7); // Remove 'sk-ant-' prefix
        var validChars = /^[A-Za-z0-9+/=_-]+$/;
        if (!validChars.test(keyPart)) {
            return false;
        }
        return true;
    };
    return AnthropicProvider;
}());
exports.AnthropicProvider = AnthropicProvider;
