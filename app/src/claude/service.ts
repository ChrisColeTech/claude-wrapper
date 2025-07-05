/**
 * Claude Code SDK Service
 * High-level service for Claude Code SDK integration
 * Based on Python claude_cli.py ClaudeCodeCLI class
 */

import { ClaudeClient, ClaudeCodeOptions, ClaudeCodeMessage } from './client';
import { ClaudeSDKClient } from './sdk-client';
import { ClaudeResponseParser, StreamResponseParser } from './parser';
import { ClaudeMetadataExtractor, ResponseMetadata } from './metadata';
import { MessageAdapter } from '../message/adapter';
import { Message } from '../models/message';
import { ChatCompletionRequest } from '../models/chat';
import { ClaudeClientError, StreamingError } from '../models/error';
import { ClaudeSDKError, handleClaudeSDKCall } from './error-types';
import { getLogger } from '../utils/logger';
import { modelValidator, ModelValidationError } from '../validation/model-validator';

const logger = getLogger('ClaudeService');

/**
 * Claude completion request options
 */
export interface ClaudeCompletionOptions {
  model?: string;
  max_turns?: number;
  allowed_tools?: string[];
  disallowed_tools?: string[];
  system_prompt?: string;
  enable_tools?: boolean;
  stream?: boolean;
}

/**
 * Claude completion response
 */
export interface ClaudeCompletionResponse {
  content: string;
  role: 'assistant';
  metadata: ResponseMetadata;
  session_id?: string;
  stop_reason?: 'stop' | 'length' | 'content_filter' | null;
}

/**
 * Streaming completion chunk
 */
export interface ClaudeStreamChunk {
  content: string;
  delta?: string;
  finished: boolean;
  metadata?: ResponseMetadata;
}

/**
 * Claude Code SDK Service
 * Provides high-level interface for Claude completions
 */
export class ClaudeService {
  private client: ClaudeClient;
  private sdkClient: ClaudeSDKClient;
  private messageAdapter: MessageAdapter;

  constructor(timeout: number = 600000, cwd?: string) {
    this.client = new ClaudeClient(timeout, cwd);
    this.sdkClient = new ClaudeSDKClient({ timeout, cwd });
    this.messageAdapter = new MessageAdapter();
  }

  /**
   * Verify Claude Code SDK is available and authenticated
   */
  async verifySDK(): Promise<{ available: boolean; error?: string }> {
    return handleClaudeSDKCall(async () => {
      try {
        // Use the new SDK client for verification
        const result = await this.sdkClient.verifySDK();
        logger.info('Claude SDK verification result', { 
          available: result.available, 
          authentication: result.authentication,
          version: result.version 
        });
        
        return {
          available: result.available && (result.authentication ?? false),
          error: result.error
        };
      } catch (error) {
        logger.error('Claude SDK verification error', { error });
        return {
          available: false,
          error: `SDK verification failed: ${error}`
        };
      }
    });
  }

