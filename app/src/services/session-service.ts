/**
 * Phase 16A: Basic session service without tool execution state
 */

export interface SessionInfo {
  id: string;
  created: Date;
  lastActivity: Date;
  messageCount: number;
}

export class SessionService {
  private sessions = new Map<string, SessionInfo>();

  createSession(id: string): SessionInfo {
    const session: SessionInfo = {
      id,
      created: new Date(),
      lastActivity: new Date(),
      messageCount: 0
    };
    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string): SessionInfo | undefined {
    return this.sessions.get(id);
  }

  updateSession(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.lastActivity = new Date();
      session.messageCount++;
    }
  }

  deleteSession(id: string): boolean {
    return this.sessions.delete(id);
  }

  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  // Additional methods for interface compatibility
  listSessions(): SessionInfo[] {
    return this.getAllSessions();
  }

  getConfig(): any {
    return { maxSessions: 1000, ttl: 3600000 };
  }

  getSessionStats(): any {
    return {
      total: this.getSessionCount(),
      active: this.getSessionCount()
    };
  }

  getExpiredSessionCount(): number {
    return 0; // No expiration logic in basic implementation
  }

  cleanupExpiredSessions(): number {
    return 0; // No cleanup in basic implementation
  }

  validateSessionId(id: string): boolean {
    return typeof id === 'string' && id.length > 0;
  }

  createSessionFromRequest(req: any): SessionInfo {
    const id = req.body?.session_id || `session_${Date.now()}`;
    return this.createSession(id);
  }
}

export const sessionService = new SessionService();