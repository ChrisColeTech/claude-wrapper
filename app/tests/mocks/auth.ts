/**
 * Auth Mock Implementation
 * Provides mock authentication objects and providers for testing
 */

export function createMockAuthProvider(method: string, configured: boolean = false) {
  return {
    getMethod: jest.fn().mockReturnValue(method),
    canDetect: jest.fn().mockReturnValue(configured),
    isConfigured: jest.fn().mockReturnValue(configured),
    validate: jest.fn().mockResolvedValue({
      valid: configured,
      errors: configured ? [] : [`${method} not configured`],
      config: configured ? { method } : {},
      method
    }),
    getRequiredEnvVars: jest.fn().mockReturnValue([])
  };
}

export function createMockAuthManager() {
  return {
    getAvailableProviders: jest.fn().mockReturnValue([]),
    selectProvider: jest.fn().mockResolvedValue(null),
    validateAll: jest.fn().mockResolvedValue([]),
    getCurrentProvider: jest.fn().mockReturnValue(null),
    isConfigured: jest.fn().mockReturnValue(false)
  };
}

export function createMockCredentialValidator() {
  return {
    validate: jest.fn().mockResolvedValue({
      valid: true,
      errors: []
    }),
    validateFormat: jest.fn().mockReturnValue({
      valid: true,
      errors: []
    }),
    validateWithAPI: jest.fn().mockResolvedValue({
      valid: true,
      errors: []
    })
  };
}

export const mockAuthProviders = {
  claudeCli: createMockAuthProvider('claude-cli'),
  anthropic: createMockAuthProvider('anthropic-api'),
  bedrock: createMockAuthProvider('aws-bedrock'),
  vertex: createMockAuthProvider('google-vertex')
};

export function resetAuthMocks() {
  Object.values(mockAuthProviders).forEach(provider => {
    Object.values(provider).forEach(method => {
      if (jest.isMockFunction(method)) {
        method.mockClear();
      }
    });
  });
}