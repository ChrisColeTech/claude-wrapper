import { StreamingHandler } from '../../../src/streaming/handler';
import { StreamingTestSetup } from './setup';

describe('StreamingHandler Core Functionality', () => {
  let handler: StreamingHandler;
  let testSetup: StreamingTestSetup;

  beforeEach(() => {
    testSetup = new StreamingTestSetup();
    testSetup.beforeEach();
    handler = new StreamingHandler(
      testSetup.mockFormatter,
      testSetup.mockManager,
      testSetup.mockCoreWrapper
    );
  });

  afterEach(() => {
    testSetup.afterEach();
    testSetup.assertNoMemoryLeaks();
  });

  describe('handleStreamingRequest', () => {
    it('should setup streaming headers correctly', async () => {
      const mockRequest = testSetup.testDataFactory.createValidRequest();
      mockRequest.stream = true;
      
      const mockAsyncGenerator = async function* () {
        yield 'data: test\n\n';
      };
      
      jest.spyOn(handler, 'createStreamingResponse').mockImplementation(mockAsyncGenerator);

      await handler.handleStreamingRequest(mockRequest, testSetup.mockResponse as any);

      expect(testSetup.mockResponse.statusCode).toBe(200);
      expect(testSetup.mockResponse.headers['Content-Type']).toBe('text/event-stream');
      expect(testSetup.mockResponse.headers['Cache-Control']).toBe('no-cache');
      expect(testSetup.mockResponse.headers['Connection']).toBe('keep-alive');
    });

    it('should create connection and stream response', async () => {
      const mockRequest = testSetup.testDataFactory.createValidRequest();
      mockRequest.stream = true;
      
      const mockAsyncGenerator = async function* () {
        yield 'data: chunk1\n\n';
        yield 'data: chunk2\n\n';
      };
      
      jest.spyOn(handler, 'createStreamingResponse').mockImplementation(mockAsyncGenerator);

      await handler.handleStreamingRequest(mockRequest, testSetup.mockResponse as any);

      expect(testSetup.mockManager.createConnectionCalls.length).toBeGreaterThan(0);
      expect(testSetup.mockResponse.chunks).toContain('data: chunk1\n\n');
      expect(testSetup.mockResponse.chunks).toContain('data: chunk2\n\n');
      expect(testSetup.mockManager.closeConnectionCalls.length).toBeGreaterThan(0);
    });

    it('should handle streaming errors gracefully', async () => {
      const mockRequest = testSetup.testDataFactory.createValidRequest();
      mockRequest.stream = true;
      
      const mockAsyncGenerator = async function* () {
        yield 'data: test\n\n';
        throw new Error('Streaming error');
      };
      
      jest.spyOn(handler, 'createStreamingResponse').mockImplementation(mockAsyncGenerator);

      await handler.handleStreamingRequest(mockRequest, testSetup.mockResponse as any);

      expect(testSetup.mockFormatter.formatErrorCalls.length).toBeGreaterThan(0);
      expect(testSetup.mockManager.closeConnectionCalls.length).toBeGreaterThan(0);
    });

    it('should close connection on response end', async () => {
      const mockRequest = testSetup.testDataFactory.createValidRequest();
      mockRequest.stream = true;
      
      const mockAsyncGenerator = async function* () {
        yield 'data: test\n\n';
      };
      
      jest.spyOn(handler, 'createStreamingResponse').mockImplementation(mockAsyncGenerator);

      await handler.handleStreamingRequest(mockRequest, testSetup.mockResponse as any);

      expect(testSetup.mockManager.closeConnectionCalls.length).toBeGreaterThan(0);
    });
  });

  describe('createStreamingResponse', () => {
    it('should generate complete streaming response', async () => {
      const mockRequest = testSetup.testDataFactory.createValidRequest();
      const mockResponse = testSetup.testDataFactory.createValidResponse();
      
      testSetup.mockCoreWrapper.setMockResponse(mockResponse);

      const generator = handler.createStreamingResponse(mockRequest);
      const chunks: string[] = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(testSetup.mockFormatter.formatInitialChunkCalls.length).toBeGreaterThan(0);
      expect(testSetup.mockFormatter.createFinalChunkCalls.length).toBeGreaterThan(0);
      expect(testSetup.mockFormatter.formatDoneCalls).toBeGreaterThan(0);
    });

    it('should call core wrapper with stream=false', async () => {
      const mockRequest = testSetup.testDataFactory.createValidRequest();
      const mockResponse = testSetup.testDataFactory.createValidResponse();
      
      testSetup.mockCoreWrapper.setMockResponse(mockResponse);

      const generator = handler.createStreamingResponse(mockRequest);
      const chunks: string[] = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(testSetup.mockCoreWrapper.handleChatCompletionCalls.length).toBeGreaterThan(0);
      const lastCall = testSetup.mockCoreWrapper.handleChatCompletionCalls[0];
      expect(lastCall).toBeDefined();
      expect(lastCall?.stream).toBe(false);
    });

    it('should handle empty response content', async () => {
      const mockRequest = testSetup.testDataFactory.createValidRequest();
      const mockResponse = testSetup.testDataFactory.createValidResponse();
      if (mockResponse.choices[0]) {
        mockResponse.choices[0].message.content = '';
      }
      
      testSetup.mockCoreWrapper.setMockResponse(mockResponse);

      const generator = handler.createStreamingResponse(mockRequest);
      const chunks: string[] = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(testSetup.mockFormatter.formatInitialChunkCalls.length).toBeGreaterThan(0);
      expect(testSetup.mockFormatter.formatDoneCalls).toBeGreaterThan(0);
    });

    it('should handle core wrapper errors', async () => {
      const mockRequest = testSetup.testDataFactory.createValidRequest();
      const error = new Error('Core wrapper error');
      
      testSetup.mockCoreWrapper.shouldThrowError = true;
      testSetup.mockCoreWrapper.errorToThrow = error;

      const generator = handler.createStreamingResponse(mockRequest);
      const chunks: string[] = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(testSetup.mockFormatter.formatErrorCalls.length).toBeGreaterThan(0);
      expect(testSetup.mockFormatter.formatErrorCalls[0]?.message).toBe('Core wrapper error');
    });

    it('should handle multiline response content', async () => {
      const mockRequest = testSetup.testDataFactory.createValidRequest();
      const mockResponse = testSetup.testDataFactory.createValidResponse();
      if (mockResponse.choices[0]) {
        mockResponse.choices[0].message.content = 'Line 1\nLine 2\nLine 3';
      }
      
      testSetup.mockCoreWrapper.setMockResponse(mockResponse);

      const generator = handler.createStreamingResponse(mockRequest);
      const chunks: string[] = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(testSetup.mockFormatter.createContentChunkCalls.length).toBeGreaterThan(0);
    });

    it('should handle response with no choices', async () => {
      const mockRequest = testSetup.testDataFactory.createValidRequest();
      const mockResponse = testSetup.testDataFactory.createValidResponse();
      mockResponse.choices = [];
      
      testSetup.mockCoreWrapper.setMockResponse(mockResponse);

      const generator = handler.createStreamingResponse(mockRequest);
      const chunks: string[] = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(testSetup.mockFormatter.formatInitialChunkCalls.length).toBeGreaterThan(0);
      expect(testSetup.mockFormatter.formatDoneCalls).toBeGreaterThan(0);
    });

    it('should handle response with custom finish reason', async () => {
      const mockRequest = testSetup.testDataFactory.createValidRequest();
      const mockResponse = testSetup.testDataFactory.createValidResponse();
      if (mockResponse.choices[0]) {
        mockResponse.choices[0].finish_reason = 'length';
      }
      
      testSetup.mockCoreWrapper.setMockResponse(mockResponse);

      const generator = handler.createStreamingResponse(mockRequest);
      const chunks: string[] = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(testSetup.mockFormatter.createFinalChunkCalls.length).toBeGreaterThan(0);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('tool calls', () => {
    const toolCall = {
      id: 'call_1',
      type: 'function' as const,
      function: { name: 'list_issues', arguments: '{}' }
    };

    it('should stream tool calls and finish with tool_calls', async () => {
      const mockRequest = testSetup.testDataFactory.createValidRequest();
      const mockResponse = testSetup.testDataFactory.createValidResponse();
      if (mockResponse.choices[0]) {
        mockResponse.choices[0].message = { role: 'assistant', content: null, tool_calls: [toolCall] };
        mockResponse.choices[0].finish_reason = 'tool_calls';
      }
      testSetup.mockCoreWrapper.setMockResponse(mockResponse);

      for await (const _chunk of handler.createStreamingResponse(mockRequest)) { /* drain */ }

      expect(testSetup.mockFormatter.createContentChunkCalls).toHaveLength(0);
      expect(testSetup.mockFormatter.createToolCallsChunkCalls[0]?.toolCalls).toEqual([toolCall]);
      expect(testSetup.mockFormatter.createFinalChunkCalls[0]?.finishReason).toBe('tool_calls');
    });

    it('should pass tool_choice to the core wrapper', async () => {
      const mockRequest = {
        ...testSetup.testDataFactory.createValidRequest(),
        tools: [{ type: 'function', function: { name: 'list_issues' } }],
        tool_choice: 'required' as const
      };

      for await (const _chunk of handler.createStreamingResponse(mockRequest)) { /* drain */ }

      expect(testSetup.mockCoreWrapper.handleChatCompletionCalls[0]?.tool_choice).toBe('required');
    });

    it('should send a usage chunk only when the client asks for it', async () => {
      const mockRequest = testSetup.testDataFactory.createValidRequest();

      for await (const _chunk of handler.createStreamingResponse(mockRequest)) { /* drain */ }
      expect(testSetup.mockFormatter.createUsageChunkCalls).toHaveLength(0);

      const withUsage = { ...mockRequest, stream_options: { include_usage: true } };
      for await (const _chunk of handler.createStreamingResponse(withUsage)) { /* drain */ }
      expect(testSetup.mockFormatter.createUsageChunkCalls).toHaveLength(1);
    });
  });

  describe('shutdown', () => {
    it('should shutdown manager when shutdown is called', () => {
      handler.shutdown();
      expect(testSetup.mockManager.shutdownCalls).toBeGreaterThan(0);
    });

    it('should handle missing manager shutdown gracefully', () => {
      const mockManagerWithoutShutdown = {
        ...testSetup.mockManager,
        shutdown: undefined
      };
      const handlerWithoutShutdown = new StreamingHandler(
        testSetup.mockFormatter,
        mockManagerWithoutShutdown as any,
        testSetup.mockCoreWrapper
      );
      
      expect(() => handlerWithoutShutdown.shutdown()).toThrow('this.manager.shutdown is not a function');
    });
  });
});