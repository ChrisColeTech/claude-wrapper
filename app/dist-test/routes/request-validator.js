"use strict";
/**
 * Chat request validation service
 * Single Responsibility: Validate chat completion requests
 */
exports.__esModule = true;
exports.requestValidator = exports.RequestValidator = void 0;
var validator_1 = require("../validation/validator");
var RequestValidator = /** @class */ (function () {
    function RequestValidator() {
    }
    /**
     * Validate chat completion request
     */
    RequestValidator.prototype.validateChatRequest = function (body) {
        var errors = [];
        // Basic structure validation
        if (!body || typeof body !== 'object') {
            return {
                isValid: false,
                errors: ['Request body must be a valid JSON object']
            };
        }
        // Model validation
        if (!body.model || typeof body.model !== 'string') {
            errors.push('Model parameter is required and must be a string');
        }
        // Messages validation
        if (!body.messages || !Array.isArray(body.messages)) {
            errors.push('Messages parameter is required and must be an array');
        }
        else if (body.messages.length === 0) {
            errors.push('Messages array cannot be empty');
        }
        else {
            // Validate each message
            body.messages.forEach(function (message, index) {
                if (!message || typeof message !== 'object') {
                    errors.push("Message at index ".concat(index, " must be an object"));
                }
                else {
                    if (!message.role || typeof message.role !== 'string') {
                        errors.push("Message at index ".concat(index, " must have a valid role"));
                    }
                    else if (!['system', 'user', 'assistant'].includes(message.role)) {
                        errors.push("Message at index ".concat(index, " has invalid role: ").concat(message.role));
                    }
                    if (!message.content || typeof message.content !== 'string') {
                        errors.push("Message at index ".concat(index, " must have valid content"));
                    }
                }
            });
        }
        // Optional parameter validation
        if (body.temperature !== undefined) {
            if (typeof body.temperature !== 'number' || body.temperature < 0 || body.temperature > 2) {
                errors.push('Temperature must be a number between 0 and 2');
            }
        }
        if (body.top_p !== undefined) {
            if (typeof body.top_p !== 'number' || body.top_p < 0 || body.top_p > 1) {
                errors.push('Top_p must be a number between 0 and 1');
            }
        }
        if (body.max_tokens !== undefined) {
            if (typeof body.max_tokens !== 'number' || body.max_tokens < 1) {
                errors.push('Max_tokens must be a positive number');
            }
        }
        if (body.stream !== undefined) {
            if (typeof body.stream !== 'boolean') {
                errors.push('Stream must be a boolean');
            }
        }
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    };
    /**
     * Validate request using parameter validator
     */
    RequestValidator.prototype.validateWithParameterValidator = function (request) {
        var validation = validator_1.ParameterValidator.validateRequest(request);
        return {
            isValid: validation.valid,
            errors: validation.errors
        };
    };
    /**
     * Validate model support
     */
    RequestValidator.prototype.validateModelSupport = function (model) {
        var validation = validator_1.ParameterValidator.validateModel(model);
        return {
            isValid: validation.valid,
            errors: validation.errors
        };
    };
    return RequestValidator;
}());
exports.RequestValidator = RequestValidator;
exports.requestValidator = new RequestValidator();
