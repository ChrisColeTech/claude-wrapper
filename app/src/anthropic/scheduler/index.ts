/**
 * The scheduler's interface (spec sections 14 and 16): `createScheduler(options) → Scheduler`,
 * which gates every run the surface starts (`admit → Lease`, `Lease.release()`), holds the parked
 * runs (`registerParked`, `deliver`), drains at `shutdown(deadline)` and counts for `/health`; and
 * the teardown ladder every early end of a run descends.
 */
export { createScheduler, SHUTTING_DOWN } from './scheduler';
export type {
  Admission, Lease, ScheduledRun, Scheduler, SchedulerCounts, SchedulerOptions, SchedulerSettings
} from './types';
export type { Delivery, HeldOpen } from './parking';
export { createTeardown, RESULT_WAIT_MS } from './teardown';
export type { Teardown, TeardownOptions } from './teardown';
