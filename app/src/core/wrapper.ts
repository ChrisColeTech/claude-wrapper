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
import { ClaudeResolver } from './claude-resolver/index';
import { TempFileManager } from '../utils/temp-file-manager';
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
  private static instanceCount = 0;
  private instanceId: string;
  private claudeClient: IClaudeClient;
  private validator: IResponseValidator;
  private claudeResolver: ClaudeResolver;
  private claudeSessions: Map<string, ClaudeSessionState> = new Map();
  private useSingleStageProcessing: boolean = true; // Default to new approach

  constructor(claudeClient?: IClaudeClient, validator?: IResponseValidator, claudeResolver?: ClaudeResolver) {
    this.instanceId = `wrapper-${++CoreWrapper.instanceCount}`;
    this.claudeClient = claudeClient || new ClaudeClient();
    this.validator = validator || new ResponseValidator();
    this.claudeResolver = claudeResolver || ClaudeResolver.getInstance();
    
    logger.debug('CoreWrapper instance created', { 
      instanceId: this.instanceId,
      totalInstances: CoreWrapper.instanceCount,
      hasCustomClient: !!claudeClient 
    });
  }

  async handleChatCompletion(request: OpenAIRequest): Promise<OpenAIResponse> {
    logger.info('Processing chat completion request', {
      model: request.model,
      messageCount: request.messages.length,
      stream: request.stream,
      processingMode: this.useSingleStageProcessing ? 'single-stage' : 'two-stage'
    });

    // Check if this request has system prompts
    const systemPrompts = this.extractSystemPrompts(request.messages);
    
    if (systemPrompts.length === 0) {
      // No system prompt - process normally
      return this.processNormally(request);
    }
    
    if (this.useSingleStageProcessing) {
      // Single-stage: Use file-based approach
      return this.processSingleStage(request);
    } else {
      // Two-stage: Use session optimization
      return this.processTwoStage(request);
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

  private async processSingleStage(request: OpenAIRequest): Promise<OpenAIResponse> {
    logger.info('Processing with single-stage file-based approach');
    
    // Create system prompt file
    const systemPrompts = this.extractSystemPrompts(request.messages);
    const systemPromptContent = systemPrompts.map(msg => msg.content).join('\n\n');
    
    let tempFilePath: string | null = null;
    
    try {
      // Create temporary file with system prompt
      tempFilePath = await TempFileManager.createTempFile(systemPromptContent);
      
      // Get user messages only
      const userMessages = request.messages.filter(msg => msg.role !== 'system');
      const prompt = this.claudeClient.messagesToPrompt(userMessages);
      
      // Execute with file-based system prompt
      const rawResponse = await this.claudeResolver.executeCommandWithFile(
        prompt,
        request.model,
        tempFilePath
      );
      
      const claudeRequest = this.addFormatInstructions(request);
      return this.validateAndCorrect(rawResponse, claudeRequest);
    } finally {
      // Clean up temporary file
      if (tempFilePath) {
        await TempFileManager.cleanupTempFile(tempFilePath);
      }
    }
  }
  
  private async processTwoStage(request: OpenAIRequest): Promise<OpenAIResponse> {
    logger.info('Processing with two-stage session optimization');
    
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
  async handleStreamingChatCompletion(request: OpenAIRequest): Promise<NodeJS.ReadableStream> {
    logger.info('Processing streaming chat completion (real)', {
      model: request.model,
      messageCount: request.messages.length,
      processingMode: this.useSingleStageProcessing ? 'single-stage' : 'two-stage'
    });

    // Check if this request has system prompts
    const systemPrompts = this.extractSystemPrompts(request.messages);
    
    if (systemPrompts.length === 0) {
      // No system prompt - stream normally
      const prompt = this.claudeClient.messagesToPrompt(request.messages);
      return this.claudeResolver.executeCommandStreaming(prompt, request.model, null);
    }
    
    if (this.useSingleStageProcessing) {
      // Single-stage: Use file-based streaming
      return this.streamSingleStage(request);
    } else {
      // Two-stage: Use session-based streaming
      return this.streamTwoStage(request);
    }
  }
  
  private async streamSingleStage(request: OpenAIRequest): Promise<NodeJS.ReadableStream> {
    logger.info('Streaming with single-stage file-based approach');
    
    // Create system prompt file
    const systemPrompts = this.extractSystemPrompts(request.messages);
    const systemPromptContent = systemPrompts.map(msg => msg.content).join('\n\n');
    
    const tempFilePath = await TempFileManager.createTempFile(systemPromptContent);
    
    try {
      // Get user messages only
      const userMessages = request.messages.filter(msg => msg.role !== 'system');
      const prompt = this.claudeClient.messagesToPrompt(userMessages);
      
      // Execute streaming with file-based system prompt
      return await this.claudeResolver.executeCommandStreamingWithFile(
        prompt,
        request.model,
        tempFilePath
      );
    } catch (error) {
      // Clean up on error
      await TempFileManager.cleanupTempFile(tempFilePath);
      throw error;
    }
    // Note: Cleanup will be handled by the resolver after streaming completes
  }
  
  private async streamTwoStage(request: OpenAIRequest): Promise<NodeJS.ReadableStream> {
    logger.info('Streaming with two-stage session optimization');
    
    // Use same session detection logic as non-streaming
    const sessionInfo = this.detectSystemPromptSession(request.messages);
    
    let claudeSessionId: string | null = null;
    
    if (sessionInfo.isNewSession) {
      // Create new Claude session or process normally
      if (sessionInfo.systemPromptHash) {
        // Need to initialize system prompt session for streaming
        const systemPrompts = this.extractSystemPrompts(request.messages);
        claudeSessionId = await this.createSystemPromptSession(systemPrompts);
        
        // Store the session mapping
        const systemPromptContent = systemPrompts.map(msg => msg.content).join('\n\n');
        this.claudeSessions.set(sessionInfo.systemPromptHash, {
          claudeSessionId: claudeSessionId,
          systemPromptHash: sessionInfo.systemPromptHash,
          lastUsed: new Date(),
          systemPromptContent
        });
      }
    } else {
      // Use existing Claude session
      if (sessionInfo.claudeSessionId && sessionInfo.sessionState) {
        claudeSessionId = sessionInfo.claudeSessionId;
        sessionInfo.sessionState.lastUsed = new Date();
      }
    }
    
    // Strip system prompts if we have a Claude session
    const finalRequest = claudeSessionId ? this.stripSystemPrompts(request) : request;
    
    // Convert to Claude CLI format
    const prompt = this.claudeClient.messagesToPrompt(finalRequest.messages);
    
    // Execute with real streaming using Claude CLI session ID (not wrapper session ID)
    const streamingResponse = await this.claudeResolver.executeCommandStreaming(
      prompt,
      finalRequest.model,
      claudeSessionId
    );
    
    return streamingResponse;
  }

  private generateRequestId(): string {
    return `${API_CONSTANTS.DEFAULT_REQUEST_ID_PREFIX}${Math.random().toString(36).substring(2, 15)}`;
  }
  
  /**
   * Configure whether to use single-stage or two-stage processing
   */
  setSingleStageProcessing(enabled: boolean): void {
    this.useSingleStageProcessing = enabled;
    logger.info('Processing mode changed', { 
      mode: enabled ? 'single-stage' : 'two-stage' 
    });
  }
  
  /**
   * Get current processing mode
   */
  isSingleStageProcessing(): boolean {
    return this.useSingleStageProcessing;
  }
}