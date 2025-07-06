/**
 * Tool Management System (Phase 4 Enhanced)
 * Single Responsibility: Tool registry, execution coordination, and lifecycle management
 * 
 * Enhanced for Phase 4 with real tool execution capabilities
 * Based on Python tool control logic from models.py:53 and parameter_validator.py
 */

import { 
  CLAUDE_CODE_TOOLS, 
  ClaudeCodeTool, 
  PermissionMode, 
  CLAUDE_TOOL_CONFIG,
  TOOL_HEADERS 
} from './constants';
import { OpenAITool, OpenAIToolCall, ToolCallProcessingResult } from './types';
import { toolExecutor, IToolExecutor, ToolExecutionResult, ToolFunction } from './tool-executor';
import { toolRegistry } from './registry';
import { getLogger } from '../utils/logger';

const logger = getLogger('ToolManager');

/**
 * Tool execution coordination result
 */
export interface ToolExecutionCoordinationResult {
  success: boolean;
  executedTools: ToolExecutionResult[];
  failedTools: ToolExecutionResult[];
  totalExecutionTimeMs: number;
  errors: string[];
}

/**
 * Tool execution request
 */
export interface ToolExecutionRequest {
  toolCalls: OpenAIToolCall[];
  sessionId?: string;
  requestId?: string;
  workingDirectory?: string;
  allowParallel?: boolean;
}

/**
 * Enhanced tool manager interface
 */
export interface IToolManager {
  // Phase 4: Execution coordination methods
  executeToolCalls(request: ToolExecutionRequest): Promise<ToolExecutionCoordinationResult>;
  registerCustomTool(toolFunction: ToolFunction): Promise<boolean>;
  unregisterCustomTool(name: string): Promise<boolean>;
  getAvailableTools(): Promise<string[]>;
  isToolExecutionEnabled(toolName: string): boolean;
  
  // Tool lifecycle management
  initializeToolRegistry(): Promise<void>;
  shutdownToolRegistry(): Promise<void>;
  getToolExecutionStats(): {
    totalExecuted: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
  };
}

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
 * Enhanced Tool Manager - Phase 4 implementation
 * Single Responsibility: Tool coordination, execution, and lifecycle management
 * Based on Python models.py:53 enable_tools logic with real execution capabilities
 */
export class ToolManager implements IToolManager {
  private executor: IToolExecutor;
  private executionStats = {
    totalExecuted: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalExecutionTime: 0
  };

  constructor(executor: IToolExecutor = toolExecutor) {
    this.executor = executor;
  }
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
      max_turns: config.max_turns || CLAUDE_TOOL_CONFIG.DEFAULT.max_turns,
      permission_mode: config.permission_mode || CLAUDE_TOOL_CONFIG.DEFAULT.permission_mode
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
        config.allowed_tools.push(...CLAUDE_TOOL_CONFIG.CATEGORIES.READ_ONLY);
      }
      
      if (writePermission === 'true') {
        config.allowed_tools.push(...CLAUDE_TOOL_CONFIG.CATEGORIES.WRITE_OPERATIONS);
      }
      
      if (executePermission === 'true') {
        config.allowed_tools.push(...CLAUDE_TOOL_CONFIG.CATEGORIES.EXECUTION);
      }
      
      // Always include flow control tools
      config.allowed_tools.push(...CLAUDE_TOOL_CONFIG.CATEGORIES.FLOW_CONTROL);
      
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
        (CLAUDE_TOOL_CONFIG.CATEGORIES.READ_ONLY as readonly string[]).includes(tool)
      ).length,
      write_tools: config.tools.filter(tool => 
        (CLAUDE_TOOL_CONFIG.CATEGORIES.WRITE_OPERATIONS as readonly string[]).includes(tool)
      ).length,
      execution_tools: config.tools.filter(tool => 
        (CLAUDE_TOOL_CONFIG.CATEGORIES.EXECUTION as readonly string[]).includes(tool)
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

  // Phase 4: Enhanced execution methods
  async executeToolCalls(request: ToolExecutionRequest): Promise<ToolExecutionCoordinationResult> {
    const startTime = performance.now();
    const executedTools: ToolExecutionResult[] = [];
    const failedTools: ToolExecutionResult[] = [];
    const errors: string[] = [];

    try {
      for (const toolCall of request.toolCalls) {
        const result = await this.executor.execute(toolCall.function.name, toolCall.function.arguments);
        
        if (result.success) {
          executedTools.push(result);
          this.executionStats.successfulExecutions++;
        } else {
          failedTools.push(result);
          this.executionStats.failedExecutions++;
          if (result.error) errors.push(result.error);
        }
        
        this.executionStats.totalExecuted++;
        this.executionStats.totalExecutionTime += result.executionTimeMs;
      }

      return {
        success: failedTools.length === 0,
        executedTools,
        failedTools,
        totalExecutionTimeMs: performance.now() - startTime,
        errors
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      
      return {
        success: false,
        executedTools,
        failedTools,
        totalExecutionTimeMs: performance.now() - startTime,
        errors
      };
    }
  }

  async registerCustomTool(toolFunction: ToolFunction): Promise<boolean> {
    return this.executor.registerTool(toolFunction);
  }

  async unregisterCustomTool(name: string): Promise<boolean> {
    return this.executor.unregisterTool(name);
  }

  async getAvailableTools(): Promise<string[]> {
    return this.executor.getAvailableTools();
  }

  isToolExecutionEnabled(toolName: string): boolean {
    // Check if tool is in enabled tools list
    return CLAUDE_CODE_TOOLS.includes(toolName as ClaudeCodeTool);
  }

  async initializeToolRegistry(): Promise<void> {
    // Initialize tool registry if needed
    logger.debug('Tool registry initialized');
  }

  async shutdownToolRegistry(): Promise<void> {
    // Cleanup tool registry if needed
    logger.debug('Tool registry shutdown');
  }

  getToolExecutionStats() {
    const { totalExecuted, successfulExecutions, failedExecutions, totalExecutionTime } = this.executionStats;
    
    return {
      totalExecuted,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime: totalExecuted > 0 ? totalExecutionTime / totalExecuted : 0
    };
  }
}
