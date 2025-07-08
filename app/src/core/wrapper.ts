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
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { 
  API_CONSTANTS, 
  TEMPLATE_CONSTANTS, 
  DEFAULT_USAGE 
} from '../config/constants';

export class CoreWrapper implements ICoreWrapper {
  private claudeClient: IClaudeClient;
  private validator: IResponseValidator;

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

    const enhancedRequest = this.addFormatInstructions(request);
    const rawResponse = await this.claudeClient.execute(enhancedRequest);
    
    return this.validateAndCorrect(rawResponse, enhancedRequest);
  }

  private addFormatInstructions(request: OpenAIRequest): ClaudeRequest {
    const timestamp = Math.floor(Date.now() / 1000);
    const requestId = this.generateRequestId();
    
    const formatInstruction: OpenAIMessage = {
      role: TEMPLATE_CONSTANTS.FORMAT_INSTRUCTION_ROLE,
      content: this.createFormatTemplate(requestId, timestamp, request.model)
    };

    const enhancedMessages = [formatInstruction, ...request.messages];

    logger.debug('Added format instructions', {
      originalMessageCount: request.messages.length,
      enhancedMessageCount: enhancedMessages.length,
      requestId
    });

    return {
      model: request.model,
      messages: enhancedMessages
    };
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

    return `Return raw JSON only, no formatting: ${JSON.stringify(template)}. Replace REPLACE_WITH_ANSWER with your response.`;
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

    if (attempt < API_CONSTANTS.MAX_VALIDATION_ATTEMPTS) {
      logger.warn('Invalid response, attempting self-correction', {
        attempt,
        errors: validation.errors
      });

      const correctionRequest = this.createCorrectionRequest(
        response, 
        originalRequest, 
        validation.errors
      );

      const correctedResponse = await this.claudeClient.execute(correctionRequest);
      return this.validateAndCorrect(correctedResponse, originalRequest, attempt + 1);
    }

    const errorMessage = `Failed to get valid OpenAI format after ${attempt} attempts. Last errors: ${validation.errors.join(', ')}`;
    logger.error('Validation failed after max attempts', undefined, { 
      attempts: attempt,
      errors: validation.errors 
    });
    
    throw new ValidationError(errorMessage);
  }

  private createCorrectionRequest(
    invalidResponse: string,
    originalRequest: ClaudeRequest,
    errors: string[]
  ): ClaudeRequest {
    const correctionMessage: OpenAIMessage = {
      role: TEMPLATE_CONSTANTS.CORRECTION_ROLE,
      content: `The previous response had format errors: ${errors.join(', ')}. 

Please provide a correctly formatted OpenAI Chat Completions JSON response. Remember:
- Must be valid JSON
- Must include all required fields (id, object, created, model, choices, usage)
- No extra text outside the JSON
- Use exactly this structure with your content in the message.content field`
    };

    return {
      model: originalRequest.model,
      messages: [
        ...originalRequest.messages,
        { role: 'assistant', content: invalidResponse },
        correctionMessage
      ]
    };
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