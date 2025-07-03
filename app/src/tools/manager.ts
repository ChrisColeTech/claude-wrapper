/**
 * Tool Management System
 * Based on Python tool control logic from models.py:53 and parameter_validator.py
 * Phase 7A Implementation: Complete tools management with header parsing
 */

import { 
  CLAUDE_CODE_TOOLS, 
  ClaudeCodeTool, 
  PermissionMode, 
  DEFAULT_TOOL_CONFIG,
  TOOL_CATEGORIES,
  TOOL_HEADERS 
} from './constants';
import { getLogger } from '../utils/logger';

const logger = getLogger('ToolManager');

export interface ToolConfiguration {
  disable_tools?: boolean; // Changed: tools enabled by default
  allowed_tools?: ClaudeCodeTool[];
  disallowed_tools?: ClaudeCodeTool[];
  permission_mode?: PermissionMode;
  max_turns?: number;
  tools_enabled?: boolean;
}

export interface ToolRequest {
  tools?: ClaudeCodeTool[];
  disable_tools?: boolean;
  max_turns?: number;
  permission_mode?: PermissionMode;
}

export interface ToolResponse {
  tools: ClaudeCodeTool[];
  tools_enabled: boolean;
  max_turns: number;
  permission_mode: PermissionMode;
  disabled_tools?: ClaudeCodeTool[];
}

/**
 * Tool Manager - Complete implementation for Phase 7A
 * Based on Python models.py:53 enable_tools logic
 */
export class ToolManager {
  /**
   * Configure tools based on request parameters
   * CHANGE: Tools enabled by default (opposite of Python)
   */
  static configureTools(config: ToolConfiguration): ToolResponse {
    logger.debug('Configuring tools', { config });
    
    // If tools are explicitly disabled, return minimal configuration
    if (config.disable_tools === true || config.tools_enabled === false) {
      return {
        tools: [],
        tools_enabled: false,
        max_turns: 1,
        permission_mode: config.permission_mode || 'default',
        disabled_tools: [...CLAUDE_CODE_TOOLS]
      };
    }
    
    // Default: enable all tools for full Claude Code power
    let enabledTools = [...CLAUDE_CODE_TOOLS];
    
    // Apply allowed tools filter
    if (config.allowed_tools && config.allowed_tools.length > 0) {
      enabledTools = enabledTools.filter(tool => 
        config.allowed_tools!.includes(tool)
      );
    }
    
    // Apply disallowed tools filter  
    if (config.disallowed_tools && config.disallowed_tools.length > 0) {
      enabledTools = enabledTools.filter(tool => 
        !config.disallowed_tools!.includes(tool)
      );
    }
    
    const result: ToolResponse = {
      tools: enabledTools,
      tools_enabled: enabledTools.length > 0,
      max_turns: config.max_turns || DEFAULT_TOOL_CONFIG.max_turns,
      permission_mode: config.permission_mode || DEFAULT_TOOL_CONFIG.permission_mode
    };
    
    if (config.disallowed_tools && config.disallowed_tools.length > 0) {
      result.disabled_tools = config.disallowed_tools;
    }
    
    logger.debug('Tool configuration result', { result });
    return result;
  }
  
  /**
   * Parse tool configuration from HTTP headers
   * Based on Python parameter_validator.py:96-137 header parsing
   */
  static parseToolHeaders(headers: Record<string, string>): ToolConfiguration {
    const config: ToolConfiguration = {};
    
    // Parse tools enabled/disabled
    const toolsEnabled = headers[TOOL_HEADERS.TOOLS_ENABLED];
    const toolsDisabled = headers[TOOL_HEADERS.TOOLS_DISABLED];
    
    if (toolsEnabled) {
      config.tools_enabled = toolsEnabled.toLowerCase() === 'true';
    }
    
    if (toolsDisabled) {
      config.disable_tools = toolsDisabled.toLowerCase() === 'true';
    }
    
    // Parse permission mode
    const permissionMode = headers[TOOL_HEADERS.PERMISSION_MODE];
    if (permissionMode && ['default', 'acceptEdits', 'bypassPermissions'].includes(permissionMode)) {
      config.permission_mode = permissionMode as PermissionMode;
    }
    
    // Parse max turns
    const maxTurns = headers[TOOL_HEADERS.MAX_TURNS];
    if (maxTurns) {
      const parsed = parseInt(maxTurns, 10);
      if (!isNaN(parsed) && parsed > 0) {
        config.max_turns = parsed;
      }
    }
    
    // Parse specific tool permissions
    const readPermission = headers[TOOL_HEADERS.READ_PERMISSION];
    const writePermission = headers[TOOL_HEADERS.WRITE_PERMISSION];
    const executePermission = headers[TOOL_HEADERS.EXECUTION_PERMISSION];
    
    if (readPermission || writePermission || executePermission) {
      config.allowed_tools = [];
      
      if (readPermission === 'true') {
        config.allowed_tools.push(...TOOL_CATEGORIES.READ_ONLY);
      }
      
      if (writePermission === 'true') {
        config.allowed_tools.push(...TOOL_CATEGORIES.WRITE_OPERATIONS);
      }
      
      if (executePermission === 'true') {
        config.allowed_tools.push(...TOOL_CATEGORIES.EXECUTION);
      }
      
      // Always include flow control tools
      config.allowed_tools.push(...TOOL_CATEGORIES.FLOW_CONTROL);
      
      // Remove duplicates
      config.allowed_tools = [...new Set(config.allowed_tools)];
    }
    
    logger.debug('Parsed tool headers', { headers, config });
    return config;
  }
  
  /**
   * Get tool statistics for debugging
   */
  static getToolStats(config: ToolResponse): {
    total_tools: number;
    enabled_tools: number;
    disabled_tools: number;
    read_only_tools: number;
    write_tools: number;
    execution_tools: number;
  } {
    const enabledCount = config.tools.length;
    const disabledCount = config.disabled_tools?.length || 0;
    
    return {
      total_tools: CLAUDE_CODE_TOOLS.length,
      enabled_tools: enabledCount,
      disabled_tools: disabledCount,
      read_only_tools: config.tools.filter(tool => 
        (TOOL_CATEGORIES.READ_ONLY as readonly string[]).includes(tool)
      ).length,
      write_tools: config.tools.filter(tool => 
        (TOOL_CATEGORIES.WRITE_OPERATIONS as readonly string[]).includes(tool)
      ).length,
      execution_tools: config.tools.filter(tool => 
        (TOOL_CATEGORIES.EXECUTION as readonly string[]).includes(tool)
      ).length
    };
  }
  
  /**
   * Validate tool configuration
   */
  static validateToolConfig(config: ToolConfiguration): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (config.allowed_tools) {
      for (const tool of config.allowed_tools) {
        if (!CLAUDE_CODE_TOOLS.includes(tool)) {
          errors.push(`Unknown tool: ${tool}`);
        }
      }
    }
    
    if (config.disallowed_tools) {
      for (const tool of config.disallowed_tools) {
        if (!CLAUDE_CODE_TOOLS.includes(tool)) {
          errors.push(`Unknown tool in disallowed list: ${tool}`);
        }
      }
    }
    
    if (config.max_turns !== undefined && (config.max_turns < 1 || config.max_turns > 100)) {
      errors.push('max_turns must be between 1 and 100');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}
