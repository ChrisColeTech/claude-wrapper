#!/usr/bin/env node
"use strict";
/**
 * Claude Code OpenAI Wrapper - CLI Entry Point
 * Command-line interface for starting the server
 *
 * Based on Python implementation main.py CLI behavior
 * Single Responsibility: CLI argument parsing and application startup
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
exports.CliRunner = exports.CliParser = void 0;
var commander_1 = require("commander");
var env_1 = require("./utils/env");
var logger_1 = require("./utils/logger");
var server_1 = require("./server");
var auth_manager_1 = require("./auth/auth-manager");
var interactive_1 = require("./utils/interactive");
var child_process_1 = require("child_process");
var util_1 = require("util");
var fs = require("fs");
var path = require("path");
var os = require("os");
var execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * CLI argument parser and validator
 */
var CliParser = /** @class */ (function () {
    function CliParser() {
        this.program = new commander_1.Command();
        this.setupCommands();
    }
    /**
     * Setup CLI commands and options - simplified to match Python behavior
     * Python only accepts a single port argument via sys.argv
     */
    CliParser.prototype.setupCommands = function () {
        this.program
            .name('claude-wrapper')
            .description('OpenAI-compatible API wrapper for Claude Code CLI')
            .version('1.0.0')
            .option('-p, --port <port>', 'port to run server on (default: 8000)')
            .option('-v, --verbose', 'enable verbose logging')
            .option('-d, --debug', 'enable debug mode')
            .option('--no-interactive', 'disable interactive API key setup')
            .option('--start', 'start server in background (daemon mode)')
            .option('--stop', 'stop background server')
            .option('--status', 'check background server status')
            .helpOption('-h, --help', 'display help for command')
            .argument('[port]', 'port to run server on (default: 8000) - alternative to --port option');
    };
    /**
     * Parse command line arguments (matches Python sys.argv behavior)
     * @param argv Command line arguments
     * @returns Parsed CLI options
     */
    CliParser.prototype.parseArguments = function (argv) {
        this.program.parse(argv);
        var options = this.program.opts();
        var args = this.program.args;
        // Handle port from --port option or positional argument
        // Priority: --port option takes precedence over positional argument
        var portToUse = options.port;
        if (!portToUse && args.length > 0) {
            var portArg = args[0];
            try {
                // Python int() is stricter than parseInt - must be exact integer string
                var portNum = parseInt(portArg, 10);
                var isExactInteger = portArg === portNum.toString() && !portArg.includes('.');
                if (!isNaN(portNum) && isExactInteger && portNum >= 1 && portNum <= 65535) {
                    portToUse = portArg;
                    console.log("Using port from command line argument: ".concat(portNum));
                }
                else {
                    console.log("Invalid port number: ".concat(portArg, ". Using default."));
                }
            }
            catch (error) {
                console.log("Invalid port number: ".concat(portArg, ". Using default."));
            }
        }
        if (portToUse) {
            options.port = portToUse;
        }
        return options;
    };
    /**
     * Validate CLI options
     * @param options CLI options to validate
     */
    CliParser.prototype.validateOptions = function (options) {
        if (options.port) {
            var portNum = parseInt(options.port, 10);
            if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                throw new Error("Invalid port number: ".concat(options.port, ". Must be between 1 and 65535."));
            }
        }
    };
    return CliParser;
}());
exports.CliParser = CliParser;
/**
 * CLI application runner
 */