  /**
   * Create a completion using Claude Code SDK
   * Phase 5A: Enhanced with model validation before SDK calls
   */
  async createCompletion(
    messages: Message[],
    options: ClaudeCompletionOptions = {}
  ): Promise<ClaudeCompletionResponse> {
    return handleClaudeSDKCall(async () => {
      try {
        logger.info('Creating Claude completion', { 
          messageCount: messages.length,
          model: options.model,
          maxTurns: options.max_turns 
        });

        // Phase 5A: Validate model before proceeding
        if (options.model) {
          this.validateModelForCompletion(options.model, ['streaming']);
        }

        // Convert messages to prompt format
        const prompt = this.messageAdapter.convertToClaudePrompt(messages);
        
        // Prepare Claude Code SDK options
        const claudeOptions = this.prepareClaudeOptions(options);

        // Use the SDK client instead of the legacy client
        const claudeMessages: ClaudeCodeMessage[] = [];
        
        // Performance tracking for Phase 1A requirement
        const startTime = Date.now();
        
        for await (const message of this.sdkClient.runCompletion(prompt, claudeOptions)) {
          claudeMessages.push(message);
          
          // Break early if we get a complete assistant response
          if (message.type === 'assistant' && ClaudeResponseParser.isCompleteResponse(claudeMessages)) {
            break;
          }
        }

        const responseTime = Date.now() - startTime;
        logger.info('Claude completion response time', { responseTime, messageCount: claudeMessages.length });

        // Parse response
        const parsedResponse = ClaudeResponseParser.parseToOpenAIResponse(claudeMessages);
        if (!parsedResponse) {
          throw new ClaudeSDKError('No valid response received from Claude Code SDK');
        }

        // Extract metadata
        const metadata = ClaudeMetadataExtractor.extractMetadata(claudeMessages);

        const response = {
          content: parsedResponse.content,
          role: 'assistant' as const,
          metadata,
          session_id: parsedResponse.session_id,
          stop_reason: parsedResponse.stop_reason
        };

        logger.info('Claude completion successful', { 
          contentLength: response.content.length,
          responseTime,
          tokenUsage: metadata
        });

        return response;

      } catch (error) {
        logger.error('Claude completion failed', { error });
        if (error instanceof ClaudeSDKError) {
          throw error;
        }
        throw new ClaudeSDKError(`Completion failed: ${error}`);
      }
    });
  }

  /**
   * Create a streaming completion using Claude Code SDK
   * Phase 5A: Enhanced with model validation before SDK calls
   */
  async *createStreamingCompletion(
    messages: Message[],
    options: ClaudeCompletionOptions = {}
  ): AsyncGenerator<ClaudeStreamChunk, void, unknown> {
    try {
      logger.info('Creating Claude streaming completion', { 
        messageCount: messages.length,
        model: options.model 
      });

      // Phase 5A: Validate model before proceeding
      if (options.model) {
        this.validateModelForCompletion(options.model, ['streaming']);
      }

      // Convert messages to prompt format
      const prompt = this.messageAdapter.convertToClaudePrompt(messages);
      
      // Prepare Claude Code SDK options
      const claudeOptions = this.prepareClaudeOptions(options);

      // Use stream parser to track state
      const streamParser = new StreamResponseParser();
      let lastContent = '';

      // Performance tracking for Phase 1A requirement
      const startTime = Date.now();

      for await (const message of this.sdkClient.runCompletion(prompt, claudeOptions)) {
        streamParser.addMessage(message);
        
        // Get current content
        const currentContent = streamParser.getCurrentContent() || '';
        
        // Calculate delta (new content since last chunk)
        const delta = currentContent.slice(lastContent.length);
        
        if (delta) {
          yield {
            content: currentContent,
            delta,
            finished: false
          };
          
          lastContent = currentContent;
        }

        // Check if response is complete
        if (streamParser.isComplete()) {
          const responseTime = Date.now() - startTime;
          logger.info('Claude streaming completion finished', { responseTime });
          
          streamParser.getFinalResponse();
          const metadata = ClaudeMetadataExtractor.extractMetadata(streamParser.getMessages());
          
          yield {
            content: currentContent,
            finished: true,
            metadata
          };
          
          break;
        }
      }

    } catch (error) {
      logger.error('Claude streaming completion failed', { error });
      if (error instanceof ClaudeSDKError) {
        throw error;
      }
      throw new StreamingError(`Streaming completion failed: ${error}`);
    }
  }

  /**
   * Create completion from OpenAI chat completion request
   */
  async createChatCompletion(request: ChatCompletionRequest): Promise<ClaudeCompletionResponse> {
    const options: ClaudeCompletionOptions = {
      model: request.model,
      enable_tools: request.enable_tools,
      stream: request.stream
    };

    if (request.stream) {
      throw new Error('Use createStreamingChatCompletion for streaming requests');
    }

    return this.createCompletion(request.messages, options);
  }

