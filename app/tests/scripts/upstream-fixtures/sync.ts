/**
 * Copies recordings into the upstream fixtures directory, scrubbing each one.
 * A source file lands at `<upstreamDir>/<group>/<name>`; a file already in the
 * fixtures directory with no source (a recording saved there directly) is
 * scrubbed in place. A file is written only when its scrubbed bytes differ
 * from what is there, so a re-run changes nothing.
 */
import * as fs from 'fs';
import * as path from 'path';
import { LiveValues } from './live-values';
import { listFiles, readFileText } from './fixture-files';
import { countLiveValues, scrubRecording } from './scrub';

export interface FixtureSource {
  readonly dir: string;
  readonly group: string;
  readonly include: (name: string) => boolean;
}

export interface SyncOptions {
  readonly sources: ReadonlyArray<FixtureSource>;
  readonly upstreamDir: string;
  readonly values: LiveValues;
}

export interface SyncReport {
  /** Fixtures written, relative to the upstream fixtures directory. */
  readonly written: string[];
  readonly unchanged: number;
  /** Live values replaced across every input read. */
  readonly replaced: number;
}

export function syncUpstreamFixtures(options: SyncOptions): SyncReport {
  const inputs = new Map<string, string>();
  for (const rel of listFiles(options.upstreamDir)) inputs.set(rel, path.join(options.upstreamDir, rel));
  for (const source of options.sources) {
    for (const name of listFiles(source.dir).filter(source.include)) {
      inputs.set(path.join(source.group, name), path.join(source.dir, name));
    }
  }
  const written: string[] = [];
  let replaced = 0;
  for (const [rel, input] of [...inputs].sort(([a], [b]) => a.localeCompare(b))) {
    const scrubbed = scrubFile(rel, input, options.values);
    replaced += scrubbed.replaced;
    if (writeIfChanged(path.join(options.upstreamDir, rel), scrubbed.bytes)) written.push(rel);
  }
  return { written, unchanged: inputs.size - written.length, replaced };
}

function scrubFile(rel: string, file: string, values: LiveValues): { bytes: Buffer; replaced: number } {
  const { text, utf8 } = readFileText(file);
  if (utf8) {
    const result = scrubRecording(text, values);
    return { bytes: Buffer.from(result.text, 'utf8'), replaced: result.replaced };
  }
  const count = countLiveValues(text, values);
  if (count > 0) {
    throw new Error(`${rel} is not UTF-8 and carries ${count} live value(s); it cannot be rewritten safely, edit it by hand`);
  }
  return { bytes: fs.readFileSync(file), replaced: 0 };
}

function writeIfChanged(file: string, bytes: Buffer): boolean {
  if (fs.existsSync(file) && fs.readFileSync(file).equals(bytes)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  return true;
}
