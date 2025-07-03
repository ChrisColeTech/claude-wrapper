/**
 * Claude Code tools constants
 * Based on Python main.py:342-344 tool list
 * Complete set of 11 core Claude Code tools
 */

export const CLAUDE_CODE_TOOLS = [
  'Task', 'Bash', 'Glob', 'Grep', 'LS', 'exit_plan_mode',
  'Read', 'Edit', 'MultiEdit', 'Write', 'NotebookRead', 
  'NotebookEdit', 'WebFetch', 'TodoRead', 'TodoWrite', 'WebSearch'
] as const;

export type ClaudeCodeTool = typeof CLAUDE_CODE_TOOLS[number];

/**
 * Permission modes for tool execution
 * Based on Python parameter_validator.py permission handling
 */
export const PERMISSION_MODES = ['default', 'acceptEdits', 'bypassPermissions'] as const;
export type PermissionMode = typeof PERMISSION_MODES[number];

/**
 * Tool categories for granular control
 * Based on Python tool classification logic
 */
export const TOOL_CATEGORIES = {
  READ_ONLY: ['Task', 'Glob', 'Grep', 'LS', 'Read', 'NotebookRead', 'WebFetch', 'TodoRead', 'WebSearch'],
  WRITE_OPERATIONS: ['Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'TodoWrite'],
  EXECUTION: ['Bash'],
  FLOW_CONTROL: ['exit_plan_mode']
} as const;

/**
 * Default tool configuration
 * Changed from Python: tools enabled by default for full Claude Code power
 */
export const DEFAULT_TOOL_CONFIG = {
  tools_enabled: true,
  disable_tools: false,
  max_turns: 10,
  permission_mode: 'default' as PermissionMode,
  allowed_tools: [...CLAUDE_CODE_TOOLS],
  disallowed_tools: [] as ClaudeCodeTool[]
};

/**
 * Tool header names for HTTP request parsing
 * Based on Python parameter_validator.py:96-137 header parsing
 */
export const TOOL_HEADERS = {
  READ_PERMISSION: 'X-Claude-Read',
  WRITE_PERMISSION: 'X-Claude-Write', 
  EXECUTION_PERMISSION: 'X-Claude-Execute',
  TOOLS_ENABLED: 'X-Claude-Tools-Enabled',
  TOOLS_DISABLED: 'X-Claude-Tools-Disabled',
  PERMISSION_MODE: 'X-Claude-Permission-Mode',
  MAX_TURNS: 'X-Claude-Max-Turns'
} as const;
