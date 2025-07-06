/**
 * Claude Message Parser
 * SRP: Handles only Claude message parsing and content extraction
 * Based on CLAUDE_SDK_REFERENCE.md ClaudeMessageProcessor patterns
 */

import { ClaudeCodeMessage } from '../claude/client';
import { IMessageParser, IContentFilter } from './interfaces';
import { ContentFilterResult } from './interfaces';
import { 
  CONTENT_FILTER_PATTERNS,
  DEFAULT_FALLBACK_CONTENT,
  MESSAGE_PERFORMANCE
} from './constants';
import { 
  MessageParsingError,
  ContentFilteringError,
  ConversionTimeoutError,
  handleMessageConversionCall 
} from './errors';
import { getLogger } from '../utils/logger';

const logger = getLogger('MessageParser');

/**
 * Claude message parser
 * SRP: Single responsibility for parsing Claude messages
 * Max file size: <200 lines, functions <50 lines
 */
export class MessageParser implements IMessageParser {

  /**
   * Parse Claude SDK messages to extract content
   */
  async parseClaudeMessages(messages: ClaudeCodeMessage[]): Promise<string> {
    return handleMessageConversionCall(async () => {
      const startTime = Date.now();
      
      // Check timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new ConversionTimeoutError(
            MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS,
            'Claude message parsing'
          ));
        }, MESSAGE_PERFORMANCE.CONVERSION_TIMEOUT_MS);
      });
      
      // Perform parsing
      const parsingPromise = this.performParsing(messages);
      
      const result = await Promise.race([parsingPromise, timeoutPromise]);
      
      const processingTime = Date.now() - startTime;
      logger.debug('Claude message parsing completed', {
        messageCount: messages.length,
        processingTimeMs: processingTime,
        contentLength: result.length
      });
      
      return result;
    }, 'Claude message parsing');
  }

  /**
   * Extract content from Claude messages
   */
  extractContent(messages: ClaudeCodeMessage[]): string {
    if (!messages || messages.length === 0) {
      throw new MessageParsingError('Messages array cannot be empty');
    }

    // Find assistant messages first
    const assistantMessages = messages.filter(m => m.type === 'assistant');
    if (assistantMessages.length > 0) {
      const content = this.extractMessageContent(assistantMessages[0]);
      if (content) {
        return content;
      }
    }

    // Fall back to any message with content
    for (const message of messages) {
      const content = this.extractMessageContent(message);
      if (content) {
        return content;
      }
    }

    throw new MessageParsingError('No content found in any message');
  }

  /**
   * Check if messages represent complete response
   */
  isCompleteResponse(messages: ClaudeCodeMessage[]): boolean {
    if (!messages || messages.length === 0) {
      return false;
    }

    // Check for result message indicating completion
    const hasResult = messages.some(m => 
      m.type === 'result' && 
      (m.subtype === 'success' || m.subtype === 'error')
    );

    if (hasResult) {
      return true;
    }

    // Check for assistant message with content
    const hasAssistantContent = messages.some(m => 
      m.type === 'assistant' && 
      this.extractMessageContent(m)
    );

    return hasAssistantContent;
  }

  /**
   * Perform the parsing operation
   */
  private async performParsing(messages: ClaudeCodeMessage[]): Promise<string> {
    const rawContent = this.extractContent(messages);
    
    // Apply content filtering
    const contentFilter = new ContentFilter();
    const filterResult = await contentFilter.filter(rawContent);
    
    return filterResult.content;
  }

  /**
   * Extract content from a single message
   */
  private extractMessageContent(message: ClaudeCodeMessage): string | null {
    // Check direct content property
    if (message.content) {
      return this.parseContentValue(message.content);
    }

    // Check message object (message is string type, not object)
    if (message.message && typeof message.message === 'string') {
      return message.message;
    }

    // Check data object
    if (message.data?.content) {
      return this.parseContentValue(message.data.content);
    }

    return null;
  }

  /**
   * Parse content value handling different formats
   */
  private parseContentValue(content: any): string | null {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map(block => {
          if (typeof block === 'string') {
            return block;
          }
          if (block.text) {
            return block.text;
          }
          return String(block);
        })
        .join('');
    }

    if (content && typeof content === 'object' && content.text) {
      return content.text;
    }

    return null;
  }
}

/**
 * Content filter implementation
 * SRP: Single responsibility for content filtering
 */
export class ContentFilter implements IContentFilter {

