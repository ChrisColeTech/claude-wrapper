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
      processingMode: 'single-stage'
    });

    // Check if this request has system prompts
    const systemPrompts = this.extractSystemPrompts(request.messages);
    
    if (systemPrompts.length === 0) {
      // No system prompt - process normally
      return this.processNormally(request);
    }
    
    // Single-stage with session reuse
    return this.processSingleStage(request);
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
    logger.info('Processing with single-stage session reuse');
    
    // Extract system prompts and create hash
    const systemPrompts = this.extractSystemPrompts(request.messages);
    const systemPromptHash = this.getSystemPromptHash(systemPrompts);
    
    // Check for existing session
    let sessionState = this.claudeSessions.get(systemPromptHash);
    
    if (!sessionState) {
      // First request: Create session with system prompt file
      const sessionId = await this.createSingleStageSession(systemPrompts, request);
      
      // Store session for reuse
      const systemPromptContent = systemPrompts.map(msg => msg.content).join('\n\n');
      this.claudeSessions.set(systemPromptHash, {
        claudeSessionId: sessionId,
        systemPromptHash,
        lastUsed: new Date(),
        systemPromptContent
      });
      
      sessionState = this.claudeSessions.get(systemPromptHash);
      
      logger.info('Created new single-stage session', {
        systemPromptHash,
        sessionId
      });
    }
    
    // Update last used timestamp
    sessionState!.lastUsed = new Date();
    
    // Process remaining messages with existing session
    return this.processWithSession(request, sessionState!.claudeSessionId);
  }

  private async createSingleStageSession(systemPrompts: OpenAIMessage[], request: OpenAIRequest): Promise<string> {
    logger.info('Creating single-stage session with system prompt file');
    
    const systemPromptContent = systemPrompts.map(msg => msg.content).join('\n\n');
    let tempFilePath: string | null = null;
    
    try {
      // Create temporary file with system prompt
      tempFilePath = await TempFileManager.createTempFile(systemPromptContent);
      
      // Get user messages only
      const userMessages = request.messages.filter(msg => msg.role !== 'system');
      const prompt = this.claudeClient.messagesToPrompt(userMessages);
      
      // Execute with file-based system prompt and JSON output to get session ID
      const rawResponse = await this.claudeResolver.executeCommandWithFileForSession(
        prompt,
        request.model,
        tempFilePath
      );
      
      // Parse response to extract session ID
      const { sessionId } = this.parseClaudeSessionResponse(rawResponse);
      
      if (!sessionId) {
        throw new Error('Failed to extract session ID from Claude CLI response');
      }
      
      logger.info('Single-stage session created successfully', {
        sessionId,
        systemPromptHash: this.getSystemPromptHash(systemPrompts)
      });
      
      return sessionId;
    } finally {
      // Clean up temporary file
      if (tempFilePath) {
        await TempFileManager.cleanupTempFile(tempFilePath);
      }
    }
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
    
    // Parse Claude CLI JSON response to extract result field if present
    const processedResponse = this.parseClaudeResponse(rawResponse);
    
    return this.validateAndCorrect(processedResponse, claudeRequest);
  }

  private async processNormally(request: OpenAIRequest): Promise<OpenAIResponse> {
    logger.info('Processing without session optimization');
    
    const claudeRequest = this.addFormatInstructions(request);
    const rawResponse = await this.claudeClient.execute(claudeRequest);
    
    // Parse Claude CLI JSON response to extract result field if present
    const processedResponse = this.parseClaudeResponse(rawResponse);
    
    return this.validateAndCorrect(processedResponse, claudeRequest);
  }

  private parseClaudeResponse(rawResponse: string): string {
    try {
      const parsed = JSON.parse(rawResponse);
      // If it's a Claude CLI JSON response with result field, extract it
      if (parsed.result !== undefined) {
        logger.debug('Extracted result from Claude CLI JSON response', {
          hasSessionId: !!parsed.session_id,
          resultLength: parsed.result.length
        });
        return parsed.result;
      }
      // Otherwise return the original response
      return rawResponse;
    } catch (error) {
      // Not JSON, return as-is
      return rawResponse;
    }
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
    logger.info('Processing streaming chat completion with single-stage session reuse', {
      model: request.model,
      messageCount: request.messages.length,
      processingMode: 'single-stage'
    });

    // Check if this request has system prompts
    const systemPrompts = this.extractSystemPrompts(request.messages);
    
    if (systemPrompts.length === 0) {
      // No system prompt - stream normally
      const prompt = this.claudeClient.messagesToPrompt(request.messages);
      return this.claudeResolver.executeCommandStreaming(prompt, request.model, null);
    }
    
    // Single-stage with session reuse
    return this.streamWithSessionReuse(request);
  }
  
  private async streamWithSessionReuse(request: OpenAIRequest): Promise<NodeJS.ReadableStream> {
    logger.info('Streaming with single-stage session reuse');
    
    // Extract system prompts and create hash
    const systemPrompts = this.extractSystemPrompts(request.messages);
    const systemPromptHash = this.getSystemPromptHash(systemPrompts);
    
    // Check for existing session
    let sessionState = this.claudeSessions.get(systemPromptHash);
    
    if (!sessionState) {
      // First request: Create session with system prompt file
      const sessionId = await this.createSingleStageSession(systemPrompts, request);
      
      // Store session for reuse
      const systemPromptContent = systemPrompts.map(msg => msg.content).join('\n\n');
      this.claudeSessions.set(systemPromptHash, {
        claudeSessionId: sessionId,
        systemPromptHash,
        lastUsed: new Date(),
        systemPromptContent
      });
      
      sessionState = this.claudeSessions.get(systemPromptHash);
      
      logger.info('Created new single-stage session for streaming', {
        systemPromptHash,
        sessionId
      });
    }
    
    // Update last used timestamp
    sessionState!.lastUsed = new Date();
    
    // Strip system prompts and process remaining messages with existing session
    const finalRequest = this.stripSystemPrompts(request);
    const prompt = this.claudeClient.messagesToPrompt(finalRequest.messages);
    
    // Execute with real streaming using Claude CLI session ID
    const streamingResponse = await this.claudeResolver.executeCommandStreaming(
      prompt,
      finalRequest.model,
      sessionState!.claudeSessionId
    );
    
    return streamingResponse;
  }

  private generateRequestId(): string {
    return `${API_CONSTANTS.DEFAULT_REQUEST_ID_PREFIX}${Math.random().toString(36).substring(2, 15)}`;
  }
  
  
  /**
   * Get optimized session information for API exposure
   */
  getOptimizedSessions(): Map<string, ClaudeSessionState> {
    return new Map(this.claudeSessions);
  }
  
  /**
   * Clear all optimized sessions
   */
  clearOptimizedSessions(): number {
    const count = this.claudeSessions.size;
    this.claudeSessions.clear();
    return count;
  }
  
  /**
   * Delete a specific optimized session by hash
   */
  deleteOptimizedSession(hash: string): boolean {
    return this.claudeSessions.delete(hash);
  }
}