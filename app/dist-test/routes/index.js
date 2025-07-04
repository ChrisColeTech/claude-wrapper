"use strict";
/**
 * Routes module exports
 * Implements Phase 11A routes organization
 * Updated for Phase 12A to include auth routes
 * Updated for Phase 13A to include sessions routes
 * Updated for Phase 14A to include debug routes
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
exports.__esModule = true;
exports.DebugRouter = exports.SessionsRouter = exports.AuthRouter = exports.ChatRouter = exports.HealthRouter = exports.ModelsRouter = void 0;
__exportStar(require("./models"), exports);
__exportStar(require("./health"), exports);
__exportStar(require("./chat"), exports);
__exportStar(require("./auth"), exports);
__exportStar(require("./sessions"), exports);
__exportStar(require("./debug"), exports);
var models_1 = require("./models");
__createBinding(exports, models_1, "default", "ModelsRouter");
var health_1 = require("./health");
__createBinding(exports, health_1, "default", "HealthRouter");
var chat_1 = require("./chat");
__createBinding(exports, chat_1, "default", "ChatRouter");
var auth_1 = require("./auth");
__createBinding(exports, auth_1, "default", "AuthRouter");
var sessions_1 = require("./sessions");
__createBinding(exports, sessions_1, "SessionsRouter");
var debug_1 = require("./debug");
__createBinding(exports, debug_1, "DebugRouter");
