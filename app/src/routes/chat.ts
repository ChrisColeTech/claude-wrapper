/**
 * Chat completions endpoint implementation
 * Based on Python main.py:502-642 chat completions endpoint
 * Implements Phase 10B chat completions requirements following Python patterns exactly
 * 
 * Single Responsibility: OpenAI-compatible chat completions API endpoint
 * CRITICAL: Follows Python authentication, header processing, and tools disabled by default
 */

import { Router, Request, Response } from 'express';
import { ParameterValidator, ValidationResult } from '../validation/validator';
import { HeaderProcessor, ClaudeHeaders } from '../validation/headers';
import { CompatibilityReporter } from '../validation/compatibility';
import { SessionService } from '../services/session-service';
import { MessageService } from '../services/message-service';
import { ToolValidator } from '../tools/validator';
import { ToolManager, ToolConfiguration } from '../tools/manager';
import { ToolContentFilter } from '../tools/filter';
import { ModelsRouter } from './models';
import { getLogger } from '../utils/logger';
import { Message } from '../models/message';
import { ChatCompletionRequest as ChatRequest } from '../models/chat';

const logger = getLogger('ChatRouter');

// Using ChatCompletionRequest from models/chat.ts
type ChatCompletionRequest = ChatRequest;

/**
 * OpenAI-compatible chat completion response interface
 */
export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion' | 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message?: {
      role: 'assistant';
      content: string | null;
    };
    delta?: {
      role?: 'assistant';
      content?: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost?: number;
  };
  session_id?: string;
}

/**
 * Chat router class implementing OpenAI chat completions endpoint
 * Based on Python FastAPI chat completions implementation
 */
export class ChatRouter {
  private sessionService: SessionService;
  private messageService: MessageService;

  constructor() {
    this.sessionService = new SessionService();
    this.messageService = new MessageService();
  }

  /**
   * Create Express router with chat endpoints
   */
  static createRouter(): Router {
    const router = Router();
    const chatRouter = new ChatRouter();

    // POST /v1/chat/completions - OpenAI-compatible chat completions
    router.post('/v1/chat/completions', chatRouter.createChatCompletion.bind(chatRouter));

    return router;
  }

  /**
   * Chat completions endpoint
   * Based on Python main.py:502-642 chat_completions function - EXACTLY following Python patterns
   */
  async createChatCompletion(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    let requestId: string = `chatcmpl-${Math.random().toString(16).substr(2, 8)}`;
    let sessionId: string | undefined;
    
    try {
      logger.info('Chat completion request received', {
        model: req.body.model,
        messageCount: req.body.messages?.length,
        stream: req.body.stream,
        sessionId: req.body.session_id,
        requestId
      });

      // 1. CRITICAL: Python pattern - Extract Claude-specific parameters from headers
      const claudeHeaders: ClaudeHeaders = HeaderProcessor.extractClaudeHeaders(req.headers as Record<string, string>);
      logger.debug(`Claude headers extracted: ${JSON.stringify(claudeHeaders)}`);

      // 2. Log compatibility info if debug enabled (Python pattern)
      const compatibilityReport = CompatibilityReporter.generateCompatibilityReport(req.body);
      logger.debug(`Compatibility report: ${JSON.stringify(compatibilityReport)}`);

      // 3. Validate request parameters using ParameterValidator
      const validationResult = ParameterValidator.validateRequest(req.body);
      if (!validationResult || !validationResult.valid) {
        const errors = validationResult?.errors || ['Request validation failed'];
        logger.warn('Request validation failed', { errors, requestId });
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid request parameters',
          details: errors
        });
        return;
      }

      const chatRequest: ChatCompletionRequest = req.body;
      sessionId = chatRequest.session_id;

