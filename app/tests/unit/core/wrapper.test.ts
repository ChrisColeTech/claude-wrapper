import { CoreWrapper } from '../../../src/core/wrapper';
import { OpenAIRequest, ValidationResult, IClaudeClient, IResponseValidator } from '../../../src/types';
import { ValidationError } from '../../../src/utils/errors';

describe('CoreWrapper', () => {
  let coreWrapper: CoreWrapper;
  let mockClaudeClient: jest.Mocked<IClaudeClient>;
  let mockValidator: jest.Mocked<IResponseValidator>;

  beforeEach(() => {
    mockClaudeClient = {
      execute: jest.fn()
    };

    mockValidator = {
      validate: jest.fn(),
      parse: jest.fn()
    };

    coreWrapper = new CoreWrapper(mockClaudeClient, mockValidator);
  });

  describe('handleChatCompletion', () => {
    const mockRequest: OpenAIRequest = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        { role: 'user', content: 'Hello, how are you?' }
      ]
    };

    it('should handle valid chat completion successfully', async () => {
      const mockRawResponse = JSON.stringify({
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'claude-3-5-sonnet-20241022',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'I am doing well, thank you!' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 }
      });

      const mockParsedResponse = JSON.parse(mockRawResponse);
      const mockValidationResult: ValidationResult = { valid: true, errors: [] };

      mockClaudeClient.execute.mockResolvedValue(mockRawResponse);
      mockValidator.validate.mockReturnValue(mockValidationResult);
      mockValidator.parse.mockReturnValue(mockParsedResponse);

      const result = await coreWrapper.handleChatCompletion(mockRequest);

      expect(result).toEqual(mockParsedResponse);
      expect(mockClaudeClient.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-5-sonnet-20241022',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('Return raw JSON only')
            }),
            { role: 'user', content: 'Hello, how are you?' }
          ])
        })
      );
    });

    it('should add format instructions to request', async () => {
      const mockRawResponse = '{"id":"test","object":"chat.completion","created":123,"model":"test","choices":[],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}';
      const mockValidationResult: ValidationResult = { valid: true, errors: [] };

      mockClaudeClient.execute.mockResolvedValue(mockRawResponse);
      mockValidator.validate.mockReturnValue(mockValidationResult);
      mockValidator.parse.mockReturnValue(JSON.parse(mockRawResponse));

      await coreWrapper.handleChatCompletion(mockRequest);

      const capturedRequest = mockClaudeClient.execute.mock.calls[0]![0]!;
      
      expect(capturedRequest.messages).toHaveLength(2); // format instruction + original message
      expect(capturedRequest.messages[0]!.role).toBe('system');
      expect(capturedRequest.messages[0]!.content).toContain('Return raw JSON only');
      expect(capturedRequest.messages[0]!.content).toContain('REPLACE_WITH_ANSWER');
    });

    it('should generate unique request IDs', async () => {
      const mockRawResponse = '{"id":"test","object":"chat.completion","created":123,"model":"test","choices":[],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}';
      const mockValidationResult: ValidationResult = { valid: true, errors: [] };

      mockClaudeClient.execute.mockResolvedValue(mockRawResponse);
      mockValidator.validate.mockReturnValue(mockValidationResult);
      mockValidator.parse.mockReturnValue(JSON.parse(mockRawResponse));

      await coreWrapper.handleChatCompletion(mockRequest);
      await coreWrapper.handleChatCompletion(mockRequest);

      const firstCall = mockClaudeClient.execute.mock.calls[0]![0]!;
      const secondCall = mockClaudeClient.execute.mock.calls[1]![0]!;
      
      const firstRequestId = firstCall.messages[0]!.content.match(/"id":"([^"]+)"/)?.[1];
      const secondRequestId = secondCall.messages[0]!.content.match(/"id":"([^"]+)"/)?.[1];
      
      expect(firstRequestId).toBeDefined();
      expect(secondRequestId).toBeDefined();
      expect(firstRequestId).not.toBe(secondRequestId);
    });

    it('should attempt self-correction for invalid responses', async () => {
      const invalidResponse = 'Invalid JSON response';
      const validResponse = '{"id":"test","object":"chat.completion","created":123,"model":"test","choices":[{"index":0,"message":{"role":"assistant","content":"corrected"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}';
      
      const invalidValidationResult: ValidationResult = { 
        valid: false, 
        errors: ['Invalid JSON: Unexpected token I in JSON at position 0'] 
      };
      const validValidationResult: ValidationResult = { valid: true, errors: [] };

      mockClaudeClient.execute
        .mockResolvedValueOnce(invalidResponse)
        .mockResolvedValueOnce(validResponse);
      
      mockValidator.validate
        .mockReturnValueOnce(invalidValidationResult)
        .mockReturnValueOnce(validValidationResult);
      
      mockValidator.parse.mockReturnValue(JSON.parse(validResponse));

      const result = await coreWrapper.handleChatCompletion(mockRequest);

      expect(mockClaudeClient.execute).toHaveBeenCalledTimes(2);
      expect(result).toEqual(JSON.parse(validResponse));
      
      // Check that correction request includes error information
      const correctionRequest = mockClaudeClient.execute.mock.calls[1]![0]!;
      const lastMessage = correctionRequest.messages[correctionRequest.messages.length - 1]!;
      expect(lastMessage.content).toContain('format errors');
      expect(lastMessage.content).toContain('Invalid JSON');
    });

    it('should throw ValidationError after max correction attempts', async () => {
      const invalidResponse = 'Invalid JSON response';
      const invalidValidationResult: ValidationResult = { 
        valid: false, 
        errors: ['Invalid JSON'] 
      };

      mockClaudeClient.execute.mockResolvedValue(invalidResponse);
      mockValidator.validate.mockReturnValue(invalidValidationResult);

      await expect(coreWrapper.handleChatCompletion(mockRequest)).rejects.toThrow(ValidationError);
      await expect(coreWrapper.handleChatCompletion(mockRequest)).rejects.toThrow('Failed to get valid OpenAI format after 3 attempts');
      
      // Reset mock calls for accurate count
      mockClaudeClient.execute.mockClear();
      mockValidator.validate.mockClear();
      
      // Test again to verify exact call count
      await expect(coreWrapper.handleChatCompletion(mockRequest)).rejects.toThrow(ValidationError);
      expect(mockClaudeClient.execute).toHaveBeenCalledTimes(3); // Initial + 2 correction attempts
    });

    it('should include timestamp and model in format template', async () => {
      const mockRawResponse = '{"id":"test","object":"chat.completion","created":123,"model":"test","choices":[],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}';
      const mockValidationResult: ValidationResult = { valid: true, errors: [] };

      mockClaudeClient.execute.mockResolvedValue(mockRawResponse);
      mockValidator.validate.mockReturnValue(mockValidationResult);
      mockValidator.parse.mockReturnValue(JSON.parse(mockRawResponse));

      const startTime = Date.now();
      await coreWrapper.handleChatCompletion(mockRequest);
      const endTime = Date.now();

      const capturedRequest = mockClaudeClient.execute.mock.calls[0]![0]!;
      const formatInstruction = capturedRequest.messages[0]!.content;
      
      // Extract timestamp from format instruction
      const timestampMatch = formatInstruction.match(/"created":(\d+)/);
      expect(timestampMatch).toBeTruthy();
      
      const timestamp = parseInt(timestampMatch![1]!) * 1000; // Convert to milliseconds
      expect(timestamp).toBeGreaterThanOrEqual(Math.floor(startTime / 1000) * 1000);
      expect(timestamp).toBeLessThanOrEqual(Math.ceil(endTime / 1000) * 1000);
      
      // Check model is included
      expect(formatInstruction).toContain(`"model":"${mockRequest.model}"`);
    });
  });
});