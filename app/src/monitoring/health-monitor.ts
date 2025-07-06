/**
 * Phase 16A: Minimal health monitoring for HTTP server
 * Server-side tool execution monitoring removed
 */

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
  };
}

export class HealthMonitor {
  static getStatus(): HealthStatus {
    const memUsage = process.memoryUsage();
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal
      }
    };
  }

  static async checkHealth(): Promise<HealthStatus> {
    return this.getStatus();
  }

  // Phase 16A: Additional compatibility methods
  static startHealthMonitoring(): void {
    // Minimal health monitoring start
    console.log('Health monitoring started');
  }

  shutdown(): void {
    // Cleanup health monitoring
    console.log('Health monitoring shutdown');
  }

  setActiveServerPort(port: number): void {
    // Track active server port
    console.log(`Active server port set to: ${port}`);
  }

  clearActiveServerPort(): void {
    // Clear active server port
    console.log('Active server port cleared');
  }

  getStatistics(): any {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      status: 'healthy'
    };
  }

  static getLatestHealthReport(): any {
    return this.getStatus();
  }
}

export const healthMonitor = new HealthMonitor();

// Export compatibility functions
export const startHealthMonitoring = HealthMonitor.startHealthMonitoring;
export const getLatestHealthReport = HealthMonitor.getLatestHealthReport;