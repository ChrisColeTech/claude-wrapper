/**
 * Chat completions endpoint implementation
 * Single Responsibility: OpenAI-compatible chat completions API endpoint
 * Refactored for Phase 5B architecture compliance
 */

import { Router, Request, Response } from 'express';
import { ParameterValidator } from '../validation/validator';
import { HeaderProcessor } from '../validation/headers';
import { CompatibilityReporter } from '../validation/compatibility';
import { SessionService } from '../services/session-service';
import { MessageService } from '../services/message-service';
import { toolChoiceProcessor, multiToolCallHandler } from '../tools';
import { ChoiceProcessingContext } from '../tools/choice-processor';
import { streamingHandler } from './streaming-handler';
import { nonStreamingHandler } from './non-streaming-handler';
import { requestValidator } from './request-validator';
import { getLogger } from '../utils/logger';
import { ChatCompletionRequest as ChatRequest } from '../models/chat';
import { OpenAIToolCall } from '../tools/types';

const logger = getLogger('ChatRouter');

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
      tool_calls?: OpenAIToolCall[];
    };
    delta?: {
      role?: 'assistant';
      content?: string;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null;
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
 * Refactored for Phase 5B compliance with SRP and DRY principles
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

    router.post('/v1/chat/completions', chatRouter.createChatCompletion.bind(chatRouter));
    return router;
  }

  /**
   * Create chat completion endpoint
   * Refactored for Phase 5B architecture compliance
   */
  async createChatCompletion(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Chat completion request received');

      // 1. Request validation
      const validation = requestValidator.validateChatRequest(req.body);
      if (!validation.isValid) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid request parameters',
          details: validation.errors
        });
        return;
      }

      // 2. Parameter validation
      const paramValidation = requestValidator.validateWithParameterValidator(req.body);
      if (!paramValidation.isValid) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Request validation failed',
          details: paramValidation.errors
        });
        return;
      }

      // 3. Model validation
      const compatibilityOptions = CompatibilityReporter.getClaudeSDKOptions(req.body);
      const modelValidation = requestValidator.validateModelSupport(
        compatibilityOptions.model || req.body.model
      );
      if (!modelValidation.isValid) {
        const supportedModels = ParameterValidator.getSupportedModels();
        res.status(400).json({
          error: 'Bad Request',
          message: `Model ${compatibilityOptions.model || req.body.model} is not supported`,
          supported_models: supportedModels,
          details: modelValidation.errors
        });
        return;
      }

      // 4. Extract Claude headers
      const claudeHeaders = HeaderProcessor.extractClaudeHeaders(req.headers as Record<string, string>);
      
      // 5. Process tool choice context
      const request: ChatCompletionRequest = req.body;
      const choiceContext = await this.processToolChoice(request);

      // 6. Process multi-tool calls (Phase 7A)
      const multiToolResult = await this.processMultiToolCalls(request);
      if (!multiToolResult.success && multiToolResult.errors.length > 0) {
        logger.warn('Multi-tool processing warnings:', multiToolResult.errors);
      }

      // 7. Session processing
      const sessionData = await this.processSessionMessages(request);
      
      // 8. Message conversion
      const messageConversion = await this.messageService.convertToClaudeFormat(
        sessionData.messages
      );

      // 9. Route to streaming or non-streaming handler
      if (request.stream) {
        await streamingHandler.handleStreamingResponse({
          request,
          claudeHeaders,
          prompt: messageConversion.prompt,
          sessionId: sessionData.sessionId
        }, res);
      } else {
        await nonStreamingHandler.handleNonStreamingResponse({
          request,
          claudeHeaders,
          prompt: messageConversion.prompt,
          choiceContext,
          sessionId: sessionData.sessionId
        }, res);
      }

    } catch (error) {
      logger.error('Chat completion error:', error);
      
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'An error occurred while processing the completion'
        });
      }
    }
  }

  /**
   * Process tool choice context
   */
  private async processToolChoice(request: ChatCompletionRequest): Promise<ChoiceProcessingContext> {
    let choiceContext: ChoiceProcessingContext = {
      hasChoice: !!request.tool_choice,
      choiceType: 'auto',
      allowsTools: request.enable_tools !== false,
      forcesTextOnly: false,
      forcesSpecificFunction: false,
      functionName: undefined,
      claudeFormat: {
        mode: 'auto',
        allowTools: true
      },
      processingTimeMs: 0
    };

    if (request.tool_choice) {
      const startTime = Date.now();
      try {
        const choiceResult = await toolChoiceProcessor.processChoice({
          choice: request.tool_choice,
          tools: request.tools || []
        });
        
        if (choiceResult.success && choiceResult.processedChoice) {
          // Update choice context based on processed result
          const behavior = choiceResult.processedChoice.behavior;
          if (behavior?.toString() === 'none') {
            choiceContext.forcesTextOnly = true;
            choiceContext.choiceType = 'none';
          } else if (behavior?.toString() === 'specific' && choiceResult.processedChoice.functionName) {
            choiceContext.forcesSpecificFunction = true;
            choiceContext.functionName = choiceResult.processedChoice.functionName;
            choiceContext.choiceType = 'function';
          }
        }
        choiceContext.processingTimeMs = Date.now() - startTime;
      } catch (error) {
        logger.warn('Tool choice processing failed:', error);
        choiceContext.processingTimeMs = Date.now() - startTime;
      }
    }

    return choiceContext;
  }

  /**
   * Process multi-tool calls (Phase 7A)
   */
  private async processMultiToolCalls(request: ChatCompletionRequest): Promise<{
    success: boolean;
    toolCalls?: OpenAIToolCall[];
    errors: string[];
    processingTimeMs: number;
  }> {
    if (!request.tools || request.tools.length === 0) {
      return {
        success: true,
        toolCalls: [],
        errors: [],
        processingTimeMs: 0
      };
    }

    // Extract tool calls from assistant messages if any
    const toolCalls: OpenAIToolCall[] = [];
    for (const message of request.messages) {
      if (message.role === 'assistant' && (message as any).tool_calls) {
        toolCalls.push(...(message as any).tool_calls);
      }
    }

    if (toolCalls.length === 0) {
      return {
        success: true,
        toolCalls: [],
        errors: [],
        processingTimeMs: 0
      };
    }

    const startTime = Date.now();
    try {
      const multiToolRequest = {
        tools: request.tools,
        toolCalls: toolCalls,
        sessionId: request.session_id,
        requestId: `req-${Date.now()}`,
        parallel: toolCalls.length > 1 // Use parallel processing for multiple calls
      };

      const result = await multiToolCallHandler.processMultipleToolCalls(multiToolRequest);
      
      return {
        success: result.success,
        toolCalls: result.toolCalls,
        errors: result.errors,
        processingTimeMs: Date.now() - startTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Multi-tool processing failed:', error);
      
      return {
        success: false,
        toolCalls: [],
        errors: [error instanceof Error ? error.message : 'Multi-tool processing failed'],
        processingTimeMs: processingTime
      };
    }
  }

  /**
   * Process session messages
   */
  private async processSessionMessages(request: ChatCompletionRequest): Promise<{
    messages: any[];
    sessionId?: string;
  }> {
    let messages = request.messages;
    const sessionId = request.session_id;

    // Handle session continuity
    if (sessionId) {
      const existingSession = this.sessionService.getSessionWithMessages(sessionId);
      if (existingSession) {
        // Merge existing messages with new ones
        messages = [...existingSession.messages, ...request.messages];
      } else {
        // Create new session
        this.sessionService.createSession({
          model: request.model,
          system_prompt: 'You are a helpful assistant.',
          max_turns: 10
        });
      }
    }

    return { messages, sessionId };
  }
}

export default ChatRouter;