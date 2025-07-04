"use strict";
/**
 * Tool Content Filtering System
 * Based on Python message_adapter.py content filtering for tools
 * Phase 7A Implementation: Complete tool content filtering and extraction
 */
exports.__esModule = true;
exports.ToolContentFilter = void 0;
var constants_1 = require("./constants");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('ToolContentFilter');
/**
 * Tool Content Filter - Complete implementation for Phase 7A
 * Based on Python message_adapter.py tool content filtering logic
 */
var ToolContentFilter = /** @class */ (function () {
    function ToolContentFilter() {
    }
    /**
     * Filter tool-related content from responses
     * Based on Python content filtering logic - integrates with message filter
     */
    ToolContentFilter.filterToolContent = function (content, config) {
        if (config === void 0) { config = {}; }
        if (!content) {
            return {
                filtered_content: content,
                removed_tools: [],
                found_attempt_completion: false,
                found_thinking_blocks: false,
                original_length: 0,
                filtered_length: 0
            };
        }
        var originalLength = content.length;
        var filteredContent = content;
        var removedTools = [];
        logger.debug('Starting tool content filtering', {
            originalLength: originalLength,
            config: config
        });
        // Step 1: Remove thinking blocks if configured
        var hadThinking = /<thinking>/.test(filteredContent);
        if (config.removeThinkingBlocks !== false) {
            filteredContent = this.removeThinkingBlocks(filteredContent);
        }
        // Step 2: Check for attempt_completion blocks
        var hasAttemptCompletion = /<attempt_completion>/.test(filteredContent);
        if (hasAttemptCompletion && config.extractAttemptCompletion !== false) {
            // Extract from attempt_completion - this takes precedence over tool filtering
            filteredContent = this.extractAttemptCompletion(filteredContent);
        }
        else if (config.removeToolUsage !== false || !config.tools_enabled) {
            // Remove tool usage blocks only if no attempt_completion found
            var toolRemovalResult = this.removeToolUsageBlocks(filteredContent);
            filteredContent = toolRemovalResult.content;
            removedTools.push.apply(removedTools, toolRemovalResult.removed_tools);
        }
        // Step 3: Clean up whitespace
        filteredContent = this.cleanupWhitespace(filteredContent);
        var result = {
            filtered_content: filteredContent,
            removed_tools: removedTools,
            found_attempt_completion: hasAttemptCompletion,
            found_thinking_blocks: hadThinking,
            original_length: originalLength,
            filtered_length: filteredContent.length
        };
        logger.debug('Tool content filtering complete', result);
        return result;
    };
    /**
     * Remove tool usage blocks from content
     * Based on Python tool_patterns removal logic
     */
    ToolContentFilter.removeToolUsageBlocks = function (content) {
        var removedTools = [];
        var processedContent = content;
        // Define all Claude Code tool patterns
        var toolPatterns = [
            { pattern: /<read_file[^>]*>.*?<\/read_file>/gs, tool: 'Read' },
            { pattern: /<write_file[^>]*>.*?<\/write_file>/gs, tool: 'Write' },
            { pattern: /<edit_file[^>]*>.*?<\/edit_file>/gs, tool: 'Edit' },
            { pattern: /<multi_edit[^>]*>.*?<\/multi_edit>/gs, tool: 'MultiEdit' },
            { pattern: /<bash[^>]*>.*?<\/bash>/gs, tool: 'Bash' },
            { pattern: /<search_files[^>]*>.*?<\/search_files>/gs, tool: 'Glob' },
            { pattern: /<grep[^>]*>.*?<\/grep>/gs, tool: 'Grep' },
            { pattern: /<list_files[^>]*>.*?<\/list_files>/gs, tool: 'LS' },
            { pattern: /<ls[^>]*>.*?<\/ls>/gs, tool: 'LS' },
            { pattern: /<notebook_read[^>]*>.*?<\/notebook_read>/gs, tool: 'NotebookRead' },
            { pattern: /<notebook_edit[^>]*>.*?<\/notebook_edit>/gs, tool: 'NotebookEdit' },
            { pattern: /<web_fetch[^>]*>.*?<\/web_fetch>/gs, tool: 'WebFetch' },
            { pattern: /<todo_read[^>]*>.*?<\/todo_read>/gs, tool: 'TodoRead' },
            { pattern: /<todo_write[^>]*>.*?<\/todo_write>/gs, tool: 'TodoWrite' },
            { pattern: /<web_search[^>]*>.*?<\/web_search>/gs, tool: 'WebSearch' },
            { pattern: /<task[^>]*>.*?<\/task>/gs, tool: 'Task' },
            { pattern: /<exit_plan_mode[^>]*>.*?<\/exit_plan_mode>/gs, tool: 'exit_plan_mode' },
            // Generic patterns for any unrecognized tool blocks
            { pattern: /<str_replace_editor[^>]*>.*?<\/str_replace_editor>/gs, tool: 'str_replace_editor' },
            { pattern: /<args[^>]*>.*?<\/args>/gs, tool: 'args' },
            { pattern: /<ask_followup_question[^>]*>.*?<\/ask_followup_question>/gs, tool: 'ask_followup_question' },
            { pattern: /<question[^>]*>.*?<\/question>/gs, tool: 'question' },
            { pattern: /<follow_up[^>]*>.*?<\/follow_up>/gs, tool: 'follow_up' },
            { pattern: /<suggest[^>]*>.*?<\/suggest>/gs, tool: 'suggest' }
        ];
        for (var _i = 0, toolPatterns_1 = toolPatterns; _i < toolPatterns_1.length; _i++) {
            var _a = toolPatterns_1[_i], pattern = _a.pattern, tool = _a.tool;
            var matches = processedContent.match(pattern);
            if (matches && matches.length > 0) {
                processedContent = processedContent.replace(pattern, '');
                if (!removedTools.includes(tool)) {
                    removedTools.push(tool);
                }
            }
        }
        return {
            content: processedContent,
            removed_tools: removedTools
        };
    };
    /**
     * Extract content from attempt_completion blocks
     * Based on Python attempt_completion extraction logic
     */
    ToolContentFilter.extractAttemptCompletion = function (content) {
        var attemptCompletionPattern = /<attempt_completion[^>]*>(.*?)<\/attempt_completion>/gs;
        var matches = content.match(attemptCompletionPattern);
        if (!matches || matches.length === 0) {
            return content;
        }
        // Use the first attempt_completion block (should only be one)
        var extractedContent = matches[0]
            .replace(/<attempt_completion[^>]*>/g, '')
            .replace(/<\/attempt_completion>/g, '')
            .trim();
        // Check for nested result tags
        var resultPattern = /<result[^>]*>(.*?)<\/result>/gs;
        var resultMatches = extractedContent.match(resultPattern);
        if (resultMatches && resultMatches.length > 0) {
            // Extract from result tag if present
            extractedContent = resultMatches[0]
                .replace(/<result[^>]*>/g, '')
                .replace(/<\/result>/g, '')
                .trim();
        }
        // If extraction resulted in empty content, return fallback message
        if (!extractedContent) {
            return "I understand you're testing the system. How can I help you today?";
        }
        return extractedContent;
    };
    /**
     * Remove thinking blocks from content
     * Based on Python thinking block removal logic
     */
    ToolContentFilter.removeThinkingBlocks = function (content) {
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
     * Clean up extra whitespace and newlines
     * Based on Python whitespace cleanup logic
     */
    ToolContentFilter.cleanupWhitespace = function (content) {
        // Multiple newlines to double newlines
        var cleaned = content.replace(/\n\s*\n\s*\n+/g, '\n\n');
        // Clean up excessive internal whitespace (preserve single spaces and intentional formatting)
        cleaned = cleaned.replace(/[ \t]+/g, ' ');
        // Trim leading and trailing whitespace
        cleaned = cleaned.trim();
        return cleaned;
    };
    /**
     * Check if content contains tool usage
     */
    ToolContentFilter.containsToolUsage = function (content) {
        var _a;
        var foundTools = [];
        // Check for each tool type
        var toolChecks = [
            { pattern: /<(read_file|write_file|edit_file|multi_edit|bash|search_files|grep|list_files|ls|notebook_read|notebook_edit|web_fetch|todo_read|todo_write|web_search|task|exit_plan_mode)[^>]*>/g, tools: constants_1.CLAUDE_CODE_TOOLS },
            { pattern: /<(str_replace_editor|args|ask_followup_question|question|follow_up|suggest)[^>]*>/g, tools: ['legacy'] }
        ];
        for (var _i = 0, toolChecks_1 = toolChecks; _i < toolChecks_1.length; _i++) {
            var pattern = toolChecks_1[_i].pattern;
            var matches = content.match(pattern);
            if (matches) {
                for (var _b = 0, matches_1 = matches; _b < matches_1.length; _b++) {
                    var match = matches_1[_b];
                    var toolName = (_a = match.match(/<(\w+)/)) === null || _a === void 0 ? void 0 : _a[1];
                    if (toolName && !foundTools.includes(toolName)) {
                        foundTools.push(toolName);
                    }
                }
            }
        }
        return {
            has_tools: foundTools.length > 0,
            found_tools: foundTools,
            tool_count: foundTools.length
        };
    };
    /**
     * Get filtering statistics for debugging
     */
    ToolContentFilter.getFilterStats = function (original, filtered) {
        var originalLength = original.length;
        var filteredLength = filtered.length;
        var charactersRemoved = originalLength - filteredLength;
        var percentageReduced = originalLength > 0 ? (charactersRemoved / originalLength) * 100 : 0;
        return {
            original_length: originalLength,
            filtered_length: filteredLength,
            characters_removed: charactersRemoved,
            percentage_reduced: percentageReduced,
            was_modified: original !== filtered
        };
    };
    return ToolContentFilter;
}());
exports.ToolContentFilter = ToolContentFilter;
