import { exec } from 'child_process';
import { promisify } from 'util';
import { IClaudeResolver } from '../types';
import { ClaudeCliError, TimeoutError } from '../utils/errors';
import { logger } from '../utils/logger';
import { EnvironmentManager } from '../config/env';
import { TempFileManager } from '../utils/temp-file-manager';

const execAsync = promisify(exec);

export class ClaudeResolver implements IClaudeResolver {
  private static instanceCount = 0;
  private instanceId: string;
  private claudeCommand: string | null = null;

  constructor() {
    this.instanceId = `resolver-${++ClaudeResolver.instanceCount}`;
    logger.debug('ClaudeResolver instance created', { 
      instanceId: this.instanceId,
      totalInstances: ClaudeResolver.instanceCount 
    });
  }

  async findClaudeCommand(): Promise<string> {
    logger.debug('Claude path cache check', { 
      instanceId: this.instanceId,
      hasCachedPath: !!this.claudeCommand,
      cachedPath: this.claudeCommand 
    });
    
    if (this.claudeCommand) {
      logger.debug('Using cached Claude path', { 
        instanceId: this.instanceId,
        cachedPath: this.claudeCommand 
      });
      return this.claudeCommand;
    }
    
    logger.debug('Starting Claude path discovery', { 
      instanceId: this.instanceId 
    });

    // Check environment variable override first
    const envPath = process.env['CLAUDE_COMMAND'] || process.env['CLAUDE_CLI_PATH'];
    if (envPath) {
      logger.info('Using Claude path from environment variable', { 
        instanceId: this.instanceId,
        envPath 
      });
      this.claudeCommand = envPath;
      return envPath;
    }
    
    const config = EnvironmentManager.getConfig();
    if (config.claudeCommand) {
      logger.debug('Using Claude command from config', { 
        instanceId: this.instanceId,
        command: config.claudeCommand 
      });
      this.claudeCommand = config.claudeCommand;
      return config.claudeCommand;
    }

    // Try PATH resolution - covers npm global installs, aliases, and Docker
    const pathCommands = [
      // Interactive shells (handles aliases)
      'bash -i -c "which claude"',
      'zsh -i -c "which claude"',
      
      // Direct PATH lookups (handles npm global installs)
      'command -v claude',
      'which claude',
      
      // Docker detection (check if Docker containers are available)
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
          // Clean up shell prompt output that might be mixed in
          const cleanedPath = claudePath.replace(/\]633;[^;]*;[^;]*;[^;]*;[^;]*]/g, '').trim();
          
          // Handle different command types
          let actualPath = cleanedPath;
          logger.debug('Processing Claude path detection', { claudePath: cleanedPath, pathCmd });
          
          // Handle Docker commands
          if (pathCmd.includes('docker run') || pathCmd.includes('podman run')) {
            // For Docker, the full command is the "path"
            actualPath = pathCmd.replace(' --version', '');
            logger.debug('Parsed Docker command', { actualPath });
          }
          // Handle shell alias output
          else if (cleanedPath.includes(': aliased to ')) {
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
            logger.info('Found Claude via PATH resolution', { 
              instanceId: this.instanceId,
              path: actualPath, 
              original: claudePath 
            });
            this.claudeCommand = actualPath;
            logger.debug('Claude path cached', { 
              instanceId: this.instanceId,
              cachedPath: this.claudeCommand 
            });
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
      process.env['CLAUDE_CLI_PATH'],
      process.env['CLAUDE_DOCKER_IMAGE'] ? `docker run --rm ${process.env['CLAUDE_DOCKER_IMAGE']}` : undefined,
      process.env['DOCKER_CLAUDE_CMD']
    ].filter(Boolean) as string[];

