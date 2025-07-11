/**
 * Daemon management for background process operations
 * Extracted from server-daemon.ts and cli.ts for separation of concerns
 * 
 * Single Responsibility: Handle daemon process creation and management
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { PROCESS_CONFIG } from '../config/constants';
import { logger } from '../utils/logger';
import { pidManager } from './pid';

/**
 * Daemon process options
 */
export interface DaemonOptions {
  port?: string;
  apiKey?: string;
  verbose?: boolean;
  debug?: boolean;
  scriptPath?: string;
  mock?: boolean;
}

/**
 * Daemon manager interface (ISP compliance)
 */
export interface IDaemonManager {
  startDaemon(options: DaemonOptions): Promise<number>;
  isDaemonRunning(): boolean;
  stopDaemon(): Promise<boolean>;
  getDaemonStatus(): Promise<{ running: boolean; pid: number | null }>;
}

/**
 * Process error for daemon operations
 */
export class DaemonError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly pid?: number
  ) {
    super(message);
    this.name = 'DaemonError';
  }
}

/**
 * Daemon manager implementation following SOLID principles
 */
export class DaemonManager implements IDaemonManager {
  constructor() {
    logger.debug('DaemonManager initialized');
  }

  /**
   * Start daemon process in background
   */
  async startDaemon(options: DaemonOptions): Promise<number> {
    // Check if already running
    if (this.isDaemonRunning()) {
      const pid = pidManager.readPid();
      throw new DaemonError(
        `Daemon already running with PID ${pid}`,
        'start',
        pid || undefined
      );
    }

    const scriptPath = options.scriptPath || this.getDefaultScriptPath();
    const args = this.buildDaemonArgs(options);

    logger.debug('Starting daemon process', { scriptPath, args });

    try {
      const child = spawn(process.execPath, [scriptPath, ...args], {
        detached: true,
        stdio: 'ignore',
        env: {
          ...process.env  // Inherit parent environment variables
        }
      });

      if (!child.pid) {
        throw new DaemonError('Failed to spawn daemon process', 'start');
      }

      // Save PID for management (non-fatal if this fails)
      try {
        pidManager.savePid(child.pid);
      } catch (pidError) {
        logger.warn('Failed to save PID file, daemon started but may be harder to manage', { pid: child.pid, error: pidError instanceof Error ? pidError.message : 'Unknown error' });
      }
      
      // Allow parent to exit
      child.unref();

      logger.info('Daemon process started successfully', { pid: child.pid });
      return child.pid;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to start daemon process', error instanceof Error ? error : undefined, { error: errorMessage });
      
      throw new DaemonError(
        `Failed to start daemon: ${errorMessage}`,
        'start'
      );
    }
  }

  /**
   * Check if daemon is currently running
   */
  isDaemonRunning(): boolean {
    return pidManager.validateAndCleanup();
  }

  /**
   * Stop daemon process
   */
  async stopDaemon(): Promise<boolean> {
    const pid = pidManager.readPid();
    
    if (!pid) {
      logger.debug('No daemon PID found');
      return false;
    }

    if (!pidManager.isProcessRunning(pid)) {
      logger.debug('Daemon process not running, cleaning up PID file');
      try {
        pidManager.cleanupPidFile();
      } catch (cleanupError) {
        logger.warn('Failed to cleanup stale PID file', { pid, error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error' });
      }
      return false;
    }

    try {
      logger.debug('Sending SIGTERM to daemon process', { pid });
      process.kill(pid, 'SIGTERM');
      
      // Wait for graceful shutdown
      await this.waitForProcessExit(pid, PROCESS_CONFIG.DEFAULT_SHUTDOWN_TIMEOUT_MS);
      
      // Clean up PID file (non-fatal if this fails)
      try {
        pidManager.cleanupPidFile();
      } catch (cleanupError) {
        logger.warn('Failed to cleanup PID file after stopping daemon', { pid, error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error' });
      }
      
      logger.info('Daemon process stopped successfully', { pid });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to stop daemon process', error instanceof Error ? error : undefined, { pid, error: errorMessage });
      
      throw new DaemonError(
        `Failed to stop daemon: ${errorMessage}`,
        'stop',
        pid
      );
    }
  }

  /**
   * Get daemon status information
   */
  async getDaemonStatus(): Promise<{ running: boolean; pid: number | null }> {
    try {
      const pid = pidManager.readPid();
      
      if (!pid) {
        return { running: false, pid: null };
      }
      
      // Use validateAndCleanup to handle stale PID files
      const running = pidManager.validateAndCleanup();
      
      // Return the original PID even if process is not running (for logging)
      // but validateAndCleanup will have cleaned up the stale file
      return { running, pid: running ? pid : null };
    } catch (error) {
      // Return safe defaults on error
      logger.debug('Error reading daemon status', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { running: false, pid: null };
    }
  }

  /**
   * Get default script path for daemon
   */
  private getDefaultScriptPath(): string {
    return path.join(__dirname, '../server-daemon.js');
  }

  /**
   * Build command line arguments for daemon process
   */
  private buildDaemonArgs(options: DaemonOptions): string[] {
    const args: string[] = [];
    
    if (options.port) {
      args.push('--port', options.port);
    }
    
    if (options.apiKey) {
      args.push('--api-key', options.apiKey);
    }
    
    if (options.verbose) {
      args.push('--verbose');
    }
    
    if (options.debug) {
      args.push('--debug');
    }
    
    if (options.mock) {
      args.push('--mock');
    }
    
    return args;
  }

  /**
   * Wait for process to exit
   */
  private async waitForProcessExit(pid: number, timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    const checkInterval = PROCESS_CONFIG.PROCESS_CHECK_INTERVAL_MS;
    
    return new Promise((resolve, reject) => {
      const checkProcess = () => {
        const elapsed = Date.now() - startTime;
        
        if (elapsed >= timeoutMs) {
          reject(new DaemonError(
            `Process ${pid} did not exit within ${timeoutMs}ms`,
            'wait',
            pid
          ));
          return;
        }
        
        if (!pidManager.isProcessRunning(pid)) {
          resolve();
          return;
        }
        
        setTimeout(checkProcess, checkInterval);
      };
      
      checkProcess();
    });
  }
}

/**
 * Global daemon manager instance (Singleton pattern)
 */
export const daemonManager = new DaemonManager();