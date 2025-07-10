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
      const prompt = this.messagesToPrompt(request.messages, request.tools);
      logger.info('Executing Claude with prompt', { 
        messageCount: request.messages.length,
        model: request.model,
        hasTools: !!request.tools,
        promptLength: prompt.length,
        promptPreview: prompt.substring(0, 200) + '...'
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

  private messagesToPrompt(messages: any[], tools?: any[]): string {
    let prompt = '';
    
    // Add tools if provided
    if (tools && tools.length > 0) {
      prompt += `Available tools: ${JSON.stringify(tools)}\n\n`;
    }
    
    for (const message of messages) {
      // Ensure content is properly serialized to string
      let content = typeof message.content === 'string' 
        ? message.content 
        : typeof message.content === 'object'
        ? JSON.stringify(message.content)
        : String(message.content);
      
      // Handle cached system prompt references
      if (message.role === 'system' && content.startsWith('[CACHED_SYSTEM_PROMPT:')) {
        const hashMatch = content.match(/\[CACHED_SYSTEM_PROMPT:([a-f0-9]+)\]/);
        if (hashMatch) {
          logger.debug('Skipping cached system prompt', { hash: hashMatch[1] });
          continue; // Skip this message entirely
        }
      }
      
      if (message.role === 'system') {
        prompt += `System: ${content}\n\n`;
      } else if (message.role === 'user') {
        prompt += `Human: ${content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${content}\n\n`;
      }
    }
    
    prompt += 'Assistant: ';
    
    logger.debug('Converted messages to prompt', { 
      promptLength: prompt.length,
      messageCount: messages.length,
      toolCount: tools?.length || 0
    });
    
    return prompt;
  }
}