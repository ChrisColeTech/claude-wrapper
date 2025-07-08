import { IStreamingManager, StreamConnection } from '../types';
import { STREAMING_CONFIG } from '../config/constants';
import { logger } from '../utils/logger';

// Global registry to track all StreamingManager instances
const streamingManagerRegistry = new Set<StreamingManager>();

/**
 * Global cleanup function for all StreamingManager instances
 * Used primarily for test cleanup
 */
export function shutdownAllStreamingManagers(): void {
  for (const manager of streamingManagerRegistry) {
    manager.shutdown();
  }
  streamingManagerRegistry.clear();
}

/**
 * StreamingManager - Manages active streaming connections
 * Single Responsibility: Connection lifecycle management
 * Max 200 lines, functions under 50 lines (SOLID compliance)
 */
export class StreamingManager implements IStreamingManager {
  private activeConnections: Map<string, StreamConnection> = new Map();
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor() {
    // Register this instance globally for cleanup
    streamingManagerRegistry.add(this);
    this.startCleanupTimer();
  }

  /**
   * Create new streaming connection
   */
  createConnection(id: string, response: any): void {
    // Clean up existing connection if it exists
    if (this.activeConnections.has(id)) {
      this.closeConnection(id);
    }

    const connection: StreamConnection = {
      id,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true,
      response
    };

    this.activeConnections.set(id, connection);
    this.setupConnectionCleanup(id, response);
    
    logger.info('Streaming connection created', { 
      connectionId: id, 
      totalConnections: this.activeConnections.size 
    });
  }

  /**
   * Get existing connection
   */
  getConnection(id: string): StreamConnection | null {
    const connection = this.activeConnections.get(id);
    
    if (connection) {
      connection.lastActivity = new Date();
      return connection;
    }
    
    return null;
  }

  /**
   * Close streaming connection
   */
  closeConnection(id: string): boolean {
    const connection = this.activeConnections.get(id);
    
    if (connection) {
      connection.isActive = false;
      
      // Clear connection timeout if it exists
      const timeout = this.connectionTimeouts.get(id);
      if (timeout) {
        clearTimeout(timeout);
        this.connectionTimeouts.delete(id);
      }
      
      if (connection.response && !connection.response.headersSent) {
        try {
          connection.response.end();
        } catch (error) {
          logger.warn('Error closing connection response', error);
        }
      }
      
      this.activeConnections.delete(id);
      logger.info('Streaming connection closed', { 
        connectionId: id, 
        totalConnections: this.activeConnections.size 
      });
      
      return true;
    }
    
    return false;
  }

  /**
   * Get number of active connections
   */
  getActiveConnections(): number {
    return this.activeConnections.size;
  }

  /**
   * Cleanup stale connections
   */
  cleanup(): void {
    const now = new Date();
    const staleConnections: string[] = [];
    
    for (const [id, connection] of this.activeConnections) {
      const timeSinceActivity = now.getTime() - connection.lastActivity.getTime();
      
      if (timeSinceActivity > STREAMING_CONFIG.CONNECTION_TIMEOUT_MS) {
        staleConnections.push(id);
      }
    }
    
    for (const id of staleConnections) {
      this.closeConnection(id);
    }
    
    if (staleConnections.length > 0) {
      logger.info('Cleaned up stale streaming connections', { 
        count: staleConnections.length,
        remaining: this.activeConnections.size 
      });
    }
  }

  /**
   * Setup connection cleanup handlers
   */
  private setupConnectionCleanup(id: string, response: any): void {
    if (response) {
      // Handle client disconnect
      response.on('close', () => {
        logger.info('Client disconnected from stream', { connectionId: id });
        this.closeConnection(id);
      });

      // Handle errors
      response.on('error', (error: Error) => {
        logger.error('Streaming response error', error, { connectionId: id });
        this.closeConnection(id);
      });

      // Set connection timeout
      const timeout = setTimeout(() => {
        logger.warn('Streaming connection timeout', { connectionId: id });
        this.closeConnection(id);
      }, STREAMING_CONFIG.CONNECTION_TIMEOUT_MS);

      // Store timeout for cleanup
      this.connectionTimeouts.set(id, timeout);

      // Clear timeout if connection closes normally
      response.on('finish', () => {
        const timeout = this.connectionTimeouts.get(id);
        if (timeout) {
          clearTimeout(timeout);
          this.connectionTimeouts.delete(id);
        }
      });
    }
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, STREAMING_CONFIG.HEARTBEAT_INTERVAL_MS);
  }


  /**
   * Shutdown manager and cleanup resources
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Clear all connection timeouts
    for (const timeout of this.connectionTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.connectionTimeouts.clear();

    // Close all active connections
    for (const id of this.activeConnections.keys()) {
      this.closeConnection(id);
    }

    // Remove from global registry
    streamingManagerRegistry.delete(this);

    logger.info('StreamingManager shutdown complete');
  }
}