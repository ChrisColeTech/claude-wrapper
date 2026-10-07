/**
 * The upstream fixture index (tests/fixtures/upstream/README.md) lists every
 * fixture exactly once, and the seventeen recordings that carried the account
 * email hold the placeholder in its place and no live value.
 */
import * as fs from 'fs';
import * as path from 'path';
import { EMAIL_PLACEHOLDER, LiveValues, readLiveValues } from '../../scripts/upstream-fixtures/live-values';
import { listFiles, readFileText } from '../../scripts/upstream-fixtures/fixture-files';
import { countLiveValues } from '../../scripts/upstream-fixtures/scrub';

const UPSTREAM = path.resolve(__dirname, '..', '..', 'fixtures', 'upstream');
const KINDS = ['frames', 'frames+partial', 'wire', 'transcript', 'result', 'stderr', 'text', 'summary',
  'harness-log', 'hook-log', 'mcp-log', 'run-log', 'input'];

interface Row {
  readonly name: string;
  readonly kind: string;
  readonly shows: string;
  readonly spec: string;
  readonly address: string;
}

function indexRows(): Row[] {
  return fs.readFileSync(path.join(UPSTREAM, 'README.md'), 'utf8').split('\n')
    .filter(line => /^\| `[^`]+\/[^`]+` \|/.test(line))
    .map(line => line.split(' | ').map(cell => cell.replace(/^\|? ?|`| ?\|?$/g, '').trim()))
    .map(([name = '', kind = '', shows = '', spec = '', address = '']) => ({ name, kind, shows, spec, address }));
}

const read = (name: string): string => readFileText(path.join(UPSTREAM, name)).text;

describe('upstream fixture index', () => {
  const rows = indexRows();
  const scrubbed = rows.filter(r => r.address === 'scrubbed').map(r => r.name);

  it('lists every fixture exactly once, and nothing else', () => {
    const files = listFiles(UPSTREAM).filter(f => f !== 'README.md');

    expect(rows.map(r => r.name)).toEqual(files);
  });

  it('gives each fixture a kind, what it shows and a spec section', () => {
    for (const row of rows) {
      expect(KINDS).toContain(row.kind);
      expect(row.shows.length).toBeGreaterThan(10);
      expect(row.spec).toMatch(/^§\d+(\.\d+)?(, §\d+(\.\d+)?)*$/);
    }
  });

  it('marks the seventeen recordings that carried the address, every SDK spike run among them', () => {
    const sdkRuns = listFiles(path.join(UPSTREAM, 'spike-runs')).filter(f => /^sdk-.*\.wire\.ndjson$/.test(f));

    expect(scrubbed).toHaveLength(17);
    expect(sdkRuns).toHaveLength(6);
    expect(scrubbed).toEqual(expect.arrayContaining(sdkRuns.map(f => `spike-runs/${f}`)));
  });

  it('finds the placeholder where the address was in each of the seventeen', () => {
    const placeholder: LiveValues = [{ field: 'emailAddress', value: EMAIL_PLACEHOLDER, placeholder: EMAIL_PLACEHOLDER }];

    for (const name of scrubbed) expect([name, countLiveValues(read(name), placeholder) > 0]).toEqual([name, true]);
  });

  const live = readLiveValues();
  (live ? it : it.skip)('finds no live value in any of the seventeen (skipped without an account file)', () => {
    for (const name of scrubbed) expect([name, countLiveValues(read(name), live ?? [])]).toEqual([name, 0]);
  });
});
