/**
 * The sessions module's interface (spec section 16): `createSessions(options) → Sessions`, the
 * in-memory fingerprint map (`lookup`, `record`, `forget`, with idle expiry and LRU capacity, a
 * forget deleting the upstream transcript) and the parked-run registry (`parked`).
 */
export { createSessions } from './sessions';
export type { ParkedRun, ParkedRuns, Sessions, SessionsOptions } from './types';
