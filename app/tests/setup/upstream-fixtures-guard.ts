/**
 * Jest global setup: the suite refuses to run while any fixture still carries
 * a live value of the operator's account (read from the CLI's account file).
 * Skips with a notice when there is no account file to read.
 */
import * as path from 'path';
import { checkUpstreamFixtures, GuardOptions } from '../scripts/upstream-fixtures/guard';

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures');

export async function guardUpstreamFixtures(options: GuardOptions = { fixtureDir: FIXTURE_DIR }): Promise<void> {
  const result = checkUpstreamFixtures(options);
  if (result.status === 'skipped') {
    console.warn(`\n${result.notice}`);
    return;
  }
  if (result.status === 'dirty') {
    const files = result.findings.map(f => `  ${f.file}: ${f.count} live value(s)`).join('\n');
    throw new Error(`Fixtures carry the operator's account values; run \`npm run fixtures:scrub\`:\n${files}`);
  }
}

export default function globalSetup(): Promise<void> {
  return guardUpstreamFixtures();
}
