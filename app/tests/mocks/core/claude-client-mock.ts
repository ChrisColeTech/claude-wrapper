/**
 * Claude Client Mock for externalized test mocking
 * Externalized mock following clean architecture principles
 * 
 * Single Responsibility: Mock Claude client execution
 */

import { ClaudeRequest } from '../../../src/types';

export interface ClaudeClientMockConfig {
  shouldFailExecution?: boolean;
  shouldFailSessionExecution?: boolean;
  executionDelay?: number;
  defaultResponse?: string;
  sessionResponses?: Record<string, string>;
  sessionSetupResponse?: string;
}

export interface MockClaudeClient {
  execute: jest.MockedFunction<(request: ClaudeRequest) => Promise<string>>;
  executeWithSession: jest.MockedFunction<(request: ClaudeRequest, sessionId: string | null, useJsonOutput: boolean) => Promise<string>>;
}

/**
 * Claude client mock utility for externalized test mocking
 */
export class ClaudeClientMock {
  private static mockInstance: MockClaudeClient | null = null;
  private static config: ClaudeClientMockConfig = {};

  /**
   * Setup Claude client mock with configuration
   */
  static setup(config: ClaudeClientMockConfig = {}): MockClaudeClient {
    this.config = { ...this.config, ...config };

    // Create mock execute function
    const mockExecute = jest.fn(async (_request: ClaudeRequest): Promise<string> => {
      if (this.config.shouldFailExecution) {
        throw new Error('Claude CLI execution failed');
      }
      
      if (this.config.executionDelay) {
        await new Promise(resolve => setTimeout(resolve, this.config.executionDelay));
      }
      
      return this.config.defaultResponse || 'Mock response';
    });

    // Create mock executeWithSession function
    const mockExecuteWithSession = jest.fn(async (
      _request: ClaudeRequest, 
      sessionId: string | null, 
      useJsonOutput: boolean
    ): Promise<string> => {
      if (this.config.shouldFailSessionExecution) {
        throw new Error('Claude CLI session execution failed');
      }
      
      if (this.config.executionDelay) {
        await new Promise(resolve => setTimeout(resolve, this.config.executionDelay));
      }
      
      // Session setup call (sessionId is null and useJsonOutput is true)
      if (sessionId === null && useJsonOutput) {
        return this.config.sessionSetupResponse || '{"session_id":"test-session-123","result":"Ready"}';
      }
      
      // Session processing call
      if (sessionId && !useJsonOutput) {
        return this.config.sessionResponses?.[sessionId] || this.config.defaultResponse || 'Mock session response';
      }
      
      return this.config.defaultResponse || 'Mock response';
    });

    this.mockInstance = {
      execute: mockExecute,
      executeWithSession: mockExecuteWithSession
    };

    return this.mockInstance;
  }

  /**
   * Set execution failure
   */
  static setExecutionFailure(shouldFail: boolean = true): void {
    this.config.shouldFailExecution = shouldFail;
  }

  /**
   * Set session execution failure
   */
  static setSessionExecutionFailure(shouldFail: boolean = true): void {
    this.config.shouldFailSessionExecution = shouldFail;
  }

  /**
   * Set default response
   */
  static setDefaultResponse(response: string): void {
    this.config.defaultResponse = response;
  }

  /**
   * Set session setup response
   */
  static setSessionSetupResponse(response: string): void {
    this.config.sessionSetupResponse = response;
  }

  /**
   * Set session responses
   */
  static setSessionResponses(responses: Record<string, string>): void {
    this.config.sessionResponses = responses;
  }

  /**
   * Set execution delay
   */
  static setExecutionDelay(delay: number): void {
    this.config.executionDelay = delay;
  }

  /**
   * Reset all mock configurations
   */
  static reset(): void {
    this.config = {};
    this.mockInstance = null;
  }

  /**
   * Get current mock instance
   */
  static getMockInstance(): MockClaudeClient | null {
    return this.mockInstance;
  }

  /**
   * Update configuration
   */
  static updateConfig(updates: Partial<ClaudeClientMockConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}