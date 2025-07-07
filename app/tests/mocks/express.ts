/**
 * Express Mock Implementation
 * Provides mock Express request/response objects for testing
 */

export function createMockRequest(overrides: any = {}) {
  return {
    method: 'GET',
    url: '/test',
    path: '/test',
    query: {},
    params: {},
    body: {},
    headers: {
      'content-type': 'application/json',
      'user-agent': 'test-agent'
    },
    get: jest.fn((name: string) => overrides.headers?.[name.toLowerCase()]),
    ip: '127.0.0.1',
    ips: [],
    ...overrides
  };
}

export function createMockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    locals: {},
    statusCode: 200,
    headersSent: false
  };
  return res;
}

export function createMockNext() {
  return jest.fn();
}

export const mockExpress = {
  json: jest.fn(() => jest.fn()),
  urlencoded: jest.fn(() => jest.fn()),
  static: jest.fn(() => jest.fn()),
  Router: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    use: jest.fn()
  }))
};

export function resetExpressMocks() {
  Object.values(mockExpress).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
}