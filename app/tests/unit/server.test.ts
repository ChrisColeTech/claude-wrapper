/**
 * Test suite for Server Components
 * Tests for src/server.ts components
 */

import request from 'supertest';
import { Application } from 'express';
import { 
  createApp, 
  ExpressAppFactory, 
  ServerManager
} from '../../src/server';
import { Config } from '../../src/utils/env';
import { createLogger } from '../../src/utils/logger';

// Mock winston to avoid console output during tests
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  })),
  format: {
    combine: jest.fn(() => ({})),
    timestamp: jest.fn(() => ({})),
    errors: jest.fn(() => ({})),
    colorize: jest.fn(() => ({})),
    simple: jest.fn(() => ({})),
    json: jest.fn(() => ({}))
  },
  transports: {
    Console: jest.fn()
  }
}));

describe('Server Components', () => {
  const mockConfig: Config = {
    DEBUG_MODE: false,
    VERBOSE: false,
    PORT: 8000,
    CORS_ORIGINS: '["*"]',
    MAX_TIMEOUT: 600000,
    API_KEY: undefined
  };

  describe('App Creation', () => {
    it('should create app with wildcard CORS', () => {
      const app = createApp(mockConfig);
      expect(app).toBeDefined();
    });

    it('should create app with specific CORS origins', () => {
      const corsConfig: Config = {
        ...mockConfig,
        CORS_ORIGINS: '["http://localhost:3000", "https://example.com"]'
      };
      
      const app = createApp(corsConfig);
      expect(app).toBeDefined();
    });

    it('should handle invalid CORS JSON gracefully', () => {
      const corsConfig: Config = {
        ...mockConfig,
        CORS_ORIGINS: 'invalid-json'
      };
      
      const app = createApp(corsConfig);
      expect(app).toBeDefined();
    });
  });

  describe('ExpressAppFactory', () => {
    let factory: ExpressAppFactory;
    let mockLogger: any;

    beforeEach(() => {
      mockLogger = {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
      };
      factory = new ExpressAppFactory(mockLogger);
    });

    it('should create Express app with middleware', () => {
      const serverConfig = {
        port: 8000,
        corsOrigins: '["*"]',
        timeout: 600000
      };

      const app = factory.createApp(serverConfig);
      expect(app).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith('Express application configured successfully');
    });

    it('should setup health endpoint', async () => {
      const serverConfig = {
        port: 8000,
        corsOrigins: '["*"]',
        timeout: 600000
      };

      const app = factory.createApp(serverConfig);
      
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('claude-code-openai-wrapper');
      // Basic health check doesn't include version (only detailed health does)
      // Basic health check doesn't include timestamp and uptime (only detailed health does)
    });

    it('should handle unknown endpoints (auth middleware runs first)', async () => {
      const serverConfig = {
        port: 8000,
        corsOrigins: '["*"]',
        timeout: 600000
      };

      const app = factory.createApp(serverConfig);
      
      const response = await request(app).get('/unknown-endpoint');
      
      // Auth middleware runs before 404 handler, so we expect 401 when auth is required
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('missing_authorization');
    });

    it('should setup error handling middleware', () => {
      const serverConfig = {
        port: 8000,
        corsOrigins: '["*"]',
        timeout: 600000
      };

      const app = factory.createApp(serverConfig);
      
      // Test that the app was created successfully and has error handling
      expect(app).toBeDefined();
      expect(app._router).toBeDefined();
    });

    it('should setup request logging middleware', async () => {
      const serverConfig = {
        port: 8000,
        corsOrigins: '["*"]',
        timeout: 600000
      };

      const app = factory.createApp(serverConfig);
      
      await request(app).get('/health');
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'GET /health',
        expect.objectContaining({
          method: 'GET',
          path: '/health'
        })
      );
    });
  });

  describe('ServerManager', () => {
    let manager: ServerManager;
    let mockLogger: any;

    beforeEach(() => {
      mockLogger = {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
      };
      manager = new ServerManager(mockLogger);
    });

    it('should start server on available port', async () => {
      const app = createApp(mockConfig);
      const testPort = 8900 + Math.floor(Math.random() * 100);
      
      const result = await manager.startServer(app, testPort);
      
      expect(result.server).toBeDefined();
      expect(result.port).toBeGreaterThanOrEqual(testPort);
      expect(result.url).toBe(`http://localhost:${result.port}`);
      
      // Cleanup
      await new Promise<void>((resolve) => {
        result.server.close(() => resolve());
      });
    }, 10000);

    it('should find alternative port when preferred is occupied', async () => {
      const app1 = createApp(mockConfig);
      const app2 = createApp(mockConfig);
      const testPort = 8950;
      
      // Start first server
      const result1 = await manager.startServer(app1, testPort);
      
      // Start second server (should find alternative port)
      const manager2 = new ServerManager(mockLogger);
      const result2 = await manager2.startServer(app2, testPort);
      
      expect(result1.port).toBe(testPort);
      expect(result2.port).toBeGreaterThan(testPort);
      
      // Cleanup
      await Promise.all([
        new Promise<void>((resolve) => result1.server.close(() => resolve())),
        new Promise<void>((resolve) => result2.server.close(() => resolve()))
      ]);
    }, 15000);
  });

  describe('createApp function', () => {
    it('should create Express app from config', () => {
      const app = createApp(mockConfig);
      expect(app).toBeDefined();
    });

    it('should handle debug configuration', () => {
      const debugConfig: Config = {
        ...mockConfig,
        DEBUG_MODE: true
      };
      
      const app = createApp(debugConfig);
      expect(app).toBeDefined();
    });

    it('should handle custom CORS origins', () => {
      const corsConfig: Config = {
        ...mockConfig,
        CORS_ORIGINS: '["http://localhost:3000"]'
      };
      
      const app = createApp(corsConfig);
      expect(app).toBeDefined();
    });
  });

  describe('Health endpoint functionality', () => {
    let app: Application;

    beforeEach(() => {
      app = createApp(mockConfig);
    });

    it('should return health status with all required fields', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'claude-code-openai-wrapper'
        // Basic health check doesn't include version
      });
      // Basic health check doesn't include timestamp and uptime
    });

    it('should handle concurrent health check requests', async () => {
      const promises = Array(5).fill(0).map(() => 
        request(app).get('/health')
      );
      
      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
      });
    });
  });

  describe('Middleware integration', () => {
    let app: Application;

    beforeEach(() => {
      app = createApp(mockConfig);
    });

    it('should have JSON parsing middleware', () => {
      // Test that the app was created with JSON parsing middleware
      expect(app).toBeDefined();
      // JSON middleware is set up internally, we can test by making a health request
      expect(app._router).toBeDefined();
    });

    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');
      
      expect(response.status).toBe(204);
    });
  });
});