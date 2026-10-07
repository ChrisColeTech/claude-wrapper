/**
 * The failure reader (spec sections 11, 13 and 14), one per run: it reads every frame for what
 * upstream said about a failure, and maps each way a turn can fail with the upstream failure
 * table. It is also the `api_retry` reader: a deterministic category fails the turn at first
 * sight (`failFast`); any other starts the retry cap, which gives up with the last category's
 * error unless a model call produces a frame first.
 */
import { ApiRetryFrame, Frame, ResultFrame } from '../../upstream/frames';
import { RunExit, RunFailureReason } from '../../upstream/runner';
import { Clock, systemClock, TimerHandle } from '../../utils/clock';
import { Logger } from '../../utils/logger';
import { SurfaceError } from '../surface-error';
import { FailureEvidence } from './failure-evidence';
import { jsonSchemaRejection } from './json-schema-rejection';
import { isBillingGate, mapUpstreamFailure } from './map-upstream-failure';
import { retryAfterSeconds } from './retry-after';
import { runFailureError } from './run-failure-error';
import { DETERMINISTIC_CATEGORIES, UpstreamSignal } from './upstream-signal';

/** How a turn failed (spec section 11's triggers, and the runner's own end of a run). */
export type FailureTrigger =
  /** (ii) a failed `result` before the turn's end. */
  | { kind: 'result'; result: ResultFrame }
  /** (i) a `message_start` while the current upstream message still had an open block. */
  | { kind: 'broken_call' }
  /** (iii) the runner ended the run: a timer, an oversized line, a spawn failure. */
  | { kind: 'run_failure'; reason: RunFailureReason }
  /** (iii) the process exited before the turn ended. */
  | { kind: 'exit'; exit: RunExit };

export interface FailureReaderOptions {
  /** What the table needs from the request: the client's `model` (404) and `system` length (billing gate). */
  turn?: { requestedModel?: string; systemLength?: number };
  clock?: Clock;
  /** The retry cap (setting `retryCapMs`); not a positive number: no cap. */
  retryCapMs?: number;
  /** Called once, when the retry cap fires, with the error the last `api_retry` maps to. */
  onGiveUp?: (error: SurfaceError) => void;
  logger?: Pick<Logger, 'warn'>;
}

export interface FailureReader {
  /** Every frame of the run, in order, after the translator has taken it. */
  observe(frame: Frame): void;
  /** The error to fail the turn with at once when `retry` names a deterministic category, else null. */
  failFast(retry: ApiRetryFrame): SurfaceError | null;
  /** The error a turn fails with on `trigger`. */
  errorFor(trigger: FailureTrigger): SurfaceError;
  /** Stops the retry cap; the run has ended. */
  stop(): void;
}

const BROKEN_CALL = "upstream's model call failed after it had streamed content";
const NO_LOGGER: Pick<Logger, 'warn'> = { warn: () => undefined };

class Reader implements FailureReader {
  private readonly evidence = new FailureEvidence();
  private readonly clock: Clock;
  private cap: TimerHandle | undefined;
  private capped = false;
  private gateLogged = false;

  constructor(private readonly options: FailureReaderOptions) {
    this.clock = options.clock ?? systemClock;
  }

  observe(frame: Frame): void {
    this.evidence.observe(frame);
    if (frame.type === 'system' && frame.subtype === 'api_retry' && !DETERMINISTIC_CATEGORIES.has(frame.error)) {
      this.startCap();
    } else if ((frame.type === 'stream_event' && frame.parent_tool_use_id == null) || frame.type === 'result') {
      this.stop();
    }
  }

  failFast(retry: ApiRetryFrame): SurfaceError | null {
    return DETERMINISTIC_CATEGORIES.has(retry.error) ? this.map({ category: retry.error }) : null;
  }

  errorFor(trigger: FailureTrigger): SurfaceError {
    switch (trigger.kind) {
      case 'result':
        return this.map(this.resultSignal(trigger.result));
      case 'broken_call':
        return this.map(this.evidence.retry ? { category: this.evidence.retry.error } : { text: BROKEN_CALL });
      case 'run_failure':
        return runFailureError(trigger.reason);
      case 'exit':
        if (trigger.exit.failure) return runFailureError(trigger.exit.failure);
        return jsonSchemaRejection(trigger.exit.stderr) ?? this.map({ ...this.evidence.signal(), exit: trigger.exit });
    }
  }

  stop(): void {
    if (this.cap !== undefined) this.clock.clearTimeout(this.cap);
    this.cap = undefined;
  }

  private resultSignal(result: ResultFrame): UpstreamSignal {
    const said = this.evidence.signal();
    const text = said.text ?? (typeof result.result === 'string' ? result.result : undefined);
    return { ...said, ...(text ? { text } : {}), apiErrorStatus: result.api_error_status ?? null,
      subtype: result.subtype, errors: result.errors ?? null };
  }

  private map(signal: UpstreamSignal): SurfaceError {
    const { turn = {} } = this.options;
    const retryAfter = retryAfterSeconds(this.evidence.rateLimit, this.clock.now());
    if (isBillingGate(signal) && !this.gateLogged) {
      this.gateLogged = true;
      const systemLength = turn.systemLength ?? 0;
      this.logger.warn('Upstream billing gate: relayed as a 400, never retried', { systemLength });
    }
    return mapUpstreamFailure(signal, {
      ...(turn.requestedModel === undefined ? {} : { requestedModel: turn.requestedModel }),
      ...(retryAfter === undefined ? {} : { retryAfter })
    });
  }

  private startCap(): void {
    const { retryCapMs, onGiveUp } = this.options;
    if (this.cap !== undefined || this.capped || !onGiveUp || !(retryCapMs !== undefined && retryCapMs > 0)) return;
    this.cap = this.clock.setTimeout(() => this.giveUp(onGiveUp), retryCapMs);
  }

  private giveUp(onGiveUp: (error: SurfaceError) => void): void {
    this.cap = undefined;
    this.capped = true;
    const category = this.evidence.retry?.error ?? 'unknown';
    this.logger.warn('Upstream retry loop capped', { category, attempt: this.evidence.retry?.attempt });
    onGiveUp(this.map({ category }));
  }

  private get logger(): Pick<Logger, 'warn'> {
    return this.options.logger ?? NO_LOGGER;
  }
}

export function createFailureReader(options: FailureReaderOptions = {}): FailureReader {
  return new Reader(options);
}
