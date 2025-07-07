/**
 * Conversation Continuity - Manages conversation flow with tool calls and results
 * Single Responsibility: Maintain conversation context through tool usage cycles
 * 
 * Based on OpenAI Tools API Implementation Plan
 */

import { OpenAIToolCall } from '../types';
import { ToolMessage, ToolExecutionResult } from './tool-result-processor';
import { getLogger } from '../../utils/logger';

const logger = getLogger('conversation-continuity');

/**
 * Message in the conversation
 */
export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

/**
 * Tool call state tracking
 */
export interface ToolCallState {
  /** Pending tool calls awaiting results */
  pendingCalls: Map<string, OpenAIToolCall>;
  
  /** Completed tool calls with results */
  completedCalls: Map<string, ToolExecutionResult>;
  
  /** Conversation session ID */
  conversationId: string;
  
  /** Whether we're currently waiting for tool results */
  awaitingResults: boolean;
}

/**
 * Conversation step in a tool usage cycle
 */
export interface ConversationStep {
  /** Step type */
  type: 'user_message' | 'assistant_response' | 'tool_calls' | 'tool_results' | 'assistant_final';
  
  /** Messages for this step */
  messages: ConversationMessage[];
  
  /** Tool calls for this step (if any) */
  toolCalls?: OpenAIToolCall[];
  
  /** Tool results for this step (if any) */
  toolResults?: ToolExecutionResult[];
  
  /** Timestamp of this step */
  timestamp: Date;
}

/**
 * Complete conversation context with tool usage
 */
export interface ConversationContext {
  /** All conversation steps in order */
  steps: ConversationStep[];
  
  /** Current message history for Claude API */
  messages: ConversationMessage[];
  
  /** Current tool call state */
  toolState: ToolCallState;
  
  /** Conversation metadata */
  metadata: {
    conversationId: string;
    startedAt: Date;
    lastUpdated: Date;
    totalSteps: number;
    toolCallCycles: number;
  };
}

/**
 * Configuration for conversation continuity
 */
export interface ConversationContinuityConfig {
  /** Maximum conversation history length */
  maxHistoryLength?: number;
  
  /** Whether to preserve tool call metadata */
  preserveMetadata?: boolean;
  
  /** Whether to enable debug logging */
  debug?: boolean;
}

/**
 * Conversation Continuity Manager - Maintains conversation flow through tool usage
 * 
 * Architecture:
 * - SRP: Single responsibility for conversation flow management
 * - State Management: Tracks tool call states and conversation progress
 * - Immutability: Creates new context objects rather than modifying existing ones
 */
export class ConversationContinuity {
  private readonly config: Required<ConversationContinuityConfig>;

  constructor(config: ConversationContinuityConfig = {}) {
    this.config = {
      maxHistoryLength: config.maxHistoryLength ?? 100,
      preserveMetadata: config.preserveMetadata ?? true,
      debug: config.debug ?? false,
    };

    if (this.config.debug) {
      logger.debug('ConversationContinuity initialized', { config: this.config });
    }
  }

  /**
   * Create a new conversation context
   * 
   * @param conversationId - Unique conversation identifier
   * @param initialMessages - Initial messages to start the conversation
   * @returns New conversation context
   */
  createConversation(
    conversationId: string,
    initialMessages: ConversationMessage[] = []
  ): ConversationContext {
    const now = new Date();

    const context: ConversationContext = {
      steps: [],
      messages: [...initialMessages],
      toolState: {
        pendingCalls: new Map(),
        completedCalls: new Map(),
        conversationId,
        awaitingResults: false
      },
      metadata: {
        conversationId,
        startedAt: now,
        lastUpdated: now,
        totalSteps: 0,
        toolCallCycles: 0
      }
    };

    if (initialMessages.length > 0) {
      this.addStep(context, 'user_message', initialMessages);
    }

    if (this.config.debug) {
      logger.debug('Created new conversation', { 
        conversationId, 
        initialMessageCount: initialMessages.length 
      });
    }

    return context;
  }

  /**
   * Add assistant response with tool calls to conversation
   * 
   * @param context - Current conversation context
   * @param assistantMessage - Assistant's response message
   * @param toolCalls - Tool calls requested by assistant
   * @returns Updated conversation context
   */
  addAssistantWithToolCalls(
    context: ConversationContext,
    assistantMessage: ConversationMessage,
    toolCalls: OpenAIToolCall[]
  ): ConversationContext {
    const newContext = this.cloneContext(context);

    // Add assistant message to conversation
    newContext.messages.push(assistantMessage);

    // Track pending tool calls
    toolCalls.forEach(call => {
      newContext.toolState.pendingCalls.set(call.id, call);
    });

    newContext.toolState.awaitingResults = true;

    // Add conversation step
    this.addStep(newContext, 'tool_calls', [assistantMessage], toolCalls);

    if (this.config.debug) {
      logger.debug('Added assistant response with tool calls', {
        conversationId: context.metadata.conversationId,
        toolCallCount: toolCalls.length
      });
    }

    return newContext;
  }

