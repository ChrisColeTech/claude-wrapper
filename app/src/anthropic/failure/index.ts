/**
 * The error module's interface (spec sections 11, 13 and 14): upstream failures mapped by what
 * the client should do (ADR 0005). `createFailureReader` reads one run's frames and maps every
 * way its turn can fail; `mapUpstreamFailure` is the upstream failure table itself.
 */
export { createFailureReader } from './failure-reader';
export type { FailureReader, FailureReaderOptions, FailureTrigger } from './failure-reader';
export { isBillingGate, mapUpstreamFailure } from './map-upstream-failure';
export { retryAfterSeconds } from './retry-after';
export { runFailureError } from './run-failure-error';
export { UPSTREAM_FAILURE_ROWS } from './upstream-table';
export type { FailureRow, MessageRule, UpstreamRowName } from './upstream-table';
export { DETERMINISTIC_CATEGORIES } from './upstream-signal';
export type { FailureContext, UpstreamCategory, UpstreamSignal } from './upstream-signal';
