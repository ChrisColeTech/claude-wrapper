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
import { MockClaudeResolver } from '../../mocks/core/mock-claude-resolver';

const execAsync = promisify(exec);

export class ClaudeCommandExecutor implements IClaudeCommandExecutor {
  private readonly STDIN_THRESHOLD = 50 * 1024; // 50KB
  private readonly mockMode: boolean;
  private readonly mockResolver: MockClaudeResolver;

  constructor(mockMode: boolean = false) {
    this.mockMode = mockMode;
    this.mockResolver = MockClaudeResolver.getInstance();
    logger.debug('ClaudeCommandExecutor initialized', { mockMode });
  }

  async execute(command: string, args: string[]): Promise<string> {
    if (this.mockMode) {
      return this.mockExecute(command, args);
    }
    const prompt = args[0] || '';
    const flags = args.slice(1).join(' ');
    
    if (this.shouldUseStdin(prompt)) {
      return this.executeWithStdin(prompt, command, flags);
    } else {
      return this.executeWithCommandLine(prompt, command, flags);
    }
  }

  async executeStreaming(command: string, args: string[]): Promise<NodeJS.ReadableStream> {
    if (this.mockMode) {
      return this.mockExecuteStreaming(command, args);
    }
    
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

  /**
   * Mock execution for testing - uses enhanced response generator
   */
  private async mockExecute(command: string, args: string[]): Promise<string> {
    const prompt = args[0] || 'test';
    const flags = args.slice(1).join(' ');
    
    logger.debug('Enhanced mock execution triggered', { 
      commandLength: command.length,
      promptLength: prompt.length,
      flags
    });
    
    // Extract model and session ID from flags
    const model = this.extractModelFromFlags(flags) || 'sonnet';
    const sessionId = this.extractSessionIdFromFlags(flags);
    
    try {
      // Use enhanced mock resolver
      const response = await this.mockResolver.executeCommand(prompt, model, sessionId || undefined, false);
      
      // Check if this is an OpenAI request and wrap accordingly
      if (this.isOpenAIRequest(prompt)) {
        return this.wrapAsClaudeResponse(response);
      }
      
      return response;
    } catch (error) {
      logger.error('Enhanced mock execution failed', error as Error);
      return this.generateFallbackResponse(prompt);
    }
  }

  /**
   * Mock streaming execution for testing - uses enhanced response generator
   */
  private async mockExecuteStreaming(command: string, args: string[]): Promise<NodeJS.ReadableStream> {
    const prompt = args[0] || 'test';
    const flags = args.slice(1).join(' ');
    
    logger.debug('Enhanced mock streaming execution triggered', { 
      commandLength: command.length,
      promptLength: prompt.length,
      flags
    });
    
    // Extract model and session ID from flags
    const model = this.extractModelFromFlags(flags) || 'sonnet';
    const sessionId = this.extractSessionIdFromFlags(flags);
    
    try {
      // Use enhanced mock resolver for streaming
      const stream = await this.mockResolver.executeCommandStreaming(prompt, model, sessionId || undefined);
      
      logger.info('Enhanced mock streaming response generated', {
        streamType: 'enhanced',
        model,
        sessionId,
        inputTokens: Math.floor(prompt.length / 4)
      });
      
      return stream;
    } catch (error) {
      logger.error('Enhanced mock streaming execution failed', error as Error);
      return this.generateFallbackStreamingResponse(prompt);
    }
  }



  /**
   * Helper methods for enhanced mock execution
   */
  private extractModelFromFlags(flags: string): string | null {
    const modelMatch = flags.match(/--model\s+(\S+)/);
    return modelMatch ? modelMatch[1] || null : null;
  }

  private extractSessionIdFromFlags(flags: string): string | null {
    const sessionMatch = flags.match(/--resume\s+(\S+)/);
    return sessionMatch ? sessionMatch[1] || null : null;
  }

  private isOpenAIRequest(prompt: string): boolean {
    return prompt.includes('"messages":') || prompt.includes('"model":') || prompt.includes('"tools":');
  }

  private wrapAsClaudeResponse(response: string): string {
    // If response is already JSON, return as-is
    try {
      JSON.parse(response);
      return response;
    } catch {
      // Wrap plain text response in Claude CLI format
      return JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        duration_ms: Math.floor(Math.random() * 20) + 5,
        duration_api_ms: Math.floor(Math.random() * 10) + 2,
        num_turns: 1,
        result: response,
        session_id: `mock-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        total_cost_usd: 0.001,
        usage: {
          input_tokens: Math.floor(response.length * 0.25),
          output_tokens: Math.floor(response.length / 4),
          server_tool_use: { web_search_requests: 0 },
          service_tier: 'standard'
        }
      });
    }
  }

  private generateFallbackResponse(prompt: string): string {
    const response = `Enhanced mock mode fallback response for: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`;
    return this.wrapAsClaudeResponse(response);
  }

  private generateFallbackStreamingResponse(prompt: string): NodeJS.ReadableStream {
    const { Readable } = require('stream');
    const fallbackContent = `Enhanced mock mode fallback streaming response for: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`;
    
    return new Readable({
      read() {
        // Simple streaming fallback
        this.push(fallbackContent);
        this.push(null);
      }
    });
  }
}