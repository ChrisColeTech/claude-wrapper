/**
 * Tool Call Detector - Detects when Claude responses indicate tool usage
 * Single Responsibility: Analyze Claude responses for tool usage patterns
 * 
 * Based on OpenAI Tools API Implementation Plan
 */

import { OpenAITool, OpenAIToolCall } from '../types';
import { ClaudeIntentParser, ToolIntent } from './claude-intent-parser';
import { ToolMapper } from './tool-mapper';
import { getLogger } from '../../utils/logger';

const logger = getLogger('tool-call-detector');

/**
 * Result of tool call detection analysis
 */
export interface ToolCallDetection {
  /** Whether Claude's response indicates tool usage is needed */
  needsTools: boolean;
  
  /** Generated OpenAI-compliant tool calls */
  toolCalls: OpenAIToolCall[];
  
  /** Claude's reasoning for tool usage (for debugging) */
  reasoning: string;
  
  /** Original Claude response that triggered detection */
  originalResponse: string;
}

/**
 * Configuration for tool call detection
 */
export interface ToolCallDetectorConfig {
  /** Maximum number of tool calls to generate per response */
  maxToolCalls?: number;
  
  /** Whether to enable debug logging */
  debug?: boolean;
  
  /** Minimum confidence threshold for tool detection (0-1) */
  confidenceThreshold?: number;
}

/**
 * Tool Call Detector - Analyzes Claude responses for tool usage indicators
 * 
 * Architecture:
 * - SRP: Single responsibility for detecting tool usage from Claude responses
 * - DIP: Depends on interfaces for intent parsing and tool mapping
 * - OCP: Extensible for new detection patterns without modifying core logic
 */
export class ToolCallDetector {
  private readonly intentParser: ClaudeIntentParser;
  private readonly toolMapper: ToolMapper;
  private readonly config: Required<ToolCallDetectorConfig>;

  constructor(
    config: ToolCallDetectorConfig = {},
    intentParser?: ClaudeIntentParser,
    toolMapper?: ToolMapper
  ) {
    this.config = {
      maxToolCalls: config.maxToolCalls ?? 5,
      debug: config.debug ?? false,
      confidenceThreshold: config.confidenceThreshold ?? 0.7,
    };

    this.intentParser = intentParser ?? new ClaudeIntentParser();
    this.toolMapper = toolMapper ?? new ToolMapper();

    if (this.config.debug) {
      logger.debug('ToolCallDetector initialized', { config: this.config });
    }
  }

  /**
   * Detect tool calls from Claude's response
   * 
   * @param claudeResponse - Claude's natural language response
   * @param availableTools - Tools that the client has provided
   * @returns Tool call detection result
   */
  detectToolCalls(
    claudeResponse: string,
    availableTools: OpenAITool[]
  ): ToolCallDetection {
    try {
      // Parse Claude's response for tool usage intent
      const intent = this.intentParser.parseIntent(claudeResponse);

      if (this.config.debug) {
        logger.debug('Parsed Claude intent', { 
          intent, 
          responseLength: claudeResponse.length 
        });
      }

      // Check if confidence meets threshold
      if (intent.confidence < this.config.confidenceThreshold) {
        return {
          needsTools: false,
          toolCalls: [],
          reasoning: `Low confidence (${intent.confidence}) below threshold (${this.config.confidenceThreshold})`,
          originalResponse: claudeResponse,
        };
      }

      // Map intentions to available tools
      const toolCalls = this.toolMapper.mapToAvailableTools(
        intent,
        availableTools,
        this.config.maxToolCalls
      );

      const needsTools = toolCalls.length > 0;

      if (this.config.debug) {
        logger.debug('Tool call detection result', {
          needsTools,
          toolCallCount: toolCalls.length,
          intent: intent.action,
        });
      }

      return {
        needsTools,
        toolCalls,
        reasoning: this.buildReasoning(intent, toolCalls),
        originalResponse: claudeResponse,
      };

    } catch (error) {
      logger.error('Tool call detection failed', { error, responseLength: claudeResponse.length });
      
      return {
        needsTools: false,
        toolCalls: [],
        reasoning: `Detection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        originalResponse: claudeResponse,
      };
    }
  }

  /**
   * Check if a response explicitly indicates no tool usage needed
   * 
   * @param claudeResponse - Claude's response to analyze
   * @returns True if Claude explicitly indicates no tools needed
   */
  isExplicitNoToolsResponse(claudeResponse: string): boolean {
    const noToolsPatterns = [
      /I (?:can|will) answer (?:this|that) directly/i,
      /No (?:tools|functions) (?:are )?(?:needed|required)/i,
      /I (?:don't|do not) need to (?:use|call) any (?:tools|functions)/i,
      /This (?:can|should) be answered without (?:tools|functions)/i,
    ];

    return noToolsPatterns.some(pattern => pattern.test(claudeResponse));
  }

  /**
   * Get detection statistics for monitoring
   */
  getDetectionStats(): {
    maxToolCalls: number;
    confidenceThreshold: number;
    debugEnabled: boolean;
  } {
    return {
      maxToolCalls: this.config.maxToolCalls,
      confidenceThreshold: this.config.confidenceThreshold,
      debugEnabled: this.config.debug,
    };
  }

  /**
   * Build human-readable reasoning for the detection result
   */
  private buildReasoning(intent: ToolIntent, toolCalls: OpenAIToolCall[]): string {
    if (toolCalls.length === 0) {
      return `Claude indicated "${intent.action}" but no matching tools found`;
    }

    const toolNames = toolCalls.map(call => call.function.name);
    return `Claude wants to "${intent.action}" using tools: ${toolNames.join(', ')} (confidence: ${intent.confidence})`;
  }
}

/**
 * Default tool call detector instance
 */
export const toolCallDetector = new ToolCallDetector();