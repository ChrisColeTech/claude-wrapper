/**
 * The scheduler's interface (spec sections 14 and 16): `admit(plan) → Lease` gates every run the
 * surface starts (the run cap, rate-limit admission, the per-session mutex with its re-plan),
 * `Lease.release()`, `registerParked(run)` and `shutdown(deadline)`; it holds the parked runs and
 * exposes its counts for `/health`.
 */
import { ToolResultBlock } from '../../upstream/bridge';
import { Frame } from '../../upstream/frames';
import { Clock } from '../../utils/clock';
import { SurfaceError } from '../surface-error';
import { TurnPlan } from '../request';
import { ParkedRun, ParkedRuns } from '../sessions';
import { Delivery, HeldOpen } from './parking';

export interface SchedulerSettings {
  /** Runs in existence, active plus parked. */
  maxRuns: number;
  /** How long a continued turn waits for its session's previous run to exit before SIGKILL. */
  continuedTurnWaitMs: number;
  /** How long the shutdown drains before SIGKILL. */
  shutdownDrainMs: number;
  /** How long a parked run waits for the client's results. */
  parkTtlMs: number;
}

export interface SchedulerLogger {
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
}

export interface SchedulerOptions {
  settings: SchedulerSettings;
  clock: Clock;
  /** The sessions' parked-run registry, which the planner reads. */
  registry: ParkedRuns;
  logger?: SchedulerLogger;
}

/** One request asking to be served. */
export interface Admission {
  /** For logs. */
  requestId: string;
  plan: TurnPlan;
  /** Plans the request again against the sessions as they are now, once it has waited on its session. */
  replan(): TurnPlan;
}

/** A started run as the scheduler sees it. */
export interface ScheduledRun {
  readonly runId: string;
  /** Upstream's session id once `system/init` is in. */
  readonly sessionId: string | undefined;
  /** Settles once upstream has exited and every turn of the run has settled its session. */
  readonly ended: Promise<void>;
  /** Fails the turn the run is serving: before commit its HTTP error, after it the SSE `error`. */
  fail(error: SurfaceError): void;
  /** Sends the run down the teardown ladder. */
  stop(reason: string): void;
  /** SIGKILL. */
  kill(): void;
}

/** An admitted turn's hold on the scheduler: for a turn that starts a run, its slot. */
export interface Lease {
  /** What to serve: the admitted plan, or the re-plan made after waiting on its session. */
  readonly plan: TurnPlan;
  /** Feeds the lease every frame of its run: its upstream session, and upstream's rate-limit state. */
  onFrame(frame: Frame): void;
  /** The admitted run has started; its slot is given back once it has ended. */
  started(run: ScheduledRun): void;
  /** The turn is over and did not park. A lease whose run never started gives its slot back here. */
  release(): void;
}

/** What `/health` shows of the scheduler. */
export interface SchedulerCounts {
  active: number;
  parked: number;
  maxRuns: number;
  /** Turns waiting on each upstream session that has any. */
  queued: Record<string, number>;
  /** Upstream's last `rate_limit_event`, if any. */
  rateLimit: { status: string; resetsAt?: number; rateLimitType?: string } | null;
}

export interface Scheduler<R extends HeldOpen = HeldOpen> {
  /**
   * Admits a turn, or rejects with the `SurfaceError` to answer: 529 at shutdown or at the run cap,
   * 429 while upstream's rate limit is rejecting. A continued turn queues behind its session's
   * earlier turns, holding no slot, and waits up to the continued-turn wait for the session's
   * previous run to exit (parked or not; it is evicted then); it is re-planned and admitted again.
   */
  admit(admission: Admission): Promise<Lease>;
  /** Holds a run its turn parked until the client answers it, its park TTL expires, or it ends. */
  registerParked(run: R): void;
  /** Hands the client's results to a parked run; when they complete its park it is returned, active again. */
  deliver(parked: ParkedRun, results: ToolResultBlock[]): Delivery<R>;
  /** Refuses new turns and drains every run within `deadlineMs` (the setting by default), then SIGKILLs the rest. */
  shutdown(deadlineMs?: number): Promise<void>;
  counts(): SchedulerCounts;
}
