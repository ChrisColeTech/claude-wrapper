"use strict";
/**
 * Tool call coordination service
 * Single Responsibility: Coordination and orchestration only
 *
 * Coordinates multiple tool calls by:
 * - Detecting dependencies between tool calls
 * - Optimizing processing order for efficiency
 * - Managing tool call relationships and sequencing
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
exports.toolCallCoordinator = exports.ToolCallCoordinatorFactory = exports.ToolCallCoordinator = exports.CoordinationUtils = exports.CoordinationError = void 0;
var constants_1 = require("./constants");
var id_manager_1 = require("./id-manager");
/**
 * Tool call coordination error
 */
var CoordinationError = /** @class */ (function (_super) {
    __extends(CoordinationError, _super);
    function CoordinationError(message, code, coordinationId, details) {
        var _this = _super.call(this, message) || this;
        _this.name = 'CoordinationError';
        _this.code = code;
        _this.coordinationId = coordinationId;
        _this.details = details;
        return _this;
    }
    return CoordinationError;
}(Error));
exports.CoordinationError = CoordinationError;
/**
 * Tool call coordination utilities
 */
var CoordinationUtils = /** @class */ (function () {
    function CoordinationUtils() {
    }
    /**
     * Validate tool calls for coordination
     */
    CoordinationUtils.validateToolCalls = function (toolCalls) {
        var _a;
        if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
            return false;
        }
        if (toolCalls.length > constants_1.MULTI_TOOL_LIMITS.MAX_TOOLS_PER_REQUEST) {
            return false;
        }
        // Validate each tool call structure
        for (var _i = 0, toolCalls_1 = toolCalls; _i < toolCalls_1.length; _i++) {
            var toolCall = toolCalls_1[_i];
            if (!toolCall.id || !((_a = toolCall["function"]) === null || _a === void 0 ? void 0 : _a.name)) {
                return false;
            }
        }
        // Check for duplicate IDs
        var ids = toolCalls.map(function (call) { return call.id; });
        var uniqueIds = new Set(ids);
        if (ids.length !== uniqueIds.size) {
            return false;
        }
        return true;
    };
    /**
     * Extract file paths from tool call arguments
     */
    CoordinationUtils.extractFilePaths = function (toolCall) {
        var paths = [];
        try {
            var args = JSON.parse(toolCall["function"].arguments || '{}');
            // Common path properties
            var pathProps = ['path', 'file', 'directory', 'source', 'destination', 'input', 'output'];
            for (var _i = 0, pathProps_1 = pathProps; _i < pathProps_1.length; _i++) {
                var prop = pathProps_1[_i];
                if (args[prop] && typeof args[prop] === 'string') {
                    paths.push(args[prop]);
                }
            }
        }
        catch (_a) {
            // Ignore invalid JSON arguments
        }
        return paths;
    };
    /**
     * Check if tool name represents a file operation
     */
    CoordinationUtils.isFileOperation = function (toolName) {
        var fileOperations = [
            'read_file', 'write_file', 'edit_file', 'delete_file',
            'list_files', 'copy_file', 'move_file', 'create_directory',
            'remove_directory'
        ];
        return fileOperations.includes(toolName);
    };
    /**
     * Get operation type for prioritization
     */
    CoordinationUtils.getOperationType = function (toolName) {
        var readOps = ['read_file', 'list_files', 'get_file_info', 'process_file'];
        var writeOps = ['write_file', 'edit_file', 'delete_file', 'copy_file', 'move_file', 'create_directory'];
        if (readOps.includes(toolName))
            return 'read';
        if (writeOps.includes(toolName))
            return 'write';
        return 'other';
    };
    /**
     * Analyze tool call dependencies
     */
    CoordinationUtils.analyzeToolCallDependencies = function (toolCall) {
        var paths = this.extractFilePaths(toolCall);
        var opType = this.getOperationType(toolCall["function"].name);
        // For process_file, input paths are dependencies, output paths are provides
        if (toolCall["function"].name === 'process_file') {
            try {
                var args = JSON.parse(toolCall["function"].arguments || '{}');
                var dependencies = args.input ? [args.input] : [];
                var provides = args.output ? [args.output] : [];
                return { dependencies: dependencies, provides: provides };
            }
            catch (_a) {
                return { dependencies: [], provides: [] };
            }
        }
        return {
            dependencies: opType === 'read' ? paths : [],
            provides: opType === 'write' ? paths : [] // Write operations provide files
        };
    };
    /**
     * Topological sort for dependency resolution
     */
    CoordinationUtils.topologicalSort = function (nodes, dependencies) {
        var visited = new Set();
        var tempVisited = new Set();
        var result = [];
        var visit = function (node) {
            if (tempVisited.has(node)) {
                // Circular dependency - include node anyway
                return;
            }
            if (visited.has(node)) {
                return;
            }
            tempVisited.add(node);
            var deps = dependencies.get(node) || [];
            for (var _i = 0, deps_1 = deps; _i < deps_1.length; _i++) {
                var dep = deps_1[_i];
                if (nodes.includes(dep)) {
                    visit(dep);
                }
            }
            tempVisited["delete"](node);
            visited.add(node);
            result.push(node);
        };
        for (var _i = 0, nodes_1 = nodes; _i < nodes_1.length; _i++) {
            var node = nodes_1[_i];
            if (!visited.has(node)) {
                visit(node);
            }
        }
        return result;
    };
    /**
     * Create coordination result
     */
    CoordinationUtils.createResult = function (success, coordinatedCalls, processingOrder, dependencies, errors, startTime) {
        if (processingOrder === void 0) { processingOrder = []; }
        if (dependencies === void 0) { dependencies = new Map(); }
        if (errors === void 0) { errors = []; }
        return {
            success: success,
            coordinatedCalls: coordinatedCalls,
            processingOrder: processingOrder,
            dependencies: dependencies,
            errors: errors,
            coordinationTimeMs: startTime ? performance.now() - startTime : 0
        };
    };
    return CoordinationUtils;
}());
exports.CoordinationUtils = CoordinationUtils;
/**
 * Tool call coordinator implementation
 */
