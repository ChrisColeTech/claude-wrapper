/**
 * OpenAI Tools Mock Objects - Central Export Index
 * 
 * Provides comprehensive mock objects for testing OpenAI tools functionality
 * across all phases 1A-12A of the implementation.
 * 
 * Features:
 * - Tool execution and handling mocks
 * - OpenAI API client mocks
 * - Validation service mocks
 * - Configurable responses and error injection
 * - Call tracking for test verification
 * - Jest integration support
 * - Performance testing support
 */

// Tool Handler Mocks
export {
  MockToolHandler,
  MockToolValidator as MockHandlerToolValidator,
  MockToolProcessor,
  MockToolConverter,
  MockToolErrorHandler,
  MockToolStateManager,
  MockToolStateTracker,
  createMockToolHandler,
  createJestMockToolHandler
} from './mock-tool-handler';

export type {
  MockToolHandlerConfig,
  MockCallInfo
} from './mock-tool-handler';

// OpenAI Client Mocks
export {
  MockOpenAIClient,
  MockOpenAIStreamResponse,
  createMockOpenAIClient,
  createJestMockOpenAIClient
} from './mock-openai-client';

export type {
  OpenAICompletionRequest,
  OpenAICompletionResponse,
  OpenAIStreamChunk,
  OpenAIModelInfo,
  MockOpenAIClientConfig,
  MockRequestInfo,
  MockResponseInfo
} from './mock-openai-client';

// Validator Mocks
export {
  MockToolSchemaValidator,
  MockToolValidator,
  MockToolArrayValidator,
  MockToolChoiceValidator,
  MockFormatValidator,
  MockRuntimeValidator,
  MockValidationFramework,
  createMockValidators,
  createJestMockValidators
} from './mock-validators';

export type {
  MockValidationConfig,
  MockValidationCallInfo
} from './mock-validators';

/**
 * Complete mock suite for OpenAI tools testing
 * Includes all mocks configured for different test scenarios
 */
export class OpenAIToolsMockSuite {
  public toolHandler: MockToolHandler;
  public openaiClient: MockOpenAIClient;
  public validators: ReturnType<typeof createMockValidators.successful>;
  
  constructor(config: {
    toolHandler?: import('./mock-tool-handler').MockToolHandlerConfig;
    openaiClient?: import('./mock-openai-client').MockOpenAIClientConfig;
    validators?: import('./mock-validators').MockValidationConfig;
  } = {}) {
    this.toolHandler = new MockToolHandler(config.toolHandler);
    this.openaiClient = new MockOpenAIClient(config.openaiClient);
    this.validators = createMockValidators.successful(config.validators);
  }

  /**
   * Configure all mocks for successful operations
   */
  configureSuccessful(): void {
    this.toolHandler.updateConfig({
      validationResponses: { success: true },
      processingResponses: { success: true },
      conversionResponses: { success: true },
      errorConfig: { shouldThrow: false }
    });

    this.openaiClient.updateConfig({
      errorConfig: { shouldError: false }
    });

    // Validators are already configured for success by default
  }

  /**
   * Configure all mocks to simulate errors
   */
  configureErrors(errorType: 'validation' | 'processing' | 'network' | 'timeout' = 'validation'): void {
    switch (errorType) {
      case 'validation':
        this.toolHandler.updateConfig({
          errorConfig: { shouldThrow: true, errorType: 'validation' }
        });
        this.validators.schemaValidator.updateConfig({
          errorConfig: { shouldThrow: true, errorType: 'validation' }
        });
        break;
        
      case 'processing':
        this.toolHandler.updateConfig({
          errorConfig: { shouldThrow: true, errorType: 'processing' }
        });
        break;
        
      case 'network':
        this.openaiClient.updateConfig({
          errorConfig: { shouldError: true, errorType: 'server' }
        });
        break;
        
      case 'timeout':
        this.toolHandler.updateConfig({
          performanceConfig: { shouldTimeout: true }
        });
        this.openaiClient.updateConfig({
          performanceConfig: { shouldTimeout: true }
        });
        break;
    }
  }

  /**
   * Configure all mocks for performance testing
   */
  configurePerformance(latencyMs: number = 100): void {
    this.toolHandler.updateConfig({
      performanceConfig: { latencyMs },
      trackCalls: false // Disable tracking for performance tests
    });

    this.openaiClient.updateConfig({
      performanceConfig: { latencyMs },
      trackRequests: false,
      trackResponses: false
    });

    // Update validators for performance
    Object.values(this.validators).forEach(validator => {
      if (validator.updateConfig) {
        validator.updateConfig({
          performanceConfig: { latencyMs },
          trackValidations: false
        });
      }
    });
  }

