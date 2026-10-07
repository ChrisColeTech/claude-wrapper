/**
 * Helpers for tests that drive a `Run`.
 */
import { Frame } from '../../../src/upstream/frames';
import { RunFailure } from '../../../src/upstream/runner/run-failure';
import { Run, RunFailureReason, RunTimers } from '../../../src/upstream/runner/types';

/** Every timer disabled. */
export const NO_TIMERS: RunTimers = { startup: 0, stall: 0, lifetime: 0 };

/** Iterates the run's frames to their end. */
export async function collectFrames(run: Run): Promise<Frame[]> {
  const frames: Frame[] = [];
  for await (const frame of run.frames) {
    frames.push(frame);
  }
  return frames;
}

/** Iterates frames until (and including) the first one matching, leaving the rest queued. */
export async function framesUntil(run: Run, match: (frame: Frame) => boolean): Promise<Frame[]> {
  const frames: Frame[] = [];
  for await (const frame of run.frames) {
    frames.push(frame);
    if (match(frame)) break;
  }
  return frames;
}

/** Iterates the frames to their end: the `RunFailure` reason they ended with, else undefined. */
export async function failureOf(run: Run): Promise<RunFailureReason | undefined> {
  try {
    for await (const frame of run.frames) void frame;
  } catch (error) {
    if (error instanceof RunFailure) return error.reason;
    throw error;
  }
  return undefined;
}

/** Lets every pending promise callback run, so a fake-clock test observes what a step settled. */
export function settle(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

/** Reads frames in the background into `seen`; `done` resolves when they end, with what they threw. */
export function consume(run: Run): { seen: Frame[]; done: Promise<unknown> } {
  const seen: Frame[] = [];
  const done = (async () => {
    try {
      for await (const frame of run.frames) seen.push(frame);
    } catch (error) {
      return error;
    }
    return undefined;
  })();
  return { seen, done };
}
