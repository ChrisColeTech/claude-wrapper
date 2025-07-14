/**
 * Unit tests for ProcessDaemon mock flag handling
 * Tests daemon options and command line argument building
 */

import { DaemonManager, DaemonOptions } from '../../../src/process/daemon';
import { spawn } from 'child_process';
import { logger } from '../../../src/utils/logger';

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  }
}));

// Mock pid manager
jest.mock('../../../src/process/pid', () => ({
  pidManager: {
    savePid: jest.fn(),
    readPid: jest.fn(),
    cleanupPidFile: jest.fn(),
    validateAndCleanup: jest.fn(),
    isProcessRunning: jest.fn()
  }
}));

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

describe('DaemonManager Mock Mode Tests', () => {
  let daemonManager: DaemonManager;

  beforeEach(() => {
    daemonManager = new DaemonManager();
    jest.clearAllMocks();
  });

  describe('DaemonOptions Interface', () => {
    test('should have correct mock property type', () => {
      const options: DaemonOptions = {
        mock: true
      };
      
      expect(typeof options.mock).toBe('boolean');
    });

    test('should allow mock with all other properties', () => {
      const options: DaemonOptions = {
        port: '8000',
        apiKey: 'test-key',
        verbose: true,
        debug: false,
        scriptPath: '/path/to/script',
        mock: true
      };
      
      expect(options.mock).toBe(true);
      expect(Object.keys(options)).toContain('mock');
    });
  });

  describe('Command Line Argument Building', () => {
    test('should build args with mock flag', () => {
      const options: DaemonOptions = {
        port: '8000',
        mock: true
      };

      // Mock process already running check
      const mockPidManager = require('../../../src/process/pid').pidManager;
      mockPidManager.validateAndCleanup.mockReturnValue(false);

      // Mock spawn to capture arguments
      const mockChildProcess = {
        pid: 12345,
        unref: jest.fn(),
        on: jest.fn()
      };
      mockSpawn.mockReturnValue(mockChildProcess as any);

      daemonManager.startDaemon(options);

      // Verify spawn was called with correct arguments
      expect(mockSpawn).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining([
          '--port', '8000',
          '--mock'
        ]),
        expect.any(Object)
      );
    });

    test('should build args with mock flag and other options', () => {
      const options: DaemonOptions = {
        port: '9000',
        apiKey: 'test-key',
        verbose: true,
        debug: false,
        mock: true
      };

      const mockPidManager = require('../../../src/process/pid').pidManager;
      mockPidManager.validateAndCleanup.mockReturnValue(false);

      const mockChildProcess = {
        pid: 12345,
        unref: jest.fn(),
        on: jest.fn()
      };
      mockSpawn.mockReturnValue(mockChildProcess as any);

      daemonManager.startDaemon(options);

      expect(mockSpawn).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining([
          '--port', '9000',
          '--api-key', 'test-key',
          '--verbose',
          '--mock'
        ]),
        expect.any(Object)
      );
    });

    test('should not include mock flag when not specified', () => {
      const options: DaemonOptions = {
        port: '8000',
        debug: true
      };

      const mockPidManager = require('../../../src/process/pid').pidManager;
      mockPidManager.validateAndCleanup.mockReturnValue(false);

      const mockChildProcess = {
        pid: 12345,
        unref: jest.fn(),
        on: jest.fn()
      };
      mockSpawn.mockReturnValue(mockChildProcess as any);

      daemonManager.startDaemon(options);

      const spawnCall = mockSpawn.mock.calls[0];
      const args = spawnCall?.[1];

      expect(args).toContain('--port');
      expect(args).toContain('8000');
      expect(args).toContain('--debug');
      expect(args).not.toContain('--mock');
    });

    test('should include mock flag when explicitly set to false', () => {
      const options: DaemonOptions = {
        port: '8000',
        mock: false
      };

      const mockPidManager = require('../../../src/process/pid').pidManager;
      mockPidManager.validateAndCleanup.mockReturnValue(false);

      const mockChildProcess = {
        pid: 12345,
        unref: jest.fn(),
        on: jest.fn()
      };
      mockSpawn.mockReturnValue(mockChildProcess as any);

      daemonManager.startDaemon(options);

      const spawnCall = mockSpawn.mock.calls[0];
      const args = spawnCall?.[1];

      expect(args).toContain('--port');
      expect(args).toContain('8000');
      expect(args).not.toContain('--mock'); // false values are not included
    });
  });

  describe('Daemon Process Creation', () => {
    test('should create daemon process with mock flag', async () => {
      const options: DaemonOptions = {
        port: '8000',
        mock: true
      };

      const mockPidManager = require('../../../src/process/pid').pidManager;
      mockPidManager.validateAndCleanup.mockReturnValue(false);

      const mockChildProcess = {
        pid: 12345,
        unref: jest.fn(),
        on: jest.fn()
      };
      mockSpawn.mockReturnValue(mockChildProcess as any);

      const pid = await daemonManager.startDaemon(options);

      expect(pid).toBe(12345);
      expect(mockSpawn).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining(['--mock']),
        expect.objectContaining({
          detached: true,
          stdio: 'ignore'
        })
      );
    });

    test('should handle environment variables inheritance', async () => {
      const options: DaemonOptions = {
        port: '8000',
        mock: true
      };

      const mockPidManager = require('../../../src/process/pid').pidManager;
      mockPidManager.validateAndCleanup.mockReturnValue(false);

      const mockChildProcess = {
        pid: 12345,
        unref: jest.fn(),
        on: jest.fn()
      };
      mockSpawn.mockReturnValue(mockChildProcess as any);

      await daemonManager.startDaemon(options);

      expect(mockSpawn).toHaveBeenCalledWith(
        process.execPath,
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining(process.env)
        })
      );
    });

    test('should handle custom script path with mock flag', async () => {
      const options: DaemonOptions = {
        port: '8000',
        scriptPath: '/custom/path/to/script.js',
        mock: true
      };

      const mockPidManager = require('../../../src/process/pid').pidManager;
      mockPidManager.validateAndCleanup.mockReturnValue(false);

      const mockChildProcess = {
        pid: 12345,
        unref: jest.fn(),
        on: jest.fn()
      };
      mockSpawn.mockReturnValue(mockChildProcess as any);

      await daemonManager.startDaemon(options);

      expect(mockSpawn).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining([
          '/custom/path/to/script.js',
          '--port', '8000',
          '--mock'
        ]),
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle daemon start failure with mock flag', async () => {
      const options: DaemonOptions = {
        port: '8000',
        mock: true
      };

      const mockPidManager = require('../../../src/process/pid').pidManager;
      mockPidManager.validateAndCleanup.mockReturnValue(false);

      // Mock spawn to return process without PID
      const mockChildProcess = {
        pid: undefined,
        unref: jest.fn(),
        on: jest.fn()
      };
      mockSpawn.mockReturnValue(mockChildProcess as any);

      await expect(daemonManager.startDaemon(options)).rejects.toThrow('Failed to spawn daemon process');
    });

    test('should handle already running daemon with mock flag', async () => {
      const options: DaemonOptions = {
        port: '8000',
        mock: true
      };

      const mockPidManager = require('../../../src/process/pid').pidManager;
      mockPidManager.validateAndCleanup.mockReturnValue(true);
      mockPidManager.readPid.mockReturnValue(12345);

      await expect(daemonManager.startDaemon(options)).rejects.toThrow('Daemon already running');
    });
  });

  describe('Logging', () => {
    test('should log daemon start with mock flag', async () => {
      const options: DaemonOptions = {
        port: '8000',
        mock: true
      };

      const mockPidManager = require('../../../src/process/pid').pidManager;
      mockPidManager.validateAndCleanup.mockReturnValue(false);

      const mockChildProcess = {
        pid: 12345,
        unref: jest.fn(),
        on: jest.fn()
      };
      mockSpawn.mockReturnValue(mockChildProcess as any);

      await daemonManager.startDaemon(options);

      expect(logger.debug).toHaveBeenCalledWith(
        'Starting daemon process',
        expect.objectContaining({
          args: expect.arrayContaining(['--mock'])
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        'Daemon process started successfully',
        expect.objectContaining({
          pid: 12345
        })
      );
    });
  });

  describe('Non-Mock Operations', () => {
    test('should handle stop daemon without mock flag interference', async () => {
      const mockPidManager = require('../../../src/process/pid').pidManager;
      mockPidManager.readPid.mockReturnValue(12345);
      mockPidManager.isProcessRunning.mockReturnValue(true);

      // Mock process.kill
      const originalKill = process.kill;
      process.kill = jest.fn();

      // Mock wait for process exit
      mockPidManager.isProcessRunning
        .mockReturnValueOnce(true)  // Initial check
        .mockReturnValueOnce(false); // After kill

      const result = await daemonManager.stopDaemon();

      expect(result).toBe(true);
      expect(process.kill).toHaveBeenCalledWith(12345, 'SIGTERM');

      // Restore original kill
      process.kill = originalKill;
    });

    test('should handle daemon status without mock flag interference', async () => {
      const mockPidManager = require('../../../src/process/pid').pidManager;
      mockPidManager.readPid.mockReturnValue(12345);
      mockPidManager.validateAndCleanup.mockReturnValue(true);

      const status = await daemonManager.getDaemonStatus();

      expect(status.running).toBe(true);
      expect(status.pid).toBe(12345);
    });
  });
});