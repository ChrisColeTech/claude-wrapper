/**
 * Claude Resolver - Main orchestrator following facade pattern
 * Coordinates path detection, caching, and command execution
 */
import { logger } from '../../utils/logger';
import { TempFileManager } from '../../utils/temp-file-manager';
import { ClaudePathCache } from './path-cache';
import { ClaudePathDetector } from './path-detector';
import { ClaudeCommandExecutor } from './command-executor';
import { IClaudeResolver } from './interfaces';
import { EnvironmentManager } from '../../config/env';

export class ClaudeResolver implements IClaudeResolver {
  private static instance: ClaudeResolver | null = null;
  private readonly pathCache: ClaudePathCache;
  private readonly pathDetector: ClaudePathDetector;
  private readonly commandExecutor: ClaudeCommandExecutor;

  private constructor() {
    this.pathCache = ClaudePathCache.getInstance();
    this.pathDetector = new ClaudePathDetector();
    this.commandExecutor = new ClaudeCommandExecutor(EnvironmentManager.isMockMode());
    
    const modeText = EnvironmentManager.isMockMode() ? 'mock mode' : 'normal mode';
    logger.info(`ClaudeResolver initialized as singleton (${modeText})`);
  }

  private async initializePath(): Promise<void> {
    try {
      await this.findClaudeCommand();
      logger.info('Claude CLI ready for requests');
    } catch (error) {
      logger.error('Claude CLI not available at startup', error as Error);
      // Don't throw - let individual requests handle the error
    }
  }

  static getInstance(): ClaudeResolver {
    if (!ClaudeResolver.instance) {
      ClaudeResolver.instance = new ClaudeResolver();
    }
    return ClaudeResolver.instance;
  }

  static async getInstanceAsync(): Promise<ClaudeResolver> {
    if (!ClaudeResolver.instance) {
      ClaudeResolver.instance = new ClaudeResolver();
      await ClaudeResolver.instance.initializePath();
    }
    return ClaudeResolver.instance;
  }

  async findClaudeCommand(): Promise<string> {
    // Check cache first
    const cachedPath = await this.pathCache.get();
    if (cachedPath) {
      logger.debug('Using cached Claude path', { path: cachedPath });
      return cachedPath;
    }

    // Detect path
    logger.info('Claude path not cached, detecting...');
    const detectedPath = await this.pathDetector.detectPath();
    
    // Cache the result
    await this.pathCache.set(detectedPath);
    
    return detectedPath;
  }

  async executeCommand(
    prompt: string, 
    model: string, 
    sessionId?: string | null, 
    isStreaming: boolean = false
  ): Promise<string> {
    const claudeCmd = await this.findClaudeCommand();
    const flags = this.buildCommandFlags(model, sessionId, true, isStreaming);
    const args = [prompt, flags];
    
    return this.commandExecutor.execute(claudeCmd, args);
  }

  async executeCommandStreaming(
    prompt: string, 
    model: string, 
    sessionId?: string | null
  ): Promise<NodeJS.ReadableStream> {
    const claudeCmd = await this.findClaudeCommand();
    const flags = this.buildCommandFlags(model, sessionId, true, true);
    const args = [prompt, flags];
    
    return this.commandExecutor.executeStreaming(claudeCmd, args);
  }

  async executeCommandWithFile(
    prompt: string,
    model: string,
    systemPromptFilePath: string
  ): Promise<string> {
    const claudeCmd = await this.findClaudeCommand();
    const flags = this.buildCommandFlags(model, null, true, false);
    
    // Use cat to pipe file content and prompt together
    const combinedCommand = `cat "${systemPromptFilePath}" | ${claudeCmd} ${flags} -p "${prompt.replace(/"/g, '\\"')}"`;
    
    logger.debug('Executing file-based Claude command', {
      systemPromptFile: systemPromptFilePath,
      promptLength: prompt.length,
      model
    });
    
    return this.commandExecutor.execute(combinedCommand, []);
  }

  async executeCommandWithFileForSession(
    prompt: string,
    model: string,
    systemPromptFilePath: string
  ): Promise<string> {
    const claudeCmd = await this.findClaudeCommand();
    const flags = this.buildCommandFlags(model, null, true, false); // JSON output enabled
    
    // Use cat to pipe file content and prompt together with JSON output for session ID
    const combinedCommand = `cat "${systemPromptFilePath}" | ${claudeCmd} ${flags} -p "${prompt.replace(/"/g, '\\"')}"`;
    
    logger.debug('Executing file-based Claude command for session creation', {
      systemPromptFile: systemPromptFilePath,
      promptLength: prompt.length,
      model
    });
    
    return this.commandExecutor.execute(combinedCommand, []);
  }

  async executeCommandStreamingWithFile(
    prompt: string,
    model: string,
    systemPromptFilePath: string
  ): Promise<NodeJS.ReadableStream> {
    const claudeCmd = await this.findClaudeCommand();
    const flags = this.buildCommandFlags(model, null, true, true);
    
    // Use cat to pipe file content and prompt together for streaming
    const combinedCommand = `cat "${systemPromptFilePath}" | ${claudeCmd} ${flags} -p "${prompt.replace(/"/g, '\\"')}"`;
    
    logger.debug('Executing file-based streaming Claude command', {
      systemPromptFile: systemPromptFilePath,
      promptLength: prompt.length,
      model
    });
    
    // Create a wrapper stream that cleans up the temp file when done
    const originalStream = await this.commandExecutor.executeStreaming(combinedCommand, []);
    
    // Add cleanup handler
    originalStream.on('end', async () => {
      await TempFileManager.cleanupTempFile(systemPromptFilePath);
      logger.debug('Cleaned up system prompt file after streaming', {
        filePath: systemPromptFilePath
      });
    });
    
    originalStream.on('error', async () => {
      await TempFileManager.cleanupTempFile(systemPromptFilePath);
      logger.debug('Cleaned up system prompt file after stream error', {
        filePath: systemPromptFilePath
      });
    });
    
    return originalStream;
  }

  private buildCommandFlags(
    model: string, 
    sessionId?: string | null, 
    useJsonOutput: boolean = true, 
    isStreaming: boolean = false
  ): string {
    let flags = `--model ${model}`;
    
    // Add print flag - required for both streaming and non-streaming
    // According to Claude CLI SDK docs: streaming requires `-p --output-format stream-json`
    // Reference: https://docs.anthropic.com/en/docs/claude-code/sdk
    flags += ` --print`;
    
    // Add session flag if provided (sessionId should be Claude CLI's UUID session ID)
    if (sessionId) {
      flags += ` --resume ${sessionId}`;
    }
    
    // Add JSON output flag if requested
    if (useJsonOutput) {
      if (isStreaming) {
        flags += ` --output-format stream-json --verbose`;
      } else {
        flags += ` --output-format json`;
      }
    }
    
    return flags;
  }

  /**
   * Check if file-based processing is supported by Claude CLI
   */
  async isFileInputSupported(): Promise<boolean> {
    try {
      const claudeCmd = await this.findClaudeCommand();
      // Check if we can use stdin with Claude CLI
      const testOutput = await this.commandExecutor.execute('echo "test" | ' + claudeCmd + ' --help', []);
      return !testOutput.includes('error');
    } catch (error) {
      logger.warn('Unable to determine file input support', error as Error);
      return false;
    }
  }
}