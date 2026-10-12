import { ClaudeResolver } from '../../src/core/claude-resolver';
import { MockConfigManager } from '../../src/config/mock-config';

describe('Claude path caching integration', () => {
  const originalMockMode = process.env['MOCK_MODE'];

  beforeEach(() => {
    process.env['MOCK_MODE'] = 'true';
    MockConfigManager.resetConfig();
  });

  afterAll(() => {
    if (originalMockMode === undefined) delete process.env['MOCK_MODE'];
    else process.env['MOCK_MODE'] = originalMockMode;
    MockConfigManager.resetConfig();
  });

  it('returns a stable path across repeated calls', async () => {
    const resolver = new ClaudeResolver();

    const first = await resolver.findClaudeCommand();
    const second = await resolver.findClaudeCommand();

    expect(first).toBe('/mock/path/to/claude');
    expect(second).toBe(first);
  });

  it('provides the same mock path to independent resolver instances', async () => {
    const first = new ClaudeResolver();
    const second = new ClaudeResolver();

    await expect(first.findClaudeCommand()).resolves.toBe('/mock/path/to/claude');
    await expect(second.findClaudeCommand()).resolves.toBe('/mock/path/to/claude');
  });
});
