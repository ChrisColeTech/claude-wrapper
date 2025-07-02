/**
 * Claude Code tools constants
 * Based on Python main.py:342-344 tool list
 */

export const CLAUDE_CODE_TOOLS = [
  'Task', 'Bash', 'Glob', 'Grep', 'LS', 'exit_plan_mode',
  'Read', 'Edit', 'MultiEdit', 'Write', 'NotebookRead', 
  'NotebookEdit', 'WebFetch', 'TodoRead', 'TodoWrite', 'WebSearch'
] as const;

export type ClaudeCodeTool = typeof CLAUDE_CODE_TOOLS[number];

export const PERMISSION_MODES = ['default', 'acceptEdits', 'bypassPermissions'] as const;
export type PermissionMode = typeof PERMISSION_MODES[number];
