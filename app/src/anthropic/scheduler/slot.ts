/**
 * A lease (spec section 14). A turn that starts a run holds a slot from the moment it may run (a
 * continued turn: once it has waited on its session) until its run has ended, so a slot counts one
 * run in existence, active or parked; a run that never started frees its slot when the lease is
 * released. The slot also marks its run for the session mutex: the next turn on its session waits
 * for the slot to end.
 */
import { Frame } from '../../upstream/frames';
import { TurnPlan } from '../request';
import { Lease, ScheduledRun } from './types';
import { deferred } from './wait';

/** What a slot reports to the scheduler that holds it. */
export interface SlotHost {
  observe(slot: Slot, frame: Frame): void;
  started(slot: Slot, run: ScheduledRun): void;
  /** The run has ended, or the slot was released before a run started. */
  freed(slot: Slot): void;
}

export class Slot implements Lease {
  run: ScheduledRun | undefined;
  /** The upstream sessions the slot's run is on. */
  readonly sessions = new Set<string>();
  private readonly gone = deferred();
  private free = false;

  constructor(readonly requestId: string, public plan: TurnPlan, private readonly host: SlotHost) {}

  /** Settles once the slot is free. */
  get ended(): Promise<void> {
    return this.gone.promise;
  }

  onFrame(frame: Frame): void {
    this.host.observe(this, frame);
  }

  started(run: ScheduledRun): void {
    this.run = run;
    void run.ended.then(() => this.end());
    this.host.started(this, run);
  }

  release(): void {
    if (!this.run) this.end();
  }

  private end(): void {
    if (this.free) return;
    this.free = true;
    this.gone.resolve();
    this.host.freed(this);
  }
}

/** The lease of a turn that answers a parked run: that run already holds a slot. */
export const parkedRunLease = (plan: TurnPlan): Lease => ({
  plan, onFrame: () => undefined, started: () => undefined, release: () => undefined
});
