/**
 * Signal handling for graceful process shutdown
 * Extracted from server-daemon.ts for separation of concerns
 * 
 * Single Responsibility: Handle process signals and coordinate graceful shutdown
 */

import { SIGNAL_CONFIG, PROCESS_CONFIG } from '../config/constants';
import { logger } from '../utils/logger';
import { pidManager } from './pid';

/**
 * Shutdown step information
 */
export interface ShutdownStep {
  step: number;
  name: string;
  action: () => Promise<void> | void;
  timeout?: number;
}

/**
 * Signal handler interface (ISP compliance)
 */
export interface ISignalHandler {
  setupGracefulShutdown(server: any): void;
  registerShutdownStep(step: ShutdownStep): void;
  initiateShutdown(signal: string): Promise<void>;
  forceShutdown(reason: string): void;
}

/**
 * Process error for signal operations
 */
export class SignalError extends Error {
  constructor(
    message: string,
    public readonly signal?: string,
    public readonly step?: number
  ) {
    super(message);
    this.name = 'SignalError';
  }
}

/**
 * Signal handler implementation following SOLID principles
 */
export class SignalHandler implements ISignalHandler {
  private shutdownSteps: ShutdownStep[] = [];
  private isShuttingDown = false;
  private shutdownTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    logger.debug('SignalHandler initialized');
  }

  /**
   * Setup graceful shutdown handlers for server
   */
  setupGracefulShutdown(server: any): void {
    if (!server) {
      throw new SignalError('Server instance is required for graceful shutdown');
    }

    // Register default shutdown steps
    this.registerDefaultShutdownSteps(server);

    // Setup signal handlers
    for (const signal of SIGNAL_CONFIG.GRACEFUL_SHUTDOWN_SIGNALS) {
      process.on(signal, () => {
        this.initiateShutdown(signal).catch((error) => {
          logger.error('Error during graceful shutdown', error instanceof Error ? error : undefined, { 
            signal: signal, 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          this.forceShutdown(`Graceful shutdown failed: ${error}`);
        });
      });
    }

    logger.debug('Graceful shutdown handlers setup', {
      signals: SIGNAL_CONFIG.GRACEFUL_SHUTDOWN_SIGNALS,
      steps: this.shutdownSteps.length
    });
  }

  /**
   * Register a shutdown step to be executed during graceful shutdown
   */
  registerShutdownStep(step: ShutdownStep): void {
    if (!step.name || !step.action) {
      throw new SignalError('Shutdown step must have name and action');
    }

    this.shutdownSteps.push({
      ...step,
      timeout: step.timeout || PROCESS_CONFIG.DEFAULT_SHUTDOWN_TIMEOUT_MS
    });

    // Sort by step number
    this.shutdownSteps.sort((a, b) => a.step - b.step);

    logger.debug('Shutdown step registered', { 
      step: step.step, 
      name: step.name,
      totalSteps: this.shutdownSteps.length
    });
  }

  /**
   * Initiate graceful shutdown sequence
   */
  async initiateShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring signal', { signal });
      return;
    }

    this.isShuttingDown = true;
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    // Set overall shutdown timeout
    this.shutdownTimer = setTimeout(() => {
      this.forceShutdown('Shutdown timeout exceeded');
    }, PROCESS_CONFIG.DEFAULT_SHUTDOWN_TIMEOUT_MS);

    try {
      await this.executeShutdownSteps();
      
      if (this.shutdownTimer) {
        clearTimeout(this.shutdownTimer);
      }

      logger.info('Graceful shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      if (this.shutdownTimer) {
        clearTimeout(this.shutdownTimer);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Graceful shutdown failed', error instanceof Error ? error : undefined, { error: errorMessage });
      this.forceShutdown(`Shutdown step failed: ${errorMessage}`);
    }
  }

  /**
   * Force immediate shutdown
   */
  forceShutdown(reason: string): void {
    logger.error(`Force shutdown initiated: ${reason}`);
    
    // Best effort PID cleanup
    try {
      pidManager.cleanupPidFile();
    } catch (error) {
      logger.error('Failed to cleanup PID during force shutdown', error instanceof Error ? error : undefined, { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    process.exit(1);
  }

  /**
   * Register default shutdown steps
   */
  private registerDefaultShutdownSteps(server: any): void {
    // Step 1: Close HTTP server
    this.registerShutdownStep({
      step: SIGNAL_CONFIG.SHUTDOWN_STEPS.CLOSE_SERVER,
      name: 'Close HTTP Server',
      action: () => {
        return new Promise<void>((resolve, reject) => {
          server.close((error: Error | undefined) => {
            if (error) {
              reject(error);
            } else {
              logger.debug('HTTP server closed');
              resolve();
            }
          });
        });
      },
      timeout: 5000
    });

    // Step 2: Cleanup sessions (if session manager is available)
    this.registerShutdownStep({
      step: SIGNAL_CONFIG.SHUTDOWN_STEPS.CLEANUP_SESSIONS,
      name: 'Cleanup Sessions',
      action: async () => {
        try {
          // Dynamic import to avoid circular dependencies
          const { sessionManager } = await import('../session/manager');
          if (sessionManager && typeof sessionManager.shutdown === 'function') {
            await sessionManager.shutdown();
            logger.debug('Session manager shutdown completed');
          }
        } catch (error) {
          logger.debug('Session manager not available or shutdown failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      },
      timeout: 2000
    });

    // Step 3: Remove PID file
    this.registerShutdownStep({
      step: SIGNAL_CONFIG.SHUTDOWN_STEPS.REMOVE_PID_FILE,
      name: 'Remove PID File',
      action: () => {
        pidManager.cleanupPidFile();
        logger.debug('PID file cleanup completed');
      },
      timeout: 1000
    });
  }

  /**
   * Execute all shutdown steps in order
   */
  private async executeShutdownSteps(): Promise<void> {
    for (const step of this.shutdownSteps) {
      logger.debug(`Executing shutdown step: ${step.name}`, { step: step.step });

      try {
        // Execute step with timeout
        await this.executeStepWithTimeout(step);
        logger.debug(`Shutdown step completed: ${step.name}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Shutdown step failed: ${step.name}`, error instanceof Error ? error : undefined, { 
          step: step.step,
          error: errorMessage
        });
        
        throw new SignalError(
          `Shutdown step failed: ${step.name} - ${errorMessage}`,
          undefined,
          step.step
        );
      }
    }
  }

  /**
   * Execute a shutdown step with timeout
   */
  private async executeStepWithTimeout(step: ShutdownStep): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new SignalError(
          `Shutdown step timeout: ${step.name}`,
          undefined,
          step.step
        ));
      }, step.timeout);

      Promise.resolve(step.action())
        .then(() => {
          clearTimeout(timeout);
          resolve();
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }
}

/**
 * Global signal handler instance (Singleton pattern)
 */
export const signalHandler = new SignalHandler();