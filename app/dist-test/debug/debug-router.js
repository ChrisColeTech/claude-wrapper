"use strict";
/**
 * Debug Endpoints Router
 * Single Responsibility: HTTP routing for debug endpoints only
 *
 * Provides HTTP endpoint routing for debug functionality:
 * - Tool call inspection endpoints
 * - OpenAI compatibility verification endpoints
 * - Performance monitoring endpoints
 * - Debug reporting and analysis endpoints
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
exports.debugRouter = exports.DebugRouter = void 0;
var express_1 = require("express");
var tool_inspector_1 = require("./tool-inspector");
var compatibility_checker_1 = require("./compatibility-checker");
var logger_1 = require("../utils/logger");
var constants_1 = require("../tools/constants");
var logger = (0, logger_1.getLogger)('DebugRouter');
/**
 * Debug router implementation
 */
var DebugRouter = /** @class */ (function () {
    function DebugRouter() {
        this.router = (0, express_1.Router)();
        this.setupRoutes();
    }
    /**
     * Get Express router instance
     */
    DebugRouter.prototype.getRouter = function () {
        return this.router;
    };
    /**
     * Setup debug routes
     */
    DebugRouter.prototype.setupRoutes = function () {
        // Tool inspection endpoints
        this.router.get(constants_1.DEBUG_ENDPOINTS.TOOL_INSPECT + '/:sessionId/:toolCallId', this.validateDebugRequest.bind(this), this.handleToolInspection.bind(this));
        this.router.get(constants_1.DEBUG_ENDPOINTS.TOOL_HISTORY + '/:sessionId', this.validateDebugRequest.bind(this), this.handleHistoryInspection.bind(this));
        this.router.get(constants_1.DEBUG_ENDPOINTS.PERFORMANCE_MONITOR + '/:sessionId/:toolCallId', this.validateDebugRequest.bind(this), this.handlePerformanceAnalysis.bind(this));
        // Compatibility verification endpoints
        this.router.post(constants_1.DEBUG_ENDPOINTS.COMPATIBILITY_CHECK, this.validateCompatibilityRequest.bind(this), this.handleCompatibilityCheck.bind(this));
        // OpenAI compliance endpoints
        this.router.get(constants_1.DEBUG_ENDPOINTS.OPENAI_COMPLIANCE + '/:sessionId', this.validateDebugRequest.bind(this), this.handleDebugReport.bind(this));
        this.router.get(constants_1.DEBUG_ENDPOINTS.TOOL_VALIDATION + '/:sessionId', this.validateDebugRequest.bind(this), this.handleChainValidation.bind(this));
        logger.debug('Debug routes configured', {
            routes: Object.keys(constants_1.DEBUG_ENDPOINTS)
        });
    };
    /**
     * Validate debug request parameters
     */
    DebugRouter.prototype.validateDebugRequest = function (req, res, next) {
        var sessionId = req.params.sessionId;
        if (!sessionId) {
            res.status(400).json({
                error: constants_1.DEBUG_ERROR_CODES.INVALID_DEBUG_REQUEST,
                message: constants_1.DEBUG_MESSAGES.INVALID_DEBUG_REQUEST
            });
            return;
        }
        next();
    };
    /**
     * Validate compatibility check request
     */
    DebugRouter.prototype.validateCompatibilityRequest = function (req, res, next) {
        var request = req.body.request;
        if (!request) {
            res.status(400).json({
                error: constants_1.DEBUG_ERROR_CODES.INVALID_DEBUG_REQUEST,
                message: 'Request body is required for compatibility checking'
            });
            return;
        }
        next();
    };
    /**
     * Handle tool call inspection
     */
    DebugRouter.prototype.handleToolInspection = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, _a, sessionId, toolCallId, result, responseTime, error_1, responseTime;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = Date.now();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        _a = req.params, sessionId = _a.sessionId, toolCallId = _a.toolCallId;
                        if (!toolCallId) {
                            res.status(400).json({
                                error: constants_1.DEBUG_ERROR_CODES.INVALID_DEBUG_REQUEST,
                                message: 'Tool call ID is required'
                            });
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, tool_inspector_1.toolInspector.inspectToolCall(sessionId, toolCallId)];
                    case 2:
                        result = _b.sent();
                        responseTime = Date.now() - startTime;
                        this.checkPerformanceRequirement(responseTime);
                        res.json({
                            success: true,
                            data: result,
                            responseTimeMs: responseTime
                        });
                        logger.debug('Tool inspection completed', {
                            sessionId: sessionId,
                            toolCallId: toolCallId,
                            responseTime: responseTime
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _b.sent();
                        responseTime = Date.now() - startTime;
                        this.handleRouterError(res, error_1, 'tool inspection', responseTime);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle tool call history inspection
     */
    DebugRouter.prototype.handleHistoryInspection = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, sessionId, limit, result, responseTime, error_2, responseTime;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        sessionId = req.params.sessionId;
                        limit = parseInt(req.query.limit) || 50;
                        return [4 /*yield*/, tool_inspector_1.toolInspector.generateToolCallHistoryReport(sessionId)];
                    case 2:
                        result = _a.sent();
                        responseTime = Date.now() - startTime;
                        this.checkPerformanceRequirement(responseTime);
                        res.json({
                            success: true,
                            data: result,
                            responseTimeMs: responseTime
                        });
                        logger.debug('History inspection completed', {
                            sessionId: sessionId,
                            limit: limit,
                            responseTime: responseTime
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        responseTime = Date.now() - startTime;
                        this.handleRouterError(res, error_2, 'history inspection', responseTime);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle performance analysis
     */
    DebugRouter.prototype.handlePerformanceAnalysis = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, _a, sessionId, toolCallId, result, responseTime, error_3, responseTime;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = Date.now();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        _a = req.params, sessionId = _a.sessionId, toolCallId = _a.toolCallId;
                        if (!toolCallId) {
                            res.status(400).json({
                                error: constants_1.DEBUG_ERROR_CODES.INVALID_DEBUG_REQUEST,
                                message: 'Tool call ID is required for performance analysis'
                            });
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, tool_inspector_1.toolInspector.analyzePerformanceTrends(sessionId)];
                    case 2:
                        result = _b.sent();
                        responseTime = Date.now() - startTime;
                        this.checkPerformanceRequirement(responseTime);
                        res.json({
                            success: true,
                            data: result,
                            responseTimeMs: responseTime
                        });
                        logger.debug('Performance analysis completed', {
                            sessionId: sessionId,
                            toolCallId: toolCallId,
                            responseTime: responseTime
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _b.sent();
                        responseTime = Date.now() - startTime;
                        this.handleRouterError(res, error_3, 'performance analysis', responseTime);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle compatibility checking
     */
    DebugRouter.prototype.handleCompatibilityCheck = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, _a, request, toolSpecification, endpoint, result, responseTime, error_4, responseTime;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        startTime = Date.now();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 8, , 9]);
                        _a = req.body, request = _a.request, toolSpecification = _a.toolSpecification, endpoint = _a.endpoint;
                        result = void 0;
                        if (!toolSpecification) return [3 /*break*/, 3];
                        return [4 /*yield*/, compatibility_checker_1.compatibilityChecker.validateToolSpecification(toolSpecification)];
                    case 2:
                        result = _b.sent();
                        return [3 /*break*/, 7];
                    case 3:
                        if (!endpoint) return [3 /*break*/, 5];
                        return [4 /*yield*/, compatibility_checker_1.compatibilityChecker.verifyEndpointCompliance(endpoint)];
                    case 4:
                        result = _b.sent();
                        return [3 /*break*/, 7];
                    case 5: return [4 /*yield*/, compatibility_checker_1.compatibilityChecker.checkOpenAICompatibility(request)];
                    case 6:
                        result = _b.sent();
                        _b.label = 7;
                    case 7:
                        responseTime = Date.now() - startTime;
                        this.checkPerformanceRequirement(responseTime);
                        res.json({
                            success: true,
                            data: result,
                            responseTimeMs: responseTime
                        });
                        logger.debug('Compatibility check completed', {
                            hasToolSpec: !!toolSpecification,
                            hasEndpoint: !!endpoint,
                            responseTime: responseTime
                        });
                        return [3 /*break*/, 9];
                    case 8:
                        error_4 = _b.sent();
                        responseTime = Date.now() - startTime;
                        this.handleRouterError(res, error_4, 'compatibility check', responseTime);
                        return [3 /*break*/, 9];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle debug report generation
     */
    DebugRouter.prototype.handleDebugReport = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, sessionId, reportType, result, responseTime, error_5, responseTime;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        sessionId = req.params.sessionId;
                        reportType = req.query.type || 'full';
                        return [4 /*yield*/, tool_inspector_1.toolInspector.generateInspectionReport(sessionId)];
                    case 2:
                        result = _a.sent();
                        responseTime = Date.now() - startTime;
                        this.checkPerformanceRequirement(responseTime);
                        res.json({
                            success: true,
                            data: result,
                            responseTimeMs: responseTime
                        });
                        logger.debug('Debug report generated', {
                            sessionId: sessionId,
                            reportType: reportType,
                            responseTime: responseTime
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        error_5 = _a.sent();
                        responseTime = Date.now() - startTime;
                        this.handleRouterError(res, error_5, 'debug report generation', responseTime);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle tool call chain validation
     */
    DebugRouter.prototype.handleChainValidation = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, sessionId, toolCallIds, result, responseTime, error_6, responseTime;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        sessionId = req.params.sessionId;
                        toolCallIds = req.body.toolCallIds || [];
                        return [4 /*yield*/, tool_inspector_1.toolInspector.validateToolCallChain(toolCallIds, sessionId)];
                    case 2:
                        result = _a.sent();
                        responseTime = Date.now() - startTime;
                        this.checkPerformanceRequirement(responseTime);
                        res.json({
                            success: true,
                            data: result,
                            responseTimeMs: responseTime
                        });
                        logger.debug('Chain validation completed', {
                            sessionId: sessionId,
                            responseTime: responseTime
                        });
                        return [3 /*break*/, 4];
                    case 3:
                        error_6 = _a.sent();
                        responseTime = Date.now() - startTime;
                        this.handleRouterError(res, error_6, 'chain validation', responseTime);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check performance requirement compliance
     */
    DebugRouter.prototype.checkPerformanceRequirement = function (responseTime) {
        if (responseTime > constants_1.DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS) {
            logger.warn('Debug endpoint exceeded performance requirement', {
                responseTime: responseTime,
                limit: constants_1.DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS
            });
        }
    };
    /**
     * Handle router errors
     */
    DebugRouter.prototype.handleRouterError = function (res, error, operation, responseTime) {
        var errorMessage = error instanceof Error ? error.message : String(error);
        logger.error("Debug router ".concat(operation, " failed"), {
            error: errorMessage,
            responseTime: responseTime
        });
        res.status(500).json({
            success: false,
            error: constants_1.DEBUG_ERROR_CODES.TOOL_INSPECTION_FAILED,
            message: "".concat(operation, " failed: ").concat(errorMessage),
            responseTimeMs: responseTime
        });
    };
    return DebugRouter;
}());
exports.DebugRouter = DebugRouter;
/**
 * Default debug router instance
 */
exports.debugRouter = new DebugRouter();
