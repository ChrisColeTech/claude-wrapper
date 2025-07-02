/**
 * Tool management - To be implemented in Phase 26
 * Based on Python tool control logic from models.py:53 and parameter_validator.py
 */

import { CLAUDE_CODE_TOOLS, ClaudeCodeTool, PermissionMode } from './constants';

export interface ToolConfiguration {
  disable_tools?: boolean; // Changed: tools enabled by default
  allowed_tools?: ClaudeCodeTool[];
  disallowed_tools?: ClaudeCodeTool[];
  permission_mode?: PermissionMode;
  max_turns?: number;
}

export class ToolManager {
  static configureTools(config: ToolConfiguration): {
    allowed_tools?: ClaudeCodeTool[];
    disallowed_tools?: ClaudeCodeTool[];
    max_turns: number;
  } {
    // Implementation pending - Phase 7
    // CHANGE: Tools enabled by default (opposite of Python)
    
    if (config.disable_tools === true) {
      // Opt-out: disable tools for speed optimization
      return {
        disallowed_tools: [...CLAUDE_CODE_TOOLS],
        max_turns: 1
      };
    }
    
    // Default: enable all tools for full Claude Code power
    return {
      allowed_tools: config.allowed_tools || [...CLAUDE_CODE_TOOLS],
      disallowed_tools: config.disallowed_tools || undefined,
      max_turns: config.max_turns || 10
    };
  }
}
