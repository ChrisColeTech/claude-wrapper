/**
 * OpenAI Tools API Types
 * Simple, clean interfaces for OpenAI Tools API protocol implementation
 * No server-side execution - protocol conversion only
 */

/**
 * OpenAI tool call in response
 */
export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * OpenAI function definition
 */
export interface OpenAIFunction {
  name: string;
  description?: string;
  parameters?: Record<string, any>; // JSON Schema
}

/**
 * OpenAI tool definition
 */
export interface OpenAITool {
  type: 'function';
  function: OpenAIFunction;
}

/**
 * OpenAI tool choice options
 */
export type OpenAIToolChoice = 'auto' | 'none' | 'required' | {
  type: 'function';
  function: {
    name: string;
  };
};

/**
 * Claude tool format (for conversion)
 */
export interface ClaudeToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: any;
}

/**
 * Tool message type (for conversation flow)
 */
export interface ToolMessage {
  role: 'tool';
  content: string;
  tool_call_id: string;
}

/**
 * Simple conversion result
 */
export interface ToolConversionResult {
  success: boolean;
  result?: any;
  error?: string;
}