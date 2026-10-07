/**
 * Parking (spec section 7, ADR 0001): where the conductor holds the runs its turns parked. A
 * parked run is registered in the sessions' parked-run registry under every `tool_use` id its turn
 * returned, so the planner can match the next request's `tool_result` ids, and its park TTL is
 * armed. It leaves parking one of three ways: a request's results complete its park (it is handed
 * back to be resumed), the TTL expires (it is abandoned: interrupted before its waiting calls are
 * rejected), or the run ends on its own (what is left of it is abandoned). A partial answer
 * leaves it parked with its TTL running.
 *
 * This is the scheduler's held-run registry (spec section 16): its count is the run cap's parked
 * count, and the shutdown abandons every run still parked.
 */
import { DeliverOutcome, ToolResultBlock } from '../../upstream/bridge';
import { Clock, TimerHandle } from '../../utils/clock';
import { ParkedRun, ParkedRuns } from '../sessions';

/** What parking needs of a held-open run beside the registry's view of it. */
export interface HeldOpen extends ParkedRun {
  /** The client's results for the park, all or nothing (the bridge's `deliver`). */
  deliver(results: ToolResultBlock[]): DeliverOutcome;
  /** Settles once the run has exited. */
  readonly exited: Promise<void>;
}

/** The outcome of a delivery: `resumed` hands the run back, out of parking; anything else leaves it as it was. */
export type Delivery<R> = { status: 'resumed'; run: R } | Exclude<DeliverOutcome, { status: 'resumed' }>;

export interface Parking<R extends HeldOpen = HeldOpen> {
  /** Holds `run` until a request's results complete its park, its park TTL expires, or it ends. */
  park(run: R): void;
  /** Hands `results` to `parked`; when they complete its park it is taken out of parking and returned. */
  deliver(parked: ParkedRun, results: ToolResultBlock[]): Delivery<R>;
  /** Abandons every parked run (the shutdown): each is interrupted before its waiting calls are rejected. */
  abandonAll(reason: string): void;
  /** Runs parked now. */
  readonly count: number;
}

export interface ParkingLogger {
  info(message: string, context?: unknown): void;
}

export interface ParkingOptions {
  /** The sessions' parked-run registry, which the planner reads. */
  registry: ParkedRuns;
  clock: Clock;
  /** The park TTL (setting `parkTtlMs`). */
  ttlMs: number;
  logger: ParkingLogger;
}

class ParkingLot<R extends HeldOpen> implements Parking<R> {
  private readonly held = new Map<ParkedRun, { run: R; ttl: TimerHandle }>();

  constructor(private readonly options: ParkingOptions) {}

  get count(): number {
    return this.held.size;
  }

  park(run: R): void {
    const { clock, ttlMs, registry, logger } = this.options;
    this.held.set(run, { run, ttl: clock.setTimeout(() => this.expire(run), ttlMs) });
    registry.put(run);
    void run.exited.then(() => this.ended(run));
    logger.info('Run parked', { runId: run.runId, toolUseIds: run.toolUseIds, ttlMs });
  }

  deliver(parked: ParkedRun, results: ToolResultBlock[]): Delivery<R> {
    const entry = this.held.get(parked);
    if (!entry) return { status: 'unknown', unknownIds: results.map(result => result.tool_use_id) };
    const outcome = entry.run.deliver(results);
    if (outcome.status !== 'resumed') return outcome;
    this.release(parked);
    return { status: 'resumed', run: entry.run };
  }

  abandonAll(reason: string): void {
    for (const { run } of [...this.held.values()]) {
      this.release(run);
      this.options.logger.info('Parked run abandoned', { runId: run.runId, toolUseIds: run.toolUseIds, reason });
      void run.abandon(reason);
    }
  }

  private expire(run: R): void {
    if (!this.release(run)) return;
    this.options.logger.info('Park TTL expired: run abandoned', { runId: run.runId, toolUseIds: run.toolUseIds });
    void run.abandon('park TTL expired');
  }

  private ended(run: R): void {
    if (!this.release(run)) return;
    this.options.logger.info('Parked run ended before its results arrived', { runId: run.runId });
    void run.abandon('the run ended while parked');
  }

  /** Takes `run` out of parking; false when it was not parked. */
  private release(run: ParkedRun): boolean {
    const entry = this.held.get(run);
    if (!entry) return false;
    this.options.clock.clearTimeout(entry.ttl);
    this.held.delete(run);
    this.options.registry.remove(run);
    return true;
  }
}

export function createParking<R extends HeldOpen = HeldOpen>(options: ParkingOptions): Parking<R> {
  return new ParkingLot<R>(options);
}
