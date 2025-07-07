import { claudeResolver } from './claude-resolver';
import { ClaudeRequest, OpenAIResponse } from './types';

export class ClaudeClient {
  /**
   * Call Claude Code CLI with the request
   */
  async execute(request: ClaudeRequest): Promise<string> {
    try {
      // Convert messages to a single prompt for simplicity
      const prompt = this.messagesToPrompt(request.messages);
      
      // Use the resolver to execute with the correct Claude installation via stdin
      const result = await claudeResolver.executeClaudeCommand(prompt, request.model);
      return result;
      
    } catch (error) {
      throw new Error(`Claude CLI execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert OpenAI messages to a prompt string
   */
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
    return prompt;
  }
}