/**
 * Server Port Conflict Resolution Tests
 * Tests ensuring port conflict behavior matches Python main.py exactly
 */

import { createApp, ServerManager } from '../../src/server';
import { config } from '../../src/utils/env';
import { createLogger } from '../../src/utils/logger';
import express from 'express';

// Mock console to capture Python-compatible output
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('Server Port Conflict Resolution', () => {
  let app: express.Application;
  let logger: any;
  let serverManager: ServerManager;
  let conflictServer: any;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp(config);
    logger = createLogger(config);
    serverManager = new ServerManager(logger);
  });

  afterEach(async () => {
    // Clean up any running servers
    if (conflictServer) {
      await new Promise<void>((resolve) => {
        conflictServer.close(() => resolve());
      });
      conflictServer = null;
    }
    
    if (serverManager) {
      await serverManager.shutdown();
    }
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('Python Port Conflict Behavior', () => {
    it('should start on preferred port when available', async () => {
      const preferredPort = 8123; // Use unusual port to avoid conflicts
      
      const result = await serverManager.startServer(app, preferredPort);
      
      expect(result.port).toBe(preferredPort);
      expect(result.url).toBe(`http://localhost:${preferredPort}`);
      
      // Should not show fallback messages when preferred port works
      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        expect.stringMatching(/🚀 Server starting on/)
      );
    }, 10000);

    it('should handle port conflict like Python with exact messages', async () => {
      const conflictPort = 8124; // Use unusual port to avoid conflicts
      
      // Create a server on the conflict port first
      conflictServer = express().listen(conflictPort);
      
      // Wait for conflict server to be ready
      await new Promise<void>((resolve) => {
        conflictServer.on('listening', () => resolve());
      });
      
      // Now try to start our server on the same port
      const result = await serverManager.startServer(app, conflictPort);
      
      // Should get a different port
      expect(result.port).not.toBe(conflictPort);
      expect(result.port).toBeGreaterThan(conflictPort);
      
      // Should show Python-compatible fallback messages
      expect(mockConsoleLog).toHaveBeenCalledWith(
        `\n🚀 Server starting on http://localhost:${result.port}`
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        `📝 Update your client base_url to: http://localhost:${result.port}/v1`
      );
    }, 15000);

    it('should log Python-compatible warning messages for port conflicts', async () => {
      const conflictPort = 8125;
      
      // Create conflict server
      conflictServer = express().listen(conflictPort);
      await new Promise<void>((resolve) => {
        conflictServer.on('listening', () => resolve());
      });
      
      // Mock logger to capture warning
      const mockLoggerWarn = jest.spyOn(logger, 'warn');
      const mockLoggerInfo = jest.spyOn(logger, 'info');
      
      const result = await serverManager.startServer(app, conflictPort);
      
      // Should log exact Python-compatible messages
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        `Port ${conflictPort} is already in use. Finding alternative port...`
      );
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        `Starting server on alternative port ${result.port}`
      );
      
      mockLoggerWarn.mockRestore();
      mockLoggerInfo.mockRestore();
    }, 15000);

    it('should find next available port sequentially like Python', async () => {
      const startPort = 8126;
      const numConflicts = 3;
      const conflictServers: any[] = [];
      
      try {
        // Create multiple conflict servers
        for (let i = 0; i < numConflicts; i++) {
          const server = express().listen(startPort + i);
          conflictServers.push(server);
          await new Promise<void>((resolve) => {
            server.on('listening', () => resolve());
          });
        }
        
        // Try to start on the first conflict port
        const result = await serverManager.startServer(app, startPort);
        
        // Should get the next available port (startPort + numConflicts)
        expect(result.port).toBe(startPort + numConflicts);
        
      } finally {
        // Clean up conflict servers
        for (const server of conflictServers) {
          await new Promise<void>((resolve) => {
            server.close(() => resolve());
          });
        }
      }
    }, 20000);

    it('should handle rapid port conflicts gracefully', async () => {
      const basePort = 8130;
      const servers: any[] = [];
      
      try {
        // Start multiple servers rapidly to test conflict resolution
        const startPromises = Array.from({ length: 5 }, async (_, i) => {
          const mgr = new ServerManager(logger);
          const testApp = createApp(config);
          return mgr.startServer(testApp, basePort);
        });
        
        const results = await Promise.all(startPromises);
        
        // All servers should start on different ports
        const ports = results.map(r => r.port);
        const uniquePorts = new Set(ports);
        expect(uniquePorts.size).toBe(ports.length);
        
        // All ports should be >= basePort
        ports.forEach(port => {
          expect(port).toBeGreaterThanOrEqual(basePort);
        });
        
        // Clean up
        for (const result of results) {
          await new Promise<void>((resolve) => {
            result.server.close(() => resolve());
          });
        }
        
      } finally {
        // Ensure cleanup
        for (const server of servers) {
          try {
            await new Promise<void>((resolve) => {
              server.close(() => resolve());
            });
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      }
    }, 30000);
  });

  describe('Python Error Handling Compatibility', () => {
    it('should reject when no ports available in reasonable range', async () => {
      // Create a server on the target port to force initial conflict
      const blockingServer = app.listen(8200);
      
      try {
        // Mock port availability by importing and mocking directly
        const { PortUtils } = require('../../src/utils/port');
        const originalGetNextAvailablePort = PortUtils.getNextAvailablePort;
        
        PortUtils.getNextAvailablePort = jest.fn().mockRejectedValue(
          new Error('No available ports found starting from 8201')
        );
        
        try {
          const { ServerManager } = require('../../src/server');
          const manager = new ServerManager(logger);
          
          await expect(
            manager.startServer(app, 8200)
          ).rejects.toThrow('No available ports found starting from 8201');
        } finally {
          // Restore original function
          PortUtils.getNextAvailablePort = originalGetNextAvailablePort;
        }
      } finally {
        // Clean up blocking server
        await new Promise<void>((resolve) => {
          blockingServer.close(() => resolve());
        });
      }
    });

    it('should handle non-EADDRINUSE errors correctly', async () => {
      // Create an app that will cause a different error
      const badApp = express();
      badApp.listen = jest.fn().mockImplementation((port, callback) => {
        const server = {
          on: jest.fn().mockImplementation((event, handler) => {
            if (event === 'error') {
              // Simulate a non-port-conflict error
              setTimeout(() => handler(new Error('Some other error')), 10);
            }
          })
        };
        return server;
      });
      
      await expect(
        serverManager.startServer(badApp as any, 8300)
      ).rejects.toThrow('Some other error');
    });
  });

  describe('Python Logging Output Compatibility', () => {
    it('should produce exact Python-compatible user messages', async () => {
      const conflictPort = 8127;
      
      conflictServer = express().listen(conflictPort);
      await new Promise<void>((resolve) => {
        conflictServer.on('listening', () => resolve());
      });
      
      const result = await serverManager.startServer(app, conflictPort);
      
      // Verify exact message format matches Python
      expect(mockConsoleLog).toHaveBeenCalledWith(
        `\n🚀 Server starting on http://localhost:${result.port}`
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        `📝 Update your client base_url to: http://localhost:${result.port}/v1`
      );
    }, 15000);
  });
});