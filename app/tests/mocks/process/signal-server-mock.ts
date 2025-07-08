/**
 * Server Signal Mock for testing server shutdown
 * Single Responsibility: Mock server shutdown behavior
 */

export interface ServerMock {
  close: jest.Mock;
  listening: boolean;
  connections: number;
  address: () => object | null;
  on: jest.Mock;
  off: jest.Mock;
  removeAllListeners: jest.Mock;
}

export interface ServerCloseCallback {
  (error?: Error): void;
}

export class ServerSignalMockFactory {
  private static serverInstance: ServerMock;
  private static isClosing: boolean = false;
  private static shouldErrorOnClose: boolean = false;
  private static closeTimeout: number = 0;

  static setup(options: {
    shouldErrorOnClose?: boolean;
    closeTimeout?: number;
  } = {}): ServerMock {
    this.isClosing = false;
    this.shouldErrorOnClose = options.shouldErrorOnClose || false;
    this.closeTimeout = options.closeTimeout || 0;

    this.serverInstance = {
      close: jest.fn().mockImplementation((callback?: ServerCloseCallback) => {
        if (this.isClosing) {
          if (callback) {
            callback(new Error('Server is already closing'));
          }
          return;
        }

        this.isClosing = true;
        this.serverInstance.listening = false;

        if (this.closeTimeout > 0) {
          setTimeout(() => {
            if (callback) {
              if (this.shouldErrorOnClose) {
                callback(new Error('Server close failed'));
              } else {
                callback();
              }
            }
          }, this.closeTimeout);
        } else {
          if (callback) {
            if (this.shouldErrorOnClose) {
              callback(new Error('Server close failed'));
            } else {
              callback();
            }
          }
        }
      }),
      listening: true,
      connections: 0,
      address: jest.fn().mockReturnValue({ port: 8000, address: '127.0.0.1' }),
      on: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn()
    };

    return this.serverInstance;
  }

  static reset(): void {
    this.isClosing = false;
    this.shouldErrorOnClose = false;
    this.closeTimeout = 0;
    
    if (this.serverInstance) {
      this.serverInstance.close.mockClear();
      (this.serverInstance.address as jest.Mock).mockClear();
      this.serverInstance.on.mockClear();
      this.serverInstance.off.mockClear();
      this.serverInstance.removeAllListeners.mockClear();
      this.serverInstance.listening = true;
      this.serverInstance.connections = 0;
    }
  }

  static simulateServerCloseError(): void {
    this.shouldErrorOnClose = true;
  }

  static simulateServerCloseTimeout(timeout: number): void {
    this.closeTimeout = timeout;
  }

  static isServerClosing(): boolean {
    return this.isClosing;
  }

  static getServerInstance(): ServerMock {
    return this.serverInstance;
  }
}

export const ServerSignalMockSetup = {
  setup: (options?: { shouldErrorOnClose?: boolean; closeTimeout?: number }) => 
    ServerSignalMockFactory.setup(options),
  reset: () => ServerSignalMockFactory.reset(),
  simulateServerCloseError: () => ServerSignalMockFactory.simulateServerCloseError(),
  simulateServerCloseTimeout: (timeout: number) => ServerSignalMockFactory.simulateServerCloseTimeout(timeout),
  isServerClosing: () => ServerSignalMockFactory.isServerClosing(),
  getServerInstance: () => ServerSignalMockFactory.getServerInstance()
};