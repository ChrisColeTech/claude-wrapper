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
    try {
      const prompt = this.messagesToPrompt(request.messages);
      logger.debug('Converting messages to prompt', { 
        messageCount: request.messages.length,
        model: request.model 
      });
      
      const result = await this.resolver.executeClaudeCommand(prompt, request.model);
      logger.info('Claude execution completed successfully', {
        model: request.model,
        responseLength: result.length
      });
      
      return result;
      
    } catch (error) {
      logger.error('Claude CLI execution failed', error as Error, { 
        model: request.model,
        messageCount: request.messages.length 
      });
      
      if (error instanceof ClaudeCliError) {
        throw error;
      }
      
      throw new ClaudeCliError(
        `Claude CLI execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private messagesToPrompt(messages: any[]): string {
    let prompt = '';
    
    for (const message of messages) {
      if (message.role === 'system') {
        prompt += `System: ${message.content}\n\n`;
      } else if (message.role === 'user') {
        prompt += `Human: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n\n`;
      }
    }
    
    prompt += 'Assistant: ';
    
    logger.debug('Converted messages to prompt', { 
      promptLength: prompt.length,
      messageCount: messages.length 
    });
    
    return prompt;
  }
}