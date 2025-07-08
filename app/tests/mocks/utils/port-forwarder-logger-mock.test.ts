/**
 * Tests for Logger Mock
 * Verifies logging functionality simulation
 */

import { LoggerMockFactory } from './port-forwarder-logger-mock';

describe('Logger Mock', () => {
  beforeEach(() => {
    LoggerMockFactory.reset();
  });

  afterEach(() => {
    LoggerMockFactory.reset();
  });

  describe('Factory Setup', () => {
    it('should setup with default configuration', () => {
      const mockLogger = LoggerMockFactory.setup();
      
      expect(mockLogger.debug).toBeDefined();
      expect(mockLogger.info).toBeDefined();
      expect(mockLogger.warn).toBeDefined();
      expect(mockLogger.error).toBeDefined();
      expect(typeof mockLogger.debug).toBe('function');
    });

    it('should setup with custom configuration', () => {
      const config = {
        captureLogging: false,
        shouldFailLogging: true,
        logLevel: 'error' as const
      };
      
      const mockLogger = LoggerMockFactory.setup(config);
      
      expect(mockLogger).toBeDefined();
    });

    it('should return same instance on subsequent calls', () => {
      const mock1 = LoggerMockFactory.setup();
      const mock2 = LoggerMockFactory.getMockInstance();
      
      expect(mock1).toBe(mock2);
    });
  });

  describe('Logging Capture', () => {
    it('should capture debug logs', () => {
      const mockLogger = LoggerMockFactory.setup();
      
      mockLogger.debug('Test debug message', { port: 3000 });
      
      const entries = LoggerMockFactory.getLogEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('debug');
      expect(entries[0].message).toBe('Test debug message');
      expect(entries[0].data).toEqual({ port: 3000 });
    });

    it('should capture info logs', () => {
      const mockLogger = LoggerMockFactory.setup();
      
      mockLogger.info('Test info message', { wslIP: '172.20.0.1' });
      
      const entries = LoggerMockFactory.getLogEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('info');
      expect(entries[0].message).toBe('Test info message');
      expect(entries[0].data).toEqual({ wslIP: '172.20.0.1' });
    });

    it('should capture warn logs', () => {
      const mockLogger = LoggerMockFactory.setup();
      
      mockLogger.warn('Test warn message', { error: 'Something went wrong' });
      
      const entries = LoggerMockFactory.getLogEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('warn');
      expect(entries[0].message).toBe('Test warn message');
      expect(entries[0].data).toEqual({ error: 'Something went wrong' });
    });

    it('should capture error logs with error object', () => {
      const mockLogger = LoggerMockFactory.setup();
      const testError = new Error('Test error');
      
      mockLogger.error('Test error message', testError, { port: 3000 });
      
      const entries = LoggerMockFactory.getLogEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('error');
      expect(entries[0].message).toBe('Test error message');
      expect(entries[0].error).toBe(testError);
      expect(entries[0].data).toEqual({ port: 3000 });
    });

    it('should include timestamp in log entries', () => {
      const mockLogger = LoggerMockFactory.setup();
      const beforeLog = new Date();
      
      mockLogger.info('Test message');
      
      const entries = LoggerMockFactory.getLogEntries();
      const afterLog = new Date();
      expect(entries[0].timestamp).toBeInstanceOf(Date);
      expect(entries[0].timestamp.getTime()).toBeGreaterThanOrEqual(beforeLog.getTime());
      expect(entries[0].timestamp.getTime()).toBeLessThanOrEqual(afterLog.getTime());
    });

    it('should not capture logs when capture is disabled', () => {
      const mockLogger = LoggerMockFactory.setup({ captureLogging: false });
      
      mockLogger.info('Test message');
      
      const entries = LoggerMockFactory.getLogEntries();
      expect(entries).toHaveLength(0);
    });
  });

  describe('Log Retrieval', () => {
    beforeEach(() => {
      const mockLogger = LoggerMockFactory.setup();
      mockLogger.debug('Debug message');
      mockLogger.info('Info message');
      mockLogger.warn('Warn message');
      mockLogger.error('Error message');
    });

    it('should get all log entries', () => {
      const entries = LoggerMockFactory.getLogEntries();
      
      expect(entries).toHaveLength(4);
      expect(entries.map(e => e.level)).toEqual(['debug', 'info', 'warn', 'error']);
    });

    it('should get log entries by level', () => {
      const debugEntries = LoggerMockFactory.getLogEntriesByLevel('debug');
      const infoEntries = LoggerMockFactory.getLogEntriesByLevel('info');
      
      expect(debugEntries).toHaveLength(1);
      expect(debugEntries[0].level).toBe('debug');
      expect(infoEntries).toHaveLength(1);
      expect(infoEntries[0].level).toBe('info');
    });

    it('should get last log entry', () => {
      const lastEntry = LoggerMockFactory.getLastLogEntry();
      
      expect(lastEntry?.level).toBe('error');
      expect(lastEntry?.message).toBe('Error message');
    });

    it('should return null for last entry when no logs', () => {
      LoggerMockFactory.reset();
      LoggerMockFactory.setup();
      
      const lastEntry = LoggerMockFactory.getLastLogEntry();
      
      expect(lastEntry).toBeNull();
    });

    it('should get log count', () => {
      const count = LoggerMockFactory.getLogCount();
      
      expect(count).toBe(4);
    });

    it('should get log count by level', () => {
      const debugCount = LoggerMockFactory.getLogCountByLevel('debug');
      const infoCount = LoggerMockFactory.getLogCountByLevel('info');
      
      expect(debugCount).toBe(1);
      expect(infoCount).toBe(1);
    });
  });

  describe('Log Verification', () => {
    beforeEach(() => {
      const mockLogger = LoggerMockFactory.setup();
      mockLogger.debug('Setting up WSL port forwarding');
      mockLogger.info('WSL port forwarding established');
      mockLogger.warn('PowerShell command warning');
      mockLogger.error('Failed to setup WSL port forwarding');
    });

    it('should verify log was called', () => {
      expect(LoggerMockFactory.verifyLogCalled('debug', 'Setting up WSL')).toBe(true);
      expect(LoggerMockFactory.verifyLogCalled('info', 'established')).toBe(true);
      expect(LoggerMockFactory.verifyLogCalled('warn', 'PowerShell')).toBe(true);
      expect(LoggerMockFactory.verifyLogCalled('error', 'Failed to setup')).toBe(true);
    });

    it('should verify specific log level methods', () => {
      expect(LoggerMockFactory.verifyDebugCalled('Setting up WSL')).toBe(true);
      expect(LoggerMockFactory.verifyInfoCalled('established')).toBe(true);
      expect(LoggerMockFactory.verifyWarnCalled('PowerShell')).toBe(true);
      expect(LoggerMockFactory.verifyErrorCalled('Failed to setup')).toBe(true);
    });

    it('should verify log with specific data', () => {
      const mockLogger = LoggerMockFactory.setup();
      mockLogger.info('Port forwarding setup', { port: 3000, wslIP: '172.20.0.1' });
      
      const verified = LoggerMockFactory.verifyLogWithData('info', 'Port forwarding setup', { port: 3000, wslIP: '172.20.0.1' });
      
      expect(verified).toBe(true);
    });

    it('should verify log sequence', () => {
      const expectedSequence = [
        { level: 'debug' as const, message: 'Setting up WSL' },
        { level: 'info' as const, message: 'established' },
        { level: 'warn' as const, message: 'PowerShell' },
        { level: 'error' as const, message: 'Failed to setup' }
      ];
      
      const verified = LoggerMockFactory.verifyLogSequence(expectedSequence);
      
      expect(verified).toBe(true);
    });

    it('should fail verification for incorrect sequence', () => {
      const wrongSequence = [
        { level: 'info' as const, message: 'established' },
        { level: 'debug' as const, message: 'Setting up WSL' }
      ];
      
      const verified = LoggerMockFactory.verifyLogSequence(wrongSequence);
      
      expect(verified).toBe(false);
    });
  });

  describe('Call Counts', () => {
    it('should track call counts for each log level', () => {
      const mockLogger = LoggerMockFactory.setup();
      
      mockLogger.debug('Debug 1');
      mockLogger.debug('Debug 2');
      mockLogger.info('Info 1');
      mockLogger.error('Error 1');
      
      const counts = LoggerMockFactory.getCallCounts();
      
      expect(counts.debug).toBe(2);
      expect(counts.info).toBe(1);
      expect(counts.warn).toBe(0);
      expect(counts.error).toBe(1);
    });

    it('should return zero counts when no calls made', () => {
      LoggerMockFactory.setup();
      
      const counts = LoggerMockFactory.getCallCounts();
      
      expect(counts.debug).toBe(0);
      expect(counts.info).toBe(0);
      expect(counts.warn).toBe(0);
      expect(counts.error).toBe(0);
    });
  });

  describe('Configuration Management', () => {
    it('should update logging failure mode', () => {
      const mockLogger = LoggerMockFactory.setup();
      
      LoggerMockFactory.setLoggingFailureMode(true);
      
      expect(() => mockLogger.info('Test message')).toThrow('Logging failed for level: info');
    });

    it('should update capture mode', () => {
      const mockLogger = LoggerMockFactory.setup();
      
      LoggerMockFactory.setCaptureMode(false);
      mockLogger.info('Test message');
      
      expect(LoggerMockFactory.getLogCount()).toBe(0);
    });

    it('should update log level', () => {
      const mockLogger = LoggerMockFactory.setup();
      
      LoggerMockFactory.setLogLevel('error');
      mockLogger.info('Test message');
      
      expect(LoggerMockFactory.getLogCount()).toBe(1);
    });
  });

  describe('Log Search', () => {
    beforeEach(() => {
      const mockLogger = LoggerMockFactory.setup();
      mockLogger.info('Setting up port forwarding for port 3000');
      mockLogger.warn('PowerShell command warning');
      mockLogger.error('Failed to setup port forwarding');
    });

    it('should find logs with specific message', () => {
      const logs = LoggerMockFactory.findLogsWithMessage('port forwarding');
      
      expect(logs).toHaveLength(2);
      expect(logs[0].message).toContain('Setting up port forwarding');
      expect(logs[1].message).toContain('Failed to setup port forwarding');
    });

    it('should find logs with specific data', () => {
      const mockLogger = LoggerMockFactory.setup();
      mockLogger.info('Test message', { port: 3000 });
      mockLogger.debug('Debug message', { port: 8080 });
      mockLogger.info('Another message', { port: 3000 });
      
      const logs = LoggerMockFactory.findLogsWithData({ port: 3000 });
      
      expect(logs).toHaveLength(2);
      expect(logs[0].level).toBe('info');
      expect(logs[1].level).toBe('info');
    });

    it('should return empty array when no matches found', () => {
      const logs = LoggerMockFactory.findLogsWithMessage('nonexistent');
      
      expect(logs).toHaveLength(0);
    });
  });

  describe('Log Management', () => {
    it('should clear logs', () => {
      const mockLogger = LoggerMockFactory.setup();
      mockLogger.info('Test message');
      
      LoggerMockFactory.clearLogs();
      
      expect(LoggerMockFactory.getLogCount()).toBe(0);
    });

    it('should maintain logs across multiple calls', () => {
      const mockLogger = LoggerMockFactory.setup();
      
      mockLogger.info('Message 1');
      mockLogger.debug('Message 2');
      mockLogger.warn('Message 3');
      
      expect(LoggerMockFactory.getLogCount()).toBe(3);
    });
  });

  describe('Mock Reset', () => {
    it('should reset all logs and configuration', () => {
      const mockLogger = LoggerMockFactory.setup();
      mockLogger.info('Test message');
      LoggerMockFactory.setLoggingFailureMode(true);
      
      LoggerMockFactory.reset();
      
      expect(LoggerMockFactory.getLogCount()).toBe(0);
      expect(LoggerMockFactory.getCallCounts().info).toBe(0);
    });

    it('should reset mock functions', () => {
      const mockLogger = LoggerMockFactory.setup();
      mockLogger.info('Test message');
      
      LoggerMockFactory.reset();
      const newMock = LoggerMockFactory.setup();
      
      expect(typeof newMock.info.mockReset).toBe('function');
    });
  });
});