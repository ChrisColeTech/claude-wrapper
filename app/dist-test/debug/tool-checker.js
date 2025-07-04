"use strict";
/**
 * Tool compatibility checking utilities
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
exports.analyzeToolParameters = exports.validateParametersSchema = exports.validateToolStructure = exports.checkToolsCompatibility = void 0;
/**
 * Check tools compatibility with OpenAI standards
 */
function checkToolsCompatibility(tools) {
    return __awaiter(this, void 0, void 0, function () {
        var issues, score, toolNames;
        return __generator(this, function (_a) {
            issues = [];
            score = 100;
            if (!tools) {
                return [2 /*return*/, { score: score, issues: issues }];
            }
            if (!Array.isArray(tools)) {
                score = 0;
                issues.push('Tools must be an array if provided');
                return [2 /*return*/, { score: score, issues: issues }];
            }
            if (tools.length > 128) {
                score -= 20;
                issues.push('Too many tools (max 128 supported by OpenAI)');
            }
            toolNames = new Set();
            tools.forEach(function (tool, index) {
                if (!tool.type || tool.type !== 'function') {
                    score -= 15;
                    issues.push("Tool ".concat(index, ": Type must be 'function'"));
                }
                if (!tool["function"]) {
                    score -= 20;
                    issues.push("Tool ".concat(index, ": Missing function definition"));
                    return;
                }
                if (!tool["function"].name) {
                    score -= 15;
                    issues.push("Tool ".concat(index, ": Missing function name"));
                }
                else {
                    if (toolNames.has(tool["function"].name)) {
                        score -= 20;
                        issues.push("Tool ".concat(index, ": Duplicate function name '").concat(tool["function"].name, "'"));
                    }
                    toolNames.add(tool["function"].name);
                    if (!/^[a-zA-Z0-9_-]+$/.test(tool["function"].name)) {
                        score -= 10;
                        issues.push("Tool ".concat(index, ": Function name '").concat(tool["function"].name, "' contains invalid characters"));
                    }
                }
                if (!tool["function"].description) {
                    score -= 5;
                    issues.push("Tool ".concat(index, ": Missing function description (recommended)"));
                }
                // Validate parameters schema
                if (tool["function"].parameters) {
                    var schemaIssues = validateParametersSchema(tool["function"].parameters);
                    schemaIssues.forEach(function (issue) {
                        if (issue.severity === 'error')
                            score -= 10;
                        else if (issue.severity === 'warning')
                            score -= 5;
                        issues.push("Tool ".concat(index, ", ").concat(issue.field, ": ").concat(issue.issue));
                    });
                }
            });
            return [2 /*return*/, { score: Math.max(0, score), issues: issues }];
        });
    });
}
exports.checkToolsCompatibility = checkToolsCompatibility;
/**
 * Validate tool structure
 */
function validateToolStructure(tool) {
    var issues = [];
    if (!tool.type) {
        issues.push({
            field: 'type',
            issue: 'Missing required field',
            severity: 'error',
            suggestion: 'Add type: "function"'
        });
    }
    else if (tool.type !== 'function') {
        issues.push({
            field: 'type',
            issue: "Invalid type '".concat(tool.type, "', must be 'function'"),
            severity: 'error',
            suggestion: 'Change type to "function"'
        });
    }
    if (!tool["function"]) {
        issues.push({
            field: 'function',
            issue: 'Missing required function definition',
            severity: 'error'
        });
        return issues;
    }
    if (!tool["function"].name) {
        issues.push({
            field: 'function.name',
            issue: 'Missing required function name',
            severity: 'error'
        });
    }
    else {
        if (tool["function"].name.length > 64) {
            issues.push({
                field: 'function.name',
                issue: 'Function name too long (max 64 characters)',
                severity: 'error'
            });
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(tool["function"].name)) {
            issues.push({
                field: 'function.name',
                issue: 'Function name contains invalid characters (only a-z, A-Z, 0-9, _, - allowed)',
                severity: 'error'
            });
        }
    }
    if (!tool["function"].description) {
        issues.push({
            field: 'function.description',
            issue: 'Missing function description',
            severity: 'warning',
            suggestion: 'Add a clear description of what the function does'
        });
    }
    else if (tool["function"].description.length > 1024) {
        issues.push({
            field: 'function.description',
            issue: 'Function description too long (max 1024 characters)',
            severity: 'warning'
        });
    }
    return issues;
}
exports.validateToolStructure = validateToolStructure;
/**
 * Validate parameters schema
 */
