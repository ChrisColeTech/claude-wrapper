/**
 * Process management orchestrator for Phase 6A
 * Extracted from cli.ts for separation of concerns
 * 
 * Single Responsibility: Coordinate all process management operations
 */

import { PROCESS_CONFIG, PROCESS_PERFORMANCE } from '../config/constants';
import { logger } from '../utils/logger';
import { pidManager, IPidManager } from './pid';
import { daemonManager, IDaemonManager, DaemonOptions } from './daemon';
import { signalHandler, ISignalHandler } from './signals';

/**
 * Process status information
 */
export interface ProcessStatus {
  running: boolean;
  pid: number | null;
  uptime?: number;
  health?: 'healthy' | 'unhealthy' | 'unknown';
}

/**
 * Process manager options
 */
export interface ProcessManagerOptions {
  port?: string;
  apiKey?: string;
  verbose?: boolean;
  debug?: boolean;
  interactive?: boolean;
  mock?: boolean;
}

/**
 * Process manager interface (ISP compliance)
 */
export interface IProcessManager {
  start(options: ProcessManagerOptions): Promise<number>;
  stop(): Promise<boolean>;
  status(): Promise<ProcessStatus>;
  restart(options?: ProcessManagerOptions): Promise<number>;
  isRunning(): boolean;
}

/**
 * Process error for manager operations
 */
export class ProcessError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ProcessError';
  }
}

/**
 * Process manager implementation following SOLID principles
 * Orchestrates PID management, daemon operations, and signal handling
 */
export class ProcessManager implements IProcessManager {
  private pidManager: IPidManager;
  private daemonManager: IDaemonManager;
  private signalHandler: ISignalHandler;
  private currentPort: string = '8000'; // Track the current port

  constructor(
    customPidManager?: IPidManager,
    customDaemonManager?: IDaemonManager,
    customSignalHandler?: ISignalHandler
  ) {
    this.pidManager = customPidManager || pidManager;
    this.daemonManager = customDaemonManager || daemonManager;
    this.signalHandler = customSignalHandler || signalHandler;
    
    // Load the current port from file if available
    this.currentPort = this.loadCurrentPort() || '8000';
    
    logger.debug('ProcessManager initialized');
  }

