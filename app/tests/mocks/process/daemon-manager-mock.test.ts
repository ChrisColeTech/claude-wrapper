/**
 * Daemon Manager Mock Tests
 * Verify the mock functionality works as expected
 */

import { MockDaemonManager, DaemonManagerMock } from './daemon-manager-mock';
import { DaemonError } from '../../../src/process/daemon';

describe('DaemonManagerMock', () => {
  beforeEach(() => {
    DaemonManagerMock.resetAll();
  });

  afterEach(() => {
    DaemonManagerMock.resetAll();
  });

  describe('MockDaemonManager', () => {
    it('should create mock with default configuration', () => {
      const mock = new MockDaemonManager();

      expect(mock.isDaemonRunning()).toBe(false);
      expect(mock.getCalls()).toEqual([
        { method: 'isDaemonRunning', args: [] }
      ]);
    });

    it('should track startDaemon calls', async () => {
      const mock = new MockDaemonManager({ startPid: 12345 });

      const result = await mock.startDaemon({ port: '8000' });

      expect(result).toBe(12345);
      expect(mock.wasMethodCalled('startDaemon')).toBe(true);
      expect(mock.getMethodCallCount('startDaemon')).toBe(1);
    });

    it('should throw error when startDaemon fails', async () => {
      const mock = new MockDaemonManager({
        startShouldFail: true,
        startError: 'Test start failure'
      });

      await expect(mock.startDaemon({ port: '8000' }))
        .rejects
        .toThrow(DaemonError);

      const error = await mock.startDaemon({ port: '8000' }).catch(err => err);
      expect(error.message).toBe('Test start failure');
      expect(error.operation).toBe('start');
    });

    it('should track isDaemonRunning calls', () => {
      const mock = new MockDaemonManager({ isRunning: true });

      const result = mock.isDaemonRunning();

      expect(result).toBe(true);
      expect(mock.wasMethodCalled('isDaemonRunning')).toBe(true);
    });

    it('should track stopDaemon calls', async () => {
      const mock = new MockDaemonManager();

      const result = await mock.stopDaemon();

      expect(result).toBe(true);
      expect(mock.wasMethodCalled('stopDaemon')).toBe(true);
    });

    it('should throw error when stopDaemon fails', async () => {
      const mock = new MockDaemonManager({
        stopShouldFail: true,
        stopError: 'Test stop failure'
      });

      await expect(mock.stopDaemon())
        .rejects
        .toThrow(DaemonError);

      const error = await mock.stopDaemon().catch(err => err);
      expect(error.message).toBe('Test stop failure');
      expect(error.operation).toBe('stop');
    });

    it('should track getDaemonStatus calls', async () => {
      const mock = new MockDaemonManager({
        statusRunning: true,
        statusPid: 12345
      });

      const result = await mock.getDaemonStatus();

      expect(result).toEqual({ running: true, pid: 12345 });
      expect(mock.wasMethodCalled('getDaemonStatus')).toBe(true);
    });

    it('should update configuration dynamically', async () => {
      const mock = new MockDaemonManager({ startPid: 12345 });

      mock.updateConfig({ startPid: 54321 });

      const result = await mock.startDaemon({ port: '8000' });
      expect(result).toBe(54321);
    });

    it('should reset call history and configuration', async () => {
      const mock = new MockDaemonManager({ startPid: 12345 });

      await mock.startDaemon({ port: '8000' });
      expect(mock.getCalls().length).toBe(1);

      mock.reset({ startPid: 99999 });

      expect(mock.getCalls().length).toBe(0);
      const result = await mock.startDaemon({ port: '8000' });
      expect(result).toBe(99999);
    });

    it('should get last method call details', async () => {
      const mock = new MockDaemonManager({ startPid: 12345 });

      await mock.startDaemon({ port: '8000', verbose: true });

      const lastCall = mock.getLastMethodCall('startDaemon');
      expect(lastCall?.method).toBe('startDaemon');
      expect(lastCall?.args[0]).toEqual({ port: '8000', verbose: true });
    });

    it('should simulate already running scenario', () => {
      const mock = new MockDaemonManager();

      mock.simulateAlreadyRunning(12345);

      expect(mock.isDaemonRunning()).toBe(true);
      expect(mock.getDaemonStatus()).resolves.toEqual({ running: true, pid: 12345 });
    });

    it('should simulate stopped scenario', () => {
      const mock = new MockDaemonManager({ isRunning: true, statusPid: 12345 });

      mock.simulateStopped();

      expect(mock.isDaemonRunning()).toBe(false);
      expect(mock.getDaemonStatus()).resolves.toEqual({ running: false, pid: null });
    });
  });

  describe('DaemonManagerMock Utility', () => {
    it('should create named instances', () => {
      const mock1 = DaemonManagerMock.create('test1', { startPid: 12345 });
      const mock2 = DaemonManagerMock.create('test2', { startPid: 54321 });

      expect(DaemonManagerMock.getInstance('test1')).toBe(mock1);
      expect(DaemonManagerMock.getInstance('test2')).toBe(mock2);
    });

    it('should create success scenario mock', async () => {
      const mock = DaemonManagerMock.createSuccessScenario();

      const result = await mock.startDaemon({ port: '8000' });
      expect(result).toBe(12345);
      expect(mock.isDaemonRunning()).toBe(false);
    });

    it('should create failure scenario mock', async () => {
      const mock = DaemonManagerMock.createFailureScenario();

      await expect(mock.startDaemon({ port: '8000' }))
        .rejects
        .toThrow('Failed to start daemon process');

      await expect(mock.stopDaemon())
        .rejects
        .toThrow('Failed to stop daemon process');
    });

    it('should create already running scenario mock', async () => {
      const mock = DaemonManagerMock.createAlreadyRunningScenario(99999);

      expect(mock.isDaemonRunning()).toBe(true);
      
      const status = await mock.getDaemonStatus();
      expect(status).toEqual({ running: true, pid: 99999 });

      await expect(mock.startDaemon({ port: '8000' }))
        .rejects
        .toThrow('Daemon already running with PID 99999');
    });

    it('should get all instance names', () => {
      DaemonManagerMock.create('instance1');
      DaemonManagerMock.create('instance2');
      DaemonManagerMock.create('instance3');

      const names = DaemonManagerMock.getInstanceNames();
      expect(names).toContain('instance1');
      expect(names).toContain('instance2');
      expect(names).toContain('instance3');
    });

    it('should reset all instances', () => {
      DaemonManagerMock.create('instance1');
      DaemonManagerMock.create('instance2');

      expect(DaemonManagerMock.getInstanceNames().length).toBe(2);

      DaemonManagerMock.resetAll();

      expect(DaemonManagerMock.getInstanceNames().length).toBe(0);
    });

    it('should return undefined for non-existent instance', () => {
      const instance = DaemonManagerMock.getInstance('non-existent');
      expect(instance).toBeUndefined();
    });
  });

  describe('call tracking', () => {
    it('should track multiple method calls in order', async () => {
      const mock = new MockDaemonManager({ startPid: 12345 });

      await mock.startDaemon({ port: '8000' });
      mock.isDaemonRunning();
      await mock.getDaemonStatus();
      await mock.stopDaemon();

      const calls = mock.getCalls();
      expect(calls.length).toBe(4);
      expect(calls[0]?.method).toBe('startDaemon');
      expect(calls[1]?.method).toBe('isDaemonRunning');
      expect(calls[2]?.method).toBe('getDaemonStatus');
      expect(calls[3]?.method).toBe('stopDaemon');
    });

    it('should track method call arguments', async () => {
      const mock = new MockDaemonManager({ startPid: 12345 });

      const options = { port: '9999', apiKey: 'test-key', verbose: true };
      await mock.startDaemon(options);

      const lastCall = mock.getLastMethodCall('startDaemon');
      expect(lastCall?.args[0]).toEqual(options);
    });
  });

  describe('configuration edge cases', () => {
    it('should handle undefined configuration gracefully', () => {
      const mock = new MockDaemonManager(undefined);

      expect(mock.isDaemonRunning()).toBe(false);
      expect(mock.getDaemonStatus()).resolves.toEqual({ running: false, pid: null });
    });

    it('should handle partial configuration updates', async () => {
      const mock = new MockDaemonManager({ startPid: 12345, isRunning: true });

      mock.updateConfig({ startPid: 54321 }); // Only update PID

      expect(mock.isDaemonRunning()).toBe(true); // Should remain true
      
      const result = await mock.startDaemon({ port: '8000' });
      expect(result).toBe(54321); // Should use new PID
    });
  });
});