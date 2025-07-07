/**
 * Session Mock Implementation
 * Provides mock session objects and storage for testing
 */

export function createMockSession(overrides: any = {}) {
  return {
    id: 'mock-session-id',
    createdAt: new Date(),
    lastAccessedAt: new Date(),
    messages: [],
    metadata: {},
    isActive: true,
    ...overrides
  };
}

export function createMockSessionStorage() {
  const storage = new Map();
  
  return {
    set: jest.fn((key: string, value: any) => {
      storage.set(key, value);
      return Promise.resolve();
    }),
    get: jest.fn((key: string) => {
      return Promise.resolve(storage.get(key));
    }),
    delete: jest.fn((key: string) => {
      const had = storage.has(key);
      storage.delete(key);
      return Promise.resolve(had);
    }),
    has: jest.fn((key: string) => {
      return Promise.resolve(storage.has(key));
    }),
    clear: jest.fn(() => {
      storage.clear();
      return Promise.resolve();
    }),
    keys: jest.fn(() => {
      return Promise.resolve(Array.from(storage.keys()));
    }),
    values: jest.fn(() => {
      return Promise.resolve(Array.from(storage.values()));
    }),
    size: jest.fn(() => {
      return Promise.resolve(storage.size);
    }),
    getStats: jest.fn(() => {
      return Promise.resolve({
        totalSessions: storage.size,
        activeSessions: storage.size,
        expiredSessions: 0,
        memoryUsageBytes: 1024,
        avgSessionSizeBytes: 512,
        oldestSessionAge: 0,
        newestSessionAge: 0,
        lastCleanupTime: new Date(),
        cleanupCount: 0
      });
    })
  };
}

export function createMockSessionManager() {
  const storage = createMockSessionStorage();
  
  return {
    createSession: jest.fn(() => Promise.resolve(createMockSession())),
    getSession: jest.fn((id: string) => storage.get(id)),
    updateSession: jest.fn((id: string, session: any) => storage.set(id, session)),
    deleteSession: jest.fn((id: string) => storage.delete(id)),
    listSessions: jest.fn(() => storage.values()),
    cleanup: jest.fn(() => Promise.resolve(0)),
    getStats: jest.fn(() => storage.getStats()),
    clear: jest.fn(() => storage.clear())
  };
}

export function resetSessionMocks() {
  // Mock functions are reset automatically by Jest
}