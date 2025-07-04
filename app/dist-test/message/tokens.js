"use strict";
/**
 * Token Estimation System
 * Based on Python message_adapter.py:111-117 (estimate_tokens method)
 * Provides rough token count estimation using character-based calculation
 */
exports.__esModule = true;
exports.TokenEstimator = void 0;
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.getLogger)('TokenEstimator');
/**
 * TokenEstimator class for estimating token counts
 * Based on Python MessageAdapter.estimate_tokens method
 */
var TokenEstimator = /** @class */ (function () {
    function TokenEstimator() {
    }
    /**
     * Rough estimation of token count
     * Based on Python estimate_tokens method (lines 112-117)
     * OpenAI's rule of thumb: ~4 characters per token for English text
     *
     * @param text Text to estimate tokens for
     * @returns Estimated token count
     */
    TokenEstimator.estimateTokens = function (text) {
        if (!text) {
            return 0;
        }
        // Use the same formula as Python: len(text) // 4
        var estimatedTokens = Math.floor(text.length / this.CHARS_PER_TOKEN);
        logger.debug('Estimated tokens for text', {
            textLength: text.length,
            estimatedTokens: estimatedTokens,
            charactersPerToken: this.CHARS_PER_TOKEN
        });
        return estimatedTokens;
    };
    /**
     * Calculate token usage for prompt and completion
     *
     * @param prompt Input prompt text
     * @param completion Response completion text
     * @returns Token usage breakdown
     */
    TokenEstimator.calculateUsage = function (prompt, completion) {
        var prompt_tokens = this.estimateTokens(prompt);
        var completion_tokens = this.estimateTokens(completion);
        var total_tokens = prompt_tokens + completion_tokens;
        logger.debug('Calculated token usage', {
            prompt_tokens: prompt_tokens,
            completion_tokens: completion_tokens,
            total_tokens: total_tokens
        });
        return {
            prompt_tokens: prompt_tokens,
            completion_tokens: completion_tokens,
            total_tokens: total_tokens
        };
    };
    /**
     * Estimate tokens for an array of messages
     *
     * @param messages Array of message objects with content
     * @returns Total estimated tokens across all messages
     */
    TokenEstimator.estimateMessagesTokens = function (messages) {
        var totalTokens = 0;
        for (var _i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
            var message = messages_1[_i];
            totalTokens += this.estimateTokens(message.content);
        }
        logger.debug('Estimated tokens for message array', {
            messageCount: messages.length,
            totalTokens: totalTokens
        });
        return totalTokens;
    };
    /**
     * Get detailed token estimation statistics
     *
     * @param text Text to analyze
     * @returns Detailed estimation statistics
     */
    TokenEstimator.getEstimationStats = function (text) {
        var textLength = text.length;
        var estimatedTokens = this.estimateTokens(text);
        var charactersPerToken = estimatedTokens > 0 ? textLength / estimatedTokens : 0;
        return {
            textLength: textLength,
            estimatedTokens: estimatedTokens,
            charactersPerToken: charactersPerToken,
            estimationMethod: 'character-based'
        };
    };
    /**
     * More accurate token estimation using word-based calculation
     * This provides a slightly more accurate estimate for longer texts
     *
     * @param text Text to estimate tokens for
     * @returns Estimated token count using word-based method
     */
    TokenEstimator.estimateTokensWordBased = function (text) {
        if (!text) {
            return 0;
        }
        // Split by whitespace and punctuation to get word-like tokens
        var words = text.trim().split(/\s+/);
        var wordCount = words.length;
        // Rough estimation: 1.3 tokens per word (accounting for punctuation and subwords)
        var estimatedTokens = Math.ceil(wordCount * 1.3);
        logger.debug('Word-based token estimation', {
            wordCount: wordCount,
            estimatedTokens: estimatedTokens,
            tokensPerWord: 1.3
        });
        return estimatedTokens;
    };
    /**
     * Hybrid token estimation combining character and word-based methods
     * Uses the higher of the two estimates for better accuracy
     *
     * @param text Text to estimate tokens for
     * @returns Estimated token count using hybrid method
     */
    TokenEstimator.estimateTokensHybrid = function (text) {
        if (!text) {
            return 0;
        }
        var characterBased = this.estimateTokens(text);
        var wordBased = this.estimateTokensWordBased(text);
        // Use the higher estimate for better accuracy
        var hybridEstimate = Math.max(characterBased, wordBased);
        logger.debug('Hybrid token estimation', {
            characterBased: characterBased,
            wordBased: wordBased,
            hybridEstimate: hybridEstimate
        });
        return hybridEstimate;
    };
    /**
     * Calculate estimated cost for token usage
     * Note: This is a rough estimate and actual costs may vary
     *
     * @param usage Token usage object
     * @param costPerToken Cost per token in USD (default: rough estimate)
     * @returns Estimated cost in USD
     */
    TokenEstimator.estimateCost = function (usage, costPerToken) {
        if (costPerToken === void 0) { costPerToken = 0.000002; }
        var estimatedCost = usage.total_tokens * costPerToken;
        logger.debug('Estimated token cost', {
            totalTokens: usage.total_tokens,
            costPerToken: costPerToken,
            estimatedCost: estimatedCost
        });
        return estimatedCost;
    };
    /**
     * Validate token count against limits
     *
     * @param tokenCount Number of tokens to validate
     * @param maxTokens Maximum allowed tokens
     * @returns True if within limits, false otherwise
     */
    TokenEstimator.validateTokenLimit = function (tokenCount, maxTokens) {
        var isValid = tokenCount <= maxTokens;
        if (!isValid) {
            logger.warn('Token limit exceeded', {
                tokenCount: tokenCount,
                maxTokens: maxTokens,
                excess: tokenCount - maxTokens
            });
        }
        return isValid;
    };
    /**
     * Characters per token ratio matching Python implementation
     * Based on OpenAI's rule of thumb: ~4 characters per token for English text
     */
    TokenEstimator.CHARS_PER_TOKEN = 4;
    return TokenEstimator;
}());
exports.TokenEstimator = TokenEstimator;
