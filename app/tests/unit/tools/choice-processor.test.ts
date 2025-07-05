/**
 * Unit tests for tool choice processing service
 * Phase 5A: Complete test coverage for tool choice processing functionality
 * 
 * Tests choice processing with validation and Claude format conversion:
 * - Request processing with full validation
 * - Claude format conversion for all choice types
 * - Processing context creation for enforcement
 * - Performance requirements validation
 */

import {
  ToolChoiceProcessor,
  ToolChoiceProcessorFactory,
  ChoiceProcessingUtils,
  IToolChoiceProcessor,
  ToolChoiceProcessingRequest,
  ToolChoiceProcessingResult,
  ChoiceProcessingContext,
  ClaudeChoiceFormat,
  ToolChoiceProcessingError,
  ChoiceProcessingOptions
} from '../../../src/tools/choice-processor';
import {
  ToolChoiceLogic,
  IToolChoiceHandler,
  ProcessedToolChoice,
  ToolChoiceValidationResult
} from '../../../src/tools/choice';
import { OpenAITool, OpenAIToolChoice } from '../../../src/tools/types';
import {
  TOOL_CHOICE_BEHAVIORS,
  TOOL_CHOICE_MESSAGES,
  TOOL_CHOICE_ERRORS,
  TOOL_CHOICE_PROCESSING_LIMITS
} from '../../../src/tools/constants';

