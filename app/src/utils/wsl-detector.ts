/**
 * WSL Detection Utility
 * Detects Windows Subsystem for Linux environment and retrieves WSL IP address
 * Single Responsibility: WSL environment detection and IP resolution
 */

import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';

const execAsync = promisify(exec);

export interface WSLInfo {
  isWSL: boolean;
  distroName?: string;
  wslVersion?: string;
  ip?: string;
}

/**
 * WSL detection and IP resolution utility
 */
export class WSLDetector {
  /**
   * Check if running in WSL environment
   */
  static isWSL(): boolean {
    try {
      // Method 1: Check WSL_DISTRO_NAME environment variable
      if (process.env['WSL_DISTRO_NAME']) {
        return true;
      }

      // Method 2: Check /proc/version for Microsoft WSL indicator
      if (fs.existsSync('/proc/version')) {
        const version = fs.readFileSync('/proc/version', 'utf8');
        if (version.toLowerCase().includes('microsoft') || 
            version.toLowerCase().includes('wsl')) {
          return true;
        }
      }

      // Method 3: Check /proc/sys/kernel/osrelease for WSL
      if (fs.existsSync('/proc/sys/kernel/osrelease')) {
        const osrelease = fs.readFileSync('/proc/sys/kernel/osrelease', 'utf8');
        if (osrelease.toLowerCase().includes('microsoft') ||
            osrelease.toLowerCase().includes('wsl')) {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.debug('WSL detection failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
  }

  /**
   * Get WSL IP address
   */
  static async getWSLIP(): Promise<string> {
    try {
      const { stdout } = await execAsync('hostname -I', { timeout: 5000 });
      const ips = stdout.trim().split(/\s+/);
      
      // Return the first IP address (usually the primary WSL interface)
      const wslIP = ips[0];
      
      if (!wslIP || !this.isValidIPv4(wslIP)) {
        throw new Error(`Invalid WSL IP address: ${wslIP}`);
      }

      logger.debug('WSL IP detected', { ip: wslIP, allIPs: ips });
      return wslIP;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get WSL IP address', error instanceof Error ? error : undefined, { error: errorMessage });
      throw new Error(`Failed to get WSL IP address: ${errorMessage}`);
    }
  }

  /**
   * Get comprehensive WSL information
   */
  static async getWSLInfo(): Promise<WSLInfo> {
    const isWSL = this.isWSL();
    
    if (!isWSL) {
      return { isWSL: false };
    }

    try {
      const wslVersion = await this.getWSLVersion();
      const distroName = process.env['WSL_DISTRO_NAME'];
      const ip = await this.getWSLIP();
      
      const info: WSLInfo = {
        isWSL: true,
        ...(distroName !== undefined && { distroName }),
        ...(wslVersion && { wslVersion }),
        ip
      };

      logger.info('WSL environment detected', info);
      return info;
    } catch (error) {
      logger.warn('Failed to get complete WSL info', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        isWSL: true,
        ...(process.env['WSL_DISTRO_NAME'] !== undefined && { distroName: process.env['WSL_DISTRO_NAME'] })
      };
    }
  }

  /**
   * Get WSL version (1 or 2)
   */
  private static async getWSLVersion(): Promise<string | undefined> {
    try {
      // Try to determine WSL version by checking for WSL2-specific features
      if (fs.existsSync('/proc/version')) {
        const version = fs.readFileSync('/proc/version', 'utf8');
        // WSL2 typically has a different kernel version pattern
        if (version.includes('WSL2') || version.includes('microsoft-standard-WSL2')) {
          return '2';
        } else if (version.includes('Microsoft')) {
          return '1';
        }
      }
      return undefined;
    } catch (error) {
      logger.debug('Failed to determine WSL version', { error: error instanceof Error ? error.message : 'Unknown error' });
      return undefined;
    }
  }

  /**
   * Validate IPv4 address format
   */
  private static isValidIPv4(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(ip);
  }

  /**
   * Check if WSL networking is available
   */
  static async isWSLNetworkingAvailable(): Promise<boolean> {
    if (!this.isWSL()) {
      return false;
    }

    try {
      await this.getWSLIP();
      return true;
    } catch (error) {
      logger.debug('WSL networking not available', { error: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
  }
}