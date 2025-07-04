"use strict";
/**
 * Message module exports
 * Phase 2A: Updated with new message conversion components
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
exports.contentFilter = exports.messageParser = exports.openaiConverter = exports.claudeConverter = exports.MESSAGE_PERFORMANCE = exports.MESSAGE_ROLES = exports.CONVERSION_MODES = exports.MESSAGE_FORMATS = exports.MessageParserFactory = exports.MessageParser = void 0;
// Legacy components (backwards compatibility)
__exportStar(require("./adapter"), exports);
__exportStar(require("./filter"), exports);
__exportStar(require("./tokens"), exports);
// Phase 2A: New message format conversion components
__exportStar(require("./constants"), exports);
__exportStar(require("./interfaces"), exports);
__exportStar(require("./errors"), exports);
__exportStar(require("./claude-converter"), exports);
__exportStar(require("./openai-converter"), exports);
var message_parser_1 = require("./message-parser");
__createBinding(exports, message_parser_1, "MessageParser");
__createBinding(exports, message_parser_1, "MessageParserFactory");
// Re-export key constants
var constants_1 = require("./constants");
__createBinding(exports, constants_1, "MESSAGE_FORMATS");
__createBinding(exports, constants_1, "CONVERSION_MODES");
__createBinding(exports, constants_1, "MESSAGE_ROLES");
__createBinding(exports, constants_1, "MESSAGE_PERFORMANCE");
// Re-export main converter instances
var claude_converter_1 = require("./claude-converter");
__createBinding(exports, claude_converter_1, "claudeConverter");
var openai_converter_1 = require("./openai-converter");
__createBinding(exports, openai_converter_1, "openaiConverter");
var message_parser_2 = require("./message-parser");
__createBinding(exports, message_parser_2, "messageParser");
__createBinding(exports, message_parser_2, "contentFilter");
