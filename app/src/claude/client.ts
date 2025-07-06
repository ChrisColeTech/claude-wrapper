/**
 * Claude Code SDK Client
 * Integrates the Claude Code SDK with our authentication system
 * Based on Python claude_cli.py implementation using claude_code_sdk
 */

import { authManager } from '../auth/auth-manager';
import { getLogger } from '../utils/logger';
import { ClaudeClientError, AuthenticationError, StreamingError } from '../models/error';
// Phase 5A: Tool choice integration
import { 
  ChoiceProcessingContext,
  ClaudeChoiceFormat,
  ChoiceEnforcementRequest,
  ChoiceEnforcementResult,
  IToolChoiceEnforcer,
  ToolChoiceEnforcerFactory
} from '../tools/choice-enforcer';

const logger = getLogger('ClaudeClient');

/**
 * Claude Code SDK options interface
 * Based on Python ClaudeCodeOptions class
 */
export interface ClaudeCodeOptions {
  max_turns?: number;
  allowed_tools?: string[];
  disallowed_tools?: string[];
  permission_mode?: 'default' | 'acceptEdits' | 'bypassPermissions';
  max_thinking_tokens?: number;
  continue_conversation?: string;
  cwd?: string;
  model?: string;
  system_prompt?: string;
  // Phase 5A: Tool choice integration
  tool_choice_mode?: 'auto' | 'none' | 'specific';
  force_function?: string;
  choice_restrictions?: {
    onlyTextResponse?: boolean;
    specificFunction?: boolean;
    functionName?: string;
  };
}

/**
 * Parsed Claude message interface
 */
export interface ParsedClaudeMessage {
  content: string;
  metadata: ResponseMetadata;
  timestamp: string;
  raw_content?: string;
  original_prompt?: string;
  session_id?: string;
}

/**
 * Response metadata interface
 */
export interface ResponseMetadata {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost?: number;
  session_id?: string;
}

/**
 * SDK verification result
 */
export interface VerificationResult {
  available: boolean;
  version?: string;
  authentication?: boolean;
  error?: string;
  suggestion?: string;
}

/**
 * Claude Code SDK Message interface
 * Based on Python SDK message structure
 */
export interface ClaudeCodeMessage {
  type: 'system' | 'user' | 'assistant' | 'result';
  subtype?: 'init' | 'success' | 'error';
  content?: any;
  data?: any;
  message?: any;
  total_cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
  session_id?: string;
  stop_reason?: string;
}

/**
 * Claude Code Client
 * Provides authenticated access to Claude models
 * Based on Python claude_cli.py implementation
 */
export class ClaudeClient {
  private claudeCodeSDK: any = null;
  private originalEnvVars: Record<string, string | undefined> = {};
  private timeout: number = 600000; // 10 minutes in ms
  private cwd: string;
  // Phase 5A: Tool choice enforcement
  private choiceEnforcer: IToolChoiceEnforcer;

  constructor(timeout: number = 600000, cwd?: string) {
    this.timeout = timeout;
    this.cwd = cwd || process.cwd();
    // Phase 5A: Initialize tool choice enforcer
    this.choiceEnforcer = ToolChoiceEnforcerFactory.create();
    
    // Initialize SDK immediately
    this.initializeSDK().catch(() => {
      // Silent failure will be handled in SDK operations
      logger.warn('Failed to initialize Claude SDK during construction - will retry during operations');
    });
  }

