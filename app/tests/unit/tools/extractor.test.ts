/**
 * Unit tests for Tool Parameter Extractor
 * Phase 2A: Tool Request Parameter Processing
 * 
 * Tests parameter extraction logic with 100% coverage
 */

import {
  ToolParameterExtractor,
  ToolParameterExtractionError,
  ToolExtractionUtils,
  toolParameterExtractor,
  IToolExtractor,
  ToolParameterExtractionResult,
  ToolExtractionOptions
} from '../../../src/tools/extractor';
import { OpenAITool, OpenAIToolChoice } from '../../../src/tools/types';
import { TOOL_PARAMETER_MESSAGES, TOOL_PARAMETER_ERRORS } from '../../../src/tools/constants';

describe('ToolParameterExtractor', () => {
  let extractor: IToolExtractor;

  beforeEach(() => {
    extractor = new ToolParameterExtractor();
  });

  describe('extractFromRequest', () => {
    it('should extract tools and tool_choice from valid request', () => {
      const request = {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: 'test' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'test_function',
              description: 'A test function',
              parameters: { type: 'object', properties: {} }
            }
          }
        ],
        tool_choice: 'auto'
      };

      const result = extractor.extractFromRequest(request);

      expect(result.success).toBe(true);
      expect(result.tools).toHaveLength(1);
      expect(result.tools![0].function.name).toBe('test_function');
      expect(result.toolChoice).toBe('auto');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle request without tools', () => {
      const request = {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: 'test' }]
      };

      const result = extractor.extractFromRequest(request);

      expect(result.success).toBe(true);
      expect(result.tools).toBeUndefined();
      expect(result.toolChoice).toBeUndefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should handle tool_choice without tools', () => {
      const request = {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: 'test' }],
        tool_choice: 'auto'
      };

      const result = extractor.extractFromRequest(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Tool choice specified but no tools provided');
    });

    it('should require tools when requireTools option is true', () => {
      const request = {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: 'test' }]
      };

      const options: ToolExtractionOptions = { requireTools: true };
      const result = extractor.extractFromRequest(request, options);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(TOOL_PARAMETER_MESSAGES.TOOLS_PARAMETER_REQUIRED);
    });

    it('should handle empty tools array when allowEmptyTools is false', () => {
      const request = {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: 'test' }],
        tools: []
      };

      const options: ToolExtractionOptions = { 
        requireTools: true, 
        allowEmptyTools: false 
      };
      const result = extractor.extractFromRequest(request, options);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Tools array cannot be empty when tools are required');
    });

    it('should handle invalid request object', () => {
      const result = extractor.extractFromRequest(null);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(TOOL_PARAMETER_MESSAGES.PARAMETER_EXTRACTION_FAILED);
    });

    it('should handle extraction errors gracefully', () => {
      const request = {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: 'test' }],
        tools: 'invalid_tools' // Not an array
      };

      const result = extractor.extractFromRequest(request);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('extractTools', () => {
    it('should extract valid tools array', () => {
      const request = {
        tools: [
          {
            type: 'function',
            function: {
              name: 'test_function',
              description: 'A test function'
            }
          }
        ]
      };

      const tools = extractor.extractTools(request);

      expect(tools).toHaveLength(1);
      expect(tools![0].function.name).toBe('test_function');
    });

    it('should return undefined when tools not present', () => {
      const request = { model: 'claude-3-sonnet' };

      const tools = extractor.extractTools(request);

      expect(tools).toBeUndefined();
    });

    it('should return undefined when tools is null', () => {
      const request = { tools: null };

      const tools = extractor.extractTools(request);

      expect(tools).toBeUndefined();
    });

    it('should throw error when tools is not an array', () => {
      const request = { tools: 'invalid' };

      expect(() => extractor.extractTools(request)).toThrow(ToolParameterExtractionError);
    });

    it('should handle invalid request object', () => {
      const tools = extractor.extractTools(null);

      expect(tools).toBeUndefined();
    });
  });

  describe('extractToolChoice', () => {
    it('should extract string tool choice (auto)', () => {
      const request = { tool_choice: 'auto' };

      const toolChoice = extractor.extractToolChoice(request);

      expect(toolChoice).toBe('auto');
    });

    it('should extract string tool choice (none)', () => {
      const request = { tool_choice: 'none' };

      const toolChoice = extractor.extractToolChoice(request);

      expect(toolChoice).toBe('none');
    });

    it('should extract object tool choice', () => {
      const request = {
        tool_choice: {
          type: 'function',
          function: { name: 'test_function' }
        }
      };

      const toolChoice = extractor.extractToolChoice(request);

      expect(toolChoice).toEqual({
        type: 'function',
        function: { name: 'test_function' }
      });
    });

    it('should return undefined when tool_choice not present', () => {
      const request = { model: 'claude-3-sonnet' };

      const toolChoice = extractor.extractToolChoice(request);

      expect(toolChoice).toBeUndefined();
    });

    it('should return undefined when tool_choice is null', () => {
      const request = { tool_choice: null };

      const toolChoice = extractor.extractToolChoice(request);

      expect(toolChoice).toBeUndefined();
    });

    it('should throw error for invalid string tool choice', () => {
      const request = { tool_choice: 'invalid' };

      expect(() => extractor.extractToolChoice(request)).toThrow(ToolParameterExtractionError);
    });

    it('should throw error for invalid type tool choice', () => {
      const request = { tool_choice: 123 };

      expect(() => extractor.extractToolChoice(request)).toThrow(ToolParameterExtractionError);
    });

    it('should handle invalid request object', () => {
      const toolChoice = extractor.extractToolChoice(null);

      expect(toolChoice).toBeUndefined();
    });
  });

  describe('hasToolParameters', () => {
    it('should return true when tools present', () => {
      const request = { tools: [] };

      const hasParams = extractor.hasToolParameters(request);

      expect(hasParams).toBe(true);
    });

    it('should return true when tool_choice present', () => {
      const request = { tool_choice: 'auto' };

      const hasParams = extractor.hasToolParameters(request);

      expect(hasParams).toBe(true);
    });

    it('should return true when both present', () => {
      const request = { tools: [], tool_choice: 'auto' };

      const hasParams = extractor.hasToolParameters(request);

      expect(hasParams).toBe(true);
    });

    it('should return false when neither present', () => {
      const request = { model: 'claude-3-sonnet' };

      const hasParams = extractor.hasToolParameters(request);

      expect(hasParams).toBe(false);
    });

    it('should return false for invalid request', () => {
      const hasParams = extractor.hasToolParameters(null);

      expect(hasParams).toBe(false);
    });
  });

  describe('ToolExtractionUtils', () => {
    describe('createOptions', () => {
      it('should create default options', () => {
        const options = ToolExtractionUtils.createOptions();

        expect(options.requireTools).toBe(false);
        expect(options.allowEmptyTools).toBe(true);
        expect(options.validateExtraction).toBe(true);
      });

      it('should override default options', () => {
        const options = ToolExtractionUtils.createOptions({
          requireTools: true,
          allowEmptyTools: false
        });

        expect(options.requireTools).toBe(true);
        expect(options.allowEmptyTools).toBe(false);
        expect(options.validateExtraction).toBe(true);
      });
    });

    describe('hasTools', () => {
      it('should return true for successful result with tools', () => {
        const result: ToolParameterExtractionResult = {
          success: true,
          tools: [{ type: 'function', function: { name: 'test' } }],
          errors: []
        };

        const hasTools = ToolExtractionUtils.hasTools(result);

        expect(hasTools).toBe(true);
      });

      it('should return false for unsuccessful result', () => {
        const result: ToolParameterExtractionResult = {
          success: false,
          errors: ['error']
        };

        const hasTools = ToolExtractionUtils.hasTools(result);

        expect(hasTools).toBe(false);
      });

      it('should return false for result without tools', () => {
        const result: ToolParameterExtractionResult = {
          success: true,
          errors: []
        };

        const hasTools = ToolExtractionUtils.hasTools(result);

        expect(hasTools).toBe(false);
      });

      it('should return false for result with empty tools array', () => {
        const result: ToolParameterExtractionResult = {
          success: true,
          tools: [],
          errors: []
        };

        const hasTools = ToolExtractionUtils.hasTools(result);

        expect(hasTools).toBe(false);
      });
    });

    describe('hasToolChoice', () => {
      it('should return true for successful result with tool choice', () => {
        const result: ToolParameterExtractionResult = {
          success: true,
          toolChoice: 'auto',
          errors: []
        };

        const hasToolChoice = ToolExtractionUtils.hasToolChoice(result);

        expect(hasToolChoice).toBe(true);
      });

      it('should return false for unsuccessful result', () => {
        const result: ToolParameterExtractionResult = {
          success: false,
          errors: ['error']
        };

        const hasToolChoice = ToolExtractionUtils.hasToolChoice(result);

        expect(hasToolChoice).toBe(false);
      });

      it('should return false for result without tool choice', () => {
        const result: ToolParameterExtractionResult = {
          success: true,
          errors: []
        };

        const hasToolChoice = ToolExtractionUtils.hasToolChoice(result);

        expect(hasToolChoice).toBe(false);
      });
    });

    describe('getToolCount', () => {
      it('should return correct count for tools array', () => {
        const result: ToolParameterExtractionResult = {
          success: true,
          tools: [
            { type: 'function', function: { name: 'test1' } },
            { type: 'function', function: { name: 'test2' } }
          ],
          errors: []
        };

        const count = ToolExtractionUtils.getToolCount(result);

        expect(count).toBe(2);
      });

      it('should return 0 for result without tools', () => {
        const result: ToolParameterExtractionResult = {
          success: true,
          errors: []
        };

        const count = ToolExtractionUtils.getToolCount(result);

        expect(count).toBe(0);
      });
    });
  });

  describe('default instance', () => {
    it('should export default toolParameterExtractor instance', () => {
      expect(toolParameterExtractor).toBeInstanceOf(ToolParameterExtractor);
    });

    it('should work with default instance', () => {
      const request = {
        tools: [{ type: 'function', function: { name: 'test' } }]
      };

      const result = toolParameterExtractor.extractFromRequest(request);

      expect(result.success).toBe(true);
      expect(result.tools).toHaveLength(1);
    });
  });

  describe('error scenarios', () => {
    it('should handle extraction errors with proper error codes', () => {
      const request = { tools: 'invalid' };

      expect(() => extractor.extractTools(request)).toThrow(
        expect.objectContaining({
          name: 'ToolParameterExtractionError',
          code: TOOL_PARAMETER_ERRORS.EXTRACTION_FAILED,
          field: 'tools'
        })
      );
    });

    it('should handle tool_choice extraction errors', () => {
      const request = { tool_choice: 'invalid' };

      expect(() => extractor.extractToolChoice(request)).toThrow(
        expect.objectContaining({
          name: 'ToolParameterExtractionError',
          code: TOOL_PARAMETER_ERRORS.EXTRACTION_FAILED,
          field: 'tool_choice'
        })
      );
    });
  });

  describe('performance', () => {
    it('should extract parameters within performance limit', () => {
      const request = {
        tools: Array.from({ length: 20 }, (_, i) => ({
          type: 'function',
          function: {
            name: `test_function_${i}`,
            description: `Test function ${i}`
          }
        })),
        tool_choice: 'auto'
      };

      const startTime = Date.now();
      const result = extractor.extractFromRequest(request);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5); // Less than 5ms for performance requirement
    });
  });
});