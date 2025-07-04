"use strict";
/**
 * Claude Code OpenAI Wrapper - Application Entry Point
 * Main application entry point for programmatic usage
 *
 * Based on Python implementation main.py
 * Single Responsibility: Application bootstrap and programmatic API
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
exports.PortUtils = exports.createLogger = exports.config = exports.createApplication = exports.startServer = exports.Application = void 0;
var dotenv_1 = require("dotenv");
var env_1 = require("./utils/env");
var logger_1 = require("./utils/logger");
var server_1 = require("./server");
// Load environment variables
dotenv_1["default"].config();
/**
 * Main application class for programmatic usage
 */
var Application = /** @class */ (function () {
    function Application() {
        this.logger = (0, logger_1.createLogger)(env_1.config);
    }
    /**
     * Start the application with options
     * @param options Application startup options
     * @returns Application result with server and shutdown function
     */
    Application.prototype.start = function (options) {
        if (options === void 0) { options = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var _a, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        // Override environment variables with options
                        if (options.port) {
                            process.env.PORT = options.port.toString();
                        }
                        if (options.verbose) {
                            process.env.VERBOSE = 'true';
                        }
                        if (options.debug) {
                            process.env.DEBUG_MODE = 'true';
                        }
                        this.logger.info('Starting Claude Code OpenAI Wrapper application...', {
                            options: options,
                            config: {
                                port: env_1.config.PORT,
                                verbose: env_1.config.VERBOSE,
                                debug: env_1.config.DEBUG_MODE
                            }
                        });
                        // Start the server
                        _a = this;
                        return [4 /*yield*/, (0, server_1.createAndStartServer)(env_1.config)];
                    case 1:
                        // Start the server
                        _a.serverResult = _b.sent();
                        this.logger.info('Application started successfully', {
                            url: this.serverResult.url,
                            port: this.serverResult.port
                        });
                        return [2 /*return*/, {
                                server: this.serverResult,
                                shutdown: this.shutdown.bind(this)
                            }];
                    case 2:
                        error_1 = _b.sent();
                        this.logger.error('Failed to start application:', error_1);
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Gracefully shutdown the application
     */
    Application.prototype.shutdown = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (!this.serverResult) {
                    return [2 /*return*/];
                }
                this.logger.info('Shutting down application...');
                return [2 /*return*/, new Promise(function (resolve) {
                        _this.serverResult.server.close(function () {
                            _this.logger.info('Application shutdown completed');
                            resolve();
                        });
                    })];
            });
        });
    };
    return Application;
}());
exports.Application = Application;
/**
 * Start server with options (legacy function for compatibility)
 * @param options Server startup options
 * @returns Promise resolving to server result
 */
function startServer(options) {
    if (options === void 0) { options = {}; }
    return __awaiter(this, void 0, void 0, function () {
        var app, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    app = new Application();
                    return [4 /*yield*/, app.start(options)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.server];
            }
        });
    });
}
exports.startServer = startServer;
/**
 * Create application instance
 * @returns New application instance
 */
function createApplication() {
    return new Application();
}
exports.createApplication = createApplication;
// Export configuration and utilities for external use
var env_2 = require("./utils/env");
__createBinding(exports, env_2, "config");
var logger_2 = require("./utils/logger");
__createBinding(exports, logger_2, "createLogger");
var port_1 = require("./utils/port");
__createBinding(exports, port_1, "PortUtils");
// Direct execution (for npm run dev)
if (require.main === module) {
    var app = new Application();
    app.start().then(function (result) {
        console.log("\uD83D\uDE80 Server ready at ".concat(result.server.url));
        // Setup graceful shutdown for direct execution
        var gracefulShutdown = function (signal) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\nReceived ".concat(signal, ", shutting down gracefully..."));
                        return [4 /*yield*/, result.shutdown()];
                    case 1:
                        _a.sent();
                        process.exit(0);
                        return [2 /*return*/];
                }
            });
        }); };
        process.on('SIGTERM', function () { return gracefulShutdown('SIGTERM'); });
        process.on('SIGINT', function () { return gracefulShutdown('SIGINT'); });
    })["catch"](function (error) {
        console.error('Failed to start application:', error);
        process.exit(1);
    });
}
