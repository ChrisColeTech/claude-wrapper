import request from 'supertest';
import app from '../../../src/api/server';

describe('Authentication Integration', () => {
  it('should check auth status', async () => {
    const response = await request(app)
      .get('/v1/auth/status')
      .expect(200);
    
    expect(response.body.authenticated).toBe(false);
  });
});