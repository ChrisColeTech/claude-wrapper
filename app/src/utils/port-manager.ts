/**
 * Production Port Management System
 * Handles port conflict resolution and management for production deployments
 * 
 * Single Responsibility: Port allocation, conflict detection, and management
 * Integrates with existing PortUtils for Claude SDK compatibility
 */

import { PortUtils } from './port';
import { createLogger } from './logger';
import { config } from './env';
import winston from 'winston';

/**
 * Port management configuration interface
 */
export interface PortManagerConfig {
  defaultPort: number;
  scanRangeStart: number;
  scanRangeEnd: number;
  maxRetries: number;
  retryDelay: number;
  reservationTimeout: number;
}

/**
 * Port reservation information
 */
export interface PortReservation {
  port: number;
  reservedAt: Date;
  reservedBy: string;
  expiresAt: Date;
  purpose: string;
}

/**
 * Port availability result
 */
export interface PortAvailabilityResult {
  port: number;
  available: boolean;
  reason?: string;
  alternativePort?: number;
  scanDuration: number;
}

/**
 * Production-grade port management with reservation and conflict resolution
 * Follows SRP: handles only port allocation and management concerns
 */
export class PortManager {
  private logger: winston.Logger;
  private config: PortManagerConfig;
  private reservations: Map<number, PortReservation> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(portConfig?: Partial<PortManagerConfig>) {
    this.logger = createLogger(config);

    // Production-optimized defaults
    this.config = {
      defaultPort: parseInt(process.env.PORT || '3000', 10),
      scanRangeStart: 8000,
      scanRangeEnd: 8099,
      maxRetries: 5,
      retryDelay: 100,
      reservationTimeout: 300000, // 5 minutes
      ...portConfig
    };

    this.startCleanupScheduler();
  }

  /**
   * Find an available port with production-grade conflict resolution
   * Integrates with existing PortUtils for Claude SDK compatibility
   */
  async findAvailablePort(preferredPort?: number): Promise<PortAvailabilityResult> {
    const startTime = Date.now();
    const targetPort = preferredPort || this.config.defaultPort;

    try {
      this.logger.debug(`Searching for available port starting from ${targetPort}`);

      // Check if preferred port is available and not reserved
      if (await this.isPortAvailableAndUnreserved(targetPort)) {
        const scanDuration = Date.now() - startTime;
        this.logger.info(`Port ${targetPort} is available (scan: ${scanDuration}ms)`);
        
        return {
          port: targetPort,
          available: true,
          scanDuration
        };
      }

      // Use existing PortUtils for Claude SDK compatibility
      this.logger.warn(`Port ${targetPort} is already in use. Finding alternative port...`);
      
      const alternativePort = await PortUtils.getNextAvailablePort(targetPort);
      const scanDuration = Date.now() - startTime;

      this.logger.info(`Alternative port found: ${alternativePort} (scan: ${scanDuration}ms)`);

      return {
        port: alternativePort,
        available: true,
        reason: `Port ${targetPort} was unavailable`,
        alternativePort,
        scanDuration
      };

    } catch (error) {
      const scanDuration = Date.now() - startTime;
      this.logger.error(`Port scanning failed: ${error}`);
      
      return {
        port: targetPort,
        available: false,
        reason: error instanceof Error ? error.message : 'Unknown port scanning error',
        scanDuration
      };
    }
  }

  /**
   * Reserve a port for production use
   * Prevents conflicts during deployment and scaling
   */
  async reservePort(port: number, purpose: string, reservedBy = 'production-server'): Promise<boolean> {
    try {
      // Check if port is available
      if (!await this.isPortAvailableAndUnreserved(port)) {
        this.logger.warn(`Cannot reserve port ${port}: already in use or reserved`);
        return false;
      }

      const reservation: PortReservation = {
        port,
        reservedAt: new Date(),
        reservedBy,
        expiresAt: new Date(Date.now() + this.config.reservationTimeout),
        purpose
      };

      this.reservations.set(port, reservation);
      this.logger.info(`Port ${port} reserved for ${purpose} by ${reservedBy}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Port reservation failed for ${port}: ${error}`);
      return false;
    }
  }

