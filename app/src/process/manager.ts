export class ProcessManager {
  constructor(private pidFile: string) {}

  async start(): Promise<void> {
    console.log(`Starting process with PID file: ${this.pidFile}`);
  }

  async stop(): Promise<void> {
    console.log('Stopping process...');
  }

  async status(): Promise<string> {
    return 'unknown';
  }
}