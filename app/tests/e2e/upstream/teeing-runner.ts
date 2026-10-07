/**
 * The production spawn runner, noting each run's spec and keeping every frame upstream yields, so
 * a real-CLI scenario can check what the surface spawned and what upstream said behind the
 * response, and record it (`recordFrames`). Real CLI only: use it behind `describeUpstream`.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Frame } from '../../../src/upstream/frames';
import { createSpawnRunner, Run, Runner, RunSpec } from '../../../src/upstream/runner';

export interface TeedRun {
  spec: RunSpec;
  /** Every frame the surface has read so far, in order. */
  frames: Frame[];
}

export interface TeeingRunner extends Runner {
  /** One entry per run started, in order. */
  readonly runs: TeedRun[];
}

/** `run`, with every frame it yields also kept in `frames`. */
function teed(run: Run, frames: Frame[]): Run {
  const source = run.frames[Symbol.asyncIterator]();
  const iterator: AsyncIterator<Frame> = {
    next: async () => {
      const next = await source.next();
      if (!next.done) frames.push(next.value);
      return next;
    }
  };
  return {
    frames: { [Symbol.asyncIterator]: () => iterator },
    send: message => run.send(message),
    interrupt: () => run.interrupt(),
    close: () => run.close(),
    kill: () => run.kill(),
    park: () => run.park(),
    exited: run.exited
  };
}

export function teeingRunner(): TeeingRunner {
  const runner = createSpawnRunner();
  const runs: TeedRun[] = [];
  return {
    runs,
    startRun(spec) {
      const entry = { spec, frames: [] };
      runs.push(entry);
      return teed(runner.startRun(spec), entry.frames);
    }
  };
}

/** The main thread's model calls upstream started (`message_start` frames). */
export const modelCallStarts = (frames: readonly Frame[]): number =>
  frames.filter(frame => frame.type === 'stream_event' && frame.parent_tool_use_id == null &&
    frame.event.type === 'message_start').length;

/** Upstream's session id, from `system/init`. */
export function sessionOf(frames: readonly Frame[]): string | undefined {
  const init = frames.find(frame => frame.type === 'system' && frame.subtype === 'init');
  return init?.type === 'system' && init.subtype === 'init' ? init.session_id : undefined;
}

/**
 * Writes a run's frames as upstream wrote them, one per line, to `<name>.jsonl` in
 * `UPSTREAM_E2E_RECORD_DIR` when that is set; the file's path, else undefined. A recording carries
 * the account's values until it is scrubbed (`npm run fixtures:scrub`) into the fixtures.
 */
export function recordFrames(name: string, frames: readonly Frame[]): string | undefined {
  const dir = process.env['UPSTREAM_E2E_RECORD_DIR'];
  if (!dir) return undefined;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.jsonl`);
  fs.writeFileSync(file, frames.map(frame => JSON.stringify(frame.type === 'unknown' ? frame.raw : frame)).join('\n') + '\n');
  return file;
}
