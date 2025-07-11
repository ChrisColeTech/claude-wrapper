import { 
  IStreamingFormatter, 
  IStreamingManager, 
  ICoreWrapper,
  OpenAIStreamingResponse,
  StreamConnection,
  OpenAIRequest,
  OpenAIResponse 
} from '../../src/types';

/**
 * Mock Express Response for streaming tests
 */
export class MockExpressResponse {
  public headersSent = false;
  public headers: { [key: string]: string } = {};
  public statusCode = 200;
  public chunks: string[] = [];
  private eventListeners: { [event: string]: Function[] } = {};

  writeHead(statusCode: number, headers: { [key: string]: string }) {
    this.statusCode = statusCode;
    this.headers = { ...headers };
  }

  write(chunk: string) {
    this.chunks.push(chunk);
  }

  end() {
    this.headersSent = true;
    this.emit('finish');
  }

  on(event: string, listener: Function) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(listener);
  }

  emit(event: string, ...args: any[]) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(listener => listener(...args));
    }
  }

  reset() {
    this.headersSent = false;
    this.headers = {};
    this.statusCode = 200;
    this.chunks = [];
    this.eventListeners = {};
  }
}

/**
 * Mock StreamingFormatter
 */
export class MockStreamingFormatter implements IStreamingFormatter {
  public formatChunkCalls: OpenAIStreamingResponse[] = [];
  public formatErrorCalls: Error[] = [];
  public formatDoneCalls: number = 0;
  public formatInitialChunkCalls: Array<{requestId: string, model: string}> = [];
  public createContentChunkCalls: Array<{requestId: string, model: string, content: string}> = [];
  public createFinalChunkCalls: Array<{requestId: string, model: string, finishReason?: string}> = [];

  formatChunk(chunk: OpenAIStreamingResponse): string {
    this.formatChunkCalls.push(chunk);
    return `data: ${JSON.stringify(chunk)}\n\n`;
  }

  formatError(error: Error): string {
    this.formatErrorCalls.push(error);
    return `data: {"error": "${error.message}"}\n\n`;
  }

  formatDone(): string {
    this.formatDoneCalls++;
    return 'data: [DONE]\n\n';
  }

  formatInitialChunk(requestId: string, model: string): string {
    this.formatInitialChunkCalls.push({ requestId, model });
    return `data: {"id":"${requestId}","model":"${model}","choices":[{"delta":{"role":"assistant"}}]}\n\n`;
  }

  createContentChunk(requestId: string, model: string, content: string): string {
    this.createContentChunkCalls.push({ requestId, model, content });
    return `data: {"id":"${requestId}","model":"${model}","choices":[{"delta":{"content":"${content}"}}]}\n\n`;
  }

  createFinalChunk(requestId: string, model: string, finishReason: string = 'stop'): string {
    this.createFinalChunkCalls.push({ requestId, model, finishReason });
    return `data: {"id":"${requestId}","model":"${model}","choices":[{"delta":{},"finish_reason":"${finishReason}"}]}\n\n`;
  }

  reset() {
    this.formatChunkCalls = [];
    this.formatErrorCalls = [];
    this.formatDoneCalls = 0;
    this.formatInitialChunkCalls = [];
    this.createContentChunkCalls = [];
    this.createFinalChunkCalls = [];
  }
}

/**
 * Mock StreamingManager
 */
export class MockStreamingManager implements IStreamingManager {
  public connections: Map<string, StreamConnection> = new Map();
  public createConnectionCalls: Array<{id: string, response: any}> = [];
  public getConnectionCalls: string[] = [];
  public closeConnectionCalls: string[] = [];
  public cleanupCalls: number = 0;
  public shutdownCalls: number = 0;

  createConnection(id: string, response: any): void {
    this.createConnectionCalls.push({ id, response });
    this.connections.set(id, {
      id,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true,
      response
    });
  }

  getConnection(id: string): StreamConnection | null {
    this.getConnectionCalls.push(id);
    const connection = this.connections.get(id);
    if (connection) {
      connection.lastActivity = new Date();
      return connection;
    }
    return null;
  }

  closeConnection(id: string): boolean {
    this.closeConnectionCalls.push(id);
    return this.connections.delete(id);
  }

  cleanup(): void {
    this.cleanupCalls++;
  }

  getActiveConnections(): number {
    return this.connections.size;
  }

  shutdown(): void {
    this.shutdownCalls++;
    this.connections.clear();
  }

  reset() {
    this.connections.clear();
    this.createConnectionCalls = [];
    this.getConnectionCalls = [];
    this.closeConnectionCalls = [];
    this.cleanupCalls = 0;
    this.shutdownCalls = 0;
  }
}

/**
 * Mock CoreWrapper
 */
export class MockCoreWrapper implements ICoreWrapper {
  public handleChatCompletionCalls: OpenAIRequest[] = [];
  public handleStreamingChatCompletionCalls: OpenAIRequest[] = [];
  public shouldThrowError: boolean = false;
  public errorToThrow: Error | null = null;
  public mockResponse: OpenAIResponse = {
    id: 'chatcmpl-mock123',
    object: 'chat.completion',
    created: 1234567890,
    model: 'sonnet',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: 'Mock response content' },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 15,
      total_tokens: 25
    }
  };

  async handleChatCompletion(request: OpenAIRequest): Promise<OpenAIResponse> {
    this.handleChatCompletionCalls.push(request);
    if (this.shouldThrowError && this.errorToThrow) {
      throw this.errorToThrow;
    }
    return this.mockResponse;
  }

  async handleStreamingChatCompletion(request: OpenAIRequest): Promise<NodeJS.ReadableStream> {
    this.handleStreamingChatCompletionCalls.push(request);
    if (this.shouldThrowError && this.errorToThrow) {
      throw this.errorToThrow;
    }
    
    // Create a mock readable stream
    const { Readable } = require('stream');
    const mockStream = new Readable({
      read() {
        this.push('{"type":"assistant","message":{"content":[{"type":"text","text":"test"}]}}\n');
        this.push('{"type":"assistant","message":{"content":[{"type":"text","text":"content"}]}}\n');
        this.push(null);
      }
    });
    
    return mockStream;
  }

  setMockResponse(response: OpenAIResponse) {
    this.mockResponse = response;
  }

  reset() {
    this.handleChatCompletionCalls = [];
    this.handleStreamingChatCompletionCalls = [];
    this.shouldThrowError = false;
    this.errorToThrow = null;
    this.mockResponse = {
      id: 'chatcmpl-mock123',
      object: 'chat.completion',
      created: 1234567890,
      model: 'sonnet',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: 'Mock response content' },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 15,
        total_tokens: 25
      }
    };
  }
}

/**
 * Test data factory
 */
export class StreamingTestDataFactory {
  static createValidRequest(): OpenAIRequest {
    return {
      model: 'sonnet',
      messages: [
        { role: 'user', content: 'Test message' }
      ],
      stream: true
    };
  }

  static createValidResponse(): OpenAIResponse {
    return {
      id: 'chatcmpl-test123',
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'sonnet',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: 'Test response content' },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 15,
        total_tokens: 25
      }
    };
  }

  static createStreamingResponse(id: string = 'test-id', model: string = 'sonnet'): OpenAIStreamingResponse {
    return {
      id,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        delta: { content: 'test content' },
        finish_reason: null
      }]
    };
  }

  static createStreamConnection(id: string = 'test-connection'): StreamConnection {
    return {
      id,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true,
      response: new MockExpressResponse()
    };
  }
}