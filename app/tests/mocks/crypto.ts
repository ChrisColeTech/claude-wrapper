/**
 * Crypto Mock Implementation
 * Provides predictable crypto operations for testing
 */

export const mockCryptoImpl = {
  randomBytes: jest.fn((size: number) => Buffer.from('a'.repeat(size))),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mock-hash-digest')
  })),
  createHmac: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mock-hmac-digest')
  })),
  timingSafeEqual: jest.fn(() => true)
};

export function resetCryptoMocks() {
  Object.values(mockCryptoImpl).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
}