/**
 * Production Server Manager
 * Handles production server lifecycle management with enhanced startup and shutdown
 * 
 * Single Responsibility: Production server lifecycle operations
 * Integrates with existing ServerManager for Claude SDK compatibility
 */

import express from 'express';
import { Server } from 'http';
import winston from 'winston';
import { ServerManager } from './server-manager';
import { portManager, PortAvailabilityResult } from '../utils/port-manager';
import { createLogger } from '../utils/logger';
import { config } from '../utils/env';
import { productionConfig } from '../../config/production.config';
import { healthMonitor } from '../monitoring/health-monitor';

/**
 * Production server configuration interface
 */
export interface ProductionServerConfig {
  port: number;
  host: string;
  timeout: number;
  gracefulShutdownTimeout: number;
  maxStartupAttempts: number;
  startupRetryDelay: number;
  healthCheckEnabled: boolean;
  preflightChecks: boolean;
}

/**
 * Server startup result information
 */
export interface ServerStartupResult {
  success: boolean;
  server?: Server;
  port?: number;
  url?: string;
  startupTime: number;
  portResolution?: PortAvailabilityResult;
  healthCheckUrl?: string;
  errors?: string[];
}

/**
 * Server shutdown result information
 */
export interface ServerShutdownResult {
  success: boolean;
  shutdownTime: number;
  errors?: string[];
  resourcesReleased: string[];
}

/**
 * Server health status
 */
export interface ServerHealthStatus {
  status: 'healthy' | 'unhealthy' | 'starting' | 'stopping';
  uptime: number;
  port: number;
  lastHealthCheck: Date;
  errors: string[];
}

/**
 * Production-grade server lifecycle manager
 * Follows SRP: handles only production server lifecycle concerns
 */
export class ProductionServerManager {
  private logger: winston.Logger;
  private config: ProductionServerConfig;
  private serverManager: ServerManager;
  private currentServer: Server | null = null;
  private currentPort: number | null = null;
  private isShuttingDown = false;
  private startupTime: Date | null = null;
  private shutdownHandlers: (() => Promise<void>)[] = [];
  private signalHandlers: { [signal: string]: (() => void) } = {};

  constructor(serverConfig?: Partial<ProductionServerConfig>) {
    try {
      this.logger = createLogger(config);
    } catch (error) {
      console.warn('Failed to create logger:', error instanceof Error ? error.message : String(error));
      console.warn('ProductionServerManager will continue with fallback logging');
      // Create a fallback console logger
      this.logger = {
        debug: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error
      } as winston.Logger;
    }

    this.config = {
      port: productionConfig.getServerConfig().port,
      host: productionConfig.getServerConfig().host,
      timeout: productionConfig.getServerConfig().timeout,
      gracefulShutdownTimeout: 10000, // 10 seconds
      maxStartupAttempts: 3,
      startupRetryDelay: 1000,
      healthCheckEnabled: productionConfig.getMonitoringConfig().healthCheckEnabled,
      preflightChecks: true,
      ...serverConfig
    };

    this.serverManager = new ServerManager(this.logger);
    this.setupSignalHandlers();
  }

  /**
   * Start production server with comprehensive validation and health checks
   */
  async startServer(app: express.Application, preferredPort?: number): Promise<ServerStartupResult> {
    const startTime = Date.now();
    const targetPort = preferredPort || this.config.port;

    try {
      this.safeLog('info', 'Starting production server...');

      // Preflight checks
      if (this.config.preflightChecks) {
        await this.runPreflightChecks(app);
      }

      // Port resolution with production-grade conflict handling
      const portResult = await portManager.findAvailablePort(targetPort);
      if (!portResult.available) {
        throw new Error(`No available ports found: ${portResult.reason}`);
      }

      // Reserve the port to prevent conflicts during startup
      await portManager.reservePort(portResult.port, 'production-server', 'ProductionServerManager');

      let startupResult: ServerStartupResult;
      let lastError: Error | null = null;

      // Attempt startup with retries
      for (let attempt = 1; attempt <= this.config.maxStartupAttempts; attempt++) {
        try {
          this.safeLog('debug', `Server startup attempt ${attempt}/${this.config.maxStartupAttempts} on port ${portResult.port}`);

          const serverResult = await this.serverManager.startServer(app, portResult.port);
          
          // Configure production server settings
          await this.configureProductionServer(serverResult.server, portResult.port);

          this.currentServer = serverResult.server;
          this.currentPort = portResult.port;
          this.startupTime = new Date();

          // Update health monitor with active server port
          healthMonitor.setActiveServerPort(portResult.port);

          const startupTime = Date.now() - startTime;
          
          // Show user-friendly startup messages
          console.log(`\n🚀 Server starting on http://localhost:${portResult.port}`);
          console.log(`📝 Update your client base_url to: http://localhost:${portResult.port}/v1`);

          this.safeLog('info', `Production server started successfully on port ${portResult.port} (startup: ${startupTime}ms)`);

          startupResult = {
            success: true,
            server: serverResult.server,
            port: portResult.port,
            url: serverResult.url,
            startupTime,
            portResolution: portResult,
            healthCheckUrl: this.config.healthCheckEnabled ? `${serverResult.url}/health` : undefined
          };

          break;

        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          this.safeLog('warn', `Server startup attempt ${attempt} failed: ${lastError.message}`);
          
          if (attempt < this.config.maxStartupAttempts) {
            await this.delay(this.config.startupRetryDelay);
          }
        }
      }

      // If all attempts failed
      if (!startupResult!) {
        portManager.releasePort(portResult.port);
        throw lastError || new Error('Server startup failed after all attempts');
      }

      return startupResult;

    } catch (error) {
      const startupTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.safeLog('error', `Production server startup failed: ${errorMessage} (attempt duration: ${startupTime}ms)`);

      return {
        success: false,
        startupTime,
        errors: [errorMessage]
      };
    }
  }

