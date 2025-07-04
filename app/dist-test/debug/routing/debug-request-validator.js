"use strict";
/**
 * Debug Request Validator (Phase 14B)
 * Single Responsibility: Request validation and parameter checking for debug endpoints
 *
 * Extracted from oversized debug-router.ts following SRP
 * Validates and sanitizes debug request parameters
 */
exports.__esModule = true;
exports.DebugRequestValidator = void 0;
var constants_1 = require("../../tools/constants");
var logger_1 = require("../../utils/logger");
var logger = (0, logger_1.getLogger)('DebugRequestValidator');
/**
 * Request validator for debug endpoints
 */
var DebugRequestValidator = /** @class */ (function () {
    function DebugRequestValidator() {
    }
    /**
     * Validate tool inspection request
     */
    DebugRequestValidator.validateToolInspectionRequest = function (req) {
        var errors = [];
        var warnings = [];
        try {
            var _a = req.body, sessionId = _a.sessionId, toolCallId = _a.toolCallId, detailLevel = _a.detailLevel, includeHistory = _a.includeHistory;
            // Validate required fields
            if (!sessionId || typeof sessionId !== 'string') {
                errors.push('sessionId is required and must be a string');
            }
            else if (sessionId.length === 0) {
                errors.push('sessionId cannot be empty');
            }
            if (!toolCallId || typeof toolCallId !== 'string') {
                errors.push('toolCallId is required and must be a string');
            }
            else if (toolCallId.length === 0) {
                errors.push('toolCallId cannot be empty');
            }
            // Validate optional fields
            if (detailLevel && !['basic', 'detailed', 'comprehensive'].includes(detailLevel)) {
                errors.push('detailLevel must be one of: basic, detailed, comprehensive');
            }
            if (includeHistory !== undefined && typeof includeHistory !== 'boolean') {
                warnings.push('includeHistory should be a boolean, converting to boolean');
            }
            var sanitizedParams = {
                sessionId: sessionId === null || sessionId === void 0 ? void 0 : sessionId.trim(),
                toolCallId: toolCallId === null || toolCallId === void 0 ? void 0 : toolCallId.trim(),
                detailLevel: detailLevel || 'detailed',
                includeHistory: Boolean(includeHistory)
            };
            return {
                valid: errors.length === 0,
                errors: errors,
                warnings: warnings,
                sanitizedParams: sanitizedParams
            };
        }
        catch (error) {
            logger.error('Tool inspection request validation failed', { error: error });
            return {
                valid: false,
                errors: ['Invalid request format'],
                warnings: []
            };
        }
    };
    /**
     * Validate compatibility check request
     */
    DebugRequestValidator.validateCompatibilityCheckRequest = function (req) {
        var errors = [];
        var warnings = [];
        try {
            var _a = req.body, tools = _a.tools, request = _a.request, response = _a.response, strictMode = _a.strictMode;
            // Validate tools array
            if (!tools || !Array.isArray(tools)) {
                errors.push('tools is required and must be an array');
            }
            else if (tools.length === 0) {
                errors.push('tools array cannot be empty');
            }
            else {
                // Basic tool structure validation
                tools.forEach(function (tool, index) {
                    if (!tool || typeof tool !== 'object') {
                        errors.push("tools[".concat(index, "] must be an object"));
                    }
                    else if (!tool.type || tool.type !== 'function') {
                        errors.push("tools[".concat(index, "] must have type 'function'"));
                    }
                    else if (!tool["function"] || !tool["function"].name) {
                        errors.push("tools[".concat(index, "] must have a function with a name"));
                    }
                });
            }
            // Validate optional fields
            if (strictMode !== undefined && typeof strictMode !== 'boolean') {
                warnings.push('strictMode should be a boolean, converting to boolean');
            }
            if (request && typeof request !== 'object') {
                warnings.push('request parameter should be an object');
            }
            if (response && typeof response !== 'object') {
                warnings.push('response parameter should be an object');
            }
            var sanitizedParams = {
                tools: tools || [],
                request: request,
                response: response,
                strictMode: Boolean(strictMode)
            };
            return {
                valid: errors.length === 0,
                errors: errors,
                warnings: warnings,
                sanitizedParams: sanitizedParams
            };
        }
        catch (error) {
            logger.error('Compatibility check request validation failed', { error: error });
            return {
                valid: false,
                errors: ['Invalid request format'],
                warnings: []
            };
        }
    };
    /**
     * Validate history inspection request
     */
    DebugRequestValidator.validateHistoryInspectionRequest = function (req) {
        var errors = [];
        var warnings = [];
        try {
            var _a = req.body, sessionId = _a.sessionId, limit = _a.limit, includePerformanceData = _a.includePerformanceData, timeRange = _a.timeRange;
            // Validate required fields
            if (!sessionId || typeof sessionId !== 'string') {
                errors.push('sessionId is required and must be a string');
            }
            else if (sessionId.length === 0) {
                errors.push('sessionId cannot be empty');
            }
            // Validate optional fields
            if (limit !== undefined) {
                if (typeof limit !== 'number' || limit <= 0) {
                    errors.push('limit must be a positive number');
                }
                else if (limit > constants_1.DEBUG_PERFORMANCE_LIMITS.MAX_HISTORY_ENTRIES) {
                    warnings.push("limit exceeds maximum of ".concat(constants_1.DEBUG_PERFORMANCE_LIMITS.MAX_HISTORY_ENTRIES, ", will be capped"));
                }
            }
            if (includePerformanceData !== undefined && typeof includePerformanceData !== 'boolean') {
                warnings.push('includePerformanceData should be a boolean, converting to boolean');
            }
            // Validate time range
            if (timeRange) {
                if (typeof timeRange !== 'object') {
                    errors.push('timeRange must be an object');
                }
                else {
                    if (typeof timeRange.startTime !== 'number' || typeof timeRange.endTime !== 'number') {
                        errors.push('timeRange must have numeric startTime and endTime');
                    }
                    else if (timeRange.startTime >= timeRange.endTime) {
                        errors.push('timeRange startTime must be before endTime');
                    }
                }
            }
            var sanitizedParams = {
                sessionId: sessionId === null || sessionId === void 0 ? void 0 : sessionId.trim(),
                limit: Math.min(limit || constants_1.DEBUG_PERFORMANCE_LIMITS.MAX_HISTORY_ENTRIES, constants_1.DEBUG_PERFORMANCE_LIMITS.MAX_HISTORY_ENTRIES),
                includePerformanceData: Boolean(includePerformanceData),
                timeRange: timeRange
            };
            return {
                valid: errors.length === 0,
                errors: errors,
                warnings: warnings,
                sanitizedParams: sanitizedParams
            };
        }
        catch (error) {
            logger.error('History inspection request validation failed', { error: error });
            return {
                valid: false,
                errors: ['Invalid request format'],
                warnings: []
            };
        }
    };
    /**
     * Validate performance analysis request
     */
    DebugRequestValidator.validatePerformanceAnalysisRequest = function (req) {
        var errors = [];
        var warnings = [];
        try {
            var _a = req.body, sessionId = _a.sessionId, toolCallId = _a.toolCallId, includeBaseline = _a.includeBaseline, generateRecommendations = _a.generateRecommendations;
            // Validate required fields
            if (!sessionId || typeof sessionId !== 'string') {
                errors.push('sessionId is required and must be a string');
            }
            else if (sessionId.length === 0) {
                errors.push('sessionId cannot be empty');
            }
            // toolCallId is optional for performance analysis
            if (toolCallId && typeof toolCallId !== 'string') {
                errors.push('toolCallId must be a string if provided');
            }
            // Validate optional fields
            if (includeBaseline !== undefined && typeof includeBaseline !== 'boolean') {
                warnings.push('includeBaseline should be a boolean, converting to boolean');
            }
            if (generateRecommendations !== undefined && typeof generateRecommendations !== 'boolean') {
                warnings.push('generateRecommendations should be a boolean, converting to boolean');
            }
            var sanitizedParams = {
                sessionId: sessionId === null || sessionId === void 0 ? void 0 : sessionId.trim(),
                toolCallId: toolCallId === null || toolCallId === void 0 ? void 0 : toolCallId.trim(),
                includeBaseline: Boolean(includeBaseline),
                generateRecommendations: Boolean(generateRecommendations)
            };
            return {
                valid: errors.length === 0,
                errors: errors,
                warnings: warnings,
                sanitizedParams: sanitizedParams
            };
        }
        catch (error) {
            logger.error('Performance analysis request validation failed', { error: error });
            return {
                valid: false,
                errors: ['Invalid request format'],
                warnings: []
            };
        }
    };
    /**
     * Validate debug mode parameter
     */
    DebugRequestValidator.validateDebugMode = function (mode) {
        return Object.values(constants_1.DEBUG_MODES).includes(mode);
    };
    /**
     * Extract and validate common debug parameters
     */
    DebugRequestValidator.extractCommonParams = function (req) {
        var debugMode = req.query.mode || constants_1.DEBUG_MODES.INSPECTION;
        var requestId = req.headers['x-request-id'] || this.generateRequestId();
        var timeout = req.query.timeout ? parseInt(req.query.timeout, 10) : undefined;
        return {
            debugMode: this.validateDebugMode(debugMode) ? debugMode : constants_1.DEBUG_MODES.INSPECTION,
            requestId: requestId,
            timeout: timeout && timeout > 0 && timeout <= constants_1.DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS * 2
                ? timeout
                : undefined
        };
    };
    /**
     * Generate unique request ID
     */
    DebugRequestValidator.generateRequestId = function () {
        return "req_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9));
    };
    return DebugRequestValidator;
}());
exports.DebugRequestValidator = DebugRequestValidator;
