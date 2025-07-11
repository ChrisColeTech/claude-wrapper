import { Response } from 'express';
import { 
  IStreamingHandler, 
  IStreamingFormatter, 
  IStreamingManager,
  ICoreWrapper,
  OpenAIRequest
} from '../types';
import { StreamingFormatter } from './formatter';
import { StreamingManager } from './manager';
import { CoreWrapper } from '../core/wrapper';
import { 
  SSE_CONFIG, 
  API_CONSTANTS
} from '../config/constants';
import { logger } from '../utils/logger';

/**
 * StreamingHandler - Handles streaming chat completions
 * Single Responsibility: Coordinate streaming response flow
 * Max 200 lines, functions under 50 lines (SOLID compliance)
 */
export class StreamingHandler implements IStreamingHandler {
  private formatter: IStreamingFormatter;
  private manager: IStreamingManager;
  private coreWrapper: ICoreWrapper;

  constructor(
    formatter?: IStreamingFormatter,
    manager?: IStreamingManager,
    coreWrapper?: ICoreWrapper
  ) {
    this.formatter = formatter || new StreamingFormatter();
    this.manager = manager || new StreamingManager();
    this.coreWrapper = coreWrapper || new CoreWrapper();
  }

  /**
   * Handle streaming request with SSE
   */
  async handleStreamingRequest(request: OpenAIRequest, response: Response): Promise<void> {
    const requestId = this.generateRequestId();
    
    try {
      // Setup SSE headers
      this.setupStreamingHeaders(response);
      
      // Create connection for management
      this.manager.createConnection(requestId, response);
      
      logger.info('Starting streaming response', { 
        requestId, 
        model: request.model,
        messageCount: request.messages.length 
      });

      // Generate and stream response
      const startTime = Date.now();
      let firstChunkSent = false;

      for await (const chunk of this.createStreamingResponse(request)) {
        // Track timing for first chunk
        if (!firstChunkSent) {
          const firstChunkTime = Date.now() - startTime;
          logger.debug('First streaming chunk sent', { 
            requestId, 
            timing: `${firstChunkTime}ms` 
          });
          firstChunkSent = true;
        }

        // Send chunk to client
        response.write(chunk);
        
        // Check if connection is still active
        const connection = this.manager.getConnection(requestId);
        if (!connection || !connection.isActive) {
          break;
        }
      }

      // Close connection
      this.manager.closeConnection(requestId);
      
      const totalTime = Date.now() - startTime;
      logger.info('Streaming response completed', { 
        requestId, 
        totalTime: `${totalTime}ms` 
      });

    } catch (error) {
      logger.error('Streaming request failed', error instanceof Error ? error : new Error(String(error)), { requestId });
      
      // Send error and cleanup
      response.write(this.formatter.formatError(error instanceof Error ? error : new Error(String(error))));
      this.manager.closeConnection(requestId);
    }
  }

  /**
   * Create streaming response generator
   */
  async* createStreamingResponse(request: OpenAIRequest): AsyncGenerator<string, void, unknown> {
    const requestId = this.generateRequestId();
    
    try {
      // Send initial chunk with role
      yield this.formatter.formatInitialChunk(requestId, request.model);
      
      // Get real streaming response from Claude CLI
      logger.debug('Streaming: About to call handleStreamingChatCompletion', { requestId });
      
      // Create modified request with stream=false for core wrapper
      const modifiedRequest = { ...request, stream: false };
      const streamingResponse = await this.coreWrapper.handleStreamingChatCompletion(modifiedRequest);
      logger.debug('Streaming: Got streaming response', { requestId });

      // Process streaming JSON chunks
      yield* this.processStreamingResponse(requestId, request.model, streamingResponse);
      
      // Send final chunk
      yield this.formatter.createFinalChunk(requestId, request.model);
      yield this.formatter.formatDone();

    } catch (error) {
      logger.error('Error creating streaming response', error instanceof Error ? error : new Error(String(error)));
      yield this.formatter.formatError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Process real streaming JSON chunks from Claude CLI
   */
  private async* processStreamingResponse(
    requestId: string,
    model: string,
    stream: NodeJS.ReadableStream
  ): AsyncGenerator<string, void, unknown> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity
    });
    
    for await (const line of rl) {
      if (line.trim()) {
        logger.info('Received streaming line', { line: line.trim() });
        try {
          // Parse streaming JSON chunk from Claude CLI
          const chunk = JSON.parse(line);
          logger.info('Parsed streaming chunk', { chunk });
          
          // Extract content from Claude's streaming format
          const content = this.extractContentFromStreamChunk(chunk);
          logger.info('Extracted content from chunk', { content });
          
          if (content) {
            yield this.formatter.createContentChunk(requestId, model, content);
          }
        } catch (parseError) {
          logger.warn('Failed to parse streaming chunk', { line, error: parseError });
        }
      }
    }
  }

  /**
   * Extract content from Claude's stream-json format
   */
  private extractContentFromStreamChunk(chunk: any): string | null {
    // Handle Claude CLI's stream-json format
    if (chunk.type === 'assistant' && chunk.message?.content) {
      for (const contentBlock of chunk.message.content) {
        if (contentBlock.type === 'text' && contentBlock.text) {
          return contentBlock.text;
        }
      }
    }
    return null;
  }


  /**
   * Setup SSE headers for streaming
   */
  private setupStreamingHeaders(response: Response): void {
    response.writeHead(200, {
      'Content-Type': SSE_CONFIG.CONTENT_TYPE,
      'Cache-Control': SSE_CONFIG.CACHE_CONTROL,
      'Connection': SSE_CONFIG.CONNECTION,
      'Access-Control-Allow-Origin': SSE_CONFIG.ACCESS_CONTROL_ALLOW_ORIGIN,
      'Access-Control-Allow-Headers': SSE_CONFIG.ACCESS_CONTROL_ALLOW_HEADERS,
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${API_CONSTANTS.DEFAULT_REQUEST_ID_PREFIX}${Math.random().toString(36).substring(2, 15)}`;
  }


  /**
   * Cleanup resources
   */
  shutdown(): void {
    this.manager.shutdown();
  }
}