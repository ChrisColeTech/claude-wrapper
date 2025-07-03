/**
 * Content Filtering System
 * Based on Python message_adapter.py:36-99 (filter_content method)
 * Filters content for unsupported features and tool usage
 */

import { getLogger } from '../utils/logger';

const logger = getLogger('ContentFilter');

/**
 * Content filtering configuration
 */
export interface FilterConfig {
  removeThinkingBlocks?: boolean;
  removeToolUsage?: boolean;
  removeImageReferences?: boolean;
  handleEmptyContent?: boolean;
}

/**
 * Default filter configuration matching Python behavior
 */
const DEFAULT_FILTER_CONFIG: Required<FilterConfig> = {
  removeThinkingBlocks: true,
  removeToolUsage: true,
  removeImageReferences: true,
  handleEmptyContent: true
};

/**
 * ContentFilter class for filtering unsupported content
 * Based on Python MessageAdapter.filter_content method
 */
export class ContentFilter {
  /**
   * Filter content for unsupported features and tool usage
   * Based on Python filter_content method (lines 37-99)
   * 
   * @param content Content to filter
   * @param config Filter configuration options
   * @returns Filtered content
   */
  static filterContent(content: string, config: FilterConfig = {}): string {
    if (!content) {
      return content;
    }
    
    const filterConfig = { ...DEFAULT_FILTER_CONFIG, ...config };
    let filteredContent = content;
    
    logger.debug('Starting content filtering', {
      originalLength: content.length,
      config: filterConfig
    });
    
    // Remove thinking blocks (common when tools are disabled but Claude tries to think)
    if (filterConfig.removeThinkingBlocks) {
      filteredContent = this.filterThinkingBlocks(filteredContent);
    }
    
    // Extract content from attempt_completion blocks (these contain the actual user response)
    // This follows Python logic: if attempt_completion exists, use it; otherwise, remove tool blocks
    const attemptCompletionPattern = /<attempt_completion>(.*?)<\/attempt_completion>/gs;
    const attemptMatches = filteredContent.match(attemptCompletionPattern);
    
    if (attemptMatches) {
      // Use the content from the attempt_completion block (Python lines 53-63)
      let extractedContent = attemptMatches[0]
        .replace(/<attempt_completion>/g, '')
        .replace(/<\/attempt_completion>/g, '')
        .trim();
      
      // If there's a <result> tag inside, extract from that
      const resultPattern = /<result>(.*?)<\/result>/gs;
      const resultMatches = extractedContent.match(resultPattern);
      
      if (resultMatches) {
        extractedContent = resultMatches[0]
          .replace(/<result>/g, '')
          .replace(/<\/result>/g, '')
          .trim();
      }
      
      if (extractedContent) {
        filteredContent = extractedContent;
      } else {
        // If attempt_completion exists but is empty, remove the tags and keep rest of content
        filteredContent = filteredContent.replace(attemptCompletionPattern, '');
      }
    } else {
      // Remove other tool usage blocks (when tools are disabled but Claude tries to use them)
      // This only happens if NO attempt_completion was found (Python lines 65-81)
      if (filterConfig.removeToolUsage) {
        filteredContent = this.filterToolUsage(filteredContent);
      }
    }
    
    // Filter image references
    if (filterConfig.removeImageReferences) {
      filteredContent = this.filterImageReferences(filteredContent);
    }
    
    // Clean up extra whitespace and newlines
    filteredContent = this.cleanupWhitespace(filteredContent);
    
    // Handle empty content
    if (filterConfig.handleEmptyContent && this.isEffectivelyEmpty(filteredContent)) {
      filteredContent = "I understand you're testing the system. How can I help you today?";
    }
    
    logger.debug('Content filtering completed', {
      originalLength: content.length,
      filteredLength: filteredContent.length,
      wasModified: content !== filteredContent
    });
    
    return filteredContent;
  }
  
  /**
   * Remove thinking blocks from content
   * Based on Python thinking_pattern removal (lines 45-47)
   * Handles nested thinking blocks by using a stack-based approach
   * 
   * @param content Content to process
   * @returns Content with thinking blocks removed
   */
  static filterThinkingBlocks(content: string): string {
    let result = '';
    let depth = 0;
    let i = 0;
    
    while (i < content.length) {
      // Check for opening tag
      if (content.slice(i, i + 10) === '<thinking>') {
        depth++;
        i += 10;
        continue;
      }
      
      // Check for closing tag
      if (content.slice(i, i + 11) === '</thinking>') {
        depth--;
        i += 11;
        continue;
      }
      
      // If we're not inside a thinking block, add the character
      if (depth === 0) {
        result += content[i];
      }
      
      i++;
    }
    
    return result;
  }
  
