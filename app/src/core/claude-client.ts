import { ClaudeRequest, IClaudeClient } from '../types';
import { ClaudeResolver } from './claude-resolver/index';
import { ClaudeCliError } from '../utils/errors';
import { logger } from '../utils/logger';

export class ClaudeClient implements IClaudeClient {
  private static instanceCount = 0;
  private instanceId: string;
  private resolver: ClaudeResolver;

  constructor() {
    this.instanceId = `client-${++ClaudeClient.instanceCount}`;
    this.resolver = ClaudeResolver.getInstance();
    
    logger.debug('ClaudeClient instance created', { 
      instanceId: this.instanceId,
      totalInstances: ClaudeClient.instanceCount 
    });
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
      
      const result = await this.resolver.executeCommand(
        prompt, 
        request.model, 
        sessionId, 
        false
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

  messagesToPrompt(messages: any[], tools?: any[]): string {
    let prompt = '';
    
    // Add tools if provided
    if (tools && tools.length > 0) {
      prompt += `Available tools: ${JSON.stringify(tools)}\n\n`;
    }
    
    for (const message of messages) {
      // Ensure content is properly serialized to string
      const content = typeof message.content === 'string' 
        ? message.content 
        : typeof message.content === 'object'
        ? JSON.stringify(message.content)
        : String(message.content);
      
      // Send raw content without prefixes to save tokens
      if (message.role === 'system') {
        prompt += `${content}\n\n`;
      } else if (message.role === 'user') {
        prompt += `${content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `${content}\n\n`;
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