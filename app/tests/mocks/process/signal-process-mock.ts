/**
 * Process Signal Mock for testing signal handling
 * Single Responsibility: Mock process signal operations
 */

export interface ProcessSignalMock {
  on: jest.Mock;
  exit: jest.Mock;
  kill: jest.Mock;
  listeners: jest.Mock;
  removeListener: jest.Mock;
  removeAllListeners: jest.Mock;
  pid: number;
  env: Record<string, string>;
}

export interface SignalHandler {
  signal: string;
  handler: (...args: any[]) => void;
}

export class ProcessSignalMockFactory {
  private static signalHandlers: Map<string, SignalHandler[]> = new Map();
  private static mockProcess: ProcessSignalMock;

  static setup(): ProcessSignalMock {
    this.signalHandlers.clear();
    
    this.mockProcess = {
      on: jest.fn().mockImplementation((signal: string, handler: (...args: any[]) => void) => {
        if (!this.signalHandlers.has(signal)) {
          this.signalHandlers.set(signal, []);
        }
        this.signalHandlers.get(signal)!.push({ signal, handler });
      }),
      exit: jest.fn(),
      kill: jest.fn(),
      listeners: jest.fn().mockImplementation((signal: string) => {
        return this.signalHandlers.get(signal)?.map(h => h.handler) || [];
      }),
      removeListener: jest.fn().mockImplementation((signal: string, handler: (...args: any[]) => void) => {
        const handlers = this.signalHandlers.get(signal) || [];
        const index = handlers.findIndex(h => h.handler === handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }),
      removeAllListeners: jest.fn().mockImplementation((signal?: string) => {
        if (signal) {
          this.signalHandlers.delete(signal);
        } else {
          this.signalHandlers.clear();
        }
      }),
      pid: 12345,
      env: { NODE_ENV: 'test' }
    };

    return this.mockProcess;
  }

  static reset(): void {
    this.signalHandlers.clear();
    if (this.mockProcess) {
      this.mockProcess.on.mockClear();
      this.mockProcess.exit.mockClear();
      this.mockProcess.kill.mockClear();
      this.mockProcess.listeners.mockClear();
      this.mockProcess.removeListener.mockClear();
      this.mockProcess.removeAllListeners.mockClear();
    }
  }

  static triggerSignal(signal: string): void {
    const handlers = this.signalHandlers.get(signal) || [];
    handlers.forEach(h => h.handler());
  }

  static getRegisteredSignals(): string[] {
    return Array.from(this.signalHandlers.keys());
  }

  static getHandlersForSignal(signal: string): SignalHandler[] {
    return this.signalHandlers.get(signal) || [];
  }

  static getMockProcess(): ProcessSignalMock {
    return this.mockProcess;
  }
}

export const ProcessSignalMockSetup = {
  setup: () => ProcessSignalMockFactory.setup(),
  reset: () => ProcessSignalMockFactory.reset(),
  triggerSignal: (signal: string) => ProcessSignalMockFactory.triggerSignal(signal),
  getRegisteredSignals: () => ProcessSignalMockFactory.getRegisteredSignals(),
  getHandlersForSignal: (signal: string) => ProcessSignalMockFactory.getHandlersForSignal(signal),
  getMockProcess: () => ProcessSignalMockFactory.getMockProcess()
};