var CliRunner = /** @class */ (function () {
    function CliRunner() {
        this.parser = new CliParser();
    }
    /**
     * Run the CLI application
     * @param argv Command line arguments
     */
    CliRunner.prototype.run = function (argv) {
        if (argv === void 0) { argv = process.argv; }
        return __awaiter(this, void 0, void 0, function () {
            var options, loadEnvironmentConfig, updatedConfig, logger, runtimeApiKey, result, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 11, , 12]);
                        options = this.parser.parseArguments(argv);
                        this.parser.validateOptions(options);
                        if (!options.stop) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.stopDaemon()];
                    case 1:
                        _a.sent();
                        process.exit(0);
                        _a.label = 2;
                    case 2:
                        if (!options.status) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.checkDaemonStatus()];
                    case 3:
                        _a.sent();
                        process.exit(0);
                        _a.label = 4;
                    case 4:
                        if (!options.start) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.startDaemon(options)];
                    case 5:
                        _a.sent();
                        process.exit(0);
                        _a.label = 6;
                    case 6:
                        // Override environment variables with CLI options
                        if (options.port) {
                            process.env.PORT = options.port;
                        }
                        if (options.verbose) {
                            process.env.VERBOSE = 'true';
                        }
                        if (options.debug) {
                            process.env.DEBUG_MODE = 'true';
                        }
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('./utils/env'); })];
                    case 7:
                        loadEnvironmentConfig = (_a.sent()).loadEnvironmentConfig;
                        updatedConfig = loadEnvironmentConfig();
                        logger = (0, logger_1.createLogger)(updatedConfig);
                        // Show startup banner
                        console.log('\n🚀 Claude Code OpenAI Wrapper v1.0.0');
                        console.log('==================================================');
                        console.log('Starting server...');
                        console.log("Port: ".concat(updatedConfig.PORT));
                        console.log("Debug: ".concat(updatedConfig.DEBUG_MODE ? 'enabled' : 'disabled'));
                        console.log("Verbose: ".concat(updatedConfig.VERBOSE ? 'enabled' : 'disabled'));
                        console.log('==================================================\n');
                        logger.info('Starting Claude Code OpenAI Wrapper', {
                            version: '1.0.0',
                            options: {
                                port: updatedConfig.PORT,
                                verbose: updatedConfig.VERBOSE,
                                debug: updatedConfig.DEBUG_MODE,
                                interactive: options.interactive !== false
                            }
                        });
                        if (!(options.interactive !== false)) return [3 /*break*/, 9];
                        logger.debug('Running interactive API key setup...');
                        return [4 /*yield*/, (0, interactive_1.promptForApiProtection)()];
                    case 8:
                        runtimeApiKey = _a.sent();
                        if (runtimeApiKey) {
                            auth_manager_1.authManager.setApiKey(runtimeApiKey);
                            logger.info('Runtime API key configured for server protection');
                        }
                        _a.label = 9;
                    case 9:
                        // Start the server with progress indicators
                        console.log('🔧 Initializing authentication providers...');
                        return [4 /*yield*/, (0, server_1.createAndStartServer)(updatedConfig)];
                    case 10:
                        result = _a.sent();
                        console.log('\n🎉 Server is ready and running!');
                        console.log('==================================================');
                        console.log("\uD83C\uDF10 Server URL: ".concat(result.url));
                        console.log("\uD83D\uDCE1 Port: ".concat(result.port));
                        console.log('\n📋 Available endpoints:');
                        console.log("   Health:          ".concat(result.url, "/health"));
                        console.log("   Chat:            ".concat(result.url, "/v1/chat/completions"));
                        console.log("   Models:          ".concat(result.url, "/v1/models"));
                        console.log("   Sessions:        ".concat(result.url, "/v1/sessions"));
                        console.log("   Auth Status:     ".concat(result.url, "/v1/auth/status"));
                        console.log('\n💡 Test with:');
                        console.log("   curl ".concat(result.url, "/health"));
                        console.log('==================================================\n');
                        logger.info('🚀 Server is ready!', {
                            url: result.url,
                            port: result.port,
                            endpoints: [
                                "".concat(result.url, "/health"),
                                "".concat(result.url, "/v1/chat/completions"),
                                "".concat(result.url, "/v1/models")
                            ]
                        });
                        // Setup graceful shutdown
                        this.setupGracefulShutdown(result.server, logger);
                        return [3 /*break*/, 12];
                    case 11:
                        error_1 = _a.sent();
                        this.handleError(error_1);
                        return [3 /*break*/, 12];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Setup graceful shutdown handlers
     * @param server HTTP server instance
     * @param logger Logger instance
     */
    CliRunner.prototype.setupGracefulShutdown = function (server, logger) {
        var _this = this;
        var shutdown = function (signal) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                logger.info("Received ".concat(signal, ", starting graceful shutdown..."));
                server.close(function () {
                    logger.info('HTTP server closed');
                    process.exit(0);
                });
                // Force exit after 10 seconds
                setTimeout(function () {
                    logger.error('Forced shutdown after timeout');
                    process.exit(1);
                }, 10000);
                return [2 /*return*/];
            });
        }); };
        process.on('SIGTERM', function () { return shutdown('SIGTERM'); });
        process.on('SIGINT', function () { return shutdown('SIGINT'); });
    };
    /**
     * Handle CLI errors
     * @param error Error to handle
     */
    CliRunner.prototype.handleError = function (error) {
        console.log('\n💥 Startup Failed!');
        console.log('==================================================');
        if (error instanceof env_1.EnvironmentError) {
            console.error("\u274C Configuration Error: ".concat(error.message));
            console.error('\n🔧 Troubleshooting:');
            console.error('   1. Check your environment variables');
            console.error('   2. Verify .env file configuration');
            console.error('   3. Ensure all required dependencies are installed');
        }
        else {
            console.error("\u274C Failed to start server: ".concat(error.message));
            console.error('\n🔧 Troubleshooting:');
            console.error('   1. Check if port is already in use');
            console.error('   2. Verify Claude Code CLI is installed (claude --version)');
            console.error('   3. Check authentication setup');
            console.error('   4. Try running with --debug for more details');
        }
        console.log('==================================================\n');
        process.exit(1);
    };
    /**
     * Get PID file path
     */
    CliRunner.prototype.getPidFile = function () {
        return path.join(os.tmpdir(), 'claude-wrapper.pid');
    };
    /**
     * Get log file path
     */
    CliRunner.prototype.getLogFile = function () {
        return path.join(os.tmpdir(), 'claude-wrapper.log');
    };
    /**
     * Start server in daemon mode
     */
    CliRunner.prototype.startDaemon = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var pidFile, logFile, pid, port, args, spawn, nodePath, scriptPath, child, logStream;
            return __generator(this, function (_a) {
                pidFile = this.getPidFile();
                logFile = this.getLogFile();
                // Check if already running
                if (fs.existsSync(pidFile)) {
                    pid = fs.readFileSync(pidFile, 'utf8').trim();
                    try {
                        process.kill(parseInt(pid), 0); // Check if process exists
                        console.log('❌ Server is already running (PID: ' + pid + ')');
                        console.log('   Use --stop to stop it first, or --status to check');
                        return [2 /*return*/];
                    }
                    catch (_b) {
                        // Process doesn't exist, remove stale PID file
                        fs.unlinkSync(pidFile);
                    }
                }
                console.log('🚀 Starting claude-wrapper in background...');
                port = options.port || '8000';
                args = [port, '--no-interactive'];
                if (options.verbose)
                    args.push('--verbose');
                if (options.debug)
                    args.push('--debug');
                spawn = require('child_process').spawn;
                nodePath = process.execPath;
                scriptPath = path.join(__dirname, 'index.js');
                child = spawn(nodePath, [scriptPath], {
                    detached: true,
                    stdio: ['ignore', 'pipe', 'pipe'],
                    env: __assign(__assign({}, process.env), { PORT: port, VERBOSE: options.verbose ? 'true' : undefined, DEBUG_MODE: options.debug ? 'true' : undefined })
                });
                // Write PID file
                fs.writeFileSync(pidFile, child.pid.toString());
                logStream = fs.createWriteStream(logFile, { flags: 'a' });
                child.stdout.pipe(logStream);
                child.stderr.pipe(logStream);
                child.unref(); // Allow parent to exit
                console.log("\u2705 Server started in background");
                console.log("   PID: ".concat(child.pid));
                console.log("   Port: ".concat(port));
                console.log("   Logs: ".concat(logFile));
                console.log("   Stop: claude-wrapper --stop");
                return [2 /*return*/];
            });
        });
    };
    /**
     * Stop daemon server
     */
    CliRunner.prototype.stopDaemon = function () {
        return __awaiter(this, void 0, void 0, function () {
            var pidFile, pid;
            return __generator(this, function (_a) {
                pidFile = this.getPidFile();
                if (!fs.existsSync(pidFile)) {
                    console.log('❌ No background server found');
                    return [2 /*return*/];
                }
                pid = fs.readFileSync(pidFile, 'utf8').trim();
                try {
                    process.kill(parseInt(pid), 'SIGTERM');
                    fs.unlinkSync(pidFile);
                    console.log("\u2705 Server stopped (PID: ".concat(pid, ")"));
                }
                catch (error) {
                    console.log("\u274C Failed to stop server: ".concat(error));
                    fs.unlinkSync(pidFile); // Remove stale PID file
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Check daemon status
     */
    CliRunner.prototype.checkDaemonStatus = function () {
        return __awaiter(this, void 0, void 0, function () {
            var pidFile, logFile, pid, stdout, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        pidFile = this.getPidFile();
                        logFile = this.getLogFile();
                        if (!fs.existsSync(pidFile)) {
                            console.log('📊 Server Status: NOT RUNNING');
                            return [2 /*return*/];
                        }
                        pid = fs.readFileSync(pidFile, 'utf8').trim();
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 6, , 7]);
                        process.kill(parseInt(pid), 0); // Check if process exists
                        console.log('📊 Server Status: RUNNING');
                        console.log("   PID: ".concat(pid));
                        console.log("   Logs: ".concat(logFile));
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, execAsync('curl -s http://localhost:8000/health')];
                    case 3:
                        stdout = (_c.sent()).stdout;
                        if (stdout.includes('healthy')) {
                            console.log('   Health: ✅ OK (port 8000)');
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        _a = _c.sent();
                        console.log('   Health: ❓ Could not connect to port 8000');
                        return [3 /*break*/, 5];
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        _b = _c.sent();
                        console.log('📊 Server Status: NOT RUNNING (stale PID file)');
                        fs.unlinkSync(pidFile);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    return CliRunner;
}());
exports.CliRunner = CliRunner;
// Main execution
if (require.main === module) {
    var cli = new CliRunner();
    cli.run()["catch"](function (error) {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
}
