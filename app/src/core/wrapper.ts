import { 
  OpenAIRequest, 
  OpenAIResponse, 
  OpenAIMessage, 
  ClaudeRequest,
  ICoreWrapper,
  IClaudeClient,
  IResponseValidator
} from '../types';
import { ClaudeClient } from './claude-client';
import { ResponseValidator } from './validator';
import { logger } from '../utils/logger';
import { 
  API_CONSTANTS, 
  TEMPLATE_CONSTANTS, 
  DEFAULT_USAGE 
} from '../config/constants';
import crypto from 'crypto';

// Claude session state interface
interface ClaudeSessionState {
  claudeSessionId: string;
  systemPromptHash: string;
  lastUsed: Date;
  systemPromptContent: string;
}

export class CoreWrapper implements ICoreWrapper {
  private claudeClient: IClaudeClient;
  private validator: IResponseValidator;
  private claudeSessions: Map<string, ClaudeSessionState> = new Map();

  constructor(claudeClient?: IClaudeClient, validator?: IResponseValidator) {
    this.claudeClient = claudeClient || new ClaudeClient();
    this.validator = validator || new ResponseValidator();
  }

  async handleChatCompletion(request: OpenAIRequest): Promise<OpenAIResponse> {
    logger.info('Processing chat completion request', {
      model: request.model,
      messageCount: request.messages.length,
      stream: request.stream
    });

    // Detect if we have a system prompt and check for existing session
    const sessionInfo = this.detectSystemPromptSession(request.messages);
    
    if (sessionInfo.isNewSession) {
      // Create new Claude session or process normally
      if (sessionInfo.systemPromptHash) {
        return this.initializeSystemPromptSession(request, sessionInfo.systemPromptHash);
      } else {
        return this.processNormally(request);
      }
    } else {
      // Resume existing Claude session
      if (sessionInfo.claudeSessionId && sessionInfo.sessionState) {
        return this.processWithSession(request, sessionInfo.claudeSessionId);
      } else {
        // Fallback to normal processing if session data is incomplete
        return this.processNormally(request);
      }
    }
  }

  private detectSystemPromptSession(messages: OpenAIMessage[]): {
    isNewSession: boolean;
    systemPromptHash?: string;
    claudeSessionId?: string;
    sessionState?: ClaudeSessionState;
  } {
    // Extract system prompts from messages
    const systemPrompts = this.extractSystemPrompts(messages);
    
    if (systemPrompts.length === 0) {
      // No system prompt - no optimization needed
      return { isNewSession: true };
    }

    // Create hash from system prompt content
    const systemPromptHash = this.getSystemPromptHash(systemPrompts);
    
    // Check if we have an existing Claude session for this system prompt
    const sessionState = this.claudeSessions.get(systemPromptHash);
    
    if (sessionState) {
      logger.debug('Found existing Claude session for system prompt', {
        systemPromptHash,
        claudeSessionId: sessionState.claudeSessionId,
        lastUsed: sessionState.lastUsed
      });
      
      return {
        isNewSession: false,
        systemPromptHash,
        claudeSessionId: sessionState.claudeSessionId,
        sessionState
      };
    }

    // System prompt exists but no Claude session found - need to create session
    logger.debug('System prompt found but no Claude session exists', {
      systemPromptHash,
      systemPromptCount: systemPrompts.length
    });
    
    return { isNewSession: true, systemPromptHash };
  }

  private extractSystemPrompts(messages: OpenAIMessage[]): OpenAIMessage[] {
    return messages.filter(msg => msg.role === 'system');
  }

