/**
 * Tool Validation System
 * Based on Python parameter_validator.py:96-137 tool header validation
 * Phase 7A Implementation: Complete tool validation and header parsing
 */

import { 
  PERMISSION_MODES, 
  ClaudeCodeTool, 
  PermissionMode, 
  CLAUDE_CODE_TOOLS,
  TOOL_HEADERS 
} from './constants';
import { getLogger } from '../utils/logger';

const logger = getLogger('ToolValidator');

export interface ToolValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  validated_tools?: ClaudeCodeTool[];
}

export interface HeaderValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  parsed_config?: any;
}

/**
 * Tool Validator - Complete implementation for Phase 7A
 * Based on Python parameter_validator.py tool validation logic
 */
export class ToolValidator {
  /**
   * Validate tool names against supported Claude Code tools
   * Based on Python tool name validation logic
   */
  static validateToolNames(tools: string[]): ToolValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validatedTools: ClaudeCodeTool[] = [];
    
    if (!Array.isArray(tools)) {
      errors.push('Tools must be provided as an array');
      return { valid: false, errors, warnings };
    }
    
    for (const tool of tools) {
      if (typeof tool !== 'string') {
        errors.push(`Tool name must be a string, got ${typeof tool}`);
        continue;
      }
      
      const trimmedTool = tool.trim();
      if (!trimmedTool) {
        warnings.push('Empty tool name provided, ignoring');
        continue;
      }
      
      if (!CLAUDE_CODE_TOOLS.includes(trimmedTool as ClaudeCodeTool)) {
        errors.push(`Unknown tool: ${trimmedTool}. Supported tools: ${CLAUDE_CODE_TOOLS.join(', ')}`);
        continue;
      }
      
      if (!validatedTools.includes(trimmedTool as ClaudeCodeTool)) {
        validatedTools.push(trimmedTool as ClaudeCodeTool);
      } else {
        warnings.push(`Duplicate tool: ${trimmedTool}`);
      }
    }
    
