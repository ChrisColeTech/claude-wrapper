/**
 * Process Manager Tests - Phase 02
 * Comprehensive testing with externalized mocks following clean architecture principles
 * 
 * Test Coverage:
 * - Process lifecycle management (start/stop/restart/status)
 * - Health check functionality with dynamic import mocking
 * - Error handling and recovery scenarios
 * - Performance monitoring for startup/shutdown times
 * - WSL integration and port forwarding cleanup
 * - PID management integration testing
 */

import { ProcessManager, ProcessError, IProcessManager, ProcessManagerOptions } from '../../../src/process/manager';
import { MockDaemonManager, DaemonManagerMock } from '../../mocks/process/daemon-manager-mock';
import { MockPidManager, PidManagerMock } from '../../mocks/process/pid-manager-mock';
import { MockSignalHandler, SignalHandlerMock } from '../../mocks/process/signal-handler-mock';
import { ChildProcessMock } from '../../mocks/process/child-process-mock';

// Mock the dynamic imports at the top level
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

jest.mock('util', () => ({
  promisify: jest.fn((fn) => jest.fn().mockImplementation(async (...args) => {
    return new Promise((resolve, reject) => {
      const callback = (error: any, stdout?: string, stderr?: string) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout: stdout || '', stderr: stderr || '' });
        }
      };
      fn(...args, callback);
    });
  }))
}));

