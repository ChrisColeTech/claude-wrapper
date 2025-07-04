/**
 * Tool call error classification service
 * Single Responsibility: Error type classification only
 * 
 * Classifies errors into specific categories for proper handling:
 * - Validation errors (422)
 * - Timeout errors (408) 
 * - Processing errors (422)
 * - System errors (500)
 */

import { ToolCallErrorType } from '../models/error';
import { OpenAIToolCall } from './types';
import { TOOL_ERROR_LIMITS } from './constants';

/**
 * Error classification request
 */
export interface ErrorClassificationRequest {
  error: Error | unknown;
  toolCall?: OpenAIToolCall;
  context?: Record<string, any>;
}

/**
 * Error classification result
 */
export interface ErrorClassificationResult {
  success: boolean;
  errorType: ToolCallErrorType;
  confidence: number; // 0-1 confidence score
  recoverable: boolean;
  classificationTimeMs: number;
  reasoning?: string;
}

/**
 * Error classification patterns
 */
interface ErrorPattern {
  keywords: string[];
  errorType: ToolCallErrorType;
  recoverable: boolean;
  weight: number;
}

/**
 * Tool error classifier interface
 */
export interface IToolErrorClassifier {
  classifyError(request: ErrorClassificationRequest): ErrorClassificationResult;
  isValidationError(error: Error | unknown): boolean;
  isTimeoutError(error: Error | unknown): boolean;
  isProcessingError(error: Error | unknown): boolean;
  isSystemError(error: Error | unknown): boolean;
  getConfidenceScore(errorType: ToolCallErrorType, error: Error | unknown): number;
}

/**
 * Tool error classifier implementation
 */
export class ToolErrorClassifier implements IToolErrorClassifier {
  private readonly errorPatterns: ErrorPattern[] = [
    // Validation errors
    {
      keywords: ['validation', 'invalid', 'required', 'missing', 'malformed', 'schema'],
      errorType: 'validation',
      recoverable: false,
      weight: 1.0
    },
    
    // Timeout errors
    {
      keywords: ['timeout', 'time', 'expired', 'deadline', 'abort'],
      errorType: 'timeout',
      recoverable: true,
      weight: 1.0
    },
    
    // Format errors
    {
      keywords: ['format', 'parse', 'json', 'syntax', 'structure'],
      errorType: 'format',
      recoverable: false,
      weight: 0.9
    },
    
    // Execution errors
    {
      keywords: ['execution', 'failed', 'error', 'exception', 'runtime'],
      errorType: 'execution',
      recoverable: true,
      weight: 0.8
    },
    
    // System errors
    {
      keywords: ['system', 'internal', 'server', 'fatal', 'critical', 'crash'],
      errorType: 'system',
      recoverable: false,
      weight: 1.0
    },
    
    // Processing errors (fallback)
    {
      keywords: ['processing', 'handle', 'process', 'operation'],
      errorType: 'processing',
      recoverable: true,
      weight: 0.7
    }
  ];

  /**
   * Classify error into specific type with confidence score
   */
  classifyError(request: ErrorClassificationRequest): ErrorClassificationResult {
    const startTime = Date.now();

    try {
      const errorMessage = this.extractErrorMessage(request.error);
      const errorStack = this.extractErrorStack(request.error);
      
      // Analyze error characteristics
      const scores = this.analyzeErrorPatterns(errorMessage, errorStack);
      
      // Find best match
      const bestMatch = this.findBestMatch(scores);
      
      // Calculate confidence
      const confidence = this.calculateConfidence(bestMatch, scores);
      
      // Determine recoverability
      const recoverable = this.determineRecoverability(bestMatch.errorType, request.error);
      
      const classificationTime = Date.now() - startTime;

      return {
        success: true,
        errorType: bestMatch.errorType,
        confidence,
        recoverable,
        classificationTimeMs: classificationTime,
        reasoning: this.generateReasoning(bestMatch, errorMessage)
      };

    } catch (classificationError) {
      const classificationTime = Date.now() - startTime;
      
      return {
        success: false,
        errorType: 'processing', // Safe fallback
        confidence: 0.1,
        recoverable: true,
        classificationTimeMs: classificationTime
      };
    }
  }

