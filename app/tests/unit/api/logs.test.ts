import request from 'supertest';
import express from 'express';
import logsRoutes from '../../../src/api/routes/logs';
import { logger, LogLevel } from '../../../src/utils/logger';

describe('Logs API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', logsRoutes);
    
    // Clear logs before each test
    logger.clearLogs();
    
    // Set debug level to ensure http logs are captured
    logger.setLevel(LogLevel.DEBUG);
  });

  afterEach(() => {
    logger.clearLogs();
  });

  describe('GET /logs', () => {
    beforeEach(() => {
      // Add some test logs
      logger.info('Test info message', { test: 'context' });
      logger.error('Test error message', new Error('Test error'));
      logger.debug('Test debug message');
      logger.http('request', 'GET /test', { method: 'GET' }, 'req-123');
    });

    it('should return logs with default parameters', async () => {
      const response = await request(app)
        .get('/logs')
        .expect(200);

      expect(response.body).toHaveProperty('logs');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('filters');
      expect(Array.isArray(response.body.logs)).toBe(true);
      expect(response.body.total).toBeGreaterThan(0);
      expect(response.body.filters.limit).toBe(100);
    });

    it('should filter logs by level', async () => {
      const response = await request(app)
        .get('/logs?level=error')
        .expect(200);

      expect(response.body.logs).toHaveLength(1);
      expect(response.body.logs[0].level).toBe(LogLevel.ERROR);
      expect(response.body.filters.level).toBe('error');
    });

    it('should limit number of logs returned', async () => {
      const response = await request(app)
        .get('/logs?limit=2')
        .expect(200);

      expect(response.body.logs.length).toBeLessThanOrEqual(2);
      expect(response.body.filters.limit).toBe(2);
    });

    it('should filter logs by type', async () => {
      const response = await request(app)
        .get('/logs?type=request')
        .expect(200);

      expect(response.body.logs).toHaveLength(1);
      expect(response.body.logs[0].type).toBe('request');
      expect(response.body.filters.type).toBe('request');
    });

    it('should filter logs by since timestamp', async () => {
      const futureTime = new Date(Date.now() + 1000).toISOString();
      
      const response = await request(app)
        .get(`/logs?since=${futureTime}`)
        .expect(200);

      expect(response.body.logs).toHaveLength(0);
      expect(response.body.filters.since).toBe(futureTime);
    });

    it('should return 400 for invalid limit parameter', async () => {
      await request(app)
        .get('/logs?limit=invalid')
        .expect(400);

      await request(app)
        .get('/logs?limit=0')
        .expect(400);

      await request(app)
        .get('/logs?limit=1001')
        .expect(400);
    });

    it('should return 400 for invalid level parameter', async () => {
      await request(app)
        .get('/logs?level=invalid')
        .expect(400);
    });

    it('should return 400 for invalid type parameter', async () => {
      await request(app)
        .get('/logs?type=invalid')
        .expect(400);
    });

    it('should return 400 for invalid since parameter', async () => {
      await request(app)
        .get('/logs?since=invalid-date')
        .expect(400);
    });

    it('should handle multiple filters', async () => {
      const response = await request(app)
        .get('/logs?level=info&limit=10&type=general')
        .expect(200);

      expect(response.body.filters.level).toBe('info');
      expect(response.body.filters.limit).toBe(10);
      expect(response.body.filters.type).toBe('general');
    });

    it('should serialize error objects properly', async () => {
      const response = await request(app)
        .get('/logs?level=error')
        .expect(200);

      const errorLog = response.body.logs[0];
      expect(errorLog.error).toBeDefined();
      expect(errorLog.error.message).toBe('Test error');
      expect(errorLog.error.name).toBe('Error');
      expect(errorLog.error.stack).toBeDefined();
    });

    it('should return logs in reverse chronological order', async () => {
      logger.info('First message');
      logger.info('Second message');
      
      const response = await request(app)
        .get('/logs?level=info')
        .expect(200);

      // Should have at least the two new messages plus the initial test message
      expect(response.body.logs.length).toBeGreaterThanOrEqual(3);
      
      // Check that logs are in reverse chronological order (newest first)
      const timestamps = response.body.logs.map((log: any) => new Date(log.timestamp).getTime());
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
      }
    });

    it('should handle empty logs', async () => {
      logger.clearLogs();
      
      const response = await request(app)
        .get('/logs')
        .expect(200);

      expect(response.body.logs).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });
  });

  describe('POST /logs/clear', () => {
    beforeEach(() => {
      // Add some test logs
      logger.info('Test message 1');
      logger.error('Test message 2');
      logger.debug('Test message 3');
    });

    it('should clear all logs successfully', async () => {
      // Verify logs exist before clearing
      const beforeResponse = await request(app)
        .get('/logs')
        .expect(200);
      expect(beforeResponse.body.logs.length).toBeGreaterThan(0);

      // Clear logs
      const clearResponse = await request(app)
        .post('/logs/clear')
        .expect(200);

      expect(clearResponse.body.message).toBe('Server logs cleared successfully');
      expect(clearResponse.body.cleared).toBe(true);

      // Verify logs are cleared
      const afterResponse = await request(app)
        .get('/logs')
        .expect(200);
      expect(afterResponse.body.logs.length).toBe(1); // Only the "cleared" log entry
    });

    it('should log the clear operation', async () => {
      await request(app)
        .post('/logs/clear')
        .expect(200);

      const response = await request(app)
        .get('/logs')
        .expect(200);

      // Should have the log entry about clearing
      const clearLog = response.body.logs.find((log: any) => 
        log.message.includes('Server logs cleared')
      );
      expect(clearLog).toBeDefined();
      expect(clearLog.level).toBe(LogLevel.INFO);
    });

    it('should handle clearing already empty logs', async () => {
      logger.clearLogs();
      
      const response = await request(app)
        .post('/logs/clear')
        .expect(200);

      expect(response.body.cleared).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle internal server errors gracefully', async () => {
      // Mock logger.getLogs to throw an error
      const originalGetLogs = logger.getLogs;
      logger.getLogs = jest.fn().mockImplementation(() => {
        throw new Error('Internal error');
      });

      const response = await request(app)
        .get('/logs')
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Internal server error while retrieving logs');
      expect(response.body.error.code).toBe('internal_error');

      // Restore original method
      logger.getLogs = originalGetLogs;
    });

    it('should handle clear logs errors gracefully', async () => {
      // Mock logger.clearLogs to throw an error
      const originalClearLogs = logger.clearLogs;
      logger.clearLogs = jest.fn().mockImplementation(() => {
        throw new Error('Clear error');
      });

      const response = await request(app)
        .post('/logs/clear')
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Internal server error while clearing logs');
      expect(response.body.error.code).toBe('internal_error');

      // Restore original method
      logger.clearLogs = originalClearLogs;
    });
  });
});