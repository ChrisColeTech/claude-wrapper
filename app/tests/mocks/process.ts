/**
 * Process Mock for Testing
 * Provides controlled process operations for tests
 */

export const mockProcessExit = jest.fn();
export const mockProcessOn = jest.fn();
export const mockProcessRemoveListener = jest.fn();

export const mockProcessImpl = {
  exit: mockProcessExit,
  on: mockProcessOn,
  removeListener: mockProcessRemoveListener,
  env: {},
  cwd: jest.fn().mockReturnValue('/test'),
  platform: 'test',
  version: '16.0.0',
  versions: {
    node: '16.0.0',
  },
};

export function resetProcessMocks() {
  mockProcessExit.mockReset();
  mockProcessOn.mockReset();
  mockProcessRemoveListener.mockReset();
}

export function mockEnvironment(env: Record<string, string>) {
  Object.assign(process.env, env);
}

export function clearEnvironment() {
  Object.keys(process.env).forEach(key => {
    if (!key.startsWith('NODE_') && key !== 'PATH') {
      delete process.env[key];
    }
  });
}