  private getSystemPromptHash(systemPrompts: OpenAIMessage[]): string {
    // Create hash from system prompt content only
    const content = systemPrompts.map(msg => msg.content).join('\n\n');
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  private stripSystemPrompts(request: OpenAIRequest): OpenAIRequest {
    const nonSystemMessages = request.messages.filter(msg => msg.role !== 'system');
    
    logger.debug('Stripped system prompts from request', {
      originalMessageCount: request.messages.length,
      strippedMessageCount: nonSystemMessages.length,
      systemPromptsRemoved: request.messages.length - nonSystemMessages.length
    });

    return {
      ...request,
      messages: nonSystemMessages
    };
  }

  private async initializeSystemPromptSession(request: OpenAIRequest, systemPromptHash: string): Promise<OpenAIResponse> {
    logger.info('Initializing system prompt session', { systemPromptHash });
    
    // Stage 1: Setup system prompt session
    const systemPrompts = this.extractSystemPrompts(request.messages);
    const sessionId = await this.createSystemPromptSession(systemPrompts);
    
    // Store the session mapping
    const systemPromptContent = systemPrompts.map(msg => msg.content).join('\n\n');
    this.claudeSessions.set(systemPromptHash, {
      claudeSessionId: sessionId,
      systemPromptHash,
      lastUsed: new Date(),
      systemPromptContent
    });
    
    logger.info('Created new Claude session for system prompt', {
      systemPromptHash,
      claudeSessionId: sessionId
    });
    
    // Stage 2: Process remaining messages with session
    return this.processWithSession(request, sessionId);
  }

  private async createSystemPromptSession(systemPrompts: OpenAIMessage[]): Promise<string> {
    const systemContent = systemPrompts.map(msg => msg.content).join('\n\n');
    const setupRequest: ClaudeRequest = {
      model: 'sonnet',
      messages: [{ role: 'system' as const, content: systemContent }]
    };
    
    const response = await this.claudeClient.executeWithSession(setupRequest, null, true);
    const { sessionId } = this.parseClaudeSessionResponse(response);
    
    if (!sessionId) {
      throw new Error('Failed to extract session ID from Claude CLI response');
    }
    
    return sessionId;
  }

  private async processWithSession(request: OpenAIRequest, sessionId: string): Promise<OpenAIResponse> {
    logger.info('Processing with existing Claude session', { sessionId });
    
    // Strip system prompts and process remaining messages
    const strippedRequest = this.stripSystemPrompts(request);
    const claudeRequest = this.addFormatInstructions(strippedRequest);
    
    const rawResponse = await this.claudeClient.executeWithSession(
      claudeRequest, 
      sessionId, 
      false // Regular mode, not JSON
    );
    
    // Update session state
    const sessionHash = this.getSystemPromptHash(this.extractSystemPrompts(request.messages));
    const sessionState = this.claudeSessions.get(sessionHash);
    if (sessionState) {
      sessionState.lastUsed = new Date();
    }
    
    return this.validateAndCorrect(rawResponse, claudeRequest);
  }

  private async processNormally(request: OpenAIRequest): Promise<OpenAIResponse> {
    logger.info('Processing without session optimization');
    
    const claudeRequest = this.addFormatInstructions(request);
    const rawResponse = await this.claudeClient.execute(claudeRequest);
    
    return this.validateAndCorrect(rawResponse, claudeRequest);
  }

  private parseClaudeSessionResponse(jsonResponse: string): { sessionId: string | null; response: string } {
    try {
      const parsed = JSON.parse(jsonResponse);
      return {
        sessionId: parsed.session_id || null,
        response: parsed.result || jsonResponse
      };
    } catch (error) {
      logger.warn('Failed to parse Claude session response as JSON', { error });
      return {
        sessionId: null,
        response: jsonResponse
      };
    }
  }

  private addFormatInstructions(request: OpenAIRequest): ClaudeRequest {
    const needsFormatting = this.shouldUseFormatInstructions(request);
    
    if (!needsFormatting) {
      logger.debug('Skipping format instructions for simple request', {
        messageCount: request.messages.length,
        hasTools: !!request.tools
      });
      
      return {
        model: request.model,
        messages: request.messages,
        ...(request.tools && { tools: request.tools })
      };
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const requestId = this.generateRequestId();
    
    const formatInstruction: OpenAIMessage = {
      role: TEMPLATE_CONSTANTS.FORMAT_INSTRUCTION_ROLE,
      content: this.createFormatTemplate(requestId, timestamp, request.model)
    };

    const enhancedMessages = [formatInstruction, ...request.messages];

    logger.debug('Added format instructions for complex request', {
      originalMessageCount: request.messages.length,
      enhancedMessageCount: enhancedMessages.length,
      requestId
    });

    return {
      model: request.model,
      messages: enhancedMessages,
      ...(request.tools && { tools: request.tools })
    };
  }

  private shouldUseFormatInstructions(request: OpenAIRequest): boolean {
    // Always use formatting if tools are present
    if (request.tools && request.tools.length > 0) {
      return true;
    }

    // Use formatting for multi-turn conversations (more than 2 messages)
    if (request.messages.length > 2) {
      return true;
    }

    // Use formatting if there's a system message
    const hasSystemMessage = request.messages.some(msg => msg.role === 'system');
    if (hasSystemMessage) {
      return true;
    }

    // Use formatting for long user messages (likely complex requests)
    const lastUserMessage = request.messages.filter(msg => msg.role === 'user').pop();
    if (lastUserMessage && typeof lastUserMessage.content === 'string' && lastUserMessage.content.length > 200) {
      return true;
    }

    // Skip formatting for simple single-turn questions
    return false;
  }

  private createFormatTemplate(requestId: string, timestamp: number, model: string): string {
    const template = {
      id: requestId,
      object: TEMPLATE_CONSTANTS.COMPLETION_OBJECT_TYPE,
      created: timestamp,
      model: model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'REPLACE_WITH_ANSWER'
        },
        finish_reason: TEMPLATE_CONSTANTS.DEFAULT_FINISH_REASON
      }],
      usage: {
        prompt_tokens: DEFAULT_USAGE.PROMPT_TOKENS,
        completion_tokens: DEFAULT_USAGE.COMPLETION_TOKENS,
        total_tokens: DEFAULT_USAGE.TOTAL_TOKENS
      }
    };

