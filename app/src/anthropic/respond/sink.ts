/**
 * What both sinks share: the turn stream goes in event by event, and the outcome says how the
 * response ended, so the conductor knows whether the run must be interrupted.
 */
import { ServerResponse } from 'http';
import { SurfaceError } from '../http/surface-error';
import { ApiEvent, FailSignal } from '../translate';

/**
 * What a sink is given: the turn stream's API events and its `fail` signal. The `park` signal is
 * the conductor's (it follows the `message_stop` that has already ended the response).
 */
export type SinkEvent = ApiEvent | FailSignal;

export type SinkOutcome =
  /** The whole message reached the response. */
  | { kind: 'completed' }
  /** Failed before commit: nothing was written; the caller renders `error` as the HTTP error. */
  | { kind: 'rejected'; error: SurfaceError }
  /** Failed after commit: the SSE `error` event was written and the response ended. */
  | { kind: 'failed'; error: SurfaceError }
  /** The client went away before the turn's end. */
  | { kind: 'disconnected' };

export interface TurnSink {
  /** Every turn event, in order; ignored once the outcome has settled. */
  push(event: SinkEvent): void;
  /** Settles once: at `message_stop`, at a `fail`, or when the client disconnects. */
  readonly outcome: Promise<SinkOutcome>;
}

/** Settles the outcome once, and as `disconnected` if the response closes first. */
export class Settlement {
  readonly outcome: Promise<SinkOutcome>;
  private resolve: (outcome: SinkOutcome) => void = () => undefined;
  private settled = false;

  constructor(res: ServerResponse, private readonly onSettle: () => void = () => undefined) {
    this.outcome = new Promise(resolve => { this.resolve = resolve; });
    res.on('close', () => this.settle({ kind: 'disconnected' }));
  }

  get done(): boolean {
    return this.settled;
  }

  settle(outcome: SinkOutcome): void {
    if (this.settled) return;
    this.settled = true;
    this.onSettle();
    this.resolve(outcome);
  }
}