describe('ToolChoiceProcessor', () => {
  let processor: IToolChoiceProcessor;
  let mockChoiceHandler: jest.Mocked<IToolChoiceHandler>;
  let sampleTools: OpenAITool[];

  beforeEach(() => {
    // Create mock choice handler
    mockChoiceHandler = {
      validateChoice: jest.fn(),
      processChoice: jest.fn(),
      createBehavior: jest.fn()
    };

    processor = new ToolChoiceProcessor(mockChoiceHandler);
    
    sampleTools = [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get current weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'City name'
              }
            },
            required: ['location']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_web',
          description: 'Search the web for information',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query'
              }
            },
            required: ['query']
          }
        }
      }
    ];
  });

  describe('processChoice', () => {
    describe('successful processing', () => {
      it('should process auto choice successfully', async () => {
        const request: ToolChoiceProcessingRequest = {
          choice: 'auto',
          tools: sampleTools,
          requestId: 'test-request-1'
        };

        const mockProcessedChoice: ProcessedToolChoice = {
          type: 'auto',
          behavior: {
            allowsClaudeDecision: true,
            forcesTextOnly: false,
            forcesSpecificFunction: false,
            description: 'Auto allows Claude decision'
          },
          originalChoice: 'auto'
        };

        const mockValidation: ToolChoiceValidationResult = {
          valid: true,
          errors: [],
          choice: mockProcessedChoice,
          validationTimeMs: 2
        };

        mockChoiceHandler.validateChoice.mockReturnValue(mockValidation);

        const result = await processor.processChoice(request);

        expect(result.success).toBe(true);
        expect(result.processedChoice).toEqual(mockProcessedChoice);
        expect(result.claudeFormat).toEqual({
          mode: 'auto',
          allowTools: true,
          restrictions: {
            onlyTextResponse: false,
            specificFunction: false
          }
        });
        expect(result.errors).toHaveLength(0);
        expect(result.requestId).toBe('test-request-1');
        expect(result.processingTimeMs).toBeDefined();
        expect(result.processingTimeMs!).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
      });

      it('should process none choice successfully', async () => {
        const request: ToolChoiceProcessingRequest = {
          choice: 'none',
          tools: sampleTools,
          requestId: 'test-request-2'
        };

        const mockProcessedChoice: ProcessedToolChoice = {
          type: 'none',
          behavior: {
            allowsClaudeDecision: false,
            forcesTextOnly: true,
            forcesSpecificFunction: false,
            description: 'None forces text only'
          },
          originalChoice: 'none'
        };

        const mockValidation: ToolChoiceValidationResult = {
          valid: true,
          errors: [],
          choice: mockProcessedChoice,
          validationTimeMs: 1
        };

        mockChoiceHandler.validateChoice.mockReturnValue(mockValidation);

        const result = await processor.processChoice(request);

        expect(result.success).toBe(true);
        expect(result.processedChoice).toEqual(mockProcessedChoice);
        expect(result.claudeFormat).toEqual({
          mode: 'none',
          allowTools: false,
          restrictions: {
            onlyTextResponse: true,
            specificFunction: false
          }
        });
        expect(result.errors).toHaveLength(0);
        expect(result.requestId).toBe('test-request-2');
      });

      it('should process function choice successfully', async () => {
        const functionChoice: OpenAIToolChoice = {
          type: 'function',
          function: { name: 'get_weather' }
        };

        const request: ToolChoiceProcessingRequest = {
          choice: functionChoice,
          tools: sampleTools,
          requestId: 'test-request-3'
        };

        const mockProcessedChoice: ProcessedToolChoice = {
          type: 'function',
          behavior: {
            allowsClaudeDecision: false,
            forcesTextOnly: false,
            forcesSpecificFunction: true,
            functionName: 'get_weather',
            description: 'Function forces specific call'
          },
          functionName: 'get_weather',
          originalChoice: functionChoice
        };

        const mockValidation: ToolChoiceValidationResult = {
          valid: true,
          errors: [],
          choice: mockProcessedChoice,
          validationTimeMs: 3
        };

        mockChoiceHandler.validateChoice.mockReturnValue(mockValidation);

        const result = await processor.processChoice(request);

        expect(result.success).toBe(true);
        expect(result.processedChoice).toEqual(mockProcessedChoice);
        expect(result.claudeFormat).toEqual({
          mode: 'specific',
          allowTools: true,
          forceFunction: 'get_weather',
          restrictions: {
            onlyTextResponse: false,
            specificFunction: true,
            functionName: 'get_weather'
          }
        });
        expect(result.errors).toHaveLength(0);
        expect(result.requestId).toBe('test-request-3');
      });

      it('should process choice without tools', async () => {
        const request: ToolChoiceProcessingRequest = {
          choice: 'auto',
          requestId: 'test-request-4'
        };

        const mockProcessedChoice: ProcessedToolChoice = {
          type: 'auto',
          behavior: {
            allowsClaudeDecision: true,
            forcesTextOnly: false,
            forcesSpecificFunction: false,
            description: 'Auto allows Claude decision'
          },
          originalChoice: 'auto'
        };

        const mockValidation: ToolChoiceValidationResult = {
          valid: true,
          errors: [],
          choice: mockProcessedChoice,
          validationTimeMs: 1
        };

        mockChoiceHandler.validateChoice.mockReturnValue(mockValidation);

        const result = await processor.processChoice(request);

        expect(result.success).toBe(true);
        expect(result.processedChoice).toEqual(mockProcessedChoice);
        expect(result.requestId).toBe('test-request-4');
      });
    });

    describe('validation failures', () => {
      it('should handle validation failure', async () => {
        const request: ToolChoiceProcessingRequest = {
          choice: 'invalid' as OpenAIToolChoice,
          tools: sampleTools,
          requestId: 'test-request-5'
        };

        const mockValidation: ToolChoiceValidationResult = {
          valid: false,
          errors: [TOOL_CHOICE_MESSAGES.CHOICE_INVALID],
          validationTimeMs: 1
        };

        mockChoiceHandler.validateChoice.mockReturnValue(mockValidation);

        const result = await processor.processChoice(request);

        expect(result.success).toBe(false);
        expect(result.processedChoice).toBeUndefined();
        expect(result.claudeFormat).toBeUndefined();
        expect(result.errors).toEqual([TOOL_CHOICE_MESSAGES.CHOICE_INVALID]);
        expect(result.requestId).toBe('test-request-5');
      });

      it('should handle missing processed choice', async () => {
        const request: ToolChoiceProcessingRequest = {
          choice: 'auto',
          tools: sampleTools
        };

        const mockValidation: ToolChoiceValidationResult = {
          valid: true,
          errors: [],
          // Missing choice field
          validationTimeMs: 1
        };

        mockChoiceHandler.validateChoice.mockReturnValue(mockValidation);

        const result = await processor.processChoice(request);

        expect(result.success).toBe(false);
        expect(result.errors).toEqual([TOOL_CHOICE_MESSAGES.CHOICE_PROCESSING_FAILED]);
      });

      it('should handle validation exception', async () => {
        const request: ToolChoiceProcessingRequest = {
          choice: 'auto',
          tools: sampleTools
        };

        mockChoiceHandler.validateChoice.mockImplementation(() => {
          throw new Error('Validation error');
        });

        const result = await processor.processChoice(request);

        expect(result.success).toBe(false);
        expect(result.errors).toEqual(['Validation error']);
      });
    });

    describe('timeout handling', () => {
      it('should handle timeout when enforceTimeout is true', async () => {
        const request: ToolChoiceProcessingRequest = {
          choice: 'auto',
          tools: sampleTools
        };

        const options: ChoiceProcessingOptions = {
          enforceTimeout: true,
          timeoutMs: 1 // Very short timeout
        };

        const mockProcessedChoice: ProcessedToolChoice = {
          type: 'auto',
          behavior: {
            allowsClaudeDecision: true,
            forcesTextOnly: false,
            forcesSpecificFunction: false,
            description: 'Auto allows Claude decision'
          },
          originalChoice: 'auto'
        };

        const mockValidation: ToolChoiceValidationResult = {
          valid: true,
          errors: [],
          choice: mockProcessedChoice,
          validationTimeMs: 1
        };

        mockChoiceHandler.validateChoice.mockImplementation(() => {
          // Simulate slow processing
          const start = Date.now();
          while (Date.now() - start < 10) {
            // Busy wait to simulate slow processing
          }
          return mockValidation;
        });

        const result = await processor.processChoice(request, options);

        expect(result.success).toBe(false);
        expect(result.errors).toEqual([TOOL_CHOICE_MESSAGES.CHOICE_PROCESSING_TIMEOUT]);
      });

      it('should not enforce timeout when enforceTimeout is false', async () => {
        const request: ToolChoiceProcessingRequest = {
          choice: 'auto',
          tools: sampleTools
        };

        const options: ChoiceProcessingOptions = {
          enforceTimeout: false,
          timeoutMs: 1 // Very short timeout, but disabled
        };

        const mockProcessedChoice: ProcessedToolChoice = {
          type: 'auto',
          behavior: {
            allowsClaudeDecision: true,
            forcesTextOnly: false,
            forcesSpecificFunction: false,
            description: 'Auto allows Claude decision'
          },
          originalChoice: 'auto'
        };

        const mockValidation: ToolChoiceValidationResult = {
          valid: true,
          errors: [],
          choice: mockProcessedChoice,
          validationTimeMs: 1
        };

        mockChoiceHandler.validateChoice.mockReturnValue(mockValidation);

        const result = await processor.processChoice(request, options);

        expect(result.success).toBe(true);
        expect(result.processedChoice).toEqual(mockProcessedChoice);
      });
    });

    describe('processing options', () => {
      it('should use default options when none provided', async () => {
        const request: ToolChoiceProcessingRequest = {
          choice: 'auto',
          tools: sampleTools
        };

        const mockProcessedChoice: ProcessedToolChoice = {
          type: 'auto',
          behavior: {
            allowsClaudeDecision: true,
            forcesTextOnly: false,
            forcesSpecificFunction: false,
            description: 'Auto allows Claude decision'
          },
          originalChoice: 'auto'
        };

        const mockValidation: ToolChoiceValidationResult = {
          valid: true,
          errors: [],
          choice: mockProcessedChoice,
          validationTimeMs: 1
        };

        mockChoiceHandler.validateChoice.mockReturnValue(mockValidation);

        const result = await processor.processChoice(request);

        expect(result.success).toBe(true);
        expect(mockChoiceHandler.validateChoice).toHaveBeenCalledWith('auto', sampleTools);
      });

      it('should use custom options when provided', async () => {
        const request: ToolChoiceProcessingRequest = {
          choice: 'auto',
          tools: sampleTools
        };

        const options: ChoiceProcessingOptions = {
          validateChoice: true,
          convertToClaude: true,
          enforceTimeout: false,
          timeoutMs: 100,
          allowInvalidTools: true
        };

        const mockProcessedChoice: ProcessedToolChoice = {
          type: 'auto',
          behavior: {
            allowsClaudeDecision: true,
            forcesTextOnly: false,
            forcesSpecificFunction: false,
            description: 'Auto allows Claude decision'
          },
          originalChoice: 'auto'
        };

        const mockValidation: ToolChoiceValidationResult = {
          valid: true,
          errors: [],
          choice: mockProcessedChoice,
          validationTimeMs: 1
        };

        mockChoiceHandler.validateChoice.mockReturnValue(mockValidation);

        const result = await processor.processChoice(request, options);

        expect(result.success).toBe(true);
      });
    });
  });

  describe('validateAndProcess', () => {
    it('should validate and process choice successfully', async () => {
      const choice: OpenAIToolChoice = 'auto';

      const mockProcessedChoice: ProcessedToolChoice = {
        type: 'auto',
        behavior: {
          allowsClaudeDecision: true,
          forcesTextOnly: false,
          forcesSpecificFunction: false,
          description: 'Auto allows Claude decision'
        },
        originalChoice: 'auto'
      };

      const mockValidation: ToolChoiceValidationResult = {
        valid: true,
        errors: [],
        choice: mockProcessedChoice,
        validationTimeMs: 1
      };

      mockChoiceHandler.validateChoice.mockReturnValue(mockValidation);

      const result = await processor.validateAndProcess(choice, sampleTools);

      expect(result.success).toBe(true);
      expect(result.processedChoice).toEqual(mockProcessedChoice);
      expect(result.claudeFormat).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should handle validation failure in validateAndProcess', async () => {
      const choice: OpenAIToolChoice = 'invalid' as OpenAIToolChoice;

      const mockValidation: ToolChoiceValidationResult = {
        valid: false,
        errors: [TOOL_CHOICE_MESSAGES.CHOICE_INVALID]
      };

      mockChoiceHandler.validateChoice.mockReturnValue(mockValidation);

      const result = await processor.validateAndProcess(choice, sampleTools);

      expect(result.success).toBe(false);
      expect(result.errors).toEqual([TOOL_CHOICE_MESSAGES.CHOICE_INVALID]);
    });
  });

  describe('convertToClaudeFormat', () => {
    it('should convert auto choice to Claude format', () => {
      const processedChoice: ProcessedToolChoice = {
        type: 'auto',
        behavior: {
          allowsClaudeDecision: true,
          forcesTextOnly: false,
          forcesSpecificFunction: false,
          description: 'Auto allows Claude decision'
        },
        originalChoice: 'auto'
      };

      const result = processor.convertToClaudeFormat(processedChoice);

      expect(result).toEqual({
        mode: 'auto',
        allowTools: true,
        restrictions: {
          onlyTextResponse: false,
          specificFunction: false
        }
      });
    });

    it('should convert none choice to Claude format', () => {
      const processedChoice: ProcessedToolChoice = {
        type: 'none',
        behavior: {
          allowsClaudeDecision: false,
          forcesTextOnly: true,
          forcesSpecificFunction: false,
          description: 'None forces text only'
        },
        originalChoice: 'none'
      };

      const result = processor.convertToClaudeFormat(processedChoice);

      expect(result).toEqual({
        mode: 'none',
        allowTools: false,
        restrictions: {
          onlyTextResponse: true,
          specificFunction: false
        }
      });
    });

    it('should convert function choice to Claude format', () => {
      const processedChoice: ProcessedToolChoice = {
        type: 'function',
        behavior: {
          allowsClaudeDecision: false,
          forcesTextOnly: false,
          forcesSpecificFunction: true,
          functionName: 'get_weather',
          description: 'Function forces specific call'
        },
        functionName: 'get_weather',
        originalChoice: { type: 'function', function: { name: 'get_weather' } }
      };

      const result = processor.convertToClaudeFormat(processedChoice);

      expect(result).toEqual({
        mode: 'specific',
        allowTools: true,
        forceFunction: 'get_weather',
        restrictions: {
          onlyTextResponse: false,
          specificFunction: true,
          functionName: 'get_weather'
        }
      });
    });

    it('should throw error for unknown choice type', () => {
      const processedChoice = {
        type: 'unknown',
        behavior: {
          allowsClaudeDecision: false,
          forcesTextOnly: false,
          forcesSpecificFunction: false,
          description: 'Unknown'
        },
        originalChoice: 'unknown'
      } as any;

      expect(() => {
        processor.convertToClaudeFormat(processedChoice);
      }).toThrow(ToolChoiceProcessingError);
    });
  });

  describe('createProcessingContext', () => {
    it('should create context for successful result', () => {
      const result: ToolChoiceProcessingResult = {
        success: true,
        processedChoice: {
          type: 'function',
          behavior: {
            allowsClaudeDecision: false,
            forcesTextOnly: false,
            forcesSpecificFunction: true,
            functionName: 'get_weather',
            description: 'Function forces specific call'
          },
          functionName: 'get_weather',
          originalChoice: { type: 'function', function: { name: 'get_weather' } }
        },
        claudeFormat: {
          mode: 'specific',
          allowTools: true,
          forceFunction: 'get_weather',
          restrictions: {
            onlyTextResponse: false,
            specificFunction: true,
            functionName: 'get_weather'
          }
        },
        errors: [],
        processingTimeMs: 2
      };

      const context = processor.createProcessingContext(result);

      expect(context).toEqual({
        hasChoice: true,
        choiceType: 'function',
        allowsTools: true,
        forcesTextOnly: false,
        forcesSpecificFunction: true,
        functionName: 'get_weather',
        claudeFormat: result.claudeFormat,
        processingTimeMs: 2
      });
    });

    it('should create fallback context for failed result', () => {
      const result: ToolChoiceProcessingResult = {
        success: false,
        errors: ['Validation failed'],
        processingTimeMs: 1
      };

      const context = processor.createProcessingContext(result);

      expect(context).toEqual({
        hasChoice: false,
        choiceType: 'unknown',
        allowsTools: false,
        forcesTextOnly: true,
        forcesSpecificFunction: false,
        claudeFormat: {
          mode: 'none',
          allowTools: false,
          restrictions: {
            onlyTextResponse: true,
            specificFunction: false
          }
        },
        processingTimeMs: 1
      });
    });

    it('should handle missing processing time', () => {
      const result: ToolChoiceProcessingResult = {
        success: false,
        errors: ['Validation failed']
      };

      const context = processor.createProcessingContext(result);

      expect(context.processingTimeMs).toBe(0);
    });
  });
});

