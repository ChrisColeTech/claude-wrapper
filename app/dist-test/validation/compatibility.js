"use strict";
/**
 * Compatibility reporting for OpenAI to Claude Code SDK conversion
 * Based on Python parameter_validator.py CompatibilityReporter class
 * Implements Phase 8A compatibility analysis requirements
 */
exports.__esModule = true;
exports.CompatibilityReporter = void 0;
/**
 * Reports on OpenAI API compatibility and suggests Claude Code SDK alternatives
 * Based on Python CompatibilityReporter class
 */
var CompatibilityReporter = /** @class */ (function () {
    function CompatibilityReporter() {
    }
    /**
     * Generate a detailed compatibility report for the request
     * Based on Python generate_compatibility_report method
     */
    CompatibilityReporter.generateCompatibilityReport = function (request) {
        var report = {
            supported_parameters: [],
            unsupported_parameters: [],
            warnings: [],
            suggestions: []
        };
        // Check supported parameters
        if (request.model) {
            report.supported_parameters.push('model');
        }
        if (request.messages) {
            report.supported_parameters.push('messages');
        }
        if (request.stream !== undefined) {
            report.supported_parameters.push('stream');
        }
        if (request.user) {
            report.supported_parameters.push('user (for logging)');
        }
        // Check unsupported parameters with suggestions
        if (request.temperature !== 1.0) {
            report.unsupported_parameters.push('temperature');
            report.suggestions.push('Claude Code SDK does not support temperature control. Consider using different models for varied response styles (e.g., claude-3-5-haiku for more focused responses).');
        }
        if (request.top_p !== 1.0) {
            report.unsupported_parameters.push('top_p');
            report.suggestions.push('Claude Code SDK does not support top_p. This parameter will be ignored.');
        }
        if (request.max_tokens !== undefined) {
            report.unsupported_parameters.push('max_tokens');
            report.suggestions.push('Use max_turns parameter instead to limit conversation length, or use max_thinking_tokens to limit internal reasoning.');
        }
        if (request.n > 1) {
            report.unsupported_parameters.push('n');
            report.suggestions.push('Claude Code SDK only supports single responses (n=1). For multiple variations, make separate API calls.');
        }
        if (request.stop) {
            report.unsupported_parameters.push('stop');
            report.suggestions.push('Stop sequences are not supported. Consider post-processing responses or using max_turns to limit output.');
        }
        if (request.presence_penalty !== 0 || request.frequency_penalty !== 0) {
            if (request.presence_penalty !== 0) {
                report.unsupported_parameters.push('presence_penalty');
            }
            if (request.frequency_penalty !== 0) {
                report.unsupported_parameters.push('frequency_penalty');
            }
            report.suggestions.push('Penalty parameters are not supported. Consider using different system prompts to encourage varied responses.');
        }
        if (request.logit_bias) {
            report.unsupported_parameters.push('logit_bias');
            report.suggestions.push('Logit bias is not supported. Consider using system prompts to guide response style.');
        }
        return report;
    };
    /**
     * Legacy method for backward compatibility
     * @deprecated Use generateCompatibilityReport instead
     */
    CompatibilityReporter.analyzeRequest = function (request) {
        return this.generateCompatibilityReport(request);
    };
    /**
     * Get Claude SDK specific options from request
     * Extracts Claude-compatible parameters for SDK usage
     */
    CompatibilityReporter.getClaudeSDKOptions = function (request) {
        var options = {};
        // Extract supported parameters
        if (request.model) {
            options.model = request.model;
        }
        if (request.messages) {
            options.messages = request.messages;
        }
        if (request.stream !== undefined) {
            options.stream = request.stream;
        }
        if (request.user) {
            options.user = request.user;
        }
        // Note: Unsupported parameters are intentionally omitted
        // They should be handled via custom headers (X-Claude-*) if needed
        return options;
    };
    /**
     * Check if a request uses any unsupported OpenAI parameters
     */
    CompatibilityReporter.hasUnsupportedParameters = function (request) {
        return (request.temperature !== 1.0 ||
            request.top_p !== 1.0 ||
            request.max_tokens !== undefined ||
            request.n > 1 ||
            !!request.stop ||
            request.presence_penalty !== 0 ||
            request.frequency_penalty !== 0 ||
            !!request.logit_bias);
    };
    /**
     * Get list of all unsupported parameter names for a request
     */
    CompatibilityReporter.getUnsupportedParameterNames = function (request) {
        var report = this.generateCompatibilityReport(request);
        return report.unsupported_parameters;
    };
    return CompatibilityReporter;
}());
exports.CompatibilityReporter = CompatibilityReporter;
