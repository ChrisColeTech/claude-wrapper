/**
 * Server Signal Mock Tests
 * Test that server shutdown mocks work correctly
 */

import { ServerSignalMockFactory, ServerSignalMockSetup } from './signal-server-mock';

describe('Server Signal Mock', () => {
  let serverMock: ReturnType<typeof ServerSignalMockFactory.setup>;

  beforeEach(() => {
    serverMock = ServerSignalMockSetup.setup();
  });

  afterEach(() => {
    ServerSignalMockSetup.reset();
  });

  describe('ServerSignalMockFactory', () => {
    it('should setup server mock with all required methods', () => {
      expect(typeof serverMock.close).toBe('function');
      expect(serverMock.listening).toBe(true);
      expect(serverMock.connections).toBe(0);
      expect(typeof serverMock.address).toBe('function');
      expect(typeof serverMock.on).toBe('function');
      expect(typeof serverMock.off).toBe('function');
      expect(typeof serverMock.removeAllListeners).toBe('function');
    });

    it('should handle server close without error', (done) => {
      serverMock.close((error?: Error) => {
        expect(error).toBeUndefined();
        expect(serverMock.listening).toBe(false);
        done();
      });
    });

    it('should handle server close without callback', () => {
      expect(() => {
        serverMock.close();
      }).not.toThrow();
      expect(serverMock.listening).toBe(false);
    });

    it('should simulate server close error', (done) => {
      ServerSignalMockSetup.simulateServerCloseError();
      
      serverMock.close((error?: Error) => {
        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toBe('Server close failed');
        done();
      });
    });

    it('should simulate server close timeout', (done) => {
      const timeout = 100;
      ServerSignalMockSetup.simulateServerCloseTimeout(timeout);
      
      const startTime = Date.now();
      serverMock.close(() => {
        const endTime = Date.now();
        expect(endTime - startTime).toBeGreaterThanOrEqual(timeout - 10); // Allow 10ms tolerance
        done();
      });
    });

    it('should prevent multiple close calls', (done) => {
      serverMock.close(() => {
        // First close succeeds
        expect(serverMock.listening).toBe(false);
        
        // Second close should error
        serverMock.close((error?: Error) => {
          expect(error).toBeInstanceOf(Error);
          expect(error?.message).toBe('Server is already closing');
          done();
        });
      });
    });

    it('should track closing state', () => {
      expect(ServerSignalMockSetup.isServerClosing()).toBe(false);
      
      serverMock.close();
      
      expect(ServerSignalMockSetup.isServerClosing()).toBe(true);
    });

    it('should return server address', () => {
      const address = serverMock.address();
      expect(address).toEqual({ port: 8000, address: '127.0.0.1' });
    });

    it('should handle server event methods', () => {
      const handler = jest.fn();
      
      serverMock.on('connection', handler);
      serverMock.off('connection', handler);
      serverMock.removeAllListeners('connection');
      
      expect(serverMock.on).toHaveBeenCalledWith('connection', handler);
      expect(serverMock.off).toHaveBeenCalledWith('connection', handler);
      expect(serverMock.removeAllListeners).toHaveBeenCalledWith('connection');
    });

    it('should reset server state', () => {
      serverMock.close();
      expect(ServerSignalMockSetup.isServerClosing()).toBe(true);
      
      ServerSignalMockSetup.reset();
      
      expect(ServerSignalMockSetup.isServerClosing()).toBe(false);
      expect(serverMock.listening).toBe(true);
      expect(serverMock.connections).toBe(0);
      expect(serverMock.close).toHaveBeenCalledTimes(0);
    });

    it('should handle setup with options', () => {
      const options = {
        shouldErrorOnClose: true,
        closeTimeout: 50
      };
      
      const customServer = ServerSignalMockSetup.setup(options);
      
      expect(customServer).toBeDefined();
      expect(typeof customServer.close).toBe('function');
    });
  });

  describe('ServerSignalMockSetup', () => {
    it('should provide correct setup interface', () => {
      const mock = ServerSignalMockSetup.setup();
      expect(mock).toBeDefined();
      expect(typeof mock.close).toBe('function');
    });

    it('should provide correct utility functions', () => {
      expect(typeof ServerSignalMockSetup.getServerInstance).toBe('function');
      expect(typeof ServerSignalMockSetup.isServerClosing).toBe('function');
      expect(typeof ServerSignalMockSetup.simulateServerCloseError).toBe('function');
      expect(typeof ServerSignalMockSetup.simulateServerCloseTimeout).toBe('function');
    });

    it('should return server instance', () => {
      const instance = ServerSignalMockSetup.getServerInstance();
      expect(instance).toBe(serverMock);
    });
  });
});