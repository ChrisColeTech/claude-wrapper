/**
 * Claude Command Executor - Handles command execution
 * Follows Single Responsibility Principle
 */
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../utils/logger';
import { EnvironmentManager } from '../../config/env';
import { TempFileManager } from '../../utils/temp-file-manager';
import { ClaudeCliError, TimeoutError } from '../../utils/errors';
import { IClaudeCommandExecutor } from './interfaces';

const execAsync = promisify(exec);

export class ClaudeCommandExecutor implements IClaudeCommandExecutor {
  private readonly STDIN_THRESHOLD = 50 * 1024; // 50KB

  async execute(command: string, args: string[]): Promise<string> {
    const prompt = args[0] || '';
    const flags = args.slice(1).join(' ');
    
    if (this.shouldUseStdin(prompt)) {
      return this.executeWithStdin(prompt, command, flags);
    } else {
      return this.executeWithCommandLine(prompt, command, flags);
    }
  }

  async executeStreaming(command: string, args: string[]): Promise<NodeJS.ReadableStream> {
    const prompt = args[0] || '';
    const flags = args.slice(1).join(' ');
    
    if (this.shouldUseStdin(prompt)) {
      return this.executeWithStdinStreaming(prompt, command, flags);
    } else {
      return this.executeWithCommandLineStreaming(prompt, command, flags);
    }
  }

  private shouldUseStdin(prompt: string): boolean {
    const useStdin = prompt.length > this.STDIN_THRESHOLD;
    logger.debug('Execution strategy decision', {
      promptLength: prompt.length,
      threshold: this.STDIN_THRESHOLD,
      useStdin,
      strategy: useStdin ? 'stdin' : 'command-line'
    });
    return useStdin;
  }

  private async executeWithStdin(prompt: string, claudeCmd: string, flags: string): Promise<string> {
    const config = EnvironmentManager.getConfig();
    let tempFile: string | null = null;
    
    try {
      tempFile = await TempFileManager.createTempFile(prompt);
      const command = this.buildStdinCommand(claudeCmd, flags, tempFile);
      
      logger.debug('Executing Claude command with stdin', { 
        promptLength: prompt.length,
        tempFile,
        isDocker: this.isDockerCommand(claudeCmd)
      });
      
      const { stdout, stderr } = await execAsync(command, { 
        maxBuffer: 1024 * 1024 * 10,
        timeout: config.timeout
      });
      
      if (stderr && stderr.trim()) {
        logger.warn('Claude CLI warning', { stderr: stderr.trim() });
      }
      
      return stdout.trim();
      
    } catch (error) {
      this.handleExecutionError(error, 'stdin', tempFile);
      throw error; // Never reached, but TypeScript needs it
    }
  }

  private async executeWithCommandLine(prompt: string, claudeCmd: string, flags: string): Promise<string> {
    const config = EnvironmentManager.getConfig();
    const command = this.buildCommandLineCommand(claudeCmd, flags, prompt);
    
    logger.debug('Executing Claude command with command line', { 
      promptLength: prompt.length,
      isDocker: this.isDockerCommand(claudeCmd)
    });
    
    try {
      const { stdout, stderr } = await execAsync(command, { 
        maxBuffer: 1024 * 1024 * 10,
        timeout: config.timeout
      });
      
      if (stderr && stderr.trim()) {
        logger.warn('Claude CLI warning', { stderr: stderr.trim() });
      }
      
      return stdout.trim();
      
    } catch (error) {
      this.handleExecutionError(error, 'command-line');
      throw error; // Never reached, but TypeScript needs it
    }
  }

  private async executeWithStdinStreaming(prompt: string, claudeCmd: string, flags: string): Promise<NodeJS.ReadableStream> {
    let tempFile: string | null = null;
    
    try {
      tempFile = await TempFileManager.createTempFile(prompt);
      const command = this.buildStdinCommand(claudeCmd, flags, tempFile);
      
      logger.debug('Executing streaming Claude command with stdin', { command, tempFile });
      
      const process = spawn('bash', ['-c', command], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Handle process errors
      process.on('error', (error) => {
        logger.error('Claude CLI streaming process error (stdin)', error);
      });
      
      process.stderr.on('data', (data) => {
        logger.warn('Claude CLI streaming stderr (stdin)', { stderr: data.toString() });
      });
      
      // Ensure stdout is not buffered
      process.stdout.setEncoding('utf8');
      
      return process.stdout;
      
    } catch (error) {
      logger.error('Claude CLI streaming execution failed (stdin)', error as Error, { tempFile });
      throw new ClaudeCliError(`Claude CLI streaming execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeWithCommandLineStreaming(prompt: string, claudeCmd: string, flags: string): Promise<NodeJS.ReadableStream> {
    try {
      const command = this.buildCommandLineCommand(claudeCmd, flags, prompt);
      
      logger.debug('Executing streaming Claude command (command line)', { command });
      
      const process = spawn('bash', ['-c', command], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Handle process errors
      process.on('error', (error) => {
        logger.error('Claude CLI streaming process error', error);
      });
      
      process.stderr.on('data', (data) => {
        logger.warn('Claude CLI streaming stderr', { stderr: data.toString() });
      });
      
      // Ensure stdout is not buffered
      process.stdout.setEncoding('utf8');
      
      return process.stdout;
      
    } catch (error) {
      logger.error('Claude CLI streaming execution failed (command line)', error as Error);
      throw new ClaudeCliError(`Claude CLI streaming execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildStdinCommand(claudeCmd: string, flags: string, tempFile: string): string {
    if (this.isDockerCommand(claudeCmd)) {
      const dockerCommand = claudeCmd.replace('docker run', `docker run -v "${tempFile}:${tempFile}:ro"`);
      return `cat "${tempFile}" | ${dockerCommand} ${flags}`;
    }
    
    if (claudeCmd.includes('bash -c')) {
      return `cat "${tempFile}" | ${claudeCmd.replace('"claude"', `"claude ${flags}"`)}`;
    }
    
    return `cat "${tempFile}" | ${claudeCmd} ${flags}`;
  }

  private buildCommandLineCommand(claudeCmd: string, flags: string, prompt: string): string {
    const escapedPrompt = this.escapeShellString(prompt);
    
    if (this.isDockerCommand(claudeCmd)) {
      return `echo '${escapedPrompt}' | ${claudeCmd} ${flags}`;
    }
    
    if (claudeCmd.includes('bash -c')) {
      return `echo '${escapedPrompt}' | ${claudeCmd.replace('"claude"', `"claude ${flags}"`)}`;
    }
    
    return `echo '${escapedPrompt}' | ${claudeCmd} ${flags}`;
  }

  private isDockerCommand(command: string): boolean {
    return command.includes('docker run') || command.includes('podman run');
  }

  private escapeShellString(str: string): string {
    return str.replace(/'/g, "'\"'\"'");
  }

  private handleExecutionError(error: any, method: string, tempFile?: string | null): never {
    const config = EnvironmentManager.getConfig();
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const stderr = error.stderr || '';
    const stdout = error.stdout || '';
    const code = error.code || 'unknown';
    
    logger.error(`Claude CLI execution failed (${method})`, error as Error, {
      tempFile,
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