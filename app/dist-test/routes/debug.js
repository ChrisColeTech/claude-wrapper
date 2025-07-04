"use strict";
/**
 * Debug Router - Debug and Compatibility Endpoints
 * Phase 14A Implementation: Complete debug and compatibility endpoints
 * Based on Phase 14A requirements for tool call inspection and debugging
 *
 * Single Responsibility: HTTP endpoint handling for debugging and compatibility analysis
 */
exports.__esModule = true;
exports.DebugRouter = void 0;
var debug_router_1 = require("../debug/debug-router");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('DebugRouter');
/**
 * Debug Router class
 * Phase 14A implementation using new debug services
 */
var DebugRouter = /** @class */ (function () {
    function DebugRouter() {
    }
    /**
     * Create Express router with debug endpoints
     * Uses the new Phase 14A debug-router implementation
     */
    DebugRouter.createRouter = function () {
        var router = debug_router_1.debugRouter.getRouter();
        logger.info('DebugRouter configured with Phase 14A debug services');
        return router;
    };
    return DebugRouter;
}());
exports.DebugRouter = DebugRouter;
/**
 * Default export for backward compatibility
 */
exports["default"] = DebugRouter.createRouter();
