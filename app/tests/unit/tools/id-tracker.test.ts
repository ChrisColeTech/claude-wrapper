/**
 * Tool Call ID Tracker Unit Tests
 * Phase 6A: ID Management Implementation
 * 
 * Tests ID tracking across conversation turns and sessions
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  ToolCallIDTracker, 
  IDTrackingError,
  IDTrackingUtils 
} from '../../../src/tools/id-tracker';
import { 
  IIDTracker, 
  IDTrackingResult 
} from '../../../src/tools/types';
import { ID_MANAGEMENT_LIMITS, ID_FORMATS } from '../../../src/tools/constants';

describe('ToolCallIDTracker', () => {
  let tracker: IIDTracker;

  beforeEach(() => {
    tracker = new ToolCallIDTracker();
  });

  describe('addId', () => {
    it('should add valid ID successfully', () => {
      const result = tracker.addId('call_ABC123DEF456GHI789JKL012M', 'session-123');
      
      expect(result.success).toBe(true);
      expect(result.id).toBe('call_ABC123DEF456GHI789JKL012M');
      expect(result.sessionId).toBe('session-123');
      expect(result.errors).toEqual([]);
      expect(result.trackingTimeMs).toBeGreaterThan(0);
    });

    it('should add ID without session', () => {
      const result = tracker.addId('call_ABC123DEF456GHI789JKL012M');
      
      expect(result.success).toBe(true);
      expect(result.id).toBe('call_ABC123DEF456GHI789JKL012M');
      expect(result.sessionId).toBeUndefined();
      expect(result.errors).toEqual([]);
    });

    it('should reject invalid ID format', () => {
      const result = tracker.addId('invalid_id', 'session-123');
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid session ID', () => {
      const result = tracker.addId('call_ABC123DEF456GHI789JKL012M', '');
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject already tracked ID', () => {
      tracker.addId('call_ABC123DEF456GHI789JKL012M', 'session-123');
      const result = tracker.addId('call_ABC123DEF456GHI789JKL012M', 'session-456');
      
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('already');
    });

    it('should enforce session ID limits', () => {
      const sessionId = 'test-session';
      const maxIds = ID_MANAGEMENT_LIMITS.MAX_IDS_PER_SESSION;
      
      // Add maximum allowed IDs
      for (let i = 0; i < maxIds; i++) {
        const id = `call_${'A'.repeat(22)}${i.toString().padStart(3, '0')}`;
        const result = tracker.addId(id, sessionId);
        expect(result.success).toBe(true);
      }
      
      // Try to add one more - should fail
      const overLimitResult = tracker.addId('call_OVERLIMIT1234567890123456', sessionId);
      expect(overLimitResult.success).toBe(false);
      expect(overLimitResult.errors[0]).toContain('Cannot track more than');
    });

    it('should handle tracking exceptions gracefully', () => {
      // Test with a session ID that could cause issues
      const result = tracker.addId('call_ABC123DEF456GHI789JKL012M', 'x'.repeat(200));
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('hasId', () => {
    it('should return true for tracked ID', () => {
      tracker.addId('call_ABC123DEF456GHI789JKL012M');
      
      expect(tracker.hasId('call_ABC123DEF456GHI789JKL012M')).toBe(true);
    });

    it('should return false for untracked ID', () => {
      expect(tracker.hasId('call_ABC123DEF456GHI789JKL012M')).toBe(false);
    });

    it('should return false for invalid ID', () => {
      expect(tracker.hasId('invalid_id')).toBe(false);
    });
  });

  describe('getIds', () => {
    beforeEach(() => {
      tracker.addId('call_ABC123DEF456GHI789JKL012M', 'session-1');
      tracker.addId('call_DEF456GHI789JKL012MNO345A', 'session-1');
      tracker.addId('call_GHI789JKL012MNO345ABC678D', 'session-2');
      tracker.addId('call_JKL012MNO345ABC678DEF901G');
    });

    it('should get all IDs for specific session', () => {
      const session1Ids = tracker.getIds('session-1');
      
      expect(session1Ids).toHaveLength(2);
      expect(session1Ids).toContain('call_ABC123DEF456GHI789JKL012M');
      expect(session1Ids).toContain('call_DEF456GHI789JKL012MNO345A');
    });

    it('should get all IDs when no session specified', () => {
      const allIds = tracker.getIds();
      
      expect(allIds).toHaveLength(4);
      expect(allIds).toContain('call_ABC123DEF456GHI789JKL012M');
      expect(allIds).toContain('call_JKL012MNO345ABC678DEF901G');
    });

    it('should return empty array for session with no IDs', () => {
      const emptySession = tracker.getIds('empty-session');
      
      expect(emptySession).toEqual([]);
    });

    it('should return empty array for nonexistent session', () => {
      const nonexistent = tracker.getIds('does-not-exist');
      
      expect(nonexistent).toEqual([]);
    });
  });

  describe('removeId', () => {
    beforeEach(() => {
      tracker.addId('call_ABC123DEF456GHI789JKL012M', 'session-123');
    });

    it('should remove tracked ID successfully', () => {
      const result = tracker.removeId('call_ABC123DEF456GHI789JKL012M');
      
      expect(result.success).toBe(true);
      expect(result.id).toBe('call_ABC123DEF456GHI789JKL012M');
      expect(result.sessionId).toBe('session-123');
      expect(tracker.hasId('call_ABC123DEF456GHI789JKL012M')).toBe(false);
    });

    it('should handle removing untracked ID', () => {
      const result = tracker.removeId('call_UNTRACKED1234567890123456');
      
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not being tracked');
    });

    it('should clean up session data when removing last ID', () => {
      tracker.removeId('call_ABC123DEF456GHI789JKL012M');
      
      const sessionIds = tracker.getIds('session-123');
      expect(sessionIds).toEqual([]);
    });

    it('should handle removal exceptions', () => {
      // Remove the ID first
      tracker.removeId('call_ABC123DEF456GHI789JKL012M');
      
      // Try to remove again
      const result = tracker.removeId('call_ABC123DEF456GHI789JKL012M');
      expect(result.success).toBe(false);
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      tracker.addId('call_ABC123DEF456GHI789JKL012M', 'session-1');
      tracker.addId('call_DEF456GHI789JKL012MNO345A', 'session-1');
      tracker.addId('call_GHI789JKL012MNO345ABC678D', 'session-2');
      tracker.addId('call_JKL012MNO345ABC678DEF901G');
    });

    it('should clear specific session', () => {
      tracker.clear('session-1');
      
      expect(tracker.getIds('session-1')).toEqual([]);
      expect(tracker.getIds('session-2')).toHaveLength(1);
      expect(tracker.getIds()).toHaveLength(2); // session-2 + no-session IDs
    });

    it('should clear all data when no session specified', () => {
      tracker.clear();
      
      expect(tracker.getIds()).toEqual([]);
      expect(tracker.getIds('session-1')).toEqual([]);
      expect(tracker.getIds('session-2')).toEqual([]);
    });

    it('should handle clearing nonexistent session', () => {
      tracker.clear('nonexistent-session');
      
      // Should not affect existing data
      expect(tracker.getIds('session-1')).toHaveLength(2);
    });
  });

  describe('ToolCallIDTracker specific methods', () => {
    let concreteTracker: ToolCallIDTracker;

    beforeEach(() => {
      concreteTracker = new ToolCallIDTracker();
    });

    describe('getTrackingStats', () => {
      it('should return accurate tracking statistics', () => {
        concreteTracker.addId('call_ABC123DEF456GHI789JKL012M', 'session-1');
        concreteTracker.addId('call_DEF456GHI789JKL012MNO345A', 'session-1');
        concreteTracker.addId('call_GHI789JKL012MNO345ABC678D', 'session-2');
        
        const stats = concreteTracker.getTrackingStats();
        
        expect(stats.totalTrackedIds).toBe(3);
        expect(stats.totalSessions).toBe(2);
        expect(stats.averageIdsPerSession).toBe(1.5);
      });

      it('should handle empty tracker stats', () => {
        const stats = concreteTracker.getTrackingStats();
        
        expect(stats.totalTrackedIds).toBe(0);
        expect(stats.totalSessions).toBe(0);
        expect(stats.averageIdsPerSession).toBe(0);
      });
    });

    describe('getSessionForId', () => {
      beforeEach(() => {
        concreteTracker.addId('call_ABC123DEF456GHI789JKL012M', 'session-123');
        concreteTracker.addId('call_DEF456GHI789JKL012MNO345A');
      });

      it('should return session for tracked ID', () => {
        const session = concreteTracker.getSessionForId('call_ABC123DEF456GHI789JKL012M');
        expect(session).toBe('session-123');
      });

      it('should return null for ID without session', () => {
        const session = concreteTracker.getSessionForId('call_DEF456GHI789JKL012MNO345A');
        expect(session).toBeNull();
      });

      it('should return null for untracked ID', () => {
        const session = concreteTracker.getSessionForId('call_UNTRACKED1234567890123456');
        expect(session).toBeNull();
      });
    });

    describe('hasSession', () => {
      beforeEach(() => {
        concreteTracker.addId('call_ABC123DEF456GHI789JKL012M', 'session-123');
      });

      it('should return true for existing session', () => {
        expect(concreteTracker.hasSession('session-123')).toBe(true);
      });

      it('should return false for nonexistent session', () => {
        expect(concreteTracker.hasSession('nonexistent')).toBe(false);
      });
    });
  });
});

describe('IDTrackingUtils', () => {
  describe('validateSessionId', () => {
    it('should validate correct session IDs', () => {
      expect(IDTrackingUtils.validateSessionId('session-123')).toBe(true);
      expect(IDTrackingUtils.validateSessionId('valid-session')).toBe(true);
      expect(IDTrackingUtils.validateSessionId('a')).toBe(true);
    });

    it('should reject invalid session IDs', () => {
      expect(IDTrackingUtils.validateSessionId('')).toBe(false);
      expect(IDTrackingUtils.validateSessionId('x'.repeat(101))).toBe(false);
      expect(IDTrackingUtils.validateSessionId(null as any)).toBe(false);
      expect(IDTrackingUtils.validateSessionId(123 as any)).toBe(false);
    });
  });

  describe('validateToolCallId', () => {
    it('should validate correct tool call IDs', () => {
      expect(IDTrackingUtils.validateToolCallId('call_ABC123DEF456GHI789JKL012M')).toBe(true);
      expect(IDTrackingUtils.validateToolCallId('call_' + 'A'.repeat(25))).toBe(true);
    });

    it('should reject invalid tool call IDs', () => {
      expect(IDTrackingUtils.validateToolCallId('invalid_id')).toBe(false);
      expect(IDTrackingUtils.validateToolCallId('call_short')).toBe(false);
      expect(IDTrackingUtils.validateToolCallId('wrong_ABC123DEF456GHI789JKL012MN')).toBe(false);
      expect(IDTrackingUtils.validateToolCallId('')).toBe(false);
      expect(IDTrackingUtils.validateToolCallId(null as any)).toBe(false);
    });
  });

  describe('createTrackingKey', () => {
    it('should create key with session', () => {
      const key = IDTrackingUtils.createTrackingKey('call_ABC123', 'session-123');
      expect(key).toBe('session-123:call_ABC123');
    });

    it('should create key without session', () => {
      const key = IDTrackingUtils.createTrackingKey('call_ABC123');
      expect(key).toBe('call_ABC123');
    });
  });

  describe('extractSessionFromKey', () => {
    it('should extract session from key with session', () => {
      const session = IDTrackingUtils.extractSessionFromKey('session-123:call_ABC123');
      expect(session).toBe('session-123');
    });

    it('should return null for key without session', () => {
      const session = IDTrackingUtils.extractSessionFromKey('call_ABC123');
      expect(session).toBeNull();
    });
  });

  describe('extractIdFromKey', () => {
    it('should extract ID from key with session', () => {
      const id = IDTrackingUtils.extractIdFromKey('session-123:call_ABC123');
      expect(id).toBe('call_ABC123');
    });

    it('should extract ID from key without session', () => {
      const id = IDTrackingUtils.extractIdFromKey('call_ABC123');
      expect(id).toBe('call_ABC123');
    });
  });
});

describe('IDTrackingError', () => {
  it('should create error with all properties', () => {
    const error = new IDTrackingError(
      'Test error',
      'TEST_CODE',
      'test-id',
      'session-123'
    );
    
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.id).toBe('test-id');
    expect(error.sessionId).toBe('session-123');
    expect(error.name).toBe('IDTrackingError');
  });

  it('should work with minimal parameters', () => {
    const error = new IDTrackingError('Test error', 'TEST_CODE');
    
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.id).toBeUndefined();
    expect(error.sessionId).toBeUndefined();
  });
});

describe('Performance Tests', () => {
  it('should handle large numbers of IDs efficiently', () => {
    const tracker = new ToolCallIDTracker();
    const count = 1000;
    
    const startTime = performance.now();
    
    for (let i = 0; i < count; i++) {
      const id = `call_${'A'.repeat(21)}${i.toString().padStart(4, '0')}`;
      const result = tracker.addId(id, `session-${i % 10}`);
      expect(result.success).toBe(true);
    }
    
    const duration = performance.now() - startTime;
    
    expect(tracker.getIds()).toHaveLength(count);
    expect(duration).toBeLessThan(100); // Should be very fast
  });

  it('should handle tracking operations within time limits', () => {
    const tracker = new ToolCallIDTracker();
    
    const startTime = performance.now();
    const result = tracker.addId('call_ABC123DEF456GHI789JKL012M', 'session-123');
    const duration = performance.now() - startTime;
    
    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(ID_MANAGEMENT_LIMITS.TRACKING_TIMEOUT_MS + 1); // Small buffer
  });

  it('should maintain performance with multiple sessions', () => {
    const tracker = new ToolCallIDTracker();
    const sessionCount = 100;
    const idsPerSession = 10;
    
    const startTime = performance.now();
    
    for (let s = 0; s < sessionCount; s++) {
      for (let i = 0; i < idsPerSession; i++) {
        const id = `call_S${s.toString().padStart(2, '0')}I${i.toString().padStart(2, '0')}${'A'.repeat(19)}`;
        tracker.addId(id, `session-${s}`);
      }
    }
    
    const duration = performance.now() - startTime;
    
    expect(tracker.getIds()).toHaveLength(sessionCount * idsPerSession);
    expect(duration).toBeLessThan(500); // Should handle many sessions efficiently
  });

  it('should handle concurrent operations', () => {
    const tracker = new ToolCallIDTracker();
    
    const operations = Array(50).fill(null).map((_, i) => () => {
      const id = `call_CONC${i.toString().padStart(2, '0')}${'A'.repeat(19)}`;
      return tracker.addId(id, `session-${i % 5}`);
    });
    
    const startTime = performance.now();
    const results = operations.map(op => op());
    const duration = performance.now() - startTime;
    
    expect(results.every(r => r.success)).toBe(true);
    expect(duration).toBeLessThan(50); // Should handle concurrent ops quickly
  });
});