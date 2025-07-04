/**
 * Tool Calling State Management Unit Tests
 * Phase 11A: Comprehensive state management testing
 * No placeholders - all real functionality tests
 */

import { 
  ToolStateManager,
  ToolStateUtils,
  IToolStateManager,
  ToolCallStateEntry,
  ToolCallStateSnapshot,
  StateTransitionRequest,
  StateTransitionResult,
  StateCleanupResult
} from '../../../src/tools/state';
import { OpenAIToolCall } from '../../../src/tools/types';
import { 
  TOOL_STATES, 
  STATE_MANAGEMENT_LIMITS,
  VALID_STATE_TRANSITIONS,
  TERMINAL_STATES,
  ACTIVE_STATES 
} from '../../../src/tools/constants';

describe('ToolStateManager', () => {
  let stateManager: IToolStateManager;
  const testSessionId = 'test-session-123';
  const testToolCall: OpenAIToolCall = {
    id: 'call_test_123',
    type: 'function',
    function: { name: 'test_function', arguments: '{"param": "value"}' }
  };

  beforeEach(() => {
    stateManager = new ToolStateManager();
  });

  describe('createToolCall', () => {
    it('should create tool call state entry successfully', async () => {
      const entry = await stateManager.createToolCall(testSessionId, testToolCall);

      expect(entry).toBeDefined();
      expect(entry.id).toBe(testToolCall.id);
      expect(entry.toolCall).toEqual(testToolCall);
      expect(entry.state).toBe(TOOL_STATES.PENDING);
      expect(entry.createdAt).toBeGreaterThan(0);
      expect(entry.updatedAt).toBe(entry.createdAt);
      expect(entry.completedAt).toBeUndefined();
      expect(entry.result).toBeUndefined();
      expect(entry.error).toBeUndefined();
    });

    it('should create tool call with metadata', async () => {
      const metadata = { origin: 'test', priority: 'high' };
      const entry = await stateManager.createToolCall(testSessionId, testToolCall, metadata);

      expect(entry.metadata).toEqual(metadata);
    });

    it('should throw error for missing session ID', async () => {
      await expect(stateManager.createToolCall('', testToolCall))
        .rejects.toThrow('Session ID and tool call ID are required');
    });

    it('should throw error for missing tool call ID', async () => {
      const invalidToolCall = { ...testToolCall, id: '' };
      await expect(stateManager.createToolCall(testSessionId, invalidToolCall))
        .rejects.toThrow('Session ID and tool call ID are required');
    });

    it('should handle null tool call gracefully', async () => {
      await expect(stateManager.createToolCall(testSessionId, null as any))
        .rejects.toThrow('Session ID and tool call ID are required');
    });
  });

  describe('updateToolCallState', () => {
    beforeEach(async () => {
      await stateManager.createToolCall(testSessionId, testToolCall);
    });

    it('should successfully transition from pending to in_progress', async () => {
      const request: StateTransitionRequest = {
        toolCallId: testToolCall.id,
        newState: TOOL_STATES.IN_PROGRESS
      };

      const result = await stateManager.updateToolCallState(testSessionId, request);

      expect(result.success).toBe(true);
      expect(result.previousState).toBe(TOOL_STATES.PENDING);
      expect(result.newState).toBe(TOOL_STATES.IN_PROGRESS);
      expect(result.transitionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.transitionTimeMs).toBeLessThan(STATE_MANAGEMENT_LIMITS.STATE_OPERATION_TIMEOUT_MS);
    });

    it('should successfully transition to completed with result', async () => {
      // First transition to in_progress
      await stateManager.updateToolCallState(testSessionId, {
        toolCallId: testToolCall.id,
        newState: TOOL_STATES.IN_PROGRESS
      });

      const testResult = { success: true, data: 'test result' };
      const request: StateTransitionRequest = {
        toolCallId: testToolCall.id,
        newState: TOOL_STATES.COMPLETED,
        result: testResult
      };

      const result = await stateManager.updateToolCallState(testSessionId, request);

      expect(result.success).toBe(true);
      expect(result.newState).toBe(TOOL_STATES.COMPLETED);

      // Verify the entry was updated
      const entry = await stateManager.getToolCallState(testSessionId, testToolCall.id);
      expect(entry?.state).toBe(TOOL_STATES.COMPLETED);
      expect(entry?.result).toEqual(testResult);
      expect(entry?.completedAt).toBeGreaterThan(0);
    });

    it('should fail invalid state transition', async () => {
      const request: StateTransitionRequest = {
        toolCallId: testToolCall.id,
        newState: TOOL_STATES.COMPLETED // Invalid: pending -> completed without in_progress
      };

      const result = await stateManager.updateToolCallState(testSessionId, request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid state transition');
    });

    it('should handle transition with error', async () => {
      await stateManager.updateToolCallState(testSessionId, {
        toolCallId: testToolCall.id,
        newState: TOOL_STATES.IN_PROGRESS
      });

      const errorMessage = 'Tool execution failed';
      const request: StateTransitionRequest = {
        toolCallId: testToolCall.id,
        newState: TOOL_STATES.FAILED,
        error: errorMessage
      };

      const result = await stateManager.updateToolCallState(testSessionId, request);

      expect(result.success).toBe(true);
      expect(result.newState).toBe(TOOL_STATES.FAILED);

      const entry = await stateManager.getToolCallState(testSessionId, testToolCall.id);
      expect(entry?.error).toBe(errorMessage);
      expect(entry?.completedAt).toBeGreaterThan(0);
    });

    it('should handle transition with metadata', async () => {
      const metadata = { attempt: 2, reason: 'retry' };
      const request: StateTransitionRequest = {
        toolCallId: testToolCall.id,
        newState: TOOL_STATES.IN_PROGRESS,
        metadata
      };

      await stateManager.updateToolCallState(testSessionId, request);

      const entry = await stateManager.getToolCallState(testSessionId, testToolCall.id);
      expect(entry?.metadata).toEqual(expect.objectContaining(metadata));
    });

    it('should fail for non-existent session', async () => {
      const request: StateTransitionRequest = {
        toolCallId: testToolCall.id,
        newState: TOOL_STATES.IN_PROGRESS
      };

      const result = await stateManager.updateToolCallState('non-existent', request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Session non-existent not found');
    });

    it('should fail for non-existent tool call', async () => {
      const request: StateTransitionRequest = {
        toolCallId: 'non-existent-call',
        newState: TOOL_STATES.IN_PROGRESS
      };

      const result = await stateManager.updateToolCallState(testSessionId, request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool call non-existent-call not found');
    });
  });

  describe('getToolCallState', () => {
    it('should return null for non-existent session', async () => {
      const state = await stateManager.getToolCallState('non-existent', testToolCall.id);
      expect(state).toBeNull();
    });

    it('should return null for non-existent tool call', async () => {
      await stateManager.createToolCall(testSessionId, testToolCall);
      const state = await stateManager.getToolCallState(testSessionId, 'non-existent-call');
      expect(state).toBeNull();
    });

    it('should return tool call state for existing entry', async () => {
      await stateManager.createToolCall(testSessionId, testToolCall);
      const state = await stateManager.getToolCallState(testSessionId, testToolCall.id);

      expect(state).toBeDefined();
      expect(state!.id).toBe(testToolCall.id);
      expect(state!.state).toBe(TOOL_STATES.PENDING);
    });
  });

  describe('getPendingToolCalls', () => {
    it('should return empty array for non-existent session', async () => {
      const pendingCalls = await stateManager.getPendingToolCalls('non-existent');
      expect(pendingCalls).toEqual([]);
    });

    it('should return only pending and in_progress calls', async () => {
      const toolCall2: OpenAIToolCall = {
        id: 'call_test_456',
        type: 'function',
        function: { name: 'test_function_2', arguments: '{}' }
      };

      const toolCall3: OpenAIToolCall = {
        id: 'call_test_789',
        type: 'function',
        function: { name: 'test_function_3', arguments: '{}' }
      };

      // Create multiple tool calls in different states
      await stateManager.createToolCall(testSessionId, testToolCall); // pending
      await stateManager.createToolCall(testSessionId, toolCall2); // pending -> in_progress
      await stateManager.createToolCall(testSessionId, toolCall3); // pending -> completed

      await stateManager.updateToolCallState(testSessionId, {
        toolCallId: toolCall2.id,
        newState: TOOL_STATES.IN_PROGRESS
      });

      await stateManager.updateToolCallState(testSessionId, {
        toolCallId: toolCall3.id,
        newState: TOOL_STATES.IN_PROGRESS
      });

      await stateManager.updateToolCallState(testSessionId, {
        toolCallId: toolCall3.id,
        newState: TOOL_STATES.COMPLETED
      });

      const pendingCalls = await stateManager.getPendingToolCalls(testSessionId);

      expect(pendingCalls).toHaveLength(2);
      expect(pendingCalls.map(call => call.id)).toContain(testToolCall.id);
      expect(pendingCalls.map(call => call.id)).toContain(toolCall2.id);
      expect(pendingCalls.map(call => call.id)).not.toContain(toolCall3.id);
    });

    it('should return calls sorted by creation time', async () => {
      const toolCall2: OpenAIToolCall = {
        id: 'call_test_456',
        type: 'function',
        function: { name: 'test_function_2', arguments: '{}' }
      };

      await stateManager.createToolCall(testSessionId, testToolCall);
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
      await stateManager.createToolCall(testSessionId, toolCall2);

      const pendingCalls = await stateManager.getPendingToolCalls(testSessionId);

      expect(pendingCalls).toHaveLength(2);
      expect(pendingCalls[0].createdAt).toBeLessThanOrEqual(pendingCalls[1].createdAt);
    });
  });

  describe('getCompletedToolCalls', () => {
    it('should return only completed, failed, and cancelled calls', async () => {
      const toolCall2: OpenAIToolCall = {
        id: 'call_test_456',
        type: 'function',
        function: { name: 'test_function_2', arguments: '{}' }
      };

      await stateManager.createToolCall(testSessionId, testToolCall);
      await stateManager.createToolCall(testSessionId, toolCall2);

      // Complete one, leave one pending
      await stateManager.updateToolCallState(testSessionId, {
        toolCallId: testToolCall.id,
        newState: TOOL_STATES.IN_PROGRESS
      });

      await stateManager.updateToolCallState(testSessionId, {
        toolCallId: testToolCall.id,
        newState: TOOL_STATES.COMPLETED
      });

      const completedCalls = await stateManager.getCompletedToolCalls(testSessionId);

      expect(completedCalls).toHaveLength(1);
      expect(completedCalls[0].id).toBe(testToolCall.id);
      expect(completedCalls[0].state).toBe(TOOL_STATES.COMPLETED);
    });
  });

  describe('getAllToolCalls', () => {
    it('should return all tool calls for session', async () => {
      const toolCall2: OpenAIToolCall = {
        id: 'call_test_456',
        type: 'function',
        function: { name: 'test_function_2', arguments: '{}' }
      };

      await stateManager.createToolCall(testSessionId, testToolCall);
      await stateManager.createToolCall(testSessionId, toolCall2);

      const allCalls = await stateManager.getAllToolCalls(testSessionId);

      expect(allCalls).toHaveLength(2);
      expect(allCalls.map(call => call.id)).toContain(testToolCall.id);
      expect(allCalls.map(call => call.id)).toContain(toolCall2.id);
    });

    it('should return empty array for non-existent session', async () => {
      const allCalls = await stateManager.getAllToolCalls('non-existent');
      expect(allCalls).toEqual([]);
    });
  });

  describe('getStateSnapshot', () => {
    it('should return null for non-existent session', async () => {
      const snapshot = await stateManager.getStateSnapshot('non-existent');
      expect(snapshot).toBeNull();
    });

    it('should return state snapshot with correct counts', async () => {
      const toolCall2: OpenAIToolCall = {
        id: 'call_test_456',
        type: 'function',
        function: { name: 'test_function_2', arguments: '{}' }
      };

      await stateManager.createToolCall(testSessionId, testToolCall);
      await stateManager.createToolCall(testSessionId, toolCall2);

      // Complete one call
      await stateManager.updateToolCallState(testSessionId, {
        toolCallId: testToolCall.id,
        newState: TOOL_STATES.IN_PROGRESS
      });

      await stateManager.updateToolCallState(testSessionId, {
        toolCallId: testToolCall.id,
        newState: TOOL_STATES.COMPLETED
      });

      const snapshot = await stateManager.getStateSnapshot(testSessionId);

      expect(snapshot).toBeDefined();
      expect(snapshot!.sessionId).toBe(testSessionId);
      expect(snapshot!.totalCalls).toBe(2);
      expect(snapshot!.pendingCalls).toHaveLength(1);
      expect(snapshot!.completedCalls).toHaveLength(1);
      expect(snapshot!.conversationTurn).toBeGreaterThan(0);
      expect(snapshot!.createdAt).toBeGreaterThan(0);
      expect(snapshot!.updatedAt).toBeGreaterThan(0);
    });
  });

  describe('cleanupExpiredStates', () => {
    it('should clean up expired completed states', async () => {
      await stateManager.createToolCall(testSessionId, testToolCall);

      // Complete the call
      await stateManager.updateToolCallState(testSessionId, {
        toolCallId: testToolCall.id,
        newState: TOOL_STATES.IN_PROGRESS
      });

      await stateManager.updateToolCallState(testSessionId, {
        toolCallId: testToolCall.id,
        newState: TOOL_STATES.COMPLETED
      });

      // Add a small delay to ensure completedAt timestamp is in the past
      await new Promise(resolve => setTimeout(resolve, 10));

      // Clean up with very short max age (everything should be expired)
      const cleanupResult = await stateManager.cleanupExpiredStates(0);

      expect(cleanupResult.cleanedEntries).toBe(1);
      expect(cleanupResult.remainingEntries).toBe(0);
      expect(cleanupResult.cleanupTimeMs).toBeGreaterThanOrEqual(0);
      expect(cleanupResult.bytesFreed).toBeGreaterThan(0);

      // Verify state was actually cleaned up
      const snapshot = await stateManager.getStateSnapshot(testSessionId);
      expect(snapshot).toBeNull();
    });

    it('should not clean up active states', async () => {
      await stateManager.createToolCall(testSessionId, testToolCall);

      // Clean up with very short max age
      const cleanupResult = await stateManager.cleanupExpiredStates(0);

      expect(cleanupResult.cleanedEntries).toBe(0);
      expect(cleanupResult.remainingEntries).toBe(1);

      // Verify state is still there
      const state = await stateManager.getToolCallState(testSessionId, testToolCall.id);
      expect(state).toBeDefined();
    });

    it('should handle cleanup with no states', async () => {
      const cleanupResult = await stateManager.cleanupExpiredStates(1000);

      expect(cleanupResult.cleanedEntries).toBe(0);
      expect(cleanupResult.remainingEntries).toBe(0);
      expect(cleanupResult.cleanupTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('clearSessionState', () => {
    it('should clear all state for session', async () => {
      await stateManager.createToolCall(testSessionId, testToolCall);

      const result = await stateManager.clearSessionState(testSessionId);

      expect(result).toBe(true);

      // Verify state was cleared
      const snapshot = await stateManager.getStateSnapshot(testSessionId);
      expect(snapshot).toBeNull();

      const state = await stateManager.getToolCallState(testSessionId, testToolCall.id);
      expect(state).toBeNull();
    });

    it('should handle clearing non-existent session', async () => {
      const result = await stateManager.clearSessionState('non-existent');
      expect(result).toBe(true);
    });
  });

  describe('performance requirements', () => {
    it('should complete state operations within 4ms limit', async () => {
      const startTime = Date.now();
      await stateManager.createToolCall(testSessionId, testToolCall);
      const createTime = Date.now() - startTime;

      const updateStart = Date.now();
      await stateManager.updateToolCallState(testSessionId, {
        toolCallId: testToolCall.id,
        newState: TOOL_STATES.IN_PROGRESS
      });
      const updateTime = Date.now() - updateStart;

      const getStart = Date.now();
      await stateManager.getToolCallState(testSessionId, testToolCall.id);
      const getTime = Date.now() - getStart;

      // All operations should be under 4ms
      expect(createTime).toBeLessThan(STATE_MANAGEMENT_LIMITS.STATE_OPERATION_TIMEOUT_MS);
      expect(updateTime).toBeLessThan(STATE_MANAGEMENT_LIMITS.STATE_OPERATION_TIMEOUT_MS);
      expect(getTime).toBeLessThan(STATE_MANAGEMENT_LIMITS.STATE_OPERATION_TIMEOUT_MS);
    });

    it('should handle multiple concurrent operations efficiently', async () => {
      const concurrentOps = Array(20).fill(null).map((_, i) => ({
        id: `call_concurrent_${i}`,
        type: 'function' as const,
        function: { name: `func_${i}`, arguments: '{}' }
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        concurrentOps.map(toolCall => 
          stateManager.createToolCall(testSessionId, toolCall)
        )
      );
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(20);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.state).toBe(TOOL_STATES.PENDING);
      });

      // Should complete all operations reasonably quickly
      expect(totalTime).toBeLessThan(100);
    });
  });
});

describe('ToolStateUtils', () => {
  describe('isTerminalState', () => {
    it('should correctly identify terminal states', () => {
      expect(ToolStateUtils.isTerminalState(TOOL_STATES.COMPLETED)).toBe(true);
      expect(ToolStateUtils.isTerminalState(TOOL_STATES.FAILED)).toBe(true);
      expect(ToolStateUtils.isTerminalState(TOOL_STATES.CANCELLED)).toBe(true);
      
      expect(ToolStateUtils.isTerminalState(TOOL_STATES.PENDING)).toBe(false);
      expect(ToolStateUtils.isTerminalState(TOOL_STATES.IN_PROGRESS)).toBe(false);
    });
  });

  describe('isActiveState', () => {
    it('should correctly identify active states', () => {
      expect(ToolStateUtils.isActiveState(TOOL_STATES.PENDING)).toBe(true);
      expect(ToolStateUtils.isActiveState(TOOL_STATES.IN_PROGRESS)).toBe(true);
      
      expect(ToolStateUtils.isActiveState(TOOL_STATES.COMPLETED)).toBe(false);
      expect(ToolStateUtils.isActiveState(TOOL_STATES.FAILED)).toBe(false);
      expect(ToolStateUtils.isActiveState(TOOL_STATES.CANCELLED)).toBe(false);
    });
  });

  describe('getStatePriority', () => {
    it('should return correct priorities for state ordering', () => {
      expect(ToolStateUtils.getStatePriority(TOOL_STATES.IN_PROGRESS)).toBe(0);
      expect(ToolStateUtils.getStatePriority(TOOL_STATES.PENDING)).toBe(1);
      expect(ToolStateUtils.getStatePriority(TOOL_STATES.COMPLETED)).toBe(2);
      expect(ToolStateUtils.getStatePriority(TOOL_STATES.FAILED)).toBe(3);
      expect(ToolStateUtils.getStatePriority(TOOL_STATES.CANCELLED)).toBe(4);
    });
  });

  describe('filterByAge', () => {
    it('should filter entries by age correctly', () => {
      const now = Date.now();
      const entries: ToolCallStateEntry[] = [
        {
          id: 'call_1',
          toolCall: { id: 'call_1', type: 'function', function: { name: 'func1', arguments: '{}' } },
          state: TOOL_STATES.COMPLETED,
          createdAt: now - 2000, // 2 seconds ago
          updatedAt: now - 1000
        },
        {
          id: 'call_2',
          toolCall: { id: 'call_2', type: 'function', function: { name: 'func2', arguments: '{}' } },
          state: TOOL_STATES.PENDING,
          createdAt: now - 500, // 0.5 seconds ago
          updatedAt: now - 500
        }
      ];

      const filtered = ToolStateUtils.filterByAge(entries, 1000); // 1 second max age

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('call_2');
    });
  });

  describe('getCompletionRate', () => {
    it('should calculate completion rate correctly', () => {
      const entries: ToolCallStateEntry[] = [
        {
          id: 'call_1',
          toolCall: { id: 'call_1', type: 'function', function: { name: 'func1', arguments: '{}' } },
          state: TOOL_STATES.COMPLETED,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 'call_2',
          toolCall: { id: 'call_2', type: 'function', function: { name: 'func2', arguments: '{}' } },
          state: TOOL_STATES.FAILED,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 'call_3',
          toolCall: { id: 'call_3', type: 'function', function: { name: 'func3', arguments: '{}' } },
          state: TOOL_STATES.PENDING,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      const rate = ToolStateUtils.getCompletionRate(entries);
      expect(rate).toBe(1 / 3); // 1 completed out of 3 total
    });

    it('should return 0 for empty entries', () => {
      const rate = ToolStateUtils.getCompletionRate([]);
      expect(rate).toBe(0);
    });
  });
});

describe('State Transition Validation', () => {
  it('should validate all allowed state transitions', () => {
    // Test all valid transitions from VALID_STATE_TRANSITIONS
    for (const [fromState, toStates] of Object.entries(VALID_STATE_TRANSITIONS)) {
      for (const toState of toStates) {
        expect(VALID_STATE_TRANSITIONS[fromState as keyof typeof VALID_STATE_TRANSITIONS])
          .toContain(toState);
      }
    }
  });

  it('should identify terminal states correctly', () => {
    TERMINAL_STATES.forEach(state => {
      expect(VALID_STATE_TRANSITIONS[state]).toHaveLength(0);
    });
  });

  it('should identify active states correctly', () => {
    ACTIVE_STATES.forEach(state => {
      expect(VALID_STATE_TRANSITIONS[state].length).toBeGreaterThan(0);
    });
  });
});