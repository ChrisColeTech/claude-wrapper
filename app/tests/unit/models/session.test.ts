/**
 * Unit tests for Session Models
 * Tests src/models/session.ts components
 * Based on Python models.py:157-166 validation patterns
 */

import { 
  SessionInfoSchema,
  SessionListResponseSchema,
  SessionCreateOptionsSchema,
  SessionUtils,
  MemorySessionStorage,
  type SessionInfo,
  type SessionListResponse,
  type SessionCreateOptions,
  type SessionStorage
} from '../../../src/models/session';

describe('Session Models', () => {
  describe('SessionInfoSchema', () => {
    const baseSession = {
      session_id: "session_123",
      created_at: new Date(),
      last_accessed: new Date(),
      message_count: 0,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    it('should validate valid session info', () => {
      const result = SessionInfoSchema.parse(baseSession);
      
      expect(result.session_id).toBe("session_123");
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.last_accessed).toBeInstanceOf(Date);
      expect(result.message_count).toBe(0);
      expect(result.expires_at).toBeInstanceOf(Date);
    });

    it('should reject negative message count', () => {
      const invalidSession = {
        ...baseSession,
        message_count: -1
      };
      
      expect(() => SessionInfoSchema.parse(invalidSession)).toThrow();
    });

    it('should reject non-integer message count', () => {
      const invalidSession = {
        ...baseSession,
        message_count: 3.14
      };
      
      expect(() => SessionInfoSchema.parse(invalidSession)).toThrow();
    });

    it('should reject missing required fields', () => {
      const requiredFields = ['session_id', 'created_at', 'last_accessed', 'message_count', 'expires_at'];
      
      for (const field of requiredFields) {
        const invalidSession = { ...baseSession };
        delete (invalidSession as any)[field];
        
        expect(() => SessionInfoSchema.parse(invalidSession)).toThrow();
      }
    });
  });

  describe('SessionListResponseSchema', () => {
    it('should validate valid session list response', () => {
      const sessionList = {
        sessions: [
          {
            session_id: "session_1",
            created_at: new Date(),
            last_accessed: new Date(),
            message_count: 5,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        ],
        total: 1
      };
      
      const result = SessionListResponseSchema.parse(sessionList);
      
      expect(result.sessions).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should validate empty session list', () => {
      const emptyList = {
        sessions: [],
        total: 0
      };
      
      const result = SessionListResponseSchema.parse(emptyList);
      
      expect(result.sessions).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should reject negative total', () => {
      const invalidList = {
        sessions: [],
        total: -1
      };
      
      expect(() => SessionListResponseSchema.parse(invalidList)).toThrow();
    });
  });

  describe('SessionCreateOptionsSchema', () => {
    it('should validate minimal options', () => {
      const result = SessionCreateOptionsSchema.parse({});
      
      expect(result.expires_in_minutes).toBe(60 * 24); // 24 hours default
      expect(result.session_id).toBeUndefined();
      expect(result.metadata).toBeUndefined();
    });

    it('should validate complete options', () => {
      const options = {
        session_id: "custom_session_id",
        expires_in_minutes: 120,
        metadata: { user: "test_user", project: "test_project" }
      };
      
      const result = SessionCreateOptionsSchema.parse(options);
      
      expect(result.session_id).toBe("custom_session_id");
      expect(result.expires_in_minutes).toBe(120);
      expect(result.metadata).toEqual({ user: "test_user", project: "test_project" });
    });

    it('should reject negative expires_in_minutes', () => {
      const invalidOptions = {
        expires_in_minutes: -1
      };
      
      expect(() => SessionCreateOptionsSchema.parse(invalidOptions)).toThrow();
    });

    it('should reject zero expires_in_minutes', () => {
      const invalidOptions = {
        expires_in_minutes: 0
      };
      
      expect(() => SessionCreateOptionsSchema.parse(invalidOptions)).toThrow();
    });
  });

  describe('SessionUtils', () => {
    describe('generateSessionId', () => {
      it('should generate unique session IDs', () => {
        const id1 = SessionUtils.generateSessionId();
        const id2 = SessionUtils.generateSessionId();
        
        expect(id1).not.toBe(id2);
        expect(id1).toMatch(/^session_[a-z0-9]+_[a-z0-9]+$/);
        expect(id2).toMatch(/^session_[a-z0-9]+_[a-z0-9]+$/);
      });

      it('should generate IDs with consistent format', () => {
        for (let i = 0; i < 10; i++) {
          const id = SessionUtils.generateSessionId();
          expect(id).toMatch(/^session_[a-z0-9]+_[a-z0-9]+$/);
        }
      });
    });

    describe('createSession', () => {
      it('should create session with default options', () => {
        const session = SessionUtils.createSession();
        
        expect(session.session_id).toMatch(/^session_/);
        expect(session.created_at).toBeInstanceOf(Date);
        expect(session.last_accessed).toBeInstanceOf(Date);
        expect(session.message_count).toBe(0);
        expect(session.expires_at).toBeInstanceOf(Date);
        
        // Should expire in approximately 24 hours
        const expiresIn = session.expires_at.getTime() - session.created_at.getTime();
        expect(expiresIn).toBeCloseTo(24 * 60 * 60 * 1000, -4); // Within 10 seconds
      });

      it('should create session with custom options', () => {
        const options: SessionCreateOptions = {
          session_id: "custom_id",
          expires_in_minutes: 60,
          enable_tool_state_tracking: true,
          metadata: { test: "value" }
        };
        
        const session = SessionUtils.createSession(options);
        
        expect(session.session_id).toBe("custom_id");
        
        // Should expire in approximately 1 hour
        const expiresIn = session.expires_at.getTime() - session.created_at.getTime();
        expect(expiresIn).toBeCloseTo(60 * 60 * 1000, -3); // Within 1 second
      });
    });

    describe('isExpired', () => {
      it('should return false for unexpired session', () => {
        const session = SessionUtils.createSession({ expires_in_minutes: 60 });
        
        expect(SessionUtils.isExpired(session)).toBe(false);
      });

      it('should return true for expired session', () => {
        const expiredSession: SessionInfo = {
          session_id: "expired_session",
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          last_accessed: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
          message_count: 5,
          expires_at: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
        };
        
        expect(SessionUtils.isExpired(expiredSession)).toBe(true);
      });
    });

    describe('updateSession', () => {
      it('should update last_accessed and increment message_count', () => {
        const originalSession = SessionUtils.createSession();
        
        // Wait a small amount to ensure different timestamps
        setTimeout(() => {
          const updatedSession = SessionUtils.updateSession(originalSession);
          
          expect(updatedSession.session_id).toBe(originalSession.session_id);
          expect(updatedSession.message_count).toBe(originalSession.message_count + 1);
          expect(updatedSession.last_accessed.getTime()).toBeGreaterThan(originalSession.last_accessed.getTime());
          expect(updatedSession.created_at).toBe(originalSession.created_at);
          expect(updatedSession.expires_at).toBe(originalSession.expires_at);
        }, 1);
      });
    });

    describe('extendSession', () => {
      it('should extend session expiration', () => {
        const session = SessionUtils.createSession({ expires_in_minutes: 60 });
        const extendedSession = SessionUtils.extendSession(session, 30);
        
        const expectedExpiration = session.expires_at.getTime() + 30 * 60 * 1000;
        expect(extendedSession.expires_at.getTime()).toBe(expectedExpiration);
        
        // Other fields should remain unchanged
        expect(extendedSession.session_id).toBe(session.session_id);
        expect(extendedSession.created_at).toBe(session.created_at);
        expect(extendedSession.last_accessed).toBe(session.last_accessed);
        expect(extendedSession.message_count).toBe(session.message_count);
      });
    });

    describe('createSessionList', () => {
      it('should create session list response', () => {
        const sessions = [
          SessionUtils.createSession(),
          SessionUtils.createSession(),
          SessionUtils.createSession()
        ];
        
        const sessionList = SessionUtils.createSessionList(sessions);
        
        expect(sessionList.sessions).toEqual(sessions);
        expect(sessionList.total).toBe(3);
      });

      it('should handle empty session list', () => {
        const sessionList = SessionUtils.createSessionList([]);
        
        expect(sessionList.sessions).toEqual([]);
        expect(sessionList.total).toBe(0);
      });
    });

    describe('filterActiveSessions', () => {
      it('should filter out expired sessions', () => {
        const activeSessions = [
          SessionUtils.createSession({ expires_in_minutes: 60 }),
          SessionUtils.createSession({ expires_in_minutes: 120 })
        ];
        
        const expiredSession: SessionInfo = {
          session_id: "expired",
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
          last_accessed: new Date(Date.now() - 1 * 60 * 60 * 1000),
          message_count: 1,
          expires_at: new Date(Date.now() - 30 * 60 * 1000)
        };
        
        const allSessions = [...activeSessions, expiredSession];
        const filtered = SessionUtils.filterActiveSessions(allSessions);
        
        expect(filtered).toHaveLength(2);
        expect(filtered).toEqual(activeSessions);
      });
    });

    describe('sortByLastAccessed', () => {
      it('should sort sessions by last accessed time', () => {
        const now = Date.now();
        const sessions: SessionInfo[] = [
          {
            session_id: "old",
            created_at: new Date(now - 3 * 60 * 60 * 1000),
            last_accessed: new Date(now - 2 * 60 * 60 * 1000), // 2 hours ago
            message_count: 1,
            expires_at: new Date(now + 60 * 60 * 1000)
          },
          {
            session_id: "recent",
            created_at: new Date(now - 1 * 60 * 60 * 1000),
            last_accessed: new Date(now - 5 * 60 * 1000), // 5 minutes ago
            message_count: 2,
            expires_at: new Date(now + 60 * 60 * 1000)
          },
          {
            session_id: "newest",
            created_at: new Date(now - 30 * 60 * 1000),
            last_accessed: new Date(now - 1 * 60 * 1000), // 1 minute ago
            message_count: 3,
            expires_at: new Date(now + 60 * 60 * 1000)
          }
        ];
        
        const sorted = SessionUtils.sortByLastAccessed(sessions);
        
        expect(sorted[0].session_id).toBe("newest");
        expect(sorted[1].session_id).toBe("recent");
        expect(sorted[2].session_id).toBe("old");
      });
    });

    describe('serialization methods', () => {
      it('should serialize and deserialize session correctly', () => {
        const originalSession = SessionUtils.createSession({
          session_id: "test_session",
          expires_in_minutes: 120
        });
        
        const serialized = SessionUtils.toSerializable(originalSession);
        const deserialized = SessionUtils.fromSerializable(serialized);
        
        expect(deserialized.session_id).toBe(originalSession.session_id);
        expect(deserialized.created_at.toISOString()).toBe(originalSession.created_at.toISOString());
        expect(deserialized.last_accessed.toISOString()).toBe(originalSession.last_accessed.toISOString());
        expect(deserialized.message_count).toBe(originalSession.message_count);
        expect(deserialized.expires_at.toISOString()).toBe(originalSession.expires_at.toISOString());
      });
    });

    describe('validation methods', () => {
      it('should validate valid session', () => {
        const session = SessionUtils.createSession();
        
        expect(() => SessionUtils.validateSession(session)).not.toThrow();
      });

      it('should validate valid session list', () => {
        const sessionList = SessionUtils.createSessionList([
          SessionUtils.createSession(),
          SessionUtils.createSession()
        ]);
        
        expect(() => SessionUtils.validateSessionList(sessionList)).not.toThrow();
      });
    });
  });

  describe('MemorySessionStorage', () => {
    let storage: MemorySessionStorage;

    beforeEach(() => {
      storage = new MemorySessionStorage();
    });

    describe('store and get', () => {
      it('should store and retrieve session', async () => {
        const session = SessionUtils.createSession({ session_id: "test_session" });
        
        await storage.store(session);
        const retrieved = await storage.get("test_session");
        
        expect(retrieved).toEqual(session);
      });

      it('should return null for non-existent session', async () => {
        const retrieved = await storage.get("non_existent");
        
        expect(retrieved).toBeNull();
      });

      it('should return null for expired session and clean up', async () => {
        const expiredSession: SessionInfo = {
          session_id: "expired_session",
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
          last_accessed: new Date(Date.now() - 1 * 60 * 60 * 1000),
          message_count: 1,
          expires_at: new Date(Date.now() - 30 * 60 * 1000) // Expired 30 minutes ago
        };
        
        await storage.store(expiredSession);
        const retrieved = await storage.get("expired_session");
        
        expect(retrieved).toBeNull();
        
        // Should have been cleaned up
        const retrievedAgain = await storage.get("expired_session");
        expect(retrievedAgain).toBeNull();
      });
    });

    describe('update', () => {
      it('should update existing session', async () => {
        const session = SessionUtils.createSession({ session_id: "test_session" });
        await storage.store(session);
        
        const updatedSession = SessionUtils.updateSession(session);
        await storage.update(updatedSession);
        
        const retrieved = await storage.get("test_session");
        expect(retrieved?.message_count).toBe(1);
      });

      it('should not update non-existent session', async () => {
        const session = SessionUtils.createSession({ session_id: "non_existent" });
        
        await storage.update(session);
        const retrieved = await storage.get("non_existent");
        
        expect(retrieved).toBeNull();
      });
    });

    describe('delete', () => {
      it('should delete existing session', async () => {
        const session = SessionUtils.createSession({ session_id: "test_session" });
        await storage.store(session);
        
        await storage.delete("test_session");
        const retrieved = await storage.get("test_session");
        
        expect(retrieved).toBeNull();
      });

      it('should handle deleting non-existent session gracefully', async () => {
        await expect(storage.delete("non_existent")).resolves.not.toThrow();
      });
    });

    describe('list', () => {
      it('should list all active sessions', async () => {
        const sessions = [
          SessionUtils.createSession({ session_id: "session_1" }),
          SessionUtils.createSession({ session_id: "session_2" }),
          SessionUtils.createSession({ session_id: "session_3" })
        ];
        
        for (const session of sessions) {
          await storage.store(session);
        }
        
        const listed = await storage.list();
        
        expect(listed).toHaveLength(3);
        
        const sessionIds = listed.map(s => s.session_id);
        expect(sessionIds).toContain("session_1");
        expect(sessionIds).toContain("session_2");
        expect(sessionIds).toContain("session_3");
      });

      it('should not list expired sessions', async () => {
        const activeSession = SessionUtils.createSession({ session_id: "active" });
        
        const expiredSession: SessionInfo = {
          session_id: "expired",
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
          last_accessed: new Date(Date.now() - 1 * 60 * 60 * 1000),
          message_count: 1,
          expires_at: new Date(Date.now() - 30 * 60 * 1000)
        };
        
        await storage.store(activeSession);
        await storage.store(expiredSession);
        
        const listed = await storage.list();
        
        expect(listed).toHaveLength(1);
        expect(listed[0].session_id).toBe("active");
      });
    });

    describe('cleanup', () => {
      it('should remove expired sessions and return count', async () => {
        const activeSessions = [
          SessionUtils.createSession({ session_id: "active_1" }),
          SessionUtils.createSession({ session_id: "active_2" })
        ];
        
        const expiredSessions: SessionInfo[] = [
          {
            session_id: "expired_1",
            created_at: new Date(Date.now() - 3 * 60 * 60 * 1000),
            last_accessed: new Date(Date.now() - 2 * 60 * 60 * 1000),
            message_count: 1,
            expires_at: new Date(Date.now() - 60 * 60 * 1000)
          },
          {
            session_id: "expired_2",
            created_at: new Date(Date.now() - 4 * 60 * 60 * 1000),
            last_accessed: new Date(Date.now() - 3 * 60 * 60 * 1000),
            message_count: 2,
            expires_at: new Date(Date.now() - 2 * 60 * 60 * 1000)
          }
        ];
        
        for (const session of [...activeSessions, ...expiredSessions]) {
          await storage.store(session);
        }
        
        const cleanedCount = await storage.cleanup();
        
        expect(cleanedCount).toBe(2);
        
        // Only active sessions should remain
        const remaining = await storage.list();
        expect(remaining).toHaveLength(2);
        
        const remainingIds = remaining.map(s => s.session_id);
        expect(remainingIds).toContain("active_1");
        expect(remainingIds).toContain("active_2");
      });

      it('should return 0 when no sessions need cleanup', async () => {
        const cleanedCount = await storage.cleanup();
        expect(cleanedCount).toBe(0);
      });
    });
  });

  describe('Integration tests', () => {
    it('should work with complete session workflow', async () => {
      const storage = new MemorySessionStorage();
      
      // Create and store a session
      const session = SessionUtils.createSession({
        session_id: "workflow_test",
        expires_in_minutes: 60
      });
      
      await storage.store(session);
      
      // Retrieve and validate
      const retrieved = await storage.get("workflow_test");
      expect(retrieved).toBeTruthy();
      expect(SessionUtils.validateSession(retrieved!)).toBeTruthy();
      
      // Update session with message
      const updated = SessionUtils.updateSession(retrieved!);
      await storage.update(updated);
      
      // Verify update
      const afterUpdate = await storage.get("workflow_test");
      expect(afterUpdate!.message_count).toBe(1);
      
      // List sessions
      const sessionList = await storage.list();
      expect(sessionList).toHaveLength(1);
      
      // Create session list response
      const listResponse = SessionUtils.createSessionList(sessionList);
      expect(SessionUtils.validateSessionList(listResponse)).toBeTruthy();
      
      // Cleanup (should not remove active session)
      const cleaned = await storage.cleanup();
      expect(cleaned).toBe(0);
      
      // Delete session
      await storage.delete("workflow_test");
      const afterDelete = await storage.get("workflow_test");
      expect(afterDelete).toBeNull();
    });
  });
});