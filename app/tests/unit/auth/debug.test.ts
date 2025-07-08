/**
 * Debug test to check imports
 */

import { authTestSetup } from './setup';

describe('Debug Test', () => {
  beforeAll(authTestSetup.beforeAll);
  afterAll(authTestSetup.afterAll);
  beforeEach(authTestSetup.beforeEach);
  afterEach(authTestSetup.afterEach);

  it('should import setup correctly', () => {
    expect(authTestSetup).toBeDefined();
    expect(authTestSetup.beforeEach).toBeDefined();
  });

  it('should import auth providers', async () => {
    const { AnthropicProvider } = await import('../../../src/auth/providers');
    expect(AnthropicProvider).toBeDefined();
  });
});