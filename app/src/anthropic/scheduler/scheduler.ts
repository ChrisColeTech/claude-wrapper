/**
 * The scheduler (spec sections 14 and 16), which gates every run the surface starts. A turn is
 * admitted unless the wrapper is shutting down (529), upstream's rate limit is rejecting (429 with
 * `retry-after`) or every slot is taken (529, at once, no queue): one slot per run in existence,
 * active or parked, and a parked run is never evicted to admit a turn. A turn that answers a
 * parked run takes no slot of its own. A continued turn then waits on its session (the session
 * mutex) and is re-planned. The scheduler holds the parked runs, and at shutdown refuses newcomers,
 * fails every turn in flight, abandons every parked run and sends every run down the teardown
 * ladder in parallel, SIGKILLing what is left at the drain's deadline.
 */
import { ToolResultBlock } from '../../upstream/bridge';
import { Frame } from '../../upstream/frames';
import { logger as defaultLogger } from '../../utils/logger';
import { SurfaceError } from '../surface-error';
import { resumedSession, TurnPlan } from '../request';
import { ParkedRun } from '../sessions';
import { createParking, Delivery, HeldOpen, Parking } from './parking';
import { RateLimitGate } from './rate-limit-gate';
import { SessionLocks } from './session-locks';
import { parkedRunLease, Slot, SlotHost } from './slot';
import {
  Admission, Lease, ScheduledRun, Scheduler, SchedulerCounts, SchedulerLogger, SchedulerOptions
} from './types';
import { within } from './wait';

/** What a turn in flight is failed with at shutdown, and why each run goes down the ladder. */
export const SHUTTING_DOWN = 'server shutting down';

const overloaded = (message: string) => SurfaceError.of('overloaded_error', message);

class RunScheduler<R extends HeldOpen> implements Scheduler<R>, SlotHost {
  private readonly slots = new Set<Slot>();
  private readonly parking: Parking<R>;
  private readonly locks: SessionLocks;
  private readonly rateLimit: RateLimitGate;
  private readonly logger: SchedulerLogger;
  private draining: Promise<void> | undefined;

  constructor(private readonly options: SchedulerOptions) {
    const { settings, clock, registry } = options;
    this.logger = options.logger ?? defaultLogger;
    this.parking = createParking<R>({ registry, clock, ttlMs: settings.parkTtlMs, logger: this.logger });
    this.locks = new SessionLocks({ clock, waitMs: settings.continuedTurnWaitMs, logger: this.logger });
    this.rateLimit = new RateLimitGate(clock, this.logger);
  }

  async admit({ requestId, plan, replan }: Admission): Promise<Lease> {
    const refusal = this.refusal(requestId, plan);
    if (refusal) throw refusal;
    if ('parked' in plan.continuation) return parkedRunLease(plan);
    const slot = new Slot(requestId, plan, this);
    this.slots.add(slot);
    try {
      await this.locks.acquire(slot, replan);
    } catch (error) {
      slot.release();
      throw error;
    }
    return slot;
  }

  registerParked(run: R): void {
    if (this.draining) void run.abandon(SHUTTING_DOWN);
    else this.parking.park(run);
  }

  deliver(parked: ParkedRun, results: ToolResultBlock[]): Delivery<R> {
    return this.parking.deliver(parked, results);
  }

  shutdown(deadlineMs = this.options.settings.shutdownDrainMs): Promise<void> {
    this.draining ??= this.drain(deadlineMs);
    return this.draining;
  }

  counts(): SchedulerCounts {
    const parked = this.parking.count;
    return {
      active: Math.max(0, this.slots.size - parked), parked, maxRuns: this.options.settings.maxRuns,
      queued: this.locks.queued(), rateLimit: this.rateLimit.state()
    };
  }

  observe(slot: Slot, frame: Frame): void {
    if (frame.type === 'system' && frame.subtype === 'init') this.locks.bind(slot, frame.session_id);
    if (frame.type !== 'rate_limit_event') return;
    const sessionId = slot.run?.sessionId ?? [...slot.sessions][0];
    this.rateLimit.observe(frame.rate_limit_info, { requestId: slot.requestId, sessionId });
  }

  started(_slot: Slot, run: ScheduledRun): void {
    if (this.draining) this.endForShutdown(run);
  }

  freed(slot: Slot): void {
    this.slots.delete(slot);
    this.locks.unbind(slot);
  }

  /** Why the request is refused now, if it is; logged with its request id and session. */
  private refusal(requestId: string, plan: TurnPlan): SurfaceError | undefined {
    const context = { requestId, sessionId: resumedSession(plan.continuation) };
    if (this.draining) {
      this.logger.info('Shutting down: request refused', context);
      return overloaded('Overloaded: the server is shutting down');
    }
    const rateLimited = this.rateLimit.refusal();
    if (rateLimited) {
      this.logger.warn('Rate-limited: request refused', { ...context, retryAfter: rateLimited.retryAfter });
      return rateLimited;
    }
    const { maxRuns } = this.options.settings;
    if ('parked' in plan.continuation || this.slots.size < maxRuns) return undefined;
    this.logger.warn('Run cap reached: request refused', { ...context, ...this.counts() });
    return overloaded(`Overloaded: the wrapper is running its limit of ${maxRuns} upstream runs`);
  }

  private async drain(deadlineMs: number): Promise<void> {
    this.logger.info('Shutting down: draining upstream runs', { ...this.counts(), deadlineMs });
    this.locks.close(overloaded('Overloaded: the server is shutting down'));
    this.parking.abandonAll(SHUTTING_DOWN);
    this.running().forEach(slot => slot.run && this.endForShutdown(slot.run));
    if (await within(this.allEnded(), deadlineMs, this.options.clock)) return;
    const left = this.running();
    for (const { requestId, run } of left) {
      this.logger.warn('Shutdown drain ran out: run killed', { requestId, runId: run?.runId, sessionId: run?.sessionId });
      run?.kill();
    }
    await Promise.all(left.map(slot => slot.ended));
  }

  /** The slots whose run has started and not ended. */
  private running(): Slot[] {
    return [...this.slots].filter(slot => slot.run);
  }

  /** Settles once no run is left, a run started meanwhile (admitted before the shutdown) included. */
  private async allEnded(): Promise<void> {
    for (let left = this.running(); left.length > 0; left = this.running()) {
      await Promise.all(left.map(slot => slot.ended));
    }
  }

  /** A turn in flight gets the SSE `error` (or, before commit, its HTTP error); the run goes down the ladder. */
  private endForShutdown(run: ScheduledRun): void {
    run.fail(SurfaceError.of('api_error', SHUTTING_DOWN));
    run.stop(SHUTTING_DOWN);
  }
}

export function createScheduler<R extends HeldOpen = HeldOpen>(options: SchedulerOptions): Scheduler<R> {
  return new RunScheduler<R>(options);
}
