/**
 * Phase 16A: Minimal message format adapter
 * Server-side tool processing removed - protocol conversion only
 */

import { getLogger } from '../utils/logger';

const logger = getLogger('MessageAdapter');

export interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | { type: 'text'; text: string; }[];
  name?: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class MessageAdapter {
  /**
   * Convert OpenAI messages to Claude format (Phase 16A: tools rejected)
   */
  static convertToClaudeFormat(messages: OpenAIMessage[]): ClaudeMessage[] {
    const claudeMessages: ClaudeMessage[] = [];

    for (const message of messages) {
      // Phase 16A: Reject tool messages with helpful error
      if (message.role === 'tool') {
        logger.warn('Tool message detected - Phase 16A protocol compatibility requires client-side tool execution');
        continue; // Skip tool messages
      }

      if (message.tool_calls && message.tool_calls.length > 0) {
        logger.warn('Tool calls detected - Phase 16A protocol compatibility requires client-side tool execution');
        // Convert tool calls to text description for Claude
        claudeMessages.push({
          role: message.role as 'user' | 'assistant' | 'system',
          content: `${message.content}\n\n[Note: Tool calls have been removed - please execute tools client-side and include results in message content]`
        });
        continue;
      }

      // Standard message conversion
      const content = typeof message.content === 'string' 
        ? message.content 
        : message.content.map(c => c.text).join('');
        
      claudeMessages.push({
        role: message.role as 'user' | 'assistant' | 'system',
        content: content
      });
    }

    return claudeMessages;
  }

  /**
   * Convert Claude response to OpenAI format
   */
  static convertToOpenAIFormat(
    claudeResponse: string,
    model: string
  ): any {
    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: claudeResponse
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };
  }

  /**
   * Convert Claude streaming response to OpenAI format
   */
  static convertStreamingToOpenAIFormat(
    claudeChunk: string,
    model: string,
    isLast: boolean = false
  ): string {
    const chunk = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [{
        index: 0,
        delta: isLast ? {} : { content: claudeChunk },
        finish_reason: isLast ? 'stop' : null
      }]
    };

    return `data: ${JSON.stringify(chunk)}\n\n`;
  }

  // Phase 16A: Compatibility method for existing code
  static convertToClaudePrompt(messages: OpenAIMessage[]): string {
    // Simple prompt conversion for legacy compatibility
    return messages
      .filter(m => m.role !== 'tool') // Skip tool messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');
  }
}

export const messageAdapter = new MessageAdapter();