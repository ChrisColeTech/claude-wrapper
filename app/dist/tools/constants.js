"use strict";
/**
 * Claude Code tools constants
 * Based on Python main.py:342-344 tool list
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSION_MODES = exports.CLAUDE_CODE_TOOLS = void 0;
exports.CLAUDE_CODE_TOOLS = [
    'Task', 'Bash', 'Glob', 'Grep', 'LS', 'exit_plan_mode',
    'Read', 'Edit', 'MultiEdit', 'Write', 'NotebookRead',
    'NotebookEdit', 'WebFetch', 'TodoRead', 'TodoWrite', 'WebSearch'
];
exports.PERMISSION_MODES = ['default', 'acceptEdits', 'bypassPermissions'];
//# sourceMappingURL=constants.js.map