      // 4. Handle streaming vs non-streaming - Python pattern
      if (chatRequest.stream) {
        await this.handleStreamingResponse(res, chatRequest, '', undefined, undefined, {}, startTime);
      } else {
        await this.handleNonStreamingResponse(req, res, chatRequest, claudeHeaders, requestId, startTime);
      }

    } catch (error) {
      logger.error('Chat completion error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        requestId,
        duration: Date.now() - startTime
      });
      
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'An error occurred while processing the chat completion',
          request_id: requestId,
          session_id: sessionId
        });
      }
    }
  }

  /**
   * Handle streaming chat completion response
   * Based on Python streaming response implementation
   */
  private async handleStreamingResponse(
    res: Response,
    request: ChatCompletionRequest,
    prompt: string,
    systemPrompt: string | undefined,
    sessionId: string | undefined,
    toolConfig: any,
    startTime: number
  ): Promise<void> {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const completionId = `chatcmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    let contentBuffer = '';
    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let estimatedCost = 0;

    try {
      // Send initial chunk
      const initialChunk: ChatCompletionResponse = {
        id: completionId,
        object: 'chat.completion.chunk',
        created: Math.floor(startTime / 1000),
        model: request.model,
        choices: [{
          index: 0,
          delta: { role: 'assistant', content: '' },
          finish_reason: null
        }],
        session_id: sessionId
      };

      res.write(`data: ${JSON.stringify(initialChunk)}\n\n`);

      // TODO: Implement Claude Code SDK streaming call
      // This is a placeholder - will be implemented with actual SDK integration
      const mockStreamingResponse = [
        { content: 'Hello', tokens: 1 },
        { content: ' there!', tokens: 2 },
        { content: ' How can I help you today?', tokens: 6 }
      ];

      for (const chunk of mockStreamingResponse) {
        contentBuffer += chunk.content;
        completionTokens += chunk.tokens;

        const streamChunk: ChatCompletionResponse = {
          id: completionId,
          object: 'chat.completion.chunk',
          created: Math.floor(startTime / 1000),
          model: request.model,
          choices: [{
            index: 0,
            delta: { content: chunk.content },
            finish_reason: null
          }],
          session_id: sessionId
        };

        res.write(`data: ${JSON.stringify(streamChunk)}\n\n`);
      }

      // Send final chunk
      totalTokens = promptTokens + completionTokens;
      estimatedCost = this.estimateTokenCost(totalTokens, request.model);

      const finalChunk: ChatCompletionResponse = {
        id: completionId,
        object: 'chat.completion.chunk',
        created: Math.floor(startTime / 1000),
        model: request.model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
          estimated_cost: estimatedCost
        },
        session_id: sessionId
      };

      res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
      res.write('data: [DONE]\n\n');

      // Update session if applicable
      if (sessionId && contentBuffer) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: contentBuffer
        };
        
        this.sessionService.addMessagesToSession(sessionId, [
          ...request.messages,
          assistantMessage
        ]);
      }

      logger.info('Streaming completion completed', {
        completionId,
        sessionId,
        contentLength: contentBuffer.length,
        totalTokens,
        estimatedCost,
        duration: Date.now() - startTime
      });

    } catch (error) {
      logger.error('Streaming response error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        completionId,
        sessionId
      });
      
      const errorChunk = {
        id: completionId,
        object: 'chat.completion.chunk',
        created: Math.floor(startTime / 1000),
        model: request.model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }],
        error: {
          message: 'An error occurred during streaming',
          type: 'server_error'
        }
      };
      
      res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
      res.write('data: [DONE]\n\n');
    } finally {
      res.end();
    }
  }

  /**
   * Handle non-streaming chat completion response
   * Based on Python main.py:550-635 non-streaming implementation - EXACTLY following Python pattern
   */
  private async handleNonStreamingResponse(
    req: Request,
    res: Response,
    request: ChatCompletionRequest,
    claudeHeaders: ClaudeHeaders,
    requestId: string,
    startTime: number
  ): Promise<void> {
    try {
      // 1. Process messages with session management (Python pattern main.py:551-553)
      const { allMessages, actualSessionId } = await this.processSessionMessages(
        request.messages, 
        request.session_id
      );
      
      logger.info(`Chat completion: session_id=${actualSessionId}, total_messages=${allMessages.length}`);

      // 2. Convert messages to prompt (Python pattern main.py:558)
      const formatResult = await this.messageService.convertToClaudeFormat(allMessages);
      if (!formatResult) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to convert messages to Claude format',
          request_id: requestId
        });
        return;
      }
      const { prompt, systemPrompt } = formatResult;
      
      // 3. Filter content (Python pattern main.py:561-563)
      const filteredPrompt = prompt ? await this.messageService.filterContent(prompt) : '';
      const filteredSystemPrompt = systemPrompt ? await this.messageService.filterContent(systemPrompt) : undefined;

      // 4. Get Claude Code SDK options from request (Python pattern main.py:566)
      const claudeOptions = this.buildClaudeOptions(request, claudeHeaders);

      // 5. Validate model (Python pattern main.py:573-574)
      if (claudeOptions.model) {
        const modelValidation = ParameterValidator.validateModel(claudeOptions.model);
        if (!modelValidation || !modelValidation.valid) {
          const errors = modelValidation?.errors || [`Model ${claudeOptions.model} is not supported`];
          res.status(400).json({
            error: 'Bad Request',
            message: `Model '${claudeOptions.model}' is not supported`,
            details: errors,
            supported_models: ParameterValidator.getSupportedModels()
          });
          return;
        }
      }

      // 6. Handle tools - CRITICAL: disabled by default for OpenAI compatibility (Python pattern main.py:576-586)
      if (!request.enable_tools) {
        // Python pattern: Set disallowed_tools to all available tools to disable them
        const allTools = ['Task', 'Bash', 'Glob', 'Grep', 'LS', 'exit_plan_mode', 
                         'Read', 'Edit', 'MultiEdit', 'Write', 'NotebookRead', 
                         'NotebookEdit', 'WebFetch', 'TodoRead', 'TodoWrite', 'WebSearch'];
        claudeOptions.disallowed_tools = allTools;
        claudeOptions.max_turns = 1; // Single turn for Q&A
        logger.info("Tools disabled (default behavior for OpenAI compatibility)");
      } else {
        logger.info("Tools enabled by user request");
      }

      // 7. TODO: Collect all chunks from Claude CLI (Python pattern main.py:588-599)
      // This is a placeholder for actual Claude Code SDK integration
      const mockChunks = [
        { content: 'Hello! How can I help you today?', stop_reason: 'end_turn' }
      ];

      // 8. Extract assistant message (Python pattern main.py:602)
      const rawAssistantContent = this.parseClaudeMessage(mockChunks);
      
      if (!rawAssistantContent) {
        res.status(500).json({
          error: {
            message: 'No response from Claude Code',
            type: 'server_error',
            code: 'no_response'
          }
        });
        return;
      }

      // 9. Filter out tool usage and thinking blocks (Python pattern main.py:608)
      const assistantContent = rawAssistantContent ? await this.messageService.filterContent(rawAssistantContent) : '';

      // 10. Add assistant response to session if using session mode (Python pattern main.py:611-613)
      if (actualSessionId && assistantContent) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: assistantContent
        };
        this.sessionService.addMessagesToSession(actualSessionId, [assistantMessage]);
      }

      // 11. Estimate tokens (Python pattern main.py:615-617)
      const promptTokens = filteredPrompt ? await this.messageService.estimateTokens(filteredPrompt) : 0;
      const completionTokens = assistantContent ? await this.messageService.estimateTokens(assistantContent) : 0;

      // 12. Create response (Python pattern main.py:619-633)
      const response: ChatCompletionResponse = {
        id: requestId,
        object: 'chat.completion',
        created: Math.floor(startTime / 1000),
        model: request.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: assistantContent
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens
        },
        session_id: actualSessionId
      };

      logger.info('Non-streaming completion completed', {
        requestId,
        sessionId: actualSessionId,
        contentLength: assistantContent.length,
        totalTokens: promptTokens + completionTokens,
        duration: Date.now() - startTime
      });

      res.json(response);

    } catch (error) {
      logger.error('Non-streaming response error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An error occurred while processing the completion',
        request_id: requestId
      });
    }
  }

  /**
   * Validate chat completion request
   * Based on Python request validation
   */
  private validateChatRequest(body: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate required fields
    if (!body.model || typeof body.model !== 'string') {
      errors.push('Field "model" is required and must be a string');
    }

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      errors.push('Field "messages" is required and must be a non-empty array');
    }

    // Validate messages structure
    if (body.messages && Array.isArray(body.messages)) {
      for (let i = 0; i < body.messages.length; i++) {
        const message = body.messages[i];
        if (!message.role || !message.content) {
          errors.push(`Message at index ${i} must have "role" and "content" fields`);
        }
        if (message.role && !['system', 'user', 'assistant'].includes(message.role)) {
          errors.push(`Message at index ${i} has invalid role: ${message.role}`);
        }
      }
    }

    // Validate optional parameters using ParameterValidator
    const paramValidation = ParameterValidator.validateRequest(body);

    if (!paramValidation.valid) {
      errors.push(...paramValidation.errors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Process messages with session management
   * Based on Python session_manager.process_messages (main.py:551-553)
   */
  private async processSessionMessages(
    messages: Message[],
    sessionId?: string
  ): Promise<{ allMessages: Message[]; actualSessionId?: string }> {
    if (!sessionId) {
      return { allMessages: messages, actualSessionId: undefined };
    }

    // Get existing session or create new one
    const session = this.sessionService.getSessionWithMessages(sessionId);
    if (session) {
      const allMessages = [...session.messages, ...messages];
      return { allMessages, actualSessionId: sessionId };
    } else {
      // Create new session
      this.sessionService.createSession(sessionId);
      return { allMessages: messages, actualSessionId: sessionId };
    }
  }

  /**
   * Build Claude Code SDK options from request and headers
   * Based on Python request.to_claude_options() + header merging (main.py:566-570)
   */
  private buildClaudeOptions(request: ChatCompletionRequest, claudeHeaders: ClaudeHeaders): Record<string, any> {
    // Get basic Claude options from request
    const claudeOptions = CompatibilityReporter.getClaudeSDKOptions(request);
    
    // Merge with Claude-specific headers (Python pattern)
    if (claudeHeaders && Object.keys(claudeHeaders).length > 0) {
      const mergedOptions = HeaderProcessor.mergeWithOptions(claudeOptions, claudeHeaders);
      return mergedOptions;
    }
    
    return claudeOptions;
  }

  /**
   * Parse Claude message from chunks
   * Based on Python claude_cli.parse_claude_message(chunks) (main.py:602)
   */
  private parseClaudeMessage(chunks: Array<{ content: string; stop_reason?: string }>): string | null {
    if (!chunks || chunks.length === 0) {
      return null;
    }
    
    // Combine all chunk content
    return chunks.map(chunk => chunk.content).join('');
  }

  /**
   * Estimate token cost based on model and token count
   * Based on Python cost estimation
   */
  private estimateTokenCost(tokens: number, model: string): number {
    // Simplified cost estimation - should be updated with actual pricing
    const costPerToken = 0.000003; // $3 per 1M tokens (example)
    return tokens * costPerToken;
  }
}

export default ChatRouter;