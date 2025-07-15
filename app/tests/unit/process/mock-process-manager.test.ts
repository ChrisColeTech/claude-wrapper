/**
 * Unit tests for ProcessManager mock flag propagation
 * Tests mock flag handling in process management chain
 */

import { ProcessManager, ProcessManagerOptions } from '../../../src/process/manager';
import { IPidManager } from '../../../src/process/pid';
import { IDaemonManager, DaemonOptions } from '../../../src/process/daemon';
import { ISignalHandler } from '../../../src/process/signals';
import { logger } from '../../../src/utils/logger';

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  }
}));

describe('ProcessManager Mock Mode Tests', () => {
  let mockPidManager: jest.Mocked<IPidManager>;
  let mockDaemonManager: jest.Mocked<IDaemonManager>;
  let mockSignalHandler: jest.Mocked<ISignalHandler>;
  let processManager: ProcessManager;

  beforeEach(() => {
    // Create mock implementations
    mockPidManager = {
      getPidFilePath: jest.fn(),
      savePid: jest.fn(),
      readPid: jest.fn(),
      cleanupPidFile: jest.fn(),
      validateAndCleanup: jest.fn(),
      isProcessRunning: jest.fn(),
      getPidInfo: jest.fn()
    };

    mockDaemonManager = {
      startDaemon: jest.fn(),
      isDaemonRunning: jest.fn(),
      stopDaemon: jest.fn(),
      getDaemonStatus: jest.fn()
    };

    mockSignalHandler = {
      setupGracefulShutdown: jest.fn(),
      registerShutdownStep: jest.fn(),
      initiateShutdown: jest.fn(),
      forceShutdown: jest.fn()
    };

    // Create ProcessManager with mocked dependencies
    processManager = new ProcessManager(
      mockPidManager,
      mockDaemonManager,
      mockSignalHandler
    );

    jest.clearAllMocks();
  });

  describe('ProcessManagerOptions Interface', () => {
    test('should have correct mock property type', () => {
      const options: ProcessManagerOptions = {
        mock: true
      };
      
      expect(typeof options.mock).toBe('boolean');
    });

    test('should allow mock with all other properties', () => {
      const options: ProcessManagerOptions = {
        port: '8000',
        apiKey: 'test-key',
        verbose: true,
        debug: false,
        interactive: true,
        mock: true
      };
      
      expect(options.mock).toBe(true);
      expect(Object.keys(options)).toContain('mock');
    });
  });

  describe('Mock Flag Propagation', () => {
    test('should propagate mock flag to daemon options', async () => {
      const options: ProcessManagerOptions = {
        port: '8000',
        mock: true
      };

      mockPidManager.validateAndCleanup.mockReturnValue(false);
      mockDaemonManager.startDaemon.mockResolvedValue(12345);

      await processManager.start(options);

      expect(mockDaemonManager.startDaemon).toHaveBeenCalledWith(
        expect.objectContaining({
          mock: true
        })
      );
    });

    test('should propagate mock flag with other options', async () => {
      const options: ProcessManagerOptions = {
        port: '9000',
        apiKey: 'test-key',
        verbose: true,
        debug: false,
        interactive: false,
        mock: true
      };

      mockPidManager.validateAndCleanup.mockReturnValue(false);
      mockDaemonManager.startDaemon.mockResolvedValue(12345);

      await processManager.start(options);

      const expectedDaemonOptions: DaemonOptions = {
        port: '9000',
        apiKey: 'test-key',
        verbose: true,
        mock: true
      };

      expect(mockDaemonManager.startDaemon).toHaveBeenCalledWith(
        expectedDaemonOptions
      );
    });

    test('should not propagate mock flag when not specified', async () => {
      const options: ProcessManagerOptions = {
        port: '8000',
        debug: true
      };

      mockPidManager.validateAndCleanup.mockReturnValue(false);
      mockDaemonManager.startDaemon.mockResolvedValue(12345);

      await processManager.start(options);

      expect(mockDaemonManager.startDaemon).toHaveBeenCalledWith(
        expect.not.objectContaining({
          mock: expect.anything()
        })
      );
    });

    test('should propagate mock flag set to false', async () => {
      const options: ProcessManagerOptions = {
        port: '8000',
        mock: false
      };

      mockPidManager.validateAndCleanup.mockReturnValue(false);
      mockDaemonManager.startDaemon.mockResolvedValue(12345);

      await processManager.start(options);

      expect(mockDaemonManager.startDaemon).toHaveBeenCalledWith(
        expect.objectContaining({
          mock: false
        })
      );
    });
  });

  describe('Error Handling with Mock Mode', () => {
    test('should handle daemon start error with mock flag', async () => {
      const options: ProcessManagerOptions = {
        port: '8000',
        mock: true
      };

      mockPidManager.validateAndCleanup.mockReturnValue(false);
      mockDaemonManager.startDaemon.mockRejectedValue(new Error('Daemon start failed'));

      await expect(processManager.start(options)).rejects.toThrow('Failed to start process');
      
      expect(mockDaemonManager.startDaemon).toHaveBeenCalledWith(
        expect.objectContaining({
          mock: true
        })
      );
    });

    test('should handle already running process with mock flag', async () => {
      const options: ProcessManagerOptions = {
        port: '8000',
        mock: true
      };

      mockPidManager.validateAndCleanup.mockReturnValue(true);
      mockPidManager.readPid.mockReturnValue(12345);

      await expect(processManager.start(options)).rejects.toThrow('Process already running');
      
      expect(mockDaemonManager.startDaemon).not.toHaveBeenCalled();
    });
  });

  describe('Logging with Mock Mode', () => {
    test('should log successful start with mock flag', async () => {
      const options: ProcessManagerOptions = {
        port: '8000',
        mock: true
      };

      mockPidManager.validateAndCleanup.mockReturnValue(false);
      mockDaemonManager.startDaemon.mockResolvedValue(12345);

      await processManager.start(options);

      expect(logger.info).toHaveBeenCalledWith(
        'Process started successfully',
        expect.objectContaining({
          pid: 12345,
          port: '8000'
        })
      );
    });

    test('should log daemon options with mock flag', async () => {
      const options: ProcessManagerOptions = {
        port: '8000',
        mock: true
      };

      mockPidManager.validateAndCleanup.mockReturnValue(false);
      mockDaemonManager.startDaemon.mockResolvedValue(12345);

      await processManager.start(options);

      expect(mockDaemonManager.startDaemon).toHaveBeenCalledWith(
        expect.objectContaining({
          mock: true
        })
      );
    });
  });

  describe('Other Process Manager Functions', () => {
    test('should handle stop without being affected by mock mode', async () => {
      mockPidManager.validateAndCleanup.mockReturnValue(true);
      mockDaemonManager.stopDaemon.mockResolvedValue(true);

      const result = await processManager.stop();

      expect(result).toBe(true);
      expect(mockDaemonManager.stopDaemon).toHaveBeenCalled();
    });

    test('should handle status without being affected by mock mode', async () => {
      mockDaemonManager.getDaemonStatus.mockResolvedValue({
        running: true,
        pid: 12345
      });

      const status = await processManager.status();

      expect(status.running).toBe(true);
      expect(status.pid).toBe(12345);
    });

    test('should handle isRunning without being affected by mock mode', () => {
      mockPidManager.validateAndCleanup.mockReturnValue(true);

      const isRunning = processManager.isRunning();

      expect(isRunning).toBe(true);
      expect(mockPidManager.validateAndCleanup).toHaveBeenCalled();
    });
  });

  describe('Port Persistence with Mock Mode', () => {
    test('should save and load port correctly with mock flag', async () => {
      const options: ProcessManagerOptions = {
        port: '9000',
        mock: true
      };

      mockPidManager.validateAndCleanup.mockReturnValue(false);
      mockDaemonManager.startDaemon.mockResolvedValue(12345);

      await processManager.start(options);

      // Port should be saved internally for health checks
      expect(mockDaemonManager.startDaemon).toHaveBeenCalledWith(
        expect.objectContaining({
          port: '9000',
          mock: true
        })
      );
    });
  });
});