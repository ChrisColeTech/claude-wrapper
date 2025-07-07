export class SignalHandler {
  private handlers: Map<string, () => void> = new Map();

  register(signal: string, handler: () => void): void {
    this.handlers.set(signal, handler);
    process.on(signal as any, handler);
  }

  gracefulShutdown(): void {
    console.log('Initiating graceful shutdown...');
    process.exit(0);
  }
}