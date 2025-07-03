/**
 * Custom header processing for Claude Code SDK parameters
 * Based on Python parameter_validator.py:96-137 extract_claude_headers
 * Implements Phase 8A header validation requirements
 */

import { getLogger } from '../utils/logger';

const logger = getLogger('HeaderProcessor');

export interface ClaudeHeaders {
  maxTurns?: number;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: string;
  maxThinkingTokens?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Header processor for Claude Code SDK specific parameters
 * Extracts and validates X-Claude-* headers from HTTP requests
 */
export class HeaderProcessor {
  // Valid permission modes for Claude Code SDK
  static readonly VALID_PERMISSION_MODES = new Set([
    'default',
    'acceptEdits', 
    'bypassPermissions'
  ]);

  /**
   * Extract Claude-Code-specific parameters from custom HTTP headers
   * Based on Python extract_claude_headers method
   * 
   * Supported headers:
   * - X-Claude-Max-Turns: 5
   * - X-Claude-Allowed-Tools: tool1,tool2,tool3
   * - X-Claude-Disallowed-Tools: tool1,tool2  
   * - X-Claude-Permission-Mode: acceptEdits
   * - X-Claude-Max-Thinking-Tokens: 10000
   */
  static extractClaudeHeaders(headers: Record<string, string>): ClaudeHeaders {
    const claudeOptions: ClaudeHeaders = {};

    // Normalize header names to lowercase for case-insensitive matching
    const normalizedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      normalizedHeaders[key.toLowerCase()] = value;
    }

    // Extract max_turns
    if ('x-claude-max-turns' in normalizedHeaders) {
      try {
        const maxTurns = parseInt(normalizedHeaders['x-claude-max-turns'], 10);
        if (!isNaN(maxTurns)) {
          claudeOptions.maxTurns = maxTurns;
        } else {
          logger.warning(`Invalid X-Claude-Max-Turns header: ${normalizedHeaders['x-claude-max-turns']}`);
        }
      } catch (error) {
        logger.warning(`Error parsing X-Claude-Max-Turns header: ${normalizedHeaders['x-claude-max-turns']}`);
      }
    }

    // Extract allowed tools
    if ('x-claude-allowed-tools' in normalizedHeaders) {
      const toolsStr = normalizedHeaders['x-claude-allowed-tools'];
      if (toolsStr.trim()) {
        const tools = toolsStr.split(',').map(tool => tool.trim()).filter(tool => tool.length > 0);
        if (tools.length > 0) {
          claudeOptions.allowedTools = tools;
        }
      }
    }

    // Extract disallowed tools
    if ('x-claude-disallowed-tools' in normalizedHeaders) {
      const toolsStr = normalizedHeaders['x-claude-disallowed-tools'];
      if (toolsStr.trim()) {
        const tools = toolsStr.split(',').map(tool => tool.trim()).filter(tool => tool.length > 0);
        if (tools.length > 0) {
          claudeOptions.disallowedTools = tools;
        }
      }
    }

    // Extract permission mode
    if ('x-claude-permission-mode' in normalizedHeaders) {
      const permissionMode = normalizedHeaders['x-claude-permission-mode'];
      if (permissionMode.trim()) {
        claudeOptions.permissionMode = permissionMode.trim();
      }
    }

    // Extract max thinking tokens
    if ('x-claude-max-thinking-tokens' in normalizedHeaders) {
      try {
        const maxThinkingTokens = parseInt(normalizedHeaders['x-claude-max-thinking-tokens'], 10);
        if (!isNaN(maxThinkingTokens)) {
          claudeOptions.maxThinkingTokens = maxThinkingTokens;
        } else {
          logger.warning(`Invalid X-Claude-Max-Thinking-Tokens header: ${normalizedHeaders['x-claude-max-thinking-tokens']}`);
        }
      } catch (error) {
        logger.warning(`Error parsing X-Claude-Max-Thinking-Tokens header: ${normalizedHeaders['x-claude-max-thinking-tokens']}`);
      }
    }

    return claudeOptions;
  }
  
