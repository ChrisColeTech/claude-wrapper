/**
 * Unit tests for Tool Parameter Processor
 * Phase 2A: Tool Request Parameter Processing
 * 
 * Tests parameter processing logic with 100% coverage
 */

import {
  ToolParameterProcessor,
  ToolParameterProcessingError,
  ToolProcessingUtils,
  ToolProcessorFactory,
  IToolProcessor,
  ToolParameterProcessingResult,
  ToolProcessingOptions,
  ToolDefaultBehavior
} from '../../../src/tools/processor';
import { IToolValidator, OpenAITool, OpenAIToolChoice, ToolArrayValidationResult, ToolValidationResult } from '../../../src/tools/types';
import { IToolExtractor, ToolParameterExtractionResult } from '../../../src/tools/extractor';
import { IToolChoiceValidator } from '../../../src/tools/choice-validator';
import { TOOL_PARAMETER_LIMITS, TOOL_PARAMETER_MESSAGES, TOOL_PARAMETER_ERRORS } from '../../../src/tools/constants';

// Mock implementations
class MockToolValidator implements IToolValidator {
  validateTool = jest.fn().mockReturnValue({ valid: true, errors: [] });
  validateFunction = jest.fn().mockReturnValue({ valid: true, errors: [] });
  validateParameters = jest.fn().mockReturnValue({ valid: true, errors: [] });
  validateToolArray = jest.fn().mockReturnValue({ valid: true, errors: [], validTools: [] });
  validateToolChoice = jest.fn().mockReturnValue({ valid: true, errors: [] });
  validateToolsRequest = jest.fn().mockReturnValue({ valid: true, errors: [], validTools: [] });
}

class MockToolExtractor implements IToolExtractor {
  extractFromRequest = jest.fn().mockReturnValue({ 
    success: true, 
    tools: [], 
    toolChoice: undefined, 
    errors: [] 
  });
  extractTools = jest.fn().mockReturnValue([]);
  extractToolChoice = jest.fn().mockReturnValue(undefined);
  hasToolParameters = jest.fn().mockReturnValue(false);
}

class MockToolChoiceValidator implements IToolChoiceValidator {
  validateToolChoice = jest.fn().mockReturnValue({ valid: true, errors: [] });
  validateToolChoiceFormat = jest.fn().mockReturnValue({ valid: true, errors: [] });
  validateToolChoiceConsistency = jest.fn().mockReturnValue({ valid: true, errors: [] });
  isValidToolChoiceValue = jest.fn().mockReturnValue(true);
}