    logger.debug('Tool name validation result', {
      input: tools,
      validated: validatedTools,
      errors,
      warnings
    });
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      validated_tools: validatedTools
    };
  }
  
  /**
   * Validate permission mode against supported modes
   * Based on Python permission mode validation
   */
  static validatePermissionMode(mode: string): boolean {
    if (typeof mode !== 'string') {
      return false;
    }
    
    return PERMISSION_MODES.includes(mode.trim() as PermissionMode);
  }
  
  /**
   * Parse tool header value (comma-separated tool names)
   * Based on Python header parsing logic
   */
  static parseToolHeader(headerValue: string): ClaudeCodeTool[] {
    if (!headerValue || typeof headerValue !== 'string') {
      return [];
    }
    
    const toolNames = headerValue
      .split(',')
      .map(tool => tool.trim())
      .filter(tool => tool.length > 0);
      
    const validationResult = this.validateToolNames(toolNames);
    
    if (validationResult.valid && validationResult.validated_tools) {
      return validationResult.validated_tools;
    }
    
    logger.warn('Invalid tools found in header', {
      header: headerValue,
      errors: validationResult.errors
    });
    
    return [];
  }
  
  /**
   * Validate all tool-related headers
   * Based on Python parameter_validator.py:96-137 comprehensive header validation
   */
  static validateToolHeaders(headers: Record<string, string>): HeaderValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const config: any = {};
    
    // Validate tools enabled/disabled headers
    const toolsEnabled = headers[TOOL_HEADERS.TOOLS_ENABLED];
    const toolsDisabled = headers[TOOL_HEADERS.TOOLS_DISABLED];
    
    if (toolsEnabled !== undefined) {
      const normalizedEnabled = toolsEnabled.toLowerCase();
      if (!['true', 'false'].includes(normalizedEnabled)) {
        errors.push(`${TOOL_HEADERS.TOOLS_ENABLED} must be 'true' or 'false', got: ${toolsEnabled}`);
      } else {
        config.tools_enabled = normalizedEnabled === 'true';
      }
    }
    
    if (toolsDisabled !== undefined) {
      const normalizedDisabled = toolsDisabled.toLowerCase();
      if (!['true', 'false'].includes(normalizedDisabled)) {
        errors.push(`${TOOL_HEADERS.TOOLS_DISABLED} must be 'true' or 'false', got: ${toolsDisabled}`);
      } else {
        config.disable_tools = normalizedDisabled === 'true';
      }
    }
    
    // Validate conflicting headers
    if (toolsEnabled === 'true' && toolsDisabled === 'true') {
      errors.push('Cannot have both tools enabled and disabled');
    }
    
    // Validate permission mode
    const permissionMode = headers[TOOL_HEADERS.PERMISSION_MODE];
    if (permissionMode !== undefined) {
      if (!this.validatePermissionMode(permissionMode)) {
        errors.push(`Invalid permission mode: ${permissionMode}. Supported: ${PERMISSION_MODES.join(', ')}`);
      } else {
        config.permission_mode = permissionMode.trim();
      }
    }
    
    // Validate max turns
    const maxTurns = headers[TOOL_HEADERS.MAX_TURNS];
    if (maxTurns !== undefined) {
      const parsed = parseInt(maxTurns, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 100) {
        errors.push(`${TOOL_HEADERS.MAX_TURNS} must be a number between 1 and 100, got: ${maxTurns}`);
      } else {
        config.max_turns = parsed;
      }
    }
    
    // Validate permission headers
    const readPermission = headers[TOOL_HEADERS.READ_PERMISSION];
    const writePermission = headers[TOOL_HEADERS.WRITE_PERMISSION];
    const executePermission = headers[TOOL_HEADERS.EXECUTION_PERMISSION];
    
    [
      { header: TOOL_HEADERS.READ_PERMISSION, value: readPermission },
      { header: TOOL_HEADERS.WRITE_PERMISSION, value: writePermission },
      { header: TOOL_HEADERS.EXECUTION_PERMISSION, value: executePermission }
    ].forEach(({ header, value }) => {
      if (value !== undefined) {
        const normalized = value.toLowerCase();
        if (!['true', 'false'].includes(normalized)) {
          errors.push(`${header} must be 'true' or 'false', got: ${value}`);
        }
      }
    });
    
    logger.debug('Tool header validation result', {
      headers,
      config,
      errors,
      warnings
    });
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      parsed_config: config
    };
  }
  
  /**
   * Validate tool security constraints
   * Based on Python security validation logic
   */
  static validateToolSecurity(
    requestedTools: ClaudeCodeTool[], 
    permissionMode: PermissionMode
  ): ToolValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check for dangerous tool combinations in restrictive mode
    if (permissionMode === 'default') {
      const hasWrite = requestedTools.some(tool => 
        ['Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'TodoWrite'].includes(tool)
      );
      const hasExecution = requestedTools.includes('Bash');
      
      if (hasWrite && hasExecution) {
        warnings.push('Both write and execution tools requested - ensure proper security measures');
      }
      
      if (hasExecution && permissionMode === 'default') {
        warnings.push('Bash execution requested in default mode - consider using acceptEdits mode');
      }
    }
    
    // Validate tool dependencies
    if (requestedTools.includes('exit_plan_mode') && requestedTools.length === 1) {
      warnings.push('exit_plan_mode alone may not provide full functionality');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      validated_tools: requestedTools
    };
  }
  
  /**
   * Get comprehensive tool validation report
   */
  static getValidationReport(
    tools: string[],
    headers: Record<string, string>,
    permissionMode: PermissionMode = 'default'
  ): {
    overall_valid: boolean;
    tool_validation: ToolValidationResult;
    header_validation: HeaderValidationResult;
    security_validation: ToolValidationResult;
    all_errors: string[];
    all_warnings: string[];
  } {
    const toolValidation = this.validateToolNames(tools);
    const headerValidation = this.validateToolHeaders(headers);
    const securityValidation = this.validateToolSecurity(
      toolValidation.validated_tools || [],
      permissionMode
    );
    
    const allErrors = [
      ...toolValidation.errors,
      ...headerValidation.errors,
      ...securityValidation.errors
    ];
    
    const allWarnings = [
      ...toolValidation.warnings,
      ...headerValidation.warnings,
      ...securityValidation.warnings
    ];
    
    return {
      overall_valid: allErrors.length === 0,
      tool_validation: toolValidation,
      header_validation: headerValidation,
      security_validation: securityValidation,
      all_errors: allErrors,
      all_warnings: allWarnings
    };
  }
}
