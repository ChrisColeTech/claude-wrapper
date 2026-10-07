/**
 * One run, pumped from start to exit (spec sections 11 and 14): the turn's user message goes in,
 * every frame goes through the startup checks and the translator into the sink, stdin is closed
 * once `result` is in, and the frames are read to the end after the response has ended, so
 * `result` and the exit are logged without the client waiting for them. A run that ends before
 * the turn did fails the turn, mapped by the run's failure reader: at once when the runner
 * ended the run (a timer, an oversized line), else once upstream has exited. A turn the
 * translator cut at an output limit stops the run. This is the run's only reader of its frames.
 */
import { Frame, ResultFrame, SystemInitFrame } from '../../upstream/frames';
import { Run, RunFailure, UserMessage } from '../../upstream/runner';
import { Clock, TimerHandle } from '../../utils/clock';
import { FailureReader } from '../failure';
import { SurfaceError } from '../http/surface-error';
import { StartupChecks } from '../request';
import { TurnSink } from '../respond';
import { Translator, TurnEvent } from '../translate';
import { startupError } from './startup-checks';

export interface PumpLogger {
  debug(message: string, context?: unknown): void;
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
}

/** Sees every frame of the run, in order, before the translator does. */
export interface FrameObserver {
  onFrame(frame: Frame): void;
}

export interface PumpOptions {
  /** Fed every frame; built with the same `failures`. */
  translator: Translator;
  /** The run's failure reader: maps a run that ends before the turn did, and is stopped at exit. */
  failures: FailureReader;
  sink: TurnSink;
  checks: StartupChecks;
  clock: Clock;
  /** Carries the request id; never given the run spec. */
  logger: PumpLogger;
  /** The turn's other readers of the frames (its session bookkeeping, a bridge). */
  observers?: readonly FrameObserver[];
}

export interface RunPump {
  /** The turn ended early: interrupt unless `result` is in; stdin closes at `result`, or after the wait. */
  stop(): void;
  /** Settles once upstream has exited and the exit is logged. */
  readonly done: Promise<void>;
}

/** How long a stopped run gets to write its `result` before its stdin is closed (spec section 14). */
export const RESULT_WAIT_MS = 5_000;

class Pump implements RunPump {
  readonly done: Promise<void>;
  private sawInit = false;
  private sawResult = false;
  private stopped = false;
  private exited = false;
  private closeTimer: TimerHandle | undefined;

  constructor(private readonly run: Run, message: UserMessage, private readonly options: PumpOptions) {
    run.send(message).catch((error: Error) =>
      options.logger.debug("Upstream did not take the turn's message", { error: error.message }));
    void run.exited.then(() => {
      this.exited = true;
      if (this.closeTimer !== undefined) options.clock.clearTimeout(this.closeTimer);
    });
    this.done = this.pump();
  }

  stop(): void {
    if (this.stopped || this.exited) return;
    this.stopped = true;
    if (this.sawResult) return;
    this.run.interrupt().catch(() => undefined);
    this.closeTimer = this.options.clock.setTimeout(() => void this.run.close(), RESULT_WAIT_MS);
  }

  private async pump(): Promise<void> {
    try {
      for await (const frame of this.run.frames) this.onFrame(frame);
      this.toSink(this.options.translator.end());
    } catch (error) {
      if (!(error instanceof RunFailure)) this.abandon(error);
      else this.fail(this.options.failures.errorFor({ kind: 'run_failure', reason: error.reason }));
    }
    const exit = await this.run.exited;
    this.options.failures.stop();
    this.fail(this.options.failures.errorFor({ kind: 'exit', exit }));
    this.options.logger.info('Upstream run exited', { code: exit.code, signal: exit.signal, failure: exit.failure });
  }

  private onFrame(frame: Frame): void {
    this.options.observers?.forEach(observer => observer.onFrame(frame));
    if (frame.type === 'system' && frame.subtype === 'init' && !this.sawInit) this.onInit(frame);
    this.toSink(this.options.translator.push(frame));
    if (frame.type === 'result' && !this.sawResult) this.onResult(frame);
  }

  private onInit(init: SystemInitFrame): void {
    this.sawInit = true;
    this.options.logger.info('Upstream run started', { sessionId: init.session_id, model: init.model });
    const error = startupError(init, this.options.checks);
    if (error) this.fail(error);
  }

  private onResult(result: ResultFrame): void {
    this.sawResult = true;
    this.options.logger.info('Upstream result', {
      sessionId: result.session_id, subtype: result.subtype, isError: result.is_error,
      stopReason: result.stop_reason, numTurns: result.num_turns, durationMs: result.duration_ms
    });
    void this.run.close();
  }

  /** A fault in the wrapper itself: fail the turn and stop the run. */
  private abandon(error: unknown): void {
    this.options.logger.warn('Turn abandoned on an internal error', { error: String(error) });
    this.fail(new SurfaceError(500, 'api_error', 'Internal server error'));
    this.stop();
  }

  /** Ignored by a sink whose outcome has settled. */
  private fail(error: SurfaceError): void {
    this.options.sink.push({ type: 'fail', error });
  }

  /** A `cut` ends the turn at once: the run is interrupted before upstream calls the model again. */
  private toSink(events: TurnEvent[]): void {
    events.forEach(event => {
      this.options.sink.push(event);
      if (event.type === 'cut') this.stop();
    });
  }
}

/** Sends `message` and pumps the run's frames into `options.sink` until upstream exits. */
export function pumpRun(run: Run, message: UserMessage, options: PumpOptions): RunPump {
  return new Pump(run, message, options);
}
