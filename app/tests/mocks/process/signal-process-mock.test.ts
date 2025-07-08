/**
 * Process Signal Mock Tests
 * Test that process signal mocks work correctly
 */

import { ProcessSignalMockFactory, ProcessSignalMockSetup } from './signal-process-mock';

describe('Process Signal Mock', () => {
  let processSignalMock: ReturnType<typeof ProcessSignalMockFactory.setup>;

  beforeEach(() => {
    processSignalMock = ProcessSignalMockSetup.setup();
  });

  afterEach(() => {
    ProcessSignalMockSetup.reset();
  });

  describe('ProcessSignalMockFactory', () => {
    it('should setup process mock with all required methods', () => {
      expect(typeof processSignalMock.on).toBe('function');
      expect(typeof processSignalMock.exit).toBe('function');
      expect(typeof processSignalMock.kill).toBe('function');
      expect(typeof processSignalMock.listeners).toBe('function');
      expect(typeof processSignalMock.removeListener).toBe('function');
      expect(typeof processSignalMock.removeAllListeners).toBe('function');
      expect(processSignalMock.pid).toBe(12345);
      expect(processSignalMock.env).toEqual({ NODE_ENV: 'test' });
    });

    it('should register signal handlers', () => {
      const handler = jest.fn();
      processSignalMock.on('SIGTERM', handler);

      expect(processSignalMock.on).toHaveBeenCalledWith('SIGTERM', handler);
      expect(ProcessSignalMockSetup.getRegisteredSignals()).toContain('SIGTERM');
    });

    it('should register multiple handlers for same signal', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      processSignalMock.on('SIGTERM', handler1);
      processSignalMock.on('SIGTERM', handler2);

      const handlers = ProcessSignalMockSetup.getHandlersForSignal('SIGTERM');
      expect(handlers).toHaveLength(2);
    });

    it('should trigger signal handlers', () => {
      const handler = jest.fn();
      processSignalMock.on('SIGTERM', handler);

      ProcessSignalMockSetup.triggerSignal('SIGTERM');

      expect(handler).toHaveBeenCalled();
    });

    it('should trigger multiple handlers for same signal', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      processSignalMock.on('SIGTERM', handler1);
      processSignalMock.on('SIGTERM', handler2);

      ProcessSignalMockSetup.triggerSignal('SIGTERM');

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should return signal listeners', () => {
      const handler = jest.fn();
      processSignalMock.on('SIGTERM', handler);

      const listeners = processSignalMock.listeners('SIGTERM');
      expect(listeners).toContain(handler);
    });

    it('should remove signal listeners', () => {
      const handler = jest.fn();
      processSignalMock.on('SIGTERM', handler);
      
      processSignalMock.removeListener('SIGTERM', handler);
      
      expect(processSignalMock.removeListener).toHaveBeenCalledWith('SIGTERM', handler);
      expect(ProcessSignalMockSetup.getHandlersForSignal('SIGTERM')).toHaveLength(0);
    });

    it('should remove all listeners for signal', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      processSignalMock.on('SIGTERM', handler1);
      processSignalMock.on('SIGTERM', handler2);
      
      processSignalMock.removeAllListeners('SIGTERM');
      
      expect(processSignalMock.removeAllListeners).toHaveBeenCalledWith('SIGTERM');
      expect(ProcessSignalMockSetup.getHandlersForSignal('SIGTERM')).toHaveLength(0);
    });

    it('should remove all listeners for all signals', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      processSignalMock.on('SIGTERM', handler1);
      processSignalMock.on('SIGINT', handler2);
      
      processSignalMock.removeAllListeners();
      
      expect(processSignalMock.removeAllListeners).toHaveBeenCalledWith();
      expect(ProcessSignalMockSetup.getRegisteredSignals()).toHaveLength(0);
    });

    it('should reset mock state', () => {
      const handler = jest.fn();
      processSignalMock.on('SIGTERM', handler);

      ProcessSignalMockSetup.reset();

      expect(processSignalMock.on).toHaveBeenCalledTimes(0);
      expect(ProcessSignalMockSetup.getRegisteredSignals()).toHaveLength(0);
    });

    it('should handle unknown signal triggers gracefully', () => {
      expect(() => {
        ProcessSignalMockSetup.triggerSignal('UNKNOWN_SIGNAL');
      }).not.toThrow();
    });
  });

  describe('ProcessSignalMockSetup', () => {
    it('should provide correct setup interface', () => {
      const mock = ProcessSignalMockSetup.setup();
      expect(mock).toBeDefined();
      expect(typeof mock.on).toBe('function');
    });

    it('should provide correct utility functions', () => {
      expect(typeof ProcessSignalMockSetup.getMockProcess).toBe('function');
      expect(typeof ProcessSignalMockSetup.getRegisteredSignals).toBe('function');
      expect(typeof ProcessSignalMockSetup.getHandlersForSignal).toBe('function');
      expect(typeof ProcessSignalMockSetup.triggerSignal).toBe('function');
    });
  });
});