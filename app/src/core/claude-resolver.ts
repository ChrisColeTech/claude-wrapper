import { exec } from 'child_process';
import { promisify } from 'util';
import { IClaudeResolver } from '../types';
import { ClaudeCliError, TimeoutError } from '../utils/errors';
import { logger } from '../utils/logger';
import { EnvironmentManager } from '../config/env';

const execAsync = promisify(exec);

export class ClaudeResolver implements IClaudeResolver {
  private claudeCommand: string | null = null;

  async findClaudeCommand(): Promise<string> {
    if (this.claudeCommand) {
      return this.claudeCommand;
    }

    const config = EnvironmentManager.getConfig();
    if (config.claudeCommand) {
      logger.debug('Using Claude command from config', { command: config.claudeCommand });
      this.claudeCommand = config.claudeCommand;
      return config.claudeCommand;
    }

    const candidates = [
      'claude',
      'bash -c "claude"',
      '~/.claude/local/claude',
      '/usr/local/bin/claude',
      '/usr/bin/claude',
      '$(npm root -g)/@anthropic-ai/claude-code/bin/claude',
      'npx @anthropic-ai/claude-code'
    ];

    for (const candidate of candidates) {
      try {
        logger.debug('Trying Claude command', { candidate });
        
        const testCommand = candidate.includes('bash -c') 
          ? candidate.replace('"claude"', '"claude --version"')
          : `${candidate} --version`;
          
        const { stdout } = await execAsync(testCommand, { timeout: 5000 });
        
        if (stdout.includes('Claude Code')) {
          logger.info('Found working Claude command', { command: candidate });
          this.claudeCommand = candidate;
          return candidate;
        }
      } catch (error) {
        logger.debug('Claude command failed', { 
          candidate, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        continue;
      }
    }

    throw new ClaudeCliError('Could not find working Claude CLI installation. Please install Claude Code CLI.');
  }

  async executeClaudeCommand(prompt: string, model: string): Promise<string> {
    const claudeCmd = await this.findClaudeCommand();
    const config = EnvironmentManager.getConfig();
    
    const command = claudeCmd.includes('bash -c') 
      ? `echo '${this.escapeShellString(prompt)}' | ${claudeCmd.replace('"claude"', `"claude --print --model ${model}"`)}`
      : `echo '${this.escapeShellString(prompt)}' | ${claudeCmd} --print --model ${model}`;

    logger.debug('Executing Claude command', { model, promptLength: prompt.length });
    
    try {
      const { stdout, stderr } = await execAsync(command, { 
        maxBuffer: 1024 * 1024 * 10,
        timeout: config.timeout
      });
      
      if (stderr && stderr.trim()) {
        logger.warn('Claude CLI warning', { stderr: stderr.trim() });
      }
      
      logger.debug('Claude command completed successfully');
      return stdout.trim();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Claude CLI execution failed', error as Error);
      
      if (errorMessage.includes('timeout')) {
        throw new TimeoutError(`Claude CLI execution timed out after ${config.timeout}ms`);
      }
      
      throw new ClaudeCliError(`Claude CLI execution failed: ${errorMessage}`);
    }
  }

  private escapeShellString(str: string): string {
    return str.replace(/'/g, "'\"'\"'");
  }
}