/**
 * Mock OpenAI Client for OpenAI Tools Testing
 * 
 * Provides comprehensive mocking for OpenAI API client interactions
 * supporting all OpenAI tools testing scenarios.
 * 
 * Features:
 * - Configurable API responses for different endpoints
 * - Error injection for testing error handling
 * - Request/response tracking for test verification
 * - Streaming and non-streaming response support
 * - Rate limiting simulation
 * - Authentication and authorization mocking
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// OpenAI API types
export interface OpenAICompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }>;
    tool_call_id?: string;
  }>;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters?: any;
    };
  }>;
  tool_choice?: 'auto' | 'none' | 'required' | {
    type: 'function';
    function: { name: string };
  };
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  [key: string]: any;
}

export interface OpenAICompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'function_call';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'function_call' | null;
  }>;
}

export interface OpenAIModelInfo {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
  permission: any[];
  root: string;
  parent?: string;
}

export interface MockOpenAIClientConfig {
  // API behavior configuration
  baseURL?: string;
  apiKey?: string;
  organization?: string;
  timeout?: number;
  
  // Response configuration
  responses?: {
    completions?: OpenAICompletionResponse[];
    streamChunks?: OpenAIStreamChunk[][];
    models?: OpenAIModelInfo[];
  };
  
  // Error simulation
  errorConfig?: {
    shouldError?: boolean;
    errorType?: 'auth' | 'rate_limit' | 'server' | 'timeout' | 'invalid_request' | 'model_not_found';
    errorMessage?: string;
    errorCode?: number;
    errorDetails?: any;
  };
  
  // Performance simulation
  performanceConfig?: {
    latencyMs?: number;
    shouldTimeout?: boolean;
    timeoutMs?: number;
    rateLimitDelay?: number;
  };
  
  // Tracking configuration
  trackRequests?: boolean;
  trackResponses?: boolean;
  trackHeaders?: boolean;
}

export interface MockRequestInfo {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  timestamp: number;
}

export interface MockResponseInfo {
  status: number;
  headers: Record<string, string>;
  body: any;
  timestamp: number;
  latency: number;
}

/**
 * Mock OpenAI Client
 */
export class MockOpenAIClient {
  private config: MockOpenAIClientConfig;
  private requestHistory: MockRequestInfo[] = [];
  private responseHistory: MockResponseInfo[] = [];
  private callCounts: Map<string, number> = new Map();
  private currentResponseIndex = 0;
  private currentStreamIndex = 0;
  
  constructor(config: MockOpenAIClientConfig = {}) {
    this.config = {
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'mock-api-key',
      timeout: 30000,
      responses: {
        completions: this.getDefaultCompletionResponses(),
        streamChunks: this.getDefaultStreamChunks(),
        models: this.getDefaultModels()
      },
      errorConfig: {
        shouldError: false
      },
      performanceConfig: {
        latencyMs: 100,
        shouldTimeout: false,
        timeoutMs: 30000
      },
      trackRequests: true,
      trackResponses: true,
      trackHeaders: true,
      ...config
    };
  }

