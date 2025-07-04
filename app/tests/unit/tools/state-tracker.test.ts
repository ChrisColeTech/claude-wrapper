/**
 * Tool State Tracker Unit Tests
 * Phase 11A: Comprehensive state tracking and analytics testing
 * No placeholders - all real functionality tests
 */

import { 
  ToolStateTracker,
  ToolStateTrackingUtils,
  IToolStateTracker,
  ToolCallMetrics,
  FunctionUsageStats,
  StateTransitionEvent,
  TrackingPeriodStats
} from '../../../src/tools/state-tracker';
import { ToolCallStateEntry } from '../../../src/tools/state';
import { OpenAIToolCall } from '../../../src/tools/types';
import { TOOL_STATES, STATE_MANAGEMENT_LIMITS } from '../../../src/tools/constants';

describe('ToolStateTracker', () => {
  let stateTracker: IToolStateTracker;
  const testSessionId = 'test-session-123';
  const testToolCall: OpenAIToolCall = {
    id: 'call_test_123',
    type: 'function',
    function: { name: 'test_function', arguments: '{"param": "value"}' }
  };

  beforeEach(() => {
    stateTracker = new ToolStateTracker();
  });

  describe('trackToolCall', () => {
    it('should track tool call successfully', async () => {
      const entry: ToolCallStateEntry = {
        id: testToolCall.id,
        toolCall: testToolCall,
        state: TOOL_STATES.PENDING,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await stateTracker.trackToolCall(testSessionId, entry);

      const metrics = await stateTracker.getSessionMetrics(testSessionId);
      expect(metrics).toBeDefined();
      expect(metrics!.sessionId).toBe(testSessionId);
      expect(metrics!.totalCalls).toBe(1);
      expect(metrics!.pendingCalls).toBe(1);
      expect(metrics!.mostUsedFunction).toBe(testToolCall.function.name);
    });

    it('should update session metrics correctly', async () => {
      const entry: ToolCallStateEntry = {
        id: testToolCall.id,
        toolCall: testToolCall,
        state: TOOL_STATES.COMPLETED,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await stateTracker.trackToolCall(testSessionId, entry);

      const metrics = await stateTracker.getSessionMetrics(testSessionId);
      expect(metrics!.completedCalls).toBe(1);
      expect(metrics!.successRate).toBe(1.0);
    });

    it('should update function statistics', async () => {
      const entry: ToolCallStateEntry = {
        id: testToolCall.id,
        toolCall: testToolCall,
        state: TOOL_STATES.COMPLETED,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await stateTracker.trackToolCall(testSessionId, entry);

      const functionStats = await stateTracker.getFunctionStats(testToolCall.function.name);
      expect(functionStats).toBeDefined();
      expect(functionStats!.functionName).toBe(testToolCall.function.name);
      expect(functionStats!.callCount).toBe(1);
      expect(functionStats!.successCount).toBe(1);
      expect(functionStats!.successRate).toBe(1.0);
    });

    it('should handle multiple tool calls for same session', async () => {
      const entry1: ToolCallStateEntry = {
        id: 'call_1',
        toolCall: { ...testToolCall, id: 'call_1' },
        state: TOOL_STATES.COMPLETED,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const entry2: ToolCallStateEntry = {
        id: 'call_2',
        toolCall: { ...testToolCall, id: 'call_2' },
        state: TOOL_STATES.FAILED,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await stateTracker.trackToolCall(testSessionId, entry1);
      await stateTracker.trackToolCall(testSessionId, entry2);

      const metrics = await stateTracker.getSessionMetrics(testSessionId);
      expect(metrics!.totalCalls).toBe(2);
      expect(metrics!.completedCalls).toBe(1);
      expect(metrics!.failedCalls).toBe(1);
      expect(metrics!.successRate).toBe(0.5);
    });

    it('should track active calls', async () => {
      const entry: ToolCallStateEntry = {
        id: testToolCall.id,
        toolCall: testToolCall,
        state: TOOL_STATES.PENDING,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await stateTracker.trackToolCall(testSessionId, entry);

      const activeCount = await stateTracker.getActiveCallsCount();
      expect(activeCount).toBe(1);
    });
  });

  describe('trackStateTransition', () => {
    it('should track state transition successfully', async () => {
      const transitionEvent: StateTransitionEvent = {
        sessionId: testSessionId,
        toolCallId: testToolCall.id,
        functionName: testToolCall.function.name,
        fromState: TOOL_STATES.PENDING,
        toState: TOOL_STATES.IN_PROGRESS,
        duration: 100,
        timestamp: Date.now(),
        success: true
      };

      await stateTracker.trackStateTransition(transitionEvent);

      // Verify active calls tracking is updated
      const activeCount = await stateTracker.getActiveCallsCount();
      expect(activeCount).toBe(1);
    });

    it('should remove from active calls on completion', async () => {
      // Track initial call
      const entry: ToolCallStateEntry = {
        id: testToolCall.id,
        toolCall: testToolCall,
        state: TOOL_STATES.PENDING,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await stateTracker.trackToolCall(testSessionId, entry);

      const completionEvent: StateTransitionEvent = {
        sessionId: testSessionId,
        toolCallId: testToolCall.id,
        functionName: testToolCall.function.name,
        fromState: TOOL_STATES.IN_PROGRESS,
        toState: TOOL_STATES.COMPLETED,
        duration: 1500,
        timestamp: Date.now(),
        success: true
      };

      await stateTracker.trackStateTransition(completionEvent);

      const activeCount = await stateTracker.getActiveCallsCount();
      expect(activeCount).toBe(0);
    });

    it('should update metrics on transition', async () => {
      // First track the tool call
      const entry: ToolCallStateEntry = {
        id: testToolCall.id,
        toolCall: testToolCall,
        state: TOOL_STATES.PENDING,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await stateTracker.trackToolCall(testSessionId, entry);

      const transitionEvent: StateTransitionEvent = {
        sessionId: testSessionId,
        toolCallId: testToolCall.id,
        functionName: testToolCall.function.name,
        fromState: TOOL_STATES.IN_PROGRESS,
        toState: TOOL_STATES.COMPLETED,
        duration: 2000,
        timestamp: Date.now(),
        success: true
      };

      await stateTracker.trackStateTransition(transitionEvent);

      const metrics = await stateTracker.getSessionMetrics(testSessionId);
      expect(metrics!.averageDuration).toBe(2000);

      const functionStats = await stateTracker.getFunctionStats(testToolCall.function.name);
      expect(functionStats!.averageDuration).toBe(2000);
    });
  });

  describe('getSessionMetrics', () => {
    it('should return null for non-existent session', async () => {
      const metrics = await stateTracker.getSessionMetrics('non-existent');
      expect(metrics).toBeNull();
    });

    it('should return session metrics with correct calculations', async () => {
      const entry1: ToolCallStateEntry = {
        id: 'call_1',
        toolCall: { ...testToolCall, id: 'call_1' },
        state: TOOL_STATES.COMPLETED,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const entry2: ToolCallStateEntry = {
        id: 'call_2',
        toolCall: { ...testToolCall, id: 'call_2' },
        state: TOOL_STATES.FAILED,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await stateTracker.trackToolCall(testSessionId, entry1);
      await stateTracker.trackToolCall(testSessionId, entry2);

      const metrics = await stateTracker.getSessionMetrics(testSessionId);
      
      expect(metrics).toBeDefined();
      expect(metrics!.sessionId).toBe(testSessionId);
      expect(metrics!.totalCalls).toBe(2);
      expect(metrics!.completedCalls).toBe(1);
      expect(metrics!.failedCalls).toBe(1);
      expect(metrics!.successRate).toBe(0.5);
      expect(metrics!.createdAt).toBeGreaterThan(0);
      expect(metrics!.updatedAt).toBeGreaterThan(0);
    });
  });

  describe('getFunctionStats', () => {
    it('should return null for non-existent function', async () => {
      const stats = await stateTracker.getFunctionStats('non-existent');
      expect(stats).toBeNull();
    });

    it('should return function statistics', async () => {
      const entry: ToolCallStateEntry = {
        id: testToolCall.id,
        toolCall: testToolCall,
        state: TOOL_STATES.COMPLETED,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await stateTracker.trackToolCall(testSessionId, entry);

      const stats = await stateTracker.getFunctionStats(testToolCall.function.name);
      
      expect(stats).toBeDefined();
      expect(stats!.functionName).toBe(testToolCall.function.name);
      expect(stats!.callCount).toBe(1);
      expect(stats!.successCount).toBe(1);
      expect(stats!.failureCount).toBe(0);
      expect(stats!.successRate).toBe(1.0);
      expect(stats!.lastUsed).toBeGreaterThan(0);
    });

    it('should update statistics across multiple calls', async () => {
      const entry1: ToolCallStateEntry = {
        id: 'call_1',
        toolCall: { ...testToolCall, id: 'call_1' },
        state: TOOL_STATES.COMPLETED,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const entry2: ToolCallStateEntry = {
        id: 'call_2',
        toolCall: { ...testToolCall, id: 'call_2' },
        state: TOOL_STATES.FAILED,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await stateTracker.trackToolCall(testSessionId, entry1);
      await stateTracker.trackToolCall(testSessionId, entry2);

      const stats = await stateTracker.getFunctionStats(testToolCall.function.name);
      
      expect(stats!.callCount).toBe(2);
      expect(stats!.successCount).toBe(1);
      expect(stats!.failureCount).toBe(1);
      expect(stats!.successRate).toBe(0.5);
    });
  });

  describe('getAllFunctionStats', () => {
    it('should return empty array when no functions tracked', async () => {
      const allStats = await stateTracker.getAllFunctionStats();
      expect(allStats).toEqual([]);
    });

    it('should return all function statistics sorted by call count', async () => {
      const func1Call: ToolCallStateEntry = {
        id: 'call_1',
        toolCall: { 
          id: 'call_1', 
          type: 'function', 
          function: { name: 'function_1', arguments: '{}' }
        },
        state: TOOL_STATES.COMPLETED,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const func2Call1: ToolCallStateEntry = {
        id: 'call_2',
        toolCall: { 
          id: 'call_2', 
          type: 'function', 
          function: { name: 'function_2', arguments: '{}' }
        },
        state: TOOL_STATES.COMPLETED,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const func2Call2: ToolCallStateEntry = {
        id: 'call_3',
        toolCall: { 
          id: 'call_3', 
          type: 'function', 
          function: { name: 'function_2', arguments: '{}' }
        },
        state: TOOL_STATES.COMPLETED,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await stateTracker.trackToolCall(testSessionId, func1Call);
      await stateTracker.trackToolCall(testSessionId, func2Call1);
      await stateTracker.trackToolCall(testSessionId, func2Call2);

      const allStats = await stateTracker.getAllFunctionStats();
      
      expect(allStats).toHaveLength(2);
      expect(allStats[0].functionName).toBe('function_2');
      expect(allStats[0].callCount).toBe(2);
      expect(allStats[1].functionName).toBe('function_1');
      expect(allStats[1].callCount).toBe(1);
    });
  });

  describe('getPeriodStats', () => {
    it('should calculate period statistics correctly', async () => {
      const periodStart = Date.now() - 10000;
      const periodEnd = Date.now();

      // Create some transition events within the period
      const event1: StateTransitionEvent = {
        sessionId: testSessionId,
        toolCallId: 'call_1',
        functionName: 'test_function',
        fromState: TOOL_STATES.PENDING,
        toState: TOOL_STATES.COMPLETED,
        duration: 1000,
        timestamp: periodStart + 1000,
        success: true
      };

      const event2: StateTransitionEvent = {
        sessionId: 'session_2',
        toolCallId: 'call_2',
        functionName: 'test_function',
        fromState: TOOL_STATES.PENDING,
        toState: TOOL_STATES.FAILED,
        duration: 2000,
        timestamp: periodStart + 2000,
        success: false
      };

      await stateTracker.trackStateTransition(event1);
      await stateTracker.trackStateTransition(event2);

      const periodStats = await stateTracker.getPeriodStats(periodStart, periodEnd);

      expect(periodStats.periodStart).toBe(periodStart);
      expect(periodStats.periodEnd).toBe(periodEnd);
      expect(periodStats.totalSessions).toBe(2);
      expect(periodStats.totalToolCalls).toBe(2);
      expect(periodStats.averageCallsPerSession).toBe(1);
      expect(periodStats.overallSuccessRate).toBe(0.5);
      expect(periodStats.topFunctions).toHaveLength(1);
      expect(periodStats.topFunctions[0].functionName).toBe('test_function');
      expect(periodStats.performanceMetrics.averageStateTransitionTime).toBe(1500);
    });

    it('should return empty stats for period with no events', async () => {
      const periodStart = Date.now() - 10000;
      const periodEnd = Date.now() - 5000;

      const periodStats = await stateTracker.getPeriodStats(periodStart, periodEnd);

      expect(periodStats.totalSessions).toBe(0);
      expect(periodStats.totalToolCalls).toBe(0);
      expect(periodStats.averageCallsPerSession).toBe(0);
      expect(periodStats.overallSuccessRate).toBe(0);
      expect(periodStats.topFunctions).toEqual([]);
    });
  });

  describe('getActiveCallsCount', () => {
    it('should return current active calls count', async () => {
      // Initially should be 0
      let activeCount = await stateTracker.getActiveCallsCount();
      expect(activeCount).toBe(0);

      // Track a call
      const entry: ToolCallStateEntry = {
        id: testToolCall.id,
        toolCall: testToolCall,
        state: TOOL_STATES.PENDING,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await stateTracker.trackToolCall(testSessionId, entry);

      activeCount = await stateTracker.getActiveCallsCount();
      expect(activeCount).toBe(1);
    });
  });

  describe('cleanupOldMetrics', () => {
    it('should clean up old metrics', async () => {
      const oldTimestamp = Date.now() - 10000;
      
      // Track some old data
      const entry: ToolCallStateEntry = {
        id: testToolCall.id,
        toolCall: testToolCall,
        state: TOOL_STATES.COMPLETED,
        createdAt: oldTimestamp,
        updatedAt: oldTimestamp
      };

      await stateTracker.trackToolCall(testSessionId, entry);

      const cleanupCount = await stateTracker.cleanupOldMetrics(5000); // 5 seconds max age

      expect(cleanupCount).toBeGreaterThan(0);

      // Verify metrics were cleaned up
      const metrics = await stateTracker.getSessionMetrics(testSessionId);
      expect(metrics).toBeNull();
    });

    it('should not clean up recent metrics', async () => {
      const entry: ToolCallStateEntry = {
        id: testToolCall.id,
        toolCall: testToolCall,
        state: TOOL_STATES.COMPLETED,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await stateTracker.trackToolCall(testSessionId, entry);

      const cleanupCount = await stateTracker.cleanupOldMetrics(60000); // 1 minute max age

      expect(cleanupCount).toBe(0);

      // Verify metrics are still there
      const metrics = await stateTracker.getSessionMetrics(testSessionId);
      expect(metrics).toBeDefined();
    });
  });

  describe('performance requirements', () => {
    it('should complete tracking operations within performance limits', async () => {
      const entry: ToolCallStateEntry = {
        id: testToolCall.id,
        toolCall: testToolCall,
        state: TOOL_STATES.PENDING,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const startTime = Date.now();
      await stateTracker.trackToolCall(testSessionId, entry);
      const trackingTime = Date.now() - startTime;

      const transitionStart = Date.now();
      await stateTracker.trackStateTransition({
        sessionId: testSessionId,
        toolCallId: testToolCall.id,
        functionName: testToolCall.function.name,
        fromState: TOOL_STATES.PENDING,
        toState: TOOL_STATES.COMPLETED,
        duration: 100,
        timestamp: Date.now(),
        success: true
      });
      const transitionTime = Date.now() - transitionStart;

      // Should be well under timeout limits
      expect(trackingTime).toBeLessThan(STATE_MANAGEMENT_LIMITS.TRACKING_OPERATION_TIMEOUT_MS);
      expect(transitionTime).toBeLessThan(STATE_MANAGEMENT_LIMITS.TRACKING_OPERATION_TIMEOUT_MS);
    });
  });
});

describe('ToolStateTrackingUtils', () => {
  describe('calculateSuccessRate', () => {
    it('should calculate success rate correctly', () => {
      expect(ToolStateTrackingUtils.calculateSuccessRate(8, 10)).toBe(0.8);
      expect(ToolStateTrackingUtils.calculateSuccessRate(0, 10)).toBe(0);
      expect(ToolStateTrackingUtils.calculateSuccessRate(10, 10)).toBe(1);
      expect(ToolStateTrackingUtils.calculateSuccessRate(5, 0)).toBe(0);
    });
  });

  describe('formatDuration', () => {
    it('should format durations correctly', () => {
      expect(ToolStateTrackingUtils.formatDuration(500)).toBe('500ms');
      expect(ToolStateTrackingUtils.formatDuration(1500)).toBe('1.5s');
      expect(ToolStateTrackingUtils.formatDuration(65000)).toBe('1.1m');
    });
  });

  describe('getPerformanceGrade', () => {
    it('should assign correct performance grades', () => {
      expect(ToolStateTrackingUtils.getPerformanceGrade(500)).toBe('A');
      expect(ToolStateTrackingUtils.getPerformanceGrade(2000)).toBe('B');
      expect(ToolStateTrackingUtils.getPerformanceGrade(4000)).toBe('C');
      expect(ToolStateTrackingUtils.getPerformanceGrade(8000)).toBe('D');
      expect(ToolStateTrackingUtils.getPerformanceGrade(15000)).toBe('F');
    });
  });

  describe('isTrendingFunction', () => {
    it('should identify trending functions correctly', () => {
      const recentStats: FunctionUsageStats = {
        functionName: 'trending_func',
        callCount: 10,
        successCount: 8,
        failureCount: 2,
        averageDuration: 1000,
        successRate: 0.8,
        lastUsed: Date.now() - 1000 // 1 second ago
      };

      const oldStats: FunctionUsageStats = {
        functionName: 'old_func',
        callCount: 5,
        successCount: 5,
        failureCount: 0,
        averageDuration: 1000,
        successRate: 1.0,
        lastUsed: Date.now() - 7200000 // 2 hours ago
      };

      expect(ToolStateTrackingUtils.isTrendingFunction(recentStats)).toBe(true);
      expect(ToolStateTrackingUtils.isTrendingFunction(oldStats)).toBe(false);
    });

    it('should require minimum call count for trending', () => {
      const lowVolumeStats: FunctionUsageStats = {
        functionName: 'low_volume_func',
        callCount: 2,
        successCount: 2,
        failureCount: 0,
        averageDuration: 1000,
        successRate: 1.0,
        lastUsed: Date.now() - 1000
      };

      expect(ToolStateTrackingUtils.isTrendingFunction(lowVolumeStats)).toBe(false);
    });
  });
});

describe('Integration with State Management', () => {
  let stateTracker: IToolStateTracker;

  beforeEach(() => {
    stateTracker = new ToolStateTracker();
  });

  it('should handle complete tool call lifecycle tracking', async () => {
    const sessionId = 'lifecycle-test-session';
    const toolCall: OpenAIToolCall = {
      id: 'call_lifecycle_test',
      type: 'function',
      function: { name: 'lifecycle_function', arguments: '{}' }
    };

    // 1. Initial tool call tracking
    const pendingEntry: ToolCallStateEntry = {
      id: toolCall.id,
      toolCall: toolCall,
      state: TOOL_STATES.PENDING,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await stateTracker.trackToolCall(sessionId, pendingEntry);

    // 2. Track transition to in_progress
    await stateTracker.trackStateTransition({
      sessionId,
      toolCallId: toolCall.id,
      functionName: toolCall.function.name,
      fromState: TOOL_STATES.PENDING,
      toState: TOOL_STATES.IN_PROGRESS,
      duration: 50,
      timestamp: Date.now(),
      success: true
    });

    // 3. Track completion
    await stateTracker.trackStateTransition({
      sessionId,
      toolCallId: toolCall.id,
      functionName: toolCall.function.name,
      fromState: TOOL_STATES.IN_PROGRESS,
      toState: TOOL_STATES.COMPLETED,
      duration: 1500,
      timestamp: Date.now(),
      success: true
    });

    // Verify final state
    const metrics = await stateTracker.getSessionMetrics(sessionId);
    const functionStats = await stateTracker.getFunctionStats(toolCall.function.name);
    const activeCount = await stateTracker.getActiveCallsCount();

    expect(metrics!.totalCalls).toBe(1);
    expect(metrics!.completedCalls).toBe(1);
    expect(metrics!.successRate).toBe(1.0);
    expect(functionStats!.successRate).toBe(1.0);
    expect(functionStats!.averageDuration).toBe(1500);
    expect(activeCount).toBe(0); // Should be removed from active calls
  });

  it('should handle error scenarios properly', async () => {
    const sessionId = 'error-test-session';
    const toolCall: OpenAIToolCall = {
      id: 'call_error_test',
      type: 'function',
      function: { name: 'error_function', arguments: '{}' }
    };

    // Track tool call
    const pendingEntry: ToolCallStateEntry = {
      id: toolCall.id,
      toolCall: toolCall,
      state: TOOL_STATES.PENDING,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await stateTracker.trackToolCall(sessionId, pendingEntry);

    // Track failure
    await stateTracker.trackStateTransition({
      sessionId,
      toolCallId: toolCall.id,
      functionName: toolCall.function.name,
      fromState: TOOL_STATES.PENDING,
      toState: TOOL_STATES.FAILED,
      duration: 500,
      timestamp: Date.now(),
      success: false
    });

    const metrics = await stateTracker.getSessionMetrics(sessionId);
    const functionStats = await stateTracker.getFunctionStats(toolCall.function.name);

    expect(metrics!.failedCalls).toBe(1);
    expect(metrics!.successRate).toBe(0);
    expect(functionStats!.failureCount).toBe(1);
    expect(functionStats!.successRate).toBe(0);
  });
});