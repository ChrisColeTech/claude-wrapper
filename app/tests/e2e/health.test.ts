import request from 'supertest';
import { createServer } from '../../src/api/server';

describe('E2E Health Tests', () => {
  let app: any;

  beforeEach(() => {
    app = createServer();
  });

  it('should return healthy status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toEqual({
      status: 'healthy',
      service: 'claude-wrapper',
      version: expect.any(String),
      description: expect.any(String),
      timestamp: expect.any(String),
      mock_mode: expect.any(Boolean)
    });
  });

  it('should return models list', async () => {
    const response = await request(app)
      .get('/v1/models')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body.data.length).toBeGreaterThan(0);
  });
});