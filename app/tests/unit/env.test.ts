/**
 * Environment configuration tests
 */
import { config } from '../../src/utils/env';

describe('Environment Configuration', () => {
  it('should have default values', () => {
    expect(config.PORT).toBe(8001); // Test environment sets PORT=8001
    expect(config.CORS_ORIGINS).toBe('["*"]');
    expect(config.MAX_TIMEOUT).toBe(600000);
    expect(typeof config.DEBUG_MODE).toBe('boolean');
    expect(typeof config.VERBOSE).toBe('boolean');
  });

  it('should have API_KEY as string or undefined', () => {
    expect(typeof config.API_KEY === 'string' || config.API_KEY === undefined).toBe(true);
  });
});