  /**
   * Filter content based on patterns
   */
  async filter(content: string): Promise<ContentFilterResult> {
    return handleMessageConversionCall(async () => {
      const startTime = Date.now();
      const originalContent = content;
      const filtersApplied: string[] = [];
      
      if (!content) {
        return {
          content: DEFAULT_FALLBACK_CONTENT.EMPTY_RESPONSE,
          wasFiltered: true,
          filtersApplied: ['empty_content_fallback'],
          processingTimeMs: Date.now() - startTime
        };
      }

      let filteredContent = content;

      // Remove thinking blocks
      const beforeThinking = filteredContent;
      filteredContent = this.removeThinkingBlocks(filteredContent);
      if (filteredContent !== beforeThinking) {
        filtersApplied.push('thinking_blocks');
      }

      // Extract attempt completion content
      const attemptContent = this.extractAttemptCompletion(filteredContent);
      if (attemptContent) {
        filteredContent = attemptContent;
        filtersApplied.push('attempt_completion_extraction');
      } else {
        // Remove tool usage if no attempt completion found
        const beforeToolRemoval = filteredContent;
        filteredContent = this.removeToolUsage(filteredContent);
        if (filteredContent !== beforeToolRemoval) {
          filtersApplied.push('tool_usage_removal');
        }
      }

      // Remove image references
      const beforeImageFilter = filteredContent;
      filteredContent = filteredContent.replace(
        CONTENT_FILTER_PATTERNS.IMAGE_REFERENCES,
        '[Image: Content not supported by Claude Code]'
      );
      if (filteredContent !== beforeImageFilter) {
        filtersApplied.push('image_filtering');
      }

      // Clean up whitespace
      filteredContent = filteredContent.replace(CONTENT_FILTER_PATTERNS.MULTIPLE_NEWLINES, '\n\n');
      filteredContent = filteredContent.trim();

      // Fallback for empty content
      if (!filteredContent || /^\s*$/.test(filteredContent)) {
        filteredContent = DEFAULT_FALLBACK_CONTENT.EMPTY_RESPONSE;
        filtersApplied.push('empty_result_fallback');
      }

      const processingTime = Date.now() - startTime;
      logger.debug('Content filtering completed', {
        originalLength: originalContent.length,
        filteredLength: filteredContent.length,
        filtersApplied,
        processingTimeMs: processingTime
      });

      return {
        content: filteredContent,
        wasFiltered: originalContent !== filteredContent,
        filtersApplied,
        processingTimeMs: processingTime
      };
    }, 'Content filtering');
  }

  /**
   * Remove thinking blocks
   */
  removeThinkingBlocks(content: string): string {
    // Handle nested thinking blocks by finding outermost blocks
    let result = content;
    let startIndex = 0;
    
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const thinkingStart = result.indexOf('<thinking>', startIndex);
      if (thinkingStart === -1) break;
      
      // Find the matching closing tag for this opening tag
      let depth = 1;
      let pos = thinkingStart + '<thinking>'.length;
      
      while (pos < result.length && depth > 0) {
        const nextOpen = result.indexOf('<thinking>', pos);
        const nextClose = result.indexOf('</thinking>', pos);
        
        if (nextClose === -1) {
          // Unclosed tag - leave it as is and move on
          startIndex = thinkingStart + 1;
          break;
        }
        
        if (nextOpen !== -1 && nextOpen < nextClose) {
          // Found another opening tag before closing
          depth++;
          pos = nextOpen + '<thinking>'.length;
        } else {
          // Found closing tag
          depth--;
          pos = nextClose + '</thinking>'.length;
        }
      }
      
      if (depth === 0) {
        // Found matching closing tag - remove the entire block
        result = result.slice(0, thinkingStart) + result.slice(pos);
        startIndex = thinkingStart;
      } else {
        // Unclosed tag - leave it and continue searching
        startIndex = thinkingStart + 1;
      }
    }
    
    return result;
  }

  /**
   * Remove tool usage patterns
   */
  removeToolUsage(content: string): string {
    let filtered = content;
    
    for (const pattern of CONTENT_FILTER_PATTERNS.TOOL_USAGE) {
      filtered = filtered.replace(pattern, '');
    }
    
    return filtered;
  }

  /**
   * Extract attempt completion content
   */
  extractAttemptCompletion(content: string): string | null {
    const matches = Array.from(content.matchAll(CONTENT_FILTER_PATTERNS.ATTEMPT_COMPLETION));
    
    if (matches.length === 0) {
      return null;
    }

    let extractedContent = matches[0][1].trim();

    // Check for nested result blocks
    const resultMatches = Array.from(extractedContent.matchAll(CONTENT_FILTER_PATTERNS.RESULT_BLOCKS));
    if (resultMatches.length > 0) {
      extractedContent = resultMatches[0][1].trim();
    }

    return extractedContent || null;
  }
}

/**
 * Factory for creating message parsers
 */
export class MessageParserFactory {
  
  /**
   * Create a message parser instance
   */
  static create(): IMessageParser {
    return new MessageParser();
  }

  /**
   * Create content filter instance
   */
  static createContentFilter(): IContentFilter {
    return new ContentFilter();
  }
}

/**
 * Global message parser instance
 */
export const messageParser = MessageParserFactory.create();

/**
 * Global content filter instance
 */
export const contentFilter = MessageParserFactory.createContentFilter();