var ToolCallCoordinator = /** @class */ (function () {
    function ToolCallCoordinator(idManager) {
        this.stats = {
            totalCoordinations: 0,
            successfulCoordinations: 0,
            failedCoordinations: 0,
            averageDependencies: 0,
            totalCoordinationTime: 0
        };
        this.idManager = idManager || id_manager_1.toolCallIDManager;
    }
    /**
     * Coordinate multiple tool calls for optimal execution
     */
    ToolCallCoordinator.prototype.coordinateToolCalls = function (toolCalls, sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, result_1, result_2, ids, uniqueIds, result_3, result_4, _i, toolCalls_2, toolCall, dependencies, processingOrder, coordinatedCalls, result;
            return __generator(this, function (_a) {
                startTime = performance.now();
                this.stats.totalCoordinations++;
                try {
                    // Validate tool calls  
                    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
                        result_1 = CoordinationUtils.createResult(false, [], [], new Map(), [constants_1.MULTI_TOOL_MESSAGES.INVALID_MULTI_CALL_STRUCTURE], startTime);
                        this.stats.failedCoordinations++;
                        return [2 /*return*/, result_1];
                    }
                    if (toolCalls.length > constants_1.MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS) {
                        result_2 = CoordinationUtils.createResult(false, toolCalls, [], new Map(), [constants_1.MULTI_TOOL_MESSAGES.TOO_MANY_PARALLEL_CALLS], startTime);
                        this.stats.failedCoordinations++;
                        return [2 /*return*/, result_2];
                    }
                    ids = toolCalls.map(function (call) { return call.id; });
                    uniqueIds = new Set(ids);
                    if (ids.length !== uniqueIds.size) {
                        result_3 = CoordinationUtils.createResult(false, toolCalls, [], new Map(), [constants_1.MULTI_TOOL_MESSAGES.DUPLICATE_TOOL_CALL_IDS], startTime);
                        this.stats.failedCoordinations++;
                        return [2 /*return*/, result_3];
                    }
                    if (!CoordinationUtils.validateToolCalls(toolCalls)) {
                        result_4 = CoordinationUtils.createResult(false, toolCalls, [], new Map(), [constants_1.MULTI_TOOL_MESSAGES.COORDINATION_FAILED], startTime);
                        this.stats.failedCoordinations++;
                        return [2 /*return*/, result_4];
                    }
                    // Track all tool call IDs if session provided
                    if (sessionId) {
                        for (_i = 0, toolCalls_2 = toolCalls; _i < toolCalls_2.length; _i++) {
                            toolCall = toolCalls_2[_i];
                            this.idManager.trackId(toolCall.id, sessionId);
                        }
                    }
                    dependencies = this.detectDependencies(toolCalls);
                    processingOrder = this.optimizeProcessingOrder(toolCalls);
                    coordinatedCalls = processingOrder.map(function (id) {
                        return toolCalls.find(function (call) { return call.id === id; });
                    });
                    result = CoordinationUtils.createResult(true, coordinatedCalls, processingOrder, dependencies, [], startTime);
                    this.stats.successfulCoordinations++;
                    this.stats.averageDependencies =
                        (this.stats.averageDependencies * (this.stats.totalCoordinations - 1) + dependencies.size)
                            / this.stats.totalCoordinations;
                    this.stats.totalCoordinationTime += result.coordinationTimeMs;
                    return [2 /*return*/, result];
                }
                catch (error) {
                    this.stats.failedCoordinations++;
                    return [2 /*return*/, CoordinationUtils.createResult(false, toolCalls, [], new Map(), [error instanceof Error ? error.message : constants_1.MULTI_TOOL_MESSAGES.COORDINATION_FAILED], startTime)];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Detect dependencies between tool calls
     */
    ToolCallCoordinator.prototype.detectDependencies = function (toolCalls) {
        var dependencies = new Map();
        var provides = new Map();
        // First pass: catalog what each tool call provides
        for (var _i = 0, toolCalls_3 = toolCalls; _i < toolCalls_3.length; _i++) {
            var toolCall = toolCalls_3[_i];
            var analysis = CoordinationUtils.analyzeToolCallDependencies(toolCall);
            for (var _a = 0, _b = analysis.provides; _a < _b.length; _a++) {
                var provided = _b[_a];
                provides.set(provided, toolCall.id);
            }
        }
        // Second pass: find dependencies
        for (var _c = 0, toolCalls_4 = toolCalls; _c < toolCalls_4.length; _c++) {
            var toolCall = toolCalls_4[_c];
            var analysis = CoordinationUtils.analyzeToolCallDependencies(toolCall);
            var toolDependencies = [];
            for (var _d = 0, _e = analysis.dependencies; _d < _e.length; _d++) {
                var dependency = _e[_d];
                var providerId = provides.get(dependency);
                if (providerId && providerId !== toolCall.id) {
                    toolDependencies.push(providerId);
                }
            }
            if (toolDependencies.length > 0) {
                dependencies.set(toolCall.id, toolDependencies);
            }
        }
        return dependencies;
    };
    /**
     * Optimize processing order based on dependencies and priorities
     */
    ToolCallCoordinator.prototype.optimizeProcessingOrder = function (toolCalls) {
        var _this = this;
        var dependencies = this.detectDependencies(toolCalls);
        var processed = new Set();
        var order = [];
        // Topological sort with priority optimization
        var canProcess = function (toolCallId) {
            var deps = dependencies.get(toolCallId) || [];
            return deps.every(function (dep) { return processed.has(dep); });
        };
        // Process tool calls in dependency order with priority rules
        while (order.length < toolCalls.length) {
            var addedInThisRound = false;
            // Find tool calls that can be processed (dependencies satisfied)
            var available = toolCalls
                .filter(function (call) { return !processed.has(call.id) && canProcess(call.id); })
                .sort(function (a, b) { return _this.getPriority(a) - _this.getPriority(b); });
            for (var _i = 0, available_1 = available; _i < available_1.length; _i++) {
                var toolCall = available_1[_i];
                order.push(toolCall.id);
                processed.add(toolCall.id);
                addedInThisRound = true;
            }
            // Break circular dependencies if no progress made
            if (!addedInThisRound) {
                var remaining = toolCalls.filter(function (call) { return !processed.has(call.id); });
                if (remaining.length > 0) {
                    // Add the tool call with fewest dependencies
                    var leastDeps = remaining.reduce(function (min, call) {
                        var _a, _b;
                        var callDeps = ((_a = dependencies.get(call.id)) === null || _a === void 0 ? void 0 : _a.length) || 0;
                        var minDeps = ((_b = dependencies.get(min.id)) === null || _b === void 0 ? void 0 : _b.length) || 0;
                        return callDeps < minDeps ? call : min;
                    });
                    order.push(leastDeps.id);
                    processed.add(leastDeps.id);
                }
            }
        }
        return order;
    };
    /**
     * Get priority for tool call (lower number = higher priority)
     */
    ToolCallCoordinator.prototype.getPriority = function (toolCall) {
        var functionName = toolCall["function"].name;
        // Priority order for optimal execution
        var priorities = {
            'list_directory': 1,
            'list_files': 1,
            'search_files': 2,
            'search_content': 2,
            'read_file': 3,
            'web_fetch': 4,
            'web_search': 4,
            'write_file': 5,
            'edit_file': 6,
            'execute_command': 7 // Commands last
        };
        return priorities[functionName] || 8;
    };
    /**
     * Get coordination statistics
     */
    ToolCallCoordinator.prototype.getCoordinationStats = function () {
        return __assign(__assign({}, this.stats), { averageCoordinationTime: this.stats.totalCoordinations > 0
                ? this.stats.totalCoordinationTime / this.stats.totalCoordinations
                : 0, successRate: this.stats.totalCoordinations > 0
                ? this.stats.successfulCoordinations / this.stats.totalCoordinations
                : 0 });
    };
    /**
     * Reset coordination statistics
     */
    ToolCallCoordinator.prototype.resetStats = function () {
        this.stats = {
            totalCoordinations: 0,
            successfulCoordinations: 0,
            failedCoordinations: 0,
            averageDependencies: 0,
            totalCoordinationTime: 0
        };
    };
    return ToolCallCoordinator;
}());
exports.ToolCallCoordinator = ToolCallCoordinator;
/**
 * Factory for creating tool call coordinator
 */
var ToolCallCoordinatorFactory = /** @class */ (function () {
    function ToolCallCoordinatorFactory() {
    }
    ToolCallCoordinatorFactory.create = function (idManager) {
        return new ToolCallCoordinator(idManager);
    };
    return ToolCallCoordinatorFactory;
}());
exports.ToolCallCoordinatorFactory = ToolCallCoordinatorFactory;
/**
 * Singleton tool call coordinator instance
 */
exports.toolCallCoordinator = ToolCallCoordinatorFactory.create();
