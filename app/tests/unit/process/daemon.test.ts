/**
 * Daemon Manager Unit Tests - Phase 6A
 * Tests daemon process creation and management functionality
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ChildProcess } from 'child_process';
import { 
  mockChildProcess, 
  mockLogger, 
  mockProcess, 
  mockFs, 
  mockPath, 
  mockOs,
  resetProcessMocks,
  setupSuccessfulPidOperations,
} from '../../mocks/process-mocks';

// Mock modules
jest.mock('child_process', () => ({
  spawn: mockChildProcess.spawn,
  exec: mockChildProcess.exec,
}));

jest.mock('fs', () => ({
  existsSync: mockFs.existsSync,
  readFileSync: mockFs.readFileSync,
  writeFileSync: mockFs.writeFileSync,
  unlinkSync: mockFs.unlinkSync,
}));

jest.mock('path', () => ({
  join: mockPath.join,
}));

jest.mock('os', () => ({
  tmpdir: mockOs.tmpdir,
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: mockLogger,
}));

// Mock the pid manager
jest.mock('../../../src/process/pid', () => ({
  pidManager: {
    savePid: jest.fn(),
    readPid: jest.fn(),
    isProcessRunning: jest.fn(),
    cleanupPidFile: jest.fn(),
    validateAndCleanup: jest.fn(),
  },
}));

// Import modules under test
import { DaemonManager, DaemonError, DaemonOptions } from '../../../src/process/daemon';
import { pidManager } from '../../../src/process/pid';

const mockPidManager = pidManager as jest.Mocked<typeof pidManager>;

describe('DaemonManager', () => {
  let daemonManager: DaemonManager;
  let mockChild: Partial<ChildProcess>;

  beforeEach(() => {
    // Reset all mocks
    resetProcessMocks();
    setupSuccessfulPidOperations();
    jest.clearAllMocks();
    
    // Setup mock child process
    mockChild = {
      pid: 12345,
      unref: jest.fn(),
      kill: jest.fn() as any,
    };
    
    mockChildProcess.spawn.mockReturnValue(mockChild as ChildProcess);
    mockPidManager.readPid.mockReturnValue(12345);
    mockPidManager.isProcessRunning.mockReturnValue(true);
    mockPidManager.validateAndCleanup.mockReturnValue(false);
    
    // Create fresh instance
    daemonManager = new DaemonManager();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    test('should create DaemonManager instance', () => {
      expect(daemonManager).toBeInstanceOf(DaemonManager);
    });

    test('should log initialization', () => {
      new DaemonManager();
      expect(mockLogger.debug).toHaveBeenCalledWith('DaemonManager initialized');
    });
  });

  describe('startDaemon', () => {
    test('should start daemon with default options', async () => {
      const options: DaemonOptions = {};
      
      const pid = await daemonManager.startDaemon(options);
      
      expect(pid).toBe(12345);
      expect(mockChildProcess.spawn).toHaveBeenCalledWith(
        process.execPath,
        [expect.stringContaining('server-daemon.js')],
        { detached: true, stdio: 'ignore' }
      );
    });

    test('should start daemon with port option', async () => {
      const options: DaemonOptions = { port: '3000' };
      
      await daemonManager.startDaemon(options);
      
      expect(mockChildProcess.spawn).toHaveBeenCalledWith(
        process.execPath,
        [expect.stringContaining('server-daemon.js'), '--port', '3000'],
        { detached: true, stdio: 'ignore' }
      );
    });

    test('should start daemon with api key option', async () => {
      const options: DaemonOptions = { apiKey: 'test-key' };
      
      await daemonManager.startDaemon(options);
      
      expect(mockChildProcess.spawn).toHaveBeenCalledWith(
        process.execPath,
        [expect.stringContaining('server-daemon.js'), '--api-key', 'test-key'],
        { detached: true, stdio: 'ignore' }
      );
    });

    test('should start daemon with verbose option', async () => {
      const options: DaemonOptions = { verbose: true };
      
      await daemonManager.startDaemon(options);
      
      expect(mockChildProcess.spawn).toHaveBeenCalledWith(
        process.execPath,
        [expect.stringContaining('server-daemon.js'), '--verbose'],
        { detached: true, stdio: 'ignore' }
      );
    });

    test('should start daemon with debug option', async () => {
      const options: DaemonOptions = { debug: true };
      
      await daemonManager.startDaemon(options);
      
      expect(mockChildProcess.spawn).toHaveBeenCalledWith(
        process.execPath,
        [expect.stringContaining('server-daemon.js'), '--debug'],
        { detached: true, stdio: 'ignore' }
      );
    });

    test('should start daemon with all options', async () => {
      const options: DaemonOptions = {
        port: '3000',
        apiKey: 'test-key',
        verbose: true,
        debug: true,
      };
      
      await daemonManager.startDaemon(options);
      
      expect(mockChildProcess.spawn).toHaveBeenCalledWith(
        process.execPath,
        [
          expect.stringContaining('server-daemon.js'),
          '--port', '3000',
          '--api-key', 'test-key',
          '--verbose',
          '--debug'
        ],
        { detached: true, stdio: 'ignore' }
      );
    });

    test('should use custom script path', async () => {
      const options: DaemonOptions = { scriptPath: '/custom/path/script.js' };
      
      await daemonManager.startDaemon(options);
      
      expect(mockChildProcess.spawn).toHaveBeenCalledWith(
        process.execPath,
        ['/custom/path/script.js'],
        { detached: true, stdio: 'ignore' }
      );
    });

    test('should save PID after successful start', async () => {
      const options: DaemonOptions = {};
      
      await daemonManager.startDaemon(options);
      
      expect(mockPidManager.savePid).toHaveBeenCalledWith(12345);
    });

    test('should unref child process', async () => {
      const options: DaemonOptions = {};
      
      await daemonManager.startDaemon(options);
      
      expect(mockChild.unref).toHaveBeenCalled();
    });

    test('should log successful daemon start', async () => {
      const options: DaemonOptions = {};
      
      await daemonManager.startDaemon(options);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Daemon process started successfully',
        { pid: 12345 }
      );
    });

    test('should throw DaemonError when already running', async () => {
      mockPidManager.validateAndCleanup.mockReturnValue(true);
      mockPidManager.readPid.mockReturnValue(12345);
      
      const options: DaemonOptions = {};
      
      await expect(daemonManager.startDaemon(options)).rejects.toThrow(DaemonError);
      await expect(daemonManager.startDaemon(options)).rejects.toThrow('already running');
    });

    test('should throw DaemonError when spawn fails', async () => {
      (mockChild as any).pid = undefined;
      
      const options: DaemonOptions = {};
      
      await expect(daemonManager.startDaemon(options)).rejects.toThrow(DaemonError);
      await expect(daemonManager.startDaemon(options)).rejects.toThrow('Failed to spawn daemon process');
    });

    test('should throw DaemonError when spawn throws', async () => {
      mockChildProcess.spawn.mockImplementation(() => {
        throw new Error('Spawn failed');
      });
      
      const options: DaemonOptions = {};
      
      await expect(daemonManager.startDaemon(options)).rejects.toThrow(DaemonError);
    });

    test('should handle PID save failure gracefully', async () => {
      mockPidManager.savePid.mockImplementation(() => {
        throw new Error('PID save failed');
      });
      
      const options: DaemonOptions = {};
      
      // Should still complete successfully
      const pid = await daemonManager.startDaemon(options);
      expect(pid).toBe(12345);
    });

    test('should log debug information', async () => {
      const options: DaemonOptions = { port: '3000' };
      
      await daemonManager.startDaemon(options);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Starting daemon process',
        expect.objectContaining({
          scriptPath: expect.any(String),
          args: expect.arrayContaining(['--port', '3000'])
        })
      );
    });
  });

  describe('isDaemonRunning', () => {
    test('should return true when daemon is running', () => {
      mockPidManager.validateAndCleanup.mockReturnValue(true);
      
      const result = daemonManager.isDaemonRunning();
      
      expect(result).toBe(true);
    });

    test('should return false when daemon is not running', () => {
      mockPidManager.validateAndCleanup.mockReturnValue(false);
      
      const result = daemonManager.isDaemonRunning();
      
      expect(result).toBe(false);
    });

    test('should delegate to pidManager', () => {
      daemonManager.isDaemonRunning();
      
      expect(mockPidManager.validateAndCleanup).toHaveBeenCalled();
    });
  });

  describe('stopDaemon', () => {
    test('should stop running daemon', async () => {
      mockPidManager.readPid.mockReturnValue(12345);
      mockPidManager.isProcessRunning.mockReturnValue(true);
      
      const result = await daemonManager.stopDaemon();
      
      expect(result).toBe(true);
      expect(mockProcess.kill).toHaveBeenCalledWith(12345, 'SIGTERM');
    });

    test('should return false when no PID found', async () => {
      mockPidManager.readPid.mockReturnValue(null);
      
      const result = await daemonManager.stopDaemon();
      
      expect(result).toBe(false);
      expect(mockProcess.kill).not.toHaveBeenCalled();
    });

    test('should return false when process not running', async () => {
      mockPidManager.readPid.mockReturnValue(12345);
      mockPidManager.isProcessRunning.mockReturnValue(false);
      
      const result = await daemonManager.stopDaemon();
      
      expect(result).toBe(false);
      expect(mockPidManager.cleanupPidFile).toHaveBeenCalled();
    });

    test('should wait for process to exit', async () => {
      mockPidManager.readPid.mockReturnValue(12345);
      mockPidManager.isProcessRunning
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      
      const result = await daemonManager.stopDaemon();
      
      expect(result).toBe(true);
    });

    test('should cleanup PID file after successful stop', async () => {
      mockPidManager.readPid.mockReturnValue(12345);
      mockPidManager.isProcessRunning.mockReturnValue(true);
      
      await daemonManager.stopDaemon();
      
      expect(mockPidManager.cleanupPidFile).toHaveBeenCalled();
    });

    test('should log successful stop', async () => {
      mockPidManager.readPid.mockReturnValue(12345);
      mockPidManager.isProcessRunning.mockReturnValue(true);
      
      await daemonManager.stopDaemon();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Daemon process stopped successfully',
        { pid: 12345 }
      );
    });

    test('should throw DaemonError when kill fails', async () => {
      mockPidManager.readPid.mockReturnValue(12345);
      mockPidManager.isProcessRunning.mockReturnValue(true);
      mockProcess.kill.mockImplementation(() => {
        throw new Error('Kill failed');
      });
      
      await expect(daemonManager.stopDaemon()).rejects.toThrow(DaemonError);
    });

    test('should handle process exit timeout', async () => {
      mockPidManager.readPid.mockReturnValue(12345);
      mockPidManager.isProcessRunning.mockReturnValue(true);
      
      // Mock process that never exits
      mockPidManager.isProcessRunning.mockReturnValue(true);
      
      await expect(daemonManager.stopDaemon()).rejects.toThrow(DaemonError);
    });

    test('should log debug information', async () => {
      mockPidManager.readPid.mockReturnValue(12345);
      mockPidManager.isProcessRunning.mockReturnValue(true);
      
      await daemonManager.stopDaemon();
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Sending SIGTERM to daemon process',
        { pid: 12345 }
      );
    });
  });

  describe('getDaemonStatus', () => {
    test('should return status for running daemon', async () => {
      mockPidManager.readPid.mockReturnValue(12345);
      mockPidManager.isProcessRunning.mockReturnValue(true);
      
      const status = await daemonManager.getDaemonStatus();
      
      expect(status).toEqual({
        running: true,
        pid: 12345,
      });
    });

    test('should return status for stopped daemon', async () => {
      mockPidManager.readPid.mockReturnValue(12345);
      mockPidManager.isProcessRunning.mockReturnValue(false);
      
      const status = await daemonManager.getDaemonStatus();
      
      expect(status).toEqual({
        running: false,
        pid: 12345,
      });
    });

    test('should return status when no PID file', async () => {
      mockPidManager.readPid.mockReturnValue(null);
      
      const status = await daemonManager.getDaemonStatus();
      
      expect(status).toEqual({
        running: false,
        pid: null,
      });
    });

    test('should not throw on status check', async () => {
      mockPidManager.readPid.mockImplementation(() => {
        throw new Error('PID read failed');
      });
      
      await expect(daemonManager.getDaemonStatus()).resolves.not.toThrow();
    });
  });

  describe('buildDaemonArgs', () => {
    test('should build args with port', () => {
      const manager = new DaemonManager();
      const options: DaemonOptions = { port: '3000' };
      
      // Access private method for testing
      const buildArgs = (manager as any).buildDaemonArgs;
      const args = buildArgs.call(manager, options);
      
      expect(args).toEqual(['--port', '3000']);
    });

    test('should build args with all options', () => {
      const manager = new DaemonManager();
      const options: DaemonOptions = {
        port: '3000',
        apiKey: 'test-key',
        verbose: true,
        debug: true,
      };
      
      const buildArgs = (manager as any).buildDaemonArgs;
      const args = buildArgs.call(manager, options);
      
      expect(args).toEqual([
        '--port', '3000',
        '--api-key', 'test-key',
        '--verbose',
        '--debug'
      ]);
    });

    test('should build empty args for empty options', () => {
      const manager = new DaemonManager();
      const options: DaemonOptions = {};
      
      const buildArgs = (manager as any).buildDaemonArgs;
      const args = buildArgs.call(manager, options);
      
      expect(args).toEqual([]);
    });

    test('should skip falsy options', () => {
      const manager = new DaemonManager();
      const options: DaemonOptions = {
        port: '',
        apiKey: '',
        verbose: false,
        debug: false,
      };
      
      const buildArgs = (manager as any).buildDaemonArgs;
      const args = buildArgs.call(manager, options);
      
      expect(args).toEqual([]);
    });
  });

  describe('getDefaultScriptPath', () => {
    test('should return default script path', () => {
      const manager = new DaemonManager();
      
      const getDefaultScriptPath = (manager as any).getDefaultScriptPath;
      const pathResult = getDefaultScriptPath.call(manager);
      
      expect(pathResult).toContain('server-daemon.js');
    });

    test('should use __dirname in path', () => {
      const manager = new DaemonManager();
      
      const getDefaultScriptPath = (manager as any).getDefaultScriptPath;
      getDefaultScriptPath.call(manager);
      
      expect(mockPath.join).toHaveBeenCalledWith(__dirname, '../server-daemon.js');
    });
  });

  describe('DaemonError', () => {
    test('should create error with all properties', () => {
      const error = new DaemonError('Test error', 'test-operation', 12345);
      
      expect(error.name).toBe('DaemonError');
      expect(error.message).toBe('Test error');
      expect(error.operation).toBe('test-operation');
      expect(error.pid).toBe(12345);
    });

    test('should create error with minimal properties', () => {
      const error = new DaemonError('Test error', 'test-operation');
      
      expect(error.name).toBe('DaemonError');
      expect(error.message).toBe('Test error');
      expect(error.operation).toBe('test-operation');
      expect(error.pid).toBeUndefined();
    });

    test('should extend Error class', () => {
      const error = new DaemonError('Test error', 'test-operation');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DaemonError);
    });
  });

  describe('Error Handling', () => {
    test('should handle spawn errors gracefully', async () => {
      mockChildProcess.spawn.mockImplementation(() => {
        throw new Error('Spawn error');
      });
      
      const options: DaemonOptions = {};
      
      await expect(daemonManager.startDaemon(options)).rejects.toThrow(DaemonError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to start daemon process',
        { error: 'Spawn error' }
      );
    });

    test('should handle process kill errors', async () => {
      mockPidManager.readPid.mockReturnValue(12345);
      mockPidManager.isProcessRunning.mockReturnValue(true);
      mockProcess.kill.mockImplementation(() => {
        throw new Error('Kill error');
      });
      
      await expect(daemonManager.stopDaemon()).rejects.toThrow(DaemonError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to stop daemon process',
        { pid: 12345, error: 'Kill error' }
      );
    });

    test('should handle PID file errors during stop', async () => {
      mockPidManager.readPid.mockReturnValue(12345);
      mockPidManager.isProcessRunning.mockReturnValue(false);
      mockPidManager.cleanupPidFile.mockImplementation(() => {
        throw new Error('Cleanup error');
      });
      
      // Should still complete successfully
      const result = await daemonManager.stopDaemon();
      expect(result).toBe(false);
    });
  });

  describe('Integration', () => {
    test('should complete full lifecycle', async () => {
      // Start daemon
      const options: DaemonOptions = { port: '3000' };
      const pid = await daemonManager.startDaemon(options);
      expect(pid).toBe(12345);
      
      // Check status
      const status = await daemonManager.getDaemonStatus();
      expect(status.running).toBe(true);
      
      // Stop daemon
      const stopped = await daemonManager.stopDaemon();
      expect(stopped).toBe(true);
    });

    test('should handle multiple start attempts', async () => {
      const options: DaemonOptions = {};
      
      // First start should succeed
      await daemonManager.startDaemon(options);
      
      // Second start should fail
      mockPidManager.validateAndCleanup.mockReturnValue(true);
      await expect(daemonManager.startDaemon(options)).rejects.toThrow(DaemonError);
    });

    test('should handle stop without start', async () => {
      mockPidManager.readPid.mockReturnValue(null);
      
      const result = await daemonManager.stopDaemon();
      expect(result).toBe(false);
    });
  });
});