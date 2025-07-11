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
  private readonly mockMode: boolean;

  constructor(mockMode: boolean = false) {
    this.mockMode = mockMode;
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
   * Mock execution for testing - returns instant realistic response
   */
  private mockExecute(command: string, args: string[]): Promise<string> {
    const prompt = args[0] || 'test';
    const flags = args.slice(1).join(' ');
    
    logger.debug('Mock execution triggered', { 
      commandLength: command.length,
      promptLength: prompt.length,
      flags
    });
    
    // Generate realistic mock response matching Claude CLI JSON format
    const mockResponse = {
      type: 'result',
      subtype: 'success',
      is_error: false,
      duration_ms: Math.floor(Math.random() * 20) + 5, // 5-25ms
      duration_api_ms: Math.floor(Math.random() * 10) + 2, // 2-12ms
      num_turns: 1,
      result: `Mock response to: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`,
      session_id: `mock-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      total_cost_usd: 0.001,
      usage: {
        input_tokens: Math.floor(prompt.length / 4), // Rough token estimate
        output_tokens: 15 + Math.floor(Math.random() * 10), // 15-25 tokens
        server_tool_use: { web_search_requests: 0 },
        service_tier: 'standard'
      }
    };
    
    logger.info('Mock response generated', {
      responseSize: JSON.stringify(mockResponse).length,
      inputTokens: mockResponse.usage.input_tokens,
      outputTokens: mockResponse.usage.output_tokens
    });
    
    return Promise.resolve(JSON.stringify(mockResponse));
  }

  /**
   * Mock streaming execution for testing - returns instant realistic streaming response
   */
  private mockExecuteStreaming(command: string, args: string[]): Promise<NodeJS.ReadableStream> {
    const prompt = args[0] || 'test';
    const { Readable } = require('stream');
    
    logger.debug('Mock streaming execution triggered', { 
      commandLength: command.length,
      promptLength: prompt.length
    });
    
    const mockStream = new Readable({
      read() {
        // Emit mock streaming JSON events instantly
        const messageId = `mock-msg-${Date.now()}`;
        
        // Message start
        this.push(`{"type":"message_start","message":{"id":"${messageId}","type":"message","role":"assistant","content":[],"model":"claude-3-5-sonnet-20241022","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":${Math.floor(prompt.length / 4)},"output_tokens":0}}}\n`);
        
        // Content block start
        this.push('{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n');
        
        // Content deltas
        const mockWords = ['Mock', 'streaming', 'response', 'for', 'testing', 'purposes.'];
        mockWords.forEach(word => {
          this.push(`{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"${word} "}}\n`);
        });
        
        // Content block stop
        this.push('{"type":"content_block_stop","index":0}\n');
        
        // Message delta
        this.push(`{"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":${mockWords.length + 2}}}\n`);
        
        // Message stop
        this.push('{"type":"message_stop"}\n');
        
        // End stream
        this.push(null);
      }
    });
    
    logger.info('Mock streaming response generated', {
      streamType: 'mock',
      inputTokens: Math.floor(prompt.length / 4)
    });
    
    return Promise.resolve(mockStream);
  }
}