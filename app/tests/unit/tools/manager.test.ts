/**
 * Comprehensive Test Suite for Tool Manager
 * Phase 7A Implementation: Complete tool management system tests
 * Based on Python models.py:53 and parameter_validator.py behavior
 */

import { 
  ToolManager, 
  ToolConfiguration, 
  ToolRequest, 
  ToolResponse 
} from '../../../src/tools/manager';
import { 
  CLAUDE_CODE_TOOLS, 
  ClaudeCodeTool, 
  PermissionMode,
  DEFAULT_TOOL_CONFIG,
  TOOL_CATEGORIES,
  TOOL_HEADERS 
} from '../../../src/tools/constants';

// Mock logger to avoid console output during tests
jest.mock('../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('ToolManager', () => {
  describe('configureTools', () => {
    it('should enable all tools by default', () => {
      const config: ToolConfiguration = {};
      const result = ToolManager.configureTools(config);
      
      expect(result.tools_enabled).toBe(true);
      expect(result.tools).toEqual(CLAUDE_CODE_TOOLS);
      expect(result.max_turns).toBe(DEFAULT_TOOL_CONFIG.max_turns);
      expect(result.permission_mode).toBe(DEFAULT_TOOL_CONFIG.permission_mode);
    });
    
    it('should disable all tools when disable_tools is true', () => {
      const config: ToolConfiguration = {
        disable_tools: true
      };
      const result = ToolManager.configureTools(config);
      
      expect(result.tools_enabled).toBe(false);
      expect(result.tools).toEqual([]);
      expect(result.max_turns).toBe(1);
      expect(result.disabled_tools).toEqual(CLAUDE_CODE_TOOLS);
    });
    
    it('should disable all tools when tools_enabled is false', () => {
      const config: ToolConfiguration = {
        tools_enabled: false
      };
      const result = ToolManager.configureTools(config);
      
      expect(result.tools_enabled).toBe(false);
      expect(result.tools).toEqual([]);
      expect(result.max_turns).toBe(1);
    });
    
    it('should filter tools based on allowed_tools', () => {
      const allowedTools: ClaudeCodeTool[] = ['Read', 'Write', 'Bash'];
      const config: ToolConfiguration = {
        allowed_tools: allowedTools
      };
      const result = ToolManager.configureTools(config);
      
      expect(result.tools_enabled).toBe(true);
      expect(result.tools).toEqual(expect.arrayContaining(allowedTools));
      expect(result.tools.length).toBe(3);
    });
    
    it('should filter out disallowed tools', () => {
      const disallowedTools: ClaudeCodeTool[] = ['Bash', 'Edit', 'Write'];
      const config: ToolConfiguration = {
        disallowed_tools: disallowedTools
      };
      const result = ToolManager.configureTools(config);
      
      expect(result.tools_enabled).toBe(true);
      expect(result.disabled_tools).toEqual(disallowedTools);
      
      // Check that disallowed tools are not in the result
      disallowedTools.forEach(tool => {
        expect(result.tools).not.toContain(tool);
      });
      
      // Check that some allowed tools are in the result
      expect(result.tools).toContain('Read');
      expect(result.tools).toContain('Glob');
    });
    
    it('should apply both allowed and disallowed filters correctly', () => {
      const allowedTools: ClaudeCodeTool[] = ['Read', 'Write', 'Edit', 'Bash'];
      const disallowedTools: ClaudeCodeTool[] = ['Bash', 'Edit'];
      const config: ToolConfiguration = {
        allowed_tools: allowedTools,
        disallowed_tools: disallowedTools
      };
      const result = ToolManager.configureTools(config);
      
      expect(result.tools_enabled).toBe(true);
      expect(result.tools).toEqual(['Read', 'Write']);
      expect(result.disabled_tools).toEqual(disallowedTools);
    });
    
    it('should set custom max_turns', () => {
      const config: ToolConfiguration = {
        max_turns: 5
      };
      const result = ToolManager.configureTools(config);
      
      expect(result.max_turns).toBe(5);
    });
    
    it('should set custom permission_mode', () => {
      const config: ToolConfiguration = {
        permission_mode: 'acceptEdits'
      };
      const result = ToolManager.configureTools(config);
      
      expect(result.permission_mode).toBe('acceptEdits');
    });
  });
  
  describe('parseToolHeaders', () => {
    it('should parse empty headers', () => {
      const headers = {};
      const result = ToolManager.parseToolHeaders(headers);
      
      expect(result).toEqual({});
    });
    
    it('should parse tools enabled header', () => {
      const headers = {
        [TOOL_HEADERS.TOOLS_ENABLED]: 'true'
      };
      const result = ToolManager.parseToolHeaders(headers);
      
      expect(result.tools_enabled).toBe(true);
    });
    
    it('should parse tools disabled header', () => {
      const headers = {
        [TOOL_HEADERS.TOOLS_DISABLED]: 'true'
      };
      const result = ToolManager.parseToolHeaders(headers);
      
      expect(result.disable_tools).toBe(true);
    });
    
    it('should parse permission mode header', () => {
      const headers = {
        [TOOL_HEADERS.PERMISSION_MODE]: 'acceptEdits'
      };
      const result = ToolManager.parseToolHeaders(headers);
      
      expect(result.permission_mode).toBe('acceptEdits');
    });
    
    it('should parse max turns header', () => {
      const headers = {
        [TOOL_HEADERS.MAX_TURNS]: '5'
      };
      const result = ToolManager.parseToolHeaders(headers);
      
      expect(result.max_turns).toBe(5);
    });
    
    it('should ignore invalid max turns', () => {
      const headers = {
        [TOOL_HEADERS.MAX_TURNS]: 'invalid'
      };
      const result = ToolManager.parseToolHeaders(headers);
      
      expect(result.max_turns).toBeUndefined();
    });
    
    it('should parse read permission header', () => {
      const headers = {
        [TOOL_HEADERS.READ_PERMISSION]: 'true'
      };
      const result = ToolManager.parseToolHeaders(headers);
      
      expect(result.allowed_tools).toEqual(expect.arrayContaining(TOOL_CATEGORIES.READ_ONLY));
      expect(result.allowed_tools).toEqual(expect.arrayContaining(TOOL_CATEGORIES.FLOW_CONTROL));
    });
    
    it('should parse write permission header', () => {
      const headers = {
        [TOOL_HEADERS.WRITE_PERMISSION]: 'true'
      };
      const result = ToolManager.parseToolHeaders(headers);
      
      expect(result.allowed_tools).toEqual(expect.arrayContaining(TOOL_CATEGORIES.WRITE_OPERATIONS));
      expect(result.allowed_tools).toEqual(expect.arrayContaining(TOOL_CATEGORIES.FLOW_CONTROL));
    });
    
    it('should parse execution permission header', () => {
      const headers = {
        [TOOL_HEADERS.EXECUTION_PERMISSION]: 'true'
      };
      const result = ToolManager.parseToolHeaders(headers);
      
      expect(result.allowed_tools).toEqual(expect.arrayContaining(TOOL_CATEGORIES.EXECUTION));
      expect(result.allowed_tools).toEqual(expect.arrayContaining(TOOL_CATEGORIES.FLOW_CONTROL));
    });
    
    it('should parse multiple permission headers', () => {
      const headers = {
        [TOOL_HEADERS.READ_PERMISSION]: 'true',
        [TOOL_HEADERS.WRITE_PERMISSION]: 'true'
      };
      const result = ToolManager.parseToolHeaders(headers);
      
      expect(result.allowed_tools).toEqual(expect.arrayContaining(TOOL_CATEGORIES.READ_ONLY));
      expect(result.allowed_tools).toEqual(expect.arrayContaining(TOOL_CATEGORIES.WRITE_OPERATIONS));
      expect(result.allowed_tools).toEqual(expect.arrayContaining(TOOL_CATEGORIES.FLOW_CONTROL));
    });
    
    it('should remove duplicates from allowed tools', () => {
      const headers = {
        [TOOL_HEADERS.READ_PERMISSION]: 'true',
        [TOOL_HEADERS.WRITE_PERMISSION]: 'true',
        [TOOL_HEADERS.EXECUTION_PERMISSION]: 'true'
      };
      const result = ToolManager.parseToolHeaders(headers);
      
      const uniqueTools = [...new Set(result.allowed_tools)];
      expect(result.allowed_tools?.length).toBe(uniqueTools.length);
    });
  });
  
  describe('getToolStats', () => {
    it('should calculate stats for enabled tools', () => {
      const config: ToolResponse = {
        tools: ['Read', 'Write', 'Bash'],
        tools_enabled: true,
        max_turns: 10,
        permission_mode: 'default'
      };
      const stats = ToolManager.getToolStats(config);
      
      expect(stats.total_tools).toBe(CLAUDE_CODE_TOOLS.length);
      expect(stats.enabled_tools).toBe(3);
      expect(stats.disabled_tools).toBe(0);
      expect(stats.read_only_tools).toBe(1); // 'Read'
      expect(stats.write_tools).toBe(1); // 'Write'
      expect(stats.execution_tools).toBe(1); // 'Bash'
    });
    
    it('should calculate stats for disabled tools', () => {
      const config: ToolResponse = {
        tools: [],
        tools_enabled: false,
        max_turns: 1,
        permission_mode: 'default',
        disabled_tools: [...CLAUDE_CODE_TOOLS]
      };
      const stats = ToolManager.getToolStats(config);
      
      expect(stats.total_tools).toBe(CLAUDE_CODE_TOOLS.length);
      expect(stats.enabled_tools).toBe(0);
      expect(stats.disabled_tools).toBe(CLAUDE_CODE_TOOLS.length);
      expect(stats.read_only_tools).toBe(0);
      expect(stats.write_tools).toBe(0);
      expect(stats.execution_tools).toBe(0);
    });
  });
  
  describe('validateToolConfig', () => {
    it('should validate valid configuration', () => {
      const config: ToolConfiguration = {
        allowed_tools: ['Read', 'Write'],
        max_turns: 5,
        permission_mode: 'default'
      };
      const result = ToolManager.validateToolConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
    
    it('should reject unknown tools in allowed_tools', () => {
      const config: ToolConfiguration = {
        allowed_tools: ['Read', 'UnknownTool' as ClaudeCodeTool]
      };
      const result = ToolManager.validateToolConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown tool: UnknownTool');
    });
    
    it('should reject unknown tools in disallowed_tools', () => {
      const config: ToolConfiguration = {
        disallowed_tools: ['BadTool' as ClaudeCodeTool]
      };
      const result = ToolManager.validateToolConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown tool in disallowed list: BadTool');
    });
    
    it('should reject invalid max_turns values', () => {
      const config1: ToolConfiguration = { max_turns: 0 };
      const config2: ToolConfiguration = { max_turns: 101 };
      
      const result1 = ToolManager.validateToolConfig(config1);
      const result2 = ToolManager.validateToolConfig(config2);
      
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('max_turns must be between 1 and 100');
      
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('max_turns must be between 1 and 100');
    });
    
    it('should accept valid max_turns values', () => {
      const config1: ToolConfiguration = { max_turns: 1 };
      const config2: ToolConfiguration = { max_turns: 100 };
      const config3: ToolConfiguration = { max_turns: 50 };
      
      const result1 = ToolManager.validateToolConfig(config1);
      const result2 = ToolManager.validateToolConfig(config2);
      const result3 = ToolManager.validateToolConfig(config3);
      
      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
      expect(result3.valid).toBe(true);
    });
  });
  
  describe('integration scenarios', () => {
    it('should handle tools enabled by default scenario', () => {
      // This is the key difference from Python - tools enabled by default
      const config = ToolManager.configureTools({});
      
      expect(config.tools_enabled).toBe(true);
      expect(config.tools.length).toBe(CLAUDE_CODE_TOOLS.length);
      expect(config.tools).toEqual(CLAUDE_CODE_TOOLS);
    });
    
    it('should handle speed optimization scenario', () => {
      // Users can opt-out for speed
      const config = ToolManager.configureTools({ disable_tools: true });
      
      expect(config.tools_enabled).toBe(false);
      expect(config.tools).toEqual([]);
      expect(config.max_turns).toBe(1);
    });
    
    it('should handle permission-based tool filtering', () => {
      const headers = {
        [TOOL_HEADERS.READ_PERMISSION]: 'true',
        [TOOL_HEADERS.EXECUTION_PERMISSION]: 'false'
      };
      
      const headerConfig = ToolManager.parseToolHeaders(headers);
      const toolConfig = ToolManager.configureTools(headerConfig);
      
      expect(toolConfig.tools).toEqual(expect.arrayContaining(TOOL_CATEGORIES.READ_ONLY));
      expect(toolConfig.tools).not.toEqual(expect.arrayContaining(TOOL_CATEGORIES.EXECUTION));
    });
    
    it('should handle complex configuration scenarios', () => {
      const config: ToolConfiguration = {
        allowed_tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob'],
        disallowed_tools: ['Bash'], // Remove dangerous execution
        permission_mode: 'acceptEdits',
        max_turns: 15
      };
      
      const result = ToolManager.configureTools(config);
      const validation = ToolManager.validateToolConfig(config);
      const stats = ToolManager.getToolStats(result);
      
      expect(validation.valid).toBe(true);
      expect(result.tools).toEqual(expect.arrayContaining(['Read', 'Write', 'Edit', 'Glob']));
      expect(result.tools.length).toBe(4);
      expect(result.permission_mode).toBe('acceptEdits');
      expect(stats.execution_tools).toBe(0); // Bash removed
      expect(stats.write_tools).toBe(2); // Write, Edit
    });
  });
  
  describe('performance', () => {
    it('should configure tools quickly', () => {
      const config: ToolConfiguration = {
        allowed_tools: [...CLAUDE_CODE_TOOLS],
        max_turns: 10
      };
      
      const start = Date.now();
      const result = ToolManager.configureTools(config);
      const end = Date.now();
      
      expect(end - start).toBeLessThan(10); // Should complete in under 10ms
      expect(result.tools_enabled).toBe(true);
    });
    
    it('should parse headers quickly', () => {
      const headers = {
        [TOOL_HEADERS.TOOLS_ENABLED]: 'true',
        [TOOL_HEADERS.PERMISSION_MODE]: 'acceptEdits',
        [TOOL_HEADERS.MAX_TURNS]: '10',
        [TOOL_HEADERS.READ_PERMISSION]: 'true',
        [TOOL_HEADERS.WRITE_PERMISSION]: 'false',
        [TOOL_HEADERS.EXECUTION_PERMISSION]: 'true'
      };
      
      const start = Date.now();
      const result = ToolManager.parseToolHeaders(headers);
      const end = Date.now();
      
      expect(end - start).toBeLessThan(5); // Should complete in under 5ms
      expect(result.tools_enabled).toBe(true);
    });
  });
});
