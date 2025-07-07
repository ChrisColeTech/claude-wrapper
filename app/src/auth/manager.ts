import { IAuthProvider } from './providers';

export class AuthManager {
  private providers: Map<string, IAuthProvider> = new Map();

  async authenticate(provider: string): Promise<boolean> {
    const authProvider = this.providers.get(provider);
    if (!authProvider) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    return authProvider.authenticate();
  }
}