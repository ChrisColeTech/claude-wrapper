/**
 * Mock Tool Handler for OpenAI Tools Testing
 * 
 * Provides comprehensive mocking for tool execution and handling services
 * covering all phases 1A-12A of the OpenAI tools implementation.
 * 
 * Features:
 * - Configurable responses for different test scenarios
 * - Error injection for testing error handling
 * - Call tracking for test verification
 * - Lightweight and fast for unit testing
 * - Support for all validation, processing, and error handling services
 */

import { jest } from '@jest/globals';
import {
  OpenAITool,
  OpenAIToolChoice,
  ToolValidationResult,
  ToolArrayValidationResult,
  ToolConversionResult,
  ToolParameterProcessingResult,
  ToolCallProcessingResult,
  MultiToolCallResult,
  ToolErrorHandlingResult,
  ToolCallState,
  ToolCallMetrics,
  IToolValidator,
  IToolProcessor,
  IToolConverter,
  IToolErrorHandler,
  IToolStateManager,
  IToolCallCoordinator,
  IParallelProcessor,
  IToolStateTracker
} from '../../../src/tools/types';

// Mock response configurations
export interface MockToolHandlerConfig {
  // Validation responses
  validationResponses?: {
    success?: boolean;
    errors?: string[];
    warnings?: string[];
  };
  
  // Processing responses
  processingResponses?: {
    success?: boolean;
    result?: any;
    metadata?: any;
  };
  
  // Conversion responses
  conversionResponses?: {
    success?: boolean;
    claudeTools?: any[];
    openaiTools?: any[];
  };
  
  // Error handling configuration
  errorConfig?: {
    shouldThrow?: boolean;
    errorType?: 'validation' | 'processing' | 'conversion' | 'runtime';
    errorMessage?: string;
    errorDetails?: any;
  };
  
  // Performance simulation
  performanceConfig?: {
    latencyMs?: number;
    shouldTimeout?: boolean;
    timeoutMs?: number;
  };
  
  // Call tracking
  trackCalls?: boolean;
}

export interface MockCallInfo {
  methodName: string;
  args: any[];
  timestamp: number;
  result?: any;
  error?: Error;
}

/**
 * Mock Tool Handler - Main orchestrator for tool handling mocks
 */
export class MockToolHandler {
  private config: MockToolHandlerConfig;
  private callHistory: MockCallInfo[] = [];
  private callCounts: Map<string, number> = new Map();
  
  constructor(config: MockToolHandlerConfig = {}) {
    this.config = {
      validationResponses: { success: true },
      processingResponses: { success: true },
      conversionResponses: { success: true },
      errorConfig: { shouldThrow: false },
      performanceConfig: { latencyMs: 0 },
      trackCalls: true,
      ...config
    };
  }

  /**
   * Simulate network delay and potential timeouts
   */
  private async simulatePerformance(): Promise<void> {
    const { latencyMs = 0, shouldTimeout = false, timeoutMs = 5000 } = this.config.performanceConfig || {};
    
    if (shouldTimeout) {
      await new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
      );
    }
    
