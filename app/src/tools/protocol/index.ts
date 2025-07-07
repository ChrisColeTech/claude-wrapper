/**
 * Tool Protocol - OpenAI Tools API Implementation
 * Exports all tool protocol components for easy importing
 */

// Core protocol components
export { ToolCallDetector, type ToolCallDetection, type ToolCallDetectorConfig } from './tool-call-detector';
export { ClaudeIntentParser, type ToolIntent } from './claude-intent-parser';
export { ToolMapper } from './tool-mapper';

// Tool call generation
export { 
  ToolCallGenerator, 
  type ToolCallGeneratorConfig,
  type GeneratedToolCall,
  type ToolCallGenerationResult
} from './tool-call-generator';

// OpenAI formatting
export {
  OpenAIFormatter,
  type OpenAIFormatterConfig,
  type OpenAIChatCompletionChoice,
  type OpenAIStreamingChunk
} from './openai-formatter';

// Tool result processing
export {
  ToolResultProcessor,
  type ToolResultProcessorConfig,
  type ToolExecutionResult,
  type ToolMessage,
  type ProcessedToolResults
} from './tool-result-processor';

// Conversation continuity
export {
  ConversationContinuity,
  type ConversationContinuityConfig,
  type ConversationMessage,
  type ToolCallState,
  type ConversationStep,
  type ConversationContext
} from './conversation-continuity';

// Streaming support
export {
  StreamingToolCalls,
  type StreamingToolCallsConfig,
  type ToolCallStreamChunk
} from './streaming-tool-calls';

// Default instances
export { toolCallDetector } from './tool-call-detector';
export { toolCallGenerator } from './tool-call-generator';
export { openaiFormatter } from './openai-formatter';
export { toolResultProcessor } from './tool-result-processor';
export { conversationContinuity } from './conversation-continuity';
export { streamingToolCalls } from './streaming-tool-calls';