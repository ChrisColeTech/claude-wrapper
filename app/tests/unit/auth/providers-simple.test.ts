/**
 * Simple auth providers test
 */

describe('AuthProviders Basic Test', () => {
  it('should work without imports', () => {
    expect(1).toBe(1);
  });

  it('should import AuthMethod enum', async () => {
    const { AuthMethod } = await import('../../../src/auth/providers');
    expect(AuthMethod.ANTHROPIC).toBe('anthropic');
  });
});