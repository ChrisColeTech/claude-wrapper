import { CoreWrapper } from '../../../src/core/wrapper';
import { OpenAIRequest } from '../../../src/types';
import { ClaudeClientMock } from '../../mocks/core/claude-client-mock';
import { ValidatorMock } from '../../mocks/core/validator-mock';

describe('CoreWrapper', () => {
  let wrapper: CoreWrapper;
  let mockClaudeClient: ReturnType<typeof ClaudeClientMock.setup>;
  let mockValidator: ReturnType<typeof ValidatorMock.setup>;

  beforeEach(() => {
    // Reset all mocks
    ClaudeClientMock.reset();
    ValidatorMock.reset();

    // Setup mocks
    mockClaudeClient = ClaudeClientMock.setup();
    mockValidator = ValidatorMock.setup();

    // Create wrapper with mocked dependencies
    wrapper = new CoreWrapper(mockClaudeClient, mockValidator);
    
    // Clear any sessions between tests
    (wrapper as any).claudeSessions.clear();
  });

  afterEach(() => {
    ClaudeClientMock.reset();
    ValidatorMock.reset();
  });

  describe('Single-stage processing', () => {
    it('should use single-stage processing by default', () => {
      const newWrapper = new CoreWrapper(mockClaudeClient, mockValidator);
      expect(newWrapper).toBeDefined();
      // Single-stage is the only mode - no configuration needed
    });
  });
  
  describe('processNormally - no system prompt', () => {
    it('should process request without system prompt optimization', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'user', content: 'What is 2+2?' }
        ]
      };

      ClaudeClientMock.setDefaultResponse('The answer is 4');
      ValidatorMock.setValidationAsValid(false); // Non-JSON response

      const result = await wrapper.handleChatCompletion(request);

      expect(mockClaudeClient.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'sonnet',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user', content: 'What is 2+2?' })
          ])
        })
      );
      expect(mockClaudeClient.executeWithSession).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        choices: [expect.objectContaining({
          message: expect.objectContaining({
            content: 'The answer is 4'
          })
        })]
      }));
    });
  });

  describe('single-stage processing - new system prompt', () => {
    it('should create new session for system prompt using file-based approach', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: 'You are a math tutor.' },
          { role: 'user', content: 'What is 5+3?' }
        ]
      };

      // Mock the file-based session creation
      const mockClaudeResolver = {
        executeCommandWithFileForSession: jest.fn().mockResolvedValue(
          '{"session_id":"session123","result":"Ready"}'
        )
      };
      
      wrapper = new CoreWrapper(mockClaudeClient, mockValidator, mockClaudeResolver as any);
      (wrapper as any).claudeSessions.clear();
      
      ClaudeClientMock.setDefaultResponse('The answer is 8');
      ValidatorMock.setValidationAsValid(false); // Non-JSON response

      const result = await wrapper.handleChatCompletion(request);

      // Should use single-stage processing (file-based session creation + message processing)
      expect(mockClaudeResolver.executeCommandWithFileForSession).toHaveBeenCalledWith(
        expect.any(String), // prompt
        'sonnet',
        expect.stringContaining('tmp') // temp file path
      );
      
      expect(mockClaudeClient.executeWithSession).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'sonnet',
          messages: [{ role: 'user', content: 'What is 5+3?' }] // system prompt stripped
        }),
        'session123',
        false // regular processing
      );

      expect(result).toEqual(expect.objectContaining({
        choices: [expect.objectContaining({
          message: expect.objectContaining({
            content: 'The answer is 8'
          })
        })]
      }));
    });

    it('should throw error if session setup fails', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: 'You are a helper.' },
          { role: 'user', content: 'Hello' }
        ]
      };

      // Mock the file-based session creation to fail
      const mockClaudeResolver = {
        executeCommandWithFileForSession: jest.fn().mockResolvedValue(
          '{"result":"Ready"}' // missing session_id
        )
      };
      
      wrapper = new CoreWrapper(mockClaudeClient, mockValidator, mockClaudeResolver as any);
      (wrapper as any).claudeSessions.clear();

      await expect(wrapper.handleChatCompletion(request)).rejects.toThrow(
        'Failed to extract session ID from Claude CLI response'
      );
    });
  });

  describe('single-stage session reuse', () => {
    it('should reuse existing session for same system prompt', async () => {
      const systemPrompt = 'You are a math tutor.';
      
      const firstRequest: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'What is 5+3?' }
        ]
      };

      const secondRequest: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'What is 10-4?' }
        ]
      };

      // Mock the file-based session creation for first request only
      const mockClaudeResolver = {
        executeCommandWithFileForSession: jest.fn().mockResolvedValue(
          '{"session_id":"session123","result":"Ready"}'
        )
      };
      
      wrapper = new CoreWrapper(mockClaudeClient, mockValidator, mockClaudeResolver as any);
      (wrapper as any).claudeSessions.clear();
      
      ClaudeClientMock.setSessionResponses({
        'session123': 'Session response'
      });
      ValidatorMock.setValidationAsValid(false); // Non-JSON response

      // First request - creates session
      await wrapper.handleChatCompletion(firstRequest);
      
      // Second request - should reuse session
      await wrapper.handleChatCompletion(secondRequest);

      // Should create session only once (first request)
      expect(mockClaudeResolver.executeCommandWithFileForSession).toHaveBeenCalledTimes(1);
      
      // Both requests should use the same session
      expect(mockClaudeClient.executeWithSession).toHaveBeenCalledTimes(2);
      
      // Second call should reuse session
      expect(mockClaudeClient.executeWithSession).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          messages: [{ role: 'user', content: 'What is 10-4?' }]
        }),
        'session123',
        false
      );
    });

    it('should create new session for different system prompt', async () => {
      const firstRequest: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: 'You are a math tutor.' },
          { role: 'user', content: 'What is 5+3?' }
        ]
      };

      const secondRequest: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: 'You are a creative writer.' },
          { role: 'user', content: 'Write a poem' }
        ]
      };

      // Mock file-based session creation for both requests
      let sessionCallCount = 0;
      const mockClaudeResolver = {
        executeCommandWithFileForSession: jest.fn().mockImplementation(async () => {
          sessionCallCount++;
          if (sessionCallCount === 1) {
            return '{"session_id":"session1","result":"Ready"}';
          } else {
            return '{"session_id":"session2","result":"Ready"}';
          }
        })
      };
      
      wrapper = new CoreWrapper(mockClaudeClient, mockValidator, mockClaudeResolver as any);
      (wrapper as any).claudeSessions.clear();
      
      ClaudeClientMock.setDefaultResponse('Response content');
      ValidatorMock.setValidationAsValid(false); // Non-JSON response

      await wrapper.handleChatCompletion(firstRequest);
      await wrapper.handleChatCompletion(secondRequest);

      // Should create two different sessions
      expect(mockClaudeResolver.executeCommandWithFileForSession).toHaveBeenCalledTimes(2);
      
      // Should process both messages with different sessions
      expect(mockClaudeClient.executeWithSession).toHaveBeenCalledTimes(2);
      
      // Verify different sessions are used
      expect(mockClaudeClient.executeWithSession).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          messages: [{ role: 'user', content: 'What is 5+3?' }]
        }),
        'session1',
        false
      );
      
      expect(mockClaudeClient.executeWithSession).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          messages: [{ role: 'user', content: 'Write a poem' }]
        }),
        'session2',
        false
      );
    });
  });

  describe('response handling', () => {
    it('should wrap non-JSON responses in OpenAI format', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      ClaudeClientMock.setDefaultResponse('Hello there!');
      ValidatorMock.setValidationAsValid(false); // Non-JSON response

      const result = await wrapper.handleChatCompletion(request);

      expect(result).toEqual(expect.objectContaining({
        id: expect.stringMatching(/^chatcmpl-/),
        object: 'chat.completion',
        created: expect.any(Number),
        model: 'sonnet',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello there!'
          },
          finish_reason: 'stop'
        }],
        usage: expect.any(Object)
      }));
    });

    it('should return valid JSON responses as-is', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const validJsonResponse = '{"id":"test123","object":"chat.completion","model":"sonnet","choices":[]}';
      const parsedResponse = JSON.parse(validJsonResponse);

      ClaudeClientMock.setDefaultResponse(validJsonResponse);
      ValidatorMock.setValidationAsValid(true); // Valid JSON response
      ValidatorMock.setParseResult(parsedResponse);

      const result = await wrapper.handleChatCompletion(request);

      expect(result).toEqual(parsedResponse);
      expect(mockValidator.parse).toHaveBeenCalledWith(validJsonResponse);
    });
  });

  describe('format instructions', () => {
    it('should add format instructions for requests with tools', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [{ role: 'user', content: 'Use this tool' }],
        tools: [{ type: 'function', function: { name: 'test_tool' } }]
      };

      ClaudeClientMock.setDefaultResponse('Tool response');
      ValidatorMock.setValidationAsValid(false);

      await wrapper.handleChatCompletion(request);

      expect(mockClaudeClient.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }), // Format instruction
            expect.objectContaining({ role: 'user', content: 'Use this tool' })
          ]),
          tools: expect.arrayContaining([
            expect.objectContaining({ type: 'function' })
          ])
        })
      );
    });

    it('should add format instructions for multi-turn conversations', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi' },
          { role: 'user', content: 'How are you?' }
        ]
      };

      ClaudeClientMock.setDefaultResponse('I am well');
      ValidatorMock.setValidationAsValid(false);

      await wrapper.handleChatCompletion(request);

      expect(mockClaudeClient.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }) // Format instruction
          ])
        })
      );
    });

    it('should add format instructions for long user messages', async () => {
      const longMessage = 'a'.repeat(250); // > 200 characters
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [{ role: 'user', content: longMessage }]
      };

      ClaudeClientMock.setDefaultResponse('Response');
      ValidatorMock.setValidationAsValid(false);

      await wrapper.handleChatCompletion(request);

      expect(mockClaudeClient.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }) // Format instruction
          ])
        })
      );
    });

    it('should skip format instructions for simple requests', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [{ role: 'user', content: 'Hi' }]
      };

      ClaudeClientMock.setDefaultResponse('Hello');
      ValidatorMock.setValidationAsValid(false);

      await wrapper.handleChatCompletion(request);

      expect(mockClaudeClient.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: 'Hi' }] // No format instruction
        })
      );
    });
  });

  describe('system prompt hash generation', () => {
    it('should generate same hash for identical system prompts', async () => {
      const systemPrompt = 'You are a helpful assistant.';
      
      const request1: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Hello' }
        ]
      };

      const request2: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Hi there' }
        ]
      };

      // Mock file-based session creation to return same session ID
      const mockClaudeResolver = {
        executeCommandWithFileForSession: jest.fn().mockResolvedValue(
          '{"session_id":"session123","result":"Ready"}'
        )
      };
      
      wrapper = new CoreWrapper(mockClaudeClient, mockValidator, mockClaudeResolver as any);
      (wrapper as any).claudeSessions.clear();
      
      ClaudeClientMock.setDefaultResponse('Response');
      ValidatorMock.setValidationAsValid(false);

      await wrapper.handleChatCompletion(request1);
      await wrapper.handleChatCompletion(request2);

      // Should create session only once due to hash reuse
      expect(mockClaudeResolver.executeCommandWithFileForSession).toHaveBeenCalledTimes(1);
      
      // Should reuse session - only 2 calls total (2 messages with same session)
      expect(mockClaudeClient.executeWithSession).toHaveBeenCalledTimes(2);
    });

    it('should generate different hash for different system prompts', async () => {
      const request1: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello' }
        ]
      };

      const request2: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: 'You are a creative writer.' },
          { role: 'user', content: 'Hello' }
        ]
      };

      // Mock file-based session creation for different sessions
      let sessionCallCount = 0;
      const mockClaudeResolver = {
        executeCommandWithFileForSession: jest.fn().mockImplementation(async () => {
          sessionCallCount++;
          if (sessionCallCount === 1) {
            return '{"session_id":"session1","result":"Ready"}';
          } else {
            return '{"session_id":"session2","result":"Ready"}';
          }
        })
      };
      
      wrapper = new CoreWrapper(mockClaudeClient, mockValidator, mockClaudeResolver as any);
      (wrapper as any).claudeSessions.clear();
      
      ClaudeClientMock.setDefaultResponse('Response');
      ValidatorMock.setValidationAsValid(false);

      await wrapper.handleChatCompletion(request1);
      await wrapper.handleChatCompletion(request2);

      // Should create separate sessions - 2 session creations + 2 messages
      expect(mockClaudeResolver.executeCommandWithFileForSession).toHaveBeenCalledTimes(2);
      expect(mockClaudeClient.executeWithSession).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple system prompts in single request', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'system', content: 'Be concise in your responses.' },
          { role: 'user', content: 'Hello' }
        ]
      };

      // Mock file-based session creation
      const mockClaudeResolver = {
        executeCommandWithFileForSession: jest.fn().mockResolvedValue(
          '{"session_id":"session123","result":"Ready"}'
        )
      };
      
      wrapper = new CoreWrapper(mockClaudeClient, mockValidator, mockClaudeResolver as any);
      (wrapper as any).claudeSessions.clear();
      
      ClaudeClientMock.setDefaultResponse('Response');
      ValidatorMock.setValidationAsValid(false);

      await wrapper.handleChatCompletion(request);

      // Should combine system prompts for session creation
      expect(mockClaudeResolver.executeCommandWithFileForSession).toHaveBeenCalledWith(
        expect.any(String), // prompt
        'sonnet',
        expect.stringContaining('tmp') // temp file path containing combined system prompts
      );
    });
  });

  describe('error handling', () => {
    it('should handle Claude client execution errors', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      ClaudeClientMock.setExecutionFailure(true);

      await expect(wrapper.handleChatCompletion(request)).rejects.toThrow('Claude CLI execution failed');
    });

    it('should handle Claude client session execution errors', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: 'You are a helper.' },
          { role: 'user', content: 'Hello' }
        ]
      };

      ClaudeClientMock.setSessionExecutionFailure(true);

      await expect(wrapper.handleChatCompletion(request)).rejects.toThrow('Claude CLI not found');
    });

    it('should handle invalid JSON in session setup response', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: 'You are a helper.' },
          { role: 'user', content: 'Hello' }
        ]
      };

      // Mock file-based session creation to return invalid JSON
      const mockClaudeResolver = {
        executeCommandWithFileForSession: jest.fn().mockResolvedValue('invalid json')
      };
      
      wrapper = new CoreWrapper(mockClaudeClient, mockValidator, mockClaudeResolver as any);
      (wrapper as any).claudeSessions.clear();

      await expect(wrapper.handleChatCompletion(request)).rejects.toThrow(
        'Failed to extract session ID from Claude CLI response'
      );
    });

    it('should handle empty session setup response', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: 'You are a helper.' },
          { role: 'user', content: 'Hello' }
        ]
      };

      // Mock file-based session creation to return empty string
      const mockClaudeResolver = {
        executeCommandWithFileForSession: jest.fn().mockResolvedValue('')
      };
      
      wrapper = new CoreWrapper(mockClaudeClient, mockValidator, mockClaudeResolver as any);
      (wrapper as any).claudeSessions.clear();

      await expect(wrapper.handleChatCompletion(request)).rejects.toThrow(
        'Failed to extract session ID from Claude CLI response'
      );
    });
  });

  describe('streaming support', () => {
    it('should return a readable stream for streaming requests', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true
      };

      ClaudeClientMock.setDefaultResponse('Response');
      ValidatorMock.setValidationAsValid(false);

      try {
        const result = await wrapper.handleStreamingChatCompletion(request);
        
        // Should return a readable stream
        expect(result).toBeDefined();
        expect(typeof result.read).toBe('function');
        expect(typeof result.on).toBe('function');
      } catch (error: any) {
        // In CI environment, Claude CLI is not available, expect path detection error
        expect(error.message).toContain('Claude CLI not found');
      }
    });
  });

  describe('session state management', () => {
    it('should update session last used time on reuse', async () => {
      const systemPrompt = 'You are a helper.';
      
      const request1: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'First message' }
        ]
      };

      const request2: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Second message' }
        ]
      };

      // Mock file-based session creation
      const mockClaudeResolver = {
        executeCommandWithFileForSession: jest.fn().mockResolvedValue(
          '{"session_id":"session123","result":"Ready"}'
        )
      };
      
      wrapper = new CoreWrapper(mockClaudeClient, mockValidator, mockClaudeResolver as any);
      (wrapper as any).claudeSessions.clear();
      
      ClaudeClientMock.setDefaultResponse('Response');
      ValidatorMock.setValidationAsValid(false);

      await wrapper.handleChatCompletion(request1);
      
      // Get session state after first request
      const sessions = (wrapper as any).claudeSessions;
      const sessionKeys = Array.from(sessions.keys());
      const firstSessionState = sessions.get(sessionKeys[0]);
      const firstLastUsed = firstSessionState?.lastUsed;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await wrapper.handleChatCompletion(request2);

      // Check that lastUsed was updated
      const secondSessionState = sessions.get(sessionKeys[0]);
      const secondLastUsed = secondSessionState?.lastUsed;

      expect(secondLastUsed).toBeDefined();
      expect(firstLastUsed).toBeDefined();
      expect(secondLastUsed!.getTime()).toBeGreaterThan(firstLastUsed!.getTime());
    });

    it('should store correct session content and hash', async () => {
      const systemPrompt = 'You are a math tutor specializing in algebra.';
      
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Help me with equations' }
        ]
      };

      // Mock file-based session creation
      const mockClaudeResolver = {
        executeCommandWithFileForSession: jest.fn().mockResolvedValue(
          '{"session_id":"session123","result":"Ready"}'
        )
      };
      
      wrapper = new CoreWrapper(mockClaudeClient, mockValidator, mockClaudeResolver as any);
      (wrapper as any).claudeSessions.clear();
      
      ClaudeClientMock.setDefaultResponse('Response');
      ValidatorMock.setValidationAsValid(false);

      await wrapper.handleChatCompletion(request);

      const sessions = (wrapper as any).claudeSessions;
      const sessionKeys = Array.from(sessions.keys());
      const sessionState = sessions.get(sessionKeys[0]);

      expect(sessionState).toEqual(expect.objectContaining({
        claudeSessionId: 'session123',
        systemPromptContent: systemPrompt,
        systemPromptHash: sessionKeys[0],
        lastUsed: expect.any(Date)
      }));
    });
  });

  describe('edge cases', () => {
    it('should handle empty messages array', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: []
      };

      ClaudeClientMock.setDefaultResponse('Response');
      ValidatorMock.setValidationAsValid(false);

      const result = await wrapper.handleChatCompletion(request);

      expect(result).toEqual(expect.objectContaining({
        choices: [expect.objectContaining({
          message: expect.objectContaining({
            content: 'Response'
          })
        })]
      }));
    });

    it('should handle request with only system prompts', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: 'You are a helper.' }
        ]
      };

      // Mock file-based session creation
      const mockClaudeResolver = {
        executeCommandWithFileForSession: jest.fn().mockResolvedValue(
          '{"session_id":"session123","result":"Ready"}'
        )
      };
      
      wrapper = new CoreWrapper(mockClaudeClient, mockValidator, mockClaudeResolver as any);
      (wrapper as any).claudeSessions.clear();
      
      ClaudeClientMock.setDefaultResponse('Response');
      ValidatorMock.setValidationAsValid(false);

      await wrapper.handleChatCompletion(request);

      // Should strip system prompt for message processing, leaving empty messages
      expect(mockClaudeClient.executeWithSession).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: []
        }),
        'session123',
        false
      );
    });

    it('should handle mixed role messages correctly', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: 'You are a helper.' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
          { role: 'system', content: 'Be brief.' },
          { role: 'user', content: 'How are you?' }
        ]
      };

      // Mock file-based session creation
      const mockClaudeResolver = {
        executeCommandWithFileForSession: jest.fn().mockResolvedValue(
          '{"session_id":"session123","result":"Ready"}'
        )
      };
      
      wrapper = new CoreWrapper(mockClaudeClient, mockValidator, mockClaudeResolver as any);
      (wrapper as any).claudeSessions.clear();
      
      ClaudeClientMock.setDefaultResponse('Response');
      ValidatorMock.setValidationAsValid(false);

      await wrapper.handleChatCompletion(request);

      // Should combine all system prompts for session creation
      expect(mockClaudeResolver.executeCommandWithFileForSession).toHaveBeenCalledWith(
        expect.any(String), // prompt
        'sonnet',
        expect.stringContaining('tmp') // temp file path containing combined system prompts
      );

      // Should strip system prompts for message processing and add format instructions
      expect(mockClaudeClient.executeWithSession).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }), // Format instruction
            expect.objectContaining({ role: 'user', content: 'Hello' }),
            expect.objectContaining({ role: 'assistant', content: 'Hi there' }),
            expect.objectContaining({ role: 'user', content: 'How are you?' })
          ])
        }),
        'session123',
        false
      );
    });

    it('should handle request with different model names', async () => {
      const request: OpenAIRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'system', content: 'You are a helper.' },
          { role: 'user', content: 'Hello' }
        ]
      };

      // Mock file-based session creation
      const mockClaudeResolver = {
        executeCommandWithFileForSession: jest.fn().mockResolvedValue(
          '{"session_id":"session123","result":"Ready"}'
        )
      };
      
      wrapper = new CoreWrapper(mockClaudeClient, mockValidator, mockClaudeResolver as any);
      (wrapper as any).claudeSessions.clear();
      
      ClaudeClientMock.setDefaultResponse('Response');
      ValidatorMock.setValidationAsValid(false);

      const result = await wrapper.handleChatCompletion(request);

      expect(result).toEqual(expect.objectContaining({
        model: 'claude-3-5-sonnet-20241022'
      }));
    });
  });

  describe('MCP tools and function calling', () => {
    it('should handle requests with MCP tools', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [{ role: 'user', content: 'Get the weather for New York' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather information for a location',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string', description: 'The location to get weather for' }
                },
                required: ['location']
              }
            }
          }
        ]
      };

      const toolResponse = JSON.stringify({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'sonnet',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "New York"}'
              }
            }]
          },
          finish_reason: 'tool_calls'
        }],
        usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 }
      });

      ClaudeClientMock.setDefaultResponse(toolResponse);
      ValidatorMock.setValidationAsValid(true);
      ValidatorMock.setParseResult(JSON.parse(toolResponse));

      const result = await wrapper.handleChatCompletion(request);

      expect(mockClaudeClient.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }), // Format instruction
            expect.objectContaining({ role: 'user', content: 'Get the weather for New York' })
          ]),
          tools: expect.arrayContaining([
            expect.objectContaining({
              type: 'function',
              function: expect.objectContaining({
                name: 'get_weather'
              })
            })
          ])
        })
      );

      expect(result).toEqual(expect.objectContaining({
        choices: [expect.objectContaining({
          message: expect.objectContaining({
            tool_calls: expect.arrayContaining([
              expect.objectContaining({
                function: expect.objectContaining({
                  name: 'get_weather'
                })
              })
            ])
          })
        })]
      }));
    });

    it('should handle tool calls with session optimization', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: 'You are a helpful assistant with access to tools.' },
          { role: 'user', content: 'What is the weather in San Francisco?' }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather information',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' }
                }
              }
            }
          }
        ]
      };

      const toolResponse = JSON.stringify({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'sonnet',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_456',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "San Francisco"}'
              }
            }]
          },
          finish_reason: 'tool_calls'
        }],
        usage: { prompt_tokens: 60, completion_tokens: 25, total_tokens: 85 }
      });

      // Mock file-based session creation
      const mockClaudeResolver = {
        executeCommandWithFileForSession: jest.fn().mockResolvedValue(
          '{"session_id":"tool_session_123","result":"Ready"}'
        )
      };
      
      wrapper = new CoreWrapper(mockClaudeClient, mockValidator, mockClaudeResolver as any);
      (wrapper as any).claudeSessions.clear();
      
      ClaudeClientMock.setDefaultResponse(toolResponse);
      ValidatorMock.setValidationAsValid(true);
      ValidatorMock.setParseResult(JSON.parse(toolResponse));

      const result = await wrapper.handleChatCompletion(request);

      // Should create session with system prompt file
      expect(mockClaudeResolver.executeCommandWithFileForSession).toHaveBeenCalledWith(
        expect.any(String), // prompt
        'sonnet',
        expect.stringContaining('tmp') // temp file path
      );

      // Should process message with tools
      expect(mockClaudeClient.executeWithSession).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }), // Format instruction
            expect.objectContaining({ role: 'user', content: 'What is the weather in San Francisco?' })
          ]),
          tools: expect.arrayContaining([
            expect.objectContaining({
              type: 'function',
              function: expect.objectContaining({
                name: 'get_weather'
              })
            })
          ])
        }),
        'tool_session_123',
        false
      );

      expect(result).toEqual(expect.objectContaining({
        choices: [expect.objectContaining({
          message: expect.objectContaining({
            tool_calls: expect.arrayContaining([
              expect.objectContaining({
                function: expect.objectContaining({
                  name: 'get_weather'
                })
              })
            ])
          })
        })]
      }));
    });

    it('should handle tool result responses', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'user', content: 'What is the weather in Boston?' },
          { 
            role: 'assistant', 
            content: null,
            tool_calls: [{
              id: 'call_789',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "Boston"}'
              }
            }]
          },
          {
            role: 'tool',
            content: 'The weather in Boston is sunny, 72°F',
            tool_call_id: 'call_789'
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather information',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' }
                }
              }
            }
          }
        ]
      };

      const finalResponse = 'Based on the weather data, Boston is currently sunny with a temperature of 72°F. It\'s a great day to be outside!';

      ClaudeClientMock.setDefaultResponse(finalResponse);
      ValidatorMock.setValidationAsValid(false);

      const result = await wrapper.handleChatCompletion(request);

      expect(mockClaudeClient.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }), // Format instruction
            expect.objectContaining({ role: 'user', content: 'What is the weather in Boston?' }),
            expect.objectContaining({ 
              role: 'assistant',
              tool_calls: expect.arrayContaining([
                expect.objectContaining({
                  function: expect.objectContaining({
                    name: 'get_weather'
                  })
                })
              ])
            }),
            expect.objectContaining({ 
              role: 'tool',
              content: 'The weather in Boston is sunny, 72°F',
              tool_call_id: 'call_789'
            })
          ])
        })
      );

      expect(result).toEqual(expect.objectContaining({
        choices: [expect.objectContaining({
          message: expect.objectContaining({
            content: finalResponse
          })
        })]
      }));
    });

    it('should handle multiple tool calls in one response', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [{ role: 'user', content: 'Get weather for New York and London' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather information',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' }
                }
              }
            }
          }
        ]
      };

      const multiToolResponse = JSON.stringify({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'sonnet',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_ny',
                type: 'function',
                function: {
                  name: 'get_weather',
                  arguments: '{"location": "New York"}'
                }
              },
              {
                id: 'call_london',
                type: 'function',
                function: {
                  name: 'get_weather',
                  arguments: '{"location": "London"}'
                }
              }
            ]
          },
          finish_reason: 'tool_calls'
        }],
        usage: { prompt_tokens: 70, completion_tokens: 40, total_tokens: 110 }
      });

      ClaudeClientMock.setDefaultResponse(multiToolResponse);
      ValidatorMock.setValidationAsValid(true);
      ValidatorMock.setParseResult(JSON.parse(multiToolResponse));

      const result = await wrapper.handleChatCompletion(request);

      expect(result).toEqual(expect.objectContaining({
        choices: [expect.objectContaining({
          message: expect.objectContaining({
            tool_calls: expect.arrayContaining([
              expect.objectContaining({
                id: 'call_ny',
                function: expect.objectContaining({
                  name: 'get_weather',
                  arguments: '{"location": "New York"}'
                })
              }),
              expect.objectContaining({
                id: 'call_london',
                function: expect.objectContaining({
                  name: 'get_weather',
                  arguments: '{"location": "London"}'
                })
              })
            ])
          })
        })]
      }));
    });

    it('should handle complex MCP tool schema', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [{ role: 'user', content: 'Search for files in my project' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'search_files',
              description: 'Search for files in a directory',
              parameters: {
                type: 'object',
                properties: {
                  directory: { 
                    type: 'string', 
                    description: 'The directory to search in' 
                  },
                  pattern: { 
                    type: 'string', 
                    description: 'The search pattern (glob or regex)' 
                  },
                  recursive: { 
                    type: 'boolean', 
                    description: 'Whether to search recursively',
                    default: true
                  },
                  file_types: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'File extensions to include'
                  }
                },
                required: ['directory', 'pattern']
              }
            }
          }
        ]
      };

      const complexToolResponse = JSON.stringify({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'sonnet',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_search',
              type: 'function',
              function: {
                name: 'search_files',
                arguments: JSON.stringify({
                  directory: './src',
                  pattern: '*.ts',
                  recursive: true,
                  file_types: ['ts', 'tsx']
                })
              }
            }]
          },
          finish_reason: 'tool_calls'
        }],
        usage: { prompt_tokens: 80, completion_tokens: 35, total_tokens: 115 }
      });

      ClaudeClientMock.setDefaultResponse(complexToolResponse);
      ValidatorMock.setValidationAsValid(true);
      ValidatorMock.setParseResult(JSON.parse(complexToolResponse));

      const result = await wrapper.handleChatCompletion(request);

      expect(result).toEqual(expect.objectContaining({
        choices: [expect.objectContaining({
          message: expect.objectContaining({
            tool_calls: expect.arrayContaining([
              expect.objectContaining({
                function: expect.objectContaining({
                  name: 'search_files',
                  arguments: expect.stringContaining('src')
                })
              })
            ])
          })
        })]
      }));
    });

    it('should handle tool errors gracefully', async () => {
      const request: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'user', content: 'Get weather for InvalidCity' },
          { 
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_error',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "InvalidCity"}'
              }
            }]
          },
          {
            role: 'tool',
            content: 'Error: Location not found',
            tool_call_id: 'call_error'
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather information',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' }
                }
              }
            }
          }
        ]
      };

      const errorResponse = 'I apologize, but I couldn\'t find weather information for "InvalidCity". Please check the location name and try again.';

      ClaudeClientMock.setDefaultResponse(errorResponse);
      ValidatorMock.setValidationAsValid(false);

      const result = await wrapper.handleChatCompletion(request);

      expect(result).toEqual(expect.objectContaining({
        choices: [expect.objectContaining({
          message: expect.objectContaining({
            content: errorResponse
          })
        })]
      }));
    });

    it('should handle tools with session reuse', async () => {
      const systemPrompt = 'You are an AI assistant with access to weather tools.';
      
      const request1: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'What is the weather in Chicago?' }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather information',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' }
                }
              }
            }
          }
        ]
      };

      const request2: OpenAIRequest = {
        model: 'sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'What about in Miami?' }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather information',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' }
                }
              }
            }
          }
        ]
      };

      // Mock file-based session creation
      const mockClaudeResolver = {
        executeCommandWithFileForSession: jest.fn().mockResolvedValue(
          '{"session_id":"weather_session","result":"Ready"}'
        )
      };
      
      wrapper = new CoreWrapper(mockClaudeClient, mockValidator, mockClaudeResolver as any);
      (wrapper as any).claudeSessions.clear();
      
      ClaudeClientMock.setDefaultResponse('Weather response');
      ValidatorMock.setValidationAsValid(false);

      await wrapper.handleChatCompletion(request1);
      await wrapper.handleChatCompletion(request2);

      // Should create session only once due to reuse
      expect(mockClaudeResolver.executeCommandWithFileForSession).toHaveBeenCalledTimes(1);
      
      // Should reuse session - 2 calls total (2 messages with same session)
      expect(mockClaudeClient.executeWithSession).toHaveBeenCalledTimes(2);
      
      // Both requests should use the same session
      expect(mockClaudeClient.executeWithSession).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          tools: expect.arrayContaining([
            expect.objectContaining({
              type: 'function',
              function: expect.objectContaining({
                name: 'get_weather'
              })
            })
          ])
        }),
        'weather_session',
        false
      );
    });
  });
});