  /**
   * Start process with options
   */
  async start(options: ProcessManagerOptions): Promise<number> {
    const startTime = Date.now();
    
    try {
      // Check if already running
      if (this.isRunning()) {
        const pid = this.pidManager.readPid();
        throw new ProcessError(
          `Process already running with PID ${pid}`,
          'start',
          'ALREADY_RUNNING'
        );
      }

      // Store the port for health checks
      this.currentPort = options.port || '8000';
      this.saveCurrentPort(this.currentPort);

      // Prepare daemon options
      const daemonOptions: DaemonOptions = {
        ...(options.port && { port: options.port }),
        ...(options.apiKey && { apiKey: options.apiKey }),
        ...(options.verbose && { verbose: options.verbose }),
        ...(options.debug && { debug: options.debug }),
        ...(options.mock !== undefined && { mock: options.mock }),
      };

      // Start daemon
      const pid = await this.daemonManager.startDaemon(daemonOptions);
      
      // Verify startup within performance requirements
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > PROCESS_PERFORMANCE.MAX_OPERATION_TIME_MS) {
        logger.warn('Process start exceeded performance target', {
          elapsed: elapsedTime,
          target: PROCESS_PERFORMANCE.MAX_OPERATION_TIME_MS
        });
      }

      logger.info('Process started successfully', { 
        pid, 
        port: options.port,
        startupTime: elapsedTime
      });
      
      return pid;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to start process', error instanceof Error ? error : undefined, { error: errorMessage });
      
      if (error instanceof ProcessError) {
        throw error;
      }
      
      throw new ProcessError(
        `Failed to start process: ${errorMessage}`,
        'start',
        'START_FAILED'
      );
    }
  }

  /**
   * Stop running process
   */
  async stop(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      if (!this.isRunning()) {
        logger.debug('No process running, nothing to stop');
        return false;
      }


      const stopped = await this.daemonManager.stopDaemon();
      
      // Reset port when stopping
      this.currentPort = '8000';
      this.saveCurrentPort(this.currentPort);
      
      // Verify shutdown within performance requirements
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > PROCESS_PERFORMANCE.MAX_OPERATION_TIME_MS) {
        logger.warn('Process stop exceeded performance target', {
          elapsed: elapsedTime,
          target: PROCESS_PERFORMANCE.MAX_OPERATION_TIME_MS
        });
      }

      if (stopped) {
        logger.info('Process stopped successfully', { 
          shutdownTime: elapsedTime
        });
      }
      
      return stopped;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to stop process', error instanceof Error ? error : undefined, { error: errorMessage });
      
      throw new ProcessError(
        `Failed to stop process: ${errorMessage}`,
        'stop',
        'STOP_FAILED'
      );
    }
  }

  /**
   * Get process status
   */
  async status(): Promise<ProcessStatus> {
    try {
      const { running, pid } = await this.daemonManager.getDaemonStatus();
      
      const status: ProcessStatus = {
        running,
        pid,
      };

      // Add health check if running
      if (running && pid) {
        status.health = await this.checkHealth();
      }

      return status;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get process status', error instanceof Error ? error : undefined, { error: errorMessage });
      
      throw new ProcessError(
        `Failed to get status: ${errorMessage}`,
        'status',
        'STATUS_FAILED'
      );
    }
  }

  /**
   * Restart process
   */
  async restart(options?: ProcessManagerOptions): Promise<number> {
    logger.info('Restarting process');
    
    try {
      // Stop if running
      await this.stop();
      
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, PROCESS_CONFIG.RESTART_DELAY_MS));
      
      // Start with provided or default options
      const startOptions = options || {
        port: '8000',
        verbose: false,
        debug: false,
        interactive: false,
      };
      
      return await this.start(startOptions);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to restart process', error instanceof Error ? error : undefined, { error: errorMessage });
      
      throw new ProcessError(
        `Failed to restart process: ${errorMessage}`,
        'restart',
        'RESTART_FAILED'
      );
    }
  }

  /**
   * Check if process is currently running
   */
  isRunning(): boolean {
    return this.pidManager.validateAndCleanup();
  }

  /**
   * Get signal handler instance (for future signal management integration)
   */
  getSignalHandler(): ISignalHandler {
    return this.signalHandler;
  }

  /**
   * Check process health
   */
  private async checkHealth(): Promise<'healthy' | 'unhealthy' | 'unknown'> {
    try {
      // Simple health check via HTTP (if available)
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const command = `curl -s --connect-timeout 1 http://localhost:${this.currentPort}/health`;
      logger.info('Running health check command', { command, port: this.currentPort });
      
      const { stdout } = await execAsync(
        command,
        { timeout: PROCESS_CONFIG.HEALTH_CHECK_TIMEOUT_MS }
      );
      
      logger.info('Health check response', { stdout });
      
      if (stdout.includes('healthy')) {
        return 'healthy';
      } else {
        return 'unhealthy';
      }
    } catch (error) {
      logger.info('Health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        port: this.currentPort
      });
      return 'unknown';
    }
  }

  /**
   * Save current port to file for persistence across CLI invocations
   */
  private saveCurrentPort(port: string): void {
    try {
      const { tmpdir } = require('os');
      const { writeFileSync } = require('fs');
      const portFilePath = require('path').join(tmpdir(), 'claude-wrapper-port');
      writeFileSync(portFilePath, port);
    } catch (error) {
      // Non-fatal error - just log it
      logger.debug('Failed to save current port', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Load current port from file
   */
  private loadCurrentPort(): string | null {
    try {
      const { tmpdir } = require('os');
      const { readFileSync, existsSync } = require('fs');
      const portFilePath = require('path').join(tmpdir(), 'claude-wrapper-port');
      
      if (existsSync(portFilePath)) {
        const portContent = readFileSync(portFilePath, 'utf8');
        return portContent.trim();
      }
      return null;
    } catch (error) {
      // Non-fatal error - just log it
      logger.debug('Failed to load current port', { error: error instanceof Error ? error.message : 'Unknown error' });
      return null;
    }
  }
}

/**
 * Global process manager instance (Singleton pattern)
 */
export const processManager = new ProcessManager();