  /**
   * Validate extracted Claude headers
   * Based on Python validation patterns
   */
  static validateHeaders(headers: ClaudeHeaders): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate max_turns
    if (headers.maxTurns !== undefined) {
      if (headers.maxTurns < 1) {
        errors.push('max_turns must be at least 1');
      } else if (headers.maxTurns > 100) {
        warnings.push(`max_turns=${headers.maxTurns} is outside recommended range (1-100)`);
      }
    }

    // Validate tools
    if (headers.allowedTools !== undefined) {
      const toolResult = this.validateTools(headers.allowedTools);
      errors.push(...toolResult.errors);
      warnings.push(...toolResult.warnings);
    }

    if (headers.disallowedTools !== undefined) {
      const toolResult = this.validateTools(headers.disallowedTools);
      errors.push(...toolResult.errors);
      warnings.push(...toolResult.warnings);
    }

    // Check for conflicting tool settings
    if (headers.allowedTools && headers.disallowedTools) {
      const allowed = new Set(headers.allowedTools);
      const disallowed = new Set(headers.disallowedTools);
      const conflicts = [...allowed].filter(tool => disallowed.has(tool));
      if (conflicts.length > 0) {
        errors.push(`Tools cannot be both allowed and disallowed: ${conflicts.join(', ')}`);
      }
    }

    // Validate permission mode
    if (headers.permissionMode !== undefined) {
      if (!this.VALID_PERMISSION_MODES.has(headers.permissionMode)) {
        errors.push(`Invalid permission_mode '${headers.permissionMode}'. Valid options: ${Array.from(this.VALID_PERMISSION_MODES).join(', ')}`);
      }
    }

    // Validate max thinking tokens
    if (headers.maxThinkingTokens !== undefined) {
      if (headers.maxThinkingTokens < 0) {
        errors.push('max_thinking_tokens must be non-negative');
      } else if (headers.maxThinkingTokens > 50000) {
        warnings.push(`max_thinking_tokens=${headers.maxThinkingTokens} is outside recommended range (0-50000)`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate tool names
   * Based on Python validate_tools method
   */
  private static validateTools(tools: string[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(tools)) {
      errors.push('Tools must be provided as an array');
      return { valid: false, errors, warnings };
    }

    if (tools.length === 0) {
      warnings.push('Empty tools array provided');
      return { valid: true, errors, warnings };
    }

    // Validate each tool name
    for (const tool of tools) {
      if (typeof tool !== 'string') {
        errors.push(`Tool name must be a string, got: ${typeof tool}`);
      } else if (!tool.trim()) {
        errors.push('Tool names must be non-empty strings');
      }
    }

    // Check for duplicates
    const uniqueTools = new Set(tools);
    if (uniqueTools.size !== tools.length) {
      warnings.push('Duplicate tool names detected in the list');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Merge Claude headers with existing options
   * Applies header overrides to base options
   */
  static mergeWithOptions(baseOptions: Record<string, any>, headers: ClaudeHeaders): Record<string, any> {
    const merged = { ...baseOptions };

    if (headers.maxTurns !== undefined) {
      merged.max_turns = headers.maxTurns;
    }

    if (headers.allowedTools !== undefined) {
      merged.allowed_tools = headers.allowedTools;
    }

    if (headers.disallowedTools !== undefined) {
      merged.disallowed_tools = headers.disallowedTools;
    }

    if (headers.permissionMode !== undefined) {
      merged.permission_mode = headers.permissionMode;
    }

    if (headers.maxThinkingTokens !== undefined) {
      merged.max_thinking_tokens = headers.maxThinkingTokens;
    }

    return merged;
  }

  /**
   * Check if headers contain any Claude-specific parameters
   */
  static hasClaudeHeaders(headers: Record<string, string>): boolean {
    const claudeHeaderPrefixes = [
      'x-claude-max-turns',
      'x-claude-allowed-tools',
      'x-claude-disallowed-tools', 
      'x-claude-permission-mode',
      'x-claude-max-thinking-tokens'
    ];

    const normalizedKeys = Object.keys(headers).map(key => key.toLowerCase());
    return claudeHeaderPrefixes.some(prefix => 
      normalizedKeys.includes(prefix)
    );
  }
}
