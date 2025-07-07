/**
 * Fetch Mock for Testing
 * Provides controlled HTTP request operations for tests
 */

export const mockFetch = jest.fn();

// Mock Response class
export class MockResponse {
  status: number;
  statusText: string;
  ok: boolean;
  headers: Map<string, string>;
  private textResponse: string;

  constructor(status: number = 200, body: string = 'OK', statusText: string = 'OK') {
    this.status = status;
    this.statusText = statusText;
    this.ok = status >= 200 && status < 300;
    this.headers = new Map();
    this.textResponse = body;
  }

  async text(): Promise<string> {
    return this.textResponse;
  }

  async json(): Promise<any> {
    return JSON.parse(this.textResponse);
  }

  clone(): MockResponse {
    return new MockResponse(this.status, this.textResponse, this.statusText);
  }
}

// Mock AbortController
export class MockAbortController {
  signal: { aborted: boolean };
  aborted: boolean = false;

  constructor() {
    this.signal = { aborted: false };
  }

  abort() {
    this.aborted = true;
    this.signal.aborted = true;
  }
}

// Mock implementations
export const mockFetchImpl = {
  fetch: mockFetch,
  Response: MockResponse,
  AbortController: MockAbortController,
};

// Set up global mocks
export const setupFetchMocks = () => {
  (global as any).fetch = mockFetch;
  (global as any).AbortController = MockAbortController;
  (global as any).setTimeout = jest.fn().mockImplementation((fn: Function, delay: number) => {
    if (typeof fn === 'function') {
      fn();
    }
    return 1;
  });
  (global as any).clearTimeout = jest.fn();
};

export const resetFetchMocks = () => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(new MockResponse());
};

export const createMockResponse = (status: number = 200, body: string = 'OK', statusText: string = 'OK') => {
  return new MockResponse(status, body, statusText);
};