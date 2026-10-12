import { ClaudeResolver } from '../../src/core/claude-resolver';
import { ClaudeCliError } from '../../src/utils/errors';

describe('real CLI test guard', () => {
  it('routes accidental Claude execution to the cross-platform blocker', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const resolver = new ClaudeResolver();

    try {
      await expect(resolver.executeClaudeCommand('do not spend quota', 'sonnet'))
        .rejects.toEqual(expect.objectContaining<Partial<ClaudeCliError>>({
          name: 'ClaudeCliError',
          message: expect.stringContaining('real CLI blocked in tests')
        }));
    } finally {
      errorLog.mockRestore();
    }
  });
});