  /**
   * Add tool results to conversation and prepare for Claude's continuation
   * 
   * @param context - Current conversation context
   * @param toolResults - Results from tool execution
   * @param toolMessages - Formatted tool messages for conversation
   * @returns Updated conversation context
   */
  addToolResults(
    context: ConversationContext,
    toolResults: ToolExecutionResult[],
    toolMessages: ToolMessage[]
  ): ConversationContext {
    const newContext = this.cloneContext(context);

    // Add tool messages to conversation
    toolMessages.forEach(toolMessage => {
      newContext.messages.push(toolMessage);
    });

    // Update tool call state
    toolResults.forEach(result => {
      if (newContext.toolState.pendingCalls.has(result.toolCallId)) {
        newContext.toolState.pendingCalls.delete(result.toolCallId);
        newContext.toolState.completedCalls.set(result.toolCallId, result);
      }
    });

    newContext.toolState.awaitingResults = newContext.toolState.pendingCalls.size > 0;

    // Add conversation step
    this.addStep(newContext, 'tool_results', toolMessages, undefined, toolResults);

    if (this.config.debug) {
      logger.debug('Added tool results to conversation', {
        conversationId: context.metadata.conversationId,
        toolResultCount: toolResults.length,
        stillAwaitingResults: newContext.toolState.awaitingResults
      });
    }

    return newContext;
  }

  /**
   * Add user message to conversation
   * 
   * @param context - Current conversation context
   * @param userMessage - User's message
   * @returns Updated conversation context
   */
  addUserMessage(
    context: ConversationContext,
    userMessage: ConversationMessage
  ): ConversationContext {
    const newContext = this.cloneContext(context);

    newContext.messages.push(userMessage);
    this.addStep(newContext, 'user_message', [userMessage]);

    if (this.config.debug) {
      logger.debug('Added user message to conversation', {
        conversationId: context.metadata.conversationId,
        messageLength: userMessage.content?.length || 0
      });
    }

    return newContext;
  }

  /**
   * Add final assistant response (after tool execution)
   * 
   * @param context - Current conversation context
   * @param assistantMessage - Assistant's final response
   * @returns Updated conversation context
   */
  addFinalAssistantResponse(
    context: ConversationContext,
    assistantMessage: ConversationMessage
  ): ConversationContext {
    const newContext = this.cloneContext(context);

    newContext.messages.push(assistantMessage);
    this.addStep(newContext, 'assistant_final', [assistantMessage]);

    // Reset tool state for next interaction
    newContext.toolState.pendingCalls.clear();
    newContext.toolState.awaitingResults = false;

    if (this.config.debug) {
      logger.debug('Added final assistant response to conversation', {
        conversationId: context.metadata.conversationId,
        responseLength: assistantMessage.content?.length || 0
      });
    }

    return newContext;
  }

  /**
   * Get conversation messages formatted for Claude API
   * 
   * @param context - Conversation context
   * @returns Messages formatted for Claude API
   */
  getMessagesForClaude(context: ConversationContext): ConversationMessage[] {
    // Return recent messages within the configured limit
    const messages = context.messages;
    
    if (messages.length <= this.config.maxHistoryLength) {
      return [...messages];
    }

    // Keep system messages and recent conversation
    const systemMessages = messages.filter(msg => msg.role === 'system');
    const otherMessages = messages.filter(msg => msg.role !== 'system');
    const recentMessages = otherMessages.slice(-this.config.maxHistoryLength + systemMessages.length);

    return [...systemMessages, ...recentMessages];
  }

  /**
   * Check if conversation is waiting for tool results
   * 
   * @param context - Conversation context
   * @returns True if waiting for tool results
   */
  isAwaitingToolResults(context: ConversationContext): boolean {
    return context.toolState.awaitingResults;
  }

  /**
   * Get conversation statistics
   * 
   * @param context - Conversation context
   * @returns Conversation statistics
   */
  getConversationStats(context: ConversationContext): {
    messageCount: number;
    stepCount: number;
    toolCallCycles: number;
    pendingToolCalls: number;
    completedToolCalls: number;
    duration: number;
  } {
    const now = new Date();
    
    return {
      messageCount: context.messages.length,
      stepCount: context.steps.length,
      toolCallCycles: context.metadata.toolCallCycles,
      pendingToolCalls: context.toolState.pendingCalls.size,
      completedToolCalls: context.toolState.completedCalls.size,
      duration: now.getTime() - context.metadata.startedAt.getTime()
    };
  }

  /**
   * Clone conversation context for immutability
   */
  private cloneContext(context: ConversationContext): ConversationContext {
    return {
      steps: [...context.steps],
      messages: [...context.messages],
      toolState: {
        pendingCalls: new Map(context.toolState.pendingCalls),
        completedCalls: new Map(context.toolState.completedCalls),
        conversationId: context.toolState.conversationId,
        awaitingResults: context.toolState.awaitingResults
      },
      metadata: {
        ...context.metadata,
        lastUpdated: new Date()
      }
    };
  }

  /**
   * Add a step to the conversation history
   */
  private addStep(
    context: ConversationContext,
    type: ConversationStep['type'],
    messages: ConversationMessage[],
    toolCalls?: OpenAIToolCall[],
    toolResults?: ToolExecutionResult[]
  ): void {
    const step: ConversationStep = {
      type,
      messages: [...messages],
      toolCalls,
      toolResults,
      timestamp: new Date()
    };

    context.steps.push(step);
    context.metadata.totalSteps = context.steps.length;
    context.metadata.lastUpdated = new Date();

    // Increment tool call cycles when we complete a tool call/result cycle
    if (type === 'tool_results') {
      context.metadata.toolCallCycles++;
    }
  }

  /**
   * Get configuration
   */
  getConfig(): ConversationContinuityConfig {
    return { ...this.config };
  }
}

/**
 * Default conversation continuity instance
 */
export const conversationContinuity = new ConversationContinuity();