"use strict";
/**
 * Claude CLI authentication provider
 * Based on Python auth.py ClaudeCliAuth class
 *
 * Single Responsibility: Handle Claude CLI system authentication
 */
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
exports.ClaudeCliProvider = void 0;
var interfaces_1 = require("../interfaces");
var logger_1 = require("../../utils/logger");
var util_1 = require("util");
var child_process_1 = require("child_process");
var execAsync = (0, util_1.promisify)(child_process_1.exec);
var logger = (0, logger_1.getLogger)('ClaudeCliProvider');
/**
 * Claude CLI authentication provider
 */
var ClaudeCliProvider = /** @class */ (function () {
    function ClaudeCliProvider() {
    }
    /**
     * Validate Claude CLI authentication configuration
     * Matches Python behavior - assumes CLI is valid by default
     */
    ClaudeCliProvider.prototype.validate = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                logger.debug('Claude CLI authentication: assuming valid (matches Python behavior)');
                // Python approach: assume Claude CLI is functional
                // Let the actual SDK handle authentication during usage
                return [2 /*return*/, {
                        valid: true,
                        errors: [],
                        config: {
                            method: 'Claude Code CLI authentication',
                            note: 'Using existing Claude Code CLI authentication'
                        },
                        method: interfaces_1.AuthMethod.CLAUDE_CLI
                    }];
            });
        });
    };
    /**
     * Get authentication method type
     */
    ClaudeCliProvider.prototype.getMethod = function () {
        return interfaces_1.AuthMethod.CLAUDE_CLI;
    };
    /**
     * Get required environment variables for this provider
     */
    ClaudeCliProvider.prototype.getRequiredEnvVars = function () {
        // Claude CLI doesn't require specific environment variables
        return [];
    };
    /**
     * Check if this provider is configured
     */
    ClaudeCliProvider.prototype.isConfigured = function () {
        // Always consider configured if CLI might be available
        // Actual validation happens in validate()
        return true;
    };
    /**
     * Detect if this provider should be used based on environment
     */
    ClaudeCliProvider.prototype.canDetect = function () {
        // Auto-detect if no other auth methods are available
        // This is typically the fallback option
        return true;
    };
    /**
     * Check if Claude CLI is installed
     */
    ClaudeCliProvider.prototype.isClaudeCliInstalled = function () {
        return __awaiter(this, void 0, void 0, function () {
            var cliCommands, _i, cliCommands_1, cmd, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cliCommands = [
                            'claude --version',
                            '/home/risky/.claude/local/claude --version',
                            '~/.claude/local/claude --version',
                            'npx @anthropic-ai/claude-code --version'
                        ];
                        _i = 0, cliCommands_1 = cliCommands;
                        _a.label = 1;
                    case 1:
                        if (!(_i < cliCommands_1.length)) return [3 /*break*/, 6];
                        cmd = cliCommands_1[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, execAsync(cmd, { timeout: 5000 })];
                    case 3:
                        _a.sent();
                        logger.debug("Claude CLI installation verified with: ".concat(cmd));
                        return [2 /*return*/, true];
                    case 4:
                        error_1 = _a.sent();
                        logger.debug("Claude CLI not found with ".concat(cmd, ": ").concat(error_1));
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/, false];
                }
            });
        });
    };
    /**
     * Check Claude CLI authentication status
     */
    ClaudeCliProvider.prototype.checkClaudeCliAuth = function () {
        return __awaiter(this, void 0, void 0, function () {
            var testCommands, _i, testCommands_1, cmd, _a, stdout, stderr, error_2, errorStr;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        testCommands = [
                            'claude --print "test"',
                            '/home/risky/.claude/local/claude --print "test"',
                            '~/.claude/local/claude --print "test"',
                            'npx @anthropic-ai/claude-code --print "test"'
                        ];
                        _i = 0, testCommands_1 = testCommands;
                        _b.label = 1;
                    case 1:
                        if (!(_i < testCommands_1.length)) return [3 /*break*/, 6];
                        cmd = testCommands_1[_i];
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, execAsync(cmd, {
                                timeout: 10000,
                                env: __assign(__assign({}, process.env), { CLAUDE_CLI_NO_INTERACTION: '1' })
                            })];
                    case 3:
                        _a = _b.sent(), stdout = _a.stdout, stderr = _a.stderr;
                        if (stderr && stderr.includes('not authenticated')) {
                            return [3 /*break*/, 5]; // Try next command
                        }
                        if (stderr && stderr.includes('API key')) {
                            return [3 /*break*/, 5]; // Try next command
                        }
                        // If we get output without errors, assume authenticated
                        if (stdout || (!stderr.includes('error') && !stderr.includes('Error'))) {
                            logger.debug("Claude CLI authentication test passed with: ".concat(cmd));
                            return [2 /*return*/, {
                                    authenticated: true,
                                    userInfo: { test_response: stdout.trim().substring(0, 50), command: cmd }
                                }];
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _b.sent();
                        errorStr = String(error_2);
                        // Handle common authentication errors
                        if (errorStr.includes('not authenticated') || errorStr.includes('API key')) {
                            return [3 /*break*/, 5]; // Try next command
                        }
                        if (errorStr.includes('timeout')) {
                            return [3 /*break*/, 5]; // Try next command
                        }
                        logger.debug("Claude CLI auth check error with ".concat(cmd, ": ").concat(error_2));
                        return [3 /*break*/, 5]; // Try next command
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: 
                    // All commands failed
                    return [2 /*return*/, {
                            authenticated: false,
                            error: 'Claude CLI authentication test failed with all command variations'
                        }];
                }
            });
        });
    };
    return ClaudeCliProvider;
}());
exports.ClaudeCliProvider = ClaudeCliProvider;
