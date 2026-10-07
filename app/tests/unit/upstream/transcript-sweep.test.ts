/**
 * Sweeping upstream's transcripts (spec section 14): a session is its `<id>.jsonl` and its side
 * directory `<id>/`, last written when the newer of the two was. A sweep with a cutoff deletes the
 * sessions last written before it; without one, every session (the orphans an earlier wrapper
 * process left). Anything that is not a session's is left alone.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createTranscriptStore } from '../../../src/upstream/transcripts';

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 7, 12);

describe('sweeping transcripts', () => {
  let projects: string;
  const at = (name: string) => path.join(projects, name);
  const quiet = { warn: jest.fn() };

  function session(id: string, writtenAt: number, sideAt?: number): void {
    fs.writeFileSync(at(`${id}.jsonl`), '{}\n');
    fs.utimesSync(at(`${id}.jsonl`), writtenAt / 1000, writtenAt / 1000);
    if (sideAt === undefined) return;
    fs.mkdirSync(at(id));
    fs.writeFileSync(path.join(at(id), 'subagent.jsonl'), '{}\n');
    fs.utimesSync(at(id), sideAt / 1000, sideAt / 1000);
  }

  beforeEach(() => {
    projects = fs.mkdtempSync(path.join(os.tmpdir(), 'transcript-sweep-'));
  });

  afterEach(() => {
    fs.rmSync(projects, { recursive: true, force: true });
  });

  it('deletes every session without a cutoff, side directories included, and nothing else', () => {
    session('orphan-1', NOW - HOUR, NOW - HOUR);
    session('orphan-2', NOW);
    fs.writeFileSync(at('notes.txt'), 'kept');
    const store = createTranscriptStore(() => projects, quiet);

    expect(store.sweep()).toBe(2);

    expect(fs.readdirSync(projects)).toEqual(['notes.txt']);
  });

  it('deletes only the sessions last written before the cutoff, judged by their newest entry', () => {
    session('stale', NOW - 25 * HOUR, NOW - 25 * HOUR);
    session('fresh', NOW - HOUR);
    session('busy-side', NOW - 30 * HOUR, NOW - HOUR);
    const store = createTranscriptStore(() => projects, quiet);

    expect(store.sweep(NOW - 24 * HOUR)).toBe(1);

    expect(fs.readdirSync(projects).sort()).toEqual(['busy-side', 'busy-side.jsonl', 'fresh.jsonl']);
  });

  it('finds nothing to sweep where upstream has written nothing yet', () => {
    const store = createTranscriptStore(() => path.join(projects, 'never-created'), quiet);

    expect(store.sweep()).toBe(0);
    expect(quiet.warn).not.toHaveBeenCalled();
  });
});
