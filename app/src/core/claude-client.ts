import { ClaudeRequest, IClaudeClient } from '../types';
import { ClaudeResolver } from './claude-resolver';
import { ClaudeCliError } from '../utils/errors';
import { logger } from '../utils/logger';

export class ClaudeClient implements IClaudeClient {
  private resolver: ClaudeResolver;

  constructor() {
    this.resolver = new ClaudeResolver();
  }

  async execute(request: ClaudeRequest): Promise<string> {
    return this.executeWithSession(request, null, false);
  }

  async executeWithSession(request: ClaudeRequest, sessionId: string | null, useJsonOutput: boolean): Promise<string> {
    try {
      const prompt = this.messagesToPrompt(request.messages, request.tools);
      logger.debug('Converting messages to prompt', { 
        messageCount: request.messages.length,
        model: request.model,
        hasTools: !!request.tools,
        sessionId,
        useJsonOutput
      });
      
      const result = await this.resolver.executeClaudeCommandWithSession(
        prompt, 
        request.model, 
        sessionId, 
        useJsonOutput
      );
      
      logger.info('Claude execution completed successfully', {
        model: request.model,
        responseLength: result.length,
        sessionId,
        useJsonOutput
      });
      
      return result;
      
    } catch (error) {
      logger.error('Claude CLI execution failed', error as Error, { 
        model: request.model,
        messageCount: request.messages.length,
        sessionId 
      });
      
      if (error instanceof ClaudeCliError) {
        throw error;
      }
      
      throw new ClaudeCliError(
        `Claude CLI execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private messagesToPrompt(messages: any[], tools?: any[]): string {
    let prompt = '';
    
    // Add tools if provided
    if (tools && tools.length > 0) {
      prompt += `Available tools: ${JSON.stringify(tools)}\n\n`;
    }
    
    for (const message of messages) {
      const content = textOf(message.content);

      // Preserve conversation roles when flattening messages for the CLI, tool calls and their results included:
      // without them the model does not see what it already asked and calls the same tool again.
      if (message.role === 'system') {
        prompt += `${content}\n\n`;
      } else if (message.role === 'user') {
        prompt += `User:\n${content}\n\n`;
      } else if (message.role === 'assistant') {
        const calls = Array.isArray(message.tool_calls) && message.tool_calls.length > 0
          ? `Tool calls made:\n${JSON.stringify(message.tool_calls)}\n`
          : '';
        prompt += `Assistant:\n${content ? `${content}\n` : ''}${calls}\n`;
      } else if (message.role === 'tool') {
        prompt += `Tool result (tool_call_id ${message.tool_call_id || 'unknown'}):\n${content}\n\n`;
      }
    }

    logger.debug('Converted messages to prompt', { 
      promptLength: prompt.length,
      messageCount: messages.length,
      toolCount: tools?.length || 0
    });
    
    return prompt;
  }
}

// The text of a message content: a string, the text parts of a multi-part content, nothing for null.
function textOf(content: unknown): string {
  if (content === null || content === undefined) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => (part?.type === 'text' ? String(part.text ?? '') : part?.type ? `[${part.type}]` : ''))
      .filter(Boolean)
      .join('\n');
  }
  return typeof content === 'object' ? JSON.stringify(content) : String(content);
}