function validateParametersSchema(parameters) {
    var issues = [];
    if (!parameters) {
        return issues;
    }
    if (typeof parameters !== 'object' || Array.isArray(parameters)) {
        issues.push({
            field: 'parameters',
            issue: 'Parameters must be an object',
            severity: 'error'
        });
        return issues;
    }
    // Check for required JSON Schema fields
    if (parameters.type !== 'object') {
        issues.push({
            field: 'parameters.type',
            issue: 'Parameters type must be "object"',
            severity: 'error',
            suggestion: 'Set type: "object"'
        });
    }
    if (parameters.properties && typeof parameters.properties !== 'object') {
        issues.push({
            field: 'parameters.properties',
            issue: 'Properties must be an object',
            severity: 'error'
        });
    }
    if (parameters.required && !Array.isArray(parameters.required)) {
        issues.push({
            field: 'parameters.required',
            issue: 'Required must be an array',
            severity: 'error'
        });
    }
    // Validate property complexity
    if (parameters.properties) {
        var propertyCount = Object.keys(parameters.properties).length;
        if (propertyCount > 100) {
            issues.push({
                field: 'parameters.properties',
                issue: "Too many properties (".concat(propertyCount, ", max 100)"),
                severity: 'warning'
            });
        }
        // Check nested depth
        var maxDepth = calculateObjectDepth(parameters.properties);
        if (maxDepth > 5) {
            issues.push({
                field: 'parameters.properties',
                issue: "Schema too deeply nested (depth ".concat(maxDepth, ", max 5)"),
                severity: 'warning'
            });
        }
    }
    return issues;
}
exports.validateParametersSchema = validateParametersSchema;
/**
 * Analyze tool parameters
 */
function analyzeToolParameters(parameters) {
    var analysis = [];
    if (!parameters || !parameters.properties) {
        return { supportedCount: 0, unsupportedCount: 0, analysis: analysis };
    }
    var supportedCount = 0;
    var unsupportedCount = 0;
    Object.entries(parameters.properties).forEach(function (_a) {
        var paramName = _a[0], paramDef = _a[1];
        var paramAnalysis = {
            parameterName: paramName,
            supported: true,
            supportLevel: 'full',
            issues: [],
            recommendations: []
        };
        // Check parameter type support
        if (paramDef.type) {
            var supportedTypes = ['string', 'number', 'integer', 'boolean', 'object', 'array'];
            if (!supportedTypes.includes(paramDef.type)) {
                paramAnalysis.supported = false;
                paramAnalysis.supportLevel = 'none';
                paramAnalysis.issues.push("Unsupported parameter type: ".concat(paramDef.type));
                unsupportedCount++;
            }
            else {
                supportedCount++;
            }
        }
        else {
            paramAnalysis.supportLevel = 'partial';
            paramAnalysis.issues.push('Missing type specification');
            paramAnalysis.recommendations.push('Add explicit type specification');
        }
        // Check for complex nested objects
        if (paramDef.type === 'object' && paramDef.properties) {
            var nestedDepth = calculateObjectDepth(paramDef.properties);
            if (nestedDepth > 3) {
                paramAnalysis.supportLevel = 'partial';
                paramAnalysis.issues.push('Deeply nested object may cause issues');
                paramAnalysis.recommendations.push('Consider flattening the parameter structure');
            }
        }
        analysis.push(paramAnalysis);
    });
    return { supportedCount: supportedCount, unsupportedCount: unsupportedCount, analysis: analysis };
}
exports.analyzeToolParameters = analyzeToolParameters;
/**
 * Calculate object depth for schema validation
 */
function calculateObjectDepth(obj, currentDepth) {
    if (currentDepth === void 0) { currentDepth = 0; }
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        return currentDepth;
    }
    var maxDepth = currentDepth;
    Object.values(obj).forEach(function (value) {
        if (typeof value === 'object' && value !== null) {
            var depth = calculateObjectDepth(value, currentDepth + 1);
            maxDepth = Math.max(maxDepth, depth);
        }
    });
    return maxDepth;
}