  /**
   * Get default completion responses
   */
  private getDefaultCompletionResponses(): OpenAICompletionResponse[] {
    return [
      {
        id: 'chatcmpl-mock-1',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello! How can I help you today?'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 10,
          total_tokens: 30
        }
      },
      {
        id: 'chatcmpl-mock-2',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_mock_1',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "New York", "unit": "celsius"}'
              }
            }]
          },
          finish_reason: 'tool_calls'
        }],
        usage: {
          prompt_tokens: 35,
          completion_tokens: 15,
          total_tokens: 50
        }
      }
    ];
  }

  /**
   * Get default stream chunks
   */
  private getDefaultStreamChunks(): OpenAIStreamChunk[][] {
    return [
      [
        {
          id: 'chatcmpl-mock-stream-1',
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: 'gpt-4',
          choices: [{
            index: 0,
            delta: { role: 'assistant' },
            finish_reason: null
          }]
        },
        {
          id: 'chatcmpl-mock-stream-1',
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: 'gpt-4',
          choices: [{
            index: 0,
            delta: { content: 'Hello' },
            finish_reason: null
          }]
        },
        {
          id: 'chatcmpl-mock-stream-1',
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: 'gpt-4',
          choices: [{
            index: 0,
            delta: { content: '! How can I help you?' },
            finish_reason: null
          }]
        },
        {
          id: 'chatcmpl-mock-stream-1',
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: 'gpt-4',
          choices: [{
            index: 0,
            delta: {},
            finish_reason: 'stop'
          }]
        }
      ]
    ];
  }

  /**
   * Get default models
   */
  private getDefaultModels(): OpenAIModelInfo[] {
    return [
      {
        id: 'gpt-4',
        object: 'model',
        created: 1677610602,
        owned_by: 'openai',
        permission: [],
        root: 'gpt-4'
      },
      {
        id: 'gpt-4-turbo',
        object: 'model',
        created: 1677610602,
        owned_by: 'openai',
        permission: [],
        root: 'gpt-4-turbo'
      },
      {
        id: 'gpt-3.5-turbo',
        object: 'model',
        created: 1677610602,
        owned_by: 'openai',
        permission: [],
        root: 'gpt-3.5-turbo'
      }
    ];
  }

  /**
   * Simulate network latency and potential failures
   */
  private async simulateNetworkBehavior(): Promise<void> {
    const { latencyMs = 100, shouldTimeout = false, timeoutMs = 30000, rateLimitDelay = 0 } = this.config.performanceConfig || {};
    
    if (shouldTimeout) {
      throw new Error('Request timeout');
    }
    
    if (rateLimitDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, rateLimitDelay));
    }
    
    if (latencyMs > 0) {
      await new Promise(resolve => setTimeout(resolve, latencyMs));
    }
  }

  /**
   * Handle configured errors
   */
  private handleError(): void {
    const { shouldError, errorType, errorMessage, errorCode, errorDetails } = this.config.errorConfig || {};
    
    if (shouldError) {
      const error = new Error(errorMessage || 'Mock API error');
      
      switch (errorType) {
        case 'auth':
          (error as any).status = 401;
          (error as any).type = 'invalid_request_error';
          break;
        case 'rate_limit':
          (error as any).status = 429;
          (error as any).type = 'rate_limit_error';
          break;
        case 'server':
          (error as any).status = 500;
          (error as any).type = 'server_error';
          break;
        case 'timeout':
          (error as any).status = 408;
          (error as any).type = 'timeout_error';
          break;
        case 'invalid_request':
          (error as any).status = 400;
          (error as any).type = 'invalid_request_error';
          break;
        case 'model_not_found':
          (error as any).status = 404;
          (error as any).type = 'model_not_found_error';
          break;
        default:
          (error as any).status = errorCode || 500;
          (error as any).type = 'api_error';
      }
      
      if (errorDetails) {
        (error as any).details = errorDetails;
      }
      
      throw error;
    }
  }

  /**
   * Track requests and responses
   */
  private trackRequest(method: string, url: string, headers: Record<string, string>, body?: any): void {
    if (!this.config.trackRequests) return;
    
    this.requestHistory.push({
      method,
      url,
      headers: this.config.trackHeaders ? headers : {},
      body,
      timestamp: Date.now()
    });
    
    const endpoint = `${method} ${url}`;
    this.callCounts.set(endpoint, (this.callCounts.get(endpoint) || 0) + 1);
  }

  private trackResponse(status: number, headers: Record<string, string>, body: any, latency: number): void {
    if (!this.config.trackResponses) return;
    
    this.responseHistory.push({
      status,
      headers: this.config.trackHeaders ? headers : {},
      body,
      timestamp: Date.now(),
      latency
    });
  }

  /**
   * Chat Completions API
   */
  async createChatCompletion(request: OpenAICompletionRequest): Promise<OpenAICompletionResponse> {
    const startTime = Date.now();
    
    try {
      this.trackRequest('POST', '/v1/chat/completions', {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }, request);
      
      await this.simulateNetworkBehavior();
      this.handleError();
      
      const responses = this.config.responses?.completions || [];
      const response = responses[this.currentResponseIndex % responses.length];
      this.currentResponseIndex++;
      
      // Apply request-specific modifications
      const modifiedResponse: OpenAICompletionResponse = {
        ...response,
        id: `chatcmpl-mock-${Date.now()}`,
        created: Math.floor(Date.now() / 1000),
        model: request.model
      };
      
      // If request has tools, potentially return tool calls
      if (request.tools && request.tools.length > 0 && Math.random() > 0.5) {
        modifiedResponse.choices[0].message.content = null;
        modifiedResponse.choices[0].message.tool_calls = [{
          id: `call_mock_${Date.now()}`,
          type: 'function',
          function: {
            name: request.tools[0].function.name,
            arguments: JSON.stringify({ mock: 'parameters' })
          }
        }];
        modifiedResponse.choices[0].finish_reason = 'tool_calls';
      }
      
      const latency = Date.now() - startTime;
      this.trackResponse(200, { 'Content-Type': 'application/json' }, modifiedResponse, latency);
      
      return modifiedResponse;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.trackResponse((error as any).status || 500, {}, error, latency);
      throw error;
    }
  }

  /**
   * Streaming Chat Completions API
   */
  async *createChatCompletionStream(request: OpenAICompletionRequest): AsyncGenerator<OpenAIStreamChunk, void, unknown> {
    const startTime = Date.now();
    
    try {
      this.trackRequest('POST', '/v1/chat/completions', {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }, { ...request, stream: true });
      
      await this.simulateNetworkBehavior();
      this.handleError();
      
      const streamChunks = this.config.responses?.streamChunks || [];
      const chunks = streamChunks[this.currentStreamIndex % streamChunks.length];
      this.currentStreamIndex++;
      
      // Simulate streaming delay
      for (const chunk of chunks) {
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const modifiedChunk: OpenAIStreamChunk = {
          ...chunk,
          id: `chatcmpl-mock-stream-${Date.now()}`,
          created: Math.floor(Date.now() / 1000),
          model: request.model
        };
        
        yield modifiedChunk;
      }
      
      const latency = Date.now() - startTime;
      this.trackResponse(200, { 'Content-Type': 'text/event-stream' }, 'stream', latency);
      
    } catch (error) {
      const latency = Date.now() - startTime;
      this.trackResponse((error as any).status || 500, {}, error, latency);
      throw error;
    }
  }

  /**
   * Models API
   */
  async listModels(): Promise<{ data: OpenAIModelInfo[]; object: 'list' }> {
    const startTime = Date.now();
    
    try {
      this.trackRequest('GET', '/v1/models', {
        'Authorization': `Bearer ${this.config.apiKey}`
      });
      
      await this.simulateNetworkBehavior();
      this.handleError();
      
      const models = this.config.responses?.models || [];
      const response = {
        data: models,
        object: 'list' as const
      };
      
      const latency = Date.now() - startTime;
      this.trackResponse(200, { 'Content-Type': 'application/json' }, response, latency);
      
      return response;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.trackResponse((error as any).status || 500, {}, error, latency);
      throw error;
    }
  }

  /**
   * Get specific model
   */
  async retrieveModel(modelId: string): Promise<OpenAIModelInfo> {
    const startTime = Date.now();
    
    try {
      this.trackRequest('GET', `/v1/models/${modelId}`, {
        'Authorization': `Bearer ${this.config.apiKey}`
      });
      
      await this.simulateNetworkBehavior();
      this.handleError();
      
      const models = this.config.responses?.models || [];
      const model = models.find(m => m.id === modelId);
      
      if (!model) {
        const error = new Error(`Model '${modelId}' not found`);
        (error as any).status = 404;
        (error as any).type = 'model_not_found_error';
        throw error;
      }
      
      const latency = Date.now() - startTime;
      this.trackResponse(200, { 'Content-Type': 'application/json' }, model, latency);
      
      return model;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.trackResponse((error as any).status || 500, {}, error, latency);
      throw error;
    }
  }

  // Test utilities
  getRequestHistory(): MockRequestInfo[] {
    return [...this.requestHistory];
  }

  getResponseHistory(): MockResponseInfo[] {
    return [...this.responseHistory];
  }

  getCallCount(endpoint?: string): number {
    if (endpoint) {
      return this.callCounts.get(endpoint) || 0;
    }
    return this.requestHistory.length;
  }

  getLastRequest(): MockRequestInfo | undefined {
    return this.requestHistory[this.requestHistory.length - 1];
  }

  getLastResponse(): MockResponseInfo | undefined {
    return this.responseHistory[this.responseHistory.length - 1];
  }

  clearHistory(): void {
    this.requestHistory = [];
    this.responseHistory = [];
    this.callCounts.clear();
  }

  updateConfig(config: Partial<MockOpenAIClientConfig>): void {
    this.config = { ...this.config, ...config };
  }

  reset(): void {
    this.clearHistory();
    this.currentResponseIndex = 0;
    this.currentStreamIndex = 0;
    this.config = {
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'mock-api-key',
      timeout: 30000,
      responses: {
        completions: this.getDefaultCompletionResponses(),
        streamChunks: this.getDefaultStreamChunks(),
        models: this.getDefaultModels()
      },
      errorConfig: {
        shouldError: false
      },
      performanceConfig: {
        latencyMs: 100,
        shouldTimeout: false,
        timeoutMs: 30000
      },
      trackRequests: true,
      trackResponses: true,
      trackHeaders: true
    };
  }
}

