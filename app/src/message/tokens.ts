/**
 * Token Estimation System
 * Based on Python message_adapter.py:111-117 (estimate_tokens method)
 * Provides rough token count estimation using character-based calculation
 */

import { getLogger } from '../utils/logger';

const logger = getLogger('TokenEstimator');

/**
 * Token usage interface matching OpenAI format
 */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Token estimation statistics for debugging
 */
export interface TokenEstimationStats {
  textLength: number;
  estimatedTokens: number;
  charactersPerToken: number;
  estimationMethod: 'character-based' | 'word-based' | 'hybrid';
}

/**
 * TokenEstimator class for estimating token counts
 * Based on Python MessageAdapter.estimate_tokens method
 */
export class TokenEstimator {
  /**
   * Characters per token ratio matching Python implementation
   * Based on OpenAI's rule of thumb: ~4 characters per token for English text
   */
  private static readonly CHARS_PER_TOKEN = 4;
  
  /**
   * Rough estimation of token count
   * Based on Python estimate_tokens method (lines 112-117)
   * OpenAI's rule of thumb: ~4 characters per token for English text
   * 
   * @param text Text to estimate tokens for
   * @returns Estimated token count
   */
  static estimateTokens(text: string): number {
    if (!text) {
      return 0;
    }
    
    // Use the same formula as Python: len(text) // 4
    const estimatedTokens = Math.floor(text.length / this.CHARS_PER_TOKEN);
    
    logger.debug('Estimated tokens for text', {
      textLength: text.length,
      estimatedTokens,
      charactersPerToken: this.CHARS_PER_TOKEN
    });
    
    return estimatedTokens;
  }
  
  /**
   * Calculate token usage for prompt and completion
   * 
   * @param prompt Input prompt text
   * @param completion Response completion text
   * @returns Token usage breakdown
   */
  static calculateUsage(prompt: string, completion: string): TokenUsage {
    const prompt_tokens = this.estimateTokens(prompt);
    const completion_tokens = this.estimateTokens(completion);
    const total_tokens = prompt_tokens + completion_tokens;
    
    logger.debug('Calculated token usage', {
      prompt_tokens,
      completion_tokens,
      total_tokens
    });
    
    return {
      prompt_tokens,
      completion_tokens,
      total_tokens
    };
  }
  
  /**
   * Estimate tokens for an array of messages
   * 
   * @param messages Array of message objects with content
   * @returns Total estimated tokens across all messages
   */
  static estimateMessagesTokens(messages: Array<{ content: string }>): number {
    let totalTokens = 0;
    
    for (const message of messages) {
      totalTokens += this.estimateTokens(message.content);
    }
    
    logger.debug('Estimated tokens for message array', {
      messageCount: messages.length,
      totalTokens
    });
    
    return totalTokens;
  }
  
  /**
   * Get detailed token estimation statistics
   * 
   * @param text Text to analyze
   * @returns Detailed estimation statistics
   */
  static getEstimationStats(text: string): TokenEstimationStats {
    const textLength = text.length;
    const estimatedTokens = this.estimateTokens(text);
    const charactersPerToken = estimatedTokens > 0 ? textLength / estimatedTokens : 0;
    
    return {
      textLength,
      estimatedTokens,
      charactersPerToken,
      estimationMethod: 'character-based'
    };
  }
  
  /**
   * More accurate token estimation using word-based calculation
   * This provides a slightly more accurate estimate for longer texts
   * 
   * @param text Text to estimate tokens for
   * @returns Estimated token count using word-based method
   */
  static estimateTokensWordBased(text: string): number {
    if (!text) {
      return 0;
    }
    
    // Split by whitespace and punctuation to get word-like tokens
    const words = text.trim().split(/\s+/);
    const wordCount = words.length;
    
    // Rough estimation: 1.3 tokens per word (accounting for punctuation and subwords)
    const estimatedTokens = Math.ceil(wordCount * 1.3);
    
    logger.debug('Word-based token estimation', {
      wordCount,
      estimatedTokens,
      tokensPerWord: 1.3
    });
    
    return estimatedTokens;
  }
  
  /**
   * Hybrid token estimation combining character and word-based methods
   * Uses the higher of the two estimates for better accuracy
   * 
   * @param text Text to estimate tokens for
   * @returns Estimated token count using hybrid method
   */
  static estimateTokensHybrid(text: string): number {
    if (!text) {
      return 0;
    }
    
    const characterBased = this.estimateTokens(text);
    const wordBased = this.estimateTokensWordBased(text);
    
    // Use the higher estimate for better accuracy
    const hybridEstimate = Math.max(characterBased, wordBased);
    
    logger.debug('Hybrid token estimation', {
      characterBased,
      wordBased,
      hybridEstimate
    });
    
    return hybridEstimate;
  }
  
  /**
   * Calculate estimated cost for token usage
   * Note: This is a rough estimate and actual costs may vary
   * 
   * @param usage Token usage object
   * @param costPerToken Cost per token in USD (default: rough estimate)
   * @returns Estimated cost in USD
   */
  static estimateCost(usage: TokenUsage, costPerToken: number = 0.000002): number {
    const estimatedCost = usage.total_tokens * costPerToken;
    
    logger.debug('Estimated token cost', {
      totalTokens: usage.total_tokens,
      costPerToken,
      estimatedCost
    });
    
    return estimatedCost;
  }
  
  /**
   * Validate token count against limits
   * 
   * @param tokenCount Number of tokens to validate
   * @param maxTokens Maximum allowed tokens
   * @returns True if within limits, false otherwise
   */
  static validateTokenLimit(tokenCount: number, maxTokens: number): boolean {
    const isValid = tokenCount <= maxTokens;
    
    if (!isValid) {
      logger.warn('Token limit exceeded', {
        tokenCount,
        maxTokens,
        excess: tokenCount - maxTokens
      });
    }
    
    return isValid;
  }
}
