/**
 * Claude Code SDK Service
 * High-level service for Claude Code SDK integration
 * Based on Python claude_cli.py ClaudeCodeCLI class
 */

import { ClaudeClient, ClaudeCodeOptions, ClaudeCodeMessage } from './client';
import { ClaudeResponseParser, StreamResponseParser, ParsedClaudeResponse } from './parser';
import { ClaudeMetadataExtractor, ResponseMetadata } from './metadata';
import { MessageAdapter } from '../message/adapter';
import { Message } from '../models/message';
import { ChatCompletionRequest } from '../models/chat';
import { ClaudeClientError, AuthenticationError, StreamingError } from '../models/error';
import { getLogger } from '../utils/logger';

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
  private messageAdapter: MessageAdapter;

  constructor(timeout: number = 600000, cwd?: string) {
    this.client = new ClaudeClient(timeout, cwd);
    this.messageAdapter = new MessageAdapter();
  }

  /**
   * Verify Claude Code SDK is available and authenticated
   */
  async verifySDK(): Promise<{ available: boolean; error?: string }> {
    try {
      const result = await this.client.verifySDK();
      return {
        available: result.available && (result.authentication ?? false),
        error: result.error
      };
    } catch (error) {
      return {
        available: false,
        error: `SDK verification failed: ${error}`
      };
    }
  }

  /**
   * Create a completion using Claude Code SDK
   * Based on Python run_completion method
   */
  async createCompletion(
    messages: Message[],
    options: ClaudeCompletionOptions = {}
  ): Promise<ClaudeCompletionResponse> {
    try {
      // Convert messages to prompt format
      const prompt = this.messageAdapter.convertToClaudePrompt(messages);
      
      // Prepare Claude Code SDK options
      const claudeOptions = this.prepareClaudeOptions(options);

      // Collect all messages from SDK
      const claudeMessages: ClaudeCodeMessage[] = [];
      
      for await (const message of this.client.runCompletion(prompt, claudeOptions)) {
        claudeMessages.push(message);
        
        // Break early if we get a complete assistant response
        if (message.type === 'assistant' && ClaudeResponseParser.isCompleteResponse(claudeMessages)) {
          break;
        }
      }

      // Parse response
      const parsedResponse = ClaudeResponseParser.parseToOpenAIResponse(claudeMessages);
      if (!parsedResponse) {
        throw new ClaudeClientError('No valid response received from Claude Code SDK');
      }

      // Extract metadata
      const metadata = ClaudeMetadataExtractor.extractMetadata(claudeMessages);

      return {
        content: parsedResponse.content,
        role: 'assistant',
        metadata,
        session_id: parsedResponse.session_id,
        stop_reason: parsedResponse.stop_reason
      };

    } catch (error) {
      if (error instanceof ClaudeClientError) {
        throw error;
      }
      throw new ClaudeClientError(`Completion failed: ${error}`);
    }
  }

  /**
   * Create a streaming completion using Claude Code SDK
   */
  async *createStreamingCompletion(
    messages: Message[],
    options: ClaudeCompletionOptions = {}
  ): AsyncGenerator<ClaudeStreamChunk, void, unknown> {
    try {
      // Convert messages to prompt format
      const prompt = this.messageAdapter.convertToClaudePrompt(messages);
      
      // Prepare Claude Code SDK options
      const claudeOptions = this.prepareClaudeOptions(options);

      // Use stream parser to track state
      const streamParser = new StreamResponseParser();
      let lastContent = '';

      for await (const message of this.client.runCompletion(prompt, claudeOptions)) {
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
          const finalResponse = streamParser.getFinalResponse();
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
      if (error instanceof ClaudeClientError) {
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
    if (options.enable_tools === false) {
      claudeOptions.disallowed_tools = ['*']; // Disable all tools
    }

    return claudeOptions;
  }
}

/**
 * Global Claude service instance
 */
export const claudeService = new ClaudeService();