describe('ToolParameterProcessor', () => {
  let processor: IToolProcessor;
  let mockValidator: MockToolValidator;
  let mockExtractor: MockToolExtractor;
  let mockChoiceValidator: MockToolChoiceValidator;

  beforeEach(() => {
    mockValidator = new MockToolValidator();
    mockExtractor = new MockToolExtractor();
    mockChoiceValidator = new MockToolChoiceValidator();
    processor = new ToolParameterProcessor(mockValidator, mockExtractor, mockChoiceValidator);
  });

  describe('processRequest', () => {
    it('should process request with valid tools successfully', async () => {
      const request = {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: 'test' }],
        tools: [
          {
            type: 'function',
            function: { name: 'test_function', description: 'Test' }
          }
        ],
        tool_choice: 'auto'
      };

      mockExtractor.extractFromRequest.mockReturnValue({
        success: true,
        tools: request.tools,
        toolChoice: request.tool_choice,
        errors: []
      });

      mockValidator.validateToolArray.mockReturnValue({
        valid: true,
        errors: [],
        validTools: request.tools
      });

      const result = await processor.processRequest(request);

      expect(result.success).toBe(true);
      expect(result.tools).toEqual(request.tools);
      expect(result.toolChoice).toBe('auto');
      expect(result.errors).toHaveLength(0);
      expect(result.processingTimeMs).toBeDefined();
      expect(result.processingTimeMs!).toBeLessThanOrEqual(TOOL_PARAMETER_LIMITS.PROCESSING_TIMEOUT_MS);
    });

    it('should handle extraction failure', async () => {
      const request = { model: 'claude-3-sonnet', messages: [] };

      mockExtractor.extractFromRequest.mockReturnValue({
        success: false,
        errors: ['Extraction failed']
      });

      const result = await processor.processRequest(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Extraction failed');
      expect(result.processingTimeMs).toBeDefined();
    });

    it('should enforce timeout when processing exceeds limit', async () => {
      const request = { model: 'claude-3-sonnet', messages: [] };

      mockExtractor.extractFromRequest.mockReturnValue({
        success: true,
        tools: [],
        errors: []
      });

      const options: ToolProcessingOptions = {
        enforceTimeout: true,
        timeoutMs: 1 // Very low timeout
      };

      // Add a small delay to exceed timeout
      jest.spyOn(processor, 'processToolParameters').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 2));
        return { success: true, errors: [] };
      });

      const result = await processor.processRequest(request, options);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(TOOL_PARAMETER_MESSAGES.PARAMETER_PROCESSING_TIMEOUT);
    });

    it('should handle processing errors gracefully', async () => {
      const request = { model: 'claude-3-sonnet', messages: [] };

      mockExtractor.extractFromRequest.mockImplementation(() => {
        throw new Error('Extraction error');
      });

      const result = await processor.processRequest(request);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.processingTimeMs).toBeDefined();
    });

    it('should use default options when none provided', async () => {
      const request = { model: 'claude-3-sonnet', messages: [] };

      mockExtractor.extractFromRequest.mockReturnValue({
        success: true,
        tools: [],
        errors: []
      });

      const result = await processor.processRequest(request);

      expect(result.success).toBe(true);
      expect(mockExtractor.extractFromRequest).toHaveBeenCalledWith(request);
    });
  });

  describe('processToolParameters', () => {
    it('should process valid tools and tool choice', async () => {
      const tools: OpenAITool[] = [
        {
          type: 'function',
          function: { name: 'test_function', description: 'Test' }
        }
      ];
      const toolChoice: OpenAIToolChoice = 'auto';

      mockValidator.validateToolArray.mockReturnValue({
        valid: true,
        errors: [],
        validTools: tools
      });

      mockChoiceValidator.validateToolChoice.mockReturnValue({
        valid: true,
        errors: []
      });

      const result = await processor.processToolParameters(tools, toolChoice);

      expect(result.success).toBe(true);
      expect(result.tools).toEqual(tools);
      expect(result.toolChoice).toBe(toolChoice);
      expect(result.errors).toHaveLength(0);
      expect(result.defaultBehavior).toBeUndefined();
    });

    it('should return default behavior when no tools provided', async () => {
      const result = await processor.processToolParameters();

      expect(result.success).toBe(true);
      expect(result.tools).toBeUndefined();
      expect(result.toolChoice).toBeUndefined();
      expect(result.defaultBehavior).toEqual({
        enableTools: false,
        toolChoice: 'none',
        allowToolCalls: false
      });
    });

    it('should return default behavior for empty tools array', async () => {
      const result = await processor.processToolParameters([]);

      expect(result.success).toBe(true);
      expect(result.defaultBehavior).toEqual({
        enableTools: false,
        toolChoice: 'none',
        allowToolCalls: false
      });
    });

    it('should handle tool validation failure', async () => {
      const tools: OpenAITool[] = [
        {
          type: 'function',
          function: { name: 'invalid_function' }
        }
      ];

      mockValidator.validateToolArray.mockReturnValue({
        valid: false,
        errors: ['Tool validation failed'],
        validTools: []
      });

      const result = await processor.processToolParameters(tools);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Tool validation failed');
    });

    it('should handle tool choice validation failure', async () => {
      const tools: OpenAITool[] = [
        {
          type: 'function',
          function: { name: 'test_function' }
        }
      ];
      const toolChoice: OpenAIToolChoice = 'invalid' as any;

      mockValidator.validateToolArray.mockReturnValue({
        valid: true,
        errors: [],
        validTools: tools
      });

      mockChoiceValidator.validateToolChoice.mockReturnValue({
        valid: false,
        errors: ['Invalid tool choice']
      });

      const result = await processor.processToolParameters(tools, toolChoice);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid tool choice');
    });

    it('should reject tool choice without tools', async () => {
      const toolChoice: OpenAIToolChoice = 'auto';

      const result = await processor.processToolParameters(undefined, toolChoice);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Tool choice specified but no tools provided');
    });

    it('should handle processing errors gracefully', async () => {
      mockValidator.validateToolArray.mockImplementation(() => {
        throw new Error('Validation error');
      });

      const tools: OpenAITool[] = [
        {
          type: 'function',
          function: { name: 'test_function' }
        }
      ];

      const result = await processor.processToolParameters(tools);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('mergeWithRequestContext', () => {
    it('should merge successful processing result with request', () => {
      const request = {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: 'test' }]
      };

      const processingResult: ToolParameterProcessingResult = {
        success: true,
        tools: [
          {
            type: 'function',
            function: { name: 'test_function' }
          }
        ],
        toolChoice: 'auto',
        errors: [],
        processingTimeMs: 2
      };

      const merged = processor.mergeWithRequestContext(request, processingResult);

      expect(merged).toMatchObject(request);
      expect(merged.toolProcessing).toEqual({
        hasTools: true,
        toolCount: 1,
        hasToolChoice: true,
        toolChoice: 'auto',
        defaultBehavior: undefined,
        processingTimeMs: 2
      });
      expect(merged.processedTools).toEqual(processingResult.tools);
    });

    it('should merge result with default behavior', () => {
      const request = {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: 'test' }]
      };

      const processingResult: ToolParameterProcessingResult = {
        success: true,
        defaultBehavior: {
          enableTools: false,
          toolChoice: 'none',
          allowToolCalls: false
        },
        errors: []
      };

      const merged = processor.mergeWithRequestContext(request, processingResult);

      expect(merged.toolProcessing.hasTools).toBe(false);
      expect(merged.toolProcessing.toolCount).toBe(0);
      expect(merged.toolProcessing.hasToolChoice).toBe(false);
      expect(merged.toolProcessing.defaultBehavior).toEqual(processingResult.defaultBehavior);
    });

    it('should throw error for unsuccessful processing result', () => {
      const request = { model: 'claude-3-sonnet' };
      const processingResult: ToolParameterProcessingResult = {
        success: false,
        errors: ['Processing failed']
      };

      expect(() => processor.mergeWithRequestContext(request, processingResult))
        .toThrow(ToolParameterProcessingError);
    });

    it('should handle merging errors gracefully', () => {
      const request = null as any;
      const processingResult: ToolParameterProcessingResult = {
        success: true,
        errors: []
      };

      expect(() => processor.mergeWithRequestContext(request, processingResult))
        .toThrow(ToolParameterProcessingError);
    });
  });

  describe('getDefaultBehavior', () => {
    it('should return default behavior', () => {
      const request = { model: 'claude-3-sonnet' };

      const defaultBehavior = processor.getDefaultBehavior(request);

      expect(defaultBehavior).toEqual({
        enableTools: false,
        toolChoice: 'none',
        allowToolCalls: false
      });
    });
  });

  describe('ToolProcessingUtils', () => {
    describe('createOptions', () => {
      it('should create default options', () => {
        const options = ToolProcessingUtils.createOptions();

        expect(options).toEqual({
          validateTools: true,
          validateToolChoice: true,
          enforceTimeout: true,
          timeoutMs: TOOL_PARAMETER_LIMITS.PROCESSING_TIMEOUT_MS,
          allowPartialProcessing: false
        });
      });

      it('should override default options', () => {
        const options = ToolProcessingUtils.createOptions({
          validateTools: false,
          timeoutMs: 10
        });

        expect(options.validateTools).toBe(false);
        expect(options.timeoutMs).toBe(10);
        expect(options.validateToolChoice).toBe(true); // Should keep default
      });
    });

    describe('hasValidTools', () => {
      it('should return true for successful result with tools', () => {
        const result: ToolParameterProcessingResult = {
          success: true,
          tools: [{ type: 'function', function: { name: 'test' } }],
          errors: []
        };

        const hasTools = ToolProcessingUtils.hasValidTools(result);

        expect(hasTools).toBe(true);
      });

      it('should return false for unsuccessful result', () => {
        const result: ToolParameterProcessingResult = {
          success: false,
          errors: ['error']
        };

        const hasTools = ToolProcessingUtils.hasValidTools(result);

        expect(hasTools).toBe(false);
      });

      it('should return false for result without tools', () => {
        const result: ToolParameterProcessingResult = {
          success: true,
          errors: []
        };

        const hasTools = ToolProcessingUtils.hasValidTools(result);

        expect(hasTools).toBe(false);
      });
    });

    describe('hasToolChoice', () => {
      it('should return true for successful result with tool choice', () => {
        const result: ToolParameterProcessingResult = {
          success: true,
          toolChoice: 'auto',
          errors: []
        };

        const hasToolChoice = ToolProcessingUtils.hasToolChoice(result);

        expect(hasToolChoice).toBe(true);
      });

      it('should return false for unsuccessful result', () => {
        const result: ToolParameterProcessingResult = {
          success: false,
          errors: ['error']
        };

        const hasToolChoice = ToolProcessingUtils.hasToolChoice(result);

        expect(hasToolChoice).toBe(false);
      });
    });

    describe('getToolCount', () => {
      it('should return correct count', () => {
        const result: ToolParameterProcessingResult = {
          success: true,
          tools: [
            { type: 'function', function: { name: 'test1' } },
            { type: 'function', function: { name: 'test2' } }
          ],
          errors: []
        };

        const count = ToolProcessingUtils.getToolCount(result);

        expect(count).toBe(2);
      });

      it('should return 0 for result without tools', () => {
        const result: ToolParameterProcessingResult = {
          success: true,
          errors: []
        };

        const count = ToolProcessingUtils.getToolCount(result);

        expect(count).toBe(0);
      });
    });

    describe('isDefaultBehavior', () => {
      it('should return true when default behavior is present', () => {
        const result: ToolParameterProcessingResult = {
          success: true,
          defaultBehavior: {
            enableTools: false,
            toolChoice: 'none',
            allowToolCalls: false
          },
          errors: []
        };

        const isDefault = ToolProcessingUtils.isDefaultBehavior(result);

        expect(isDefault).toBe(true);
      });

      it('should return false when no default behavior', () => {
        const result: ToolParameterProcessingResult = {
          success: true,
          errors: []
        };

        const isDefault = ToolProcessingUtils.isDefaultBehavior(result);

        expect(isDefault).toBe(false);
      });
    });

    describe('isWithinPerformanceLimit', () => {
      it('should return true for processing within limit', () => {
        const result: ToolParameterProcessingResult = {
          success: true,
          errors: [],
          processingTimeMs: 3
        };

        const withinLimit = ToolProcessingUtils.isWithinPerformanceLimit(result);

        expect(withinLimit).toBe(true);
      });

      it('should return false for processing exceeding limit', () => {
        const result: ToolParameterProcessingResult = {
          success: true,
          errors: [],
          processingTimeMs: 10
        };

        const withinLimit = ToolProcessingUtils.isWithinPerformanceLimit(result);

        expect(withinLimit).toBe(false);
      });

      it('should return true when no processing time recorded', () => {
        const result: ToolParameterProcessingResult = {
          success: true,
          errors: []
        };

        const withinLimit = ToolProcessingUtils.isWithinPerformanceLimit(result);

        expect(withinLimit).toBe(true);
      });
    });
  });

  describe('ToolProcessorFactory', () => {
    it('should create processor with dependencies', () => {
      const createdProcessor = ToolProcessorFactory.create(
        mockValidator,
        mockExtractor,
        mockChoiceValidator
      );

      expect(createdProcessor).toBeInstanceOf(ToolParameterProcessor);
    });
  });

  describe('error scenarios', () => {
    it('should create ToolParameterProcessingError with correct properties', () => {
      const error = new ToolParameterProcessingError(
        'Test error',
        'TEST_CODE',
        'test_field',
        123
      );

      expect(error.name).toBe('ToolParameterProcessingError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.field).toBe('test_field');
      expect(error.processingTimeMs).toBe(123);
    });
  });

  describe('performance', () => {
    it('should process parameters within performance limit', async () => {
      const request = {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: 'test' }],
        tools: Array.from({ length: 20 }, (_, i) => ({
          type: 'function' as const,
          function: {
            name: `test_function_${i}`,
            description: `Test function ${i}`
          }
        })),
        tool_choice: 'auto' as const
      };

      mockExtractor.extractFromRequest.mockReturnValue({
        success: true,
        tools: request.tools,
        toolChoice: request.tool_choice,
        errors: []
      });

      mockValidator.validateToolArray.mockReturnValue({
        valid: true,
        errors: [],
        validTools: request.tools
      });

      const startTime = Date.now();
      const result = await processor.processRequest(request);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(TOOL_PARAMETER_LIMITS.PROCESSING_TIMEOUT_MS);
      expect(result.processingTimeMs!).toBeLessThanOrEqual(TOOL_PARAMETER_LIMITS.PROCESSING_TIMEOUT_MS);
    });
  });
});