    if (latencyMs > 0) {
      await new Promise(resolve => setTimeout(resolve, latencyMs));
    }
  }

  /**
   * Track method calls for verification
   */
  private trackCall(methodName: string, args: any[], result?: any, error?: Error): void {
    if (!this.config.trackCalls) return;
    
    this.callHistory.push({
      methodName,
      args,
      timestamp: Date.now(),
      result,
      error
    });
    
    this.callCounts.set(methodName, (this.callCounts.get(methodName) || 0) + 1);
  }

  /**
   * Handle configured errors
   */
  private handleError(methodName: string): void {
    const { shouldThrow, errorType, errorMessage, errorDetails } = this.config.errorConfig || {};
    
    if (shouldThrow) {
      const message = errorMessage || `Mock error in ${methodName}`;
      const error = new Error(message);
      
      if (errorDetails) {
        (error as any).details = errorDetails;
      }
      
      if (errorType) {
        (error as any).type = errorType;
      }
      
      throw error;
    }
  }

  // Tool Validation Mocks (Phase 1A)
  async validateTool(tool: OpenAITool): Promise<ToolValidationResult> {
    const methodName = 'validateTool';
    
    try {
      await this.simulatePerformance();
      this.handleError(methodName);
      
      const { success = true, errors = [], warnings = [] } = this.config.validationResponses || {};
      
      const result: ToolValidationResult = {
        valid: success,
        errors,
        warnings,
        tool: success ? tool : undefined
      };
      
      this.trackCall(methodName, [tool], result);
      return result;
    } catch (error) {
      this.trackCall(methodName, [tool], undefined, error as Error);
      throw error;
    }
  }

  async validateToolArray(tools: OpenAITool[]): Promise<ToolArrayValidationResult> {
    const methodName = 'validateToolArray';
    
    try {
      await this.simulatePerformance();
      this.handleError(methodName);
      
      const { success = true, errors = [], warnings = [] } = this.config.validationResponses || {};
      
      const result: ToolArrayValidationResult = {
        valid: success,
        errors,
        warnings,
        validTools: success ? tools : [],
        invalidTools: success ? [] : tools
      };
      
      this.trackCall(methodName, [tools], result);
      return result;
    } catch (error) {
      this.trackCall(methodName, [tools], undefined, error as Error);
      throw error;
    }
  }

  async validateToolChoice(toolChoice: OpenAIToolChoice): Promise<ToolValidationResult> {
    const methodName = 'validateToolChoice';
    
    try {
      await this.simulatePerformance();
      this.handleError(methodName);
      
      const { success = true, errors = [], warnings = [] } = this.config.validationResponses || {};
      
      const result: ToolValidationResult = {
        valid: success,
        errors,
        warnings,
        toolChoice: success ? toolChoice : undefined
      };
      
      this.trackCall(methodName, [toolChoice], result);
      return result;
    } catch (error) {
      this.trackCall(methodName, [toolChoice], undefined, error as Error);
      throw error;
    }
  }

  // Tool Processing Mocks (Phase 2A)
  async processToolParameters(tool: OpenAITool, parameters: any): Promise<ToolParameterProcessingResult> {
    const methodName = 'processToolParameters';
    
    try {
      await this.simulatePerformance();
      this.handleError(methodName);
      
      const { success = true, result, metadata } = this.config.processingResponses || {};
      
      const processingResult: ToolParameterProcessingResult = {
        success,
        processedParameters: success ? (result || parameters) : undefined,
        errors: success ? [] : ['Processing failed'],
        warnings: [],
        metadata: metadata || {}
      };
      
      this.trackCall(methodName, [tool, parameters], processingResult);
      return processingResult;
    } catch (error) {
      this.trackCall(methodName, [tool, parameters], undefined, error as Error);
      throw error;
    }
  }

  async extractToolParameters(tool: OpenAITool): Promise<any> {
    const methodName = 'extractToolParameters';
    
    try {
      await this.simulatePerformance();
      this.handleError(methodName);
      
      const result = tool.function?.parameters || {};
      
      this.trackCall(methodName, [tool], result);
      return result;
    } catch (error) {
      this.trackCall(methodName, [tool], undefined, error as Error);
      throw error;
    }
  }

  // Tool Conversion Mocks (Phase 3A)
  async convertToClaudeFormat(tools: OpenAITool[]): Promise<ToolConversionResult> {
    const methodName = 'convertToClaudeFormat';
    
    try {
      await this.simulatePerformance();
      this.handleError(methodName);
      
      const { success = true, claudeTools = [] } = this.config.conversionResponses || {};
      
      const result: ToolConversionResult = {
        success,
        claudeTools: success ? (claudeTools.length > 0 ? claudeTools : tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          input_schema: t.function.parameters || {}
        }))) : [],
        errors: success ? [] : ['Conversion failed'],
        warnings: []
      };
      
      this.trackCall(methodName, [tools], result);
      return result;
    } catch (error) {
      this.trackCall(methodName, [tools], undefined, error as Error);
      throw error;
    }
  }

  async convertFromClaudeFormat(claudeTools: any[]): Promise<ToolConversionResult> {
    const methodName = 'convertFromClaudeFormat';
    
    try {
      await this.simulatePerformance();
      this.handleError(methodName);
      
      const { success = true, openaiTools = [] } = this.config.conversionResponses || {};
      
      const result: ToolConversionResult = {
        success,
        openaiTools: success ? (openaiTools.length > 0 ? openaiTools : claudeTools.map(t => ({
          type: 'function' as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.input_schema || {}
          }
        }))) : [],
        errors: success ? [] : ['Conversion failed'],
        warnings: []
      };
      
      this.trackCall(methodName, [claudeTools], result);
      return result;
    } catch (error) {
      this.trackCall(methodName, [claudeTools], undefined, error as Error);
      throw error;
    }
  }

  // Tool Call Processing Mocks (Phase 4A-7A)
  async processToolCall(toolCall: any): Promise<ToolCallProcessingResult> {
    const methodName = 'processToolCall';
    
    try {
      await this.simulatePerformance();
      this.handleError(methodName);
      
      const { success = true, result, metadata } = this.config.processingResponses || {};
      
      const processingResult: ToolCallProcessingResult = {
        success,
        result: success ? (result || { output: 'Mock tool call result' }) : undefined,
        errors: success ? [] : ['Tool call processing failed'],
        warnings: [],
        metadata: metadata || {}
      };
      
      this.trackCall(methodName, [toolCall], processingResult);
      return processingResult;
    } catch (error) {
      this.trackCall(methodName, [toolCall], undefined, error as Error);
      throw error;
    }
  }

  async processMultipleToolCalls(toolCalls: any[]): Promise<MultiToolCallResult> {
    const methodName = 'processMultipleToolCalls';
    
    try {
      await this.simulatePerformance();
      this.handleError(methodName);
      
      const { success = true } = this.config.processingResponses || {};
      
      const result: MultiToolCallResult = {
        success,
        results: success ? toolCalls.map((call, index) => ({
          toolCallId: `mock-call-${index}`,
          result: { output: `Mock result for ${call.function?.name || 'unknown'}` },
          success: true
        })) : [],
        errors: success ? [] : ['Multi-tool processing failed'],
        warnings: []
      };
      
      this.trackCall(methodName, [toolCalls], result);
      return result;
    } catch (error) {
      this.trackCall(methodName, [toolCalls], undefined, error as Error);
      throw error;
    }
  }

  // Error Handling Mocks (Phase 8A)
  async handleToolError(error: Error, context?: any): Promise<ToolErrorHandlingResult> {
    const methodName = 'handleToolError';
    
    try {
      await this.simulatePerformance();
      
      const result: ToolErrorHandlingResult = {
        handled: true,
        recovery: {
          strategy: 'retry',
          retryCount: 1,
          fallbackAvailable: true
        },
        formattedError: {
          type: 'tool_error',
          message: error.message,
          details: context
        }
      };
      
      this.trackCall(methodName, [error, context], result);
      return result;
    } catch (handlingError) {
      this.trackCall(methodName, [error, context], undefined, handlingError as Error);
      throw handlingError;
    }
  }

  // State Management Mocks (Phase 11A)
  async getToolCallState(toolCallId: string): Promise<ToolCallState> {
    const methodName = 'getToolCallState';
    
    try {
      await this.simulatePerformance();
      this.handleError(methodName);
      
      const state: ToolCallState = {
        id: toolCallId,
        status: 'pending',
        toolName: 'mock-tool',
        parameters: {},
        result: null,
        error: null,
        timestamps: {
          created: Date.now(),
          started: null,
          completed: null
        }
      };
      
      this.trackCall(methodName, [toolCallId], state);
      return state;
    } catch (error) {
      this.trackCall(methodName, [toolCallId], undefined, error as Error);
      throw error;
    }
  }

  async updateToolCallState(toolCallId: string, updates: Partial<ToolCallState>): Promise<ToolCallState> {
    const methodName = 'updateToolCallState';
    
    try {
      await this.simulatePerformance();
      this.handleError(methodName);
      
      const currentState = await this.getToolCallState(toolCallId);
      const updatedState: ToolCallState = {
        ...currentState,
        ...updates
      };
      
      this.trackCall(methodName, [toolCallId, updates], updatedState);
      return updatedState;
    } catch (error) {
      this.trackCall(methodName, [toolCallId, updates], undefined, error as Error);
      throw error;
    }
  }

  async getToolCallMetrics(): Promise<ToolCallMetrics> {
    const methodName = 'getToolCallMetrics';
    
    try {
      await this.simulatePerformance();
      this.handleError(methodName);
      
      const metrics: ToolCallMetrics = {
        totalCalls: this.callCounts.size,
        successfulCalls: Math.floor(this.callCounts.size * 0.9),
        failedCalls: Math.floor(this.callCounts.size * 0.1),
        averageLatency: 150,
        toolUsage: new Map([
          ['mock-tool', 5],
          ['test-tool', 3]
        ])
      };
      
      this.trackCall(methodName, [], metrics);
      return metrics;
    } catch (error) {
      this.trackCall(methodName, [], undefined, error as Error);
      throw error;
    }
  }

  // Test Utilities
  getCallHistory(): MockCallInfo[] {
    return [...this.callHistory];
  }

  getCallCount(methodName?: string): number {
    if (methodName) {
      return this.callCounts.get(methodName) || 0;
    }
    return this.callHistory.length;
  }

  getLastCall(methodName?: string): MockCallInfo | undefined {
    if (methodName) {
      return this.callHistory.filter(call => call.methodName === methodName).pop();
    }
    return this.callHistory[this.callHistory.length - 1];
  }

  clearCallHistory(): void {
    this.callHistory = [];
    this.callCounts.clear();
  }

  updateConfig(config: Partial<MockToolHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  reset(): void {
    this.clearCallHistory();
    this.config = {
      validationResponses: { success: true },
      processingResponses: { success: true },
      conversionResponses: { success: true },
      errorConfig: { shouldThrow: false },
      performanceConfig: { latencyMs: 0 },
      trackCalls: true
    };
  }
}

