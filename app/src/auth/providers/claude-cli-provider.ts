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
 * Execute a command through shell with proper environment handling
 */
interface ShellExecOptions {
  timeout?: number;
  env?: NodeJS.ProcessEnv;
}

/**
 * Command execution result
 */
interface CommandResult {
  stdout: string;
  stderr: string;
  success: boolean;
  error?: Error;
}

/**
 * Claude CLI authentication provider
 */
export class ClaudeCliProvider implements IAutoDetectProvider {
  /**
   * Execute a command through shell with proper alias resolution
   * Uses bash shell to ensure aliases and shell functions work
   */
  private async executeShellCommand(command: string, options: ShellExecOptions = {}): Promise<CommandResult> {
    const mergedEnv = { ...process.env, CLAUDE_CLI_NO_INTERACTION: '1', ...(options.env || {}) };
    const defaultOptions = {
      timeout: 10000,
      ...options,
      env: mergedEnv
    };

    try {
      // Use bash shell with proper sourcing of profile files to resolve aliases
      const shellCommand = `bash -c 'source ~/.bashrc 2>/dev/null; source ~/.bash_profile 2>/dev/null; ${command}'`;
      
      const { stdout, stderr } = await execAsync(shellCommand, {
        timeout: defaultOptions.timeout,
        env: defaultOptions.env
      });

      return {
        stdout: stdout || '',
        stderr: stderr || '',
        success: true
      };
    } catch (error) {
      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Get candidate commands for Claude CLI
   * Prioritizes shell alias, then common installation paths
   */
  private getClaudeCommands(): string[] {
    return [
      'claude',  // Shell alias - try first
      '~/.claude/local/claude',
      'npx @anthropic-ai/claude-code'
    ];
  }

  /**
   * Validate Claude CLI authentication configuration
   * Matches Python behavior - assumes CLI is valid by default
   */
  async validate(): Promise<AuthValidationResult> {
    logger.debug('Claude CLI authentication: validating CLI installation and auth');
    
    try {
      // Check if Claude CLI is installed
      const isInstalled = await this.isClaudeCliInstalled();
      if (!isInstalled) {
        return {
          valid: false,
          errors: ['Claude CLI not found in system PATH'],
          config: {},
          method: AuthMethod.CLAUDE_CLI
        };
      }

      // Check authentication status
      const authCheck = await this.checkClaudeCliAuth();
      if (!authCheck.authenticated) {
        return {
          valid: false,
          errors: [authCheck.error || 'Claude CLI authentication failed'],
          config: {},
          method: AuthMethod.CLAUDE_CLI
        };
      }

      // If we get here, validation passed
      return {
        valid: true,
        errors: [],
        config: {
          method: 'Claude Code CLI authentication',
          note: 'Using existing Claude Code CLI authentication',
          userInfo: authCheck.userInfo
        },
        method: AuthMethod.CLAUDE_CLI
      };

    } catch (error) {
      logger.error('Claude CLI validation error:', error);
      return {
        valid: false,
        errors: [`Claude CLI validation failed: ${error}`],
        config: {},
        method: AuthMethod.CLAUDE_CLI
      };
    }
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
    const commands = this.getClaudeCommands();

    for (const baseCommand of commands) {
      const versionCommand = `${baseCommand} --version`;
      
      try {
        const result = await this.executeShellCommand(versionCommand, { timeout: 5000 });
        
        if (result.success) {
          logger.debug(`Claude CLI installation verified with: ${baseCommand}`);
          return true;
        }
        
        logger.debug(`Claude CLI not found with ${baseCommand}: ${result.stderr}`);
      } catch (error) {
        logger.debug(`Claude CLI check failed for ${baseCommand}: ${error}`);
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
    const commands = this.getClaudeCommands();

    for (const baseCommand of commands) {
      const testCommand = `${baseCommand} --print "test"`;
      
      try {
        const result = await this.executeShellCommand(testCommand, { timeout: 10000 });
        
        // Check for authentication errors in stderr
        if (this.isAuthenticationError(result.stderr)) {
          logger.debug(`Authentication error with ${baseCommand}: ${result.stderr}`);
          continue; // Try next command
        }

        // Check for successful authentication
        if (this.isValidResponse(result)) {
          logger.debug(`Claude CLI authentication test passed with: ${baseCommand}`);
          return {
            authenticated: true,
            userInfo: { 
              test_response: result.stdout.trim().substring(0, 50), 
              command: baseCommand 
            }
          };
        }

        logger.debug(`Claude CLI auth check failed for ${baseCommand}: ${result.stderr}`);
      } catch (error) {
        logger.debug(`Claude CLI auth check error with ${baseCommand}: ${error}`);
        continue; // Try next command
      }
    }

    // All commands failed
    return {
      authenticated: false,
      error: 'Claude CLI authentication test failed with all command variations'
    };
  }

  /**
   * Check if response indicates authentication error
   */
  private isAuthenticationError(stderr: string): boolean {
    const authErrors = [
      'not authenticated',
      'api key',
      'authentication failed',
      'authentication required',
      'login required',
      'unauthorized'
    ];
    
    const lowerStderr = stderr.toLowerCase();
    return authErrors.some(error => lowerStderr.includes(error));
  }

  /**
   * Check if response indicates valid Claude CLI execution
   */
  private isValidResponse(result: CommandResult): boolean {
    // Consider response valid if:
    // 1. Command succeeded, OR
    // 2. Got stdout output, OR
    // 3. Only warnings/non-critical errors in stderr
    return result.success || 
           (typeof result.stdout === 'string' && result.stdout.trim().length > 0) ||
           (!this.isAuthenticationError(result.stderr) && 
            !result.stderr.toLowerCase().includes('not found') && 
            !result.stderr.toLowerCase().includes('timeout'));
  }
}