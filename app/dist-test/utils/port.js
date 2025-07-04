"use strict";
/**
 * Port availability detection utilities
 * Based on Python main.py:835-851
 *
 * Single Responsibility: Port availability checking and detection
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
exports.PortUtils = exports.isValidPort = exports.findAvailablePortWithRetry = exports.findAvailablePort = exports.checkPortAvailability = exports.PortUnavailableError = void 0;
var node_net_1 = require("node:net");
/**
 * Port validation constants
 */
var PORT_MIN = 1;
var PORT_MAX = 65535;
var DEFAULT_PORT_RANGE = 100;
var DEFAULT_MAX_RETRIES = 10;
var DEFAULT_MAX_TRIES = 50;
/**
 * Error thrown when no available port is found
 */
var PortUnavailableError = /** @class */ (function (_super) {
    __extends(PortUnavailableError, _super);
    function PortUnavailableError(range) {
        var _this = _super.call(this, "No available port found in range ".concat(range.start, "-").concat(range.end)) || this;
        _this.name = 'PortUnavailableError';
        return _this;
    }
    return PortUnavailableError;
}(Error));
exports.PortUnavailableError = PortUnavailableError;
/**
 * Check if a specific port is available
 * @param port Port number to check
 * @returns Promise resolving to port check result
 */
function checkPortAvailability(port) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve) {
                    var server = (0, node_net_1.createServer)();
                    server.listen(port, function () {
                        server.close(function () {
                            resolve({
                                port: port,
                                available: true
                            });
                        });
                    });
                    server.on('error', function (error) {
                        resolve({
                            port: port,
                            available: false,
                            error: error.message
                        });
                    });
                })];
        });
    });
}
exports.checkPortAvailability = checkPortAvailability;
/**
 * Find the first available port in a range
 * @param startPort Starting port number
 * @param endPort Ending port number (default: startPort + 100)
 * @returns Promise resolving to first available port
 */
function findAvailablePort(startPort, endPort) {
    if (endPort === void 0) { endPort = startPort + DEFAULT_PORT_RANGE; }
    return __awaiter(this, void 0, void 0, function () {
        var port, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    port = startPort;
                    _a.label = 1;
                case 1:
                    if (!(port <= endPort)) return [3 /*break*/, 4];
                    return [4 /*yield*/, checkPortAvailability(port)];
                case 2:
                    result = _a.sent();
                    if (result.available) {
                        return [2 /*return*/, port];
                    }
                    _a.label = 3;
                case 3:
                    port++;
                    return [3 /*break*/, 1];
                case 4: throw new PortUnavailableError({ start: startPort, end: endPort });
            }
        });
    });
}
exports.findAvailablePort = findAvailablePort;
/**
 * Find available port with retry logic
 * @param preferredPort Preferred port number
 * @param maxRetries Maximum number of ports to try
 * @returns Promise resolving to available port
 */
function findAvailablePortWithRetry(preferredPort, maxRetries) {
    if (maxRetries === void 0) { maxRetries = DEFAULT_MAX_RETRIES; }
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, checkPortAvailability(preferredPort)];
                case 1:
                    result = _a.sent();
                    if (result.available) {
                        return [2 /*return*/, preferredPort];
                    }
                    // Try sequential ports after preferred port
                    return [2 /*return*/, findAvailablePort(preferredPort + 1, preferredPort + maxRetries)];
            }
        });
    });
}
exports.findAvailablePortWithRetry = findAvailablePortWithRetry;
/**
 * Validate port number is within valid range
 * @param port Port number to validate
 * @returns True if port is valid
 */
function isValidPort(port) {
    return Number.isInteger(port) && port >= PORT_MIN && port <= PORT_MAX;
}
exports.isValidPort = isValidPort;
/**
 * Port utilities class for organized port operations
 */
var PortUtils = /** @class */ (function () {
    function PortUtils() {
    }
    /**
     * Check if port is available
     * @param port Port number to check
     * @returns Promise resolving to availability status
     */
    PortUtils.isPortAvailable = function (port) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!isValidPort(port)) {
                            return [2 /*return*/, false];
                        }
                        return [4 /*yield*/, checkPortAvailability(port)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.available];
                }
            });
        });
    };
    /**
     * Get next available port starting from specified port
     * @param startPort Starting port number
     * @param maxTries Maximum number of ports to try
     * @returns Promise resolving to available port
     */
    PortUtils.getNextAvailablePort = function (startPort, maxTries) {
        if (maxTries === void 0) { maxTries = DEFAULT_MAX_TRIES; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!isValidPort(startPort)) {
                    throw new Error("Invalid port number: ".concat(startPort));
                }
                return [2 /*return*/, findAvailablePortWithRetry(startPort, maxTries)];
            });
        });
    };
    return PortUtils;
}());
exports.PortUtils = PortUtils;
