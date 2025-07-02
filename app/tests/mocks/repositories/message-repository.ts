/**
 * Mock message repository - FOR TESTING ONLY
 * Used to isolate tests from actual storage implementation
 */

export class MockMessageRepository {
  private messages = new Map<string, any[]>();
  
  async create(sessionId: string, message: any): Promise<void> {
    if (!this.messages.has(sessionId)) {
      this.messages.set(sessionId, []);
    }
    this.messages.get(sessionId)!.push(message);
  }
  
  async findBySessionId(sessionId: string): Promise<any[]> {
    return this.messages.get(sessionId) || [];
  }
  
  async count(sessionId: string): Promise<number> {
    return this.messages.get(sessionId)?.length || 0;
  }
  
  clear(): void {
    this.messages.clear();
  }
}
