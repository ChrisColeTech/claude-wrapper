/**
 * The fixture guard: finds live account values in recordings, however they are
 * carried, and refuses fixtures that still hold one. Values are synthetic.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { liveValuesFrom, LiveValues } from '../../scripts/upstream-fixtures/live-values';
import { countLiveValues } from '../../scripts/upstream-fixtures/scrub';
import { checkUpstreamFixtures } from '../../scripts/upstream-fixtures/guard';

const ACCOUNT = { emailAddress: 'j.roe@corp.test', displayName: 'Jane', fullName: 'Jane Roe' };
const values = (): LiveValues => liveValuesFrom(ACCOUNT) ?? [];

const delta = (text: string): string => JSON.stringify({
  type: 'stream_event', parent_tool_use_id: null,
  event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
});

describe('countLiveValues', () => {
  it('finds a value split across text_delta chunks', () => {
    expect(countLiveValues([delta('it is j.r'), delta('oe@corp.te'), delta('st')].join('\n'), values())).toBe(1);
  });

  it('finds a value inside a wire log frame string, escaped or not', () => {
    const frame = JSON.stringify({ type: 'assistant', text: 'Jane' });
    const escaped = JSON.stringify({ t_ms: 1, frame }).replace('Jane', '\\u004a\\u0061ne');

    expect(countLiveValues(escaped, values())).toBe(1);
  });

  it('finds nothing in scrubbed text', () => {
    expect(countLiveValues('user@example.invalid and Example User', values())).toBe(0);
  });
});

describe('checkUpstreamFixtures', () => {
  let dir: string;
  let fixtureDir: string;
  let accountFile: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-guard-'));
    fixtureDir = path.join(dir, 'fixtures');
    accountFile = path.join(dir, '.claude.json');
    fs.mkdirSync(path.join(fixtureDir, 'upstream', 'cli-probes'), { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, 'sample.json'), '{"ok":true}\n');
    fs.writeFileSync(accountFile, JSON.stringify({ numStartups: 3, oauthAccount: ACCOUNT }));
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('passes when no fixture holds a live value', () => {
    fs.writeFileSync(path.join(fixtureDir, 'upstream', 'cli-probes', 'a.jsonl'), delta('user@example.invalid'));

    expect(checkUpstreamFixtures({ accountFile, fixtureDir })).toEqual({ status: 'clean', files: 2 });
  });

  it('names each fixture that holds a live value, with a count and never the value', () => {
    const file = path.join(fixtureDir, 'upstream', 'cli-probes', 'b.jsonl');
    fs.writeFileSync(file, [delta('j.roe@'), delta('corp.test'), delta(' Jane')].join('\n'));

    const result = checkUpstreamFixtures({ accountFile, fixtureDir });

    expect(result).toEqual({ status: 'dirty', findings: [{ file: path.join('upstream', 'cli-probes', 'b.jsonl'), count: 2 }] });
    expect(JSON.stringify(result)).not.toMatch(/roe|jane/i);
  });

  it('scans files that are not UTF-8', () => {
    fs.writeFileSync(path.join(fixtureDir, 'doc.pdf'), Buffer.concat([Buffer.from([0xff, 0xfe, 0x0a]), Buffer.from('Jane')]));

    expect(checkUpstreamFixtures({ accountFile, fixtureDir })).toMatchObject({ status: 'dirty' });
  });

  it('skips with a notice when there is no account file', () => {
    fs.rmSync(accountFile);

    expect(checkUpstreamFixtures({ accountFile, fixtureDir })).toEqual({
      status: 'skipped',
      notice: expect.stringContaining('no CLI account file'),
    });
  });

  it('fails without quoting the account file when it is not valid JSON', () => {
    fs.writeFileSync(accountFile, '{"oauthAccount":{"emailAddress":"j.roe@corp.test",');

    expect(() => checkUpstreamFixtures({ accountFile, fixtureDir })).toThrow(/^The CLI account file is not valid JSON$/);
  });

  it('skips with a notice when the account file has no OAuth account', () => {
    fs.writeFileSync(accountFile, JSON.stringify({ numStartups: 3 }));

    expect(checkUpstreamFixtures({ accountFile, fixtureDir })).toMatchObject({ status: 'skipped' });
  });
});
