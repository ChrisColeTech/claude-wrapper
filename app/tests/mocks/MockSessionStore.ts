/**
 * Mock session store for testing
 * In-memory session storage without TTL complexity
 */

export interface MockSession {
  id: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
  }>;
  model: string;
  created_at: number;
  updated_at: number;
  provider: string;
}

export class MockSessionStore {
  private sessions = new Map<string, MockSession>();

  async create(sessionId: string, model: string, provider: string): Promise<MockSession> {
    const session: MockSession = {
      id: sessionId,
      messages: [],
      model,
      created_at: Date.now(),
      updated_at: Date.now(),
      provider
    };
    
    this.sessions.set(sessionId, session);
    return { ...session };
  }

  async get(sessionId: string): Promise<MockSession | null> {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : null;
  }

  async update(sessionId: string, updates: Partial<MockSession>): Promise<MockSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const updatedSession = {
      ...session,
      ...updates,
      updated_at: Date.now()
    };
    
    this.sessions.set(sessionId, updatedSession);
    return { ...updatedSession };
  }

  async addMessage(sessionId: string, role: 'user' | 'assistant' | 'system', content: string): Promise<MockSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.messages.push({
      role,
      content,
      timestamp: Date.now()
    });
    session.updated_at = Date.now();
    
    return { ...session };
  }

  async delete(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }

  async cleanup(): Promise<number> {
    // Mock cleanup - in real implementation would clean expired sessions
    return 0;
  }

  async list(): Promise<MockSession[]> {
    return Array.from(this.sessions.values()).map(session => ({ ...session }));
  }

  // Test utilities
  clear(): void {
    this.sessions.clear();
  }

  size(): number {
    return this.sessions.size;
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}
