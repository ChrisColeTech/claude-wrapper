/**
 * Signal Handler Tests
 * Comprehensive tests for process signal handling
 * Single Responsibility: Test signal handler behavior
 */

import { SignalHandler, SignalError, ISignalHandler, ShutdownStep } from '../../../src/process/signals';
import { ProcessSignalMockSetup } from '../../mocks/process/signal-process-mock';
import { ServerSignalMockSetup } from '../../mocks/process/signal-server-mock';

// Mock the constants
jest.mock('../../../src/config/constants', () => ({
  SIGNAL_CONFIG: {
    GRACEFUL_SHUTDOWN_SIGNALS: ['SIGTERM', 'SIGINT'],
    FORCE_KILL_SIGNAL: 'SIGKILL',
    SHUTDOWN_STEPS: {
      CLOSE_SERVER: 1,
      CLEANUP_SESSIONS: 2,
      REMOVE_PID_FILE: 3,
      EXIT_PROCESS: 4
    }
  },
  PROCESS_CONFIG: {
    DEFAULT_SHUTDOWN_TIMEOUT_MS: 10000
  }
}));

// Mock the logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Get the mocked logger
const mockLogger = require('../../../src/utils/logger').logger;

// Mock the PID manager
jest.mock('../../../src/process/pid', () => ({
  pidManager: {
    cleanupPidFile: jest.fn()
  }
}));

// Get the mocked PID manager
const mockPidManager = require('../../../src/process/pid').pidManager;

// Mock the process object
let mockProcess: ReturnType<typeof ProcessSignalMockSetup.setup>;

// Initialize mock process after imports
mockProcess = ProcessSignalMockSetup.setup();
(global as any).process = mockProcess;

// Mock the dynamic import for session manager
jest.mock('../../../src/session/manager', () => ({
  sessionManager: {
    shutdown: jest.fn().mockResolvedValue(undefined)
  }
}), { virtual: true });

describe('Signal Handler', () => {
  let signalHandler: SignalHandler;
  let mockServer: ReturnType<typeof ServerSignalMockSetup.setup>;

  beforeEach(() => {
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    
    mockProcess = ProcessSignalMockSetup.setup();
    (global as any).process = mockProcess;
    mockServer = ServerSignalMockSetup.setup();
    mockPidManager.cleanupPidFile.mockClear();
    
    signalHandler = new SignalHandler();
  });

  afterEach(() => {
    ProcessSignalMockSetup.reset();
    ServerSignalMockSetup.reset();
  });

  describe('constructor', () => {
    it('should create signal handler instance', () => {
      expect(signalHandler).toBeInstanceOf(SignalHandler);
      expect(signalHandler).toHaveProperty('setupGracefulShutdown');
      expect(signalHandler).toHaveProperty('registerShutdownStep');
      expect(signalHandler).toHaveProperty('initiateShutdown');
      expect(signalHandler).toHaveProperty('forceShutdown');
    });

    it('should implement ISignalHandler interface', () => {
      const handler: ISignalHandler = signalHandler;
      expect(handler).toBeDefined();
    });

    it('should log initialization', () => {
      expect(mockLogger.debug).toHaveBeenCalledWith('SignalHandler initialized');
    });
  });

  describe('setupGracefulShutdown', () => {
    it('should setup graceful shutdown with server', () => {
      signalHandler.setupGracefulShutdown(mockServer);

      expect(ProcessSignalMockSetup.getRegisteredSignals()).toContain('SIGTERM');
      expect(ProcessSignalMockSetup.getRegisteredSignals()).toContain('SIGINT');
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Graceful shutdown handlers setup',
        expect.objectContaining({
          signals: ['SIGTERM', 'SIGINT'],
          steps: expect.any(Number)
        })
      );
    });

    it('should throw error if server is not provided', () => {
      expect(() => {
        signalHandler.setupGracefulShutdown(null);
      }).toThrow(SignalError);
      expect(() => {
        signalHandler.setupGracefulShutdown(null);
      }).toThrow('Server instance is required for graceful shutdown');
    });

    it('should register default shutdown steps', () => {
      signalHandler.setupGracefulShutdown(mockServer);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Shutdown step registered',
        expect.objectContaining({
          step: 1,
          name: 'Close HTTP Server'
        })
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Shutdown step registered',
        expect.objectContaining({
          step: 2,
          name: 'Cleanup Sessions'
        })
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Shutdown step registered',
        expect.objectContaining({
          step: 3,
          name: 'Remove PID File'
        })
      );
    });
  });

  describe('registerShutdownStep', () => {
    it('should register shutdown step', () => {
      const step: ShutdownStep = {
        step: 5,
        name: 'Test Step',
        action: jest.fn()
      };

      signalHandler.registerShutdownStep(step);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Shutdown step registered',
        expect.objectContaining({
          step: 5,
          name: 'Test Step',
          totalSteps: 1
        })
      );
    });

    it('should throw error for invalid step', () => {
      expect(() => {
        signalHandler.registerShutdownStep({
          step: 1,
          name: '',
          action: jest.fn()
        });
      }).toThrow(SignalError);
      expect(() => {
        signalHandler.registerShutdownStep({
          step: 1,
          name: '',
          action: jest.fn()
        });
      }).toThrow('Shutdown step must have name and action');
    });
  });

  describe('forceShutdown', () => {
    it('should force shutdown with reason', () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      expect(() => {
        signalHandler.forceShutdown('Test reason');
      }).toThrow('process.exit called');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Force shutdown initiated: Test reason'
      );
      expect(mockPidManager.cleanupPidFile).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle PID cleanup failure during force shutdown', () => {
      mockPidManager.cleanupPidFile.mockImplementation(() => {
        throw new Error('PID cleanup failed');
      });

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      expect(() => {
        signalHandler.forceShutdown('Test reason');
      }).toThrow('process.exit called');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to cleanup PID during force shutdown',
        expect.any(Error),
        expect.objectContaining({
          error: 'PID cleanup failed'
        })
      );

      mockExit.mockRestore();
    });
  });
});

describe('SignalError', () => {
  it('should create error with signal and step', () => {
    const error = new SignalError('Test message', 'SIGTERM', 1);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('SignalError');
    expect(error.message).toBe('Test message');
    expect(error.signal).toBe('SIGTERM');
    expect(error.step).toBe(1);
  });

  it('should create error with message only', () => {
    const error = new SignalError('Test message');

    expect(error.message).toBe('Test message');
    expect(error.signal).toBeUndefined();
    expect(error.step).toBeUndefined();
  });

  it('should be instance of Error', () => {
    const error = new SignalError('Test message');

    expect(error instanceof Error).toBe(true);
    expect(error instanceof SignalError).toBe(true);
  });
});