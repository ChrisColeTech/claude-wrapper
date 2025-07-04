"use strict";
/**
 * Server lifecycle management
 * Based on Python main.py server startup and port conflict resolution
 *
 * Single Responsibility: HTTP server lifecycle and port management
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
exports.ServerManager = void 0;
var port_1 = require("../utils/port");
/**
 * Server manager for handling server lifecycle
 */
var ServerManager = /** @class */ (function () {
    function ServerManager(logger) {
        this.logger = logger;
    }
    /**
     * Start Express server on available port (matches Python port conflict behavior)
     * @param app Express application
     * @param preferredPort Preferred port number
     * @returns Promise resolving to server start result
     */
    ServerManager.prototype.startServer = function (app, preferredPort) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        try {
                            console.log("\uD83D\uDE80 Starting server on port ".concat(preferredPort, "..."));
                            // Try preferred port first (matching Python behavior)
                            var server_1 = app.listen(preferredPort, function () {
                                _this.server = server_1;
                                var url = "http://localhost:".concat(preferredPort);
                                console.log("\u2705 Server listening on port ".concat(preferredPort));
                                _this.logger.info("Server started successfully", {
                                    port: preferredPort,
                                    url: url,
                                    preferredPort: preferredPort
                                });
                                resolve({
                                    server: server_1,
                                    port: preferredPort,
                                    url: url
                                });
                            });
                            server_1.on('error', function (error) { return __awaiter(_this, void 0, void 0, function () {
                                var availablePort_1, fallbackServer_1, portError_1;
                                var _this = this;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!(error.code === 'EADDRINUSE' || error.message.includes('address already in use'))) return [3 /*break*/, 5];
                                            // Match Python behavior: warning + find alternative port
                                            this.logger.warn("Port ".concat(preferredPort, " is already in use. Finding alternative port..."));
                                            _a.label = 1;
                                        case 1:
                                            _a.trys.push([1, 3, , 4]);
                                            return [4 /*yield*/, port_1.PortUtils.getNextAvailablePort(preferredPort + 1)];
                                        case 2:
                                            availablePort_1 = _a.sent();
                                            fallbackServer_1 = app.listen(availablePort_1, function () {
                                                _this.server = fallbackServer_1;
                                                var url = "http://localhost:".concat(availablePort_1);
                                                // Match Python user notification messages
                                                _this.logger.info("Starting server on alternative port ".concat(availablePort_1));
                                                console.log("\n\uD83D\uDE80 Server starting on http://localhost:".concat(availablePort_1));
                                                console.log("\uD83D\uDCDD Update your client base_url to: http://localhost:".concat(availablePort_1, "/v1"));
                                                resolve({
                                                    server: fallbackServer_1,
                                                    port: availablePort_1,
                                                    url: url
                                                });
                                            });
                                            fallbackServer_1.on('error', function (fallbackError) {
                                                _this.logger.error('Fallback server startup error:', fallbackError);
                                                reject(fallbackError);
                                            });
                                            return [3 /*break*/, 4];
                                        case 3:
                                            portError_1 = _a.sent();
                                            this.logger.error('No available ports found:', portError_1);
                                            reject(new Error("No available ports found starting from ".concat(preferredPort + 1)));
                                            return [3 /*break*/, 4];
                                        case 4: return [3 /*break*/, 6];
                                        case 5:
                                            this.logger.error('Server startup error:', error);
                                            reject(error);
                                            _a.label = 6;
                                        case 6: return [2 /*return*/];
                                    }
                                });
                            }); });
                        }
                        catch (error) {
                            _this.logger.error('Server creation error:', error);
                            reject(error);
                        }
                    })];
            });
        });
    };
    /**
     * Gracefully shutdown the server
     * @returns Promise resolving when server is closed
     */
    ServerManager.prototype.shutdown = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (!this.server) {
                    return [2 /*return*/];
                }
                return [2 /*return*/, new Promise(function (resolve) {
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        _this.server.close(function () {
                            _this.logger.info('Server shutdown completed');
                            resolve();
                        });
                    })];
            });
        });
    };
    return ServerManager;
}());
exports.ServerManager = ServerManager;