/**
 * Mock implementations for specific interfaces
 */
export class MockToolValidator implements IToolValidator {
  constructor(private handler: MockToolHandler) {}

  async validate(tool: OpenAITool): Promise<ToolValidationResult> {
    return this.handler.validateTool(tool);
  }

  async validateArray(tools: OpenAITool[]): Promise<ToolArrayValidationResult> {
    return this.handler.validateToolArray(tools);
  }

  async validateChoice(toolChoice: OpenAIToolChoice): Promise<ToolValidationResult> {
    return this.handler.validateToolChoice(toolChoice);
  }
}

export class MockToolProcessor implements IToolProcessor {
  constructor(private handler: MockToolHandler) {}

  async process(tool: OpenAITool, parameters: any): Promise<ToolParameterProcessingResult> {
    return this.handler.processToolParameters(tool, parameters);
  }

  async extract(tool: OpenAITool): Promise<any> {
    return this.handler.extractToolParameters(tool);
  }
}

export class MockToolConverter implements IToolConverter {
  constructor(private handler: MockToolHandler) {}

  async convertToClaudeFormat(tools: OpenAITool[]): Promise<ToolConversionResult> {
    return this.handler.convertToClaudeFormat(tools);
  }

  async convertFromClaudeFormat(claudeTools: any[]): Promise<ToolConversionResult> {
    return this.handler.convertFromClaudeFormat(claudeTools);
  }
}

