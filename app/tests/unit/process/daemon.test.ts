/**
 * Daemon Manager Tests
 * Comprehensive test suite for daemon management functionality
 * Uses externalized mocks following clean architecture principles
 */

import { DaemonManager, DaemonError, DaemonOptions } from '../../../src/process/daemon';
import { DaemonChildProcessMock } from '../../mocks/process/daemon-child-process-mock';
import { DaemonFilesystemMock } from '../../mocks/process/daemon-filesystem-mock';
import { DaemonOSMock } from '../../mocks/process/daemon-os-mock';

// Only mock external dependencies
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../../src/process/pid', () => ({
  pidManager: {
    validateAndCleanup: jest.fn().mockReturnValue(false),
    readPid: jest.fn().mockReturnValue(null),
    isProcessRunning: jest.fn().mockReturnValue(true),
    savePid: jest.fn(),
    cleanupPidFile: jest.fn()
  }
}));

describe('DaemonManager', () => {
  let daemonManager: DaemonManager;
  let originalSpawn: any;
  let originalExecPath: string;
  let originalJoin: any;
  let originalKill: any;

  beforeEach(() => {
    // Store original values
    originalSpawn = require('child_process').spawn;
    originalExecPath = process.execPath;
    originalJoin = require('path').join;
    originalKill = process.kill;

    // Reset all externalized mocks
    DaemonChildProcessMock.reset();
    DaemonFilesystemMock.reset();
    DaemonOSMock.reset();

    // Setup externalized mocks
    DaemonChildProcessMock.setup({ spawnPid: 12345 });
    DaemonFilesystemMock.setup({ defaultScriptPath: '/mock/server-daemon.js' });
    DaemonOSMock.setup({ execPath: '/usr/bin/node' });

    // Apply mocks to global modules
    const childProcessMock = DaemonChildProcessMock.setup({ spawnPid: 12345 });
    const filesystemMock = DaemonFilesystemMock.setup({ defaultScriptPath: '/mock/server-daemon.js' });
    const osMock = DaemonOSMock.setup({ execPath: '/usr/bin/node' });

    // Replace global functions with mocks
    require('child_process').spawn = childProcessMock.spawn;
    require('path').join = filesystemMock.join;
    
    // Apply OS mock to global process
    Object.defineProperty(process, 'execPath', {
      value: osMock.execPath,
      writable: true,
      configurable: true
    });
    Object.defineProperty(process, 'kill', {
      value: osMock.kill,
      writable: true,
      configurable: true
    });

    jest.clearAllMocks();
    daemonManager = new DaemonManager();
  });

  afterEach(() => {
    // Restore original values
    require('child_process').spawn = originalSpawn;
    require('path').join = originalJoin;
    Object.defineProperty(process, 'execPath', {
      value: originalExecPath,
      writable: true,
      configurable: true
    });
    Object.defineProperty(process, 'kill', {
      value: originalKill,
      writable: true,
      configurable: true
    });

    // Clean up all externalized mocks
    DaemonChildProcessMock.reset();
    DaemonFilesystemMock.reset();
    DaemonOSMock.reset();
    jest.clearAllMocks();
  });

  describe('startDaemon', () => {
    const defaultOptions: DaemonOptions = {
      port: '8000',
      verbose: true
    };

    it('should start daemon process successfully', async () => {
      const { logger } = require('../../../src/utils/logger');
      const { pidManager } = require('../../../src/process/pid');

      const pid = await daemonManager.startDaemon(defaultOptions);

      expect(pid).toBe(12345);
      expect(DaemonChildProcessMock.getSpawnCalls().length).toBeGreaterThan(0);
      expect(pidManager.savePid).toHaveBeenCalledWith(12345);
      expect(logger.info).toHaveBeenCalledWith(
        'Daemon process started successfully',
        { pid: 12345 }
      );
    });

    it('should build command arguments correctly', async () => {
      const options: DaemonOptions = {
        port: '9999',
        apiKey: 'test-key',
        verbose: true,
        debug: true
      };

      await daemonManager.startDaemon(options);

      const calls = DaemonChildProcessMock.getSpawnCalls();
      expect(calls.length).toBeGreaterThan(0);

      const [command, args, options_param] = calls[0];
      expect(command).toBe('/usr/bin/node');
      expect(args[0]).toBe('/mock/server-daemon.js');
      expect(args.slice(1)).toEqual(['--port', '9999', '--api-key', 'test-key', '--verbose', '--debug']);
      expect(options_param).toEqual({ detached: true, stdio: 'ignore' });
    });

    it('should throw error if daemon already running', async () => {
      const { pidManager } = require('../../../src/process/pid');
      
      pidManager.validateAndCleanup.mockReturnValue(true);
      pidManager.readPid.mockReturnValue(67890);

      await expect(daemonManager.startDaemon(defaultOptions)).rejects.toThrow(DaemonError);
      await expect(daemonManager.startDaemon(defaultOptions)).rejects.toThrow(
        'Daemon already running with PID 67890'
      );
    });

    it('should throw error if spawn fails', async () => {
      DaemonChildProcessMock.setSpawnFailure(true, 'Mock spawn failure');

      await expect(daemonManager.startDaemon(defaultOptions)).rejects.toThrow(DaemonError);
      await expect(daemonManager.startDaemon(defaultOptions)).rejects.toThrow(
        'Failed to start daemon'
      );
    });

    it('should throw error if spawned process has no PID', async () => {
      DaemonChildProcessMock.setSpawnPid(undefined);

      await expect(daemonManager.startDaemon(defaultOptions)).rejects.toThrow(DaemonError);
      await expect(daemonManager.startDaemon(defaultOptions)).rejects.toThrow(
        'Failed to spawn daemon process'
      );
    });
  });

  describe('isDaemonRunning', () => {
    it('should return true when daemon is running', () => {
      const { pidManager } = require('../../../src/process/pid');
      
      pidManager.validateAndCleanup.mockReturnValue(true);

      const result = daemonManager.isDaemonRunning();

      expect(result).toBe(true);
      expect(pidManager.validateAndCleanup).toHaveBeenCalled();
    });

    it('should return false when daemon is not running', () => {
      const { pidManager } = require('../../../src/process/pid');
      
      pidManager.validateAndCleanup.mockReturnValue(false);

      const result = daemonManager.isDaemonRunning();

      expect(result).toBe(false);
      expect(pidManager.validateAndCleanup).toHaveBeenCalled();
    });
  });

  describe('stopDaemon', () => {
    it('should stop daemon process successfully', async () => {
      const { pidManager } = require('../../../src/process/pid');
      const { logger } = require('../../../src/utils/logger');

      pidManager.readPid.mockReturnValue(12345);
      
      let processRunning = true;
      pidManager.isProcessRunning.mockImplementation(() => processRunning);

      // Set up OS mock for successful kill
      DaemonOSMock.setKillBehavior('success');
      const osMock = DaemonOSMock.setup({ execPath: '/usr/bin/node' });
      Object.defineProperty(process, 'kill', {
        value: osMock.kill,
        writable: true,
        configurable: true
      });
      
      setTimeout(() => {
        processRunning = false;
      }, 10);

      const result = await daemonManager.stopDaemon();

      expect(result).toBe(true);
      expect(DaemonOSMock.wasKillCalledWith(12345, 'SIGTERM')).toBe(true);
      expect(pidManager.cleanupPidFile).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Daemon process stopped successfully',
        { pid: 12345 }
      );
    });

    it('should return false if no PID found', async () => {
      const { pidManager } = require('../../../src/process/pid');
      const { logger } = require('../../../src/utils/logger');

      pidManager.readPid.mockReturnValue(null);

      const result = await daemonManager.stopDaemon();

      expect(result).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith('No daemon PID found');
    });

    it('should throw error if kill fails', async () => {
      const { pidManager } = require('../../../src/process/pid');

      pidManager.readPid.mockReturnValue(12345);
      pidManager.isProcessRunning.mockReturnValue(true);
      
      // Set up OS mock for failed kill
      DaemonOSMock.setKillBehavior('failure', 'Kill operation failed');
      const osMock = DaemonOSMock.setup({ execPath: '/usr/bin/node' });
      Object.defineProperty(process, 'kill', {
        value: osMock.kill,
        writable: true,
        configurable: true
      });

      await expect(daemonManager.stopDaemon()).rejects.toThrow(DaemonError);
      await expect(daemonManager.stopDaemon()).rejects.toThrow(
        'Failed to stop daemon: Kill operation failed'
      );
    });
  });

  describe('getDaemonStatus', () => {
    it('should return running status with PID', async () => {
      const { pidManager } = require('../../../src/process/pid');

      pidManager.readPid.mockReturnValue(12345);
      pidManager.validateAndCleanup.mockReturnValue(true);

      const result = await daemonManager.getDaemonStatus();

      expect(result).toEqual({ running: true, pid: 12345 });
    });

    it('should return not running with null PID when no PID file', async () => {
      const { pidManager } = require('../../../src/process/pid');

      pidManager.readPid.mockReturnValue(null);

      const result = await daemonManager.getDaemonStatus();

      expect(result).toEqual({ running: false, pid: null });
    });

    it('should return safe defaults on error', async () => {
      const { pidManager } = require('../../../src/process/pid');
      const { logger } = require('../../../src/utils/logger');

      pidManager.readPid.mockImplementation(() => {
        throw new Error('PID read failed');
      });

      const result = await daemonManager.getDaemonStatus();

      expect(result).toEqual({ running: false, pid: null });
      expect(logger.debug).toHaveBeenCalledWith(
        'Error reading daemon status',
        { error: 'PID read failed' }
      );
    });
  });

  describe('externalized mock verification', () => {
    it('should use only externalized mocks', () => {
      expect(DaemonChildProcessMock).toBeDefined();
      expect(DaemonFilesystemMock).toBeDefined();
      expect(DaemonOSMock).toBeDefined();
      
      const childConfig = DaemonChildProcessMock.setup();
      expect(childConfig.spawn).toBeDefined();
      
      const fsConfig = DaemonFilesystemMock.setup();
      expect(fsConfig.join).toBeDefined();
      
      const osConfig = DaemonOSMock.setup();
      expect(osConfig.execPath).toBe('/usr/bin/node');
    });

    it('should verify all externalized mock interactions', async () => {
      const { pidManager } = require('../../../src/process/pid');
      const { logger } = require('../../../src/utils/logger');

      await daemonManager.startDaemon({ port: '8000', verbose: true });

      const spawnCalls = DaemonChildProcessMock.getSpawnCalls();
      expect(spawnCalls.length).toBeGreaterThan(0);

      const osConfig = DaemonOSMock.getConfig();
      expect(osConfig.execPath).toBe('/usr/bin/node');

      expect(pidManager.validateAndCleanup).toHaveBeenCalled();
      expect(pidManager.savePid).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
    });
  });
});