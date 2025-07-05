/**
 * Enhanced Options Helper
 * Helper for creating Claude Code SDK specific options
 * Extracted from validator.ts to reduce file complexity
 */

import { ChatCompletionRequest } from '../models/chat';
import { getLogger } from '../utils/logger';

const logger = getLogger('EnhancedOptionsHelper');

/**
 * Enhanced options helper for Claude Code SDK parameters
 */
export class EnhancedOptionsHelper {
  /**
   * Valid permission modes for Claude Code SDK
   */
  private static readonly VALID_PERMISSION_MODES = new Set([
    'default',
    'acceptEdits', 
    'bypassPermissions'
  ]);

  /**
   * Create enhanced Claude Code SDK options with additional parameters
   * Based on Python ParameterValidator.create_enhanced_options() lines 52-93
   * 
   * This allows API users to pass Claude-Code-specific parameters that don't
   * exist in the OpenAI API through custom headers or environment variables.
   */
  static createEnhancedOptions(
    request: ChatCompletionRequest,
    maxTurns?: number,
    allowedTools?: string[],
    disallowedTools?: string[],
    permissionMode?: string,
    maxThinkingTokens?: number
  ): Record<string, any> {
    // Start with basic options from request (would normally come from request.to_claude_options())
    const options: Record<string, any> = {
      model: request.model,
      messages: request.messages,
      stream: request.stream,
      user: request.user
    };

    // Add Claude Code SDK specific options
    if (maxTurns !== undefined) {
      if (maxTurns < 1 || maxTurns > 100) {
        logger.warn(`max_turns=${maxTurns} is outside recommended range (1-100)`);
      }
      options.max_turns = maxTurns;
    }

    if (allowedTools) {
      if (this.validateTools(allowedTools)) {
        options.allowed_tools = allowedTools;
      }
    }

    if (disallowedTools) {
      if (this.validateTools(disallowedTools)) {
        options.disallowed_tools = disallowedTools;
      }
    }

    if (permissionMode) {
      if (this.validatePermissionMode(permissionMode)) {
        options.permission_mode = permissionMode;
      }
    }

    if (maxThinkingTokens !== undefined) {
      if (maxThinkingTokens < 0 || maxThinkingTokens > 50000) {
        logger.warn(`max_thinking_tokens=${maxThinkingTokens} is outside recommended range (0-50000)`);
      }
      options.max_thinking_tokens = maxThinkingTokens;
    }

    return options;
  }

  /**
   * Validate permission mode parameter
   */
  static validatePermissionMode(permissionMode: string): boolean {
    if (!this.VALID_PERMISSION_MODES.has(permissionMode)) {
      logger.error(`Invalid permission_mode '${permissionMode}'. Valid options: ${Array.from(this.VALID_PERMISSION_MODES).join(', ')}`);
      return false;
    }
    return true;
  }

  /**
   * Validate tool names (basic validation for non-empty strings)
   */
  static validateTools(tools: string[]): boolean {
    if (!tools.every(tool => typeof tool === 'string' && tool.trim().length > 0)) {
      logger.error('All tool names must be non-empty strings');
      return false;
    }
    return true;
  }
}