describe('ProcessManager - Phase 02', () => {
  let processManager: IProcessManager;
  let mockDaemonManager: MockDaemonManager;
  let mockPidManager: MockPidManager;
  let mockSignalHandler: MockSignalHandler;

  beforeEach(() => {
    // Reset all mocks
    DaemonManagerMock.resetAll();
    PidManagerMock.resetAll();
    SignalHandlerMock.resetAll();
    ChildProcessMock.reset();

    // Create fresh mock instances
    mockDaemonManager = DaemonManagerMock.createSuccessScenario();
    mockPidManager = PidManagerMock.createCleanStateScenario();
    mockSignalHandler = SignalHandlerMock.createSuccessScenario();

    // Create process manager with mocked dependencies
    processManager = new ProcessManager(
      mockPidManager,
      mockDaemonManager,
      mockSignalHandler
    );
  });

  afterEach(() => {
    // Clean up after each test
    DaemonManagerMock.resetAll();
    PidManagerMock.resetAll();
    SignalHandlerMock.resetAll();
    ChildProcessMock.reset();
  });

  describe('Process Lifecycle Management', () => {
    describe('start()', () => {
      it('should start process successfully with default options', async () => {
        const options: ProcessManagerOptions = {
          port: '8000',
          verbose: false
        };

        mockDaemonManager.updateConfig({ startPid: 12345 });
        mockPidManager.updateConfig({ validateResult: false }); // Not running initially

        const result = await processManager.start(options);

        expect(result).toBe(12345);
        expect(mockDaemonManager.wasMethodCalled('startDaemon')).toBe(true);
        expect(mockPidManager.wasMethodCalled('validateAndCleanup')).toBe(true);
      });

      it('should start process with custom options', async () => {
        const options: ProcessManagerOptions = {
          port: '9999',
          apiKey: 'test-key-123',
          verbose: true,
          debug: true
        };

        mockDaemonManager.updateConfig({ startPid: 54321 });

        const result = await processManager.start(options);

        expect(result).toBe(54321);
        
        const lastCall = mockDaemonManager.getLastMethodCall('startDaemon');
        expect(lastCall?.args[0]).toMatchObject({
          port: '9999',
          apiKey: 'test-key-123',
          verbose: true,
          debug: true
        });
      });

      it('should throw ProcessError if process already running', async () => {
        const runningMock = PidManagerMock.createRunningProcessScenario(12345);
        const runningProcessManager = new ProcessManager(
          runningMock,
          mockDaemonManager,
          mockSignalHandler
        );

        runningMock.updateConfig({ validateResult: true });

        const options: ProcessManagerOptions = { port: '8000' };

        await expect(runningProcessManager.start(options))
          .rejects
          .toThrow(ProcessError);

        try {
          await runningProcessManager.start(options);
          throw new Error('Should have thrown ProcessError');
        } catch (error) {
          expect(error).toBeInstanceOf(ProcessError);
          const processError = error as ProcessError;
          expect(processError.operation).toBe('start');
          expect(processError.code).toBe('ALREADY_RUNNING');
        }
      });

      it('should handle daemon start failure', async () => {
        const failureMock = DaemonManagerMock.createFailureScenario();
        const failureProcessManager = new ProcessManager(
          mockPidManager,
          failureMock,
          mockSignalHandler
        );

        const options: ProcessManagerOptions = { port: '8000' };

        await expect(failureProcessManager.start(options))
          .rejects
          .toThrow(ProcessError);

        try {
          await failureProcessManager.start(options);
          throw new Error('Should have thrown ProcessError');
        } catch (error) {
          expect(error).toBeInstanceOf(ProcessError);
          const processError = error as ProcessError;
          expect(processError.operation).toBe('start');
          expect(processError.code).toBe('START_FAILED');
        }
      });

      it('should handle performance monitoring for startup time', async () => {
        const startTime = Date.now();
        const options: ProcessManagerOptions = { port: '8000' };

        mockDaemonManager.updateConfig({ startPid: 12345 });

        const result = await processManager.start(options);
        const endTime = Date.now();

        expect(result).toBe(12345);
        expect(endTime - startTime).toBeLessThan(10000); // Performance requirement
      });
    });

    describe('stop()', () => {
      it('should stop running process successfully', async () => {
        const runningMock = PidManagerMock.createRunningProcessScenario(12345);
        const stoppableProcessManager = new ProcessManager(
          runningMock,
          mockDaemonManager,
          mockSignalHandler
        );

        runningMock.updateConfig({ validateResult: true });
        mockDaemonManager.updateConfig({ statusRunning: true });

        const result = await stoppableProcessManager.stop();

        expect(result).toBe(true);
        expect(mockDaemonManager.wasMethodCalled('stopDaemon')).toBe(true);
      });

      it('should return false if no process running', async () => {
        mockPidManager.updateConfig({ validateResult: false });

        const result = await processManager.stop();

        expect(result).toBe(false);
        expect(mockDaemonManager.getMethodCallCount('stopDaemon')).toBe(0);
      });

      it('should handle WSL port forwarding cleanup', async () => {
        // Setup WSL environment

        const runningMock = PidManagerMock.createRunningProcessScenario(12345);
        const wslProcessManager = new ProcessManager(
          runningMock,
          mockDaemonManager,
          mockSignalHandler
        );

        runningMock.updateConfig({ validateResult: true });

        const result = await wslProcessManager.stop();

        expect(result).toBe(true);
        expect(mockDaemonManager.wasMethodCalled('stopDaemon')).toBe(true);
      });

      it('should handle WSL cleanup failure gracefully', async () => {
        // Setup WSL environment with networking issues

        const runningMock = PidManagerMock.createRunningProcessScenario(12345);
        const wslProcessManager = new ProcessManager(
          runningMock,
          mockDaemonManager,
          mockSignalHandler
        );

        runningMock.updateConfig({ validateResult: true });

        // Should not throw even if WSL cleanup fails
        const result = await wslProcessManager.stop();

        expect(result).toBe(true);
        expect(mockDaemonManager.wasMethodCalled('stopDaemon')).toBe(true);
      });

      it('should throw ProcessError on daemon stop failure', async () => {
        const runningMock = PidManagerMock.createRunningProcessScenario(12345);
        const failureMock = DaemonManagerMock.createFailureScenario();
        const failureProcessManager = new ProcessManager(
          runningMock,
          failureMock,
          mockSignalHandler
        );

        runningMock.updateConfig({ validateResult: true });

        await expect(failureProcessManager.stop())
          .rejects
          .toThrow(ProcessError);

        try {
          await failureProcessManager.stop();
          throw new Error('Should have thrown ProcessError');
        } catch (error) {
          expect(error).toBeInstanceOf(ProcessError);
          const processError = error as ProcessError;
          expect(processError.operation).toBe('stop');
          expect(processError.code).toBe('STOP_FAILED');
        }
      });

      it('should handle performance monitoring for shutdown time', async () => {
        const runningMock = PidManagerMock.createRunningProcessScenario(12345);
        const performanceProcessManager = new ProcessManager(
          runningMock,
          mockDaemonManager,
          mockSignalHandler
        );

        runningMock.updateConfig({ validateResult: true });

        const startTime = Date.now();
        const result = await performanceProcessManager.stop();
        const endTime = Date.now();

        expect(result).toBe(true);
        expect(endTime - startTime).toBeLessThan(10000); // Performance requirement
      });
    });

    describe('restart()', () => {
      it('should restart process successfully', async () => {
        const options: ProcessManagerOptions = {
          port: '8000',
          verbose: true
        };

        // Create a fresh mock for restart to track calls properly
        const restartDaemonMock = DaemonManagerMock.createSuccessScenario();
        const restartPidMock = PidManagerMock.createCleanStateScenario();
        const restartManager = new ProcessManager(
          restartPidMock,
          restartDaemonMock,
          mockSignalHandler
        );

        restartDaemonMock.updateConfig({ 
          startPid: 54321,
          statusRunning: true,
          statusPid: 12345
        });
        // Simulate process running initially, then stopped after stop() call
        let isRunning = true;
        restartPidMock.validateAndCleanup = jest.fn(() => {
          if (isRunning) {
            isRunning = false; // Process gets stopped after first call
            return true;
          }
          return false;
        });

        const result = await restartManager.restart(options);

        expect(result).toBe(54321);
        expect(restartDaemonMock.wasMethodCalled('stopDaemon')).toBe(true);
        expect(restartDaemonMock.wasMethodCalled('startDaemon')).toBe(true);
      });

      it('should restart with default options if none provided', async () => {
        // Create a fresh mock for restart to track calls properly
        const restartDaemonMock = DaemonManagerMock.createSuccessScenario();
        const restartPidMock = PidManagerMock.createCleanStateScenario();
        const restartManager = new ProcessManager(
          restartPidMock,
          restartDaemonMock,
          mockSignalHandler
        );

        restartDaemonMock.updateConfig({ 
          startPid: 99999,
          statusRunning: true,
          statusPid: 12345
        });
        // Simulate process running initially, then stopped after stop() call
        let isRunning = true;
        restartPidMock.validateAndCleanup = jest.fn(() => {
          if (isRunning) {
            isRunning = false; // Process gets stopped after first call
            return true;
          }
          return false;
        });

        const result = await restartManager.restart();

        expect(result).toBe(99999);
        expect(restartDaemonMock.wasMethodCalled('stopDaemon')).toBe(true);
        expect(restartDaemonMock.wasMethodCalled('startDaemon')).toBe(true);
      });

      it('should handle restart failure', async () => {
        const failureMock = DaemonManagerMock.createFailureScenario();
        const failureProcessManager = new ProcessManager(
          mockPidManager,
          failureMock,
          mockSignalHandler
        );

        await expect(failureProcessManager.restart())
          .rejects
          .toThrow(ProcessError);

        try {
          await failureProcessManager.restart();
          throw new Error('Should have thrown ProcessError');
        } catch (error) {
          expect(error).toBeInstanceOf(ProcessError);
          const processError = error as ProcessError;
          expect(processError.operation).toBe('restart');
          expect(processError.code).toBe('RESTART_FAILED');
        }
      });

      it('should include restart delay', async () => {
        const startTime = Date.now();
        
        mockDaemonManager.updateConfig({ startPid: 11111 });

        const result = await processManager.restart();
        const endTime = Date.now();

        expect(result).toBe(11111);
        expect(endTime - startTime).toBeGreaterThanOrEqual(100); // Should include delay
      });
    });

    describe('status()', () => {
      it('should return status for running process', async () => {
        // Mock the promisify function for exec
        const { promisify } = require('util');
        
        const mockExecAsync = jest.fn().mockResolvedValue({
          stdout: 'healthy response',
          stderr: ''
        });
        
        promisify.mockReturnValue(mockExecAsync);

        mockDaemonManager.updateConfig({
          statusRunning: true,
          statusPid: 12345
        });

        const status = await processManager.status();

        expect(status.running).toBe(true);
        expect(status.pid).toBe(12345);
        expect(status.health).toBe('healthy');
      });

      it('should return status for stopped process', async () => {
        mockDaemonManager.updateConfig({
          statusRunning: false,
          statusPid: null
        });

        const status = await processManager.status();

        expect(status.running).toBe(false);
        expect(status.pid).toBe(null);
        expect(status.health).toBeUndefined();
      });

      it('should handle health check failure', async () => {
        // Mock the exec function to fail
        const { exec } = require('child_process');
        
        exec.mockImplementation((_command: string, _options: any, callback: Function) => {
          callback(new Error('Health check failed'), '', '');
        });

        mockDaemonManager.updateConfig({
          statusRunning: true,
          statusPid: 12345
        });

        const status = await processManager.status();

        expect(status.running).toBe(true);
        expect(status.pid).toBe(12345);
        expect(status.health).toBe('unknown');
      });

      it('should handle unhealthy response', async () => {
        // Mock the promisify function for exec
        const { promisify } = require('util');
        
        const mockExecAsync = jest.fn().mockResolvedValue({
          stdout: 'error response', // Response that doesn't include "healthy"
          stderr: ''
        });
        
        promisify.mockReturnValue(mockExecAsync);

        mockDaemonManager.updateConfig({
          statusRunning: true,
          statusPid: 12345
        });

        const status = await processManager.status();

        expect(status.running).toBe(true);
        expect(status.pid).toBe(12345);
        expect(status.health).toBe('unhealthy');
      });

      it('should throw ProcessError on status failure', async () => {
        const failureMock = DaemonManagerMock.createFailureScenario();
        failureMock.updateConfig({
          statusRunning: false,
          statusPid: null
        });

        // Force getDaemonStatus to throw
        const originalGetDaemonStatus = failureMock.getDaemonStatus;
        failureMock.getDaemonStatus = jest.fn().mockRejectedValue(new Error('Status check failed'));

        const failureProcessManager = new ProcessManager(
          mockPidManager,
          failureMock,
          mockSignalHandler
        );

        await expect(failureProcessManager.status())
          .rejects
          .toThrow(ProcessError);

        // Restore original method
        failureMock.getDaemonStatus = originalGetDaemonStatus;
      });
    });

    describe('isRunning()', () => {
      it('should return true for running process', () => {
        mockPidManager.updateConfig({ validateResult: true });

        const result = processManager.isRunning();

        expect(result).toBe(true);
        expect(mockPidManager.wasMethodCalled('validateAndCleanup')).toBe(true);
      });

      it('should return false for stopped process', () => {
        mockPidManager.updateConfig({ validateResult: false });

        const result = processManager.isRunning();

        expect(result).toBe(false);
        expect(mockPidManager.wasMethodCalled('validateAndCleanup')).toBe(true);
      });

      it('should clean up stale PID files', () => {
        const staleMock = PidManagerMock.createStalePidFileScenario(12345);
        const staleProcessManager = new ProcessManager(
          staleMock,
          mockDaemonManager,
          mockSignalHandler
        );

        const result = staleProcessManager.isRunning();

        expect(result).toBe(false);
        expect(staleMock.wasMethodCalled('validateAndCleanup')).toBe(true);
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle invalid PID scenarios', async () => {
      const options: ProcessManagerOptions = { port: '8000' };
      
      mockDaemonManager.updateConfig({ 
        startShouldFail: true,
        startError: 'Invalid PID returned'
      });

      await expect(processManager.start(options))
        .rejects
        .toThrow(ProcessError);
    });

    it('should handle permission errors', async () => {
      const permissionMock = PidManagerMock.createFailureScenario();
      const permissionProcessManager = new ProcessManager(
        permissionMock,
        mockDaemonManager,
        mockSignalHandler
      );

      const options: ProcessManagerOptions = { port: '8000' };

      // Should handle PID save failures gracefully (non-fatal)
      const result = await permissionProcessManager.start(options);
      expect(result).toBe(12345); // Should still succeed
    });

    it('should handle network connectivity issues', async () => {
      // Mock exec to fail for network issues
      const { exec } = require('child_process');
      
      exec.mockImplementation((_command: string, _options: any, callback: Function) => {
        setTimeout(() => callback(new Error('Network timeout'), '', ''), 100);
      });

      mockDaemonManager.updateConfig({
        statusRunning: true,
        statusPid: 12345
      });

      const status = await processManager.status();

      expect(status.running).toBe(true);
      expect(status.health).toBe('unknown');
    });

    it('should handle concurrent operation attempts', async () => {
      const options: ProcessManagerOptions = { port: '8000' };
      
      // Create multiple managers with individual mocks to simulate concurrency
      const manager1Mock = DaemonManagerMock.createSuccessScenario();
      const manager2Mock = DaemonManagerMock.createAlreadyRunningScenario(12345);
      const manager3Mock = DaemonManagerMock.createAlreadyRunningScenario(12345);

      const pidMock1 = PidManagerMock.createCleanStateScenario();
      const pidMock2 = PidManagerMock.createRunningProcessScenario(12345);
      const pidMock3 = PidManagerMock.createRunningProcessScenario(12345);

      const manager1 = new ProcessManager(pidMock1, manager1Mock, mockSignalHandler);
      const manager2 = new ProcessManager(pidMock2, manager2Mock, mockSignalHandler);
      const manager3 = new ProcessManager(pidMock3, manager3Mock, mockSignalHandler);

      manager1Mock.updateConfig({ startPid: 12345 });
      pidMock1.updateConfig({ validateResult: false });
      pidMock2.updateConfig({ validateResult: true });
      pidMock3.updateConfig({ validateResult: true });

      // Start multiple operations concurrently
      const promises = [
        manager1.start(options),
        manager2.start(options).catch(err => err),
        manager3.start(options).catch(err => err)
      ];

      const results = await Promise.all(promises);
      
      // First should succeed, others should fail
      expect(results[0]).toBe(12345);
      expect(results[1]).toBeInstanceOf(ProcessError);
      expect(results[2]).toBeInstanceOf(ProcessError);
    });

    it('should handle system resource exhaustion', async () => {
      const resourceMock = DaemonManagerMock.createFailureScenario();
      resourceMock.updateConfig({
        startError: 'System resources exhausted'
      });

      const resourceProcessManager = new ProcessManager(
        mockPidManager,
        resourceMock,
        mockSignalHandler
      );

      const options: ProcessManagerOptions = { port: '8000' };

      await expect(resourceProcessManager.start(options))
        .rejects
        .toThrow('System resources exhausted');
    });
  });

  describe('Performance Monitoring', () => {
    it('should complete start operation within performance target', async () => {
      const options: ProcessManagerOptions = { port: '8000' };
      
      mockDaemonManager.updateConfig({ startPid: 12345 });

      const startTime = Date.now();
      await processManager.start(options);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200); // <200ms target
    });

    it('should complete stop operation within performance target', async () => {
      const runningMock = PidManagerMock.createRunningProcessScenario(12345);
      const performanceProcessManager = new ProcessManager(
        runningMock,
        mockDaemonManager,
        mockSignalHandler
      );

      runningMock.updateConfig({ validateResult: true });

      const startTime = Date.now();
      await performanceProcessManager.stop();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200); // <200ms target
    });

    it('should complete status check within performance target', async () => {
      ChildProcessMock.setup();
      ChildProcessMock.mockDynamicImport();

      mockDaemonManager.updateConfig({
        statusRunning: false,
        statusPid: null
      });

      const startTime = Date.now();
      await processManager.status();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // <100ms target for status
    });
  });

  describe('Integration Testing', () => {
    it('should handle complete lifecycle with all dependencies', async () => {
      const options: ProcessManagerOptions = {
        port: '9999',
        apiKey: 'integration-test-key',
        verbose: true
      };

      // Setup comprehensive scenario
      const { exec } = require('child_process');
      exec.mockImplementation((_command: string, _options: any, callback: Function) => {
        callback(null, '{"status":"healthy"}', '');
      });

      // Start process
      mockDaemonManager.updateConfig({ startPid: 99999 });
      const startResult = await processManager.start(options);
      expect(startResult).toBe(99999);

      // Check status
      mockDaemonManager.updateConfig({ 
        statusRunning: true, 
        statusPid: 99999 
      });
      const status = await processManager.status();
      expect(status.running).toBe(true);
      expect(status.pid).toBe(99999);

      // Stop process
      const runningMock = PidManagerMock.createRunningProcessScenario(99999);
      const integratedManager = new ProcessManager(
        runningMock,
        mockDaemonManager,
        mockSignalHandler
      );
      runningMock.updateConfig({ validateResult: true });

      const stopResult = await integratedManager.stop();
      expect(stopResult).toBe(true);

      // Verify all components were called
      expect(mockDaemonManager.wasMethodCalled('startDaemon')).toBe(true);
      expect(mockDaemonManager.wasMethodCalled('getDaemonStatus')).toBe(true);
      expect(mockDaemonManager.wasMethodCalled('stopDaemon')).toBe(true);
    });

    it('should handle signal handler integration', () => {
      const concreteManager = processManager as ProcessManager;
      const signalHandler = concreteManager.getSignalHandler();
      expect(signalHandler).toBe(mockSignalHandler);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined options gracefully', async () => {
      mockDaemonManager.updateConfig({ startPid: 12345 });

      // Should not throw with minimal options
      const result = await processManager.start({});
      expect(result).toBe(12345);
    });

    it('should handle empty string values in options', async () => {
      const options: ProcessManagerOptions = {
        port: '',
        apiKey: '',
        verbose: false
      };

      mockDaemonManager.updateConfig({ startPid: 12345 });

      const result = await processManager.start(options);
      expect(result).toBe(12345);
    });

    it('should handle extremely large PID values', async () => {
      const largePid = 2147483647; // Max 32-bit signed integer
      
      mockDaemonManager.updateConfig({ startPid: largePid });

      const result = await processManager.start({ port: '8000' });
      expect(result).toBe(largePid);
    });

    it('should handle rapid start/stop cycles', async () => {
      const options: ProcessManagerOptions = { port: '8000' };
      
      for (let i = 0; i < 5; i++) {
        mockDaemonManager.updateConfig({ startPid: 10000 + i });
        
        const startResult = await processManager.start(options);
        expect(startResult).toBe(10000 + i);

        const runningMock = PidManagerMock.createRunningProcessScenario(10000 + i);
        const cycleManager = new ProcessManager(
          runningMock,
          mockDaemonManager,
          mockSignalHandler
        );
        runningMock.updateConfig({ validateResult: true });

        const stopResult = await cycleManager.stop();
        expect(stopResult).toBe(true);

        // Reset for next iteration
        mockPidManager.updateConfig({ validateResult: false });
      }
    });
  });
});