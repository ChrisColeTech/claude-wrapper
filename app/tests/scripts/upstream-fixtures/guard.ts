/**
 * The fixture guard: no file in the fixtures directory may carry a live value
 * of the operator's account. Reports which files and how many matches, never
 * the values. Skips when the CLI has no account file or no OAuth account.
 */
import * as path from 'path';
import { defaultAccountFile, readLiveValues } from './live-values';
import { listFiles, readFileText } from './fixture-files';
import { countLiveValues } from './scrub';

export interface Finding {
  readonly file: string;
  readonly count: number;
}

export type GuardResult =
  | { readonly status: 'clean'; readonly files: number }
  | { readonly status: 'dirty'; readonly findings: Finding[] }
  | { readonly status: 'skipped'; readonly notice: string };

export interface GuardOptions {
  readonly fixtureDir: string;
  readonly accountFile?: string;
}

export function checkUpstreamFixtures(options: GuardOptions): GuardResult {
  const values = readLiveValues(options.accountFile ?? defaultAccountFile());
  if (!values) {
    return {
      status: 'skipped',
      notice: 'Fixture guard skipped: no CLI account file, or no OAuth account in it, so there are no live values to look for.',
    };
  }
  const files = listFiles(options.fixtureDir);
  const findings = files
    .map(file => ({ file, count: countLiveValues(readFileText(path.join(options.fixtureDir, file)).text, values) }))
    .filter(f => f.count > 0);
  return findings.length ? { status: 'dirty', findings } : { status: 'clean', files: files.length };
}
