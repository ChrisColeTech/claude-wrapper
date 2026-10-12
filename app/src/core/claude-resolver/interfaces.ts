/**
 * Claude Resolver Interfaces
 * Following SOLID principles with clear separation of concerns
 */

export interface IClaudePathCache {
  get(): Promise<string | null>;
  set(path: string): Promise<void>;
  clear(): Promise<void>;
}

export interface IClaudePathDetector {
  detectPath(): Promise<string>;
}

export interface IClaudeCommandExecutor {
  execute(command: string, args: string[]): Promise<string>;
  executeStreaming(command: string, args: string[]): Promise<NodeJS.ReadableStream>;
}

export interface IClaudeResolver {
  findClaudeCommand(): Promise<string>;
  executeCommand(prompt: string, model: string, sessionId?: string | null, isStreaming?: boolean): Promise<string>;
  executeCommandStreaming(prompt: string, model: string, sessionId?: string | null): Promise<NodeJS.ReadableStream>;
}