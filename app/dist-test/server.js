"use strict";
/**
 * Express server configuration and management
 * Based on Python main.py FastAPI app setup
 *
 * Single Responsibility: Express server creation and lifecycle management
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
exports.createAndStartServer = exports.createApp = exports.ExpressAppFactory = exports.Server = exports.ServerManager = void 0;
var express_1 = require("express");
var logger_1 = require("./utils/logger");
var middleware_1 = require("./auth/middleware");
var cors_1 = require("./middleware/cors");
var auth_initializer_1 = require("./server/auth-initializer");
var server_manager_1 = require("./server/server-manager");
exports.ServerManager = server_manager_1.ServerManager;
var routes_1 = require("./routes");
// Re-export http Server for tests
var http_1 = require("http");
__createBinding(exports, http_1, "Server");
// ServerStartResult exported from server-manager
/**
 * Express application factory
 */
var ExpressAppFactory = /** @class */ (function () {
    function ExpressAppFactory(logger) {
        this.logger = logger;
        this.startTime = Date.now();
    }
    /**
     * Create configured Express application
     * @param config Server configuration
     * @returns Configured Express app
     */
    ExpressAppFactory.prototype.createApp = function (config) {
        var _this = this;
        var app = (0, express_1["default"])();
        // Remove security headers that expose server info
        app.disable('x-powered-by');
        // Request parsing middleware
        app.use(express_1["default"].json({ limit: '10mb' }));
        app.use(express_1["default"].urlencoded({ extended: true }));
        // CORS middleware
        app.use((0, cors_1.createCorsMiddleware)(config.corsOrigins));
        // Request logging middleware
        app.use(function (req, _res, next) {
            _this.logger.debug("".concat(req.method, " ").concat(req.path), {
                method: req.method,
                path: req.path,
                userAgent: req.get('User-Agent')
            });
            next();
        });
        // Authentication status middleware (adds auth headers)
        app.use(middleware_1.authStatusMiddleware);
        // Authentication middleware for protected routes
        app.use((0, middleware_1.authMiddleware)({
            skipPaths: ['/health', '/health/detailed', '/v1/models', '/v1/auth/status', '/v1/compatibility', '/v1/debug/request'] // Skip auth for health, models, auth status, and debug endpoints
        }));
        // Set start time for health router
        routes_1.HealthRouter.setStartTime(this.startTime);
        // Mount route handlers
        app.use(routes_1.ModelsRouter.createRouter());
        app.use(routes_1.HealthRouter.createRouter());
        app.use(routes_1.AuthRouter.createRouter());
        app.use(routes_1.SessionsRouter.createRouter());
        app.use(routes_1.DebugRouter.createRouter());
        app.use(routes_1.ChatRouter.createRouter());
        // 404 handler
        app.use(function (_req, res) {
            res.status(404).json({
                error: 'Not Found',
                message: 'The requested endpoint does not exist'
            });
        });
        // Error handling middleware
        app.use(function (error, _req, res, _next) {
            _this.logger.error('Express error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'An unexpected error occurred'
            });
        });
        this.logger.info('Express application configured successfully');
        return app;
    };
    return ExpressAppFactory;
}());
exports.ExpressAppFactory = ExpressAppFactory;
/**
 * Create Express application with environment configuration
 * @param config Environment configuration
 * @returns Configured Express application
 */
function createApp(config) {
    var logger = (0, logger_1.createLogger)(config);
    var factory = new ExpressAppFactory(logger);
    var serverConfig = {
        port: config.PORT,
        corsOrigins: config.CORS_ORIGINS,
        timeout: config.MAX_TIMEOUT
    };
    return factory.createApp(serverConfig);
}
exports.createApp = createApp;
/**
 * Create and start server with environment configuration
 * @param config Environment configuration
 * @returns Promise resolving to server start result
 */
function createAndStartServer(config) {
    return __awaiter(this, void 0, void 0, function () {
        var logger, app, serverManager;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logger = (0, logger_1.createLogger)(config);
                    // Initialize authentication before creating app
                    return [4 /*yield*/, (0, auth_initializer_1.initializeAuthentication)(logger)];
                case 1:
                    // Initialize authentication before creating app
                    _a.sent();
                    app = createApp(config);
                    serverManager = new server_manager_1.ServerManager(logger);
                    return [2 /*return*/, serverManager.startServer(app, config.PORT)];
            }
        });
    });
}
exports.createAndStartServer = createAndStartServer;
