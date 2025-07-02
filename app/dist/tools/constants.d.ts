/**
 * Claude Code tools constants
 * Based on Python main.py:342-344 tool list
 */
export declare const CLAUDE_CODE_TOOLS: readonly ["Task", "Bash", "Glob", "Grep", "LS", "exit_plan_mode", "Read", "Edit", "MultiEdit", "Write", "NotebookRead", "NotebookEdit", "WebFetch", "TodoRead", "TodoWrite", "WebSearch"];
export type ClaudeCodeTool = typeof CLAUDE_CODE_TOOLS[number];
export declare const PERMISSION_MODES: readonly ["default", "acceptEdits", "bypassPermissions"];
export type PermissionMode = typeof PERMISSION_MODES[number];
//# sourceMappingURL=constants.d.ts.map