import { AnthropicProvider, AWSProvider, GoogleProvider } from '../../../src/auth/providers';

describe('Auth Providers', () => {
  describe('AnthropicProvider', () => {
    it('should create instance', () => {
      const provider = new AnthropicProvider();
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });
  });

  describe('AWSProvider', () => {
    it('should create instance', () => {
      const provider = new AWSProvider();
      expect(provider).toBeInstanceOf(AWSProvider);
    });
  });

  describe('GoogleProvider', () => {
    it('should create instance', () => {
      const provider = new GoogleProvider();
      expect(provider).toBeInstanceOf(GoogleProvider);
    });
  });
});