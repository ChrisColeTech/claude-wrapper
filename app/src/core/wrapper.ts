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


export class CoreWrapper implements ICoreWrapper {
  private claudeClient: IClaudeClient;
  private validator: IResponseValidator;
  private currentSystemPromptHash: string | null = null;
  private claudeMdUpdateInProgress: boolean = false;
  private pendingSystemPromptHash: string | null = null;

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

    // Stage 1: System prompt management (if needed)
    const { systemPrompts } = this.extractSystemPrompts(request.messages);
    
    if (systemPrompts.length > 0) {
      // Combine all system prompts into one content string
      const systemContent = systemPrompts
        .map(msg => typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content))
        .join('\n\n');
      
      const systemHash = this.getSystemPromptHash(systemContent);
      
      if (this.needsClaudeMdUpdate(systemHash)) {
        logger.info('System prompt changed, updating CLAUDE.md', { systemHash });
        
        this.setClaudeMdUpdateInProgress(systemHash);
        const updateSuccess = await this.updateClaudeMd(systemContent);
        this.clearClaudeMdUpdateInProgress(updateSuccess);
        
        if (!updateSuccess) {
          logger.warn('CLAUDE.md update failed, falling back to including system prompt in request');
          // Fall back to original behavior if CLAUDE.md update fails
          return this.processWithSystemPrompts(request);
        }
      }
    }

    // Stage 2: Optimized request processing
    const optimizedRequest = this.stripSystemPrompts(request);
    const enhancedRequest = this.addFormatInstructions(optimizedRequest);
    const rawResponse = await this.claudeClient.execute(enhancedRequest);
    
    return this.validateAndCorrect(rawResponse, enhancedRequest);
  }

  private async processWithSystemPrompts(request: OpenAIRequest): Promise<OpenAIResponse> {
    // Fallback: process request with system prompts included (original behavior)
    const enhancedRequest = this.addFormatInstructions(request);
    const rawResponse = await this.claudeClient.execute(enhancedRequest);
    return this.validateAndCorrect(rawResponse, enhancedRequest);
  }

  private stripSystemPrompts(request: OpenAIRequest): OpenAIRequest {
    const { otherMessages } = this.extractSystemPrompts(request.messages);
    
    logger.info('Stripped system prompts from request', {
      originalMessageCount: request.messages.length,
      optimizedMessageCount: otherMessages.length,
      reduction: `${Math.round((1 - otherMessages.length / request.messages.length) * 100)}%`
    });

    return {
      ...request,
      messages: otherMessages
    };
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

  private getSystemPromptHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  private hasSystemPromptChanged(newHash: string): boolean {
    const changed = this.currentSystemPromptHash !== newHash;
    
    logger.debug('Checking system prompt hash', {
      currentHash: this.currentSystemPromptHash,
      newHash,
      hasChanged: changed
    });
    
    return changed;
  }

  private updateStoredHash(hash: string): void {
    this.currentSystemPromptHash = hash;
    logger.debug('Updated stored system prompt hash', { hash });
  }

  private needsClaudeMdUpdate(newHash: string): boolean {
    // Need update if hash changed and no update is in progress
    const hashChanged = this.hasSystemPromptChanged(newHash);
    const needsUpdate = hashChanged && !this.claudeMdUpdateInProgress;
    
    logger.debug('Checking if CLAUDE.md needs update', {
      hashChanged,
      updateInProgress: this.claudeMdUpdateInProgress,
      needsUpdate
    });
    
    return needsUpdate;
  }

  private setClaudeMdUpdateInProgress(hash: string): void {
    this.claudeMdUpdateInProgress = true;
    this.pendingSystemPromptHash = hash;
    logger.debug('Set CLAUDE.md update in progress', { hash });
  }

  private clearClaudeMdUpdateInProgress(success: boolean): void {
    if (success && this.pendingSystemPromptHash) {
      this.updateStoredHash(this.pendingSystemPromptHash);
    }
    
    this.claudeMdUpdateInProgress = false;
    this.pendingSystemPromptHash = null;
    
    logger.debug('Cleared CLAUDE.md update in progress', { success });
  }

  private async updateClaudeMd(systemContent: string): Promise<boolean> {
    try {
      const instruction = `Please update the CLAUDE.md file in the current directory. Find the section between '<!-- CLAUDE_WRAPPER_SYSTEM_START -->' and '<!-- CLAUDE_WRAPPER_SYSTEM_END -->' and replace only the content between those markers with:

${systemContent}

If those markers don't exist, append them with the content to the end of the file. Do not modify any other content in the file.`;

      logger.info('Requesting CLAUDE.md update', {
        systemContentLength: systemContent.length,
        systemContentPreview: systemContent.substring(0, 100) + '...'
      });

      // Create a request for Claude to update CLAUDE.md
      const claudeMdRequest = {
        model: 'sonnet', // Use same model as the main request
        messages: [
          {
            role: 'user' as const,
            content: instruction
          }
        ]
      };

      const response = await this.claudeClient.execute(claudeMdRequest);
      
      // Parse response to check if update was successful
      const success = this.parseClaudeMdUpdateResponse(response);
      
      logger.info('CLAUDE.md update completed', { 
        success,
        responseLength: response.length,
        responsePreview: response.substring(0, 200) + '...'
      });

      return success;

    } catch (error) {
      logger.error('CLAUDE.md update failed', error as Error, {
        systemContentLength: systemContent.length
      });
      return false;
    }
  }

  private parseClaudeMdUpdateResponse(response: string): boolean {
    // Look for indicators that Claude successfully updated the file
    const successIndicators = [
      'updated',
      'written',
      'saved',
      'modified',
      'CLAUDE.md',
      'file has been',
      'successfully'
    ];

    const errorIndicators = [
      'error',
      'failed',
      'cannot',
      'unable',
      'permission denied',
      'not found'
    ];

    const responseText = response.toLowerCase();

    // Check for error indicators first
    const hasError = errorIndicators.some(indicator => responseText.includes(indicator));
    if (hasError) {
      logger.warn('CLAUDE.md update response indicates error', { response: response.substring(0, 500) });
      return false;
    }

    // Check for success indicators
    const hasSuccess = successIndicators.some(indicator => responseText.includes(indicator));
    if (hasSuccess) {
      logger.debug('CLAUDE.md update response indicates success', { response: response.substring(0, 500) });
      return true;
    }

    // If neither clear success nor error, assume success (Claude might respond minimally)
    logger.debug('CLAUDE.md update response unclear, assuming success', { response: response.substring(0, 500) });
    return true;
  }


  private extractSystemPrompts(messages: OpenAIMessage[]): {
    systemPrompts: OpenAIMessage[],
    otherMessages: OpenAIMessage[]
  } {
    const systemPrompts = messages.filter(msg => msg.role === 'system');
    const otherMessages = messages.filter(msg => msg.role !== 'system');

    logger.debug('Extracted system prompts', {
      totalMessages: messages.length,
      systemCount: systemPrompts.length,
      otherCount: otherMessages.length
    });

    return {
      systemPrompts,
      otherMessages
    };
  }

}