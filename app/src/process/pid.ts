/**
 * PID file management for process lifecycle
 * Extracted from cli.ts for separation of concerns
 * 
 * Single Responsibility: Manage PID file operations (create, read, validate, cleanup)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PROCESS_CONFIG, SIGNAL_CONFIG } from '../config/constants';
import { logger } from '../utils/logger';

/**
 * PID file information interface
 */
export interface PidInfo {
  pid: number;
  filePath: string;
  exists: boolean;
  running: boolean;
}

/**
 * PID manager interface (ISP compliance)
 */
export interface IPidManager {
  getPidFilePath(): string;
  savePid(pid: number): void;
  readPid(): number | null;
  isProcessRunning(pid?: number): boolean;
  cleanupPidFile(): void;
  getPidInfo(): PidInfo;
  validateAndCleanup(): boolean;
}

/**
 * Process error for PID operations
 */
export class PidError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly filePath?: string,
    public readonly pid?: number
  ) {
    super(message);
    this.name = 'PidError';
  }
}

/**
 * PID file manager implementation following SOLID principles
 */
export class PidManager implements IPidManager {
  private readonly pidFilePath: string;

  constructor(pidFileName?: string) {
    this.pidFilePath = path.join(
      os.tmpdir(), 
      pidFileName || PROCESS_CONFIG.PID_FILE_NAME
    );
    
    logger.debug('PidManager initialized', { 
      pidFilePath: this.pidFilePath,
      fileName: pidFileName || PROCESS_CONFIG.PID_FILE_NAME
    });
  }

  /**
   * Get the PID file path
   */
  getPidFilePath(): string {
    return this.pidFilePath;
  }

  /**
   * Save process PID to file
   */
  savePid(pid: number): void {
    if (!Number.isInteger(pid) || pid <= 0) {
      throw new PidError(
        `Invalid PID: ${pid}. Must be a positive integer`,
        'save',
        this.pidFilePath,
        pid
      );
    }

    try {
      fs.writeFileSync(this.pidFilePath, pid.toString(), { encoding: 'utf8' });
      logger.debug('PID saved successfully', { pid, filePath: this.pidFilePath });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to save PID file', error instanceof Error ? error : undefined, { 
        pid: pid, 
        filePath: this.pidFilePath, 
        error: errorMessage 
      });
      
      throw new PidError(
        `Failed to save PID file: ${errorMessage}`,
        'save',
        this.pidFilePath,
        pid
      );
    }
  }

  /**
   * Read PID from file, returns null if file doesn't exist or invalid
   */
  readPid(): number | null {
    if (!fs.existsSync(this.pidFilePath)) {
      logger.debug('PID file does not exist', { filePath: this.pidFilePath });
      return null;
    }

    try {
      const pidString = fs.readFileSync(this.pidFilePath, 'utf8').trim();
      const pid = parseInt(pidString, 10);
      
      if (isNaN(pid) || pid <= 0) {
        logger.warn('Invalid PID in file', { 
          pidString, 
          filePath: this.pidFilePath 
        });
        return null;
      }

      logger.debug('PID read from file', { pid, filePath: this.pidFilePath });
      return pid;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn('Failed to read PID file', { 
        filePath: this.pidFilePath, 
        error: errorMessage 
      });
      return null;
    }
  }

  /**
   * Check if process is running using signal 0
   * If no PID provided, reads from file
   */
  isProcessRunning(pid?: number): boolean {
    const processId = pid || this.readPid();
    
    if (!processId) {
      logger.debug('No PID available for process check');
      return false;
    }

    try {
      // Signal 0 doesn't actually send a signal, just checks if process exists
      process.kill(processId, SIGNAL_CONFIG.PROCESS_CHECK_SIGNAL);
      logger.debug('Process is running', { pid: processId });
      return true;
    } catch (error) {
      logger.debug('Process is not running', { 
        pid: processId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Clean up PID file
   */
  cleanupPidFile(): void {
    if (!fs.existsSync(this.pidFilePath)) {
      logger.debug('PID file does not exist, no cleanup needed', { 
        filePath: this.pidFilePath 
      });
      return;
    }

    try {
      fs.unlinkSync(this.pidFilePath);
      logger.debug('PID file cleaned up successfully', { 
        filePath: this.pidFilePath 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn('Failed to cleanup PID file', { 
        filePath: this.pidFilePath, 
        error: errorMessage 
      });
      
      // Don't throw here - cleanup should be best effort
    }
  }

  /**
   * Get comprehensive PID information
   */
  getPidInfo(): PidInfo {
    const pid = this.readPid();
    const exists = fs.existsSync(this.pidFilePath);
    const running = pid ? this.isProcessRunning(pid) : false;

    const info: PidInfo = {
      pid: pid || 0,
      filePath: this.pidFilePath,
      exists,
      running
    };

    logger.debug('PID info retrieved', info);
    return info;
  }

  /**
   * Validate PID file state and clean up stale files
   */
  validateAndCleanup(): boolean {
    const info = this.getPidInfo();
    
    // If file exists but process is not running, clean up stale file
    if (info.exists && !info.running) {
      logger.info('Cleaning up stale PID file', { 
        pid: info.pid, 
        filePath: info.filePath 
      });
      this.cleanupPidFile();
      return false;
    }
    
    return info.running;
  }
}

/**
 * Global PID manager instance (Singleton pattern)
 */
export const pidManager = new PidManager();