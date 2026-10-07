/**
 * Upstream fixtures for replay tests: a recording to hand the replay runner, and, read
 * independently of the replay code, what upstream wrote on stdout in that recording.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Frame } from '../../../src/upstream/frames';
import { parseRecording, Recording } from '../../../src/upstream/runner';

export const UPSTREAM_FIXTURES = path.resolve(__dirname, '..', '..', 'fixtures', 'upstream');

const read = (name: string): string => fs.readFileSync(path.join(UPSTREAM_FIXTURES, name), 'utf8');
const lines = (text: string): string[] => text.split('\n').filter(line => line.trim() !== '');

/** A fixture under `tests/fixtures/upstream/`, by its path in the fixture index. */
export function loadRecording(name: string): Recording {
  return parseRecording(read(name));
}

/** The stdout frames of a fixture, parsed straight from the file. */
export function recordedStdout(name: string): unknown[] {
  if (!name.endsWith('.wire.ndjson')) {
    return lines(read(name)).map(line => JSON.parse(line));
  }
  return lines(read(name))
    .map(line => JSON.parse(line) as { dir: string; frame?: string; line?: string })
    .filter(entry => entry.dir === 'cli->host')
    .map(entry => JSON.parse(entry.frame ?? entry.line ?? ''));
}

/** A wire fixture's timing: when the user message went in, and when each stdout frame came out. */
export function recordedTimeline(name: string): { userAtMs: number; stdoutAtMs: number[] } {
  const entries = lines(read(name))
    .map(line => JSON.parse(line) as { t_ms: number; dir: string; frame?: unknown; line?: unknown });
  const user = entries.find(entry => entry.dir === 'host->cli'
    && String(entry.frame ?? entry.line).startsWith('{"type":"user"'));
  return {
    userAtMs: user ? user.t_ms : NaN,
    stdoutAtMs: entries.filter(entry => entry.dir === 'cli->host').map(entry => entry.t_ms)
  };
}

/** A replayed frame as upstream wrote it (an unknown frame unwrapped). */
export function asUpstreamWrote(frame: Frame): unknown {
  return frame.type === 'unknown' ? frame.raw : frame;
}
