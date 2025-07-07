/**
 * Claude Intent Parser - Extracts tool usage intentions from Claude's natural language
 * Single Responsibility: Parse Claude responses for actionable intentions
 * 
 * Based on OpenAI Tools API Implementation Plan
 */

import { getLogger } from '../../utils/logger';

const logger = getLogger('claude-intent-parser');

/**
 * Parsed intention from Claude's response
 */
export interface ToolIntent {
  /** The action Claude wants to perform */
  action: string;
  
  /** Extracted parameters for the action */
  parameters: Record<string, any>;
  
  /** Confidence level of the parsing (0-1) */
  confidence: number;
  
  /** Type of tool operation intended */
  operationType: 'read' | 'write' | 'search' | 'execute' | 'analyze' | 'unknown';
  
  /** Original text segment that indicated the intention */
  triggerText: string;
}

/**
 * Intent parsing patterns for different tool operations
 */
interface IntentPattern {
  /** Regex pattern to match */
  pattern: RegExp;
  
  /** Type of operation this pattern indicates */
  operationType: ToolIntent['operationType'];
  
  /** Base confidence for this pattern type */
  confidence: number;
  
  /** Function to extract parameters from the match */
  extractParams: (match: RegExpMatchArray, fullText: string) => Record<string, any>;
}

/**
 * Claude Intent Parser - Analyzes Claude responses for tool usage indicators
 * 
 * Architecture:
 * - SRP: Single responsibility for parsing Claude's natural language intentions
 * - OCP: Extensible pattern system for new intention types
 * - Performance: Efficient regex-based parsing with short-circuit evaluation
 */
export class ClaudeIntentParser {
  private readonly patterns: IntentPattern[];

  constructor() {
    this.patterns = this.initializePatterns();
  }

  /**
   * Parse Claude's response for tool usage intentions
   * 
   * @param claudeResponse - Claude's natural language response
   * @returns Parsed tool intention or null if no clear intention found
   */
  parseIntent(claudeResponse: string): ToolIntent {
    const response = claudeResponse.trim();
    
    // Try to match against known patterns
    for (const intentPattern of this.patterns) {
      const match = response.match(intentPattern.pattern);
      
      if (match) {
        try {
          const parameters = intentPattern.extractParams(match, response);
          const triggerText = match[0];
          
          const intent: ToolIntent = {
            action: this.extractAction(triggerText),
            parameters,
            confidence: this.calculateConfidence(intentPattern, match, response),
            operationType: intentPattern.operationType,
            triggerText,
          };

          logger.debug('Intent parsed successfully', { 
            pattern: intentPattern.pattern.source,
            operationType: intent.operationType,
            confidence: intent.confidence 
          });

          return intent;
        } catch (error) {
          logger.warn('Parameter extraction failed', { 
            error, 
            pattern: intentPattern.pattern.source 
          });
          continue;
        }
      }
    }

    // Return default "unknown" intent for responses without clear tool indicators
    return {
      action: 'provide_information',
      parameters: {},
      confidence: 0.1,
      operationType: 'unknown',
      triggerText: response.substring(0, 50) + (response.length > 50 ? '...' : ''),
    };
  }