  /**
   * Create streaming completion from OpenAI chat completion request
   */
  async *createStreamingChatCompletion(
    request: ChatCompletionRequest
  ): AsyncGenerator<ClaudeStreamChunk, void, unknown> {
    const options: ClaudeCompletionOptions = {
      model: request.model,
      enable_tools: request.enable_tools,
      stream: true
    };

    yield* this.createStreamingCompletion(request.messages, options);
  }

  /**
   * Parse messages from a completed Claude response
   * Based on Python parse_claude_message
   */
  parseClaudeMessages(messages: ClaudeCodeMessage[]): string | null {
    return ClaudeResponseParser.parseClaudeMessage(messages);
  }

  /**
   * Extract metadata from Claude response
   * Based on Python extract_metadata
   */
  extractMetadata(messages: ClaudeCodeMessage[]): ResponseMetadata {
    return ClaudeMetadataExtractor.extractMetadata(messages);
  }

  /**
   * Check if Claude Code SDK is available
   */
  isSDKAvailable(): boolean {
    return this.client.isAvailable();
  }

  /**
   * Get client timeout
   */
  getTimeout(): number {
    return this.client.getTimeout();
  }

  /**
   * Get current working directory
   */
  getCwd(): string {
    return this.client.getCwd();
  }

  /**
   * Prepare Claude Code SDK options from our options
   */
  private prepareClaudeOptions(options: ClaudeCompletionOptions): ClaudeCodeOptions {
    const claudeOptions: ClaudeCodeOptions = {
      cwd: this.client.getCwd()
    };

    if (options.model) {
      claudeOptions.model = options.model;
    }

    if (options.max_turns !== undefined) {
      claudeOptions.max_turns = options.max_turns;
    }

    if (options.system_prompt) {
      claudeOptions.system_prompt = options.system_prompt;
    }

    if (options.allowed_tools) {
      claudeOptions.allowed_tools = options.allowed_tools;
    }

    if (options.disallowed_tools) {
      claudeOptions.disallowed_tools = options.disallowed_tools;
    }

    // Default tools configuration based on enable_tools flag
    if (options.enable_tools === false && !options.disallowed_tools) {
      claudeOptions.disallowed_tools = ['*']; // Disable all tools
    }

    return claudeOptions;
  }

  /**
   * Validate model for completion with specific feature requirements
   * Phase 5A: Enhanced model validation before SDK calls
   */
  private validateModelForCompletion(model: string, requiredFeatures: string[] = []): void {
    try {
      // Strict validation - will throw if model is invalid
      modelValidator.validateModelStrict(model);
      
      // Check feature compatibility if features are specified
      if (requiredFeatures.length > 0) {
        const compatibilityResult = modelValidator.validateModelCompatibility(model, requiredFeatures);
        if (!compatibilityResult.valid) {
          const featureErrors = compatibilityResult.errors.join('; ');
          logger.error(`Model compatibility validation failed for '${model}': ${featureErrors}`);
          throw new ModelValidationError(
            `Model '${model}' does not support required features: ${featureErrors}`,
            'MODEL_CAPABILITY_MISMATCH',
            compatibilityResult.suggestions?.map(s => s.suggested_model) || [],
            compatibilityResult.alternative_models
          );
        }
        
        // Log warnings if any
        if (compatibilityResult.warnings.length > 0) {
          logger.warn(`Model compatibility warnings for '${model}': ${compatibilityResult.warnings.join('; ')}`);
        }
      }
      
      logger.debug(`Model validation passed for '${model}'`);
    } catch (error) {
      if (error instanceof ModelValidationError) {
        throw new ClaudeSDKError(`Model validation failed: ${error.message}`);
      }
      throw new ClaudeSDKError(`Model validation error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Global Claude service instance
 */
export const claudeService = new ClaudeService();