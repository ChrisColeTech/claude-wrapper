/**
 * Streaming response handler service
 * Single Responsibility: Handle streaming chat completion responses
 */

import { Response } from 'express';
import { claudeService } from '../claude/service';
import { ChatCompletionRequest } from '../models/chat';
import { ClaudeHeaders } from '../validation/headers';
import { getLogger } from '../utils/logger';

const logger = getLogger('StreamingHandler');

export interface StreamingContext {
  request: ChatCompletionRequest;
  claudeHeaders: ClaudeHeaders;
  prompt: string;
  sessionId?: string;
}

export class StreamingHandler {
  /**
   * Handle streaming response for chat completion
   */
  async handleStreamingResponse(
    context: StreamingContext,
    res: Response
  ): Promise<void> {
    const { request, claudeHeaders, prompt, sessionId } = context;

    // Set streaming headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    const responseId = this.generateResponseId();
    const created = Math.floor(Date.now() / 1000);

    try {
      // Build Claude options
      const claudeOptions = this.buildClaudeOptions(request, claudeHeaders);
      
      // Stream mock response (Claude service integration pending)
      const mockContent = 'I understand your request and will help you with that.';
      
      // Send chunks
      for (let i = 0; i < mockContent.length; i += 5) {
        const chunk = mockContent.slice(i, i + 5);
        this.sendStreamChunk(res, {
          id: responseId,
          created,
          model: request.model,
          content: chunk,
          isComplete: false,
          sessionId
        });
        
        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Send final chunk
      this.sendStreamChunk(res, {
        id: responseId,
        created,
        model: request.model,
        content: '',
        isComplete: true,
        sessionId
      });

      // Send completion
      this.sendStreamCompletion(res);

    } catch (error) {
      logger.error('Streaming error:', error);
      this.sendStreamError(res, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Send streaming chunk
   */
  private sendStreamChunk(res: Response, data: {
    id: string;
    created: number;
    model: string;
    content: string;
    isComplete: boolean;
    sessionId?: string;
  }): void {
    const chunk = {
      id: data.id,
      object: 'chat.completion.chunk',
      created: data.created,
      model: data.model,
      choices: [{
        index: 0,
        delta: data.isComplete ? {} : { content: data.content },
        finish_reason: data.isComplete ? 'stop' : null
      }]
    };

    if (data.sessionId) {
      (chunk as any).session_id = data.sessionId;
    }

    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }

  /**
   * Send stream completion
   */
  private sendStreamCompletion(res: Response): void {
    res.write('data: [DONE]\n\n');
    res.end();
  }

  /**
   * Send stream error
   */
  private sendStreamError(res: Response, error: string): void {
    const errorChunk = {
      error: {
        message: error,
        type: 'server_error'
      }
    };
    res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }

  /**
   * Build Claude options from request
   */
  private buildClaudeOptions(request: ChatCompletionRequest, claudeHeaders: ClaudeHeaders): Record<string, any> {
    const options: Record<string, any> = {
      model: request.model,
      max_tokens: request.max_tokens || 2048,
      temperature: request.temperature ?? 1.0,
      top_p: request.top_p ?? 1.0,
      stream: true
    };

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
   * Generate unique response ID
   */
  private generateResponseId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `chatcmpl-${timestamp}${random}`;
  }
}

export const streamingHandler = new StreamingHandler();