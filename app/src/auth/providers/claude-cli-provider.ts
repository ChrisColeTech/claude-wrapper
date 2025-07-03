/**
 * Claude CLI authentication provider
 * Based on Python auth.py ClaudeCliAuth class
 * 
 * Single Responsibility: Handle Claude CLI system authentication
 */

import { IAutoDetectProvider, AuthMethod, AuthValidationResult } from '../interfaces';
import { getLogger } from '../../utils/logger';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);
const logger = getLogger('ClaudeCliProvider');

/**
 * Claude CLI authentication provider
 */
export class ClaudeCliProvider implements IAutoDetectProvider {
  /**
   * Validate Claude CLI authentication configuration
   * Matches Python behavior - assumes CLI is valid by default
   */
  async validate(): Promise<AuthValidationResult> {
    logger.debug('Claude CLI authentication: assuming valid (matches Python behavior)');
    
    // Python approach: assume Claude CLI is functional
    // Let the actual SDK handle authentication during usage
    return {
      valid: true,
      errors: [],
      config: {
        method: 'Claude Code CLI authentication',
        note: 'Using existing Claude Code CLI authentication'
      },
      method: AuthMethod.CLAUDE_CLI
    };
  }

  /**
   * Get authentication method type
   */
  getMethod(): AuthMethod {
    return AuthMethod.CLAUDE_CLI;
  }

  /**
   * Get required environment variables for this provider
   */
  getRequiredEnvVars(): string[] {
    // Claude CLI doesn't require specific environment variables
    return [];
  }

  /**
   * Check if this provider is configured
   */
  isConfigured(): boolean {
    // Always consider configured if CLI might be available
    // Actual validation happens in validate()
    return true;
  }

  /**
   * Detect if this provider should be used based on environment
   */
  canDetect(): boolean {
    // Auto-detect if no other auth methods are available
    // This is typically the fallback option
    return true;
  }

  /**
   * Check if Claude CLI is installed
   */
  private async isClaudeCliInstalled(): Promise<boolean> {
    // Try multiple common paths for Claude CLI
    const cliCommands = [
      'claude --version',
      '/home/risky/.claude/local/claude --version',
      '~/.claude/local/claude --version',
      'npx @anthropic-ai/claude-code --version'
    ];

    for (const cmd of cliCommands) {
      try {
        await execAsync(cmd, { timeout: 5000 });
        logger.debug(`Claude CLI installation verified with: ${cmd}`);
        return true;
      } catch (error) {
        logger.debug(`Claude CLI not found with ${cmd}: ${error}`);
      }
    }
    
    return false;
  }

  /**
   * Check Claude CLI authentication status
   */
   private async checkClaudeCliAuth(): Promise<{
    authenticated: boolean;
    error?: string;
    userInfo?: any;
  }> {
    // Try multiple command variations for Claude CLI
    const testCommands = [
      'claude --print "test"',
      '/home/risky/.claude/local/claude --print "test"',
      '~/.claude/local/claude --print "test"',
      'npx @anthropic-ai/claude-code --print "test"'
    ];

    for (const cmd of testCommands) {
      try {
        // Try a simple Claude CLI command to test authentication
        const { stdout, stderr } = await execAsync(cmd, { 
          timeout: 10000,
          env: { ...process.env, CLAUDE_CLI_NO_INTERACTION: '1' }
        });

        if (stderr && stderr.includes('not authenticated')) {
          continue; // Try next command
        }

        if (stderr && stderr.includes('API key')) {
          continue; // Try next command
        }

        // If we get output without errors, assume authenticated
        if (stdout || (!stderr.includes('error') && !stderr.includes('Error'))) {
          logger.debug(`Claude CLI authentication test passed with: ${cmd}`);
          return {
            authenticated: true,
            userInfo: { test_response: stdout.trim().substring(0, 50), command: cmd }
          };
        }

      } catch (error) {
        const errorStr = String(error);
        
        // Handle common authentication errors
        if (errorStr.includes('not authenticated') || errorStr.includes('API key')) {
          continue; // Try next command
        }

        if (errorStr.includes('timeout')) {
          continue; // Try next command
        }

        logger.debug(`Claude CLI auth check error with ${cmd}: ${error}`);
        continue; // Try next command
      }
    }

    // All commands failed
    return {
      authenticated: false,
      error: 'Claude CLI authentication test failed with all command variations'
    };
  }
}