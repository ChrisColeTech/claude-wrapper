/**
 * Comprehensive Test Suite for Tool Validator
 * Phase 7A Implementation: Complete tool validation and header parsing tests
 * Based on Python parameter_validator.py:96-137 validation behavior
 */

import { 
  ToolValidator, 
  ToolValidationResult, 
  HeaderValidationResult 
} from '../../../src/tools/validator';
import { 
  CLAUDE_CODE_TOOLS, 
  ClaudeCodeTool, 
  PermissionMode,
  PERMISSION_MODES,
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

describe('ToolValidator', () => {
  describe('validateToolNames', () => {
    it('should validate empty tool array', () => {
      const result = ToolValidator.validateToolNames([]);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.validated_tools).toEqual([]);
    });
    
    it('should validate known tools', () => {
      const tools = ['Read', 'Write', 'Bash'];
      const result = ToolValidator.validateToolNames(tools);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.validated_tools).toEqual(['Read', 'Write', 'Bash']);
    });
    
    it('should reject unknown tools', () => {
      const tools = ['Read', 'UnknownTool', 'Write'];
      const result = ToolValidator.validateToolNames(tools);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Unknown tool: UnknownTool');
      expect(result.validated_tools).toEqual(['Read', 'Write']);
    });
    
    it('should handle non-array input', () => {
      const result = ToolValidator.validateToolNames('not-an-array' as any);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Tools must be provided as an array');
    });
    
    it('should handle non-string tool names', () => {
      const tools = ['Read', 123, 'Write'] as any;
      const result = ToolValidator.validateToolNames(tools);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Tool name must be a string');
      expect(result.validated_tools).toEqual(['Read', 'Write']);
    });
    
    it('should warn about empty tool names', () => {
      const tools = ['Read', '', '  ', 'Write'];
      const result = ToolValidator.validateToolNames(tools);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Empty tool name provided, ignoring');
      expect(result.validated_tools).toEqual(['Read', 'Write']);
    });
    
    it('should remove duplicate tools', () => {
      const tools = ['Read', 'Write', 'Read', 'Bash'];
      const result = ToolValidator.validateToolNames(tools);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Duplicate tool: Read');
      expect(result.validated_tools).toEqual(['Read', 'Write', 'Bash']);
    });
    
    it('should trim whitespace from tool names', () => {
      const tools = ['  Read  ', ' Write ', 'Bash'];
      const result = ToolValidator.validateToolNames(tools);
      
      expect(result.valid).toBe(true);
      expect(result.validated_tools).toEqual(['Read', 'Write', 'Bash']);
    });
    
    it('should validate all Claude Code tools', () => {
      const result = ToolValidator.validateToolNames([...CLAUDE_CODE_TOOLS]);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.validated_tools).toEqual(CLAUDE_CODE_TOOLS);
    });
  });
  
  describe('validatePermissionMode', () => {
    it('should validate known permission modes', () => {
      PERMISSION_MODES.forEach(mode => {
        expect(ToolValidator.validatePermissionMode(mode)).toBe(true);
      });
    });
    
    it('should reject unknown permission modes', () => {
      expect(ToolValidator.validatePermissionMode('invalid')).toBe(false);
      expect(ToolValidator.validatePermissionMode('admin')).toBe(false);
      expect(ToolValidator.validatePermissionMode('superuser')).toBe(false);
    });
    
    it('should handle non-string input', () => {
      expect(ToolValidator.validatePermissionMode(123 as any)).toBe(false);
      expect(ToolValidator.validatePermissionMode(null as any)).toBe(false);
      expect(ToolValidator.validatePermissionMode(undefined as any)).toBe(false);
    });
    
    it('should trim whitespace', () => {
      expect(ToolValidator.validatePermissionMode('  default  ')).toBe(true);
      expect(ToolValidator.validatePermissionMode(' acceptEdits ')).toBe(true);
    });
  });
  
  describe('parseToolHeader', () => {
    it('should parse empty header', () => {
      const result = ToolValidator.parseToolHeader('');
      expect(result).toEqual([]);
    });
    
    it('should parse single tool', () => {
      const result = ToolValidator.parseToolHeader('Read');
      expect(result).toEqual(['Read']);
    });
    
    it('should parse multiple tools', () => {
      const result = ToolValidator.parseToolHeader('Read,Write,Bash');
      expect(result).toEqual(['Read', 'Write', 'Bash']);
    });
    
    it('should handle whitespace in headers', () => {
      const result = ToolValidator.parseToolHeader(' Read , Write , Bash ');
      expect(result).toEqual(['Read', 'Write', 'Bash']);
    });
    
    it('should filter out invalid tools', () => {
      const result = ToolValidator.parseToolHeader('Read,InvalidTool,Write');
      expect(result).toEqual(['Read', 'Write']);
    });
    
    it('should handle null/undefined headers', () => {
      expect(ToolValidator.parseToolHeader(null as any)).toEqual([]);
      expect(ToolValidator.parseToolHeader(undefined as any)).toEqual([]);
    });
    
    it('should handle non-string headers', () => {
      expect(ToolValidator.parseToolHeader(123 as any)).toEqual([]);
    });
    
    it('should remove empty tool names from comma-separated list', () => {
      const result = ToolValidator.parseToolHeader('Read,,Write,   ,Bash');
      expect(result).toEqual(['Read', 'Write', 'Bash']);
    });
  });
  
  describe('validateToolHeaders', () => {
    it('should validate empty headers', () => {
      const result = ToolValidator.validateToolHeaders({});
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.parsed_config).toEqual({});
    });
    
    it('should validate tools enabled header', () => {
      const headers = {
        [TOOL_HEADERS.TOOLS_ENABLED]: 'true'
      };
      const result = ToolValidator.validateToolHeaders(headers);
      
      expect(result.valid).toBe(true);
      expect(result.parsed_config.tools_enabled).toBe(true);
    });
    
    it('should validate tools disabled header', () => {
      const headers = {
        [TOOL_HEADERS.TOOLS_DISABLED]: 'false'
      };
      const result = ToolValidator.validateToolHeaders(headers);
      
      expect(result.valid).toBe(true);
      expect(result.parsed_config.disable_tools).toBe(false);
    });
    
    it('should reject invalid boolean values', () => {
      const headers = {
        [TOOL_HEADERS.TOOLS_ENABLED]: 'maybe'
      };
      const result = ToolValidator.validateToolHeaders(headers);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes("must be 'true' or 'false'"))).toBe(true);
    });
    
    it('should detect conflicting tool headers', () => {
      const headers = {
        [TOOL_HEADERS.TOOLS_ENABLED]: 'true',
        [TOOL_HEADERS.TOOLS_DISABLED]: 'true'
      };
      const result = ToolValidator.validateToolHeaders(headers);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cannot have both tools enabled and disabled');
    });
    
    it('should validate permission mode header', () => {
      const headers = {
        [TOOL_HEADERS.PERMISSION_MODE]: 'acceptEdits'
      };
      const result = ToolValidator.validateToolHeaders(headers);
      
      expect(result.valid).toBe(true);
      expect(result.parsed_config.permission_mode).toBe('acceptEdits');
    });
    
    it('should reject invalid permission mode', () => {
      const headers = {
        [TOOL_HEADERS.PERMISSION_MODE]: 'invalid'
      };
      const result = ToolValidator.validateToolHeaders(headers);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('Invalid permission mode'))).toBe(true);
    });
    
    it('should validate max turns header', () => {
      const headers = {
        [TOOL_HEADERS.MAX_TURNS]: '15'
      };
      const result = ToolValidator.validateToolHeaders(headers);
      
      expect(result.valid).toBe(true);
      expect(result.parsed_config.max_turns).toBe(15);
    });
    
    it('should reject invalid max turns values', () => {
      const invalidValues = ['0', '101', 'abc', '-5'];
      
      invalidValues.forEach(value => {
        const headers = {
          [TOOL_HEADERS.MAX_TURNS]: value
        };
        const result = ToolValidator.validateToolHeaders(headers);
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(error => error.includes('must be a number between 1 and 100'))).toBe(true);
      });
    });
    
    it('should validate permission headers', () => {
      const headers = {
        [TOOL_HEADERS.READ_PERMISSION]: 'true',
        [TOOL_HEADERS.WRITE_PERMISSION]: 'false',
        [TOOL_HEADERS.EXECUTION_PERMISSION]: 'true'
      };
      const result = ToolValidator.validateToolHeaders(headers);
      
      expect(result.valid).toBe(true);
    });
    
    it('should reject invalid permission header values', () => {
      const headers = {
        [TOOL_HEADERS.READ_PERMISSION]: 'maybe'
      };
      const result = ToolValidator.validateToolHeaders(headers);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes("must be 'true' or 'false'"))).toBe(true);
    });
    
    it('should handle multiple valid headers', () => {
      const headers = {
        [TOOL_HEADERS.TOOLS_ENABLED]: 'true',
        [TOOL_HEADERS.PERMISSION_MODE]: 'default',
        [TOOL_HEADERS.MAX_TURNS]: '10',
        [TOOL_HEADERS.READ_PERMISSION]: 'true'
      };
      const result = ToolValidator.validateToolHeaders(headers);
      
      expect(result.valid).toBe(true);
      expect(result.parsed_config.tools_enabled).toBe(true);
      expect(result.parsed_config.permission_mode).toBe('default');
      expect(result.parsed_config.max_turns).toBe(10);
    });
  });
  
  describe('validateToolSecurity', () => {
    it('should pass security validation for safe tools', () => {
      const tools: ClaudeCodeTool[] = ['Read', 'Glob', 'Grep'];
      const result = ToolValidator.validateToolSecurity(tools, 'default');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
    
    it('should warn about write and execution combination', () => {
      const tools: ClaudeCodeTool[] = ['Read', 'Write', 'Bash'];
      const result = ToolValidator.validateToolSecurity(tools, 'default');
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(warning => warning.includes('Both write and execution tools requested'))).toBe(true);
    });
    
    it('should warn about bash in default mode', () => {
      const tools: ClaudeCodeTool[] = ['Bash'];
      const result = ToolValidator.validateToolSecurity(tools, 'default');
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(warning => warning.includes('Bash execution requested in default mode'))).toBe(true);
    });
    
    it('should warn about exit_plan_mode alone', () => {
      const tools: ClaudeCodeTool[] = ['exit_plan_mode'];
      const result = ToolValidator.validateToolSecurity(tools, 'default');
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(warning => warning.includes('exit_plan_mode alone may not provide full functionality'))).toBe(true);
    });
    
    it('should allow dangerous combinations in acceptEdits mode', () => {
      const tools: ClaudeCodeTool[] = ['Write', 'Bash'];
      const result = ToolValidator.validateToolSecurity(tools, 'acceptEdits');
      
      expect(result.valid).toBe(true);
      // Should have fewer warnings in acceptEdits mode
    });
  });
  
  describe('getValidationReport', () => {
    it('should provide comprehensive validation report for valid input', () => {
      const tools = ['Read', 'Write'];
      const headers = {
        [TOOL_HEADERS.TOOLS_ENABLED]: 'true',
        [TOOL_HEADERS.PERMISSION_MODE]: 'default'
      };
      
      const report = ToolValidator.getValidationReport(tools, headers, 'default');
      
      expect(report.overall_valid).toBe(true);
      expect(report.tool_validation.valid).toBe(true);
      expect(report.header_validation.valid).toBe(true);
      expect(report.security_validation.valid).toBe(true);
      expect(report.all_errors).toEqual([]);
    });
    
    it('should provide comprehensive validation report for invalid input', () => {
      const tools = ['Read', 'InvalidTool'];
      const headers = {
        [TOOL_HEADERS.TOOLS_ENABLED]: 'maybe',
        [TOOL_HEADERS.MAX_TURNS]: '200'
      };
      
      const report = ToolValidator.getValidationReport(tools, headers, 'default');
      
      expect(report.overall_valid).toBe(false);
      expect(report.all_errors.length).toBeGreaterThan(0);
      expect(report.all_errors.some(error => error.includes('Unknown tool: InvalidTool'))).toBe(true);
      expect(report.all_errors.some(error => error.includes("must be 'true' or 'false'"))).toBe(true);
    });
    
    it('should aggregate warnings from all validation steps', () => {
      const tools = ['Write', 'Bash', 'exit_plan_mode'];
      const headers = {};
      
      const report = ToolValidator.getValidationReport(tools, headers, 'default');
      
      expect(report.overall_valid).toBe(true);
      expect(report.all_warnings.length).toBeGreaterThan(0);
      expect(report.all_warnings.some(warning => warning.includes('Both write and execution tools requested'))).toBe(true);
    });
  });
  
  describe('edge cases and error handling', () => {
    it('should handle malformed header values gracefully', () => {
      const headers = {
        [TOOL_HEADERS.TOOLS_ENABLED]: '',
        [TOOL_HEADERS.MAX_TURNS]: '',
        [TOOL_HEADERS.PERMISSION_MODE]: ''
      };
      
      const result = ToolValidator.validateToolHeaders(headers);
      
      // Should handle empty strings gracefully
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    it('should handle extremely large tool lists', () => {
      const largeToolArray = new Array(1000).fill('Read');
      const result = ToolValidator.validateToolNames(largeToolArray);
      
      expect(result.valid).toBe(true);
      expect(result.validated_tools).toEqual(['Read']); // Duplicates removed
      expect(result.warnings.length).toBeGreaterThan(0); // Duplicate warnings
    });
    
    it('should handle special characters in tool names', () => {
      const tools = ['Read!', '@Write', '#Bash'];
      const result = ToolValidator.validateToolNames(tools);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3); // All invalid
    });
    
    it('should validate case sensitivity', () => {
      const tools = ['read', 'WRITE', 'Bash'];
      const result = ToolValidator.validateToolNames(tools);
      
      expect(result.valid).toBe(false);
      expect(result.validated_tools).toEqual(['Bash']); // Only exact match
      expect(result.errors.some(error => error.includes('Unknown tool: read'))).toBe(true);
      expect(result.errors.some(error => error.includes('Unknown tool: WRITE'))).toBe(true);
    });
  });
  
  describe('performance', () => {
    it('should validate tools quickly', () => {
      const tools = [...CLAUDE_CODE_TOOLS];
      
      const start = Date.now();
      const result = ToolValidator.validateToolNames(tools);
      const end = Date.now();
      
      expect(end - start).toBeLessThan(10); // Should complete in under 10ms
      expect(result.valid).toBe(true);
    });
    
    it('should validate headers quickly', () => {
      const headers = {
        [TOOL_HEADERS.TOOLS_ENABLED]: 'true',
        [TOOL_HEADERS.PERMISSION_MODE]: 'acceptEdits',
        [TOOL_HEADERS.MAX_TURNS]: '10',
        [TOOL_HEADERS.READ_PERMISSION]: 'true',
        [TOOL_HEADERS.WRITE_PERMISSION]: 'false',
        [TOOL_HEADERS.EXECUTION_PERMISSION]: 'true'
      };
      
      const start = Date.now();
      const result = ToolValidator.validateToolHeaders(headers);
      const end = Date.now();
      
      expect(end - start).toBeLessThan(5); // Should complete in under 5ms
      expect(result.valid).toBe(true);
    });
    
    it('should generate comprehensive reports quickly', () => {
      const tools = [...CLAUDE_CODE_TOOLS];
      const headers = {
        [TOOL_HEADERS.TOOLS_ENABLED]: 'true',
        [TOOL_HEADERS.PERMISSION_MODE]: 'default'
      };
      
      const start = Date.now();
      const report = ToolValidator.getValidationReport(tools, headers);
      const end = Date.now();
      
      expect(end - start).toBeLessThan(15); // Should complete in under 15ms
      expect(report.overall_valid).toBe(true);
    });
  });
});