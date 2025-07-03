/**
 * Session Models for Claude Code Chat Continuity
 * Based on Python models.py:157-166 (SessionInfo, SessionListResponse)
 * Provides session management with Zod validation
 */

import { z } from 'zod';

/**
 * Session info schema
 * Based on Python SessionInfo class
 */
export const SessionInfoSchema = z.object({
  session_id: z.string(),
  created_at: z.date(),
  last_accessed: z.date(),
  message_count: z.number().int().nonnegative(),
  expires_at: z.date()
});

export type SessionInfo = z.infer<typeof SessionInfoSchema>;

/**
 * Session list response schema
 * Based on Python SessionListResponse class
 */
export const SessionListResponseSchema = z.object({
  sessions: z.array(SessionInfoSchema),
  total: z.number().int().nonnegative()
});

export type SessionListResponse = z.infer<typeof SessionListResponseSchema>;

/**
 * Session creation options
 */
export const SessionCreateOptionsSchema = z.object({
  session_id: z.string().optional(),
  expires_in_minutes: z.number().int().positive().default(60 * 24), // 24 hours default
  metadata: z.record(z.string(), z.any()).optional()
});

export type SessionCreateOptions = z.infer<typeof SessionCreateOptionsSchema>;

/**
 * Session utilities
 */
export const SessionUtils = {
  /**
   * Generate a new session ID
   */
  generateSessionId: (): string => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `session_${timestamp}_${random}`;
  },

  /**
   * Create a new session
   */
  createSession: (options: Partial<SessionCreateOptions> = {}): SessionInfo => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (options.expires_in_minutes || 1440) * 60 * 1000);
    
    return {
      session_id: options.session_id || SessionUtils.generateSessionId(),
      created_at: now,
      last_accessed: now,
      message_count: 0,
      expires_at: expiresAt
    };
  },

  /**
   * Check if session is expired
   */
  isExpired: (session: SessionInfo): boolean => {
    return new Date() > session.expires_at;
  },

  /**
   * Update session with new message
   */
  updateSession: (session: SessionInfo): SessionInfo => {
    return {
      ...session,
      last_accessed: new Date(),
      message_count: session.message_count + 1
    };
  },

  /**
   * Extend session expiration
   */
  extendSession: (session: SessionInfo, minutes: number): SessionInfo => {
    const newExpiresAt = new Date(session.expires_at.getTime() + minutes * 60 * 1000);
    
    return {
      ...session,
      expires_at: newExpiresAt
    };
  },

  /**
   * Create session list response
   */
  createSessionList: (sessions: SessionInfo[]): SessionListResponse => {
    return {
      sessions,
      total: sessions.length
    };
  },

  /**
   * Filter active sessions (not expired)
   */
  filterActiveSessions: (sessions: SessionInfo[]): SessionInfo[] => {
    return sessions.filter(session => !SessionUtils.isExpired(session));
  },

  /**
   * Sort sessions by last accessed (most recent first)
   */
  sortByLastAccessed: (sessions: SessionInfo[]): SessionInfo[] => {
    return [...sessions].sort((a, b) => b.last_accessed.getTime() - a.last_accessed.getTime());
  },

  /**
   * Validate session info
   */
  validateSession: (session: unknown): SessionInfo => {
    return SessionInfoSchema.parse(session);
  },

  /**
   * Validate session list response
   */
  validateSessionList: (response: unknown): SessionListResponse => {
    return SessionListResponseSchema.parse(response);
  },

  /**
   * Convert session to serializable format
   */
  toSerializable: (session: SessionInfo): Record<string, any> => {
    return {
      session_id: session.session_id,
      created_at: session.created_at.toISOString(),
      last_accessed: session.last_accessed.toISOString(),
      message_count: session.message_count,
      expires_at: session.expires_at.toISOString()
    };
  },

  /**
   * Parse session from serializable format
   */
  fromSerializable: (data: Record<string, any>): SessionInfo => {
    return {
      session_id: data.session_id,
      created_at: new Date(data.created_at),
      last_accessed: new Date(data.last_accessed),
      message_count: data.message_count,
      expires_at: new Date(data.expires_at)
    };
  }
};

/**
 * Session storage interface
 */
export interface SessionStorage {
  /**
   * Store a session
   */
  store(session: SessionInfo): Promise<void>;

  /**
   * Retrieve a session by ID
   */
  get(sessionId: string): Promise<SessionInfo | null>;

  /**
   * Update an existing session
   */
  update(session: SessionInfo): Promise<void>;

  /**
   * Delete a session
   */
  delete(sessionId: string): Promise<void>;

  /**
   * List all sessions
   */
  list(): Promise<SessionInfo[]>;

  /**
   * Clean up expired sessions
   */
  cleanup(): Promise<number>;
}

/**
 * In-memory session storage implementation
 */
export class MemorySessionStorage implements SessionStorage {
  private sessions = new Map<string, SessionInfo>();

  async store(session: SessionInfo): Promise<void> {
    this.sessions.set(session.session_id, session);
  }

  async get(sessionId: string): Promise<SessionInfo | null> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }
    
    if (SessionUtils.isExpired(session)) {
      this.sessions.delete(sessionId);
      return null;
    }
    
    return session;
  }

  async update(session: SessionInfo): Promise<void> {
    if (this.sessions.has(session.session_id)) {
      this.sessions.set(session.session_id, session);
    }
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async list(): Promise<SessionInfo[]> {
    const allSessions = Array.from(this.sessions.values());
    return SessionUtils.filterActiveSessions(allSessions);
  }

  async cleanup(): Promise<number> {
    let cleaned = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (SessionUtils.isExpired(session)) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }
    
    return cleaned;
  }
}
