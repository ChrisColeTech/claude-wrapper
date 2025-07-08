/**
 * Test the daemon OS mock to ensure it works correctly
 */

import { DaemonOSMock } from './daemon-os-mock';

describe('DaemonOSMock', () => {
  beforeEach(() => {
    DaemonOSMock.reset();
  });

  afterEach(() => {
    DaemonOSMock.reset();
  });

  describe('setup and configuration', () => {
    it('should create mock with default configuration', () => {
      const mock = DaemonOSMock.setup();
      
      expect(mock.execPath).toBe('/usr/bin/node');
      expect(mock.platform).toBe('linux');
      expect(mock.kill).toBeDefined();
      expect(jest.isMockFunction(mock.kill)).toBe(true);
    });

    it('should create mock with custom configuration', () => {
      const mock = DaemonOSMock.setup({
        execPath: '/custom/node',
        platform: 'darwin',
        killBehavior: 'failure'
      });
      
      expect(mock.execPath).toBe('/custom/node');
      expect(mock.platform).toBe('darwin');
    });
  });

  describe('kill behavior simulation', () => {
    it('should simulate successful kill by default', () => {
      const mock = DaemonOSMock.setup();
      
      const result = mock.kill(12345, 'SIGTERM');
      expect(result).toBe(true);
      
      const killCalls = DaemonOSMock.getKillCalls();
      expect(killCalls).toHaveLength(1);
      expect(killCalls[0]).toEqual({ pid: 12345, signal: 'SIGTERM' });
    });

    it('should simulate kill failure', () => {
      const mock = DaemonOSMock.setup({ 
        killBehavior: 'failure',
        killError: 'Mock kill failed'
      });
      
      expect(() => mock.kill(12345, 'SIGTERM')).toThrow('Mock kill failed');
    });

    it('should simulate no such process error', () => {
      const mock = DaemonOSMock.setup({ killBehavior: 'no-such-process' });
      
      try {
        mock.kill(12345, 'SIGTERM');
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toBe('No such process');
        expect(error.code).toBe('ESRCH');
      }
    });

    it('should use default signal when not specified', () => {
      const mock = DaemonOSMock.setup();
      
      mock.kill(12345);
      
      const killCalls = DaemonOSMock.getKillCalls();
      expect(killCalls[0]).toEqual({ pid: 12345, signal: 'SIGTERM' });
    });
  });

  describe('kill call tracking', () => {
    it('should track all kill calls', () => {
      const mock = DaemonOSMock.setup();
      
      mock.kill(12345, 'SIGTERM');
      mock.kill(67890, 'SIGKILL');
      mock.kill(11111, 9);
      
      const calls = DaemonOSMock.getKillCalls();
      expect(calls).toHaveLength(3);
      expect(calls[0]).toEqual({ pid: 12345, signal: 'SIGTERM' });
      expect(calls[1]).toEqual({ pid: 67890, signal: 'SIGKILL' });
      expect(calls[2]).toEqual({ pid: 11111, signal: 9 });
    });

    it('should verify specific kill calls', () => {
      const mock = DaemonOSMock.setup();
      
      mock.kill(12345, 'SIGTERM');
      
      expect(DaemonOSMock.wasKillCalledWith(12345, 'SIGTERM')).toBe(true);
      expect(DaemonOSMock.wasKillCalledWith(12345, 'SIGKILL')).toBe(false);
      expect(DaemonOSMock.wasKillCalledWith(67890, 'SIGTERM')).toBe(false);
    });

    it('should verify kill calls without signal check', () => {
      const mock = DaemonOSMock.setup();
      
      mock.kill(12345, 'SIGTERM');
      mock.kill(12345, 'SIGKILL');
      
      expect(DaemonOSMock.wasKillCalledWith(12345)).toBe(true);
      expect(DaemonOSMock.wasKillCalledWith(67890)).toBe(false);
    });
  });

  describe('dynamic configuration', () => {
    it('should allow changing kill behavior after setup', () => {
      const mock = DaemonOSMock.setup();
      
      // Should work initially
      expect(mock.kill(12345, 'SIGTERM')).toBe(true);
      
      // Change to failure
      DaemonOSMock.setKillBehavior('failure', 'Later error');
      
      expect(() => mock.kill(12345, 'SIGTERM')).toThrow('Later error');
    });

    it('should allow changing exec path after setup', () => {
      DaemonOSMock.setExecPath('/new/node/path');
      
      const mock = DaemonOSMock.setup();
      expect(mock.execPath).toBe('/new/node/path');
    });

    it('should allow changing platform after setup', () => {
      DaemonOSMock.setPlatform('win32');
      
      const mock = DaemonOSMock.setup();
      expect(mock.platform).toBe('win32');
    });
  });

  describe('global process mocking', () => {
    it('should apply mock to global process', () => {
      DaemonOSMock.applyToGlobal();
      
      expect(global.process.execPath).toBe('/usr/bin/node');
      expect(global.process.platform).toBe('linux');
      expect(jest.isMockFunction(global.process.kill)).toBe(true);
      
      // Test kill functionality
      const result = global.process.kill(12345, 'SIGTERM');
      expect(result).toBe(true);
      expect(DaemonOSMock.wasKillCalledWith(12345, 'SIGTERM')).toBe(true);
    });
  });

  describe('configuration introspection', () => {
    it('should provide access to current configuration', () => {
      DaemonOSMock.setExecPath('/test/node');
      DaemonOSMock.setPlatform('darwin');
      DaemonOSMock.setKillBehavior('failure', 'Test error');
      
      const config = DaemonOSMock.getConfig();
      expect(config.execPath).toBe('/test/node');
      expect(config.platform).toBe('darwin');
      expect(config.killBehavior).toBe('failure');
      expect(config.killError).toBe('Test error');
    });
  });

  describe('reset functionality', () => {
    it('should reset configuration to defaults', () => {
      // Configure non-default settings
      DaemonOSMock.setExecPath('/custom/node');
      DaemonOSMock.setPlatform('win32');
      DaemonOSMock.setKillBehavior('failure', 'Custom error');
      
      const mock = DaemonOSMock.setup();
      
      // Test that kill behavior is set to failure (should throw)
      expect(() => mock.kill(12345, 'SIGTERM')).toThrow('Custom error');
      
      // Reset
      DaemonOSMock.reset();
      
      // Should be back to defaults
      const config = DaemonOSMock.getConfig();
      expect(config.execPath).toBe('/usr/bin/node');
      expect(config.platform).toBe('linux');
      expect(config.killBehavior).toBe('success');
      
      const calls = DaemonOSMock.getKillCalls();
      expect(calls).toHaveLength(0);
    });
  });

  describe('kill history management', () => {
    it('should clear kill history without resetting configuration', () => {
      const mock = DaemonOSMock.setup();
      
      DaemonOSMock.setExecPath('/custom/node');
      mock.kill(12345, 'SIGTERM');
      
      expect(DaemonOSMock.getKillCalls()).toHaveLength(1);
      expect(DaemonOSMock.getConfig().execPath).toBe('/custom/node');
      
      DaemonOSMock.clearKillHistory();
      
      expect(DaemonOSMock.getKillCalls()).toHaveLength(0);
      expect(DaemonOSMock.getConfig().execPath).toBe('/custom/node'); // Should preserve config
    });
  });

  describe('delayed kill simulation', () => {
    it('should simulate delayed kill success', async () => {
      DaemonOSMock.setKillBehavior('success');
      
      const promise = DaemonOSMock.simulateDelayedKill(12345, 'SIGTERM', 50);
      
      const result = await promise;
      expect(result).toBe(true);
      expect(DaemonOSMock.wasKillCalledWith(12345, 'SIGTERM')).toBe(true);
    });

    it('should simulate delayed kill failure', async () => {
      DaemonOSMock.setKillBehavior('failure', 'Delayed error');
      
      const promise = DaemonOSMock.simulateDelayedKill(12345, 'SIGTERM', 50);
      
      await expect(promise).rejects.toThrow('Delayed error');
      expect(DaemonOSMock.wasKillCalledWith(12345, 'SIGTERM')).toBe(true);
    });
  });

  describe('mock process creation', () => {
    it('should create standalone mock process', () => {
      const mockProcess = DaemonOSMock.createMockProcess({
        execPath: '/standalone/node',
        platform: 'freebsd'
      });
      
      expect(mockProcess.execPath).toBe('/standalone/node');
      expect(mockProcess.platform).toBe('freebsd');
      expect(jest.isMockFunction(mockProcess.kill)).toBe(true);
    });
  });
});