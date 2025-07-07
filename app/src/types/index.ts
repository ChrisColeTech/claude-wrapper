// OpenAI API Types (from original POC)
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenAIChoice {
  index: number;
  message: OpenAIMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls';
}

export interface OpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

// Validation Types
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Claude CLI Types
export interface ClaudeRequest {
  model: string;
  messages: OpenAIMessage[];
}

// Core Interface Contracts (SOLID Principles)
export interface IClaudeClient {
  execute(request: ClaudeRequest): Promise<string>;
}

export interface IClaudeResolver {
  findClaudeCommand(): Promise<string>;
  executeClaudeCommand(prompt: string, model: string): Promise<string>;
}

export interface IResponseValidator {
  validate(response: string): ValidationResult;
  parse(response: string): OpenAIResponse;
}

export interface ICoreWrapper {
  handleChatCompletion(request: OpenAIRequest): Promise<OpenAIResponse>;
}

// Configuration Types
export interface EnvironmentConfig {
  port: number;
  timeout: number;
  claudeCommand: string | undefined;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// Error Types
export interface ClaudeWrapperError {
  code: string;
  message: string;
  details?: any;
}