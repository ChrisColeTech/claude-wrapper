export interface ISession {
  id: string;
  messages: any[];
  createdAt: Date;
  lastAccessedAt: Date;
}

export class SessionManager {
  private sessions: Map<string, ISession> = new Map();

  create(sessionId: string): ISession {
    const session: ISession = {
      id: sessionId,
      messages: [],
      createdAt: new Date(),
      lastAccessedAt: new Date()
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  get(sessionId: string): ISession | null {
    return this.sessions.get(sessionId) || null;
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  cleanup(): void {
    // TODO: Implement TTL-based cleanup
    console.log('Cleaning up expired sessions...');
  }
}