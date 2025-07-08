/**
 * Port Forwarding Utility
 * Handles automatic WSL port forwarding to Windows host
 * Single Responsibility: WSL-to-Windows port forwarding management
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { WSLDetector } from './wsl-detector';
import { logger } from './logger';

const execAsync = promisify(exec);

export interface PortForwardingRule {
  port: number;
  wslIP: string;
  created: Date;
}

export interface PortForwardingError extends Error {
  code: 'WSL_NOT_DETECTED' | 'POWERSHELL_FAILED' | 'ADMIN_REQUIRED' | 'NETWORK_ERROR';
  port?: number | undefined;
  wslIP?: string | undefined;
}

/**
 * Port forwarding utility for WSL environments
 */
export class PortForwarder {
  private static activeForwards: Map<number, PortForwardingRule> = new Map();

  /**
   * Setup WSL port forwarding from Windows to WSL
   */
  static async setupWSLForwarding(port: number): Promise<PortForwardingRule> {
    // Validate WSL environment
    if (!WSLDetector.isWSL()) {
      const error = new Error('Not running in WSL environment') as PortForwardingError;
      error.code = 'WSL_NOT_DETECTED';
      error.port = port;
      throw error;
    }

    // Validate port range
    if (port < 1 || port > 65535) {
      throw new Error(`Invalid port number: ${port}. Must be between 1 and 65535.`);
    }

    try {
      // Get WSL IP address
      const wslIP = await WSLDetector.getWSLIP();
      logger.debug('Setting up WSL port forwarding', { port, wslIP });

      // Remove existing forwarding rule if it exists
      await this.removeWSLForwarding(port, false);

      // Create PowerShell command for port forwarding
      const powershellCmd = this.buildPortForwardCommand(port, wslIP);
      
      // Execute PowerShell command
      await this.executePowerShellCommand(powershellCmd, port, wslIP);

      // Store the active forwarding rule
      const rule: PortForwardingRule = {
        port,
        wslIP,
        created: new Date()
      };
      this.activeForwards.set(port, rule);

      logger.info('WSL port forwarding established', rule);
      return rule;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to setup WSL port forwarding', error instanceof Error ? error : undefined, { port });
      
      if (error instanceof Error && (error as PortForwardingError).code) {
        throw error;
      }
      
      const forwardingError: PortForwardingError = Object.assign(
        new Error(`Failed to setup WSL port forwarding: ${errorMessage}`),
        { code: 'NETWORK_ERROR' as const, port }
      );
      throw forwardingError;
    }
  }

  /**
   * Remove WSL port forwarding rule
   */
  static async removeWSLForwarding(port: number, throwOnError = true): Promise<boolean> {
    try {
      logger.debug('Removing WSL port forwarding', { port });

      // Create PowerShell command to remove forwarding
      const powershellCmd = `netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=${port}`;
      
      // Execute PowerShell command (ignore errors as the rule might not exist)
      await this.executePowerShellCommand(powershellCmd, port, undefined, false);

      // Remove from active forwards tracking
      this.activeForwards.delete(port);

      logger.info('WSL port forwarding removed', { port });
      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.debug('Failed to remove WSL port forwarding', { port, error: errorMessage });
      
      if (throwOnError) {
        throw new Error(`Failed to remove WSL port forwarding: ${errorMessage}`);
      }
      
      return false;
    }
  }

  /**
   * Remove all active WSL port forwarding rules
   */
  static async removeAllWSLForwarding(): Promise<void> {
    const ports = Array.from(this.activeForwards.keys());
    const results = await Promise.allSettled(
      ports.map(port => this.removeWSLForwarding(port, false))
    );

    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      logger.warn('Some WSL port forwarding rules failed to remove', { 
        total: ports.length, 
        failures: failures.length 
      });
    } else {
      logger.info('All WSL port forwarding rules removed', { count: ports.length });
    }
  }

  /**
   * List all active port forwarding rules
   */
  static getActiveForwards(): PortForwardingRule[] {
    return Array.from(this.activeForwards.values());
  }

  /**
   * Check if port forwarding is active for a specific port
   */
  static isPortForwarded(port: number): boolean {
    return this.activeForwards.has(port);
  }

  /**
   * Validate WSL networking and port forwarding capability
   */
  static async validateWSLNetworking(): Promise<{ isValid: boolean; error?: string }> {
    try {
      if (!WSLDetector.isWSL()) {
        return { isValid: false, error: 'Not running in WSL environment' };
      }

      const networkingAvailable = await WSLDetector.isWSLNetworkingAvailable();
      if (!networkingAvailable) {
        return { isValid: false, error: 'WSL networking not available' };
      }

      // Test PowerShell access
      await this.executePowerShellCommand('echo "test"', 0, '', false);
      
      return { isValid: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { isValid: false, error: errorMessage };
    }
  }

  /**
   * Build PowerShell command for port forwarding
   */
  private static buildPortForwardCommand(port: number, wslIP: string): string {
    return `netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=${port} connectaddress=${wslIP} connectport=${port}`;
  }

  /**
   * Execute PowerShell command with error handling
   */
  private static async executePowerShellCommand(
    command: string, 
    port: number, 
    wslIP: string | undefined = undefined, 
    throwOnError = true
  ): Promise<void> {
    try {
      const { stdout, stderr } = await execAsync(`powershell.exe -Command "${command}"`, {
        timeout: 10000
      });

      if (stderr && stderr.trim() && throwOnError) {
        // Check for admin privilege requirements
        if (stderr.toLowerCase().includes('access is denied') || 
            stderr.toLowerCase().includes('administrator')) {
          const error: PortForwardingError = Object.assign(
            new Error('Administrator privileges required for port forwarding'),
            { code: 'ADMIN_REQUIRED' as const, port, wslIP: wslIP as string | undefined }
          );
          throw error;
        }

        logger.warn('PowerShell command warning', { command, stderr: stderr.trim() });
      }

      logger.debug('PowerShell command executed', { command, stdout: stdout.trim() });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.debug('PowerShell command failed', { command, error: errorMessage });

      if (throwOnError) {
        if (error instanceof Error && (error as PortForwardingError).code) {
          throw error;
        }

        const powershellError: PortForwardingError = Object.assign(
          new Error(`PowerShell command failed: ${errorMessage}`),
          { code: 'POWERSHELL_FAILED' as const, port, wslIP: wslIP as string | undefined }
        );
        throw powershellError;
      }
    }
  }

  /**
   * Clean up all resources and remove forwarding rules
   */
  static async cleanup(): Promise<void> {
    logger.debug('Cleaning up port forwarding resources');
    await this.removeAllWSLForwarding();
    this.activeForwards.clear();
  }
}