  /**
   * Get comprehensive call statistics
   */
  getStatistics() {
    return {
      toolHandler: {
        totalCalls: this.toolHandler.getCallCount(),
        callHistory: this.toolHandler.getCallHistory()
      },
      openaiClient: {
        totalRequests: this.openaiClient.getCallCount(),
        requestHistory: this.openaiClient.getRequestHistory(),
        responseHistory: this.openaiClient.getResponseHistory()
      },
      validators: {
        schemaValidator: {
          totalCalls: this.validators.schemaValidator.getCallCount(),
          callHistory: this.validators.schemaValidator.getCallHistory()
        },
        toolValidator: {
          totalCalls: this.validators.toolValidator.getCallCount(),
          callHistory: this.validators.toolValidator.getCallHistory()
        }
        // Add other validators as needed
      }
    };
  }

  /**
   * Reset all mocks to default state
   */
  reset(): void {
    this.toolHandler.reset();
    this.openaiClient.reset();
    Object.values(this.validators).forEach(validator => {
      if (validator.reset) {
        validator.reset();
      }
    });
  }

  /**
   * Clear all call history
   */
  clearHistory(): void {
    this.toolHandler.clearCallHistory();
    this.openaiClient.clearHistory();
    Object.values(this.validators).forEach(validator => {
      if (validator.clearCallHistory) {
        validator.clearCallHistory();
      }
    });
  }
}

/**
 * Preset configurations for common test scenarios
 */
