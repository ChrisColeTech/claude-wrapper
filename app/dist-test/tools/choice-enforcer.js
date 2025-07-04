"use strict";
/**
 * Tool choice enforcement service
 * Single Responsibility: Tool choice enforcement only
 *
 * Enforces choice decisions in Claude SDK integration:
 * - Ensures responses match the chosen behavior
 * - Handles choice-specific error scenarios
 * - Validates Claude responses against choice constraints
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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.ToolChoiceEnforcerFactory = exports.ChoiceEnforcementUtils = exports.ToolChoiceEnforcer = exports.ToolChoiceEnforcementError = void 0;
var constants_1 = require("./constants");
/**
 * Tool choice enforcement error
 */
var ToolChoiceEnforcementError = /** @class */ (function (_super) {
    __extends(ToolChoiceEnforcementError, _super);
    function ToolChoiceEnforcementError(message, code, context, enforcementTimeMs) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.context = context;
        _this.enforcementTimeMs = enforcementTimeMs;
        _this.name = 'ToolChoiceEnforcementError';
        return _this;
    }
    return ToolChoiceEnforcementError;
}(Error));
exports.ToolChoiceEnforcementError = ToolChoiceEnforcementError;
/**
 * Tool choice enforcer implementation
 */
var ToolChoiceEnforcer = /** @class */ (function () {
    function ToolChoiceEnforcer() {
    }
    /**
     * Enforce tool choice against Claude response
     */
    ToolChoiceEnforcer.prototype.enforceChoice = function (request, options) {
        if (options === void 0) { options = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var startTime, opts, context, response, violations, enforcementAction, modifiedResponse, enforcementTimeMs, hasErrorViolations, success;
            return __generator(this, function (_a) {
                startTime = Date.now();
                try {
                    opts = __assign({ strictEnforcement: true, allowPartialCompliance: false, enforceTimeout: true, timeoutMs: constants_1.TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS, logViolations: true }, options);
                    context = request.context;
                    response = request.claudeResponse;
                    // If no response to enforce against, return success
                    if (!response) {
                        return [2 /*return*/, {
                                success: true,
                                enforcementAction: {
                                    type: 'none',
                                    description: 'No response to enforce against',
                                    modifications: [],
                                    wasRequired: false
                                },
                                violations: [],
                                errors: []
                            }];
                    }
                    violations = this.validateResponseAgainstChoice(context, response);
                    enforcementAction = this.createEnforcementAction(context, violations);
                    modifiedResponse = response;
                    if (enforcementAction.type !== 'none') {
                        modifiedResponse = this.modifyResponseForChoice(context, response);
                    }
                    enforcementTimeMs = Date.now() - startTime;
                    if (opts.enforceTimeout && enforcementTimeMs > opts.timeoutMs) {
                        return [2 /*return*/, {
                                success: false,
                                enforcementAction: {
                                    type: 'reject_response',
                                    description: 'Enforcement timeout exceeded',
                                    modifications: [],
                                    wasRequired: true
                                },
                                violations: [],
                                errors: [constants_1.TOOL_CHOICE_MESSAGES.CHOICE_PROCESSING_TIMEOUT],
                                enforcementTimeMs: enforcementTimeMs
                            }];
                    }
                    hasErrorViolations = violations.some(function (v) { return v.severity === 'error'; });
                    success = !hasErrorViolations || (opts.allowPartialCompliance && enforcementAction.type !== 'reject_response');
                    return [2 /*return*/, {
                            success: success,
                            enforcementAction: enforcementAction,
                            modifiedResponse: modifiedResponse,
                            violations: violations,
                            errors: hasErrorViolations && !success ? violations.map(function (v) { return v.description; }) : [],
                            enforcementTimeMs: enforcementTimeMs
                        }];
                }
                catch (error) {
                    return [2 /*return*/, {
                            success: false,
                            enforcementAction: {
                                type: 'reject_response',
                                description: 'Enforcement failed with error',
                                modifications: [],
                                wasRequired: true
                            },
                            violations: [],
                            errors: [
                                error instanceof Error ? error.message : constants_1.TOOL_CHOICE_MESSAGES.CHOICE_ENFORCEMENT_FAILED
                            ],
                            enforcementTimeMs: Date.now() - startTime
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Validate Claude response against tool choice constraints
     */
    ToolChoiceEnforcer.prototype.validateResponseAgainstChoice = function (context, response) {
        var _a, _b;
        var violations = [];
        var hasToolCalls = response.tool_calls && response.tool_calls.length > 0;
        // Auto choice: No specific constraints (Claude decides)
        if (context.choiceType === 'auto') {
            // Auto choice is always valid - Claude can decide
            return violations;
        }
        // None choice: Must be text-only, no tool calls
        if (context.choiceType === 'none') {
            if (hasToolCalls) {
                violations.push({
                    type: 'unexpected_tool_calls',
                    description: 'Tool calls present when choice is "none" (text-only required)',
                    severity: 'error',
                    expectedBehavior: 'Text-only response without tool calls',
                    actualBehavior: "Response contains ".concat((_a = response.tool_calls) === null || _a === void 0 ? void 0 : _a.length, " tool calls")
                });
            }
            return violations;
        }
        // Function choice: Must call the specific function
        if (context.choiceType === 'function') {
            var expectedFunction_1 = context.functionName;
            if (!hasToolCalls) {
                violations.push({
                    type: 'missing_forced_function',
                    description: "No tool calls when specific function \"".concat(expectedFunction_1, "\" is required"),
                    severity: 'error',
                    expectedBehavior: "Must call function \"".concat(expectedFunction_1, "\""),
                    actualBehavior: 'No tool calls in response'
                });
            }
            else {
                // Check if the required function was called
                var calledFunctions = ((_b = response.tool_calls) === null || _b === void 0 ? void 0 : _b.map(function (call) { var _a; return (_a = call["function"]) === null || _a === void 0 ? void 0 : _a.name; })) || [];
                var hasRequiredFunction = calledFunctions.includes(expectedFunction_1);
                if (!hasRequiredFunction) {
                    violations.push({
                        type: 'wrong_function_called',
                        description: "Required function \"".concat(expectedFunction_1, "\" not called"),
                        severity: 'error',
                        expectedBehavior: "Must call function \"".concat(expectedFunction_1, "\""),
                        actualBehavior: "Called functions: ".concat(calledFunctions.join(', '))
                    });
                }
                // Warning if additional functions called (depending on enforcement strictness)
                var additionalFunctions = calledFunctions.filter(function (name) { return name !== expectedFunction_1; });
                if (additionalFunctions.length > 0) {
                    violations.push({
                        type: 'unexpected_tool_calls',
                        description: "Additional functions called beyond required \"".concat(expectedFunction_1, "\""),
                        severity: 'warning',
                        expectedBehavior: "Only call function \"".concat(expectedFunction_1, "\""),
                        actualBehavior: "Additional functions: ".concat(additionalFunctions.join(', '))
                    });
                }
            }
            return violations;
        }
        return violations;
    };
    /**
     * Modify Claude response to comply with tool choice
     */
    ToolChoiceEnforcer.prototype.modifyResponseForChoice = function (context, response) {
        var modifiedResponse = __assign({}, response);
        // None choice: Remove all tool calls, ensure text-only
        if (context.choiceType === 'none') {
            modifiedResponse.tool_calls = [];
            modifiedResponse.finish_reason = 'stop';
            // Ensure there's text content if tool calls were removed
            if (!modifiedResponse.content || modifiedResponse.content.trim().length === 0) {
                modifiedResponse.content = 'I can provide a text response. How can I help you?';
            }
        }
        // Function choice: Filter to only the required function
        if (context.choiceType === 'function' && context.functionName) {
            var requiredFunction_1 = context.functionName;
            if (modifiedResponse.tool_calls) {
                // Keep only the required function calls
                modifiedResponse.tool_calls = modifiedResponse.tool_calls.filter(function (call) { var _a; return ((_a = call["function"]) === null || _a === void 0 ? void 0 : _a.name) === requiredFunction_1; });
                // If no required function calls found, this is an error case
                if (modifiedResponse.tool_calls.length === 0) {
                    // This should be handled by validation - don't modify further
                }
                else {
                    modifiedResponse.finish_reason = 'tool_calls';
                }
            }
        }
        return modifiedResponse;
    };
    /**
     * Create enforcement action based on context and violations
     */
    ToolChoiceEnforcer.prototype.createEnforcementAction = function (context, violations) {
        var hasErrorViolations = violations.some(function (v) { return v.severity === 'error'; });
        var modifications = [];
        // No violations - no action needed
        if (violations.length === 0) {
            return {
                type: 'none',
                description: 'Response complies with tool choice requirements',
                modifications: [],
                wasRequired: false
            };
        }
        // None choice enforcement
        if (context.choiceType === 'none' && hasErrorViolations) {
            modifications.push('Removed all tool calls', 'Set finish_reason to "stop"');
            return {
                type: 'force_text_only',
                description: 'Enforced text-only response for "none" choice',
                modifications: modifications,
                wasRequired: true
            };
        }
        // Function choice enforcement
        if (context.choiceType === 'function' && hasErrorViolations) {
            var expectedFunction = context.functionName;
            modifications.push("Filtered to only \"".concat(expectedFunction, "\" function calls"));
            return {
                type: 'force_function',
                description: "Enforced specific function \"".concat(expectedFunction, "\" for function choice"),
                modifications: modifications,
                wasRequired: true
            };
        }
        // General tool filtering for warnings
        if (violations.some(function (v) { return v.type === 'unexpected_tool_calls' && v.severity === 'warning'; })) {
            modifications.push('Filtered unexpected tool calls');
            return {
                type: 'filter_tools',
                description: 'Filtered unexpected tool calls based on choice constraints',
                modifications: modifications,
                wasRequired: false
            };
        }
        // Reject response for serious violations
        if (hasErrorViolations) {
            return {
                type: 'reject_response',
                description: 'Response violates tool choice constraints and cannot be modified',
                modifications: [],
                wasRequired: true
            };
        }
        return {
            type: 'none',
            description: 'No enforcement action required',
            modifications: [],
            wasRequired: false
        };
    };
    return ToolChoiceEnforcer;
}());
exports.ToolChoiceEnforcer = ToolChoiceEnforcer;
/**
 * Tool choice enforcement utilities
 */
exports.ChoiceEnforcementUtils = {
    /**
     * Check if enforcement was successful
     */
    wasSuccessful: function (result) {
        return result.success;
    },
    /**
     * Check if modifications were made
     */
    wasModified: function (result) {
        return result.enforcementAction.type !== 'none' && result.modifiedResponse !== undefined;
    },
    /**
     * Check if response was rejected
     */
    wasRejected: function (result) {
        return result.enforcementAction.type === 'reject_response';
    },
    /**
     * Get error violations only
     */
    getErrorViolations: function (result) {
        return result.violations.filter(function (v) { return v.severity === 'error'; });
    },
    /**
     * Get warning violations only
     */
    getWarningViolations: function (result) {
        return result.violations.filter(function (v) { return v.severity === 'warning'; });
    },
    /**
     * Check if enforcement meets performance requirements
     */
    meetsPerformanceRequirements: function (result) {
        return !result.enforcementTimeMs ||
            result.enforcementTimeMs <= constants_1.TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS;
    },
    /**
     * Create default enforcement options
     */
    createDefaultOptions: function () { return ({
        strictEnforcement: true,
        allowPartialCompliance: false,
        enforceTimeout: true,
        timeoutMs: constants_1.TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS,
        logViolations: true
    }); },
    /**
     * Create error enforcement result
     */
    createErrorResult: function (errors, enforcementTimeMs) { return ({
        success: false,
        enforcementAction: {
            type: 'reject_response',
            description: 'Enforcement failed with errors',
            modifications: [],
            wasRequired: true
        },
        violations: [],
        errors: errors,
        enforcementTimeMs: enforcementTimeMs
    }); }
};
/**
 * Factory for creating tool choice enforcer
 */
var ToolChoiceEnforcerFactory = /** @class */ (function () {
    function ToolChoiceEnforcerFactory() {
    }
    ToolChoiceEnforcerFactory.create = function () {
        return new ToolChoiceEnforcer();
    };
    return ToolChoiceEnforcerFactory;
}());
exports.ToolChoiceEnforcerFactory = ToolChoiceEnforcerFactory;
