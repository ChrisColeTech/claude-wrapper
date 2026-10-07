/**
 * The runs the conductor drives (spec sections 7 and 14, ADR 0001): a `ConductedRun` is one run
 * across the turns of a tool loop; a `HeldRun` is such a run parked on one turn's client
 * `tool_use` ids, held open (its lifetime timer paused) until a request answers them or the park
 * is abandoned.
 */
import { Bridge, DeliverOutcome, ToolResultBlock } from '../../upstream/bridge';
import { Run } from '../../upstream/runner';
import { FailureReader } from '../failure';
import { RunBound, RunContinuation, TurnPlan } from '../request';
import { HeldOpen, Lease } from '../scheduler';
import { PumpLogger, RunPump } from './run-pump';

/** One run the conductor drives, across the turns of a tool loop. */
export interface ConductedRun {
  readonly runId: string;
  readonly run: Run;
  readonly pump: RunPump;
  /** The run's failure reader; every turn's translator is built with it. */
  readonly failures: FailureReader;
  /** The bridge's state machine, when the run exposes client tools. */
  readonly bridge: Bridge | undefined;
  /** What the run was spawned with. */
  readonly runBound: RunBound;
  /** The plan the run was started for: as admitted, or re-planned after waiting on its session. */
  readonly plan: TurnPlan & { continuation: RunContinuation };
  /** The run's slot: released when a turn of it ends without parking; given back once it has ended. */
  readonly lease: Lease;
  /** Runs `hook` once upstream has exited, before the run gives its slot back (a turn's session bookkeeping). */
  atExit(hook: () => void): void;
}

export interface HeldRunOptions {
  /** Forgets an upstream session (the sessions' `forget`). */
  forget(sessionId: string): void;
  logger: PumpLogger;
}

export class HeldRun implements HeldOpen {
  readonly exited: Promise<void>;
  private readonly unpark: () => void;

  constructor(
    readonly conducted: ConductedRun, private readonly bridge: Bridge, readonly toolUseIds: readonly string[],
    private readonly options: HeldRunOptions
  ) {
    this.unpark = conducted.run.park();
    this.exited = conducted.pump.done.catch(() => undefined);
  }

  get runId(): string {
    return this.conducted.runId;
  }

  /** Upstream's session, which the run continues. */
  get sessionId(): string | undefined {
    return this.conducted.pump.sessionId;
  }

  /** All or nothing; once they complete the park the run is active again (its lifetime timer runs). */
  deliver(results: ToolResultBlock[]): DeliverOutcome {
    const outcome = this.bridge.deliver(results);
    if (outcome.status === 'resumed') this.unpark();
    return outcome;
  }

  /**
   * Interrupts the run before its waiting calls are rejected (the pump's stop goes through the
   * bridge), closes it once it has had its chance to write `result` (its `error_during_execution`
   * end is the expected one), and forgets its upstream session at once and again at exit.
   */
  abandon(reason: string): Promise<void> {
    this.options.logger.info('Parked run abandoned', { runId: this.runId, sessionId: this.sessionId, reason });
    this.unpark();
    this.conducted.pump.stop(reason);
    this.forget();
    return this.exited.then(() => this.forget());
  }

  private forget(): void {
    const { sessionId } = this;
    if (sessionId !== undefined) this.options.forget(sessionId);
  }
}
