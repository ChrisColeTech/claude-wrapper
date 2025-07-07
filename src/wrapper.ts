import { ClaudeClient } from './claude-client';
import { ResponseValidator } from './validator';
import { OpenAIRequest, OpenAIResponse, OpenAIMessage, ClaudeRequest } from './types';

export class ClaudeWrapper {
  private claudeClient: ClaudeClient;
  private validator: ResponseValidator;

  constructor() {
    this.claudeClient = new ClaudeClient();
    this.validator = new ResponseValidator();
  }

  /**
   * Main entry point - handle OpenAI chat completion request
   */
  async handleChatCompletion(request: OpenAIRequest): Promise<OpenAIResponse> {
    // Step 1: Add format instructions to the request
    const enhancedRequest = this.addFormatInstructions(request);

    // Step 2: Send to Claude Code CLI
    const rawResponse = await this.claudeClient.execute(enhancedRequest);

    // Step 3: Validate and potentially self-correct
    return this.validateAndCorrect(rawResponse, enhancedRequest);
  }

  /**
   * Add format instructions without replacing client messages
   */
  private addFormatInstructions(request: OpenAIRequest): ClaudeRequest {
    const timestamp = Math.floor(Date.now() / 1000);
    const requestId = `chatcmpl-${Math.random().toString(36).substring(2, 15)}`;
    
    const formatInstruction: OpenAIMessage = {
      role: 'system',
      content: `Return raw JSON only, no formatting: {"id":"${requestId}","object":"chat.completion","created":${timestamp},"model":"${request.model}","choices":[{"index":0,"message":{"role":"assistant","content":"REPLACE_WITH_ANSWER"},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}. Replace REPLACE_WITH_ANSWER with your response.`
    };

    // Insert format instruction at the beginning, keep all original messages
    const enhancedMessages = [formatInstruction, ...request.messages];

    return {
      model: request.model,
      messages: enhancedMessages
    };
  }

  /**
   * Validate response and self-correct if needed
   */
  private async validateAndCorrect(
    response: string, 
    originalRequest: ClaudeRequest, 
    attempt: number = 1
  ): Promise<OpenAIResponse> {
    
    const validation = this.validator.validate(response);

    if (validation.valid) {
      console.log(`✅ Valid response on attempt ${attempt}`);
      return this.validator.parse(response);
    }

    // If validation failed and we haven't exceeded max attempts
    if (attempt < 3) {
      console.log(`❌ Invalid response on attempt ${attempt}, errors:`, validation.errors);
      console.log('🔧 Attempting self-correction...');

      // Create correction request
      const correctionMessage: OpenAIMessage = {
        role: 'user',
        content: `The previous response had format errors: ${validation.errors.join(', ')}. 

Please provide a correctly formatted OpenAI Chat Completions JSON response. Remember:
- Must be valid JSON
- Must include all required fields (id, object, created, model, choices, usage)
- No extra text outside the JSON
- Use exactly this structure with your content in the message.content field`
      };

      const correctionRequest: ClaudeRequest = {
        model: originalRequest.model,
        messages: [
          ...originalRequest.messages,
          { role: 'assistant', content: response },
          correctionMessage
        ]
      };

      const correctedResponse = await this.claudeClient.execute(correctionRequest);
      return this.validateAndCorrect(correctedResponse, originalRequest, attempt + 1);
    }

    // Max attempts exceeded, return error
    throw new Error(`Failed to get valid OpenAI format after ${attempt} attempts. Last errors: ${validation.errors.join(', ')}`);
  }
}