describe('ChoiceProcessingUtils', () => {
  describe('result validation', () => {
    it('should identify successful result', () => {
      const result: ToolChoiceProcessingResult = {
        success: true,
        processedChoice: {
          type: 'auto',
          behavior: {
            allowsClaudeDecision: true,
            forcesTextOnly: false,
            forcesSpecificFunction: false,
            description: 'Auto allows Claude decision'
          },
          originalChoice: 'auto'
        },
        claudeFormat: {
          mode: 'auto',
          allowTools: true,
          restrictions: {
            onlyTextResponse: false,
            specificFunction: false
          }
        },
        errors: []
      };

      expect(ChoiceProcessingUtils.isSuccessful(result)).toBe(true);
    });

    it('should identify failed result', () => {
      const result: ToolChoiceProcessingResult = {
        success: false,
        errors: ['Validation failed']
      };

      expect(ChoiceProcessingUtils.isSuccessful(result)).toBe(false);
    });

    it('should identify incomplete successful result', () => {
      const result: ToolChoiceProcessingResult = {
        success: true,
        // Missing processedChoice and claudeFormat
        errors: []
      };

      expect(ChoiceProcessingUtils.isSuccessful(result)).toBe(false);
    });
  });

  describe('behavior checks', () => {
    it('should check if result allows tools', () => {
      const result: ToolChoiceProcessingResult = {
        success: true,
        claudeFormat: {
          mode: 'auto',
          allowTools: true,
          restrictions: {
            onlyTextResponse: false,
            specificFunction: false
          }
        },
        errors: []
      };

      expect(ChoiceProcessingUtils.allowsTools(result)).toBe(true);
    });

    it('should check if result forces text only', () => {
      const result: ToolChoiceProcessingResult = {
        success: true,
        claudeFormat: {
          mode: 'none',
          allowTools: false,
          restrictions: {
            onlyTextResponse: true,
            specificFunction: false
          }
        },
        errors: []
      };

      expect(ChoiceProcessingUtils.forcesTextOnly(result)).toBe(true);
    });

    it('should check if result forces specific function', () => {
      const result: ToolChoiceProcessingResult = {
        success: true,
        claudeFormat: {
          mode: 'specific',
          allowTools: true,
          forceFunction: 'get_weather',
          restrictions: {
            onlyTextResponse: false,
            specificFunction: true,
            functionName: 'get_weather'
          }
        },
        errors: []
      };

      expect(ChoiceProcessingUtils.forcesSpecificFunction(result)).toBe(true);
      expect(ChoiceProcessingUtils.getFunctionName(result)).toBe('get_weather');
    });

    it('should handle missing claude format', () => {
      const result: ToolChoiceProcessingResult = {
        success: false,
        errors: ['Failed']
      };

      expect(ChoiceProcessingUtils.allowsTools(result)).toBe(false);
      expect(ChoiceProcessingUtils.forcesTextOnly(result)).toBe(false);
      expect(ChoiceProcessingUtils.forcesSpecificFunction(result)).toBe(false);
      expect(ChoiceProcessingUtils.getFunctionName(result)).toBeUndefined();
    });
  });

  describe('performance validation', () => {
    it('should validate performance for fast processing', () => {
      const result: ToolChoiceProcessingResult = {
        success: true,
        errors: [],
        processingTimeMs: 2
      };

      expect(ChoiceProcessingUtils.meetsPerformanceRequirements(result)).toBe(true);
    });

    it('should reject performance for slow processing', () => {
      const result: ToolChoiceProcessingResult = {
        success: true,
        errors: [],
        processingTimeMs: 60
      };

      expect(ChoiceProcessingUtils.meetsPerformanceRequirements(result)).toBe(false);
    });

    it('should handle undefined processing time', () => {
      const result: ToolChoiceProcessingResult = {
        success: true,
        errors: []
      };

      expect(ChoiceProcessingUtils.meetsPerformanceRequirements(result)).toBe(true);
    });
  });

  describe('utility functions', () => {
    it('should create default options', () => {
      const options = ChoiceProcessingUtils.createDefaultOptions();

      expect(options).toEqual({
        validateChoice: true,
        convertToClaude: true,
        enforceTimeout: true,
        timeoutMs: TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS,
        allowInvalidTools: false
      });
    });

    it('should create error result', () => {
      const errors = ['Error 1', 'Error 2'];
      const processingTime = 5;

      const result = ChoiceProcessingUtils.createErrorResult(errors, processingTime);

      expect(result).toEqual({
        success: false,
        errors,
        processingTimeMs: processingTime
      });
    });
  });
});