/**
 * Factory functions for creating mock clients with common configurations
 */
export const createMockOpenAIClient = {
  /**
   * Create a mock client that always succeeds
   */
  successful: (config?: Partial<MockOpenAIClientConfig>) =>
    new MockOpenAIClient({
      errorConfig: { shouldError: false },
      ...config
    }),

  /**
   * Create a mock client that simulates authentication errors
   */
  authError: (config?: Partial<MockOpenAIClientConfig>) =>
    new MockOpenAIClient({
      errorConfig: { shouldError: true, errorType: 'auth', errorMessage: 'Invalid API key' },
      ...config
    }),

  /**
   * Create a mock client that simulates rate limiting
   */
  rateLimited: (config?: Partial<MockOpenAIClientConfig>) =>
    new MockOpenAIClient({
      errorConfig: { shouldError: true, errorType: 'rate_limit', errorMessage: 'Rate limit exceeded' },
      performanceConfig: { rateLimitDelay: 1000 },
      ...config
    }),

  /**
   * Create a mock client with custom latency
   */
  withLatency: (latencyMs: number, config?: Partial<MockOpenAIClientConfig>) =>
    new MockOpenAIClient({
      performanceConfig: { latencyMs },
      ...config
    }),

  /**
   * Create a mock client that simulates timeouts
   */
  withTimeouts: (config?: Partial<MockOpenAIClientConfig>) =>
    new MockOpenAIClient({
      performanceConfig: { shouldTimeout: true },
      ...config
    }),

  /**
   * Create a mock client that only returns tool calls
   */
  toolCallsOnly: (config?: Partial<MockOpenAIClientConfig>) =>
    new MockOpenAIClient({
      responses: {
        completions: [{
          id: 'chatcmpl-tool-call',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: 'call_test_tool',
                type: 'function',
                function: {
                  name: 'test_function',
                  arguments: '{"test": "parameter"}'
                }
              }]
            },
            finish_reason: 'tool_calls'
          }],
          usage: {
            prompt_tokens: 30,
            completion_tokens: 20,
            total_tokens: 50
          }
        }]
      },
      ...config
    }),

  /**
   * Create a lightweight mock client (no tracking)
   */
  lightweight: (config?: Partial<MockOpenAIClientConfig>) =>
    new MockOpenAIClient({
      trackRequests: false,
      trackResponses: false,
      trackHeaders: false,
      ...config
    })
};

