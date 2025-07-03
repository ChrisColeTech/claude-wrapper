/**
 * Test suite for Port Utilities
 * Tests for src/utils/port.ts components
 */

import { 
  checkPortAvailability, 
  findAvailablePort, 
  findAvailablePortWithRetry,
  isValidPort,
  PortUtils,
  PortUnavailableError
} from '../../../src/utils/port';
import { createServer } from 'node:net';

describe('Port Utilities', () => {
  describe('isValidPort', () => {
    it('should return true for valid port numbers', () => {
      expect(isValidPort(1)).toBe(true);
      expect(isValidPort(8000)).toBe(true);
      expect(isValidPort(65535)).toBe(true);
    });

    it('should return false for invalid port numbers', () => {
      expect(isValidPort(0)).toBe(false);
      expect(isValidPort(65536)).toBe(false);
      expect(isValidPort(-1)).toBe(false);
      expect(isValidPort(1.5)).toBe(false);
    });

    it('should return false for non-integer values', () => {
      expect(isValidPort(NaN)).toBe(false);
      expect(isValidPort(Infinity)).toBe(false);
    });
  });

  describe('checkPortAvailability', () => {
    it('should return available=true for free port', async () => {
      // Use a high port number that's likely to be free
      const port = 58000 + Math.floor(Math.random() * 1000);
      const result = await checkPortAvailability(port);
      
      expect(result.port).toBe(port);
      expect(result.available).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return available=false for occupied port', async () => {
      // Create a server to occupy a port
      const server = createServer();
      const port = 58100 + Math.floor(Math.random() * 100);
      
      await new Promise<void>((resolve) => {
        server.listen(port, resolve);
      });

      try {
        const result = await checkPortAvailability(port);
        
        expect(result.port).toBe(port);
        expect(result.available).toBe(false);
        expect(result.error).toBeDefined();
      } finally {
        await new Promise<void>((resolve) => {
          server.close(() => resolve());
        });
      }
    });
  });

  describe('findAvailablePort', () => {
    it('should find available port in range', async () => {
      const startPort = 58200 + Math.floor(Math.random() * 100);
      const endPort = startPort + 10;
      
      const port = await findAvailablePort(startPort, endPort);
      
      expect(port).toBeGreaterThanOrEqual(startPort);
      expect(port).toBeLessThanOrEqual(endPort);
      expect(isValidPort(port)).toBe(true);
    });

    it('should throw PortUnavailableError when no ports available', async () => {
      // Create servers to occupy a range of ports
      const startPort = 58300;
      const endPort = startPort + 2;
      const servers = [];

      try {
        // Occupy all ports in range
        for (let port = startPort; port <= endPort; port++) {
          const server = createServer();
          await new Promise<void>((resolve) => {
            server.listen(port, resolve);
          });
          servers.push(server);
        }

        // Should throw error when all ports occupied
        await expect(findAvailablePort(startPort, endPort))
          .rejects.toThrow(PortUnavailableError);

      } finally {
        // Clean up servers
        await Promise.all(servers.map(server => 
          new Promise<void>((resolve) => server.close(() => resolve()))
        ));
      }
    });

    it('should use default range when endPort not specified', async () => {
      const startPort = 58400;
      const port = await findAvailablePort(startPort);
      
      expect(port).toBeGreaterThanOrEqual(startPort);
      expect(port).toBeLessThanOrEqual(startPort + 100); // DEFAULT_PORT_RANGE
    });
  });

  describe('findAvailablePortWithRetry', () => {
    it('should return preferred port when available', async () => {
      const preferredPort = 58500 + Math.floor(Math.random() * 100);
      const port = await findAvailablePortWithRetry(preferredPort);
      
      expect(port).toBe(preferredPort);
    });

    it('should find alternative port when preferred is occupied', async () => {
      const preferredPort = 58600;
      const server = createServer();
      
      await new Promise<void>((resolve) => {
        server.listen(preferredPort, resolve);
      });

      try {
        const port = await findAvailablePortWithRetry(preferredPort, 5);
        
        expect(port).toBeGreaterThan(preferredPort);
        expect(port).toBeLessThanOrEqual(preferredPort + 5);
      } finally {
        await new Promise<void>((resolve) => {
          server.close(() => resolve());
        });
      }
    });
  });

  describe('PortUnavailableError', () => {
    it('should create error with correct message', () => {
      const range = { start: 8000, end: 8010 };
      const error = new PortUnavailableError(range);
      
      expect(error.message).toBe('No available port found in range 8000-8010');
      expect(error.name).toBe('PortUnavailableError');
    });
  });

  describe('PortUtils', () => {
    describe('isPortAvailable', () => {
      it('should return false for invalid port', async () => {
        const result = await PortUtils.isPortAvailable(0);
        expect(result).toBe(false);
      });

      it('should return true for valid available port', async () => {
        const port = 58700 + Math.floor(Math.random() * 100);
        const result = await PortUtils.isPortAvailable(port);
        expect(result).toBe(true);
      });
    });

    describe('getNextAvailablePort', () => {
      it('should throw error for invalid start port', async () => {
        await expect(PortUtils.getNextAvailablePort(0))
          .rejects.toThrow('Invalid port number: 0');
      });

      it('should find available port from valid start port', async () => {
        const startPort = 58800;
        const port = await PortUtils.getNextAvailablePort(startPort, 10);
        
        expect(port).toBeGreaterThanOrEqual(startPort);
        expect(isValidPort(port)).toBe(true);
      });
    });
  });
});