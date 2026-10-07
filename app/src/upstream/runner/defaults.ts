/**
 * The spec's default run timers (section 15): startup 20 s, stall 90 s, active lifetime 30 min.
 */
import { RunTimers } from './types';

export const DEFAULT_RUN_TIMERS: Readonly<RunTimers> = Object.freeze({
  startup: 20_000,
  stall: 90_000,
  lifetime: 30 * 60_000
});
