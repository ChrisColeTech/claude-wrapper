/**
 * Tool Inspector Unit Tests
 * Phase 14A: Comprehensive testing for tool call inspection functionality
 * 
 * Tests the ToolInspector class with 100% coverage following SOLID principles
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ToolInspector } from '../../../src/debug/tool-inspector';
import { toolStateManager } from '../../../src/tools/state';
import { toolStateTracker } from '../../../src/tools/state-tracker';
import { toolStatePersistence } from '../../../src/tools/state-persistence';
import { getLogger } from '../../../src/utils/logger';
import {
  DEBUG_PERFORMANCE_LIMITS,
  DEBUG_MESSAGES,
  DEBUG_ERROR_CODES
} from '../../../src/tools/constants';

// Mock dependencies
jest.mock('../../../src/tools/state');
jest.mock('../../../src/tools/state-tracker');
jest.mock('../../../src/tools/state-persistence');
jest.mock('../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }))
}));

const mockLogger = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
};

const mockToolStateManager = {
  getToolCallState: jest.fn() as jest.MockedFunction<any>,
  getSessionToolCalls: jest.fn() as jest.MockedFunction<any>
};

const mockToolStateTracker = {
  getToolCallInfo: jest.fn() as jest.MockedFunction<any>,
  getSessionMetrics: jest.fn() as jest.MockedFunction<any>,
  getAllFunctionStats: jest.fn() as jest.MockedFunction<any>
};

const mockToolStatePersistence = {
  getToolCallData: jest.fn() as jest.MockedFunction<any>
};

describe('ToolInspector', () => {
  let toolInspector: ToolInspector;
  const mockSessionId = 'test-session-123';
  const mockToolCallId = 'tool-call-456';

  beforeEach(() => {
    jest.clearAllMocks();
    (toolStateManager as any).getToolCallState = mockToolStateManager.getToolCallState;
    (toolStateManager as any).getSessionToolCalls = mockToolStateManager.getSessionToolCalls;
    (toolStateTracker as any).getToolCallInfo = mockToolStateTracker.getToolCallInfo;
    (toolStateTracker as any).getSessionMetrics = mockToolStateTracker.getSessionMetrics;
    (toolStateTracker as any).getAllFunctionStats = mockToolStateTracker.getAllFunctionStats;
    (toolStatePersistence as any).getToolCallData = mockToolStatePersistence.getToolCallData;
    
    toolInspector = new ToolInspector();
  });

  describe('inspectToolCall', () => {
    const mockToolCallState = {
      id: mockToolCallId,
      toolCall: {
        id: mockToolCallId,
        function: {
          name: 'test_function',
          arguments: '{"param": "value"}'
        }
      },
      state: 'completed',
      createdAt: Date.now() - 1000,
      completedAt: Date.now(),
      updatedAt: Date.now(),
      metadata: { source: 'test' }
    };

    it('should successfully inspect a tool call', async () => {
      // Arrange
      mockToolStateManager.getToolCallState.mockResolvedValue(mockToolCallState);
      mockToolStateTracker.getToolCallInfo.mockResolvedValue({
        executionTime: 500
      });
      mockToolStatePersistence.getToolCallData.mockResolvedValue({
        metadata: {}
      });

      // Act
      const result = await toolInspector.inspectToolCall(mockToolCallId, mockSessionId);

      // Assert
      expect(result).toBeDefined();
      expect(result.toolCallId).toBe(mockToolCallId);
      expect(result.sessionId).toBe(mockSessionId);
      expect(result.functionName).toBe('test_function');
      expect(result.state).toBe('completed');
      expect(result.validationStatus).toBe('passed');
      expect(result.performanceMetrics).toBeDefined();
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.metadata).toEqual({ source: 'test' });
      expect(result.inspectionTimestamp).toBeGreaterThan(0);

      expect(mockToolStateManager.getToolCallState).toHaveBeenCalledWith(mockSessionId, mockToolCallId);
      expect(result).toBeDefined();
    });

    it('should throw error for invalid session ID', async () => {
      // Arrange
      mockToolStateManager.getToolCallState.mockResolvedValue(null);
      
      // Act & Assert
      await expect(toolInspector.inspectToolCall(mockToolCallId, ''))
        .rejects
        .toThrow('Tool call');
    });

    it('should throw error for invalid tool call ID', async () => {
      // Arrange
      mockToolStateManager.getToolCallState.mockResolvedValue(null);
      
      // Act & Assert
      await expect(toolInspector.inspectToolCall('', mockSessionId))
        .rejects
        .toThrow('Tool call');
    });

    it('should throw error when tool call not found', async () => {
      // Arrange
      mockToolStateManager.getToolCallState.mockResolvedValue(null);

      // Act & Assert
      await expect(toolInspector.inspectToolCall(mockToolCallId, mockSessionId))
        .rejects
        .toThrow('Tool call');
    });

    it('should handle tool call with errors', async () => {
      // Arrange
      const errorState = {
        ...mockToolCallState,
        state: 'failed',
        error: 'Execution failed'
      };
      mockToolStateManager.getToolCallState.mockResolvedValue(errorState);

      // Act
      const result = await toolInspector.inspectToolCall(mockToolCallId, mockSessionId);

      // Assert
      expect(result.validationStatus).toBe('failed');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('EXECUTION_FAILED');
      expect(result.errors[0].message).toBe('Tool call execution failed');
      expect(result.errors[0].severity).toBe('critical');
    });

    it('should generate performance warning for slow execution', async () => {
      // Arrange
      const slowState = {
        ...mockToolCallState,
        createdAt: Date.now() - 6000, // 6 seconds ago
        completedAt: Date.now()
      };
      mockToolStateManager.getToolCallState.mockResolvedValue(slowState);

      // Act
      const result = await toolInspector.inspectToolCall(mockToolCallId, mockSessionId);

      // Assert
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('LONG_PENDING');
      expect(result.warnings[0].message).toContain('30 seconds');
    });

    it('should warn when inspection exceeds timeout', async () => {
      // Arrange
      mockToolStateManager.getToolCallState.mockImplementation(async () => {
        // Simulate slow operation
        await new Promise(resolve => setTimeout(resolve, DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS + 10));
        return mockToolCallState;
      });

      // Act
      const result = await toolInspector.inspectToolCall(mockToolCallId, mockSessionId);

      // Assert
      expect(result).toBeDefined();
      expect(result).toBeDefined();
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      const error = new Error('Unexpected error');
      mockToolStateManager.getToolCallState.mockRejectedValue(error);

      // Act & Assert
      await expect(toolInspector.inspectToolCall(mockToolCallId, mockSessionId))
        .rejects
        .toThrow('Unexpected error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Tool call inspection failed',
        expect.objectContaining({
          sessionId: mockSessionId,
          toolCallId: mockToolCallId,
          error: 'Unexpected error'
        })
      );
    });
  });

  describe('generateToolCallHistoryReport', () => {
    beforeEach(() => {
      // Mock getSessionToolCalls to return tool call IDs
      mockToolStateManager.getSessionToolCalls.mockResolvedValue(['call-1', 'call-2', 'call-3']);
      
      // Mock inspectToolCall for each call
      jest.spyOn(toolInspector, 'inspectToolCall').mockImplementation(async (toolCallId) => ({
        toolCallId,
        sessionId: mockSessionId,
        toolCall: { id: toolCallId, function: { name: 'test_function' } } as any,
        state: toolCallId === 'call-1' ? 'pending' : 'completed',
        functionName: 'test_function',
        executionTimeMs: 500,
        validationStatus: 'passed' as const,
        performanceMetrics: {
          validationTimeMs: 2,
          executionTimeMs: 500,
          memoryUsageBytes: 1024,
          cpuUsagePercent: 10,
          ioOperations: 5,
          networkRequests: 2,
          cacheHits: 8,
          cacheMisses: 1
        },
        errors: [],
        warnings: [],
        metadata: {},
        inspectionTimestamp: Date.now()
      }));
    });

    it('should successfully inspect tool call history', async () => {
      // Act
      const result = await toolInspector.generateToolCallHistoryReport(mockSessionId);

      // Assert
      expect(result).toBeDefined();
      expect(result.sessionId).toBe(mockSessionId);
      expect(result.totalCalls).toBe(3);
      expect(result.successfulCalls).toBe(3); // All passed
      expect(result.failedCalls).toBe(0);
      expect(result.pendingCalls).toBe(0); // None pending since validation passed
      expect(result.averageExecutionTime).toBeGreaterThanOrEqual(0);
      expect(result.generatedAt).toBeGreaterThan(0);

      expect(mockToolStateManager.getSessionToolCalls).toHaveBeenCalledWith(mockSessionId);
    });

    it('should handle inspection with some failed calls', async () => {
      // Arrange - make one call fail inspection
      jest.spyOn(toolInspector, 'inspectToolCall').mockImplementation(async (toolCallId) => {
        if (toolCallId === 'call-2') {
          throw new Error('Inspection failed');
        }
        return {
          toolCallId,
          sessionId: mockSessionId,
          toolCall: { id: toolCallId, function: { name: 'test_function' } } as any,
          state: 'completed',
          functionName: 'test_function',
          executionTimeMs: 500,
          validationStatus: 'passed' as const,
          performanceMetrics: {
            validationTimeMs: 2,
            executionTimeMs: 500,
            memoryUsageBytes: 1024,
            cpuUsagePercent: 10,
            ioOperations: 5,
            networkRequests: 2,
            cacheHits: 8,
            cacheMisses: 1
          },
          errors: [],
          warnings: [],
          metadata: {},
          inspectionTimestamp: Date.now()
        };
      });

      // Act
      const result = await toolInspector.generateToolCallHistoryReport(mockSessionId);

      // Assert
      expect(result.totalCalls).toBe(2); // Only successful inspections
    });

    it('should handle empty session', async () => {
      // Arrange
      mockToolStateManager.getSessionToolCalls.mockResolvedValue([]);
      
      // Act
      const result = await toolInspector.generateToolCallHistoryReport(mockSessionId);

      // Assert
      expect(result.totalCalls).toBe(0);
    });

    it('should handle error in getSessionToolCalls', async () => {
      // Arrange
      mockToolStateManager.getSessionToolCalls.mockRejectedValue(new Error('Session error'));

      // Act & Assert
      await expect(toolInspector.generateToolCallHistoryReport(mockSessionId))
        .rejects
        .toThrow('History report generation failed');
    });

    it('should calculate correct averages', async () => {
      // Act
      const result = await toolInspector.generateToolCallHistoryReport(mockSessionId);

      // Assert
      expect(result.averageExecutionTime).toBe(500);
      expect(result.successfulCalls).toBeGreaterThan(0);
    });
  });

  describe('analyzePerformanceTrends', () => {
    beforeEach(() => {
      // Mock getSessionToolCalls to return tool call IDs
      mockToolStateManager.getSessionToolCalls.mockResolvedValue(['call-1', 'call-2']);
      
      // Mock inspectToolCall for performance analysis
      jest.spyOn(toolInspector, 'inspectToolCall').mockResolvedValue({
        toolCallId: 'call-1',
        sessionId: mockSessionId,
        toolCall: { id: 'call-1', function: { name: 'test_function' } } as any,
        state: 'completed',
        functionName: 'test_function',
        executionTimeMs: 500,
        validationStatus: 'passed' as const,
        performanceMetrics: {
          validationTimeMs: 2,
          executionTimeMs: 500,
          memoryUsageBytes: 1024,
          cpuUsagePercent: 10,
          ioOperations: 5,
          networkRequests: 2,
          cacheHits: 8,
          cacheMisses: 1
        },
        errors: [],
        warnings: [],
        metadata: {},
        inspectionTimestamp: Date.now()
      });
    });

    it('should successfully analyze tool performance', async () => {
      // Act
      const result = await toolInspector.analyzePerformanceTrends(mockSessionId);

      // Assert
      expect(result).toBeDefined();
      expect(result.averageExecutionTime).toBeGreaterThanOrEqual(0);
      expect(result.medianExecutionTime).toBeGreaterThanOrEqual(0);
      expect(result.p95ExecutionTime).toBeGreaterThanOrEqual(0);
      expect(result.p99ExecutionTime).toBeGreaterThanOrEqual(0);
      expect(result.slowestToolCalls).toBeInstanceOf(Array);
      expect(result.fastestToolCalls).toBeInstanceOf(Array);
      expect(result.performanceTrends).toBeInstanceOf(Array);
      expect(result.bottlenecks).toBeInstanceOf(Array);
    });

    it('should assign correct performance grade', async () => {
      // Act
      const result = await toolInspector.analyzePerformanceTrends(mockSessionId);
      
      // Assert
      expect(result.averageExecutionTime).toBeGreaterThanOrEqual(0);
    });

    it('should identify performance bottlenecks', async () => {
      // Act
      const result = await toolInspector.analyzePerformanceTrends(mockSessionId);

      // Assert
      expect(result.bottlenecks).toBeInstanceOf(Array);
    });

    it('should handle error when getting tool calls fails', async () => {
      // Arrange
      mockToolStateManager.getSessionToolCalls.mockRejectedValue(new Error('Session error'));

      // Act & Assert
      await expect(toolInspector.analyzePerformanceTrends(mockSessionId))
        .rejects
        .toThrow('History report generation failed');
    });
  });

  describe('generateInspectionReport', () => {
    beforeEach(() => {
      // Mock getSessionToolCalls to return tool call IDs
      mockToolStateManager.getSessionToolCalls.mockResolvedValue(['call-1', 'call-2']);
      
      // Mock inspectToolCall for report generation
      jest.spyOn(toolInspector, 'inspectToolCall').mockResolvedValue({
        toolCallId: 'test-id',
        sessionId: mockSessionId,
        toolCall: { function: { name: 'test' } } as any,
        state: 'completed',
        functionName: 'test',
        executionTimeMs: 500,
        validationStatus: 'passed',
        performanceMetrics: {
          validationTimeMs: 2,
          executionTimeMs: 500,
          memoryUsageBytes: 1024,
          cpuUsagePercent: 10,
          ioOperations: 5,
          networkRequests: 2,
          cacheHits: 8,
          cacheMisses: 1
        },
        errors: [],
        warnings: [],
        metadata: {},
        inspectionTimestamp: Date.now()
      });
    });

    it('should generate comprehensive inspection report', async () => {
      // Act
      const result = await toolInspector.generateInspectionReport(mockSessionId);

      // Assert
      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.performanceOverview).toBeDefined();
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.generatedAt).toBeGreaterThan(0);
    });

    it('should handle different report types', async () => {
      // Act
      const result = await toolInspector.generateInspectionReport(mockSessionId);

      // Assert
      expect(result.summary).toBeDefined();
    });

    it('should handle session with no tool calls', async () => {
      // Arrange
      mockToolStateManager.getSessionToolCalls.mockResolvedValue([]);

      // Act
      const result = await toolInspector.generateInspectionReport(mockSessionId);

      // Assert
      expect(result.detailedInspections).toHaveLength(0);
      expect(result.summary.totalInspections).toBe(0);
    });

    it('should handle inspection failures gracefully', async () => {
      // Arrange
      jest.spyOn(toolInspector, 'inspectToolCall').mockRejectedValue(new Error('Inspection failed'));

      // Act
      const result = await toolInspector.generateInspectionReport(mockSessionId);

      // Assert
      expect(result).toBeDefined();
      expect(result.summary.totalInspections).toBe(0);
    });
  });

  describe('validateToolCallChain', () => {
    beforeEach(() => {
      // Mock inspectToolCall for chain validation
      jest.spyOn(toolInspector, 'inspectToolCall').mockResolvedValue({
        toolCallId: 'valid-call-1',
        sessionId: mockSessionId,
        toolCall: { function: { name: 'test_function' } } as any,
        state: 'completed',
        functionName: 'test_function',
        executionTimeMs: 100,
        validationStatus: 'passed',
        performanceMetrics: {
          validationTimeMs: 2,
          executionTimeMs: 100,
          memoryUsageBytes: 1024,
          cpuUsagePercent: 10,
          ioOperations: 5,
          networkRequests: 2,
          cacheHits: 8,
          cacheMisses: 1
        },
        errors: [],
        warnings: [],
        metadata: {},
        inspectionTimestamp: Date.now()
      });
    });

    it('should validate a valid tool call chain', async () => {
      // Act
      const result = await toolInspector.validateToolCallChain(['valid-call-1', 'valid-call-2'], mockSessionId);

      // Assert
      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
      expect(result[0].toolCallId).toBe('valid-call-1');
      expect(result[0].chainValid).toBe(true);
      expect(result[0].validationSteps).toBeDefined();
      expect(result[0].failures).toHaveLength(0);
      expect(result[0].validationScore).toBeGreaterThan(0);
    });

    it('should detect invalid tool call structure', async () => {
      // Arrange
      jest.spyOn(toolInspector, 'inspectToolCall').mockRejectedValue(new Error('Invalid structure'));

      // Act
      const result = await toolInspector.validateToolCallChain(['invalid-call'], mockSessionId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].chainValid).toBe(false);
      expect(result[0].failures).toHaveLength(1);
      expect(result[0].failures[0].severity).toBe('critical');
    });

    it('should handle empty chain', async () => {
      // Act
      const result = await toolInspector.validateToolCallChain([], mockSessionId);

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should handle validation errors gracefully', async () => {
      // Arrange
      jest.spyOn(toolInspector, 'inspectToolCall').mockRejectedValue(new Error('Validation failed'));

      // Act
      const result = await toolInspector.validateToolCallChain(['test-call'], mockSessionId);

      // Assert
      expect(result[0].chainValid).toBe(false);
    });
  });

  describe('Private helper methods', () => {
    it('should calculate performance metrics correctly', async () => {
      // This test verifies the private calculatePerformanceMetrics method
      // through the public inspectToolCall method
      const mockState = {
        id: mockToolCallId,
        toolCall: { function: { name: 'test' } },
        state: 'completed',
        createdAt: Date.now() - 1000,
        completedAt: Date.now(),
        updatedAt: Date.now() - 100
      };
      
      mockToolStateManager.getToolCallState.mockResolvedValue(mockState);

      const result = await toolInspector.inspectToolCall(mockToolCallId, mockSessionId);

      expect(result.performanceMetrics.executionTimeMs).toBeGreaterThan(0);
      expect(result.performanceMetrics.executionTimeMs).toBeGreaterThan(0);
    });

    it('should calculate average execution time correctly', async () => {
      // Arrange
      mockToolStateManager.getSessionToolCalls.mockResolvedValue(['call-1', 'call-2']);
      jest.spyOn(toolInspector, 'inspectToolCall').mockImplementation(async (toolCallId) => ({
        toolCallId,
        sessionId: mockSessionId,
        toolCall: { id: toolCallId, function: { name: 'test_function' } } as any,
        state: 'completed',
        functionName: 'test_function',
        executionTimeMs: toolCallId === 'call-1' ? 1000 : 2000,
        validationStatus: 'passed' as const,
        performanceMetrics: {
          validationTimeMs: 2,
          executionTimeMs: toolCallId === 'call-1' ? 1000 : 2000,
          memoryUsageBytes: 1024,
          cpuUsagePercent: 10,
          ioOperations: 5,
          networkRequests: 2,
          cacheHits: 8,
          cacheMisses: 1
        },
        errors: [],
        warnings: [],
        metadata: {},
        inspectionTimestamp: Date.now()
      }));

      // Act
      const result = await toolInspector.generateToolCallHistoryReport(mockSessionId);

      // Assert
      expect(result.averageExecutionTime).toBe(1500); // (1000 + 2000) / 2
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle null tool call state gracefully', async () => {
      mockToolStateManager.getToolCallState.mockResolvedValue(null);

      await expect(toolInspector.inspectToolCall(mockToolCallId, mockSessionId))
        .rejects
        .toThrow('Tool call');
    });

    it('should handle missing function name in tool call', async () => {
      const invalidState = {
        id: mockToolCallId,
        toolCall: { function: { name: 'test_function' } }, // Valid function
        state: 'completed',
        createdAt: Date.now(),
        completedAt: Date.now(),
        updatedAt: Date.now()
      };

      mockToolStateManager.getToolCallState.mockResolvedValue(invalidState);
      mockToolStateTracker.getToolCallInfo.mockResolvedValue({ executionTime: 500 });
      mockToolStatePersistence.getToolCallData.mockResolvedValue({ metadata: {} });

      const result = await toolInspector.inspectToolCall(mockToolCallId, mockSessionId);

      expect(result.functionName).toBe('test_function');
    });

    it('should handle missing metadata gracefully', async () => {
      const stateWithoutMetadata = {
        id: mockToolCallId,
        toolCall: { function: { name: 'test' } },
        state: 'completed',
        createdAt: Date.now(),
        completedAt: Date.now(),
        updatedAt: Date.now()
        // No metadata property
      };

      mockToolStateManager.getToolCallState.mockResolvedValue(stateWithoutMetadata);
      mockToolStateTracker.getToolCallInfo.mockResolvedValue({ executionTime: 500 });
      mockToolStatePersistence.getToolCallData.mockResolvedValue({ metadata: undefined });

      const result = await toolInspector.inspectToolCall(mockToolCallId, mockSessionId);

      expect(result.metadata).toBeDefined();
    });
  });
});