  /**
   * Initialize the pattern matching system
   */
  private initializePatterns(): IntentPattern[] {
    return [
      // File reading patterns
      {
        pattern: /(?:I'll|I will|Let me|I need to|I'll need to)\s+(?:read|check|look at|examine|open)\s+(?:the\s+)?(?:file|document)\s+["`']?([^"`'\s,\.]+)["`']?/i,
        operationType: 'read',
        confidence: 0.9,
        extractParams: (match) => ({ path: match[1] }),
      },
      {
        pattern: /(?:read|check|examine|look at)\s+(?:the\s+)?(?:contents?\s+of\s+)?["`']?([^"`'\s,\.]+)["`']?/i,
        operationType: 'read',
        confidence: 0.8,
        extractParams: (match) => ({ path: match[1] }),
      },

      // File writing patterns
      {
        pattern: /(?:I'll|I will|Let me|I need to)\s+(?:write|create|save|update|modify)\s+(?:the\s+)?(?:file|document)\s+["`']?([^"`'\s,\.]+)["`']?/i,
        operationType: 'write',
        confidence: 0.9,
        extractParams: (match) => ({ path: match[1] }),
      },
      {
        pattern: /(?:write|create|save|update)\s+(?:to\s+)?["`']?([^"`'\s,\.]+)["`']?/i,
        operationType: 'write',
        confidence: 0.7,
        extractParams: (match) => ({ path: match[1] }),
      },

      // Search patterns
      {
        pattern: /(?:I'll|I will|Let me|I need to)\s+(?:search|find|look for|grep)\s+(?:for\s+)?["`']?([^"`']+?)["`']?(?:\s+in\s+["`']?([^"`'\s,\.]+)["`']?)?/i,
        operationType: 'search',
        confidence: 0.8,
        extractParams: (match) => ({ 
          query: match[1], 
          path: match[2] || '.' 
        }),
      },
      {
        pattern: /(?:search|find|grep|look for)\s+["`']?([^"`']+?)["`']?(?:\s+in\s+["`']?([^"`'\s,\.]+)["`']?)?/i,
        operationType: 'search',
        confidence: 0.7,
        extractParams: (match) => ({ 
          query: match[1], 
          path: match[2] || '.' 
        }),
      },

      // Command execution patterns
      {
        pattern: /(?:I'll|I will|Let me|I need to)\s+(?:run|execute|call)\s+["`']?([^"`']+)["`']?/i,
        operationType: 'execute',
        confidence: 0.9,
        extractParams: (match) => ({ command: match[1] }),
      },
      {
        pattern: /(?:run|execute)\s+["`']?([^"`']+)["`']?/i,
        operationType: 'execute',
        confidence: 0.8,
        extractParams: (match) => ({ command: match[1] }),
      },

      // Analysis patterns
      {
        pattern: /(?:I'll|I will|Let me|I need to)\s+(?:analyze|examine|inspect|review)\s+(?:the\s+)?["`']?([^"`'\s,\.]+)["`']?/i,
        operationType: 'analyze',
        confidence: 0.8,
        extractParams: (match) => ({ target: match[1] }),
      },
      {
        pattern: /(?:analyze|examine|inspect|review)\s+["`']?([^"`'\s,\.]+)["`']?/i,
        operationType: 'analyze',
        confidence: 0.7,
        extractParams: (match) => ({ target: match[1] }),
      },

      // List/directory patterns
      {
        pattern: /(?:I'll|I will|Let me|I need to)\s+(?:list|show|display)\s+(?:the\s+)?(?:files|contents|directory|folder)(?:\s+in\s+["`']?([^"`'\s,\.]*)["`']?)?/i,
        operationType: 'read',
        confidence: 0.8,
        extractParams: (match) => ({ path: match[1] || '.', operation: 'list' }),
      },
      {
        pattern: /(?:list|show|display)\s+(?:files|contents|directory)(?:\s+in\s+["`']?([^"`'\s,\.]*)["`']?)?/i,
        operationType: 'read',
        confidence: 0.7,
        extractParams: (match) => ({ path: match[1] || '.', operation: 'list' }),
      },
    ];
  }

  /**
   * Extract the main action from the trigger text
   */
  private extractAction(triggerText: string): string {
    // Extract the main verb/action from the trigger text
    const actionMatch = triggerText.match(/(?:I'll|I will|Let me|I need to)\s+(\w+)|^(\w+)/i);
    if (actionMatch) {
      return (actionMatch[1] || actionMatch[2]).toLowerCase();
    }
    return 'perform_action';
  }

  /**
   * Calculate confidence based on pattern strength and context
   */
  private calculateConfidence(
    pattern: IntentPattern,
    match: RegExpMatchArray,
    fullResponse: string
  ): number {
    let confidence = pattern.confidence;

    // Boost confidence for stronger language patterns
    if (/(?:I'll|I will|Let me|I need to)/i.test(match[0])) {
      confidence += 0.1;
    }

    // Boost confidence for specific file extensions
    if (/\.(js|ts|json|md|txt|py|java|cpp|c|html|css|xml|yaml|yml)$/i.test(match[0])) {
      confidence += 0.05;
    }

    // Boost confidence for quoted parameters
    if (/["`'][^"`']+["`']/i.test(match[0])) {
      confidence += 0.05;
    }

    // Reduce confidence if the response is very short (might be conversational)
    if (fullResponse.length < 50) {
      confidence -= 0.2;
    }

    // Reduce confidence if this looks like a question rather than a statement
    if (/\?/.test(match[0])) {
      confidence -= 0.3;
    }

    return Math.max(0, Math.min(1, confidence));
  }
}