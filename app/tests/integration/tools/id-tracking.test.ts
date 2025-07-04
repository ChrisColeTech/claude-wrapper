/**
 * ID Tracking Integration Tests
 * Phase 6A: ID Management Implementation
 * 
 * Tests ID management in conversation flow and session persistence
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ToolCallIDManager } from '../../../src/tools/id-manager';
import { ToolCallIDTracker } from '../../../src/tools/id-tracker';
import { ToolCallIdGenerator } from '../../../src/tools/id-generator';
import { 
  IIDManager, 
  IIDTracker, 
  IToolCallIdGenerator 
} from '../../../src/tools/types';
import { ID_MANAGEMENT_LIMITS, ID_FORMATS } from '../../../src/tools/constants';

describe('Phase 6A: ID Management Integration Tests', () => {
  let manager: IIDManager;
  let tracker: IIDTracker;
  let generator: IToolCallIdGenerator;

  beforeEach(() => {
    generator = new ToolCallIdGenerator();
    tracker = new ToolCallIDTracker();
    manager = new ToolCallIDManager(generator, tracker);
  });

  describe('Complete ID Management Workflow', () => {
    it('should handle complete conversation flow with ID persistence', () => {
      const sessionId = 'conv-session-123';
      
      // Step 1: Generate and track IDs for initial tool calls
      const result1 = manager.generateAndTrackId(sessionId);
      const result2 = manager.generateAndTrackId(sessionId);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.id).toMatch(/^call_[A-Za-z0-9]{25}$/);
      expect(result2.id).toMatch(/^call_[A-Za-z0-9]{25}$/);
      expect(result1.id).not.toBe(result2.id);
      
      // Step 2: Verify IDs are tracked in session
      const sessionIds = manager.getSessionIds(sessionId);
      expect(sessionIds).toContain(result1.id);
      expect(sessionIds).toContain(result2.id);
      expect(sessionIds).toHaveLength(2);
      
      // Step 3: Check ID tracking status
      expect(manager.isIdTracked(result1.id!)).toBe(true);
      expect(manager.isIdTracked(result2.id!)).toBe(true);
      
      // Step 4: Add tool response and continue conversation
      const result3 = manager.generateAndTrackId(sessionId);
      expect(result3.success).toBe(true);
      expect(manager.getSessionIds(sessionId)).toHaveLength(3);
      
      // Step 5: Verify conversation continuity
      const allSessionIds = manager.getSessionIds(sessionId);
      expect(allSessionIds).toContain(result1.id);
      expect(allSessionIds).toContain(result2.id);
      expect(allSessionIds).toContain(result3.id);
    });

    it('should handle multiple concurrent sessions', () => {
      const session1 = 'session-1';
      const session2 = 'session-2';
      const session3 = 'session-3';
      
      // Generate IDs for different sessions
      const s1ids = [
        manager.generateAndTrackId(session1),
        manager.generateAndTrackId(session1)
      ];
      
      const s2ids = [
        manager.generateAndTrackId(session2),
        manager.generateAndTrackId(session2),
        manager.generateAndTrackId(session2)
      ];
      
      const s3ids = [
        manager.generateAndTrackId(session3)
      ];
      
      // Verify all operations succeeded
      [...s1ids, ...s2ids, ...s3ids].forEach(result => {
        expect(result.success).toBe(true);
      });
      
      // Verify session isolation
      expect(manager.getSessionIds(session1)).toHaveLength(2);
      expect(manager.getSessionIds(session2)).toHaveLength(3);
      expect(manager.getSessionIds(session3)).toHaveLength(1);
      
      // Verify no cross-contamination
      const s1Set = new Set(manager.getSessionIds(session1));
      const s2Set = new Set(manager.getSessionIds(session2));
      const s3Set = new Set(manager.getSessionIds(session3));
      
      // No overlap between sessions
      s1Set.forEach(id => {
        expect(s2Set.has(id)).toBe(false);
        expect(s3Set.has(id)).toBe(false);
      });
    });

    it('should maintain ID uniqueness across all sessions', () => {
      const sessions = ['session-a', 'session-b', 'session-c'];
      const allIds: string[] = [];
      
      // Generate IDs across multiple sessions
      sessions.forEach(sessionId => {
        for (let i = 0; i < 10; i++) {
          const result = manager.generateAndTrackId(sessionId);
          expect(result.success).toBe(true);
          allIds.push(result.id!);
        }
      });
      
      // Verify all IDs are unique
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
      expect(allIds).toHaveLength(30);
      
      // Verify all IDs follow format
      allIds.forEach(id => {
        expect(id).toMatch(/^call_[A-Za-z0-9]{25}$/);
        expect(id.length).toBe(ID_FORMATS.CALL_ID_LENGTH);
      });
    });
  });

  describe('Session Management Integration', () => {
    it('should handle session cleanup without affecting other sessions', () => {
      const targetSession = 'cleanup-target';
      const otherSession = 'cleanup-other';
      
      // Add IDs to both sessions
      const targetIds = [];
      const otherIds = [];
      
      for (let i = 0; i < 5; i++) {
        targetIds.push(manager.generateAndTrackId(targetSession).id);
        otherIds.push(manager.generateAndTrackId(otherSession).id);
      }
      
      // Verify both sessions have IDs
      expect(manager.getSessionIds(targetSession)).toHaveLength(5);
      expect(manager.getSessionIds(otherSession)).toHaveLength(5);
      
      // Clear target session
      manager.clearSession(targetSession);
      
      // Verify target session is cleared
      expect(manager.getSessionIds(targetSession)).toHaveLength(0);
      
      // Verify other session is unaffected
      expect(manager.getSessionIds(otherSession)).toHaveLength(5);
      
      // Verify target IDs are no longer tracked
      targetIds.forEach(id => {
        expect(manager.isIdTracked(id!)).toBe(false);
      });
      
      // Verify other IDs are still tracked
      otherIds.forEach(id => {
        expect(manager.isIdTracked(id!)).toBe(true);
      });
    });

    it('should handle large session with many IDs', () => {
      const largeSession = 'large-session';
      const idCount = 100;
      const generatedIds: string[] = [];
      
      // Generate many IDs for session
      for (let i = 0; i < idCount; i++) {
        const result = manager.generateAndTrackId(largeSession);
        expect(result.success).toBe(true);
        generatedIds.push(result.id!);
      }
      
      // Verify all IDs are tracked
      const sessionIds = manager.getSessionIds(largeSession);
      expect(sessionIds).toHaveLength(idCount);
      
      // Verify all generated IDs are in session
      generatedIds.forEach(id => {
        expect(sessionIds).toContain(id);
        expect(manager.isIdTracked(id)).toBe(true);
      });
      
      // Test session performance
      const startTime = performance.now();
      const retrievedIds = manager.getSessionIds(largeSession);
      const duration = performance.now() - startTime;
      
      expect(retrievedIds).toHaveLength(idCount);
      expect(duration).toBeLessThan(10); // Should be fast even with many IDs
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle session limit enforcement', () => {
      const limitSession = 'limit-test';
      const maxIds = ID_MANAGEMENT_LIMITS.MAX_IDS_PER_SESSION;
      
      // Add maximum allowed IDs
      const successfulIds: string[] = [];
      for (let i = 0; i < maxIds; i++) {
        const result = manager.generateAndTrackId(limitSession);
        expect(result.success).toBe(true);
        successfulIds.push(result.id!);
      }
      
      // Try to add one more - should fail
      const overLimitResult = manager.generateAndTrackId(limitSession);
      expect(overLimitResult.success).toBe(false);
      expect(overLimitResult.errors[0]).toContain('Cannot track more than');
      
      // Verify session still has exactly maxIds
      expect(manager.getSessionIds(limitSession)).toHaveLength(maxIds);
    });

    it('should handle ID tracking failures gracefully', () => {
      // Try to track invalid ID
      const invalidResult = manager.trackId('invalid-id-format', 'test-session');
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
      
      // Try to track valid ID twice
      const validId = manager.generateId();
      const firstTrack = manager.trackId(validId, 'test-session');
      expect(firstTrack.success).toBe(true);
      
      const secondTrack = manager.trackId(validId, 'test-session');
      expect(secondTrack.success).toBe(false);
      expect(secondTrack.errors[0]).toContain('already');
    });

    it('should handle empty and invalid session operations', () => {
      // Get IDs for nonexistent session
      expect(manager.getSessionIds('nonexistent')).toEqual([]);
      
      // Clear nonexistent session (should not error)
      expect(() => manager.clearSession('nonexistent')).not.toThrow();
      
      // Check if invalid ID is tracked
      expect(manager.isIdTracked('invalid-format')).toBe(false);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-volume ID operations efficiently', () => {
      const startTime = performance.now();
      const sessionCount = 20;
      const idsPerSession = 50;
      const totalOperations = sessionCount * idsPerSession;
      
      for (let s = 0; s < sessionCount; s++) {
        const sessionId = `perf-session-${s}`;
        
        for (let i = 0; i < idsPerSession; i++) {
          const result = manager.generateAndTrackId(sessionId);
          expect(result.success).toBe(true);
        }
      }
      
      const duration = performance.now() - startTime;
      const avgTimePerOp = duration / totalOperations;
      
      expect(avgTimePerOp).toBeLessThan(1); // Should average less than 1ms per operation
      expect(duration).toBeLessThan(1000); // Total should be under 1 second
      
      // Verify all operations completed correctly
      for (let s = 0; s < sessionCount; s++) {
        const sessionId = `perf-session-${s}`;
        expect(manager.getSessionIds(sessionId)).toHaveLength(idsPerSession);
      }
    });

    it('should maintain consistent performance under load', () => {
      const operations = 1000;
      const durations: number[] = [];
      
      for (let i = 0; i < operations; i++) {
        const startTime = performance.now();
        const result = manager.generateAndTrackId(`load-session-${i % 10}`);
        const duration = performance.now() - startTime;
        
        expect(result.success).toBe(true);
        durations.push(duration);
      }
      
      // Calculate performance metrics
      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      const maxDuration = Math.max(...durations);
      
      expect(avgDuration).toBeLessThan(2); // Average should be under 2ms
      expect(maxDuration).toBeLessThan(10); // No single operation should take > 10ms
      
      // Verify performance doesn't degrade over time
      const firstQuarter = durations.slice(0, operations / 4);
      const lastQuarter = durations.slice(-operations / 4);
      
      const firstAvg = firstQuarter.reduce((a, b) => a + b) / firstQuarter.length;
      const lastAvg = lastQuarter.reduce((a, b) => a + b) / lastQuarter.length;
      
      // Performance shouldn't degrade by more than 50%
      expect(lastAvg).toBeLessThan(firstAvg * 1.5);
    });
  });

  describe('Real-world Conversation Simulation', () => {
    it('should simulate multi-turn conversation with tools', () => {
      const conversationSession = 'conversation-123';
      const conversationFlow: string[] = [];
      
      // Turn 1: User asks question, Claude calls 2 tools
      const turn1Tools = [
        manager.generateAndTrackId(conversationSession),
        manager.generateAndTrackId(conversationSession)
      ];
      turn1Tools.forEach(result => {
        expect(result.success).toBe(true);
        conversationFlow.push(result.id!);
      });
      
      // Turn 2: User provides tool responses, Claude calls 1 more tool
      const turn2Tools = [
        manager.generateAndTrackId(conversationSession)
      ];
      turn2Tools.forEach(result => {
        expect(result.success).toBe(true);
        conversationFlow.push(result.id!);
      });
      
      // Turn 3: User provides response, Claude calls 3 tools
      const turn3Tools = [
        manager.generateAndTrackId(conversationSession),
        manager.generateAndTrackId(conversationSession),
        manager.generateAndTrackId(conversationSession)
      ];
      turn3Tools.forEach(result => {
        expect(result.success).toBe(true);
        conversationFlow.push(result.id!);
      });
      
      // Verify complete conversation history
      const sessionHistory = manager.getSessionIds(conversationSession);
      expect(sessionHistory).toHaveLength(6);
      
      // Verify all conversation IDs are tracked
      conversationFlow.forEach(id => {
        expect(sessionHistory).toContain(id);
        expect(manager.isIdTracked(id)).toBe(true);
      });
      
      // Verify chronological order is maintained (IDs should be unique)
      const uniqueIds = new Set(conversationFlow);
      expect(uniqueIds.size).toBe(conversationFlow.length);
    });

    it('should handle concurrent conversations', () => {
      const conversations = [
        'user-1-conversation',
        'user-2-conversation', 
        'user-3-conversation'
      ];
      
      const conversationData = new Map<string, string[]>();
      
      // Simulate concurrent conversations
      conversations.forEach(sessionId => {
        conversationData.set(sessionId, []);
        
        // Each conversation has different number of tool calls
        const toolCallCount = Math.floor(Math.random() * 10) + 1;
        
        for (let i = 0; i < toolCallCount; i++) {
          const result = manager.generateAndTrackId(sessionId);
          expect(result.success).toBe(true);
          conversationData.get(sessionId)!.push(result.id!);
        }
      });
      
      // Verify conversation isolation
      conversations.forEach(sessionId => {
        const sessionIds = manager.getSessionIds(sessionId);
        const expectedIds = conversationData.get(sessionId)!;
        
        expect(sessionIds).toHaveLength(expectedIds.length);
        expectedIds.forEach(id => {
          expect(sessionIds).toContain(id);
        });
      });
      
      // Verify no cross-conversation contamination
      const allIds = Array.from(conversationData.values()).flat();
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should properly clean up after session completion', () => {
      const completedSession = 'completed-session';
      const activeSession = 'active-session';
      
      // Create data in both sessions
      const completedIds = [];
      const activeIds = [];
      
      for (let i = 0; i < 5; i++) {
        completedIds.push(manager.generateAndTrackId(completedSession).id);
        activeIds.push(manager.generateAndTrackId(activeSession).id);
      }
      
      // Get initial stats
      const initialStats = manager.getManagementStats();
      
      // Clear completed session
      manager.clearSession(completedSession);
      
      // Verify completed session is clean
      expect(manager.getSessionIds(completedSession)).toHaveLength(0);
      completedIds.forEach(id => {
        expect(manager.isIdTracked(id!)).toBe(false);
      });
      
      // Verify active session remains untouched
      expect(manager.getSessionIds(activeSession)).toHaveLength(5);
      activeIds.forEach(id => {
        expect(manager.isIdTracked(id!)).toBe(true);
      });
    });

    it('should handle complete reset of ID management system', () => {
      // Create substantial data
      for (let s = 0; s < 5; s++) {
        for (let i = 0; i < 10; i++) {
          manager.generateAndTrackId(`session-${s}`);
        }
      }
      
      // Verify data exists
      const stats = manager.getManagementStats();
      expect(stats.totalIdsGenerated).toBe(50);
      expect(stats.totalIdsTracked).toBe(50);
      
      // Clear all data
      manager.clearAll();
      
      // Verify complete cleanup
      const clearedStats = manager.getManagementStats();
      expect(clearedStats.totalIdsGenerated).toBe(0);
      expect(clearedStats.totalIdsTracked).toBe(0);
      
      // Verify no sessions remain
      for (let s = 0; s < 5; s++) {
        expect(manager.getSessionIds(`session-${s}`)).toHaveLength(0);
      }
    });
  });
});