    return `Return raw JSON only, no formatting: ${JSON.stringify(template)}. Replace REPLACE_WITH_ANSWER with your response. If you need to use tools, populate the tool_calls array instead of content (set content to null). Each tool call should have: {"id": "call_xxx", "type": "function", "function": {"name": "tool_name", "arguments": "json_string"}}.`;
  }

  private async validateAndCorrect(
    response: string, 
    originalRequest: ClaudeRequest, 
    attempt: number = 1
  ): Promise<OpenAIResponse> {
    
    const validation = this.validator.validate(response);

    if (validation.valid) {
      logger.info('Valid response received', { attempt });
      return this.validator.parse(response);
    }

    // Instead of trying to self-correct, wrap non-JSON response in OpenAI format
    logger.info('Non-JSON response received, wrapping in OpenAI format', {
      responseLength: response.length,
      responsePreview: response.substring(0, 100)
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const requestId = this.generateRequestId();

    const wrappedResponse: OpenAIResponse = {
      id: requestId,
      object: TEMPLATE_CONSTANTS.COMPLETION_OBJECT_TYPE,
      created: timestamp,
      model: originalRequest.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: response
        },
        finish_reason: TEMPLATE_CONSTANTS.DEFAULT_FINISH_REASON
      }],
      usage: {
        prompt_tokens: DEFAULT_USAGE.PROMPT_TOKENS,
        completion_tokens: DEFAULT_USAGE.COMPLETION_TOKENS,
        total_tokens: DEFAULT_USAGE.TOTAL_TOKENS
      }
    };

    return wrappedResponse;
  }


  /**
   * Handle streaming chat completion (future enhancement)
   * Currently returns single response, but structured for future streaming support
   */
  async handleStreamingChatCompletion(request: OpenAIRequest): Promise<OpenAIResponse> {
    logger.info('Processing streaming chat completion (simulated)', {
      model: request.model,
      messageCount: request.messages.length
    });

    // For now, delegate to regular completion
    // Future: Implement true streaming with Claude CLI
    return this.handleChatCompletion(request);
  }

  private generateRequestId(): string {
    return `${API_CONSTANTS.DEFAULT_REQUEST_ID_PREFIX}${Math.random().toString(36).substring(2, 15)}`;
  }
}