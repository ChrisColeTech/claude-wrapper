/**
 * Mock session repository - FOR TESTING ONLY
 * Used to isolate tests from actual storage implementation
 */

export interface SessionData {
  session_id: string;
  created_at: string;
  last_accessed: string;
  message_count: number;
  expires_at: string;
}

export class MockSessionRepository {
  private sessions = new Map<string, SessionData>();
  
  async create(sessionData: Omit<SessionData, 'created_at' | 'last_accessed'>): Promise<SessionData> {
    const now = new Date().toISOString();
    const session: SessionData = {
      ...sessionData,
      created_at: now,
      last_accessed: now
    };
    this.sessions.set(session.session_id, session);
    return session;
  }
  
  async findById(sessionId: string): Promise<SessionData | null> {
    return this.sessions.get(sessionId) || null;
  }
  
  async delete(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }
  
  async list(): Promise<SessionData[]> {
    return Array.from(this.sessions.values());
  }
  
  clear(): void {
    this.sessions.clear();
  }
}
