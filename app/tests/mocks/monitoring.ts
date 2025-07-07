/**
 * Monitoring Mock Implementation
 * Provides mock monitoring objects for testing
 */

export function createMockHealthMonitor() {
  return {
    getStatus: jest.fn().mockResolvedValue({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: 1000,
      memory: {
        used: 100 * 1024 * 1024,
        total: 512 * 1024 * 1024
      },
      services: {
        auth: 'healthy',
        claude: 'healthy',
        session: 'healthy'
      }
    }),
    checkHealth: jest.fn().mockResolvedValue(true),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined)
  };
}

export function createMockPerformanceMonitor() {
  return {
    recordMetric: jest.fn(),
    getMetrics: jest.fn().mockReturnValue({
      requestCount: 100,
      averageResponseTime: 150,
      errorRate: 0.02,
      memoryUsage: 100 * 1024 * 1024
    }),
    startTimer: jest.fn().mockReturnValue(() => 150),
    recordRequestMetrics: jest.fn(),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined)
  };
}

export function createMockSystemMonitor() {
  return {
    getSystemInfo: jest.fn().mockReturnValue({
      platform: 'linux',
      arch: 'x64',
      nodeVersion: 'v18.0.0',
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime()
    }),
    monitor: jest.fn(),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined)
  };
}

export const mockMonitoring = {
  health: createMockHealthMonitor(),
  performance: createMockPerformanceMonitor(),
  system: createMockSystemMonitor()
};

export function resetMonitoringMocks() {
  Object.values(mockMonitoring).forEach(monitor => {
    Object.values(monitor).forEach(method => {
      if (jest.isMockFunction(method)) {
        method.mockClear();
      }
    });
  });
}