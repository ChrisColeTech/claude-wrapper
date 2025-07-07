export interface IStorage {
  set(key: string, value: any, ttl?: number): void;
  get(key: string): any;
  delete(key: string): boolean;
  cleanup(): void;
}

export class InMemoryStorage implements IStorage {
  private data: Map<string, { value: any; expires: number }> = new Map();

  set(key: string, value: any, ttl: number = 3600000): void {
    const expires = Date.now() + ttl;
    this.data.set(key, { value, expires });
  }

  get(key: string): any {
    const item = this.data.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.data.delete(key);
      return null;
    }
    
    return item.value;
  }

  delete(key: string): boolean {
    return this.data.delete(key);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.data.entries()) {
      if (now > item.expires) {
        this.data.delete(key);
      }
    }
  }
}