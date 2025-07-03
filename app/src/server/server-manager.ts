/**
 * Server lifecycle management
 * Based on Python main.py server startup and port conflict resolution
 * 
 * Single Responsibility: HTTP server lifecycle and port management
 */

import express from 'express';
import { Server } from 'http';
import winston from 'winston';
import { PortUtils } from '../utils/port';

/**
 * Server startup result
 */
export interface ServerStartResult {
  server: Server;
  port: number;
  url: string;
}

/**
 * Server manager for handling server lifecycle
 */
export class ServerManager {
  private logger: winston.Logger;
  private server?: Server;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  /**
   * Start Express server on available port (matches Python port conflict behavior)
   * @param app Express application
   * @param preferredPort Preferred port number
   * @returns Promise resolving to server start result
   */
  async startServer(
    app: express.Application, 
    preferredPort: number
  ): Promise<ServerStartResult> {
    return new Promise((resolve, reject) => {
      try {
        // Try preferred port first (matching Python behavior)
        const server = app.listen(preferredPort, () => {
          this.server = server;
          const url = `http://localhost:${preferredPort}`;
          
          this.logger.info(`Server started successfully`, {
            port: preferredPort,
            url,
            preferredPort
          });

          resolve({
            server,
            port: preferredPort,
            url
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
                const url = `http://localhost:${availablePort}`;
                
                // Match Python user notification messages
                this.logger.info(`Starting server on alternative port ${availablePort}`);
                console.log(`\n🚀 Server starting on http://localhost:${availablePort}`);
                console.log(`📝 Update your client base_url to: http://localhost:${availablePort}/v1`);

                resolve({
                  server: fallbackServer,
                  port: availablePort,
                  url
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
   * @returns Promise resolving when server is closed
   */
  async shutdown(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.server!.close(() => {
        this.logger.info('Server shutdown completed');
        resolve();
      });
    });
  }
}