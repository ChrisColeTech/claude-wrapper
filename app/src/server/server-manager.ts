/**
 * Server lifecycle management
 * Based on Python main.py server startup and port conflict resolution
 * Enhanced with production-grade features for Phase 3A
 * 
 * Single Responsibility: HTTP server lifecycle and port management
 */

import express from 'express';
import { Server } from 'http';
import winston from 'winston';
import { PortUtils } from '../utils/port';
import { productionConfig } from '../../config/production.config';

/**
 * Server startup result
 */
export interface ServerStartResult {
  server: Server;
  port: number;
  url: string;
  startupTime?: number;
  productionMode?: boolean;
}

/**
 * Production server configuration options
 */
export interface ProductionServerOptions {
  timeout?: number;
  keepAliveTimeout?: number;
  headersTimeout?: number;
  maxHeadersCount?: number;
  enableProductionOptimizations?: boolean;
}

/**
 * Server manager for handling server lifecycle
 * Enhanced with production-grade features while maintaining backward compatibility
 */
export class ServerManager {
  private logger: winston.Logger;
  private server?: Server;
  private productionOptions: ProductionServerOptions;
  private isProductionMode: boolean;

  constructor(logger: winston.Logger, productionOptions: ProductionServerOptions = {}) {
    this.logger = logger;
    this.productionOptions = {
      enableProductionOptimizations: process.env.NODE_ENV === 'production',
      ...productionOptions
    };
    this.isProductionMode = this.productionOptions.enableProductionOptimizations || false;
    
    if (this.isProductionMode) {
      this.logger.debug('ServerManager initialized in production mode');
    }
  }

  /**
   * Start Express server on available port (matches Python port conflict behavior)
   * Enhanced with production optimizations for Phase 3A
   * @param app Express application
   * @param preferredPort Preferred port number
   * @returns Promise resolving to server start result
   */
  async startServer(
    app: express.Application, 
    preferredPort: number
  ): Promise<ServerStartResult> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      try {
        if (this.isProductionMode) {
          this.logger.debug(`Starting production server on port ${preferredPort}...`);
        } else {
          console.log(`🚀 Starting server on port ${preferredPort}...`);
        }
        
        // Try preferred port first (matching Python behavior)
        const server = app.listen(preferredPort, () => {
          this.server = server;
          
          // Apply production optimizations if enabled
          if (this.isProductionMode) {
            this.applyProductionOptimizations(server);
          }
          
          const url = `http://localhost:${preferredPort}`;
          const startupTime = Date.now() - startTime;
          
          if (!this.isProductionMode) {
            console.log(`✅ Server listening on port ${preferredPort}`);
          }
          
          this.logger.info(`Server started successfully`, {
            port: preferredPort,
            url,
            preferredPort,
            startupTime,
            productionMode: this.isProductionMode
          });

          resolve({
            server,
            port: preferredPort,
            url,
            startupTime,
            productionMode: this.isProductionMode
          });
        });

        server.on('error', async (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE' || error.message.includes('address already in use')) {
            // Match Python behavior: warning + find alternative port
            this.logger.warn(`Port ${preferredPort} is already in use. Finding alternative port...`);
            
            try {
              const availablePort = await PortUtils.getNextAvailablePort(preferredPort + 1);
              
              const fallbackServer = app.listen(availablePort, () => {
                this.server = fallbackServer;
                
                // Apply production optimizations if enabled
                if (this.isProductionMode) {
                  this.applyProductionOptimizations(fallbackServer);
                }
                
                const url = `http://localhost:${availablePort}`;
                const startupTime = Date.now() - startTime;
                
                // Match Python user notification messages
                this.logger.info(`Starting server on alternative port ${availablePort}`);
                
                if (!this.isProductionMode) {
                  console.log(`\n🚀 Server starting on http://localhost:${availablePort}`);
                  console.log(`📝 Update your client base_url to: http://localhost:${availablePort}/v1`);
                }

                resolve({
                  server: fallbackServer,
                  port: availablePort,
                  url,
                  startupTime,
                  productionMode: this.isProductionMode
                });
              });

              fallbackServer.on('error', (fallbackError) => {
                this.logger.error('Fallback server startup error:', fallbackError);
                reject(fallbackError);
              });

            } catch (portError) {
              this.logger.error('No available ports found:', portError);
              reject(new Error(`No available ports found starting from ${preferredPort + 1}`));
            }
          } else {
            this.logger.error('Server startup error:', error);
            reject(error);
          }
        });

      } catch (error) {
        this.logger.error('Server creation error:', error);
        reject(error);
      }
    });
  }

  /**
   * Gracefully shutdown the server
   * Enhanced with production-grade cleanup for Phase 3A
   * @returns Promise resolving when server is closed
   */
  async shutdown(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve) => {
      const shutdownStart = Date.now();
      
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.server!.close(() => {
        const shutdownTime = Date.now() - shutdownStart;
        
        if (this.isProductionMode) {
          this.logger.info('Production server shutdown completed', { shutdownTime });
        } else {
          this.logger.info('Server shutdown completed');
        }
        
        this.server = undefined;
        resolve();
      });
    });
  }

  /**
   * Apply production optimizations to server instance
   * Configures timeouts and performance settings for production deployment
   * @param server HTTP server instance
   */
  private applyProductionOptimizations(server: Server): void {
    try {
      const serverConfig = productionConfig.getServerConfig();
      
      // Apply production timeout settings
      server.timeout = this.productionOptions.timeout || serverConfig.timeout;
      server.keepAliveTimeout = this.productionOptions.keepAliveTimeout || serverConfig.keepAliveTimeout;
      server.headersTimeout = this.productionOptions.headersTimeout || serverConfig.headersTimeout;
      
      // Set maximum headers count
      server.maxHeadersCount = this.productionOptions.maxHeadersCount || 100;
      
      this.logger.debug('Production optimizations applied', {
        timeout: server.timeout,
        keepAliveTimeout: server.keepAliveTimeout,
        headersTimeout: server.headersTimeout,
        maxHeadersCount: server.maxHeadersCount
      });
      
    } catch (error) {
      this.logger.warn('Failed to apply production optimizations:', error);
    }
  }

  /**
   * Get current server instance (for advanced usage)
   * @returns Current HTTP server instance or undefined
   */
  getServer(): Server | undefined {
    return this.server;
  }

  /**
   * Check if server is running
   * @returns True if server is currently running
   */
  isRunning(): boolean {
    return this.server !== undefined;
  }

  /**
   * Get production mode status
   * @returns True if running in production mode
   */
  isInProductionMode(): boolean {
    return this.isProductionMode;
  }
}