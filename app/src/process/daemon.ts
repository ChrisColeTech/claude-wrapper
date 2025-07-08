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
        stdio: 'ignore'
      });

      if (!child.pid) {
        throw new DaemonError('Failed to spawn daemon process', 'start');
      }

      // Save PID for management
      pidManager.savePid(child.pid);
      
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
      pidManager.cleanupPidFile();
      return false;
    }

    try {
      logger.debug('Sending SIGTERM to daemon process', { pid });
      process.kill(pid, 'SIGTERM');
      
      // Wait for graceful shutdown
      await this.waitForProcessExit(pid, PROCESS_CONFIG.DEFAULT_SHUTDOWN_TIMEOUT_MS);
      
      // Clean up PID file
      pidManager.cleanupPidFile();
      
      logger.info('Daemon process stopped successfully', { pid });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to stop daemon process', error instanceof Error ? error : undefined, { pid: pid, error: errorMessage });
      
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
    const pid = pidManager.readPid();
    const running = pid ? pidManager.isProcessRunning(pid) : false;
    
    return { running, pid };
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