/**
 * Unit tests for tool choice logic implementation
 * Phase 5A: Complete test coverage for tool choice validation and processing
 * 
 * Tests tool_choice parameter behavior:
 * - "auto": Claude decides tool usage autonomously
 * - "none": Forces text-only responses, no tool calls
 * - Specific function: Forces exact function call
 */

import {
  ToolChoiceLogic,
  ToolChoiceUtils,
  ToolChoiceHandlerFactory,
  ToolChoiceError,
  IToolChoiceHandler,
  ToolChoiceValidationResult,
  ProcessedToolChoice,
  ToolChoiceBehavior
} from '../../../src/tools/choice';
import { OpenAITool, OpenAIToolChoice } from '../../../src/tools/types';
import {
  TOOL_CHOICE_BEHAVIORS,
  TOOL_CHOICE_MESSAGES,
  TOOL_CHOICE_ERRORS,
  TOOL_CHOICE_PROCESSING_LIMITS
} from '../../../src/tools/constants';

describe('ToolChoiceLogic', () => {
  let toolChoiceHandler: IToolChoiceHandler;
  let sampleTools: OpenAITool[];

  beforeEach(() => {
    toolChoiceHandler = new ToolChoiceLogic();
    
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

  describe('validateChoice', () => {
    describe('auto choice validation', () => {
      it('should validate "auto" choice successfully', () => {
        const result = toolChoiceHandler.validateChoice('auto', sampleTools);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.choice).toBeDefined();
        expect(result.choice!.type).toBe('auto');
        expect(result.choice!.behavior.allowsClaudeDecision).toBe(true);
        expect(result.choice!.behavior.forcesTextOnly).toBe(false);
        expect(result.choice!.behavior.forcesSpecificFunction).toBe(false);
      });

      it('should validate "auto" choice without tools', () => {
        const result = toolChoiceHandler.validateChoice('auto');
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.choice!.type).toBe('auto');
      });

      it('should complete auto choice validation within performance limit', () => {
        const result = toolChoiceHandler.validateChoice('auto', sampleTools);
        
        expect(result.validationTimeMs).toBeDefined();
        expect(result.validationTimeMs!).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
      });
    });

    describe('none choice validation', () => {
      it('should validate "none" choice successfully', () => {
        const result = toolChoiceHandler.validateChoice('none', sampleTools);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.choice).toBeDefined();
        expect(result.choice!.type).toBe('none');
        expect(result.choice!.behavior.allowsClaudeDecision).toBe(false);
        expect(result.choice!.behavior.forcesTextOnly).toBe(true);
        expect(result.choice!.behavior.forcesSpecificFunction).toBe(false);
      });

      it('should validate "none" choice without tools', () => {
        const result = toolChoiceHandler.validateChoice('none');
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.choice!.type).toBe('none');
      });

      it('should complete none choice validation within performance limit', () => {
        const result = toolChoiceHandler.validateChoice('none', sampleTools);
        
        expect(result.validationTimeMs).toBeDefined();
        expect(result.validationTimeMs!).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
      });
    });

    describe('function choice validation', () => {
      it('should validate valid function choice successfully', () => {
        const functionChoice: OpenAIToolChoice = {
          type: 'function',
          function: { name: 'get_weather' }
        };
        
        const result = toolChoiceHandler.validateChoice(functionChoice, sampleTools);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.choice).toBeDefined();
        expect(result.choice!.type).toBe('function');
        expect(result.choice!.functionName).toBe('get_weather');
        expect(result.choice!.behavior.allowsClaudeDecision).toBe(false);
        expect(result.choice!.behavior.forcesTextOnly).toBe(false);
        expect(result.choice!.behavior.forcesSpecificFunction).toBe(true);
        expect(result.choice!.behavior.functionName).toBe('get_weather');
      });

      it('should reject function choice for non-existent function', () => {
        const functionChoice: OpenAIToolChoice = {
          type: 'function',
          function: { name: 'non_existent_function' }
        };
        
        const result = toolChoiceHandler.validateChoice(functionChoice, sampleTools);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(TOOL_CHOICE_MESSAGES.CHOICE_FUNCTION_NOT_FOUND);
      });

      it('should reject function choice when no tools provided', () => {
        const functionChoice: OpenAIToolChoice = {
          type: 'function',
          function: { name: 'get_weather' }
        };
        
        const result = toolChoiceHandler.validateChoice(functionChoice);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(TOOL_CHOICE_MESSAGES.CHOICE_FUNCTION_NOT_FOUND);
      });

      it('should reject function choice with empty tools array', () => {
        const functionChoice: OpenAIToolChoice = {
          type: 'function',
          function: { name: 'get_weather' }
        };
        
        const result = toolChoiceHandler.validateChoice(functionChoice, []);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(TOOL_CHOICE_MESSAGES.CHOICE_FUNCTION_NOT_FOUND);
      });

      it('should reject function choice without function name', () => {
        const invalidChoice = {
          type: 'function',
          function: {}
        } as OpenAIToolChoice;
        
        const result = toolChoiceHandler.validateChoice(invalidChoice, sampleTools);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(TOOL_CHOICE_MESSAGES.CHOICE_FUNCTION_NAME_REQUIRED);
      });

      it('should reject function choice without function object', () => {
        const invalidChoice = {
          type: 'function'
        } as OpenAIToolChoice;
        
        const result = toolChoiceHandler.validateChoice(invalidChoice, sampleTools);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(TOOL_CHOICE_MESSAGES.CHOICE_FUNCTION_NAME_REQUIRED);
      });

      it('should complete function choice validation within performance limit', () => {
        const functionChoice: OpenAIToolChoice = {
          type: 'function',
          function: { name: 'get_weather' }
        };
        
        const result = toolChoiceHandler.validateChoice(functionChoice, sampleTools);
        
        expect(result.validationTimeMs).toBeDefined();
        expect(result.validationTimeMs!).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
      });
    });

    describe('invalid choice validation', () => {
      it('should reject invalid string choice', () => {
        const result = toolChoiceHandler.validateChoice('invalid' as OpenAIToolChoice, sampleTools);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(TOOL_CHOICE_MESSAGES.CHOICE_INVALID);
      });

      it('should reject null choice', () => {
        const result = toolChoiceHandler.validateChoice(null as any, sampleTools);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(TOOL_CHOICE_MESSAGES.CHOICE_INVALID);
      });

      it('should reject undefined choice', () => {
        const result = toolChoiceHandler.validateChoice(undefined as any, sampleTools);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(TOOL_CHOICE_MESSAGES.CHOICE_INVALID);
      });

      it('should reject invalid object choice', () => {
        const invalidChoice = { invalid: 'choice' } as unknown as OpenAIToolChoice;
        
        const result = toolChoiceHandler.validateChoice(invalidChoice, sampleTools);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(TOOL_CHOICE_MESSAGES.CHOICE_INVALID);
      });

      it('should reject function choice with wrong type', () => {
        const invalidChoice = {
          type: 'invalid',
          function: { name: 'get_weather' }
        } as unknown as OpenAIToolChoice;
        
        const result = toolChoiceHandler.validateChoice(invalidChoice, sampleTools);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(TOOL_CHOICE_MESSAGES.CHOICE_INVALID);
      });
    });
  });

  describe('processChoice', () => {
    it('should process auto choice correctly', () => {
      const processed = toolChoiceHandler.processChoice('auto', sampleTools);
      
      expect(processed.type).toBe('auto');
      expect(processed.originalChoice).toBe('auto');
      expect(processed.functionName).toBeUndefined();
      expect(processed.behavior.allowsClaudeDecision).toBe(true);
      expect(processed.behavior.forcesTextOnly).toBe(false);
      expect(processed.behavior.forcesSpecificFunction).toBe(false);
    });

    it('should process none choice correctly', () => {
      const processed = toolChoiceHandler.processChoice('none', sampleTools);
      
      expect(processed.type).toBe('none');
      expect(processed.originalChoice).toBe('none');
      expect(processed.functionName).toBeUndefined();
      expect(processed.behavior.allowsClaudeDecision).toBe(false);
      expect(processed.behavior.forcesTextOnly).toBe(true);
      expect(processed.behavior.forcesSpecificFunction).toBe(false);
    });

    it('should process function choice correctly', () => {
      const functionChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'get_weather' }
      };
      
      const processed = toolChoiceHandler.processChoice(functionChoice, sampleTools);
      
      expect(processed.type).toBe('function');
      expect(processed.originalChoice).toBe(functionChoice);
      expect(processed.functionName).toBe('get_weather');
      expect(processed.behavior.allowsClaudeDecision).toBe(false);
      expect(processed.behavior.forcesTextOnly).toBe(false);
      expect(processed.behavior.forcesSpecificFunction).toBe(true);
      expect(processed.behavior.functionName).toBe('get_weather');
    });

    it('should throw error for invalid choice', () => {
      expect(() => {
        toolChoiceHandler.processChoice('invalid' as OpenAIToolChoice, sampleTools);
      }).toThrow(ToolChoiceError);
    });
  });

  describe('createBehavior', () => {
    it('should create correct behavior for auto choice', () => {
      const behavior = toolChoiceHandler.createBehavior('auto', sampleTools);
      
      expect(behavior.allowsClaudeDecision).toBe(true);
      expect(behavior.forcesTextOnly).toBe(false);
      expect(behavior.forcesSpecificFunction).toBe(false);
      expect(behavior.functionName).toBeUndefined();
      expect(behavior.description).toBe(TOOL_CHOICE_MESSAGES.AUTO_ALLOWS_CLAUDE_DECISION);
    });

    it('should create correct behavior for none choice', () => {
      const behavior = toolChoiceHandler.createBehavior('none', sampleTools);
      
      expect(behavior.allowsClaudeDecision).toBe(false);
      expect(behavior.forcesTextOnly).toBe(true);
      expect(behavior.forcesSpecificFunction).toBe(false);
      expect(behavior.functionName).toBeUndefined();
      expect(behavior.description).toBe(TOOL_CHOICE_MESSAGES.NONE_FORCES_TEXT_ONLY);
    });

    it('should create correct behavior for function choice', () => {
      const functionChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'get_weather' }
      };
      
      const behavior = toolChoiceHandler.createBehavior(functionChoice, sampleTools);
      
      expect(behavior.allowsClaudeDecision).toBe(false);
      expect(behavior.forcesTextOnly).toBe(false);
      expect(behavior.forcesSpecificFunction).toBe(true);
      expect(behavior.functionName).toBe('get_weather');
      expect(behavior.description).toBe(TOOL_CHOICE_MESSAGES.FUNCTION_FORCES_SPECIFIC_CALL);
    });

    it('should throw error for invalid choice', () => {
      expect(() => {
        toolChoiceHandler.createBehavior('invalid' as OpenAIToolChoice, sampleTools);
      }).toThrow(ToolChoiceError);
    });
  });
});

