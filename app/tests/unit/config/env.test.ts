import { EnvironmentManager } from '../../../src/config/env';
import { MockConfigManager } from '../../../src/config/mock-config';

describe('EnvironmentManager mock mode', () => {
  const originalNodeEnv = process.env['NODE_ENV'];
  const originalMockMode = process.env['MOCK_MODE'];

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = originalNodeEnv;
    if (originalMockMode === undefined) delete process.env['MOCK_MODE'];
    else process.env['MOCK_MODE'] = originalMockMode;
    MockConfigManager.resetConfig();
  });

  it('delegates explicit mock mode configuration', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['MOCK_MODE'] = 'true';
    MockConfigManager.resetConfig();

    expect(EnvironmentManager.isMockMode()).toBe(true);
  });

  it('disables mock mode in normal production configuration', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['MOCK_MODE'];
    MockConfigManager.resetConfig();

    expect(EnvironmentManager.isMockMode()).toBe(false);
  });
});
