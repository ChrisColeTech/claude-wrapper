// OpenAI API Types (from original POC)
export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: OpenAIToolCall[];
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  session_id?: string;
  tools?: any[];
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
  tools?: any[];
}

// Core Interface Contracts (SOLID Principles)
export interface IClaudeClient {
  execute(request: ClaudeRequest): Promise<string>;
  executeWithSession(request: ClaudeRequest, sessionId: string | null, useJsonOutput: boolean): Promise<string>;
}

export interface IClaudeResolver {
  findClaudeCommand(): Promise<string>;
  executeClaudeCommand(prompt: string, model: string): Promise<string>;
  executeClaudeCommandWithSession(prompt: string, model: string, sessionId: string | null, useJsonOutput: boolean): Promise<string>;
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

// Session Management Types (Phase 3A)
export interface SessionInfo {
  session_id: string;
  messages: OpenAIMessage[];
  created_at: Date;
  last_accessed: Date;
  expires_at: Date;
}

export interface SessionStorage {
  store(session: SessionInfo): Promise<void>;
  get(sessionId: string): Promise<SessionInfo | null>;
  update(session: SessionInfo): Promise<void>;
  delete(sessionId: string): Promise<void>;
  list(): Promise<SessionInfo[]>;
  cleanup(): Promise<number>;
}

export interface ISessionManager {
  getOrCreateSession(sessionId: string): SessionInfo;
  processMessages(messages: OpenAIMessage[], sessionId?: string | null): [OpenAIMessage[], string | null];
  listSessions(): SessionInfo[];
  deleteSession(sessionId: string): void;
  getSessionCount(): number;
}

export interface ISessionCleanup {
  startCleanupTask(): void;
  shutdown(): void;
  isRunning(): boolean;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  averageMessageCount: number;
  oldestSessionAge: number;
}

// Streaming Types (Phase 4A)
export interface StreamingDelta {
  role?: 'assistant';
  content?: string;
}

export interface OpenAIStreamingChoice {
  index: number;
  delta: StreamingDelta;
  finish_reason?: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

export interface OpenAIStreamingResponse {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: OpenAIStreamingChoice[];
}

export interface StreamConnection {
  id: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
  response?: any; // Express Response object
}

export interface IStreamingHandler {
  handleStreamingRequest(request: OpenAIRequest, response: any): Promise<void>;
  createStreamingResponse(request: OpenAIRequest): AsyncGenerator<string, void, unknown>;
}

export interface IStreamingFormatter {
  formatChunk(chunk: OpenAIStreamingResponse): string;
  formatError(error: Error): string;
  formatDone(): string;
  formatInitialChunk(requestId: string, model: string): string;
  createContentChunk(requestId: string, model: string, content: string): string;
  createFinalChunk(requestId: string, model: string, finishReason?: string): string;
}

export interface IStreamingManager {
  createConnection(id: string, response: any): void;
  getConnection(id: string): StreamConnection | null;
  closeConnection(id: string): boolean;
  cleanup(): void;
  getActiveConnections(): number;
  shutdown(): void;
}