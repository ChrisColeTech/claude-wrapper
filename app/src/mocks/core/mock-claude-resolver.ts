/**
 * Enhanced Mock Claude Resolver
 * Provides sophisticated Claude CLI simulation with template-based responses
 */

import { MockConfigManager } from '../../config/mock-config';
import { EnhancedResponseGenerator } from './enhanced-response-generator';
import { logger } from '../../utils/logger';

interface ExecutionHistoryEntry {
  prompt: string;
  model: string;
  sessionId: string | null;
  timestamp: Date;
  response: string;
  category?: string;
  responseTime?: number;
}

interface OpenAIRequest {
  messages: Array<{
    role: string;
    content: string;
    tool_calls?: any[];
  }>;
  model?: string;
  tools?: any[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export class MockClaudeResolver {
  private static instance: MockClaudeResolver;
  private claudePath = '/mock/path/to/claude';
  private executionHistory: ExecutionHistoryEntry[] = [];
  private responseGenerator: EnhancedResponseGenerator;

  private constructor() {
    this.responseGenerator = EnhancedResponseGenerator.getInstance();
  }

  static getInstance(): MockClaudeResolver {
    if (!this.instance) {
      this.instance = new MockClaudeResolver();
    }
    return this.instance;
  }

  /**
   * Mock Claude command discovery
   */
  async findClaudeCommand(): Promise<string> {
    logger.debug('🎭 MockClaudeResolver: Finding Claude command (mock)');
    
    const delay = MockConfigManager.getRandomDelay();
    await this.delay(delay);
    
    return this.claudePath;
  }

  /**
   * Execute Claude command with enhanced response generation
   */
  async executeCommand(
    prompt: string,
    model: string,
    sessionId?: string,
    isStreaming: boolean = false
  ): Promise<string> {
    logger.debug(`🎭 MockClaudeResolver: Executing command (mock) - Model: ${model}, Session: ${sessionId}`);

    // Check for error simulation
    if (MockConfigManager.shouldSimulateError()) {
      const errorType = MockConfigManager.getRandomErrorType();
      throw this.createMockError(errorType);
    }

    const startTime = Date.now();
    const delay = MockConfigManager.getRandomDelay();
    await this.delay(delay);

    // Create OpenAI-style request for enhanced generator
    const request: OpenAIRequest = {
      messages: [{ role: 'user', content: prompt }],
      model: model || 'sonnet',
      stream: isStreaming
    };

    // Generate enhanced response
    const template = await this.responseGenerator.generateResponse(request, sessionId);
    
    const responseTime = Date.now() - startTime;
    const content = template.content || this.createDefaultResponse(prompt);

    // Format as Claude CLI JSON response
    const claudeResponse = {
      type: 'result',
      subtype: 'success',
      is_error: false,
      duration_ms: responseTime,
      duration_api_ms: Math.floor(responseTime * 0.6),
      num_turns: 1,
      result: content,
      session_id: `mock-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      total_cost_usd: 0.001,
      usage: template.tokenUsage ? {
        input_tokens: template.tokenUsage.prompt_tokens,
        output_tokens: template.tokenUsage.completion_tokens,
        server_tool_use: { web_search_requests: 0 },
        service_tier: 'standard'
      } : {
        input_tokens: Math.ceil(prompt.length / 4),
        output_tokens: Math.ceil(content.length / 4),
        server_tool_use: { web_search_requests: 0 },
        service_tier: 'standard'
      }
    };

    const response = JSON.stringify(claudeResponse);

    // Add to execution history
    this.executionHistory.push({
      prompt,
      model,
      sessionId: sessionId || null,
      timestamp: new Date(),
      response: content,
      responseTime
    });

    logger.debug(`🎭 MockClaudeResolver: Generated enhanced response (${content.length} chars) in ${responseTime}ms`);
    
    return response;
  }

  /**
   * Execute streaming command with enhanced response generation
   */
  async executeCommandStreaming(
    prompt: string,
    model: string,
    sessionId?: string
  ): Promise<NodeJS.ReadableStream> {
    logger.debug(`🎭 MockClaudeResolver: Streaming execution (mock) - Model: ${model}`);

    // Create OpenAI-style request
    const request: OpenAIRequest = {
      messages: [{ role: 'user', content: prompt }],
      model: model || 'sonnet',
      stream: true
    };

    // Generate enhanced streaming response
    const template = await this.responseGenerator.generateStreamingResponse(request, sessionId);
    
    const content = template.content || this.createDefaultResponse(prompt);
    const chunks = template.streamingChunks || this.createStreamingChunks(content);

    return this.createMockStream(chunks);
  }

  /**
   * Execute Claude command with session context and JSON output option
   */
  async executeClaudeCommandWithSession(
    prompt: string,
    model: string,
    sessionId?: string,
    useJsonOutput: boolean = false
  ): Promise<string> {
    logger.debug(`🎭 MockClaudeResolver: Session execution (mock) - JSON: ${useJsonOutput}`);

    const response = await this.executeCommand(prompt, model, sessionId);
    
    if (useJsonOutput) {
      return this.ensureJsonFormat(response);
    }
    
    return response;
  }

  /**
   * Execute Claude command with file-based system prompt for session creation
   * Used for single-stage session initialization
   */
  async executeCommandWithFileForSession(
    prompt: string,
    model: string,
    systemPromptFilePath: string
  ): Promise<string> {
    logger.debug(`🎭 MockClaudeResolver: File-based session creation (mock) - File: ${systemPromptFilePath}`);

    // In mock mode, we simulate reading the system prompt file
    // and creating a session with it
    const startTime = Date.now();
    const delay = MockConfigManager.getRandomDelay();
    await this.delay(delay);

    // Create OpenAI-style request with system prompt simulation
    const request: OpenAIRequest = {
      messages: [
        { role: 'system', content: `[Mock system prompt from ${systemPromptFilePath}]` },
        { role: 'user', content: prompt }
      ],
      model: model || 'sonnet'
    };

    // Generate enhanced response
    const template = await this.responseGenerator.generateResponse(request, undefined);
    
    const responseTime = Date.now() - startTime;
    const content = template.content || this.createDefaultResponse(prompt);
    const sessionId = `mock-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Format as Claude CLI JSON response with session ID
    const claudeResponse = {
      type: 'result',
      subtype: 'success',
      is_error: false,
      duration_ms: responseTime,
      duration_api_ms: Math.floor(responseTime * 0.6),
      num_turns: 1,
      result: content,
      session_id: sessionId,
      total_cost_usd: 0.001,
      usage: template.tokenUsage ? {
        input_tokens: template.tokenUsage.prompt_tokens,
        output_tokens: template.tokenUsage.completion_tokens,
        server_tool_use: { web_search_requests: 0 },
        service_tier: 'standard'
      } : {
        input_tokens: Math.ceil(prompt.length / 4),
        output_tokens: Math.ceil(content.length / 4),
        server_tool_use: { web_search_requests: 0 },
        service_tier: 'standard'
      }
    };

    const response = JSON.stringify(claudeResponse);

    // Add to execution history
    this.executionHistory.push({
      prompt,
      model,
      sessionId,
      timestamp: new Date(),
      response: content,
      responseTime
    });

    logger.debug(`🎭 MockClaudeResolver: Created mock session ${sessionId} with file-based system prompt`);
    
    return response;
  }

  /**
   * Execute OpenAI-compatible request
   */
  async executeOpenAIRequest(request: OpenAIRequest, sessionId?: string): Promise<any> {
    logger.debug('🎭 MockClaudeResolver: OpenAI request execution (mock)');

    // Check for error simulation
    if (MockConfigManager.shouldSimulateError()) {
      const errorType = MockConfigManager.getRandomErrorType();
      throw this.createMockError(errorType);
    }

    const delay = MockConfigManager.getRandomDelay();
    await this.delay(delay);

    // Generate enhanced response
    const template = await this.responseGenerator.generateResponse(request, sessionId);

    // Handle tool calls
    if (template.toolCalls && template.toolCalls.length > 0) {
      return this.formatToolCallResponse(template, request);
    }

    // Handle error responses
    if (template.shouldError) {
      throw this.createMockError(template.errorType || 'system');
    }

    // Format as OpenAI response
    return this.formatOpenAIResponse(template, request);
  }

  /**
   * Execute streaming OpenAI-compatible request
   */
  async executeOpenAIStreamingRequest(request: OpenAIRequest, sessionId?: string): Promise<NodeJS.ReadableStream> {
    logger.debug('🎭 MockClaudeResolver: OpenAI streaming request execution (mock)');

    const template = await this.responseGenerator.generateStreamingResponse(request, sessionId);
    const content = template.content || this.createDefaultResponse(request.messages[request.messages.length - 1]?.content || '');
    const chunks = template.streamingChunks || this.createStreamingChunks(content);

    return this.createOpenAIStreamingResponse(chunks, request.model || 'sonnet');
  }

  /**
   * Check if Claude CLI is available (always true in mock mode)
   */
  async isClaudeAvailable(): Promise<boolean> {
    logger.debug('🎭 MockClaudeResolver: Checking Claude availability (mock)');
    return true;
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): ExecutionHistoryEntry[] {
    return [...this.executionHistory];
  }

  /**
   * Get response generation statistics
   */
  getStats(): any {
    return {
      executions: this.executionHistory.length,
      responseGenerator: this.responseGenerator.getStats(),
      config: MockConfigManager.getConfig()
    };
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
    this.responseGenerator.clearHistory();
    logger.debug('🎭 MockClaudeResolver: Execution history cleared');
  }

  /**
   * Private helper methods
   */
  private createDefaultResponse(prompt: string): string {
    return `Mock response for: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`;
  }

  private createStreamingChunks(content: string): string[] {
    const chunkSize = 50;
    const chunks: string[] = [];
    
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.substring(i, i + chunkSize));
    }
    
    return chunks;
  }

  private formatOpenAIResponse(template: any, request: OpenAIRequest): any {
    return {
      id: template.id,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: request.model || 'sonnet',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: template.content,
          tool_calls: template.toolCalls
        },
        finish_reason: template.finishReason
      }],
      usage: template.tokenUsage || this.calculateTokenUsage(request, template.content || '')
    };
  }

  private formatToolCallResponse(template: any, request: OpenAIRequest): any {
    return {
      id: template.id,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: request.model || 'sonnet',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: template.content,
          tool_calls: template.toolCalls
        },
        finish_reason: 'tool_calls'
      }],
      usage: template.tokenUsage || this.calculateTokenUsage(request, '')
    };
  }

  private calculateTokenUsage(request: OpenAIRequest, response: string): any {
    const promptText = request.messages.map(m => m.content).join(' ');
    const promptTokens = Math.ceil(promptText.length / 4);
    const completionTokens = Math.ceil(response.length / 4);
    
    return {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens
    };
  }

  private createMockStream(chunks: string[]): NodeJS.ReadableStream {
    const { Readable } = require('stream');
    let chunkIndex = 0;

    return new Readable({
      read() {
        if (chunkIndex < chunks.length) {
          setTimeout(() => {
            // Format as Claude CLI streaming format that handler expects
            const claudeChunk = {
              type: 'assistant',
              message: {
                content: [{
                  type: 'text',
                  text: chunks[chunkIndex]
                }]
              },
              session_id: `mock-session-${Date.now()}`
            };
            this.push(JSON.stringify(claudeChunk) + '\n');
            chunkIndex++;
          }, 100);
        } else {
          // Send final completion chunk
          const finalChunk = {
            type: 'result',
            subtype: 'success',
            session_id: `mock-session-${Date.now()}`
          };
          this.push(JSON.stringify(finalChunk) + '\n');
          this.push(null); // End stream
        }
      }
    });
  }

  private createOpenAIStreamingResponse(chunks: string[], model: string): NodeJS.ReadableStream {
    const { Readable } = require('stream');
    let chunkIndex = 0;

    return new Readable({
      read() {
        if (chunkIndex < chunks.length) {
          setTimeout(() => {
            const chunk = {
              id: `chatcmpl-mock-${Date.now()}`,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{
                index: 0,
                delta: { content: chunks[chunkIndex] },
                finish_reason: null
              }]
            };
            this.push(`data: ${JSON.stringify(chunk)}\n\n`);
            chunkIndex++;
          }, 50);
        } else {
          // Send final chunk
          const finalChunk = {
            id: `chatcmpl-mock-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{
              index: 0,
              delta: {},
              finish_reason: 'stop'
            }]
          };
          this.push(`data: ${JSON.stringify(finalChunk)}\n\n`);
          this.push('data: [DONE]\n\n');
          this.push(null);
        }
      }
    });
  }

  private ensureJsonFormat(response: string): string {
    try {
      JSON.parse(response);
      return response;
    } catch {
      return JSON.stringify({
        id: `chatcmpl-mock-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'sonnet',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: response
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: Math.ceil(response.length * 0.25),
          completion_tokens: Math.ceil(response.length / 4),
          total_tokens: Math.ceil(response.length * 1.25 / 4)
        }
      }, null, 2);
    }
  }

  private createMockError(errorType: string): Error {
    const errorMessages = {
      timeout: 'Mock timeout: Claude CLI operation timed out (simulated)',
      validation: 'Mock validation error: Invalid request format (simulated)',
      cli_error: 'Mock CLI error: Claude command execution failed (simulated)',
      network: 'Mock network error: Connection failed (simulated)',
      system: 'Mock system error: Internal server error (simulated)'
    };

    const message = errorMessages[errorType as keyof typeof errorMessages] || 
                    `Mock error: Unknown error type ${errorType} (simulated)`;
    
    return new Error(message);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}