"use strict";
/**
 * Tool validation - To be implemented in Phase 26
 * Based on Python parameter_validator.py:96-137 tool header validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolValidator = void 0;
const constants_1 = require("./constants");
class ToolValidator {
    static validateToolNames(_tools) {
        // Implementation pending - Phase 26
        const errors = [];
        const warnings = [];
        // Will validate tool names against CLAUDE_CODE_TOOLS list
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    static validatePermissionMode(mode) {
        // Implementation pending - Phase 26
        return constants_1.PERMISSION_MODES.includes(mode);
    }
    static parseToolHeader(_headerValue) {
        // Implementation pending - Phase 26
        // Will parse comma-separated tool names
        return [];
    }
}
exports.ToolValidator = ToolValidator;
//# sourceMappingURL=validator.js.map