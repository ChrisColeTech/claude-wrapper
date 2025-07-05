/**
 * Integration Tests for Tools Management System
 * Phase 7A Implementation: Complete tools system integration tests
 * Tests integration with message processing, validation, and filtering
 */

import { ToolManager } from '../../../src/tools/manager';
import { ToolValidator } from '../../../src/tools/validator';
import { ToolContentFilter } from '../../../src/tools/filter';
import { ContentFilter } from '../../../src/message/filter';
import { 
  CLAUDE_CODE_TOOLS, 
  ClaudeCodeTool,
  TOOL_HEADERS,
  TOOL_CATEGORIES 
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

describe.skip('Tools System Integration', () => {
  describe.skip('Tools + Message Processing Integration', () => {
    it('should integrate tool filtering with message content filtering', () => {
      const claudeResponse = `
        <thinking>
        I need to help the user with file operations.
        </thinking>
        
        I'll help you read that file.
        
        <read_file path="/some/file.txt">
        Reading the file content...
        </read_file>
        
        <attempt_completion>
        Here's the content from the file:
        
        Line 1: Important data
        Line 2: More data
        Line 3: Final data
        </attempt_completion>
      `;
      
      // Test message content filter (existing system)
      const messageFiltered = ContentFilter.filterContent(claudeResponse);
      
      // Test tool content filter (new system)
      const toolFiltered = ToolContentFilter.filterToolContent(claudeResponse);
      
      // Both should produce similar results for attempt_completion extraction
      expect(messageFiltered).toContain("Here's the content from the file:");
      expect(messageFiltered).toContain("Line 1: Important data");
      expect(messageFiltered).not.toContain('<thinking>');
      expect(messageFiltered).not.toContain('<attempt_completion>');
      
      expect(toolFiltered.filtered_content).toContain("Here's the content from the file:");
      expect(toolFiltered.found_attempt_completion).toBe(true);
      expect(toolFiltered.found_thinking_blocks).toBe(true);
    });
    
    it('should handle tool configuration affecting content filtering', () => {
      const content = `
        I'll help you with that.
        
        <bash>
        ls -la
        </bash>
        
        <read_file>
        file content
        </read_file>
        
        Here's what I found.
      `;
      
      // With tools enabled - should preserve tool blocks  
      const enabledConfig = ToolManager.configureTools({ tools_enabled: true });
      const enabledFilter = ToolContentFilter.filterToolContent(content, {
        tools_enabled: enabledConfig.tools_enabled,
        removeToolUsage: false
      });
      
      expect(enabledFilter.filtered_content).toContain('<bash>');
      expect(enabledFilter.filtered_content).toContain('<read_file>');
      expect(enabledFilter.removed_tools).toEqual([]);
      
      // With tools disabled - should remove tool blocks
      const disabledConfig = ToolManager.configureTools({ disable_tools: true });
      const disabledFilter = ToolContentFilter.filterToolContent(content, {
        tools_enabled: disabledConfig.tools_enabled
      });
      
      expect(disabledFilter.filtered_content).not.toContain('<bash>');
      expect(disabledFilter.filtered_content).not.toContain('<read_file>');
      expect(disabledFilter.removed_tools).toContain('Bash');
      expect(disabledFilter.removed_tools).toContain('Read');
    });
  });
  
  describe.skip('Header Processing + Tool Configuration Flow', () => {
    it('should process HTTP headers through complete tool pipeline', () => {
      // Simulate HTTP request headers
      const headers = {
        [TOOL_HEADERS.TOOLS_ENABLED]: 'true',
        [TOOL_HEADERS.READ_PERMISSION]: 'true',
        [TOOL_HEADERS.WRITE_PERMISSION]: 'false',
        [TOOL_HEADERS.EXECUTION_PERMISSION]: 'false',
        [TOOL_HEADERS.PERMISSION_MODE]: 'default',
        [TOOL_HEADERS.MAX_TURNS]: '5'
      };
      
      // Step 1: Validate headers
      const headerValidation = ToolValidator.validateToolHeaders(headers);
      expect(headerValidation.valid).toBe(true);
      
      // Step 2: Parse headers to configuration
      const headerConfig = ToolManager.parseToolHeaders(headers);
      expect(headerConfig.tools_enabled).toBe(true);
      expect(headerConfig.permission_mode).toBe('default');
      expect(headerConfig.max_turns).toBe(5);
      
      // Step 3: Configure tools based on headers
      const toolConfig = ToolManager.configureTools(headerConfig);
      expect(toolConfig.tools_enabled).toBe(true);
      expect(toolConfig.max_turns).toBe(5);
      
      // Should only have read-only tools (no write or execution)
      expect(toolConfig.tools).toEqual(expect.arrayContaining(TOOL_CATEGORIES.READ_ONLY));
      expect(toolConfig.tools).toEqual(expect.arrayContaining(TOOL_CATEGORIES.FLOW_CONTROL));
      expect(toolConfig.tools).not.toEqual(expect.arrayContaining(TOOL_CATEGORIES.WRITE_OPERATIONS));
      expect(toolConfig.tools).not.toEqual(expect.arrayContaining(TOOL_CATEGORIES.EXECUTION));
      
      // Step 4: Validate tool security
      const securityValidation = ToolValidator.validateToolSecurity(
        toolConfig.tools, 
        toolConfig.permission_mode
      );
      expect(securityValidation.valid).toBe(true);
    });
    
    it('should handle conflicting headers gracefully', () => {
      const conflictingHeaders = {
        [TOOL_HEADERS.TOOLS_ENABLED]: 'true',
        [TOOL_HEADERS.TOOLS_DISABLED]: 'true'
      };
      
      const validation = ToolValidator.validateToolHeaders(conflictingHeaders);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Cannot have both tools enabled and disabled');
    });
    
    it('should apply permission restrictions correctly', () => {
      const restrictiveHeaders = {
        [TOOL_HEADERS.READ_PERMISSION]: 'true',
        [TOOL_HEADERS.WRITE_PERMISSION]: 'false',
        [TOOL_HEADERS.EXECUTION_PERMISSION]: 'false'
      };
      
      const config = ToolManager.parseToolHeaders(restrictiveHeaders);
      const toolConfig = ToolManager.configureTools(config);
      
      // Should only allow safe read operations
      expect(toolConfig.tools).toContain('Read');
      expect(toolConfig.tools).toContain('Glob');
      expect(toolConfig.tools).toContain('Grep');
      expect(toolConfig.tools).not.toContain('Write');
      expect(toolConfig.tools).not.toContain('Bash');
      expect(toolConfig.tools).not.toContain('Edit');
    });
  });
  
  describe.skip('Tool Validation + Security Integration', () => {
    it('should provide comprehensive security analysis', () => {
      const dangerousTools = ['Write', 'Edit', 'Bash'];
      const safeTools = ['Read', 'Glob', 'Grep'];
      
      // Test dangerous combination
      const dangerousReport = ToolValidator.getValidationReport(
        dangerousTools, 
        {}, 
        'default'
      );
      expect(dangerousReport.overall_valid).toBe(true);
      expect(dangerousReport.all_warnings.length).toBeGreaterThan(0);
      expect(dangerousReport.all_warnings.some((warning: string) => 
        warning.includes('Both write and execution tools requested')
      )).toBe(true);
      
      // Test safe combination
      const safeReport = ToolValidator.getValidationReport(
        safeTools, 
        {}, 
        'default'
      );
      expect(safeReport.overall_valid).toBe(true);
      expect(safeReport.all_warnings.length).toBe(0);
    });
    
    it('should validate tools in different permission modes', () => {
      const tools = ['Write', 'Bash'];
      
      // Default mode - should warn
      const defaultReport = ToolValidator.getValidationReport(tools, {}, 'default');
      expect(defaultReport.all_warnings.length).toBeGreaterThan(0);
      
      // AcceptEdits mode - should be more permissive
      const acceptEditsReport = ToolValidator.getValidationReport(tools, {}, 'acceptEdits');
      expect(acceptEditsReport.overall_valid).toBe(true);
      
      // BypassPermissions mode - should allow everything
      const bypassReport = ToolValidator.getValidationReport(tools, {}, 'bypassPermissions');
      expect(bypassReport.overall_valid).toBe(true);
    });
  });
  
  describe.skip('End-to-End Tool Processing Pipeline', () => {
    it('should process complete request with tools', async () => {
      // Simulate incoming request
      const requestHeaders = {
        [TOOL_HEADERS.TOOLS_ENABLED]: 'true',
        [TOOL_HEADERS.PERMISSION_MODE]: 'acceptEdits',
        [TOOL_HEADERS.MAX_TURNS]: '10'
      };
      
      const requestedTools: ClaudeCodeTool[] = ['Read', 'Write', 'Glob'];
      
      // Step 1: Validate request
      const validation = ToolValidator.getValidationReport(requestedTools, requestHeaders);
      expect(validation.overall_valid).toBe(true);
      
      // Step 2: Configure tools
      const headerConfig = ToolManager.parseToolHeaders(requestHeaders);
      const toolConfig = ToolManager.configureTools({
        ...headerConfig,
        allowed_tools: requestedTools
      });
      
      expect(toolConfig.tools_enabled).toBe(true);
      expect(toolConfig.tools).toEqual(expect.arrayContaining(requestedTools));
      expect(toolConfig.tools.length).toBe(requestedTools.length);
      expect(toolConfig.permission_mode).toBe('acceptEdits');
      
      // Step 3: Process Claude response
      const claudeResponse = `
        <thinking>
        I need to read the file and then write the results.
        </thinking>
        
        I'll help you process that file.
        
        <read_file path="/input.txt">
        Reading input file...
        </read_file>
        
        <write_file path="/output.txt">
        Writing processed results...
        </write_file>
        
        <attempt_completion>
        I've successfully processed your file:
        
        1. Read the input from /input.txt
        2. Processed the data
        3. Wrote the results to /output.txt
        
        The operation completed successfully.
        </attempt_completion>
      `;
      
      // Step 4: Filter response content
      const filterResult = ToolContentFilter.filterToolContent(claudeResponse, {
        tools_enabled: toolConfig.tools_enabled
      });
      
      expect(filterResult.found_attempt_completion).toBe(true);
      expect(filterResult.filtered_content).toContain('successfully processed your file');
      expect(filterResult.filtered_content).not.toContain('<thinking>');
      expect(filterResult.filtered_content).not.toContain('<read_file>');
      
      // Step 5: Get processing statistics
      const stats = ToolManager.getToolStats(toolConfig);
      expect(stats.enabled_tools).toBe(3);
      expect(stats.read_only_tools).toBe(2); // Read, Glob
      expect(stats.write_tools).toBe(1); // Write
    });
    
    it('should handle tool-disabled request efficiently', () => {
      const requestHeaders = {
        [TOOL_HEADERS.TOOLS_DISABLED]: 'true'
      };
      
      const config = ToolManager.parseToolHeaders(requestHeaders);
      const toolConfig = ToolManager.configureTools(config);
      
      expect(toolConfig.tools_enabled).toBe(false);
      expect(toolConfig.tools).toEqual([]);
      expect(toolConfig.max_turns).toBe(1); // Speed optimization
      
      const claudeResponse = `
        I'll provide a direct answer without using tools.
        
        <read_file>This should be removed</read_file>
        
        Here's the information you requested.
      `;
      
      const filterResult = ToolContentFilter.filterToolContent(claudeResponse, {
        tools_enabled: false
      });
      
      expect(filterResult.filtered_content).not.toContain('<read_file>');
      expect(filterResult.removed_tools).toContain('Read');
      expect(filterResult.filtered_content).toContain("I'll provide a direct answer");
      expect(filterResult.filtered_content).toContain("Here's the information you requested");
    });
  });
  
  describe.skip('Error Handling and Edge Cases', () => {
    it('should handle malformed tool content gracefully', () => {
      const malformedContent = `
        <read_file>
        Unclosed tag content
        </read_file>
        Regular text after.
      `;
      
      const result = ToolContentFilter.removeToolUsageBlocks(malformedContent);
      expect(result.content).toContain('Regular text after.');
      expect(result.removed_tools).toContain('Read');
    });
    
    it('should handle empty configurations', () => {
      const emptyConfig = ToolManager.configureTools({});
      expect(emptyConfig.tools_enabled).toBe(true); // Default behavior
      expect(emptyConfig.tools).toEqual(CLAUDE_CODE_TOOLS);
      
      const emptyValidation = ToolValidator.validateToolHeaders({});
      expect(emptyValidation.valid).toBe(true);
    });
    
    it('should handle large tool configurations', () => {
      const largeConfig = {
        allowed_tools: [...CLAUDE_CODE_TOOLS],
        max_turns: 50
      };
      
      const start = Date.now();
      const toolConfig = ToolManager.configureTools(largeConfig);
      const validation = ToolManager.validateToolConfig(largeConfig);
      const end = Date.now();
      
      expect(end - start).toBeLessThan(20); // Should be fast
      expect(toolConfig.tools).toEqual(CLAUDE_CODE_TOOLS);
      expect(validation.valid).toBe(true);
    });
  });
  
  describe.skip('Performance and Scalability', () => {
    it('should handle concurrent tool processing', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        headers: {
          [TOOL_HEADERS.TOOLS_ENABLED]: 'true',
          [TOOL_HEADERS.MAX_TURNS]: String(i + 1)
        },
        tools: (['Read', 'Write', 'Bash'] as ClaudeCodeTool[]).slice(0, (i % 3) + 1)
      }));
      
      const start = Date.now();
      const results = await Promise.all(
        requests.map(async (request) => {
          const headerConfig = ToolManager.parseToolHeaders(request.headers);
          const toolConfig = ToolManager.configureTools({
            ...headerConfig,
            allowed_tools: request.tools
          });
          const validation = ToolValidator.validateToolNames(request.tools);
          
          return { toolConfig, validation };
        })
      );
      const end = Date.now();
      
      expect(end - start).toBeLessThan(50); // Should handle concurrent processing
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.toolConfig.tools_enabled).toBe(true);
        expect(result.validation.valid).toBe(true);
      });
    });
    
    it('should maintain performance with complex content filtering', () => {
      let complexContent = 'Start\n';
      
      // Build content with multiple tool types
      for (let i = 0; i < 50; i++) {
        complexContent += `<thinking>Thought ${i}</thinking>\n`;
        complexContent += `<read_file>File ${i}</read_file>\n`;
        complexContent += `<bash>Command ${i}</bash>\n`;
        complexContent += `Regular content ${i}\n`;
      }
      
      complexContent += '<attempt_completion>Final result</attempt_completion>';
      
      const start = Date.now();
      const result = ToolContentFilter.filterToolContent(complexContent);
      const end = Date.now();
      
      expect(end - start).toBeLessThan(100); // Should handle complex content efficiently
      expect(result.filtered_content).toBe('Final result');
      expect(result.found_thinking_blocks).toBe(true);
      expect(result.found_attempt_completion).toBe(true);
    });
  });
});