  /**
   * Check if error is validation-related
   */
  isValidationError(error: Error | unknown): boolean {
    const message = this.extractErrorMessage(error);
    const validationKeywords = ['validation', 'invalid', 'required', 'missing', 'malformed'];
    return validationKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * Check if error is timeout-related
   */
  isTimeoutError(error: Error | unknown): boolean {
    const message = this.extractErrorMessage(error);
    const timeoutKeywords = ['timeout', 'time', 'expired', 'deadline'];
    return timeoutKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * Check if error is processing-related
   */
  isProcessingError(error: Error | unknown): boolean {
    const message = this.extractErrorMessage(error);
    const processingKeywords = ['processing', 'process', 'handle', 'operation'];
    return processingKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * Check if error is system-related
   */
  isSystemError(error: Error | unknown): boolean {
    const message = this.extractErrorMessage(error);
    const systemKeywords = ['system', 'internal', 'server', 'fatal', 'critical'];
    return systemKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * Get confidence score for error classification
   */
  getConfidenceScore(errorType: ToolCallErrorType, error: Error | unknown): number {
    const message = this.extractErrorMessage(error);
    const pattern = this.errorPatterns.find(p => p.errorType === errorType);
    
    if (!pattern) {
      return 0.1;
    }

    const matches = pattern.keywords.filter(keyword => message.includes(keyword));
    return Math.min(1.0, (matches.length / pattern.keywords.length) * pattern.weight);
  }

  /**
   * Extract error message from error object
   */
  private extractErrorMessage(error: Error | unknown): string {
    if (error instanceof Error) {
      return error.message.toLowerCase();
    }
    return String(error).toLowerCase();
  }

  /**
   * Extract error stack from error object
   */
  private extractErrorStack(error: Error | unknown): string {
    if (error instanceof Error && error.stack) {
      return error.stack.toLowerCase();
    }
    return '';
  }

  /**
   * Analyze error against all patterns
   */
  private analyzeErrorPatterns(message: string, stack: string): Array<{ pattern: ErrorPattern; score: number }> {
    return this.errorPatterns.map(pattern => {
      let score = 0;
      const totalKeywords = pattern.keywords.length;

      // Check keywords in message
      const messageMatches = pattern.keywords.filter(keyword => message.includes(keyword));
      score += (messageMatches.length / totalKeywords) * 0.7; // 70% weight for message

      // Check keywords in stack trace
      if (stack) {
        const stackMatches = pattern.keywords.filter(keyword => stack.includes(keyword));
        score += (stackMatches.length / totalKeywords) * 0.3; // 30% weight for stack
      }

      // Apply pattern weight
      score *= pattern.weight;

      return { pattern, score };
    });
  }

  /**
   * Find best matching pattern
   */
  private findBestMatch(scores: Array<{ pattern: ErrorPattern; score: number }>): ErrorPattern {
    const sorted = scores.sort((a, b) => b.score - a.score);
    return sorted[0]?.pattern || this.errorPatterns[this.errorPatterns.length - 1]; // Default to processing
  }

  /**
   * Calculate confidence based on scores
   */
  private calculateConfidence(bestMatch: ErrorPattern, scores: Array<{ pattern: ErrorPattern; score: number }>): number {
    const bestScore = scores.find(s => s.pattern === bestMatch)?.score || 0;
    
    // Higher confidence if best score is significantly higher than others
    const otherScores = scores.filter(s => s.pattern !== bestMatch).map(s => s.score);
    const maxOtherScore = Math.max(...otherScores, 0);
    
    const scoreDifference = bestScore - maxOtherScore;
    const confidence = Math.min(1.0, Math.max(0.1, bestScore + scoreDifference * 0.5));
    
    return Math.round(confidence * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Determine if error is recoverable
   */
  private determineRecoverability(errorType: ToolCallErrorType, error: Error | unknown): boolean {
    const pattern = this.errorPatterns.find(p => p.errorType === errorType);
    const baseRecoverable = pattern?.recoverable ?? true;

    // Check for non-recoverable indicators in error message
    const message = this.extractErrorMessage(error);
    const nonRecoverableTerms = ['fatal', 'critical', 'permanent', 'corrupt', 'destroyed'];
    const hasNonRecoverableTerms = nonRecoverableTerms.some(term => message.includes(term));

    return baseRecoverable && !hasNonRecoverableTerms;
  }

  /**
   * Generate reasoning for classification
   */
  private generateReasoning(pattern: ErrorPattern, message: string): string {
    const matchedKeywords = pattern.keywords.filter(keyword => message.includes(keyword));
    
    if (matchedKeywords.length === 0) {
      return `Classified as ${pattern.errorType} by default pattern matching`;
    }

    return `Classified as ${pattern.errorType} based on keywords: ${matchedKeywords.join(', ')}`;
  }
}

/**
 * Error classification utilities
 */
export const ErrorClassificationUtils = {
  /**
   * Quick classification for common errors
   */
  quickClassify: (error: Error | unknown): ToolCallErrorType => {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation';
    }
    if (message.includes('timeout')) {
      return 'timeout';
    }
    if (message.includes('format') || message.includes('parse')) {
      return 'format';
    }
    if (message.includes('system') || message.includes('internal')) {
      return 'system';
    }
    if (message.includes('execution') || message.includes('failed')) {
      return 'execution';
    }

    return 'processing';
  },

  /**
   * Check if error type requires immediate attention
   */
  requiresImmediateAttention: (errorType: ToolCallErrorType): boolean => {
    return errorType === 'system' || errorType === 'validation';
  },

  /**
   * Get error severity level
   */
  getSeverityLevel: (errorType: ToolCallErrorType): 'low' | 'medium' | 'high' | 'critical' => {
    const severityMap: Record<ToolCallErrorType, 'low' | 'medium' | 'high' | 'critical'> = {
      'validation': 'medium',
      'timeout': 'low',
      'processing': 'medium',
      'format': 'medium',
      'execution': 'high',
      'system': 'critical'
    };

    return severityMap[errorType] || 'medium';
  },

  /**
   * Check if error should be logged
   */
  shouldLog: (errorType: ToolCallErrorType, confidence: number): boolean => {
    // Always log system errors and high-confidence errors
    return errorType === 'system' || confidence >= 0.8;
  },

  /**
   * Get recommended retry count
   */
  getRecommendedRetryCount: (errorType: ToolCallErrorType): number => {
    const retryMap: Record<ToolCallErrorType, number> = {
      'validation': 0, // Don't retry validation errors
      'timeout': 2,   // Retry timeouts
      'processing': 1, // Retry processing errors once
      'format': 0,    // Don't retry format errors
      'execution': 1, // Retry execution errors once
      'system': 0     // Don't retry system errors
    };

    return retryMap[errorType] || 0;
  }
};

export const toolErrorClassifier = new ToolErrorClassifier();