/**
 * Non-streaming response handler service
 * Single Responsibility: Handle non-streaming chat completion responses
 */

import { Response } from 'express';
import { claudeService } from '../claude/service';
import { ChatCompletionRequest, ChatCompletionResponse } from '../models/chat';
import { ClaudeHeaders } from '../validation/headers';
import { ChoiceProcessingContext } from '../tools/choice-processor';
import { getLogger } from '../utils/logger';

const logger = getLogger('NonStreamingHandler');

export interface NonStreamingContext {
  request: ChatCompletionRequest;
  claudeHeaders: ClaudeHeaders;
  prompt: string;
  choiceContext: ChoiceProcessingContext;
  sessionId?: string;
}

export class NonStreamingHandler {
  /**
   * Handle non-streaming response for chat completion
   */
  async handleNonStreamingResponse(
    context: NonStreamingContext,
    res: Response
  ): Promise<void> {
    const { request, claudeHeaders, prompt, choiceContext, sessionId } = context;

    try {
      // Build Claude options with tool choice
      const claudeOptions = this.buildClaudeOptions(request, claudeHeaders, choiceContext);
      
      // Mock Claude response (Claude service integration pending)
      const claudeResponse = {
        content: 'I understand your request and will help you with that.',
        stop_reason: 'end_turn'
      };
      
      // Parse tool calls from response if present
      const { toolCalls, assistantContent } = await this.parseToolCallsFromResponse(
        claudeResponse.content || ''
      );

      // Estimate tokens
      const inputTokens = this.estimateTokens(prompt);
      const outputTokens = this.estimateTokens(assistantContent);

      // Build response
      const response: ChatCompletionResponse = {
        id: this.generateResponseId(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: assistantContent,
            ...(toolCalls.length > 0 && { tool_calls: toolCalls })
          },
          finish_reason: toolCalls.length > 0 ? 'tool_calls' : 'stop'
        }],
        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens
        }
      };

      // Add session ID if present
      if (sessionId) {
        (response as any).session_id = sessionId;
      }

      res.json(response);

    } catch (error) {
      logger.error('Non-streaming error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An error occurred while processing the completion'
      });
    }
  }

  /**
   * Build Claude options with tool choice enforcement
   */
  private buildClaudeOptions(
    request: ChatCompletionRequest,
    claudeHeaders: ClaudeHeaders,
    choiceContext: ChoiceProcessingContext
  ): Record<string, any> {
    const options: Record<string, any> = {
      model: request.model,
      max_tokens: request.max_tokens || 2048,
      temperature: request.temperature ?? 1.0,
      top_p: request.top_p ?? 1.0,
      stream: false
    };

    // Add tool choice enforcement
    if (choiceContext.forcesTextOnly) {
      // Disable tools completely
      options.tools = [];
    } else if (choiceContext.forcesSpecificFunction && choiceContext.functionName) {
      // Enable only specific function
      options.allowed_tools = [choiceContext.functionName];
    }

    // Add headers if present (basic headers only)
    if (claudeHeaders.maxTurns) {
      options.max_turns = claudeHeaders.maxTurns;
    }
    if (claudeHeaders.allowedTools) {
      options.allowed_tools = claudeHeaders.allowedTools;
    }

    return options;
  }

  /**
   * Parse tool calls from Claude response
   */
  private async parseToolCallsFromResponse(rawContent: string): Promise<{
    toolCalls: any[];
    assistantContent: string;
  }> {
    const toolCalls: any[] = [];
    let assistantContent = rawContent;

    // Check for tool usage indicators
    if (this.containsToolUsageIndicators(rawContent)) {
      const parseResult = this.extractToolCallsFromContent(rawContent);
      toolCalls.push(...parseResult.toolCalls);
      assistantContent = parseResult.cleanContent;
    }

    return { toolCalls, assistantContent };
  }

  /**
   * Check if content contains tool usage indicators
   */
  private containsToolUsageIndicators(content: string): boolean {
    const indicators = [
      'I\'ll use the',
      'Let me use',
      'I\'ll help you by using',
      'I need to use',
      'Using the',
      'I\'ll call the'
    ];
    
    return indicators.some(indicator => 
      content.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  /**
   * Extract tool calls from content
   */
  private extractToolCallsFromContent(content: string): {
    toolCalls: any[];
    cleanContent: string;
  } {
    const toolCalls: any[] = [];
    const cleanContent = content;

    // Pattern matching for common tool usage patterns
    const patterns = [
      /I'?ll use the (\w+) tool/gi,
      /Let me use (\w+)/gi,
      /Using the (\w+) (?:tool|function)/gi,
      /I need to (\w+)/gi
    ];

    patterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const toolName = match[1];
        const functionName = this.mapClaudeToolToFunction(toolName);
        
        if (functionName) {
          const toolCall = {
            id: this.generateToolCallId(),
            type: 'function',
            function: {
              name: functionName,
              arguments: this.generateArgumentsFromDescription(content, functionName)
            }
          };
          toolCalls.push(toolCall);
        }
      }
    });

    return { toolCalls, cleanContent };
  }

  /**
   * Map Claude tool names to OpenAI function names
   */
  private mapClaudeToolToFunction(claudeTool: string): string | null {
    const mapping: Record<string, string> = {
      'read': 'read_file',
      'write': 'write_file',
      'list': 'list_directory',
      'search': 'search_files',
      'bash': 'execute_command',
      'command': 'execute_command',
      'terminal': 'execute_command'
    };

    return mapping[claudeTool.toLowerCase()] || null;
  }

  /**
   * Generate arguments from description
   */
  private generateArgumentsFromDescription(description: string, functionName: string): string {
    // Simple argument generation based on function type
    const defaultArgs: Record<string, any> = {
      'read_file': { path: 'file.txt' },
      'write_file': { path: 'file.txt', content: 'content' },
      'list_directory': { path: '.' },
      'search_files': { pattern: 'pattern' },
      'execute_command': { command: 'command' }
    };

    return JSON.stringify(defaultArgs[functionName] || {});
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    // Simple estimation: roughly 4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate unique response ID
   */
  private generateResponseId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `chatcmpl-${timestamp}${random}`;
  }

  /**
   * Generate unique tool call ID
   */
  private generateToolCallId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `call_${timestamp}${random}`;
  }
}

export const nonStreamingHandler = new NonStreamingHandler();