  /**
   * Extract content from attempt_completion blocks
   * Based on Python attempt_completion_pattern logic (lines 49-64)
   * 
   * @param content Content to process
   * @returns Extracted content or original if no attempt_completion found
   */
  static extractAttemptCompletion(content: string): string {
    const attemptCompletionPattern = /<attempt_completion>(.*?)<\/attempt_completion>/gs;
    const attemptMatches = content.match(attemptCompletionPattern);
    
    if (attemptMatches) {
      // Use the content from the attempt_completion block
      let extractedContent = attemptMatches[0]
        .replace(/<attempt_completion>/g, '')
        .replace(/<\/attempt_completion>/g, '')
        .trim();
      
      // If there's a <result> tag inside, extract from that
      const resultPattern = /<result>(.*?)<\/result>/gs;
      const resultMatches = extractedContent.match(resultPattern);
      
      if (resultMatches) {
        extractedContent = resultMatches[0]
          .replace(/<result>/g, '')
          .replace(/<\/result>/g, '')
          .trim();
      }
      
      if (extractedContent) {
        return extractedContent;
      }
    }
    
    return content;
  }
  
  /**
   * Remove tool usage blocks from content
   * Based on Python tool_patterns removal (lines 66-81)
   * 
   * @param content Content to process
   * @returns Content with tool usage blocks removed
   */
  static filterToolUsage(content: string): string {
    const toolPatterns = [
      /<read_file>.*?<\/read_file>/gs,
      /<write_file>.*?<\/write_file>/gs,
      /<bash>.*?<\/bash>/gs,
      /<search_files>.*?<\/search_files>/gs,
      /<str_replace_editor>.*?<\/str_replace_editor>/gs,
      /<args>.*?<\/args>/gs,
      /<ask_followup_question>.*?<\/ask_followup_question>/gs,
      /<attempt_completion>.*?<\/attempt_completion>/gs,
      /<question>.*?<\/question>/gs,
      /<follow_up>.*?<\/follow_up>/gs,
      /<suggest>.*?<\/suggest>/gs
    ];
    
    let filteredContent = content;
    
    for (const pattern of toolPatterns) {
      filteredContent = filteredContent.replace(pattern, '');
    }
    
    return filteredContent;
  }
  
  /**
   * Filter image references and base64 data
   * Based on Python image_pattern replacement (lines 83-89)
   * 
   * @param content Content to process
   * @returns Content with image references replaced
   */
  static filterImageReferences(content: string): string {
    // Pattern to match image references or base64 data
    const imagePattern = /\[Image:.*?\]|data:image\/.*?;base64,.*?(?=\s|$)/g;
    
    return content.replace(imagePattern, () => {
      return "[Image: Content not supported by Claude Code]";
    });
  }
  
  /**
   * Clean up extra whitespace and newlines
   * Based on Python whitespace cleanup (lines 91-93)
   * 
   * @param content Content to clean
   * @returns Cleaned content
   */
  static cleanupWhitespace(content: string): string {
    // Multiple newlines to double
    let cleaned = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    // Trim leading and trailing whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
  }
  
  /**
   * Check if content is effectively empty
   * Based on Python empty content check (lines 95-97)
   * 
   * @param content Content to check
   * @returns True if content is empty or only whitespace
   */
  static isEffectivelyEmpty(content: string): boolean {
    return !content || content.trim().length === 0;
  }
  
  /**
   * Get filter statistics for debugging
   * 
   * @param original Original content
   * @param filtered Filtered content
   * @returns Statistics about filtering applied
   */
  static getFilterStats(original: string, filtered: string): {
    originalLength: number;
    filteredLength: number;
    charactersRemoved: number;
    percentageReduced: number;
    wasModified: boolean;
  } {
    const originalLength = original.length;
    const filteredLength = filtered.length;
    const charactersRemoved = originalLength - filteredLength;
    const percentageReduced = originalLength > 0 ? (charactersRemoved / originalLength) * 100 : 0;
    
    return {
      originalLength,
      filteredLength,
      charactersRemoved,
      percentageReduced,
      wasModified: original !== filtered
    };
  }
}
