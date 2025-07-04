"use strict";
/**
 * Debug Router (Phase 14B - Refactored)
 * Single Responsibility: Main orchestrator for debug endpoints
 *
 * Replaces oversized debug-router.ts following SRP and DRY principles
 * Coordinates focused route handlers under 200 lines total
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
exports.__esModule = true;
exports.DebugResponseUtils = exports.CompatibilityHandlers = exports.ToolInspectionHandlers = exports.DebugRequestValidator = exports.DebugRouteConfig = exports.debugRouter = exports.createDebugRouter = exports.DebugRouter = void 0;
var debug_route_config_1 = require("./routing/debug-route-config");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('DebugRouter');
/**
 * Main debug router that orchestrates all debug functionality
 * SRP: Route coordination and configuration only
 */
var DebugRouter = /** @class */ (function () {
    function DebugRouter(config) {
        this.routeConfig = new debug_route_config_1.DebugRouteConfig(config);
        this.router = this.routeConfig.createRouter();
        logger.info('Debug router initialized', {
            config: config,
            message: 'All debug endpoints configured and ready'
        });
    }
    /**
     * Get the configured Express router
     */
    DebugRouter.prototype.getRouter = function () {
        return this.router;
    };
    /**
     * Get route configuration
     */
    DebugRouter.prototype.getConfig = function () {
        return this.routeConfig;
    };
    return DebugRouter;
}());
exports.DebugRouter = DebugRouter;
/**
 * Create debug router with default configuration
 */
function createDebugRouter(config) {
    var debugRouter = new DebugRouter(config);
    return debugRouter.getRouter();
}
exports.createDebugRouter = createDebugRouter;
/**
 * Export default router instance for convenience
 */
exports.debugRouter = createDebugRouter();
// Export all focused components for direct access if needed
var debug_route_config_2 = require("./routing/debug-route-config");
__createBinding(exports, debug_route_config_2, "DebugRouteConfig");
var debug_request_validator_1 = require("./routing/debug-request-validator");
__createBinding(exports, debug_request_validator_1, "DebugRequestValidator");
var tool_inspection_handlers_1 = require("./handlers/tool-inspection-handlers");
__createBinding(exports, tool_inspection_handlers_1, "ToolInspectionHandlers");
var compatibility_handlers_1 = require("./handlers/compatibility-handlers");
__createBinding(exports, compatibility_handlers_1, "CompatibilityHandlers");
var debug_response_utils_1 = require("./utils/debug-response-utils");
__createBinding(exports, debug_response_utils_1, "DebugResponseUtils");
