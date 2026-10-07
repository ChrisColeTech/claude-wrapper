/**
 * The three run timers (spec section 14) on the injected clock. Startup runs from start to the
 * first `system/init`. Stall is reset by every frame and paused while the run is idle after a
 * `result`, until the next send. Lifetime counts active time from start; parks pause it.
 */
import { Frame } from '../frames';
import { Clock, TimerHandle } from '../../utils/clock';
import { RunTimerName, RunTimers } from './types';

export interface RunTimerSet {
  frame(frame: Frame): void;
  sent(): void;
  park(): () => void;
  stop(): void;
}

interface OneShot {
  arm(ms: number): void;
  clear(): void;
}

const enabled = (ms: number): boolean => Number.isFinite(ms) && ms > 0;

function oneShot(clock: Clock, onFire: () => void): OneShot {
  let handle: TimerHandle | undefined;
  const clear = (): void => {
    if (handle !== undefined) clock.clearTimeout(handle);
    handle = undefined;
  };
  return {
    arm(ms) {
      clear();
      if (enabled(ms)) handle = clock.setTimeout(() => { handle = undefined; onFire(); }, ms);
    },
    clear
  };
}

/** `action` the first time the returned function is called, never again. */
function once(action: () => void): () => void {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    action();
  };
}

/**
 * The active lifetime on `timer`, armed now: every open park pauses it (overlapping parks are
 * counted) and the time spent parked is not counted. Nothing is armed again once `stopped()`.
 */
function activeLifetime(timer: OneShot, clock: Clock, lifetimeMs: number, stopped: () => boolean): () => () => void {
  let parks = 0;
  let left = lifetimeMs;
  let activeSince = clock.now();
  timer.arm(left);
  const unpark = (): void => {
    parks -= 1;
    if (parks > 0 || stopped()) return;
    activeSince = clock.now();
    timer.arm(left);
  };
  return () => {
    parks += 1;
    if (parks === 1) {
      timer.clear();
      left -= clock.now() - activeSince;
    }
    return once(unpark);
  };
}

export function createRunTimers(timers: RunTimers, clock: Clock, fire: (timer: RunTimerName) => void): RunTimerSet {
  let stopped = false;
  const timer = (name: RunTimerName): OneShot => oneShot(clock, () => { if (!stopped) fire(name); });
  const startup = timer('startup');
  const stall = timer('stall');
  const lifetime = timer('lifetime');
  startup.arm(timers.startup);
  stall.arm(timers.stall);
  const park = activeLifetime(lifetime, clock, timers.lifetime, () => stopped);
  let idle = false;

  return {
    frame(frame) {
      if (frame.type === 'system' && frame.subtype === 'init') startup.clear();
      if (frame.type === 'result') {
        idle = true;
        stall.clear();
      } else if (!idle) {
        stall.arm(timers.stall);
      }
    },
    sent() {
      if (!idle) return;
      idle = false;
      stall.arm(timers.stall);
    },
    park,
    stop() {
      stopped = true;
      [startup, stall, lifetime].forEach(t => t.clear());
    }
  };
}
