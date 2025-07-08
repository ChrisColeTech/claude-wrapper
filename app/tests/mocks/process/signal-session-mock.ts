/**
 * Session Manager Signal Mock for testing session cleanup during shutdown
 * Single Responsibility: Mock session manager shutdown behavior
 */

export interface SessionManagerMock {
  shutdown: jest.Mock;
  cleanup: jest.Mock;
  getSessions: jest.Mock;
  getActiveSessionCount: jest.Mock;
  isShuttingDown: boolean;
}

export interface SessionManagerImportMock {
  sessionManager: SessionManagerMock;
}

export class SessionSignalMockFactory {
  private static sessionManagerInstance: SessionManagerMock;
  private static shouldErrorOnShutdown: boolean = false;
  private static shutdownTimeout: number = 0;
  private static shouldFailImport: boolean = false;

  static setup(options: {
    shouldErrorOnShutdown?: boolean;
    shutdownTimeout?: number;
    shouldFailImport?: boolean;
  } = {}): SessionManagerMock {
    this.shouldErrorOnShutdown = options.shouldErrorOnShutdown || false;
    this.shutdownTimeout = options.shutdownTimeout || 0;
    this.shouldFailImport = options.shouldFailImport || false;

    this.sessionManagerInstance = {
      shutdown: jest.fn().mockImplementation(async () => {
        if (this.shouldErrorOnShutdown) {
          throw new Error('Session manager shutdown failed');
        }
        
        if (this.shutdownTimeout > 0) {
          await new Promise(resolve => setTimeout(resolve, this.shutdownTimeout));
        }
        
        this.sessionManagerInstance.isShuttingDown = true;
      }),
      cleanup: jest.fn(),
      getSessions: jest.fn().mockReturnValue([]),
      getActiveSessionCount: jest.fn().mockReturnValue(0),
      isShuttingDown: false
    };

    return this.sessionManagerInstance;
  }

  static reset(): void {
    this.shouldErrorOnShutdown = false;
    this.shutdownTimeout = 0;
    this.shouldFailImport = false;
    
    if (this.sessionManagerInstance) {
      this.sessionManagerInstance.shutdown.mockClear();
      this.sessionManagerInstance.cleanup.mockClear();
      this.sessionManagerInstance.getSessions.mockClear();
      this.sessionManagerInstance.getActiveSessionCount.mockClear();
      this.sessionManagerInstance.isShuttingDown = false;
    }
  }

  static simulateShutdownError(): void {
    this.shouldErrorOnShutdown = true;
  }

  static simulateShutdownTimeout(timeout: number): void {
    this.shutdownTimeout = timeout;
  }

  static simulateImportFailure(): void {
    this.shouldFailImport = true;
  }

  static createDynamicImportMock(): () => Promise<SessionManagerImportMock> {
    return jest.fn().mockImplementation(async () => {
      if (this.shouldFailImport) {
        throw new Error('Failed to import session manager');
      }
      
      return {
        sessionManager: this.sessionManagerInstance
      };
    });
  }

  static getSessionManagerInstance(): SessionManagerMock {
    return this.sessionManagerInstance;
  }
}

export const SessionSignalMockSetup = {
  setup: (options?: { shouldErrorOnShutdown?: boolean; shutdownTimeout?: number; shouldFailImport?: boolean }) => 
    SessionSignalMockFactory.setup(options),
  reset: () => SessionSignalMockFactory.reset(),
  simulateShutdownError: () => SessionSignalMockFactory.simulateShutdownError(),
  simulateShutdownTimeout: (timeout: number) => SessionSignalMockFactory.simulateShutdownTimeout(timeout),
  simulateImportFailure: () => SessionSignalMockFactory.simulateImportFailure(),
  createDynamicImportMock: () => SessionSignalMockFactory.createDynamicImportMock(),
  getSessionManagerInstance: () => SessionSignalMockFactory.getSessionManagerInstance()
};