export class MockToolErrorHandler implements IToolErrorHandler {
  constructor(private handler: MockToolHandler) {}

  async handle(error: Error, context?: any): Promise<ToolErrorHandlingResult> {
    return this.handler.handleToolError(error, context);
  }
}

export class MockToolStateManager implements IToolStateManager {
  constructor(private handler: MockToolHandler) {}

  async getState(toolCallId: string): Promise<ToolCallState> {
    return this.handler.getToolCallState(toolCallId);
  }

  async updateState(toolCallId: string, updates: Partial<ToolCallState>): Promise<ToolCallState> {
    return this.handler.updateToolCallState(toolCallId, updates);
  }

  async cleanup(): Promise<void> {
    // Mock cleanup
  }
}

export class MockToolStateTracker implements IToolStateTracker {
  constructor(private handler: MockToolHandler) {}

  async getMetrics(): Promise<ToolCallMetrics> {
    return this.handler.getToolCallMetrics();
  }

  async track(event: any): Promise<void> {
    // Mock tracking
  }
}

/**
 * Factory function for creating mock tool handlers with common configurations
 */
export const createMockToolHandler = {
  /**
   * Create a mock that always succeeds
   */
  successful: (config?: Partial<MockToolHandlerConfig>) => 
    new MockToolHandler({
      validationResponses: { success: true },
      processingResponses: { success: true },
      conversionResponses: { success: true },
      errorConfig: { shouldThrow: false },
      ...config
    }),

  /**
   * Create a mock that always fails validation
   */
  validationError: (errors: string[] = ['Validation failed'], config?: Partial<MockToolHandlerConfig>) =>
    new MockToolHandler({
      validationResponses: { success: false, errors },
      ...config
    }),

  /**
   * Create a mock that throws errors
   */
  withErrors: (errorType: 'validation' | 'processing' | 'conversion' | 'runtime' = 'runtime', config?: Partial<MockToolHandlerConfig>) =>
    new MockToolHandler({
      errorConfig: { shouldThrow: true, errorType },
      ...config
    }),

  /**
   * Create a mock with performance simulation
   */
  withLatency: (latencyMs: number, config?: Partial<MockToolHandlerConfig>) =>
    new MockToolHandler({
      performanceConfig: { latencyMs },
      ...config
    }),

  /**
   * Create a mock that simulates timeouts
   */
  withTimeouts: (timeoutMs: number = 1000, config?: Partial<MockToolHandlerConfig>) =>
    new MockToolHandler({
      performanceConfig: { shouldTimeout: true, timeoutMs },
      ...config
    }),

  /**
   * Create a mock without call tracking (for performance tests)
   */
  lightweight: (config?: Partial<MockToolHandlerConfig>) =>
    new MockToolHandler({
      trackCalls: false,
      ...config
    })
};

