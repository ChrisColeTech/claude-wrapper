/**
 * Tool State Persistence Integration Tests
 * Phase 11A: End-to-end state persistence integration testing
 * Tests real-world scenarios across the entire state management system
 */

import { 
  toolStateManager,
  toolStateTracker,
  toolStatePersistence,
  ToolCallStateSnapshot,
  StateTransitionEvent
} from '../../../src/tools';
import { OpenAIToolCall } from '../../../src/tools/types';
import { TOOL_STATES, STATE_MANAGEMENT_LIMITS } from '../../../src/tools/constants';

describe('State Management Integration Tests', () => {
  let testSessionId: string;
  
  beforeEach(async () => {
    // Generate unique session ID for each test to ensure isolation
    testSessionId = `integration-test-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Clean up before each test to ensure isolation
    await toolStateManager.cleanupExpiredStates(0);
    await toolStateTracker.cleanupOldMetrics(0);
    await toolStatePersistence.cleanupExpiredStates(0);
  });
  
  afterEach(async () => {
    // Cleanup after each test - clean up ALL sessions, not just testSessionId
    await toolStateManager.cleanupExpiredStates(0);
    await toolStateTracker.cleanupOldMetrics(0);
    await toolStatePersistence.cleanupExpiredStates(0);
  });

  describe('End-to-End State Lifecycle', () => {
    it('should handle complete tool call lifecycle with persistence', async () => {
      const toolCall: OpenAIToolCall = {
        id: 'call_e2e_test',
        type: 'function',
        function: { name: 'e2e_test_function', arguments: '{"param": "value"}' }
      };

      // 1. Create tool call state
      const entry = await toolStateManager.createToolCall(testSessionId, toolCall, {
        origin: 'integration_test',
        priority: 'high'
      });

      expect(entry.state).toBe(TOOL_STATES.PENDING);
      expect(entry.metadata?.origin).toBe('integration_test');

      // 2. Track the tool call
      await toolStateTracker.trackToolCall(testSessionId, entry);

      // 3. Get initial snapshot and persist it
      let snapshot = await toolStateManager.getStateSnapshot(testSessionId);
      expect(snapshot).toBeDefined();
      expect(snapshot!.totalCalls).toBe(1);
      expect(snapshot!.pendingCalls).toHaveLength(1);

      const metrics = await toolStateTracker.getSessionMetrics(testSessionId);
      const saveResult = await toolStatePersistence.saveSessionState(
        testSessionId, 
        snapshot!,
        metrics || undefined
      );

      expect(saveResult.success).toBe(true);

      // 4. Create backup
      const backupResult = await toolStatePersistence.backupSessionState(testSessionId);
      expect(backupResult.success).toBe(true);

      // 5. Transition to in_progress
      const transitionToProgress = await toolStateManager.updateToolCallState(testSessionId, {
        toolCallId: toolCall.id,
        newState: TOOL_STATES.IN_PROGRESS,
        metadata: { attempt: 1 }
      });

      expect(transitionToProgress.success).toBe(true);

      // Track the transition
      await toolStateTracker.trackStateTransition({
        sessionId: testSessionId,
        toolCallId: toolCall.id,
        functionName: toolCall.function.name,
        fromState: TOOL_STATES.PENDING,
        toState: TOOL_STATES.IN_PROGRESS,
        duration: 100,
        timestamp: Date.now(),
        success: true
      });

      // 6. Complete the tool call
      const transitionToComplete = await toolStateManager.updateToolCallState(testSessionId, {
        toolCallId: toolCall.id,
        newState: TOOL_STATES.COMPLETED,
        result: { success: true, data: 'test result' }
      });

      expect(transitionToComplete.success).toBe(true);

      // Track completion
      await toolStateTracker.trackStateTransition({
        sessionId: testSessionId,
        toolCallId: toolCall.id,
        functionName: toolCall.function.name,
        fromState: TOOL_STATES.IN_PROGRESS,
        toState: TOOL_STATES.COMPLETED,
        duration: 1500,
        timestamp: Date.now(),
        success: true
      });

      // 7. Verify final state
      const finalState = await toolStateManager.getToolCallState(testSessionId, toolCall.id);
      expect(finalState?.state).toBe(TOOL_STATES.COMPLETED);
      expect(finalState?.result).toEqual({ success: true, data: 'test result' });
      expect(finalState?.completedAt).toBeGreaterThan(0);

      // 8. Verify tracking metrics
      const finalMetrics = await toolStateTracker.getSessionMetrics(testSessionId);
      expect(finalMetrics!.totalCalls).toBe(1);
      expect(finalMetrics!.completedCalls).toBe(1);
      expect(finalMetrics!.successRate).toBe(1.0);
      expect(finalMetrics!.averageDuration).toBe(1500);

      const functionStats = await toolStateTracker.getFunctionStats(toolCall.function.name);
      expect(functionStats!.callCount).toBe(1);
      expect(functionStats!.successCount).toBe(1);
      expect(functionStats!.averageDuration).toBe(1500);

      // 9. Persist final state
      snapshot = await toolStateManager.getStateSnapshot(testSessionId);
      const finalSaveResult = await toolStatePersistence.saveSessionState(
        testSessionId,
        snapshot!,
        metrics || undefined
      );

      expect(finalSaveResult.success).toBe(true);

      // 10. Test state restoration
      await toolStateManager.clearSessionState(testSessionId);
      const { snapshot: restoredSnapshot, metrics: restoredMetrics } = 
        await toolStatePersistence.loadSessionState(testSessionId);

      expect(restoredSnapshot).toBeDefined();
      expect(restoredSnapshot!.totalCalls).toBe(1);
      expect(restoredSnapshot!.completedCalls).toHaveLength(1);
      expect(restoredMetrics!.successRate).toBe(1.0);
    });
  });

  describe('Multi-Tool Call Scenarios', () => {
    it('should handle multiple concurrent tool calls with state tracking', async () => {
      const toolCalls: OpenAIToolCall[] = Array(5).fill(null).map((_, i) => ({
        id: `call_multi_${i}`,
        type: 'function',
        function: { name: `function_${i % 2 === 0 ? 'even' : 'odd'}`, arguments: '{}' }
      }));

      // Create all tool calls
      const entries = await Promise.all(
        toolCalls.map(toolCall => 
          toolStateManager.createToolCall(testSessionId, toolCall)
        )
      );

      expect(entries).toHaveLength(5);

      // Track all tool calls
      await Promise.all(
        entries.map(entry => toolStateTracker.trackToolCall(testSessionId, entry))
      );

      // Progress some calls
      await toolStateManager.updateToolCallState(testSessionId, {
        toolCallId: toolCalls[0].id,
        newState: TOOL_STATES.IN_PROGRESS
      });

      await toolStateManager.updateToolCallState(testSessionId, {
        toolCallId: toolCalls[1].id,
        newState: TOOL_STATES.IN_PROGRESS
      });

      // Complete some calls
      await toolStateManager.updateToolCallState(testSessionId, {
        toolCallId: toolCalls[0].id,
        newState: TOOL_STATES.COMPLETED,
        result: { success: true }
      });

      // Track transitions
      await toolStateTracker.trackStateTransition({
        sessionId: testSessionId,
        toolCallId: toolCalls[0].id,
        functionName: toolCalls[0].function.name,
        fromState: TOOL_STATES.IN_PROGRESS,
        toState: TOOL_STATES.COMPLETED,
        duration: 1000,
        timestamp: Date.now(),
        success: true
      });

      // Fail one call
      await toolStateManager.updateToolCallState(testSessionId, {
        toolCallId: toolCalls[1].id,
        newState: TOOL_STATES.FAILED,
        error: 'Test failure'
      });

      await toolStateTracker.trackStateTransition({
        sessionId: testSessionId,
        toolCallId: toolCalls[1].id,
        functionName: toolCalls[1].function.name,
        fromState: TOOL_STATES.IN_PROGRESS,
        toState: TOOL_STATES.FAILED,
        duration: 500,
        timestamp: Date.now(),
        success: false
      });

      // Verify state
      const snapshot = await toolStateManager.getStateSnapshot(testSessionId);
      expect(snapshot!.totalCalls).toBe(5);
      expect(snapshot!.pendingCalls).toHaveLength(3);
      expect(snapshot!.completedCalls).toHaveLength(2);

      const metrics = await toolStateTracker.getSessionMetrics(testSessionId);
      expect(metrics!.completedCalls).toBe(1);
      expect(metrics!.failedCalls).toBe(1);
      expect(metrics!.successRate).toBe(0.5);

      // Test persistence with complex state
      const saveResult = await toolStatePersistence.saveSessionState(
        testSessionId,
        snapshot!,
        metrics || undefined
      );

      expect(saveResult.success).toBe(true);

      // Verify function statistics
      const functionStats = await toolStateTracker.getAllFunctionStats();
      expect(functionStats).toHaveLength(2);
      
      const evenFuncStats = functionStats.find(stats => stats.functionName === 'function_even');
      const oddFuncStats = functionStats.find(stats => stats.functionName === 'function_odd');
      
      expect(evenFuncStats?.callCount).toBeGreaterThan(0);
      expect(oddFuncStats?.callCount).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle state corruption and recovery', async () => {
      const recoverySessionId = 'recovery-test-session';
      const toolCall: OpenAIToolCall = {
        id: 'call_recovery_test',
        type: 'function',
        function: { name: 'recovery_function', arguments: '{}' }
      };

      // Create initial state
      await toolStateManager.createToolCall(recoverySessionId, toolCall);
      const snapshot = await toolStateManager.getStateSnapshot(recoverySessionId);
      
      // Save state and create backup
      await toolStatePersistence.saveSessionState(recoverySessionId, snapshot!);
      await toolStatePersistence.backupSessionState(recoverySessionId);

      // Simulate corruption by clearing in-memory state
      await toolStateManager.clearSessionState(recoverySessionId);

      // Verify state is gone
      let currentSnapshot = await toolStateManager.getStateSnapshot(recoverySessionId);
      expect(currentSnapshot).toBeNull();

      // Restore from backup
      const restoreResult = await toolStatePersistence.restoreSessionState(recoverySessionId);
      expect(restoreResult.success).toBe(true);

      // Verify restoration worked
      const { snapshot: restoredSnapshot } = await toolStatePersistence.loadSessionState(recoverySessionId);
      expect(restoredSnapshot).toBeDefined();
      expect(restoredSnapshot!.totalCalls).toBe(1);
      expect(restoredSnapshot!.pendingCalls).toHaveLength(1);
    });

    it('should handle state cleanup and memory management', async () => {
      const toolCalls: OpenAIToolCall[] = Array(10).fill(null).map((_, i) => ({
        id: `call_cleanup_${i}`,
        type: 'function',
        function: { name: 'cleanup_function', arguments: '{}' }
      }));

      // Create multiple tool calls across different sessions
      for (let i = 0; i < toolCalls.length; i++) {
        const sessionId = `cleanup-session-${i}`;
        const entry = await toolStateManager.createToolCall(sessionId, toolCalls[i]);
        await toolStateTracker.trackToolCall(sessionId, entry);

        // Complete some calls
        if (i % 2 === 0) {
          await toolStateManager.updateToolCallState(sessionId, {
            toolCallId: toolCalls[i].id,
            newState: TOOL_STATES.IN_PROGRESS
          });

          await toolStateManager.updateToolCallState(sessionId, {
            toolCallId: toolCalls[i].id,
            newState: TOOL_STATES.COMPLETED
          });
        }

        // Save state
        const snapshot = await toolStateManager.getStateSnapshot(sessionId);
        if (snapshot) {
          await toolStatePersistence.saveSessionState(sessionId, snapshot);
        }
      }

      // Verify we have data
      const storageStats = await toolStatePersistence.getStorageStats();
      expect(storageStats.totalSessions).toBeGreaterThan(0);

      // Clean up expired states (everything should be expired with 0ms age)
      const stateCleanupResult = await toolStateManager.cleanupExpiredStates(0);
      const persistenceCleanupResult = await toolStatePersistence.cleanupExpiredStates(0);
      const trackingCleanupCount = await toolStateTracker.cleanupOldMetrics(0);

      expect(stateCleanupResult.cleanedEntries).toBeGreaterThan(0);
      expect(persistenceCleanupResult.success).toBe(true);
      expect(trackingCleanupCount).toBeGreaterThan(0);

      // Verify cleanup worked
      const finalStorageStats = await toolStatePersistence.getStorageStats();
      expect(finalStorageStats.totalSessions).toBe(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should maintain performance under load', async () => {
      const numberOfCalls = 50;
      const toolCalls: OpenAIToolCall[] = Array(numberOfCalls).fill(null).map((_, i) => ({
        id: `call_perf_${i}`,
        type: 'function',
        function: { name: `perf_function_${i % 5}`, arguments: '{}' }
      }));

      const startTime = Date.now();

      // Create all tool calls concurrently
      const entries = await Promise.all(
        toolCalls.map(toolCall => 
          toolStateManager.createToolCall(testSessionId, toolCall)
        )
      );

      const creationTime = Date.now() - startTime;

      // Track all calls
      const trackingStart = Date.now();
      await Promise.all(
        entries.map(entry => toolStateTracker.trackToolCall(testSessionId, entry))
      );
      const trackingTime = Date.now() - trackingStart;

      // Complete calls with transitions
      const transitionStart = Date.now();
      const transitionPromises = [];

      for (let i = 0; i < numberOfCalls; i++) {
        transitionPromises.push(
          toolStateManager.updateToolCallState(testSessionId, {
            toolCallId: toolCalls[i].id,
            newState: TOOL_STATES.IN_PROGRESS
          }).then(async (result) => {
            await toolStateTracker.trackStateTransition({
              sessionId: testSessionId,
              toolCallId: toolCalls[i].id,
              functionName: toolCalls[i].function.name,
              fromState: TOOL_STATES.PENDING,
              toState: TOOL_STATES.IN_PROGRESS,
              duration: 50,
              timestamp: Date.now(),
              success: true
            });
            return result;
          })
        );

        transitionPromises.push(
          toolStateManager.updateToolCallState(testSessionId, {
            toolCallId: toolCalls[i].id,
            newState: TOOL_STATES.COMPLETED,
            result: { index: i }
          }).then(async (result) => {
            await toolStateTracker.trackStateTransition({
              sessionId: testSessionId,
              toolCallId: toolCalls[i].id,
              functionName: toolCalls[i].function.name,
              fromState: TOOL_STATES.IN_PROGRESS,
              toState: TOOL_STATES.COMPLETED,
              duration: 1000,
              timestamp: Date.now(),
              success: true
            });
            return result;
          })
        );
      }

      const transitionResults = await Promise.all(transitionPromises);
      const transitionTime = Date.now() - transitionStart;

      // Verify all transitions succeeded
      transitionResults.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.transitionTimeMs).toBeLessThan(STATE_MANAGEMENT_LIMITS.STATE_OPERATION_TIMEOUT_MS);
      });

      // Test persistence performance
      const persistenceStart = Date.now();
      const snapshot = await toolStateManager.getStateSnapshot(testSessionId);
      const metrics = await toolStateTracker.getSessionMetrics(testSessionId);
      const saveResult = await toolStatePersistence.saveSessionState(testSessionId, snapshot!, metrics || undefined);
      const persistenceTime = Date.now() - persistenceStart;

      expect(saveResult.success).toBe(true);

      // Verify performance requirements
      const averageCreationTime = creationTime / numberOfCalls;
      const averageTrackingTime = trackingTime / numberOfCalls;
      const averageTransitionTime = transitionTime / (numberOfCalls * 2);

      console.log('DEBUG: Performance metrics:', {
        averageCreationTime,
        averageTrackingTime, 
        averageTransitionTime,
        persistenceTime,
        limits: {
          stateTimeout: STATE_MANAGEMENT_LIMITS.STATE_OPERATION_TIMEOUT_MS,
          trackingTimeout: STATE_MANAGEMENT_LIMITS.TRACKING_OPERATION_TIMEOUT_MS,
          persistenceTimeout: STATE_MANAGEMENT_LIMITS.PERSISTENCE_OPERATION_TIMEOUT_MS
        }
      });

      expect(averageCreationTime).toBeLessThan(STATE_MANAGEMENT_LIMITS.STATE_OPERATION_TIMEOUT_MS);
      expect(averageTrackingTime).toBeLessThan(STATE_MANAGEMENT_LIMITS.TRACKING_OPERATION_TIMEOUT_MS);
      expect(averageTransitionTime).toBeLessThan(STATE_MANAGEMENT_LIMITS.STATE_OPERATION_TIMEOUT_MS);
      expect(persistenceTime).toBeLessThan(STATE_MANAGEMENT_LIMITS.PERSISTENCE_OPERATION_TIMEOUT_MS);

      // Verify final state
      expect(snapshot!.totalCalls).toBe(numberOfCalls);
      expect(snapshot!.completedCalls).toHaveLength(numberOfCalls);
      expect(metrics!.successRate).toBe(1.0);

      console.log('Performance Results:', {
        numberOfCalls,
        averageCreationTime,
        averageTrackingTime,
        averageTransitionTime,
        persistenceTime,
        totalTime: Date.now() - startTime
      });
    });

    it('should handle concurrent session operations', async () => {
      const numberOfSessions = 20;
      const sessionsWithCalls = Array(numberOfSessions).fill(null).map((_, i) => ({
        sessionId: `concurrent-session-${i}`,
        toolCall: {
          id: `call_concurrent_${i}`,
          type: 'function' as const,
          function: { name: 'concurrent_function', arguments: '{}' }
        }
      }));

      const startTime = Date.now();

      // Create tool calls across multiple sessions concurrently
      const results = await Promise.all(
        sessionsWithCalls.map(async ({ sessionId, toolCall }) => {
          const entry = await toolStateManager.createToolCall(sessionId, toolCall);
          await toolStateTracker.trackToolCall(sessionId, entry);
          
          const snapshot = await toolStateManager.getStateSnapshot(sessionId);
          const metrics = await toolStateTracker.getSessionMetrics(sessionId);
          
          const saveResult = await toolStatePersistence.saveSessionState(sessionId, snapshot!, metrics || undefined);
          
          return { sessionId, success: saveResult.success };
        })
      );

      const totalTime = Date.now() - startTime;

      // Verify all operations succeeded
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify we can load all states
      const loadResults = await Promise.all(
        sessionsWithCalls.map(({ sessionId }) => 
          toolStatePersistence.loadSessionState(sessionId)
        )
      );

      loadResults.forEach(({ snapshot, metrics }) => {
        expect(snapshot).toBeDefined();
        expect(metrics).toBeDefined();
        expect(snapshot!.totalCalls).toBe(1);
      });

      expect(totalTime).toBeLessThan(2000); // Should complete in reasonable time

      // Cleanup all sessions
      await Promise.all(
        sessionsWithCalls.map(({ sessionId }) => 
          toolStateManager.clearSessionState(sessionId)
        )
      );
    });
  });

  describe('Data Consistency and Integrity', () => {
    it('should maintain data consistency across state transitions', async () => {
      const toolCall: OpenAIToolCall = {
        id: 'call_consistency_test',
        type: 'function',
        function: { name: 'consistency_function', arguments: '{}' }
      };

      // Create tool call
      const entry = await toolStateManager.createToolCall(testSessionId, toolCall);
      await toolStateTracker.trackToolCall(testSessionId, entry);

      // Capture initial snapshot
      const initialSnapshot = await toolStateManager.getStateSnapshot(testSessionId);
      const initialMetrics = await toolStateTracker.getSessionMetrics(testSessionId);

      expect(initialSnapshot!.totalCalls).toBe(1);
      expect(initialSnapshot!.pendingCalls).toHaveLength(1);
      expect(initialMetrics!.pendingCalls).toBe(1);

      // Transition to in_progress
      await toolStateManager.updateToolCallState(testSessionId, {
        toolCallId: toolCall.id,
        newState: TOOL_STATES.IN_PROGRESS
      });

      await toolStateTracker.trackStateTransition({
        sessionId: testSessionId,
        toolCallId: toolCall.id,
        functionName: toolCall.function.name,
        fromState: TOOL_STATES.PENDING,
        toState: TOOL_STATES.IN_PROGRESS,
        duration: 50,
        timestamp: Date.now(),
        success: true
      });

      // Verify consistency after transition
      const progressSnapshot = await toolStateManager.getStateSnapshot(testSessionId);
      const progressMetrics = await toolStateTracker.getSessionMetrics(testSessionId);

      console.log('DEBUG: Progress snapshot:', {
        totalCalls: progressSnapshot?.totalCalls,
        pendingCallsLength: progressSnapshot?.pendingCalls?.length,
        completedCallsLength: progressSnapshot?.completedCalls?.length
      });
      console.log('DEBUG: Progress metrics:', {
        pendingCalls: progressMetrics?.pendingCalls,
        completedCalls: progressMetrics?.completedCalls,
        successRate: progressMetrics?.successRate
      });

      expect(progressSnapshot!.totalCalls).toBe(1);
      expect(progressSnapshot!.pendingCalls).toHaveLength(1); // Still shows as pending in state manager
      expect(progressMetrics!.pendingCalls).toBe(0); // But metrics are updated by tracker

      // Complete the call
      await toolStateManager.updateToolCallState(testSessionId, {
        toolCallId: toolCall.id,
        newState: TOOL_STATES.COMPLETED,
        result: { success: true }
      });

      await toolStateTracker.trackStateTransition({
        sessionId: testSessionId,
        toolCallId: toolCall.id,
        functionName: toolCall.function.name,
        fromState: TOOL_STATES.IN_PROGRESS,
        toState: TOOL_STATES.COMPLETED,
        duration: 1200,
        timestamp: Date.now(),
        success: true
      });

      // Verify final consistency
      const finalSnapshot = await toolStateManager.getStateSnapshot(testSessionId);
      const finalMetrics = await toolStateTracker.getSessionMetrics(testSessionId);

      expect(finalSnapshot!.totalCalls).toBe(1);
      expect(finalSnapshot!.completedCalls).toHaveLength(1);
      expect(finalSnapshot!.pendingCalls).toHaveLength(0);
      expect(finalMetrics!.completedCalls).toBe(1);
      expect(finalMetrics!.successRate).toBe(1.0);

      // Persist and verify integrity
      const saveResult = await toolStatePersistence.saveSessionState(
        testSessionId,
        finalSnapshot!,
        finalMetrics || undefined
      );

      expect(saveResult.success).toBe(true);

      const { snapshot: persistedSnapshot, metrics: persistedMetrics } = 
        await toolStatePersistence.loadSessionState(testSessionId);

      expect(persistedSnapshot!.totalCalls).toBe(finalSnapshot!.totalCalls);
      expect(persistedSnapshot!.completedCalls).toHaveLength(finalSnapshot!.completedCalls.length);
      expect(persistedMetrics!.successRate).toBe(finalMetrics!.successRate);
    });
  });
});

describe('Real-World Integration Scenarios', () => {
  beforeEach(async () => {
    // Clean up before each test to ensure isolation
    await toolStateManager.cleanupExpiredStates(0);
    await toolStateTracker.cleanupOldMetrics(0);
    await toolStatePersistence.cleanupExpiredStates(0);
  });
  
  afterEach(async () => {
    // Cleanup
    await toolStateManager.cleanupExpiredStates(0);
    await toolStateTracker.cleanupOldMetrics(0);
    await toolStatePersistence.cleanupExpiredStates(0);
  });

  it('should handle tool calling workflow with retries and failures', async () => {
    const sessionId = 'workflow-test-session';
    const toolCall: OpenAIToolCall = {
      id: 'call_workflow_test',
      type: 'function',
      function: { name: 'unreliable_function', arguments: '{"retry_count": 3}' }
    };

    // Initial attempt
    let entry = await toolStateManager.createToolCall(sessionId, toolCall, {
      attempt: 1,
      maxRetries: 3
    });

    await toolStateTracker.trackToolCall(sessionId, entry);

    // First failure
    await toolStateManager.updateToolCallState(sessionId, {
      toolCallId: toolCall.id,
      newState: TOOL_STATES.IN_PROGRESS
    });

    await toolStateManager.updateToolCallState(sessionId, {
      toolCallId: toolCall.id,
      newState: TOOL_STATES.FAILED,
      error: 'Network timeout'
    });

    await toolStateTracker.trackStateTransition({
      sessionId,
      toolCallId: toolCall.id,
      functionName: toolCall.function.name,
      fromState: TOOL_STATES.IN_PROGRESS,
      toState: TOOL_STATES.FAILED,
      duration: 5000,
      timestamp: Date.now(),
      success: false
    });

    // Create retry call
    const retryCall: OpenAIToolCall = {
      id: 'call_workflow_retry',
      type: 'function',
      function: { name: 'unreliable_function', arguments: '{"retry_count": 3}' }
    };

    entry = await toolStateManager.createToolCall(sessionId, retryCall, {
      attempt: 2,
      maxRetries: 3,
      originalCallId: toolCall.id
    });

    await toolStateTracker.trackToolCall(sessionId, entry);

    // Successful retry
    await toolStateManager.updateToolCallState(sessionId, {
      toolCallId: retryCall.id,
      newState: TOOL_STATES.IN_PROGRESS
    });

    await toolStateManager.updateToolCallState(sessionId, {
      toolCallId: retryCall.id,
      newState: TOOL_STATES.COMPLETED,
      result: { success: true, data: 'retry succeeded' }
    });

    await toolStateTracker.trackStateTransition({
      sessionId,
      toolCallId: retryCall.id,
      functionName: retryCall.function.name,
      fromState: TOOL_STATES.IN_PROGRESS,
      toState: TOOL_STATES.COMPLETED,
      duration: 1500,
      timestamp: Date.now(),
      success: true
    });

    // Verify final state
    const snapshot = await toolStateManager.getStateSnapshot(sessionId);
    const metrics = await toolStateTracker.getSessionMetrics(sessionId);

    expect(snapshot!.totalCalls).toBe(2);
    expect(snapshot!.completedCalls).toHaveLength(2); // Both completed and failed calls
    expect(metrics!.totalCalls).toBe(2);
    expect(metrics!.failedCalls).toBe(1);
    expect(metrics!.completedCalls).toBe(1);
    expect(metrics!.successRate).toBe(0.5);

    // Function stats should show both attempts
    const functionStats = await toolStateTracker.getFunctionStats('unreliable_function');
    expect(functionStats!.callCount).toBe(2);
    expect(functionStats!.successCount).toBe(1);
    expect(functionStats!.failureCount).toBe(1);

    // Persist the workflow state
    const saveResult = await toolStatePersistence.saveSessionState(sessionId, snapshot!, metrics || undefined);
    expect(saveResult.success).toBe(true);
  });

  it('should handle long-running conversation with multiple tool calls', async () => {
    const sessionId = 'conversation-test-session';
    const toolCalls: OpenAIToolCall[] = [
      {
        id: 'call_read_file',
        type: 'function',
        function: { name: 'read_file', arguments: '{"path": "/data/config.json"}' }
      },
      {
        id: 'call_process_data',
        type: 'function',
        function: { name: 'process_data', arguments: '{"data": "config_content"}' }
      },
      {
        id: 'call_write_result',
        type: 'function',
        function: { name: 'write_file', arguments: '{"path": "/output/result.json"}' }
      }
    ];

    // Simulate conversation flow
    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];
      
      // Create tool call
      const entry = await toolStateManager.createToolCall(sessionId, toolCall, {
        conversationStep: i + 1,
        workflow: 'data_processing'
      });

      await toolStateTracker.trackToolCall(sessionId, entry);

      // Execute tool call
      await toolStateManager.updateToolCallState(sessionId, {
        toolCallId: toolCall.id,
        newState: TOOL_STATES.IN_PROGRESS
      });

      await toolStateTracker.trackStateTransition({
        sessionId,
        toolCallId: toolCall.id,
        functionName: toolCall.function.name,
        fromState: TOOL_STATES.PENDING,
        toState: TOOL_STATES.IN_PROGRESS,
        duration: 50,
        timestamp: Date.now(),
        success: true
      });

      // Complete with variable duration
      const duration = 500 + (i * 200); // Increasing duration
      
      await toolStateManager.updateToolCallState(sessionId, {
        toolCallId: toolCall.id,
        newState: TOOL_STATES.COMPLETED,
        result: { step: i + 1, duration }
      });

      await toolStateTracker.trackStateTransition({
        sessionId,
        toolCallId: toolCall.id,
        functionName: toolCall.function.name,
        fromState: TOOL_STATES.IN_PROGRESS,
        toState: TOOL_STATES.COMPLETED,
        duration,
        timestamp: Date.now(),
        success: true
      });

      // Save state after each step
      const snapshot = await toolStateManager.getStateSnapshot(sessionId);
      const metrics = await toolStateTracker.getSessionMetrics(sessionId);
      
      await toolStatePersistence.saveSessionState(sessionId, snapshot!, metrics || undefined);
      
      // Create backup at key points
      if (i === 1) {
        await toolStatePersistence.backupSessionState(sessionId);
      }
    }

    // Verify final conversation state
    const finalSnapshot = await toolStateManager.getStateSnapshot(sessionId);
    const finalMetrics = await toolStateTracker.getSessionMetrics(sessionId);

    expect(finalSnapshot!.totalCalls).toBe(3);
    expect(finalSnapshot!.completedCalls).toHaveLength(3);
    expect(finalSnapshot!.conversationTurn).toBe(3);
    expect(finalMetrics!.successRate).toBe(1.0);

    // Verify function diversity
    const allFunctionStats = await toolStateTracker.getAllFunctionStats();
    expect(allFunctionStats).toHaveLength(3);
    
    const functionNames = allFunctionStats.map(stats => stats.functionName);
    expect(functionNames).toContain('read_file');
    expect(functionNames).toContain('process_data');
    expect(functionNames).toContain('write_file');

    // Test period statistics
    const periodStart = Date.now() - 60000; // 1 minute ago
    const periodEnd = Date.now();
    const periodStats = await toolStateTracker.getPeriodStats(periodStart, periodEnd);

    expect(periodStats.totalSessions).toBe(1);
    expect(periodStats.totalToolCalls).toBe(6); // 3 calls × 2 transitions each
    expect(periodStats.overallSuccessRate).toBe(1.0);
    expect(periodStats.topFunctions).toHaveLength(3);

    // Verify backup and restore capability
    const backups = await toolStatePersistence.listBackups(sessionId);
    expect(backups).toHaveLength(1);

    // Test restore from backup (should restore to step 2)
    await toolStateManager.clearSessionState(sessionId);
    const restoreResult = await toolStatePersistence.restoreSessionState(sessionId);
    expect(restoreResult.success).toBe(true);

    const { snapshot: restoredSnapshot } = await toolStatePersistence.loadSessionState(sessionId);
    expect(restoredSnapshot).toBeDefined();
  });
});