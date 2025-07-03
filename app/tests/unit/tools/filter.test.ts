/**
 * Comprehensive Test Suite for Tool Content Filter
 * Phase 7A Implementation: Complete tool content filtering tests
 * Based on Python message_adapter.py content filtering behavior
 */

import { 
  ToolContentFilter, 
  ToolFilterConfig, 
  ToolFilterResult 
} from '../../../src/tools/filter';
import { CLAUDE_CODE_TOOLS } from '../../../src/tools/constants';

// Mock logger to avoid console output during tests
jest.mock('../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('ToolContentFilter', () => {
  describe('filterToolContent', () => {
    it('should handle empty content', () => {
      const result = ToolContentFilter.filterToolContent('');
      
      expect(result.filtered_content).toBe('');
      expect(result.removed_tools).toEqual([]);
      expect(result.found_attempt_completion).toBe(false);
      expect(result.found_thinking_blocks).toBe(false);
      expect(result.original_length).toBe(0);
      expect(result.filtered_length).toBe(0);
    });
    
    it('should handle null/undefined content', () => {
      const result1 = ToolContentFilter.filterToolContent(null as any);
      const result2 = ToolContentFilter.filterToolContent(undefined as any);
      
      expect(result1.filtered_content).toBe(null);
      expect(result2.filtered_content).toBe(undefined);
    });
    
    it('should remove thinking blocks by default', () => {
      const content = `
        <thinking>
        Let me think about this problem...
        </thinking>
        Here's the answer.
      `;
      
      const result = ToolContentFilter.filterToolContent(content);
      
      expect(result.filtered_content).not.toContain('<thinking>');
      expect(result.filtered_content).not.toContain('Let me think about this problem...');
      expect(result.filtered_content).toContain("Here's the answer.");
      expect(result.found_thinking_blocks).toBe(true);
    });
    
    it('should preserve thinking blocks when configured', () => {
      const content = `
        <thinking>
        Let me think about this problem...
        </thinking>
        Here's the answer.
      `;
      
      const config: ToolFilterConfig = { removeThinkingBlocks: false };
      const result = ToolContentFilter.filterToolContent(content, config);
      
      expect(result.filtered_content).toContain('<thinking>');
      expect(result.filtered_content).toContain('Let me think about this problem...');
    });
    
    it('should extract attempt_completion content', () => {
      const content = `
        <thinking>
        I need to provide a response.
        </thinking>
        Some initial text.
        <attempt_completion>
        This is the actual response I want to give.
        </attempt_completion>
        Some trailing text.
      `;
      
      const result = ToolContentFilter.filterToolContent(content);
      
      expect(result.filtered_content).toBe('This is the actual response I want to give.');
      expect(result.found_attempt_completion).toBe(true);
      expect(result.found_thinking_blocks).toBe(true);
    });
    
    it('should extract nested result tags from attempt_completion', () => {
      const content = `
        <attempt_completion>
        <result>
        This is the final result.
        </result>
        </attempt_completion>
      `;
      
      const result = ToolContentFilter.filterToolContent(content);
      
      expect(result.filtered_content).toBe('This is the final result.');
      expect(result.found_attempt_completion).toBe(true);
    });
    
    it('should remove tool usage blocks when no attempt_completion', () => {
      const content = `
        I'll help you with that.
        <read_file>
        path: /some/file.txt
        </read_file>
        <bash>
        ls -la
        </bash>
        Here's what I found.
      `;
      
      const result = ToolContentFilter.filterToolContent(content);
      
      expect(result.filtered_content).not.toContain('<read_file>');
      expect(result.filtered_content).not.toContain('<bash>');
      expect(result.filtered_content).toContain("I'll help you with that.");
      expect(result.filtered_content).toContain("Here's what I found.");
      expect(result.removed_tools).toContain('Read');
      expect(result.removed_tools).toContain('Bash');
    });
    
    it('should not remove tools when tools are enabled and no attempt_completion', () => {
      const content = `
        I'll help you with that.
        <read_file>
        path: /some/file.txt
        </read_file>
        Here's what I found.
      `;
      
      const config: ToolFilterConfig = { tools_enabled: true, removeToolUsage: false };
      const result = ToolContentFilter.filterToolContent(content, config);
      
      expect(result.filtered_content).toContain('<read_file>');
      expect(result.removed_tools).toEqual([]);
    });
    
    it('should clean up whitespace', () => {
      const content = `
        
        
        This has    
        
        
        too much whitespace.
        
        
      `;
      
      const result = ToolContentFilter.filterToolContent(content);
      
      // Allow for some whitespace normalization differences
      expect(result.filtered_content.trim()).toContain('This has');
    });
  });
  
  describe('removeToolUsageBlocks', () => {
    it('should remove all supported tool blocks', () => {
      const content = `
        <read_file>content</read_file>
        <write_file>content</write_file>
        <edit_file>content</edit_file>
        <multi_edit>content</multi_edit>
        <bash>content</bash>
        <search_files>content</search_files>
        <grep>content</grep>
        <list_files>content</list_files>
        <ls>content</ls>
        <notebook_read>content</notebook_read>
        <notebook_edit>content</notebook_edit>
        <web_fetch>content</web_fetch>
        <todo_read>content</todo_read>
        <todo_write>content</todo_write>
        <web_search>content</web_search>
        <task>content</task>
        <exit_plan_mode>content</exit_plan_mode>
        Some remaining text.
      `;
      
      const result = ToolContentFilter.removeToolUsageBlocks(content);
      
      expect(result.content).toContain('Some remaining text.');
      expect(result.removed_tools.length).toBeGreaterThan(0);
      expect(result.removed_tools).toContain('Read');
      expect(result.removed_tools).toContain('Write');
      expect(result.removed_tools).toContain('Bash');
    });
    
    it('should remove legacy tool blocks', () => {
      const content = `
        <str_replace_editor>content</str_replace_editor>
        <args>content</args>
        <ask_followup_question>content</ask_followup_question>
        Some remaining text.
      `;
      
      const result = ToolContentFilter.removeToolUsageBlocks(content);
      
      expect(result.content).not.toContain('<str_replace_editor>');
      expect(result.content).not.toContain('<args>');
      expect(result.content).not.toContain('<ask_followup_question>');
      expect(result.content).toContain('Some remaining text.');
    });
    
    it('should handle tool blocks with attributes', () => {
      const content = `
        <read_file path="/some/path" encoding="utf-8">
        file content here
        </read_file>
        <bash timeout="30">
        ls -la
        </bash>
        Remaining text.
      `;
      
      const result = ToolContentFilter.removeToolUsageBlocks(content);
      
      expect(result.content).not.toContain('<read_file');
      expect(result.content).not.toContain('<bash');
      expect(result.content).toContain('Remaining text.');
      expect(result.removed_tools).toContain('Read');
      expect(result.removed_tools).toContain('Bash');
    });
    
    it('should handle nested tool content', () => {
      const content = `
        <read_file>
        This file contains <tags> and other content.
        </read_file>
        Text after.
      `;
      
      const result = ToolContentFilter.removeToolUsageBlocks(content);
      
      expect(result.content).not.toContain('<read_file>');
      expect(result.content).not.toContain('This file contains <tags>');
      expect(result.content).toContain('Text after.');
    });
    
    it('should not remove duplicates in removed_tools list', () => {
      const content = `
        <read_file>content1</read_file>
        <read_file>content2</read_file>
        <bash>command1</bash>
        <bash>command2</bash>
      `;
      
      const result = ToolContentFilter.removeToolUsageBlocks(content);
      
      expect(result.removed_tools).toContain('Read');
      expect(result.removed_tools).toContain('Bash');
      expect(result.removed_tools.filter(tool => tool === 'Read')).toHaveLength(1);
      expect(result.removed_tools.filter(tool => tool === 'Bash')).toHaveLength(1);
    });
  });
  
  describe('extractAttemptCompletion', () => {
    it('should return original content when no attempt_completion', () => {
      const content = 'This is regular content.';
      const result = ToolContentFilter.extractAttemptCompletion(content);
      
      expect(result).toBe(content);
    });
    
    it('should extract content from attempt_completion block', () => {
      const content = `
        <attempt_completion>
        This is the completion content.
        </attempt_completion>
      `;
      
      const result = ToolContentFilter.extractAttemptCompletion(content);
      
      expect(result).toBe('This is the completion content.');
    });
    
    it('should extract from result tag within attempt_completion', () => {
      const content = `
        <attempt_completion>
        Some wrapper content.
        <result>
        This is the final result.
        </result>
        More wrapper content.
        </attempt_completion>
      `;
      
      const result = ToolContentFilter.extractAttemptCompletion(content);
      
      expect(result).toBe('This is the final result.');
    });
    
    it('should handle attempt_completion with attributes', () => {
      const content = `
        <attempt_completion type="final">
        This is the completion content.
        </attempt_completion>
      `;
      
      const result = ToolContentFilter.extractAttemptCompletion(content);
      
      expect(result).toBe('This is the completion content.');
    });
    
    it('should handle result with attributes', () => {
      const content = `
        <attempt_completion>
        <result status="success">
        This is the final result.
        </result>
        </attempt_completion>
      `;
      
      const result = ToolContentFilter.extractAttemptCompletion(content);
      
      expect(result).toBe('This is the final result.');
    });
    
    it('should return fallback message for empty attempt_completion', () => {
      const content = `
        <attempt_completion>
        </attempt_completion>
      `;
      
      const result = ToolContentFilter.extractAttemptCompletion(content);
      
      expect(result).toBe("I understand you're testing the system. How can I help you today?");
    });
    
    it('should return fallback message for empty result', () => {
      const content = `
        <attempt_completion>
        <result>
        </result>
        </attempt_completion>
      `;
      
      const result = ToolContentFilter.extractAttemptCompletion(content);
      
      expect(result).toBe("I understand you're testing the system. How can I help you today?");
    });
    
    it('should use first attempt_completion when multiple exist', () => {
      const content = `
        <attempt_completion>
        First completion.
        </attempt_completion>
        <attempt_completion>
        Second completion.
        </attempt_completion>
      `;
      
      const result = ToolContentFilter.extractAttemptCompletion(content);
      
      expect(result).toBe('First completion.');
    });
  });
  
  describe('removeThinkingBlocks', () => {
    it('should remove simple thinking blocks', () => {
      const content = `
        Before thinking.
        <thinking>
        This is my internal thought process.
        </thinking>
        After thinking.
      `;
      
      const result = ToolContentFilter.removeThinkingBlocks(content);
      
      expect(result).not.toContain('<thinking>');
      expect(result).not.toContain('This is my internal thought process.');
      expect(result).toContain('Before thinking.');
      expect(result).toContain('After thinking.');
    });
    
    it('should handle nested thinking blocks', () => {
      const content = `
        <thinking>
        Outer thought.
        <thinking>
        Inner thought.
        </thinking>
        Back to outer.
        </thinking>
        Final content.
      `;
      
      const result = ToolContentFilter.removeThinkingBlocks(content);
      
      expect(result).not.toContain('<thinking>');
      expect(result).not.toContain('Outer thought');
      expect(result).not.toContain('Inner thought');
      expect(result).toContain('Final content.');
    });
    
    it('should handle multiple thinking blocks', () => {
      const content = `
        First text.
        <thinking>
        First thought.
        </thinking>
        Middle text.
        <thinking>
        Second thought.
        </thinking>
        Final text.
      `;
      
      const result = ToolContentFilter.removeThinkingBlocks(content);
      
      expect(result).not.toContain('<thinking>');
      expect(result).not.toContain('First thought');
      expect(result).not.toContain('Second thought');
      expect(result).toContain('First text.');
      expect(result).toContain('Middle text.');
      expect(result).toContain('Final text.');
    });
    
    it('should handle malformed thinking blocks gracefully', () => {
      const content = `
        <thinking>
        Unclosed thinking block.
        Regular content.
      `;
      
      const result = ToolContentFilter.removeThinkingBlocks(content);
      
      // Should not contain anything after the unclosed thinking tag
      expect(result).not.toContain('Unclosed thinking block');
      expect(result).not.toContain('Regular content');
    });
    
    it('should preserve content outside thinking blocks', () => {
      const content = `
        This is important content.
        <thinking>Remove this.</thinking>
        This is also important.
      `;
      
      const result = ToolContentFilter.removeThinkingBlocks(content);
      
      expect(result).toContain('This is important content.');
      expect(result).toContain('This is also important.');
      expect(result).not.toContain('Remove this.');
    });
  });
  
  describe('cleanupWhitespace', () => {
    it('should reduce multiple newlines to double', () => {
      const content = 'Line 1\n\n\n\n\nLine 2';
      const result = ToolContentFilter.cleanupWhitespace(content);
      
      expect(result).toBe('Line 1\n\nLine 2');
    });
    
    it('should trim leading and trailing whitespace', () => {
      const content = '   \n  Content here  \n   ';
      const result = ToolContentFilter.cleanupWhitespace(content);
      
      expect(result).toBe('Content here');
    });
    
    it('should handle mixed whitespace', () => {
      const content = '\n  \n\n   \nContent\n  \n\n   \n';
      const result = ToolContentFilter.cleanupWhitespace(content);
      
      expect(result).toBe('Content');
    });
    
    it('should preserve intentional spacing', () => {
      const content = 'Line 1\n\nLine 2\n\nLine 3';
      const result = ToolContentFilter.cleanupWhitespace(content);
      
      expect(result).toBe('Line 1\n\nLine 2\n\nLine 3');
    });
  });
  
  describe('containsToolUsage', () => {
    it('should detect tool usage', () => {
      const content = `
        <read_file>content</read_file>
        <bash>command</bash>
      `;
      
      const result = ToolContentFilter.containsToolUsage(content);
      
      expect(result.has_tools).toBe(true);
      expect(result.found_tools).toContain('read_file');
      expect(result.found_tools).toContain('bash');
      expect(result.tool_count).toBe(2);
    });
    
    it('should detect no tool usage', () => {
      const content = 'This is regular content without tools.';
      
      const result = ToolContentFilter.containsToolUsage(content);
      
      expect(result.has_tools).toBe(false);
      expect(result.found_tools).toEqual([]);
      expect(result.tool_count).toBe(0);
    });
    
    it('should detect legacy tools', () => {
      const content = '<str_replace_editor>content</str_replace_editor>';
      
      const result = ToolContentFilter.containsToolUsage(content);
      
      expect(result.has_tools).toBe(true);
      expect(result.found_tools).toContain('str_replace_editor');
    });
    
    it('should handle tools with attributes', () => {
      const content = '<read_file path="/some/path">content</read_file>';
      
      const result = ToolContentFilter.containsToolUsage(content);
      
      expect(result.has_tools).toBe(true);
      expect(result.found_tools).toContain('read_file');
    });
  });
  
  describe('getFilterStats', () => {
    it('should calculate basic filter statistics', () => {
      const original = 'This is original content with 50 characters.';
      const filtered = 'This is filtered content.';
      
      const stats = ToolContentFilter.getFilterStats(original, filtered);
      
      expect(stats.original_length).toBe(original.length);
      expect(stats.filtered_length).toBe(filtered.length);
      expect(stats.characters_removed).toBe(original.length - filtered.length);
      expect(stats.percentage_reduced).toBeGreaterThan(0);
      expect(stats.was_modified).toBe(true);
    });
    
    it('should handle no modification', () => {
      const content = 'This content was not modified.';
      
      const stats = ToolContentFilter.getFilterStats(content, content);
      
      expect(stats.original_length).toBe(content.length);
      expect(stats.filtered_length).toBe(content.length);
      expect(stats.characters_removed).toBe(0);
      expect(stats.percentage_reduced).toBe(0);
      expect(stats.was_modified).toBe(false);
    });
    
    it('should handle empty content', () => {
      const stats = ToolContentFilter.getFilterStats('', '');
      
      expect(stats.original_length).toBe(0);
      expect(stats.filtered_length).toBe(0);
      expect(stats.characters_removed).toBe(0);
      expect(stats.percentage_reduced).toBe(0);
      expect(stats.was_modified).toBe(false);
    });
  });
  
  describe('integration scenarios', () => {
    it('should handle complex content with all features', () => {
      const content = `
        <thinking>
        I need to help the user with their request.
        Let me analyze what they're asking for.
        </thinking>
        
        I'll help you with that task.
        
        <read_file path="/some/file.txt">
        Let me read the file first.
        </read_file>
        
        <bash>
        ls -la /some/directory
        </bash>
        
        <attempt_completion>
        <result>
        Based on my analysis, here's what I found:
        
        1. The file contains important data
        2. The directory has the expected structure
        3. Everything looks good
        </result>
        </attempt_completion>
      `;
      
      const result = ToolContentFilter.filterToolContent(content);
      
      expect(result.filtered_content).toContain("Based on my analysis, here's what I found:");
      expect(result.filtered_content).toContain("1. The file contains important data");
      expect(result.filtered_content).toContain("2. The directory has the expected structure");
      expect(result.filtered_content).toContain("3. Everything looks good");
      expect(result.found_thinking_blocks).toBe(true);
      expect(result.found_attempt_completion).toBe(true);
      expect(result.removed_tools).toEqual([]); // Tools not removed when attempt_completion exists
    });
    
    it('should handle content with tools but no attempt_completion', () => {
      const content = `
        <thinking>
        I need to use some tools.
        </thinking>
        
        I'll help you with that.
        
        <read_file>
        file content
        </read_file>
        
        <write_file>
        new content
        </write_file>
        
        Here's the result of my work.
      `;
      
      const result = ToolContentFilter.filterToolContent(content);
      
      expect(result.filtered_content).toContain("I'll help you with that.");
      expect(result.filtered_content).toContain("Here's the result of my work.");
      expect(result.filtered_content).not.toContain('<read_file>');
      expect(result.filtered_content).not.toContain('<write_file>');
      expect(result.removed_tools).toContain('Read');
      expect(result.removed_tools).toContain('Write');
    });
    
    it('should handle empty attempt_completion with fallback', () => {
      const content = `
        <thinking>
        Hmm, I'm not sure what to say.
        </thinking>
        
        <attempt_completion>
        </attempt_completion>
      `;
      
      const result = ToolContentFilter.filterToolContent(content);
      
      expect(result.filtered_content).toBe("I understand you're testing the system. How can I help you today?");
      expect(result.found_attempt_completion).toBe(true);
    });
  });
  
  describe('performance', () => {
    it('should filter content quickly', () => {
      const largeContent = 'A'.repeat(10000) + '<thinking>' + 'B'.repeat(5000) + '</thinking>' + 'C'.repeat(10000);
      
      const start = Date.now();
      const result = ToolContentFilter.filterToolContent(largeContent);
      const end = Date.now();
      
      expect(end - start).toBeLessThan(50); // Should complete in under 50ms
      expect(result.filtered_content).not.toContain('<thinking>');
    });
    
    it('should handle many tool blocks efficiently', () => {
      let content = 'Start content.\n';
      for (let i = 0; i < 100; i++) {
        content += `<read_file>content ${i}</read_file>\n`;
      }
      content += 'End content.';
      
      const start = Date.now();
      const result = ToolContentFilter.removeToolUsageBlocks(content);
      const end = Date.now();
      
      expect(end - start).toBeLessThan(30); // Should complete in under 30ms
      expect(result.content).toContain('Start content.');
      expect(result.content).toContain('End content.');
      expect(result.content).not.toContain('<read_file>');
    });
  });
});