export const MockSuitePresets = {
  /**
   * Default successful configuration
   */
  successful: () => new OpenAIToolsMockSuite({
    toolHandler: {
      validationResponses: { success: true },
      processingResponses: { success: true },
      conversionResponses: { success: true },
      errorConfig: { shouldThrow: false }
    },
    openaiClient: {
      errorConfig: { shouldError: false },
      performanceConfig: { latencyMs: 0 }
    },
    validators: {
      schemaValidation: { shouldPass: true },
      parameterValidation: { shouldPass: true },
      formatValidation: { shouldPass: true },
      runtimeValidation: { shouldPass: true }
    }
  }),

  /**
   * Configuration for validation error testing
   */
  validationErrors: () => new OpenAIToolsMockSuite({
    toolHandler: {
      validationResponses: { success: false, errors: ['Tool validation failed'] },
      errorConfig: { shouldThrow: false }
    },
    validators: {
      schemaValidation: { shouldPass: false, errors: ['Schema validation failed'] },
      parameterValidation: { shouldPass: false, errors: ['Parameter validation failed'] }
    }
  }),

  /**
   * Configuration for network error testing
   */
  networkErrors: () => new OpenAIToolsMockSuite({
    openaiClient: {
      errorConfig: { shouldError: true, errorType: 'server', errorMessage: 'Internal server error' }
    }
  }),

  /**
   * Configuration for timeout testing
   */
  timeouts: () => new OpenAIToolsMockSuite({
    toolHandler: {
      performanceConfig: { shouldTimeout: true, timeoutMs: 1000 }
    },
    openaiClient: {
      performanceConfig: { shouldTimeout: true, timeoutMs: 1000 }
    }
  }),

  /**
   * Configuration for performance testing
   */
  performance: (latencyMs: number = 100) => new OpenAIToolsMockSuite({
    toolHandler: {
      performanceConfig: { latencyMs },
      trackCalls: false
    },
    openaiClient: {
      performanceConfig: { latencyMs },
      trackRequests: false,
      trackResponses: false
    },
    validators: {
      trackValidations: false,
      performanceConfig: { latencyMs }
    }
  }),

  /**
   * Configuration for rate limiting testing
   */
  rateLimited: () => new OpenAIToolsMockSuite({
    openaiClient: {
      errorConfig: { shouldError: true, errorType: 'rate_limit' },
      performanceConfig: { rateLimitDelay: 1000 }
    }
  }),

  /**
   * Configuration for streaming testing
   */
  streaming: () => new OpenAIToolsMockSuite({
    openaiClient: {
      responses: {
        streamChunks: [
          [
            {
              id: 'chatcmpl-stream-test',
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
              id: 'chatcmpl-stream-test',
              object: 'chat.completion.chunk',
              created: Date.now(),
              model: 'gpt-4',
              choices: [{
                index: 0,
                delta: { content: 'Streaming response' },
                finish_reason: null
              }]
            },
            {
              id: 'chatcmpl-stream-test',
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
        ]
      }
    }
  }),

  /**
   * Lightweight configuration for unit tests
   */
  lightweight: () => new OpenAIToolsMockSuite({
    toolHandler: {
      trackCalls: false,
      performanceConfig: { latencyMs: 0 }
    },
    openaiClient: {
      trackRequests: false,
      trackResponses: false,
      trackHeaders: false,
      performanceConfig: { latencyMs: 0 }
    },
    validators: {
      trackValidations: false,
      performanceConfig: { latencyMs: 0 }
    }
  })
};

/**
 * Jest test utilities
 */
export const createJestMockSuite = (preset?: keyof typeof MockSuitePresets) => {
  const suite = preset ? MockSuitePresets[preset]() : MockSuitePresets.successful();
  
  return {
    suite,
    jestMocks: {
      toolHandler: createJestMockToolHandler(suite.toolHandler.config),
      openaiClient: createJestMockOpenAIClient(suite.openaiClient.config),
      validators: createJestMockValidators(suite.validators.schemaValidator.config)
    },
    
    // Convenience methods for Jest tests
    expectCalled: (mockMethod: jest.Mock, times?: number) => {
      if (times !== undefined) {
        expect(mockMethod).toHaveBeenCalledTimes(times);
      } else {
        expect(mockMethod).toHaveBeenCalled();
      }
    },
    
    expectCalledWith: (mockMethod: jest.Mock, ...args: any[]) => {
      expect(mockMethod).toHaveBeenCalledWith(...args);
    },
    
    expectLastCalledWith: (mockMethod: jest.Mock, ...args: any[]) => {
      expect(mockMethod).toHaveBeenLastCalledWith(...args);
    },
    
    resetAllMocks: () => {
      suite.reset();
      jest.clearAllMocks();
    }
  };
};

/**
 * Test data generators
 */
export const MockDataGenerators = {
  /**
   * Generate mock OpenAI tool
   */
  openaiTool: (name: string = 'test_tool') => ({
    type: 'function' as const,
    function: {
      name,
      description: `Mock ${name} for testing`,
      parameters: {
        type: 'object',
        properties: {
          param1: { type: 'string', description: 'Test parameter 1' },
          param2: { type: 'number', description: 'Test parameter 2' }
        },
        required: ['param1']
      }
    }
  }),

  /**
   * Generate mock tool call
   */
  toolCall: (toolName: string = 'test_tool', callId: string = 'call_test') => ({
    id: callId,
    type: 'function' as const,
    function: {
      name: toolName,
      arguments: JSON.stringify({ param1: 'test_value', param2: 42 })
    }
  }),

  /**
   * Generate mock completion request
   */
  completionRequest: (tools?: any[]) => ({
    model: 'gpt-4',
    messages: [
      { role: 'user' as const, content: 'Test message' }
    ],
    tools: tools || [MockDataGenerators.openaiTool()],
    tool_choice: 'auto' as const
  }),

  /**
   * Generate mock completion response
   */
  completionResponse: (withToolCalls: boolean = false) => ({
    id: 'chatcmpl-mock-test',
    object: 'chat.completion' as const,
    created: Math.floor(Date.now() / 1000),
    model: 'gpt-4',
    choices: [{
      index: 0,
      message: {
        role: 'assistant' as const,
        content: withToolCalls ? null : 'Mock response',
        ...(withToolCalls && {
          tool_calls: [MockDataGenerators.toolCall()]
        })
      },
      finish_reason: (withToolCalls ? 'tool_calls' : 'stop') as const
    }],
    usage: {
      prompt_tokens: 20,
      completion_tokens: 10,
      total_tokens: 30
    }
  })
};

/**
 * Default export with everything
 */
export default {
  // Main classes
  OpenAIToolsMockSuite,
  
  // Presets
  MockSuitePresets,
  
  // Utilities
  createJestMockSuite,
  MockDataGenerators,
  
  // Individual exports
  MockToolHandler,
  MockOpenAIClient,
  createMockValidators,
  createMockToolHandler,
  createMockOpenAIClient,
  createJestMockToolHandler,
  createJestMockOpenAIClient,
  createJestMockValidators
};