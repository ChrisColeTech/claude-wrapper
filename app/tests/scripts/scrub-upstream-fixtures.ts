/**
 * Copies the recorded upstream transcripts (the research probes and the
 * spike's runs) into tests/fixtures/upstream, replacing the operator's account
 * email, display name and full name with placeholders, then runs the fixture
 * guard. The live values are read from the CLI's account file now and are
 * never printed. Re-runnable: only new or changed fixtures are written.
 *
 *   npm run fixtures:scrub [-- --account-file <path>]
 */
import * as path from 'path';
import { defaultAccountFile, readLiveValues } from './upstream-fixtures/live-values';
import { FixtureSource, syncUpstreamFixtures } from './upstream-fixtures/sync';
import { checkUpstreamFixtures } from './upstream-fixtures/guard';

const APP_DIR = path.resolve(__dirname, '..', '..');
const EFFORT_DIR = path.resolve(APP_DIR, '..', '.scratch', 'anthropic-compat-api');
const FIXTURE_DIR = path.join(APP_DIR, 'tests', 'fixtures');
const HARNESS_CODE = /\.(py|mjs)$/;

const SOURCES: FixtureSource[] = [
  { dir: path.join(EFFORT_DIR, 'research', 'cli-probes'), group: 'cli-probes', include: name => !HARNESS_CODE.test(name) },
  { dir: path.join(EFFORT_DIR, 'spike', 'runs'), group: 'spike-runs', include: () => true },
];

function accountFileArg(argv: string[]): string {
  const i = argv.indexOf('--account-file');
  return i >= 0 && argv[i + 1] ? path.resolve(argv[i + 1] as string) : defaultAccountFile();
}

function main(): number {
  const values = readLiveValues(accountFileArg(process.argv.slice(2)));
  if (!values) {
    console.error('No CLI account file with an OAuth account was found, so nothing can be scrubbed. Pass --account-file <path>.');
    return 1;
  }
  const report = syncUpstreamFixtures({ sources: SOURCES, upstreamDir: path.join(FIXTURE_DIR, 'upstream'), values });
  report.written.forEach(rel => console.log(`written  ${rel}`));
  console.log(`${report.written.length} written, ${report.unchanged} unchanged, ${report.replaced} live value(s) replaced (${values.length} armed)`);
  const guard = checkUpstreamFixtures({ fixtureDir: FIXTURE_DIR, accountFile: accountFileArg(process.argv.slice(2)) });
  if (guard.status === 'dirty') {
    guard.findings.forEach(f => console.error(`still carries ${f.count} live value(s): ${f.file}`));
    return 1;
  }
  console.log(`Fixture guard: ${guard.status === 'clean' ? `${guard.files} fixtures clean` : guard.notice}`);
  return 0;
}

process.exitCode = main();