describe('ToolChoiceProcessorFactory', () => {
  it('should create processor instance', () => {
    const choiceHandler = new ToolChoiceLogic();
    const processor = ToolChoiceProcessorFactory.create(choiceHandler);

    expect(processor).toBeInstanceOf(ToolChoiceProcessor);
  });

  it('should create different instances', () => {
    const choiceHandler = new ToolChoiceLogic();
    const processor1 = ToolChoiceProcessorFactory.create(choiceHandler);
    const processor2 = ToolChoiceProcessorFactory.create(choiceHandler);

    expect(processor1).not.toBe(processor2);
  });
});

describe('ToolChoiceProcessingError', () => {
  it('should create error with message and code', () => {
    const error = new ToolChoiceProcessingError('Test message', 'TEST_CODE');

    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('ToolChoiceProcessingError');
  });

  it('should create error with choice and processing time', () => {
    const choice: OpenAIToolChoice = { type: 'function', function: { name: 'test' } };
    const error = new ToolChoiceProcessingError('Test message', 'TEST_CODE', choice, 5);

    expect(error.choice).toBe(choice);
    expect(error.processingTimeMs).toBe(5);
  });
});

describe('Performance Requirements', () => {
  let processor: IToolChoiceProcessor;
  let performanceTools: OpenAITool[];

  beforeEach(() => {
    const choiceHandler = new ToolChoiceLogic();
    processor = new ToolChoiceProcessor(choiceHandler);
    
    // Create a larger set of tools for performance testing
    performanceTools = Array.from({ length: 50 }, (_, i) => ({
      type: 'function',
      function: {
        name: `function_${i}`,
        description: `Test function ${i}`,
        parameters: {
          type: 'object',
          properties: {
            param: { type: 'string' }
          }
        }
      }
    }));
  });

  it('should process auto choice within 5ms performance limit', async () => {
    const request: ToolChoiceProcessingRequest = {
      choice: 'auto',
      tools: performanceTools
    };

    const startTime = Date.now();
    const result = await processor.processChoice(request);
    const endTime = Date.now();

    expect(result.success).toBe(true);
    expect(endTime - startTime).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
  });

  it('should process none choice within 5ms performance limit', async () => {
    const request: ToolChoiceProcessingRequest = {
      choice: 'none',
      tools: performanceTools
    };

    const startTime = Date.now();
    const result = await processor.processChoice(request);
    const endTime = Date.now();

    expect(result.success).toBe(true);
    expect(endTime - startTime).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
  });

  it('should process function choice within 5ms performance limit', async () => {
    const request: ToolChoiceProcessingRequest = {
      choice: { type: 'function', function: { name: 'function_25' } },
      tools: performanceTools
    };

    const startTime = Date.now();
    const result = await processor.processChoice(request);
    const endTime = Date.now();

    expect(result.success).toBe(true);
    expect(endTime - startTime).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
  });

  it('should process multiple choices within performance limits', async () => {
    const choices: OpenAIToolChoice[] = [
      'auto',
      'none',
      { type: 'function', function: { name: 'function_0' } },
      { type: 'function', function: { name: 'function_25' } },
      { type: 'function', function: { name: 'function_49' } }
    ];

    for (const choice of choices) {
      const request: ToolChoiceProcessingRequest = {
        choice,
        tools: performanceTools
      };

      const startTime = Date.now();
      await processor.processChoice(request);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
    }
  });
});