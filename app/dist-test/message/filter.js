"use strict";
/**
 * Content Filtering System
 * Based on Python message_adapter.py:36-99 (filter_content method)
 * Filters content for unsupported features and tool usage
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
exports.ContentFilter = void 0;
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('ContentFilter');
/**
 * Default filter configuration matching Python behavior
 */
var DEFAULT_FILTER_CONFIG = {
    removeThinkingBlocks: true,
    removeToolUsage: true,
    removeImageReferences: true,
    handleEmptyContent: true
};
/**
 * ContentFilter class for filtering unsupported content
 * Based on Python MessageAdapter.filter_content method
 */
var ContentFilter = /** @class */ (function () {
    function ContentFilter() {
    }
    /**
     * Filter content for unsupported features and tool usage
     * Based on Python filter_content method (lines 37-99)
     *
     * @param content Content to filter
     * @param config Filter configuration options
     * @returns Filtered content
     */
    ContentFilter.filterContent = function (content, config) {
        if (config === void 0) { config = {}; }
        if (!content) {
            return content;
        }
        var filterConfig = __assign(__assign({}, DEFAULT_FILTER_CONFIG), config);
        var filteredContent = content;
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
        var attemptCompletionPattern = /<attempt_completion>(.*?)<\/attempt_completion>/gs;
        var attemptMatches = filteredContent.match(attemptCompletionPattern);
        if (attemptMatches) {
            // Use the content from the attempt_completion block (Python lines 53-63)
            var extractedContent = attemptMatches[0]
                .replace(/<attempt_completion>/g, '')
                .replace(/<\/attempt_completion>/g, '')
                .trim();
            // If there's a <result> tag inside, extract from that
            var resultPattern = /<result>(.*?)<\/result>/gs;
            var resultMatches = extractedContent.match(resultPattern);
            if (resultMatches) {
                extractedContent = resultMatches[0]
                    .replace(/<result>/g, '')
                    .replace(/<\/result>/g, '')
                    .trim();
            }
            if (extractedContent) {
                filteredContent = extractedContent;
            }
            else {
                // If attempt_completion exists but is empty, remove the tags and keep rest of content
                filteredContent = filteredContent.replace(attemptCompletionPattern, '');
            }
        }
        else {
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
    };
    /**
     * Remove thinking blocks from content
     * Based on Python thinking_pattern removal (lines 45-47)
     * Handles nested thinking blocks by using a stack-based approach
     *
     * @param content Content to process
     * @returns Content with thinking blocks removed
     */
    ContentFilter.filterThinkingBlocks = function (content) {
        var result = '';
        var depth = 0;
        var i = 0;
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
    };
    /**
     * Extract content from attempt_completion blocks
     * Based on Python attempt_completion_pattern logic (lines 49-64)
     *
     * @param content Content to process
     * @returns Extracted content or original if no attempt_completion found
     */
    ContentFilter.extractAttemptCompletion = function (content) {
        var attemptCompletionPattern = /<attempt_completion>(.*?)<\/attempt_completion>/gs;
        var attemptMatches = content.match(attemptCompletionPattern);
        if (attemptMatches) {
            // Use the content from the attempt_completion block
            var extractedContent = attemptMatches[0]
                .replace(/<attempt_completion>/g, '')
                .replace(/<\/attempt_completion>/g, '')
                .trim();
            // If there's a <result> tag inside, extract from that
            var resultPattern = /<result>(.*?)<\/result>/gs;
            var resultMatches = extractedContent.match(resultPattern);
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
    };
    /**
     * Remove tool usage blocks from content
     * Based on Python tool_patterns removal (lines 66-81)
     *
     * @param content Content to process
     * @returns Content with tool usage blocks removed
     */
    ContentFilter.filterToolUsage = function (content) {
        var toolPatterns = [
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
        var filteredContent = content;
        for (var _i = 0, toolPatterns_1 = toolPatterns; _i < toolPatterns_1.length; _i++) {
            var pattern = toolPatterns_1[_i];
            filteredContent = filteredContent.replace(pattern, '');
        }
        return filteredContent;
    };
    /**
     * Filter image references and base64 data
     * Based on Python image_pattern replacement (lines 83-89)
     *
     * @param content Content to process
     * @returns Content with image references replaced
     */
    ContentFilter.filterImageReferences = function (content) {
        // Pattern to match image references or base64 data
        var imagePattern = /\[Image:.*?\]|data:image\/.*?;base64,.*?(?=\s|$)/g;
        return content.replace(imagePattern, function () {
            return "[Image: Content not supported by Claude Code]";
        });
    };
    /**
     * Clean up extra whitespace and newlines
     * Based on Python whitespace cleanup (lines 91-93)
     *
     * @param content Content to clean
     * @returns Cleaned content
     */
    ContentFilter.cleanupWhitespace = function (content) {
        // Multiple newlines to double
        var cleaned = content.replace(/\n\s*\n\s*\n/g, '\n\n');
        // Trim leading and trailing whitespace
        cleaned = cleaned.trim();
        return cleaned;
    };
    /**
     * Check if content is effectively empty
     * Based on Python empty content check (lines 95-97)
     *
     * @param content Content to check
     * @returns True if content is empty or only whitespace
     */
    ContentFilter.isEffectivelyEmpty = function (content) {
        return !content || content.trim().length === 0;
    };
    /**
     * Get filter statistics for debugging
     *
     * @param original Original content
     * @param filtered Filtered content
     * @returns Statistics about filtering applied
     */
    ContentFilter.getFilterStats = function (original, filtered) {
        var originalLength = original.length;
        var filteredLength = filtered.length;
        var charactersRemoved = originalLength - filteredLength;
        var percentageReduced = originalLength > 0 ? (charactersRemoved / originalLength) * 100 : 0;
        return {
            originalLength: originalLength,
            filteredLength: filteredLength,
            charactersRemoved: charactersRemoved,
            percentageReduced: percentageReduced,
            wasModified: original !== filtered
        };
    };
    return ContentFilter;
}());
exports.ContentFilter = ContentFilter;
