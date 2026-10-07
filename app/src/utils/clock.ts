/**
 * The time source injected into anything that reads the time or schedules a timer
 * (run timers, session expiry, park TTL, ping and sweep intervals), so tests can drive time.
 */

/** Opaque handle from `Clock.setTimeout`; only meaningful to the clock that issued it. */
export type TimerHandle = unknown;

export interface Clock {
  now(): number;
  setTimeout(callback: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
};