describe('ToolChoiceUtils', () => {
  describe('choice type checking', () => {
    it('should correctly identify auto choice', () => {
      expect(ToolChoiceUtils.isAutoChoice('auto')).toBe(true);
      expect(ToolChoiceUtils.isAutoChoice('none')).toBe(false);
      expect(ToolChoiceUtils.isAutoChoice({ type: 'function', function: { name: 'test' } })).toBe(false);
    });

    it('should correctly identify none choice', () => {
      expect(ToolChoiceUtils.isNoneChoice('none')).toBe(true);
      expect(ToolChoiceUtils.isNoneChoice('auto')).toBe(false);
      expect(ToolChoiceUtils.isNoneChoice({ type: 'function', function: { name: 'test' } })).toBe(false);
    });

    it('should correctly identify function choice', () => {
      expect(ToolChoiceUtils.isFunctionChoice({ type: 'function', function: { name: 'test' } })).toBe(true);
      expect(ToolChoiceUtils.isFunctionChoice('auto')).toBe(false);
      expect(ToolChoiceUtils.isFunctionChoice('none')).toBe(false);
      expect(ToolChoiceUtils.isFunctionChoice({} as unknown as OpenAIToolChoice)).toBe(false);
      expect(ToolChoiceUtils.isFunctionChoice(null as unknown as OpenAIToolChoice)).toBe(false);
    });
  });

  describe('function name extraction', () => {
    it('should extract function name from function choice', () => {
      const functionChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'get_weather' }
      };
      
      expect(ToolChoiceUtils.getFunctionName(functionChoice)).toBe('get_weather');
    });

    it('should return undefined for string choices', () => {
      expect(ToolChoiceUtils.getFunctionName('auto')).toBeUndefined();
      expect(ToolChoiceUtils.getFunctionName('none')).toBeUndefined();
    });

    it('should return undefined for invalid choices', () => {
      expect(ToolChoiceUtils.getFunctionName({} as unknown as OpenAIToolChoice)).toBeUndefined();
      expect(ToolChoiceUtils.getFunctionName(null as unknown as OpenAIToolChoice)).toBeUndefined();
    });
  });

  describe('choice creation', () => {
    it('should create auto choice', () => {
      const choice = ToolChoiceUtils.createAutoChoice();
      expect(choice).toBe('auto');
    });

    it('should create none choice', () => {
      const choice = ToolChoiceUtils.createNoneChoice();
      expect(choice).toBe('none');
    });

    it('should create function choice', () => {
      const choice = ToolChoiceUtils.createFunctionChoice('get_weather');
      expect(choice).toEqual({
        type: 'function',
        function: { name: 'get_weather' }
      });
    });
  });

  describe('performance validation', () => {
    it('should validate performance for fast validation', () => {
      const result: ToolChoiceValidationResult = {
        valid: true,
        errors: [],
        validationTimeMs: 2
      };
      
      expect(ToolChoiceUtils.isWithinPerformanceLimit(result)).toBe(true);
    });

    it('should reject performance for slow validation', () => {
      const result: ToolChoiceValidationResult = {
        valid: true,
        errors: [],
        validationTimeMs: 60
      };
      
      expect(ToolChoiceUtils.isWithinPerformanceLimit(result)).toBe(false);
    });

    it('should handle undefined validation time', () => {
      const result: ToolChoiceValidationResult = {
        valid: true,
        errors: []
      };
      
      expect(ToolChoiceUtils.isWithinPerformanceLimit(result)).toBe(true);
    });
  });
});

