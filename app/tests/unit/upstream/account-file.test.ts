/**
 * Where the CLI's account file is (spec section 6): `.claude.json` in `CLAUDE_CONFIG_DIR` when the
 * run's environment sets it, else in the run's home directory. Only paths are computed here; no
 * test reads an operator's account file. (`cliAccountFile` is replaced in test processes by
 * `tests/setup/isolate-cli-account.ts`, so its real one is required directly.)
 */
import * as path from 'path';
import { accountFilePath } from '../../../src/upstream/account-file';

const actual = jest.requireActual<typeof import('../../../src/upstream/account-file')>('../../../src/upstream/account-file');

describe('accountFilePath', () => {
  it("is .claude.json in the run's home directory", () => {
    expect(accountFilePath({ HOME: '/home/operator' })).toBe('/home/operator/.claude.json');
  });

  it('is .claude.json in CLAUDE_CONFIG_DIR when the run sets it', () => {
    expect(accountFilePath({ HOME: '/home/operator', CLAUDE_CONFIG_DIR: '/srv/claude' })).toBe('/srv/claude/.claude.json');
  });

  it("falls back to the user's home directory when the run has no HOME", () => {
    expect(accountFilePath({ CLAUDE_CONFIG_DIR: '' }, '/home/fallback')).toBe('/home/fallback/.claude.json');
  });
});

describe('cliAccountFile', () => {
  const saved = process.env['CLAUDE_CONFIG_DIR'];

  afterEach(() => {
    if (saved === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
    else process.env['CLAUDE_CONFIG_DIR'] = saved;
  });

  it("follows upstream.env, which reaches the run, and not the wrapper's own CLAUDE_CONFIG_DIR, which does not", () => {
    process.env['CLAUDE_CONFIG_DIR'] = '/wrapper/only';

    expect(actual.cliAccountFile({})).toBe(path.join(process.env['HOME'] ?? '', '.claude.json'));
    expect(actual.cliAccountFile({ CLAUDE_CONFIG_DIR: '/srv/claude' })).toBe('/srv/claude/.claude.json');
    expect(actual.cliAccountFile({ HOME: '/home/run' })).toBe('/home/run/.claude.json');
  });
});