/**
 * Jest mock factory for automatic mocking
 */
export const createJestMockOpenAIClient = (config?: MockOpenAIClientConfig) => {
  const client = new MockOpenAIClient(config);
  
  return {
    chat: {
      completions: {
        create: jest.fn().mockImplementation(client.createChatCompletion.bind(client)),
        stream: jest.fn().mockImplementation(client.createChatCompletionStream.bind(client))
      }
    },
    models: {
      list: jest.fn().mockImplementation(client.listModels.bind(client)),
      retrieve: jest.fn().mockImplementation(client.retrieveModel.bind(client))
    },
    
    // Test utilities
    getRequestHistory: jest.fn().mockImplementation(client.getRequestHistory.bind(client)),
    getResponseHistory: jest.fn().mockImplementation(client.getResponseHistory.bind(client)),
    getCallCount: jest.fn().mockImplementation(client.getCallCount.bind(client)),
    getLastRequest: jest.fn().mockImplementation(client.getLastRequest.bind(client)),
    getLastResponse: jest.fn().mockImplementation(client.getLastResponse.bind(client)),
    clearHistory: jest.fn().mockImplementation(client.clearHistory.bind(client)),
    updateConfig: jest.fn().mockImplementation(client.updateConfig.bind(client)),
    reset: jest.fn().mockImplementation(client.reset.bind(client))
  };
};

/**
 * Mock OpenAI Stream Response
 */
export class MockOpenAIStreamResponse extends EventEmitter {
  private chunks: OpenAIStreamChunk[];
  private currentIndex = 0;
  private interval?: NodeJS.Timeout;
  
  constructor(chunks: OpenAIStreamChunk[]) {
    super();
    this.chunks = chunks;
  }
  
  async *[Symbol.asyncIterator](): AsyncGenerator<OpenAIStreamChunk, void, unknown> {
    for (const chunk of this.chunks) {
      await new Promise(resolve => setTimeout(resolve, 50));
      yield chunk;
    }
  }
  
  start(intervalMs: number = 100): void {
    this.interval = setInterval(() => {
      if (this.currentIndex < this.chunks.length) {
        this.emit('data', this.chunks[this.currentIndex]);
        this.currentIndex++;
      } else {
        this.emit('end');
        if (this.interval) {
          clearInterval(this.interval);
        }
      }
    }, intervalMs);
  }
  
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.emit('end');
  }
}

export default MockOpenAIClient;