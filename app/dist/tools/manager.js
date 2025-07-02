"use strict";
/**
 * Tool management - To be implemented in Phase 26
 * Based on Python tool control logic from models.py:53 and parameter_validator.py
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolManager = void 0;
const constants_1 = require("./constants");
class ToolManager {
    static configureTools(config) {
        // Implementation pending - Phase 7
        // CHANGE: Tools enabled by default (opposite of Python)
        if (config.disable_tools === true) {
            // Opt-out: disable tools for speed optimization
            return {
                disallowed_tools: [...constants_1.CLAUDE_CODE_TOOLS],
                max_turns: 1
            };
        }
        // Default: enable all tools for full Claude Code power
        return {
            allowed_tools: config.allowed_tools || [...constants_1.CLAUDE_CODE_TOOLS],
            disallowed_tools: config.disallowed_tools || undefined,
            max_turns: config.max_turns || 10
        };
    }
}
exports.ToolManager = ToolManager;
//# sourceMappingURL=manager.js.map