  /**
   * Release a port reservation
   */
  releasePort(port: number): boolean {
    if (this.reservations.has(port)) {
      const reservation = this.reservations.get(port)!;
      this.reservations.delete(port);
      this.logger.info(`Port ${port} released (was reserved for ${reservation.purpose})`);
      return true;
    }
    
    this.logger.debug(`Port ${port} was not reserved`);
    return false;
  }

  /**
   * Get all current port reservations
   */
  getReservations(): PortReservation[] {
    return Array.from(this.reservations.values());
  }

  /**
   * Check if a port is available and not reserved
   */
  private async isPortAvailableAndUnreserved(port: number): Promise<boolean> {
    // Check system availability using existing PortUtils
    const systemAvailable = await PortUtils.isPortAvailable(port);
    if (!systemAvailable) {
      return false;
    }

    // Check our reservations
    const reservation = this.reservations.get(port);
    if (reservation && reservation.expiresAt > new Date()) {
      this.logger.debug(`Port ${port} is reserved until ${reservation.expiresAt}`);
      return false;
    }

    return true;
  }

  /**
   * Validate port configuration for production
   */
  validatePortConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.defaultPort < 1 || this.config.defaultPort > 65535) {
      errors.push(`Invalid default port: ${this.config.defaultPort} (must be 1-65535)`);
    }

    if (this.config.scanRangeStart < 1 || this.config.scanRangeStart > 65535) {
      errors.push(`Invalid scan range start: ${this.config.scanRangeStart} (must be 1-65535)`);
    }

    if (this.config.scanRangeEnd < this.config.scanRangeStart || this.config.scanRangeEnd > 65535) {
      errors.push(`Invalid scan range end: ${this.config.scanRangeEnd} (must be >= start and <= 65535)`);
    }

    if (this.config.maxRetries < 1) {
      errors.push(`Invalid max retries: ${this.config.maxRetries} (must be >= 1)`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get port manager status for monitoring
   */
  getStatus(): {
    activeReservations: number;
    config: PortManagerConfig;
    nextCleanup: Date | null;
  } {
    return {
      activeReservations: this.reservations.size,
      config: { ...this.config },
      nextCleanup: this.cleanupInterval ? new Date(Date.now() + 60000) : null // Approximate
    };
  }

  /**
   * Start cleanup scheduler for expired reservations
   */
  private startCleanupScheduler(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredReservations();
    }, 60000); // Run every minute

    // Cleanup on process exit
    process.on('exit', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * Clean up expired port reservations
   */
  private cleanupExpiredReservations(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [port, reservation] of this.reservations.entries()) {
      if (reservation.expiresAt <= now) {
        this.reservations.delete(port);
        cleanedCount++;
        this.logger.debug(`Cleaned expired reservation for port ${port}`);
      }
    }

    if (cleanedCount > 0) {
      this.logger.info(`Cleaned ${cleanedCount} expired port reservations`);
    }
  }

  /**
   * Shutdown port manager and cleanup resources
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Release all reservations
    const activeReservations = this.reservations.size;
    this.reservations.clear();
    
    if (activeReservations > 0) {
      this.logger.info(`Released ${activeReservations} port reservations during shutdown`);
    }

    this.logger.debug('PortManager shutdown complete');
  }
}

// Production-ready singleton instance
export const portManager = new PortManager();

// Export utilities for easy access
export const findAvailablePort = (preferredPort?: number) => portManager.findAvailablePort(preferredPort);
export const reservePort = (port: number, purpose: string) => portManager.reservePort(port, purpose);
export const releasePort = (port: number) => portManager.releasePort(port);