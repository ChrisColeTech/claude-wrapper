"use strict";
/**
 * Tool call ID generation service
 * Single Responsibility: ID generation only
 *
 * Generates unique tool call IDs in OpenAI call_xxx format
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
exports.toolCallIdGenerator = exports.IdGenerationUtils = exports.ToolCallIdGenerator = exports.ToolCallIdGenerationError = void 0;
var crypto_1 = require("crypto");
var constants_1 = require("./constants");
/**
 * Tool call ID generation error
 */
var ToolCallIdGenerationError = /** @class */ (function (_super) {
    __extends(ToolCallIdGenerationError, _super);
    function ToolCallIdGenerationError(message, code, attemptedId) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.attemptedId = attemptedId;
        _this.name = 'ToolCallIdGenerationError';
        return _this;
    }
    return ToolCallIdGenerationError;
}(Error));
exports.ToolCallIdGenerationError = ToolCallIdGenerationError;
/**
 * Tool call ID generator implementation
 */
var ToolCallIdGenerator = /** @class */ (function () {
    function ToolCallIdGenerator() {
        this.usedIds = new Set();
    }
    /**
     * Generate a unique tool call ID in call_xxx format
     */
    ToolCallIdGenerator.prototype.generateId = function () {
        try {
            var uniquePart = this.generateUniqueString();
            var id = "".concat(constants_1.ID_FORMATS.CALL_PREFIX).concat(uniquePart);
            // Ensure uniqueness
            if (this.usedIds.has(id)) {
                return this.generateId(); // Retry with new ID
            }
            this.usedIds.add(id);
            if (!this.validateIdFormat(id)) {
                throw new ToolCallIdGenerationError(constants_1.RESPONSE_FORMATTING_MESSAGES.ID_GENERATION_FAILED, constants_1.RESPONSE_FORMATTING_ERRORS.ID_GENERATION_FAILED, id);
            }
            return id;
        }
        catch (error) {
            throw new ToolCallIdGenerationError(error instanceof Error ? error.message : constants_1.RESPONSE_FORMATTING_MESSAGES.ID_GENERATION_FAILED, constants_1.RESPONSE_FORMATTING_ERRORS.ID_GENERATION_FAILED);
        }
    };
    /**
     * Generate multiple unique tool call IDs
     */
    ToolCallIdGenerator.prototype.generateIds = function (count) {
        if (count <= 0) {
            return [];
        }
        var ids = [];
        for (var i = 0; i < count; i++) {
            ids.push(this.generateId());
        }
        return ids;
    };
    /**
     * Check if ID is valid and follows OpenAI format
     */
    ToolCallIdGenerator.prototype.isValidId = function (id) {
        return this.validateIdFormat(id);
    };
    /**
     * Validate ID format matches OpenAI specification
     */
    ToolCallIdGenerator.prototype.validateIdFormat = function (id) {
        try {
            // Check basic format
            if (!id || typeof id !== 'string') {
                return false;
            }
            // Check prefix
            if (!id.startsWith(constants_1.ID_FORMATS.CALL_PREFIX)) {
                return false;
            }
            // Check total length
            if (id.length !== constants_1.ID_FORMATS.CALL_ID_LENGTH) {
                return false;
            }
            // Check unique part contains only valid characters
            var uniquePart = id.slice(constants_1.ID_FORMATS.CALL_PREFIX.length);
            return this.isValidUniqueString(uniquePart);
        }
        catch (error) {
            return false;
        }
    };
    /**
     * Generate unique string part of ID
     */
    ToolCallIdGenerator.prototype.generateUniqueString = function () {
        var length = constants_1.ID_FORMATS.CALL_ID_LENGTH - constants_1.ID_FORMATS.CALL_PREFIX.length;
        var characters = constants_1.ID_FORMATS.ID_CHARACTERS;
        var result = '';
        // Use webcrypto.getRandomValues if available, otherwise Math.random
        if (typeof crypto_1.webcrypto !== 'undefined' && crypto_1.webcrypto.getRandomValues) {
            var array = new Uint8Array(length);
            crypto_1.webcrypto.getRandomValues(array);
            for (var i = 0; i < length; i++) {
                result += characters[array[i] % characters.length];
            }
        }
        else {
            // Fallback to Math.random for environments without crypto
            for (var i = 0; i < length; i++) {
                result += characters[Math.floor(Math.random() * characters.length)];
            }
        }
        return result;
    };
    /**
     * Validate unique string contains only allowed characters
     */
    ToolCallIdGenerator.prototype.isValidUniqueString = function (uniqueString) {
        if (!uniqueString || uniqueString.length !== constants_1.ID_FORMATS.CALL_ID_LENGTH - constants_1.ID_FORMATS.CALL_PREFIX.length) {
            return false;
        }
        for (var _i = 0, uniqueString_1 = uniqueString; _i < uniqueString_1.length; _i++) {
            var char = uniqueString_1[_i];
            if (!constants_1.ID_FORMATS.ID_CHARACTERS.includes(char)) {
                return false;
            }
        }
        return true;
    };
    /**
     * Clear used IDs cache (for testing)
     */
    ToolCallIdGenerator.prototype.clearUsedIds = function () {
        this.usedIds.clear();
    };
    /**
     * Get count of used IDs (for testing)
     */
    ToolCallIdGenerator.prototype.getUsedIdsCount = function () {
        return this.usedIds.size;
    };
    return ToolCallIdGenerator;
}());
exports.ToolCallIdGenerator = ToolCallIdGenerator;
/**
 * ID generation utilities
 */
exports.IdGenerationUtils = {
    /**
     * Extract unique part from tool call ID
     */
    extractUniqueId: function (id) {
        if (!id.startsWith(constants_1.ID_FORMATS.CALL_PREFIX)) {
            return null;
        }
        return id.slice(constants_1.ID_FORMATS.CALL_PREFIX.length);
    },
    /**
     * Check if ID is OpenAI format
     */
    isOpenAIFormat: function (id) {
        return id.startsWith(constants_1.ID_FORMATS.CALL_PREFIX) && id.length === constants_1.ID_FORMATS.CALL_ID_LENGTH;
    },
    /**
     * Validate multiple IDs for uniqueness
     */
    areIdsUnique: function (ids) {
        var uniqueIds = new Set(ids);
        return uniqueIds.size === ids.length;
    },
    /**
     * Generate batch of IDs with guaranteed uniqueness
     */
    generateBatch: function (count, generator) {
        var gen = generator || new ToolCallIdGenerator();
        return gen.generateIds(count);
    }
};
/**
 * Default tool call ID generator instance
 */
exports.toolCallIdGenerator = new ToolCallIdGenerator();
