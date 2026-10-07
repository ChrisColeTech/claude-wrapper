/**
 * The Jest global setup that runs the fixture guard before the suites.
 * Values are synthetic.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { guardUpstreamFixtures } from '../../setup/upstream-fixtures-guard';

describe('guardUpstreamFixtures (Jest global setup)', () => {
  let dir: string;
  let fixtureDir: string;
  let accountFile: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-setup-'));
    fixtureDir = path.join(dir, 'fixtures');
    accountFile = path.join(dir, '.claude.json');
    fs.mkdirSync(fixtureDir);
    fs.writeFileSync(accountFile, JSON.stringify({ oauthAccount: { emailAddress: 'j.roe@corp.test' } }));
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('refuses to run the suite, naming the fixture and the fix', async () => {
    fs.writeFileSync(path.join(fixtureDir, 'run.jsonl'), '{"text":"J.Roe@corp.test"}\n');

    await expect(guardUpstreamFixtures({ fixtureDir, accountFile }))
      .rejects.toThrow(/npm run fixtures:scrub`:\n {2}run\.jsonl: 1 live value/);
  });

  it('lets the suite run when every fixture is clean', async () => {
    fs.writeFileSync(path.join(fixtureDir, 'run.jsonl'), '{"text":"user@example.invalid"}\n');

    await expect(guardUpstreamFixtures({ fixtureDir, accountFile })).resolves.toBeUndefined();
  });

  it('prints a notice and lets the suite run when there is no account file', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    fs.rmSync(accountFile);

    await expect(guardUpstreamFixtures({ fixtureDir, accountFile })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Fixture guard skipped'));
  });
});
