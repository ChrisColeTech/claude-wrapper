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
   */
  async validate(): Promise<AuthValidationResult> {
    const errors: string[] = [];
    const config: Record<string, any> = {};

    try {
      // Check if Claude CLI is installed
      const cliInstalled = await this.isClaudeCliInstalled();
      config.cli_installed = cliInstalled;

      if (!cliInstalled) {
        errors.push('Claude CLI not installed or not in PATH');
        return {
          valid: false,
          errors,
          config,
          method: AuthMethod.CLAUDE_CLI
        };
      }

      // Check if Claude CLI is authenticated
      const authStatus = await this.checkClaudeCliAuth();
      config.auth_status = authStatus;

      if (!authStatus.authenticated) {
        errors.push(`Claude CLI not authenticated: ${authStatus.error || 'Unknown error'}`);
      } else {
        logger.debug('Claude CLI authentication verified');
        config.user_info = authStatus.userInfo;
      }

    } catch (error) {
      const errorMsg = `Failed to validate Claude CLI: ${error}`;
      errors.push(errorMsg);
      logger.debug(errorMsg);
    }

    const isValid = errors.length === 0;
    
    if (isValid) {
      logger.info('Claude CLI authentication validated successfully');
    } else {
      logger.debug(`Claude CLI validation failed: ${errors.join(', ')}`);
    }

    return {
      valid: isValid,
      errors,
      config,
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
    try {
      await execAsync('claude --version', { timeout: 5000 });
      logger.debug('Claude CLI installation verified');
      return true;
    } catch (error) {
      logger.debug(`Claude CLI not found: ${error}`);
      return false;
    }
  }

  /**
   * Check Claude CLI authentication status
   */
  private async checkClaudeCliAuth(): Promise<{
    authenticated: boolean;
    error?: string;
    userInfo?: any;
  }> {
    try {
      // Try a simple Claude CLI command to test authentication
      const { stdout, stderr } = await execAsync('claude --print "test"', { 
        timeout: 10000,
        env: { ...process.env, CLAUDE_CLI_NO_INTERACTION: '1' }
      });

      if (stderr && stderr.includes('not authenticated')) {
        return {
          authenticated: false,
          error: 'Claude CLI not authenticated'
        };
      }

      if (stderr && stderr.includes('API key')) {
        return {
          authenticated: false,
          error: 'Claude CLI API key not configured'
        };
      }

      // If we get output without errors, assume authenticated
      if (stdout || (!stderr.includes('error') && !stderr.includes('Error'))) {
        logger.debug('Claude CLI authentication test passed');
        return {
          authenticated: true,
          userInfo: { test_response: stdout.trim().substring(0, 50) }
        };
      }

      return {
        authenticated: false,
        error: `Unexpected response: ${stderr}`
      };

    } catch (error) {
      const errorStr = String(error);
      
      // Handle common authentication errors
      if (errorStr.includes('not authenticated') || errorStr.includes('API key')) {
        return {
          authenticated: false,
          error: 'Claude CLI authentication required'
        };
      }

      if (errorStr.includes('timeout')) {
        return {
          authenticated: false,
          error: 'Claude CLI response timeout'
        };
      }

      logger.debug(`Claude CLI auth check error: ${error}`);
      return {
        authenticated: false,
        error: `Command failed: ${errorStr.substring(0, 100)}`
      };
    }
  }
}