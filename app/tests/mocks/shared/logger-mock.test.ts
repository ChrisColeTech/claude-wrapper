/**
 * Logger Mock Tests
 * Verify the logger mock functionality works as expected
 */

import { LoggerMock } from './logger-mock';

describe('LoggerMock', () => {
  beforeEach(() => {
    LoggerMock.reset();
  });

  afterEach(() => {
    LoggerMock.reset();
  });

  describe('setup()', () => {
    it('should create mock logger with default configuration', () => {
      const mockLogger = LoggerMock.setup();

      expect(mockLogger.debug).toBeDefined();
      expect(mockLogger.warn).toBeDefined();
      expect(mockLogger.error).toBeDefined();
      expect(mockLogger.info).toBeDefined();
      expect(jest.isMockFunction(mockLogger.debug)).toBe(true);
      expect(jest.isMockFunction(mockLogger.warn)).toBe(true);
      expect(jest.isMockFunction(mockLogger.error)).toBe(true);
      expect(jest.isMockFunction(mockLogger.info)).toBe(true);
    });

    it('should capture call history by default', () => {
      const mockLogger = LoggerMock.setup();
      
      mockLogger.debug('test debug message');
      mockLogger.warn('test warn message');
      mockLogger.error('test error message');
      mockLogger.info('test info message');

      const history = LoggerMock.getCallHistory();
      expect(history).toHaveLength(4);
      expect(history[0]?.method).toBe('debug');
      expect(history[1]?.method).toBe('warn');
      expect(history[2]?.method).toBe('error');
      expect(history[3]?.method).toBe('info');
    });

    it('should handle context objects in log calls', () => {
      const mockLogger = LoggerMock.setup();
      const context = { userId: 123, action: 'test' };
      
      mockLogger.debug('test message', context);

      const history = LoggerMock.getCallHistory();
      expect(history[0]?.context).toEqual(context);
    });

    it('should handle error objects in error logs', () => {
      const mockLogger = LoggerMock.setup();
      const testError = new Error('test error');
      
      mockLogger.error('error occurred', testError, { code: 500 });

      const history = LoggerMock.getCallHistory();
      expect(history[0]?.error).toBe(testError);
      expect(history[0]?.context).toEqual({ code: 500 });
    });
  });

  describe('createSimple()', () => {
    it('should create logger without call history capture', () => {
      const mockLogger = LoggerMock.createSimple();
      
      mockLogger.debug('test message');
      mockLogger.warn('test warning');

      const history = LoggerMock.getCallHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('createTracking()', () => {
    it('should create logger with call history tracking', () => {
      const mockLogger = LoggerMock.createTracking();
      
      mockLogger.debug('debug message');
      mockLogger.info('info message');

      const history = LoggerMock.getCallHistory();
      expect(history).toHaveLength(2);
    });
  });

  describe('createStrict()', () => {
    it('should throw on error when configured strictly', () => {
      const mockLogger = LoggerMock.createStrict();
      
      expect(() => {
        mockLogger.error('error message');
      }).toThrow('Logger error: error message');
    });

    it('should throw on warn when configured strictly', () => {
      const mockLogger = LoggerMock.createStrict();
      
      expect(() => {
        mockLogger.warn('warning message');
      }).toThrow('Logger warn: warning message');
    });

    it('should not throw on debug or info when configured strictly', () => {
      const mockLogger = LoggerMock.createStrict();
      
      expect(() => {
        mockLogger.debug('debug message');
        mockLogger.info('info message');
      }).not.toThrow();
    });
  });

  describe('getCallsByMethod()', () => {
    it('should filter calls by method type', () => {
      const mockLogger = LoggerMock.setup();
      
      mockLogger.debug('debug 1');
      mockLogger.warn('warn 1');
      mockLogger.debug('debug 2');
      mockLogger.error('error 1');

      const debugCalls = LoggerMock.getCallsByMethod('debug');
      const warnCalls = LoggerMock.getCallsByMethod('warn');
      const errorCalls = LoggerMock.getCallsByMethod('error');

      expect(debugCalls).toHaveLength(2);
      expect(warnCalls).toHaveLength(1);
      expect(errorCalls).toHaveLength(1);
    });
  });

  describe('getLastCall()', () => {
    it('should return last call overall when no method specified', () => {
      const mockLogger = LoggerMock.setup();
      
      mockLogger.debug('first');
      mockLogger.warn('second');
      mockLogger.error('last');

      const lastCall = LoggerMock.getLastCall();
      expect(lastCall?.method).toBe('error');
      expect(lastCall?.message).toBe('last');
    });

    it('should return last call for specific method', () => {
      const mockLogger = LoggerMock.setup();
      
      mockLogger.debug('debug 1');
      mockLogger.warn('warn 1');
      mockLogger.debug('debug 2');

      const lastDebugCall = LoggerMock.getLastCall('debug');
      expect(lastDebugCall?.message).toBe('debug 2');
    });

    it('should return undefined for method that was never called', () => {
      const mockLogger = LoggerMock.setup();
      
      mockLogger.debug('test');

      const lastErrorCall = LoggerMock.getLastCall('error');
      expect(lastErrorCall).toBeUndefined();
    });
  });

  describe('wasMethodCalled()', () => {
    it('should return true when method was called', () => {
      const mockLogger = LoggerMock.setup();
      
      mockLogger.warn('test warning');

      expect(LoggerMock.wasMethodCalled('warn')).toBe(true);
      expect(LoggerMock.wasMethodCalled('debug')).toBe(false);
    });
  });

  describe('wasCalledWith()', () => {
    it('should return true when method was called with specific message', () => {
      const mockLogger = LoggerMock.setup();
      
      mockLogger.error('Authentication failed for user');

      expect(LoggerMock.wasCalledWith('error', 'Authentication failed')).toBe(true);
      expect(LoggerMock.wasCalledWith('error', 'Login successful')).toBe(false);
    });
  });

  describe('getMethodCallCount()', () => {
    it('should return correct count for each method', () => {
      const mockLogger = LoggerMock.setup();
      
      mockLogger.debug('debug 1');
      mockLogger.debug('debug 2');
      mockLogger.warn('warn 1');
      mockLogger.error('error 1');
      mockLogger.error('error 2');
      mockLogger.error('error 3');

      expect(LoggerMock.getMethodCallCount('debug')).toBe(2);
      expect(LoggerMock.getMethodCallCount('warn')).toBe(1);
      expect(LoggerMock.getMethodCallCount('error')).toBe(3);
      expect(LoggerMock.getMethodCallCount('info')).toBe(0);
    });
  });

  describe('clearHistory()', () => {
    it('should clear call history but keep logger functional', () => {
      const mockLogger = LoggerMock.setup();
      
      mockLogger.debug('before clear');
      expect(LoggerMock.getCallHistory()).toHaveLength(1);

      LoggerMock.clearHistory();
      expect(LoggerMock.getCallHistory()).toHaveLength(0);

      mockLogger.debug('after clear');
      expect(LoggerMock.getCallHistory()).toHaveLength(1);
    });
  });

  describe('reset()', () => {
    it('should reset all configurations and history', () => {
      const mockLogger = LoggerMock.setup();
      
      mockLogger.debug('test');
      expect(LoggerMock.getCallHistory()).toHaveLength(1);
      expect(LoggerMock.getMockLogger()).not.toBeNull();

      LoggerMock.reset();
      
      expect(LoggerMock.getCallHistory()).toHaveLength(0);
      expect(LoggerMock.getMockLogger()).toBeNull();
    });
  });

  describe('timestamps', () => {
    it('should include timestamps in call history', () => {
      const mockLogger = LoggerMock.setup();
      const beforeTime = Date.now();
      
      mockLogger.debug('test message');
      
      const afterTime = Date.now();
      const history = LoggerMock.getCallHistory();
      
      expect(history[0]?.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(history[0]?.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });
});