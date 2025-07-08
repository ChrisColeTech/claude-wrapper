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

    // Try PATH resolution - covers npm global installs and aliases
    const pathCommands = [
      // Interactive shells (handles aliases)
      'bash -i -c "which claude"',
      'zsh -i -c "which claude"',
      
      // Direct PATH lookups (handles npm global installs)
      'command -v claude',
      'which claude'
    ];
    
    // Windows-specific commands
    if (process.platform === 'win32') {
      pathCommands.push(
        'where claude',
        'powershell -c "Get-Command claude -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source"'
      );
    }

    for (const pathCmd of pathCommands) {
      try {
        logger.debug('Trying PATH resolution', { command: pathCmd });
        const { stdout } = await execAsync(pathCmd, { timeout: 2000 });
        const claudePath = stdout.trim();
        
        if (claudePath && !claudePath.includes('not found')) {
          // Clean up shell prompt output that might be mixed in
          const cleanedPath = claudePath.replace(/\]633;[^;]*;[^;]*;[^;]*;[^;]*]/g, '').trim();
          
          // Handle shell alias output
          let actualPath = cleanedPath;
          logger.debug('Processing Claude path detection', { claudePath: cleanedPath, pathCmd });
          
          if (cleanedPath.includes(': aliased to ')) {
            const splitPath = cleanedPath.split(': aliased to ')[1];
            actualPath = splitPath ? splitPath.trim() : cleanedPath;
            logger.debug('Parsed alias', { actualPath });
          } else if (cleanedPath.includes('aliased to ')) {
            const splitPath = cleanedPath.split('aliased to ')[1];
            actualPath = splitPath ? splitPath.trim() : cleanedPath;
            logger.debug('Parsed alias', { actualPath });
          } else {
            logger.debug('Using path as-is', { actualPath });
          }
          // Verify it works
          const testResult = await this.testClaudeCommand(actualPath);
          if (testResult) {
            logger.info('Found Claude via PATH resolution', { path: actualPath, original: claudePath });
            this.claudeCommand = actualPath;
            return actualPath;
          }
        }
      } catch (error) {
        logger.debug('PATH resolution failed', { command: pathCmd, error });
        continue;
      }
    }


    // Try environment variables as fallback
    const envVars = [
      process.env['CLAUDE_COMMAND'],
      process.env['CLAUDE_CLI_PATH']
    ].filter(Boolean) as string[];

    for (const envPath of envVars) {
      try {
        logger.debug('Trying environment variable path', { path: envPath });
        const isWorking = await this.testClaudeCommand(envPath);
        
        if (isWorking) {
          logger.info('Found Claude via environment variable', { path: envPath });
          this.claudeCommand = envPath;
          return envPath;
        }
      } catch (error) {
        logger.debug('Environment path failed', { 
          path: envPath, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        continue;
      }
    }


    // No more guessing - fail clearly if not found
    throw new ClaudeCliError(
      'Claude CLI not found. Please either:\n' +
      '1. Install Claude CLI: npm install -g @anthropic-ai/claude\n' +
      '2. Ensure \'claude\' is in your PATH\n' +
      '3. Set CLAUDE_COMMAND environment variable with the correct path\n' +
      '\nSupported detection methods:\n' +
      '- npm global installs (recommended)\n' +
      '- Shell aliases (bash, zsh)\n' +
      '- Environment variables (CLAUDE_COMMAND, CLAUDE_CLI_PATH, etc.)'
    );
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

  private async testClaudeCommand(command: string): Promise<boolean> {
    try {
      const testCmd = `${command} --version`;
      const { stdout, stderr } = await execAsync(testCmd, { timeout: 3000 });
      const output = (stdout + stderr).toLowerCase();
      
      // Check for Claude CLI indicators
      return output.includes('claude') || 
             output.includes('anthropic') ||
             output.includes('@anthropic-ai');
    } catch (error) {
      logger.debug('Command test failed', { 
        command, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  private escapeShellString(str: string): string {
    return str.replace(/'/g, "'\"'\"'");
  }
}