describe('ToolChoiceHandlerFactory', () => {
  it('should create tool choice handler instance', () => {
    const handler = ToolChoiceHandlerFactory.create();
    expect(handler).toBeInstanceOf(ToolChoiceLogic);
  });

  it('should create different instances', () => {
    const handler1 = ToolChoiceHandlerFactory.create();
    const handler2 = ToolChoiceHandlerFactory.create();
    expect(handler1).not.toBe(handler2);
  });
});

describe('ToolChoiceError', () => {
  it('should create error with message and code', () => {
    const error = new ToolChoiceError('Test message', 'TEST_CODE');
    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('ToolChoiceError');
  });

  it('should create error with choice and validation time', () => {
    const choice: OpenAIToolChoice = { type: 'function', function: { name: 'test' } };
    const error = new ToolChoiceError('Test message', 'TEST_CODE', choice, 5);
    
    expect(error.choice).toBe(choice);
    expect(error.validationTimeMs).toBe(5);
  });
});

describe('Performance Requirements', () => {
  let toolChoiceHandler: IToolChoiceHandler;
  let performanceTools: OpenAITool[];

  beforeEach(() => {
    toolChoiceHandler = new ToolChoiceLogic();
    
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

  it('should validate auto choice within 5ms performance limit', () => {
    const startTime = Date.now();
    const result = toolChoiceHandler.validateChoice('auto', performanceTools);
    const endTime = Date.now();
    
    expect(result.valid).toBe(true);
    expect(endTime - startTime).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
  });

  it('should validate none choice within 5ms performance limit', () => {
    const startTime = Date.now();
    const result = toolChoiceHandler.validateChoice('none', performanceTools);
    const endTime = Date.now();
    
    expect(result.valid).toBe(true);
    expect(endTime - startTime).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
  });

  it('should validate function choice within 5ms performance limit', () => {
    const functionChoice: OpenAIToolChoice = {
      type: 'function',
      function: { name: 'function_25' }
    };
    
    const startTime = Date.now();
    const result = toolChoiceHandler.validateChoice(functionChoice, performanceTools);
    const endTime = Date.now();
    
    expect(result.valid).toBe(true);
    expect(endTime - startTime).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
  });

  it('should process choices within performance limits', () => {
    const choices: OpenAIToolChoice[] = [
      'auto',
      'none',
      { type: 'function', function: { name: 'function_0' } },
      { type: 'function', function: { name: 'function_25' } },
      { type: 'function', function: { name: 'function_49' } }
    ];

    choices.forEach(choice => {
      const startTime = Date.now();
      toolChoiceHandler.validateChoice(choice, performanceTools);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThanOrEqual(TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS);
    });
  });
});