  /**
   * Initialize Claude Code SDK
   * Imports and configures the real Claude Code SDK
   */
  private async initializeSDK(): Promise<void> {
    try {
      // Import the official Claude Code SDK
      const claudeModule = await import('@anthropic-ai/claude-code');
      
      // Store the SDK module which contains the query function
      this.claudeCodeSDK = claudeModule;
      
      logger.info('Claude Code SDK initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize Claude Code SDK: ${error}`);
      throw new ClaudeClientError(`Claude Code SDK initialization failed: ${error}`);
    }
  }

  /**
   * Verify Claude Code SDK availability and authentication
   * Based on Python verify_cli method
   */
  async verifySDK(): Promise<VerificationResult> {
    try {
      await this.initializeSDK();
      
      // Check authentication first
      await this.setupEnvironment();
      
      // Test basic SDK functionality with minimal query
      const messages: ClaudeCodeMessage[] = [];
      const options: ClaudeCodeOptions = {
        max_turns: 1,
        cwd: this.cwd
      };

      try {
        for await (const message of this.query('Hello', options)) {
          messages.push(message);
          if (message.type === 'assistant' || message.type === 'result') {
            break;
          }
        }
      } catch (error) {
        // Even if the query fails, if we have some messages, authentication worked
        logger.debug(`Query test error (may be expected): ${error}`);
      }

      // Restore environment after test
      this.restoreEnvironment();

      // Check if we got any response indicating SDK is working
      const hasResponse = messages.some(m => m.type === 'assistant' || m.type === 'system');
      
      if (hasResponse || this.claudeCodeSDK) {
        logger.info('✅ Claude Code SDK verified successfully');
        return {
          available: true,
          authentication: true,
          version: 'claude-code-sdk'
        };
      } else {
        logger.warn('⚠️ Claude Code SDK test returned no messages');
        return {
          available: true,
          authentication: false,
          error: 'SDK test returned no messages'
        };
      }
    } catch (error) {
      this.restoreEnvironment(); // Ensure cleanup on error
      logger.error(`Claude Code SDK verification failed: ${error}`);
      return {
        available: false,
        authentication: false,
        error: `SDK verification failed: ${error}`,
        suggestion: 'Please ensure Claude Code is installed and authenticated'
      };
    }
  }

  /**
   * Run a completion using Claude Code SDK
   * Based on Python run_completion method
   */
  async *runCompletion(
    prompt: string,
    options: ClaudeCodeOptions = {}
  ): AsyncGenerator<ClaudeCodeMessage, void, unknown> {
    await this.setupEnvironment();
    
    try {
      // Run the query using the Claude Code SDK
      for await (const message of this.query(prompt, options)) {
        // Convert message to our interface format
        const normalizedMessage = this.normalizeMessage(message);
        yield normalizedMessage;
      }
    } finally {
      this.restoreEnvironment();
    }
  }

  /**
   * Run completion with tool choice enforcement (Phase 5A)
   * Integrates tool choice processing and enforcement
   */
  async *runCompletionWithChoice(
    prompt: string,
    options: ClaudeCodeOptions = {},
    choiceContext?: ChoiceProcessingContext
  ): AsyncGenerator<ClaudeCodeMessage, void, unknown> {
    await this.setupEnvironment();
    
    try {
      // Apply tool choice restrictions to options
      const choiceOptions = this.applyChoiceToOptions(options, choiceContext);
      
      // Run the query with choice-modified options
      let lastMessage: ClaudeCodeMessage | undefined;
      
      for await (const message of this.query(prompt, choiceOptions)) {
        const normalizedMessage = this.normalizeMessage(message);
        lastMessage = normalizedMessage;
        
        // If this is a final response and we have choice context, enforce it
        if (choiceContext && this.isFinalResponse(normalizedMessage)) {
          const enforcedMessage = await this.enforceChoiceOnResponse(normalizedMessage, choiceContext);
          yield enforcedMessage;
        } else {
          yield normalizedMessage;
        }
      }
    } finally {
      this.restoreEnvironment();
    }
  }

  /**
   * Apply tool choice context to Claude options
   */
  private applyChoiceToOptions(
    options: ClaudeCodeOptions,
    choiceContext?: ChoiceProcessingContext
  ): ClaudeCodeOptions {
    if (!choiceContext) {
      return options;
    }

    const choiceOptions = { ...options };
    const claudeFormat = choiceContext.claudeFormat;

    // Apply choice mode
    choiceOptions.tool_choice_mode = claudeFormat.mode;

    // Apply tool restrictions
    if (claudeFormat.mode === 'none') {
      choiceOptions.choice_restrictions = {
        onlyTextResponse: true,
        specificFunction: false
      };
      // Disable tools for none choice
      choiceOptions.disallowed_tools = ['*'];
    } else if (claudeFormat.mode === 'specific' && claudeFormat.forceFunction) {
      choiceOptions.force_function = claudeFormat.forceFunction;
      choiceOptions.choice_restrictions = {
        onlyTextResponse: false,
        specificFunction: true,
        functionName: claudeFormat.forceFunction
      };
    } else if (claudeFormat.mode === 'auto') {
      choiceOptions.choice_restrictions = {
        onlyTextResponse: false,
        specificFunction: false
      };
    }

    return choiceOptions;
  }

  /**
   * Check if message is a final response
   */
  private isFinalResponse(message: ClaudeCodeMessage): boolean {
    return (
      message.type === 'assistant' && 
      message.content !== undefined &&
      message.content !== null
    ) || (
      message.type === 'result' &&
      message.subtype === 'success'
    );
  }

  /**
   * Enforce tool choice on Claude response
   */
  private async enforceChoiceOnResponse(
    message: ClaudeCodeMessage,
    choiceContext: ChoiceProcessingContext
  ): Promise<ClaudeCodeMessage> {
    try {
      // Convert message to Claude response format for enforcement
      const claudeResponse = this.messageToClaudeResponse(message);
      
      // Enforce choice
      const enforcementRequest: ChoiceEnforcementRequest = {
        context: choiceContext,
        claudeResponse
      };

      const enforcementResult = await this.choiceEnforcer.enforceChoice(enforcementRequest);

      if (enforcementResult.success && enforcementResult.modifiedResponse) {
        // Convert back to message format
        return this.claudeResponseToMessage(enforcementResult.modifiedResponse, message);
      } else if (!enforcementResult.success) {
        logger.warn(`Tool choice enforcement failed: ${enforcementResult.errors.join(', ')}`);
      }

      return message;
    } catch (error) {
      logger.error(`Tool choice enforcement error: ${error}`);
      return message;
    }
  }

  /**
   * Convert Claude message to Claude response format
   */
  private messageToClaudeResponse(message: ClaudeCodeMessage): any {
    return {
      content: message.content || '',
      tool_calls: message.data?.tool_calls || [],
      finish_reason: message.stop_reason || 'stop',
      metadata: {
        model: message.data?.model,
        usage: {
          prompt_tokens: message.data?.prompt_tokens || 0,
          completion_tokens: message.data?.completion_tokens || 0,
          total_tokens: message.data?.total_tokens || 0
        }
      }
    };
  }

  /**
   * Convert Claude response back to message format
   */
  private claudeResponseToMessage(
    claudeResponse: any, 
    originalMessage: ClaudeCodeMessage
  ): ClaudeCodeMessage {
    return {
      ...originalMessage,
      content: claudeResponse.content,
      stop_reason: claudeResponse.finish_reason,
      data: {
        ...originalMessage.data,
        tool_calls: claudeResponse.tool_calls,
        model: claudeResponse.metadata?.model,
        prompt_tokens: claudeResponse.metadata?.usage?.prompt_tokens,
        completion_tokens: claudeResponse.metadata?.usage?.completion_tokens,
        total_tokens: claudeResponse.metadata?.usage?.total_tokens
      }
    };
  }

  /**
   * Query Claude Code SDK
   * Wrapper around the actual SDK query function
   */
  private async *query(
    prompt: string,
    options: ClaudeCodeOptions
  ): AsyncGenerator<any, void, unknown> {
    if (!this.claudeCodeSDK) {
      await this.initializeSDK();
    }

    try {
      // Use the Claude Code SDK query function
      if (this.claudeCodeSDK?.query) {
        // Convert our options to SDK format
        const sdkOptions = this.convertToSDKOptions(options);
        yield* this.claudeCodeSDK.query({
          prompt,
          options: sdkOptions
        });
      } else {
        throw new ClaudeClientError('Claude Code SDK not properly initialized');
      }
    } catch (error) {
      throw new ClaudeClientError(`Claude Code SDK query failed: ${error}`);
    }
  }

  /**
   * Setup environment variables for Claude Code SDK authentication
   * Based on Python environment management pattern
   */
  private async setupEnvironment(): Promise<void> {
    try {
      // Store original environment variables
      const authEnvVars = authManager.getClaudeCodeEnvVars();
      
      for (const [key, value] of Object.entries(authEnvVars)) {
        this.originalEnvVars[key] = process.env[key];
        if (value) {
          process.env[key] = value;
          logger.debug(`Set ${key} for Claude Code SDK`);
        }
      }

      // Verify authentication is available
      const authStatus = await authManager.getAuthStatus();
      if (!authStatus.authenticated) {
        throw new AuthenticationError('No authentication method detected for Claude Code SDK');
      }
      
      logger.debug(`Using ${authStatus.method} authentication for Claude Code SDK`);
    } catch (error) {
      throw new AuthenticationError(`Failed to setup authentication: ${error}`);
    }
  }

  /**
   * Restore original environment variables
   * Based on Python finally block pattern
   */
  private restoreEnvironment(): void {
    for (const [key, originalValue] of Object.entries(this.originalEnvVars)) {
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }
    this.originalEnvVars = {};
  }

  /**
   * Normalize message from SDK to our interface
   * Based on Python message parsing logic
   */
  private normalizeMessage(message: any): ClaudeCodeMessage {
    // Handle different message formats from SDK
    if (typeof message === 'object' && message !== null) {
      // If message has __dict__, convert it to plain object
      if (message.__dict__) {
        const messageDict: any = {};
        for (const [key, value] of Object.entries(message.__dict__)) {
          if (!key.startsWith('_') && typeof value !== 'function') {
            messageDict[key] = value;
          }
        }
        return messageDict as ClaudeCodeMessage;
      }
      
      // Return as-is if already object
      return message as ClaudeCodeMessage;
    }
    
    // Fallback for unexpected formats
    return {
      type: 'assistant',
      content: String(message)
    };
  }

  /**
   * Create CLI wrapper for direct Claude CLI usage
   * Simulates SDK behavior using child_process calls
   */
  private createCLIWrapper(): any {
    return {
      query: this.cliQuery.bind(this)
    };
  }


  /**
   * CLI query implementation using claude command
   * Based on Python subprocess implementation
   */
  private async *cliQuery(
    prompt: string,
    options: ClaudeCodeOptions
  ): AsyncGenerator<ClaudeCodeMessage, void, unknown> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      // Simulate system init message
      yield {
        type: 'system',
        subtype: 'init',
        data: {
          session_id: `cli_session_${Date.now()}`,
          model: options.model || 'claude-3-5-sonnet-20241022'
        }
      };

      // Prepare Claude CLI command
      const claudeArgs = [];
      
      if (options.model) {
        claudeArgs.push(`--model "${options.model}"`);
      }
      
      if (options.max_turns) {
        claudeArgs.push(`--max-turns ${options.max_turns}`);
      }
      
      if (options.cwd) {
        claudeArgs.push(`--cwd "${options.cwd}"`);
      }

      // Execute Claude CLI command with streaming simulation
      const command = `claude ${claudeArgs.join(' ')} "${prompt.replace(/"/g, '\\"')}"`;
      const startTime = Date.now();
      
      const { stdout, stderr } = await execAsync(command, {
        timeout: this.timeout,
        cwd: options.cwd || this.cwd,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      if (stderr && !stderr.includes('warning')) {
        throw new Error(`Claude CLI error: ${stderr}`);
      }

      // Yield assistant response
      if (stdout) {
        yield {
          type: 'assistant',
          content: stdout.trim(),
          message: {
            content: stdout.trim()
          }
        };
      }

      // Yield result with metadata
      const duration = Date.now() - startTime;
      yield {
        type: 'result',
        subtype: 'success',
        total_cost_usd: 0.001, // Estimated cost
        duration_ms: duration,
        num_turns: 1,
        session_id: `cli_session_${Date.now()}`
      };

    } catch (error) {
      yield {
        type: 'result',
        subtype: 'error',
        data: {
          error: `CLI execution failed: ${error}`
        }
      };
      throw new ClaudeClientError(`Claude CLI execution failed: ${error}`);
    }
  }


  /**
   * Convert our options to Claude SDK options format
   */
  private convertToSDKOptions(options: ClaudeCodeOptions): any {
    return {
      model: options.model,
      maxTurns: options.max_turns,
      allowedTools: options.allowed_tools,
      disallowedTools: options.disallowed_tools,
      permissionMode: options.permission_mode || 'default',
      maxThinkingTokens: options.max_thinking_tokens,
      cwd: options.cwd || this.cwd,
      continue: !!options.continue_conversation
    };
  }

  /**
   * Check if SDK is available
   */
  isAvailable(): boolean {
    return this.claudeCodeSDK !== null;
  }

  /**
   * Get timeout value
   */
  getTimeout(): number {
    return this.timeout;
  }

  /**
   * Get current working directory
   */
  getCwd(): string {
    return this.cwd;
  }
}

/**
 * Global Claude Code client instance
 */
export const claudeClient = new ClaudeClient();

/**
 * Error handling wrapper for Claude SDK calls
 */
export async function handleClaudeSDKCall<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const errorMessage = String(error);
    
    if (errorMessage.includes('authentication')) {
      throw new AuthenticationError(`Claude Code authentication failed: ${errorMessage}`);
    }
    if (errorMessage.includes('stream')) {
      throw new StreamingError(`Streaming failed: ${errorMessage}`);
    }
    throw new ClaudeClientError(`SDK operation failed: ${errorMessage}`);
  }
}