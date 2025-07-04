"use strict";
/**
 * OpenAI Compatibility Checker Service
 * Single Responsibility: OpenAI compatibility verification orchestration
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
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
exports.compatibilityChecker = exports.CompatibilityChecker = void 0;
var registry_1 = require("../tools/registry");
var logger_1 = require("../utils/logger");
// Import checker modules
var model_checker_1 = require("./model-checker");
var message_checker_1 = require("./message-checker");
var tool_checker_1 = require("./tool-checker");
var logger = (0, logger_1.getLogger)('CompatibilityChecker');
/**
 * Main compatibility checker class
 */
var CompatibilityChecker = /** @class */ (function () {
    function CompatibilityChecker() {
        this.toolRegistry = (0, registry_1.createToolRegistry)();
        this.openaiSpecVersion = '2024-02-01';
        this.supportedFeatures = new Set([
            'chat_completions',
            'function_calling',
            'streaming',
            'tool_choice',
            'multiple_tools',
            'message_roles',
            'temperature_control',
            'max_tokens',
            'stop_sequences'
        ]);
    }
    /**
     * Check overall OpenAI compatibility of a request
     */
    CompatibilityChecker.prototype.checkOpenAICompatibility = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, modelCheck, messageCheck, toolsCheck, parameterCheck, weights, overallScore, compatibilityLevel, overallCompatible, result, duration, error_1, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        modelCheck = (0, model_checker_1.checkModelCompatibility)(request.model);
                        messageCheck = (0, message_checker_1.checkMessageCompatibility)(request.messages);
                        return [4 /*yield*/, (0, tool_checker_1.checkToolsCompatibility)(request.tools)];
                    case 2:
                        toolsCheck = _a.sent();
                        parameterCheck = this.checkParameterCompatibility(request);
                        weights = { model: 0.25, messages: 0.35, tools: 0.25, parameters: 0.15 };
                        overallScore = Math.round(modelCheck.score * weights.model +
                            messageCheck.score * weights.messages +
                            toolsCheck.score * weights.tools +
                            parameterCheck.score * weights.parameters);
                        compatibilityLevel = (0, model_checker_1.determineCompatibilityLevel)(overallScore);
                        overallCompatible = overallScore >= 80;
                        result = {
                            overallCompatible: overallCompatible,
                            openaiComplianceScore: overallScore,
                            supportedFeatures: this.identifySupportedFeatures(request),
                            unsupportedFeatures: this.identifyUnsupportedFeatures(request),
                            partiallySupported: this.identifyPartiallySupported(request),
                            recommendations: this.generateCompatibilityRecommendations([modelCheck, messageCheck, toolsCheck, parameterCheck], overallScore),
                            compatibilityLevel: compatibilityLevel,
                            checkTimestamp: Date.now()
                        };
                        duration = Date.now() - startTime;
                        logger.info('OpenAI compatibility check completed', {
                            score: overallScore,
                            level: compatibilityLevel,
                            duration: duration
                        });
                        return [2 /*return*/, result];
                    case 3:
                        error_1 = _a.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : String(error_1);
                        logger.error('Compatibility check failed', { error: errorMessage });
                        throw new Error("Compatibility check failed: ".concat(errorMessage));
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Validate a specific tool's OpenAI compatibility
     */
    CompatibilityChecker.prototype.validateToolSpecification = function (tool) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function () {
            var structureIssues, parameterAnalysis, complianceScore, compatible;
            return __generator(this, function (_c) {
                structureIssues = (0, tool_checker_1.validateToolStructure)(tool);
                parameterAnalysis = (0, tool_checker_1.analyzeToolParameters)((_a = tool["function"]) === null || _a === void 0 ? void 0 : _a.parameters);
                complianceScore = 100;
                structureIssues.forEach(function (issue) {
                    if (issue.severity === 'error')
                        complianceScore -= 20;
                    else if (issue.severity === 'warning')
                        complianceScore -= 10;
                    else
                        complianceScore -= 5;
                });
                complianceScore = Math.max(0, complianceScore);
                compatible = complianceScore >= 80 && structureIssues.filter(function (i) { return i.severity === 'error'; }).length === 0;
                return [2 /*return*/, {
                        toolName: ((_b = tool["function"]) === null || _b === void 0 ? void 0 : _b.name) || 'unnamed',
                        compatible: compatible,
                        complianceScore: complianceScore,
                        issues: structureIssues,
                        supportedParameters: parameterAnalysis.analysis.filter(function (p) { return p.supported; }).map(function (p) { return p.parameterName; }),
                        unsupportedParameters: parameterAnalysis.analysis.filter(function (p) { return !p.supported; }).map(function (p) { return p.parameterName; }),
                        parameterAnalysis: parameterAnalysis.analysis,
                        migrationRequirements: structureIssues.map(function (i) { return i.suggestion || i.issue; }),
                        recommendedChanges: structureIssues.map(function (issue) { return ({
                            type: 'parameter',
                            description: issue.issue,
                            priority: issue.severity === 'error' ? 'high' : 'medium',
                            effort: 'minimal'
                        }); })
                    }];
            });
        });
    };
    /**
     * Analyze parameter support
     */
    CompatibilityChecker.prototype.analyzeParameterSupport = function (parameters) {
        return __awaiter(this, void 0, void 0, function () {
            var analysis;
            return __generator(this, function (_a) {
                analysis = (0, tool_checker_1.analyzeToolParameters)(parameters);
                return [2 /*return*/, analysis.analysis];
            });
        });
    };
    /**
     * Generate comprehensive compatibility report
     */
    CompatibilityChecker.prototype.generateCompatibilityReport = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var summary, detailedAnalysis, _i, _a, tool, toolResult, parameterSupport, endpointCompliance;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.checkOpenAICompatibility(request)];
                    case 1:
                        summary = _b.sent();
                        detailedAnalysis = [];
                        if (!request.tools) return [3 /*break*/, 5];
                        _i = 0, _a = request.tools;
                        _b.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 5];
                        tool = _a[_i];
                        return [4 /*yield*/, this.validateToolSpecification(tool)];
                    case 3:
                        toolResult = _b.sent();
                        detailedAnalysis.push(toolResult);
                        _b.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [4 /*yield*/, this.analyzeParameterSupport(request)];
                    case 6:
                        parameterSupport = _b.sent();
                        return [4 /*yield*/, this.verifyEndpointCompliance('/chat/completions')];
                    case 7:
                        endpointCompliance = _b.sent();
                        return [2 /*return*/, {
                                summary: summary,
                                detailedAnalysis: detailedAnalysis,
                                parameterSupport: parameterSupport,
                                endpointCompliance: endpointCompliance,
                                migrationGuidance: this.generateMigrationGuidance(summary),
                                riskAssessment: this.assessRisks(summary),
                                generatedAt: Date.now()
                            }];
                }
            });
        });
    };
    /**
     * Verify endpoint compliance
     */
    CompatibilityChecker.prototype.verifyEndpointCompliance = function (endpoint) {
        return __awaiter(this, void 0, void 0, function () {
            var supportedEndpoints, compliant;
            return __generator(this, function (_a) {
                supportedEndpoints = ['/chat/completions', '/completions'];
                compliant = supportedEndpoints.includes(endpoint);
                return [2 /*return*/, {
                        endpoint: endpoint,
                        compliant: compliant,
                        complianceScore: compliant ? 100 : 0,
                        supportedMethods: ['POST'],
                        unsupportedMethods: ['GET', 'PUT', 'DELETE'],
                        headerCompatibility: {
                            'Content-Type': true,
                            'Authorization': true,
                            'OpenAI-Organization': false
                        },
                        responseFormatCompatibility: true,
                        authenticationCompatibility: true,
                        issues: compliant ? [] : [{
                                category: 'endpoint',
                                description: 'Endpoint not supported',
                                severity: 'critical',
                                impact: 'Request will fail'
                            }],
                        recommendations: compliant ? [] : ['Use /chat/completions endpoint']
                    }];
            });
        });
    };
    // Private helper methods
    CompatibilityChecker.prototype.checkParameterCompatibility = function (request) {
        var issues = [];
        var score = 100;
        var supportedParams = ['model', 'messages', 'tools', 'tool_choice', 'temperature', 'max_tokens', 'stream'];
        var providedParams = Object.keys(request);
        providedParams.forEach(function (param) {
            if (!supportedParams.includes(param)) {
                score -= 5;
                issues.push("Parameter '".concat(param, "' may not be supported"));
            }
        });
        return { score: Math.max(0, score), issues: issues };
    };
    CompatibilityChecker.prototype.identifySupportedFeatures = function (request) {
        var features = [];
        if (request.messages)
            features.push('chat_completions');
        if (request.tools)
            features.push('function_calling', 'multiple_tools');
        if (request.tool_choice)
            features.push('tool_choice');
        if (request.stream)
            features.push('streaming');
        if (request.temperature !== undefined)
            features.push('temperature_control');
        if (request.max_tokens)
            features.push('max_tokens');
        return features;
    };
    CompatibilityChecker.prototype.identifyUnsupportedFeatures = function (request) {
        var unsupported = [];
        // Check for known unsupported OpenAI features
        if (request.logit_bias)
            unsupported.push('logit_bias');
        if (request.presence_penalty)
            unsupported.push('presence_penalty');
        if (request.frequency_penalty)
            unsupported.push('frequency_penalty');
        return unsupported;
    };
    CompatibilityChecker.prototype.identifyPartiallySupported = function (request) {
        var partial = [];
        if (request.tools && request.tools.length > 10) {
            partial.push({
                feature: 'multiple_tools',
                supportLevel: 70,
                limitations: ['Performance may degrade with many tools'],
                workarounds: ['Use fewer tools per request', 'Batch tool calls']
            });
        }
        return partial;
    };
    CompatibilityChecker.prototype.generateCompatibilityRecommendations = function (checks, overallScore) {
        var recommendations = [];
        if (overallScore < 60) {
            recommendations.push('Consider significant modifications for OpenAI compatibility');
        }
        checks.forEach(function (check) {
            if (check.score < 80) {
                recommendations.push.apply(recommendations, check.issues.map(function (issue) { return "Address: ".concat(issue); }));
            }
        });
        return __spreadArray([], new Set(recommendations), true).slice(0, 10); // Limit to 10 recommendations
    };
    CompatibilityChecker.prototype.generateMigrationGuidance = function (result) {
        var difficulty = result.openaiComplianceScore >= 80 ? 'easy' :
            result.openaiComplianceScore >= 60 ? 'moderate' : 'complex';
        return {
            difficulty: difficulty,
            estimatedEffort: result.openaiComplianceScore >= 80 ? '1-2 hours' : '1-3 days',
            requiredChanges: [],
            migrationSteps: [
                { step: 1, description: 'Review compatibility report', actions: ['Analyze issues'], validationCriteria: ['All issues identified'] },
                { step: 2, description: 'Implement changes', actions: ['Fix critical issues'], validationCriteria: ['Score > 80'] }
            ],
            testingRecommendations: ['Test with sample requests', 'Validate tool calls', 'Check streaming']
        };
    };
    CompatibilityChecker.prototype.assessRisks = function (result) {
        var overallRisk = result.openaiComplianceScore >= 80 ? 'low' :
            result.openaiComplianceScore >= 60 ? 'medium' : 'high';
        return {
            overallRisk: overallRisk,
            risks: [
                {
                    category: 'compatibility',
                    description: 'Request may not work with OpenAI API',
                    likelihood: overallRisk,
                    impact: overallRisk,
                    mitigation: 'Follow compatibility recommendations'
                }
            ],
            mitigationStrategies: ['Implement recommended changes', 'Test thoroughly']
        };
    };
    return CompatibilityChecker;
}());
exports.CompatibilityChecker = CompatibilityChecker;
// Export singleton instance
exports.compatibilityChecker = new CompatibilityChecker();
// Re-export types for convenience
__exportStar(require("./types"), exports);
