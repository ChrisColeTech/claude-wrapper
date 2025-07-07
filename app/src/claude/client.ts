/**
 * Phase 16A: Minimal Claude Code CLI client
 * Server-side tool execution removed - protocol compatibility only
 */

import { getLogger } from '../utils/logger';

const logger = getLogger('ClaudeClient');

export interface ClaudeClientConfig {
  model?: string;
  debug?: boolean;
  timeout?: number;
  cwd?: string;
}

export interface ClaudeResponse {
  content: string;
  model: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Phase 16A compatibility types (simplified)
export interface ClaudeCodeOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  max_turns?: number;
  cwd?: string;
  system_prompt?: string;
  allowed_tools?: string[];
  disallowed_tools?: string[];
  permission_mode?: string;
  max_thinking_tokens?: number;
}

export interface ClaudeCodeMessage {
  role: string;
  content: string | any[];
  type?: string;
  subtype?: string;
  message?: string;
  data?: any;
  session_id?: string;
  total_cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
  stop_reason?: string;
}

export interface ParsedClaudeMessage {
  content: string;
  role: string;
}

export interface ResponseMetadata {
  model: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface VerificationResult {
  isValid: boolean;
  errors: string[];
}

export class ClaudeClient {
  private config: ClaudeClientConfig;

  constructor(config: ClaudeClientConfig = {}) {
    this.config = config;
  }

  async sendMessage(
    messages: Array<{ role: string; content: string }>,
    options: any = {}
  ): Promise<ClaudeResponse> {
    try {
      // Phase 16A: Direct Claude Code CLI integration without tool execution
      logger.info('Sending message to Claude Code CLI');
      
      // This would integrate with Claude Code CLI for text-only completions
      // Implementation details depend on how Claude Code CLI is invoked
      
      return {
        content: 'Claude Code CLI integration pending - Phase 16A protocol compatibility',
        model: options.model || this.config.model || 'claude-3-5-sonnet-20241022',
        usage: {
          input_tokens: 0,
          output_tokens: 0
        }
      };
    } catch (error) {
      logger.error('Claude client error:', error);
      throw new Error(`Claude client error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async *sendMessageStream(
    messages: Array<{ role: string; content: string }>,
    options: any = {}
  ): AsyncGenerator<ClaudeResponse, void, unknown> {
    try {
      // Phase 16A: Streaming without tool execution
      logger.info('Starting streaming message to Claude Code CLI');
      
      // Placeholder for streaming implementation
      yield {
        content: 'Streaming Claude Code CLI integration pending - Phase 16A protocol compatibility',
        model: options.model || this.config.model || 'claude-3-5-sonnet-20241022'
      };
    } catch (error) {
      logger.error('Claude streaming error:', error);
      throw new Error(`Claude streaming error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Phase 16A: Basic compatibility methods
  isAvailable(): boolean {
    return true; // Simplified - Claude Code CLI availability check
  }

  getTimeout(): number {
    return 30000; // 30 second default timeout
  }

  getCwd(): string {
    return process.cwd();
  }
}

export const claudeClient = new ClaudeClient();