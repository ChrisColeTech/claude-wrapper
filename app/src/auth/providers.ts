export interface IAuthProvider {
  authenticate(): Promise<boolean>;
}

export class AnthropicProvider implements IAuthProvider {
  async authenticate(): Promise<boolean> {
    return false;
  }
}

export class AWSProvider implements IAuthProvider {
  async authenticate(): Promise<boolean> {
    return false;
  }
}

export class GoogleProvider implements IAuthProvider {
  async authenticate(): Promise<boolean> {
    return false;
  }
}