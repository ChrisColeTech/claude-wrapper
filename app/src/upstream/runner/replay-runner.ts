/**
 * The replay runner: `startRun` plays the next recording through the same run core as the spawn
 * runner, so framing, control matching and the spec's timers behave as on a real run. It keeps
 * what each run was started with and written, for tests to assert on.
 */
import { Clock, systemClock } from '../../utils/clock';
import { Recording } from './recording';
import { replayProcess } from './replay-process';
import { createRun, RunLogger } from './run';
import { Run, Runner, RunSpec } from './types';

export interface ReplayOptions {
  /** Drives the recorded timing and the run timers; defaults to the system clock. */
  clock?: Clock;
  /** Multiplies every recorded gap: 1 plays in real time, 0 as fast as the clock allows. */
  timeScale?: number;
  logger?: RunLogger;
}

export interface ReplayedRun {
  readonly spec: RunSpec;
  /** Every stdin line the run wrote, parsed: user messages and control requests. */
  readonly input: unknown[];
}

export interface ReplayRunner extends Runner {
  /** One entry per `startRun`, in order. */
  readonly started: readonly ReplayedRun[];
}

/** Each `startRun` takes the next recording; one more run than recordings throws. */
export function createReplayRunner(recordings: Recording | Recording[], options: ReplayOptions = {}): ReplayRunner {
  const queue = Array.isArray(recordings) ? [...recordings] : [recordings];
  const clock = options.clock ?? systemClock;
  const timeScale = options.timeScale ?? 1;
  if (!(timeScale >= 0 && Number.isFinite(timeScale))) {
    throw new Error(`timeScale must be a finite number of at least 0, got ${timeScale}`);
  }
  const started: ReplayedRun[] = [];

  return {
    started,
    startRun(spec: RunSpec): Run {
      const recording = queue[started.length];
      if (!recording) throw new Error(`the replay runner has no recording for run ${started.length + 1}`);
      const replayed: ReplayedRun = { spec, input: [] };
      started.push(replayed);
      const starter = replayProcess(recording, { clock, timeScale, onInput: line => replayed.input.push(line) });
      return createRun(starter, { timers: spec.timers, clock, ...(options.logger ? { logger: options.logger } : {}) });
    }
  };
}
