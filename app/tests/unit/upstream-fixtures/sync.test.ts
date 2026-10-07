/**
 * The scrub script's copy step: recordings are copied from their source
 * directories into the upstream fixtures directory, scrubbed on the way, and a
 * re-run touches only what changed. Values are synthetic.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { liveValuesFrom, LiveValues } from '../../scripts/upstream-fixtures/live-values';
import { FixtureSource, syncUpstreamFixtures } from '../../scripts/upstream-fixtures/sync';

const values = (): LiveValues => liveValuesFrom({ emailAddress: 'j.roe@corp.test', fullName: 'Jane Roe' }) ?? [];

describe('syncUpstreamFixtures', () => {
  let dir: string;
  let probes: string;
  let upstreamDir: string;
  let sources: FixtureSource[];
  const write = (file: string, content: string | Buffer): void => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  const read = (rel: string): string => fs.readFileSync(path.join(upstreamDir, rel), 'utf8');

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-sync-'));
    probes = path.join(dir, 'research', 'cli-probes');
    upstreamDir = path.join(dir, 'fixtures', 'upstream');
    sources = [{ dir: probes, group: 'cli-probes', include: name => !name.endsWith('.py') }];
    write(path.join(probes, 'r3.jsonl'), '{"type":"result","result":"Mail j.roe@corp.test"}\n');
    write(path.join(probes, 'r3.stderr.txt'), 'exit 0\n');
    write(path.join(probes, 'harness.py'), 'print("j.roe@corp.test")\n');
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('copies the included recordings into their group, scrubbed', () => {
    const report = syncUpstreamFixtures({ sources, upstreamDir, values: values() });

    expect(report).toEqual({ written: ['cli-probes/r3.jsonl', 'cli-probes/r3.stderr.txt'], unchanged: 0, replaced: 1 });
    expect(read('cli-probes/r3.jsonl')).toBe('{"type":"result","result":"Mail user@example.invalid"}\n');
    expect(read('cli-probes/r3.stderr.txt')).toBe('exit 0\n');
    expect(fs.existsSync(path.join(upstreamDir, 'cli-probes', 'harness.py'))).toBe(false);
  });

  it('writes nothing on a re-run, and only a new recording after one is added', () => {
    syncUpstreamFixtures({ sources, upstreamDir, values: values() });

    expect(syncUpstreamFixtures({ sources, upstreamDir, values: values() }))
      .toEqual({ written: [], unchanged: 2, replaced: 1 });

    write(path.join(probes, 'r7.jsonl'), '{"type":"result","result":"Jane Roe"}\n');
    expect(syncUpstreamFixtures({ sources, upstreamDir, values: values() }).written).toEqual(['cli-probes/r7.jsonl']);
  });

  it('scrubs, in place, a recording saved straight into the fixtures directory', () => {
    write(path.join(upstreamDir, 'e2e', 'live.jsonl'), '{"type":"result","result":"JANE ROE"}\n');

    const report = syncUpstreamFixtures({ sources, upstreamDir, values: values() });

    expect(report.written).toContain('e2e/live.jsonl');
    expect(read('e2e/live.jsonl')).toBe('{"type":"result","result":"Example User"}\n');
  });

  it('copies a file that is not UTF-8 byte for byte', () => {
    const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]);
    write(path.join(probes, 'doc.pdf'), pdf);

    syncUpstreamFixtures({ sources, upstreamDir, values: values() });

    expect(fs.readFileSync(path.join(upstreamDir, 'cli-probes', 'doc.pdf')).equals(pdf)).toBe(true);
  });

  it('refuses a file that is not UTF-8 and carries a live value', () => {
    write(path.join(probes, 'doc.pdf'), Buffer.concat([Buffer.from([0xff, 0x0a]), Buffer.from('Jane Roe')]));

    expect(() => syncUpstreamFixtures({ sources, upstreamDir, values: values() }))
      .toThrow('cli-probes/doc.pdf is not UTF-8 and carries 1 live value');
  });
});