  /**
   * Graceful server shutdown with proper cleanup
   */
  async shutdown(): Promise<ServerShutdownResult> {
    const startTime = Date.now();
    const resourcesReleased: string[] = [];

    if (this.isShuttingDown) {
      this.safeLog('debug', 'Shutdown already in progress');
      return {
        success: true,
        shutdownTime: 0,
        resourcesReleased: ['shutdown-already-in-progress']
      };
    }

    this.isShuttingDown = true;
    this.safeLog('info', 'Initiating graceful server shutdown...');

    try {
      // Run custom shutdown handlers
      for (const handler of this.shutdownHandlers) {
        try {
          await handler();
          resourcesReleased.push('custom-handler');
        } catch (error) {
          this.safeLog('warn', `Shutdown handler failed: ${error}`);
        }
      }

      // Shutdown server with timeout
      if (this.currentServer) {
        await this.shutdownServerWithTimeout(this.currentServer);
        resourcesReleased.push('http-server');
      }

      // Release port reservation
      if (this.currentPort) {
        portManager.releasePort(this.currentPort);
        resourcesReleased.push(`port-${this.currentPort}`);
      }

      // Shutdown server manager
      if (this.serverManager) {
        await this.serverManager.shutdown();
        resourcesReleased.push('server-manager');
      }

      // Remove signal handlers to prevent memory leaks
      this.removeSignalHandlers();
      resourcesReleased.push('signal-handlers');

      // Clear active server port from health monitor
      healthMonitor.clearActiveServerPort();

      const shutdownTime = Date.now() - startTime;
      this.safeLog('info', `Production server shutdown completed (${shutdownTime}ms, resources: ${resourcesReleased.join(', ')})`);

      this.currentServer = null;
      this.currentPort = null;
      this.startupTime = null;
      this.isShuttingDown = false;

      return {
        success: true,
        shutdownTime,
        resourcesReleased
      };

    } catch (error) {
      const shutdownTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.safeLog('error', `Production server shutdown failed: ${errorMessage} (duration: ${shutdownTime}ms)`);

      return {
        success: false,
        shutdownTime,
        errors: [errorMessage],
        resourcesReleased
      };
    }
  }

  /**
   * Get current server health status
   */
  getHealthStatus(): ServerHealthStatus {
    if (!this.currentServer || !this.startupTime) {
      return {
        status: 'unhealthy',
        uptime: 0,
        port: this.currentPort || 0,
        lastHealthCheck: new Date(),
        errors: ['Server not running']
      };
    }

    if (this.isShuttingDown) {
      return {
        status: 'stopping',
        uptime: Date.now() - this.startupTime.getTime(),
        port: this.currentPort!,
        lastHealthCheck: new Date(),
        errors: []
      };
    }

    return {
      status: 'healthy',
      uptime: Date.now() - this.startupTime.getTime(),
      port: this.currentPort!,
      lastHealthCheck: new Date(),
      errors: []
    };
  }

  /**
   * Add custom shutdown handler
   */
  addShutdownHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  /**
   * Remove signal handlers to prevent memory leaks
   */
  private removeSignalHandlers(): void {
    Object.entries(this.signalHandlers).forEach(([signal, handler]) => {
      process.removeListener(signal, handler);
    });
    this.signalHandlers = {};
  }

  /**
   * Check if server is currently running
   */
  isRunning(): boolean {
    return this.currentServer !== null && !this.isShuttingDown;
  }

  /**
   * Check if logger is available
   */
  hasLogger(): boolean {
    return this.logger !== null;
  }

  /**
   * Safe logging method 
   */
  private safeLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    this.logger[level](message, ...args);
  }

  /**
   * Run preflight checks before server startup
   */
  private async runPreflightChecks(app: express.Application): Promise<void> {
    this.safeLog('debug', 'Running preflight checks...');

    // Validate app configuration
    if (!app || typeof app.listen !== 'function') {
      throw new Error('Invalid Express application provided');
    }

    // Validate production configuration
    const configValidation = productionConfig.getConfigSummary();
    this.safeLog('debug', 'Production config validation:', configValidation);

    // Check port manager status
    const portManagerStatus = portManager.getStatus();
    this.safeLog('debug', 'Port manager status:', portManagerStatus);

    this.safeLog('debug', 'Preflight checks completed successfully');
  }

  /**
   * Configure production server with optimized settings
   */
  private async configureProductionServer(server: Server, port: number): Promise<void> {
    // Set production timeouts
    server.timeout = this.config.timeout;
    server.keepAliveTimeout = productionConfig.getServerConfig().keepAliveTimeout;
    server.headersTimeout = productionConfig.getServerConfig().headersTimeout;

    // Configure maximum header size
    server.maxHeadersCount = 100;

    this.safeLog('debug', `Production server configured for port ${port}`);
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      const handler = async () => {
        this.safeLog('info', `Received ${signal}, initiating graceful shutdown...`);
        await this.shutdown();
        process.exit(0);
      };
      
      this.signalHandlers[signal] = handler;
      process.on(signal, handler);
    });
  }

  /**
   * Shutdown server with timeout protection
   */
  private async shutdownServerWithTimeout(server: Server): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Server shutdown timeout after ${this.config.gracefulShutdownTimeout}ms`));
      }, this.config.gracefulShutdownTimeout);

      server.close((error) => {
        clearTimeout(timeout);
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export production server manager factory
export const createProductionServerManager = (config?: Partial<ProductionServerConfig>) =>
  new ProductionServerManager(config);