    for (const envPath of envVars) {
      try {
        logger.debug('Trying environment variable path', { path: envPath });
        const isWorking = await this.testClaudeCommand(envPath);
        
        if (isWorking) {
          logger.info('Found Claude via environment variable', { 
            instanceId: this.instanceId,
            path: envPath 
          });
          this.claudeCommand = envPath;
          logger.debug('Claude path cached', { 
            instanceId: this.instanceId,
            cachedPath: this.claudeCommand 
          });
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
      '2. Use Docker: docker pull anthropic/claude\n' +
      '3. Ensure \'claude\' is in your PATH\n' +
      '4. Set CLAUDE_COMMAND environment variable with the correct path\n' +
      '\nSupported detection methods:\n' +
      '- npm global installs (recommended)\n' +
      '- Docker containers (docker run anthropic/claude)\n' +
      '- Shell aliases (bash, zsh)\n' +
      '- Environment variables (CLAUDE_COMMAND, CLAUDE_CLI_PATH, CLAUDE_DOCKER_IMAGE, etc.)'
    );
  }

  async executeClaudeCommand(prompt: string, model: string): Promise<string> {
    return this.executeClaudeCommandWithSession(prompt, model, null, false);
  }

  async executeClaudeCommandWithSession(
    prompt: string, 
    model: string, 
    sessionId: string | null, 
    useJsonOutput: boolean
  ): Promise<string> {
    const claudeCmd = await this.findClaudeCommand();
    
    // Build command flags
    const flags = this.buildCommandFlags(model, sessionId, useJsonOutput);
    
    // Strategy selection based on prompt size
    if (this.shouldUseStdin(prompt)) {
      return this.executeWithStdin(prompt, claudeCmd, flags);
    } else {
      return this.executeWithCommandLine(prompt, claudeCmd, flags);
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

  /**
   * Determines if stdin approach should be used based on prompt size
   * Use stdin for prompts > 50KB to avoid command line limits
   */
  private shouldUseStdin(prompt: string): boolean {
    const threshold = 50 * 1024; // 50KB threshold
    const useStdin = prompt.length > threshold;
    
    logger.debug('Execution strategy decision', {
      promptLength: prompt.length,
      threshold,
      useStdin,
      strategy: useStdin ? 'stdin' : 'command-line'
    });
    
    return useStdin;
  }

  /**
   * Builds command flags for Claude CLI
   */
  private buildCommandFlags(model: string, sessionId: string | null, useJsonOutput: boolean): string {
    let flags = `--print --model ${model}`;
    
    // Add session flag if provided
    if (sessionId) {
      flags += ` --resume ${sessionId}`;
    }
    
    // Add JSON output flag if requested
    if (useJsonOutput) {
      flags += ` --output-format json`;
    }
    
    return flags;
  }

  /**
   * Executes Claude command using stdin approach for large prompts
   */
  private async executeWithStdin(
    prompt: string, 
    claudeCmd: string, 
    flags: string
  ): Promise<string> {
    const config = EnvironmentManager.getConfig();
    let tempFile: string | null = null;
    
    try {
      // Create temporary file with prompt content
      tempFile = await TempFileManager.createTempFile(prompt);
      
      let command: string;
      
      // Handle Docker commands
      if (claudeCmd.includes('docker run') || claudeCmd.includes('podman run')) {
        // For Docker, we need to mount the temp file
        const dockerCommand = claudeCmd.replace('docker run', `docker run -v "${tempFile}:${tempFile}:ro"`);
        command = `cat "${tempFile}" | ${dockerCommand} ${flags}`;
      }
      // Handle bash -c wrapped commands
      else if (claudeCmd.includes('bash -c')) {
        command = `cat "${tempFile}" | ${claudeCmd.replace('"claude"', `"claude ${flags}"`)}`;;
      }
      // Handle regular commands
      else {
        command = `cat "${tempFile}" | ${claudeCmd} ${flags}`;
      }
      
      logger.debug('Executing Claude command with stdin', { 
        promptLength: prompt.length,
        tempFile,
        isDocker: claudeCmd.includes('docker') || claudeCmd.includes('podman')
      });
      
      const { stdout, stderr } = await execAsync(command, { 
        maxBuffer: 1024 * 1024 * 10,
        timeout: config.timeout
      });
      
      if (stderr && stderr.trim()) {
        logger.warn('Claude CLI warning', { stderr: stderr.trim() });
      }
      
      logger.debug('Claude command completed successfully via stdin');
      return stdout.trim();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const stderr = (error as any).stderr || '';
      const stdout = (error as any).stdout || '';
      const code = (error as any).code || 'unknown';
      
      logger.error('Claude CLI execution failed (stdin)', error as Error, { 
        tempFile,
        stderr,
        stdout,
        code,
        cwd: process.cwd()
      });
      
      if (errorMessage.includes('timeout')) {
        throw new TimeoutError(`Claude CLI execution timed out after ${config.timeout}ms`);
      }
      
      throw new ClaudeCliError(`Claude CLI execution failed: ${errorMessage}. stderr: ${stderr}. stdout: ${stdout}`);
      
    } finally {
      // Always cleanup temporary file
      if (tempFile) {
        await TempFileManager.cleanupTempFile(tempFile);
      }
    }
  }

  /**
   * Executes Claude command using traditional command line approach
   */
  private async executeWithCommandLine(
    prompt: string, 
    claudeCmd: string, 
    flags: string
  ): Promise<string> {
    const config = EnvironmentManager.getConfig();
    let command: string;
    
    // Handle Docker commands
    if (claudeCmd.includes('docker run') || claudeCmd.includes('podman run')) {
      // For Docker, we need to modify the container command
      const dockerCommand = claudeCmd + ` ${flags}`;
      command = `echo '${this.escapeShellString(prompt)}' | ${dockerCommand}`;
    }
    // Handle bash -c wrapped commands
    else if (claudeCmd.includes('bash -c')) {
      command = `echo '${this.escapeShellString(prompt)}' | ${claudeCmd.replace('"claude"', `"claude ${flags}"`)}`;;
    }
    // Handle regular commands
    else {
      command = `echo '${this.escapeShellString(prompt)}' | ${claudeCmd} ${flags}`;
    }

    logger.debug('Executing Claude command with command line', { 
      promptLength: prompt.length,
      isDocker: claudeCmd.includes('docker') || claudeCmd.includes('podman')
    });
    
    try {
      const { stdout, stderr } = await execAsync(command, { 
        maxBuffer: 1024 * 1024 * 10,
        timeout: config.timeout
      });
      
      if (stderr && stderr.trim()) {
        logger.warn('Claude CLI warning', { stderr: stderr.trim() });
      }
      
      logger.debug('Claude command completed successfully via command line');
      return stdout.trim();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const stderr = (error as any).stderr || '';
      const stdout = (error as any).stdout || '';
      const code = (error as any).code || 'unknown';
      
      logger.error('Claude CLI execution failed (command line)', error as Error, {
        command,
        stderr,
        stdout,
        code,
        cwd: process.cwd(),
        env: {
          PATH: process.env['PATH'],
          HOME: process.env['HOME'],
          USER: process.env['USER']
        }
      });
      
      if (errorMessage.includes('timeout')) {
        throw new TimeoutError(`Claude CLI execution timed out after ${config.timeout}ms`);
      }
      
      throw new ClaudeCliError(`Claude CLI execution failed: ${errorMessage}. stderr: ${stderr}. stdout: ${stdout}`);
    }
  }
}