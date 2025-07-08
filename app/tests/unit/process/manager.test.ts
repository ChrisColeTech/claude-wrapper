/**
 * Process Manager Unit Tests - Phase 6A
 * Tests process orchestration and management functionality
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  mockLogger, 
  resetProcessMocks,
  setupSuccessfulPidOperations,
} from '../../mocks/process-mocks';

// Mock dependencies
jest.mock('../../../src/utils/logger', () => ({
  logger: mockLogger,
}));

jest.mock('../../../src/process/pid', () => ({
  pidManager: {
    readPid: jest.fn(),
    isProcessRunning: jest.fn(),
    validateAndCleanup: jest.fn(),
    savePid: jest.fn(),
    cleanupPidFile: jest.fn(),
  },
}));

jest.mock('../../../src/process/daemon', () => ({
  daemonManager: {
    startDaemon: jest.fn(),
    stopDaemon: jest.fn(),
    isDaemonRunning: jest.fn(),
    getDaemonStatus: jest.fn(),
  },
}));

jest.mock('../../../src/process/signals', () => ({
  signalHandler: {
    setupGracefulShutdown: jest.fn(),
    registerShutdownStep: jest.fn(),
    initiateShutdown: jest.fn(),
  },
}));

// Mock child_process for health check
const mockExec = jest.fn();
jest.mock('child_process', () => ({
  exec: mockExec,
}));

// Mock util for promisify
jest.mock('util', () => ({
  promisify: jest.fn((fn) => fn),
}));

import { ProcessManager, ProcessError, ProcessManagerOptions } from '../../../src/process/manager';
import { pidManager } from '../../../src/process/pid';
import { daemonManager } from '../../../src/process/daemon';
import { signalHandler } from '../../../src/process/signals';

const mockPidManager = pidManager as jest.Mocked<typeof pidManager>;
const mockDaemonManager = daemonManager as jest.Mocked<typeof daemonManager>;
const mockSignalHandler = signalHandler as jest.Mocked<typeof signalHandler>;

describe('ProcessManager', () => {
  let processManager: ProcessManager;

  beforeEach(() => {
    // Reset all mocks
    resetProcessMocks();
    setupSuccessfulPidOperations();
    jest.clearAllMocks();
    
    // Setup default mock behaviors
    mockPidManager.readPid.mockReturnValue(12345);
    mockPidManager.isProcessRunning.mockReturnValue(true);
    mockPidManager.validateAndCleanup.mockReturnValue(false);
    mockDaemonManager.startDaemon.mockResolvedValue(12345);
    mockDaemonManager.stopDaemon.mockResolvedValue(true);
    mockDaemonManager.isDaemonRunning.mockReturnValue(false);
    mockDaemonManager.getDaemonStatus.mockResolvedValue({ running: true, pid: 12345 });
    mockSignalHandler.setupGracefulShutdown.mockReturnValue(undefined);
    mockSignalHandler.registerShutdownStep.mockReturnValue(undefined);
    mockSignalHandler.initiateShutdown.mockResolvedValue(undefined);
    
    // Create fresh instance
    processManager = new ProcessManager();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    test('should create ProcessManager instance', () => {
      expect(processManager).toBeInstanceOf(ProcessManager);
    });

    test('should log initialization', () => {
      new ProcessManager();
      expect(mockLogger.debug).toHaveBeenCalledWith('ProcessManager initialized');
    });

    test('should accept custom dependencies', () => {
      const customPidManager = {} as any;
      const customDaemonManager = {} as any;
      const customSignalHandler = {} as any;
      
      const manager = new ProcessManager(customPidManager, customDaemonManager, customSignalHandler);
      expect(manager).toBeInstanceOf(ProcessManager);
    });

    test('should use default dependencies when not provided', () => {
      const manager = new ProcessManager();
      expect(manager).toBeInstanceOf(ProcessManager);
    });
  });

  describe('start', () => {
    test('should start process with minimal options', async () => {
      const options: ProcessManagerOptions = {};
      
      const pid = await processManager.start(options);
      
      expect(pid).toBe(12345);
      expect(mockDaemonManager.startDaemon).toHaveBeenCalledWith({
        port: undefined,
        apiKey: undefined,
        verbose: undefined,
        debug: undefined,
      });
    });

    test('should start process with all options', async () => {
      const options: ProcessManagerOptions = {
        port: '3000',
        apiKey: 'test-key',
        verbose: true,
        debug: true,
        interactive: false,
      };
      
      const pid = await processManager.start(options);
      
      expect(pid).toBe(12345);
      expect(mockDaemonManager.startDaemon).toHaveBeenCalledWith({
        port: '3000',
        apiKey: 'test-key',
        verbose: true,
        debug: true,
      });
    });

    test('should throw ProcessError when already running', async () => {
      mockPidManager.validateAndCleanup.mockReturnValue(true);
      mockPidManager.readPid.mockReturnValue(12345);
      
      const options: ProcessManagerOptions = {};
      
      await expect(processManager.start(options)).rejects.toThrow(ProcessError);
      await expect(processManager.start(options)).rejects.toThrow('already running');
    });

    test('should log successful start', async () => {
      const options: ProcessManagerOptions = { port: '3000' };
      
      await processManager.start(options);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Process started successfully',
        expect.objectContaining({
          pid: 12345,
          port: '3000',
          startupTime: expect.any(Number)
        })
      );
    });

    test('should warn about slow startup', async () => {
      // Mock slow startup
      mockDaemonManager.startDaemon.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 250));
        return 12345;
      });
      
      const options: ProcessManagerOptions = {};
      
      await processManager.start(options);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Process start exceeded performance target',
        expect.objectContaining({
          elapsed: expect.any(Number),
          target: 200
        })
      );
    });

    test('should throw ProcessError when daemon start fails', async () => {
      mockDaemonManager.startDaemon.mockRejectedValue(new Error('Daemon start failed'));
      
      const options: ProcessManagerOptions = {};
      
      await expect(processManager.start(options)).rejects.toThrow(ProcessError);
    });

    test('should handle ProcessError from daemon', async () => {
      const processError = new ProcessError('Custom error', 'start', 'CUSTOM_ERROR');
      mockDaemonManager.startDaemon.mockRejectedValue(processError);
      
      const options: ProcessManagerOptions = {};
      
      await expect(processManager.start(options)).rejects.toThrow(ProcessError);
      await expect(processManager.start(options)).rejects.toThrow('Custom error');
    });

    test('should wrap non-ProcessError exceptions', async () => {
      mockDaemonManager.startDaemon.mockRejectedValue(new Error('Generic error'));
      
      const options: ProcessManagerOptions = {};
      
      await expect(processManager.start(options)).rejects.toThrow(ProcessError);
      await expect(processManager.start(options)).rejects.toThrow('Failed to start process');
    });

    test('should measure startup time', async () => {
      const options: ProcessManagerOptions = {};
      
      await processManager.start(options);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Process started successfully',
        expect.objectContaining({
          startupTime: expect.any(Number)
        })
      );
    });
  });

  describe('stop', () => {
    test('should stop running process', async () => {
      mockPidManager.validateAndCleanup.mockReturnValue(true);
      
      const result = await processManager.stop();
      
      expect(result).toBe(true);
      expect(mockDaemonManager.stopDaemon).toHaveBeenCalled();
    });

    test('should return false when not running', async () => {
      mockPidManager.validateAndCleanup.mockReturnValue(false);
      
      const result = await processManager.stop();
      
      expect(result).toBe(false);
      expect(mockDaemonManager.stopDaemon).not.toHaveBeenCalled();
    });

    test('should log successful stop', async () => {
      mockPidManager.validateAndCleanup.mockReturnValue(true);
      
      await processManager.stop();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Process stopped successfully',
        expect.objectContaining({
          shutdownTime: expect.any(Number)
        })
      );
    });

    test('should warn about slow shutdown', async () => {
      mockPidManager.validateAndCleanup.mockReturnValue(true);
      mockDaemonManager.stopDaemon.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 250));
        return true;
      });
      
      await processManager.stop();
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Process stop exceeded performance target',
        expect.objectContaining({
          elapsed: expect.any(Number),
          target: 200
        })
      );
    });

    test('should throw ProcessError when stop fails', async () => {
      mockPidManager.validateAndCleanup.mockReturnValue(true);
      mockDaemonManager.stopDaemon.mockRejectedValue(new Error('Stop failed'));
      
      await expect(processManager.stop()).rejects.toThrow(ProcessError);
    });

    test('should log no process running', async () => {
      mockPidManager.validateAndCleanup.mockReturnValue(false);
      
      await processManager.stop();
      
      expect(mockLogger.debug).toHaveBeenCalledWith('No process running, nothing to stop');
    });

    test('should measure shutdown time', async () => {
      mockPidManager.validateAndCleanup.mockReturnValue(true);
      
      await processManager.stop();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Process stopped successfully',
        expect.objectContaining({
          shutdownTime: expect.any(Number)
        })
      );
    });
  });

  describe('status', () => {
    test('should return status for running process', async () => {
      mockDaemonManager.getDaemonStatus.mockResolvedValue({ running: true, pid: 12345 });
      mockExec.mockImplementation((_command: any, _options: any, callback: any) => {
        callback(null, { stdout: 'healthy' }, '');
      });
      
      const status = await processManager.status();
      
      expect(status).toEqual({
        running: true,
        pid: 12345,
        health: 'healthy',
      });
    });

    test('should return status for stopped process', async () => {
      mockDaemonManager.getDaemonStatus.mockResolvedValue({ running: false, pid: null });
      
      const status = await processManager.status();
      
      expect(status).toEqual({
        running: false,
        pid: null,
      });
    });

    test('should return unhealthy status', async () => {
      mockDaemonManager.getDaemonStatus.mockResolvedValue({ running: true, pid: 12345 });
      mockExec.mockImplementation((_command: any, _options: any, callback: any) => {
        callback(null, { stdout: 'unhealthy' }, '');
      });
      
      const status = await processManager.status();
      
      expect(status.health).toBe('unhealthy');
    });

    test('should return unknown health on error', async () => {
      mockDaemonManager.getDaemonStatus.mockResolvedValue({ running: true, pid: 12345 });
      mockExec.mockImplementation((_command: any, _options: any, callback: any) => {
        callback(new Error('Health check failed'), null, '');
      });
      
      const status = await processManager.status();
      
      expect(status.health).toBe('unknown');
    });

    test('should throw ProcessError when status check fails', async () => {
      mockDaemonManager.getDaemonStatus.mockRejectedValue(new Error('Status failed'));
      
      await expect(processManager.status()).rejects.toThrow(ProcessError);
    });

    test('should not perform health check for stopped process', async () => {
      mockDaemonManager.getDaemonStatus.mockResolvedValue({ running: false, pid: null });
      
      await processManager.status();
      
      expect(mockExec).not.toHaveBeenCalled();
    });

    test('should handle health check timeout', async () => {
      mockDaemonManager.getDaemonStatus.mockResolvedValue({ running: true, pid: 12345 });
      mockExec.mockImplementation((_command: any, _options: any, callback: any) => {
        setTimeout(() => callback(new Error('Timeout'), null, ''), 100);
      });
      
      const status = await processManager.status();
      
      expect(status.health).toBe('unknown');
    });
  });

  describe('restart', () => {
    test('should restart process with options', async () => {
      mockPidManager.validateAndCleanup.mockReturnValue(true);
      
      const options: ProcessManagerOptions = { port: '3000' };
      const pid = await processManager.restart(options);
      
      expect(pid).toBe(12345);
      expect(mockDaemonManager.stopDaemon).toHaveBeenCalled();
      expect(mockDaemonManager.startDaemon).toHaveBeenCalled();
    });

    test('should restart process with default options', async () => {
      mockPidManager.validateAndCleanup.mockReturnValue(true);
      
      const pid = await processManager.restart();
      
      expect(pid).toBe(12345);
      expect(mockDaemonManager.startDaemon).toHaveBeenCalledWith({
        port: '8000',
        apiKey: undefined,
        verbose: false,
        debug: false,
      });
    });

    test('should wait between stop and start', async () => {
      mockPidManager.validateAndCleanup.mockReturnValue(true);
      
      const startTime = Date.now();
      await processManager.restart();
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    test('should log restart', async () => {
      mockPidManager.validateAndCleanup.mockReturnValue(true);
      
      await processManager.restart();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Restarting process');
    });

    test('should throw ProcessError when restart fails', async () => {
      mockPidManager.validateAndCleanup.mockReturnValue(true);
      mockDaemonManager.startDaemon.mockRejectedValue(new Error('Restart failed'));
      
      await expect(processManager.restart()).rejects.toThrow(ProcessError);
    });

    test('should handle stop failure during restart', async () => {
      mockPidManager.validateAndCleanup.mockReturnValue(true);
      mockDaemonManager.stopDaemon.mockRejectedValue(new Error('Stop failed'));
      
      await expect(processManager.restart()).rejects.toThrow(ProcessError);
    });

    test('should restart even if nothing was running', async () => {
      mockPidManager.validateAndCleanup.mockReturnValue(false);
      
      const pid = await processManager.restart();
      
      expect(pid).toBe(12345);
      expect(mockDaemonManager.stopDaemon).toHaveBeenCalled();
      expect(mockDaemonManager.startDaemon).toHaveBeenCalled();
    });
  });

  describe('isRunning', () => {
    test('should return true when process is running', () => {
      mockPidManager.validateAndCleanup.mockReturnValue(true);
      
      const result = processManager.isRunning();
      
      expect(result).toBe(true);
    });

    test('should return false when process is not running', () => {
      mockPidManager.validateAndCleanup.mockReturnValue(false);
      
      const result = processManager.isRunning();
      
      expect(result).toBe(false);
    });

    test('should delegate to pidManager', () => {
      processManager.isRunning();
      
      expect(mockPidManager.validateAndCleanup).toHaveBeenCalled();
    });
  });

  describe('checkHealth', () => {
    test('should return healthy status', async () => {
      mockExec.mockImplementation((_command: any, _options: any, callback: any) => {
        callback(null, { stdout: 'healthy' }, '');
      });
      
      const health = await (processManager as any).checkHealth();
      
      expect(health).toBe('healthy');
    });

    test('should return unhealthy status', async () => {
      mockExec.mockImplementation((_command: any, _options: any, callback: any) => {
        callback(null, { stdout: 'not healthy' }, '');
      });
      
      const health = await (processManager as any).checkHealth();
      
      expect(health).toBe('unhealthy');
    });

    test('should return unknown on error', async () => {
      mockExec.mockImplementation((_command: any, _options: any, callback: any) => {
        callback(new Error('Health check failed'), null, '');
      });
      
      const health = await (processManager as any).checkHealth();
      
      expect(health).toBe('unknown');
    });

    test('should use correct health check URL', async () => {
      mockExec.mockImplementation((_command: any, _options: any, callback: any) => {
        callback(null, { stdout: 'healthy' }, '');
      });
      
      await (processManager as any).checkHealth();
      
      expect(mockExec).toHaveBeenCalledWith(
        'curl -s --connect-timeout 1 http://localhost:8000/health',
        { timeout: 1000 },
        expect.any(Function)
      );
    });

    test('should handle health check timeout', async () => {
      mockExec.mockImplementation((_command: any, _options: any, callback: any) => {
        setTimeout(() => callback(new Error('Timeout'), null, ''), 100);
      });
      
      const health = await (processManager as any).checkHealth();
      
      expect(health).toBe('unknown');
    });
  });

  describe('ProcessError', () => {
    test('should create error with all properties', () => {
      const error = new ProcessError('Test error', 'test-operation', 'TEST_CODE');
      
      expect(error.name).toBe('ProcessError');
      expect(error.message).toBe('Test error');
      expect(error.operation).toBe('test-operation');
      expect(error.code).toBe('TEST_CODE');
    });

    test('should create error with minimal properties', () => {
      const error = new ProcessError('Test error', 'test-operation');
      
      expect(error.name).toBe('ProcessError');
      expect(error.message).toBe('Test error');
      expect(error.operation).toBe('test-operation');
      expect(error.code).toBeUndefined();
    });

    test('should extend Error class', () => {
      const error = new ProcessError('Test error', 'test-operation');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ProcessError);
    });
  });

  describe('Error Handling', () => {
    test('should handle daemon manager errors', async () => {
      mockDaemonManager.startDaemon.mockRejectedValue(new Error('Daemon error'));
      
      await expect(processManager.start({})).rejects.toThrow(ProcessError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to start process',
        { error: 'Daemon error' }
      );
    });

    test('should handle unexpected errors', async () => {
      mockDaemonManager.startDaemon.mockRejectedValue('String error');
      
      await expect(processManager.start({})).rejects.toThrow(ProcessError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to start process',
        { error: 'String error' }
      );
    });

    test('should handle health check errors gracefully', async () => {
      mockDaemonManager.getDaemonStatus.mockResolvedValue({ running: true, pid: 12345 });
      mockExec.mockImplementation((_command: any, _options: any, _callback: any) => {
        throw new Error('Health check error');
      });
      
      const status = await processManager.status();
      
      expect(status.health).toBe('unknown');
    });
  });

  describe('Integration', () => {
    test('should complete full process lifecycle', async () => {
      // Start process
      const startOptions: ProcessManagerOptions = { port: '3000' };
      const pid = await processManager.start(startOptions);
      expect(pid).toBe(12345);
      
      // Check if running
      mockPidManager.validateAndCleanup.mockReturnValue(true);
      expect(processManager.isRunning()).toBe(true);
      
      // Get status
      const status = await processManager.status();
      expect(status.running).toBe(true);
      
      // Stop process
      const stopped = await processManager.stop();
      expect(stopped).toBe(true);
      
      // Check if stopped
      mockPidManager.validateAndCleanup.mockReturnValue(false);
      expect(processManager.isRunning()).toBe(false);
    });

    test('should handle restart cycle', async () => {
      // Start process
      mockPidManager.validateAndCleanup.mockReturnValue(false);
      await processManager.start({});
      
      // Restart process
      mockPidManager.validateAndCleanup.mockReturnValue(true);
      const pid = await processManager.restart({ port: '4000' });
      
      expect(pid).toBe(12345);
      expect(mockDaemonManager.stopDaemon).toHaveBeenCalled();
      expect(mockDaemonManager.startDaemon).toHaveBeenCalledWith({
        port: '4000',
        apiKey: undefined,
        verbose: undefined,
        debug: undefined,
      });
    });

    test('should handle performance monitoring', async () => {
      // Slow start
      mockDaemonManager.startDaemon.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 250));
        return 12345;
      });
      
      await processManager.start({});
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Process start exceeded performance target',
        expect.any(Object)
      );
    });
  });
});