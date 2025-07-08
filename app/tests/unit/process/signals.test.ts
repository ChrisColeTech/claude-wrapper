/**
 * Signal Handler Unit Tests - Phase 6A
 * Tests graceful shutdown and signal handling functionality
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  mockProcess, 
  mockServer, 
  mockLogger, 
  mockSessionManager, 
  resetProcessMocks, 
  setupSuccessfulSignalOperations, 
  setupFailedSignalOperations 
} from '../../mocks/process-mocks';

// Mock modules
jest.mock('child_process');
jest.mock('../../../src/utils/logger', () => ({
  logger: mockLogger,
}));
jest.mock('../../../src/session/manager', () => ({
  sessionManager: mockSessionManager,
}));

// Store original process methods
const originalProcess = {
  on: process.on,
  kill: process.kill,
  exit: process.exit,
};

// Import modules under test
import { SignalHandler, SignalError, ShutdownStep } from '../../../src/process/signals';

describe('SignalHandler', () => {
  let signalHandler: SignalHandler;
  let testServer: any;

  beforeEach(() => {
    // Reset mocks
    resetProcessMocks();
    setupSuccessfulSignalOperations();
    
    // Replace process methods with mocks
    process.on = mockProcess.on as any;
    process.kill = mockProcess.kill as any;
    process.exit = mockProcess.exit as any;
    
    // Setup test server
    testServer = {
      close: mockServer.close,
      listen: mockServer.listen,
    };
    
    // Create fresh instance
    signalHandler = new SignalHandler();
  });

  afterEach(() => {
    // Restore original process methods
    process.on = originalProcess.on;
    process.kill = originalProcess.kill;
    process.exit = originalProcess.exit;
  });

  describe('Constructor', () => {
    test('should create SignalHandler instance', () => {
      expect(signalHandler).toBeInstanceOf(SignalHandler);
    });

    test('should initialize with empty shutdown steps', () => {
      const handler = new SignalHandler();
      expect(handler).toBeDefined();
    });

    test('should have default shutdown timeout', () => {
      const handler = new SignalHandler();
      expect(handler).toBeDefined();
    });
  });

  describe('setupGracefulShutdown', () => {
    test('should register SIGTERM handler', () => {
      signalHandler.setupGracefulShutdown(testServer);
      
      expect(mockProcess.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    test('should register SIGINT handler', () => {
      signalHandler.setupGracefulShutdown(testServer);
      
      expect(mockProcess.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    test('should register uncaughtException handler', () => {
      signalHandler.setupGracefulShutdown(testServer);
      
      expect(mockProcess.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
    });

    test('should register unhandledRejection handler', () => {
      signalHandler.setupGracefulShutdown(testServer);
      
      expect(mockProcess.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });

    test('should store server reference', () => {
      expect(() => signalHandler.setupGracefulShutdown(testServer)).not.toThrow();
    });

    test('should handle null server gracefully', () => {
      expect(() => signalHandler.setupGracefulShutdown(null)).not.toThrow();
    });

    test('should handle undefined server gracefully', () => {
      expect(() => signalHandler.setupGracefulShutdown(undefined)).not.toThrow();
    });
  });

  describe('registerShutdownStep', () => {
    test('should register shutdown step with all properties', () => {
      const step: ShutdownStep = {
        name: 'test-step',
        step: 1,
        action: jest.fn() as any,
        timeout: 5000,
      };

      expect(() => signalHandler.registerShutdownStep(step)).not.toThrow();
    });

    test('should register shutdown step with minimal properties', () => {
      const step: ShutdownStep = {
        name: 'minimal-step',
        step: 1,
        action: jest.fn() as any,
      };

      expect(() => signalHandler.registerShutdownStep(step)).not.toThrow();
    });

    test('should register multiple shutdown steps', () => {
      const step1: ShutdownStep = {
        name: 'step-1',
        step: 1,
        action: jest.fn() as any,
      };

      const step2: ShutdownStep = {
        name: 'step-2',
        step: 2,
        action: jest.fn() as any,
      };

      expect(() => {
        signalHandler.registerShutdownStep(step1);
        signalHandler.registerShutdownStep(step2);
      }).not.toThrow();
    });

    test('should handle duplicate step names', () => {
      const step1: ShutdownStep = {
        name: 'duplicate',
        step: 1,
        action: jest.fn() as any,
      };

      const step2: ShutdownStep = {
        name: 'duplicate',
        step: 2,
        action: jest.fn() as any,
      };

      signalHandler.registerShutdownStep(step1);
      expect(() => signalHandler.registerShutdownStep(step2)).not.toThrow();
    });

    test('should throw SignalError for invalid step name', () => {
      const step: ShutdownStep = {
        name: '',
        step: 1,
        action: jest.fn() as any,
      };

      expect(() => signalHandler.registerShutdownStep(step)).toThrow(SignalError);
    });

    test('should throw SignalError for invalid step', () => {
      const step: ShutdownStep = {
        name: 'test',
        step: -1,
        action: jest.fn() as any,
      };

      expect(() => signalHandler.registerShutdownStep(step)).toThrow(SignalError);
    });

    test('should throw SignalError for missing action', () => {
      const step = {
        name: 'test',
        step: 1,
      } as ShutdownStep;

      expect(() => signalHandler.registerShutdownStep(step)).toThrow(SignalError);
    });
  });

  describe('initiateShutdown', () => {
    test('should execute shutdown without steps', async () => {
      signalHandler.setupGracefulShutdown(testServer);
      
      await expect(signalHandler.initiateShutdown('SIGTERM')).resolves.not.toThrow();
    });

    test('should execute shutdown steps in step order', async () => {
      const executionOrder: string[] = [];
      
      const step1: ShutdownStep = {
        name: 'step-1',
        step: 1,
        action: jest.fn().mockImplementation(async () => {
          executionOrder.push('step-1');
        }),
      };

      const step2: ShutdownStep = {
        name: 'step-2',
        step: 2,
        action: jest.fn().mockImplementation(async () => {
          executionOrder.push('step-2');
        }),
      };

      const step3: ShutdownStep = {
        name: 'step-3',
        step: 1,
        action: jest.fn().mockImplementation(async () => {
          executionOrder.push('step-3');
        }),
      };

      signalHandler.registerShutdownStep(step2);
      signalHandler.registerShutdownStep(step1);
      signalHandler.registerShutdownStep(step3);
      signalHandler.setupGracefulShutdown(testServer);

      await signalHandler.initiateShutdown('SIGTERM');

      expect(executionOrder).toEqual(['step-1', 'step-3', 'step-2']);
    });

    test('should close server after shutdown steps', async () => {
      signalHandler.setupGracefulShutdown(testServer);
      
      await signalHandler.initiateShutdown('SIGTERM');
      
      expect(mockServer.close).toHaveBeenCalled();
    });

    test('should call process.exit with code 0 on success', async () => {
      signalHandler.setupGracefulShutdown(testServer);
      
      await signalHandler.initiateShutdown('SIGTERM');
      
      expect(mockProcess.exit).toHaveBeenCalledWith(0);
    });

    test('should handle server close errors', async () => {
      setupFailedSignalOperations();
      signalHandler.setupGracefulShutdown(testServer);
      
      await signalHandler.initiateShutdown('SIGTERM');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Server close failed'),
        expect.any(Object)
      );
    });

    test('should handle shutdown step errors', async () => {
      const failingStep: ShutdownStep = {
        name: 'failing-step',
        step: 1,
        action: jest.fn().mockRejectedValue(new Error('Step failed')),
      };

      signalHandler.registerShutdownStep(failingStep);
      signalHandler.setupGracefulShutdown(testServer);
      
      await signalHandler.initiateShutdown('SIGTERM');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Shutdown step failed'),
        expect.any(Object)
      );
    });

    test('should handle shutdown step timeout', async () => {
      const slowStep: ShutdownStep = {
        name: 'slow-step',
        step: 1,
        timeout: 100,
        action: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
        }),
      };

      signalHandler.registerShutdownStep(slowStep);
      signalHandler.setupGracefulShutdown(testServer);
      
      await signalHandler.initiateShutdown('SIGTERM');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Shutdown step timed out'),
        expect.any(Object)
      );
    });

    test('should prevent multiple simultaneous shutdowns', async () => {
      signalHandler.setupGracefulShutdown(testServer);
      
      const shutdownPromise1 = signalHandler.initiateShutdown('SIGTERM');
      const shutdownPromise2 = signalHandler.initiateShutdown('SIGINT');
      
      await Promise.all([shutdownPromise1, shutdownPromise2]);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Shutdown already in progress')
      );
    });

    test('should handle null server during shutdown', async () => {
      signalHandler.setupGracefulShutdown(null);
      
      await expect(signalHandler.initiateShutdown('SIGTERM')).resolves.not.toThrow();
    });

    test('should log shutdown completion', async () => {
      signalHandler.setupGracefulShutdown(testServer);
      
      await signalHandler.initiateShutdown('SIGTERM');
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Graceful shutdown completed'),
        expect.any(Object)
      );
    });

    test('should include signal name in shutdown logs', async () => {
      signalHandler.setupGracefulShutdown(testServer);
      
      await signalHandler.initiateShutdown('SIGINT');
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('SIGINT'),
        expect.any(Object)
      );
    });

    test('should force exit on timeout', async () => {
      const hangingStep: ShutdownStep = {
        name: 'hanging-step',
        step: 1,
        action: jest.fn().mockImplementation(async () => {
          await new Promise(() => {}); // Never resolves
        }),
      };

      signalHandler.registerShutdownStep(hangingStep);
      signalHandler.setupGracefulShutdown(testServer);
      
      // Mock setTimeout to trigger immediately
      const originalSetTimeout = setTimeout;
      global.setTimeout = jest.fn().mockImplementation((fn) => {
        fn();
        return 1 as any;
      });
      
      await signalHandler.initiateShutdown('SIGTERM');
      
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
      
      // Restore setTimeout
      global.setTimeout = originalSetTimeout;
    });
  });

  describe('ShutdownStep Validation', () => {
    test('should accept valid shutdown step', () => {
      const step: ShutdownStep = {
        name: 'valid-step',
        priority: 5,
        action: jest.fn() as any,
        timeout: 10000,
      };

      expect(() => signalHandler.registerShutdownStep(step)).not.toThrow();
    });

    test('should reject step with empty name', () => {
      const step: ShutdownStep = {
        name: '',
        step: 1,
        action: jest.fn() as any,
      };

      expect(() => signalHandler.registerShutdownStep(step)).toThrow(SignalError);
    });

    test('should reject step with negative priority', () => {
      const step: ShutdownStep = {
        name: 'test',
        step: -1,
        action: jest.fn() as any,
      };

      expect(() => signalHandler.registerShutdownStep(step)).toThrow(SignalError);
    });

    test('should reject step with zero priority', () => {
      const step: ShutdownStep = {
        name: 'test',
        step: 0,
        action: jest.fn() as any,
      };

      expect(() => signalHandler.registerShutdownStep(step)).toThrow(SignalError);
    });

    test('should reject step with negative timeout', () => {
      const step: ShutdownStep = {
        name: 'test',
        step: 1,
        timeout: -1000,
        action: jest.fn() as any,
      };

      expect(() => signalHandler.registerShutdownStep(step)).toThrow(SignalError);
    });

    test('should accept step with zero timeout (no timeout)', () => {
      const step: ShutdownStep = {
        name: 'test',
        step: 1,
        timeout: 0,
        action: jest.fn() as any,
      };

      expect(() => signalHandler.registerShutdownStep(step)).not.toThrow();
    });
  });

  describe('SignalError', () => {
    test('should create error with all properties', () => {
      const error = new SignalError('Test error', 'SIGTERM', 1);
      
      expect(error.name).toBe('SignalError');
      expect(error.message).toBe('Test error');
      expect(error.signal).toBe('SIGTERM');
      expect(error.step).toBe(1);
    });

    test('should create error with minimal properties', () => {
      const error = new SignalError('Test error');
      
      expect(error.name).toBe('SignalError');
      expect(error.message).toBe('Test error');
      expect(error.signal).toBeUndefined();
      expect(error.step).toBeUndefined();
    });

    test('should extend Error class', () => {
      const error = new SignalError('Test error');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SignalError);
    });
  });

  describe('Error Handling', () => {
    test('should handle unexpected errors during shutdown', async () => {
      const faultyStep: ShutdownStep = {
        name: 'faulty-step',
        step: 1,
        action: jest.fn().mockImplementation(() => {
          throw new Error('Unexpected error');
        }),
      };

      signalHandler.registerShutdownStep(faultyStep);
      signalHandler.setupGracefulShutdown(testServer);
      
      await signalHandler.initiateShutdown('SIGTERM');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Shutdown step failed'),
        expect.objectContaining({
          step: 'faulty-step',
          error: expect.stringContaining('Unexpected error')
        })
      );
    });

    test('should continue shutdown even if some steps fail', async () => {
      const failingStep: ShutdownStep = {
        name: 'failing-step',
        step: 1,
        action: jest.fn().mockRejectedValue(new Error('Step failed')),
      };

      const successStep: ShutdownStep = {
        name: 'success-step',
        step: 2,
        action: jest.fn() as any,
      };

      signalHandler.registerShutdownStep(failingStep);
      signalHandler.registerShutdownStep(successStep);
      signalHandler.setupGracefulShutdown(testServer);
      
      await signalHandler.initiateShutdown('SIGTERM');
      
      expect(failingStep.action).toHaveBeenCalled();
      expect(successStep.action).toHaveBeenCalled();
      expect(mockServer.close).toHaveBeenCalled();
    });

    test('should handle server close callback errors', async () => {
      mockServer.close.mockImplementation((callback: (error?: Error) => void) => {
        callback(new Error('Server close error'));
      });

      signalHandler.setupGracefulShutdown(testServer);
      
      await signalHandler.initiateShutdown('SIGTERM');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Server close failed'),
        expect.any(Object)
      );
    });
  });
});