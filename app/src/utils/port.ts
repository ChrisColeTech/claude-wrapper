/**
 * Port availability detection utilities
 * Based on Python main.py:835-851
 * 
 * Single Responsibility: Port availability checking and detection
 */

import { createServer } from 'node:net';

/**
 * Port validation constants
 */
const PORT_MIN = 1;
const PORT_MAX = 65535;
const DEFAULT_PORT_RANGE = 100;
const DEFAULT_MAX_RETRIES = 10;
const DEFAULT_MAX_TRIES = 50;

/**
 * Port availability check result
 */
export interface PortCheckResult {
  port: number;
  available: boolean;
  error?: string;
}

/**
 * Port range configuration
 */
export interface PortRange {
  start: number;
  end: number;
}

/**
 * Error thrown when no available port is found
 */
export class PortUnavailableError extends Error {
  constructor(range: PortRange) {
    super(`No available port found in range ${range.start}-${range.end}`);
    this.name = 'PortUnavailableError';
  }
}

/**
 * Check if a specific port is available
 * @param port Port number to check
 * @returns Promise resolving to port check result
 */
export async function checkPortAvailability(port: number): Promise<PortCheckResult> {
  return new Promise((resolve) => {
    const server = createServer();
    
    server.listen(port, () => {
      server.close(() => {
        resolve({
          port,
          available: true
        });
      });
    });
    
    server.on('error', (error: NodeJS.ErrnoException) => {
      resolve({
        port,
        available: false,
        error: error.message
      });
    });
  });
}

/**
 * Find the first available port in a range
 * @param startPort Starting port number
 * @param endPort Ending port number (default: startPort + 100)
 * @returns Promise resolving to first available port
 */
export async function findAvailablePort(
  startPort: number, 
  endPort = startPort + DEFAULT_PORT_RANGE
): Promise<number> {
  for (let port = startPort; port <= endPort; port++) {
    const result = await checkPortAvailability(port);
    if (result.available) {
      return port;
    }
  }
  
  throw new PortUnavailableError({ start: startPort, end: endPort });
}

/**
 * Find available port with retry logic
 * @param preferredPort Preferred port number
 * @param maxRetries Maximum number of ports to try
 * @returns Promise resolving to available port
 */
export async function findAvailablePortWithRetry(
  preferredPort: number,
  maxRetries = DEFAULT_MAX_RETRIES
): Promise<number> {
  const result = await checkPortAvailability(preferredPort);
  
  if (result.available) {
    return preferredPort;
  }
  
  // Try sequential ports after preferred port
  return findAvailablePort(preferredPort + 1, preferredPort + maxRetries);
}

/**
 * Validate port number is within valid range
 * @param port Port number to validate
 * @returns True if port is valid
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= PORT_MIN && port <= PORT_MAX;
}

/**
 * Port utilities class for organized port operations
 */
export class PortUtils {
  /**
   * Check if port is available
   * @param port Port number to check
   * @returns Promise resolving to availability status
   */
  static async isPortAvailable(port: number): Promise<boolean> {
    if (!isValidPort(port)) {
      return false;
    }
    
    const result = await checkPortAvailability(port);
    return result.available;
  }

  /**
   * Get next available port starting from specified port
   * @param startPort Starting port number
   * @param maxTries Maximum number of ports to try
   * @returns Promise resolving to available port
   */
  static async getNextAvailablePort(
    startPort: number, 
    maxTries = DEFAULT_MAX_TRIES
  ): Promise<number> {
    if (!isValidPort(startPort)) {
      throw new Error(`Invalid port number: ${startPort}`);
    }
    
    return findAvailablePortWithRetry(startPort, maxTries);
  }
}
