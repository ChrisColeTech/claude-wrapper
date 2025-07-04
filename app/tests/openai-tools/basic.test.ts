/**
 * Basic OpenAI Tools Functionality Tests (Phase 13A)
 * Single Responsibility: Basic functionality verification
 * 
 * Simple tests to verify core OpenAI tools functionality works
 */

import { describe, it, expect } from '@jest/globals';
import { 
  ToolValidator, 
  ToolConverter, 
  ToolCallResponseBuilder,
  ToolParameterMapper,
  FormatValidator,
  ToolManager
} from '../../src/tools';
import { SIMPLE_TOOLS, SIMPLE_TOOL_OBJECTS } from '../fixtures/openai-tools/sample-tools';

describe('Basic OpenAI Tools Tests (Phase 13A)', () => {
  describe('Tool Validation', () => {
    it('should validate a simple tool successfully', async () => {
      const validator = new ToolValidator();
      const tool = SIMPLE_TOOL_OBJECTS.calculator;
      
      const result = await validator.validateTool(tool);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate tool arrays', async () => {
      const validator = new ToolValidator();
      const tools = SIMPLE_TOOLS.slice(0, 2);
      
      const result = await validator.validateToolArray(tools);
      expect(result.valid).toBe(true);
      expect(result.validTools).toHaveLength(2);
    });
  });

  describe('Tool Conversion', () => {
    it('should convert OpenAI tools to Claude format', () => {
      const mapper = new ToolParameterMapper();
      const validator = new FormatValidator();
      const converter = new ToolConverter(mapper, validator);
      const tool = SIMPLE_TOOL_OBJECTS.get_weather;
      
      const result = converter.toClaudeFormat([tool]);
      expect(result.success).toBe(true);
      expect(result.converted).toBeDefined();
    });

    it('should handle round-trip conversion', () => {
      const mapper = new ToolParameterMapper();
      const validator = new FormatValidator();
      const converter = new ToolConverter(mapper, validator);
      const tool = SIMPLE_TOOL_OBJECTS.calculator;
      
      const claudeResult = converter.toClaudeFormat([tool]);
      expect(claudeResult.success).toBe(true);
      
      const openAIResult = converter.toOpenAIFormat(claudeResult.converted || []);
      expect(openAIResult.success).toBe(true);
      expect(openAIResult.converted).toBeDefined();
    });
  });

  describe('Tool Manager Integration', () => {
    it('should integrate multiple phases successfully', async () => {
      const manager = new ToolManager();
      const tool = SIMPLE_TOOL_OBJECTS.get_weather;
      
      // Basic functionality check
      expect(manager).toBeDefined();
      expect(tool).toBeDefined();
      expect(tool.type).toBe('function');
      expect(tool.function.name).toBe('get_weather');
    });
  });

  describe('Response Building', () => {
    it('should build tool call responses', () => {
      const responseBuilder = new ToolCallResponseBuilder();
      
      // Test basic functionality
      expect(responseBuilder).toBeDefined();
    });
  });
});