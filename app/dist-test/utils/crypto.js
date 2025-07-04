"use strict";
/**
 * Cryptographic utilities for secure token generation
 * Based on Python main.py token generation
 *
 * Single Responsibility: Secure random token generation
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
exports.__esModule = true;
exports.TokenUtils = exports.secureCompare = exports.createSafeHash = exports.validateTokenFormat = exports.generateSecureToken = exports.TokenGenerationError = void 0;
var crypto_1 = require("crypto");
/**
 * Constants for token generation
 */
var DEFAULT_TOKEN_LENGTH = 32;
var TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/**
 * Error thrown when token generation fails
 */
var TokenGenerationError = /** @class */ (function (_super) {
    __extends(TokenGenerationError, _super);
    function TokenGenerationError(message) {
        var _this = _super.call(this, "Token generation failed: ".concat(message)) || this;
        _this.name = 'TokenGenerationError';
        return _this;
    }
    return TokenGenerationError;
}(Error));
exports.TokenGenerationError = TokenGenerationError;
/**
 * Generate a secure random token for API authentication
 * Based on Python generate_secure_token() function
 *
 * @param length Token length (default: 32)
 * @returns Secure random token
 */
function generateSecureToken(length) {
    if (length === void 0) { length = DEFAULT_TOKEN_LENGTH; }
    if (length < 8) {
        throw new TokenGenerationError('Token length must be at least 8 characters');
    }
    if (length > 256) {
        throw new TokenGenerationError('Token length must be at most 256 characters');
    }
    try {
        // Generate random bytes
        var randomBuffer = (0, crypto_1.randomBytes)(length);
        // Convert to secure token using alphabet
        var token = '';
        for (var i = 0; i < length; i++) {
            var randomIndex = randomBuffer[i] % TOKEN_ALPHABET.length;
            token += TOKEN_ALPHABET[randomIndex];
        }
        return token;
    }
    catch (error) {
        throw new TokenGenerationError("Crypto operation failed: ".concat(error));
    }
}
exports.generateSecureToken = generateSecureToken;
/**
 * Validate token format and security
 *
 * @param token Token to validate
 * @returns True if token is valid format
 */
function validateTokenFormat(token) {
    if (!token || typeof token !== 'string') {
        return false;
    }
    // Check minimum length
    if (token.length < 8) {
        return false;
    }
    // Check maximum length
    if (token.length > 256) {
        return false;
    }
    // Check that token only contains valid characters
    var validChars = new Set(TOKEN_ALPHABET);
    for (var _i = 0, token_1 = token; _i < token_1.length; _i++) {
        var char = token_1[_i];
        if (!validChars.has(char)) {
            return false;
        }
    }
    return true;
}
exports.validateTokenFormat = validateTokenFormat;
/**
 * Create a hash of sensitive data for logging/comparison
 *
 * @param data Sensitive data to hash
 * @returns SHA-256 hash (first 8 characters)
 */
function createSafeHash(data) {
    if (!data) {
        return 'empty';
    }
    var hash = (0, crypto_1.createHash)('sha256').update(data).digest('hex');
    return hash.substring(0, 8); // First 8 characters for identification
}
exports.createSafeHash = createSafeHash;
/**
 * Secure comparison of two strings to prevent timing attacks
 *
 * @param a First string
 * @param b Second string
 * @returns True if strings are equal
 */
function secureCompare(a, b) {
    if (!a || !b) {
        return false;
    }
    if (a.length !== b.length) {
        return false;
    }
    var result = 0;
    for (var i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}
exports.secureCompare = secureCompare;
/**
 * Token utility class for organized token operations
 */
var TokenUtils = /** @class */ (function () {
    function TokenUtils() {
    }
    /**
     * Generate API key with specified length
     */
    TokenUtils.generateApiKey = function (length) {
        if (length === void 0) { length = DEFAULT_TOKEN_LENGTH; }
        return generateSecureToken(length);
    };
    /**
     * Validate API key format
     */
    TokenUtils.isValidApiKey = function (apiKey) {
        return validateTokenFormat(apiKey);
    };
    /**
     * Create safe representation of API key for logging
     */
    TokenUtils.maskApiKey = function (apiKey) {
        if (!apiKey || apiKey.length < 8) {
            return '***';
        }
        var hash = createSafeHash(apiKey);
        var prefix = apiKey.substring(0, 3);
        return "".concat(prefix, "***").concat(hash);
    };
    /**
     * Securely compare API keys
     */
    TokenUtils.compareApiKeys = function (provided, expected) {
        return secureCompare(provided, expected);
    };
    return TokenUtils;
}());
exports.TokenUtils = TokenUtils;
