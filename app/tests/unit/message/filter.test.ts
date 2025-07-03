/**
 * Unit tests for Content Filter
 * Tests src/message/filter.ts components
 * Based on Python message_adapter.py:36-99 validation patterns
 */

import { 
  ContentFilter,
  FilterConfig
} from '../../../src/message/filter';

// Mock logger to avoid console output during tests
jest.mock('../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('ContentFilter', () => {
  describe('filterContent', () => {
    describe('Basic filtering functionality', () => {
      it('should return content unchanged when no filtering needed', () => {
        const content = "This is clean content with no special blocks.";
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe(content);
      });

      it('should handle empty content', () => {
        const content = "";
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe("");
      });

      it('should handle null/undefined content', () => {
        expect(ContentFilter.filterContent(null as any)).toBeNull();
        expect(ContentFilter.filterContent(undefined as any)).toBeUndefined();
      });

      it('should provide fallback for effectively empty content', () => {
        const content = "   \n  \t  ";
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe("I understand you're testing the system. How can I help you today?");
      });
    });

    describe('Thinking block removal', () => {
      it('should remove thinking blocks', () => {
        const content = "Here is my response. <thinking>This is internal thought</thinking> And here is more content.";
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe("Here is my response.  And here is more content.");
        expect(result).not.toContain("<thinking>");
        expect(result).not.toContain("internal thought");
      });

      it('should remove multiple thinking blocks', () => {
        const content = `
          <thinking>First thought</thinking>
          Some content here.
          <thinking>Second thought with
          multiple lines</thinking>
          More content.
        `;
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).not.toContain("<thinking>");
        expect(result).not.toContain("First thought");
        expect(result).not.toContain("Second thought");
        expect(result).toContain("Some content here.");
        expect(result).toContain("More content.");
      });

      it('should handle nested thinking blocks', () => {
        const content = "Content <thinking>Outer <thinking>inner</thinking> thought</thinking> more content";
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe("Content  more content");
      });

      it('should handle thinking blocks with special characters', () => {
        const content = `Content <thinking>Thinking with "quotes", <tags>, & symbols</thinking> more`;
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe("Content  more");
      });
    });

    describe('Attempt completion extraction', () => {
      it('should extract content from attempt_completion blocks', () => {
        const content = `
          Some preamble.
          <attempt_completion>
          This is the actual response that should be extracted.
          </attempt_completion>
          Some trailing content that should be ignored.
        `;
        
        const result = ContentFilter.filterContent(content);
        
        expect(result.trim()).toBe("This is the actual response that should be extracted.");
      });

      it('should extract content from result tags within attempt_completion', () => {
        const content = `
          <attempt_completion>
          Some wrapper content.
          <result>
          This is the final result that should be extracted.
          </result>
          More wrapper content.
          </attempt_completion>
        `;
        
        const result = ContentFilter.filterContent(content);
        
        expect(result.trim()).toBe("This is the final result that should be extracted.");
      });

      it('should handle multiple attempt_completion blocks (use first)', () => {
        const content = `
          <attempt_completion>First completion</attempt_completion>
          <attempt_completion>Second completion</attempt_completion>
        `;
        
        const result = ContentFilter.filterContent(content);
        
        expect(result.trim()).toBe("First completion");
      });

      it('should fall back to original content if attempt_completion is empty', () => {
        const content = "Regular content <attempt_completion></attempt_completion> more content";
        
        const result = ContentFilter.filterContent(content);
        
        // Should fall through to tool usage filtering
        expect(result).toContain("Regular content");
        expect(result).toContain("more content");
      });
    });

    describe('Tool usage filtering', () => {
      it('should remove read_file blocks', () => {
        const content = "Before <read_file>file.txt</read_file> After";
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe("Before  After");
      });

      it('should remove write_file blocks', () => {
        const content = "Before <write_file>content</write_file> After";
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe("Before  After");
      });

      it('should remove bash blocks', () => {
        const content = "Before <bash>ls -la</bash> After";
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe("Before  After");
      });

      it('should remove search_files blocks', () => {
        const content = "Before <search_files>pattern</search_files> After";
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe("Before  After");
      });

      it('should remove str_replace_editor blocks', () => {
        const content = "Before <str_replace_editor>edit</str_replace_editor> After";
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe("Before  After");
      });

      it('should remove args blocks', () => {
        const content = "Before <args>arguments</args> After";
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe("Before  After");
      });

      it('should remove ask_followup_question blocks', () => {
        const content = "Before <ask_followup_question>question</ask_followup_question> After";
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe("Before  After");
      });

      it('should remove question blocks', () => {
        const content = "Before <question>What is this?</question> After";
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe("Before  After");
      });

      it('should remove follow_up blocks', () => {
        const content = "Before <follow_up>follow up</follow_up> After";
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe("Before  After");
      });

      it('should remove suggest blocks', () => {
        const content = "Before <suggest>suggestion</suggest> After";
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe("Before  After");
      });

      it('should remove multiple different tool blocks', () => {
        const content = `
          Content before
          <read_file>file.txt</read_file>
          Middle content
          <bash>command</bash>
          <write_file>output</write_file>
          Content after
        `;
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).not.toContain("<read_file>");
        expect(result).not.toContain("<bash>");
        expect(result).not.toContain("<write_file>");
        expect(result).toContain("Content before");
        expect(result).toContain("Middle content");
        expect(result).toContain("Content after");
      });

      it('should handle tool blocks with multiline content', () => {
        const content = `
          Before
          <bash>
          echo "Hello"
          ls -la
          cd /home
          </bash>
          After
        `;
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).not.toContain("<bash>");
        expect(result).not.toContain("echo");
        expect(result).toContain("Before");
        expect(result).toContain("After");
      });
    });

    describe('Image reference filtering', () => {
      it('should replace image references with placeholder', () => {
        const content = "Look at this image: [Image: screenshot.png] It shows the result.";
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe("Look at this image: [Image: Content not supported by Claude Code] It shows the result.");
      });

      it('should replace base64 image data with placeholder', () => {
        const content = "Here's the image: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA... and more text.";
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe("Here's the image: [Image: Content not supported by Claude Code] and more text.");
      });

      it('should handle multiple image references', () => {
        const content = `
          First image: [Image: pic1.jpg]
          Text between images.
          Second image: data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA
          More text.
          Third image: [Image: another.png]
        `;
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toContain("[Image: Content not supported by Claude Code]");
        expect(result).not.toContain("pic1.jpg");
        expect(result).not.toContain("base64");
        expect(result).not.toContain("another.png");
        expect(result).toContain("Text between images.");
        expect(result).toContain("More text.");
      });

      it('should handle different image formats', () => {
        const content = `
          PNG: data:image/png;base64,abc123
          JPEG: data:image/jpeg;base64,def456
          GIF: data:image/gif;base64,ghi789
        `;
        
        const result = ContentFilter.filterContent(content);
        
        const placeholderCount = (result.match(/\[Image: Content not supported by Claude Code\]/g) || []).length;
        expect(placeholderCount).toBe(3);
      });
    });

    describe('Whitespace cleanup', () => {
      it('should clean up multiple consecutive newlines', () => {
        const content = "Line 1\n\n\n\nLine 2\n\n\n\n\nLine 3";
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe("Line 1\n\nLine 2\n\nLine 3");
      });

      it('should trim leading and trailing whitespace', () => {
        const content = "   \n  Content with leading/trailing whitespace  \n   ";
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe("Content with leading/trailing whitespace");
      });

      it('should preserve internal spacing', () => {
        const content = "Word1   Word2\tWord3  Word4";
        
        const result = ContentFilter.filterContent(content);
        
        expect(result).toBe("Word1   Word2\tWord3  Word4");
      });
    });

    describe('Filter configuration options', () => {
      it('should respect removeThinkingBlocks config', () => {
        const content = "Content <thinking>thought</thinking> more";
        const config: FilterConfig = { removeThinkingBlocks: false };
        
        const result = ContentFilter.filterContent(content, config);
        
        expect(result).toContain("<thinking>thought</thinking>");
      });

      it('should respect removeToolUsage config', () => {
        const content = "Content <bash>command</bash> more";
        const config: FilterConfig = { removeToolUsage: false };
        
        const result = ContentFilter.filterContent(content, config);
        
        expect(result).toContain("<bash>command</bash>");
      });

      it('should respect removeImageReferences config', () => {
        const content = "Content [Image: test.png] more";
        const config: FilterConfig = { removeImageReferences: false };
        
        const result = ContentFilter.filterContent(content, config);
        
        expect(result).toContain("[Image: test.png]");
      });

      it('should respect handleEmptyContent config', () => {
        const content = "   ";
        const config: FilterConfig = { handleEmptyContent: false };
        
        const result = ContentFilter.filterContent(content, config);
        
        expect(result).toBe("");
      });

      it('should allow partial config overrides', () => {
        const content = "Content <thinking>thought</thinking> <bash>cmd</bash> more";
        const config: FilterConfig = { removeThinkingBlocks: false };
        
        const result = ContentFilter.filterContent(content, config);
        
        expect(result).toContain("<thinking>thought</thinking>");
        expect(result).not.toContain("<bash>cmd</bash>");
      });
    });
  });

  describe('Individual filter methods', () => {
    describe('filterThinkingBlocks', () => {
      it('should remove thinking blocks', () => {
        const content = "Before <thinking>internal thought</thinking> After";
        
        const result = ContentFilter.filterThinkingBlocks(content);
        
        expect(result).toBe("Before  After");
      });

      it('should handle multiple thinking blocks', () => {
        const content = "<thinking>First</thinking> Middle <thinking>Second</thinking>";
        
        const result = ContentFilter.filterThinkingBlocks(content);
        
        expect(result).toBe(" Middle ");
      });
    });

    describe('extractAttemptCompletion', () => {
      it('should extract simple attempt completion', () => {
        const content = "<attempt_completion>Extracted content</attempt_completion>";
        
        const result = ContentFilter.extractAttemptCompletion(content);
        
        expect(result).toBe("Extracted content");
      });

      it('should extract result from within attempt completion', () => {
        const content = "<attempt_completion>Wrapper <result>Inner result</result> More wrapper</attempt_completion>";
        
        const result = ContentFilter.extractAttemptCompletion(content);
        
        expect(result).toBe("Inner result");
      });

      it('should return original if no attempt completion found', () => {
        const content = "Regular content without attempt completion";
        
        const result = ContentFilter.extractAttemptCompletion(content);
        
        expect(result).toBe(content);
      });
    });

    describe('filterToolUsage', () => {
      it('should remove all tool patterns', () => {
        const content = `
          <read_file>file</read_file>
          <write_file>content</write_file>
          <bash>command</bash>
          Regular content
        `;
        
        const result = ContentFilter.filterToolUsage(content);
        
        expect(result).not.toContain("<read_file>");
        expect(result).not.toContain("<write_file>");
        expect(result).not.toContain("<bash>");
        expect(result).toContain("Regular content");
      });
    });

    describe('filterImageReferences', () => {
      it('should replace image references', () => {
        const content = "Image: [Image: test.png] and data:image/png;base64,abc123";
        
        const result = ContentFilter.filterImageReferences(content);
        
        expect(result).toBe("Image: [Image: Content not supported by Claude Code] and [Image: Content not supported by Claude Code]");
      });
    });

    describe('cleanupWhitespace', () => {
      it('should normalize multiple newlines', () => {
        const content = "Line 1\n\n\n\nLine 2";
        
        const result = ContentFilter.cleanupWhitespace(content);
        
        expect(result).toBe("Line 1\n\nLine 2");
      });

      it('should trim whitespace', () => {
        const content = "  Content  ";
        
        const result = ContentFilter.cleanupWhitespace(content);
        
        expect(result).toBe("Content");
      });
    });

    describe('isEffectivelyEmpty', () => {
      it('should detect empty strings', () => {
        expect(ContentFilter.isEffectivelyEmpty("")).toBe(true);
        expect(ContentFilter.isEffectivelyEmpty("   ")).toBe(true);
        expect(ContentFilter.isEffectivelyEmpty("\n\t  ")).toBe(true);
      });

      it('should detect non-empty strings', () => {
        expect(ContentFilter.isEffectivelyEmpty("content")).toBe(false);
        expect(ContentFilter.isEffectivelyEmpty(" a ")).toBe(false);
      });
    });

    describe('getFilterStats', () => {
      it('should provide filtering statistics', () => {
        const original = "Original content with <thinking>thought</thinking> blocks";
        const filtered = "Original content with  blocks";
        
        const stats = ContentFilter.getFilterStats(original, filtered);
        
        expect(stats.originalLength).toBe(original.length);
        expect(stats.filteredLength).toBe(filtered.length);
        expect(stats.charactersRemoved).toBe(original.length - filtered.length);
        expect(stats.percentageReduced).toBeGreaterThan(0);
        expect(stats.wasModified).toBe(true);
      });

      it('should handle unchanged content', () => {
        const content = "Unchanged content";
        
        const stats = ContentFilter.getFilterStats(content, content);
        
        expect(stats.charactersRemoved).toBe(0);
        expect(stats.percentageReduced).toBe(0);
        expect(stats.wasModified).toBe(false);
      });
    });
  });

  describe('Complex integration scenarios', () => {
    it('should handle content with all filter types', () => {
      const content = `
        <thinking>I need to process this request</thinking>
        
        Here's the user's question about the image: [Image: screenshot.png]
        
        <bash>
        ls -la
        </bash>
        
        <attempt_completion>
        <result>
        The image shows a file listing. I can see several files in the directory.
        </result>
        </attempt_completion>
        
        <read_file>config.txt</read_file>
        
        Additional analysis: data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ
      `;
      
      const result = ContentFilter.filterContent(content);
      
      expect(result).toBe("The image shows a file listing. I can see several files in the directory.");
      expect(result).not.toContain("<thinking>");
      expect(result).not.toContain("<bash>");
      expect(result).not.toContain("<attempt_completion>");
      expect(result).not.toContain("<read_file>");
      expect(result).not.toContain("[Image: screenshot.png]");
      expect(result).not.toContain("base64");
    });

    it('should handle realistic Claude response with tools disabled', () => {
      const content = `
        <thinking>
        The user is asking about how to create a file. Since tools are disabled,
        I should provide instructions rather than trying to use file operations.
        </thinking>
        
        I'll help you create a file. Since I can't directly manipulate files in this context,
        here are the steps you can follow:
        
        <bash>
        touch newfile.txt
        echo "Hello World" > newfile.txt
        </bash>
        
        <attempt_completion>
        To create a file, you can use these command line steps:
        
        1. Use 'touch filename.txt' to create an empty file
        2. Use 'echo "content" > filename.txt' to create a file with content
        3. Use a text editor like nano, vim, or code to edit the file
        
        These methods will work in most Unix-like systems (Linux, macOS).
        </attempt_completion>
      `;
      
      const result = ContentFilter.filterContent(content);
      
      expect(result).toContain("To create a file, you can use these command line steps:");
      expect(result).toContain("1. Use 'touch filename.txt'");
      expect(result).toContain("Unix-like systems");
      expect(result).not.toContain("<thinking>");
      expect(result).not.toContain("<bash>");
      expect(result).not.toContain("<attempt_completion>");
    });

    it('should preserve code blocks and formatting in final content', () => {
      const content = `
        <attempt_completion>
        Here's how to write a Python function:
        
        \`\`\`python
        def hello_world():
            print("Hello, World!")
        \`\`\`
        
        This function prints a greeting message.
        </attempt_completion>
      `;
      
      const result = ContentFilter.filterContent(content);
      
      expect(result).toContain("```python");
      expect(result).toContain("def hello_world():");
      expect(result).toContain("print(\"Hello, World!\")");
      expect(result).toContain("```");
      expect(result).toContain("This function prints a greeting message.");
    });
  });
});