/**
 * Jest mock factory for automatic mocking
 */
export const createJestMockToolHandler = (config?: MockToolHandlerConfig) => {
  const handler = new MockToolHandler(config);
  
  return {
    validateTool: jest.fn().mockImplementation(handler.validateTool.bind(handler)),
    validateToolArray: jest.fn().mockImplementation(handler.validateToolArray.bind(handler)),
    validateToolChoice: jest.fn().mockImplementation(handler.validateToolChoice.bind(handler)),
    processToolParameters: jest.fn().mockImplementation(handler.processToolParameters.bind(handler)),
    extractToolParameters: jest.fn().mockImplementation(handler.extractToolParameters.bind(handler)),
    convertToClaudeFormat: jest.fn().mockImplementation(handler.convertToClaudeFormat.bind(handler)),
    convertFromClaudeFormat: jest.fn().mockImplementation(handler.convertFromClaudeFormat.bind(handler)),
    processToolCall: jest.fn().mockImplementation(handler.processToolCall.bind(handler)),
    processMultipleToolCalls: jest.fn().mockImplementation(handler.processMultipleToolCalls.bind(handler)),
    handleToolError: jest.fn().mockImplementation(handler.handleToolError.bind(handler)),
    getToolCallState: jest.fn().mockImplementation(handler.getToolCallState.bind(handler)),
    updateToolCallState: jest.fn().mockImplementation(handler.updateToolCallState.bind(handler)),
    getToolCallMetrics: jest.fn().mockImplementation(handler.getToolCallMetrics.bind(handler)),
    
    // Test utilities
    getCallHistory: jest.fn().mockImplementation(handler.getCallHistory.bind(handler)),
    getCallCount: jest.fn().mockImplementation(handler.getCallCount.bind(handler)),
    getLastCall: jest.fn().mockImplementation(handler.getLastCall.bind(handler)),
    clearCallHistory: jest.fn().mockImplementation(handler.clearCallHistory.bind(handler)),
    updateConfig: jest.fn().mockImplementation(handler.updateConfig.bind(handler)),
    reset: jest.fn().mockImplementation(handler.reset.bind(handler))
  };
};

export default MockToolHandler;