/**
 * Basic server tests
 */
import { createApp } from '../../src/server';

describe('Server', () => {
  it('should create Express app successfully', async () => {
    const app = await createApp();
    expect(app).toBeDefined();
  });
});
