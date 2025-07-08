/**
 * Session Manager Signal Mock Tests
 * Test that session manager shutdown mocks work correctly
 */

import { SessionSignalMockFactory, SessionSignalMockSetup } from './signal-session-mock';

describe('Session Signal Mock', () => {
  let sessionManagerMock: ReturnType<typeof SessionSignalMockFactory.setup>;

  beforeEach(() => {
    sessionManagerMock = SessionSignalMockSetup.setup();
  });

  afterEach(() => {
    SessionSignalMockSetup.reset();
  });

  describe('SessionSignalMockFactory', () => {
    it('should setup session manager mock with all required methods', () => {
      expect(typeof sessionManagerMock.shutdown).toBe('function');
      expect(typeof sessionManagerMock.cleanup).toBe('function');
      expect(typeof sessionManagerMock.getSessions).toBe('function');
      expect(typeof sessionManagerMock.getActiveSessionCount).toBe('function');
      expect(sessionManagerMock.isShuttingDown).toBe(false);
    });

    it('should handle session manager shutdown without error', async () => {
      await sessionManagerMock.shutdown();
      
      expect(sessionManagerMock.isShuttingDown).toBe(true);
      expect(sessionManagerMock.shutdown).toHaveBeenCalled();
    });

    it('should simulate session manager shutdown error', async () => {
      SessionSignalMockSetup.simulateShutdownError();
      
      await expect(sessionManagerMock.shutdown()).rejects.toThrow('Session manager shutdown failed');
    });

    it('should simulate session manager shutdown timeout', async () => {
      const timeout = 100;
      SessionSignalMockSetup.simulateShutdownTimeout(timeout);
      
      const startTime = Date.now();
      await sessionManagerMock.shutdown();
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(timeout);
      expect(sessionManagerMock.isShuttingDown).toBe(true);
    });

    it('should return empty sessions array', () => {
      const sessions = sessionManagerMock.getSessions();
      expect(sessions).toEqual([]);
    });

    it('should return zero active session count', () => {
      const count = sessionManagerMock.getActiveSessionCount();
      expect(count).toBe(0);
    });

    it('should create dynamic import mock', async () => {
      const importMock = SessionSignalMockSetup.createDynamicImportMock();
      
      const result = await importMock();
      
      expect(result).toHaveProperty('sessionManager');
      expect(result.sessionManager).toBe(sessionManagerMock);
    });

    it('should simulate dynamic import failure', async () => {
      SessionSignalMockSetup.simulateImportFailure();
      
      const importMock = SessionSignalMockSetup.createDynamicImportMock();
      
      await expect(importMock()).rejects.toThrow('Failed to import session manager');
    });

    it('should reset session manager state', async () => {
      await sessionManagerMock.shutdown();
      expect(sessionManagerMock.isShuttingDown).toBe(true);
      
      SessionSignalMockSetup.reset();
      
      expect(sessionManagerMock.isShuttingDown).toBe(false);
      expect(sessionManagerMock.shutdown).toHaveBeenCalledTimes(0);
      expect(sessionManagerMock.cleanup).toHaveBeenCalledTimes(0);
    });

    it('should handle setup with options', () => {
      const options = {
        shouldErrorOnShutdown: true,
        shutdownTimeout: 50,
        shouldFailImport: true
      };
      
      const customSessionManager = SessionSignalMockSetup.setup(options);
      
      expect(customSessionManager).toBeDefined();
      expect(typeof customSessionManager.shutdown).toBe('function');
    });
  });

  describe('SessionSignalMockSetup', () => {
    it('should provide correct setup interface', () => {
      const mock = SessionSignalMockSetup.setup();
      expect(mock).toBeDefined();
      expect(typeof mock.shutdown).toBe('function');
    });

    it('should provide correct utility functions', () => {
      expect(typeof SessionSignalMockSetup.getSessionManagerInstance).toBe('function');
      expect(typeof SessionSignalMockSetup.simulateShutdownError).toBe('function');
      expect(typeof SessionSignalMockSetup.simulateShutdownTimeout).toBe('function');
      expect(typeof SessionSignalMockSetup.simulateImportFailure).toBe('function');
      expect(typeof SessionSignalMockSetup.createDynamicImportMock).toBe('function');
    });

    it('should return session manager instance', () => {
      const instance = SessionSignalMockSetup.getSessionManagerInstance();
      expect(instance).toBe(sessionManagerMock);
    });

    it('should handle multiple dynamic import mock calls', async () => {
      const importMock1 = SessionSignalMockSetup.createDynamicImportMock();
      const importMock2 = SessionSignalMockSetup.createDynamicImportMock();
      
      const result1 = await importMock1();
      const result2 = await importMock2();
      
      expect(result1.sessionManager).toBe(sessionManagerMock);
      expect(result2.sessionManager).toBe(sessionManagerMock);
    });
  });
});