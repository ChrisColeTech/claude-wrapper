/**
 * The teardown ladder (spec section 14) for every early end of a run (a disconnect, a cut, a
 * failure, a park TTL, the shutdown): `control_request interrupt` → up to 5 s for upstream's
 * `result` → stdin closed → up to 2 s for the exit → SIGTERM → up to 5 s → SIGKILL. The steps from
 * the closed stdin down are the run's own `close()`. A run whose `result` is in has nothing left to
 * interrupt: its stdin closes at once, which is also what ends every run after its `result`. A run
 * the runner ended itself (a timer, a line too long) is already on the same ladder in the runner;
 * descending it as well only interrupts it again (through the bridge, rejecting its waiting calls).
 */
import { RESULT_WAIT_MS, Run } from '../../upstream/runner';
import { Clock, TimerHandle } from '../../utils/clock';

/** How long a run on the ladder gets to write its `result` before its stdin is closed: the runner's own wait. */
export { RESULT_WAIT_MS };

export interface TeardownOptions {
  clock: Clock;
  /**
   * Interrupts the run; defaults to `run.interrupt()`. A bridged run interrupts through its
   * bridge, which then rejects the tool calls waiting on it.
   */
  interrupt?: (reason: string) => Promise<unknown>;
}

export interface Teardown {
  /** Upstream's `result` is in: stdin closes now (a run on the ladder stops waiting for it). */
  resultIn(): void;
  /** Starts down the ladder; once only. */
  descend(reason: string): void;
}

class Ladder implements Teardown {
  private result = false;
  private descending = false;
  private exited = false;
  private wait: TimerHandle | undefined;

  constructor(private readonly run: Run, private readonly options: TeardownOptions) {
    void run.exited.then(() => {
      this.exited = true;
      this.clearWait();
    });
  }

  resultIn(): void {
    this.result = true;
    this.clearWait();
    void this.run.close();
  }

  descend(reason: string): void {
    if (this.descending || this.exited) return;
    this.descending = true;
    if (this.result) return;
    const interrupt = this.options.interrupt ?? (() => this.run.interrupt());
    interrupt(reason).catch(() => undefined);
    this.wait = this.options.clock.setTimeout(() => void this.run.close(), RESULT_WAIT_MS);
  }

  private clearWait(): void {
    if (this.wait !== undefined) this.options.clock.clearTimeout(this.wait);
    this.wait = undefined;
  }
}

export function createTeardown(run: Run, options: TeardownOptions): Teardown {
  return new Ladder(run, options);
}
