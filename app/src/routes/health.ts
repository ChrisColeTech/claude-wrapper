/**
 * Health endpoint implementation
 * Based on Python main.py:680-683 health_check endpoint
 * Implements Phase 11A health check requirements
 */

import { Router, Request, Response } from 'express';
import { getLogger } from '../utils/logger';

const logger = getLogger('HealthRouter');

/**
 * Health check response interface
 * Based on Python health check response format
 */
export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  service: string;
  version?: string;
  timestamp?: string;
  uptime?: number;
}

/**
 * Enhanced health response with detailed information
 */
export interface DetailedHealthResponse extends HealthResponse {
  details: {
    server: 'running' | 'starting' | 'stopping';
    authentication: 'configured' | 'not_configured';
    memory_usage: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

/**
 * Health router class implementing health check endpoints
 * Based on Python health_check endpoint
 */
export class HealthRouter {
  private static startTime: number = Date.now();

  /**
   * Create Express router with health endpoints
   */
  static createRouter(): Router {
    const router = Router();

    // GET /health - Basic health check
    router.get('/health', this.basicHealthCheck.bind(this));
    
    // GET /health/detailed - Detailed health check
    router.get('/health/detailed', this.detailedHealthCheck.bind(this));

    return router;
  }

  /**
   * Basic health check endpoint
   * Based on Python main.py:680-683 health_check function
   */
  static async basicHealthCheck(_req: Request, res: Response): Promise<void> {
    try {
      logger.debug('Basic health check requested');

      const response: HealthResponse = {
        status: 'healthy',
        service: 'claude-code-openai-wrapper'
      };

      logger.debug('Health check: healthy');
      res.json(response);
    } catch (error) {
      logger.error('Error in basic health check:', error);
      res.status(503).json({
        status: 'unhealthy',
        service: 'claude-code-openai-wrapper',
        error: 'Health check failed'
      });
    }
  }

  /**
   * Detailed health check endpoint with system information
   * Enhanced version providing more diagnostic information
   */
  static async detailedHealthCheck(_req: Request, res: Response): Promise<void> {
    try {
      logger.debug('Detailed health check requested');

      const memoryUsage = process.memoryUsage();
      const uptime = Date.now() - this.startTime;

      const response: DetailedHealthResponse = {
        status: 'healthy',
        service: 'claude-code-openai-wrapper',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime,
        details: {
          server: 'running',
          authentication: this.checkAuthenticationStatus(),
          memory_usage: {
            used: memoryUsage.heapUsed,
            total: memoryUsage.heapTotal,
            percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
          }
        }
      };

      logger.debug('Detailed health check: healthy', {
        uptime,
        memoryUsage: response.details.memory_usage
      });
      
      res.json(response);
    } catch (error) {
      logger.error('Error in detailed health check:', error);
      res.status(503).json({
        status: 'unhealthy',
        service: 'claude-code-openai-wrapper',
        error: 'Detailed health check failed'
      });
    }
  }

  /**
   * Check authentication configuration status
   * Returns 'configured' if auth is available, 'not_configured' otherwise
   */
  private static checkAuthenticationStatus(): 'configured' | 'not_configured' {
    // Check for common authentication environment variables
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    const hasClaudeConfig = !!process.env.CLAUDE_CONFIG_DIR;
    const hasAwsConfig = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    const hasGcpConfig = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

    return (hasAnthropicKey || hasClaudeConfig || hasAwsConfig || hasGcpConfig) 
      ? 'configured' 
      : 'not_configured';
  }

  /**
   * Set server start time (called during initialization)
   */
  static setStartTime(startTime: number): void {
    this.startTime = startTime;
  }

  /**
   * Get current server uptime in milliseconds
   */
  static getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Check if server is healthy
   * Can be used internally for health status checks
   */
  static isHealthy(): boolean {
    try {
      // Basic health checks
      const memoryUsage = process.memoryUsage();
      const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      
      // Consider unhealthy if memory usage is above 90%
      if (memoryPercentage > 90) {
        logger.warn(`High memory usage: ${memoryPercentage.toFixed(1)}%`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error checking health status:', error);
      return false;
    }
  }
}

export default HealthRouter;