/**
 * Claude Path Detector - Discovers Claude CLI installation
 * Follows Single Responsibility Principle
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../utils/logger';
import { EnvironmentManager } from '../../config/env';
import { ClaudeCliError } from '../../utils/errors';
import { IClaudePathDetector } from './interfaces';

const execAsync = promisify(exec);

export class ClaudePathDetector implements IClaudePathDetector {
  
  async detectPath(): Promise<string> {
    logger.info('Starting Claude CLI path detection');

    // 1. Check environment variables first
    const envPath = await this.checkEnvironmentVariables();
    if (envPath) {
      return envPath;
    }

    // 2. Check config file
    const configPath = await this.checkConfigFile();
    if (configPath) {
      return configPath;
    }

    // 3. Check PATH resolution
    const pathResolved = await this.checkPathResolution();
    if (pathResolved) {
      return pathResolved;
    }

    // 4. Check environment variable fallbacks
    const envFallback = await this.checkEnvironmentFallbacks();
    if (envFallback) {
      return envFallback;
    }

    // 5. Nothing found
    throw new ClaudeCliError(this.getErrorMessage());
  }

  private async checkEnvironmentVariables(): Promise<string | null> {
    const envPath = process.env['CLAUDE_COMMAND'] || process.env['CLAUDE_CLI_PATH'];
    if (envPath) {
      logger.debug('Checking environment variable path', { envPath });
      if (await this.testCommand(envPath)) {
        logger.info('Found Claude via environment variable', { path: envPath });
        return envPath;
      }
    }
    return null;
  }

  private async checkConfigFile(): Promise<string | null> {
    const config = EnvironmentManager.getConfig();
    if (config.claudeCommand) {
      logger.debug('Checking config file path', { command: config.claudeCommand });
      if (await this.testCommand(config.claudeCommand)) {
        logger.info('Found Claude via config file', { path: config.claudeCommand });
        return config.claudeCommand;
      }
    }
    return null;
  }

  private async checkPathResolution(): Promise<string | null> {
    const pathCommands = [
      // Interactive shells (handles aliases)
      'bash -i -c "which claude"',
      'zsh -i -c "which claude"',
      
      // Direct PATH lookups (handles npm global installs)
      'command -v claude',
      'which claude',
      
      // Docker detection
      'docker run --rm anthropic/claude --version',
      'podman run --rm anthropic/claude --version'
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
          const actualPath = this.cleanPath(claudePath, pathCmd);
          if (await this.testCommand(actualPath)) {
            logger.info('Found Claude via PATH resolution', { path: actualPath, original: claudePath });
            return actualPath;
          }
        }
      } catch (error) {
        logger.debug('PATH resolution failed', { command: pathCmd, error });
        continue;
      }
    }
    return null;
  }

  private async checkEnvironmentFallbacks(): Promise<string | null> {
    const envVars = [
      process.env['CLAUDE_COMMAND'],
      process.env['CLAUDE_CLI_PATH'],
      process.env['CLAUDE_DOCKER_IMAGE'] ? `docker run --rm ${process.env['CLAUDE_DOCKER_IMAGE']}` : undefined,
      process.env['DOCKER_CLAUDE_CMD']
    ].filter(Boolean) as string[];

    for (const envPath of envVars) {
      try {
        logger.debug('Trying environment variable fallback', { path: envPath });
        if (await this.testCommand(envPath)) {
          logger.info('Found Claude via environment variable fallback', { path: envPath });
          return envPath;
        }
      } catch (error) {
        logger.debug('Environment fallback failed', { path: envPath, error });
        continue;
      }
    }
    return null;
  }

  private cleanPath(rawPath: string, command: string): string {
    // Clean up shell prompt output
    const cleanedPath = rawPath.replace(/\]633;[^;]*;[^;]*;[^;]*;[^;]*]/g, '').trim();
    
    // Handle Docker commands
    if (command.includes('docker run') || command.includes('podman run')) {
      return command.replace(' --version', '');
    }
    
    // Handle shell alias output
    if (cleanedPath.includes(': aliased to ')) {
      const splitPath = cleanedPath.split(': aliased to ')[1];
      return splitPath ? splitPath.trim() : cleanedPath;
    }
    
    if (cleanedPath.includes('aliased to ')) {
      const splitPath = cleanedPath.split('aliased to ')[1];
      return splitPath ? splitPath.trim() : cleanedPath;
    }
    
    return cleanedPath;
  }

  private async testCommand(command: string): Promise<boolean> {
    try {
      const testCmd = `${command} --version`;
      const { stdout, stderr } = await execAsync(testCmd, { timeout: 3000 });
      const output = (stdout + stderr).toLowerCase();
      
      // Check for Claude CLI indicators
      return output.includes('claude') || 
             output.includes('anthropic') ||
             output.includes('@anthropic-ai');
    } catch (error) {
      logger.debug('Command test failed', { command, error });
      return false;
    }
  }

  private getErrorMessage(): string {
    return 'Claude CLI not found. Please either:\n' +
           '1. Install Claude CLI: npm install -g @anthropic-ai/claude\n' +
           '2. Use Docker: docker pull anthropic/claude\n' +
           '3. Ensure \'claude\' is in your PATH\n' +
           '4. Set CLAUDE_COMMAND environment variable with the correct path\n' +
           '\nSupported detection methods:\n' +
           '- npm global installs (recommended)\n' +
           '- Docker containers (docker run anthropic/claude)\n' +
           '- Shell aliases (bash, zsh)\n' +
           '- Environment variables (CLAUDE_COMMAND, CLAUDE_CLI_PATH, CLAUDE_DOCKER_IMAGE, etc.)';
  }
}