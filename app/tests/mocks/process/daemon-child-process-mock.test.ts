/**
 * Test the daemon child process mock to ensure it works correctly
 */

import { DaemonChildProcessMock } from './daemon-child-process-mock';

describe('DaemonChildProcessMock', () => {
  beforeEach(() => {
    DaemonChildProcessMock.reset();
  });

  afterEach(() => {
    DaemonChildProcessMock.reset();
  });

  describe('setup and configuration', () => {
    it('should create mock with default configuration', () => {
      const mock = DaemonChildProcessMock.setup();
      
      expect(mock.spawn).toBeDefined();
      expect(jest.isMockFunction(mock.spawn)).toBe(true);
    });

    it('should create mock with custom PID', () => {
      const mock = DaemonChildProcessMock.setup({ spawnPid: 99999 });
      
      const result = mock.spawn('node', ['script.js']);
      expect(result.pid).toBe(99999);
    });

    it('should simulate spawn failure', () => {
      const mock = DaemonChildProcessMock.setup({ 
        spawnFailure: true, 
        spawnError: 'Custom error' 
      });
      
      expect(() => mock.spawn('node', ['script.js'])).toThrow('Custom error');
    });
  });

  describe('mock state management', () => {
    it('should track spawn calls', () => {
      const mock = DaemonChildProcessMock.setup();
      
      mock.spawn('node', ['script1.js'], { detached: true });
      mock.spawn('node', ['script2.js'], { detached: false });
      
      const calls = DaemonChildProcessMock.getSpawnCalls();
      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual(['node', ['script1.js'], { detached: true }]);
      expect(calls[1]).toEqual(['node', ['script2.js'], { detached: false }]);
    });

    it('should verify specific spawn calls', () => {
      const mock = DaemonChildProcessMock.setup();
      
      mock.spawn('node', ['test.js'], { detached: true, stdio: 'ignore' });
      
      expect(DaemonChildProcessMock.wasSpawnCalledWith(
        'node', 
        ['test.js'], 
        { detached: true, stdio: 'ignore' }
      )).toBe(true);
      
      expect(DaemonChildProcessMock.wasSpawnCalledWith(
        'node', 
        ['other.js']
      )).toBe(false);
    });
  });

  describe('dynamic configuration', () => {
    it('should allow changing spawn behavior after setup', () => {
      const mock = DaemonChildProcessMock.setup({ spawnPid: 12345 });
      
      // Initial spawn should work
      let result = mock.spawn('node', ['script.js']);
      expect(result.pid).toBe(12345);
      
      // Change to failure
      DaemonChildProcessMock.setSpawnFailure(true, 'Later error');
      
      expect(() => mock.spawn('node', ['script.js'])).toThrow('Later error');
    });

    it('should allow changing PID after setup', () => {
      const mock = DaemonChildProcessMock.setup({ spawnPid: 12345 });
      
      DaemonChildProcessMock.setSpawnPid(67890);
      
      const result = mock.spawn('node', ['script.js']);
      expect(result.pid).toBe(67890);
    });
  });

  describe('mock child process object', () => {
    it('should create proper mock child process', () => {
      const mock = DaemonChildProcessMock.setup({ spawnPid: 12345 });
      
      const childProcess = mock.spawn('node', ['script.js']);
      
      expect(childProcess).toHaveProperty('pid', 12345);
      expect(childProcess).toHaveProperty('unref');
      expect(childProcess).toHaveProperty('on');
      expect(jest.isMockFunction(childProcess.unref)).toBe(true);
      expect(jest.isMockFunction(childProcess.on)).toBe(true);
    });

    it('should handle undefined PID scenario', () => {
      const mock = DaemonChildProcessMock.setup({ spawnPid: undefined });
      
      const childProcess = mock.spawn('node', ['script.js']);
      
      expect(childProcess.pid).toBeUndefined();
    });
  });

  describe('reset functionality', () => {
    it('should reset configuration to defaults', () => {
      // Configure non-default settings
      DaemonChildProcessMock.setup({ spawnPid: 99999, spawnFailure: true });
      DaemonChildProcessMock.setSpawnFailure(true, 'Custom error');
      
      // Reset
      DaemonChildProcessMock.reset();
      
      // Should be back to defaults
      const mock = DaemonChildProcessMock.setup();
      const result = mock.spawn('node', ['script.js']);
      expect(result.pid).toBe(12345); // Default PID
      expect(() => mock.spawn('node', ['script.js'])).not.toThrow();
    });

    it('should clear spawn call history on reset', () => {
      const mock = DaemonChildProcessMock.setup();
      mock.spawn('node', ['script.js']);
      
      expect(DaemonChildProcessMock.getSpawnCalls()).toHaveLength(1);
      
      DaemonChildProcessMock.reset();
      
      expect(DaemonChildProcessMock.getSpawnCalls()).toHaveLength(0);
    });
  });

  describe('module mock creation', () => {
    it('should create module mock for jest.mock usage', () => {
      const moduleMock = DaemonChildProcessMock.createModuleMock({ spawnPid: 54321 });
      
      expect(moduleMock.spawn).toBeDefined();
      
      const result = moduleMock.spawn('node', ['script.js']);
      expect(result.pid).toBe(54321);
    });
  });

  describe('process event simulation', () => {
    it('should simulate process events', () => {
      const mock = DaemonChildProcessMock.setup();
      const childProcess = mock.spawn('node', ['script.js']);
      
      const exitCallback = jest.fn();
      const errorCallback = jest.fn();
      
      childProcess.on('exit', exitCallback);
      childProcess.on('error', errorCallback);
      
      // Simulate events
      DaemonChildProcessMock.simulateProcessEvent('exit', 0);
      DaemonChildProcessMock.simulateProcessEvent('error', new Error('Test error'));
      
      expect(exitCallback).toHaveBeenCalledWith(0);
      expect(errorCallback).toHaveBeenCalledWith(new Error('Test error'));
    });
  });
});